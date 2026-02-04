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
        console.log("[getHistoryData] Starting fetch...");

        // 1. Fetch all data at once to minimize DB pressure
        const [historyRecords, categories] = await Promise.all([
            prisma.asset.findMany({ orderBy: { recordedAt: 'asc' } }) as Promise<any[]>,
            prisma.category.findMany({
                include: {
                    tags: { include: { tagOption: true } } as any,
                    transactions: true
                }
            }) as Promise<any[]>
        ]);

        console.log(`[getHistoryData] Data loaded: ${historyRecords.length} records, ${categories.length} categories`);

        if (!historyRecords.length || !categories.length) return [];

        // 2. Normalize and sort dates
        const dateSet = new Set<string>();
        historyRecords.forEach((r: any) => dateSet.add(r.recordedAt.toISOString().slice(0, 10)));
        const sortedDates = Array.from(dateSet).sort();

        // 3. Pre-calculate category relationships and effective tags
        const childrenMap = new Map<number, number[]>();
        const categoryMap = new Map<number, any>();
        categories.forEach((cat: any) => {
            categoryMap.set(cat.id, cat);
            if (cat.parentId) {
                const siblings = childrenMap.get(cat.parentId) || [];
                siblings.push(cat.id);
                childrenMap.set(cat.parentId, siblings);
            }
        });

        const effectiveTagCache = new Map<number, string[]>();
        const getEffectiveTags = (id: number): string[] => {
            if (effectiveTagCache.has(id)) return effectiveTagCache.get(id)!;
            const cat = categoryMap.get(id);
            if (!cat) return [];
            let tags = (cat.tags as any[]).map((t: any) => t.tagOption?.name).filter(Boolean);
            if (tags.length === 0 && cat.parentId) {
                tags = getEffectiveTags(cat.parentId);
            }
            effectiveTagCache.set(id, tags);
            return tags;
        };

        // 4. Initial state
        const latestValues = new Map<number, number>();
        const latestCostBasis = new Map<number, number>();

        // Helper to sum own + children values (Recursive but safe)
        const getConsolidated = (id: number, valSource: Map<number, number>, costSource: Map<number, number>, visited = new Set<number>()): { val: number, cost: number } => {
            if (visited.has(id)) return { val: 0, cost: 0 }; // Circularity protection
            visited.add(id);

            const cat = categoryMap.get(id);
            if (!cat) return { val: 0, cost: 0 };

            const multiplier = cat.isLiability ? -1 : 1;
            let val = (valSource.get(id) || 0) * multiplier;
            let cost = (costSource.get(id) || 0) * (cat.isLiability ? 0 : 1);

            const children = childrenMap.get(id) || [];
            children.forEach(childId => {
                const res = getConsolidated(childId, valSource, costSource, visited);
                val += res.val;
                cost += res.cost;
            });

            return { val, cost };
        };

        // 5. Generate points
        const points: HistoryPoint[] = sortedDates.map(dateStr => {
            const dateObj = new Date(dateStr);
            const dateStrNormalized = dateStr;

            // Update this date's values
            historyRecords
                .filter((r: any) => r.recordedAt.toISOString().slice(0, 10) === dateStrNormalized)
                .forEach((r: any) => latestValues.set(r.categoryId, Number(r.currentValue)));

            // Update cost basis (cumulative transactions)
            categories.forEach((cat: any) => {
                if (cat.isCash) {
                    latestCostBasis.set(cat.id, latestValues.get(cat.id) || 0);
                } else {
                    const cost = (cat.transactions as any[] || [])
                        .filter((t: any) => new Date(t.transactedAt) <= dateObj)
                        .reduce((sum: number, t: any) => {
                            const amt = Number(t.amount);
                            return t.type === 'DEPOSIT' ? sum + amt : (t.type === 'WITHDRAW' ? sum - amt : sum);
                        }, 0);
                    latestCostBasis.set(cat.id, cost);
                }
            });

            const point: HistoryPoint = { date: dateStr, totalAssets: 0, totalCost: 0 };

            // Tag Aggregation (Per Category Contribution)
            categories.forEach((cat: any) => {
                const val = (latestValues.get(cat.id) || 0) * (cat.isLiability ? -1 : 1);
                if (val !== 0) {
                    const tags = getEffectiveTags(cat.id);
                    tags.forEach(t => {
                        const key = `tag_${t}`;
                        point[key] = (Number(point[key]) || 0) + val;
                    });
                }
            });

            // Total Aggregation (Roots only)
            let grossAssets = 0;
            let liabilities = 0;
            let totalCost = 0;

            categories.forEach(cat => {
                if (!cat.parentId) {
                    const res = getConsolidated(cat.id, latestValues, latestCostBasis);
                    if (cat.isLiability) {
                        liabilities += Math.abs(res.val);
                    } else {
                        grossAssets += res.val;
                        totalCost += Math.max(0, res.cost);
                    }
                }
            });

            point.totalAssets = grossAssets;
            point.totalCost = totalCost;
            point.netWorth = grossAssets - liabilities;

            return point;
        });

        console.log(`[getHistoryData] Finished. Points generated: ${points.length}`);
        return points;
    } catch (error) {
        console.error("[getHistoryData] CRITICAL ERROR:", error);
        return [];
    }
}
