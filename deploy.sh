#!/bin/bash

# Viveo Deployment Script for Proxmox Server
# This script sets up and deploys the Viveo application using Docker

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        warn "This script is running as root. Consider running as a regular user with sudo privileges."
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check available disk space (at least 2GB)
    available_space=$(df / | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 2097152 ]]; then  # 2GB in KB
        warn "Low disk space detected. At least 2GB recommended."
    fi
    
    log "System requirements check completed."
}

# Setup environment
setup_environment() {
    log "Setting up environment..."
    
    # Create .env file if it doesn't exist
    if [[ ! -f .env ]]; then
        log "Creating .env file..."
        
        # Create basic .env file
        cat > .env << 'EOF'
# Database Configuration
MYSQL_ROOT_PASSWORD=viveo_root_pass_change_me
MYSQL_DATABASE=viveo_db
MYSQL_USER=viveo_user
MYSQL_PASSWORD=viveo_secure_password_change_me

# Application Configuration
SECRET_KEY=your-super-secret-jwt-key-change-in-production-make-it-long-and-random
CLAUDE_API_KEY=your_claude_api_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# MongoDB (if needed)
MONGO_DB_USR=dummy_user
MONGO_DB_PWD=dummy_password

# Environment
DEBUG=false
PYTHONPATH=/app
EOF
        
        # Generate random secret key
        SECRET_KEY=$(openssl rand -hex 32)
        sed -i.bak "s/your-super-secret-jwt-key-change-in-production-make-it-long-and-random/$SECRET_KEY/" .env
        
        # Generate random MySQL passwords
        MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
        MYSQL_PASSWORD=$(openssl rand -hex 16)
        sed -i.bak "s/viveo_root_pass_change_me/$MYSQL_ROOT_PASSWORD/" .env
        sed -i.bak "s/viveo_secure_password_change_me/$MYSQL_PASSWORD/" .env
        
        warn "Please edit .env file and add your CLAUDE_API_KEY before continuing."
        warn "Generated passwords have been set in .env file."
        
        # Remove backup files
        rm -f .env.bak
    fi
    
    # Create necessary directories
    log "Creating necessary directories..."
    mkdir -p data/{users,vectors} logs nginx/ssl mysql/init frontend
    
    # Set proper permissions
    chmod 755 data logs 2>/dev/null || true
    chmod -R 755 data/* 2>/dev/null || true
    
    log "Environment setup completed."
}

# Setup frontend
setup_frontend() {
    log "Setting up frontend..."
    
    # Update API URL in frontend config if it exists
    if [[ -f frontend/config.js ]]; then
        log "Updating frontend configuration..."
        # Use a more compatible sed command for Mac
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS version
            sed -i.bak "s|http://localhost:8000|/api|g" frontend/config.js
            rm -f frontend/config.js.bak
        else
            # Linux version
            sed -i "s|http://localhost:8000|/api|g" frontend/config.js
        fi
    else
        log "Frontend config.js not found, skipping configuration update."
    fi
    
    log "Frontend setup completed."
}

# Build and start services
deploy_services() {
    log "Building and starting services..."
    
    # Determine which docker-compose file to use
    COMPOSE_FILE="docker-compose.yml"
    if [[ -f "docker-compose.mac.yml" ]]; then
        COMPOSE_FILE="docker-compose.mac.yml"
        log "Using Mac-specific docker-compose file"
    fi
    
    # Pull latest images (skip if not available)
    log "Pulling base images..."
    docker-compose -f $COMPOSE_FILE pull || warn "Some images could not be pulled, proceeding with build..."
    
    # Build custom images
    log "Building backend image..."
    docker-compose -f $COMPOSE_FILE build backend
    
    log "Building frontend image..."
    docker-compose -f $COMPOSE_FILE build frontend
    
    # Start services
    log "Starting services..."
    docker-compose -f $COMPOSE_FILE up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    check_services
}

# Check service health
check_services() {
    log "Checking service health..."
    
    # Get container names from docker ps
    containers=$(docker ps --format "table {{.Names}}" | tail -n +2)
    
    if [[ -z "$containers" ]]; then
        error "No containers are running!"
        return 1
    fi
    
    for container in $containers; do
        if docker ps --filter "name=$container" --filter "status=running" | grep -q $container; then
            log "✓ $container is running"
        else
            error "✗ $container is not running"
            docker logs $container --tail 20 2>/dev/null || true
        fi
    done
    
    # Test API endpoint (adjust port based on your setup)
    log "Testing API endpoints..."
    
    # Try different ports that might be used
    API_PORTS=("8001" "8000" "80")
    API_WORKING=false
    
    for port in "${API_PORTS[@]}"; do
        if curl -f -s http://localhost:$port/health &> /dev/null || curl -f -s http://localhost:$port/api/health &> /dev/null; then
            log "✓ API health check passed on port $port"
            API_WORKING=true
            break
        fi
    done
    
    if [[ "$API_WORKING" == false ]]; then
        warn "✗ API health check failed on all tested ports - service may still be starting"
    fi
    
    # Test frontend
    log "Testing frontend..."
    FRONTEND_PORTS=("3001" "3000" "80")
    FRONTEND_WORKING=false
    
    for port in "${FRONTEND_PORTS[@]}"; do
        if curl -f -s http://localhost:$port &> /dev/null; then
            log "✓ Frontend is accessible on port $port"
            FRONTEND_WORKING=true
            break
        fi
    done
    
    if [[ "$FRONTEND_WORKING" == false ]]; then
        warn "✗ Frontend is not accessible on tested ports"
    fi
}

# Setup monitoring
setup_monitoring() {
    log "Setting up basic monitoring..."
    
    # Create a simple health check script
    cat > health_check.sh << 'EOF'
#!/bin/bash
# Simple health check script for Viveo

# Get running container names
SERVICES=$(docker ps --format "{{.Names}}" | grep viveo || echo "")
ALERT_EMAIL=""  # Set your email here

if [[ -z "$SERVICES" ]]; then
    echo "ALERT: No Viveo services are running"
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "ALERT: No Viveo services are running" | mail -s "Viveo Service Alert" $ALERT_EMAIL
    fi
    exit 1
fi

for service in $SERVICES; do
    if ! docker ps --filter "name=$service" --filter "status=running" | grep -q $service; then
        echo "ALERT: $service is not running"
        if [[ -n "$ALERT_EMAIL" ]]; then
            echo "ALERT: $service is not running" | mail -s "Viveo Service Alert" $ALERT_EMAIL
        fi
        # Try to restart the service
        docker start $service 2>/dev/null || true
    fi
done

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [[ $DISK_USAGE -gt 80 ]]; then
    echo "ALERT: Disk usage is ${DISK_USAGE}%"
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "ALERT: Disk usage is ${DISK_USAGE}%" | mail -s "Viveo Disk Alert" $ALERT_EMAIL
    fi
fi

# Cleanup old logs
docker system prune -f >/dev/null 2>&1 || true
find logs/ -name "*.log" -mtime +7 -delete 2>/dev/null || true
EOF

    chmod +x health_check.sh
    
    log "Health check script created at: $(pwd)/health_check.sh"
    log "To add to crontab for automatic monitoring:"
    log "  */5 * * * * $(pwd)/health_check.sh"
}

