# Deploy Workflow

## Siempre preguntar al completar una tarea:

> "Deploy a produccion?"

## Si el usuario dice que si:

### 1. Commit & Push
```bash
git add -A && git commit -m "mensaje" && git push origin master
```

### 2. Deploy en servidor
```bash
ssh carlitos "cd ~/openclaw && git pull && docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build"
```

### 3. Verificar devices pendientes
```bash
ssh carlitos "docker exec openclaw openclaw devices list"
```

### 4. Aprobar device si existe request
```bash
ssh carlitos "docker exec openclaw openclaw devices approve REQUEST_ID"
```

---

## Notas
- El servidor es `carlitos` (SSH config)
- Repo path en servidor: `~/openclaw`
- Docker compose file: `docker-compose.prod.yml`
