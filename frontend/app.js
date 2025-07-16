// app.js - Main Application Functions

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    debugLog('Viveo app initializing...');
    
    // Initialize components
    initializeApp();
    
    // Check if user is already logged in
    checkExistingLogin();
    
    // Set up auto-save interval
    setupAutoSave();
    
    debugLog('Viveo app initialized successfully');
});

// Initialize the application
function initializeApp() {
    // Initialize calendar
    initializeCalendar();
    
    // Initialize calorie tracking
    updateCalorieProgress();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize theme
    loadTheme();
    
    // Show welcome message for new users
    showWelcomeMessage();
}

// Check for existing login
function checkExistingLogin() {
    const savedUser = localStorage.getItem('viveo_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            debugLog('Found existing user session:', currentUser.username);
            showDashboard();
            onUserLogin();
        } catch (error) {
            debugLog('Error loading saved user:', error);
            localStorage.removeItem('viveo_user');
            // Show login screen if saved user data is invalid
            showLoginScreen();
        }
    } else {
        // No saved user, show login screen
        showLoginScreen();
    }
}

// Handle user login actions
function onUserLogin() {
    debugLog('User login handler called for:', currentUser?.username);
    
    // Only proceed if we have a valid user
    if (!currentUser) {
        debugLog('No current user found, skipping login actions');
        return;
    }
    
    // Clear any existing AI chat state first (but keep notifications)
    clearAiChatStateOnly();
    
    // Load user profile
    loadUserProfile();
    
    // Load today's food entries
    loadTodaysFoodEntries();
    
    // Initialize AI chat fresh for this session
    initializeAiChatFresh();
    
    // Show AI notification after delay (only for logged-in users)
    setTimeout(() => {
        // Double-check user is still logged in and AI chat is not open
        if (currentUser && !aiChatOpen) {
            debugLog('Showing AI notification after login delay');
            showAiNotification();
        } else {
            debugLog('Skipping AI notification - user logged out or AI chat already open');
        }
    }, 5000);
}

// Clear AI chat state completely
function clearAiChatState() {
    debugLog('Clearing AI chat state completely...');
    
    // Clear AI chat components
    clearAiChatStateOnly();
    
    // Also clear any existing AI notifications
    const existingNotification = document.getElementById('ai-notification');
    if (existingNotification) {
        existingNotification.remove();
        debugLog('Removed existing AI notification');
    }
    
    debugLog('AI chat state and notifications cleared');
}

// Clear only AI chat state (keep notifications)
function clearAiChatStateOnly() {
    debugLog('Clearing AI chat state only...');
    
    // Close AI chat if open
    if (typeof closeAiChat === 'function') {
        closeAiChat();
    }
    
    // Reset AI chat variables
    if (typeof window.aiChatMessages !== 'undefined') {
        window.aiChatMessages = [];
    }
    
    // Clear AI chat from DOM
    const aiChatPanel = document.getElementById('aiChatPanel');
    if (aiChatPanel) {
        aiChatPanel.remove();
    }
    
    // Clear chat container
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.innerHTML = '';
    }
    
    // Reset AI chat state variables
    window.aiChatOpen = false;
    window.aiChatInitialized = false;
    
    // Clear any AI-related localStorage for this session
    // (but keep user preferences like notification dismissal unless it's a fresh login)
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('viveo_ai_chat_') && !key.includes('_seen_')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    debugLog('AI chat state cleared (notifications preserved)');
}

// Initialize AI chat fresh for new session
function initializeAiChatFresh() {
    debugLog('Initializing fresh AI chat session...');
    
    // IMPORTANT: Only initialize AI chat if user is logged in
    if (!currentUser) {
        debugLog('Skipping AI chat initialization - user not logged in');
        return;
    }
    
    // Ensure AI chat is properly initialized
    if (typeof initializeAiChat === 'function') {
        initializeAiChat();
    } else {
        // Fallback initialization if function doesn't exist yet
        window.aiChatMessages = [];
        window.aiChatOpen = false;
        window.aiChatInitialized = true;
        
        // Create fresh AI chat interface (but don't show it yet)
        createAiChatInterface();
    }
    
    debugLog('Fresh AI chat session initialized for user:', currentUser.username);
}

