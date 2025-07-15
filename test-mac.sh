#!/bin/bash

# Mac Testing Script for Viveo Docker Setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}"
}

# Check if Docker is running
check_docker() {
    log "Checking Docker..."
    
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    
    # Check for docker-compose (v1) or docker compose (v2)
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        log "✓ Docker Compose v1 found"
    elif docker compose version > /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
        log "✓ Docker Compose v2 found"
    else
        error "Docker Compose is not available. Please install Docker Desktop with Compose."
        error "Visit: https://docs.docker.com/desktop/install/mac-install/"
        exit 1
    fi
    
    log "✓ Docker is running"
}

# Setup environment
setup_environment() {
    log "Setting up Mac development environment..."
    
    # Copy Mac environment file
    if [[ ! -f .env ]]; then
        cp .env.mac .env
        log "Created .env file from .env.mac template"
        
        warn "Please edit .env file and add your CLAUDE_API_KEY"
        warn "You can continue testing without it, but AI features won't work"
    fi
    
    # Create necessary directories
    mkdir -p data/{users,vectors} mysql/init frontend
    
    # Ensure frontend files exist
    if [[ ! -f frontend/index.html ]]; then
        warn "Frontend files not found in frontend/ directory"
        warn "Please copy your HTML, CSS, JS files to frontend/ directory"
    fi
    
    log "✓ Environment setup complete"
}

# Build and start services
start_services() {
    log "Building and starting services for Mac..."
    
    # Use Mac-specific compose file
    export COMPOSE_FILE=docker-compose.mac.yml
    
    # Build images
    log "Building backend image..."
    $COMPOSE_CMD -f docker-compose.mac.yml build backend
    
    log "Building frontend image..."
    $COMPOSE_CMD -f docker-compose.mac.yml build frontend
    
    # Start services
    log "Starting services..."
    $COMPOSE_CMD -f docker-compose.mac.yml up -d
    
    log "✓ Services started"
}

# Check service health
check_services() {
    log "Checking service health..."
    
    # Wait for services to start
    log "Waiting for services to initialize..."
    sleep 15
    
    # Check MySQL
    if $COMPOSE_CMD -f docker-compose.mac.yml ps mysql | grep -q "Up"; then
        log "✓ MySQL is running"
    else
        error "✗ MySQL is not running"
        $COMPOSE_CMD -f docker-compose.mac.yml logs mysql
    fi
    
    # Check Backend
    if $COMPOSE_CMD -f docker-compose.mac.yml ps backend | grep -q "Up"; then
        log "✓ Backend is running"
        
        # Test API endpoint
        sleep 5
        if curl -f http://localhost:8001/health > /dev/null 2>&1; then
            log "✓ Backend API is responding"
        else
            warn "✗ Backend API not responding yet (may still be starting)"
        fi
    else
        error "✗ Backend is not running"
        $COMPOSE_CMD -f docker-compose.mac.yml logs backend
    fi
    
    # Check Frontend
    if $COMPOSE_CMD -f docker-compose.mac.yml ps frontend | grep -q "Up"; then
        log "✓ Frontend is running"
        
        # Test frontend
        if curl -f http://localhost:3001 > /dev/null 2>&1; then
            log "✓ Frontend is accessible"
        else
            warn "✗ Frontend not accessible yet"
        fi
    else
        error "✗ Frontend is not running"
        $COMPOSE_CMD -f docker-compose.mac.yml logs frontend
    fi
}

# Show access information
show_access_info() {
    log "Mac Development Setup Complete!"
    echo ""
    echo "🌐 Access your application:"
    echo "   Frontend: http://localhost:3001"
    echo "   Backend API: http://localhost:8001"
    echo "   API Docs: http://localhost:8001/docs"
    echo "   Health Check: http://localhost:8001/health"
    echo ""
    echo "🗄️  Database:"
    echo "   Host: localhost"
    echo "   Port: 3307"
    echo "   Database: viveo_db"
    echo "   Username: viveo_user"
    echo "   Password: viveo_pass"
    echo ""
    echo "🔧 Useful commands:"
    echo "   View logs: docker-compose -f docker-compose.mac.yml logs -f [service]"
    echo "   Stop services: docker-compose -f docker-compose.mac.yml down"
    echo "   Restart service: docker-compose -f docker-compose.mac.yml restart [service]"
    echo "   Shell into backend: docker exec -it viveo-backend-mac bash"
    echo "   MySQL shell: docker exec -it viveo-mysql-mac mysql -u viveo_user -p viveo_db"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Test the frontend at http://localhost:3001"
    echo "   2. Test API endpoints at http://localhost:8001/docs"
    echo "   3. Add your CLAUDE_API_KEY to .env file for AI features"
    echo "   4. When ready, deploy to Proxmox with ./deploy.sh"
}

# Clean up function
cleanup() {
    log "Cleaning up Mac development environment..."
    $COMPOSE_CMD -f docker-compose.mac.yml down
    docker volume rm viveo_mysql_data_mac 2>/dev/null || true
    log "✓ Cleanup complete"
}

# Main function
main() {
    case "$1" in
        start)
            check_docker
            setup_environment
            start_services
            check_services
            show_access_info
            ;;
        stop)
            log "Stopping Mac development environment..."
            $COMPOSE_CMD -f docker-compose.mac.yml down
            log "✓ Services stopped"
            ;;
        restart)
            log "Restarting Mac development environment..."
            $COMPOSE_CMD -f docker-compose.mac.yml restart
            check_services
            ;;
        logs)
            $COMPOSE_CMD -f docker-compose.mac.yml logs -f ${2:-}
            ;;
        cleanup)
            cleanup
            ;;
        status)
            $COMPOSE_CMD -f docker-compose.mac.yml ps
            ;;
        shell)
            if [[ "$2" == "backend" ]]; then
                docker exec -it viveo-backend-mac bash
            elif [[ "$2" == "mysql" ]]; then
                docker exec -it viveo-mysql-mac mysql -u viveo_user -p viveo_db
            else
                echo "Usage: $0 shell [backend|mysql]"
            fi
            ;;
        *)
            echo "Viveo Mac Development Testing"
            echo ""
            echo "Usage: $0 {start|stop|restart|logs|cleanup|status|shell}"
            echo ""
            echo "Commands:"
            echo "  start     - Start all services for Mac development"
            echo "  stop      - Stop all services"
            echo "  restart   - Restart all services"
            echo "  logs      - Show logs (optionally specify service)"
            echo "  cleanup   - Stop and remove all data"
            echo "  status    - Show service status"
            echo "  shell     - Access shell (backend|mysql)"
            echo ""
            echo "Examples:"
            echo "  $0 start"
            echo "  $0 logs backend"
            echo "  $0 shell backend"
            ;;
    esac
}

# Run main function
main "$@"