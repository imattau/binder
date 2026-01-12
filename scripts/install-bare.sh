#!/bin/bash
set -e

# Binder - Bare Metal Installer
# Installs Node.js, builds app, creates systemd service, and configures Caddy.

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_DIR="/opt/binder"
USER="binder"
PORT=4173

echo -e "${GREEN}=== Binder Bare Metal Installer ===${NC}"

# Check for root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root (use sudo).${NC}"
  exit 1
fi

# 1. Install Node.js 20
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs build-essential
else
    echo -e "${GREEN}Node.js is already installed.$(node -v)${NC}"
fi

# 2. Create User and Directory
if ! id "$USER" &>/dev/null; then
    echo -e "${YELLOW}Creating system user '$USER'...${NC}"
    useradd -r -s /bin/false $USER
fi

echo -e "${YELLOW}Setting up application directory at $APP_DIR...${NC}"
mkdir -p $APP_DIR
# Copy current directory contents to /opt/binder (excluding .git and node_modules via rsync if avail, else cp)
if command -v rsync &> /dev/null; then
    rsync -av --exclude '.git' --exclude 'node_modules' --exclude 'build' . $APP_DIR/
else
    cp -R . $APP_DIR/
fi
chown -R $USER:$USER $APP_DIR

# 3. Build Application
echo -e "${YELLOW}Building Binder...${NC}"
cd $APP_DIR
# Install serve globally for production serving
npm install -g serve
# Install deps and build as the binder user to ensure permissions
sudo -u $USER npm install
sudo -u $USER npm run build

# 4. Create Systemd Service
echo -e "${YELLOW}Creating systemd service...${NC}"
cat > /etc/systemd/system/binder.service <<EOF
[Unit]
Description=Binder Nostr App
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=$(which serve) -s build -l $PORT
Restart=always
RestartSec=3
Environment=NODE_ENV=production
# Add other env vars here if needed
# Environment=RELAY_LIST=wss://relay.damus.io

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable binder
systemctl restart binder

echo -e "${GREEN}Binder service started on port $PORT.${NC}"

# 5. Install and Config Caddy
if ! command -v caddy &> /dev/null; then
    echo -e "${YELLOW}Installing Caddy...${NC}"
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
else
    echo -e "${GREEN}Caddy is already installed.${NC}"
fi

# Configure Caddy
echo -e "${YELLOW}Configuring Caddy...${NC}"
read -p "Enter your domain (or IP): " DOMAIN
read -p "Enter your email (for SSL): " EMAIL

CADDYFILE="/etc/caddy/Caddyfile"
# Backup existing
cp $CADDYFILE "${CADDYFILE}.bak"

# Write new config
cat > $CADDYFILE <<EOF
$DOMAIN {
    reverse_proxy localhost:$PORT
    tls $EMAIL
}
EOF

systemctl restart caddy

echo -e "${GREEN}=== Installation Complete ===${NC}"
echo -e "Binder is live at: https://$DOMAIN"
echo -e "Service status: systemctl status binder"
