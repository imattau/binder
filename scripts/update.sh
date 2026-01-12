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

# 1. Pull latest changes
echo -e "${YELLOW}Pulling latest changes from git...${NC}"
git pull

# 2. Rebuild and Restart
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
