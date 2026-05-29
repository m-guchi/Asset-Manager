import type { OcrWord, ParsedHolding, OcrBoundingBox, YenAmountCandidate, YenAmountKind } from "./types"

/** Zaim 証券口座詳細画面の非銘柄行（ヘッダー・セクション・UI要素） */
const HEADER_PATTERNS = [
    /^.+証券$/,
    /^戻る$/,
    /^データを更新/,
    /^残高$/,
    /^資産$/,
    /^総残高$/,
    /^評価額合計$/,
    /^評価額$/,
    /^一覧$/,
    /^全体$/,
    /^株式$/,
    /^投資信託$/,
    /^債券$/,
    /^預かり金$/,
    /^その他$/,
    /^Zaim$/i,
    /^家計簿$/,
    /^入力$/,
    /^レポート$/,
    /^設定$/,
    /^\d{1,2}:\d{2}$/,
    /^[<>›»…]+$/,
    /^%$/,
    /^更新$/,
]

/** OCR が ¥ を \ や Y と誤認識することが多い */
const YEN_PATTERN = /[¥￥\\Y]\s*-?\s*([\d,]+)/

interface TextRow {
    words: OcrWord[]
    centerY: number
}

export function parseZaimHoldings(
    ocrWords: OcrWord[],
    imageWidth: number
): ParsedHolding[] {
    if (ocrWords.length === 0) return []

    const rows = groupWordsIntoRows(ocrWords)
    const nameThresholdX = imageWidth * 0.45
    const holdings: ParsedHolding[] = []

    for (const row of rows) {
        const sortedWords = [...row.words].sort((a, b) => a.x - b.x)
        const rowText = sortedWords.map((w) => w.text).join(" ")

        if (isHeaderRow(rowText)) continue
        if (isProfitLossOnlyRow(rowText, sortedWords, nameThresholdX)) continue

        const nameWords = sortedWords.filter((w) => w.x + w.width <= nameThresholdX + 20)
        const rightWords = sortedWords.filter((w) => w.x >= nameThresholdX - 20)

        const name = nameWords.map((w) => w.text).join(" ")
        const valuationResult = extractPrimaryValuation(rightWords.length > 0 ? rightWords : sortedWords)

        if (valuationResult === null) continue

        const { value: valuation, bbox: valuationBbox, candidates } = valuationResult

        const cleanedName = cleanAssetName(name)
        if (/^\([^)]+\)$/.test(cleanedName)) continue // 投信名の続き行 e.g. (TOPIX)
        if (!cleanedName) {
            holdings.push({ name: "", valuation, valuationBbox, amountCandidates: candidates })
            continue
        }

        holdings.push({ name: cleanedName, valuation, valuationBbox, amountCandidates: candidates })
    }

    return dedupeHoldings(holdings)
}

function cleanAssetName(raw: string): string {
    return raw
        .replace(/^[ス和ガコスイガオく]+/, "") // OCR ノイズ（行頭アイコン誤認識）
        .replace(/\.\.\.$/, "")
        .replace(/\s+/g, " ")
        .trim()
}

function normalizeRowText(text: string): string {
    return text.replace(/\s+/g, "")
}

function isHeaderRow(text: string): boolean {
    const normalized = normalizeRowText(text.trim())
    if (!normalized) return true
    return HEADER_PATTERNS.some((pattern) => pattern.test(normalized))
}

/** 損益のみの行（評価額行の次行）を除外 */
function isProfitLossOnlyRow(text: string, words: OcrWord[], nameThresholdX: number): boolean {
    const hasLeftName = words.some(
        (w) =>
            w.x + w.width <= nameThresholdX + 20 &&
            /[ぁ-んァ-ン一-龯a-zA-Z]/.test(w.text) &&
            !/^[¥￥\\Y\d.+-]+$/.test(w.text)
    )
    if (hasLeftName) return false

    const normalized = text.trim()
    return /^[¥￥\\Y]?-?[\d,]+\s*\([+-]?\d+\.?\d*%\)/.test(normalized.replace(/\s+/g, ""))
}

