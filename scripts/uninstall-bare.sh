#!/bin/bash
set -e

# Binder - Bare Metal Uninstaller
# Removes the binder service, user, and application files.

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_DIR="/opt/binder"
USER="binder"
SERVICE_FILE="/etc/systemd/system/binder.service"
CADDYFILE="/etc/caddy/Caddyfile"

echo -e "${RED}=== Binder Bare Metal Uninstaller ===${NC}"
echo -e "${YELLOW}This will remove the Binder application, service, and user.${NC}"

# Check for root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root (use sudo).${NC}"
  exit 1
fi

read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# 1. Stop and Remove Service
if systemctl list-units --full -all | grep -Fq "binder.service"; then
    echo -e "${YELLOW}Stopping and removing binder service...${NC}"
    systemctl stop binder
    systemctl disable binder
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload
    echo -e "${GREEN}Service removed.${NC}"
else
    echo "Binder service not found."
fi

# 2. Remove Application Directory
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}Removing application directory ($APP_DIR)...${NC}"
    rm -rf "$APP_DIR"
    echo -e "${GREEN}Directory removed.${NC}"
else
    echo "Application directory not found."
fi

# 3. Remove User
if id "$USER" &>/dev/null; then
    echo -e "${YELLOW}Removing system user ($USER)...${NC}"
    userdel "$USER"
    echo -e "${GREEN}User removed.${NC}"
else
    echo "User not found."
fi

# 4. Restore Caddy Configuration
if [ -f "${CADDYFILE}.bak" ]; then
    echo -e "${YELLOW}Found Caddyfile backup.${NC}"
    read -p "Do you want to restore the original Caddyfile? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mv "${CADDYFILE}.bak" "$CADDYFILE"
        systemctl restart caddy
        echo -e "${GREEN}Caddyfile restored and Caddy restarted.${NC}"
    else
        echo "Backup preserved at ${CADDYFILE}.bak"
    fi
else
    echo -e "${YELLOW}No Caddyfile backup found. You may need to edit $CADDYFILE manually to remove the Binder configuration.${NC}"
fi

echo -e "${GREEN}=== Uninstall Complete ===${NC}"
echo -e "Note: Node.js and global packages (like 'serve') were not removed."
