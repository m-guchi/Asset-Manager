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

```bash
# パッケージのインストール
npm install

# 開発サーバーの起動 (ローカルDBを使用する場合)
npm run dev

# SSHトンネルを経由してリモート開発DBを利用する場合
npm run dev:tunnel
```

---

## 🚀 デプロイ方法 (GitHub Actions 経由)

本アプリケーションは、`main` ブランチへの Push 操作をトリガーとして、VPS等へ自動デプロイされるよう GitHub Actions ワークフロー (`.github/workflows/deploy.yml`) が構成されています。

### 1. サーバー側の前提条件
- Ubuntu 等の Linux サーバー (Node.js 20系 が動作すること)
- SSHログイン可能なユーザーが存在すること
- PM2 がインストールされていること (`npm install -g pm2`)
- 必要な環境（MySQL/PostgreSQL等）がデプロイ先に構築されているか、外部データベースを利用できること

### 2. GitHub Secrets の設定
GitHub レポジトリの **Settings > Secrets and variables > Actions** に移動し、以下の `Repository secrets` を登録してください。

#### デプロイ先サーバー情報
| シークレット名 | 説明 | 例 |
| --- | --- | --- |
| `VPS_HOST` | 接続先サーバーのIPアドレスまたはドメイン | `162.43.74.7` |
| `VPS_PORT` | サーバーのSSHポート番号 | `19622` または `22` |
| `VPS_USER` | SSH接続するユーザー名 | `ubuntu` など |
| `VPS_SSH_KEY` | `VPS_USER` で接続するための SSH秘密鍵 (Private Key) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

#### アプリケーション・DB環境変数
| シークレット名 | 説明 | 例 |
| --- | --- | --- |
| `DATABASE_URL` | 本番用データベースの接続文字列 | `mysql://user:pass@host:3306/db_name` |
| `NEXTAUTH_URL` | 本番環境のベースURL | `https://asset.example.com` |
| `NEXTAUTH_SECRET` | NextAuth のセッション暗号化キー (`openssl rand -base64 32` などで生成) | `ランダムな文字列` |

#### Google OAuth (ログイン用)
| シークレット名 | 説明 |
| --- | --- |
| `AUTH_GOOGLE_ID` | GCP コンソールから取得した Google クライアントID |
| `AUTH_GOOGLE_SECRET` | GCP コンソールから取得した Google クライアントシークレット |

> **⚠️ エラー 400: redirect_uri_mismatch が発生する場合**
> Google Cloud コンソールの「認証情報」画面にて、OAuth 2.0 クライアントの「承認済みのリダイレクト URI」に以下のURLを追加してください。
> - 本番環境: `https://asset.gucchii.com/api/auth/callback/google`
> - ローカル環境: `http://localhost:3000/api/auth/callback/google`

#### メール送信設定 (SMTP)
パスワードリセットなどシステムメール送信用の設定です。
| シークレット名 | 説明 |
| --- | --- |
| `SMTP_HOST` | SMTPサーバーのホスト名 |
| `SMTP_PORT` | SMTPサーバーのポート (例: `587` または `465`) |
| `SMTP_USER` | SMTP認証のユーザー名 |
| `SMTP_PASS` | SMTP認証のパスワード |
| `SMTP_FROM` | 送信元として表示されるメールアドレス |

#### その他
| シークレット名 | 説明 |
| --- | --- |
| `NEXT_PUBLIC_GA_ID` | Google Analytics の測定ID (例: `G-XXXXXXXXXX`) |


### 3. デプロイの実行
設定が完了したら、`main` ブランチへ変更を Push するか、GitHub の Actions タブから `Deploy to VPS` ワークフローを手動で実行 (`workflow_dispatch`) してください。

#### ワークフローの流れ:
1. GitHub 側でビルド (`npm run build`) およびアーカイブの作成が行われます。
2. 作成されたパッケージ (`deploy.tar.gz`) が `scp` でサーバー上の `/home/github-user/asset.gucchii.com` へ転送されます。
3. サーバー上でアーカイブが展開され、`.env` が各 Secret を元に生成されます。
4. 本番用パッケージ (`npm install --omit=dev`) のインストール、Prisma の DB マイグレーションが走ります。
5. `pm2` を利用して Node.js アプリケーションがポート `3102` で再起動されます。
