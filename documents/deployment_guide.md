# Viveo - Unified Deployment Guide

A nutrition tracking application with AI-powered food logging, supporting both development and production deployments.

## 🚀 Quick Start

### mac testing
uvicorn app.main:app --host 0.0.0.0 --port 3334 --reload --log-level info

serve .

### Development Mode (Mac/Local)
```bash
# Clone the repository
git clone <your-repo>
cd viveo

# Make deploy script executable
chmod +x deploy.sh

# Start in development mode
./deploy.sh --mode dev

# Access the application
open http://localhost:3336/viveo/
```

### Server Deployment
1. Send files to server using Rsync on local
```bash
rsync -avz -e "ssh -p 1875" "/Users/rohitmacherla/Documents/Projects/viveo-dev/" rohit@192.168.1.199:/home/rohit/storage/applications/viveo-dev/

rsync -avz -e "ssh -p 1875" "/Users/rohitmacherla/Documents/Projects/viveo-dev/" rohit@192.168.1.199:/home/rohit/storage/applications/viveo-prod/
```

2. Run the build
```bash
cd deployments/
chmod +x deploy.sh
# Deploy in production mode using screen
screen -S viveo
./deploy.sh --mode prod
# ./deploy.sh --mode prod --domain your-domain.com --ssl --claude-key sk-your-api-key-here

# Access the application
https://your-domain.com/viveo/
```


## 📁 Project Structure

```
viveo/
├── deploy.sh                 # Unified deployment script
├── install-docker.sh         # Server setup script
├── Dockerfile.backend        # Multi-stage backend container
├── frontend/
│   ├── Dockerfile            # Multi-stage frontend container
│   ├── *.html, *.js, *.css   # Frontend assets
│   └── package.json          # Optional NPM dependencies
├── app/                      # Backend Python application
├── mysql/
│   └── init/                 # Database initialization scripts
├── nginx/                    # Generated nginx configs
├── data/                     # Application data
└── logs/                     # Application logs
```

## 🛠️ Deployment Modes

### Development Mode (`--mode dev`)
- **Purpose**: Local development on Mac/Windows/Linux
- **Features**:
  - Hot reload for backend changes
  - Debug logging enabled
  - Source code volume mounts
  - Accessible on `localhost:8080`
  - Uses development container images
  - Separate port assignments to avoid conflicts

### Production Mode (`--mode prod`)
- **Purpose**: Production deployment on servers
- **Features**:
  - Optimized container images
  - Multi-worker backend
  - Security hardening
  - SSL/HTTPS support
  - Production logging
  - Standard port assignments (80/443)

## 📋 Prerequisites

### For Development (Mac/Local)
- Docker Desktop
- Git
- OpenSSL (for generating secrets)

### For Production (Proxmox/Server)
- Ubuntu/Debian/CentOS server
- Root access
- Domain name (for SSL)
- Firewall access to ports 80/443

## 🔧 Configuration Options

### Command Line Options
```bash
./deploy.sh [OPTIONS] [COMMAND]

OPTIONS:
    -m, --mode MODE         dev or prod (default: dev)
    -p, --path PATH         UI path (default: /viveo)
    -d, --domain DOMAIN     Domain name (default: localhost)
    -s, --ssl               Enable SSL/HTTPS (prod mode only)
    -k, --claude-key KEY    Claude API key
    -h, --help              Show help

COMMANDS:
    start                   Deploy the application (default)
    stop                    Stop all services
    restart                 Restart all services
    logs [service]          Show logs for service
    status                  Show service status
    update                  Update and restart services
    cleanup                 Clean up old data and images
    backup                  Create backup
```

### Environment Variables
The script automatically generates environment files:
- `.env.dev` - Development configuration
- `.env.prod` - Production configuration

Key variables:
- `CLAUDE_API_KEY` - Your Claude API key
- `MYSQL_PASSWORD` - Auto-generated database password
- `SECRET_KEY` - Auto-generated JWT secret

