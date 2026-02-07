"use server"

// Updated History Action with GroupID support
import { prisma } from "@/lib/prisma"

interface HistoryPoint {
    date: string
    totalAssets: number | null
    totalCost: number | null
    [key: string]: string | number | null
}

export async function getHistoryData() {
    try {
        console.log("[getHistoryData] Starting fetch... (v2-group-aware)");

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
        categories.forEach((cat: any) => {
            (cat.transactions || []).forEach((t: any) => {
                dateSet.add(new Date(t.transactedAt).toISOString().slice(0, 10));
            });
        });
        const sortedDates = Array.from(dateSet).sort();

        // ... (rest of step 3 same)
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

        const effectiveTagCache = new Map<number, { name: string, groupId: number }[]>();
        const getEffectiveTags = (id: number): { name: string, groupId: number }[] => {
            if (effectiveTagCache.has(id)) return effectiveTagCache.get(id)!;
            const cat = categoryMap.get(id);
            if (!cat) return [];
            let tags = (cat.tags as any[]).map((t: any) => ({
                name: t.tagOption?.name?.trim(),
                groupId: t.tagGroupId
            })).filter(t => t.name);
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

            // Updated logic: First, apply net flow of transactions for this specific date to current values
            categories.forEach((cat: any) => {
                const txsToday = (cat.transactions as any[] || [])
                    .filter((t: any) => new Date(t.transactedAt).toISOString().slice(0, 10) === dateStrNormalized);

                if (txsToday.length > 0) {
                    const netFlow = txsToday.reduce((sum, t) => {
                        const amt = Number(t.amount);
                        return t.type === 'DEPOSIT' ? sum + amt : (t.type === 'WITHDRAW' ? sum - amt : sum);
                    }, 0);
                    const prevVal = latestValues.get(cat.id) || 0;
                    latestValues.set(cat.id, Math.max(0, prevVal + netFlow));
                }
            });

            // Second, if there's an EXPLICIT valuation record for today, it takes precedence
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

                    // Deduplicate based on groupId + name to ensure uniqueness within the category context
                    const uniqueTagsMap = new Map<string, { name: string, groupId: number }>();
                    tags.forEach(t => {
                        const compositeKey = `${t.groupId}_${t.name}`;
                        uniqueTagsMap.set(compositeKey, t);
                    });

                    uniqueTagsMap.forEach(t => {
                        // Key includes groupId to distinguish identical names in different groups
                        const key = `tag_${t.groupId}_${t.name}`;
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

            point.totalAssets = grossAssets || null;
            point.totalCost = totalCost || null;
            point.netWorth = (grossAssets - liabilities) || null;

            // Clean up tag values that are 0 to be null for cleaner charts
            Object.keys(point).forEach(key => {
                if (key.startsWith('tag_') && point[key] === 0) {
                    point[key] = null;
                }
            });

            return point;
        });

        console.log(`[getHistoryData] Finished. Points generated: ${points.length}`);
        return points;
    } catch (error) {
        console.error("[getHistoryData] CRITICAL ERROR:", error);
        return [];
    }
}
