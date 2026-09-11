#!/usr/bin/env bash
# G10 OWASP ZAP baseline (manual / weekly). Fails on High.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${ZAP_TARGET:-http://host.docker.internal:8080}"
REPORT_DIR="${ROOT}/test-results/zap"
mkdir -p "$REPORT_DIR"

echo "ZAP baseline against ${TARGET}"
docker run --rm \
  -v "${REPORT_DIR}:/zap/wrk:rw" \
  -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t "${TARGET}" -r zap-report.html -I || EXIT=$?

# zap-baseline exit: 0 ok, 1 warnings, 2+ high/fail
EXIT=${EXIT:-0}
if [[ "$EXIT" -ge 2 ]]; then
  echo "ZAP reported High (or worse). See ${REPORT_DIR}/zap-report.html"
  exit 1
fi
echo "ZAP baseline completed (exit ${EXIT}). Report: ${REPORT_DIR}/zap-report.html"
exit 0
