/**
 * Tag Management Component (Admin View)
 * 
 * Allows admins to create, edit, and delete tags.
 * Also allows assigning/unassigning tags to users.
 */

import { tagService } from '../../../services/tag-service.js';
import { authService } from '../../../services/auth-service.js';
import { userService } from '../../../services/user-service.js';
import { supabaseClient } from '../../../services/supabase-client.js';
import Header from '../../header.js';

class TagManagement {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.tags = [];
        this.users = [];
        this.editingTag = null;
    }

    async init() {
        try {
            console.log('[TagManagement] Initializing...');
            
            if (this.container) {
                this.container.style.display = 'block';
            }

            await this.renderHeader();

            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser || this.currentUser.role !== 'admin') {
                throw new Error('Access denied: Admin role required');
            }

            await this.loadData();
            this.render();
        } catch (error) {
            console.error('[TagManagement] Error initializing:', error);
            this.showError(error.message || 'Failed to load tag management.');
        }
    }

    async renderHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new Header(headerContainer);
            await header.init();
        }
    }

    async loadData() {
        try {
            this.tags = await tagService.getAllTags();
            
            // Get user count for each tag
            for (const tag of this.tags) {
                const userIds = await tagService.getUsersByTags([tag.id]);
                tag.user_count = userIds.length;
            }
            
            // Load users for tag assignment
            const { data } = await supabaseClient
                .from('users')
                .select('id, full_name, email, role')
                .eq('role', 'learner');
            this.users = data || [];
        } catch (error) {
            console.error('[TagManagement] Error loading data:', error);
            this.tags = [];
            this.users = [];
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="report-container">
                <div class="report-header">
                    <div>
                        <a href="#/reports/admin" class="btn btn-sm btn-secondary" style="margin-bottom: 8px;">
                            ← Back to Dashboard
                        </a>
                        <h1>Tag Management</h1>
                        <p class="report-subtitle">Create and manage user tags for reporting</p>
                    </div>
                </div>

                <div class="tag-management-section">
                    <div class="tag-list-section">
                        <div class="section-header">
                            <h2>Tags</h2>
                            <button class="btn btn-primary" id="create-tag-btn">+ Create Tag</button>
                        </div>
                        ${this.renderTagList()}
                    </div>

                    ${this.editingTag ? this.renderTagForm() : this.renderCreateTagForm()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderTagList() {
        if (this.tags.length === 0) {
            return `
                <div class="report-empty">
                    <div class="report-empty-icon">🏷️</div>
                    <div class="report-empty-title">No Tags</div>
                    <div class="report-empty-message">Create your first tag to start organizing learners.</div>
                </div>
            `;
        }

        return `
            <div class="tag-list">
                ${this.tags.map(tag => `
                    <div class="tag-item" data-tag-id="${tag.id}">
                        <div class="tag-item-content">
                            <span class="tag-badge-large" style="background-color: ${tag.color || '#6366f1'}20; color: ${tag.color || '#6366f1'}; border: 1px solid ${tag.color || '#6366f1'};">
                                ${this.escapeHtml(tag.name)}
                            </span>
                            <span class="tag-description">${this.escapeHtml(tag.description || '')}</span>
                            <span class="tag-user-count">${tag.user_count || 0} users</span>
                        </div>
                        <div class="tag-actions">
                            <button class="btn btn-sm btn-secondary edit-tag-btn" data-tag-id="${tag.id}">Edit</button>
                            <button class="btn btn-sm btn-danger delete-tag-btn" data-tag-id="${tag.id}">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderCreateTagForm() {
        return `
            <div class="tag-form-section">
                <h2>Create New Tag</h2>
                <form id="create-tag-form" class="tag-form">
                    <div class="form-group">
                        <label for="tag-name">Tag Name *</label>
                        <input type="text" id="tag-name" name="name" required placeholder="e.g., Beginner, Advanced, etc.">
                    </div>
                    <div class="form-group">
                        <label for="tag-description">Description</label>
                        <textarea id="tag-description" name="description" rows="3" placeholder="Optional description"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="tag-color">Color</label>
                        <input type="color" id="tag-color" name="color" value="#6366f1">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Create Tag</button>
                        <button type="button" class="btn btn-secondary" id="cancel-create-btn">Cancel</button>
                    </div>
                </form>
            </div>
        `;
    }

    renderTagForm() {
        const tag = this.tags.find(t => t.id === this.editingTag);
        if (!tag) {
            this.editingTag = null;
            this.render();
            return;
        }

        return `
            <div class="tag-form-section">
                <h2>Edit Tag</h2>
                <form id="edit-tag-form" class="tag-form">
                    <div class="form-group">
                        <label for="edit-tag-name">Tag Name *</label>
                        <input type="text" id="edit-tag-name" name="name" required value="${this.escapeHtml(tag.name)}">
                    </div>
                    <div class="form-group">
                        <label for="edit-tag-description">Description</label>
                        <textarea id="edit-tag-description" name="description" rows="3">${this.escapeHtml(tag.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="edit-tag-color">Color</label>
                        <input type="color" id="edit-tag-color" name="color" value="${tag.color || '#6366f1'}">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Update Tag</button>
                        <button type="button" class="btn btn-secondary" id="cancel-edit-btn">Cancel</button>
                    </div>
                </form>
            </div>
        `;
    }

    attachEventListeners() {
        // Create tag button
        const createBtn = this.container.querySelector('#create-tag-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.editingTag = null;
                this.render();
            });
        }

        // Cancel buttons
        const cancelCreateBtn = this.container.querySelector('#cancel-create-btn');
        if (cancelCreateBtn) {
            cancelCreateBtn.addEventListener('click', () => {
                this.editingTag = null;
                this.render();
            });
        }

        const cancelEditBtn = this.container.querySelector('#cancel-edit-btn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                this.editingTag = null;
                this.render();
            });
        }

        // Edit tag buttons
        const editBtns = this.container.querySelectorAll('.edit-tag-btn');
        editBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tagId = e.target.getAttribute('data-tag-id');
                this.editingTag = tagId;
                this.render();
            });
        });

        // Delete tag buttons
        const deleteBtns = this.container.querySelectorAll('.delete-tag-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tagId = e.target.getAttribute('data-tag-id');
                this.deleteTag(tagId);
            });
        });

        // Create tag form
        const createForm = this.container.querySelector('#create-tag-form');
        if (createForm) {
            createForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createTag(new FormData(e.target));
            });
        }

        // Edit tag form
        const editForm = this.container.querySelector('#edit-tag-form');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateTag(this.editingTag, new FormData(e.target));
            });
        }
    }

    async createTag(formData) {
        try {
            const name = formData.get('name');
            const description = formData.get('description') || null;
            const color = formData.get('color') || '#6366f1';

            await tagService.createTag(name, description, color, this.currentUser.id);
            await this.loadData();
            this.editingTag = null;
            this.render();
            this.showSuccess('Tag created successfully!');
        } catch (error) {
            console.error('[TagManagement] Error creating tag:', error);
            alert('Failed to create tag: ' + error.message);
        }
    }

    async updateTag(tagId, formData) {
        try {
            const tagData = {
                name: formData.get('name'),
                description: formData.get('description') || null,
                color: formData.get('color') || '#6366f1'
            };

            await tagService.updateTag(tagId, tagData);
            await this.loadData();
            this.editingTag = null;
            this.render();
            this.showSuccess('Tag updated successfully!');
        } catch (error) {
            console.error('[TagManagement] Error updating tag:', error);
            alert('Failed to update tag: ' + error.message);
        }
    }

    async deleteTag(tagId) {
        if (!confirm('Are you sure you want to delete this tag? This will remove the tag from all users.')) {
            return;
        }

        try {
            await tagService.deleteTag(tagId);
            await this.loadData();
            this.render();
            this.showSuccess('Tag deleted successfully!');
        } catch (error) {
            console.error('[TagManagement] Error deleting tag:', error);
            alert('Failed to delete tag: ' + error.message);
        }
    }

    showSuccess(message) {
        // Simple success notification
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="report-error">
                <div class="report-error-icon">⚠️</div>
                <div class="report-error-title">Error</div>
                <div class="report-error-message">${this.escapeHtml(message)}</div>
                <a href="#/reports/admin" class="btn btn-primary" style="margin-top: 16px;">
                    Back to Dashboard
                </a>
            </div>
        `;
    }
}

export default TagManagement;

