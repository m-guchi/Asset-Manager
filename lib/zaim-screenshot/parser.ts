import type { OcrWord, ParsedHolding } from "./types"

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
        const valuation = extractPrimaryValuation(rightWords.length > 0 ? rightWords : sortedWords)

        if (valuation === null) continue

        const cleanedName = cleanAssetName(name)
        if (/^\([^)]+\)$/.test(cleanedName)) continue // 投信名の続き行 e.g. (TOPIX)
        if (!cleanedName) {
            holdings.push({ name: "", valuation })
            continue
        }

        holdings.push({ name: cleanedName, valuation })
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

function extractPrimaryValuation(words: OcrWord[]): number | null {
    const amounts: number[] = []

    for (const word of words) {
        const match = word.text.match(YEN_PATTERN)
        if (match) {
            const value = parseInt(match[1].replace(/,/g, ""), 10)
            if (!isNaN(value) && value > 0) {
                amounts.push(value)
            }
        }
    }

    if (amounts.length === 0) {
        const combined = words.map((w) => w.text).join(" ")
        const globalMatch = combined.match(YEN_PATTERN)
        if (globalMatch) {
            const value = parseInt(globalMatch[1].replace(/,/g, ""), 10)
            if (!isNaN(value) && value > 0) return value
        }
        return null
    }

    return Math.max(...amounts)
}

/** 複数画像から得た銘柄リストを統合（同名は評価額が大きい方を採用） */
export function mergeParsedHoldings(holdings: ParsedHolding[]): ParsedHolding[] {
    return dedupeHoldings(holdings)
}

function dedupeHoldings(holdings: ParsedHolding[]): ParsedHolding[] {
    const seen = new Map<string, ParsedHolding>()
    let anonCounter = 0

    for (const holding of holdings) {
        const normalized = normalizeKey(holding.name)
        const key = normalized || `__anon_${anonCounter++}_${holding.valuation}`
        const existing = seen.get(key)
        if (!existing || holding.valuation > existing.valuation) {
            seen.set(key, holding)
        }
    }

    return Array.from(seen.values())
}

function normalizeKey(name: string): string {
    return name.replace(/\s+/g, "").toLowerCase()
}
