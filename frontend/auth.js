// auth.js - Authentication Functions

// Authentication Functions
function showLogin() {
    document.getElementById('heroSection').style.display = 'none';
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('signupForm').classList.remove('active');
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('foodLogSection').style.display = 'none';
    document.getElementById('aiChatWidget').style.display = 'none';
}

function showSignup() {
    document.getElementById('heroSection').style.display = 'none';
    document.getElementById('signupForm').classList.add('active');
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('foodLogSection').style.display = 'none';
    document.getElementById('aiChatWidget').style.display = 'none';
}

function showDashboard() {
    document.getElementById('heroSection').style.display = 'none';
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('signupForm').classList.remove('active');
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('foodLogSection').style.display = 'block';
    document.getElementById('aiChatWidget').style.display = 'block';
    
    // Update auth buttons
    document.querySelector('.auth-buttons').innerHTML = `
        <button class="btn btn-secondary" onclick="logout()">Logout</button>
    `;
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const messageDiv = document.getElementById('loginMessage');

    try {
        // Create form data for OAuth2PasswordRequestForm
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch(`${API_BASE_URL}/token`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = { 
                username: username, 
                token: data.access_token,
                token_type: data.token_type 
            };
            localStorage.setItem('viveo_user', JSON.stringify(currentUser));
            
            messageDiv.innerHTML = '<div class="message-alert success">Login successful!</div>';
            setTimeout(() => {
                showDashboard();
                onUserLogin();
            }, 1000);
        } else {
            const errorData = await response.json();
            messageDiv.innerHTML = `<div class="message-alert error">${errorData.detail || 'Invalid credentials. Please try again.'}</div>`;
        }
    } catch (error) {
        messageDiv.innerHTML = '<div class="message-alert error">Network error. Please try again.</div>';
    }
}

async function handleSignup(event) {
    event.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const full_name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const messageDiv = document.getElementById('signupMessage');

    try {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                username: username,
                full_name: full_name,
                email: email,
                password: password 
            })
        });

        if (response.ok) {
            const data = await response.text();
            messageDiv.innerHTML = '<div class="message-alert success">Account created successfully! Please login.</div>';
            setTimeout(() => {
                showLogin();
            }, 1500);
        } else {
            const errorData = await response.json();
            messageDiv.innerHTML = `<div class="message-alert error">${errorData.detail || 'Signup failed. Please try again.'}</div>`;
        }
    } catch (error) {
        messageDiv.innerHTML = '<div class="message-alert error">Network error. Please try again.</div>';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('viveo_user');
    
    // Reset auth buttons
    document.querySelector('.auth-buttons').innerHTML = `
        <button class="btn btn-secondary" onclick="showLogin()">Login</button>
        <button class="btn btn-primary" onclick="showSignup()">Sign Up</button>
    `;
    
    // Show hero section and hide other sections
    document.getElementById('heroSection').style.display = 'block';
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('foodLogSection').style.display = 'none';
    document.getElementById('aiChatWidget').style.display = 'none';
    
    // Close AI chat if open
    closeAiChat();
}

function onUserLogin() {
    loadUserProfile();
    loadTodaysFoodEntries();
    debugLog('User logged in successfully', currentUser);
}