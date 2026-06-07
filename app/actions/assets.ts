"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { TransactionType } from "@prisma/client"
import { getCurrentUserId } from "@/lib/auth"
import { normalizeRecordDate } from "@/lib/valuation-day"
import {
    findValuationChangeForDay,
    upsertValuationChange,
    type ValuationWriteResult,
} from "@/lib/valuation-change"

export type { ValuationWriteResult }

export async function checkValuationOverwrite(
    categoryId: number,
    date: Date
): Promise<{ exists: boolean; existingValue: number; dayKey: string } | null> {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const existing = await findValuationChangeForDay(categoryId, date, userId)
    if (!existing) {
        return { exists: false, existingValue: 0, dayKey: "" }
    }

    return {
        exists: true,
        existingValue: existing.value,
        dayKey: existing.dayKey,
    }
}

export async function checkBulkValuationOverwrite(
    entries: { categoryId: number; value: number }[],
    date: Date
): Promise<{ categoryId: number; existingValue: number; newValue: number; dayKey: string }[]> {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const conflicts: { categoryId: number; existingValue: number; newValue: number; dayKey: string }[] = []

    for (const entry of entries) {
        const existing = await findValuationChangeForDay(entry.categoryId, date, userId)
        if (!existing) continue

        conflicts.push({
            categoryId: entry.categoryId,
            existingValue: existing.value,
            newValue: entry.value,
            dayKey: existing.dayKey,
        })
    }

    return conflicts
}

export async function updateValuation(
    categoryId: number,
    value: number,
    recordedAt = new Date(),
    options?: { confirmOverwrite?: boolean }
): Promise<ValuationWriteResult> {
    try {
        const userId = await getCurrentUserId()
        if (!userId) {
            throw new Error("User not authenticated")
        }

        const result = await upsertValuationChange({
            categoryId,
            userId,
            date: recordedAt,
            value,
            confirmOverwrite: options?.confirmOverwrite,
            createTransaction: false,
        })

        if ("needsConfirmation" in result) {
            return result
        }

        if (!result.success) {
            return result
        }

        revalidatePath("/")
        revalidatePath("/assets")
        revalidatePath("/transactions")
        revalidatePath(`/assets/${categoryId}`)
        return { success: true }
    } catch (error) {
        console.error("Failed to update valuation:", error)
        return { success: false }
    }
}

export async function addTransaction(categoryId: number, data: {
    type: "DEPOSIT" | "WITHDRAW" | "VALUATION"
    amount: number
    realizedGain?: number | null
    valuation?: number // Optional
    date: Date
    memo?: string
    confirmOverwrite?: boolean
}) {
    // Input Validation
    if (data.memo && data.memo.length > 200) {
        return { success: false, error: "メモは200文字以内で入力してください" }
    }

    try {
        const userId = await getCurrentUserId()
        if (!userId) {
            throw new Error("User not authenticated")
        }

        if (data.type === "VALUATION") {
            if (data.valuation === undefined || data.valuation === null || isNaN(data.valuation)) {
                return { success: false, error: "評価額を入力してください" }
            }

            const result = await upsertValuationChange({
                categoryId,
                userId,
                date: data.date,
                value: data.valuation,
                memo: data.memo,
                confirmOverwrite: data.confirmOverwrite,
                createTransaction: true,
            })

            if ("needsConfirmation" in result) {
                return result
            }

            if (!result.success) {
                return result
            }

            revalidatePath("/")
            revalidatePath("/assets")
            revalidatePath("/transactions")
            revalidatePath(`/assets/${categoryId}`)
            return { success: true }
        }

        const recordedAt = normalizeRecordDate(data.date)
        const operations: Array<ReturnType<typeof prisma.transaction.create> | ReturnType<typeof prisma.asset.create>> = [
            prisma.transaction.create({
                data: {
                    categoryId,
                    userId: userId!,
                    type: data.type as TransactionType,
                    amount: data.amount,
                    realizedGain: data.realizedGain,
                    transactedAt: recordedAt,
                    memo: data.memo
                }
            })
        ];

        // Create Asset valuation record only if valuation is provided
        if (data.valuation !== undefined && data.valuation !== null && !isNaN(data.valuation)) {
            operations.push(
                prisma.asset.create({
                    data: {
                        categoryId,
                        userId: userId!,
                        currentValue: data.valuation,
                        recordedAt
                    }
                })
            );
        }

        await prisma.$transaction(operations);

        revalidatePath("/")
        revalidatePath("/assets")
        revalidatePath("/transactions")
        revalidatePath(`/assets/${categoryId}`)
        return { success: true }
    } catch (error) {
        console.error("Failed to add transaction:", error)
        return { success: false }
    }
}

