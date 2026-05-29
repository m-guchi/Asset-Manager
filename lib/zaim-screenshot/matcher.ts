import type { MatchConfidence, MatchResult, ParsedHolding, ValuationCategoryRef } from "./types"

export function normalizeName(name: string): string {
    return name
        .replace(/[・･\s\-_()（）\[\]「」]/g, "")
        .replace(/\.\.\./g, "")
        .toLowerCase()
}

export function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0)
    )

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            )
        }
    }

    return matrix[a.length][b.length]
}

/** Zaim画面に表示される名称（valuationAlias のみ） */
function getZaimDisplayNames(category: ValuationCategoryRef): string[] {
    if (!category.valuationAlias?.trim()) return []
    return category.valuationAlias
        .split(/[,、|]/)
        .map((s) => s.trim())
        .filter(Boolean)
}

function scoreNameMatch(ocrName: string, targetName: string): MatchConfidence {
    const normalizedOcr = normalizeName(ocrName)
    const normalizedTarget = normalizeName(targetName)
    if (!normalizedOcr || !normalizedTarget) return "none"

    if (normalizedOcr === normalizedTarget) return "high"

    if (normalizedOcr.includes(normalizedTarget) || normalizedTarget.includes(normalizedOcr)) {
        const shorter = Math.min(normalizedOcr.length, normalizedTarget.length)
        const longer = Math.max(normalizedOcr.length, normalizedTarget.length)
        const score = shorter / longer
        if (score >= 0.8) return "high"
        if (score >= 0.5) return "medium"
    }

    const distance = levenshteinDistance(normalizedOcr, normalizedTarget)
    const maxLen = Math.max(normalizedOcr.length, normalizedTarget.length)
    const threshold = maxLen <= 6 ? 2 : maxLen <= 12 ? 3 : 4
    if (distance <= threshold) {
        return distance <= 1 ? "medium" : "low"
    }

    return "none"
}

function matchOcrNameToCategory(
    ocrName: string,
    category: ValuationCategoryRef
): MatchConfidence {
    let best: MatchConfidence = "none"
    for (const name of getZaimDisplayNames(category)) {
        const score = scoreNameMatch(ocrName, name)
        if (score === "high") return "high"
        if (score === "medium" && (best === "none" || best === "low")) best = "medium"
        if (score === "low" && best === "none") best = "low"
    }
    return best
}

/**
 * Zaimスクショの行順と、Zaim表示名が設定されたカテゴリの valuationOrder を 1:1 で照合する。
 * categories には filterZaimImportCategories() 済みのリストを渡すこと。
 */
export function matchHoldingsToCategories(
    holdings: ParsedHolding[],
    categories: ValuationCategoryRef[]
): MatchResult[] {
    const results: MatchResult[] = []

    for (let i = 0; i < holdings.length; i++) {
        const holding = holdings[i]
        const category = i < categories.length ? categories[i] : null

        if (!category) {
            results.push({
                categoryId: null,
                categoryName: null,
                ocrName: holding.name.trim() || `(${i + 1}行目)`,
                valuation: holding.valuation,
                confidence: "none",
                selected: false,
            })
            continue
        }

        const nameCheck = matchOcrNameToCategory(holding.name, category)
        const confidence: MatchConfidence = nameCheck === "none" ? "order" : nameCheck

        results.push({
            categoryId: category.id,
            categoryName: category.name,
            ocrName: holding.name.trim() || `(${i + 1}行目)`,
            valuation: holding.valuation,
            confidence,
            selected: true,
        })
    }

    return results
}

export function mergeMatchResults(
    existing: MatchResult[],
    incoming: MatchResult[]
): MatchResult[] {
    const usedCategoryIds = new Set(
        existing.filter((r) => r.categoryId !== null).map((r) => r.categoryId as number)
    )
    const usedOcrKeys = new Set(existing.map((r) => normalizeName(r.ocrName)))

    const merged = [...existing]

    for (const item of incoming) {
        const ocrKey = normalizeName(item.ocrName)
        if (ocrKey && usedOcrKeys.has(ocrKey)) continue
        if (item.categoryId !== null && usedCategoryIds.has(item.categoryId)) continue

        merged.push(item)
        if (ocrKey) usedOcrKeys.add(ocrKey)
        if (item.categoryId !== null) usedCategoryIds.add(item.categoryId)
    }

    return merged
}

/** @deprecated テスト互換用 */
export function getCategoryMatchNames(category: ValuationCategoryRef): string[] {
    return getZaimDisplayNames(category)
}
