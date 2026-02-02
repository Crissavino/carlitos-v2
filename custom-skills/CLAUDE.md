# OpenClaw Custom Skills - Instrucciones para Claude

## Deploy Workflow

**SIEMPRE preguntar al completar una tarea:** "Deploy a produccion?"

### Si el usuario confirma:

1. **Commit & Push**
   ```bash
   git add -A && git commit -m "mensaje" && git push origin master
   ```

2. **Deploy en servidor carlitos (PERSISTENCE-SAFE)**
   ```bash
   ssh carlitos "cd ~/openclaw && git pull && docker compose -f docker-compose.prod.yml up -d --build"
   ```

   > ⚠️ **NO usar `docker compose down`** - no es necesario y puede causar downtime.
   > El `up -d --build` es suficiente y mantiene el estado.

3. **Verificar devices pendientes**
   ```bash
   ssh carlitos "docker exec openclaw openclaw devices list"
   ```

4. **Aprobar device si existe REQUEST_ID**
   ```bash
   ssh carlitos "docker exec openclaw openclaw devices approve REQUEST_ID"
   ```

## Servidor
- SSH alias: `carlitos`
- Repo path: `~/openclaw`
- Docker compose: `docker-compose.prod.yml`

## Persistence Architecture

**Estado que persiste (volume `openclaw_home`):**
- ✅ Browser pairing (`/root/.openclaw/devices/`)
- ✅ Device identity (`/root/.openclaw/identity/`)
- ✅ Config runtime (`/root/.openclaw/openclaw.json`)
- ✅ Data/audit logs (`/root/.openclaw/data/`)
- ✅ Workspace (`/root/.openclaw/workspace/`)

**Código que se actualiza (desde imagen):**
- Skills: `/app/skills/` → symlink en `/root/.openclaw/skills`
- Custom-skills: `/app/custom-skills/` → symlink en `/root/.openclaw/custom-skills`

**Operaciones seguras:**
- `up -d --build` → actualiza código, preserva estado
- `restart` → preserva estado
- `down` + `up -d` → preserva estado (volume no se borra)

**Operaciones destructivas (evitar):**
- `down -v` → BORRA TODO el estado
- `docker volume rm openclaw_openclaw_home` → BORRA TODO el estado
