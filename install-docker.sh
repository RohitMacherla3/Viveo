#!/bin/bash

# Docker Installation Script for Proxmox/Ubuntu/Debian

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
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

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    
    case $OS in
        *Ubuntu*|*Debian*)
            apt-get update
            apt-get upgrade -y
            ;;
        *CentOS*|*Red\ Hat*)
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
    
    # Remove old versions
    case $OS in
        *Ubuntu*|*Debian*)
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
            apt-get install -y docker-ce docker-ce-cli containerd.io
            ;;
            
        *CentOS*|*Red\ Hat*)
            yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine
            
            # Install dependencies
            yum install -y yum-utils
            
            # Add Docker repository
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            
            # Install Docker Engine
            yum install -y docker-ce docker-ce-cli containerd.io
            ;;
    esac
    
    log "Docker installation completed"
}

# Install Docker Compose
install_docker_compose() {
    log "Installing Docker Compose..."
    
    # Get latest version
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)
    
    # Download and install
    curl -L "https://github.com/docker/compose/releases/download/$DOCKER_COMPOSE_VERSION/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # Make executable
    chmod +x /usr/local/bin/docker-compose
    
    # Create symlink
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
    
    # Configure Docker daemon
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json << EOF
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2"
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
                jq \
                net-tools \
                ufw
            ;;
        *CentOS*|*Red\ Hat*)
            yum install -y \
                curl \
                wget \
                git \
                unzip \
                htop \
                nano \
                jq \
                net-tools \
                firewalld
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
            
            # Allow HTTP and HTTPS
            ufw allow 80/tcp
            ufw allow 443/tcp
            
            # Enable UFW
            ufw --force enable
            ;;
            
        *CentOS*|*Red\ Hat*)
            # Configure firewalld
            systemctl start firewalld
            systemctl enable firewalld
            
            # Allow HTTP and HTTPS
            firewall-cmd --permanent --add-service=http
            firewall-cmd --permanent --add-service=https
            firewall-cmd --reload
            ;;
    esac
    
    log "Firewall configuration completed"
}

# Verify installation
verify_installation() {
    log "Verifying installation..."
    
    # Test Docker
    if docker --version; then
        log "✓ Docker is installed and working"
    else
        error "✗ Docker installation failed"
        exit 1
    fi
    
    # Test Docker Compose
    if docker-compose --version; then
        log "✓ Docker Compose is installed and working"
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
        *CentOS*|*Red\ Hat*)
            yum autoremove -y
            yum clean all
            ;;
    esac
    
    log "Cleanup completed"
}

# Main installation function
main() {
    log "Starting Docker installation for Proxmox server..."
    
    check_root
    detect_os
    update_system
    install_docker
    install_docker_compose
    configure_docker
    install_tools
    setup_firewall
    verify_installation
    cleanup
    
    log "Docker installation completed successfully!"
    log ""
    log "Next steps:"
    log "1. Logout and login again to use Docker without sudo (if not root)"
    log "2. Test Docker: docker run hello-world"
    log "3. Test Docker Compose: docker-compose --version"
    log "4. Deploy Viveo: ./deploy.sh"
    log ""
    log "Useful commands:"
    log "  docker ps                    # List running containers"
    log "  docker-compose ps            # List services"
    log "  docker logs <container>      # View container logs"
    log "  docker system prune          # Clean up unused resources"
    
    if [[ $SUDO_USER ]]; then
        warn "You may need to logout and login again for group changes to take effect"
    fi
}

# Run main function
main "$@"