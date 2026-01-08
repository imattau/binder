#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
NODE_VERSION=${NODE_VERSION:-20}

# Node installation (apt-based fallback, no-op if already installed)
if ! command -v node >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    echo "Installing Node.js ${NODE_VERSION} via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs build-essential
  else
    echo "Please install Node.js ${NODE_VERSION}+ before running this script." >&2
    exit 1
  fi
fi

cd "$APP_ROOT"
npm install --no-fund
npm run build

cat <<'MESSAGE'

Binder is built. Next steps:
  1. Copy deploy/binder.service to /etc/systemd/system/binder.service and edit the WorkingDirectory/User as needed.
  2. Place deploy/Caddyfile on your web server (e.g. /etc/caddy/Caddyfile) and adjust domain/tls settings.
  3. Create /etc/default/binder (or pass env vars) to configure BINDER_PORT/BINDER_HOST/RELAY/MEDIA overrides.
  4. Start the service:
       sudo systemctl daemon-reload
       sudo systemctl enable --now binder.service

The app listens on port 4173 by default; point your reverse proxy at that address.
MESSAGE
