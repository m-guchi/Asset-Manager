import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
    basePath: "/asset-manager",
    assetPrefix: "/asset-manager",

    output: 'standalone',

    // プロジェクトのルートを明示的に指定（パスの誤認を防ぐ）
    outputFileTracingRoot: path.join(__dirname),

    // Prismaを外部パッケージとして扱う
    serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
