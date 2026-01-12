#!/bin/bash
set -e

# Binder - Docker Deployment Helper
# Usage: ./scripts/deploy-docker.sh [domain] [email]

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Binder Docker Deployment ===${NC}"

# Check for arguments or prompt
DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}Enter the domain name OR IP address for this instance (e.g. binder.com or 192.168.1.5):${NC}"
    read -r DOMAIN
fi

# Detect if input is an IP address (basic regex)
if [[ $DOMAIN =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    IS_IP=true
    echo -e "${YELLOW}IP address detected. Configuring for HTTP only (no automatic SSL).${NC}"
    # For IPs, we don't need an email for Let's Encrypt
    EMAIL="admin@localhost" 
else
    IS_IP=false
    if [ -z "$EMAIL" ]; then
        echo -e "${YELLOW}Enter the admin email for SSL certificates (e.g. admin@example.com):${NC}"
        read -r EMAIL
    fi
fi

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: Domain/IP is required.${NC}"
    exit 1
fi

echo -e "Target Address: ${GREEN}$DOMAIN${NC}"
if [ "$IS_IP" = false ]; then
    echo -e "Admin Email:    ${GREEN}$EMAIL${NC}"
fi
echo "-----------------------------------"

# 1. Install Docker if missing
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker not found. Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    echo -e "${GREEN}Docker installed successfully.${NC}"
else
    echo -e "${GREEN}Docker is already installed.${NC}"
fi

# Ensure Docker service is enabled and started
echo -e "${YELLOW}Ensuring Docker service is active...${NC}"
sudo systemctl enable docker
sudo systemctl start docker

# 2. Prepare Configuration
echo -e "${YELLOW}Configuring Caddyfile...${NC}"

# Create a backup of the original Caddyfile template
if [ ! -f deploy/Caddyfile.bak ]; then
    cp deploy/Caddyfile deploy/Caddyfile.bak
else
    # Restore from backup to ensure we don't double-replace on re-runs
    cp deploy/Caddyfile.bak deploy/Caddyfile
fi

# Replace placeholders
# We use | as delimiter to avoid issues with slashes in emails/domains if any (though unlikely)

if [ "$IS_IP" = true ]; then
    # Force HTTP for IP addresses
    sed -i "s|binder.example.com|http://$DOMAIN|g" deploy/Caddyfile
else
    # Standard Domain config
    sed -i "s|binder.example.com|$DOMAIN|g" deploy/Caddyfile
fi

sed -i "s|admin@binder.example.com|$EMAIL|g" deploy/Caddyfile

echo -e "${GREEN}Configuration updated.${NC}"

# 3. Launch
echo -e "${YELLOW}Building and starting containers...${NC}"

# Try new docker compose plugin first, fallback to legacy
if sudo docker compose version &>/dev/null; then
    sudo docker compose up -d --build --remove-orphans
elif command -v docker-compose &>/dev/null; then
    sudo docker-compose up -d --build --remove-orphans
else
    echo -e "${RED}Error: Neither 'docker compose' nor 'docker-compose' found.${NC}"
    exit 1
fi

echo -e "${GREEN}=== Deployment Complete! ===${NC}"

if [ "$IS_IP" = true ]; then
    echo -e "Your Binder instance should be reachable at: http://$DOMAIN"
else
    echo -e "Your Binder instance should be reachable at: https://$DOMAIN"
fi

echo -e "To view logs: docker compose logs -f"
