#!/usr/bin/env bash
# ローカル開発用 MySQL の起動・停止・状態確認。
# デフォルト: WSL 内の MySQL。Docker を使う場合は DB_BACKEND=docker を指定。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_BACKEND="${DB_BACKEND:-native}"
DB_USER="${DB_USER:-asset_manager}"
DB_PASSWORD="${DB_PASSWORD:-devpassword}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-asset_manager_dev}"

action="${1:-up}"

mysql_ping() {
  mysqladmin ping -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" --silent 2>/dev/null
}

mysql_native_up() {
  if ! command -v mysql >/dev/null 2>&1; then
    echo "❌ MySQL クライアントが見つかりません。"
    echo "   sudo apt install mysql-server"
    exit 1
  fi

  echo "▶ WSL MySQL を起動しています..."
  if ! sudo service mysql start; then
    echo "❌ MySQL の起動に失敗しました（sudo パスワードが必要な場合があります）"
    exit 1
  fi

  echo "▶ MySQL の起動を待機しています..."
  ready=0
  for _ in $(seq 1 30); do
    if sudo mysqladmin ping -h 127.0.0.1 --silent 2>/dev/null; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "❌ MySQL が応答しません"
    exit 1
  fi

  echo "▶ 開発用 DB / ユーザーを準備しています..."
  sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

  if ! mysql_ping; then
    echo "❌ アプリ用ユーザーでの接続に失敗しました"
    exit 1
  fi

  echo "✅ WSL MySQL: mysql://${DB_USER}:***@${DB_HOST}:${DB_PORT}/${DB_NAME}"
}

mysql_native_down() {
  echo "▶ WSL MySQL を停止しています..."
  sudo service mysql stop
  echo "✅ MySQL を停止しました"
}

mysql_native_status() {
  if service mysql status 2>/dev/null | grep -q "running"; then
    echo "MySQL サービス: running"
  else
    echo "MySQL サービス: stopped"
  fi
  if mysql_ping; then
    echo "接続: OK (${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME})"
  else
    echo "接続: NG"
  fi
}

mysql_docker_up() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Docker が見つかりません。"
    exit 1
  fi
  docker compose up -d --wait
  echo "✅ Docker MySQL: mysql://root:***@127.0.0.1:3308/asset_manager_dev"
}

mysql_docker_down() {
  docker compose down
}

mysql_docker_status() {
  docker compose ps
}

case "$DB_BACKEND" in
  docker)
    case "$action" in
      up) mysql_docker_up ;;
      down) mysql_docker_down ;;
      status) mysql_docker_status ;;
      logs) docker compose logs -f mysql ;;
      *)
        echo "Usage: $0 {up|down|status|logs}"
        exit 1
        ;;
    esac
    ;;
  native)
    case "$action" in
      up) mysql_native_up ;;
      down) mysql_native_down ;;
      status) mysql_native_status ;;
      logs)
        echo "WSL MySQL のログは次で確認できます:"
        echo "  sudo tail -f /var/log/mysql/error.log"
        ;;
      *)
        echo "Usage: $0 {up|down|status|logs}"
        exit 1
        ;;
    esac
    ;;
  *)
    echo "❌ 不明な DB_BACKEND: $DB_BACKEND（native または docker）"
    exit 1
    ;;
esac
