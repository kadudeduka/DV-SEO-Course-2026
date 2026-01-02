/**
 * Loading State Component
 * 
 * Displays loading indicator for AI Coach operations.
 * Shows animated spinner with optional message.
 */

class LoadingState {
    /**
     * Render loading state
     * @param {Object} options - Display options
     * @returns {HTMLElement} Loading state element
     */
    static render(options = {}) {
        const {
            message = 'Thinking...',
            size = 'medium', // 'small', 'medium', 'large'
            fullScreen = false
        } = options;

        const container = document.createElement('div');
        container.className = `ai-coach-loading ai-coach-loading-${size}`;
        
        if (fullScreen) {
            container.classList.add('ai-coach-loading-fullscreen');
        }

        // Spinner
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        
        // Create spinner circles
        for (let i = 0; i < 3; i++) {
            const circle = document.createElement('div');
            circle.className = `spinner-circle spinner-circle-${i + 1}`;
            spinner.appendChild(circle);
        }

        container.appendChild(spinner);

        // Message
        if (message) {
            const messageEl = document.createElement('div');
            messageEl.className = 'loading-message';
            messageEl.textContent = message;
            container.appendChild(messageEl);
        }

        return container;
    }

    /**
     * Render inline loading state (for buttons, etc.)
     * @param {string} message - Optional message
     * @returns {HTMLElement} Inline loading element
     */
    static renderInline(message = '') {
        const container = document.createElement('span');
        container.className = 'ai-coach-loading-inline';

        const spinner = document.createElement('span');
        spinner.className = 'inline-spinner';
        spinner.setAttribute('aria-label', 'Loading');
        container.appendChild(spinner);

        if (message) {
            const messageEl = document.createElement('span');
            messageEl.className = 'inline-loading-message';
            messageEl.textContent = message;
            container.appendChild(messageEl);
        }

        return container;
    }

    /**
     * Show loading state in a container
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Display options
     * @returns {Function} Cleanup function to remove loading state
     */
    static show(container, options = {}) {
        const loadingEl = this.render(options);
        container.appendChild(loadingEl);

        // Return cleanup function
        return () => {
            if (loadingEl.parentNode) {
                loadingEl.parentNode.removeChild(loadingEl);
            }
        };
    }

    /**
     * Hide loading state
     * @param {HTMLElement} container - Container element
     */
    static hide(container) {
        const loadingEl = container.querySelector('.ai-coach-loading');
        if (loadingEl) {
            loadingEl.remove();
        }
    }
}

export default LoadingState;

