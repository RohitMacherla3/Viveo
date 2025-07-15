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
    
    // Initialize water tracking
    updateWaterProgress();
    
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
        }
    }
}

// Handle user login actions
function onUserLogin() {
    debugLog('User login handler called');
    
    // Load user profile
    loadUserProfile();
    
    // Load today's food entries
    loadTodaysFoodEntries();
    
    // Load water intake for today
    loadWaterIntake();
    
    // Initialize AI chat
    initializeAiChat();
    
    // Show AI notification after delay
    setTimeout(() => {
        if (!aiChatOpen) {
            showAiNotification();
        }
    }, 5000);
}

// Water tracking functions
let waterIntake = 0;
const waterTarget = 3500; // 3.5 liters

function addWater(amount = 200) {
    waterIntake += amount;
    
    // Don't exceed reasonable limits
    if (waterIntake > 8000) {
        waterIntake = 8000;
    }
    
    updateWaterDisplay();
    updateWaterProgress();
    
    // Save to storage
    saveWaterIntake();
    
    // Show success message
    showToastMessage(`Added ${amount}ml of water!`, 'success');
}

function updateWaterDisplay() {
    const waterConsumed = document.getElementById('waterConsumed');
    const waterTargetElement = document.getElementById('waterTarget');
    
    if (waterConsumed) {
        waterConsumed.textContent = waterIntake;
    }
    
    if (waterTargetElement) {
        waterTargetElement.textContent = waterTarget;
    }
}

function updateWaterProgress() {
    const progress = Math.min((waterIntake / waterTarget) * 100, 100);
    const waterProgress = document.getElementById('waterProgress');
    
    if (waterProgress) {
        waterProgress.style.width = `${progress}%`;
        
        // Change color based on progress
        if (progress >= 100) {
            waterProgress.style.background = 'linear-gradient(90deg, #4CAF50, #45a049)';
        } else if (progress >= 50) {
            waterProgress.style.background = 'linear-gradient(90deg, #2196F3, #1976D2)';
        } else {
            waterProgress.style.background = 'linear-gradient(90deg, #ff9800, #f57c00)';
        }
    }
    
    updateWaterDisplay();
}

function saveWaterIntake() {
    const dateString = getCurrentDateString();
    const storageKey = `viveo_water_${currentUser?.username || 'guest'}_${dateString}`;
    localStorage.setItem(storageKey, waterIntake.toString());
}

function loadWaterIntake() {
    const dateString = getCurrentDateString();
    const storageKey = `viveo_water_${currentUser?.username || 'guest'}_${dateString}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
        waterIntake = parseInt(saved) || 0;
    } else {
        waterIntake = 0;
    }
    
    updateWaterProgress();
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
            saveDayData();
            
            // Save water intake
            saveWaterIntake();
            
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
                // Ctrl/Cmd + J: Toggle AI chat
                event.preventDefault();
                if (currentUser) {
                    toggleAiChat();
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
    }
});

// Notification system
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToastMessage('Notifications enabled!', 'success');
            }
        });
    }
}

function showNotification(title, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            ...options
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            notification.close();
        }, 5000);
        
        return notification;
    }
}

// Data export/import functionality
function exportAllData() {
    const allData = {
        username: currentUser?.username || 'Guest',
        exportDate: new Date().toISOString(),
        profile: userProfile,
        currentFoodEntries: foodEntries,
        waterIntake: waterIntake,
        calorieData: calorieData
    };
    
    // Add stored daily data
    const storedData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('viveo_data_') || key.startsWith('viveo_water_')) {
            storedData[key] = localStorage.getItem(key);
        }
    }
    allData.storedData = storedData;
    
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viveo-complete-export-${getCurrentDateString()}.json`;
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

// Service Worker registration (for PWA functionality)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // Uncomment to register service worker
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => debugLog('SW registered:', registration))
        //     .catch(error => debugLog('SW registration failed:', error));
    });
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

// Log performance when page loads
window.addEventListener('load', logPerformance);

// Initialize mobile adjustments
document.addEventListener('DOMContentLoaded', adjustForMobile);
window.addEventListener('resize', adjustForMobile);

// Global error boundary
window.addEventListener('unhandledrejection', function(event) {
    debugLog('Unhandled promise rejection:', event.reason);
    showToastMessage('Something went wrong. Please try again.', 'error');
});

debugLog('App.js loaded successfully');