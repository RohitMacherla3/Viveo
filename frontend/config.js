// config.js - Application Configuration

// API Configuration - Point directly to backend
const API_BASE_URL = 'http://localhost/8000';

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
    debugMode: true // Enable debug to see API calls
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