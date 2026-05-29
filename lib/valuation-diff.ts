/** 現在評価額との差分がこの比率を超えたら警告 */
export const LARGE_VALUATION_DIFF_RATIO = 0.5

export function formatValuationDiff(diff: number): string {
    const prefix = diff > 0 ? "+" : diff < 0 ? "−" : "±"
    const abs = Math.abs(diff)
    return `${prefix}¥${abs.toLocaleString()}`
}

export function valuationDiffPercent(current: number, imported: number): number | null {
    if (current <= 0) return null
    return ((imported - current) / current) * 100
}

export function isLargeValuationDiff(
    current: number,
    imported: number,
    ratioThreshold = LARGE_VALUATION_DIFF_RATIO
): boolean {
    if (current <= 0) return false
    return Math.abs(imported - current) / current >= ratioThreshold
}