function groupWordsIntoRows(words: OcrWord[]): TextRow[] {
    const sorted = [...words].sort((a, b) => {
        const yDiff = a.y - b.y
        if (Math.abs(yDiff) > 5) return yDiff
        return a.x - b.x
    })

    const rows: TextRow[] = []
    const yThreshold = medianWordHeight(sorted) * 0.6 || 12

    for (const word of sorted) {
        const centerY = word.y + word.height / 2
        const existingRow = rows.find((row) => Math.abs(row.centerY - centerY) <= yThreshold)

        if (existingRow) {
            existingRow.words.push(word)
            existingRow.centerY =
                existingRow.words.reduce((sum, w) => sum + w.y + w.height / 2, 0) /
                existingRow.words.length
        } else {
            rows.push({ words: [word], centerY })
        }
    }

    return rows.sort((a, b) => a.centerY - b.centerY)
}

function medianWordHeight(words: OcrWord[]): number {
    if (words.length === 0) return 12
    const heights = words.map((w) => w.height).sort((a, b) => a - b)
    return heights[Math.floor(heights.length / 2)]
}

function mergeWordBboxes(words: OcrWord[]): OcrBoundingBox {
    const x0 = Math.min(...words.map((w) => w.x))
    const y0 = Math.min(...words.map((w) => w.y))
    const x1 = Math.max(...words.map((w) => w.x + w.width))
    const y1 = Math.max(...words.map((w) => w.y + w.height))
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

/** 損益（+¥450 / -¥2,670 など）かどうか */
export function classifyYenAmountKind(ocrText: string): YenAmountKind {
    const compact = ocrText.replace(/\s+/g, "")
    if (/^[+\-−]/.test(compact)) return "profit_loss"
    if (/[¥￥\\Y][+\-−]/.test(compact)) return "profit_loss"
    return "valuation"
}

export function extractYenAmountCandidates(words: OcrWord[]): YenAmountCandidate[] {
    const candidates: YenAmountCandidate[] = []

    for (const word of words) {
        const match = word.text.match(YEN_PATTERN)
        if (!match) continue
        const value = parseInt(match[1].replace(/,/g, ""), 10)
        if (isNaN(value) || value <= 0) continue

        candidates.push({
            value,
            bbox: {
                x: word.x,
                y: word.y,
                width: word.width,
                height: word.height,
            },
            ocrText: word.text,
            kind: classifyYenAmountKind(word.text),
        })
    }

    return candidates.sort((a, b) => a.bbox.x - b.bbox.x)
}

function pickPrimaryValuation(candidates: YenAmountCandidate[]): YenAmountCandidate | null {
    if (candidates.length === 0) return null

    const valuationLike = candidates.filter((c) => c.kind === "valuation")
    if (valuationLike.length > 0) {
        return valuationLike[0]
    }

    return null
}

function extractPrimaryValuation(
    words: OcrWord[]
): { value: number; bbox: OcrBoundingBox; candidates: YenAmountCandidate[] } | null {
    const candidates = extractYenAmountCandidates(words)
    const primary = pickPrimaryValuation(candidates)

    if (primary) {
        return {
            value: primary.value,
            bbox: primary.bbox,
            candidates,
        }
    }

    if (candidates.length > 0) {
        return null
    }

    const combined = words.map((w) => w.text).join(" ")
    const globalMatch = combined.match(YEN_PATTERN)
    if (globalMatch) {
        const value = parseInt(globalMatch[1].replace(/,/g, ""), 10)
        if (!isNaN(value) && value > 0) {
            const matchingWords = words.filter((w) => YEN_PATTERN.test(w.text))
            return {
                value,
                bbox: mergeWordBboxes(matchingWords.length > 0 ? matchingWords : words),
                candidates,
            }
        }
    }

    return null
}

/** 複数画像から得た銘柄リストを統合（名前と評価額が両方一致する場合のみ重複除外） */
export function mergeParsedHoldings(holdings: ParsedHolding[]): ParsedHolding[] {
    return dedupeHoldings(holdings)
}

function holdingDedupeKey(holding: ParsedHolding, anonIndex: number): string {
    const normalized = normalizeKey(holding.name)
    if (normalized) {
        return `${normalized}\0${holding.valuation}`
    }
    return `__anon_${anonIndex}\0${holding.valuation}`
}

function dedupeHoldings(holdings: ParsedHolding[]): ParsedHolding[] {
    const seen = new Set<string>()
    const result: ParsedHolding[] = []
    let anonCounter = 0

    for (const holding of holdings) {
        const key = holdingDedupeKey(holding, anonCounter++)
        if (seen.has(key)) continue
        seen.add(key)
        result.push(holding)
    }

    return result
}

function normalizeKey(name: string): string {
    return name.replace(/\s+/g, "").toLowerCase()
}
