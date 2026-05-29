import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mergeMatchResults } from "./matcher"
import { mergeParsedHoldings } from "./parser"
import type { MatchResult, ParsedHolding } from "./types"

describe("mergeParsedHoldings", () => {
    it("deduplicates holdings by name keeping higher valuation", () => {
        const holdings: ParsedHolding[] = [
            { name: "NTT", valuation: 14950 },
            { name: "NTT", valuation: 15000 },
            { name: "楽天", valuation: 74530 },
        ]

        const merged = mergeParsedHoldings(holdings)

        assert.equal(merged.length, 2)
        assert.deepEqual(
            merged.find((h) => h.name === "NTT"),
            { name: "NTT", valuation: 15000 }
        )
    })
})

describe("mergeMatchResults", () => {
    const base: MatchResult[] = [
        {
            categoryId: 1,
            categoryName: "NTT",
            ocrName: "NTT",
            valuation: 14950,
            confidence: "high",
            selected: true,
        },
    ]

    it("appends non-duplicate matches from another image", () => {
        const incoming: MatchResult[] = [
            {
                categoryId: 2,
                categoryName: "楽天",
                ocrName: "楽天",
                valuation: 74530,
                confidence: "high",
                selected: true,
            },
        ]

        const merged = mergeMatchResults(base, incoming)

        assert.equal(merged.length, 2)
    })

    it("skips duplicate ocr names across overlapping screenshots", () => {
        const incoming: MatchResult[] = [
            {
                categoryId: 1,
                categoryName: "NTT",
                ocrName: "NTT",
                valuation: 15000,
                confidence: "high",
                selected: true,
            },
        ]

        const merged = mergeMatchResults(base, incoming)

        assert.equal(merged.length, 1)
        assert.equal(merged[0].valuation, 14950)
    })

    it("skips when category is already matched", () => {
        const incoming: MatchResult[] = [
            {
                categoryId: 1,
                categoryName: "NTT",
                ocrName: "NTT株",
                valuation: 15000,
                confidence: "medium",
                selected: true,
            },
            {
                categoryId: 2,
                categoryName: "楽天",
                ocrName: "楽天",
                valuation: 74530,
                confidence: "high",
                selected: true,
            },
        ]

        const merged = mergeMatchResults(base, incoming)

        assert.equal(merged.length, 2)
        assert.equal(merged[1].ocrName, "楽天")
    })
})
