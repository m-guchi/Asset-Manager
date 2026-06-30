# Local development — inject secrets from 1Password:
#   npm run db:setup   # 初回のみ（WSL MySQL 起動 + マイグレーション）
#   npm run dev
DB_USER=asset_manager
DB_PASSWORD=devpassword
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=asset_manager_dev
NEXTAUTH_SECRET=op://apps/AssetManager/nextauth-secret
NEXTAUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=op://apps/AssetManager/auth-google-id
AUTH_GOOGLE_SECRET=op://apps/AssetManager/auth-google-secret
SMTP_HOST=op://apps/Mail/smtp-host
SMTP_PORT=op://apps/Mail/smtp-port
SMTP_USER=op://apps/Mail/smtp-user
SMTP_PASS=op://apps/Mail/smtp-pass
SMTP_FROM=op://apps/Mail/smtp-from
NEXT_PUBLIC_GA_ID=op://apps/AssetManager/ga-id
SIGNALY_LOGIN_WEBHOOK_URL=op://apps/AssetManager/login-webhook-url
SIGNALY_REGISTER_WEBHOOK_URL=op://apps/AssetManager/register-webhook-url
