/**
 * AI Coach Widget Component
 * 
 * Main widget for learners to interact with AI Coach.
 * Course-aware, automatically detects current course from page context.
 */

// Lazy imports to avoid circular dependencies and loading issues
let aiCoachService = null;
let authService = null;
let MessageBubble = null;
let LoadingState = null;
let supabaseClient = null;

// Lazy load services
async function loadServices() {
    try {
        if (!authService) {
            const authModule = await import('../../../services/auth-service.js');
            authService = authModule.authService;
        }
        if (!MessageBubble) {
            const messageModule = await import('../shared/message-bubble.js');
            MessageBubble = messageModule.default;
        }
        if (!LoadingState) {
            const loadingModule = await import('../shared/loading-state.js');
            LoadingState = loadingModule.default;
        }
        if (!supabaseClient) {
            const supabaseModule = await import('../../../services/supabase-client.js');
            supabaseClient = supabaseModule.supabaseClient;
        }
        // Load AI Coach service last (it has the most dependencies)
        if (!aiCoachService) {
            const aiCoachModule = await import('../../../services/ai-coach-service.js');
            aiCoachService = aiCoachModule.aiCoachService;
        }
    } catch (error) {
        console.error('[AICoachWidget] Error loading services:', error);
        throw error;
    }
}

class AICoachWidget {
    constructor(containerId = 'ai-coach-widget-container') {
        this.containerId = containerId;
        this.container = null;
        this.currentUser = null;
        this.currentCourseId = null;
        this.messages = [];
        this.isMinimized = false;
        this.isVisible = false;
    }

    /**
     * Initialize widget
     */
    async init() {
        try {
            // Load basic services first (auth, UI components, supabase)
            if (!authService) {
                const authModule = await import('../../../services/auth-service.js');
                authService = authModule.authService;
            }
            if (!MessageBubble) {
                const messageModule = await import('../shared/message-bubble.js');
                MessageBubble = messageModule.default;
            }
            if (!LoadingState) {
                const loadingModule = await import('../shared/loading-state.js');
                LoadingState = loadingModule.default;
            }
            if (!supabaseClient) {
                try {
                    const supabaseModule = await import('../../../services/supabase-client.js');
                    // Use getSupabaseClient() function instead of const export for better error handling
                    if (supabaseModule.getSupabaseClient) {
                        supabaseClient = supabaseModule.getSupabaseClient();
                    } else if (supabaseModule.supabaseClient) {
                        supabaseClient = supabaseModule.supabaseClient;
                    }
                } catch (error) {
                    console.warn('[AICoachWidget] Failed to load supabaseClient during init:', error);
                }
            }
        } catch (error) {
            console.error('[AICoachWidget] Error loading basic services:', error);
            // Still try to show widget with error message
        }
        
        // Get current user
        try {
            this.currentUser = await authService.getCurrentUser();
            if (!this.currentUser) {
                console.warn('[AICoachWidget] No current user, widget will not initialize');
                return;
            }
        } catch (error) {
            console.error('[AICoachWidget] Error getting current user:', error);
            return;
        }

        // Check if we're on a valid course learning page
        if (!this._isValidCoursePage()) {
            return;
        }

        // Detect current course from page context
        this.currentCourseId = this._detectCurrentCourse();

        // Create widget container if it doesn't exist
        this._createContainer();

        // Load conversation history FIRST (before rendering)
        // This ensures messages are available when widget is rendered
        try {
            await this.loadConversationHistory();
        } catch (error) {
            console.warn('[AICoachWidget] Error loading conversation history:', error);
        }

        // Load recent queries (optional, don't fail if it errors)
        // This will merge with conversation history and avoid duplicates
        try {
            await this.loadRecentQueries();
        } catch (error) {
            console.warn('[AICoachWidget] Error loading recent queries:', error);
        }

        // Sort messages by timestamp to ensure correct order
        if (this.messages.length > 0) {
            this.messages.sort((a, b) => {
                const timeA = new Date(a.timestamp || 0).getTime();
                const timeB = new Date(b.timestamp || 0).getTime();
                return timeA - timeB;
            });
        }

        // Render widget (now with messages loaded)
        await this.render();

        // Attach event listeners
        this.attachEventListeners();

        // Show widget
        this.show();
    }

