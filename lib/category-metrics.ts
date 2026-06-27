type TxLike = {
    transactedAt: Date
    amount: unknown
    type: string
    realizedGain?: unknown | null
}

type AssetLike = {
    recordedAt: Date
    currentValue: unknown
}

export function sumNetFlowInRange(transactions: TxLike[], start: Date, end: Date): number {
    let sum = 0
    for (const t of transactions) {
        const at = t.transactedAt
        if (at <= start || at > end) continue
        const amt = Number(t.amount)
        if (t.type === "DEPOSIT") sum += amt
        else if (t.type === "WITHDRAW") sum -= amt
    }
    return sum
}

export function sumCostBasis(transactions: TxLike[], isCash: boolean, ownValue: number): number {
    if (isCash) return ownValue
    let sum = 0
    for (const t of transactions) {
        const amt = Number(t.amount || 0)
        if (t.type === "DEPOSIT") sum += amt
        else if (t.type === "WITHDRAW") sum -= amt
    }
    return sum
}

export function sumRealizedGain(transactions: TxLike[]): number {
    let sum = 0
    for (const t of transactions) {
        sum += Number(t.realizedGain || 0)
    }
    return sum
}

/** recordedAt 降順の資産配列から、指定日以前で最も新しい記録を探す */
export function findAssetOnOrBefore(assets: AssetLike[], limit: Date): AssetLike | undefined {
    for (const asset of assets) {
        if (asset.recordedAt <= limit) return asset
    }
    return undefined
}
