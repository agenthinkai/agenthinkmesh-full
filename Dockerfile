# ─────────────────────────────────────────────────────────────────────────────
# Mesh Enterprise Platform — Production Dockerfile
# Enterprise Certification Sprint — CR-2
#
# Multi-stage build:
#   Stage 1 (deps):   Install production dependencies only
#   Stage 2 (build):  Compile TypeScript + Vite frontend
#   Stage 3 (runner): Minimal runtime image
#
# Usage:
#   docker build -t mesh-enterprise:latest .
#   docker run -p 3000:3000 --env-file .env mesh-enterprise:latest
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package manifests and patches (required by pnpm patchedDependencies)
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install ALL dependencies (needed for build)
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build frontend (Vite) and compile server (tsc)
RUN pnpm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S meshapp && adduser -S meshapp -u 1001 -G meshapp

# Install pnpm for production install
RUN npm install -g pnpm@9

# Copy package manifests, patches, and install production deps only
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist

# Copy drizzle migrations
COPY --from=builder /app/drizzle ./drizzle

# Copy shared directory
COPY --from=builder /app/shared ./shared

# Copy startup validation script
COPY scripts/validate-env.js ./scripts/validate-env.js
COPY scripts/start-onprem.sh ./scripts/start-onprem.sh

# Set ownership
RUN chown -R meshapp:meshapp /app

USER meshapp

# Health check — verifies the /api/health endpoint responds
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/api/health | grep -q '"status":"ok"' || exit 1

# Expose default port (overridable via PORT env var)
EXPOSE 3000

# Environment defaults (override via --env-file or -e flags)
ENV NODE_ENV=production
ENV PORT=3000

# Start the server
CMD ["node", "dist/server/_core/index.js"]