    /**
     * Check if current page is a valid course learning page
     * @returns {boolean} True if on a course learning page
     */
    _isValidCoursePage() {
        const hash = window.location.hash.slice(1);
        
        // Exclude non-course pages explicitly
        const excludedRoutes = [
            '/courses',
            '/courses/my-courses'
        ];
        
        if (excludedRoutes.includes(hash) || hash.startsWith('/courses/my-courses')) {
            return false;
        }
        
        // Valid routes (must have a course ID, not just /courses):
        // - /courses/:id (overview/detail page) - but NOT /courses/my-courses
        // - /courses/:id/learn (learning page)
        // - /courses/:id/content/:chapterId (chapter content page)
        // - /courses/:id/lab/:labId (lab page)
        const validPatterns = [
            /^\/courses\/[^\/]+$/,                          // /courses/:id (overview)
            /^\/courses\/[^\/]+\/learn$/,                   // /courses/:id/learn
            /^\/courses\/[^\/]+\/content\/[^\/]+$/,         // /courses/:id/content/:chapterId
            /^\/courses\/[^\/]+\/lab\/[^\/]+$/              // /courses/:id/lab/:labId
        ];
        
        const matches = validPatterns.some(pattern => pattern.test(hash));
        
        // Additional check: ensure it's not /courses/my-courses (which matches /^\/courses\/[^\/]+$/)
        if (matches && hash.startsWith('/courses/my-courses')) {
            return false;
        }
        
        return matches;
    }

    /**
     * Detect current course from page URL/context
     * @returns {string|null} Course ID or null
     */
    _detectCurrentCourse() {
        // Only detect course if we're on a valid course page
        if (!this._isValidCoursePage()) {
            return null;
        }

        // Try to get from URL
        const hash = window.location.hash;
        const courseMatch = hash.match(/\/courses\/([^\/]+)/);
        if (courseMatch) {
            return courseMatch[1];
        }

        // Try to get from page data attribute
        const courseElement = document.querySelector('[data-course-id]');
        if (courseElement) {
            return courseElement.getAttribute('data-course-id');
        }

        // Try to get from app container
        const appContainer = document.getElementById('app-container');
        if (appContainer && appContainer.dataset.courseId) {
            return appContainer.dataset.courseId;
        }

        return null;
    }

    /**
     * Create widget container
     */
    _createContainer() {
        // Check if container already exists
        let container = document.getElementById(this.containerId);
        
        if (!container) {
            container = document.createElement('div');
            container.id = this.containerId;
            container.style.position = 'fixed';
            container.style.zIndex = '10000';
            container.style.pointerEvents = 'auto';
            document.body.appendChild(container);
        }

        this.container = container;
    }

