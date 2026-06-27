#!/usr/bin/env bash
# ローカル MySQL 用の DB_* を設定してコマンドを実行する（1Password 不要）。
set -euo pipefail

export DB_USER="${DB_USER:-asset_manager}"
export DB_PASSWORD="${DB_PASSWORD:-devpassword}"
export DB_HOST="${DB_HOST:-127.0.0.1}"
export DB_PORT="${DB_PORT:-3306}"
export DB_NAME="${DB_NAME:-asset_manager_dev}"

exec bash scripts/construct-database-url.sh "$@"
