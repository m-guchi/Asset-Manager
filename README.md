# Asset-Manager (資産管理アプリケーション)

ポートフォリオの推移と構成を、美しく直感的に管理する資産管理トラッカーです。Next.js (App Router)、Prisma、Tailwind CSS を使用して構築されています。

## 主な機能

- 📊 **ダッシュボード**
  - 総資産、負債、純資産、利益・損益率のサマリー表示
  - アセット構成（円グラフ等）と資産推移（折れ線グラフ）の可視化
  - 資産カテゴリ別の内訳リスト表示

- 💰 **資産・カテゴリ管理**
  - アセット（現金、投資商品、負債など）の自由なカテゴリ分け
  - カスタムタグによる多角的な分類管理
  - 最新の評価額の一括更新

- 📝 **取引履歴 (Transactions)**
  - 資産ごとの取引（入出金や売買など）の記録と管理

- 🔐 **認証・セキュリティ (NextAuth.js)**
  - Google OAuth ログイン対応
  - メールアドレス＆パスワードによるログイン対応
  - メール認証やパスワードリセット機能 (SMTP経由)

- 🎨 **カスタマイズ可能なUI**
  - ダークモード / ライトモード対応
  - レスポンシブデザインによるモバイル表示対応

---

## 開発環境のセットアップ

### 構成の概要

| 環境 | DB | 用途 |
|------|-----|------|
| ローカル（WSL） | `127.0.0.1:3306` / `asset_manager_dev` | 日常開発 |
| 本番（VPS） | 1Password の `db-host` / `db-name` | 本番運用 |
| 本番（ローカル接続） | SSH トンネル `127.0.0.1:3307` | デバッグ用（`prod:tunnel`） |

VPS 上の dev DB は使いません。ローカル開発は WSL 内の MySQL のみで完結します。

### 前提条件

