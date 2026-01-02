/**
 * Report Table Component
 * 
 * Provides sortable, paginated data table with export functionality
 */

class ReportTable {
    constructor(options = {}) {
        this.options = {
            sortable: options.sortable !== false,
            pagination: options.pagination !== false,
            pageSize: options.pageSize || 10,
            selectable: options.selectable || false,
            exportable: options.exportable !== false,
            lazyLoad: options.lazyLoad || false, // Enable lazy loading for large datasets
            virtualScroll: options.virtualScroll || false, // Enable virtual scrolling
            ...options
        };
        this.data = [];
        this.currentPage = 1;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.container = null;
        this.observer = null;
    }

    /**
     * Render the table
     * @param {Array} data - Table data
     * @param {Array} columns - Column definitions [{ key, label, sortable, render }]
     * @returns {string} HTML string
     */
    render(data, columns) {
        this.data = data || [];
        this.columns = columns || [];

        const paginatedData = this.options.pagination 
            ? this.getPaginatedData() 
            : this.data;

        return `
            <div class="report-table-container">
                ${this.options.exportable ? this.renderExportButtons() : ''}
                <table class="report-table">
                    <thead>
                        ${this.renderHeader()}
                    </thead>
                    <tbody>
                        ${this.renderBody(paginatedData)}
                    </tbody>
                </table>
                ${this.options.pagination ? this.renderPagination() : ''}
            </div>
        `;
    }

    renderHeader() {
        return `
            <tr>
                ${this.options.selectable ? '<th class="table-checkbox"><input type="checkbox" id="select-all"></th>' : ''}
                ${this.columns.map(col => `
                    <th class="${col.sortable !== false ? 'sortable' : ''}" 
                        data-column="${col.key}"
                        ${col.sortable !== false ? `onclick="this.sortTable('${col.key}')"` : ''}>
                        ${this.escapeHtml(col.label)}
                        ${col.sortable !== false && this.sortColumn === col.key ? 
                            (this.sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                `).join('')}
            </tr>
        `;
    }

    renderBody(data) {
        if (data.length === 0) {
            return `
                <tr>
                    <td colspan="${this.columns.length + (this.options.selectable ? 1 : 0)}" class="table-empty">
                        No data available
                    </td>
                </tr>
            `;
        }

        return data.map((row, index) => `
            <tr data-index="${index}">
                ${this.options.selectable ? `
                    <td class="table-checkbox">
                        <input type="checkbox" class="row-checkbox" data-index="${index}">
                    </td>
                ` : ''}
                ${this.columns.map(col => `
                    <td>${col.render ? col.render(row, index) : this.escapeHtml(row[col.key] || '')}</td>
                `).join('')}
            </tr>
        `).join('');
    }

    renderPagination() {
        const totalPages = Math.ceil(this.data.length / this.options.pageSize);
        
        return `
            <div class="table-pagination" role="navigation" aria-label="Table pagination">
                <button class="btn btn-sm" 
                        ${this.currentPage === 1 ? 'disabled aria-disabled="true"' : ''} 
                        data-action="previous"
                        aria-label="Previous page">Previous</button>
                <span class="pagination-info" aria-live="polite">
                    Page ${this.currentPage} of ${totalPages} (${this.data.length} total items)
                </span>
                <button class="btn btn-sm" 
                        ${this.currentPage === totalPages ? 'disabled aria-disabled="true"' : ''} 
                        data-action="next"
                        aria-label="Next page">Next</button>
            </div>
        `;
    }

    renderExportButtons() {
        return `
            <div class="table-export">
                <button class="btn btn-sm btn-secondary" onclick="this.exportToCSV()">Export CSV</button>
            </div>
        `;
    }

    getPaginatedData() {
        const start = (this.currentPage - 1) * this.options.pageSize;
        const end = start + this.options.pageSize;
        return this.data.slice(start, end);
    }

    sortTable(columnKey) {
        if (this.sortColumn === columnKey) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = columnKey;
            this.sortDirection = 'asc';
        }

        this.data.sort((a, b) => {
            const aVal = a[columnKey];
            const bVal = b[columnKey];
            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
    }

    exportToCSV() {
        try {
            if (!this.data || this.data.length === 0) {
                alert('No data available to export');
                return;
            }

            // Build CSV header
            let csvContent = this.columns.map(col => this.escapeCSV(col.label)).join(',') + '\n';

            // Build CSV rows
            this.data.forEach(row => {
                const values = this.columns.map(col => {
                    const value = col.render ? col.render(row, 0) : (row[col.key] || '');
                    // Remove HTML tags if present
                    const textValue = typeof value === 'string' ? value.replace(/<[^>]*>/g, '') : value;
                    return this.escapeCSV(textValue);
                });
                csvContent += values.join(',') + '\n';
            });

            // Create download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `table_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('[ReportTable] Error exporting CSV:', error);
            alert('Error exporting CSV. Please try again.');
        }
    }

    /**
     * Attach event listeners for pagination and sorting
     * @param {HTMLElement} container - Container element
     */
    attachEventListeners(container) {
        this.container = container;

        // Pagination buttons
        const prevBtn = container.querySelector('[data-action="previous"]');
        const nextBtn = container.querySelector('[data-action="next"]');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.refresh();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.data.length / this.options.pageSize);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.refresh();
                }
            });
        }

        // Sortable headers
        const sortableHeaders = container.querySelectorAll('th.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const columnKey = header.getAttribute('data-column');
                if (columnKey) {
                    this.sortTable(columnKey);
                    this.refresh();
                }
            });
        });

        // Export button
        const exportBtn = container.querySelector('.table-export button');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToCSV());
        }
    }

    /**
     * Refresh the table display
     */
    refresh() {
        if (!this.container) return;
        
        const tableContainer = this.container.querySelector('.report-table-container');
        if (tableContainer) {
            const paginatedData = this.options.pagination 
                ? this.getPaginatedData() 
                : this.data;
            
            // Update table body
            const tbody = tableContainer.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = this.renderBody(paginatedData);
            }

            // Update pagination
            if (this.options.pagination) {
                const pagination = tableContainer.querySelector('.table-pagination');
                if (pagination) {
                    pagination.outerHTML = this.renderPagination();
                    // Re-attach pagination listeners
                    this.attachEventListeners(this.container);
                }
            }
        }
    }

    escapeCSV(text) {
        if (text === null || text === undefined) return '';
        const str = String(text);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default ReportTable;

