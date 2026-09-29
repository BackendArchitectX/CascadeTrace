#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

APP_URL="http://localhost:8081"
API_HEALTH_URL="http://localhost:8080/actuator/health"

fail() {
  printf '[CascadeTrace] %s\n' "$1" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail 'Docker is required.'
command -v curl >/dev/null 2>&1 || fail 'curl is required for readiness checks.'
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is required.'
docker info >/dev/null 2>&1 || fail 'Docker daemon is not running.'

if curl -fsS "$APP_URL" >/dev/null 2>&1 && curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1; then
  printf '[CascadeTrace] Already running at %s\n' "$APP_URL"
else
  printf '[CascadeTrace] Building and starting PostgreSQL, Spring Boot, and React...\n'
  docker compose up --build -d

  ready=0
  for _ in $(seq 1 120); do
    if curl -fsS "$APP_URL" >/dev/null 2>&1 && curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 2
  done

  if [ "$ready" -ne 1 ]; then
    docker compose ps
    docker compose logs --tail=100
    fail 'Stack started but readiness checks did not pass.'
  fi
fi

printf '\nCascadeTrace is running.\n'
printf 'Simulator : %s\n' "$APP_URL"
printf 'Archive   : http://localhost:8081/history.html\n'
printf 'Swagger   : http://localhost:8080/swagger-ui.html\n'
printf 'API health: %s\n' "$API_HEALTH_URL"
printf '\nStop with ./stop.sh\n'

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP_URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "$APP_URL" >/dev/null 2>&1 || true
fi
