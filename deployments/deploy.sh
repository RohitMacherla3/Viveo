#!/bin/bash

# Viveo Unified Deployment Script
# Located in deployments/ folder at same level as app/
# Supports both Mac development and Proxmox server production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
MODE="dev"  # dev or prod
UI_PATH="/viveo"
DOMAIN="localhost"
SSL_ENABLED=false
CLAUDE_API_KEY=""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export COMPOSE_PROJECT_NAME="viveo"

# Verify we're in the right location
if [[ ! -d "$PROJECT_ROOT/app" ]] || [[ ! -d "$SCRIPT_DIR" ]]; then
    error "Script must be run from the deployments/ directory"
    error "Current structure should be:"
    error "  project-root/"
    error "  ├── app/"
    error "  ├── deployments/  <- you are here"
    error "  ├── frontend/"
    error "  └── ..."
    exit 1
fi

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Help function
show_help() {
    cat << EOF
Viveo Deployment Script

Usage: $0 [OPTIONS] [COMMAND]

OPTIONS:
    -m, --mode MODE         Deployment mode: dev, prod (default: dev)
    -p, --path PATH         UI path (default: /viveo)
    -d, --domain DOMAIN     Domain name (default: localhost)
    -s, --ssl               Enable SSL/HTTPS (prod mode only)
    -h, --help              Show this help

COMMANDS:
    start                   Deploy the application (default)
    stop                    Stop all services
    restart                 Restart all services
    logs [service]          Show logs for service
    status                  Show service status
    update                  Update and restart services
    cleanup                 Clean up old data and images
    backup                  Create backup

EXAMPLES:
    $0 --mode dev                              # Explicit dev mode
    $0 --mode prod --domain myapp.com --ssl   # Production with SSL

EOF
}

# Set configuration based on mode
set_config() {
    case $MODE in
        "dev")
            COMPOSE_FILE="$SCRIPT_DIR/docker-compose.dev.yml"
            CONTAINER_SUFFIX="-dev"
            FRONTEND_PORT="3001"
            BACKEND_PORT="8001"
            MYSQL_PORT="3307"
            NGINX_HTTP_PORT="8080"
            NGINX_HTTPS_PORT="8443"
            DEBUG_MODE="true"
            ENV_FILE="$PROJECT_ROOT/app/.env"
            DOCKER_TARGET="development"
            log "🍎 Mac Development Mode"
            ;;
        "prod")
            COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
            CONTAINER_SUFFIX=""
            FRONTEND_PORT="3000"
            BACKEND_PORT="8000"
            MYSQL_PORT="3306"
            NGINX_HTTP_PORT="80"
            NGINX_HTTPS_PORT="443"
            DEBUG_MODE="false"
            ENV_FILE="$PROJECT_ROOT/app/.env"
            DOCKER_TARGET="production"
            log "🚀 Production Server Mode"
            ;;
        *)
            error "Invalid mode: $MODE. Use 'dev' or 'prod'"
            exit 1
            ;;
    esac
    
    log "Using compose file: $COMPOSE_FILE"
    log "UI will be available at: http://${DOMAIN}:${NGINX_HTTP_PORT}${UI_PATH}/"
}

# Generate docker-compose file
generate_compose_file() {
    log "Generating $COMPOSE_FILE..."
    
    cat > $COMPOSE_FILE << EOF
version: '3.8'

services:
  # MySQL Database
  mysql:
    image: mysql:8.0
    container_name: viveo-mysql${CONTAINER_SUFFIX}
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD:-viveo_root_password}
      MYSQL_DATABASE: \${MYSQL_DATABASE:-viveo_db}
      MYSQL_USER: \${MYSQL_USER:-viveo_user}
      MYSQL_PASSWORD: \${MYSQL_PASSWORD:-viveo_password}
    ports:
      - "${MYSQL_PORT}:3306"
    volumes:
      - mysql_data${CONTAINER_SUFFIX}:/var/lib/mysql
      - ../mysql/init:/docker-entrypoint-initdb.d
    networks:
      - viveo-network${CONTAINER_SUFFIX}
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 20s
      retries: 10

  # Backend API
  backend:
    build:
      context: ..
      dockerfile: deployments/Dockerfile.backend
      target: ${MODE}elopment
    container_name: viveo-backend${CONTAINER_SUFFIX}
    restart: unless-stopped
    env_file:
      - ${ENV_FILE}
    environment:
      - DATABASE_URL=mysql+pymysql://\${MYSQL_USER:-viveo_user}:\${MYSQL_PASSWORD:-viveo_password}@mysql:3306/\${MYSQL_DATABASE:-viveo_db}
      - PYTHONPATH=/app
      - MODE=${MODE}
    ports:
      - "${BACKEND_PORT}:8000"
    volumes:
      - ../data:/app/data
      - backend_logs${CONTAINER_SUFFIX}:/app/logs
