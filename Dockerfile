# ==============================================================================
# Etapa 1: deps - Instalación completa de dependencias para compilación
# ==============================================================================
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ==============================================================================
# Etapa 2: build - Compilación de la aplicación
# ==============================================================================
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && \
    if [ -f dist/src/main.js ] && [ ! -f dist/main.js ]; then cp dist/src/main.js dist/main.js; fi

# ==============================================================================
# Etapa 3: prod-deps - Instalación de dependencias de producción
# ==============================================================================
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ==============================================================================
# Etapa 4: runtime - Entorno de ejecución de producción
# ==============================================================================
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package*.json ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
