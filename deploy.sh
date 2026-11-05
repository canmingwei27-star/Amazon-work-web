#!/bin/sh
set -eu
# Execute from the project checkout: sh deploy.sh
command -v docker >/dev/null 2>&1 || { echo 'Docker is required'; exit 1; }
docker compose version >/dev/null
if [ ! -f .env ]; then
  umask 077
  password=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
  printf 'SELLFOX_MCP_URL=https://api-mcp.sellfox.com/mcp\nSELLFOX_MCP_KEY=\nDASHBOARD_USER=admin\nDASHBOARD_PASSWORD=%s\n' "$password" > .env
  echo 'Created .env. Login user: admin'
  printf 'Generated login password: %s\n' "$password"
fi
if docker compose pull; then
  docker compose up -d --no-build
else
  echo 'Registry image unavailable; building from downloaded source.'
  docker compose up -d --build
fi
docker compose ps
echo 'Open http://<NAS-IP>:3080 and save the Sellfox key in Interface Settings.'
