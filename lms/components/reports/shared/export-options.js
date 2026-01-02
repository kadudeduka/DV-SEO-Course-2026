/**
 * Export Options Component
 * 
 * Provides export functionality (PDF, CSV, Print) for reports
 */

class ExportOptions {
    constructor() {
        this.reportData = null;
        this.reportType = null;
    }

    /**
     * Render export options
     * @param {Object} reportData - Report data to export
     * @param {string} reportType - Type of report
     * @returns {string} HTML string
     */
    render(reportData, reportType) {
        this.reportData = reportData;
        this.reportType = reportType;

        return `
            <div class="export-options">
                <button class="btn btn-sm btn-secondary" id="export-pdf" title="Export as PDF">
                    📄 PDF
                </button>
                <button class="btn btn-sm btn-secondary" id="export-csv" title="Export as CSV">
                    📊 CSV
                </button>
                <button class="btn btn-sm btn-secondary" id="export-print" title="Print report">
                    🖨️ Print
                </button>
            </div>
        `;
    }

    /**
     * Attach event listeners
     * @param {HTMLElement} container - Container element
     */
    attachEventListeners(container) {
        const pdfBtn = container.querySelector('#export-pdf');
        const csvBtn = container.querySelector('#export-csv');
        const printBtn = container.querySelector('#export-print');

        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => this.exportToPDF());
        }

        if (csvBtn) {
            csvBtn.addEventListener('click', () => this.exportToCSV());
        }

        if (printBtn) {
            printBtn.addEventListener('click', () => this.printReport());
        }
    }

    async exportToPDF() {
        // TODO: Implement PDF export using jsPDF
        console.log('[ExportOptions] PDF export not yet implemented');
        alert('PDF export will be available soon');
    }

    async exportToCSV() {
        try {
            if (!this.reportData) {
                alert('No data available to export');
                return;
            }

            // Convert report data to CSV based on report type
            let csvContent = '';
            const filename = `${this.reportType}_${new Date().toISOString().split('T')[0]}.csv`;

            switch (this.reportType) {
                case 'learner_overview':
                case 'learner_dashboard':
                    csvContent = this.exportLearnerOverviewCSV();
                    break;
                case 'learner_course':
                    csvContent = this.exportLearnerCourseCSV();
                    break;
                case 'trainer_dashboard':
                    csvContent = this.exportTrainerDashboardCSV();
                    break;
                case 'admin_dashboard':
                    csvContent = this.exportAdminDashboardCSV();
                    break;
                case 'admin_course_performance':
                    csvContent = this.exportCoursePerformanceCSV();
                    break;
                default:
                    // Generic export - try to export as table
                    csvContent = this.exportGenericCSV();
            }

            // Create download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('[ExportOptions] Error exporting CSV:', error);
            alert('Error exporting CSV. Please try again.');
        }
    }

    exportLearnerOverviewCSV() {
        const { overview, courseBreakdown } = this.reportData;
        let csv = 'Learner Performance Report\n';
        csv += `Generated: ${new Date().toLocaleString()}\n\n`;
        
        csv += 'Summary Statistics\n';
        csv += `Total Courses,${overview?.totalCourses || 0}\n`;
        csv += `Courses In Progress,${overview?.coursesInProgress || 0}\n`;
        csv += `Courses Completed,${overview?.coursesCompleted || 0}\n`;
        csv += `Overall Progress,${(overview?.overallProgress || 0).toFixed(1)}%\n`;
        csv += `Labs Submitted,${overview?.labsSubmitted || 0}\n`;
        csv += `Average Lab Score,${overview?.averageLabScore ? overview.averageLabScore.toFixed(1) + '%' : 'N/A'}\n\n`;

        if (courseBreakdown && courseBreakdown.length > 0) {
            csv += 'Course Breakdown\n';
            csv += 'Course Name,Progress,Status,Chapters Completed,Labs Submitted,Average Score\n';
            courseBreakdown.forEach(course => {
                csv += `"${this.escapeCSV(course.name)}",${(course.progress || 0).toFixed(1)}%,${course.status || 'N/A'},${course.chaptersCompleted || 0},${course.labsSubmitted || 0},${course.averageScore ? course.averageScore.toFixed(1) + '%' : 'N/A'}\n`;
            });
        }

        return csv;
    }

    exportLearnerCourseCSV() {
        const { course, overview, chapters, labs, timeline } = this.reportData;
        let csv = `Course Performance Report: ${course?.name || 'Unknown'}\n`;
        csv += `Generated: ${new Date().toLocaleString()}\n\n`;

        csv += 'Overview\n';
        csv += `Progress,${(overview?.progress || 0).toFixed(1)}%\n`;
        csv += `Chapters Completed,${overview?.chaptersCompleted || 0}\n`;
        csv += `Labs Submitted,${overview?.labsSubmitted || 0}\n`;
        csv += `Average Lab Score,${overview?.averageLabScore ? overview.averageLabScore.toFixed(1) + '%' : 'N/A'}\n\n`;

        if (chapters && chapters.length > 0) {
            csv += 'Chapter Progress\n';
            csv += 'Chapter Name,Status,Time Spent\n';
            chapters.forEach(ch => {
                csv += `"${this.escapeCSV(ch.name)}",${ch.completed ? 'Completed' : 'In Progress'},${this.formatTime(ch.timeSpent || 0)}\n`;
            });
            csv += '\n';
        }

        if (labs && labs.length > 0) {
            csv += 'Lab Performance\n';
            csv += 'Lab Name,Status,Score,Submitted At\n';
            labs.forEach(lab => {
                csv += `"${this.escapeCSV(lab.name)}",${lab.status || 'N/A'},${lab.score ? lab.score.toFixed(1) : 'N/A'},${lab.submittedAt || 'N/A'}\n`;
            });
        }

        return csv;
    }

    exportTrainerDashboardCSV() {
        const { summary, learners } = this.reportData;
        let csv = 'Trainer Dashboard Report\n';
        csv += `Generated: ${new Date().toLocaleString()}\n\n`;

        if (summary) {
            csv += 'Summary\n';
            csv += `Total Learners,${summary.totalLearners || 0}\n`;
            csv += `Average Progress,${(summary.averageProgress || 0).toFixed(1)}%\n`;
            csv += `Average Lab Score,${summary.averageLabScore ? summary.averageLabScore.toFixed(1) + '%' : 'N/A'}\n\n`;
        }

        if (learners && learners.length > 0) {
            csv += 'Learner Performance\n';
            csv += 'Name,Email,Progress,Status,Courses,Labs Submitted,Average Score\n';
            learners.forEach(learner => {
                csv += `"${this.escapeCSV(learner.name)}","${this.escapeCSV(learner.email || '')}",${(learner.progress || 0).toFixed(1)}%,${learner.status || 'N/A'},${learner.totalCourses || 0},${learner.labsSubmitted || 0},${learner.averageScore ? learner.averageScore.toFixed(1) + '%' : 'N/A'}\n`;
            });
        }

        return csv;
    }

    exportAdminDashboardCSV() {
        const { systemOverview } = this.reportData;
        let csv = 'Admin System Overview Report\n';
        csv += `Generated: ${new Date().toLocaleString()}\n\n`;

        if (systemOverview) {
            csv += 'System Statistics\n';
            csv += `Total Users,${systemOverview.totalUsers || 0}\n`;
            csv += `Total Learners,${systemOverview.totalLearners || 0}\n`;
            csv += `Total Trainers,${systemOverview.totalTrainers || 0}\n`;
            csv += `Total Courses,${systemOverview.totalCourses || 0}\n`;
            csv += `Published Courses,${systemOverview.publishedCourses || 0}\n`;
            csv += `Active Users (Last 30 days),${systemOverview.activeUsers || 0}\n`;
            csv += `Average Completion Rate,${(systemOverview.averageCompletionRate || 0).toFixed(1)}%\n`;
            csv += `Average Lab Score,${systemOverview.averageLabScore ? systemOverview.averageLabScore.toFixed(1) + '%' : 'N/A'}\n`;
        }

        return csv;
    }

    exportCoursePerformanceCSV() {
        const { course, overview, learners, chapterAnalysis, labAnalysis } = this.reportData;
        let csv = `Course Performance Report: ${course?.name || 'Unknown'}\n`;
        csv += `Generated: ${new Date().toLocaleString()}\n\n`;

        if (overview) {
            csv += 'Course Overview\n';
            csv += `Total Enrollments,${overview.totalEnrollments || 0}\n`;
            csv += `Active Learners,${overview.activeLearners || 0}\n`;
            csv += `Completion Rate,${(overview.completionRate || 0).toFixed(1)}%\n`;
            csv += `Average Progress,${(overview.averageProgress || 0).toFixed(1)}%\n`;
            csv += `Average Lab Score,${overview.averageLabScore ? overview.averageLabScore.toFixed(1) : 'N/A'}\n\n`;
        }

        if (learners && learners.length > 0) {
            csv += 'Learner Performance\n';
            csv += 'Name,Progress,Status,Labs Submitted,Average Score\n';
            learners.forEach(learner => {
                csv += `"${this.escapeCSV(learner.name)}",${(learner.progress || 0).toFixed(1)}%,${learner.status || 'N/A'},${learner.labsSubmitted || 0},${learner.averageScore ? learner.averageScore.toFixed(1) + '%' : 'N/A'}\n`;
            });
            csv += '\n';
        }

        if (chapterAnalysis && chapterAnalysis.length > 0) {
            csv += 'Chapter Analysis\n';
            csv += 'Chapter Name,Completion Rate,Average Time to Complete\n';
            chapterAnalysis.forEach(chapter => {
                csv += `"${this.escapeCSV(chapter.name)}",${(chapter.completionRate || 0).toFixed(1)}%,${this.formatTime((chapter.averageTimeToComplete || 0) * 60)}\n`;
            });
        }

        return csv;
    }

    exportGenericCSV() {
        // Generic export - try to find table-like data
        let csv = `Report Export: ${this.reportType}\n`;
        csv += `Generated: ${new Date().toLocaleString()}\n\n`;
        csv += 'Data exported in generic format. Please use specific export for better formatting.\n';
        return csv;
    }

    escapeCSV(text) {
        if (text === null || text === undefined) return '';
        const str = String(text);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    formatTime(seconds) {
        if (!seconds || seconds === 0) return '0 min';
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        return `${minutes}m`;
    }

    printReport() {
        window.print();
    }
}

export default ExportOptions;

