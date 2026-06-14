#!/usr/bin/env bash
# Aperti One-Click Deploy Script
# Usage: ./deploy.sh [production|development]

set -euo pipefail

ENV="${1:-development}"
SKIP_REPAIR="${SKIP_REPAIR:-0}"
SKIP_TEST="${SKIP_TEST:-1}"

RED="\033[0;31m"; GREEN="\033[0;32m"; YELLOW="\033[0;33m"; CYAN="\033[0;36m"; NC="\033[0m"
T0=$(date +%s)

log()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}  ok${NC} $*"; }
warn() { echo -e "${YELLOW}  warn${NC} $*"; }
fail() { echo -e "${RED}  fail${NC} $*"; exit 1; }

echo ""
echo -e "${CYAN}Aperti Deploy Pipeline -- ${ENV^^}${NC}"
echo ""

# Step 1: Environment validation
log "Validating environment..."
[ -z "${DATABASE_URL:-}" ] && fail "DATABASE_URL is not set. Aborting."
[ -z "${JWT_SECRET:-}"    ] && fail "JWT_SECRET is not set. Aborting."
JWT_LEN=${#JWT_SECRET}
[ "$JWT_LEN" -lt 32 ] && fail "JWT_SECRET is too short ($JWT_LEN chars). Must be >= 32."
ok "DATABASE_URL set"
ok "JWT_SECRET set (${JWT_LEN} chars)"
[ -z "${SESSION_SECRET:-}" ] && warn "SESSION_SECRET not set"
[ -z "${OPENAI_API_KEY:-}" ] && [ -z "${NVIDIA_API_KEY:-}" ] && warn "No AI key configured -- AI features disabled"

# Step 2: Install dependencies
log "Installing dependencies..."
pnpm install --frozen-lockfile && ok "Dependencies installed"

# Step 3: Auto-repair scan
if [ "$SKIP_REPAIR" = "1" ]; then
  warn "SKIP_REPAIR=1 -- skipping repair scan"
else
  log "Running auto-repair scan..."
  if npx ts-node scripts/repair.ts; then
    ok "Repair scan: no critical issues"
  else
    fail "Repair scan found critical issues. Fix them or set SKIP_REPAIR=1 to bypass."
  fi
fi

# Step 4: Build backend
log "Building backend..."
(cd artifacts/api-server && pnpm run build) && ok "Backend built"

# Step 5: Build frontend
log "Building frontend..."
(cd artifacts/aperti && pnpm run build) && ok "Frontend built"

# Step 6: Run tests
if [ "$SKIP_TEST" != "1" ]; then
  log "Running tests..."
  pnpm test --if-present && ok "Tests passed" || fail "Tests failed. Set SKIP_TEST=1 to bypass."
fi

# Step 7: Start/restart via PM2
log "Starting/restarting services via PM2..."
if command -v pm2 &>/dev/null; then
  pm2 startOrRestart ecosystem.config.js --env "$ENV" && ok "PM2 services started"
  pm2 save && ok "PM2 config saved"
else
  warn "PM2 not found -- restart services manually:"
  warn "  cd artifacts/api-server && NODE_ENV=$ENV node dist/index.mjs"
fi

T1=$(date +%s)
ELAPSED=$((T1 - T0))
echo ""
echo -e "${GREEN}Deploy complete in ${ELAPSED}s${NC}"
echo ""
