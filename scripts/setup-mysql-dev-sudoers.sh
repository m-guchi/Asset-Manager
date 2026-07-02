#!/usr/bin/env bash
# WSL 内 MySQL の起動・停止・疎通確認を sudo パスワードなしで実行できるようにする。
# Claude Code など非対話環境（sudo のパスワードプロンプトに応答できない）から
# `npm run db:up` / `npm run db:setup` を動かすための初回セットアップ。
#
# 実行には sudo パスワードが必要（対話シェルで一度だけ手動実行する）。
set -euo pipefail

if [[ $EUID -eq 0 ]]; then
  echo "❌ このスクリプトは root ではなく通常ユーザーで実行してください（内部で sudo を使います）"
  exit 1
fi

TARGET_USER="$(whoami)"
SUDOERS_FILE="/etc/sudoers.d/mysql-dev-nopasswd"

RULE="${TARGET_USER} ALL=(root) NOPASSWD: /usr/sbin/service mysql start, /usr/sbin/service mysql stop, /usr/bin/mysqladmin ping -h 127.0.0.1 --silent, /usr/bin/mysql"

echo "▶ ${SUDOERS_FILE} に以下のルールを追加します（sudo パスワードの入力が必要です）:"
echo "  ${RULE}"

TMP_FILE="$(mktemp)"
echo "${RULE}" > "$TMP_FILE"

sudo visudo -cf "$TMP_FILE"
sudo install -o root -g root -m 0440 "$TMP_FILE" "$SUDOERS_FILE"
rm -f "$TMP_FILE"

echo "✅ 設定しました。以降 scripts/db-local.sh の service/mysqladmin/mysql 呼び出しは sudo パスワード不要になります。"
echo "   確認: npm run db:up"