// Create AI chat interface (fallback if not in aiChat.js)
function createAiChatInterface() {
    // Only create if it doesn't exist
    if (document.getElementById('aiChatPanel')) {
        return;
    }
    
    const aiChatPanel = document.createElement('div');
    aiChatPanel.id = 'aiChatPanel';
    aiChatPanel.className = 'ai-chat-panel';
    aiChatPanel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 350px;
        max-height: 500px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        z-index: 1000;
        display: none;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid #e0e0e0;
    `;
    
    aiChatPanel.innerHTML = `
        <div class="ai-chat-header" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            font-weight: bold;
            display: flex;
            justify-content: between;
            align-items: center;
        ">
            <span>🤖 AI Assistant</span>
            <button onclick="closeAiChat()" style="
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                margin-left: auto;
            ">×</button>
        </div>
        <div id="chatContainer" style="
            flex: 1;
            padding: 15px;
            overflow-y: auto;
            max-height: 300px;
            min-height: 200px;
        ">
            <div class="ai-welcome-message" style="
                text-align: center;
                color: #666;
                font-size: 14px;
                margin: 20px 0;
            ">
                Welcome! Ask me about nutrition, food logging, or meal planning.
            </div>
        </div>
        <div class="ai-chat-input" style="
            padding: 15px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            gap: 10px;
        ">
            <input type="text" id="aiChatInput" placeholder="Ask me anything..." style="
                flex: 1;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
            ">
            <button onclick="sendAiMessage()" style="
                background: #667eea;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            ">Send</button>
        </div>
    `;
    
    document.body.appendChild(aiChatPanel);
    
    // Add enter key support
    const chatInput = document.getElementById('aiChatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendAiMessage();
            }
        });
    }
}

// Handle user logout
function handleUserLogout() {
    debugLog('User logout initiated');
    
    // Clear AI chat state completely (including destroying the chat window)
    clearAiChatState();
    
    // Clear current user
    currentUser = null;
    
    // Clear user-specific data
    localStorage.removeItem('viveo_user');
    
    // Reset app state
    foodEntries = [];
    calorieData = { intake: 0, target: 1764, left: 1764 };
    
    // Show login screen
    showLoginScreen();
    
    // Clear any notifications
    dismissAiNotification();
    
    debugLog('User logout completed - AI chat window destroyed');
}

// Show AI notification to encourage users to try the AI assistant
function showAiNotification() {
    try {
        // NOTE: Notification can be shown anywhere, but the chat window requires login
        
        // Check if user has dismissed this notification before
        const hasSeenAiNotification = localStorage.getItem('viveo_seen_ai_notification');
        
        if (hasSeenAiNotification) {
            debugLog('AI notification skipped - user has already seen it');
            return; // Don't show again if user has seen it
        }
        
        // Check if notification already exists
        const existingNotification = document.getElementById('ai-notification');
        if (existingNotification) {
            debugLog('AI notification already exists, skipping');
            return;
        }
        
        debugLog('Showing AI notification');
        
        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'ai-notification';
        notification.className = 'ai-notification';
        notification.innerHTML = `
            <div class="ai-notification-content">
                <div class="ai-notification-icon">🤖</div>
                <div class="ai-notification-text">
                    <strong>Try the AI Assistant!</strong>
                    <p>Ask me about nutrition, get meal suggestions, or track your food with natural language.</p>
                </div>
                <div class="ai-notification-actions">
                    <button onclick="openAiChatFromNotification()" class="btn-primary">Try Now</button>
                    <button onclick="dismissAiNotification()" class="btn-secondary">Maybe Later</button>
                </div>
            </div>
        `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        max-width: 350px;
        z-index: 1000;
        animation: slideInFromRight 0.5s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Add CSS animation if not already present
    if (!document.querySelector('#ai-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'ai-notification-styles';
        styles.textContent = `
            @keyframes slideInFromRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .ai-notification-content {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .ai-notification-icon {
                font-size: 24px;
                text-align: center;
            }
            
            .ai-notification-text {
                text-align: center;
            }
            
            .ai-notification-text strong {
                font-size: 16px;
                display: block;
                margin-bottom: 8px;
            }
            
            .ai-notification-text p {
                margin: 0;
                font-size: 14px;
                opacity: 0.9;
                line-height: 1.4;
            }
            
            .ai-notification-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            
            .ai-notification .btn-primary {
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .ai-notification .btn-primary:hover {
                background: rgba(255,255,255,0.3);
                transform: translateY(-1px);
            }
            
            .ai-notification .btn-secondary {
                background: transparent;
                border: 1px solid rgba(255,255,255,0.4);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .ai-notification .btn-secondary:hover {
                background: rgba(255,255,255,0.1);
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto-dismiss after 15 seconds
    setTimeout(() => {
        dismissAiNotification();
    }, 15000);
}

// Open AI chat from notification
function openAiChatFromNotification() {
    try {
        dismissAiNotification();
        
        // Mark as seen so we don't show it again
        localStorage.setItem('viveo_seen_ai_notification', 'true');
        
        // IMPORTANT: Check if user is still logged in before opening chat
        if (!currentUser) {
            showToastMessage('Please log in to use AI chat', 'error');
            return;
        }
        
        // Open AI chat (assuming this function exists in aiChat.js)
        if (typeof openAiChat === 'function') {
            openAiChat();
        } else if (typeof toggleAiChat === 'function') {
            toggleAiChat();
        } else {
            // Fallback: just show a message
            showToastMessage('AI Chat is now available!', 'info');
        }
        
        // Track this event
        trackEvent('ai_notification_clicked');
    } catch (error) {
        debugLog('Error in openAiChatFromNotification:', error);
        showToastMessage('Error opening AI chat', 'error');
    }
}

// Dismiss AI notification
function dismissAiNotification() {
    try {
        const notification = document.getElementById('ai-notification');
        if (notification) {
            notification.style.animation = 'slideInFromRight 0.3s ease-in reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
            debugLog('AI notification dismissed');
        }
        
        // Track dismissal
        trackEvent('ai_notification_dismissed');
    } catch (error) {
        debugLog('Error dismissing notification:', error);
        // Force remove if animation fails
        const notification = document.getElementById('ai-notification');
        if (notification && notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }
}

// Toast notification system
function showToastMessage(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        pointer-events: auto;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// Setup event listeners
function setupEventListeners() {
    // Window resize handler
    window.addEventListener('resize', handleResize);
    
    // Visibility change handler (for auto-save when tab becomes hidden)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Before unload handler (save data before page closes)
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Error handler
    window.addEventListener('error', handleGlobalError);
}

function handleResize() {
    // Adjust mobile layout if needed
    adjustForMobile();
}

function handleVisibilityChange() {
    if (document.hidden) {
        // Page is hidden, save current state
        autoSave();
    }
}

function handleBeforeUnload() {
    // Save current state before page unloads
    autoSave();
}

function handleGlobalError(event) {
    debugLog('Global error caught:', event.error);
    showToastMessage('An unexpected error occurred', 'error');
}

// Auto-save functionality
function setupAutoSave() {
    // Auto-save every 30 seconds
    setInterval(autoSave, 30000);
}

function autoSave() {
    if (currentUser) {
        try {
            // Save current day data
            autoSaveDayData();
            
            // Save profile
            localStorage.setItem('viveo_profile', JSON.stringify(userProfile));
            
            debugLog('Auto-save completed');
        } catch (error) {
            debugLog('Auto-save failed:', error);
        }
    }
}

// Theme management
function loadTheme() {
    const savedTheme = localStorage.getItem('viveo_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('viveo_theme', isDark ? 'dark' : 'light');
    
    showToastMessage(`Switched to ${isDark ? 'dark' : 'light'} theme`, 'success');
}

// Mobile adjustments
function adjustForMobile() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Add mobile-specific styles
        document.body.style.paddingBottom = '2rem';
        
        // Adjust AI chat for mobile
        const aiPanel = document.getElementById('aiChatPanel');
        if (aiPanel) {
            aiPanel.style.width = 'calc(100vw - 40px)';
        }
    } else {
        document.body.style.paddingBottom = '';
        
        const aiPanel = document.getElementById('aiChatPanel');
        if (aiPanel) {
            aiPanel.style.width = '450px';
        }
    }
}

// Welcome message for new users
function showWelcomeMessage() {
    const hasSeenWelcome = localStorage.getItem('viveo_seen_welcome');
    
    if (!hasSeenWelcome) {
        setTimeout(() => {
            showToastMessage('Welcome to Viveo! Track your nutrition and reach your goals.', 'success', 5000);
            localStorage.setItem('viveo_seen_welcome', 'true');
        }, 1000);
    }
}

// Utility functions for the entire app
function isMobile() {
    return window.innerWidth <= 768;
}

function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

function formatNumber(num, decimals = 1) {
    return Number(num).toFixed(decimals);
}

function truncateText(text, maxLength = 50) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + shortcuts
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'k':
                // Ctrl/Cmd + K: Focus on food input
                event.preventDefault();
                const foodInput = document.getElementById('foodInput');
                if (foodInput && currentUser) {
                    foodInput.focus();
                }
                break;
            case 'j':
                // Ctrl/Cmd + J: Toggle AI chat (only if logged in)
                event.preventDefault();
                if (currentUser) {
                    toggleAiChat();
                } else {
                    showToastMessage('Please log in to use AI chat', 'error');
                }
                break;
            case 's':
                // Ctrl/Cmd + S: Save (trigger auto-save)
                event.preventDefault();
                autoSave();
                showToastMessage('Data saved!', 'success');
                break;
        }
    }
    
    // ESC key shortcuts
    if (event.key === 'Escape') {
        // Close any open modals or panels
        closeProfileSettings();
        if (aiChatOpen) {
            closeAiChat();
        }
        // Also close AI notification
        dismissAiNotification();
    }
});

// Data export/import functionality
function exportAllData() {
    const allData = {
        username: currentUser?.username || 'Guest',
        exportDate: new Date().toISOString(),
        profile: userProfile,
        currentFoodEntries: foodEntries,
        calorieData: calorieData
    };
    
    // Add stored daily data
    const storedData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('viveo_day_')) {
            storedData[key] = localStorage.getItem(key);
        }
    }
    allData.storedData = storedData;
    
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viveo-export-${getCurrentDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToastMessage('Data exported successfully!', 'success');
}

