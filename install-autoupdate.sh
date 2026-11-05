#!/bin/sh
set -eu
image=ghcr.io/canmingwei27-star/amazon-work-web:latest
target=amazon-work-web-dashboard-1
helper=amazon-work-web-updater
command -v docker >/dev/null 2>&1 || { echo 'Enable Docker in fnOS first.'; exit 1; }
actual=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}/{{index .Config.Labels "com.docker.compose.service"}}' "$target")
[ "$actual" = 'amazon-work-web/dashboard' ] || { echo 'Target mismatch. No changes made.'; exit 1; }
if docker inspect "$helper" >/dev/null 2>&1; then
  owned=$(docker inspect --format '{{index .Config.Labels "io.amazon-work.updater"}}' "$helper")
  [ "$owned" = 'true' ] || { echo 'Container name already used. No changes made.'; exit 1; }
  docker start "$helper" >/dev/null
  echo 'Update helper is already installed. Open System Update in the website.'
  exit 0
fi
docker pull "$image"
docker run -d --name "$helper" --restart unless-stopped --user 0:0 \
  --read-only --no-healthcheck --cap-drop ALL --security-opt no-new-privileges:true \
  --label io.amazon-work.updater=true \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v amazon-work-web_update-state:/updates \
  -v amazon-work-web_update-backups:/backups \
  -e TARGET_CONTAINER="$target" \
  -e UPDATE_STATE_VOLUME=amazon-work-web_update-state \
  --entrypoint node "$image" updater/agent.mjs
echo 'Installed. The helper will attach its status volume and update only the dashboard.'
echo 'Watch progress: docker logs --tail=50 amazon-work-web-updater'
echo 'After the first update, refresh the website and open System Update.'
