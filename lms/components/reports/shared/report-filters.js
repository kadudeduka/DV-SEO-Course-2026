/**
 * Report Filters Component
 * 
 * Provides filter controls for reports (date range, dropdowns, search, tags)
 */

class ReportFilters {
    constructor(options = {}) {
        this.options = {
            dateRange: options.dateRange !== false,
            period: options.period !== false,
            search: options.search !== false,
            tags: options.tags !== false,
            learnerType: options.learnerType !== false,
            status: options.status !== false,
            ...options
        };
        this.filters = {
            dateRange: { from: null, to: null },
            period: '30d',
            search: '',
            tags: [],
            learnerType: 'all',
            status: 'all'
        };
        this.onApply = null;
    }

    /**
     * Render the filter panel
     * @param {Object} currentFilters - Current filter values
     * @param {Function} onApply - Callback when filters are applied
     * @returns {string} HTML string
     */
    render(currentFilters = {}, onApply = null) {
        this.filters = { ...this.filters, ...currentFilters };
        this.onApply = onApply;

        return `
            <div class="report-filters">
                <div class="filters-header">
                    <h3>Filters</h3>
                    <button class="btn btn-sm btn-secondary" id="reset-filters">Reset</button>
                </div>
                <div class="filters-content">
                    ${this.options.dateRange ? this.renderDateRange() : ''}
                    ${this.options.period ? this.renderPeriod() : ''}
                    ${this.options.search ? this.renderSearch() : ''}
                    ${this.options.tags ? this.renderTagSelector() : ''}
                    ${this.options.learnerType ? this.renderLearnerType() : ''}
                    ${this.options.status ? this.renderStatus() : ''}
                    <div class="filters-actions">
                        <button class="btn btn-primary" id="apply-filters">Apply Filters</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderDateRange() {
        return `
            <div class="filter-group">
                <label class="filter-label">Date Range</label>
                <div class="date-range-inputs">
                    <input type="date" id="filter-date-from" class="filter-input" 
                           value="${this.filters.dateRange.from || ''}">
                    <span>to</span>
                    <input type="date" id="filter-date-to" class="filter-input" 
                           value="${this.filters.dateRange.to || ''}">
                </div>
            </div>
        `;
    }

    renderPeriod() {
        return `
            <div class="filter-group">
                <label class="filter-label">Period</label>
                <select id="filter-period" class="filter-select">
                    <option value="7d" ${this.filters.period === '7d' ? 'selected' : ''}>Last 7 days</option>
                    <option value="30d" ${this.filters.period === '30d' ? 'selected' : ''}>Last 30 days</option>
                    <option value="90d" ${this.filters.period === '90d' ? 'selected' : ''}>Last 90 days</option>
                    <option value="6m" ${this.filters.period === '6m' ? 'selected' : ''}>Last 6 months</option>
                    <option value="1y" ${this.filters.period === '1y' ? 'selected' : ''}>Last year</option>
                </select>
            </div>
        `;
    }

    renderSearch() {
        return `
            <div class="filter-group">
                <label class="filter-label">Search</label>
                <input type="text" id="filter-search" class="filter-input" 
                       placeholder="Search..." value="${this.escapeHtml(this.filters.search)}">
            </div>
        `;
    }

    renderTagSelector() {
        return `
            <div class="filter-group">
                <label class="filter-label">Tags</label>
                <select id="filter-tags" class="filter-select" multiple>
                    <!-- Tags will be loaded dynamically -->
                </select>
            </div>
        `;
    }

    renderLearnerType() {
        return `
            <div class="filter-group">
                <label class="filter-label">Learner Type</label>
                <select id="filter-learner-type" class="filter-select">
                    <option value="all" ${this.filters.learnerType === 'all' ? 'selected' : ''}>All Types</option>
                    <option value="active" ${this.filters.learnerType === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${this.filters.learnerType === 'inactive' ? 'selected' : ''}>Inactive</option>
                    <option value="graduate" ${this.filters.learnerType === 'graduate' ? 'selected' : ''}>Graduate</option>
                    <option value="archive" ${this.filters.learnerType === 'archive' ? 'selected' : ''}>Archive</option>
                </select>
            </div>
        `;
    }

    renderStatus() {
        return `
            <div class="filter-group">
                <label class="filter-label">Status</label>
                <select id="filter-status" class="filter-select">
                    <option value="all" ${this.filters.status === 'all' ? 'selected' : ''}>All Statuses</option>
                    <option value="on_track" ${this.filters.status === 'on_track' ? 'selected' : ''}>On Track</option>
                    <option value="needs_attention" ${this.filters.status === 'needs_attention' ? 'selected' : ''}>Needs Attention</option>
                    <option value="at_risk" ${this.filters.status === 'at_risk' ? 'selected' : ''}>At Risk</option>
                </select>
            </div>
        `;
    }

    /**
     * Attach event listeners to filter elements
     * @param {HTMLElement} container - Container element
     */
    attachEventListeners(container) {
        const applyBtn = container.querySelector('#apply-filters');
        const resetBtn = container.querySelector('#reset-filters');

        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.handleApply(container));
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.handleReset(container));
        }
    }

    handleApply(container) {
        const filters = {
            dateRange: {
                from: container.querySelector('#filter-date-from')?.value || null,
                to: container.querySelector('#filter-date-to')?.value || null
            },
            period: container.querySelector('#filter-period')?.value || '30d',
            search: container.querySelector('#filter-search')?.value || '',
            tags: Array.from(container.querySelector('#filter-tags')?.selectedOptions || []).map(opt => opt.value),
            learnerType: container.querySelector('#filter-learner-type')?.value || 'all',
            status: container.querySelector('#filter-status')?.value || 'all'
        };

        if (this.onApply) {
            this.onApply(filters);
        }
    }

    handleReset(container) {
        this.filters = {
            dateRange: { from: null, to: null },
            period: '30d',
            search: '',
            tags: [],
            learnerType: 'all',
            status: 'all'
        };

        // Reset form
        if (container.querySelector('#filter-date-from')) container.querySelector('#filter-date-from').value = '';
        if (container.querySelector('#filter-date-to')) container.querySelector('#filter-date-to').value = '';
        if (container.querySelector('#filter-period')) container.querySelector('#filter-period').value = '30d';
        if (container.querySelector('#filter-search')) container.querySelector('#filter-search').value = '';
        if (container.querySelector('#filter-tags')) {
            Array.from(container.querySelector('#filter-tags').options).forEach(opt => opt.selected = false);
        }
        if (container.querySelector('#filter-learner-type')) container.querySelector('#filter-learner-type').value = 'all';
        if (container.querySelector('#filter-status')) container.querySelector('#filter-status').value = 'all';

        if (this.onApply) {
            this.onApply(this.filters);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default ReportFilters;

