# Viveo - AI-Powered Calorie Tracking Application

A comprehensive nutrition tracking application with AI-powered food logging, vector-based search, and intelligent nutrition analysis.

## 🏗️ Architecture

- **Backend**: FastAPI (Python 3.13) with MySQL database
- **Frontend**: Static HTML/CSS/JavaScript with modern UI
- **AI**: Claude 3.5 Sonnet/Haiku for nutrition analysis + OpenAI embeddings for vector search
- **Deployment**: Multi-stage Docker with nginx reverse proxy
- **Storage**: MySQL for structured data, local vector store for semantic search

## 📋 Prerequisites

- Docker and Docker Compose
- Linux server (Proxmox, Ubuntu, etc.) or Mac for development
- Claude API key from Anthropic
- OpenAI API key for embeddings
- At least 4GB available disk space
- Ports available: 80, 443 (prod) or 8080, 3001, 8001, 3307 (dev)

## 🚀 Quick Deployment

### 1. Clone and Setup

```bash
# Clone the repository (or create project directory)
git clone <your-repo> viveo
cd viveo

# Or if you have the files locally:
# mkdir viveo && cd viveo
# (copy all your project files here)
```

### 2. Directory Structure

Your project has this structure:

```
viveo/
├── app/                          # Backend Python application
│   ├── api/
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── ask_ai.py
│   │       ├── auth.py
│   │       ├── food_log.py
│   │       └── profile.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── ai_client.py
│   │   ├── security.py
│   │   ├── utils.py
│   │   └── vector_store.py      # Updated with OpenAI embeddings
│   ├── database/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── session.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── food_processor.py
│   │   └── rag_service.py
│   ├── main.py
│   ├── config.py
│   ├── settings.py
│   └── .env                     # Your main environment file
├── frontend/                    # Frontend static files
│   ├── index.html
│   ├── config.js
│   ├── auth.js
│   ├── foodLog.js
│   ├── profile.js
│   ├── calendar.js
│   ├── app.js
│   ├── aiChat.js
│   └── styles.css              # CSS styles
├── deployment/                  # Deployment configuration
│   ├── deploy.sh               # Main deployment script
│   ├── Dockerfile.backend      # Backend Dockerfile
│   ├── Dockerfile.frontend     # Frontend Dockerfile
│   ├── docker-compose.yml      # Generated compose files
│   ├── backup.sh               # Backup script
│   ├── health_check.sh         # Health monitoring script
│   ├── install_docker.sh       # Docker installation script
│   └── nginx/                  # Generated nginx configs
├── data/                       # Application data
│   ├── users/                  # User-specific food logs
│   └── vectors/                # Vector embeddings storage
├── logs/                       # Application logs
├── mysql/                      # MySQL initialization scripts
│   └── init/
├── requirements.txt            # Python dependencies
├── .gitignore
├── LICENSE
└── README.md
```

### 3. Configuration

```bash
# Ensure your app/.env file exists with required variables
ls -la app/.env

# If it doesn't exist, create it:
cat > app/.env << EOF
# Application Configuration
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API Keys
CLAUDE_API_KEY=sk-ant-your-claude-key-here
OPENAI_API_KEY=sk-your-openai-key-here

# Database Configuration
MYSQL_ROOT_PASSWORD=your-mysql-root-password
MYSQL_DATABASE=viveo_db
MYSQL_USER=viveo_user
MYSQL_PASSWORD=your-mysql-password
EOF
```

### 4. Deploy

Navigate to the deployment directory and run the deployment script:

```bash
# Go to deployment folder
cd deployments

# Make script executable
chmod +x deploy.sh

# Deploy in development mode (Mac/local development)
./deploy.sh --mode dev

# Deploy in production mode
./deploy.sh --mode prod --domain yourdomain.com

# Deploy with SSL (production only)
./deploy.sh --mode prod --domain yourdomain.com --ssl

# Override API keys via command line if needed
./deploy.sh --mode dev --claude-key sk-ant-xxx --openai-key sk-xxx
```

### 5. Access Application

**Development Mode:**
- **Frontend**: http://localhost:8080/viveo/
- **API**: http://localhost:8080/viveo/api/
- **Health Check**: http://localhost:8080/viveo/health
- **Direct Backend**: http://localhost:8001
- **Direct Frontend**: http://localhost:3001

**Production Mode:**
- **Frontend**: http://your-domain/viveo/
- **API**: http://your-domain/viveo/api/
- **Health Check**: http://your-domain/viveo/health

## 🛠️ Development Workflow

### Local Development Setup

```bash
# Start development environment
cd deployment
./deploy.sh --mode dev

# Watch logs
./deploy.sh logs

# Restart specific service
./deploy.sh restart

# Stop all services
./deploy.sh stop
```

### Development Features

- **Hot Reload**: Backend automatically reloads on code changes
- **Volume Mounts**: Source code is mounted for live development
- **Debug Logging**: Enhanced logging in development mode
- **CORS Enabled**: Frontend can make requests to backend

## 🔧 Management Commands

### Service Management

```bash
cd deployment

# View logs for all services
./deploy.sh logs

# View logs for specific service
./deploy.sh logs backend
./deploy.sh logs frontend
./deploy.sh logs mysql

# Check service status
./deploy.sh status

# Restart all services
./deploy.sh restart

# Update and rebuild services
./deploy.sh update

# Stop all services
./deploy.sh stop

# Clean up old data and images
./deploy.sh cleanup
```

### Backup and Restore

```bash
# Create backup
./deploy.sh backup

# Manual database backup
docker-compose -f docker-compose.prod.yml exec mysql mysqldump -u root -p viveo_db > backup.sql

# Restore database
docker-compose -f docker-compose.prod.yml exec -T mysql mysql -u root -p viveo_db < backup.sql
```

