import { levenshteinDistance, normalizeName } from "./matcher"
import type { ParsedHolding } from "./types"

/** スクロール重複で同一銘柄とみなす（名前はOCR誤差を許容、金額は一致必須） */
export function holdingsAreSameItem(a: ParsedHolding, b: ParsedHolding): boolean {
    if (a.valuation !== b.valuation) return false

    const na = normalizeName(a.name)
    const nb = normalizeName(b.name)

    if (na && nb) {
        if (na === nb) return true
        if (na.includes(nb) || nb.includes(na)) return true
        const maxLen = Math.max(na.length, nb.length)
        const threshold = maxLen <= 6 ? 2 : maxLen <= 12 ? 3 : 4
        return levenshteinDistance(na, nb) <= threshold
    }

    return !na && !nb
}

/** earlier の末尾と later の先頭が何行一致するか */
export function findOverlapLength(
    earlier: ParsedHolding[],
    later: ParsedHolding[]
): number {
    const maxK = Math.min(earlier.length, later.length)
    for (let k = maxK; k >= 1; k--) {
        let matches = true
        for (let i = 0; i < k; i++) {
            if (!holdingsAreSameItem(earlier[earlier.length - k + i], later[i])) {
                matches = false
                break
            }
        }
        if (matches) return k
    }
    return 0
}

/** 2つの連続リストを重複部分でつなぐ（順序は自動判定） */
export function mergeTwoHoldingsSequences(
    a: ParsedHolding[],
    b: ParsedHolding[]
): ParsedHolding[] {
    const forward = findOverlapLength(a, b)
    if (forward > 0) {
        return [...a, ...b.slice(forward)]
    }

    const backward = findOverlapLength(b, a)
    if (backward > 0) {
        return [...b, ...a.slice(backward)]
    }

    return [...a, ...b]
}

/**
 * 指定順に連結し、隣接する重複行（スクロール重なり）のみ除外する。
 */
export function concatenateHoldingsInOrder(sequences: ParsedHolding[][]): ParsedHolding[] {
    const result: ParsedHolding[] = []

    for (const seq of sequences) {
        for (const holding of seq) {
            if (
                result.length > 0 &&
                holdingsAreSameItem(result[result.length - 1], holding)
            ) {
                continue
            }
            result.push(holding)
        }
    }

    return result
}
