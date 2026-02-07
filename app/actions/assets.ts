"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { TransactionType } from "@prisma/client"
import { getCurrentUserId } from "@/lib/auth"

export async function updateValuation(categoryId: number, value: number, recordedAt = new Date()) {
    try {
        const userId = await getCurrentUserId()
        await prisma.asset.create({
            data: {
                categoryId,
                userId,
                currentValue: value,
                recordedAt
            }
        })
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
}) {
    try {
        const userId = await getCurrentUserId()
        const operations: Array<ReturnType<typeof prisma.transaction.create> | ReturnType<typeof prisma.asset.create>> = [
            prisma.transaction.create({
                data: {
                    categoryId,
                    userId,
                    type: data.type as TransactionType,
                    amount: data.amount,
                    realizedGain: data.realizedGain,
                    transactedAt: data.date,
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
                        userId,
                        currentValue: data.valuation,
                        recordedAt: data.date
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
        const transactions = await prisma.transaction.findMany({
            where: { userId },
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
            const assets = tx.category.assets;
            const nearestAsset = assets.find((a) => a.recordedAt <= tx.transactedAt) || assets[0]

            return {
                id: tx.id,
                date: tx.transactedAt,
                category: tx.category.name,
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
    try {
        const userId = await getCurrentUserId()
        if (type === 'tx') {
            const oldTx = await prisma.transaction.findUnique({ where: { id } })
            if (!oldTx) return { success: false }

            const amt = Number(data.amount) || 0
            const txType = (data.type === 'DEPOSIT' || data.type === 'WITHDRAW')
                ? data.type
                : (data.type === 'VALUATION' ? 'VALUATION' : (amt >= 0 ? 'DEPOSIT' : 'WITHDRAW'))

            type Op = ReturnType<typeof prisma.transaction.update> | ReturnType<typeof prisma.asset.deleteMany> | ReturnType<typeof prisma.asset.create>;
            const operations: Op[] = [
                prisma.transaction.update({
                    where: { id },
                    data: {
                        type: txType as TransactionType,
                        amount: Math.abs(amt),
                        realizedGain: data.realizedGain !== undefined ? Number(data.realizedGain) : undefined,
                        transactedAt: new Date(data.date),
                        memo: data.memo
                    }
                })
            ];

            // Check if there are other transactions on the OLD date
            const otherTxCount = await prisma.transaction.count({
                where: {
                    categoryId: oldTx.categoryId,
                    transactedAt: oldTx.transactedAt,
                    id: { not: id }
                }
            });

            if (otherTxCount === 0) {
                // Only delete asset record if no other transactions exist on that day
                operations.push(
                    prisma.asset.deleteMany({
                        where: {
                            categoryId: oldTx.categoryId,
                            recordedAt: oldTx.transactedAt
                        }
                    })
                );
            }

            // Create new asset record only if valuation is provided
            if (data.valuation !== undefined && data.valuation !== null && data.valuation !== "") {
                const numVal = Number(data.valuation);
                if (!isNaN(numVal)) {
                    operations.push(
                        prisma.asset.create({
                            data: {
                                categoryId: oldTx.categoryId,
                                userId,
                                currentValue: numVal,
                                recordedAt: new Date(data.date)
                            }
                        })
                    );
                }
            }

            await prisma.$transaction(operations);
            revalidatePath(`/assets/${oldTx.categoryId}`)
        } else {
            const asset = await prisma.asset.update({
                where: { id },
                data: {
                    currentValue: Number(data.valuation),
                    recordedAt: new Date(data.date)
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
