# OpenClaw Custom Skills - Instrucciones para Claude

## Deploy Workflow

**SIEMPRE preguntar al completar una tarea:** "Deploy a produccion?"

### Si el usuario confirma:

1. **Commit & Push**
   ```bash
   git add -A && git commit -m "mensaje" && git push origin master
   ```

2. **Deploy en servidor carlitos**
   ```bash
   ssh carlitos "cd ~/openclaw && git pull && docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build"
   ```

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
