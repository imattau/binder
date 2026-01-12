#!/bin/bash
set -e

# Binder - Update Script
# Pulls latest code and restarts containers

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Binder Update Started ===${NC}"

# 0. Preserve Configuration
# We check if Caddyfile is dirty (modified locally)
if ! git diff --quiet deploy/Caddyfile; then
    echo -e "${YELLOW}Local configuration detected. Preserving settings...${NC}"
    
    # Extract Domain (first non-whitespace string of first line)
    # This handles both "example.com {" and "http://1.2.3.4 {"
    CURRENT_DOMAIN=$(head -n 1 deploy/Caddyfile | awk '{print $1}')
    
    # Extract Email (second string of 'tls' directive)
    CURRENT_EMAIL=$(grep "tls " deploy/Caddyfile | awk '{print $2}')
    
    echo "  - Domain: $CURRENT_DOMAIN"
    echo "  - Email:  $CURRENT_EMAIL"
    
    # Reset file to match git (discarding local changes temporarily)
    # This ensures git pull doesn't fail due to conflicts
    git checkout deploy/Caddyfile
    
    NEEDS_CONFIG=true
else
    NEEDS_CONFIG=false
fi

# 1. Pull latest changes
echo -e "${YELLOW}Pulling latest changes from git...${NC}"
git pull

# 2. Re-apply Configuration
if [ "$NEEDS_CONFIG" = true ]; then
    echo -e "${YELLOW}Re-applying configuration to new version...${NC}"
    
    # Apply Domain
    if [ -n "$CURRENT_DOMAIN" ]; then
        sed -i "s|binder.example.com|$CURRENT_DOMAIN|g" deploy/Caddyfile
    fi
    
    # Apply Email
    if [ -n "$CURRENT_EMAIL" ]; then
        sed -i "s|admin@binder.example.com|$CURRENT_EMAIL|g" deploy/Caddyfile
    fi
fi

# 3. Rebuild and Restart
echo -e "${YELLOW}Rebuilding and restarting containers...${NC}"

# Try new docker compose plugin first, fallback to legacy
if sudo docker compose version &>/dev/null; then
    sudo docker compose up -d --build --remove-orphans
elif command -v docker-compose &>/dev/null; then
    sudo docker-compose up -d --build --remove-orphans
else
    echo -e "${RED}Error: Neither 'docker compose' nor 'docker-compose' found.${NC}"
    exit 1
fi

echo -e "${GREEN}=== Update Complete! ===${NC}"
echo -e "Binder is running the latest version."
