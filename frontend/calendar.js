// calendar.js - Calendar Functions

// Initialize calendar
function initializeCalendar() {
    updateCalendarDisplay();
}

// Update calendar display
function updateCalendarDisplay() {
    const calendarDays = document.getElementById('calendarDays');
    const currentWeekElement = document.getElementById('currentWeek');
    
    if (!calendarDays || !currentWeekElement) {
        debugLog('Calendar elements not found');
        return;
    }
    
    // Get current week
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Start from Monday
    
    // Update header
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    currentWeekElement.textContent = currentDate.toLocaleDateString('en-US', options);
    
    // Clear and populate calendar days
    calendarDays.innerHTML = '';
    
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        const isToday = day.toDateString() === new Date().toDateString();
        const isSelected = day.toDateString() === currentDate.toDateString();
        
        if (isToday) dayElement.classList.add('today');
        if (isSelected) dayElement.classList.add('active');
        
        dayElement.innerHTML = `
            <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.25rem;">${dayNames[i]}</div>
            <div style="font-weight: bold; font-size: 1rem;">${day.getDate()}</div>
        `;
        
        dayElement.onclick = () => {
            currentDate = new Date(day);
            updateCalendarDisplay();
            loadDayData();
        };
        
        // Add visual indicator for days with food entries
        if (hasDataForDate(day)) {
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                width: 6px;
                height: 6px;
                background: #4CAF50;
                border-radius: 50%;
                margin: 2px auto 0;
            `;
            dayElement.appendChild(indicator);
        }
        
        calendarDays.appendChild(dayElement);
    }
}

// Navigate to previous week
function previousWeek() {
    currentDate.setDate(currentDate.getDate() - 7);
    updateCalendarDisplay();
    loadDayData();
}

// Navigate to next week
function nextWeek() {
    currentDate.setDate(currentDate.getDate() + 7);
    updateCalendarDisplay();
    loadDayData();
}

// Navigate to today
function goToToday() {
    currentDate = new Date();
    updateCalendarDisplay();
    loadDayData();
}

// Load data for the selected day
async function loadDayData() {
    const dateString = currentDate.toISOString().split('T')[0];
    debugLog('Loading data for date:', dateString);
    
    if (!currentUser) {
        // Load from localStorage for demo
        loadLocalDayData(dateString);
        return;
    }
    
    try {
        // Load food entries for the selected date
        const url = new URL(`${API_BASE_URL}/getFoodEntries`);
        url.searchParams.append('date_str', dateString);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            debugLog('Loaded food entries for date:', data);
            
            // Convert backend entries to frontend format
            foodEntries = data.entries.map(entry => ({
                id: entry.entry_id || generateId(),
                text: entry.food_name || entry.original_text,
                calories: Number(entry.calories) || 0,
                protein: Number(entry.protein) || 0,
                carbs: Number(entry.carbs) || 0,
                fat: Number(entry.fats) || 0,
                fiber: Number(entry.fiber) || 0,
                quantity: entry.quantity || '',
                food_review: entry.food_review || '',
                meal_type: entry.meal_type || 'unknown',
                timestamp: new Date(entry.timestamp)
            }));
            
            // Update UI
            updateFoodEntries();
            updateCalorieData();
        } else {
            // No data for this date
            foodEntries = [];
            updateFoodEntries();
            updateCalorieData();
        }
    } catch (error) {
        debugLog('Failed to load day data from backend:', error);
        loadLocalDayData(dateString);
    }
}

// Load day data from localStorage (fallback)
function loadLocalDayData(dateString) {
    const storageKey = `viveo_data_${currentUser?.username || 'guest'}_${dateString}`;
    const savedData = localStorage.getItem(storageKey);
    
    if (savedData) {
        try {
            const dayData = JSON.parse(savedData);
            foodEntries = dayData.foodEntries || [];
            updateFoodEntries();
            updateCalorieData();
            debugLog('Loaded local data for date:', dateString);
        } catch (error) {
            debugLog('Error loading local day data:', error);
            foodEntries = [];
            updateFoodEntries();
            updateCalorieData();
        }
    } else {
        // No data for this date
        foodEntries = [];
        updateFoodEntries();
        updateCalorieData();
    }
}

// Save current day data to localStorage
function saveDayData() {
    const dateString = currentDate.toISOString().split('T')[0];
    const storageKey = `viveo_data_${currentUser?.username || 'guest'}_${dateString}`;
    
    const dayData = {
        date: dateString,
        foodEntries: foodEntries,
        calorieData: calorieData,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(storageKey, JSON.stringify(dayData));
    debugLog('Saved day data for:', dateString);
}

// Check if there's data for a specific date
function hasDataForDate(date) {
    const dateString = date.toISOString().split('T')[0];
    const storageKey = `viveo_data_${currentUser?.username || 'guest'}_${dateString}`;
    return localStorage.getItem(storageKey) !== null;
}

// Get date range for week view
function getWeekRange(date) {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay() + 1); // Monday
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    
    return { start: startOfWeek, end: endOfWeek };
}

// Get week summary data
function getWeekSummary() {
    const weekRange = getWeekRange(currentDate);
    const summary = {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        avgDailyCalories: 0,
        daysWithData: 0
    };
    
    // Loop through each day of the week
    for (let d = new Date(weekRange.start); d <= weekRange.end; d.setDate(d.getDate() + 1)) {
        const dayData = getDataForDate(d);
        if (dayData && dayData.foodEntries.length > 0) {
            summary.daysWithData++;
            
            dayData.foodEntries.forEach(entry => {
                summary.totalCalories += entry.calories || 0;
                summary.totalProtein += entry.protein || 0;
                summary.totalCarbs += entry.carbs || 0;
                summary.totalFat += entry.fat || 0;
            });
        }
    }
    
    summary.avgDailyCalories = summary.daysWithData > 0 ? 
        Math.round(summary.totalCalories / summary.daysWithData) : 0;
    
    return summary;
}

// Get data for a specific date
function getDataForDate(date) {
    const dateString = date.toISOString().split('T')[0];
    const storageKey = `viveo_data_${currentUser?.username || 'guest'}_${dateString}`;
    const savedData = localStorage.getItem(storageKey);
    
    if (savedData) {
        try {
            return JSON.parse(savedData);
        } catch (error) {
            debugLog('Error parsing data for date:', dateString, error);
            return null;
        }
    }
    
    return null;
}

// Export week data
function exportWeekData() {
    const weekRange = getWeekRange(currentDate);
    const weekData = {
        weekStart: weekRange.start.toISOString().split('T')[0],
        weekEnd: weekRange.end.toISOString().split('T')[0],
        summary: getWeekSummary(),
        dailyData: {}
    };
    
    // Collect data for each day
    for (let d = new Date(weekRange.start); d <= weekRange.end; d.setDate(d.getDate() + 1)) {
        const dateString = d.toISOString().split('T')[0];
        const dayData = getDataForDate(d);
        if (dayData) {
            weekData.dailyData[dateString] = dayData;
        }
    }
    
    const blob = new Blob([JSON.stringify(weekData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viveo-week-${weekRange.start.toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Handle keyboard navigation
function handleCalendarKeyboard(event) {
    switch (event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            currentDate.setDate(currentDate.getDate() - 1);
            updateCalendarDisplay();
            loadDayData();
            break;
        case 'ArrowRight':
            event.preventDefault();
            currentDate.setDate(currentDate.getDate() + 1);
            updateCalendarDisplay();
            loadDayData();
            break;
        case 'ArrowUp':
            event.preventDefault();
            previousWeek();
            break;
        case 'ArrowDown':
            event.preventDefault();
            nextWeek();
            break;
        case 'Home':
            event.preventDefault();
            goToToday();
            break;
    }
}

// Touch/swipe support for mobile
let touchStartX = 0;
let touchEndX = 0;

function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swipe left - next week
            nextWeek();
        } else {
            // Swipe right - previous week
            previousWeek();
        }
    }
}

// Auto-save current day data when food entries change
function autoSaveDayData() {
    saveDayData();
    updateCalendarDisplay(); // Refresh indicators
}

// Initialize calendar when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    
    // Add keyboard navigation
    document.addEventListener('keydown', handleCalendarKeyboard);
    
    // Add touch listeners to calendar
    const calendar = document.getElementById('calendarDays');
    if (calendar) {
        calendar.addEventListener('touchstart', handleTouchStart, false);
        calendar.addEventListener('touchend', handleTouchEnd, false);
    }
    
    // Auto-save every 30 seconds
    setInterval(autoSaveDayData, 30000);
});