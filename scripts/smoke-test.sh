#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:8000}"

echo "==> Logging in..."
TOKEN_JSON=$(curl -sS -X POST "$API/api/v1/auth/login"   -H "Content-Type: application/json"   -d '{"email":"admin@demo-firm.co.uk","password":"Password123!"}')

ACCESS=$(echo "$TOKEN_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

if [ -z "$ACCESS" ]; then
  echo "FAILED: no access token"
  echo "$TOKEN_JSON"
  exit 1
fi

echo "==> Listing matters..."
MATTERS=$(curl -sS "$API/api/v1/matters" -H "Authorization: Bearer $ACCESS")
COUNT=$(echo "$MATTERS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "OK: matters=$COUNT"