    /**
     * Render widget
     */
    async render() {
        if (!this.container) {
            console.warn('[AICoachWidget] Cannot render: container is null');
            return;
        }

        // Get coach name (with personalization if available)
        const coachName = await this._getCoachName();

        this.container.innerHTML = `
            <div class="ai-coach-widget ${this.isMinimized ? 'minimized' : ''}">
                <div class="ai-coach-widget-header" id="widget-header">
                    <div>
                        <h3>${coachName}</h3>
                        ${this.currentCourseId ? `<div class="course-indicator">${this._getCourseName()}</div>` : ''}
                    </div>
                    <div class="ai-coach-widget-controls">
                        <button id="minimize-btn" aria-label="Minimize">−</button>
                    </div>
                </div>
                <div class="ai-coach-widget-body">
                    <div class="ai-coach-messages" id="messages-area">
                        ${this.messages.length === 0 ? this._renderWelcomeMessage() : ''}
                    </div>
                    <div class="ai-coach-input-area">
                        <div class="ai-coach-input-wrapper">
                            <textarea 
                                id="query-input" 
                                class="ai-coach-input" 
                                placeholder="Ask a question about the course..."
                                rows="1"
                            ></textarea>
                            <button id="send-btn" class="ai-coach-send-button">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Ensure no recent queries section exists (cleanup from old code)
        const recentQueriesSection = this.container.querySelector('.recent-queries-section');
        if (recentQueriesSection) {
            recentQueriesSection.remove();
        }

        // Render existing messages
        const messagesArea = document.getElementById('messages-area');
        if (messagesArea) {
            if (this.messages.length > 0) {
                // Clear welcome message if we have messages
                messagesArea.innerHTML = '';
                for (const message of this.messages) {
                    const messageEl = await this._renderMessage(message);
                    messagesArea.appendChild(messageEl);
                }
                this._scrollToBottom();
            }
        }
    }

    /**
     * Get coach name (with personalization)
     * @returns {Promise<string>} Coach name
     */
    async _getCoachName() {
        if (!this.currentCourseId) {
            console.warn('[AICoachWidget] No currentCourseId, returning default coach name');
            return 'AI Coach';
        }

        try {
            // Only use personalization for learners, not trainers or admins
            if (!this.currentUser || this.currentUser.role !== 'learner') {
                console.log(`[AICoachWidget] User is not a learner (role: ${this.currentUser?.role || 'unknown'}), returning default coach name`);
                return 'AI Coach';
            }

            // Lazy load trainer personalization service
            const { trainerPersonalizationService } = await import('../../../services/trainer-personalization-service.js');
            
            const learnerId = this.currentUser.id;
            console.log(`[AICoachWidget] Fetching coach name for learner ${learnerId} in course ${this.currentCourseId}`);
            
            // Clear cache before fetching to ensure fresh data
            trainerPersonalizationService.clearCache(this.currentCourseId, learnerId);
            
            let coachName;
            try {
                coachName = await trainerPersonalizationService.getCoachName(this.currentCourseId, learnerId);
                console.log(`[AICoachWidget] Retrieved coach name: "${coachName}" for learner ${learnerId} in course ${this.currentCourseId}`);
            } catch (error) {
                console.error(`[AICoachWidget] Error fetching coach name:`, error);
                coachName = 'AI Coach';
            }
            
            if (!coachName || coachName === 'AI Coach') {
                console.warn(`[AICoachWidget] Personalization may not be set up correctly for learner ${learnerId} in course ${this.currentCourseId}. Coach name: "${coachName}"`);
            }
            
            return coachName || 'AI Coach';
        } catch (error) {
            console.error('[AICoachWidget] Error getting coach name:', error);
            return 'AI Coach';
        }
    }

    /**
     * Get course name
     * @returns {string} Course name
     */
    _getCourseName() {
        if (!this.currentCourseId) return '';

        // Try to get from course data
        // TODO: Load course name from course service
        return this.currentCourseId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Render welcome message
     * @returns {string} Welcome message HTML
     */
    _renderWelcomeMessage() {
        return `
            <div class="ai-coach-welcome">
                <p>👋 Hi! I'm your AI Coach. I can help you with questions about this course.</p>
                <p>Try asking:</p>
                <ul>
                    <li>"What is on-page SEO?"</li>
                    <li>"Where can I find information about keyword research?"</li>
                    <li>"I need help with the lab on Day 1"</li>
                </ul>
            </div>
        `;
    }


    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Minimize button
        const minimizeBtn = document.getElementById('minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.toggleMinimize());
        }

        // Header click to expand
        const header = document.getElementById('widget-header');
        if (header) {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.ai-coach-widget-controls')) return;
                if (this.isMinimized) {
                    this.toggleMinimize();
                }
            });
        }

        // Send button
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.handleSend());
        }


        // Input enter key
        const queryInput = document.getElementById('query-input');
        if (queryInput) {
            queryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSend();
                }
            });

            // Auto-resize textarea
            queryInput.addEventListener('input', () => {
                queryInput.style.height = 'auto';
                queryInput.style.height = `${Math.min(queryInput.scrollHeight, 120)}px`;
            });
        }

        // Listen for route changes
        this._hashChangeHandler = async () => {
            const isValidPage = this._isValidCoursePage();
            const newCourseId = this._detectCurrentCourse();
            
            if (!isValidPage) {
                // Not on a course learning page - hide widget
                this.hide();
                return;
            }

            // On a valid course page
            if (newCourseId !== this.currentCourseId) {
                this.currentCourseId = newCourseId;
                this.messages = []; // Clear messages for new course
                
                // Clear personalization cache for the new course
                try {
                    const { trainerPersonalizationService } = await import('../../../services/trainer-personalization-service.js');
                    trainerPersonalizationService.clearCache(newCourseId, this.currentUser?.id);
                } catch (error) {
                    console.warn('[AICoachWidget] Error clearing personalization cache:', error);
                }
                
                await this.render();
                // Re-attach event listeners after re-rendering
                this.attachEventListeners();
                await this.loadConversationHistory();
                this.show(); // Ensure widget is visible on course pages
            } else if (!this.isVisible) {
                // Same course but widget was hidden - show it
                this.show();
            }
        };
        window.addEventListener('hashchange', this._hashChangeHandler);

        // Listen for logout events
        this._logoutHandler = () => {
            this.hide();
            this.destroy();
        };
        window.addEventListener('user-logged-out', this._logoutHandler);

        // Also listen for auth state changes
        if (authService) {
            // Check auth state periodically (fallback)
            const checkAuth = setInterval(() => {
                authService.getCurrentUser().then(user => {
                    if (!user && this.isVisible) {
                        this.hide();
                        this.destroy();
                        clearInterval(checkAuth);
                    }
                }).catch(() => {
                    // User not authenticated
                    if (this.isVisible) {
                        this.hide();
                        this.destroy();
                        clearInterval(checkAuth);
                    }
                });
            }, 2000); // Check every 2 seconds

            // Clean up interval when widget is destroyed
            this._authCheckInterval = checkAuth;
        }

        // Listen for feedback events
        this._feedbackHandler = (e) => {
            this.handleFeedback(e.detail.messageId, e.detail.rating);
        };
        window.addEventListener('ai-coach-feedback', this._feedbackHandler);
    }

    /**
     * Handle send button click
     */
    async handleSend() {
        // Check if on valid course page
        if (!this._isValidCoursePage()) {
            alert('AI Coach is only available on course learning pages. Please navigate to a course to use it.');
            this.hide();
            return;
        }

        const queryInput = document.getElementById('query-input');
        const sendBtn = document.getElementById('send-btn');
        const messagesArea = document.getElementById('messages-area');

        if (!queryInput || !sendBtn || !messagesArea) return;

        const question = queryInput.value.trim();
        if (!question) return;

        if (!this.currentCourseId) {
            alert('Please navigate to a course page to use AI Coach.');
            return;
        }

        // Disable input
        queryInput.disabled = true;
        sendBtn.disabled = false;
        
        // Load AI Coach service when needed (lazy)
        try {
            if (!aiCoachService) {
                const aiCoachModule = await import('../../../services/ai-coach-service.js');
                aiCoachService = aiCoachModule.aiCoachService;
                if (!aiCoachService) {
                    throw new Error('aiCoachService not found in module');
                }
            }
        } catch (error) {
            console.error('[AICoachWidget] Error loading AI Coach service:', error);
            console.error('[AICoachWidget] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            // Show error to user
            const errorMessage = {
                id: `error-${Date.now()}`,
                type: 'ai',
                answer: 'Sorry, AI Coach service is temporarily unavailable. Please try again later.',
                timestamp: new Date().toISOString()
            };
            this.messages.push(errorMessage);
            const errorMessageEl = await this._renderMessage(errorMessage);
            messagesArea.appendChild(errorMessageEl);
            this._scrollToBottom();
            queryInput.disabled = false;
            sendBtn.disabled = false;
            return;
        }
        
        sendBtn.disabled = true;
        
        // Add user message
        const userMessage = {
            id: `user-${Date.now()}`,
            type: 'user',
            text: question,
            timestamp: new Date().toISOString()
        };
        this.messages.push(userMessage);
        const userMessageEl = await this._renderMessage(userMessage);
        messagesArea.appendChild(userMessageEl);
        this._scrollToBottom();

        // Clear input
        queryInput.value = '';
        queryInput.style.height = 'auto';

        // Show loading
        const loadingEl = LoadingState.render({ message: 'Thinking...' });
        messagesArea.appendChild(loadingEl);
        this._scrollToBottom();

        try {
            // Process query with timeout protection
            const queryPromise = aiCoachService.processQuery(
                this.currentUser.id,
                this.currentCourseId,
                question
            );
            
            // Add timeout (120 seconds for complex queries like AEO, Technical SEO that need dedicated chapter search)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Query processing timed out after 120 seconds. This may happen with complex queries. Please try rephrasing your question or try again.'));
                }, 120000); // Increased to 120 seconds
            });
            
            const response = await Promise.race([queryPromise, timeoutPromise]);

            // Remove loading
            loadingEl.remove();

            if (response.success) {
                // Add AI response
                const aiMessage = {
                    id: response.responseId,
                    type: 'ai',
                    answer: response.answer,
                    references: response.references,
                    confidence: response.confidence,
                    isLabGuidance: response.isLabGuidance,
                    escalated: response.escalated,
                    escalationId: response.escalationId,
                    timestamp: new Date().toISOString()
                };
                this.messages.push(aiMessage);
                const aiMessageEl = await this._renderMessage(aiMessage);
                messagesArea.appendChild(aiMessageEl);
                this._scrollToBottom();

                // Check if escalated
                if (response.escalated) {
                    this._showEscalationNotice(response.escalationId);
                }
            } else {
                console.error('[AICoachWidget] Query processing failed:', response.error);
                // Show error message
                const errorMessage = {
                    id: `error-${Date.now()}`,
                    type: 'ai',
                    answer: response.error || 'Sorry, I encountered an error. Please try again.',
                    timestamp: new Date().toISOString()
                };
                this.messages.push(errorMessage);
                const errorMessageEl = await this._renderMessage(errorMessage);
                messagesArea.appendChild(errorMessageEl);
                this._scrollToBottom();
            }
        } catch (error) {
            console.error('[AICoachWidget] Error processing query:', error);
            console.error('[AICoachWidget] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // Remove loading
            loadingEl.remove();

            // Show error
            const errorMessage = {
                id: `error-${Date.now()}`,
                type: 'ai',
                answer: `Sorry, I encountered an error: ${error.message}. Please check the console for details.`,
                timestamp: new Date().toISOString()
            };
            this.messages.push(errorMessage);
            const errorMessageEl = await this._renderMessage(errorMessage);
            messagesArea.appendChild(errorMessageEl);
            this._scrollToBottom();
        } finally {
            // Re-enable input
            queryInput.disabled = false;
            sendBtn.disabled = false;
            queryInput.focus();
        }
    }

    /**
     * Render message
     * @param {Object} message - Message object
     * @returns {HTMLElement} Message element
     */
    _renderMessage(message) {
        return MessageBubble.render(message, {
            type: message.type,
            showTimestamp: true,
            showFeedback: message.type === 'ai',
            showConfidence: message.type === 'ai' && message.confidence !== undefined && message.confidence < 0.65,
            courseId: this.currentCourseId
        });
    }

    /**
     * Load recent queries as chat messages
     */
    async loadRecentQueries() {
        if (!this.currentCourseId || !this.currentUser) {
            return;
        }

        try {
            const { queryHistoryService } = await import('../../../services/query-history-service.js');
            const recentQueries = await queryHistoryService.getRecentQueries(
                this.currentUser.id,
                this.currentCourseId,
                10 // Load more queries to show as chat history
            );

            if (!recentQueries || recentQueries.length === 0) {
                return;
            }

            // Convert recent queries to message format and add to messages array
            // Only add if not already in messages (to avoid duplicates from conversation history)
            const existingMessageIds = new Set(this.messages.map(m => m.id));
            
            // Sort by creation date (oldest first for proper chat order)
            const sortedQueries = [...recentQueries].sort((a, b) => 
                new Date(a.createdAt) - new Date(b.createdAt)
            );

            for (const query of sortedQueries) {
                // Add user message (question)
                if (!existingMessageIds.has(query.id)) {
                    this.messages.push({
                        id: query.id,
                        type: 'user',
                        text: query.question,
                        timestamp: query.createdAt
                    });
                    existingMessageIds.add(query.id);
                }

                // Add AI response if available
                if (query.latestResponse && !existingMessageIds.has(query.latestResponse.id)) {
                    this.messages.push({
                        id: query.latestResponse.id,
                        type: 'ai',
                        answer: query.latestResponse.answer,
                        references: query.latestResponse.references || [],
                        confidence: query.latestResponse.confidence_score,
                        timestamp: query.latestResponse.created_at
                    });
                    existingMessageIds.add(query.latestResponse.id);
                }
            }

            // Re-render messages in the chat window
            const messagesArea = document.getElementById('messages-area');
            if (messagesArea) {
                // Clear welcome message and any existing content
                messagesArea.innerHTML = '';
                
                // Remove any recent queries section that might exist
                const recentQueriesSection = this.container?.querySelector('.recent-queries-section');
                if (recentQueriesSection) {
                    recentQueriesSection.remove();
                }
                
                // Render all messages
                for (const message of this.messages) {
                    const messageEl = await this._renderMessage(message);
                    messagesArea.appendChild(messageEl);
                }
                this._scrollToBottom();
            }
        } catch (error) {
            console.warn('[AICoachWidget] Error loading recent queries:', error);
        }
    }

    /**
     * Load conversation history
     */
    async loadConversationHistory() {
        if (!this.currentUser || !this.currentCourseId) return;

        // Get supabaseClient - use function form for better error handling
        let client = supabaseClient;
        if (!client) {
            try {
                const supabaseModule = await import('../../../services/supabase-client.js');
                // Always use getSupabaseClient() function - it handles initialization better
                if (supabaseModule.getSupabaseClient) {
                    try {
                        client = supabaseModule.getSupabaseClient();
                        // Update the module-level variable for future use
                        supabaseClient = client;
                    } catch (initError) {
                        // getSupabaseClient() might throw if config is not loaded
                        console.warn('[AICoachWidget] Failed to initialize supabaseClient:', initError);
                        return;
                    }
                } else if (supabaseModule.supabaseClient) {
                    client = supabaseModule.supabaseClient;
                    supabaseClient = client;
                } else {
                    console.warn('[AICoachWidget] supabaseClient not available in module');
                    return;
                }
            } catch (error) {
                console.warn('[AICoachWidget] Failed to load supabaseClient module:', error);
                return;
            }
        }

        // Final check - ensure client is valid before use
        if (!client || typeof client.from !== 'function') {
            console.warn('[AICoachWidget] supabaseClient is not available or invalid, skipping conversation history', {
                client: client,
                hasFrom: client ? typeof client.from : 'N/A'
            });
            return;
        }

        try {
            const { data: history } = await client
                .from('ai_coach_conversation_history')
                .select(`
                    query_id,
                    response_id,
                    ai_coach_queries!inner(question, created_at),
                    ai_coach_responses!inner(answer, reference_locations, confidence_score, is_lab_guidance, created_at)
                `)
                .eq('learner_id', this.currentUser.id)
                .eq('course_id', this.currentCourseId)
                .order('sequence_number', { ascending: true })
                .limit(20);

            if (!history || history.length === 0) return;

            // Reconstruct messages from history
            this.messages = [];
            history.forEach(item => {
                if (item.ai_coach_queries) {
                    this.messages.push({
                        id: item.query_id,
                        type: 'user',
                        text: item.ai_coach_queries.question,
                        timestamp: item.ai_coach_queries.created_at
                    });
                }

                if (item.ai_coach_responses) {
                    this.messages.push({
                        id: item.response_id,
                        type: 'ai',
                        answer: item.ai_coach_responses.answer,
                        references: item.ai_coach_responses.reference_locations,
                        confidence: item.ai_coach_responses.confidence_score,
                        isLabGuidance: item.ai_coach_responses.is_lab_guidance,
                        timestamp: item.ai_coach_responses.created_at
                    });
                }
            });

            // Sort messages by timestamp to ensure correct order
            this.messages.sort((a, b) => {
                const timeA = new Date(a.timestamp || 0).getTime();
                const timeB = new Date(b.timestamp || 0).getTime();
                return timeA - timeB;
            });

            // Re-render messages (only if widget is already rendered)
            const messagesArea = document.getElementById('messages-area');
            if (messagesArea) {
                messagesArea.innerHTML = '';
                for (const message of this.messages) {
                    const messageEl = await this._renderMessage(message);
                    messagesArea.appendChild(messageEl);
                }
                this._scrollToBottom();
            }
            // If widget not rendered yet, messages will be rendered in render() method
        } catch (error) {
            console.error('[AICoachWidget] Error loading conversation history:', error);
        }
    }

    /**
     * Handle feedback
     * @param {string} messageId - Message ID
     * @param {string} rating - 'helpful' or 'not_helpful'
     */
    async handleFeedback(messageId, rating) {
        try {
            // Find response ID from message
            const message = this.messages.find(m => m.id === messageId);
            if (!message || message.type !== 'ai') return;

            const responseId = messageId;

            // Ensure supabaseClient is loaded
            if (!supabaseClient) {
                try {
                    const supabaseModule = await import('../../../services/supabase-client.js');
                    // Use getSupabaseClient() function instead of const export for better error handling
                    if (supabaseModule.getSupabaseClient) {
                        supabaseClient = supabaseModule.getSupabaseClient();
                    } else if (supabaseModule.supabaseClient) {
                        supabaseClient = supabaseModule.supabaseClient;
                    } else {
                        throw new Error('Database not available');
                    }
                } catch (error) {
                    console.warn('[AICoachWidget] Failed to load supabaseClient for feedback:', error);
                    throw new Error('Database not available');
                }
            }

            if (!supabaseClient || typeof supabaseClient.from !== 'function') {
                throw new Error('Database not available');
            }

            // Submit feedback
            const { error } = await supabaseClient
                .from('ai_coach_feedback')
                .insert({
                    response_id: responseId,
                    learner_id: this.currentUser.id,
                    rating: rating === 'helpful' ? 'helpful' : 'not_helpful',
                    is_lab_guidance_feedback: message.isLabGuidance || false
                });

            if (error) {
                console.error('[AICoachWidget] Error submitting feedback:', error);
            }
        } catch (error) {
            console.error('[AICoachWidget] Error handling feedback:', error);
        }
    }

    /**
     * Show escalation notice
     */
    _showEscalationNotice(escalationId = null) {
        const notice = document.createElement('div');
        notice.className = 'ai-coach-escalation-notice';
        notice.innerHTML = `
            <div style="padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin: 10px 0;">
                <p style="margin: 0; color: #856404;">
                    ⚠️ <strong>Escalated to Trainer</strong><br>
                    Your question has been escalated to your trainer due to low AI confidence. 
                    They will review and respond soon. You'll be notified when they respond.
                </p>
            </div>
        `;
        
        const messagesArea = document.getElementById('messages-area');
        if (messagesArea) {
            messagesArea.appendChild(notice);
            this._scrollToBottom();
        }
    }

    /**
     * Toggle minimize
     */
    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        const widget = this.container?.querySelector('.ai-coach-widget');
        if (widget) {
            widget.classList.toggle('minimized', this.isMinimized);
        }
    }

    /**
     * Show widget
     */
    show() {
        // Only show on valid course learning pages
        if (!this._isValidCoursePage()) {
            return;
        }

        // Only show if we have a valid course
        if (!this.currentCourseId) {
            console.warn('[AICoachWidget] No course ID, cannot show widget');
            return;
        }

        if (this.container) {
            this.container.style.display = 'block';
            this.isVisible = true;
            
            // Also ensure the widget itself is visible
            const widget = this.container.querySelector('.ai-coach-widget');
            if (widget) {
                widget.style.display = 'flex';
            } else {
                console.error('[AICoachWidget] Widget element not found in container!');
            }
        } else {
            console.error('[AICoachWidget] Container is null, cannot show widget');
        }
    }

    /**
     * Hide widget
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.isVisible = false;
        }
    }

    /**
     * Destroy the widget and clean up
     */
    destroy() {
        // Clear auth check interval
        if (this._authCheckInterval) {
            clearInterval(this._authCheckInterval);
            this._authCheckInterval = null;
        }

        // Remove event listeners
        window.removeEventListener('hashchange', this._hashChangeHandler);
        window.removeEventListener('user-logged-out', this._logoutHandler);
        window.removeEventListener('ai-coach-feedback', this._feedbackHandler);

        // Remove widget from DOM
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        // Clear state
        this.container = null;
        this.currentUser = null;
        this.currentCourseId = null;
        this.messages = [];
        this.isVisible = false;
    }

    /**
     * Scroll to bottom of messages
     */
    _scrollToBottom() {
        const messagesArea = document.getElementById('messages-area');
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }
}

export default AICoachWidget;

