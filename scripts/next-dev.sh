#!/usr/bin/env bash
# WSL 等で inotify の上限 (EMFILE) に達しやすいため、ポーリング監視を使う。
set -euo pipefail

export WATCHPACK_POLLING=true
export CHOKIDAR_USEPOLLING=true
export WATCHPACK_POLLING_INTERVAL=1000

echo "- Tunnel:        https://asset-dev.minagu.work (要: cloudflared tunnel run dev-tunnel)"

exec next dev --webpack "$@"
