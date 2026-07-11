# 本番 DB を SSH トンネル経由でローカル接続する場合:
#   npm run prod:tunnel
DB_USER=op://apps/DB/db-user
DB_PASSWORD=op://apps/DB/db-password
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=op://apps/AssetManager/db-name
NEXTAUTH_SECRET=op://apps/AssetManager/nextauth-secret
NEXTAUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=op://apps/AssetManager/auth-google-id
AUTH_GOOGLE_SECRET=op://apps/AssetManager/auth-google-secret
NEXT_PUBLIC_GA_ID=op://apps/AssetManager/ga-id
SIGNALY_LOGIN_WEBHOOK_URL=op://apps/AssetManager/login-webhook-url
SIGNALY_REGISTER_WEBHOOK_URL=op://apps/AssetManager/register-webhook-url
