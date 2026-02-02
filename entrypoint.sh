#!/bin/bash
set -e

echo "=== OpenClaw Container Starting ==="

# Create directories
mkdir -p /root/.openclaw/data/audit
mkdir -p /root/.openclaw/data/google-ads
mkdir -p /root/.openclaw/workspace
mkdir -p /root/.openclaw/config

# =============================================================================
# CONFIG BOOTSTRAP (always applied, idempotent)
# =============================================================================
# Config is generated from versioned template on every start.
# This ensures skills.load.extraDirs and gateway tokens are always correct.
# See: infra/openclaw/README.md

CONFIG_FILE="/root/.openclaw/openclaw.json"
PERSISTED_CONFIG="/root/.openclaw/config/openclaw.json"
CONFIG_TEMPLATE="/app/openclaw.config.json"

# Generate token: use env var or generate random
TOKEN="${OPENCLAW_GATEWAY_TOKEN:-$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)}"

echo "Applying OpenClaw config from template..."

# Always generate config from template (replaces __GATEWAY_TOKEN__ placeholder)
sed "s/__GATEWAY_TOKEN__/$TOKEN/g" "$CONFIG_TEMPLATE" > "$PERSISTED_CONFIG"

# Create symlink to effective config location
ln -sf "$PERSISTED_CONFIG" "$CONFIG_FILE"

echo "Config applied: skills.load.extraDirs = [\"/root/.openclaw/skills\"]"

# =============================================================================
# INFO
# =============================================================================

echo ""
echo "Custom skills: /root/.openclaw/custom-skills"
echo "Skills: /root/.openclaw/skills"

# List available skills
echo ""
echo "=== Available Skills ==="
openclaw skills list 2>/dev/null | grep -E "ready|db-reader|google-ads|business|decision|senior|dashboard" || echo "Skills loading..."

# Show dashboard URL with token
echo ""
echo "=== Starting Services ==="
echo "Gateway:       http://localhost:18789/?token=$TOKEN"
echo "Dashboard API: http://localhost:3002/"
echo "Webhook:       http://localhost:3001/ingest/google-ads"
echo ""

# =============================================================================
# START SERVICES
# =============================================================================

# Start webhook server in background
echo "Starting webhook server..."
cd /root/.openclaw/custom-skills
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
