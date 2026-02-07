"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getCurrentUserId } from "@/lib/auth"

interface CategoryWithRelations {
    id: number;
    name: string;
    color: string | null;
    order: number;
    valuationOrder: number | null;
    isValuationTarget: boolean | null;
    parentId: number | null;
    isCash: boolean | null;
    isLiability: boolean | null;
    assets: { id: number; currentValue: number; recordedAt: Date }[];
    tags: {
        tagGroupId: number;
        tagGroup: { name: string };
        tagOptionId: number | null;
        tagOption: { name: string } | null;
    }[];
    transactions: { id: number; amount: number; type: string; memo: string | null; transactedAt: Date; realizedGain: number | null }[];
}

/**
 * Robustly fetch categories with fallback and type safety.
 */
export async function getCategories() {
    try {
        const userId = await getCurrentUserId()
        if (!userId) {
            console.warn("[getCategories] No user ID found, returning empty list");
            return [];
        }
        const allCategories = await prisma.category.findMany({
            where: { userId },
            include: {
                tags: {
                    include: {
                        tagGroup: true,
                        tagOption: true
                    }
                },
                assets: {
                    orderBy: { recordedAt: 'desc' },
                    take: 1
                },
                transactions: true
            }
        }) as unknown as CategoryWithRelations[];

        if (!allCategories || allCategories.length === 0) return [];

        // Sort hierarchically
        const roots = allCategories
            .filter((c) => !c.parentId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const childrenMap = new Map<number, CategoryWithRelations[]>();
        allCategories.forEach((c) => {
            if (c.parentId) {
                const existing = childrenMap.get(c.parentId) || [];
                existing.push(c);
                childrenMap.set(c.parentId, existing);
            }
        });

        const sorted: CategoryWithRelations[] = [];
        roots.forEach((root) => {
            sorted.push(root);
            const children = (childrenMap.get(root.id) || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            sorted.push(...children);
        });

        return sorted.map((cat) => {
            try {
                const latestAsset = (cat.assets && cat.assets.length > 0) ? cat.assets[0] : null;
                const ownValue = Number(latestAsset?.currentValue || 0);

                let ownCostBasis = 0;
                const trxs = cat.transactions || [];
                if (cat.isCash) {
                    ownCostBasis = ownValue;
                } else {
                    ownCostBasis = trxs.reduce((acc: number, t) => {
                        const amt = Number(t.amount || 0);
                        return t.type === 'DEPOSIT' ? acc + amt : (t.type === 'WITHDRAW' ? acc - amt : acc);
                    }, 0);
                }

                // Child Aggregation
                const children = sorted.filter((c) => c.parentId === cat.id);
                let consolidatedValue = ownValue;
                let consolidatedCostBasis = ownCostBasis;

                children.forEach((child) => {
                    const childVal = Number(child.assets?.[0]?.currentValue || 0);
                    consolidatedValue += childVal;
                    if (child.isCash) {
                        consolidatedCostBasis += childVal;
                    } else {
                        consolidatedCostBasis += (child.transactions || []).reduce((acc: number, t) => {
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
                    tags: (cat.tags || []).map((t) => t.tagOption?.name || ""),
                    tagSettings: (cat.tags || []).map((t) => ({
                        groupId: t.tagGroupId,
                        groupName: t.tagGroup?.name || "",
                        optionId: t.tagOptionId,
                        optionName: t.tagOption?.name || ""
                    }))
                };
            } catch (e) {
                console.error(`Map error for ${cat.id}`, e);
                return {
                    id: cat.id,
                    name: "Error",
                    currentValue: 0,
                    costBasis: 0,
                    tags: [],
                    color: "#ccc",
                    order: 0,
                    valuationOrder: 0,
                    isValuationTarget: true,
                    parentId: null,
                    ownValue: 0,
                    ownCostBasis: 0,
                    isCash: false,
                    isLiability: false,
                    tagSettings: []
                };
            }
        });
    } catch (error) {
        console.error("[getCategories] Critical fail", error);
        return [];
    }
}

interface SaveCategoryData {
    id?: number;
    name: string;
    color: string;
    order?: number;
    isCash: boolean;
    isLiability: boolean;
    parentId?: number;
    tagSettings?: { groupId: number, optionId: number }[];
}

export async function saveCategory(data: SaveCategoryData) {
    try {
        const userId = await getCurrentUserId()
        const baseData = {
            name: data.name,
            color: data.color,
            order: data.order ?? 0,
            isCash: !!data.isCash,
            isLiability: !!data.isLiability,
            parentId: data.parentId === 0 ? null : (data.parentId || null),
        }

        let categoryId: number | undefined = data.id;

        if (categoryId) {
            // Fetch existing to preserve order if not provided
            const existing = await prisma.category.findUnique({ where: { id: categoryId }, select: { order: true } });
            await prisma.category.update({
                where: { id: categoryId },
                data: {
                    ...baseData,
                    order: data.order !== undefined ? data.order : (existing?.order ?? 0)
                }
            });
            await prisma.categoryTag.deleteMany({ where: { categoryId } });
        } else {
            const max = await prisma.category.aggregate({ where: { userId }, _max: { order: true } });
            const cat = await prisma.category.create({ data: { ...baseData, userId, order: (max._max.order ?? -1) + 1 } });
            categoryId = cat.id;
            await prisma.asset.create({ data: { categoryId: cat.id, userId, currentValue: 0 } });
        }

        if (data.tagSettings && data.tagSettings.length > 0 && categoryId) {
            await prisma.categoryTag.createMany({
                data: data.tagSettings.map((s) => ({
                    categoryId: categoryId as number,
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
    } catch (error) {
        console.error("Delete error", error);
        return { success: false };
    }
}

export async function updateCategoryOrder() {
    // Basic implementation to satisfy types
    revalidatePath("/");
    return { success: true };
}

export async function reorderCategoriesAction(items: { id: number, order: number }[]) {
    try {
        await prisma.$transaction(
            items.map((item) =>
                prisma.category.update({
                    where: { id: item.id },
                    data: { order: item.order }
                })
            )
        );
        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Reorder failed", error);
        return { success: false };
    }
}

interface TransactionDetail {
    amount: number;
    type: string;
    id: number;
    memo: string | null;
    transactedAt: Date;
    realizedGain: number | null;
}

interface AssetDetail {
    currentValue: number;
    recordedAt: Date;
    id: number;
}

interface CategoryWithNested {
    id: number;
    name: string;
    color: string | null;
    isCash: boolean | null;
    isLiability: boolean | null;
    parentId: number | null;
    transactions: TransactionDetail[];
    assets: AssetDetail[];
    children: (CategoryWithRelations & {
        assets: AssetDetail[];
        transactions: TransactionDetail[];
    })[];
    tags: { tagGroupId: number, tagGroup: { name: string }, tagOptionId: number | null, tagOption: { name: string } | null }[];
    parent: { id: number, name: string } | null;
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
                    }
                },
                assets: { orderBy: { recordedAt: 'asc' } },
                transactions: { orderBy: { transactedAt: 'asc' } },
                children: {
                    include: {
                        assets: { orderBy: { recordedAt: 'asc' } },
                        transactions: { orderBy: { transactedAt: 'asc' } }
                    }
                },
                parent: true
            }
        }) as unknown as CategoryWithNested;

        if (!cat) return null;

        const catWithNested = cat;

        // Helper to calc history for a single category node
        const calculateHistoryForCategory = (c: { transactions: TransactionDetail[], assets: AssetDetail[] }) => {
            const historyMap = new Map<string, { date: Date, value: number | null, cost: number, netFlow: number }>();
            let runningCost = 0;

            // 1. Transactions
            (c.transactions || []).forEach((t) => {
                const amt = Number(t.amount);
                let flow = 0;
                if (t.type === 'DEPOSIT') {
                    runningCost += amt;
                    flow = amt;
                }
                else if (t.type === 'WITHDRAW') {
                    runningCost -= amt;
                    flow = -amt;
                }

                const dateStr = t.transactedAt.toISOString().split('T')[0];
                if (historyMap.has(dateStr)) {
                    const exist = historyMap.get(dateStr)!;
                    exist.cost = runningCost; // Update to latest running cost of the day
                    exist.netFlow += flow;
                } else {
                    historyMap.set(dateStr, {
                        date: t.transactedAt,
                        value: null,
                        cost: runningCost,
                        netFlow: flow
                    });
                }
            });

            // 2. Assets
            (c.assets || []).forEach((a) => {
                const dateStr = a.recordedAt.toISOString().split('T')[0];
                const existing = historyMap.get(dateStr);

                if (existing) {
                    existing.value = a.currentValue;
                } else {
                    // Estimate cost at this point
                    const costAtTime = (c.transactions || [])
                        .filter((t) => t.transactedAt <= a.recordedAt)
                        .reduce((acc: number, t) => {
                            const amt = Number(t.amount);
                            if (t.type === 'DEPOSIT') return acc + amt;
                            if (t.type === 'WITHDRAW') return acc - amt;
                            return acc;
                        }, 0);

                    historyMap.set(dateStr, {
                        date: a.recordedAt,
                        value: a.currentValue,
                        cost: costAtTime,
                        netFlow: 0
                    });
                }
            });

            const sorted = Array.from(historyMap.values())
                .sort((a, b) => a.date.getTime() - b.date.getTime());

            // Fill gaps and create steps
            if (sorted.length === 0) return [];

            interface HistoryPoint {
                date: Date;
                value: number;
                cost: number;
                netFlow: number;
            }

            const processed: HistoryPoint[] = [];

            // Add initial point if needed or just handle logic in loop
            processed.push({ ...sorted[0], value: sorted[0].value || 0 });

            for (let i = 1; i < sorted.length; i++) {
                const prev = processed[processed.length - 1]; // Use last processed point (which has filled value)
                const curr = sorted[i];

                // Calculate day difference
                const dayDiff = Math.floor((curr.date.getTime() - prev.date.getTime()) / (1000 * 60 * 60 * 24));

                // If gap > 1 day, insert a "day before" point to create step effect
                if (dayDiff > 1) {
                    const dayBeforeVar = new Date(curr.date);
                    dayBeforeVar.setDate(curr.date.getDate() - 1);

                    // COST: Use PREVIOUS cost (to keep it flat until the day before change)
                    const fillCost = prev.cost;

                    // VALUE: Back-calculate from Current Value - NetFlow 
                    // (The value "before" the transaction happened)
                    // If current value is null, we can't back-calc, so assume flat from previous (or let fill logic handle)
                    // If current value is set, we assume that includes the flow. 
                    let fillValue = prev.value;
                    if (curr.value !== null) {
                        // User request: "If 1/8 has 10k deposit, previous day likely 10k lower"
                        fillValue = curr.value - curr.netFlow;
                        if (fillValue < 0) fillValue = 0; // Guard
                    }

                    processed.push({
                        date: dayBeforeVar,
                        value: fillValue,
                        cost: fillCost,
                        netFlow: 0
                    });
                }

                // Process current point
                // Logic to carry over value if null
                const valFromPrev = (prev.value || 0) + curr.netFlow;
                let actualValue: number = curr.value !== null ? curr.value : valFromPrev;
                if (actualValue < 0) actualValue = 0;

                processed.push({
                    date: curr.date,
                    value: actualValue,
                    cost: curr.cost,
                    netFlow: curr.netFlow
                });
            }

            return processed.map(p => ({
                date: p.date,
                value: p.value,
                cost: p.cost
            }));
        };

        const hasChildren = catWithNested.children && catWithNested.children.length > 0;
        let history: Record<string, number | string>[] = [];
        let currentValue = 0;
        let costBasis = 0;
        let childrenInfo: { id: number, name: string, color: string, currentValue: number, isLiability: boolean }[] = [];

        if (hasChildren) {
            // Aggregate Children
            childrenInfo = catWithNested.children.map((c) => {
                const lastAsset = c.assets.length > 0 ? c.assets[c.assets.length - 1] : null;
                return {
                    id: c.id,
                    name: c.name,
                    color: c.color || "#ccc",
                    currentValue: lastAsset?.currentValue || 0,
                    isLiability: !!c.isLiability
                };
            });

            // Calculate history for each child
            const childHistories = catWithNested.children.map((c) => ({
                id: c.id,
                items: calculateHistoryForCategory(c)
            }));

            // Collect all unique dates (normalized to YYYY-MM-DD)
            const allDates = new Set<string>();
            childHistories.forEach((ch) => {
                ch.items.forEach((i: { date: Date }) => allDates.add(i.date.toISOString().split('T')[0]));
            });

            const sortedDates = Array.from(allDates).sort();

            // Merge
            const runningValues: Record<number, number> = {};
            const runningCosts: Record<number, number> = {};

            history = sortedDates.map(dateStr => {
                const point: Record<string, number | string> = { date: dateStr, value: 0, cost: 0 };

                childHistories.forEach((ch) => {
                    // Update running value if this child has an entry on this date
                    const entry = ch.items.find((i: { date: Date }) => i.date.toISOString().split('T')[0] === dateStr);
                    if (entry) {
                        runningValues[ch.id] = (entry as { value: number }).value;
                        runningCosts[ch.id] = (entry as { cost: number }).cost;
                    }
                    // Apply current running value
                    point[`child_${ch.id}`] = runningValues[ch.id] || 0;
                    point.value = (point.value as number) + (runningValues[ch.id] || 0);
                    point.cost = (point.cost as number) + (runningCosts[ch.id] || 0);
                });

                return point;
            });

            // Consolidate current totals
            currentValue = catWithNested.children.reduce((sum: number, c) => {
                const lastAsset = c.assets[c.assets.length - 1];
                return sum + Number(lastAsset?.currentValue || 0);
            }, 0);

            // Recalculate cost basis
            costBasis = history.length > 0 ? Number(history[history.length - 1].cost || 0) : 0;

        } else {
            // Single Category Logic
            const rawHistory = calculateHistoryForCategory(catWithNested);
            history = rawHistory.map(h => ({
                date: h.date.toISOString(),
                value: h.value as number,
                cost: h.cost
            }));

            const latestAsset = catWithNested.assets.length > 0 ? catWithNested.assets[catWithNested.assets.length - 1] : null;
            currentValue = Number(latestAsset?.currentValue || 0);
            costBasis = rawHistory.length > 0 ? rawHistory[rawHistory.length - 1].cost : 0;

            // Use fallback logic for costBasis if history is empty but standard calculation exists
            if (history.length === 0 && catWithNested.isCash) {
                costBasis = currentValue;
                history.push({
                    date: new Date().toISOString(),
                    value: currentValue,
                    cost: costBasis
                });
            }
        }

        // Transactions & Assets
        const formatTx = (t: { id: number, transactedAt: Date, type: string, amount: number, memo: string | null, realizedGain: number | null }, catName: string, catColor: string, catId: number) => ({
            id: `tx-${t.id}`,
            rawDate: t.transactedAt,
            date: t.transactedAt.toISOString(),
            type: t.type,
            amount: t.amount,
            memo: t.memo,
            pointInTimeValuation: null as number | null,
            categoryName: catName,
            categoryColor: catColor,
            categoryId: catId,
            realizedGain: t.realizedGain
        });

        const formatAsset = (a: { id: number, recordedAt: Date, currentValue: number }, catName: string, catColor: string, catId: number) => ({
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
            ...(catWithNested.transactions || []).map((t) => formatTx(t, catWithNested.name, catWithNested.color || "#ccc", catWithNested.id)),
            ...(hasChildren ? catWithNested.children.flatMap((c) => (c.transactions || []).map((t) => formatTx(t, c.name, c.color || "#ccc", c.id))) : [])
        ];

        const rawAssets = [
            ...(catWithNested.assets || []).map((a) => formatAsset(a, catWithNested.name, catWithNested.color || "#ccc", catWithNested.id)),
            ...(hasChildren ? catWithNested.children.flatMap((c) => (c.assets || []).map((a) => formatAsset(a, c.name, c.color || "#ccc", c.id))) : [])
        ];

        // Merge logic: Group by CategoryId + Date (YYYY-MM-DD)
        const allRaw = [...rawTransactions, ...rawAssets].sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
        interface MergedItem {
            id: string;
            rawDate: Date;
            date: string;
            type: string;
            amount: number;
            memo: string | null;
            pointInTimeValuation: number | null;
            categoryName: string;
            categoryColor: string;
            categoryId: number;
            realizedGain?: number | null;
            profitRatio?: number | null;
        }
        const mergedList: MergedItem[] = [];

        const groups = new Map<string, MergedItem[]>();
        allRaw.forEach(item => {
            const day = item.date.split('T')[0];
            const key = `${item.categoryId}_${day}`;
            if (!groups.has(key)) groups.set(key, []);
            const group = groups.get(key);
            if (group) group.push(item);
        });

        groups.forEach(groupItems => {
            groupItems.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
            const txs = groupItems.filter(i => i.id.startsWith('tx-'));
            const ass = groupItems.filter(i => i.id.startsWith('as-'));

            if (txs.length > 0 && ass.length > 0) {
                const latestTx = txs[0];
                const latestAs = ass[0];
                latestTx.pointInTimeValuation = latestAs.pointInTimeValuation;
                txs.forEach(t => mergedList.push(t));
                ass.slice(1).forEach(a => mergedList.push(a));
            } else {
                groupItems.forEach(i => mergedList.push(i));
            }
        });

        mergedList.forEach((item) => {
            const dateStr = item.date.split('T')[0];
            const historyItem = history.find((h) => (h.date as string).startsWith(dateStr));

            if (historyItem && Number(historyItem.cost) > 0) {
                const profit = (historyItem.value as number) - (historyItem.cost as number);
                item.profitRatio = (profit / (historyItem.cost as number)) * 100;

                if (item.pointInTimeValuation === null || item.pointInTimeValuation === undefined) {
                    item.pointInTimeValuation = historyItem.value as number;
                }
            } else {
                item.profitRatio = null;
            }
        });

        mergedList.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

        return {
            id: catWithNested.id,
            name: catWithNested.name,
            color: catWithNested.color || "#ccc",
            isCash: catWithNested.isCash,
            isLiability: catWithNested.isLiability,
            currentValue,
            costBasis,
            tags: (catWithNested.tags || []).map((t) => t.tagOption?.name),
            history,
            children: childrenInfo,
            parent: catWithNested.parent ? { id: catWithNested.parent.id, name: catWithNested.parent.name } : null,
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
