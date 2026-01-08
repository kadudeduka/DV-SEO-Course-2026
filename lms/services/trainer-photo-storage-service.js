/**
 * Trainer Photo Storage Service
 * 
 * Handles downloading trainer photos from LinkedIn and uploading to Supabase Storage.
 * Manages photo updates, replacements, and fallback handling.
 */

import { supabaseClient } from './supabase-client.js';

const BUCKET_NAME = 'trainer-photos';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

class TrainerPhotoStorageService {
    constructor() {
        this.bucketName = BUCKET_NAME;
    }

    /**
     * Validate image format and size
     * @param {Blob|File} file - Image file to validate
     * @returns {Promise<{valid: boolean, error?: string}>}
     */
    async validateImage(file) {
        if (!file) {
            return { valid: false, error: 'No file provided' };
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
        }

        // Check MIME type
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return { valid: false, error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` };
        }

        return { valid: true };
    }

    /**
     * Download photo from LinkedIn URL
     * @param {string} photoUrl - LinkedIn photo URL
     * @returns {Promise<Blob>} Photo blob
     */
    async downloadPhotoFromLinkedIn(photoUrl) {
        if (!photoUrl) {
            throw new Error('Photo URL is required');
        }

        try {
            const response = await fetch(photoUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'image/*'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to download photo: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            
            // Validate downloaded image
            const validation = await this.validateImage(blob);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            console.log('[PhotoStorage] Successfully downloaded photo from LinkedIn');
            return blob;
        } catch (error) {
            console.error('[PhotoStorage] Error downloading photo:', error);
            throw new Error(`Failed to download photo from LinkedIn: ${error.message}`);
        }
    }

    /**
     * Generate filename for trainer photo
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @param {string} mimeType - MIME type of image
     * @returns {string} Filename
     */
    generateFilename(trainerId, courseId, mimeType) {
        const extension = mimeType.split('/')[1] || 'jpg'; // jpeg, png, webp
        const timestamp = Date.now();
        const coursePart = courseId ? `_${courseId}` : '';
        return `${trainerId}${coursePart}_${timestamp}.${extension}`;
    }

    /**
     * Upload photo to Supabase Storage
     * @param {Blob|File} photoBlob - Photo file/blob to upload
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @returns {Promise<string>} Public URL of uploaded photo
     */
    async uploadPhotoToStorage(photoBlob, trainerId, courseId = null) {
        if (!photoBlob) {
            throw new Error('Photo blob is required');
        }

        try {
            // Validate image
            const validation = await this.validateImage(photoBlob);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Generate filename
            const filename = this.generateFilename(trainerId, courseId, photoBlob.type || 'image/jpeg');

            // Upload to Supabase Storage
            const { data, error } = await supabaseClient.storage
                .from(this.bucketName)
                .upload(filename, photoBlob, {
                    contentType: photoBlob.type || 'image/jpeg',
                    upsert: false, // Don't overwrite - use unique filename with timestamp
                    cacheControl: '3600' // Cache for 1 hour
                });

            if (error) {
                // Check if bucket exists
                if (error.message.includes('not found') || error.message.includes('does not exist')) {
                    throw new Error(`Storage bucket '${this.bucketName}' does not exist. Please create it first.`);
                }
                throw new Error(`Failed to upload photo: ${error.message}`);
            }

            // Get public URL
            const { data: urlData } = supabaseClient.storage
                .from(this.bucketName)
                .getPublicUrl(filename);

            if (!urlData || !urlData.publicUrl) {
                throw new Error('Failed to get public URL for uploaded photo');
            }

            console.log('[PhotoStorage] Successfully uploaded photo to storage:', filename);
            return urlData.publicUrl;
        } catch (error) {
            console.error('[PhotoStorage] Error uploading photo:', error);
            throw error;
        }
    }

    /**
     * Delete photo from Supabase Storage
     * @param {string} photoUrl - Public URL of photo to delete
     * @returns {Promise<void>}
     */
    async deletePhotoFromStorage(photoUrl) {
        if (!photoUrl) {
            return; // No photo to delete
        }

        try {
            // Extract filename from URL
            // URL format: https://{supabase-url}/storage/v1/object/public/{bucket}/{filename}
            const urlParts = photoUrl.split('/');
            const filename = urlParts[urlParts.length - 1];

            if (!filename) {
                console.warn('[PhotoStorage] Could not extract filename from URL:', photoUrl);
                return;
            }

            // Delete from storage
            const { error } = await supabaseClient.storage
                .from(this.bucketName)
                .remove([filename]);

            if (error) {
                console.warn('[PhotoStorage] Error deleting photo (may already be deleted):', error.message);
                // Don't throw - deletion is not critical
            } else {
                console.log('[PhotoStorage] Successfully deleted photo from storage:', filename);
            }
        } catch (error) {
            console.warn('[PhotoStorage] Error deleting photo:', error.message);
            // Don't throw - deletion is not critical
        }
    }

    /**
     * Replace existing photo with new one
     * @param {string|null} oldPhotoUrl - Old photo URL to delete (optional)
     * @param {Blob|File} newPhotoBlob - New photo to upload
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @returns {Promise<string>} Public URL of new photo
     */
    async replacePhoto(oldPhotoUrl, newPhotoBlob, trainerId, courseId = null) {
        try {
            // Upload new photo first
            const newPhotoUrl = await this.uploadPhotoToStorage(newPhotoBlob, trainerId, courseId);

            // Delete old photo (non-blocking)
            if (oldPhotoUrl) {
                await this.deletePhotoFromStorage(oldPhotoUrl).catch(error => {
                    console.warn('[PhotoStorage] Failed to delete old photo:', error.message);
                });
            }

            console.log('[PhotoStorage] Successfully replaced photo');
            return newPhotoUrl;
        } catch (error) {
            console.error('[PhotoStorage] Error replacing photo:', error);
            throw error;
        }
    }

    /**
     * Download and upload photo from LinkedIn
     * @param {string} linkedinPhotoUrl - LinkedIn photo URL
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @returns {Promise<string>} Public URL of uploaded photo
     */
    async downloadAndUploadLinkedInPhoto(linkedinPhotoUrl, trainerId, courseId = null) {
        try {
            // Download from LinkedIn
            const photoBlob = await this.downloadPhotoFromLinkedIn(linkedinPhotoUrl);

            // Upload to Supabase Storage
            const publicUrl = await this.uploadPhotoToStorage(photoBlob, trainerId, courseId);

            console.log('[PhotoStorage] Successfully downloaded and uploaded LinkedIn photo');
            return publicUrl;
        } catch (error) {
            console.error('[PhotoStorage] Error downloading and uploading photo:', error);
            throw error;
        }
    }

    /**
     * Process photo: Download from LinkedIn and store, with fallback
     * @param {string} linkedinPhotoUrl - LinkedIn photo URL
     * @param {string} trainerId - Trainer user ID
     * @param {string} courseId - Course ID (optional)
     * @param {string|null} existingPhotoUrl - Existing photo URL to replace (optional)
     * @returns {Promise<{photoUrl: string, source: 'storage'|'linkedin'|null, error?: string}>}
     */
    async processPhoto(linkedinPhotoUrl, trainerId, courseId = null, existingPhotoUrl = null) {
        if (!linkedinPhotoUrl) {
            return {
                photoUrl: null,
                source: null,
                error: 'No LinkedIn photo URL provided'
            };
        }

        try {
            // Try to download and upload to storage
            const storageUrl = await this.downloadAndUploadLinkedInPhoto(
                linkedinPhotoUrl,
                trainerId,
                courseId
            );

            // Delete old photo if exists
            if (existingPhotoUrl && existingPhotoUrl !== storageUrl) {
                await this.deletePhotoFromStorage(existingPhotoUrl).catch(error => {
                    console.warn('[PhotoStorage] Failed to delete old photo:', error.message);
                });
            }

            return {
                photoUrl: storageUrl,
                source: 'storage'
            };
        } catch (error) {
            console.warn('[PhotoStorage] Failed to download/upload photo, using LinkedIn URL as fallback:', error.message);
            
            // Fallback: Use LinkedIn URL directly
            // Delete old photo from storage if exists (since we're not using it anymore)
            if (existingPhotoUrl && existingPhotoUrl.includes('storage')) {
                await this.deletePhotoFromStorage(existingPhotoUrl).catch(deleteError => {
                    console.warn('[PhotoStorage] Failed to delete old photo during fallback:', deleteError.message);
                });
            }

            return {
                photoUrl: linkedinPhotoUrl,
                source: 'linkedin',
                error: `Storage upload failed: ${error.message}. Using LinkedIn URL directly.`
            };
        }
    }
}

// Export singleton instance
export const trainerPhotoStorageService = new TrainerPhotoStorageService();

