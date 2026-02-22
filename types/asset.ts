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
    tagSettings?: {
        groupId: number;
        groupName: string;
        optionId: number | null;
        optionName: string;
    }[];
    conflicts?: string[]
    depth?: number
}

export interface HistoryPoint {
    date: string
    totalAssets: number | null
    totalCost: number | null
    netWorth?: number | null
    [key: string]: string | number | boolean | null | undefined
}

export interface TagGroup {
    id: number
    name: string
    tags?: string[]
    options?: { id: number, name: string }[]
}