export async function getTransactions() {
    try {
        const userId = await getCurrentUserId()
        if (!userId) {
            return []
        }
        const transactions = await prisma.transaction.findMany({
            where: { userId: userId! },
            orderBy: { transactedAt: 'desc' },
            include: {
                category: {
                    include: {
                        assets: {
                            orderBy: { recordedAt: 'desc' }
                        }
                    }
                }
            }
        })
        return transactions.map((tx) => {
            // Find the asset valuation recorded at or just before this transaction
            const category = tx.category;
            const assets = category.assets;
            const nearestAsset = assets.find((a) => a.recordedAt <= tx.transactedAt) || assets[0]

            return {
                id: tx.id,
                date: tx.transactedAt,
                category: category.name,
                categoryId: tx.categoryId,
                type: tx.type,
                amount: Number(tx.amount),
                valuation: Number(nearestAsset?.currentValue || 0),
                memo: tx.memo || ""
            }
        })
    } catch (error) {
        console.error("Failed to fetch transactions:", error)
        return []
    }
}

export async function deleteHistoryItem(type: 'tx' | 'as', id: number) {
    try {
        if (type === 'tx') {
            const tx = await prisma.transaction.findUnique({ where: { id } })
            if (tx) {
                // Also find matching asset valuation (sometimes created together in addTransaction)
                // We look for an Asset in the same category with exact same timestamp
                await prisma.$transaction([
                    prisma.transaction.delete({ where: { id } }),
                    prisma.asset.deleteMany({
                        where: {
                            categoryId: tx.categoryId,
                            recordedAt: tx.transactedAt
                        }
                    })
                ])
                revalidatePath("/")
                revalidatePath(`/assets/${tx.categoryId}`)
            }
        } else {
            const asset = await prisma.asset.findUnique({ where: { id } })
            if (asset) {
                await prisma.asset.delete({ where: { id } })
                revalidatePath("/")
                revalidatePath(`/assets/${asset.categoryId}`)
            }
        }
        return { success: true }
    } catch (error) {
        console.error("Delete failed:", error)
        return { success: false }
    }
}

interface UpdateHistoryItemData {
    amount?: number | string;
    type?: string;
    realizedGain?: number | string | null;
    date: Date | string;
    memo?: string | null;
    valuation?: number | string | null;
}

export async function updateHistoryItem(type: 'tx' | 'as', id: number, data: UpdateHistoryItemData) {
    // Input Validation
    if (data.memo && data.memo.length > 200) {
        return { success: false, error: "メモは200文字以内で入力してください" }
    }

    try {
        const userId = await getCurrentUserId()
        if (!userId) {
            throw new Error("User not authenticated")
        }
        if (type === 'tx') {
            const oldTx = await prisma.transaction.findUnique({ where: { id } })
            if (!oldTx) return { success: false }

            const amt = Number(data.amount) || 0
            const txType = (data.type === 'DEPOSIT' || data.type === 'WITHDRAW')
                ? data.type
                : (data.type === 'VALUATION' ? 'VALUATION' : (amt >= 0 ? 'DEPOSIT' : 'WITHDRAW'))
            const recordedAt = normalizeRecordDate(new Date(data.date))

            type Op = ReturnType<typeof prisma.transaction.update> | ReturnType<typeof prisma.asset.deleteMany> | ReturnType<typeof prisma.asset.create> | ReturnType<typeof prisma.asset.update>;
            const operations: Op[] = [
                prisma.transaction.update({
                    where: { id },
                    data: {
                        type: txType as TransactionType,
                        amount: Math.abs(amt),
                        realizedGain: data.realizedGain !== undefined ? Number(data.realizedGain) : undefined,
                        transactedAt: recordedAt,
                        memo: data.memo
                    }
                })
            ];

            const otherTxCount = await prisma.transaction.count({
                where: {
                    categoryId: oldTx.categoryId,
                    transactedAt: oldTx.transactedAt,
                    id: { not: id }
                }
            });

            if (otherTxCount === 0) {
                operations.push(
                    prisma.asset.deleteMany({
                        where: {
                            categoryId: oldTx.categoryId,
                            recordedAt: oldTx.transactedAt
                        }
                    })
                );
            }

            if (data.valuation !== undefined && data.valuation !== null && data.valuation !== "") {
                const numVal = Number(data.valuation);
                if (!isNaN(numVal)) {
                    if (txType === 'VALUATION') {
                        const existing = await findValuationChangeForDay(oldTx.categoryId, new Date(data.date), userId)
                        if (existing?.assetId) {
                            operations.push(
                                prisma.asset.update({
                                    where: { id: existing.assetId },
                                    data: {
                                        currentValue: numVal,
                                        recordedAt,
                                    },
                                })
                            )
                        } else {
                            operations.push(
                                prisma.asset.create({
                                    data: {
                                        categoryId: oldTx.categoryId,
                                        userId: userId!,
                                        currentValue: numVal,
                                        recordedAt,
                                    }
                                })
                            );
                        }
                    } else {
                        operations.push(
                            prisma.asset.create({
                                data: {
                                    categoryId: oldTx.categoryId,
                                    userId: userId!,
                                    currentValue: numVal,
                                    recordedAt,
                                }
                            })
                        );
                    }
                }
            }

            await prisma.$transaction(operations);
            revalidatePath(`/assets/${oldTx.categoryId}`)
        } else {
            const asset = await prisma.asset.update({
                where: { id },
                data: {
                    currentValue: Number(data.valuation),
                    recordedAt: normalizeRecordDate(new Date(data.date))
                }
            })
            revalidatePath(`/assets/${asset.categoryId}`)
        }
        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Update failed:", error)
        return { success: false }
    }
}
