import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    levenshteinDistance,
    matchHoldingsToCategories,
    normalizeName,
    rematchResultsToCategories,
} from "./matcher"
import type { MatchResult, ParsedHolding, ValuationCategoryRef, YenAmountCandidate } from "./types"

const zaimCategories: ValuationCategoryRef[] = [
    { id: 1, name: "NTT株", valuationAlias: "NTT" },
    { id: 2, name: "三菱重工", valuationAlias: "三菱重" },
    { id: 3, name: "全世界株", valuationAlias: "eMAXIS Slim 全世界株式" },
]

describe("normalizeName", () => {
    it("removes spaces and symbols", () => {
        assert.equal(normalizeName("SBI・V・S&P500"), "sbivs&p500")
    })
})

describe("levenshteinDistance", () => {
    it("returns 0 for identical strings", () => {
        assert.equal(levenshteinDistance("abc", "abc"), 0)
    })
})

describe("matchHoldingsToCategories", () => {
    it("maps holdings to aliased categories 1:1 by order", () => {
        const holdings: ParsedHolding[] = [
            { name: "NTT", valuation: 14950 },
            { name: "三菱重", valuation: 38060 },
            { name: "eMAXIS Slim 全世界", valuation: 84797 },
        ]

        const results = matchHoldingsToCategories(holdings, zaimCategories)

        assert.equal(results.length, 3)
        assert.equal(results[0].categoryId, 1)
        assert.equal(results[1].categoryId, 2)
        assert.equal(results[2].categoryId, 3)
        assert.equal(results[0].confidence, "high")
    })

    it("uses order when ocr name is empty", () => {
        const holdings: ParsedHolding[] = [{ name: "", valuation: 14950 }]
        const results = matchHoldingsToCategories(holdings, [zaimCategories[0]])

        assert.equal(results[0].categoryId, 1)
        assert.equal(results[0].confidence, "order")
        assert.equal(results[0].selected, true)
    })

    it("marks extra ocr rows beyond registered aliases as unmatched", () => {
        const holdings: ParsedHolding[] = [
            { name: "NTT", valuation: 14950 },
            { name: "余分", valuation: 1000 },
        ]
        const results = matchHoldingsToCategories(holdings, [zaimCategories[0]])

        assert.equal(results.length, 2)
        assert.equal(results[0].categoryId, 1)
        assert.equal(results[1].categoryId, null)
        assert.equal(results[1].confidence, "none")
    })

    it("does not match categories without alias in the list", () => {
        const holdings: ParsedHolding[] = [{ name: "NTT", valuation: 14950 }]
        const results = matchHoldingsToCategories(holdings, zaimCategories.slice(0, 1))

        assert.equal(results[0].categoryName, "NTT株")
    })
})

describe("rematchResultsToCategories", () => {
    const dismissedMarker: YenAmountCandidate = {
        value: 38060,
        bbox: { x: 10, y: 20, width: 30, height: 10 },
        ocrText: "¥38,060",
        kind: "valuation",
    }

    function baseResult(
        partial: Partial<MatchResult> & Pick<MatchResult, "ocrName" | "valuation">
    ): MatchResult {
        return {
            categoryId: null,
            categoryName: null,
            confidence: "order",
            selected: true,
            ...partial,
        }
    }

    it("reassigns categories skipping dismissed rows", () => {
        const results: MatchResult[] = [
            baseResult({
                ocrName: "NTT",
                valuation: 14950,
                categoryId: 1,
                categoryName: "NTT株",
            }),
            baseResult({
                ocrName: "三菱重",
                valuation: 38060,
                categoryId: 2,
                categoryName: "三菱重工",
                imageDismissedCandidate: dismissedMarker,
            }),
            baseResult({
                ocrName: "eMAXIS Slim 全世界",
                valuation: 84797,
                categoryId: 3,
                categoryName: "全世界株",
            }),
        ]

        const rematched = rematchResultsToCategories(results, zaimCategories)

        assert.equal(rematched[0].categoryId, 1)
        assert.equal(rematched[1].categoryId, null)
        assert.equal(rematched[1].selected, false)
        assert.ok(rematched[1].imageDismissedCandidate)
        assert.equal(rematched[2].categoryId, 2)
        assert.equal(rematched[2].categoryName, "三菱重工")
    })
})
