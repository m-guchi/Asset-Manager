"use server"

import { cache } from "react"
import { getFinancialSnapshot } from "@/lib/user-financial-snapshot"

export type { HistoryPoint } from "@/lib/history-compute"

export const getHistoryData = cache(async () => {
    const { historyPoints } = await getFinancialSnapshot()
    return historyPoints
})