## 🌐 Network Configuration

### Development Mode
- Frontend: `http://localhost:3336/viveo/`
- API: `http://localhost:3336/viveo/api/`
- Health: `http://localhost:3336/viveo/health`
- Database: `localhost:3335`

### Production Mode
- Frontend: `http(s)://your-domain.com/viveo/`
- API: `http(s)://your-domain.com/viveo/api/`
- Health: `http(s)://your-domain.com/viveo/health`
- Database: Internal network only

## 🔒 Security Features

### Development
- Basic rate limiting
- CORS enabled for development
- Debug logging

### Production
- SSL/TLS encryption
- Security headers
- Rate limiting
- fail2ban intrusion prevention
- Firewall configuration
- Non-root container users
- Secrets management

## 📊 Monitoring & Maintenance

### Check Service Status
```bash
./deploy.sh status
```

### View Logs
```bash
# All services
./deploy.sh logs

# Specific service
./deploy.sh logs backend
./deploy.sh logs frontend
./deploy.sh logs nginx
```

### Create Backup
```bash
./deploy.sh backup
```

### Update Application
```bash
./deploy.sh update
```

## 🐛 Troubleshooting

### Common Issues

1. **"Permission denied" errors**
   ```bash
   chmod +x deploy.sh
   chmod +x install-docker.sh
   ```

2. **Docker not found on server**
   ```bash
   # Run the installation script
   sudo ./install-docker.sh
   ```

3. **Port conflicts in development**
   ```bash
   # Stop conflicting services
   ./deploy.sh stop
   
   # Check what's using the ports
   lsof -i :8080
   lsof -i :8001
   ```

4. **SSL certificate issues**
   ```bash
   # Regenerate certificates
   rm -rf nginx/ssl
   ./deploy.sh --mode prod --ssl
   ```

5. **Database connection errors**
   ```bash
   # Check database status
   ./deploy.sh logs mysql
   
   # Restart database
   ./deploy.sh restart mysql
   ```

### Health Checks
- Backend: `curl http://localhost:8000/viveo/health`
- Frontend: `curl http://localhost:8080/viveo/`
- Database: `./deploy.sh logs mysql`

### Container Access
```bash
# Access backend container
docker exec -it viveo-backend-dev bash  # dev mode
docker exec -it viveo-backend bash      # prod mode

# Access database
docker exec -it viveo-mysql-dev mysql -u viveo_user -p  # dev mode
docker exec -it viveo-mysql mysql -u viveo_user -p      # prod mode
```

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          ssh user@server 'cd /path/to/viveo && ./deploy.sh --mode prod --claude-key ${{ secrets.CLAUDE_API_KEY }}'
```

## 📝 Development Workflow

1. **Local Development**
   ```bash
   # Start development environment
   ./deploy.sh --mode dev
   
   # Make changes to your code
   # Changes are automatically reflected (hot reload)
   
   # View logs
   ./deploy.sh logs backend
   ```

2. **Testing Changes**
   ```bash
   # Restart specific service
   ./deploy.sh restart backend
   
   # Check health
   curl http://localhost:8080/viveo/health
   ```

3. **Production Deployment**
   ```bash
   # Deploy to production server
   ssh user@server 'cd /path/to/viveo && ./deploy.sh --mode prod --claude-key sk-xxx'
   ```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │    Frontend     │    │    Backend      │
│  Reverse Proxy  │◄──►│   (Node.js)     │◄──►│   (Python)      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         │                                              │
         ▼                                              ▼
┌─────────────────┐                            ┌─────────────────┐
│      SSL/TLS    │                            │     MySQL       │
│   Termination   │                            │    Database     │
│                 │                            │                 │
└─────────────────┘                            └─────────────────┘
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test locally with `./deploy.sh --mode dev`
4. Submit a pull request

## 📄 License

[Your License Here]

## 🆘 Support

- Create an issue on GitHub
- Check the troubleshooting section above
- Review logs with `./deploy.sh logs`