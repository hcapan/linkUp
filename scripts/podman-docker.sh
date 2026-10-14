#!/usr/bin/env bash
# Docker CLI shim so wrangler can build/run Cloudflare Container images with Podman.
# Drops BuildKit-only flags that podman does not understand.
#   export WRANGLER_DOCKER_BIN="$PWD/scripts/podman-docker.sh"
#   export DOCKER_HOST="unix://$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}')"
args=()
for a in "$@"; do
  case "$a" in
    --provenance=*|--load) ;;
    *) args+=("$a") ;;
  esac
done
exec podman "${args[@]}"
