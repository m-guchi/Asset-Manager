import { prisma } from "@/lib/prisma"
import { fetchIndexDailyValues } from "@/lib/index-data-source"
import { getCalendarDayKey, getJstDayBounds } from "@/lib/valuation-day"

/** 指定した指数の値をYahoo Financeから取得し、IndexValueにupsertする（冪等） */
export async function syncIndexValues(indexId: number, symbol: string, range: "5d" | "max" = "5d"): Promise<number> {
    const points = await fetchIndexDailyValues(symbol, range)

    for (const point of points) {
        const dayKey = getCalendarDayKey(point.recordedAt)
        const { start } = getJstDayBounds(dayKey)
        await prisma.indexValue.upsert({
            where: { indexId_recordedAt: { indexId, recordedAt: start } },
            update: { value: point.value },
            create: { indexId, recordedAt: start, value: point.value },
        })
    }

    return points.length
}
