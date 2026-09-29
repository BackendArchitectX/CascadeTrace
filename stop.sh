#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

echo '[CascadeTrace] Stopping application stack...'
docker compose down
echo '[CascadeTrace] Stopped. PostgreSQL data was preserved.'
