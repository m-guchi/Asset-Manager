"use server"

// Updated History Action with GroupID support
import { prisma } from "@/lib/prisma"
import { getCurrentUserId } from "@/lib/auth"

interface HistoryPoint {
    date: string
    totalAssets: number | null
    totalCost: number | null
    [key: string]: string | number | null
}

interface CategoryWithRelations {
    id: number;
    name: string;
    isLiability: boolean;
    isCash: boolean;
    parentId: number | null;
    tags: { tagGroupId: number; tagOption: { name: string } | null }[];
    transactions: { transactedAt: Date; amount: number; type: string }[];
}

export async function getHistoryData() {
    try {
        const userId = await getCurrentUserId()
        if (!userId) {
            console.warn("[getHistoryData] No user ID found, returning empty history");
            return [];
        }
        console.log("[getHistoryData] Starting fetch... (v2-group-aware)");

        // 1. Fetch all data at once to minimize DB pressure
        const [historyRecords, categories] = await Promise.all([
            prisma.asset.findMany({ where: { userId }, orderBy: { recordedAt: 'asc' } }),
            prisma.category.findMany({
                where: { userId },
                include: {
                    tags: { include: { tagOption: true } },
                    transactions: true
                }
            }) as unknown as Promise<CategoryWithRelations[]>
        ]);

        console.log(`[getHistoryData] Data loaded: ${historyRecords.length} records, ${categories.length} categories`);

        if (!historyRecords || !historyRecords.length || !categories || !categories.length) return [];

        // 2. Normalize and sort dates
        const dateSet = new Set<string>();
        historyRecords.forEach((r) => dateSet.add(r.recordedAt.toISOString().slice(0, 10)));
        categories.forEach((cat) => {
            (cat.transactions || []).forEach((t) => {
                dateSet.add(new Date(t.transactedAt).toISOString().slice(0, 10));
            });
        });
        const sortedDates = Array.from(dateSet).sort();

        // ... (rest of step 3 same)
        const childrenMap = new Map<number, number[]>();
        const categoryMap = new Map<number, CategoryWithRelations>();
        categories.forEach((cat) => {
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
            let tags = (cat.tags || []).map((t) => ({
                name: (t.tagOption?.name || "").trim(),
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

        // 4. Pre-collect all unique tag keys to ensure every point has all keys
        const allTagKeys = new Set<string>();
        categories.forEach((cat) => {
            getEffectiveTags(cat.id).forEach(t => {
                allTagKeys.add(`tag_${t.groupId}_${t.name}`);
            });
        });

        // 5. Generate points
        const points: HistoryPoint[] = sortedDates.map(dateStr => {
            const dateObj = new Date(dateStr);
            const dateStrNormalized = dateStr;

            // Updated logic: First, apply net flow of transactions for this specific date to current values
            categories.forEach((cat) => {
                const txsToday = (cat.transactions || [])
                    .filter((t) => new Date(t.transactedAt).toISOString().slice(0, 10) === dateStrNormalized);

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
                .filter((r) => r.recordedAt.toISOString().slice(0, 10) === dateStrNormalized)
                .forEach((r) => latestValues.set(r.categoryId, Number(r.currentValue)));

            // Update cost basis (cumulative transactions)
            categories.forEach((cat) => {
                if (cat.isCash) {
                    latestCostBasis.set(cat.id, latestValues.get(cat.id) || 0);
                } else {
                    const cost = (cat.transactions || [])
                        .filter((t) => new Date(t.transactedAt) <= dateObj)
                        .reduce((sum: number, t) => {
                            const amt = Number(t.amount);
                            return t.type === 'DEPOSIT' ? sum + amt : (t.type === 'WITHDRAW' ? sum - amt : sum);
                        }, 0);
                    latestCostBasis.set(cat.id, cost);
                }
            });

            // Initialize point with ALL tag keys set to 0
            const point: HistoryPoint = {
                date: dateStr,
                totalAssets: 0,
                totalCost: 0,
                timestamp: dateObj.getTime()
            };
            allTagKeys.forEach(k => point[k] = 0);

            // Tag Aggregation (Per Category Contribution)
            categories.forEach((cat) => {
                const val = (latestValues.get(cat.id) || 0) * (cat.isLiability ? -1 : 1);
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
            point.netWorth = (grossAssets - liabilities);

            // The previous logic to set tag values to 0 for null/negative is now handled by initialization
            // and the removal of `if (val !== 0)` condition.
            // However, ensure no negative values remain for tags if they are meant to be non-negative in charts.
            Object.keys(point).forEach(key => {
                if (key.startsWith('tag_') && (Number(point[key]) < 0)) {
                    point[key] = 0;
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
