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
    echo -e "${YELLOW}Enter the domain name for this instance (e.g., binder.example.com):${NC}"
    read -r DOMAIN
fi

if [ -z "$EMAIL" ]; then
    echo -e "${YELLOW}Enter the admin email for SSL certificates (e.g., admin@example.com):${NC}"
    read -r EMAIL
fi

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo -e "${RED}Error: Domain and Email are required.${NC}"
    exit 1
fi

echo -e "Target Domain: ${GREEN}$DOMAIN${NC}"
echo -e "Admin Email:   ${GREEN}$EMAIL${NC}"
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
sed -i "s|binder.example.com|$DOMAIN|g" deploy/Caddyfile
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
echo -e "Your Binder instance should be reachable at: https://$DOMAIN"
echo -e "To view logs: docker compose logs -f"
