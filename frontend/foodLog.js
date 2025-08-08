// foodLog.js - Food Logging Functions

// Food logging functionality
async function logFood() {
    const foodText = document.getElementById('foodInput').value.trim();
    if (!foodText) {
        showFoodLogMessage('Please enter some food details', 'error');
        return;
    }

    if (!currentUser) {
        showFoodLogMessage('Please login first', 'error');
        return;
    }

    // Show loading state
    const logButton = document.querySelector('#foodLogSection button');
    const originalText = logButton.textContent;
    logButton.textContent = 'Processing...';
    logButton.disabled = true;

    try {
        // Get the current selected date from the calendar
        const selectedDate = currentDate.toISOString().split('T')[0];
        
        // Build URL properly for relative paths - FIXED
        const requestUrl = `${API_BASE_URL}/logFoodText?food_details=${encodeURIComponent(foodText)}&date_str=${selectedDate}`;

        debugLog('Sending food log request to:', requestUrl);

        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`,
                'Accept': 'application/json'
            }
        });

        debugLog('Food log response status:', response.status);

        if (response.ok) {
            // Parse the structured JSON response from the food logging endpoint
            const structuredData = await response.json();
            debugLog('Structured data from food log endpoint:', structuredData);
            
            // Create frontend entry using ONLY the food log endpoint response
            const newEntry = {
                id: structuredData.entry_id || generateId(),
                text: structuredData.food_name || foodText,
                calories: Number(structuredData.calories) || 0,
                protein: Number(structuredData.protein) || 0,
                carbs: Number(structuredData.carbs) || 0,
                fat: Number(structuredData.fats) || 0, // Backend uses 'fats', frontend uses 'fat'
                fiber: Number(structuredData.fiber) || 0,
                quantity: structuredData.quantity || '',
                food_review: structuredData.food_review || '',
                meal_type: structuredData.meal_type || 'unknown',
                timestamp: getESTDate()
            };

            debugLog('Created entry from food log endpoint:', newEntry);

            // Add to food entries
            foodEntries.push(newEntry);

            // Update UI with the correct data
            updateFoodEntries();
            updateCalorieData();
            
            // Clear input
            document.getElementById('foodInput').value = '';

            // Show success message
            showFoodLogMessage(`Successfully logged: ${structuredData.food_name} (${structuredData.calories} cal)`, 'success');
        } else {
            let errorMessage = 'Failed to log food';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                const errorText = await response.text();
                errorMessage = errorText || errorMessage;
            }
            console.error('Error response:', errorMessage);
            showFoodLogMessage(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Network error:', error);
        
        // Fallback for demo purposes - create a simple entry using parseFood
        debugLog('API error, creating demo entry', error);
        
        try {
            const parsedFoods = parseFood(foodText);
            
            if (parsedFoods.length > 0) {
                parsedFoods.forEach(food => {
                    const nutrition = calculateNutrition(food.nutrition, food.quantity);
                    const newEntry = {
                        id: generateId(),
                        text: `${food.name} (${food.quantity}g)`,
                        calories: nutrition.calories,
                        protein: nutrition.protein,
                        carbs: nutrition.carbs,
                        fat: nutrition.fat,
                        fiber: 0,
                        quantity: `${food.quantity}g`,
                        food_review: 'Added in offline mode',
                        meal_type: 'unknown',
                        timestamp: new Date()
                    };
                    
                    foodEntries.push(newEntry);
                });
                
                updateFoodEntries();
                updateCalorieData();
                document.getElementById('foodInput').value = '';
                showFoodLogMessage('Food logged successfully (offline mode)', 'success');
            } else {
                // Simple fallback if parseFood fails
                const newEntry = {
                    id: generateId(),
                    text: foodText,
                    calories: 200, // Demo calories
                    protein: 15,
                    carbs: 25,
                    fat: 8,
                    fiber: 3,
                    quantity: 'estimated',
                    food_review: 'Added in offline mode',
                    meal_type: 'unknown',
                    timestamp: new Date()
                };
                
                foodEntries.push(newEntry);
                updateFoodEntries();
                updateCalorieData();
                document.getElementById('foodInput').value = '';
                showFoodLogMessage('Food logged successfully (offline mode)', 'success');
            }
        } catch (fallbackError) {
            console.error('Fallback error:', fallbackError);
            showFoodLogMessage('Unable to log food. Please try again.', 'error');
        }
    } finally {
        // Reset button state
        logButton.textContent = originalText;
        logButton.disabled = false;
    }
}

// Convert to EST timezone
function getESTDate(date = new Date()) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

// Get current date string in EST
function getCurrentESTDateString() {
    const estDate = getESTDate();
    return estDate.toISOString().split('T')[0];
}

// Load food entries for a specific date from the backend
async function loadFoodEntriesForDate(dateString = null) {
    if (!currentUser) {
        debugLog('No user logged in, skipping food entries load');
        return;
    }
    
    // Use provided date or default to today in EST
    const targetDate = dateString || getCurrentESTDateString();
    
    try {
        // Use the correct endpoint format: /getFoodEntries?date_str=YYYY-MM-DD
        const requestUrl = `${API_BASE_URL}/getFoodEntries?date_str=${encodeURIComponent(targetDate)}`;
        
        debugLog('Loading food entries for date:', targetDate, 'from:', requestUrl);

        const response = await fetch(requestUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`,
                'Accept': 'application/json'
            }
        });

        debugLog('Food entries response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            debugLog('Loaded food entries data:', data);
            
            // Check if we have entries in the response
            if (data.entries && Array.isArray(data.entries)) {
                // Convert backend entries to frontend format
                foodEntries = data.entries.map(entry => ({
                    id: entry.entry_id || generateId(),
                    text: entry.food_name || entry.original_text || 'Unknown food',
                    calories: Number(entry.calories) || 0,
                    protein: Number(entry.protein) || 0,
                    carbs: Number(entry.carbs) || 0,
                    fat: Number(entry.fats) || 0, // Backend uses 'fats'
                    fiber: Number(entry.fiber) || 0,
                    quantity: entry.quantity || '',
                    food_review: entry.food_review || '',
                    meal_type: entry.meal_type || 'unknown',
                    timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date()
                }));
                
                debugLog(`Loaded ${foodEntries.length} food entries for ${targetDate}`);
                
                // Update UI
                updateFoodEntries();
                updateCalorieData();
                
                // Show success message if entries were loaded
                if (foodEntries.length > 0) {
                    showFoodLogMessage(`Loaded ${foodEntries.length} food entries for ${targetDate}`, 'success');
                }
            } else {
                // No entries for this date
                debugLog('No food entries found for date:', targetDate);
                foodEntries = [];
                updateFoodEntries();
                updateCalorieData();
            }
        } else {
            // Handle error response
            let errorMessage = 'Failed to load food entries';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
                debugLog('API error loading food entries:', errorData);
            } catch (e) {
                const errorText = await response.text();
                errorMessage = errorText || errorMessage;
                debugLog('API error loading food entries (text):', errorText);
            }
            
            console.error('Error loading food entries:', errorMessage);
            showFoodLogMessage(errorMessage, 'error');
            
            // Clear entries on error
            foodEntries = [];
            updateFoodEntries();
            updateCalorieData();
        }
    } catch (error) {
        debugLog('Network error loading food entries:', error);
        console.error('Could not load food entries:', error);
        
        // Check if this is a completely new user or just a network issue
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showFoodLogMessage('Network error - using offline mode', 'error');
            // Load sample data for demo if it's a network issue
            loadSampleFoodData();
        } else {
            // Clear entries for other errors
            foodEntries = [];
            updateFoodEntries();
            updateCalorieData();
        }
    }
}

