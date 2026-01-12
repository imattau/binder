#!/bin/bash
set -e

# Binder - Docker Uninstaller
# Stops containers, removes images, volumes, and optionally uninstall Docker itself.

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${RED}=== Binder Docker Uninstaller ===${NC}"

if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root (use sudo).${NC}"
  exit 1
fi

echo -e "${YELLOW}Stopping and removing Binder containers...${NC}"
# Navigate to script directory's parent to find docker-compose.yml
cd "$(dirname "$0")/.."

if command -v docker-compose &>/dev/null; then
    docker-compose down -v --remove-orphans
elif docker compose version &>/dev/null; then
    docker compose down -v --remove-orphans
else
    echo "Docker compose not found, trying manual container removal..."
    docker rm -f binder_binder_1 binder_caddy_1 binder_sidecar_1 binder_tor_1 2>/dev/null || true
fi

echo -e "${YELLOW}Pruning unused Docker objects (images, networks)...${NC}"
docker system prune -af --volumes

read -p "Do you want to completely uninstall Docker engine? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Uninstalling Docker...${NC}"
    apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker.io
    rm -rf /var/lib/docker
    rm -rf /var/lib/containerd
    echo -e "${GREEN}Docker uninstalled.${NC}"
else
    echo -e "${GREEN}Docker engine kept installed.${NC}"
fi

echo -e "${GREEN}=== Clean up Complete ===${NC}"