- Node.js 20 系
- WSL 内の MySQL 8.0（`sudo apt install mysql-server`）
- [1Password CLI](https://developer.1password.com/docs/cli/)（`npm run dev` など OAuth / SMTP 注入用）

> Docker Desktop は不要です。WSL 連携が使える環境では `npm run db:up:docker` で Docker 版も利用できます。

### 1Password CLI のインストール（WSL）

`npm run dev` を動かすには `op` コマンドが必要です。DB 操作（`db:setup` など）は `op` なしで実行できます。

```bash
curl -sS https://downloads.1password.com/linux/keys/1password.asc \
  | sudo gpg --dearmor -o /usr/share/keyrings/1password-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" \
  | sudo tee /etc/apt/sources.list.d/1password.list

sudo apt update && sudo apt install -y 1password-cli

# サインイン（デスクトップアプリ連携を有効にすると簡単）
eval "$(op signin)"
npm run verify:op
```

### 初回セットアップ

```bash
# パッケージのインストール
npm install

# MySQL が未インストールの場合（初回のみ）
sudo apt update && sudo apt install -y mysql-server

# ローカル MySQL 起動 + スキーマ適用（初回のみ、sudo パスワード入力あり）
npm run db:setup

# 開発サーバーの起動（1Password から OAuth / SMTP 等を注入）
npm run dev
```

日常の開発では `npm run db:up` で MySQL を起動してから `npm run dev` を実行します（`db:setup` は初回または DB を作り直したときのみ）。

### ローカル DB コマンド

| コマンド | 1Password | 内容 |
|---------|-----------|------|
| `npm run db:up` | 不要 | WSL MySQL を起動（`127.0.0.1:3306`） |
| `npm run db:up:docker` | 不要 | Docker で MySQL 8.0 を起動（`127.0.0.1:3308`） |
| `npm run db:down` | 不要 | ローカル MySQL を停止 |
| `npm run db:status` | 不要 | MySQL の状態確認 |
| `npm run db:setup` | 不要 | 起動 + `prisma db push`（初回用） |
| `npm run db:deploy:local` | 不要 | `schema.prisma` をローカル DB に反映 |
| `npm run db:reset` | 不要 | DB を初期化してスキーマを再適用 |
| `npm run db:dev` | 不要 | マイグレーションファイルの作成（スキーマ変更時） |
| `npm run dev` | **必要** | 開発サーバー起動 |

ローカル DB の接続情報（`.env.1password.tpl` に記載、秘密情報ではない）:

| 項目 | 値 |
|------|-----|
| ホスト | `127.0.0.1` |
| ポート | `3306` |
| DB 名 | `asset_manager_dev` |
| ユーザー | `asset_manager` |
| パスワード | `devpassword` |

### スキーマ同期について

ローカル・CI・本番デプロイはいずれも **`prisma db push`** で `schema.prisma` を DB に反映します（本番は `deploy.yml` 内で実行）。

`prisma/migrations` 内のファイルは古い状態のため、**`migrate deploy` だけでは `Account` など認証用テーブルが作られません**。初回セットアップやスキーマ更新後は必ず `npm run db:setup` または `npm run db:deploy:local` を使ってください。

```bash
# スキーマを変更したあと
npm run db:deploy:local
npm run dev   # 再起動
```

### Google ログイン（ローカル開発）

ローカルでも Google OAuth ログインが使えます。初回ログイン時にダミーデータが自動投入されます。

**必要な設定:**

1. 1Password に `auth-google-id` / `auth-google-secret` / `nextauth-secret` / `nextauth-url-dev`（`http://localhost:3000`）を登録
2. [Google Cloud Console](https://console.cloud.google.com/) の OAuth 2.0 クライアントにリダイレクト URI を追加:

```
http://localhost:3000/api/auth/callback/google
```

3. `npm run db:setup` 済みであること（`Account` テーブルなどが存在する状態）
4. `npm run dev` で `http://localhost:3000/login` を開く

**よくあるエラー:**

| 症状 | 対処 |
|------|------|
| `The table Account does not exist` | `npm run db:deploy:local` を実行してスキーマを同期 |
| `redirect_uri_mismatch` | Google Cloud に上記リダイレクト URI を追加 |
| `op: not found` | 1Password CLI をインストール（上記手順） |
| `Callback` エラーでログイン画面に戻る | DB スキーマ未同期の可能性 → `npm run db:deploy:local` |

### 本番 DB のローカル接続（デバッグ用）

本番データの確認が必要な場合のみ、SSH トンネル経由で接続します。

```bash
npm run prod:tunnel
```

### 環境変数の管理 (1Password)

OAuth・SMTP・NextAuth などの秘密情報は 1Password の `apps` 保管庫で管理します。DB 接続情報は WSL ローカル MySQL 用の固定値を `.env.1password.tpl` に直接記載します。

| 用途 | テンプレート | コマンド | 1Password |
|------|-------------|----------|-----------|
| ローカル開発 | `.env.1password.tpl` | `npm run dev` | OAuth / SMTP 等のみ |
| 本番 DB（ローカル接続） | `.env.1password.prod.tpl` | `npm run prod:tunnel` | DB 認証情報含む |
| GitHub Actions デプロイ | `.github/deploy.env.tpl` | `main` への push で自動実行 | 本番用一式 |

```bash
eval "$(op signin)"   # または export OP_SERVICE_ACCOUNT_TOKEN=...
npm run verify:op     # 参照確認
```

---

## ✅ デプロイ前のテスト・品質チェック

本番環境にデプロイしてビルドエラーを起こさないために、Push前に以下の品質チェックを実行してエラーが出ないか確認することを推奨します。

### 一括実行（推奨）

lint・型チェック・本番ビルドを順番に実行します（`build:local` は 1Password サインインが必要）。

```bash
npm run check
```

### 個別実行

必要に応じて、以下のコマンドを個別に実行することもできます。

```bash
# 1. Linter（静的コード解析）による構文や未使用変数のチェック
npm run lint

# 2. TypeScriptの型チェック（型エラーの検知）
npm run typecheck

# 3. ローカルでの本番ビルドテスト（ローカル DB 接続情報を使用）
npm run build:local
```

すべてのコマンドがエラーなく（`✓ Compiled successfully` など）完了すれば、デプロイやPushの準備は完了です。

---

## 🚀 デプロイ方法 (GitHub Actions 経由)

本アプリケーションは、`main` ブランチへの Push 操作をトリガーとして、VPS等へ自動デプロイされるよう GitHub Actions ワークフロー (`.github/workflows/deploy.yml`) が構成されています。

### 1. サーバー側の前提条件
- Ubuntu 等の Linux サーバー (Node.js 20系 が動作すること)
- SSHログイン可能なユーザーが存在すること
- PM2 がインストールされていること (`npm install -g pm2`)
- 必要な環境（MySQL/PostgreSQL等）がデプロイ先に構築されているか、外部データベースを利用できること

### 2. 1Password の設定

デプロイ用の秘密情報は 1Password で管理し、GitHub Actions から `1password/load-secrets-action` で読み込みます（[MyRoom](https://github.com/gucchii/myroom) と同じ構成）。

#### 2-1. 1Password にデプロイ用アイテムを作成

保管庫名 `apps` に、次のアイテムを作成してください。

**アイテム `AssetManager`**（セキュアノート等）

| フィールド名 | 内容 | 環境変数 |
|-------------|------|----------|
| `db-name` | 本番用データベース名 | `DB_NAME`（デプロイ時に `DATABASE_URL` を組み立て） |
| `nextauth-url` | 本番環境のベース URL | `NEXTAUTH_URL` |
| `nextauth-url-dev` | 開発用ベース URL | 通常 `http://localhost:3000` |
| `nextauth-secret` | NextAuth セッション暗号化キー | `NEXTAUTH_SECRET` |
| `auth-google-id` | Google OAuth クライアント ID | `AUTH_GOOGLE_ID` |
| `auth-google-secret` | Google OAuth クライアントシークレット | `AUTH_GOOGLE_SECRET` |
| `ga-id` | Google Analytics 測定 ID | `NEXT_PUBLIC_GA_ID` |
| `target-dir` | デプロイ先ディレクトリ | 例: `/home/github-user/asset.gucchii.com` |

**アイテム `DB`**（MyRoom と共有可）

| フィールド名 | 内容 | 環境変数 |
|-------------|------|----------|
| `db-user` | MySQL ユーザー名 | `DB_USER` |
| `db-password` | MySQL パスワード | `DB_PASSWORD` |
| `db-host` | 本番用 MySQL ホスト | `DB_HOST`（デプロイ時） |
| `db-port` | 本番用 MySQL ポート | `DB_PORT`（デプロイ時） |

**アイテム `Mail`**（共有可）

| フィールド名 | 内容 | 環境変数 |
|-------------|------|----------|
| `smtp-host` | SMTP サーバーホスト | `SMTP_HOST` |
| `smtp-port` | SMTP ポート | `SMTP_PORT` |
| `smtp-user` | SMTP 認証ユーザー | `SMTP_USER` |
| `smtp-pass` | SMTP 認証パスワード | `SMTP_PASS` |
| `smtp-from` | 送信元メールアドレス | `SMTP_FROM` |

**アイテム `Server`**（MyRoom と共有可）

| フィールド名 | 内容 |
|-------------|------|
| `host` | サーバーのホスト名または IP |
| `username` | SSH ユーザー名 |
| `ssh-port` | SSH ポート番号 |

**アイテム `githubaction-sshkey`**（「SSH 鍵」アイテム型・MyRoom と共有可）

| フィールド ID | 内容 |
|-------------|------|
| `private_key` | サーバー接続用 SSH 秘密鍵 |

Vault 名やアイテム名を変える場合は、`.github/deploy.env.tpl` と `.env.1password.tpl` の `op://...` 参照も合わせて更新してください。

参照の確認:

```bash
op item get AssetManager --vault apps --format json | jq '.fields[] | {id, label}'
op read "op://apps/githubaction-sshkey/private_key?ssh-format=openssh"
```

> **⚠️ エラー 400: redirect_uri_mismatch が発生する場合**
> Google Cloud コンソールの「認証情報」画面にて、OAuth 2.0 クライアントの「承認済みのリダイレクト URI」に以下の URL を追加してください。
> - 本番環境: `https://asset.gucchii.com/api/auth/callback/google`
> - ローカル環境: `http://localhost:3000/api/auth/callback/google`

#### 2-2. Service Account を作成

1. 1Password で Service Account を作成し、`apps` 保管庫への読み取り権限を付与
2. 発行されたトークンを GitHub リポジトリの Secret に登録

| GitHub Secret | 内容 |
|---------------|------|
| `OP_SERVICE_ACCOUNT_TOKEN` | 1Password Service Account のトークン（**これだけ** GitHub に残す） |

以前 GitHub Secrets に登録していた `DATABASE_URL` / `VPS_SSH_KEY` / `VPS_HOST` などは、1Password へ移行後に削除できます。

#### 2-3. 本番サーバーの `.env`

デプロイ時に 1Password から読み込んだ `DB_*` を `scripts/construct-database-url.sh` で `DATABASE_URL` に組み立て、サーバー `.env` に同期します（既存の同名キーは上書き、それ以外は保持）。

| 環境変数 | 1Password アイテム | フィールド |
|----------|-------------------|-----------|
| `DATABASE_URL` | DB + AssetManager | `db-*` + `db-name` から自動生成 |
| `NEXTAUTH_URL` | AssetManager | `nextauth-url` |
| `NEXTAUTH_SECRET` | AssetManager | `nextauth-secret` |
| `AUTH_GOOGLE_ID` | AssetManager | `auth-google-id` |
| `AUTH_GOOGLE_SECRET` | AssetManager | `auth-google-secret` |
| `SMTP_*` | Mail | `smtp-*` |
| `NEXT_PUBLIC_GA_ID` | AssetManager | `ga-id` |


### 3. デプロイの実行
設定が完了したら、`main` ブランチへ変更を Push するか、GitHub の Actions タブから `Deploy to VPS` ワークフローを手動で実行 (`workflow_dispatch`) してください。

#### ワークフローの流れ:
1. 1Password から秘密情報を読み込み、GitHub 側でビルド (`npm run build`) およびアーカイブの作成が行われます。
2. 作成されたパッケージ (`deploy.tar.gz`) が `scp` でサーバーへ転送されます。
3. サーバー上でアーカイブが展開され、`.env` が 1Password の値で同期されます。
4. 本番用パッケージ (`npm install --omit=dev`) のインストール、`prisma db push` による DB スキーマ同期が走ります。
5. `pm2` を利用して Node.js アプリケーションがポート `3102` で再起動されます。
