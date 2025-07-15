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
        log "Creating .env file from template..."
        cp .env.example .env
        
        # Generate random secret key
        SECRET_KEY=$(openssl rand -hex 32)
        sed -i "s/your-super-secret-jwt-key-change-in-production-make-it-long-and-random/$SECRET_KEY/" .env
        
        # Generate random MySQL passwords
        MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
        MYSQL_PASSWORD=$(openssl rand -hex 16)
        sed -i "s/viveo_root_password_change_me/$MYSQL_ROOT_PASSWORD/" .env
        sed -i "s/viveo_secure_password_change_me/$MYSQL_PASSWORD/" .env
        
        warn "Please edit .env file and add your CLAUDE_API_KEY before continuing."
        warn "Generated passwords have been set in .env file."
        
        # Check if Claude API key is set
        if ! grep -q "CLAUDE_API_KEY=sk-" .env; then
            error "Please set your CLAUDE_API_KEY in the .env file before continuing."
            exit 1
        fi
    fi
    
    # Create necessary directories
    log "Creating necessary directories..."
    mkdir -p data/{users,vectors} logs nginx/ssl mysql/init frontend
    
    # Set proper permissions
    chmod 755 data logs
    chmod -R 755 data/*
    
    log "Environment setup completed."
}

# Setup frontend
setup_frontend() {
    log "Setting up frontend..."
    
    # Update API URL in frontend config
    if [[ -f frontend/config.js ]]; then
        # Update API_BASE_URL to use /api prefix for production
        sed -i "s|http://localhost:8000|/api|g" frontend/config.js
    fi
    
    log "Frontend setup completed."
}

# Build and start services
deploy_services() {
    log "Building and starting services..."
    
    # Pull latest images
    docker-compose pull
    
    # Build custom images
    log "Building backend image..."
    docker-compose build backend
    
    log "Building frontend image..."
    docker-compose build frontend
    
    # Start services
    log "Starting services..."
    docker-compose up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    check_services
}

# Check service health
check_services() {
    log "Checking service health..."
    
    services=("viveo-mysql" "viveo-backend" "viveo-frontend" "viveo-nginx")
    
    for service in "${services[@]}"; do
        if docker ps --filter "name=$service" --filter "status=running" | grep -q $service; then
            log "✓ $service is running"
        else
            error "✗ $service is not running"
            docker logs $service --tail 50
        fi
    done
    
    # Test API endpoint
    log "Testing API endpoint..."
    if curl -f http://localhost/api/health &> /dev/null; then
        log "✓ API health check passed"
    else
        warn "✗ API health check failed - service may still be starting"
    fi
    
    # Test frontend
    log "Testing frontend..."
    if curl -f http://localhost &> /dev/null; then
        log "✓ Frontend is accessible"
    else
        warn "✗ Frontend is not accessible"
    fi
}

# Setup monitoring
setup_monitoring() {
    log "Setting up basic monitoring..."
    
    # Create a simple health check script
    cat > health_check.sh << 'EOF'
#!/bin/bash
# Simple health check script for Viveo

SERVICES=("viveo-mysql" "viveo-backend" "viveo-frontend" "viveo-nginx")
ALERT_EMAIL=""  # Set your email here

for service in "${SERVICES[@]}"; do
    if ! docker ps --filter "name=$service" --filter "status=running" | grep -q $service; then
        echo "ALERT: $service is not running" | mail -s "Viveo Service Alert" $ALERT_EMAIL
        docker-compose restart $service
    fi
done

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [[ $DISK_USAGE -gt 80 ]]; then
    echo "ALERT: Disk usage is ${DISK_USAGE}%" | mail -s "Viveo Disk Alert" $ALERT_EMAIL
fi

# Cleanup old logs
docker system prune -f
find logs/ -name "*.log" -mtime +7 -delete
EOF

    chmod +x health_check.sh
    
    # Add to crontab (optional)
    log "Health check script created. Add to crontab with:"
    log "*/5 * * * * /path/to/viveo/health_check.sh"
}

# Backup function
setup_backup() {
    log "Setting up backup script..."
    
    cat > backup.sh << 'EOF'
#!/bin/bash
# Backup script for Viveo

BACKUP_DIR="/backup/viveo"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Load environment variables
source .env

# Backup database
docker exec viveo-mysql mysqldump -u root -p$MYSQL_ROOT_PASSWORD viveo_db > $BACKUP_DIR/db_backup_$DATE.sql

# Backup data directory
tar -czf $BACKUP_DIR/data_backup_$DATE.tar.gz data/

# Backup environment
cp .env $BACKUP_DIR/env_backup_$DATE

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "*backup*" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

    chmod +x backup.sh
    
    log "Backup script created. Run with: ./backup.sh"
    log "Add to crontab for automated backups:"
    log "0 2 * * * /path/to/viveo/backup.sh"
}

# SSL setup (optional)
setup_ssl() {
    if [[ "$1" == "--ssl" ]]; then
        log "Setting up SSL certificates..."
        
        # Create self-signed certificate for testing
        mkdir -p nginx/ssl
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/key.pem \
            -out nginx/ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=localhost"
        
        log "Self-signed SSL certificate created."
        log "For production, replace with proper SSL certificates."
        
        # Uncomment HTTPS server block in nginx.conf
        sed -i 's/# server {/server {/g' nginx/nginx.conf
        sed -i 's/#     /    /g' nginx/nginx.conf
        
        # Restart nginx
        docker-compose restart nginx
    fi
}

# Update function
update_application() {
    log "Updating Viveo application..."
    
    # Pull latest changes (if using git)
    if [[ -d .git ]]; then
        git pull origin main
    fi
    
    # Rebuild and restart services
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    
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
    find logs/ -name "*.log" -mtime +30 -delete
    
    # Remove old data backups from data directory (keep last 30 days)
    find data/ -name "*.backup" -mtime +30 -delete
    
    log "Cleanup completed."
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
    
    if [[ "$1" == "--ssl" ]]; then
        setup_ssl --ssl
    fi
    
    log "Deployment completed successfully!"
    log ""
    log "Access your application at:"
    log "  Frontend: http://localhost"
    log "  API: http://localhost/api"
    log ""
    log "Useful commands:"
    log "  View logs: docker-compose logs -f [service]"
    log "  Restart service: docker-compose restart [service]"
    log "  Stop all: docker-compose down"
    log "  Update app: ./deploy.sh --update"
    log "  Backup data: ./backup.sh"
    log ""
    log "Next steps:"
    log "1. Update your domain in nginx configuration"
    log "2. Set up proper SSL certificates for production"
    log "3. Configure email alerts in health_check.sh"
    log "4. Set up automated backups in crontab"
}

# Handle command line arguments
case "$1" in
    --update)
        update_application
        ;;
    --cleanup)
        cleanup_old_data
        ;;
    --ssl)
        main --ssl
        ;;
    --health)
        check_services
        ;;
    --backup)
        setup_backup
        ./backup.sh
        ;;
    *)
        main "$@"
        ;;
esac