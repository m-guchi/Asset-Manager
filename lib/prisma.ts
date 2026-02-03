import { PrismaClient } from "@prisma/client";

const isProd = process.env.NODE_ENV === "production";

// Construct settings based on environment
const DB_USER = process.env.DB_USER || "ai_user";
const DB_PASSWORD = process.env.DB_PASSWORD ? encodeURIComponent(process.env.DB_PASSWORD) : "";

let databaseUrl: string;

if (process.env.NODE_ENV === "production") {
    // PRODUCTION: Always use local database inside the server
    const host = process.env.PROD_DB_HOST || "localhost";
    const port = process.env.DB_PORT || "3306";
    const name = process.env.PROD_DB_NAME || "asset_manager";

    // Force construct the production URL, ignoring any DATABASE_URL in .env which is for local dev
    databaseUrl = `mysql://${DB_USER}:${DB_PASSWORD}@${host}:${port}/${name}?sslaccept=acceptinvalid`;
    console.log(`[Prisma] MODE: PRODUCTION (Connecting to ${host}:${port}/${name})`);
} else {
    // DEVELOPMENT: Use .env DATABASE_URL if setup for SSH tunnel, or built from DEV vars
    if (process.env.DATABASE_URL) {
        databaseUrl = process.env.DATABASE_URL;
        console.log(`[Prisma] MODE: DEVELOPMENT (Using .env DATABASE_URL)`);
    } else {
        const host = process.env.DEV_DB_HOST || "127.0.0.1";
        const port = process.env.DEV_DB_PORT || "3307";
        const name = process.env.DB_NAME || "DEV_asset_manager";
        databaseUrl = `mysql://${DB_USER}:${DB_PASSWORD}@${host}:${port}/${name}?sslaccept=acceptinvalid`;
        console.log(`[Prisma] MODE: DEVELOPMENT (Constructed URL for ${host}:${port})`);
    }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
});

if (!isProd) globalForPrisma.prisma = prisma;
