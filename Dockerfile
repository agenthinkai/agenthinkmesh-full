# ─────────────────────────────────────────────────────────────────────────────
# Mesh Enterprise Platform — Production Dockerfile
# Enterprise Certification Sprint — CR-2
#
# Build layout (confirmed from vite.config.ts + server/_core/vite.ts):
#   - Frontend (Vite):  outDir = dist/public  (at project root)
#   - Server (esbuild): outDir = dist/         (at project root)
#   - serveStatic() resolves: path.resolve(__dirname, "../..", "dist", "public")
#     i.e. /app/dist/public at runtime
#
# Uses corepack to honour the pnpm version pinned in package.json#packageManager
# (pnpm@10.4.1) so patchedDependencies / lockfile hash always matches.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

# Enable corepack so the exact pnpm version in package.json#packageManager is used
RUN npm install -g corepack@latest && corepack enable

# Copy everything — avoids COPY-layer ordering bugs with patches/ directory
# (pnpm patchedDependencies requires patches/ to exist before pnpm install)
COPY . .

# Install ALL deps (vite/esbuild are devDependencies needed for the build)
RUN corepack pnpm install

# Build frontend (Vite → dist/public) and compile server TypeScript (→ dist/)
RUN corepack pnpm run build

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

# Enable corepack in the runtime image too
RUN npm install -g corepack@latest && corepack enable

# Copy package manifests + patches so prod install can apply the patch
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install production dependencies only using the exact pinned pnpm version
RUN corepack pnpm install --frozen-lockfile --prod

# Copy the entire dist/ directory (contains both server output and dist/public frontend)
COPY --from=builder /app/dist ./dist

# Copy runtime-required directories
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/scripts ./scripts

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT||3000) + '/api/health', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Expose default port (overridable via PORT env var)
EXPOSE 3000

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Start the server
CMD ["node", "dist/server/_core/index.js"]
