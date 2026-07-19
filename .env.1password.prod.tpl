# 本番 DB を SSH トンネル経由でローカル接続する場合:
#   npm run prod:tunnel
DB_USER=op://apps/DB/db-user
DB_PASSWORD=op://apps/DB/db-password
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=op://apps/AssetManager/db-name
NEXTAUTH_SECRET=op://apps/AssetManager/nextauth-secret
NEXTAUTH_URL=http://localhost:3000
# スマホ等 LAN/トンネル経由の別端末からアクセスした場合に、リクエストの Host ヘッダーから
# 正しいコールバックURLを自動判定させるための設定（next-auth v4 の挙動）。
# あわせて、本番用 Google OAuth クライアントの承認済みリダイレクト URI に
# https://asset-dev.minagu.work/api/auth/callback/google を追加しておくこと。
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=op://apps/AssetManager/auth-google-id
AUTH_GOOGLE_SECRET=op://apps/AssetManager/auth-google-secret
NEXT_PUBLIC_GA_ID=op://apps/AssetManager/ga-id
SIGNALY_LOGIN_WEBHOOK_URL=op://apps/AssetManager/login-webhook-url
SIGNALY_REGISTER_WEBHOOK_URL=op://apps/AssetManager/register-webhook-url
