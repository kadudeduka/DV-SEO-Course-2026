/**
 * Report Charts Component
 * 
 * Wrapper for Chart.js visualizations (line, bar, pie, progress bars)
 * Note: Chart.js will need to be installed and imported
 */

class ReportCharts {
    constructor() {
        this.charts = new Map();
    }

    /**
     * Render a line chart
     * @param {string} containerId - ID of container element
     * @param {Object} data - Chart data { labels: [], datasets: [] }
     * @returns {string} HTML string
     */
    renderLineChart(containerId, data) {
        return `
            <div id="${containerId}" class="chart-container">
                <canvas id="${containerId}-canvas"></canvas>
            </div>
        `;
    }

    /**
     * Render a bar chart
     * @param {string} containerId - ID of container element
     * @param {Object} data - Chart data
     * @returns {string} HTML string
     */
    renderBarChart(containerId, data) {
        return `
            <div id="${containerId}" class="chart-container">
                <canvas id="${containerId}-canvas"></canvas>
            </div>
        `;
    }

    /**
     * Render a pie chart
     * @param {string} containerId - ID of container element
     * @param {Object} data - Chart data
     * @returns {string} HTML string
     */
    renderPieChart(containerId, data) {
        return `
            <div id="${containerId}" class="chart-container">
                <canvas id="${containerId}-canvas"></canvas>
            </div>
        `;
    }

    /**
     * Render a progress bar
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} label - Optional label
     * @param {string} variant - Size variant ('sm', 'md', 'lg')
     * @returns {string} HTML string
     */
    renderProgressBar(progress, label = '', variant = 'md') {
        const clampedProgress = Math.max(0, Math.min(100, progress));
        // Format progress with one decimal place for consistency
        const formattedProgress = parseFloat(clampedProgress.toFixed(1));
        return `
            <div class="progress-bar-container progress-${variant}">
                ${label ? `<div class="progress-label">${this.escapeHtml(label)}</div>` : ''}
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${clampedProgress}%"></div>
                </div>
                <div class="progress-value">${formattedProgress}%</div>
            </div>
        `;
    }

    /**
     * Initialize Chart.js chart (to be called after DOM insertion)
     * @param {string} containerId - Container ID
     * @param {string} type - Chart type ('line', 'bar', 'pie')
     * @param {Object} data - Chart data
     * @param {Object} options - Chart options
     */
    async initChart(containerId, type, data, options = {}) {
        // TODO: Implement Chart.js initialization
        // This will require Chart.js to be installed
        console.log(`[ReportCharts] Chart initialization not yet implemented: ${containerId}`);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default ReportCharts;

