export interface OcrWord {
    text: string
    x: number
    y: number
    width: number
    height: number
}

export interface OcrBoundingBox {
    x: number
    y: number
    width: number
    height: number
}

export type YenAmountKind = "valuation" | "profit_loss"

export interface YenAmountCandidate {
    value: number
    bbox: OcrBoundingBox
    ocrText: string
    kind: YenAmountKind
}

/** OCRで読み取った評価額の元画像上の位置 */
export interface OcrValuationSource {
    imageDataUrl: string
    ocrImageWidth: number
    ocrImageHeight: number
    valuationBbox: OcrBoundingBox
    /** 読込ダイアログ内の画像キューID（画像一覧でのグループ化用） */
    sourceImageId?: string
    /** 同一行で検出した金額候補（損益など誤読の除外用） */
    amountCandidates?: YenAmountCandidate[]
}

export interface ParsedHolding {
    name: string
    valuation: number
    valuationBbox?: OcrBoundingBox
    source?: OcrValuationSource
    amountCandidates?: YenAmountCandidate[]
    /** 名前は読み取れたが評価額が読み取れなかった行（valuationは0のプレースホルダー） */
    unreadable?: boolean
    /** OCRではなく一覧画面でユーザーが手動追加した行 */
    manual?: boolean
}

export type MatchConfidence = "high" | "medium" | "low" | "order" | "none"

export interface ValuationCategoryRef {
    id: number
    name: string
    valuationAlias?: string | null
    /** 読込確認画面で現在評価額との差分表示に使用 */
    currentValue?: number
}

export interface MatchResult {
    categoryId: number | null
    categoryName: string | null
    ocrName: string
    valuation: number
    confidence: MatchConfidence
    selected: boolean
    source?: OcrValuationSource
    amountCandidates?: YenAmountCandidate[]
    /** 画像上で採用を外した金額（灰色枠で表示） */
    imageDismissedCandidate?: YenAmountCandidate
    /** 名前は読み取れたが評価額が読み取れなかった行（valuationは0のプレースホルダー） */
    unreadable?: boolean
    /** OCRではなく一覧画面でユーザーが手動追加した行 */
    manual?: boolean
}
