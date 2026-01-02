/**
 * Content Update Service
 * 
 * Handles automatic and manual content updates,
 * change detection, and re-indexing queue management.
 */

import { supabaseClient } from './supabase-client.js';
import { embeddingService } from './embedding-service.js';

class ContentUpdateService {
    constructor() {
        this.updateQueue = [];
        this.processing = false;
    }

    /**
     * Detect content changes for a course
     * @param {string} courseId - Course identifier
     * @returns {Promise<Array<Object>>} Array of changed chunks
     */
    async detectContentChanges(courseId) {
        try {
            // Get current course content
            const { getCourses } = await import('../../data/courses.js');
            const courses = await getCourses();
            const course = courses.find(c => c.id === courseId);

            if (!course) {
                throw new Error(`Course not found: ${courseId}`);
            }

            // Get indexed chunks
            const { data: indexedChunks } = await supabaseClient
                .from('ai_coach_content_chunks')
                .select('*')
                .eq('course_id', courseId);

            if (!indexedChunks || indexedChunks.length === 0) {
                // No indexed chunks, all content is new
                return { changed: [], new: true };
            }

            // Extract current chunks
            const currentChunks = embeddingService.extractChunks(course);
            const changed = [];

            // Create map of indexed chunks by key
            const indexedMap = new Map();
            indexedChunks.forEach(chunk => {
                const key = `${chunk.day}_${chunk.chapter_id}_${chunk.lab_id || ''}`;
                indexedMap.set(key, chunk);
            });

            // Compare current chunks with indexed
            for (const currentChunk of currentChunks) {
                const key = `${currentChunk.day}_${currentChunk.chapter_id}_${currentChunk.lab_id || ''}`;
                const indexedChunk = indexedMap.get(key);
                
                if (!indexedChunk) {
                    // New chunk
                    changed.push({ ...currentChunk, changeType: 'new' });
                } else {
                    // Check if content changed
                    const currentHash = await embeddingService.calculateContentHash(currentChunk.content);
                    if (indexedChunk.content_hash !== currentHash) {
                        changed.push({ ...currentChunk, changeType: 'updated', existingId: indexedChunk.id });
                    }
                }
            }

            // Check for deleted chunks (indexed but not in current)
            const currentKeys = new Set(currentChunks.map(c => 
                `${c.day}_${c.chapter_id}_${c.lab_id || ''}`
            ));
            const deleted = indexedChunks.filter(chunk => {
                const key = `${chunk.day}_${chunk.chapter_id}_${chunk.lab_id || ''}`;
                return !currentKeys.has(key);
            });

            return {
                changed,
                deleted,
                new: false
            };
        } catch (error) {
            console.error('[ContentUpdateService] Error detecting content changes:', error);
            throw error;
        }
    }

    /**
     * Trigger re-indexing for a course
     * @param {string} courseId - Course identifier
     * @param {string} updateType - 'full', 'incremental', 'manual'
     * @param {string} triggeredBy - 'automatic', 'manual', 'admin'
     * @returns {Promise<Object>} Update record
     */
    async triggerReindexing(courseId, updateType = 'incremental', triggeredBy = 'manual') {
        try {
            // Create update record
            const { data: updateRecord, error } = await supabaseClient
                .from('ai_coach_content_updates')
                .insert({
                    course_id: courseId,
                    update_type: updateType,
                    status: 'pending',
                    triggered_by: triggeredBy,
                    chunks_updated: 0,
                    chunks_total: 0
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            // Add to queue
            this.updateQueue.push({
                updateId: updateRecord.id,
                courseId,
                updateType,
                triggeredBy
            });

            // Process queue if not already processing
            if (!this.processing) {
                this._processQueue();
            }

            return updateRecord;
        } catch (error) {
            console.error('[ContentUpdateService] Error triggering re-indexing:', error);
            throw error;
        }
    }

    /**
     * Re-index course content
     * @param {string} courseId - Course identifier
     * @param {Object} options - Re-indexing options
     * @returns {Promise<Object>} Re-indexing result
     */
    async reindexCourseContent(courseId, options = {}) {
        const {
            full = false,
            incremental = true,
            force = false,
            updateId = null
        } = options;

        try {
            // Update status to processing
            if (updateId) {
                await supabaseClient
                    .from('ai_coach_content_updates')
                    .update({
                        status: 'processing',
                        started_at: new Date().toISOString()
                    })
                    .eq('id', updateId);
            }

            // Perform indexing
            const result = await embeddingService.indexCourseContent(courseId, {
                full,
                incremental,
                force
            });

            // Update status to completed
            if (updateId) {
                await supabaseClient
                    .from('ai_coach_content_updates')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        chunks_updated: result.indexed + result.updated,
                        chunks_total: result.total
                    })
                    .eq('id', updateId);
            }

            return result;
        } catch (error) {
            console.error('[ContentUpdateService] Error re-indexing course content:', error);
            
            // Update status to failed
            if (updateId) {
                await supabaseClient
                    .from('ai_coach_content_updates')
                    .update({
                        status: 'failed',
                        completed_at: new Date().toISOString(),
                        error_message: error.message
                    })
                    .eq('id', updateId);
            }

            throw error;
        }
    }

    /**
     * Get update status for a course
     * @param {string} courseId - Course identifier
     * @returns {Promise<Object>} Update status
     */
    async getUpdateStatus(courseId) {
        const { data, error } = await supabaseClient
            .from('ai_coach_content_updates')
            .select('*')
            .eq('course_id', courseId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
        }

        return data || null;
    }

    /**
     * Handle content change event (webhook/trigger)
     * @param {string} courseId - Course identifier
     * @param {string} changeType - Type of change
     * @returns {Promise<void>}
     */
    async onContentChange(courseId, changeType) {
        console.log(`[ContentUpdateService] Content change detected for course ${courseId}: ${changeType}`);
        
        // Trigger incremental re-indexing
        await this.triggerReindexing(courseId, 'incremental', 'automatic');
    }

    /**
     * Process update queue
     * @private
     */
    async _processQueue() {
        if (this.processing || this.updateQueue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.updateQueue.length > 0) {
            const item = this.updateQueue.shift();
            
            try {
                await this.reindexCourseContent(item.courseId, {
                    full: item.updateType === 'full',
                    incremental: item.updateType === 'incremental',
                    updateId: item.updateId
                });
            } catch (error) {
                console.error(`[ContentUpdateService] Error processing queue item for ${item.courseId}:`, error);
            }
        }

        this.processing = false;
    }

    /**
     * Get all pending updates
     * @returns {Promise<Array<Object>>} Array of pending updates
     */
    async getPendingUpdates() {
        const { data, error } = await supabaseClient
            .from('ai_coach_content_updates')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        return data || [];
    }

    /**
     * Retry failed update
     * @param {string} updateId - Update record ID
     * @returns {Promise<Object>} Update result
     */
    async retryFailedUpdate(updateId) {
        const { data: updateRecord, error } = await supabaseClient
            .from('ai_coach_content_updates')
            .select('*')
            .eq('id', updateId)
            .single();

        if (error) {
            throw error;
        }

        if (updateRecord.status !== 'failed') {
            throw new Error('Update is not in failed status');
        }

        return await this.reindexCourseContent(updateRecord.course_id, {
            full: updateRecord.update_type === 'full',
            incremental: updateRecord.update_type === 'incremental',
            updateId: updateRecord.id
        });
    }
}

export const contentUpdateService = new ContentUpdateService();

