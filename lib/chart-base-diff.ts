export interface BaseDiffSeriesKeys {
    valKey: string
    diffKey: string
}

export function findNearestPointByTimestamp<T extends { timestamp: number }>(
    points: T[],
    targetTime: number
): T | null {
    if (!points.length) return null
    return points.reduce((prev, curr) =>
        Math.abs(curr.timestamp - targetTime) < Math.abs(prev.timestamp - targetTime) ? curr : prev
    )
}

/** 各シリーズについて、基準日時点の値との差分を diffKey に書き込む（基準日より前は null） */
export function applyBaseDateDiff(
    points: Array<Record<string, unknown> & { timestamp: number }>,
    baseTimestamp: number,
    seriesKeysList: BaseDiffSeriesKeys[]
): void {
    const basePoint = findNearestPointByTimestamp(points, baseTimestamp)
    if (!basePoint) return

    points.forEach((point) => {
        seriesKeysList.forEach(({ valKey, diffKey }) => {
            if (point.timestamp < basePoint.timestamp) {
                point[diffKey] = null
                return
            }
            const val = Number(point[valKey] ?? 0)
            const baseVal = Number(basePoint[valKey] ?? 0)
            point[diffKey] = val - baseVal
        })
    })
}