// Performance monitoring
function logPerformance() {
    if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        debugLog(`Page load time: ${loadTime}ms`);
    }
}

// Analytics tracking (placeholder)
function trackEvent(eventName, properties = {}) {
    debugLog('Event tracked:', eventName, properties);
    // Implement analytics tracking here (Google Analytics, etc.)
}

// App state management
const AppState = {
    isLoading: false,
    hasUnsavedChanges: false,
    
    setLoading(loading) {
        this.isLoading = loading;
        // Update UI loading states
        const loadingElements = document.querySelectorAll('.loading-indicator');
        loadingElements.forEach(el => {
            el.style.display = loading ? 'block' : 'none';
        });
    },
    
    setUnsavedChanges(hasChanges) {
        this.hasUnsavedChanges = hasChanges;
        // Update UI to show unsaved changes indicator
        if (hasChanges) {
            document.title = '• Viveo - Calorie Tracking';
        } else {
            document.title = 'Viveo - Calorie Tracking';
        }
    }
};

// Initialize app state
AppState.setLoading(false);
AppState.setUnsavedChanges(false);

// Global error boundary
window.addEventListener('unhandledrejection', function(event) {
    debugLog('Unhandled promise rejection:', event.reason);
    showToastMessage('Something went wrong. Please try again.', 'error');
});

