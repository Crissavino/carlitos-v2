# OpenClaw Production Infrastructure

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DOCKER IMAGE                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  /app/                                                                │   │
│  │    ├── custom-skills/     ← Compiled TypeScript (backend + frontend) │   │
│  │    ├── skills/            ← Skill definitions (SKILL.md files)       │   │
│  │    ├── openclaw.config.json  ← Config template                       │   │
│  │    └── entrypoint.sh      ← Startup script                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓ symlinks                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  /root/.openclaw/  (DOCKER VOLUME - PERSISTENT)                      │   │
│  │    ├── skills -> /app/skills                                         │   │
│  │    ├── custom-skills -> /app/custom-skills                           │   │
│  │    ├── openclaw.json       ← Runtime config (persisted)              │   │
│  │    ├── identity/           ← Device identity (persisted)             │   │
│  │    ├── devices/            ← Browser pairing (persisted)             │   │
│  │    ├── data/               ← Audit logs, cache (persisted)           │   │
│  │    └── workspace/          ← Work files (persisted)                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### CODE vs STATE Separation

| Type | Location | Persistence | Updated By |
|------|----------|-------------|------------|
| Skills code | `/app/skills/` | Image | `docker build` |
| Custom-skills code | `/app/custom-skills/` | Image | `docker build` |
| Config template | `/app/openclaw.config.json` | Image | `docker build` |
| Runtime config | `/root/.openclaw/openclaw.json` | Volume | First start only |
| Device identity | `/root/.openclaw/identity/` | Volume | OpenClaw runtime |
| Browser pairing | `/root/.openclaw/devices/` | Volume | OpenClaw runtime |
| Audit logs | `/root/.openclaw/data/` | Volume | OpenClaw runtime |
| Workspace | `/root/.openclaw/workspace/` | Volume | OpenClaw runtime |

### Volume: `openclaw_home`

This single volume contains ALL OpenClaw state:

```yaml
volumes:
  - openclaw_home:/root/.openclaw
```

**What's persisted:**
- ✅ Chat sessions
- ✅ Browser device pairing
- ✅ Device identity/tokens
- ✅ Runtime configuration
- ✅ Audit logs
- ✅ Workspace files

## Operations

### ✅ Safe: Rebuild Container (code update)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**Result:**
- Code updated from new image
- State preserved in volume
- Browser still paired
- Sessions intact

### ✅ Safe: Restart Container

```bash
docker compose -f docker-compose.prod.yml restart openclaw
```

**Result:** All state preserved

### ✅ Safe: Stop and Start

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

**Result:** All state preserved (volume not deleted)

### ⚠️ DESTRUCTIVE: Factory Reset

```bash
# Stop services
docker compose -f docker-compose.prod.yml down

# Delete OpenClaw state volume
docker volume rm openclaw_openclaw_home

# Start fresh
docker compose -f docker-compose.prod.yml up -d --build
```

**Result:**
- ❌ Browser pairing lost (need to re-pair)
- ❌ Device identity regenerated
- ❌ All sessions/chats lost
- ❌ Audit logs lost

### ⚠️ DESTRUCTIVE: Delete ALL Volumes

```bash
docker compose -f docker-compose.prod.yml down -v
```

**Result:** ALL data lost (OpenClaw + MySQL)

## Troubleshooting

### Browser Pairing Lost After Rebuild

**Cause:** The volume was deleted, or running without volume mount.

**Check:**
```bash
docker exec openclaw ls -la /root/.openclaw/devices/
```

Should show `paired.json` with content.

**Fix:** Re-pair the browser at `carlitos-bot.com`

### Config Reset After Rebuild

**By design:** If `openclaw.json` doesn't exist, it's created from template.
If it exists, it's preserved.

**To reset config:**
```bash
docker exec openclaw rm /root/.openclaw/openclaw.json
docker compose restart openclaw
```

### Warning: "Running WITHOUT persistent volumes"

**Cause:** Volume not mounted or empty.

**Fix:** Ensure docker-compose.prod.yml has:
```yaml
volumes:
  - openclaw_home:/root/.openclaw
```

## Files in This Directory

| File | Purpose |
|------|---------|
| `openclaw.config.json` | Template for OpenClaw config. Copied to volume on first start. |
| `README.md` | This documentation. |

## Config Template

The `openclaw.config.json` contains:

- `skills.load.extraDirs`: Loads custom skills from `/root/.openclaw/skills`
- `gateway.auth.token` + `gateway.remote.token`: Set from `OPENCLAW_GATEWAY_TOKEN` env var
- `gateway.bind: "lan"`: Allows connections from Docker network

### Placeholder Substitution

The `__GATEWAY_TOKEN__` placeholder in the template is replaced with the env var on first start.

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude API access |
| `OPENCLAW_GATEWAY_TOKEN` | No | Fixed gateway token (auto-generated if not set) |
| `DASHBOARD_TOKEN` | Yes | Dashboard API auth |
| `DB_CORE_*` | Yes | Avocode database connection |
| `DB_OPENCLAW_*` | Yes | Internal MySQL connection |

## Custom Skills (loaded via extraDirs)

- business-expert
- dashboard-tasks
- db-reader
- decision-engine
- google-ads-expert
- senior-dev
