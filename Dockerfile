FROM ubuntu:24.04

# Instalar Node.js 22 y dependencias
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    make \
    g++ \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Instalar openclaw globalmente
RUN npm install -g openclaw@latest

# Crear directorios para OpenClaw
RUN mkdir -p /root/.openclaw/skills /root/.openclaw/custom-skills

# Copiar custom-skills (código TypeScript)
COPY custom-skills/ /root/.openclaw/custom-skills/

# Copiar skills (SKILL.md para OpenClaw)
COPY skills/ /root/.openclaw/skills/

# Instalar dependencias y compilar custom-skills (backend)
WORKDIR /root/.openclaw/custom-skills
RUN npm install && npx tsc --build

# Build frontend dashboard
WORKDIR /root/.openclaw/custom-skills/dashboard/frontend
RUN npm install && npm run build

# Volver al directorio de trabajo
WORKDIR /app

# Copiar script de inicio
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Exponer puerto para el gateway
EXPOSE 18789

# Volumen para persistir configuración y datos
VOLUME ["/root/.openclaw/data", "/root/.openclaw/workspace"]

# Comando por defecto
CMD ["/app/entrypoint.sh"]
