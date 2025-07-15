# 🍎 Mac Testing Guide for Viveo Docker Setup

Test your Viveo application on Mac before deploying to Proxmox server.

## 📋 Prerequisites

- **Docker Desktop for Mac** (with Compose)
- **Your Viveo project files**
- **Claude API key** (optional for initial testing)

## 🚀 Quick Start

### 1. **Setup Project Structure**

Make sure your project looks like this:

```
viveo-app/
├── app/                     # Your existing backend
│   ├── main.py
│   ├── config.py
│   ├── settings.py
│   └── ... (all your other files)
├── frontend/                # Your frontend files
│   ├── index.html
│   ├── config.js
│   ├── *.js files
│   └── ...
├── data/                    # Your existing data directory
├── requirements.txt         # Your Python dependencies
├── docker-compose.mac.yml   # Mac testing config
├── Dockerfile.backend.mac   # Mac backend dockerfile
├── .env.mac                # Mac environment template
└── test-mac.sh             # Mac testing script
```

### 2. **Prepare Frontend**

Update your `frontend/config.js` for Mac testing:

```javascript
// Change this line for Mac testing
const API_BASE_URL = 'http://localhost:8001';
```

### 3. **Start Testing**

```bash
# Make script executable
chmod +x test-mac.sh

# Start all services
./test-mac.sh start
```

### 4. **Access Your App**

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs
- **Health Check**: http://localhost:8001/health

## 🔧 Mac Testing Commands

```bash
# Start development environment
./test-mac.sh start

# Stop all services
./test-mac.sh stop

# Restart services
./test-mac.sh restart

# View logs
./test-mac.sh logs
./test-mac.sh logs backend
./test-mac.sh logs frontend

# Check service status
./test-mac.sh status

# Access service shells
./test-mac.sh shell backend
./test-mac.sh shell mysql

# Clean up everything
./test-mac.sh cleanup
```

## 🐛 Troubleshooting

### **Docker Issues**

```bash
# Check if Docker is running
docker info

# If Docker not running, start Docker Desktop
open -a Docker

# Reset Docker if issues persist
docker system prune -a
```

### **Port Conflicts**

If you get port conflicts:

```bash
# Check what's using the ports
lsof -i :3001  # Frontend port
lsof -i :8001  # Backend port
lsof -i :3307  # MySQL port

# Kill processes if needed
sudo kill -9 <PID>
```

### **Backend Not Starting**

```bash
# Check backend logs
./test-mac.sh logs backend

# Common issues:
# 1. Missing CLAUDE_API_KEY (add to .env)
# 2. Database connection (wait for MySQL to fully start)
# 3. Python dependencies (check requirements.txt)

# Shell into backend to debug
./test-mac.sh shell backend
```

### **Frontend Not Loading**

```bash
# Check frontend logs
./test-mac.sh logs frontend

# Verify files are in frontend/ directory
ls -la frontend/

# Check if config.js has correct API URL
grep API_BASE_URL frontend/config.js
```

### **Database Issues**

```bash
# Check MySQL logs
./test-mac.sh logs mysql

# Connect to database
./test-mac.sh shell mysql

# Check database exists
SHOW DATABASES;
USE viveo_db;
SHOW TABLES;
```

## 📊 Testing Checklist

### **Backend Testing**

- [ ] Health endpoint: http://localhost:8001/health
- [ ] API docs: http://localhost:8001/docs
- [ ] User signup/login
- [ ] Food logging
- [ ] AI chat (with Claude API key)

### **Frontend Testing**

- [ ] Page loads: http://localhost:3001
- [ ] Login/signup forms work
- [ ] Food logging interface
- [ ] AI chat widget
- [ ] Calendar navigation

### **Integration Testing**

- [ ] Frontend can connect to backend
- [ ] User authentication works
- [ ] Food entries save to database
- [ ] AI responses work (with API key)

## 🔧 Configuration Files

### **Database Connection**

Mac testing uses different ports to avoid conflicts:

- **MySQL**: Port 3307 (instead of 3306)
- **Backend**: Port 8001 (instead of 8000)
- **Frontend**: Port 3001 (instead of 3000)

### **Environment Variables**

Edit `.env` file for your setup:

```bash
# Required for AI features
CLAUDE_API_KEY=your-claude-api-key-here

# Database (already configured for Mac)
MYSQL_ROOT_PASSWORD=viveo_root_pass
MYSQL_PASSWORD=viveo_pass

# Optional: Change these if needed
SECRET_KEY=your-secret-key
```

## 🚀 Ready for Production?

Once Mac testing works:

1. **Copy your working files** to Proxmox server
2. **Update config.js** back to production API URL
3. **Run production deploy**: `./deploy.sh`

## 📝 Notes

- **Development Mode**: Mac setup uses `--reload` for faster development
- **Volume Mounts**: Your source code is mounted for live updates
- **Different Ports**: Avoids conflicts with other local services
- **Simplified Setup**: No nginx reverse proxy for easier debugging

## 🆘 Need Help?

If you encounter issues:

1. **Check the logs**: `./test-mac.sh logs [service]`
2. **Verify Docker**: Make sure Docker Desktop is running
3. **Check ports**: Ensure ports 3001, 8001, 3307 are free
4. **Review files**: Make sure all files are in correct directories

Happy testing! 🎉