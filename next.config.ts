import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// package.json からバージョンを取得
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version || '0.0.0';



const nextConfig: NextConfig = {
    basePath: "/asset-manager",
    assetPrefix: "/asset-manager",
    env: {
        NEXT_PUBLIC_APP_VERSION: version,
    },
    // output: 'standalone',
};

export default nextConfig;
