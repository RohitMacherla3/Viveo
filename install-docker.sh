#!/bin/bash

# Docker Installation Script for Proxmox/Ubuntu/Debian servers
# Run this on your Proxmox server before deploying Viveo

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        error "Cannot detect OS"
        exit 1
    fi
    
    log "Detected OS: $OS $VER"
}

# Update system packages
update_system() {
    log "Updating system packages..."
    
    case $OS in
        *Ubuntu*|*Debian*)
            apt-get update
            apt-get upgrade -y
            ;;
        *CentOS*|*Red\ Hat*|*Rocky*)
            yum update -y
            ;;
        *)
            warn "Unknown OS, attempting apt-get update..."
            apt-get update || yum update -y
            ;;
    esac
    
    log "System update completed"
}

# Install Docker
install_docker() {
    log "Installing Docker..."
    
    case $OS in
        *Ubuntu*|*Debian*)
            # Remove old versions
            apt-get remove -y docker docker-engine docker.io containerd runc || true
            
            # Install dependencies
            apt-get install -y \
                apt-transport-https \
                ca-certificates \
                curl \
                gnupg \
                lsb-release
            
            # Add Docker's official GPG key
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            
            # Add Docker repository
            echo \
                "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
                $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            # Install Docker Engine
            apt-get update
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
            
        *CentOS*|*Red\ Hat*|*Rocky*)
            # Remove old versions
            yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine
            
            # Install dependencies
            yum install -y yum-utils
            
            # Add Docker repository
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            
            # Install Docker Engine
            yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
    esac
    
    log "Docker installation completed"
}

# Install Docker Compose (standalone version)
install_docker_compose() {
    log "Installing Docker Compose standalone..."
    
    # Get latest version
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)
    
    # Download and install
    curl -L "https://github.com/docker/compose/releases/download/$DOCKER_COMPOSE_VERSION/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # Make executable
    chmod +x /usr/local/bin/docker-compose
    
    # Create symlink for compatibility
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    log "Docker Compose $DOCKER_COMPOSE_VERSION installed"
}

# Configure Docker
configure_docker() {
    log "Configuring Docker..."
    
    # Start and enable Docker service
    systemctl start docker
    systemctl enable docker
    
    # Create docker group and add current user (if not root)
    groupadd docker || true
    
    if [[ $SUDO_USER ]]; then
        usermod -aG docker $SUDO_USER
        log "Added $SUDO_USER to docker group"
    fi
    
    # Configure Docker daemon for production
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json << EOF
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2",
    "live-restore": true,
    "userland-proxy": false,
    "experimental": false
}
EOF
    
    # Restart Docker to apply configuration
    systemctl restart docker
    
    log "Docker configuration completed"
}

# Install additional tools
install_tools() {
    log "Installing additional tools..."
    
    case $OS in
        *Ubuntu*|*Debian*)
            apt-get install -y \
                curl \
                wget \
                git \
                unzip \
                htop \
                nano \
                vim \
                jq \
                net-tools \
                ufw \
                fail2ban \
                openssl
            ;;
        *CentOS*|*Red\ Hat*|*Rocky*)
            yum install -y \
                curl \
                wget \
                git \
                unzip \
                htop \
                nano \
                vim \
                jq \
                net-tools \
                firewalld \
                fail2ban \
                openssl
            ;;
    esac
    
    log "Additional tools installed"
}

# Setup firewall
setup_firewall() {
    log "Setting up firewall..."
    
    case $OS in
        *Ubuntu*|*Debian*)
            # Configure UFW
            ufw --force reset
            ufw default deny incoming
            ufw default allow outgoing
            
            # Allow SSH
            ufw allow ssh
            ufw allow 22/tcp
            
            # Allow HTTP and HTTPS
            ufw allow 80/tcp
            ufw allow 443/tcp
            
            # Allow custom ports for development
            ufw allow 8080/tcp comment "Viveo Dev HTTP"
            ufw allow 8443/tcp comment "Viveo Dev HTTPS"
            
            # Enable UFW
            ufw --force enable
            
            log "UFW firewall configured"
            ;;
            
        *CentOS*|*Red\ Hat*|*Rocky*)
            # Configure firewalld
            systemctl start firewalld
            systemctl enable firewalld
            
            # Allow HTTP and HTTPS
            firewall-cmd --permanent --add-service=http
            firewall-cmd --permanent --add-service=https
            firewall-cmd --permanent --add-service=ssh
            
            # Allow custom ports for development
            firewall-cmd --permanent --add-port=8080/tcp
            firewall-cmd --permanent --add-port=8443/tcp
            
            firewall-cmd --reload
            
            log "firewalld configured"
            ;;
    esac
}

# Configure fail2ban for security
setup_fail2ban() {
    log "Setting up fail2ban..."
    
    # Basic fail2ban configuration
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
EOF
    
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    log "fail2ban configured"
}

# Verify installation
verify_installation() {
    log "Verifying installation..."
    
    # Test Docker
    if docker --version; then
        log "✓ Docker is installed: $(docker --version)"
    else
        error "✗ Docker installation failed"
        exit 1
    fi
    
    # Test Docker Compose
    if docker-compose --version; then
        log "✓ Docker Compose is installed: $(docker-compose --version)"
    else
        error "✗ Docker Compose installation failed"
        exit 1
    fi
    
    # Test Docker daemon
    if docker run --rm hello-world > /dev/null 2>&1; then
        log "✓ Docker daemon is running correctly"
    else
        error "✗ Docker daemon is not working properly"
        exit 1
    fi
    
    # Show system info
    log "System Information:"
    log "  OS: $OS $VER"
    log "  Docker: $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
    log "  Docker Compose: $(docker-compose --version | cut -d' ' -f4 | cut -d',' -f1)"
    log "  Memory: $(free -h | grep Mem | awk '{print $2}')"
    log "  Disk: $(df -h / | tail -1 | awk '{print $4}') available"
    
    log "Installation verification completed successfully"
}

# Cleanup
cleanup() {
    log "Cleaning up..."
    
    case $OS in
        *Ubuntu*|*Debian*)
            apt-get autoremove -y
            apt-get autoclean
            ;;
        *CentOS*|*Red\ Hat*|*Rocky*)
            yum autoremove -y
            yum clean all
            ;;
    esac
    
    log "Cleanup completed"
}

# Main installation function
main() {
    log "🚀 Starting Docker installation for Proxmox server..."
    log "This will install Docker, Docker Compose, and configure security"
    
    check_root
    detect_os
    update_system
    install_docker
    install_docker_compose
    configure_docker
    install_tools
    setup_firewall
    setup_fail2ban
    verify_installation
    cleanup
    
    log "🎉 Docker installation completed successfully!"
    log ""
    log "📋 Next steps:"
    log "1. Logout and login again (or run 'newgrp docker') to use Docker without sudo"
    log "2. Copy your Viveo application files to this server"
    log "3. Run: ./deploy.sh --mode prod --domain your-domain.com"
    log ""
    log "🔧 Useful commands:"
    log "  docker ps                    # List running containers"
    log "  docker-compose ps            # List services"
    log "  docker logs <container>      # View container logs"
    log "  docker system prune          # Clean up unused resources"
    log "  systemctl status docker      # Check Docker service status"
    log ""
    
    if [[ $SUDO_USER ]]; then
        warn "⚠️  You may need to logout and login again for group changes to take effect"
        log "Or run: newgrp docker"
    fi
    
    log "🔒 Security features enabled:"
    log "  - UFW/firewalld firewall configured"
    log "  - fail2ban intrusion prevention"
    log "  - Docker daemon security hardening"
}

# Run main function
main "$@"