EOF

    # Add volume mounts for dev mode only
    if [[ "$MODE" == "dev" ]]; then
        cat >> $COMPOSE_FILE << EOF
      - ../app:/app/app:ro  # Mount source for hot reload
EOF
    fi

    cat >> $COMPOSE_FILE << EOF
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - viveo-network${CONTAINER_SUFFIX}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend
  frontend:
    build:
      context: ../frontend
      dockerfile: ../deployments/Dockerfile.frontend
      target: ${DOCKER_TARGET}
      args:
        - API_BASE_URL=${UI_PATH}/api
    container_name: viveo-frontend${CONTAINER_SUFFIX}
    restart: unless-stopped
    environment:
      - MODE=${MODE}
      - API_BASE_URL=${UI_PATH}/api
    ports:
      - "${FRONTEND_PORT}:3000"
EOF

    # Add volume mounts for dev mode only
    if [[ "$MODE" == "dev" ]]; then
        cat >> $COMPOSE_FILE << EOF
    volumes:
      - ../frontend:/app:ro  # Mount source for development
EOF
    fi

    cat >> $COMPOSE_FILE << EOF
    depends_on:
      - backend
    networks:
      - viveo-network${CONTAINER_SUFFIX}

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: viveo-nginx${CONTAINER_SUFFIX}
    restart: unless-stopped
    ports:
      - "${NGINX_HTTP_PORT}:80"
EOF

    if [[ "$SSL_ENABLED" == true ]]; then
        cat >> $COMPOSE_FILE << EOF
      - "${NGINX_HTTPS_PORT}:443"
EOF
    fi

    cat >> $COMPOSE_FILE << EOF
    volumes:
      - ./nginx/nginx.${MODE}.conf:/etc/nginx/nginx.conf
EOF

    if [[ "$SSL_ENABLED" == true ]]; then
        cat >> $COMPOSE_FILE << EOF
      - ./nginx/ssl:/etc/nginx/ssl
EOF
    fi

    cat >> $COMPOSE_FILE << EOF
    depends_on:
      - frontend
      - backend
    networks:
      - viveo-network${CONTAINER_SUFFIX}

volumes:
  mysql_data${CONTAINER_SUFFIX}:
  backend_logs${CONTAINER_SUFFIX}:

networks:
  viveo-network${CONTAINER_SUFFIX}:
    driver: bridge
EOF
}

# Generate nginx configuration
generate_nginx_config() {
    log "Generating nginx configuration for $MODE mode..."
    
    mkdir -p "$SCRIPT_DIR/nginx"
    
    cat > "$SCRIPT_DIR/nginx/nginx.${MODE}.conf" << EOF
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Logging
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;

    # Upstream servers
    upstream backend {
        server viveo-backend${CONTAINER_SUFFIX}:8000;
    }

    upstream frontend {
        server viveo-frontend${CONTAINER_SUFFIX}:3000;
    }

    # Main server block
    server {
        listen 80;
        server_name ${DOMAIN};
        client_max_body_size 10M;

        # Root redirect to UI path
        location = / {
            return 301 ${UI_PATH}/;
        }

        # Viveo UI routes
        location ${UI_PATH}/ {
            rewrite ^${UI_PATH}/(.*) /\$1 break;
            
            proxy_pass http://frontend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # API routes
        location ${UI_PATH}/api/ {
            rewrite ^${UI_PATH}/api/(.*) /\$1 break;
            
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            limit_req zone=api burst=20 nodelay;
        }

        # Authentication endpoints
        location ~ ^${UI_PATH}/api/(token|signup|login) {
            rewrite ^${UI_PATH}/api/(.*) /\$1 break;
            
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            limit_req zone=login burst=5 nodelay;
        }

        # Health check endpoint
        location ${UI_PATH}/health {
            rewrite ^${UI_PATH}/health /health break;
            proxy_pass http://backend;
            access_log off;
        }
    }
EOF

    if [[ "$SSL_ENABLED" == true ]]; then
        cat >> "$SCRIPT_DIR/nginx/nginx.${MODE}.conf" << EOF

    # HTTPS server block
    server {
        listen 443 ssl http2;
        server_name ${DOMAIN};

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:50m;
        ssl_session_tickets off;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        add_header Strict-Transport-Security "max-age=63072000" always;

        # Same location blocks as HTTP
        location = / {
            return 301 ${UI_PATH}/;
        }

        location ${UI_PATH}/ {
            rewrite ^${UI_PATH}/(.*) /\$1 break;
            proxy_pass http://frontend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        location ${UI_PATH}/api/ {
            rewrite ^${UI_PATH}/api/(.*) /\$1 break;
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            limit_req zone=api burst=20 nodelay;
        }

        location ~ ^${UI_PATH}/api/(token|signup|login) {
            rewrite ^${UI_PATH}/api/(.*) /\$1 break;
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            limit_req zone=login burst=5 nodelay;
        }

        location ${UI_PATH}/health {
            rewrite ^${UI_PATH}/health /health break;
            proxy_pass http://backend;
            access_log off;
        }
    }
EOF
    fi

    cat >> "$SCRIPT_DIR/nginx/nginx.${MODE}.conf" << EOF
}
EOF
}