# Backup function
setup_backup() {
    log "Setting up backup script..."
    
    cat > backup.sh << 'EOF'
#!/bin/bash
# Backup script for Viveo

BACKUP_DIR="/tmp/viveo_backup"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Check if .env file exists
if [[ ! -f .env ]]; then
    echo "ERROR: .env file not found"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Find MySQL container
MYSQL_CONTAINER=$(docker ps --filter "name=mysql" --format "{{.Names}}" | head -1)

if [[ -n "$MYSQL_CONTAINER" ]]; then
    # Backup database
    echo "Backing up database..."
    docker exec $MYSQL_CONTAINER mysqldump -u root -p${MYSQL_ROOT_PASSWORD} ${MYSQL_DATABASE:-viveo_db} > $BACKUP_DIR/db_backup_$DATE.sql 2>/dev/null || echo "Database backup failed"
else
    echo "MySQL container not found, skipping database backup"
fi

# Backup data directory if it exists
if [[ -d data/ ]]; then
    echo "Backing up data directory..."
    tar -czf $BACKUP_DIR/data_backup_$DATE.tar.gz data/ 2>/dev/null || echo "Data backup failed"
fi

# Backup environment
cp .env $BACKUP_DIR/env_backup_$DATE 2>/dev/null || echo "Environment backup failed"

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "*backup*" -mtime +7 -delete 2>/dev/null || true

echo "Backup completed: $DATE"
echo "Backup location: $BACKUP_DIR"
EOF

    chmod +x backup.sh
    
    log "Backup script created at: $(pwd)/backup.sh"
    log "To run backup: ./backup.sh"
    log "To add automated backups to crontab:"
    log "  0 2 * * * $(pwd)/backup.sh"
}

