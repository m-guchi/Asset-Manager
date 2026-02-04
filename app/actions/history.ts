"use server"

import { prisma } from "@/lib/prisma"

interface HistoryPoint {
    date: string
    totalAssets: number
    totalCost: number
    [key: string]: string | number
}

export async function getHistoryData() {
    try {
        // 1. Fetch all assets (history points) and transactions
        const historyRecords = await prisma.asset.findMany({
            include: {
                category: {
                    include: { tags: true }
                }
            },
            orderBy: { recordedAt: 'asc' }
        })

        const categories = await prisma.category.findMany({
            include: {
                tags: true,
                transactions: true
            }
        })

        if (historyRecords.length === 0) return []

        // 2. Extract unique dates (normalized to YYYY-MM-DD)
        const uniqueDates = Array.from(new Set(historyRecords.map((r: any) => r.recordedAt.toISOString().slice(0, 10)))).sort() as string[]

        // 3. For each date, calculate the state of ALL assets
        // We use a map to keep track of the LATEST value for each category
        const latestValues: Record<number, number> = {}
        const latestCostBasis: Record<number, number> = {}

        const result: HistoryPoint[] = uniqueDates.map((dateStr: string) => {
            const dateObj = new Date(dateStr)

            // 1. Update own values for this date
            const recordsOnThisDate = historyRecords.filter((r: any) => r.recordedAt.toISOString().slice(0, 10) === dateStr)
            recordsOnThisDate.forEach((r: any) => {
                latestValues[r.categoryId] = Number(r.currentValue)
            })

            // 2. Calculate own cost basis for this date
            categories.forEach((cat: any) => {
                if (cat.isCash) {
                    latestCostBasis[cat.id] = (latestValues[cat.id] || 0)
                } else {
                    latestCostBasis[cat.id] = (cat.transactions || [])
                        .filter((trx: any) => new Date(trx.transactedAt) <= dateObj)
                        .reduce((sum: number, trx: any) => {
                            if (trx.type === 'DEPOSIT') return sum + Number(trx.amount)
                            if (trx.type === 'WITHDRAW') return sum - Number(trx.amount)
                            return sum
                        }, 0)
                }
            })

            // 3. Hierarchical Aggregation for the totals
            // We need to calculate consolidated values (Self + Children) to avoid double counting
            const consolidatedValues: Record<number, number> = {}
            const consolidatedCosts: Record<number, number> = {}

            categories.forEach((cat: any) => {
                // Start with own value
                // FIX: If category has children, we ignore its OWN value to prevent double counting 
                // (assuming parent acts as a folder and shouldn't satisfy assets directly if it has sub-assets)
                const hasChildren = categories.some((c: any) => c.parentId === cat.id);
                let val = hasChildren ? 0 : (latestValues[cat.id] || 0);

                // Use actual cost basis logic (or ignore for parents if needed)
                let cost = hasChildren ? 0 : (latestCostBasis[cat.id] || 0);

                // Add values from all children
                const children = categories.filter((c: any) => c.parentId === cat.id)
                children.forEach((child: any) => {
                    // For children, we take their own values (assuming 2 levels max or recursive)
                    // Note: If 3 levels, this logic needs recursion, but currently seems 2 levels.
                    // To be safe, look up child's raw value.
                    val += (latestValues[child.id] || 0)
                    cost += (latestCostBasis[child.id] || 0)
                })

                consolidatedValues[cat.id] = val
                consolidatedCosts[cat.id] = cost
            })

            const point: HistoryPoint = { date: dateStr, totalAssets: 0, totalCost: 0 }

            // 4. Calculate Final Totals using only TOP-LEVEL categories (to avoid double counting)
            categories.forEach((cat: any) => {
                const multiplier = cat.isLiability ? -1 : 1

                // Breakdown by Tag (Use own values to avoid double counting if multiple items in hierarchy have same tag)
                const hasChildren = categories.some((c: any) => c.parentId === cat.id);
                const val = hasChildren ? 0 : (latestValues[cat.id] || 0)
                const tags = (cat as any).tags || []
                tags.forEach((tag: any) => {
                    const tagName = String(tag.name)
                    const key = `tag_${tagName}`
                    if (!point[key]) point[key] = 0
                    point[key] = Number(point[key]) + (val * multiplier)
                })

                // Breakdown by Category Name (Use consolidated values for top-level, or own values for children)
                // Dashboard usually shows Top-level names in the chart
                const catName = String(cat.name)
                if (!cat.parentId) {
                    // This is a top-level category
                    const aggVal = consolidatedValues[cat.id]
                    const aggCost = consolidatedCosts[cat.id]

                    // EXCLUDE liabilities from the main totals per user request
                    if (!cat.isLiability) {
                        point.totalAssets += aggVal
                        point.totalCost += aggCost
                    }

                    if (!point[catName]) point[catName] = 0
                    point[catName] = Number(point[catName]) + (aggVal * multiplier)
                } else {
                    // For children, we don't add to totals, but we can keep their own name breakdown if needed
                    if (!point[catName]) point[catName] = 0
                    point[catName] = Number(point[catName]) + (val * multiplier)
                }
            })

            return point
        })

        return result
    } catch (error) {
        console.error("Failed to fetch history data:", error)
        return []
    }
}
