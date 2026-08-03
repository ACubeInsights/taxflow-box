#!/usr/bin/env bash
# Smoke test script for production schema against a running API.
# Usage: ./scripts/smoke-test-api.sh https://your-api.example.com

set -euo pipefail

BASE_URL="${1:-http://localhost:3001}"

echo "=== TaxFlow API Smoke Test ==="
echo "Target: $BASE_URL"
echo ""

health=$(curl -sf "$BASE_URL/health" || echo '{"status":"fail"}')
echo "Health: $health"

status=$(echo "$health" | grep -o '"status":"[^"]*"' | head -1 || true)
if [[ "$status" != *"ok"* && "$status" != *"degraded"* ]]; then
  echo "FAIL: /health unreachable"
  exit 1
fi

echo ""
echo "PASS: /health responded"
echo ""
echo "Manual checks remaining:"
echo "  - POST /api/auth/login"
echo "  - GET  /api/projects (with Bearer token)"
echo "  - GET  /api/notifications/:userId"
echo "  - Document preview via /api/vaults/files/:id/embed"
