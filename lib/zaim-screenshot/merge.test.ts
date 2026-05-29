import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mergeMatchResults } from "./matcher"
import { mergeParsedHoldings } from "./parser"
import type { MatchResult, ParsedHolding } from "./types"

describe("mergeParsedHoldings", () => {
    it("keeps same name with different valuations as separate items", () => {
        const holdings: ParsedHolding[] = [
            { name: "eMAXIS Slim 国内株式", valuation: 180983 },
            { name: "eMAXIS Slim 国内株式", valuation: 63433 },
            { name: "楽天", valuation: 74530 },
        ]

        const merged = mergeParsedHoldings(holdings)

        assert.equal(merged.length, 3)
    })

    it("deduplicates when name and valuation both match", () => {
        const holdings: ParsedHolding[] = [
            { name: "NTT", valuation: 14950 },
            { name: "NTT", valuation: 14950 },
            { name: "NTT", valuation: 15000 },
        ]

        const merged = mergeParsedHoldings(holdings)

        assert.equal(merged.length, 2)
        assert.ok(merged.some((h) => h.name === "NTT" && h.valuation === 14950))
        assert.ok(merged.some((h) => h.name === "NTT" && h.valuation === 15000))
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

    it("skips duplicate when ocr name and valuation both match", () => {
        const incoming: MatchResult[] = [
            {
                categoryId: 1,
                categoryName: "NTT",
                ocrName: "NTT",
                valuation: 14950,
                confidence: "high",
                selected: true,
            },
        ]

        const merged = mergeMatchResults(base, incoming)

        assert.equal(merged.length, 1)
    })

    it("keeps same ocr name when valuation differs", () => {
        const incoming: MatchResult[] = [
            {
                categoryId: 2,
                categoryName: "eMAXIS国内1",
                ocrName: "eMAXIS Slim 国内株式",
                valuation: 63433,
                confidence: "order",
                selected: true,
            },
        ]
        const existing: MatchResult[] = [
            {
                categoryId: 1,
                categoryName: "eMAXIS国内2",
                ocrName: "eMAXIS Slim 国内株式",
                valuation: 180983,
                confidence: "order",
                selected: true,
            },
        ]

        const merged = mergeMatchResults(existing, incoming)

        assert.equal(merged.length, 2)
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