# Check and validate environment files
check_env_files() {
    log "Checking environment configuration..."
    
    # Check if app/.env exists
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file not found: $ENV_FILE"
        log "Please create $ENV_FILE with the following variables:"
        log "  SECRET_KEY=your-secret-key"
        log "  ALGORITHM=HS256"
        log "  ACCESS_TOKEN_EXPIRE_MINUTES=30"
        log "  CLAUDE_API_KEY=your-claude-key"
        log "  OPEN_AI_API_KEY=your-openai-key"
        log "  MYSQL_ROOT_PASSWORD=your-mysql-root-password"
        log "  MYSQL_DATABASE=viveo_db"
        log "  MYSQL_USER=viveo_user"
        log "  MYSQL_PASSWORD=your-mysql-password"
        exit 1
    fi
    
    log "✓ Found environment file: $ENV_FILE"
    
    # Source the env file to check for required variables
    set -a  # automatically export all variables
    source "$ENV_FILE"
    set +a
    
    # Check for required variables
    local missing_vars=()
    
    [[ -z "$SECRET_KEY" ]] && missing_vars+=("SECRET_KEY")
    [[ -z "$CLAUDE_API_KEY" ]] && missing_vars+=("CLAUDE_API_KEY")
    [[ -z "$OPEN_AI_API_KEY" ]] && missing_vars+=("OPEN_AI_API_KEY")
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        warn "Missing required environment variables: ${missing_vars[*]}"
        warn "Please add them to $ENV_FILE"
    else
        log "✓ All required environment variables are present"
    fi
    
    # Override with command line arguments if provided
    if [[ -n "$CLAUDE_API_KEY" ]]; then
        log "Using Claude API key from command line"
    fi
    
    if [[ -n "$OPEN_AI_API_KEY" ]]; then
        log "Using OpenAI API key from command line"
    fi
}

# Setup directories and permissions
setup_environment() {
    log "Setting up environment..."
    
    # Create necessary directories relative to project root
    mkdir -p "$PROJECT_ROOT/data/{users,vectors}" "$PROJECT_ROOT/logs" "$SCRIPT_DIR/nginx/ssl" "$PROJECT_ROOT/mysql/init" "$PROJECT_ROOT/frontend"
    
    # Set proper permissions
    chmod 755 "$PROJECT_ROOT/data" "$PROJECT_ROOT/logs" 2>/dev/null || true
    
    # Generate SSL certificates for development if needed
    if [[ "$SSL_ENABLED" == true ]] && [[ ! -f "$SCRIPT_DIR/nginx/ssl/cert.pem" ]]; then
        log "Generating self-signed SSL certificates..."
        mkdir -p "$SCRIPT_DIR/nginx/ssl"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$SCRIPT_DIR/nginx/ssl/key.pem" \
            -out "$SCRIPT_DIR/nginx/ssl/cert.pem" \
            -subj "/C=US/ST=State/L=City/O=Viveo/CN=${DOMAIN}" 2>/dev/null || true
    fi
}

# Deploy services
deploy_services() {
    log "Deploying services in $MODE mode..."
    
    # Change to deployments directory for docker-compose
    cd "$SCRIPT_DIR"
    
    # Stop existing services
    docker-compose -f "$COMPOSE_FILE" down 2>/dev/null || true
    
    # Build and start services
    docker-compose -f "$COMPOSE_FILE" build
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services
    log "Waiting for services to be ready..."
    sleep 30
    
    check_services
}

