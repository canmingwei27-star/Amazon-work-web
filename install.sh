#!/bin/sh
set -eu
target=${1:-./amazon-work-web}
command -v docker >/dev/null 2>&1 || { echo 'Install/enable Docker in fnOS first'; exit 1; }
command -v curl >/dev/null 2>&1 || { echo 'curl is required'; exit 1; }
mkdir -p "$target"
archive=$(mktemp)
trap 'rm -f "$archive"' EXIT HUP INT TERM
curl --fail --location --retry 3 https://codeload.github.com/canmingwei27-star/Amazon-work-web/tar.gz/refs/heads/main -o "$archive"
tar -xzf "$archive" --strip-components=1 -C "$target"
cd "$target"
sh deploy.sh