// Load today's food entries (wrapper for backward compatibility)
async function loadTodaysFoodEntries() {
    const today = getCurrentESTDateString();
    debugLog('Loading today\'s food entries for:', today);
    await loadFoodEntriesForDate(today);
}

// Load food entries for a different date (for calendar navigation)
async function loadFoodEntriesForSelectedDate(dateString) {
    debugLog('Loading food entries for selected date:', dateString);
    
    // Update current date context
    currentDate = new Date(dateString);
    
    // Load entries for the selected date
    await loadFoodEntriesForDate(dateString);
    
    // Update any date displays in the UI
    updateDateDisplay(dateString);
}

// Update date display in the UI
function updateDateDisplay(dateString) {
    const dateDisplayElements = document.querySelectorAll('.current-date-display');
    dateDisplayElements.forEach(element => {
        const date = new Date(dateString);
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        element.textContent = date.toLocaleDateString('en-US', options);
    });
    
    // Update any calendar highlights
    updateCalendarHighlight(dateString);
}

// Update calendar highlight (if calendar exists)
function updateCalendarHighlight(dateString) {
    // Remove existing highlights
    const existingHighlights = document.querySelectorAll('.calendar-day.selected');
    existingHighlights.forEach(day => day.classList.remove('selected'));
    
    // Add highlight to selected date
    const dayElement = document.querySelector(`[data-date="${dateString}"]`);
    if (dayElement) {
        dayElement.classList.add('selected');
    }
}

