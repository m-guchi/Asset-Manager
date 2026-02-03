import type { NextConfig } from "next";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
    basePath: "/asset-manager",
    assetPrefix: "/asset-manager",

    // output: 'standalone',
};

export default nextConfig;
