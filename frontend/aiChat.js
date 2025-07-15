// aiChat.js - AI Chat Widget Functions (Right Side Window)

console.log('[Viveo] aiChat.js loaded');

// Add fallback debugLog if not defined
if (typeof debugLog !== 'function') {
    function debugLog(...args) {
        console.log('[Viveo]', ...args);
    }
    window.debugLog = debugLog;
}

// Send AI message
async function sendAiMessage() {
    debugLog('sendAiMessage called');
    const input = document.getElementById('aiChatInput');
    const message = input.value.trim();
    if (!message) return;

    if (!currentUser) {
        addAiChatMessage('Please login first to use the AI assistant.', 'ai');
        return;
    }

    // Add user message
    addAiChatMessage(message, 'user');
    input.value = '';
    autoResizeTextarea(input);

    // Show typing indicator
    showTypingIndicator();

    // Disable send button
    const sendButton = document.getElementById('aiSendButton');
    if (sendButton) {
        sendButton.disabled = true;
    }

    try {
        debugLog('Sending AI request:', message);
        
        // Check if this is a nutrition summary query - provide context
        let enhancedMessage = message;
        if (isNutritionSummaryQuery(message)) {
            debugLog('Detected nutrition summary query, adding context...');
            const foodContext = createFoodContextForAI();
            enhancedMessage = `${message}\n\nContext: Here is my food log for today:\n${foodContext}`;
            debugLog('Enhanced message with food context:', enhancedMessage);
        }

        // Send as JSON body to match your FastAPI endpoint
        const response = await fetch(`${API_BASE_URL}/askAI`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ food_details: enhancedMessage })
        });

        hideTypingIndicator();
        debugLog('AI response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            debugLog('AI response data:', data);
            addAiChatMessage(data.response, 'ai');
        } else {
            let errorMessage = 'Sorry, I encountered an error.';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                // Ignore parsing errors
            }
            console.error('AI error response:', errorMessage);
            addAiChatMessage(errorMessage, 'ai');
        }
    } catch (error) {
        hideTypingIndicator();
        console.error('AI network error:', error);
        
        // Fallback response for demo
        const fallbackResponse = generateFallbackResponse(message);
        addAiChatMessage(fallbackResponse, 'ai');
    } finally {
        if (sendButton) {
            sendButton.disabled = false;
        }
    }
}

