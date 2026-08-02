#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Mesh Enterprise Platform — On-Premises Startup Script
# Enterprise Certification Sprint — CR-2 / CR-4
#
# Usage:
#   cp .env.template .env && vi .env   # Fill in all CHANGE_ME values
#   chmod +x scripts/start-onprem.sh
#   ./scripts/start-onprem.sh          # First-time setup + start
#   ./scripts/start-onprem.sh --reload # Zero-downtime reload (after updates)
#   ./scripts/start-onprem.sh --stop   # Graceful stop
#   ./scripts/start-onprem.sh --direct # Start directly (no PM2, for Docker)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${PROJECT_DIR}/logs"
ENV_FILE="${PROJECT_DIR}/.env"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Mesh Enterprise Platform — On-Premises Startup         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Handle flags ──────────────────────────────────────────────────────────────
MODE="start"
if [[ "${1:-}" == "--reload" ]]; then MODE="reload"; fi
if [[ "${1:-}" == "--stop"   ]]; then MODE="stop";   fi
if [[ "${1:-}" == "--direct" ]]; then MODE="direct"; fi

# ── Stop mode ─────────────────────────────────────────────────────────────────
if [[ "$MODE" == "stop" ]]; then
  info "Stopping Mesh Enterprise Platform..."
  pm2 stop mesh-enterprise 2>/dev/null || true
  info "Stopped."
  exit 0
fi

# ── Check prerequisites ───────────────────────────────────────────────────────
info "Checking prerequisites..."

for cmd in node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    error "Required command not found: $cmd"
    error "Install Node.js 20+ from https://nodejs.org"
    exit 1
  fi
done

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VER" -lt 20 ]]; then
  error "Node.js 20+ required (found v${NODE_VER})"
  exit 1
fi

if [[ "$MODE" != "direct" ]] && ! command -v pm2 &>/dev/null; then
  warn "PM2 not found. Installing globally..."
  npm install -g pm2
fi

if ! command -v pnpm &>/dev/null; then
  warn "pnpm not found. Installing globally..."
  npm install -g pnpm@9
fi

info "Prerequisites OK (Node $(node --version))"

# ── Load environment ──────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  error ".env file not found at $ENV_FILE"
  error "Run: cp .env.template .env && vi .env"
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
info "Environment loaded from .env"

# ── Validate environment ──────────────────────────────────────────────────────
info "Validating environment variables..."
node "${PROJECT_DIR}/scripts/validate-env.js"

# ── Create log directory ──────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

# ── Install dependencies ──────────────────────────────────────────────────────
info "Installing production dependencies..."
cd "$PROJECT_DIR"
pnpm install --frozen-lockfile --prod

# ── Run database migrations ───────────────────────────────────────────────────
info "Running database migrations..."
pnpm db:push
info "Database migrations complete."

# ── Build application ─────────────────────────────────────────────────────────
if [[ "$MODE" == "start" || "$MODE" == "direct" ]]; then
  info "Building application..."
  pnpm run build
  info "Build complete."
fi

# ── Direct mode (Docker / no PM2) ────────────────────────────────────────────
if [[ "$MODE" == "direct" ]]; then
  info "Starting server directly (no PM2)..."
  export NODE_ENV=production
  exec node dist/index.js
fi

# ── Start or reload with PM2 ─────────────────────────────────────────────────
if [[ "$MODE" == "reload" ]]; then
  info "Performing zero-downtime reload..."
  pm2 reload "${PROJECT_DIR}/ecosystem.config.cjs" --env production
  info "Reload complete."
else
  info "Starting Mesh Enterprise Platform with PM2..."
  pm2 start "${PROJECT_DIR}/ecosystem.config.cjs" --env production
  pm2 save
  info "Platform started."
fi

# ── Health check ──────────────────────────────────────────────────────────────
info "Waiting for health check..."
PORT="${PORT:-3000}"
MAX_RETRIES=12
RETRY=0
until curl -sf "http://localhost:${PORT}/api/health" 2>/dev/null | grep -q '"status":"ok"'; do
  RETRY=$((RETRY + 1))
  if [[ $RETRY -ge $MAX_RETRIES ]]; then
    error "Health check failed after ${MAX_RETRIES} attempts."
    error "Check logs: pm2 logs mesh-enterprise"
    exit 1
  fi
  info "Waiting... (attempt $RETRY/$MAX_RETRIES)"
  sleep 5
done

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   ✓ Mesh Enterprise Platform is RUNNING                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
info "Platform URL:  http://localhost:${PORT}"
info "Health check:  http://localhost:${PORT}/api/health"
info "PM2 logs:      pm2 logs mesh-enterprise"
info "PM2 monitor:   pm2 monit"
echo ""
