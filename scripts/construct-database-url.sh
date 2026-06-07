#!/usr/bin/env bash
# Build DATABASE_URL from DB_* parts (1Password stores them separately).
set -euo pipefail

: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_NAME:?DB_NAME is required}"

urlencode() {
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

DB_USER_ENC=$(urlencode "$DB_USER")
DB_PASSWORD_ENC=$(urlencode "$DB_PASSWORD")
export DATABASE_URL="mysql://${DB_USER_ENC}:${DB_PASSWORD_ENC}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "DATABASE_URL=${DATABASE_URL}" >> "$GITHUB_ENV"
fi

if [[ $# -eq 0 ]]; then
  exit 0
fi

exec "$@"
