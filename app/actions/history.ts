"use server"

import { cache } from "react"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { dashboardCacheTag } from "@/lib/dashboard-cache"
import { computeHistoryPoints } from "@/lib/history-compute"

export type { HistoryPoint } from "@/lib/history-compute"

async function loadHistoryPoints(userId: string) {
    const [historyRecords, categories] = await Promise.all([
        prisma.asset.findMany({
            where: { userId },
            orderBy: { recordedAt: "asc" },
            select: {
                categoryId: true,
                currentValue: true,
                recordedAt: true,
            },
        }),
        prisma.category.findMany({
            where: { userId },
            select: {
                id: true,
                name: true,
                isLiability: true,
                isCash: true,
                parentId: true,
                tags: {
                    select: {
                        tagGroupId: true,
                        tagOption: { select: { name: true } },
                    },
                },
                transactions: {
                    select: {
                        transactedAt: true,
                        amount: true,
                        type: true,
                        realizedGain: true,
                    },
                },
            },
        }),
    ])

    return computeHistoryPoints(historyRecords, categories)
}

function getCachedHistoryPoints(userId: string) {
    return unstable_cache(
        () => loadHistoryPoints(userId),
        ["history-data", userId],
        { revalidate: 300, tags: [dashboardCacheTag(userId)] },
    )
}

export const getHistoryData = cache(async () => {
    try {
        const userId = await getCurrentUserId()
        if (!userId) return []

        return await getCachedHistoryPoints(userId)()
    } catch (error) {
        console.error("[getHistoryData] Error:", error)
        return []
    }
})
