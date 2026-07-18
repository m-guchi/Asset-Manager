"use server"

import { cache } from "react"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"
import { syncIndexValues } from "@/lib/index-values-sync"

export const getIndices = cache(async () => {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const indices = await prisma.index.findMany({
        where: { userId },
        orderBy: { order: "asc" },
        include: { values: { orderBy: { recordedAt: "desc" }, take: 1 } },
    })

    return indices.map((idx) => ({
        id: idx.id,
        name: idx.name,
        symbol: idx.symbol,
        color: idx.color,
        order: idx.order,
        hidden: idx.hidden,
        latestValue: idx.values[0]?.value ?? null,
        latestRecordedAt: idx.values[0]?.recordedAt.toISOString() ?? null,
    }))
})

export const getIndexHistories = cache(async () => {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const indices = await prisma.index.findMany({
        where: { userId, hidden: false },
        orderBy: { order: "asc" },
        include: { values: { orderBy: { recordedAt: "asc" } } },
    })

    return indices.map((idx) => ({
        id: idx.id,
        name: idx.name,
        color: idx.color,
        values: idx.values.map((v) => ({ recordedAt: v.recordedAt.toISOString(), value: v.value })),
    }))
})

interface SaveIndexData {
    id?: number
    name: string
    symbol: string
    color: string
    order?: number
    hidden?: boolean
}

export async function saveIndex(data: SaveIndexData) {
    if (!data.name || data.name.length > 50) {
        return { success: false, error: "名称は50文字以内で入力してください" }
    }
    if (!data.symbol || data.symbol.length > 30) {
        return { success: false, error: "シンボルは30文字以内で入力してください" }
    }

    try {
        const userId = await getCurrentUserId()
        if (!userId) return { success: false, error: "ログインが必要です" }

        const baseData = {
            name: data.name,
            symbol: data.symbol,
            color: data.color,
            hidden: !!data.hidden,
        }

        let indexId = data.id
        let symbolChanged = false
        if (indexId) {
            const existing = await prisma.index.findFirst({ where: { id: indexId, userId } })
            if (!existing) return { success: false, error: "指数が見つかりません" }
            symbolChanged = existing.symbol !== data.symbol
            await prisma.index.update({ where: { id: indexId }, data: baseData })
        } else {
            const max = await prisma.index.aggregate({ where: { userId }, _max: { order: true } })
            const created = await prisma.index.create({
                data: { ...baseData, userId, order: (max._max.order ?? -1) + 1 },
            })
            indexId = created.id
        }

        try {
            if (symbolChanged) {
                await prisma.indexValue.deleteMany({ where: { indexId } })
            }
            await syncIndexValues(indexId, data.symbol, "max")
        } catch (syncError) {
            console.error("Initial index value sync failed", syncError)
        }

        revalidatePath("/indices")
        return { success: true }
    } catch (error) {
        console.error("Save index error", error)
        return { success: false, error: "保存に失敗しました" }
    }
}

export async function deleteIndex(id: number) {
    try {
        const userId = await getCurrentUserId()
        if (!userId) return { success: false, error: "ログインが必要です" }

        const owned = await prisma.index.findFirst({ where: { id, userId }, select: { id: true } })
        if (!owned) return { success: false, error: "指数が見つかりません" }

        await prisma.indexValue.deleteMany({ where: { indexId: id } })
        await prisma.index.delete({ where: { id } })
        revalidatePath("/indices")
        return { success: true }
    } catch (error) {
        console.error("Delete index error", error)
        return { success: false }
    }
}

export async function reorderIndicesAction(items: { id: number; order: number }[]) {
    try {
        const userId = await getCurrentUserId()
        if (!userId) return { success: false, error: "ログインが必要です" }

        const ids = items.map((item) => item.id)
        const owned = await prisma.index.findMany({ where: { id: { in: ids }, userId }, select: { id: true } })
        if (owned.length !== ids.length) return { success: false, error: "指数が見つかりません" }

        await prisma.$transaction(
            items.map((item) => prisma.index.update({ where: { id: item.id }, data: { order: item.order } }))
        )
        revalidatePath("/indices")
        return { success: true }
    } catch (error) {
        console.error("Reorder indices failed", error)
        return { success: false }
    }
}