// Check if message is asking about nutrition summary
function isNutritionSummaryQuery(message) {
    const nutritionKeywords = [
        'total calories', 'calories today', 'how many calories',
        'macros', 'macro breakdown', 'protein', 'carbs', 'fat',
        'nutrition', 'what did i eat', 'food today', 'ate today',
        'calories consumed', 'daily intake', 'food log', 'summary',
        'analyze my diet', 'how am i doing', 'progress'
    ];
    
    const lowerMessage = message.toLowerCase();
    return nutritionKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Generate fallback AI response for demo
function generateFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Handle delete-related queries
    if (lowerMessage.includes('delete') || lowerMessage.includes('remove') || lowerMessage.includes('clear')) {
        if (lowerMessage.includes('all') || lowerMessage.includes('everything')) {
            return "To delete all your food entries for today, look for the 'Clear All Entries' button at the top of your food log. You can also delete individual entries by clicking the ✕ button next to each entry.";
        }
        return "You can delete individual food entries by clicking the ✕ button next to each entry in your food log. If you want to delete all entries, use the 'Clear All Entries' button.";
    }
    
    if (isNutritionSummaryQuery(message)) {
        if (typeof foodEntries !== 'undefined' && foodEntries && foodEntries.length > 0) {
            const totalCalories = foodEntries.reduce((sum, entry) => sum + (entry.calories || 0), 0);
            const totalProtein = foodEntries.reduce((sum, entry) => sum + (entry.protein || 0), 0);
            
            return `Based on your food log today, you've consumed ${totalCalories} calories and ${totalProtein.toFixed(1)}g of protein. ${
                typeof calorieData !== 'undefined' && calorieData.target ? (
                    totalCalories < calorieData.target ? 
                    `You have ${calorieData.target - totalCalories} calories remaining to reach your goal.` :
                    `You've exceeded your calorie goal by ${totalCalories - calorieData.target} calories.`
                ) : 'Keep tracking your intake to stay on target!'
            }`;
        } else {
            return "You haven't logged any food entries today yet. Start by adding what you've eaten in the food log section!";
        }
    }
    
    if (lowerMessage.includes('healthy') || lowerMessage.includes('recommendation')) {
        return "For a healthy diet, focus on whole foods like lean proteins, vegetables, fruits, and whole grains. Stay hydrated and aim for balanced macronutrients throughout the day.";
    }
    
    if (lowerMessage.includes('weight') || lowerMessage.includes('lose') || lowerMessage.includes('gain')) {
        return "Weight management depends on creating the right calorie balance for your goals. For weight loss, aim for a moderate calorie deficit. For weight gain, a slight surplus. Always consult with a healthcare provider for personalized advice.";
    }
    
    if (lowerMessage.includes('meal') || lowerMessage.includes('food') || lowerMessage.includes('eat')) {
        return "Here are some healthy meal ideas: Grilled chicken with quinoa and vegetables, salmon with sweet potato, or a colorful salad with nuts and seeds. What type of meal are you looking for?";
    }
    
    // Handle entry management queries
    if (lowerMessage.includes('log') || lowerMessage.includes('track') || lowerMessage.includes('record')) {
        const entriesCount = (typeof foodEntries !== 'undefined' && foodEntries) ? foodEntries.length : 0;
        return `You currently have ${entriesCount} food ${entriesCount === 1 ? 'entry' : 'entries'} logged for today. You can add more by describing what you ate in the food log section, or manage existing entries using the delete buttons.`;
    }
    
    return "I'm here to help with nutrition questions! You can ask me about calories, macronutrients, healthy meal ideas, or analyze your food log. What would you like to know?";
}

// Add message to chat
function addAiChatMessage(message, sender) {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${sender}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'ai-message-bubble';
    bubbleDiv.innerHTML = message.replace(/\n/g, '<br>');
    
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    const indicator = document.getElementById('aiTypingIndicator');
    const messagesContainer = document.getElementById('aiChatMessages');
    if (indicator) {
        indicator.classList.add('show');
    }
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Hide typing indicator
function hideTypingIndicator() {
    const indicator = document.getElementById('aiTypingIndicator');
    if (indicator) {
        indicator.classList.remove('show');
    }
}

// Handle chat keypress
function handleAiChatKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendAiMessage();
    }
}

// Auto resize textarea
function autoResizeTextarea(textarea) {
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    }
}

// Initialize AI chat with welcome message
function initializeAiChat() {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) return;

    // Clear existing messages and add welcome message
    const existingWelcome = messagesContainer.querySelector('.ai-message.ai');
    if (!existingWelcome) {
        addAiChatMessage(`Hello! I'm your nutrition assistant. How can I help you today? You can ask me about:

• Nutritional information
• Food recommendations  
• Healthy meal ideas
• Calorie questions
• Your food log analysis`, 'ai');
    }
}

// Add quick action buttons to AI chat
function addQuickActions() {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) return;
    
    // Check if quick actions already exist
    if (messagesContainer.querySelector('.quick-actions')) {
        return;
    }
    
    const quickActionsDiv = document.createElement('div');
    quickActionsDiv.className = 'ai-message ai quick-actions';
    quickActionsDiv.innerHTML = `
        <div class="ai-message-bubble">
            <div style="margin-bottom: 0.5rem; font-weight: 600;">Quick Questions:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                <button class="quick-action-btn" onclick="sendQuickMessage('How many calories have I consumed today?')">
                    📊 Calorie Summary
                </button>
                <button class="quick-action-btn" onclick="sendQuickMessage('What are some healthy snack ideas?')">
                    🥜 Healthy Snacks
                </button>
                <button class="quick-action-btn" onclick="sendQuickMessage('How can I increase my protein intake?')">
                    💪 More Protein
                </button>
                <button class="quick-action-btn" onclick="sendQuickMessage('What should I eat for dinner?')">
                    🍽️ Dinner Ideas
                </button>
                <button class="quick-action-btn" onclick="sendQuickMessage('How do I delete food entries?')">
                    🗑️ Manage Entries
                </button>
                <button class="quick-action-btn" onclick="sendQuickMessage('Analyze my nutrition today')">
                    🔍 Daily Analysis
                </button>
            </div>
        </div>
    `;
    
    // Add styles for quick action buttons
    const style = document.createElement('style');
    style.textContent = `
        .quick-action-btn {
            background: #f0f8f0;
            border: 1px solid #4CAF50;
            border-radius: 12px;
            padding: 0.4rem 0.8rem;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.3s ease;
            color: #2d5a27;
        }
        .quick-action-btn:hover {
            background: #4CAF50;
            color: white;
        }
    `;
    
    if (!document.getElementById('quick-action-styles')) {
        style.id = 'quick-action-styles';
        document.head.appendChild(style);
    }
    
    messagesContainer.appendChild(quickActionsDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send quick message
function sendQuickMessage(message) {
    const input = document.getElementById('aiChatInput');
    if (input) {
        input.value = message;
        sendAiMessage();
    }
}

// Make sure createFoodContextForAI is available (fallback if not defined elsewhere)
if (typeof createFoodContextForAI !== 'function') {
    window.createFoodContextForAI = function() {
        console.log('[Viveo] Using fallback createFoodContextForAI');
        if (typeof foodEntries === 'undefined' || !foodEntries || foodEntries.length === 0) {
            return "No food entries logged for today yet.";
        }

        const totalCalories = foodEntries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0);
        const totalProtein = foodEntries.reduce((sum, entry) => sum + (Number(entry.protein) || 0), 0);
        const totalCarbs = foodEntries.reduce((sum, entry) => sum + (Number(entry.carbs) || 0), 0);
        const totalFat = foodEntries.reduce((sum, entry) => sum + (Number(entry.fat) || 0), 0);

        let context = `Today's Food Log Summary:
Total Calories: ${totalCalories}
Total Protein: ${totalProtein.toFixed(1)}g
Total Carbs: ${totalCarbs.toFixed(1)}g
Total Fat: ${totalFat.toFixed(1)}g

Individual Food Entries:`;

        foodEntries.forEach((entry, index) => {
            context += `
${index + 1}. ${entry.text}
   - Calories: ${entry.calories}
   - Protein: ${entry.protein}g, Carbs: ${entry.carbs}g, Fat: ${entry.fat}g`;
        });

        return context;
    };
}

// Attach event handlers when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Viveo] DOM Content Loaded - aiChat.js');
    
    // Wait a bit for other scripts to load
    setTimeout(() => {
        // Attach send button handler
        const sendButton = document.getElementById('aiSendButton');
        if (sendButton) {
            sendButton.onclick = function(event) {
                event.preventDefault();
                console.log('[Viveo] AI Send button clicked');
                sendAiMessage();
            };
            console.log('[Viveo] AI Send button handler attached');
        } else {
            console.error('[Viveo] AI Send button not found!');
        }
        
        // Attach input keypress handler
        const aiInput = document.getElementById('aiChatInput');
        if (aiInput) {
            aiInput.onkeypress = function(event) {
                handleAiChatKeyPress(event);
            };
            aiInput.oninput = function() {
                autoResizeTextarea(this);
            };
            console.log('[Viveo] AI Input handlers attached');
        } else {
            console.error('[Viveo] AI Input not found!');
        }
        
        // Test if elements exist
        const aiChatWidget = document.getElementById('aiChatWidget');
        const aiChatPanel = document.getElementById('aiChatPanel');
        const aiChatMessages = document.getElementById('aiChatMessages');
        
        console.log('[Viveo] Element check:', {
            aiChatWidget: !!aiChatWidget,
            aiChatPanel: !!aiChatPanel,
            aiChatMessages: !!aiChatMessages,
            aiSendButton: !!sendButton,
            aiChatInput: !!aiInput
        });
        
    }, 200);
    
    // Initialize AI chat after a delay
    setTimeout(() => {
        initializeAiChat();
        // Add quick actions after welcome message
        setTimeout(() => {
            addQuickActions();
        }, 1000);
    }, 500);
});

// Expose functions to global scope for HTML inline handlers
window.sendAiMessage = sendAiMessage;
window.handleAiChatKeyPress = handleAiChatKeyPress;
window.autoResizeTextarea = autoResizeTextarea;
window.sendQuickMessage = sendQuickMessage;

// Legacy function names for compatibility
window.sendChatMessage = sendAiMessage;
window.addChatMessage = addAiChatMessage;
window.handleChatKeyPress = handleAiChatKeyPress;

console.log('[Viveo] aiChat.js fully loaded - Right side window version');