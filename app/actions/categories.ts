"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getCategories() {
    try {
        // 1. Fetch all categories first (flat)
        const categories = await prisma.category.findMany({
            orderBy: { order: 'asc' },
            include: {
                tags: true,
                assets: {
                    orderBy: { recordedAt: 'desc' },
                    take: 1
                },
                transactions: true
            }
        });

        if (!categories || categories.length === 0) return [];

        // 2. Fetch tag groups and tags for conflict check
        let tagGroups: any[] = [];
        try {
            tagGroups = await prisma.tagGroup.findMany({ include: { tags: true } });
        } catch (e) {
            console.error("[getCategories] TagGroups fetch error:", e);
        }

        // 3. Manually map and aggregate (instead of deep include)
        const mapped = categories.map((cat: any) => {
            try {
                // Own values
                const latestAssets = cat.assets || [];
                const latestAsset = latestAssets.length > 0 ? latestAssets[0] : null;
                const ownValue = Number(latestAsset?.currentValue || 0);

                // Own cost basis
                let ownCostBasis = 0;
                const trxs = cat.transactions || [];
                if (cat.isCash) {
                    ownCostBasis = ownValue;
                } else {
                    ownCostBasis = trxs.reduce((acc: number, trx: any) => {
                        const amt = Number(trx?.amount || 0);
                        if (trx?.type === 'DEPOSIT') return acc + amt;
                        if (trx?.type === 'WITHDRAW') return acc - amt;
                        return acc;
                    }, 0);
                }

                let consolidatedValue = ownValue;
                let consolidatedCostBasis = ownCostBasis;

                // Sub-assets aggregation (finding children manually)
                const children = categories.filter((c: any) => c.parentId === cat.id);
                children.forEach((child: any) => {
                    const childLatest = child.assets?.[0];
                    const childVal = Number(childLatest?.currentValue || 0);
                    consolidatedValue += childVal;

                    if (child.isCash) {
                        consolidatedCostBasis += childVal;
                    } else {
                        const childTrxs = child.transactions || [];
                        consolidatedCostBasis += childTrxs.reduce((acc: number, trx: any) => {
                            const amt = Number(trx?.amount || 0);
                            if (trx?.type === 'DEPOSIT') return acc + amt;
                            if (trx?.type === 'WITHDRAW') return acc - amt;
                            return acc;
                        }, 0);
                    }
                });

                // Tag conflict detection
                const conflicts: string[] = [];
                const catTags = cat.tags || [];
                tagGroups.forEach(group => {
                    const groupTagIds = (group.tags || []).map((t: any) => t.id);
                    const matchedTags = catTags.filter((t: any) => t && groupTagIds.includes(t.id));
                    if (matchedTags.length > 1) conflicts.push(group.name);
                });

                return {
                    id: cat.id,
                    name: cat.name || "名称なし",
                    color: cat.color || "#cccccc",
                    order: cat.order || 0,
                    parentId: cat.parentId,
                    currentValue: consolidatedValue, // Aggregated for parents
                    costBasis: consolidatedCostBasis, // Aggregated for parents
                    ownValue: ownValue,
                    ownCostBasis: ownCostBasis,
                    isCash: !!cat.isCash,
                    isLiability: !!cat.isLiability,
                    tags: catTags.map((t: any) => t?.name || ""),
                    conflicts
                };
            } catch (err) {
                console.error(`[getCategories] Map error for ${cat?.id}:`, err);
                return {
                    id: cat?.id || 0,
                    name: cat?.name || "Error",
                    color: cat?.color || "#ff0000",
                    order: cat?.order || 0,
                    parentId: cat?.parentId || null,
                    currentValue: 0,
                    costBasis: 0,
                    ownValue: 0,
                    ownCostBasis: 0,
                    isCash: !!cat?.isCash,
                    isLiability: !!cat?.isLiability,
                    tags: [],
                    conflicts: []
                };
            }
        });

        return mapped;
    } catch (error) {
        console.error("[getCategories] CRITICAL ERROR:", error);
        return [];
    }
}

