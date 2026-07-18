import { findNearestPointByTimestamp } from "@/lib/chart-base-diff"

export interface IndexSeriesInput {
    id: number
    values: { recordedAt: string; value: number }[]
}

export interface ComparePoint {
    timestamp: number
    [key: string]: number | null
}

/** 複数指数の時系列を日付で統合する。市場が異なり取引日がずれる場合は直前値で前方補完する */
export function mergeIndexSeries(series: IndexSeriesInput[]): ComparePoint[] {
    const valueMaps = series.map((s) => {
        const map = new Map<number, number>()
        s.values.forEach((v) => map.set(new Date(v.recordedAt).getTime(), v.value))
        return { id: s.id, map }
    })

    const allTimestamps = new Set<number>()
    valueMaps.forEach(({ map }) => map.forEach((_, ts) => allTimestamps.add(ts)))
    const timestamps = Array.from(allTimestamps).sort((a, b) => a - b)

    const lastValue: Record<number, number | null> = {}
    series.forEach((s) => { lastValue[s.id] = null })

    return timestamps.map((ts) => {
        const point: ComparePoint = { timestamp: ts }
        valueMaps.forEach(({ id, map }) => {
            const val = map.get(ts)
            if (val !== undefined) lastValue[id] = val
            point[`raw_${id}`] = lastValue[id]
        })
        return point
    })
}

/** 基準日時点の値を100%（変化率0%）として、各シリーズの変化率(%)を書き込む（基準日より前はnull） */
export function applyBaseDatePercentChange(points: ComparePoint[], baseTimestamp: number, seriesIds: number[]): void {
    const basePoint = findNearestPointByTimestamp(points, baseTimestamp)
    if (!basePoint) return

    points.forEach((point) => {
        seriesIds.forEach((id) => {
            const pctKey = `pct_${id}`
            if (point.timestamp < basePoint.timestamp) {
                point[pctKey] = null
                return
            }
            const raw = point[`raw_${id}`]
            const baseRaw = basePoint[`raw_${id}`]
            if (raw === null || raw === undefined || baseRaw === null || baseRaw === undefined || baseRaw === 0) {
                point[pctKey] = null
                return
            }
            point[pctKey] = (Number(raw) / Number(baseRaw) - 1) * 100
        })
    })
}