// === AI CHAT FUNCTIONS (fallback implementations) ===

// Toggle AI chat (fallback if not in aiChat.js)
function toggleAiChat() {
    // IMPORTANT: Only allow AI chat if user is logged in
    if (!currentUser) {
        showToastMessage('Please log in to use AI chat', 'error');
        return;
    }
    
    const aiPanel = document.getElementById('aiChatPanel');
    if (!aiPanel) {
        createAiChatInterface();
        openAiChat();
    } else {
        if (aiPanel.style.display === 'none' || !aiPanel.style.display) {
            openAiChat();
        } else {
            closeAiChat();
        }
    }
}

// Open AI chat
function openAiChat() {
    // IMPORTANT: Only allow AI chat if user is logged in
    if (!currentUser) {
        showToastMessage('Please log in to use AI chat', 'error');
        return;
    }
    
    const aiPanel = document.getElementById('aiChatPanel');
    if (!aiPanel) {
        createAiChatInterface();
    }
    
    const panel = document.getElementById('aiChatPanel');
    if (panel) {
        panel.style.display = 'flex';
        window.aiChatOpen = true;
        
        // Focus on input
        const input = document.getElementById('aiChatInput');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
        
        trackEvent('ai_chat_opened');
    }
}

// Close AI chat
function closeAiChat() {
    const aiPanel = document.getElementById('aiChatPanel');
    if (aiPanel) {
        aiPanel.style.display = 'none';
        window.aiChatOpen = false;
        trackEvent('ai_chat_closed');
    }
}

