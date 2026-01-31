# OpenClaw en Docker

Configuración de [OpenClaw](https://github.com/openclaw/openclaw) en Docker.

## Inicio rápido

1. Copia el archivo de ejemplo y agrega tus API keys:
```bash
cp .env.example .env
# Edita .env con tu ANTHROPIC_API_KEY
```

2. Construye y ejecuta:
```bash
docker compose up -d --build
```

3. Entra al contenedor para configurar:
```bash
docker exec -it openclaw bash
```

4. Dentro del contenedor, ejecuta el onboarding:
```bash
openclaw onboard --install-daemon
```

## Comandos útiles

```bash
# Ver logs
docker compose logs -f openclaw

# Reiniciar
docker compose restart

# Parar
docker compose down

# Reconstruir
docker compose up -d --build
```

## Comandos de OpenClaw

```bash
# Iniciar gateway
openclaw gateway --port 18789 --verbose

# Enviar mensaje
openclaw message send --to +1234567890 --message "Hello from OpenClaw"

# Hablar con el agente
openclaw agent --message "Ship checklist" --thinking high
```

## Conectar WhatsApp

Una vez dentro del contenedor con `openclaw onboard --install-daemon`, sigue las instrucciones para escanear el QR de WhatsApp.

## Datos persistentes

Los datos se guardan en el volumen `openclaw-data`. Las sesiones están en `/root/.openclaw/`.
