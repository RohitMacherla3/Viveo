// profile.js - Profile Management Functions

// Show profile settings modal
function showProfileSettings() {
    const modal = document.getElementById('profileModal');
    modal.style.display = 'flex';
    
    // Load current profile data
    loadProfileForm();
}

// Close profile settings modal
function closeProfileSettings() {
    const modal = document.getElementById('profileModal');
    modal.style.display = 'none';
}

// Load current profile data into form
function loadProfileForm() {
    // Load nutrition goals
    document.getElementById('calorieGoal').value = userProfile.calorieGoal || 2000;
    document.getElementById('proteinGoal').value = userProfile.proteinGoal || 150;
    document.getElementById('carbsGoal').value = userProfile.carbsGoal || 250;
    document.getElementById('fatsGoal').value = userProfile.fatsGoal || 65;
    
    // Load personal information
    document.getElementById('age').value = userProfile.age || '';
    document.getElementById('weight').value = userProfile.weight || '';
    document.getElementById('height').value = userProfile.height || '';
    document.getElementById('activityLevel').value = userProfile.activityLevel || 'moderately_active';
}

// Save profile settings
async function saveProfileSettings(event) {
    event.preventDefault();
    
    const messageDiv = document.getElementById('profileMessage');
    
    try {
        // Get form data
        const formData = {
            calorieGoal: parseInt(document.getElementById('calorieGoal').value),
            proteinGoal: parseInt(document.getElementById('proteinGoal').value),
            carbsGoal: parseInt(document.getElementById('carbsGoal').value),
            fatsGoal: parseInt(document.getElementById('fatsGoal').value),
            age: parseInt(document.getElementById('age').value) || null,
            weight: parseFloat(document.getElementById('weight').value) || null,
            height: parseInt(document.getElementById('height').value) || null,
            activityLevel: document.getElementById('activityLevel').value
        };
        
        // Validate required fields
        if (!formData.calorieGoal || !formData.proteinGoal || !formData.carbsGoal || !formData.fatsGoal) {
            messageDiv.innerHTML = '<div class="message-alert error">Please fill in all nutrition goals.</div>';
            return;
        }
        
        // Calculate calorie target if personal info is provided
        if (formData.age && formData.weight && formData.height) {
            const calculatedCalories = calculateDailyCalories(
                formData.weight, 
                formData.height, 
                formData.age, 
                formData.activityLevel
            );
            
            // Suggest if user's goal is very different from calculated
            const difference = Math.abs(formData.calorieGoal - calculatedCalories);
            if (difference > 300) {
                const shouldUpdate = confirm(
                    `Based on your stats, your recommended daily calories are ${calculatedCalories}. ` +
                    `Your current goal is ${formData.calorieGoal}. Would you like to update to the recommended amount?`
                );
                
                if (shouldUpdate) {
                    formData.calorieGoal = calculatedCalories;
                    document.getElementById('calorieGoal').value = calculatedCalories;
                }
            }
        }
        
        // Update local profile
        userProfile = { ...userProfile, ...formData };
        
        // Update calorie target
        calorieData.target = formData.calorieGoal;
        
        // Save to backend if user is logged in
        if (currentUser) {
            await saveProfileToBackend(formData);
        }
        
        // Save to localStorage as backup
        localStorage.setItem('viveo_profile', JSON.stringify(userProfile));
        
        // Update UI
        updateCalorieData();
        updateProfileDisplay();
        
        messageDiv.innerHTML = '<div class="message-alert success">Profile settings saved successfully!</div>';
        
        // Close modal after delay
        setTimeout(() => {
            closeProfileSettings();
        }, 1500);
        
    } catch (error) {
        console.error('Error saving profile:', error);
        messageDiv.innerHTML = '<div class="message-alert error">Failed to save profile settings. Please try again.</div>';
    }
}

// Save profile to backend
async function saveProfileToBackend(profileData) {
    try {
        const response = await fetch(`${API_BASE_URL}/updateProfile`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save to backend');
        }
        
        debugLog('Profile saved to backend successfully');
    } catch (error) {
        debugLog('Failed to save profile to backend:', error);
        // Continue with local save
    }
}

// Load user profile from backend or localStorage
async function loadUserProfile() {
    try {
        // Try to load from backend first
        if (currentUser) {
            const response = await fetch(`${API_BASE_URL}/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${currentUser.token}`,
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const backendProfile = await response.json();
                userProfile = { ...userProfile, ...backendProfile };
                debugLog('Profile loaded from backend:', userProfile);
            }
        }
    } catch (error) {
        debugLog('Failed to load profile from backend:', error);
    }
    
    // Load from localStorage as fallback
    const savedProfile = localStorage.getItem('viveo_profile');
    if (savedProfile) {
        const localProfile = JSON.parse(savedProfile);
        userProfile = { ...userProfile, ...localProfile };
        debugLog('Profile loaded from localStorage:', userProfile);
    }
    
    // Update calorie target
    calorieData.target = userProfile.calorieGoal;
    updateCalorieData();
    updateProfileDisplay();
}

