#!/bin/bash
set -e

echo "=== OpenClaw Container Starting ==="

# Create directories
mkdir -p /root/.openclaw/data/audit
mkdir -p /root/.openclaw/data/google-ads
mkdir -p /root/.openclaw/workspace
mkdir -p /root/.openclaw/config

# Use persisted config if exists, otherwise create default
CONFIG_FILE="/root/.openclaw/openclaw.json"
PERSISTED_CONFIG="/root/.openclaw/config/openclaw.json"

if [ -f "$PERSISTED_CONFIG" ]; then
    echo "Using persisted config from $PERSISTED_CONFIG"
    ln -sf "$PERSISTED_CONFIG" "$CONFIG_FILE"
elif [ ! -f "$CONFIG_FILE" ]; then
    echo "Creating default OpenClaw config..."

    # Use env var for token or generate random one
    TOKEN="${OPENCLAW_GATEWAY_TOKEN:-$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 48)}"

    cat > "$PERSISTED_CONFIG" << EOF
{
  "agents": {
    "defaults": {
      "maxConcurrent": 4,
      "workspace": "/root/.openclaw/workspace"
    }
  },
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "$TOKEN"
    },
    "port": 18789,
    "bind": "lan"
  },
  "auth": {
    "profiles": {
      "anthropic:default": {
        "provider": "anthropic",
        "mode": "api_key"
      }
    }
  },
  "skills": {
    "install": {
      "nodeManager": "npm"
    }
  }
}
EOF
    ln -sf "$PERSISTED_CONFIG" "$CONFIG_FILE"
    echo "Gateway token: $TOKEN"
fi

echo ""
echo "Custom skills: /root/.openclaw/custom-skills"
echo "Skills: /root/.openclaw/skills"

# List available skills
echo ""
echo "=== Available Skills ==="
openclaw skills list 2>/dev/null | grep -E "ready|db-reader|google-ads" || echo "Skills loading..."

# Show dashboard URL with token
TOKEN=$(grep -o '"token": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
echo ""
echo "=== Starting Services ==="
echo "Gateway:       http://localhost:18789/?token=$TOKEN"
echo "Dashboard API: http://localhost:3002/"
echo "Webhook:       http://localhost:3001/ingest/google-ads"
echo ""

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
exec openclaw --dev gateway --bind lan --port 18789 --allow-unconfigured --token "${OPENCLAW_GATEWAY_TOKEN:-$TOKEN}"
