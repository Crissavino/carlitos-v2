# OpenClaw Infrastructure Config

## Overview

This directory contains the versionable OpenClaw configuration that gets applied on every container start.

## Files

- `openclaw.config.json` - Base configuration template with `__GATEWAY_TOKEN__` placeholder

## How it works

1. On container start, `entrypoint.sh` copies this config to `/root/.openclaw/config/openclaw.json`
2. The `__GATEWAY_TOKEN__` placeholder is replaced with the `OPENCLAW_GATEWAY_TOKEN` env var
3. A symlink is created at `/root/.openclaw/openclaw.json` pointing to the config
4. This happens on EVERY start, ensuring consistency after rebuilds

## Key settings

- `skills.load.extraDirs`: Loads custom skills from `/root/.openclaw/skills`
- `gateway.auth.token` + `gateway.remote.token`: Both set from env var for proper auth
- `gateway.bind: "lan"`: Allows connections from Docker network

## Custom Skills (loaded via extraDirs)

- business-expert
- dashboard-tasks
- db-reader
- decision-engine
- google-ads-expert
- senior-dev

## Adding new settings

1. Edit `openclaw.config.json` in this directory
2. Rebuild/restart container
3. Settings apply automatically

## Idempotent

Running multiple times is safe - config is always regenerated from template.
