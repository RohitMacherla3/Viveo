// config.js - Application Configuration

// API Configuration
function getApiBaseUrl() {
    // Check if we're in Docker (nginx will be handling routing)
    if (window.location.port === '3336' || window.location.port === '8443') {
        // Running through nginx reverse proxy (Docker)
        return window.location.origin + '/viveo/api';
    }
    
    // Running locally with backend directly
    return 'http://localhost:3334';
}

const API_BASE_URL = getApiBaseUrl();

// App State
let currentUser = null;
let currentDate = new Date();
let foodEntries = [];
let aiChatOpen = false;

// Calorie and nutrition data
let calorieData = {
    intake: 0,
    target: 1764,
    left: 1764
};

// User profile settings
let userProfile = {
    calorieGoal: 2000,
    proteinGoal: 150,
    carbsGoal: 250,
    fatsGoal: 65,
    age: null,
    weight: null,
    height: null,
    activityLevel: 'moderately_active'
};

// App settings
const APP_SETTINGS = {
    autoSaveInterval: 30000, // 30 seconds
    maxFoodEntries: 100,
    debugMode: true
};

// Environment info
const ENV_INFO = {
    environment: 'mac',
    deployMode: 'development',
    uiPath: '/viveo',
    domain: 'localhost'
};

// Utility functions
function showMessage(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function debugLog(message, data = null) {
    if (APP_SETTINGS.debugMode) {
        console.log(`[DEBUG] ${message}`, data);
    }
}
