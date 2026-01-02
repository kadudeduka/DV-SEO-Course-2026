/**
 * Tag Service
 * 
 * Manages user tags and tag assignments for reporting and analytics.
 * Tags are created by admins and can be assigned to learners for grouping and analysis.
 */

import { supabaseClient } from './supabase-client.js';

class TagService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Create a new tag
     * @param {string} name - Tag name (must be unique)
     * @param {string} description - Optional description
     * @param {string} color - Hex color code (default: #6366f1)
     * @param {string} createdBy - User ID of creator (must be admin)
     * @returns {Promise<Object>} Created tag object
     */
    async createTag(name, description, color, createdBy) {
        if (!name || name.trim().length === 0) {
            throw new Error('Tag name is required');
        }

        if (name.length > 100) {
            throw new Error('Tag name must be 100 characters or less');
        }

        // Validate color format (hex color)
        const colorRegex = /^#[0-9A-Fa-f]{6}$/;
        const tagColor = color || '#6366f1';
        if (!colorRegex.test(tagColor)) {
            throw new Error('Invalid color format. Must be a hex color code (e.g., #6366f1)');
        }

        try {
            const { data, error } = await supabaseClient
                .from('user_tags')
                .insert({
                    name: name.trim(),
                    description: description?.trim() || null,
                    color: tagColor,
                    created_by: createdBy
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Unique constraint violation
                    throw new Error(`Tag with name "${name}" already exists`);
                }
                throw new Error(`Failed to create tag: ${error.message}`);
            }

            // Clear cache
            this.cache.clear();

            return data;
        } catch (error) {
            console.error('[TagService] Error creating tag:', error);
            throw error;
        }
    }

    /**
     * Update an existing tag
     * @param {string} tagId - Tag ID
     * @param {Object} updates - Fields to update (name, description, color)
     * @returns {Promise<Object>} Updated tag object
     */
    async updateTag(tagId, updates) {
        if (!tagId) {
            throw new Error('Tag ID is required');
        }

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (updates.name !== undefined) {
            if (!updates.name || updates.name.trim().length === 0) {
                throw new Error('Tag name cannot be empty');
            }
            if (updates.name.length > 100) {
                throw new Error('Tag name must be 100 characters or less');
            }
            updateData.name = updates.name.trim();
        }

        if (updates.description !== undefined) {
            updateData.description = updates.description?.trim() || null;
        }

        if (updates.color !== undefined) {
            const colorRegex = /^#[0-9A-Fa-f]{6}$/;
            if (!colorRegex.test(updates.color)) {
                throw new Error('Invalid color format. Must be a hex color code (e.g., #6366f1)');
            }
            updateData.color = updates.color;
        }

        try {
            const { data, error } = await supabaseClient
                .from('user_tags')
                .update(updateData)
                .eq('id', tagId)
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Unique constraint violation
                    throw new Error(`Tag with name "${updates.name}" already exists`);
                }
                throw new Error(`Failed to update tag: ${error.message}`);
            }

            if (!data) {
                throw new Error('Tag not found');
            }

            // Clear cache
            this.cache.clear();

            return data;
        } catch (error) {
            console.error('[TagService] Error updating tag:', error);
            throw error;
        }
    }

    /**
     * Delete a tag
     * @param {string} tagId - Tag ID
     * @returns {Promise<void>}
     */
    async deleteTag(tagId) {
        if (!tagId) {
            throw new Error('Tag ID is required');
        }

        try {
            // Delete assignments first (CASCADE should handle this, but explicit for clarity)
            const { error: assignmentError } = await supabaseClient
                .from('user_tag_assignments')
                .delete()
                .eq('tag_id', tagId);

            if (assignmentError) {
                console.warn('[TagService] Error deleting tag assignments:', assignmentError);
            }

            // Delete the tag
            const { error } = await supabaseClient
                .from('user_tags')
                .delete()
                .eq('id', tagId);

            if (error) {
                throw new Error(`Failed to delete tag: ${error.message}`);
            }

            // Clear cache
            this.cache.clear();
        } catch (error) {
            console.error('[TagService] Error deleting tag:', error);
            throw error;
        }
    }

    /**
     * Get all tags
     * @returns {Promise<Array>} Array of tag objects
     */
    async getAllTags() {
        const cacheKey = 'all_tags';
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const { data, error } = await supabaseClient
                .from('user_tags')
                .select('*')
                .order('name', { ascending: true });

            if (error) {
                throw new Error(`Failed to get tags: ${error.message}`);
            }

            const tags = data || [];

            // Cache result
            this.cache.set(cacheKey, { data: tags, timestamp: Date.now() });

            return tags;
        } catch (error) {
            console.error('[TagService] Error getting tags:', error);
            throw error;
        }
    }

    /**
     * Get a tag by ID
     * @param {string} tagId - Tag ID
     * @returns {Promise<Object>} Tag object
     */
    async getTagById(tagId) {
        if (!tagId) {
            throw new Error('Tag ID is required');
        }

        try {
            const { data, error } = await supabaseClient
                .from('user_tags')
                .select('*')
                .eq('id', tagId)
                .single();

            if (error) {
                throw new Error(`Failed to get tag: ${error.message}`);
            }

            if (!data) {
                throw new Error('Tag not found');
            }

            return data;
        } catch (error) {
            console.error('[TagService] Error getting tag:', error);
            throw error;
        }
    }

    /**
     * Assign a tag to a user
     * @param {string} userId - User ID
     * @param {string} tagId - Tag ID
     * @param {string} assignedBy - User ID of assigner (must be admin)
     * @returns {Promise<Object>} Assignment object
     */
    async assignTagToUser(userId, tagId, assignedBy) {
        if (!userId || !tagId) {
            throw new Error('User ID and Tag ID are required');
        }

        try {
            const { data, error } = await supabaseClient
                .from('user_tag_assignments')
                .insert({
                    user_id: userId,
                    tag_id: tagId,
                    assigned_by: assignedBy
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Unique constraint violation
                    throw new Error('Tag already assigned to user');
                }
                throw new Error(`Failed to assign tag: ${error.message}`);
            }

            // Clear cache
            this.cache.clear();

            return data;
        } catch (error) {
            console.error('[TagService] Error assigning tag:', error);
            throw error;
        }
    }

    /**
     * Remove a tag from a user
     * @param {string} userId - User ID
     * @param {string} tagId - Tag ID
     * @returns {Promise<void>}
     */
    async removeTagFromUser(userId, tagId) {
        if (!userId || !tagId) {
            throw new Error('User ID and Tag ID are required');
        }

        try {
            const { error } = await supabaseClient
                .from('user_tag_assignments')
                .delete()
                .eq('user_id', userId)
                .eq('tag_id', tagId);

            if (error) {
                throw new Error(`Failed to remove tag: ${error.message}`);
            }

            // Clear cache
            this.cache.clear();
        } catch (error) {
            console.error('[TagService] Error removing tag:', error);
            throw error;
        }
    }

    /**
     * Assign multiple tags to multiple users (bulk operation)
     * @param {Array<string>} userIds - Array of user IDs
     * @param {Array<string>} tagIds - Array of tag IDs
     * @param {string} assignedBy - User ID of assigner
     * @returns {Promise<Array>} Array of assignment objects
     */
    async assignTagsToUsers(userIds, tagIds, assignedBy) {
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            throw new Error('User IDs array is required');
        }

        if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
            throw new Error('Tag IDs array is required');
        }

        const assignments = [];
        for (const userId of userIds) {
            for (const tagId of tagIds) {
                assignments.push({
                    user_id: userId,
                    tag_id: tagId,
                    assigned_by: assignedBy
                });
            }
        }

        try {
            const { data, error } = await supabaseClient
                .from('user_tag_assignments')
                .upsert(assignments, {
                    onConflict: 'user_id,tag_id',
                    ignoreDuplicates: false
                })
                .select();

            if (error) {
                throw new Error(`Failed to assign tags: ${error.message}`);
            }

            // Clear cache
            this.cache.clear();

            return data || [];
        } catch (error) {
            console.error('[TagService] Error assigning tags:', error);
            throw error;
        }
    }

    /**
     * Remove multiple tags from multiple users (bulk operation)
     * @param {Array<string>} userIds - Array of user IDs
     * @param {Array<string>} tagIds - Array of tag IDs
     * @returns {Promise<void>}
     */
    async removeTagsFromUsers(userIds, tagIds) {
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            throw new Error('User IDs array is required');
        }

        if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
            throw new Error('Tag IDs array is required');
        }

        try {
            const { error } = await supabaseClient
                .from('user_tag_assignments')
                .delete()
                .in('user_id', userIds)
                .in('tag_id', tagIds);

            if (error) {
                throw new Error(`Failed to remove tags: ${error.message}`);
            }

            // Clear cache
            this.cache.clear();
        } catch (error) {
            console.error('[TagService] Error removing tags:', error);
            throw error;
        }
    }

    /**
     * Get all tags assigned to a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Array of tag objects
     */
    async getUserTags(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        try {
            const { data, error } = await supabaseClient
                .from('user_tag_assignments')
                .select(`
                    tag_id,
                    user_tags (*)
                `)
                .eq('user_id', userId);

            if (error) {
                throw new Error(`Failed to get user tags: ${error.message}`);
            }

            return (data || []).map(item => item.user_tags).filter(Boolean);
        } catch (error) {
            console.error('[TagService] Error getting user tags:', error);
            throw error;
        }
    }

    /**
     * Get all user IDs that have the specified tags
     * @param {Array<string>} tagIds - Array of tag IDs
     * @returns {Promise<Array>} Array of user IDs
     */
    async getUsersByTags(tagIds) {
        if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
            return [];
        }

        try {
            const { data, error } = await supabaseClient
                .from('user_tag_assignments')
                .select('user_id')
                .in('tag_id', tagIds);

            if (error) {
                throw new Error(`Failed to get users by tags: ${error.message}`);
            }

            // Return unique user IDs
            return [...new Set((data || []).map(item => item.user_id))];
        } catch (error) {
            console.error('[TagService] Error getting users by tags:', error);
            throw error;
        }
    }

    /**
     * Get tag usage statistics
     * @returns {Promise<Object>} Object with tag names as keys and usage counts as values
     */
    async getTagUsageStats() {
        try {
            const { data, error } = await supabaseClient
                .from('user_tag_assignments')
                .select(`
                    tag_id,
                    user_tags (id, name)
                `);

            if (error) {
                throw new Error(`Failed to get tag usage stats: ${error.message}`);
            }

            const stats = {};
            (data || []).forEach(item => {
                const tagName = item.user_tags?.name || 'Unknown';
                stats[tagName] = (stats[tagName] || 0) + 1;
            });

            return stats;
        } catch (error) {
            console.error('[TagService] Error getting tag usage stats:', error);
            throw error;
        }
    }
}

export const tagService = new TagService();

