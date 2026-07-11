import type { NextConfig } from "next";
import path from "path";
import fs from "fs";
import withSerwistInit from "@serwist/next";

// package.json からバージョンを取得
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version || '0.0.0';



const nextConfig: NextConfig = {
    // スマホ等 LAN 上の別端末から sslip.io 経由でアクセスした際に、開発サーバーが
    // クロスオリジンリクエストとして弾かないようにするための許可設定（本番ビルドには影響しない）。
    allowedDevOrigins: ['*.sslip.io'],
    env: {
        NEXT_PUBLIC_APP_VERSION: version,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        NEXT_PUBLIC_NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
                port: '',
                pathname: '/**',
            },
        ],
    },
};

const withSerwist = withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
