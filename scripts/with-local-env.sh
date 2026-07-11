#!/usr/bin/env bash
# ローカル開発用の環境変数ラッパー（1Password 不要）。
# .env.local を読み込み、DB_* から DATABASE_URL を組み立ててコマンドを実行する。
# 本番確認は with-op-env 相当（.env.1password.prod.tpl 経由）を使う。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
ENV_EXAMPLE="$ROOT/.env.local.example"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE がありません。" >&2
  echo "  cp $ENV_EXAMPLE $ENV_FILE" >&2
  echo "  作成後、値を編集してください。" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

exec bash "$ROOT/scripts/construct-database-url.sh" "$@"
