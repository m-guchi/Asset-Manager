export interface OcrWord {
    text: string
    x: number
    y: number
    width: number
    height: number
}

export interface ParsedHolding {
    name: string
    valuation: number
}

export type MatchConfidence = "high" | "medium" | "low" | "order" | "none"

export interface ValuationCategoryRef {
    id: number
    name: string
    valuationAlias?: string | null
}

export interface MatchResult {
    categoryId: number | null
    categoryName: string | null
    ocrName: string
    valuation: number
    confidence: MatchConfidence
    selected: boolean
}
