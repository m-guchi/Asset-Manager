import { cache } from "react"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { dashboardCacheTag } from "@/lib/dashboard-cache"
import {
    computeHistoryPoints,
    type HistoryCategory,
    type HistoryPoint,
} from "@/lib/history-compute"
import {
    mapCategoriesFromRows,
    type CategoryWithRelations,
} from "@/lib/map-categories"

const categoryInclude = {
    tags: {
        include: {
            tagGroup: true,
            tagOption: true,
        },
    },
    assets: {
        orderBy: { recordedAt: "desc" as const },
        take: 40,
        select: {
            recordedAt: true,
            currentValue: true,
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
}

function toHistoryCategories(rows: CategoryWithRelations[]): HistoryCategory[] {
    return rows.map((cat) => ({
        id: cat.id,
        name: cat.name,
        isLiability: !!cat.isLiability,
        isCash: !!cat.isCash,
        parentId: cat.parentId,
        tags: cat.tags.map((t) => ({
            tagGroupId: t.tagGroupId,
            tagOption: t.tagOption ? { name: t.tagOption.name } : null,
        })),
        transactions: cat.transactions,
    }))
}

export type FinancialSnapshot = {
    categories: ReturnType<typeof mapCategoriesFromRows>
    historyPoints: HistoryPoint[]
}

async function loadFinancialSnapshot(userId: string): Promise<FinancialSnapshot> {
    const [allCategories, historyRecords] = await Promise.all([
        prisma.category.findMany({
            where: { userId },
            include: categoryInclude,
        }) as Promise<CategoryWithRelations[]>,
        prisma.asset.findMany({
            where: { userId },
            orderBy: { recordedAt: "asc" },
            select: {
                categoryId: true,
                currentValue: true,
                recordedAt: true,
            },
        }),
    ])

    if (!allCategories.length) {
        return { categories: [], historyPoints: [] }
    }

    const categories = mapCategoriesFromRows(allCategories)
    const historyPoints = computeHistoryPoints(
        historyRecords,
        toHistoryCategories(allCategories),
    )

    return { categories, historyPoints }
}

function getCachedFinancialSnapshot(userId: string) {
    return unstable_cache(
        () => loadFinancialSnapshot(userId),
        ["financial-snapshot", userId],
        { revalidate: 300, tags: [dashboardCacheTag(userId)] },
    )
}

/** 1リクエスト内でカテゴリ・履歴の DB 取得と計算を1回にまとめる */
export const getFinancialSnapshot = cache(async (): Promise<FinancialSnapshot> => {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { categories: [], historyPoints: [] }
    }

    try {
        return await getCachedFinancialSnapshot(userId)()
    } catch (error) {
        console.error("[getFinancialSnapshot] Error:", error)
        return { categories: [], historyPoints: [] }
    }
})