// Show food log messages
function showFoodLogMessage(message, type) {
    const inputArea = document.querySelector('.food-input-area');
    if (!inputArea) return;
    
    // Remove existing message
    const existingMessage = inputArea.querySelector('.food-log-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Add new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `food-log-message message-alert ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.marginTop = '1rem';
    
    inputArea.appendChild(messageDiv);

    // Remove message after 3 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

// Update food entries display
function updateFoodEntries() {
    const container = document.getElementById('foodEntries');
    if (!container) return;
    
    container.innerHTML = '';

    if (foodEntries.length === 0) {
        container.innerHTML = `
            <div class="food-entry" style="text-align: center; color: #666;">
                <p>No food entries for this date yet. Start by logging what you ate!</p>
            </div>
        `;
        return;
    }

    // Add clear all button if there are entries
    if (foodEntries.length > 1) {
        const clearAllDiv = document.createElement('div');
        clearAllDiv.style.cssText = 'text-align: right; margin-bottom: 1rem;';
        clearAllDiv.innerHTML = `
            <button class="btn btn-secondary" onclick="clearAllFoodEntries()" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                Clear All Entries
            </button>
        `;
        container.appendChild(clearAllDiv);
    }

    foodEntries.forEach((entry, index) => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'food-entry';
        entryDiv.innerHTML = `
            <div class="food-info">
                <h4>${entry.text}</h4>
                <div class="food-details">
                    Protein: ${entry.protein}g • Carbs: ${entry.carbs}g • Fat: ${entry.fat}g
                    ${entry.fiber ? ` • Fiber: ${entry.fiber}g` : ''}
                </div>
                ${entry.food_review ? `<div class="food-review" style="font-size: 0.8rem; color: #888; margin-top: 0.25rem;">${entry.food_review}</div>` : ''}
                ${entry.quantity ? `<div class="food-quantity" style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">Quantity: ${entry.quantity}</div>` : ''}
            </div>
            <div class="food-actions">
                <div class="food-calories">${entry.calories} Cal</div>
                <button class="delete-food-btn" onclick="deleteFoodEntry(${index})" title="Delete entry">
                    ✕
                </button>
            </div>
        `;
        container.appendChild(entryDiv);
    });
}

// Clear all food entries
async function clearAllFoodEntries() {
    if (foodEntries.length === 0) {
        showFoodLogMessage('No entries to clear', 'error');
        return;
    }

    const confirmClear = confirm(`Are you sure you want to delete all ${foodEntries.length} food entries for this date? This action cannot be undone.`);
    
    if (!confirmClear) {
        return;
    }

    try {
        // If user is logged in, delete all entries from backend
        if (currentUser) {
            const deletePromises = foodEntries
                .filter(entry => entry.id) // Only delete entries with IDs (from backend)
                .map(entry => 
                    fetch(`${API_BASE_URL}/deleteFoodEntry/${entry.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${currentUser.token}`,
                            'Accept': 'application/json'
                        }
                    })
                );

            // Wait for all deletions to complete (ignore individual failures)
            const results = await Promise.allSettled(deletePromises);
            
            const successCount = results.filter(result => result.status === 'fulfilled').length;
            debugLog(`Deleted ${successCount} entries from server out of ${deletePromises.length} attempts`);
        }

        // Clear local array
        const clearedCount = foodEntries.length;
        foodEntries = [];
        
        // Update UI
        updateFoodEntries();
        updateCalorieData();
        
        showFoodLogMessage(`Cleared all ${clearedCount} food entries`, 'success');
        
    } catch (error) {
        console.error('Error clearing food entries:', error);
        showFoodLogMessage('Some entries may not have been deleted from the server', 'error');
        
        // Still clear local entries even if server deletion failed
        foodEntries = [];
        updateFoodEntries();
        updateCalorieData();
    }
}

// Delete a food entry
async function deleteFoodEntry(index) {
    if (index < 0 || index >= foodEntries.length) {
        showFoodLogMessage('Invalid entry to delete', 'error');
        return;
    }

    const entryToDelete = foodEntries[index];
    const confirmDelete = confirm(`Are you sure you want to delete "${entryToDelete.text}"?`);
    
    if (!confirmDelete) {
        return;
    }

    // Show loading state
    const deleteButtons = document.querySelectorAll('.delete-food-btn');
    if (deleteButtons[index]) {
        deleteButtons[index].disabled = true;
        deleteButtons[index].textContent = '...';
    }

    try {
        // Add to undo stack before deletion
        addToUndoStack(entryToDelete);

        // If user is logged in and entry has an ID, delete from backend
        if (currentUser && entryToDelete.id) {
            const response = await fetch(`${API_BASE_URL}/deleteFoodEntry/${entryToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${currentUser.token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete from server');
            }

            debugLog('Food entry deleted from server:', entryToDelete.id);
        }

        // Remove from local array
        const deletedEntry = foodEntries.splice(index, 1)[0];
        
        // Update UI
        updateFoodEntries();
        updateCalorieData();
        
        // Show success message with undo option
        showFoodLogMessageWithUndo(`Deleted: ${deletedEntry.text}`, 'success');
        
    } catch (error) {
        console.error('Error deleting food entry:', error);
        showFoodLogMessage(`Failed to delete entry: ${error.message}`, 'error');
        
        // Remove from undo stack if deletion failed
        if (deletedEntriesStack.length > 0 && deletedEntriesStack[0].entry.id === entryToDelete.id) {
            deletedEntriesStack.shift();
        }
        
        // Re-enable button on error
        if (deleteButtons[index]) {
            deleteButtons[index].disabled = false;
            deleteButtons[index].textContent = '✕';
        }
    }
}

// Show food log message with undo option
function showFoodLogMessageWithUndo(message, type) {
    const inputArea = document.querySelector('.food-input-area');
    if (!inputArea) return;
    
    // Remove existing message
    const existingMessage = inputArea.querySelector('.food-log-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Add new message with undo button
    const messageDiv = document.createElement('div');
    messageDiv.className = `food-log-message message-alert ${type}`;
    messageDiv.style.marginTop = '1rem';
    messageDiv.style.display = 'flex';
    messageDiv.style.justifyContent = 'space-between';
    messageDiv.style.alignItems = 'center';
    
    messageDiv.innerHTML = `
        <span>${message}</span>
        <button onclick="undoLastDelete(); this.parentElement.remove();" style="
            background: none; 
            border: 1px solid currentColor; 
            color: inherit; 
            padding: 0.25rem 0.5rem; 
            border-radius: 4px; 
            cursor: pointer;
            font-size: 0.8rem;
        ">Undo</button>
    `;
    
    inputArea.appendChild(messageDiv);

    // Remove message after 5 seconds (longer for undo option)
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// Update calorie data based on food entries
function updateCalorieData() {
    const totalCalories = foodEntries.reduce((sum, entry) => sum + (entry.calories || 0), 0);
    const totalProtein = foodEntries.reduce((sum, entry) => sum + (entry.protein || 0), 0);
    const totalCarbs = foodEntries.reduce((sum, entry) => sum + (entry.carbs || 0), 0);
    const totalFat = foodEntries.reduce((sum, entry) => sum + (entry.fat || 0), 0);
    
    calorieData.intake = totalCalories;
    calorieData.left = Math.max(0, calorieData.target - totalCalories);
    
    // Update macro data
    const macroData = {
        protein: {
            consumed: totalProtein,
            target: userProfile.proteinGoal,
            left: Math.max(0, userProfile.proteinGoal - totalProtein)
        },
        carbs: {
            consumed: totalCarbs,
            target: userProfile.carbsGoal,
            left: Math.max(0, userProfile.carbsGoal - totalCarbs)
        },
        fat: {
            consumed: totalFat,
            target: userProfile.fatsGoal,
            left: Math.max(0, userProfile.fatsGoal - totalFat)
        }
    };
    
    updateCalorieProgress();
    updateMacroDisplay(macroData);
}

// Update calorie progress display
function updateCalorieProgress() {
    const caloriesLeftEl = document.getElementById('caloriesLeft');
    const calorieIntakeEl = document.getElementById('calorieIntake');
    const calorieTargetEl = document.getElementById('calorieTarget');
    const progressFillEl = document.getElementById('progressFill');
    
    if (caloriesLeftEl) caloriesLeftEl.textContent = `${calorieData.left} Cal`;
    if (calorieIntakeEl) calorieIntakeEl.textContent = calorieData.intake;
    if (calorieTargetEl) calorieTargetEl.textContent = calorieData.target;
    
    if (progressFillEl) {
        const progress = Math.min((calorieData.intake / calorieData.target) * 100, 100);
        progressFillEl.style.width = `${progress}%`;
        
        // Change color based on progress
        if (progress > 100) {
            progressFillEl.style.background = 'linear-gradient(90deg, #ff4444, #cc0000)';
        } else if (progress > 80) {
            progressFillEl.style.background = 'linear-gradient(90deg, #ff9800, #f57c00)';
        } else {
            progressFillEl.style.background = 'linear-gradient(90deg, #4CAF50, #45a049)';
        }
    }
}

// Update macro display
function updateMacroDisplay(macroData) {
    // Update protein
    const proteinValue = document.getElementById('proteinValue');
    if (proteinValue) {
        proteinValue.textContent = `${Math.round(macroData.protein.left)}g`;
    }
    
    // Update carbs
    const carbsValue = document.getElementById('carbsValue');
    if (carbsValue) {
        carbsValue.textContent = `${Math.round(macroData.carbs.left)}g`;
    }
    
    // Update fat
    const fatValue = document.getElementById('fatValue');
    if (fatValue) {
        fatValue.textContent = `${Math.round(macroData.fat.left)}g`;
    }
}

// Load sample food data for demo
function loadSampleFoodData() {
    foodEntries = [
        {
            id: generateId(),
            text: "Grilled Chicken Breast with Rice",
            calories: 350,
            protein: 35,
            carbs: 30,
            fat: 8,
            fiber: 2,
            quantity: "150g chicken, 100g rice",
            food_review: "Healthy lean protein with complex carbs",
            timestamp: new Date()
        },
        {
            id: generateId(),
            text: "Mixed Green Salad with Avocado",
            calories: 180,
            protein: 4,
            carbs: 12,
            fat: 15,
            fiber: 8,
            quantity: "1 medium bowl",
            food_review: "Fresh vegetables with healthy fats",
            timestamp: new Date()
        }
    ];
    
    updateFoodEntries();
    updateCalorieData();
}

// Create food context for AI
function createFoodContextForAI() {
    if (!foodEntries || foodEntries.length === 0) {
        return "No food entries logged for this date yet.";
    }

    const totalCalories = foodEntries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0);
    const totalProtein = foodEntries.reduce((sum, entry) => sum + (Number(entry.protein) || 0), 0);
    const totalCarbs = foodEntries.reduce((sum, entry) => sum + (Number(entry.carbs) || 0), 0);
    const totalFat = foodEntries.reduce((sum, entry) => sum + (Number(entry.fat) || 0), 0);
    const totalFiber = foodEntries.reduce((sum, entry) => sum + (Number(entry.fiber) || 0), 0);

    let context = `Food Log Summary:
Total Calories: ${totalCalories}
Total Protein: ${totalProtein.toFixed(1)}g
Total Carbs: ${totalCarbs.toFixed(1)}g
Total Fat: ${totalFat.toFixed(1)}g
Total Fiber: ${totalFiber.toFixed(1)}g

Individual Food Entries:`;

    foodEntries.forEach((entry, index) => {
        context += `
${index + 1}. ${entry.text}
   - Quantity: ${entry.quantity || 'Not specified'}
   - Calories: ${entry.calories}
   - Protein: ${entry.protein}g, Carbs: ${entry.carbs}g, Fat: ${entry.fat}g`;
        if (entry.food_review) {
            context += `
   - Notes: ${entry.food_review}`;
        }
    });

    return context;
}

// Undo functionality for deleted entries
let deletedEntriesStack = [];
const MAX_UNDO_STACK = 10;

function addToUndoStack(entry) {
    deletedEntriesStack.unshift({
        entry: { ...entry },
        timestamp: Date.now()
    });
    
    // Keep only the last MAX_UNDO_STACK entries
    if (deletedEntriesStack.length > MAX_UNDO_STACK) {
        deletedEntriesStack = deletedEntriesStack.slice(0, MAX_UNDO_STACK);
    }
    
    // Clean up old entries (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    deletedEntriesStack = deletedEntriesStack.filter(item => item.timestamp > fiveMinutesAgo);
}

function undoLastDelete() {
    if (deletedEntriesStack.length === 0) {
        showFoodLogMessage('No recent deletions to undo', 'error');
        return;
    }
    
    const lastDeleted = deletedEntriesStack.shift();
    const restoredEntry = { ...lastDeleted.entry };
    
    // Generate new ID if needed
    if (!restoredEntry.id) {
        restoredEntry.id = generateId();
    }
    
    foodEntries.push(restoredEntry);
    updateFoodEntries();
    updateCalorieData();
    
    showFoodLogMessage(`Restored: ${restoredEntry.text}`, 'success');
}

// Handle food input keyboard shortcuts
document.addEventListener('DOMContentLoaded', function() {
    const foodInput = document.getElementById('foodInput');
    if (foodInput) {
        foodInput.addEventListener('keydown', function(event) {
            // Submit on Ctrl+Enter or Cmd+Enter
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                logFood();
            }
        });
    }
});

debugLog('FoodLog.js loaded successfully');