// Send AI message (fallback implementation)
function sendAiMessage() {
    // IMPORTANT: Only allow if user is logged in
    if (!currentUser) {
        showToastMessage('Please log in to use AI chat', 'error');
        return;
    }
    
    const input = document.getElementById('aiChatInput');
    const chatContainer = document.getElementById('chatContainer');
    
    if (!input || !chatContainer) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // Clear input
    input.value = '';
    
    // Add user message to chat
    addMessageToChat('user', message);
    
    // Add loading indicator
    addMessageToChat('assistant', 'Thinking...', true);
    
    // Send to backend (if available)
    if (typeof sendMessageToAI === 'function') {
        sendMessageToAI(message);
    } else {
        // Fallback response
        setTimeout(() => {
            removeLoadingMessage();
            addMessageToChat('assistant', 'AI assistant is not fully configured yet. Please ensure your API keys are set up correctly.');
        }, 1000);
    }
}

// Add message to chat
function addMessageToChat(sender, message, isLoading = false) {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;
    
    // Remove welcome message if it exists
    const welcomeMsg = chatContainer.querySelector('.ai-welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message ${isLoading ? 'loading' : ''}`;
    messageDiv.style.cssText = `
        margin-bottom: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.4;
        max-width: 80%;
        word-wrap: break-word;
        ${sender === 'user' 
            ? 'background: #667eea; color: white; margin-left: auto; text-align: right;' 
            : 'background: #f5f5f5; color: #333; margin-right: auto;'
        }
        ${isLoading ? 'opacity: 0.7; font-style: italic;' : ''}
    `;
    
    messageDiv.textContent = message;
    chatContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Remove loading message
function removeLoadingMessage() {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;
    
    const loadingMsg = chatContainer.querySelector('.loading');
    if (loadingMsg) {
        loadingMsg.remove();
    }
}

// Generate unique ID
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get current date string in YYYY-MM-DD format
function getCurrentDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

// Auto-save day data (safe version)
function autoSaveDayData() {
    try {
        const dateString = getCurrentDateString();
        const dayData = {
            date: dateString,
            foodEntries: foodEntries || [],
            calorieData: calorieData || { intake: 0, target: 2000, left: 2000 },
            userProfile: userProfile || {}
        };
        
        localStorage.setItem(`viveo_day_${dateString}`, JSON.stringify(dayData));
        debugLog('Saved day data for:', dateString);
    } catch (error) {
        console.error('Failed to save day data:', error);
    }
}

// Load day data (safe version)
function loadDayData(dateString) {
    try {
        const savedData = localStorage.getItem(`viveo_day_${dateString}`);
        if (savedData) {
            const dayData = JSON.parse(savedData);
            
            // Only update if data exists
            if (dayData.foodEntries && Array.isArray(dayData.foodEntries)) {
                foodEntries = dayData.foodEntries;
            }
            if (dayData.calorieData) {
                Object.assign(calorieData, dayData.calorieData);
            }
            if (dayData.userProfile) {
                Object.assign(userProfile, dayData.userProfile);
            }
            
            debugLog('Loaded day data for:', dateString);
            return dayData;
        }
    } catch (error) {
        console.error('Failed to load day data:', error);
    }
    return null;
}

// Parse food fallback function (simple demo version)
function parseFood(foodText) {
    // Simple fallback food parsing for demo
    const foods = [
        {
            name: foodText,
            quantity: 100,
            nutrition: {
                calories: 2, // calories per gram
                protein: 0.15,
                carbs: 0.25,
                fat: 0.08
            }
        }
    ];
    return foods;
}

// Calculate nutrition
function calculateNutrition(nutrition, quantity) {
    return {
        calories: Math.round(nutrition.calories * quantity),
        protein: Math.round(nutrition.protein * quantity),
        carbs: Math.round(nutrition.carbs * quantity),
        fat: Math.round(nutrition.fat * quantity)
    };
}

// === INITIALIZATION ===

// Log performance when page loads
window.addEventListener('load', logPerformance);

// Initialize mobile adjustments
document.addEventListener('DOMContentLoaded', adjustForMobile);
window.addEventListener('resize', adjustForMobile);

// Add visibility change listener for auto-save
document.addEventListener('visibilitychange', handleVisibilityChange);

// Initialize auto-save
setInterval(() => {
    if (currentUser) {
        autoSave();
    }
}, 30000);

debugLog('App.js loaded successfully');