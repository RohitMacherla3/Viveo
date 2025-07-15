-- Initialize Viveo Database Schema

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    disabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    
    -- Profile fields
    calorie_goal INT DEFAULT 2000,
    protein_goal INT DEFAULT 150,
    carbs_goal INT DEFAULT 250,
    fats_goal INT DEFAULT 65,
    age INT NULL,
    weight DECIMAL(5,2) NULL,
    height INT NULL,
    activity_level ENUM('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active') DEFAULT 'moderately_active',
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
);

-- Create food_entries table for storing food logs
CREATE TABLE IF NOT EXISTS food_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    entry_id VARCHAR(100) UNIQUE NOT NULL,
    food_name VARCHAR(255) NOT NULL,
    original_text TEXT,
    quantity VARCHAR(100),
    calories DECIMAL(8,2) DEFAULT 0,
    protein DECIMAL(8,2) DEFAULT 0,
    carbs DECIMAL(8,2) DEFAULT 0,
    fats DECIMAL(8,2) DEFAULT 0,
    fiber DECIMAL(8,2) DEFAULT 0,
    food_review TEXT,
    meal_type ENUM('breakfast', 'lunch', 'dinner', 'snack', 'unknown') DEFAULT 'unknown',
    entry_date DATE NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, entry_date),
    INDEX idx_entry_id (entry_id),
    INDEX idx_timestamp (timestamp)
);

-- Create user_sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (session_token),
    INDEX idx_user_active (user_id, is_active),
    INDEX idx_expires_at (expires_at)
);

-- Create nutrition_goals table for tracking daily goals
CREATE TABLE IF NOT EXISTS nutrition_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    goal_date DATE NOT NULL,
    calorie_goal INT DEFAULT 2000,
    protein_goal INT DEFAULT 150,
    carbs_goal INT DEFAULT 250,
    fats_goal INT DEFAULT 65,
    water_goal INT DEFAULT 3500, -- in ml
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_date (user_id, goal_date),
    INDEX idx_user_date (user_id, goal_date)
);

-- Create water_intake table for tracking daily water consumption
CREATE TABLE IF NOT EXISTS water_intake (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    intake_date DATE NOT NULL,
    amount_ml INT NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, intake_date)
);

-- Create ai_conversations table for storing AI chat history
CREATE TABLE IF NOT EXISTS ai_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    conversation_id VARCHAR(100) NOT NULL,
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_conversation (user_id, conversation_id),
    INDEX idx_created_at (created_at)
);

-- Insert a default admin user (optional)
-- Password is hashed version of 'admin123' - change this!
INSERT IGNORE INTO users (
    username, 
    email, 
    full_name, 
    password, 
    disabled
) VALUES (
    'admin',
    'admin@viveo.com',
    'Administrator',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeGrfDYg8.JmWlHy.',  -- admin123
    false
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON food_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);

-- Create a view for user statistics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.created_at,
    u.last_login,
    COUNT(DISTINCT fe.entry_date) as days_logged,
    COUNT(fe.id) as total_food_entries,
    AVG(fe.calories) as avg_daily_calories,
    MAX(fe.timestamp) as last_food_entry
FROM users u
LEFT JOIN food_entries fe ON u.id = fe.user_id
GROUP BY u.id, u.username, u.email, u.full_name, u.created_at, u.last_login;