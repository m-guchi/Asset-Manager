"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

const mockCategories = [
    { name: "生活資金", color: "#3b82f6", baseValue: 500000, isCash: true, tags: ["安全資産", "円建て", "現金・預金"] },
    { name: "生活防衛資金", color: "#60a5fa", baseValue: 1000000, isCash: true, tags: ["安全資産", "円建て", "現金・預金"] },
    { name: "米国ドル", color: "#1d4ed8", baseValue: 400000, isCash: false, tags: ["安全資産", "ドル建て", "現金・預金"] },
    { name: "S&P500", color: "#10b981", baseValue: 0, isCash: false, tags: ["リスク資産", "株式", "投資信託"] },
    { name: "SBI・V・S&P500 (新NISA)", color: "#10b981", baseValue: 800000, isCash: false, tags: ["リスク資産", "株式", "投資信託"], parentName: "S&P500" },
    { name: "eMAXIS Slim S&P500 (旧NISA)", color: "#10b981", baseValue: 1200000, isCash: false, tags: ["リスク資産", "株式", "投資信託"], parentName: "S&P500" },
    { name: "eMAXIS Slim 全世界株式", color: "#22c55e", baseValue: 1500000, isCash: false, tags: ["リスク資産", "株式", "投資信託"] },
    { name: "国内株式TOPIX", color: "#059669", baseValue: 700000, isCash: false, tags: ["リスク資産", "株式"] },
    { name: "ゴールド・ファンド", color: "#eab308", baseValue: 500000, isCash: false, tags: ["リスク資産", "コモディティ"] },
    { name: "ビットコイン", color: "#f97316", baseValue: 500000, isCash: false, tags: ["リスク資産", "暗号資産"] },
    { name: "奨学金返済", color: "#ef4444", baseValue: 2000000, isCash: true, isLiability: true, tags: ["負債"] },
]

export async function seedDatabase() {
    console.log("[Seed] Starting simplified seed procedure...");
    try {
        // Step 1: Clean
        await prisma.transaction.deleteMany()
        await prisma.asset.deleteMany()
        await prisma.category.deleteMany()
        await prisma.tagGroup.deleteMany()
        await prisma.tag.deleteMany()

        // Step 2: Tags and Groups
        const tagGroupsData = [
            { name: "資産クラス別", tags: ["安全資産", "リスク資産"] },
            { name: "通貨別", tags: ["円建て", "ドル建て"] },
            { name: "分類詳細", tags: ["株式", "暗号資産", "コモディティ", "現金・預金", "投資信託", "負債"] }
        ]

        for (const g of tagGroupsData) {
            await prisma.tagGroup.create({
                data: {
                    name: g.name,
                    tags: {
                        create: g.tags.map(name => ({ name }))
                    }
                }
            })
        }

        // Step 3: Assets and History
        const now = new Date()

        for (let i = 0; i < mockCategories.length; i++) {
            const m = mockCategories[i] as any
            const category = await prisma.category.create({
                data: {
                    name: m.name,
                    color: m.color,
                    order: i,
                    isCash: m.isCash,
                    isLiability: m.isLiability,
                    tags: {
                        connect: m.tags.map((name: string) => ({ name }))
                    }
                }
            })

            // Skip history for parent-only categories (value is derived from children)
            const hasChildren = mockCategories.some((other: any) => other.parentName === m.name)
            if (hasChildren) continue

            // Add 10 data points (every 36 days back)
            let currentVal = m.baseValue
            for (let j = 0; j < 10; j++) {
                // Offset the base date slightly for each asset (j * 36 days back, then + i * hours)
                const date = new Date(now.getTime() - (10 - 1 - j) * 36 * 24 * 60 * 60 * 1000)
                // Offset each asset by i * (some hours) so they don't overlap exactly
                date.setHours(date.getHours() + (i * 2))

                // Random variation
                const multiplier = 0.95 + (Math.random() * 0.15) // 0.95 to 1.10
                currentVal = Math.floor(currentVal * multiplier)

                // Add valuation record
                await prisma.asset.create({
                    data: {
                        categoryId: category.id,
                        currentValue: currentVal,
                        recordedAt: date
                    }
                })

                // Add transaction every 3 points for non-cash
                if (!m.isCash && (j % 3 === 0)) {
                    await prisma.transaction.create({
                        data: {
                            categoryId: category.id,
                            type: 'DEPOSIT',
                            amount: 50000,
                            transactedAt: date,
                            memo: "定期購入"
                        }
                    })
                    currentVal += 50000
                }

                // Add valuation log every 5 points
                if (j % 5 === 2) {
                    await prisma.transaction.create({
                        data: {
                            categoryId: category.id,
                            type: 'VALUATION',
                            amount: 0,
                            transactedAt: date,
                            memo: "時価更新"
                        }
                    })
                }
            }
        }

        // Step 4: Link parents
        for (const m of mockCategories as any[]) {
            if (m.parentName) {
                const parent = await prisma.category.findFirst({ where: { name: m.parentName } })
                const child = await prisma.category.findFirst({ where: { name: m.name } })
                if (parent && child) {
                    await prisma.category.update({
                        where: { id: child.id },
                        data: { parentId: parent.id }
                    })
                }
            }
        }

        revalidatePath("/")
        revalidatePath("/assets")
        revalidatePath("/transactions")

        return { success: true, message: "Done" }
    } catch (err) {
        console.error(err)
        return { success: false, error: String(err) }
    }
}
