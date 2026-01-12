#!/bin/bash
set -e

# Binder - Bare Metal Updater
# Pulls latest code, rebuilds, and restarts the service.

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_DIR="/opt/binder"
USER="binder"

echo -e "${GREEN}=== Binder Bare Metal Updater ===${NC}"

# Check for root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root (use sudo).${NC}"
  exit 1
fi

echo -e "${YELLOW}Pulling latest changes from git...${NC}"
git pull

echo -e "${YELLOW}Syncing files to $APP_DIR...${NC}"
# Sync files but exclude big folders to keep it fast, we'll run npm install next
if command -v rsync &> /dev/null; then
    rsync -av --exclude '.git' --exclude 'node_modules' --exclude 'build' . $APP_DIR/
else
    cp -R . $APP_DIR/
fi
chown -R $USER:$USER $APP_DIR

echo -e "${YELLOW}Rebuilding application...${NC}"
cd $APP_DIR
# Run install and build as the service user
sudo -u $USER npm install
sudo -u $USER npm run build

echo -e "${YELLOW}Restarting service...${NC}"
systemctl restart binder

echo -e "${GREEN}=== Update Complete ===${NC}"
systemctl status binder --no-pager
