import { prisma } from "@/lib/prisma"

/**
 * Seeds initial dummy data for a new user.
 */
export async function seedDummyData(userId: string) {
    try {
        console.log(`[seedDummyData] Seeding for user: ${userId}`);

        const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
        const twentyFiveDaysAgo = new Date(new Date().setDate(new Date().getDate() - 25));
        const twentyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 20));
        const twelveDaysAgo = new Date(new Date().setDate(new Date().getDate() - 12));
        const elevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 11));
        const tenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 10));
        const yesterday = new Date(new Date().setDate(new Date().getDate() - 1));

        // 1. Create Tag Group and Options for Classification
        const tagGroup = await prisma.tagGroup.create({
            data: {
                name: "分類",
                order: 0,
                userId,
                options: {
                    create: [
                        { name: "現金", order: 0 },
                        { name: "株式", order: 1 }
                    ]
                }
            },
            include: { options: true }
        });

        const cashOption = tagGroup.options.find(o => o.name === "現金")!;
        const stockOption = tagGroup.options.find(o => o.name === "株式")!;

        // 2. 銀行預金 (現金)
        const bank = await prisma.category.create({
            data: {
                name: "銀行預金",
                color: "#94a3b8",
                isCash: true,
                order: 0,
                userId,
                tags: {
                    create: {
                        tagGroupId: tagGroup.id,
                        tagOptionId: cashOption.id
                    }
                }
            }
        });
        await prisma.transaction.create({
            data: { categoryId: bank.id, amount: 1000000, type: 'DEPOSIT', transactedAt: thirtyDaysAgo, userId }
        });
        await prisma.asset.create({
            data: { categoryId: bank.id, currentValue: 1000000, recordedAt: thirtyDaysAgo, userId }
        });

        // 3. S&P500 (株式分類)
        const sp500 = await prisma.category.create({
            data: {
                name: "S&P500",
                color: "#60a5fa",
                isCash: false,
                order: 1,
                userId,
                tags: {
                    create: {
                        tagGroupId: tagGroup.id,
                        tagOptionId: stockOption.id
                    }
                }
            }
        });
        await prisma.transaction.create({
            data: { categoryId: sp500.id, amount: 500000, type: 'DEPOSIT', transactedAt: thirtyDaysAgo, userId }
        });
        await prisma.asset.create({ data: { categoryId: sp500.id, currentValue: 500000, recordedAt: thirtyDaysAgo, userId } });
        await prisma.asset.create({ data: { categoryId: sp500.id, currentValue: 450000, recordedAt: twentyDaysAgo, userId } });
        await prisma.asset.create({ data: { categoryId: sp500.id, currentValue: 500000, recordedAt: tenDaysAgo, userId } });
        await prisma.asset.create({ data: { categoryId: sp500.id, currentValue: 550000, recordedAt: yesterday, userId } });

        // 4. 個別株 (親アセット)
        const stockRoot = await prisma.category.create({
            data: {
                name: "個別株",
                color: "#10b981",
                isCash: false,
                order: 2,
                userId,
                tags: {
                    create: {
                        tagGroupId: tagGroup.id,
                        tagOptionId: stockOption.id
                    }
                }
            }
        });

        // 5. A社株式 (個別株の子)
        const stockA = await prisma.category.create({
            data: {
                name: "A社株式",
                color: "#34d399",
                isCash: false,
                parentId: stockRoot.id,
                order: 0,
                userId,
                tags: {
                    create: {
                        tagGroupId: tagGroup.id,
                        tagOptionId: stockOption.id
                    }
                }
            }
        });
        await prisma.transaction.create({
            data: { categoryId: stockA.id, amount: 300000, type: 'DEPOSIT', transactedAt: twentyDaysAgo, userId }
        });
        await prisma.asset.create({ data: { categoryId: stockA.id, currentValue: 300000, recordedAt: twentyDaysAgo, userId } });
        await prisma.asset.create({ data: { categoryId: stockA.id, currentValue: 400000, recordedAt: twelveDaysAgo, userId } });
        await prisma.transaction.create({
            data: { categoryId: stockA.id, amount: 150000, type: 'WITHDRAW', realizedGain: 50000, transactedAt: elevenDaysAgo, userId }
        });
        await prisma.asset.create({ data: { categoryId: stockA.id, currentValue: 200000, recordedAt: elevenDaysAgo, userId } });

        // 6. B社株式 (個別株の子)
        const stockB = await prisma.category.create({
            data: {
                name: "B社株式",
                color: "#fbbf24",
                isCash: false,
                parentId: stockRoot.id,
                order: 1,
                userId,
                tags: {
                    create: {
                        tagGroupId: tagGroup.id,
                        tagOptionId: stockOption.id
                    }
                }
            }
        });
        await prisma.transaction.create({
            data: { categoryId: stockB.id, amount: 200000, type: 'DEPOSIT', transactedAt: twentyFiveDaysAgo, userId }
        });
        await prisma.asset.create({ data: { categoryId: stockB.id, currentValue: 200000, recordedAt: twentyFiveDaysAgo, userId } });
        await prisma.transaction.create({
            data: { categoryId: stockB.id, amount: 100000, type: 'DEPOSIT', transactedAt: tenDaysAgo, userId }
        });
        await prisma.asset.create({ data: { categoryId: stockB.id, currentValue: 350000, recordedAt: tenDaysAgo, userId } });

        console.log("[seedDummyData] Successfully seeded detailed dummy data with tags and stock hierarchy.");
    } catch (error) {
        console.error("[seedDummyData] Failed to seed data", error);
    }
}
