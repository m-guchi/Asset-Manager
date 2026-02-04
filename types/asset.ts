export interface Category {
    id: number
    name: string
    currentValue: number
    costBasis: number
    ownValue?: number
    ownCostBasis?: number
    color?: string
    order?: number
    parentId?: number | null
    isCash?: boolean
    isLiability?: boolean
    tags?: string[]
    conflicts?: string[]
}

export interface HistoryPoint {
    date: string
    totalAssets: number
    totalCost: number
    netWorth?: number
    [key: string]: any
}

export interface TagGroup {
    id: number
    name: string
    tags?: string[]
    options?: { id: number, name: string }[]
}