# Main deployment function
main() {
    log "Starting Viveo deployment..."
    
    check_root
    check_requirements
    setup_environment
    setup_frontend
    deploy_services
    setup_monitoring
    setup_backup
    
    log "Deployment completed successfully!"
    log ""
    log "🎉 Viveo is now running!"
    log ""
    log "Access your application at:"
    log "  Frontend: http://localhost:3001 (or check running containers)"
    log "  API: http://localhost:8001 (or check running containers)"
    log ""
    log "Useful commands:"
    log "  View logs: docker-compose logs -f [service]"
    log "  View containers: docker ps"
    log "  Restart service: docker-compose restart [service]"
    log "  Stop all: docker-compose down"
    log "  Update app: ./deploy.sh --update"
    log "  Backup data: ./backup.sh"
    log "  Check health: ./health_check.sh"
    log ""
    log "Next steps:"
    log "1. Check your .env file and add your CLAUDE_API_KEY"
    log "2. Access the application and test functionality"
    log "3. Set up automated backups if needed"
}

# Update function
update_application() {
    log "Updating Viveo application..."
    
    # Pull latest changes (if using git)
    if [[ -d .git ]]; then
        git pull origin main || warn "Git pull failed, continuing with local code"
    fi
    
    # Determine compose file
    COMPOSE_FILE="docker-compose.yml"
    if [[ -f "docker-compose.mac.yml" ]]; then
        COMPOSE_FILE="docker-compose.mac.yml"
    fi
    
    # Rebuild and restart services
    docker-compose -f $COMPOSE_FILE down
    docker-compose -f $COMPOSE_FILE build --no-cache
    docker-compose -f $COMPOSE_FILE up -d
    
    # Wait and check health
    sleep 30
    check_services
    
    log "Application updated successfully."
}

# Cleanup function
cleanup_old_data() {
    log "Cleaning up old data..."
    
    # Remove old Docker images
    docker image prune -f
    
    # Remove old logs
    find logs/ -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    # Remove old data backups from data directory (keep last 30 days)
    find data/ -name "*.backup" -mtime +30 -delete 2>/dev/null || true
    
    log "Cleanup completed."
}

# Handle command line arguments
case "$1" in
    --update|update)
        update_application
        ;;
    --cleanup|cleanup)
        cleanup_old_data
        ;;
    --health|health)
        check_services
        ;;
    --backup|backup)
        setup_backup
        ./backup.sh
        ;;
    start|--start|"")
        main "$@"
        ;;
    *)
        echo "Usage: $0 [start|update|cleanup|health|backup]"
        echo ""
        echo "Commands:"
        echo "  start    - Deploy the application (default)"
        echo "  update   - Update and restart the application"
        echo "  cleanup  - Clean up old data and Docker images"
        echo "  health   - Check service health"
        echo "  backup   - Set up and run backup"
        exit 1
        ;;
esac