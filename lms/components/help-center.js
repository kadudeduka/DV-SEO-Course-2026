/**
 * Help & Support Center Component
 * 
 * Provides help documentation, FAQs, and support contact options.
 */

import { authService } from '../services/auth-service.js';
import { router } from '../core/router.js';
import Header from './header.js';

class HelpCenter {
    constructor(container) {
        this.container = container;
        this.currentUser = null;
        this.activeCategory = 'getting-started';
        this.searchQuery = '';
        this.faqs = this.getFAQs();
    }

    /**
     * Show help center
     */
    async show() {
        if (this.container) {
            this.container.style.display = 'block';
        }

        await this.renderHeader();
        await this.loadUser();
        this.render();
    }

    /**
     * Render header
     */
    async renderHeader() {
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            const header = new Header(headerContainer);
            await header.init();
        }
    }

    /**
     * Load current user
     */
    async loadUser() {
        try {
            this.currentUser = await authService.getCurrentUser();
        } catch (error) {
            console.warn('[HelpCenter] Failed to get current user:', error);
        }
    }

    /**
     * Get FAQs organized by category
     */
    getFAQs() {
        return {
            'getting-started': [
                {
                    question: 'How do I get started with the LMS?',
                    answer: 'After logging in, you\'ll see your dashboard. Navigate to "Courses" to view available courses. Click on a course to start learning. Complete chapters and labs to progress through the course. Use the AI Coach widget on course pages to get instant help with your questions.'
                },
                {
                    question: 'How do I access my assigned courses?',
                    answer: 'Go to "My Courses" from the navigation menu. Here you\'ll see all courses assigned to you, along with your progress for each course.'
                },
                {
                    question: 'How do I submit a lab assignment?',
                    answer: 'Navigate to the lab within a course. Complete the lab requirements and upload your submission file. Click "Submit" to send it for review by your trainer.'
                },
                {
                    question: 'How do I track my progress?',
                    answer: 'Your progress is automatically tracked as you complete chapters and labs. View your overall progress on the dashboard or within individual course pages.'
                },
                {
                    question: 'What is the AI Coach?',
                    answer: 'The AI Coach is your personal learning assistant available on all course pages. It can answer questions about course content, help you understand concepts, and guide you through labs without giving direct answers. The AI Coach is personalized by your trainer and optimized for each course.'
                }
            ],
            'ai-coach': [
                {
                    question: 'What is the AI Coach?',
                    answer: 'The AI Coach is an intelligent learning assistant that appears on course pages (overview, learn, content, and lab pages). It can answer questions about course content, help you understand concepts, and provide guidance on labs. Each course has its own optimized AI Coach instance.'
                },
                {
                    question: 'How do I use the AI Coach?',
                    answer: 'The AI Coach widget appears automatically on course pages. Simply type your question in the input box and click "Send". The AI Coach will provide a concise, helpful answer based on the course content. You can minimize the widget using the "−" button if you need more screen space.'
                },
                {
                    question: 'What can I ask the AI Coach?',
                    answer: 'You can ask questions about course content, concepts, where to find specific information, or get help with labs. Examples: "What is on-page SEO?", "Where can I find information about keyword research?", or "I need help with the lab on Day 1". The AI Coach is designed to guide you without providing direct answers to lab questions.'
                },
                {
                    question: 'Can the AI Coach help me with labs?',
                    answer: 'Yes! The AI Coach can guide you through labs when you\'re struggling, but it will not provide direct answers. It will help you understand concepts, point you to relevant course materials, and suggest approaches without doing the work for you.'
                },
                {
                    question: 'Why is my AI Coach personalized?',
                    answer: 'Your trainer can personalize the AI Coach with their name, expertise, and teaching style. This makes the AI Coach feel more like your trainer is helping you. The coach name may appear as "{Trainer Name}\'s AI Coach" when personalization is enabled.'
                },
                {
                    question: 'What if the AI Coach doesn\'t know the answer?',
                    answer: 'If the AI Coach has low confidence in its answer, your question will be automatically escalated to your trainer. You\'ll see a notice when this happens, and your trainer will review and respond to your question directly.'
                },
                {
                    question: 'How do I provide feedback on AI Coach responses?',
                    answer: 'After each AI Coach response, you\'ll see "👍" (helpful) and "👎" (not helpful) buttons. Click these to provide feedback, which helps improve the AI Coach\'s responses over time.'
                },
                {
                    question: 'Where does the AI Coach appear?',
                    answer: 'The AI Coach widget appears on all course learning pages: course overview, learn page, chapter content pages, and lab pages. It does not appear on other pages like "My Courses" or the main courses listing.'
                }
            ],
            'courses': [
                {
                    question: 'How are courses structured?',
                    answer: 'Courses are organized into days, each containing multiple chapters and labs. Complete chapters to learn the material, then work on labs to apply your knowledge.'
                },
                {
                    question: 'Can I access courses offline?',
                    answer: 'Currently, courses require an internet connection. We\'re working on offline access features for future updates.'
                },
                {
                    question: 'What happens if I don\'t complete a course?',
                    answer: 'Your progress is saved automatically. You can return to any course at any time and continue from where you left off.'
                },
                {
                    question: 'How do I get a certificate?',
                    answer: 'Certificates are awarded upon successful completion of all course requirements, including all labs and assessments. Contact your trainer for more information.'
                }
            ],
            'submissions': [
                {
                    question: 'How do I submit a lab?',
                    answer: 'Navigate to the lab page within your course. Complete the lab requirements, prepare your submission file, and click the "Submit" button. Upload your file and add any comments if needed.'
                },
                {
                    question: 'What file formats are accepted?',
                    answer: 'Most common file formats are accepted, including .zip, .pdf, .doc, .docx, and code files. Check with your trainer for specific requirements.'
                },
                {
                    question: 'How long does it take to get feedback?',
                    answer: 'Feedback typically arrives within 2-3 business days. You\'ll receive a notification when your submission has been reviewed.'
                },
                {
                    question: 'What if my submission is rejected?',
                    answer: 'If your submission needs revision, you\'ll receive detailed feedback from your trainer. Make the necessary changes and resubmit your work.'
                },
                {
                    question: 'Can I resubmit a lab?',
                    answer: 'Yes, you can resubmit labs if your previous submission was rejected or if you need to make improvements. Check your submission history for details.'
                }
            ],
            'account': [
                {
                    question: 'How do I update my profile?',
                    answer: 'Go to your profile page from the navigation menu. Click "Edit Profile" to update your name, email, or other information.'
                },
                {
                    question: 'How do I change my password?',
                    answer: 'Password changes can be made from your profile settings. If you\'ve forgotten your password, use the "Forgot Password" link on the login page.'
                },
                {
                    question: 'What should I do if my account is pending approval?',
                    answer: 'New accounts require admin approval before you can log in. After registration, you\'ll be redirected to the login page with a message about pending approval. You cannot log in until an admin approves your account. Once approved, you\'ll be able to log in and access all features.'
                },
                {
                    question: 'Why can\'t I log in after registering?',
                    answer: 'For security, new user accounts require admin approval before login is allowed. After registration, you must wait for an admin to approve your account. You\'ll be able to log in once your account status changes to "approved".'
                },
                {
                    question: 'How do I contact support?',
                    answer: 'Use the contact form on this help center page, or reach out to your assigned trainer. For urgent issues, contact the system administrator. You can also use the AI Coach on course pages for instant help with course-related questions.'
                }
            ],
            'trainer': [
                {
                    question: 'How do I review learner submissions?',
                    answer: 'Go to the Trainer Dashboard and click on "Review Submissions" or "Evaluations". Review each submission and provide feedback.'
                },
                {
                    question: 'How do I assign courses to learners?',
                    answer: 'Course assignments are typically handled by administrators. Contact your admin if you need to assign courses to specific learners.'
                },
                {
                    question: 'How do I track learner progress?',
                    answer: 'Navigate to "My Learners" from the trainer dashboard. Click on any learner to view their detailed progress and submission history.'
                },
                {
                    question: 'What feedback should I provide?',
                    answer: 'Provide constructive, specific feedback. Highlight what was done well and clearly explain what needs improvement. Be encouraging and supportive.'
                },
                {
                    question: 'How do I personalize my AI Coach?',
                    answer: 'Go to your Trainer Dashboard and click "AI Coach Setup", or navigate to "AI Coach Setup" from the Administration menu. You can set a custom coach name (e.g., "John\'s AI Coach"), add your LinkedIn profile, expertise areas, years of experience, and bio. You can set global settings for all courses or course-specific settings.'
                },
                {
                    question: 'What are AI Coach Escalations?',
                    answer: 'When the AI Coach has low confidence in answering a learner\'s question, it automatically escalates the question to you. Go to "AI Escalations" from your dashboard or the Administration menu to view and respond to escalated questions. Learners will be notified when you respond.'
                },
                {
                    question: 'How do I respond to an escalated question?',
                    answer: 'Navigate to "AI Escalations" from your trainer dashboard. Click on any pending escalation to see the learner\'s question, the AI\'s context, and the learner\'s progress. Type your response and click "Respond". The learner will be notified of your response.'
                },
                {
                    question: 'Can I see all escalations for my courses?',
                    answer: 'Yes, the AI Escalations page shows all escalations for learners in your assigned courses. You can filter by status (pending, responded, resolved) and see details for each escalation.'
                }
            ],
            'admin': [
                {
                    question: 'How do I approve new users?',
                    answer: 'Go to the Admin Dashboard and click on "Pending Approvals". Review each user and assign a trainer (for learners) before approving. New users cannot log in until their account is approved.'
                },
                {
                    question: 'How do I assign trainers to learners?',
                    answer: 'When approving a learner, you\'ll be prompted to assign a trainer. You can also update trainer assignments from the user detail page.'
                },
                {
                    question: 'How do I manage courses?',
                    answer: 'Course management features are available in the admin dashboard. You can view, create, and modify courses and their content. Use the search bar on the courses page to quickly find specific courses.'
                },
                {
                    question: 'How do I view system reports?',
                    answer: 'System reports and analytics are available in the admin dashboard. Reports include user activity, course completion rates, and submission statistics.'
                },
                {
                    question: 'How do I index course content for the AI Coach?',
                    answer: 'Go to "AI Coach Indexing" from the Administration menu. Select a course and click "Index Course Content" to make the course content searchable by the AI Coach. You can also trigger a full re-index if course content has been updated. The system can automatically detect content changes, but manual indexing ensures immediate updates.'
                },
                {
                    question: 'When should I re-index course content?',
                    answer: 'Re-index course content whenever you update course materials (chapters, labs, or structure). The system can automatically detect changes, but for immediate updates, use the manual indexing feature in the AI Coach Indexing page.'
                },
                {
                    question: 'What is the AI Coach Analytics?',
                    answer: 'AI Coach Analytics provides insights into AI Coach usage, including query volume, response quality, escalation rates, and learner feedback. Access it from the Administration menu under "AI Coach Analytics".'
                }
            ]
        };
    }

    /**
     * Get help categories
     */
    getCategories() {
        const baseCategories = [
            { id: 'getting-started', label: 'Getting Started', icon: '🚀' },
            { id: 'ai-coach', label: 'AI Coach', icon: '🤖' },
            { id: 'courses', label: 'Courses', icon: '📚' },
            { id: 'submissions', label: 'Submissions', icon: '📝' },
            { id: 'account', label: 'Account', icon: '👤' }
        ];

        if (this.currentUser?.role === 'trainer') {
            baseCategories.push({ id: 'trainer', label: 'Trainer Guide', icon: '👨‍🏫' });
        }

        if (this.currentUser?.role === 'admin') {
            baseCategories.push({ id: 'admin', label: 'Admin Guide', icon: '⚙️' });
        }

        return baseCategories;
    }

    /**
     * Render help center
     */
    render() {
        const categories = this.getCategories();
        const filteredFAQs = this.getFilteredFAQs();

        this.container.innerHTML = `
            <div class="help-center-page">
                <div class="help-center-container">
                    <div class="help-center-header">
                        <div>
                            <h1 class="help-center-title">Help & Support Center</h1>
                            <p class="help-center-subtitle">Find answers to common questions and get support</p>
                        </div>
                    </div>

                    <div class="help-center-content">
                        <aside class="help-sidebar" role="complementary" aria-label="Help navigation">
                            <div class="help-search-box">
                                <label for="help-search-input" class="sr-only">Search help articles</label>
                                <input 
                                    type="text" 
                                    id="help-search-input" 
                                    class="help-search-input" 
                                    placeholder="Search help articles..."
                                    value="${this.escapeHtml(this.searchQuery)}"
                                    aria-label="Search help articles"
                                >
                                <span class="search-icon" aria-hidden="true">🔍</span>
                            </div>

                            <nav class="help-categories" role="navigation" aria-label="Help categories">
                                <div class="category-list" role="list">
                                    ${categories.map(cat => `
                                        <button 
                                            class="category-item ${this.activeCategory === cat.id ? 'active' : ''}" 
                                            data-category="${cat.id}"
                                            role="listitem"
                                            aria-pressed="${this.activeCategory === cat.id}"
                                            aria-label="View ${cat.label} help articles"
                                        >
                                            <span class="category-icon" aria-hidden="true">${cat.icon}</span>
                                            <span class="category-label">${cat.label}</span>
                                        </button>
                                    `).join('')}
                                </div>
                            </nav>

                            <div class="help-quick-links">
                                <div class="quick-links-title">Quick Links</div>
                                <a href="#/dashboard" class="quick-link">Dashboard</a>
                                <a href="#/courses/my-courses" class="quick-link">My Courses</a>
                                ${this.currentUser?.role === 'learner' ? `
                                    <a href="#/courses/my-courses" class="quick-link">My Courses</a>
                                    <a href="#/submissions" class="quick-link">My Submissions</a>
                                ` : ''}
                                ${this.currentUser?.role === 'trainer' ? `
                                    <a href="#/trainer/ai-coach-personalization" class="quick-link">AI Coach Setup</a>
                                    <a href="#/trainer/ai-escalations" class="quick-link">AI Escalations</a>
                                ` : ''}
                                ${this.currentUser?.role === 'admin' ? `
                                    <a href="#/admin/ai-coach/indexing" class="quick-link">AI Coach Indexing</a>
                                    <a href="#/admin/ai-coach/analytics" class="quick-link">AI Coach Analytics</a>
                                ` : ''}
                                <a href="#/profile" class="quick-link">My Profile</a>
                            </div>
                        </div>

                        <div class="help-main">
                            <article class="help-content-section">
                                <h2 class="section-title">${this.getCategoryLabel(this.activeCategory)}</h2>
                                
                                ${filteredFAQs.length > 0 ? `
                                    <div class="faq-list" role="list">
                                        ${filteredFAQs.map((faq, index) => `
                                            <div class="faq-item" role="listitem">
                                                <button 
                                                    class="faq-question" 
                                                    data-index="${index}"
                                                    aria-expanded="false"
                                                    aria-controls="faq-answer-${index}"
                                                    id="faq-question-${index}"
                                                >
                                                    <span class="faq-icon" aria-hidden="true">${this.activeCategory === 'getting-started' ? '❓' : '💡'}</span>
                                                    <span class="faq-text">${this.escapeHtml(faq.question)}</span>
                                                    <span class="faq-toggle" aria-hidden="true">+</span>
                                                </button>
                                                <div 
                                                    class="faq-answer" 
                                                    id="faq-answer-${index}"
                                                    role="region"
                                                    aria-labelledby="faq-question-${index}"
                                                    style="display: none;"
                                                >
                                                    <div class="faq-answer-content">
                                                        ${this.escapeHtml(faq.answer)}
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : `
                                    <div class="empty-state" role="status" aria-live="polite">
                                        <div class="empty-icon" aria-hidden="true">🔍</div>
                                        <div class="empty-text">No results found</div>
                                        <p class="empty-description">Try a different search term or browse categories</p>
                                    </div>
                                `}
                            </article>

                            <div class="help-contact-section">
                                <h2 class="section-title">Still Need Help?</h2>
                                <div class="contact-options">
                                    <div class="contact-card">
                                        <div class="contact-icon">💬</div>
                                        <div class="contact-title">DV Coach AI</div>
                                        <div class="contact-description">Get instant answers from our AI assistant</div>
                                        <button class="btn btn-primary btn-sm" id="dv-coach-btn">
                                            Chat with DV Coach
                                        </button>
                                    </div>
                                    <div class="contact-card">
                                        <div class="contact-icon">📧</div>
                                        <div class="contact-title">Contact Support</div>
                                        <div class="contact-description">Reach out to our support team</div>
                                        <button class="btn btn-secondary btn-sm" id="contact-support-btn">
                                            Send Message
                                        </button>
                                    </div>
                                    ${this.currentUser?.role === 'learner' && this.currentUser?.trainer_id ? `
                                        <div class="contact-card">
                                            <div class="contact-icon">👨‍🏫</div>
                                            <div class="contact-title">Your Trainer</div>
                                            <div class="contact-description">Contact your assigned trainer</div>
                                            <button class="btn btn-ghost btn-sm" id="contact-trainer-btn">
                                                View Trainer
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Get filtered FAQs based on search query
     */
    getFilteredFAQs() {
        const categoryFAQs = this.faqs[this.activeCategory] || [];
        
        if (!this.searchQuery.trim()) {
            return categoryFAQs;
        }

        const query = this.searchQuery.toLowerCase();
        return categoryFAQs.filter(faq => {
            return faq.question.toLowerCase().includes(query) || 
                   faq.answer.toLowerCase().includes(query);
        });
    }

    /**
     * Get category label
     */
    getCategoryLabel(categoryId) {
        const categories = this.getCategories();
        const category = categories.find(cat => cat.id === categoryId);
        return category ? category.label : 'Help';
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Category selection
        const categoryItems = this.container.querySelectorAll('.category-item');
        categoryItems.forEach(item => {
            item.addEventListener('click', () => {
                this.activeCategory = item.getAttribute('data-category');
                this.render();
            });
        });

        // FAQ toggle
        const faqQuestions = this.container.querySelectorAll('.faq-question');
        faqQuestions.forEach(question => {
            question.addEventListener('click', () => {
                const index = question.getAttribute('data-index');
                const answer = question.nextElementSibling;
                const toggle = question.querySelector('.faq-toggle');
                const isExpanded = question.getAttribute('aria-expanded') === 'true';
                
                if (!isExpanded) {
                    answer.style.display = 'block';
                    toggle.textContent = '−';
                    question.classList.add('active');
                    question.setAttribute('aria-expanded', 'true');
                } else {
                    answer.style.display = 'none';
                    toggle.textContent = '+';
                    question.classList.remove('active');
                    question.setAttribute('aria-expanded', 'false');
                }
            });

            // Keyboard support
            question.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    question.click();
                }
            });
        });

        // Search input
        const searchInput = document.getElementById('help-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.render();
            });
        }

        // DV Coach button
        const dvCoachBtn = document.getElementById('dv-coach-btn');
        if (dvCoachBtn) {
            dvCoachBtn.addEventListener('click', () => {
                // Navigate to a course page where AI Coach is available
                if (this.currentUser?.role === 'learner') {
                    router.navigate('/courses/my-courses');
                } else {
                    alert('The AI Coach is available on course pages. Navigate to any course to access your AI Coach assistant.');
                }
            });
        }

        // Contact support button
        const contactSupportBtn = document.getElementById('contact-support-btn');
        if (contactSupportBtn) {
            contactSupportBtn.addEventListener('click', () => {
                this.showContactForm();
            });
        }

        // Contact trainer button
        const contactTrainerBtn = document.getElementById('contact-trainer-btn');
        if (contactTrainerBtn) {
            contactTrainerBtn.addEventListener('click', () => {
                // Navigate to trainer info or contact page
                alert('Trainer contact feature coming soon!');
            });
        }
    }

    /**
     * Show contact form
     */
    showContactForm() {
        const modal = document.createElement('div');
        modal.className = 'contact-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'contact-modal-title');
        modal.innerHTML = `
            <div class="contact-modal-backdrop" aria-hidden="true"></div>
            <div class="contact-modal-container">
                <div class="contact-modal-header">
                    <h3 class="contact-modal-title" id="contact-modal-title">Contact Support</h3>
                    <button class="contact-modal-close" id="contact-modal-close" aria-label="Close contact form">✕</button>
                </div>
                <form class="contact-form" id="contact-form" aria-label="Contact support form">
                    <div class="form-group">
                        <label for="contact-subject" class="form-label">Subject <span class="required" aria-label="required"></span></label>
                        <input 
                            type="text" 
                            class="form-input" 
                            id="contact-subject" 
                            name="subject"
                            required
                            aria-required="true"
                            aria-describedby="contact-subject-error"
                        >
                        <span id="contact-subject-error" class="sr-only" role="alert"></span>
                    </div>
                    <div class="form-group">
                        <label for="contact-message" class="form-label">Message <span class="required" aria-label="required"></span></label>
                        <textarea 
                            class="form-textarea" 
                            id="contact-message" 
                            name="message"
                            rows="6" 
                            required
                            aria-required="true"
                            aria-describedby="contact-message-error"
                        ></textarea>
                        <span id="contact-message-error" class="sr-only" role="alert"></span>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="contact-cancel" aria-label="Cancel and close contact form">Cancel</button>
                        <button type="submit" class="btn btn-primary" aria-label="Send support message">Send Message</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => {
            modal.classList.add('open');
        }, 10);

        // Close handlers
        const closeBtn = document.getElementById('contact-modal-close');
        const cancelBtn = document.getElementById('contact-cancel');
        const backdrop = modal.querySelector('.contact-modal-backdrop');

        const closeModal = () => {
            modal.classList.remove('open');
            setTimeout(() => modal.remove(), 300);
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (backdrop) backdrop.addEventListener('click', closeModal);

        // Form submission
        const form = document.getElementById('contact-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const subjectInput = document.getElementById('contact-subject');
                const messageInput = document.getElementById('contact-message');
                const subject = subjectInput.value.trim();
                const message = messageInput.value.trim();

                // Clear previous errors
                document.getElementById('contact-subject-error').textContent = '';
                document.getElementById('contact-message-error').textContent = '';

                // Validation
                let hasErrors = false;
                if (!subject) {
                    document.getElementById('contact-subject-error').textContent = 'Subject is required';
                    subjectInput.setAttribute('aria-invalid', 'true');
                    hasErrors = true;
                } else {
                    subjectInput.setAttribute('aria-invalid', 'false');
                }

                if (!message) {
                    document.getElementById('contact-message-error').textContent = 'Message is required';
                    messageInput.setAttribute('aria-invalid', 'true');
                    hasErrors = true;
                } else {
                    messageInput.setAttribute('aria-invalid', 'false');
                }

                if (hasErrors) {
                    // Focus first error
                    if (!subject) {
                        subjectInput.focus();
                    } else {
                        messageInput.focus();
                    }
                    return;
                }

                // Here you would typically send the message to a backend service
                // For now, show success message
                const successMessage = document.createElement('div');
                successMessage.setAttribute('role', 'alert');
                successMessage.setAttribute('aria-live', 'polite');
                successMessage.className = 'success-message';
                successMessage.textContent = 'Thank you for contacting us! We\'ll get back to you soon.';
                form.insertBefore(successMessage, form.firstChild);
                
                setTimeout(() => {
                    closeModal();
                }, 2000);
            });
        }

        // Trap focus within modal
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const trapFocus = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
            if (e.key === 'Escape') {
                closeModal();
            }
        };

        modal.addEventListener('keydown', trapFocus);

        // Focus first element when modal opens
        setTimeout(() => {
            if (firstElement) {
                firstElement.focus();
            }
        }, 100);
    }
}

export default HelpCenter;

