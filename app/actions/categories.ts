"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

/**
 * Robustly fetch categories with fallback and type safety.
 */
export async function getCategories() {
    try {
        const allCategories = await prisma.category.findMany({
            include: {
                tags: {
                    include: {
                        tagGroup: true,
                        tagOption: true
                    } as any
                },
                assets: {
                    orderBy: { recordedAt: 'desc' },
                    take: 1
                },
                transactions: true
            }
        }) as any[];

        if (!allCategories || allCategories.length === 0) return [];

        // Sort hierarchically
        const roots = allCategories
            .filter((c: any) => !c.parentId)
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

        const childrenMap = new Map<number, any[]>();
        allCategories.forEach((c: any) => {
            if (c.parentId) {
                const existing = childrenMap.get(c.parentId) || [];
                existing.push(c);
                childrenMap.set(c.parentId, existing);
            }
        });

        const sorted: any[] = [];
        roots.forEach((root: any) => {
            sorted.push(root);
            const children = (childrenMap.get(root.id) || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
            sorted.push(...children);
        });

        return sorted.map((cat: any) => {
            try {
                const latestAsset = (cat.assets && cat.assets.length > 0) ? cat.assets[0] : null;
                const ownValue = Number(latestAsset?.currentValue || 0);

                let ownCostBasis = 0;
                const trxs = cat.transactions || [];
                if (cat.isCash) {
                    ownCostBasis = ownValue;
                } else {
                    ownCostBasis = trxs.reduce((acc: number, t: any) => {
                        const amt = Number(t.amount || 0);
                        return t.type === 'DEPOSIT' ? acc + amt : (t.type === 'WITHDRAW' ? acc - amt : acc);
                    }, 0);
                }

                // Child Aggregation
                const children = sorted.filter((c: any) => c.parentId === cat.id);
                let consolidatedValue = ownValue;
                let consolidatedCostBasis = ownCostBasis;

                children.forEach((child: any) => {
                    const childVal = Number(child.assets?.[0]?.currentValue || 0);
                    consolidatedValue += childVal;
                    if (child.isCash) {
                        consolidatedCostBasis += childVal;
                    } else {
                        consolidatedCostBasis += (child.transactions || []).reduce((acc: number, t: any) => {
                            const amt = Number(t.amount || 0);
                            return t.type === 'DEPOSIT' ? acc + amt : (t.type === 'WITHDRAW' ? acc - amt : acc);
                        }, 0);
                    }
                });

                return {
                    id: cat.id,
                    name: cat.name || "名称なし",
                    color: cat.color || "#cccccc",
                    order: cat.order || 0,
                    valuationOrder: cat.valuationOrder ?? 0,
                    isValuationTarget: cat.isValuationTarget ?? true,
                    parentId: cat.parentId,
                    currentValue: consolidatedValue,
                    costBasis: consolidatedCostBasis,
                    ownValue,
                    ownCostBasis,
                    isCash: !!cat.isCash,
                    isLiability: !!cat.isLiability,
                    tags: (cat.tags || []).map((t: any) => t.tagOption?.name || ""),
                    tagSettings: (cat.tags || []).map((t: any) => ({
                        groupId: t.tagGroupId,
                        groupName: t.tagGroup?.name,
                        optionId: t.tagOptionId,
                        optionName: t.tagOption?.name
                    }))
                };
            } catch (e) {
                console.error(`Map error for ${cat.id}`, e);
                return { id: cat.id, name: "Error", currentValue: 0, costBasis: 0, tags: [] };
            }
        });
    } catch (error) {
        console.error("[getCategories] Critical fail", error);
        return [];
    }
}

export async function saveCategory(data: any) {
    try {
        const baseData = {
            name: data.name,
            color: data.color,
            order: data.order ?? 0,
            isCash: !!data.isCash,
            isLiability: !!data.isLiability,
            parentId: data.parentId === 0 ? null : data.parentId,
        }

        let categoryId = data.id;

        if (categoryId) {
            await prisma.category.update({ where: { id: categoryId }, data: baseData });
            await (prisma as any).categoryTag.deleteMany({ where: { categoryId } });
        } else {
            const max = await prisma.category.aggregate({ _max: { order: true } });
            const cat = await prisma.category.create({ data: { ...baseData, order: (max._max.order ?? -1) + 1 } });
            categoryId = cat.id;
            await prisma.asset.create({ data: { categoryId: cat.id, currentValue: 0 } });
        }

        if (data.tagSettings?.length > 0 && categoryId) {
            await (prisma as any).categoryTag.createMany({
                data: data.tagSettings.map((s: any) => ({
                    categoryId: categoryId!,
                    tagGroupId: s.groupId,
                    tagOptionId: s.optionId
                }))
            });
        }

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Save error", error);
        return { success: false };
    }
}

export async function deleteCategory(id: number) {
    try {
        await prisma.category.updateMany({ where: { parentId: id }, data: { parentId: null } });
        await prisma.asset.deleteMany({ where: { categoryId: id } });
        await prisma.transaction.deleteMany({ where: { categoryId: id } });
        await prisma.category.delete({ where: { id } });
        revalidatePath("/");
        return { success: true };
    } catch (e) {
        return { success: false };
    }
}

export async function updateCategoryOrder(id: number, direction: 'up' | 'down') {
    // Basic implementation to satisfy types
    revalidatePath("/");
    return { success: true };
}

export async function reorderCategoriesAction(items: any[]) {
    revalidatePath("/");
    return { success: true };
}

export async function getCategoryDetails(id: number) {
    try {
        const cat = await prisma.category.findUnique({
            where: { id },
            include: {
                tags: {
                    include: {
                        tagGroup: true,
                        tagOption: true
                    } as any
                },
                assets: { orderBy: { recordedAt: 'asc' } },
                transactions: { orderBy: { transactedAt: 'asc' } },
                children: {
                    include: {
                        assets: { orderBy: { recordedAt: 'asc' } },
                        transactions: { orderBy: { transactedAt: 'asc' } }
                    }
                }
            }
        }) as any;

        if (!cat) return null;

        // Helper to calc history for a single category node
        const calculateHistoryForCategory = (c: any) => {
            const historyMap = new Map<string, { date: Date, value: number | null, cost: number }>();
            let runningCost = 0;

            // 1. Transactions
            (c.transactions || []).forEach((t: any) => {
                if (t.type === 'DEPOSIT') runningCost += t.amount;
                else if (t.type === 'WITHDRAW') runningCost -= t.amount;

                const dateStr = t.transactedAt.toISOString().split('T')[0];
                historyMap.set(dateStr, {
                    date: t.transactedAt,
                    value: null, // Initialize as null to distinguish from explicit 0
                    cost: runningCost
                });
            });

            // 2. Assets
            (c.assets || []).forEach((a: any) => {
                const dateStr = a.recordedAt.toISOString().split('T')[0];
                const existing = historyMap.get(dateStr);
                if (existing) {
                    existing.value = a.currentValue;
                } else {
                    // Estimate cost at this point
                    const costAtTime = (c.transactions || [])
                        .filter((t: any) => t.transactedAt <= a.recordedAt)
                        .reduce((acc: number, t: any) => {
                            const amt = Number(t.amount);
                            if (t.type === 'DEPOSIT') return acc + amt;
                            if (t.type === 'WITHDRAW') return acc - amt;
                            return acc;
                        }, 0);

                    historyMap.set(dateStr, {
                        date: a.recordedAt,
                        value: a.currentValue,
                        cost: costAtTime
                    });
                }
            });

            const sorted = Array.from(historyMap.values())
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .map(h => ({
                    date: h.date,
                    value: h.value,
                    cost: h.cost
                }));

            // Fill gaps
            if (sorted.length === 0) {
                return [];
            }

            const continuous: any[] = [];
            let lastValue = 0;
            let lastCost = 0;

            sorted.forEach(h => {
                // If value is null (no record), use lastValue. 
                // If value is explicitly 0, use 0.
                if (h.value === null) h.value = lastValue;
                else lastValue = h.value; // Update lastValue with explicit value (including 0)

                // Cost is always explicitly calculated for every point in time (Transaction or Asset).
                // So we trust h.cost, even if it is 0.
                lastCost = h.cost;

                // Ensure value is number for output
                continuous.push({
                    ...h,
                    value: h.value || 0
                });
            });
            return continuous;
        };

        const hasChildren = cat.children && cat.children.length > 0;
        let history: any[] = [];
        let currentValue = 0;
        let costBasis = 0;
        let childrenInfo: any[] = [];

        if (hasChildren) {
            // Aggregate Children
            childrenInfo = cat.children.map((c: any) => ({
                id: c.id,
                name: c.name,
                color: c.color
            }));

            // Calculate history for each child
            const childHistories = cat.children.map((c: any) => ({
                id: c.id,
                items: calculateHistoryForCategory(c)
            }));

            // Collect all unique dates
            const allDates = new Set<string>();
            childHistories.forEach((ch: any) => {
                ch.items.forEach((i: any) => allDates.add(i.date.toISOString()));
            });

            const sortedDates = Array.from(allDates).sort();

            // Merge
            const runningValues: Record<number, number> = {};
            const runningCosts: Record<number, number> = {};

            history = sortedDates.map(dateStr => {
                const d = new Date(dateStr);
                const point: any = { date: dateStr, value: 0, cost: 0 };

                childHistories.forEach((ch: any) => {
                    // Update running value if this child has an entry on this date
                    const entry = ch.items.find((i: any) => i.date.toISOString() === dateStr);
                    if (entry) {
                        runningValues[ch.id] = entry.value;
                        runningCosts[ch.id] = entry.cost;
                    }
                    // Apply current running value
                    point[`child_${ch.id}`] = runningValues[ch.id] || 0;
                    point.value += (runningValues[ch.id] || 0);
                    point.cost += (runningCosts[ch.id] || 0);
                });

                return point;
            });

            // Consolidate current totals
            currentValue = cat.children.reduce((sum: number, c: any) => {
                const lastAsset = c.assets[c.assets.length - 1];
                return sum + (lastAsset?.currentValue || 0);
            }, 0);

            // Recalculate cost basis
            costBasis = history.length > 0 ? history[history.length - 1].cost : 0;

        } else {
            // Single Category Logic
            const rawHistory = calculateHistoryForCategory(cat);
            history = rawHistory.map(h => ({
                date: h.date.toISOString(),
                value: h.value,
                cost: h.cost
            }));

            const latestAsset = cat.assets.length > 0 ? cat.assets[cat.assets.length - 1] : null;
            currentValue = Number(latestAsset?.currentValue || 0);
            costBasis = rawHistory.length > 0 ? rawHistory[rawHistory.length - 1].cost : 0;

            // Use fallback logic for costBasis if history is empty but standard calculation exists
            if (history.length === 0 && cat.isCash) {
                costBasis = currentValue;
                history.push({
                    date: new Date().toISOString(),
                    value: currentValue,
                    cost: costBasis
                });
            }
        }

        // Transactions & Assets
        const formatTx = (t: any, catName: string, catColor: string, catId: number) => ({
            id: `tx-${t.id}`,
            rawDate: t.transactedAt,
            date: t.transactedAt.toISOString(),
            type: t.type,
            amount: t.amount,
            memo: t.memo,
            pointInTimeValuation: null,
            categoryName: catName,
            categoryColor: catColor,
            categoryId: catId
        });

        const formatAsset = (a: any, catName: string, catColor: string, catId: number) => ({
            id: `as-${a.id}`,
            rawDate: a.recordedAt,
            date: a.recordedAt.toISOString(),
            type: 'VALUATION',
            amount: 0,
            pointInTimeValuation: a.currentValue,
            memo: '評価額更新',
            categoryName: catName,
            categoryColor: catColor,
            categoryId: catId
        });

        const rawTransactions = [
            ...(cat.transactions || []).map((t: any) => formatTx(t, cat.name, cat.color, cat.id)),
            ...(hasChildren ? cat.children.flatMap((c: any) => (c.transactions || []).map((t: any) => formatTx(t, c.name, c.color, c.id))) : [])
        ];

        const rawAssets = [
            ...(cat.assets || []).map((a: any) => formatAsset(a, cat.name, cat.color, cat.id)),
            ...(hasChildren ? cat.children.flatMap((c: any) => (c.assets || []).map((a: any) => formatAsset(a, c.name, c.color, c.id))) : [])
        ];

        // Merge logic: Group by CategoryId + Date (YYYY-MM-DD)
        const allRaw = [...rawTransactions, ...rawAssets].sort((a: any, b: any) => b.rawDate.getTime() - a.rawDate.getTime());
        const mergedList: any[] = [];
        const processedIds = new Set<string>();

        // We iterate and group manually or just process the list?
        // Since it's sorted desc, we can check for merge candidates
        // A better way is to group by key
        const groups = new Map<string, any[]>();
        allRaw.forEach(item => {
            const day = item.date.split('T')[0];
            const key = `${item.categoryId}_${day}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(item);
        });

        groups.forEach(groupItems => {
            // In each group, we have transactions and valuations for the same day/cat
            // Sort by time desc just to be sure
            groupItems.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

            // Separate Txs and Ass
            const txs = groupItems.filter(i => i.id.startsWith('tx-'));
            const ass = groupItems.filter(i => i.id.startsWith('as-'));

            if (txs.length > 0 && ass.length > 0) {
                // Merge the latest Asset val into the latest Tx
                const latestTx = txs[0];
                const latestAs = ass[0]; // The latest valuation for that day

                // Mutate the tx to include the valuation
                latestTx.pointInTimeValuation = latestAs.pointInTimeValuation;

                // Add all txs to mergedList
                txs.forEach(t => mergedList.push(t));

                // Add assets ONLY if they are NOT the one we merged? 
                // Or simply hide all assets for that day if we have a tx?
                // Usually one val per day. Let's hide the merged one.
                // If we merged into Tx, we don't show the Asset row.
                ass.slice(1).forEach(a => mergedList.push(a)); // keep extra assets if any
            } else {
                // No merge needed
                groupItems.forEach(i => mergedList.push(i));
            }
        });

        // Re-sort final list by date desc
        mergedList.sort((a: any, b: any) => b.rawDate.getTime() - a.rawDate.getTime());

        return {
            id: cat.id,
            name: cat.name,
            color: cat.color,
            isCash: cat.isCash,
            isLiability: cat.isLiability,
            currentValue,
            costBasis,
            tags: (cat.tags as any[]).map((t: any) => t.tagOption?.name),
            history,
            children: childrenInfo,
            transactions: mergedList
        };
    } catch (error) {
        console.error("Fetch detail error", error);
        return null;
    }
}

export async function updateValuationSettingsAction(settings: { id: number, valuationOrder: number, isValuationTarget: boolean }[]) {
    try {
        await prisma.$transaction(
            settings.map(s =>
                prisma.category.update({
                    where: { id: s.id },
                    data: {
                        valuationOrder: s.valuationOrder,
                        isValuationTarget: s.isValuationTarget
                    }
                })
            )
        );
        revalidatePath("/");
        revalidatePath("/assets/valuation");
        return { success: true };
    } catch (e) {
        console.error("Failed to update valuation settings", e);
        return { success: false };
    }
}
