#!/bin/bash

# ===========================================
# BotBuilder Hetzner VPS Deployment Script
# ===========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_DIR="/opt/botbuilder"
BACKUP_DIR="/opt/botbuilder-backups"
REPO_URL="https://github.com/yourusername/botbuilder.git"
BRANCH="main"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}   BotBuilder Deployment Script${NC}"
echo -e "${BLUE}=========================================${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Check required commands
command -v docker >/dev/null 2>&1 || { print_error "Docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || command -v "docker compose" >/dev/null 2>&1 || { print_error "Docker Compose is required but not installed."; exit 1; }

# Function to install Docker (if needed)
install_docker() {
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
    rm get-docker.sh
    print_status "Docker installed successfully"
}

# Function to create backup
create_backup() {
    if [ -d "$DEPLOY_DIR" ]; then
        print_status "Creating backup..."
        mkdir -p "$BACKUP_DIR"
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C "$DEPLOY_DIR" . 2>/dev/null || true
        print_status "Backup created: backup_$TIMESTAMP.tar.gz"

        # Keep only last 5 backups
        cd "$BACKUP_DIR" && ls -t | tail -n +6 | xargs -r rm --
    fi
}

# Function to setup SSL with Let's Encrypt
setup_ssl() {
    DOMAIN=$1

    if [ -z "$DOMAIN" ]; then
        print_warning "No domain provided, skipping SSL setup"
        return
    fi

    print_status "Setting up SSL for $DOMAIN..."

    # Install certbot
    apt-get update
    apt-get install -y certbot

    # Create SSL directory
    mkdir -p "$DEPLOY_DIR/nginx/ssl"

    # Stop nginx temporarily
    docker-compose -f "$DEPLOY_DIR/docker-compose.yml" stop nginx 2>/dev/null || true

    # Get certificate
    certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN || {
        print_warning "Certbot failed, creating self-signed certificate..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$DEPLOY_DIR/nginx/ssl/privkey.pem" \
            -out "$DEPLOY_DIR/nginx/ssl/fullchain.pem" \
            -subj "/CN=$DOMAIN"
    }

    # Copy certificates
    if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$DEPLOY_DIR/nginx/ssl/"
        cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$DEPLOY_DIR/nginx/ssl/"
        print_status "SSL certificate installed successfully"

        # Setup auto-renewal
        echo "0 0,12 * * * root certbot renew --quiet && docker-compose -f $DEPLOY_DIR/docker-compose.yml restart nginx" > /etc/cron.d/certbot-renew
    fi
}

# Function to deploy
deploy() {
    print_status "Starting deployment..."

    # Create deploy directory
    mkdir -p "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"

    # Clone or pull repository
    if [ -d ".git" ]; then
        print_status "Pulling latest changes..."
        git fetch origin
        git reset --hard origin/$BRANCH
    else
        print_status "Cloning repository..."
        git clone -b $BRANCH $REPO_URL .
    fi

    # Check for .env file
    if [ ! -f ".env" ]; then
        if [ -f ".env.production.example" ]; then
            cp .env.production.example .env
            print_warning ".env file created from example. Please edit it with your values!"
            print_warning "Run: nano $DEPLOY_DIR/.env"
        else
            print_error ".env file not found! Please create it before deployment."
            exit 1
        fi
    fi

    # Create required directories
    mkdir -p nginx/ssl uploads

    # Build and start containers
    print_status "Building Docker images..."
    docker-compose build --no-cache

    print_status "Starting containers..."
    docker-compose up -d

    # Wait for services to be healthy
    print_status "Waiting for services to start..."
    sleep 10

    # Run database migrations
    print_status "Running database migrations..."
    docker-compose exec -T backend node runMigrations.js || print_warning "Migrations may have already been applied"

    # Check container status
    print_status "Checking container status..."
    docker-compose ps

    print_status "Deployment completed successfully!"
}

# Function to show logs
show_logs() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        docker-compose -f "$DEPLOY_DIR/docker-compose.yml" logs -f --tail=100
    else
        docker-compose -f "$DEPLOY_DIR/docker-compose.yml" logs -f --tail=100 $SERVICE
    fi
}

# Function to restart services
restart_services() {
    print_status "Restarting services..."
    cd "$DEPLOY_DIR"
    docker-compose restart
    print_status "Services restarted"
}

# Function to stop services
stop_services() {
    print_status "Stopping services..."
    cd "$DEPLOY_DIR"
    docker-compose down
    print_status "Services stopped"
}

# Function to show status
show_status() {
    cd "$DEPLOY_DIR"
    echo -e "\n${BLUE}Container Status:${NC}"
    docker-compose ps
    echo -e "\n${BLUE}Resource Usage:${NC}"
    docker stats --no-stream
}

# Function to clean up
cleanup() {
    print_status "Cleaning up unused Docker resources..."
    docker system prune -af
    docker volume prune -f
    print_status "Cleanup completed"
}

# Main menu
case "$1" in
    install)
        install_docker
        ;;
    deploy)
        create_backup
        deploy
        ;;
    ssl)
        setup_ssl $2
        ;;
    restart)
        restart_services
        ;;
    stop)
        stop_services
        ;;
    logs)
        show_logs $2
        ;;
    status)
        show_status
        ;;
    backup)
        create_backup
        ;;
    cleanup)
        cleanup
        ;;
    update)
        create_backup
        deploy
        ;;
    *)
        echo -e "${BLUE}BotBuilder Deployment Script${NC}"
        echo ""
        echo "Usage: $0 {command} [options]"
        echo ""
        echo "Commands:"
        echo "  install     - Install Docker on the server"
        echo "  deploy      - Deploy the application"
        echo "  update      - Update to latest version (with backup)"
        echo "  ssl DOMAIN  - Setup SSL certificate for domain"
        echo "  restart     - Restart all services"
        echo "  stop        - Stop all services"
        echo "  logs [svc]  - Show logs (optionally for specific service)"
        echo "  status      - Show container and resource status"
        echo "  backup      - Create a backup"
        echo "  cleanup     - Clean unused Docker resources"
        echo ""
        echo "Examples:"
        echo "  $0 deploy"
        echo "  $0 ssl yourdomain.com"
        echo "  $0 logs backend"
        ;;
esac
