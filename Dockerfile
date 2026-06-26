# ============================================================
# Mapia Backend - Dockerfile multi-stage
# ============================================================

# --- Stage 1: build ---
FROM node:22-bookworm-slim AS builder

# argon2 necesita toolchain de compilación nativa
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2: runtime ---
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
# Solo dependencias de producción (argon2 ya viene compilado desde el builder,
# pero reinstalamos prod deps limpio; el toolchain se necesita aquí también)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && npm ci --omit=dev \
    && apt-get purge -y python3 make g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
