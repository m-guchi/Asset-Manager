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
                source: holding.source,
                amountCandidates: holding.amountCandidates,
                unreadable: holding.unreadable,
                manual: holding.manual,
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
            // 評価額が読み取れなかった行は、誤って0円で反映されないよう未選択にしておく
            selected: !holding.unreadable,
            source: holding.source,
            amountCandidates: holding.amountCandidates,
            unreadable: holding.unreadable,
            manual: holding.manual,
        })
    }

    return results
}

function matchResultToHolding(result: MatchResult): ParsedHolding {
    return {
        name: result.ocrName,
        valuation: result.valuation,
        source: result.source,
        amountCandidates: result.amountCandidates,
        valuationBbox: result.source?.valuationBbox,
        unreadable: result.unreadable,
        manual: result.manual,
    }
}

/**
 * 採用解除（imageDismissedCandidate）の行を除き、残りを上から順に categories と 1:1 で再割当する。
 * 非採用行は categoryId なしのまま元の位置に残す。
 */
export function rematchResultsToCategories(
    results: MatchResult[],
    categories: ValuationCategoryRef[]
): MatchResult[] {
    const activeHoldings: ParsedHolding[] = []

    for (const result of results) {
        if (!result.imageDismissedCandidate) {
            activeHoldings.push(matchResultToHolding(result))
        }
    }

    const matched = matchHoldingsToCategories(activeHoldings, categories)
    const next: MatchResult[] = []
    let matchIndex = 0

    for (const prev of results) {
        if (prev.imageDismissedCandidate) {
            next.push({
                ...prev,
                categoryId: null,
                categoryName: null,
                confidence: "none",
                selected: false,
            })
            continue
        }

        const assignment = matched[matchIndex++]
        next.push({
            ...prev,
            categoryId: assignment.categoryId,
            categoryName: assignment.categoryName,
            ocrName: assignment.ocrName,
            confidence: assignment.confidence,
            selected: assignment.categoryId !== null ? assignment.selected : false,
        })
    }

    return next
}

export function mergeMatchResults(
    existing: MatchResult[],
    incoming: MatchResult[]
): MatchResult[] {
    const usedCategoryIds = new Set(
        existing.filter((r) => r.categoryId !== null).map((r) => r.categoryId as number)
    )
    const usedOcrKeys = new Set(
        existing.map((r) => `${normalizeName(r.ocrName)}\0${r.valuation}`)
    )

    const merged = [...existing]

    for (const item of incoming) {
        const ocrKey = `${normalizeName(item.ocrName)}\0${item.valuation}`
        if (normalizeName(item.ocrName) && usedOcrKeys.has(ocrKey)) continue
        if (item.categoryId !== null && usedCategoryIds.has(item.categoryId)) continue

        merged.push(item)
        if (normalizeName(item.ocrName)) usedOcrKeys.add(ocrKey)
        if (item.categoryId !== null) usedCategoryIds.add(item.categoryId)
    }

    return merged
}

/** @deprecated テスト互換用 */
export function getCategoryMatchNames(category: ValuationCategoryRef): string[] {
    return getZaimDisplayNames(category)
}
