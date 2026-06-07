# 1Password secret references for GitHub Actions deploy.
# Vault: apps — AssetManager / DB / Server / githubaction-sshkey. See README.md.
DB_USER=op://apps/DB/db-user
DB_PASSWORD=op://apps/DB/db-password
DB_HOST=op://apps/DB/db-host
DB_PORT=op://apps/DB/db-port
DB_NAME=op://apps/AssetManager/db-name
NEXTAUTH_URL=op://apps/AssetManager/nextauth-url
NEXTAUTH_SECRET=op://apps/AssetManager/nextauth-secret
AUTH_GOOGLE_ID=op://apps/AssetManager/auth-google-id
AUTH_GOOGLE_SECRET=op://apps/AssetManager/auth-google-secret
SMTP_HOST=op://apps/Mail/smtp-host
SMTP_PORT=op://apps/Mail/smtp-port
SMTP_USER=op://apps/Mail/smtp-user
SMTP_PASS=op://apps/Mail/smtp-pass
SMTP_FROM=op://apps/Mail/smtp-from
NEXT_PUBLIC_GA_ID=op://apps/AssetManager/ga-id
DISCORD_APPS_LOGIN_WEBHOOK_URL=op://apps/AssetManager/discord-apps-login
DISCORD_APPS_REGISTER_WEBHOOK_URL=op://apps/AssetManager/discord-apps-register
DISCORD_CI_WEBHOOK_URL=op://apps/AssetManager/discord-ci-deploy
SSH_PRIVATE_KEY=op://apps/githubaction-sshkey/private_key?ssh-format=openssh
HOST=op://apps/Server/host
USERNAME=op://apps/Server/username
SSH_PORT=op://apps/Server/ssh-port
TARGET_DIR=op://apps/AssetManager/target-dir
