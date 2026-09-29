#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

failures=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf '[PASS] %s\n' "$label"
  else
    printf '[FAIL] %s\n' "$label"
    failures=$((failures + 1))
  fi
}

check 'Docker CLI available' command -v docker
check 'Docker Compose v2 available' docker compose version
check 'Docker daemon reachable' docker info
check 'Compose file valid' docker compose config --quiet

if command -v curl >/dev/null 2>&1; then
  if curl -fsS http://localhost:8080/actuator/health >/dev/null 2>&1; then
    echo '[PASS] Backend health endpoint reachable'
  else
    echo '[INFO] Backend is not currently running'
  fi
  if curl -fsS http://localhost:8081 >/dev/null 2>&1; then
    echo '[PASS] Frontend endpoint reachable'
  else
    echo '[INFO] Frontend is not currently running'
  fi
else
  echo '[INFO] curl not installed; runtime endpoint checks skipped'
fi

if [ "$failures" -gt 0 ]; then
  printf '\nCascadeTrace doctor found %s blocking issue(s).\n' "$failures"
  exit 1
fi

printf '\nCascadeTrace environment is ready. Run ./run.sh\n'
