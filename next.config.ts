import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// package.json からバージョンを取得
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version || '0.0.0';



const nextConfig: NextConfig = {
    env: {
        NEXT_PUBLIC_APP_VERSION: version,
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

export default nextConfig;