// Update profile display in UI
function updateProfileDisplay() {
    // Update calorie target display
    document.getElementById('calorieTarget').textContent = userProfile.calorieGoal;

    // Show profile details in the Profile Settings card
    const detailsDiv = document.getElementById('profileDetails');
    if (detailsDiv) {
        detailsDiv.innerHTML = `
            <div style="margin-bottom: 0.5rem;"><strong>Calories Goal:</strong> ${userProfile.calorieGoal || 2000} kcal</div>
            <div style="margin-bottom: 0.5rem;"><strong>Protein Goal:</strong> ${userProfile.proteinGoal || 150} g</div>
            <div style="margin-bottom: 0.5rem;"><strong>Carbs Goal:</strong> ${userProfile.carbsGoal || 250} g</div>
            <div style="margin-bottom: 0.5rem;"><strong>Fats Goal:</strong> ${userProfile.fatsGoal || 65} g</div>
            <div style="margin-bottom: 0.5rem;"><strong>Age:</strong> ${userProfile.age || '-'} </div>
            <div style="margin-bottom: 0.5rem;"><strong>Weight:</strong> ${userProfile.weight || '-'} kg</div>
            <div style="margin-bottom: 0.5rem;"><strong>Height:</strong> ${userProfile.height || '-'} cm</div>
            <div style="margin-bottom: 0.5rem;"><strong>Activity Level:</strong> ${userProfile.activityLevel || '-'} </div>
        `;
    }

    debugLog('Profile display updated');
}

// Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor equation
function calculateBMR(weight, height, age, gender = 'male') {
    if (gender === 'male') {
        return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
    } else {
        return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
    }
}

// Calculate daily calorie needs
function calculateDailyCalories(weight, height, age, activityLevel, gender = 'male') {
    const bmr = calculateBMR(weight, height, age, gender);
    const activityMultipliers = {
        sedentary: 1.2,
        lightly_active: 1.375,
        moderately_active: 1.55,
        very_active: 1.725,
        extremely_active: 1.9
    };
    
    const multiplier = activityMultipliers[activityLevel] || 1.55;
    return Math.round(bmr * multiplier);
}

// Calculate BMI
function calculateBMI(weight, height) {
    const heightInMeters = height / 100;
    return (weight / (heightInMeters * heightInMeters)).toFixed(1);
}

// Get BMI category
function getBMICategory(bmi) {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal weight';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
}

// Generate nutrition recommendations
function generateNutritionRecommendations() {
    const recommendations = [];
    
    if (!userProfile.age || !userProfile.weight || !userProfile.height) {
        recommendations.push("Complete your profile for personalized recommendations.");
        return recommendations;
    }
    
    const bmi = calculateBMI(userProfile.weight, userProfile.height);
    const bmiCategory = getBMICategory(parseFloat(bmi));
    
    recommendations.push(`Your BMI is ${bmi} (${bmiCategory})`);
    
    // Protein recommendations
    const proteinPerKg = userProfile.proteinGoal / userProfile.weight;
    if (proteinPerKg < 1.2) {
        recommendations.push("Consider increasing protein intake to 1.2-2.0g per kg body weight.");
    } else if (proteinPerKg > 2.2) {
        recommendations.push("Your protein intake is quite high. Ensure you're staying hydrated.");
    }
    
    // Activity level recommendations
    if (userProfile.activityLevel === 'sedentary') {
        recommendations.push("Try to incorporate more physical activity for better health.");
    }
    
    // Calorie recommendations based on goals
    const recommendedCalories = calculateDailyCalories(
        userProfile.weight, 
        userProfile.height, 
        userProfile.age, 
        userProfile.activityLevel
    );
    
    const calorieDifference = userProfile.calorieGoal - recommendedCalories;
    if (Math.abs(calorieDifference) > 200) {
        if (calorieDifference > 0) {
            recommendations.push(`Your calorie goal is ${calorieDifference} calories above maintenance. This may lead to weight gain.`);
        } else {
            recommendations.push(`Your calorie goal is ${Math.abs(calorieDifference)} calories below maintenance. This may lead to weight loss.`);
        }
    }
    
    return recommendations;
}

// Reset profile to defaults
function resetProfile() {
    if (confirm('Are you sure you want to reset your profile to default values? This action cannot be undone.')) {
        userProfile = {
            calorieGoal: 2000,
            proteinGoal: 150,
            carbsGoal: 250,
            fatsGoal: 65,
            age: null,
            weight: null,
            height: null,
            activityLevel: 'moderately_active'
        };
        
        localStorage.removeItem('viveo_profile');
        calorieData.target = userProfile.calorieGoal;
        
        loadProfileForm();
        updateCalorieData();
        updateProfileDisplay();
        
        const messageDiv = document.getElementById('profileMessage');
        messageDiv.innerHTML = '<div class="message-alert success">Profile reset to default values.</div>';
    }
}

// Export profile data
function exportProfile() {
    const profileData = {
        username: currentUser?.username || 'Guest',
        exportDate: new Date().toISOString(),
        profile: userProfile,
        recommendations: generateNutritionRecommendations()
    };
    
    const blob = new Blob([JSON.stringify(profileData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viveo-profile-${getCurrentDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Import profile data
function importProfile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (importedData.profile) {
                userProfile = { ...userProfile, ...importedData.profile };
                calorieData.target = userProfile.calorieGoal;
                
                localStorage.setItem('viveo_profile', JSON.stringify(userProfile));
                
                loadProfileForm();
                updateCalorieData();
                updateProfileDisplay();
                
                const messageDiv = document.getElementById('profileMessage');
                messageDiv.innerHTML = '<div class="message-alert success">Profile imported successfully!</div>';
            } else {
                throw new Error('Invalid profile file format');
            }
        } catch (error) {
            const messageDiv = document.getElementById('profileMessage');
            messageDiv.innerHTML = '<div class="message-alert error">Failed to import profile. Please check the file format.</div>';
        }
    };
    
    reader.readAsText(file);
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('profileModal');
    if (event.target === modal) {
        closeProfileSettings();
    }
});

// Handle escape key to close modal
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('profileModal');
        if (modal.style.display === 'flex') {
            closeProfileSettings();
        }
    }
});

// Initialize profile when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    // Load profile after a short delay to ensure other systems are ready
    setTimeout(() => {
        loadUserProfile();
    }, 100);
});