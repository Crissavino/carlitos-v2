#!/bin/bash
set -e

echo "=== OpenClaw Container Starting ==="
echo ""

# ==============================================================================
# PERSISTENCE CHECK
# ==============================================================================

OPENCLAW_HOME="/root/.openclaw"
APP_CODE="/app"

# Check if running with persistent volume
check_persistence() {
    # If the directory is empty or doesn't have key state files, warn
    if [ ! -d "$OPENCLAW_HOME" ] || [ -z "$(ls -A $OPENCLAW_HOME 2>/dev/null)" ]; then
        echo ""
        echo "╔══════════════════════════════════════════════════════════════════════════╗"
        echo "║  ⚠️  WARNING: OpenClaw running WITHOUT persistent volumes!               ║"
        echo "║                                                                          ║"
        echo "║  This WILL cause data loss on rebuild:                                   ║"
        echo "║    - Chat sessions                                                       ║"
        echo "║    - Browser pairing                                                     ║"
        echo "║    - Device identity                                                     ║"
        echo "║                                                                          ║"
        echo "║  To fix: Mount a volume to /root/.openclaw in docker-compose.yml        ║"
        echo "╚══════════════════════════════════════════════════════════════════════════╝"
        echo ""
    fi
}

check_persistence

# ==============================================================================
# DIRECTORY SETUP (idempotent)
# ==============================================================================

# Create required directories if they don't exist
mkdir -p "$OPENCLAW_HOME/data/audit"
mkdir -p "$OPENCLAW_HOME/data/google-ads"
mkdir -p "$OPENCLAW_HOME/workspace"
mkdir -p "$OPENCLAW_HOME/devices"
mkdir -p "$OPENCLAW_HOME/identity"
mkdir -p "$OPENCLAW_HOME/canvas"
mkdir -p "$OPENCLAW_HOME/cron"

# ==============================================================================
# CODE SYMLINKS (always updated - code comes from image)
# ==============================================================================

# Skills directory: symlink to image code
# Remove existing (could be old symlink or copied directory)
if [ -L "$OPENCLAW_HOME/skills" ]; then
    rm "$OPENCLAW_HOME/skills"
elif [ -d "$OPENCLAW_HOME/skills" ]; then
    rm -rf "$OPENCLAW_HOME/skills"
fi
ln -sf "$APP_CODE/skills" "$OPENCLAW_HOME/skills"
echo "✓ Skills linked: $OPENCLAW_HOME/skills -> $APP_CODE/skills"

# Custom-skills directory: symlink to image code
if [ -L "$OPENCLAW_HOME/custom-skills" ]; then
    rm "$OPENCLAW_HOME/custom-skills"
elif [ -d "$OPENCLAW_HOME/custom-skills" ]; then
    rm -rf "$OPENCLAW_HOME/custom-skills"
fi
ln -sf "$APP_CODE/custom-skills" "$OPENCLAW_HOME/custom-skills"
echo "✓ Custom-skills linked: $OPENCLAW_HOME/custom-skills -> $APP_CODE/custom-skills"

# ==============================================================================
# CONFIG BOOTSTRAP (idempotent - only create if doesn't exist)
# ==============================================================================

CONFIG_FILE="$OPENCLAW_HOME/openclaw.json"
CONFIG_TEMPLATE="$APP_CODE/openclaw.config.json"

# Generate gateway token
TOKEN="${OPENCLAW_GATEWAY_TOKEN:-$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)}"

if [ -f "$CONFIG_FILE" ]; then
    echo "✓ Config exists: $CONFIG_FILE (preserved)"

    # Update token in existing config if env var is set
    if [ -n "$OPENCLAW_GATEWAY_TOKEN" ]; then
        # Check if config has the token placeholder or different token
        if grep -q "__GATEWAY_TOKEN__" "$CONFIG_FILE" 2>/dev/null; then
            sed -i "s/__GATEWAY_TOKEN__/$TOKEN/g" "$CONFIG_FILE"
            echo "  → Token placeholder replaced with env var"
        fi
    fi
else
    echo "→ Config not found, creating from template..."
    sed "s/__GATEWAY_TOKEN__/$TOKEN/g" "$CONFIG_TEMPLATE" > "$CONFIG_FILE"
    echo "✓ Config created: $CONFIG_FILE"
fi

# ==============================================================================
# STATE PERSISTENCE INFO
# ==============================================================================

echo ""
echo "=== Persistence Status ==="

# Check key state directories
check_state() {
    local dir="$1"
    local name="$2"
    if [ -d "$OPENCLAW_HOME/$dir" ] && [ "$(ls -A $OPENCLAW_HOME/$dir 2>/dev/null)" ]; then
        echo "✓ $name: persisted ($(ls $OPENCLAW_HOME/$dir 2>/dev/null | wc -l) files)"
    else
        echo "○ $name: empty (will be created on first use)"
    fi
}

check_state "identity" "Device identity"
check_state "devices" "Browser pairing"
check_state "data" "Data/audit logs"
check_state "workspace" "Workspace"

# ==============================================================================
# SKILLS LIST
# ==============================================================================

echo ""
echo "=== Available Skills ==="
openclaw skills list 2>/dev/null | grep -E "ready|db-reader|google-ads|business|decision|senior|dashboard" || echo "Skills loading..."

# ==============================================================================
# SERVICE URLs
# ==============================================================================

echo ""
echo "=== Starting Services ==="
echo "Gateway:       http://localhost:18789/?token=$TOKEN"
echo "Dashboard API: http://localhost:3002/"
echo "Webhook:       http://localhost:3001/ingest/google-ads"
echo ""

# ==============================================================================
# START SERVICES
# ==============================================================================

# Start webhook server in background
echo "Starting webhook server..."
cd "$OPENCLAW_HOME/custom-skills"
node dist/webhook-server.js &
WEBHOOK_PID=$!
echo "Webhook server started (PID: $WEBHOOK_PID)"

# Start dashboard API in background
echo "Starting dashboard API..."
node dist/dashboard/server.js &
DASHBOARD_PID=$!
echo "Dashboard API started (PID: $DASHBOARD_PID)"

# Start gateway in foreground
cd /app
exec openclaw gateway --bind lan --port 18789 --allow-unconfigured --token "$TOKEN"