# Check service health
check_services() {
    log "Checking service health..."
    
    local services_healthy=true
    
    # Check containers
    containers=$(docker-compose -f "$COMPOSE_FILE" ps --services)
    for service in $containers; do
        if docker-compose -f "$COMPOSE_FILE" ps $service | grep -q "Up"; then
            log "✓ $service is running"
        else
            error "✗ $service is not running"
            services_healthy=false
        fi
    done
    
    # Test endpoints
    local base_url="http://${DOMAIN}:${NGINX_HTTP_PORT}"
    
    # Wait a bit more and test health endpoint
    sleep 10
    if curl -f -s "${base_url}${UI_PATH}/health" &> /dev/null; then
        log "✓ Health check passed"
    else
        warn "✗ Health check failed - services may still be starting"
        services_healthy=false
    fi
    
    if [[ "$services_healthy" == true ]]; then
        log "🎉 Deployment successful!"
        log ""
        log "🌐 Access your application:"
        log "  UI: ${base_url}${UI_PATH}/"
        log "  API: ${base_url}${UI_PATH}/api/"
        log "  Health: ${base_url}${UI_PATH}/health"
        log ""
        log "📊 Service Status:"
        log "  Mode: $MODE"
        log "  Domain: $DOMAIN"
        log "  UI Path: $UI_PATH"
        if [[ "$SSL_ENABLED" == true ]]; then
            log "  HTTPS: https://${DOMAIN}:${NGINX_HTTPS_PORT}${UI_PATH}/"
        fi
    else
        error "Some services are not healthy. Check logs with: $0 logs"
    fi
}

# Other functions
show_logs() {
    local service=${1:-}
    cd "$SCRIPT_DIR"
    if [[ -n "$service" ]]; then
        docker-compose -f "$COMPOSE_FILE" logs -f $service
    else
        docker-compose -f "$COMPOSE_FILE" logs -f
    fi
}

stop_services() {
    log "Stopping services..."
    cd "$SCRIPT_DIR"
    docker-compose -f "$COMPOSE_FILE" down
}

restart_services() {
    log "Restarting services..."
    cd "$SCRIPT_DIR"
    docker-compose -f "$COMPOSE_FILE" restart
}

show_status() {
    cd "$SCRIPT_DIR"
    docker-compose -f "$COMPOSE_FILE" ps
}

update_services() {
    log "Updating services..."
    cd "$SCRIPT_DIR"
    docker-compose -f "$COMPOSE_FILE" down
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    docker-compose -f "$COMPOSE_FILE" up -d
    sleep 30
    check_services
}

cleanup_services() {
    log "Cleaning up..."
    cd "$SCRIPT_DIR"
    docker-compose -f "$COMPOSE_FILE" down -v
    docker system prune -f
    docker volume prune -f
}

create_backup() {
    log "Creating backup..."
    
    BACKUP_DIR="$PROJECT_ROOT/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    cd "$SCRIPT_DIR"
    
    # Backup database
    if docker-compose -f "$COMPOSE_FILE" ps mysql | grep -q "Up"; then
        log "Backing up database..."
        docker-compose -f "$COMPOSE_FILE" exec -T mysql mysqladmin ping -h localhost > /dev/null 2>&1
        docker-compose -f "$COMPOSE_FILE" exec -T mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD:-viveo_root_password} viveo_db > "$BACKUP_DIR/database.sql" 2>/dev/null || warn "Database backup failed"
    fi
    
    # Backup data directory
    if [[ -d "$PROJECT_ROOT/data" ]]; then
        tar -czf "$BACKUP_DIR/data.tar.gz" -C "$PROJECT_ROOT" data/
    fi
    
    # Backup environment files
    cp "$SCRIPT_DIR"/.env.* "$BACKUP_DIR/" 2>/dev/null || true
    
    log "Backup created at: $BACKUP_DIR"
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -m|--mode)
                MODE="$2"
                shift 2
                ;;
            -p|--path)
                UI_PATH="$2"
                shift 2
                ;;
            -d|--domain)
                DOMAIN="$2"
                shift 2
                ;;
            -k|--claude-key)
                CLAUDE_API_KEY="$2"
                shift 2
                ;;
            --openai-key)
                OPEN_AI_API_KEY="$2"
                shift 2
                ;;
            -s|--ssl)
                SSL_ENABLED=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            start|"")
                COMMAND="start"
                shift
                ;;
            stop)
                COMMAND="stop"
                shift
                ;;
            restart)
                COMMAND="restart"
                shift
                ;;
            logs)
                COMMAND="logs"
                LOG_SERVICE="$2"
                shift 2
                ;;
            status)
                COMMAND="status"
                shift
                ;;
            update)
                COMMAND="update"
                shift
                ;;
            cleanup)
                COMMAND="cleanup"
                shift
                ;;
            backup)
                COMMAND="backup"
                shift
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Main function
main() {
    parse_args "$@"
    
    set_config
    
    case ${COMMAND:-start} in
        "start")
            setup_environment
            check_env_files
            generate_compose_file
            generate_nginx_config
            deploy_services
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services
            ;;
        "logs")
            show_logs "$LOG_SERVICE"
            ;;
        "status")
            show_status
            ;;
        "update")
            update_services
            ;;
        "cleanup")
            cleanup_services
            ;;
        "backup")
            create_backup
            ;;
        *)
            error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"