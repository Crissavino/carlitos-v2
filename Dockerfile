FROM ubuntu:24.04

# ==============================================================================
# OpenClaw Production Dockerfile
#
# Architecture:
#   - Code lives in /app/ (from image, updated on rebuild)
#   - State lives in /root/.openclaw/ (volume, persists across rebuilds)
#   - Entrypoint creates symlinks: state dir -> code dir
#
# This ensures:
#   ✅ Code updates on docker build
#   ✅ State persists across rebuilds
#   ✅ No data loss (sessions, chats, browser pairing)
# ==============================================================================

# Install Node.js 22, GitHub CLI, and dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    make \
    g++ \
    ca-certificates \
    gpg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    # Install GitHub CLI
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Create app directory (CODE - from image)
WORKDIR /app

# Install openclaw globally
RUN npm install -g openclaw@latest

# ==============================================================================
# CODE: Lives in /app/ (rebuilt with image)
# ==============================================================================

# Copy custom-skills source
COPY custom-skills/ /app/custom-skills/

# Copy skills definitions
COPY skills/ /app/skills/

# Build custom-skills (backend TypeScript)
WORKDIR /app/custom-skills
RUN npm install && npx tsc --build

# Build frontend dashboard
WORKDIR /app/custom-skills/dashboard/frontend
RUN npm install && npm run build

# Copy config template
WORKDIR /app
COPY infra/openclaw/openclaw.config.json /app/openclaw.config.json

# Copy entrypoint
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# ==============================================================================
# STATE: Lives in /root/.openclaw/ (volume, persists)
# ==============================================================================

# Do NOT create /root/.openclaw/* here - it will be created by volume mount
# The entrypoint handles initialization

# Expose ports
EXPOSE 18789 3001 3002

# Default command
CMD ["/app/entrypoint.sh"]