## 🔒 Security Configuration

### Production Security Checklist

1. **Strong Environment Variables**
   ```bash
   # Generate secure secrets
   openssl rand -hex 32  # For SECRET_KEY
   openssl rand -hex 16  # For database passwords
   ```

2. **SSL Configuration**
   ```bash
   # Deploy with SSL
   ./deploy.sh --mode prod --domain yourdomain.com --ssl
   
   # Or configure Let's Encrypt manually
   certbot --nginx -d yourdomain.com
   ```

3. **Firewall Setup**
   ```bash
   # Allow only necessary ports
   ufw allow 80
   ufw allow 443
   ufw deny 3000    # Block direct frontend access
   ufw deny 8000    # Block direct backend access
   ufw deny 3306    # Block direct database access
   ```

4. **Database Security**
   ```bash
   # Access MySQL container
   docker exec -it viveo-mysql mysql -u root -p
   
   # Change default passwords
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_secure_password';
   ```

### Required Environment Variables

Your `app/.env` must contain:

```bash
# Core Application
SECRET_KEY=64-character-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# AI Services
CLAUDE_API_KEY=sk-ant-your-claude-key
OPENAI_API_KEY=sk-your-openai-key

# Database
MYSQL_ROOT_PASSWORD=secure-root-password
MYSQL_DATABASE=viveo_db
MYSQL_USER=viveo_user
MYSQL_PASSWORD=secure-user-password
```

## 🐛 Troubleshooting

### Common Issues

1. **Environment File Not Found**
   ```bash
   # Check if app/.env exists
   ls -la app/.env
   
   # Create it if missing (see Configuration section above)
   ```

2. **Services Won't Start**
   ```bash
   cd deployment
   
   # Check logs
   ./deploy.sh logs
   
   # Check Docker resources
   docker system df
   docker stats
   ```

3. **Database Connection Errors**
   ```bash
   # Test MySQL connection
   docker exec viveo-mysql mysqladmin ping -h localhost
   
   # Check MySQL logs
   ./deploy.sh logs mysql
   
   # Verify environment variables
   docker exec viveo-backend env | grep DATABASE_URL
   ```

4. **API Returns 500 Errors**
   ```bash
   # Check backend logs
   ./deploy.sh logs backend
   
   # Verify API keys are set
   docker exec viveo-backend env | grep -E "(CLAUDE_API_KEY|OPENAI_API_KEY)"
   
   # Test health endpoint
   curl http://localhost:8080/viveo/health
   ```

5. **Frontend Not Loading**
   ```bash
   # Check nginx configuration
   docker exec viveo-nginx nginx -t
   
   # Check frontend logs
   ./deploy.sh logs frontend
   
   # Restart nginx
   ./deploy.sh restart
   ```

### Port Conflicts

If you get port conflicts:

```bash
# Check what's using ports
sudo netstat -tulpn | grep :8080
sudo netstat -tulpn | grep :3306

# Stop conflicting services
sudo systemctl stop apache2  # If Apache is running
sudo systemctl stop mysql    # If MySQL is running locally
```

## 📊 Monitoring and Maintenance

### Health Monitoring

```bash
# Check all services
./deploy.sh status

# Test API health
curl http://localhost:8080/viveo/health

# Monitor resource usage
docker stats viveo-backend viveo-frontend viveo-mysql
```

### Log Management

```bash
# View live logs
./deploy.sh logs

# Check log sizes
du -sh logs/
docker system df

# Clean up logs
truncate -s 0 logs/*.log
```

### Database Maintenance

```bash
# Optimize database
docker exec viveo-mysql mysqlcheck -u root -p --optimize viveo_db

# Check database size
docker exec viveo-mysql mysql -u root -p -e "
SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = 'viveo_db';"
```

## 🔄 Updates and Deployment

### Updating the Application

```bash
cd deployment

# Pull latest code
git pull origin main

# Update and restart services
./deploy.sh update

# Or rebuild from scratch
./deploy.sh stop
./deploy.sh cleanup
./deploy.sh start
```

### Database Migrations

```bash
# Backup before migrations
./deploy.sh backup

# Run any database updates
docker exec -it viveo-backend python -m alembic upgrade head
```

## 🎯 Features

### AI-Powered Features
- **Smart Food Recognition**: Claude analyzes natural language food descriptions
- **Semantic Search**: OpenAI embeddings enable intelligent food log search
- **Nutrition Analysis**: AI-powered macro and micronutrient breakdown
- **Personalized Insights**: AI provides customized nutrition recommendations

### Technical Features
- **Vector Search**: Find similar meals and ingredients using semantic similarity
- **Multi-stage Docker**: Optimized containers for development and production
- **Reverse Proxy**: Nginx handles routing, SSL, and static file serving
- **Health Checks**: Built-in monitoring for all services
- **Hot Reload**: Development mode supports live code updates

## 📞 Support

### Getting Help

1. **Check the logs**: `./deploy.sh logs [service]`
2. **Verify configuration**: Ensure `app/.env` has all required variables
3. **Test connectivity**: Use health check endpoints
4. **Resource check**: Monitor Docker resource usage
5. **Port availability**: Ensure no conflicts with other services

### Debug Mode

```bash
# Enable debug logging
export DEBUG=true

# Run with verbose output
./deploy.sh --mode dev 2>&1 | tee deployment.log
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test in development mode
5. Submit a pull request

---

**Quick Start Summary:**
1. Ensure `app/.env` exists with API keys
2. `cd deployment && chmod +x deploy.sh`
3. `./deploy.sh --mode dev` (for development)
4. Access at `http://localhost:8080/viveo/`