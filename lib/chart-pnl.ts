export interface PnlSeriesKeys {
    valKey: string
    costKey: string
    pnlRateKey: string
    pnlValueKey: string
}

export function hasAssetPosition(val: number, cost: number): boolean {
    return val > 0 || cost > 0
}

export function calcPnlRate(val: number, cost: number): number | null {
    if (cost <= 0) return null
    return ((val - cost) / cost) * 100
}

export function calcPnlValue(val: number, cost: number): number {
    return val - cost
}

export function isPlottablePnlValue(value: unknown): value is number {
    return value !== null && value !== undefined && Number.isFinite(Number(value))
}

export function applyPnlWithZeroTransitions(
    points: Array<Record<string, number | null>>,
    seriesList: PnlSeriesKeys[]
): void {
    points.forEach((point, index) => {
        seriesList.forEach(({ valKey, costKey, pnlRateKey, pnlValueKey }) => {
            const val = Number(point[valKey] ?? 0)
            const cost = Number(point[costKey] ?? 0)

            if (hasAssetPosition(val, cost)) {
                point[pnlRateKey] = calcPnlRate(val, cost)
                point[pnlValueKey] = calcPnlValue(val, cost)
                return
            }

            if (index > 0) {
                const prev = points[index - 1]
                const prevVal = Number(prev[valKey] ?? 0)
                const prevCost = Number(prev[costKey] ?? 0)
                if (hasAssetPosition(prevVal, prevCost)) {
                    point[pnlRateKey] = 0
                    point[pnlValueKey] = 0
                    return
                }
            }

            point[pnlRateKey] = null
            point[pnlValueKey] = null
        })
    })
}
