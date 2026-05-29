import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    concatenateHoldingsInOrder,
    findOverlapLength,
    holdingsAreSameItem,
    mergeTwoHoldingsSequences,
} from "./stitch-holdings"
import type { ParsedHolding } from "./types"

function h(name: string, valuation: number): ParsedHolding {
    return { name, valuation }
}

describe("holdingsAreSameItem", () => {
    it("matches same name and valuation", () => {
        assert.equal(holdingsAreSameItem(h("NTT", 14950), h("NTT", 14950)), true)
    })

    it("does not match when valuation differs", () => {
        assert.equal(holdingsAreSameItem(h("NTT", 14950), h("NTT", 15000)), false)
    })
})

describe("concatenateHoldingsInOrder", () => {
    it("concatenates sequences in given order", () => {
        const top = [h("NTT", 14950), h("楽天", 74530), h("三菱重", 38060)]
        const bottom = [h("三菱重", 38060), h("eMAXIS", 84797)]

        const merged = concatenateHoldingsInOrder([top, bottom])

        assert.deepEqual(
            merged.map((x) => x.name),
            ["NTT", "楽天", "三菱重", "eMAXIS"]
        )
    })

    it("follows manual order when images were selected bottom-first", () => {
        const top = [h("NTT", 14950), h("楽天", 74530)]
        const bottom = [h("楽天", 74530), h("三菱重", 38060)]

        const wrongOrder = concatenateHoldingsInOrder([bottom, top])
        assert.deepEqual(
            wrongOrder.map((x) => x.name),
            ["楽天", "三菱重", "NTT", "楽天"]
        )

        const correctOrder = concatenateHoldingsInOrder([top, bottom])
        assert.deepEqual(
            correctOrder.map((x) => x.name),
            ["NTT", "楽天", "三菱重"]
        )
    })

    it("deduplicates only at adjacent boundaries", () => {
        const seq1 = [h("NTT", 14950), h("楽天", 74530)]
        const seq2 = [h("楽天", 74530), h("三菱重", 38060)]

        const merged = concatenateHoldingsInOrder([seq1, seq2])

        assert.equal(merged.length, 3)
    })

    it("keeps same-name rows when valuations differ", () => {
        const seq1 = [h("eMAXIS Slim 国内株式", 180983)]
        const seq2 = [h("eMAXIS Slim 国内株式", 63433)]

        const merged = concatenateHoldingsInOrder([seq1, seq2])

        assert.equal(merged.length, 2)
    })
})

describe("findOverlapLength", () => {
    it("finds suffix-prefix overlap", () => {
        const a = [h("A", 1), h("B", 2), h("C", 3)]
        const b = [h("C", 3), h("D", 4)]

        assert.equal(findOverlapLength(a, b), 1)
    })
})

describe("mergeTwoHoldingsSequences", () => {
    it("merges when second image continues the first", () => {
        const top = [h("NTT", 14950), h("楽天", 74530), h("三菱重", 38060)]
        const bottom = [h("三菱重", 38060), h("eMAXIS", 84797)]

        const merged = mergeTwoHoldingsSequences(top, bottom)

        assert.deepEqual(
            merged.map((x) => x.name),
            ["NTT", "楽天", "三菱重", "eMAXIS"]
        )
    })
})
