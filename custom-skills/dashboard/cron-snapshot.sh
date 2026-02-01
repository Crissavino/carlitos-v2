#!/bin/bash
# ============================================================================
# OpenClaw Daily Snapshot Cron Job
#
# Saves daily KPI snapshot for historical graphs.
#
# Setup (when ready to activate):
#   1. chmod +x cron-snapshot.sh
#   2. Add to crontab: crontab -e
#   3. Example: Run daily at 23:55
#      55 23 * * * /path/to/openclaw/custom-skills/dashboard/cron-snapshot.sh >> /var/log/openclaw-snapshot.log 2>&1
#
# Requirements:
#   - DASHBOARD_TOKEN env var set
#   - Dashboard server running on DASHBOARD_URL
# ============================================================================

set -e

# Configuration
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3002}"
DASHBOARD_TOKEN="${DASHBOARD_TOKEN:-}"

if [ -z "$DASHBOARD_TOKEN" ]; then
  echo "[ERROR] $(date -Iseconds) DASHBOARD_TOKEN not set"
  exit 1
fi

echo "[INFO] $(date -Iseconds) Starting daily snapshot..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $DASHBOARD_TOKEN" \
  -H "Content-Type: application/json" \
  "${DASHBOARD_URL}/api/snapshots")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "[OK] $(date -Iseconds) Snapshot saved successfully"
  echo "$BODY" | head -c 200
  echo ""
else
  echo "[ERROR] $(date -Iseconds) Snapshot failed with HTTP $HTTP_CODE"
  echo "$BODY"
  exit 1
fi
