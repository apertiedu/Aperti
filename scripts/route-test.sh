#!/usr/bin/env bash
# Aperti Route Health Check
# Usage: bash scripts/route-test.sh [BASE_URL]
# Default BASE_URL: http://localhost:3001

BASE_URL="${1:-http://localhost:${PORT:-3001}}"
PASS=0
FAIL=0
TOTAL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() {
  local label="$1"
  local path="$2"
  local expected_status="${3:-200}"
  local extra_headers="${4:-}"

  TOTAL=$((TOTAL + 1))
  local start_ms=$(date +%s%3N)
  local actual_status
  actual_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -m 8 \
    ${extra_headers:+-H "$extra_headers"} \
    "${BASE_URL}${path}" 2>/dev/null)
  local end_ms=$(date +%s%3N)
  local latency=$((end_ms - start_ms))

  if [ "$actual_status" = "$expected_status" ]; then
    PASS=$((PASS + 1))
    printf "  ${GREEN}✓${NC} %-40s %s  %dms\n" "$label" "$actual_status" "$latency"
  else
    FAIL=$((FAIL + 1))
    printf "  ${RED}✗${NC} %-40s ${RED}%s${NC} (expected %s)  %dms\n" "$label" "$actual_status" "$expected_status" "$latency"
  fi
}

echo ""
echo "🧪 Aperti Route Health Check"
echo "   Target: $BASE_URL"
echo "   Time:   $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

# Public routes (expect 200)
check "Health endpoint"               "/health"                    200
check "Landing data"                  "/api/landing"               200
check "Landing stats"                 "/api/landing/stats"         200
check "Courses list"                  "/courses"                   200

# Auth-protected routes (no token — expect 401)
check "Dashboard (unauth)"            "/api/dashboard"             401
check "Admin health (unauth)"         "/api/admin/health"          401
check "Question bank (unauth)"        "/question-bank"             401
check "Error intelligence (unauth)"   "/api/admin/error-intelligence/summary" 401
check "Learning efficiency (unauth)"  "/api/admin/learning-efficiency"        401
check "Content validation (unauth)"   "/api/admin/content-validation/summary" 401
check "Question extraction (unauth)"  "/api/questions/extract"     401
check "Founder metrics (unauth)"      "/api/founder/metrics"       401

echo ""
echo "  ──────────────────────────────────────────────────"
printf "  ${GREEN}Passed:${NC}  %d/%d\n" "$PASS" "$TOTAL"
if [ "$FAIL" -gt 0 ]; then
  printf "  ${RED}Failed:${NC}  %d\n" "$FAIL"
  echo ""
  exit 1
else
  printf "  ${GREEN}All routes healthy! ✨${NC}\n"
  echo ""
fi
