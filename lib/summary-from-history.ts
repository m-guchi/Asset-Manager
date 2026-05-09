import type { HistoryPoint } from "@/types/asset"

export interface PortfolioHistoryPerformance {
    dailyChange: number
    dailyChangeRate: number
    monthlyChange: number
    monthlyChangeRate: number
}

function pointProfitAmount(p: HistoryPoint): number {
    const assets = Number((p.totalAssets ?? p.netWorth) ?? 0)
    const cost = Number(p.totalCost ?? 0)
    return assets - cost
}

function pointDateKey(p: HistoryPoint): string {
    if (p.date && /^\d{4}-\d{2}-\d{2}/.test(p.date)) {
        return p.date.slice(0, 10)
    }
    const ts = typeof p.timestamp === "number" ? p.timestamp : NaN
    if (Number.isFinite(ts)) {
        return new Date(ts).toISOString().slice(0, 10)
    }
    return ""
}

/** UTC 暦の YYYY-MM-DD に delta 日を加算（履歴の date と同じ基準） */
function addCalendarDaysUtc(isoDate: string, deltaDays: number): string {
    const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number)
    const utc = Date.UTC(y, m - 1, d) + deltaDays * 86400000
    return new Date(utc).toISOString().slice(0, 10)
}

function sortHistoryPoints(points: HistoryPoint[]): HistoryPoint[] {
    return [...points].sort((a, b) => {
        const da = pointDateKey(a)
        const db = pointDateKey(b)
        if (da && db && da !== db) return da.localeCompare(db)
        const ta = typeof a.timestamp === "number" ? a.timestamp : new Date(da).getTime()
        const tb = typeof b.timestamp === "number" ? b.timestamp : new Date(db).getTime()
        return ta - tb
    })
}

/** date が YYYY-MM-DD 想定。最後の「threshold 以下」の点のインデックス。無ければ -1 */
function findLastIndexOnOrBeforeDate(sorted: HistoryPoint[], threshold: string): number {
    let lo = 0
    let hi = sorted.length - 1
    let ans = -1
    while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const d = pointDateKey(sorted[mid])
        if (d <= threshold) {
            ans = mid
            lo = mid + 1
        } else {
            hi = mid - 1
        }
    }
    return ans
}

/**
 * ダッシュボード上部「1日前比」「30日前比」用。
 * 履歴時系列の損益額（totalAssets - totalCost）を、暦日ベースで揃えた参照日と比較する。
 */
export function computePortfolioPerformanceFromHistory(
    historyData: HistoryPoint[] | undefined | null
): PortfolioHistoryPerformance {
    const empty: PortfolioHistoryPerformance = {
        dailyChange: 0,
        dailyChangeRate: 0,
        monthlyChange: 0,
        monthlyChangeRate: 0,
    }
    if (!historyData?.length) return empty

    const sorted = sortHistoryPoints(historyData)
    const lastIdx = sorted.length - 1
    const latest = sorted[lastIdx]
    const latestDate = pointDateKey(latest)
    if (!latestDate) return empty

    const latestProfit = pointProfitAmount(latest)

    const dayThreshold = addCalendarDaysUtc(latestDate, -1)
    let dailyRefIdx = findLastIndexOnOrBeforeDate(sorted, dayThreshold)
    if (dailyRefIdx < 0 || dailyRefIdx >= lastIdx) {
        dailyRefIdx = lastIdx >= 1 ? lastIdx - 1 : -1
    }
    const dailyRefProfit = dailyRefIdx >= 0 ? pointProfitAmount(sorted[dailyRefIdx]) : latestProfit
    const dailyChange = dailyRefIdx >= 0 ? latestProfit - dailyRefProfit : 0
    const dailyChangeRate =
        dailyRefIdx >= 0 && dailyRefProfit !== 0 ? (dailyChange / Math.abs(dailyRefProfit)) * 100 : 0

    const monthThreshold = addCalendarDaysUtc(latestDate, -30)
    const monthRefIdx = findLastIndexOnOrBeforeDate(sorted, monthThreshold)
    let monthlyChange = 0
    let monthlyChangeRate = 0
    if (monthRefIdx >= 0 && monthRefIdx < lastIdx) {
        const monthRefProfit = pointProfitAmount(sorted[monthRefIdx])
        monthlyChange = latestProfit - monthRefProfit
        monthlyChangeRate = monthRefProfit !== 0 ? (monthlyChange / Math.abs(monthRefProfit)) * 100 : 0
    }

    return { dailyChange, dailyChangeRate, monthlyChange, monthlyChangeRate }
}
