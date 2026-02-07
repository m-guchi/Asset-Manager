import { prisma } from "../lib/prisma";

async function testConnection() {
    console.log("--- Production DB Connectivity Test ---");
    try {
        // カテゴリを1件取得してみる
        const categoryCount = await prisma.category.count();
        console.log(`✅ Connection Success: Found ${categoryCount} categories.`);

        const sampleTx = await prisma.transaction.findFirst({
            where: { realizedGain: { not: null } }
        });

        if (sampleTx) {
            console.log(`✅ Data Quality: Successfully fetched a row with realizedGain: ${sampleTx.realizedGain}`);
        } else {
            console.log("ℹ️ Note: No transactions with realizedGain found yet (expected for old data).");
        }

        console.log("--- Test Completed Successfully ---");
        process.exit(0);
    } catch (error) {
        console.error("❌ DB Connection/Query Error:");
        console.error(error);
        process.exit(1);
    }
}

testConnection();
