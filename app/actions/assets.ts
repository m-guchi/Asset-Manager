"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { TransactionType } from "@prisma/client"

export async function updateValuation(categoryId: number, value: number, recordedAt = new Date()) {
    try {
        await prisma.asset.create({
            data: {
                categoryId,
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
    valuation?: number // Optional
    date: Date
    memo?: string
}) {
    try {
        const operations: any[] = [
            prisma.transaction.create({
                data: {
                    categoryId,
                    type: data.type as TransactionType,
                    amount: data.amount,
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
        const transactions = await prisma.transaction.findMany({
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
        return transactions.map((tx: any) => {
            // Find the asset valuation recorded at or just before this transaction
            const nearestAsset = tx.category.assets.find((a: any) => a.recordedAt <= tx.transactedAt) || tx.category.assets[0]

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

export async function updateHistoryItem(type: 'tx' | 'as', id: number, data: any) {
    try {
        if (type === 'tx') {
            const oldTx = await prisma.transaction.findUnique({ where: { id } })
            if (!oldTx) return { success: false }

            const amt = Number(data.amount) || 0
            const txType = data.type === 'VALUATION' ? 'VALUATION' : (amt >= 0 ? 'DEPOSIT' : 'WITHDRAW')

            const operations: any[] = [
                prisma.transaction.update({
                    where: { id },
                    data: {
                        type: txType as TransactionType,
                        amount: Math.abs(amt),
                        transactedAt: new Date(data.date),
                        memo: data.memo
                    }
                }),
                // Delete old asset record associated with the OLD date of transaction
                prisma.asset.deleteMany({
                    where: {
                        categoryId: oldTx.categoryId,
                        recordedAt: oldTx.transactedAt
                    }
                })
            ];

            // Create new asset record only if valuation is provided
            if (data.valuation !== undefined && data.valuation !== null && data.valuation !== "") {
                const numVal = Number(data.valuation);
                if (!isNaN(numVal)) {
                    operations.push(
                        prisma.asset.create({
                            data: {
                                categoryId: oldTx.categoryId,
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
