# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (layer cache)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artefacts from builder
COPY --from=builder /app/dist ./dist

# data.db lives at /data/data.db (mounted volume so it survives container restarts)
ENV NODE_ENV=production
ENV DB_PATH=/data/data.db

# Expose Express port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:5000/api/stats || exit 1

CMD ["node", "dist/index.cjs"]
