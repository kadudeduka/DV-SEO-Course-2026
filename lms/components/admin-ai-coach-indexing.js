/**
 * Admin AI Coach Content Indexing Component
 * 
 * Browser-based interface for indexing course content.
 * Provides UI for full/incremental re-indexing and status monitoring.
 */

import { contentUpdateService } from '../services/content-update-service.js';
import { embeddingService } from '../services/embedding-service.js';
import { supabaseClient } from '../services/supabase-client.js';
import { courseService } from '../services/course-service.js';

class AdminAICoachIndexing {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container not found: ${containerId}`);
        }
    }

    async init() {
        await this.render();
        this.attachEventListeners();
    }

    async render() {
        const courses = await courseService.getCourses();
        const currentUser = await import('../services/auth-service.js').then(m => m.authService.getCurrentUser());

        if (currentUser.role !== 'admin') {
            this.container.innerHTML = '<p>Access denied. Admin only.</p>';
            return;
        }

        this.container.innerHTML = `
            <div class="admin-ai-coach-indexing">
                <h2>AI Coach Content Indexing</h2>
                <p class="description">Index course content for AI Coach. Content is chunked, embedded, and stored for semantic search.</p>

                <div class="indexing-controls">
                    <div class="form-group">
                        <label for="course-select">Select Course:</label>
                        <select id="course-select" class="form-control">
                            <option value="">-- Select a course --</option>
                            ${courses.map(course => `
                                <option value="${course.id}">${course.title}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Indexing Mode:</label>
                        <div class="radio-group">
                            <label>
                                <input type="radio" name="index-mode" value="incremental" checked>
                                Incremental (only changed chunks)
                            </label>
                            <label>
                                <input type="radio" name="index-mode" value="full">
                                Full (re-index all chunks)
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="force-index">
                            Force re-index (ignore hash check)
                        </label>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="dry-run">
                            Dry run (preview changes only)
                        </label>
                    </div>

                    <div class="button-group">
                        <button id="start-indexing" class="btn btn-primary">Start Indexing</button>
                        <button id="check-status" class="btn btn-secondary">Check Status</button>
                        <button id="detect-changes" class="btn btn-secondary">Detect Changes</button>
                    </div>
                </div>

                <div id="indexing-status" class="indexing-status" style="display: none;">
                    <h3>Indexing Status</h3>
                    <div id="status-content"></div>
                </div>

                <div id="indexing-progress" class="indexing-progress" style="display: none;">
                    <h3>Progress</h3>
                    <div class="progress-bar">
                        <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div id="progress-text" class="progress-text"></div>
                </div>

                <div id="indexing-results" class="indexing-results" style="display: none;">
                    <h3>Results</h3>
                    <div id="results-content"></div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const startBtn = document.getElementById('start-indexing');
        const statusBtn = document.getElementById('check-status');
        const changesBtn = document.getElementById('detect-changes');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.handleStartIndexing());
        }

        if (statusBtn) {
            statusBtn.addEventListener('click', () => this.handleCheckStatus());
        }

        if (changesBtn) {
            changesBtn.addEventListener('click', () => this.handleDetectChanges());
        }
    }

    async handleStartIndexing() {
        const courseSelect = document.getElementById('course-select');
        const courseId = courseSelect?.value;

        if (!courseId) {
            alert('Please select a course');
            return;
        }

        const indexMode = document.querySelector('input[name="index-mode"]:checked')?.value || 'incremental';
        const force = document.getElementById('force-index')?.checked || false;
        const dryRun = document.getElementById('dry-run')?.checked || false;

        const startBtn = document.getElementById('start-indexing');
        startBtn.disabled = true;
        startBtn.textContent = 'Indexing...';

        try {
            if (dryRun) {
                await this.handleDetectChanges();
                return;
            }

            // Show progress
            const progressDiv = document.getElementById('indexing-progress');
            const progressFill = document.getElementById('progress-fill');
            const progressText = document.getElementById('progress-text');
            
            progressDiv.style.display = 'block';
            progressFill.style.width = '10%';
            progressText.textContent = 'Starting indexing...';

            // Trigger indexing
            const updateRecord = await contentUpdateService.triggerReindexing(
                courseId,
                indexMode,
                'manual'
            );

            progressFill.style.width = '30%';
            progressText.textContent = 'Processing chunks...';

            // Perform indexing
            const result = await contentUpdateService.reindexCourseContent(courseId, {
                full: indexMode === 'full',
                incremental: indexMode === 'incremental',
                force,
                updateId: updateRecord.id
            });

            progressFill.style.width = '100%';
            progressText.textContent = 'Complete!';

            // Show results
            const resultsDiv = document.getElementById('indexing-results');
            const resultsContent = document.getElementById('results-content');
            
            resultsDiv.style.display = 'block';
            resultsContent.innerHTML = `
                <div class="result-success">
                    <h4>✅ Indexing Complete</h4>
                    <ul>
                        <li>Indexed: ${result.indexed} chunks</li>
                        <li>Updated: ${result.updated} chunks</li>
                        <li>Total: ${result.total} chunks</li>
                    </ul>
                </div>
            `;

            // Hide progress after 3 seconds
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 3000);

        } catch (error) {
            console.error('[AdminAICoachIndexing] Error:', error);
            alert(`Error: ${error.message}`);
            
            const resultsDiv = document.getElementById('indexing-results');
            const resultsContent = document.getElementById('results-content');
            
            resultsDiv.style.display = 'block';
            resultsContent.innerHTML = `
                <div class="result-error">
                    <h4>❌ Error</h4>
                    <p>${error.message}</p>
                </div>
            `;
        } finally {
            const startBtn = document.getElementById('start-indexing');
            startBtn.disabled = false;
            startBtn.textContent = 'Start Indexing';
        }
    }

    async handleCheckStatus() {
        const courseSelect = document.getElementById('course-select');
        const courseId = courseSelect?.value;

        if (!courseId) {
            alert('Please select a course');
            return;
        }

        try {
            const status = await contentUpdateService.getUpdateStatus(courseId);
            const statusDiv = document.getElementById('indexing-status');
            const statusContent = document.getElementById('status-content');

            statusDiv.style.display = 'block';

            if (!status) {
                statusContent.innerHTML = '<p>No indexing history found for this course.</p>';
            } else {
                statusContent.innerHTML = `
                    <div class="status-info">
                        <p><strong>Status:</strong> ${status.status}</p>
                        <p><strong>Type:</strong> ${status.update_type}</p>
                        <p><strong>Triggered by:</strong> ${status.triggered_by}</p>
                        <p><strong>Chunks updated:</strong> ${status.chunks_updated}/${status.chunks_total}</p>
                        <p><strong>Started:</strong> ${status.started_at || 'N/A'}</p>
                        <p><strong>Completed:</strong> ${status.completed_at || 'N/A'}</p>
                        ${status.error_message ? `<p class="error"><strong>Error:</strong> ${status.error_message}</p>` : ''}
                    </div>
                `;
            }

            // Get current chunk count
            const { data: chunks, error } = await supabaseClient
                .from('ai_coach_content_chunks')
                .select('id', { count: 'exact' })
                .eq('course_id', courseId);

            if (!error && chunks) {
                statusContent.innerHTML += `<p><strong>Current chunks in database:</strong> ${chunks.length}</p>`;
            }
        } catch (error) {
            console.error('[AdminAICoachIndexing] Error checking status:', error);
            alert(`Error: ${error.message}`);
        }
    }

    async handleDetectChanges() {
        const courseSelect = document.getElementById('course-select');
        const courseId = courseSelect?.value;

        if (!courseId) {
            alert('Please select a course');
            return;
        }

        try {
            const changes = await contentUpdateService.detectContentChanges(courseId);
            const resultsDiv = document.getElementById('indexing-results');
            const resultsContent = document.getElementById('results-content');

            resultsDiv.style.display = 'block';
            
            const newCount = changes.changed.filter(c => c.changeType === 'new').length;
            const updatedCount = changes.changed.filter(c => c.changeType === 'updated').length;
            const deletedCount = changes.deleted?.length || 0;

            let changesList = '';
            if (changes.changed.length > 0) {
                changesList = '<ul>';
                changes.changed.forEach(chunk => {
                    changesList += `<li>${chunk.changeType}: Day ${chunk.day}, ${chunk.chapter_title || chunk.chapter_id}</li>`;
                });
                changesList += '</ul>';
            }

            resultsContent.innerHTML = `
                <div class="result-info">
                    <h4>Changes Detected</h4>
                    <ul>
                        <li>New chunks: ${newCount}</li>
                        <li>Updated chunks: ${updatedCount}</li>
                        <li>Deleted chunks: ${deletedCount}</li>
                    </ul>
                    ${changesList}
                </div>
            `;
        } catch (error) {
            console.error('[AdminAICoachIndexing] Error detecting changes:', error);
            alert(`Error: ${error.message}`);
        }
    }
}

export default AdminAICoachIndexing;

