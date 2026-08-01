#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AgenThink Mesh — On-Premises Startup Script
# Sprint 3 WP-9
#
# Usage:
#   chmod +x scripts/start-onprem.sh
#   ./scripts/start-onprem.sh
#
# Prerequisites:
#   - Node.js 20+ installed
#   - pnpm installed (npm install -g pnpm)
#   - .env file present in project root (copy from .env.template)
#   - MySQL/TiDB instance running and DATABASE_URL set in .env
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== AgenThink Mesh — On-Premises Startup ==="
echo "Project root: $PROJECT_DIR"

# ── 1. Load environment ───────────────────────────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env file not found at $ENV_FILE"
  echo "       Copy .env.template to .env and fill in all required values."
  exit 1
fi

# Export all variables from .env (skip comments and empty lines)
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
echo "[OK] Environment loaded from .env"

# ── 2. Validate critical env vars ─────────────────────────────────────────────
REQUIRED_VARS=(
  "DATABASE_URL"
  "JWT_SECRET"
  "BUILT_IN_FORGE_API_KEY"
  "ANTHROPIC_API_KEY"
  "VITE_APP_ID"
)
MISSING=()
for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR:-}" ]; then
    MISSING+=("$VAR")
  fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: Missing required environment variables:"
  for V in "${MISSING[@]}"; do
    echo "         - $V"
  done
  echo "       Update your .env file and retry."
  exit 1
fi
echo "[OK] Required environment variables present"

# ── 3. Install dependencies ───────────────────────────────────────────────────
cd "$PROJECT_DIR"
echo "[...] Installing dependencies..."
pnpm install --frozen-lockfile 2>&1 | tail -3
echo "[OK] Dependencies installed"

# ── 4. Build frontend ─────────────────────────────────────────────────────────
echo "[...] Building frontend (Vite)..."
pnpm build 2>&1 | tail -5
echo "[OK] Frontend built"

# ── 5. Run database migrations ────────────────────────────────────────────────
echo "[...] Running database migrations..."
pnpm db:push 2>&1 | tail -5
echo "[OK] Database schema up to date"

# ── 6. Health pre-check (optional — skip if DB not yet reachable) ─────────────
HEALTH_PORT="${PORT:-3000}"
echo "[...] Starting server on port $HEALTH_PORT..."

# ── 7. Start the server ───────────────────────────────────────────────────────
export NODE_ENV=production
exec node dist/server/_core/index.js
