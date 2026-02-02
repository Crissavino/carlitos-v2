#!/bin/bash
# ==============================================================================
# OpenClaw Volume Migration Script
#
# Migrates from old multi-volume setup to new single-volume architecture.
# Run this ONCE before deploying the new docker-compose.
#
# Old volumes:
#   - openclaw-data:/root/.openclaw/data
#   - openclaw-workspace:/root/.openclaw/workspace
#   - openclaw-config:/root/.openclaw/config
#   - openclaw-identity:/root/.openclaw/identity
#
# New volume:
#   - openclaw_home:/root/.openclaw (everything)
# ==============================================================================

set -e

echo "=== OpenClaw Volume Migration ==="
echo ""

# Check if running on server
if [ ! -d ~/openclaw ]; then
    echo "Error: Run this script on the server (carlitos)"
    exit 1
fi

cd ~/openclaw

# Step 1: Backup current state from running container
echo "Step 1: Backing up current state..."
mkdir -p /tmp/openclaw-backup

docker exec openclaw tar -czf - \
    /root/.openclaw/data \
    /root/.openclaw/workspace \
    /root/.openclaw/identity \
    /root/.openclaw/devices \
    /root/.openclaw/openclaw.json \
    2>/dev/null > /tmp/openclaw-backup/state.tar.gz || true

echo "  Backup created: /tmp/openclaw-backup/state.tar.gz"

# Step 2: Stop services
echo ""
echo "Step 2: Stopping services..."
docker compose -f docker-compose.prod.yml down

# Step 3: Create new volume if it doesn't exist
echo ""
echo "Step 3: Creating new volume..."
docker volume create openclaw_openclaw_home 2>/dev/null || true

# Step 4: Restore backup to new volume
echo ""
echo "Step 4: Restoring state to new volume..."

# Create a temporary container to restore data
docker run --rm -v openclaw_openclaw_home:/root/.openclaw -v /tmp/openclaw-backup:/backup ubuntu:24.04 bash -c "
    cd /root/.openclaw
    tar -xzf /backup/state.tar.gz --strip-components=2 2>/dev/null || echo 'No backup to restore'
    ls -la /root/.openclaw/
"

# Step 5: Clean up old volumes (optional - commented out for safety)
echo ""
echo "Step 5: Old volumes preserved (manual cleanup required)"
echo "  To delete old volumes after verifying migration:"
echo "    docker volume rm openclaw-data openclaw-workspace openclaw-config openclaw-identity"

# Step 6: Pull and deploy
echo ""
echo "Step 6: Deploying with new architecture..."
git pull
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Verify:"
echo "  docker exec openclaw ls -la /root/.openclaw/"
echo "  docker exec openclaw ls -la /root/.openclaw/devices/"
echo ""