export async function saveCategory(data: {
    id?: number
    name: string
    color: string
    order?: number
    isCash: boolean
    isLiability: boolean
    tags: string[]
    parentId?: number | null
}) {
    try {
        const baseData = {
            name: data.name,
            color: data.color,
            order: data.order ?? 0,
            isCash: data.isCash,
            isLiability: data.isLiability,
            parentId: data.parentId === 0 ? null : data.parentId,
        }

        if (data.id) {
            await prisma.category.update({
                where: { id: data.id },
                data: {
                    ...baseData,
                    tags: {
                        set: [],
                        connectOrCreate: data.tags.map(tagName => ({
                            where: { name: tagName },
                            create: { name: tagName }
                        }))
                    }
                }
            })
        } else {
            // Find max order for new asset
            const maxOrder = await prisma.category.aggregate({
                _max: { order: true }
            })
            const nextOrder = (maxOrder._max.order ?? -1) + 1

            const category = await prisma.category.create({
                data: {
                    ...baseData,
                    order: data.order ?? nextOrder,
                    tags: {
                        connectOrCreate: data.tags.map(tagName => ({
                            where: { name: tagName },
                            create: { name: tagName }
                        }))
                    }
                }
            })
            await prisma.asset.create({
                data: {
                    categoryId: category.id,
                    currentValue: 0
                }
            })
        }
        revalidatePath("/")
        revalidatePath("/assets")
        return { success: true }
    } catch (error) {
        console.error("Failed to save asset:", error)
        return { success: false, error }
    }
}

export async function updateCategoryOrder(id: number, direction: 'up' | 'down') {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { order: 'asc' }
        })
        const index = categories.findIndex(c => c.id === id)
        if (index === -1) return { success: false }

        const target = categories[index]
        let swapWith = null

        if (direction === 'up' && index > 0) {
            swapWith = categories[index - 1]
        } else if (direction === 'down' && index < categories.length - 1) {
            swapWith = categories[index + 1]
        }

        if (swapWith) {
            await prisma.$transaction([
                prisma.category.update({
                    where: { id: target.id },
                    data: { order: swapWith.order }
                }),
                prisma.category.update({
                    where: { id: swapWith.id },
                    data: { order: target.order }
                })
            ])
        }

        revalidatePath("/")
        revalidatePath("/assets")
        return { success: true }
    } catch (error) {
        console.error("Failed to update order:", error)
        return { success: false }
    }
}

export async function deleteCategory(id: number) {
    try {
        // Clear parentId for children before deleting
        await prisma.category.updateMany({
            where: { parentId: id },
            data: { parentId: null }
        })
        await prisma.asset.deleteMany({ where: { categoryId: id } })
        await prisma.transaction.deleteMany({ where: { categoryId: id } })
        await prisma.category.delete({ where: { id } })
        revalidatePath("/")
        revalidatePath("/assets")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete asset:", error)
        return { success: false }
    }
}

export async function getCategoryDetails(id: number) {
    try {
        if (!id || isNaN(id)) return null;

        // 1. Get the target category
        const category = await prisma.category.findUnique({
            where: { id },
            include: {
                tags: true,
                assets: { orderBy: { recordedAt: 'asc' } },
                transactions: { orderBy: { transactedAt: 'desc' } }
            }
        })

        if (!category) return null;

        // 2. Fetch children separately to avoid deep nested recursive query failure
        const children = await prisma.category.findMany({
            where: { parentId: id },
            include: {
                assets: { orderBy: { recordedAt: 'asc' } },
                transactions: true
            }
        });

        // Collect all assets and transactions (Self + Children)
        let allAssets = [...(category.assets || [])];
        let allTransactions = [...(category.transactions || [])];

        children.forEach((child: any) => {
            allAssets = [...allAssets, ...(child.assets || [])];
            allTransactions = [...allTransactions, ...(child.transactions || [])];
        });

        // Current Value Aggregation
        const latestAssetSelfArr = category.assets || [];
        const latestAssetSelf = latestAssetSelfArr.length > 0 ? latestAssetSelfArr[latestAssetSelfArr.length - 1] : null;
        let aggCurrentValue = Number(latestAssetSelf?.currentValue || 0);
        children.forEach((child: any) => {
            const childLatestArr = child.assets || [];
            const childLatest = childLatestArr.length > 0 ? childLatestArr[childLatestArr.length - 1] : null;
            aggCurrentValue += Number(childLatest?.currentValue || 0);
        });

        // Cost Basis Aggregation
        let costBasis = 0;
        if (category.isCash) {
            costBasis = aggCurrentValue;
        } else {
            const ownCost = (category.transactions || []).reduce((acc: number, trx: any) => {
                const amt = Number(trx.amount || 0);
                if (trx.type === 'DEPOSIT') return acc + amt;
                if (trx.type === 'WITHDRAW') return acc - amt;
                return acc;
            }, 0);

            let childrenCost = 0;
            children.forEach((child: any) => {
                const childTrxs = child.transactions || [];
                childrenCost += childTrxs.reduce((acc: number, trx: any) => {
                    const amt = Number(trx.amount || 0);
                    if (trx.type === 'DEPOSIT') return acc + amt;
                    if (trx.type === 'WITHDRAW') return acc - amt;
                    return acc;
                }, 0);
            });
            costBasis = ownCost + childrenCost;
        }

        // 1. Collect ALL unique dates where EITHER an asset valuation OR a transaction happened
        const allEventDates = new Set<string>();
        allAssets.forEach(a => {
            if (a.recordedAt) allEventDates.add(a.recordedAt.toISOString().slice(0, 10));
        });
        allTransactions.forEach(t => {
            if (t.transactedAt) allEventDates.add(t.transactedAt.toISOString().slice(0, 10));
        });

        const sortedDates = Array.from(allEventDates).sort();
        const latestValuations: Record<number, number> = {}; // categoryId -> current valuation

        // We need to calculate a baseline for valuation if transactions exist before the first valuation record
        const combinedHistory = sortedDates.map(dateStr => {
            const dateObj = new Date(dateStr);
            const endOfDay = new Date(dateStr);
            endOfDay.setHours(23, 59, 59, 999);
            const endOfDayTime = endOfDay.getTime();

            // Valuation: Update latest known value
            allAssets
                .filter(a => a.recordedAt && a.recordedAt.toISOString().slice(0, 10) === dateStr)
                .forEach(a => {
                    latestValuations[a.categoryId] = Number(a.currentValue || 0);
                });

            // Cost Basis: Cumulative sum of transactions up to this date
            let currentCost = 0;
            if (category.isCash) {
                // For cash, cost = valuation at that time
                const currentVal = Object.values(latestValuations).reduce((acc, v) => acc + v, 0);
                currentCost = currentVal;
            } else {
                currentCost = allTransactions
                    .filter(tx => tx.transactedAt && new Date(tx.transactedAt).getTime() <= endOfDayTime)
                    .reduce((acc: number, tx: any) => {
                        const amt = Number(tx.amount || 0);
                        if (tx.type === 'DEPOSIT') return acc + amt;
                        if (tx.type === 'WITHDRAW') return acc - amt;
                        return acc;
                    }, 0);
            }

            // Valuation Adjustment: If we have a cost (deposits) but no valuation recorded YET, 
            // assume valuation = cost (book value) for the chart to start correctly
            let totalVal = Object.values(latestValuations).reduce((acc, v) => acc + v, 0);
            if (totalVal === 0 && currentCost > 0) {
                totalVal = currentCost;
            }

            return {
                date: dateStr,
                value: totalVal,
                cost: currentCost
            };
        });

        // Format timeline
        const finalTransactions = [
            ...allTransactions.map((tx: any) => {
                const txAmt = Number(tx?.amount || 0);
                const txValuationAtTime = allAssets
                    .filter((a: any) => a && a.recordedAt && a.recordedAt <= tx.transactedAt)
                    .reduce((acc, a) => acc + Number(a.currentValue || 0), 0);

                return {
                    id: `tx-${tx?.id}`,
                    date: tx?.transactedAt,
                    type: tx?.type || "TRANSACTION",
                    amount: txAmt,
                    memo: tx?.memo || "",
                    pointInTimeValuation: txValuationAtTime
                };
            }),
            ...allAssets
                .filter(a => a && a.recordedAt && !allTransactions.some((tx: any) => tx?.transactedAt && tx.transactedAt.toISOString() === a.recordedAt.toISOString()))
                .map((a: any) => ({
                    id: `as-${a?.id}`,
                    date: a?.recordedAt,
                    type: 'VALUATION',
                    amount: 0,
                    memo: "時価評価の記録",
                    pointInTimeValuation: Number(a?.currentValue || 0)
                }))
        ].sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });

        return {
            ...category,
            currentValue: aggCurrentValue,
            costBasis: costBasis,
            tags: (category.tags || []).map((t: any) => t?.name || ""),
            history: combinedHistory,
            transactions: finalTransactions
        };
    } catch (error) {
        console.error("[getCategoryDetails] CRITICAL ERROR:", error);
        return null;
    }
}
// --- Tag Groups ---
export async function getTagGroups() {
    try {
        const groups = await prisma.tagGroup.findMany({
            orderBy: { id: 'asc' },
            include: {
                tags: {
                    select: { name: true }
                }
            }
        })
        return (groups || []).map((g: any) => ({
            id: g.id,
            name: g.name || "グループ名なし",
            tags: (g.tags || []).map((t: any) => t.name)
        }))
    } catch (error) {
        console.error("Failed to fetch tag groups:", error)
        return []
    }
}
