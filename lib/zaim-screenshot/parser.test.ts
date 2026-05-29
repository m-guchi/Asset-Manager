import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseZaimHoldings } from "./parser"
import type { OcrWord } from "./types"

function word(
    text: string,
    x: number,
    y: number,
    width = 40,
    height = 16
): OcrWord {
    return { text, x, y, width, height }
}

describe("parseZaimHoldings", () => {
    const imageWidth = 400

    it("extracts name and primary valuation from a row", () => {
        const words: OcrWord[] = [
            word("NTT", 20, 100),
            word("¥14,950", 280, 100),
            word("+¥450", 340, 100),
            word("(+3.1%)", 360, 100),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.deepEqual(result, [{ name: "NTT", valuation: 14950 }])
    })

    it("ignores broker account header rows", () => {
        const words: OcrWord[] = [
            word("SBI", 160, 20),
            word("証券", 200, 20),
            word("NTT", 20, 100),
            word("¥14,950", 280, 100),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result.length, 1)
        assert.equal(result[0].name, "NTT")
    })

    it("ignores Zaim section headers", () => {
        const words: OcrWord[] = [
            word("投資信託", 20, 80),
            word("NTT", 20, 120),
            word("¥14,950", 280, 120),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result.length, 1)
        assert.equal(result[0].name, "NTT")
    })

    it("picks the largest yen amount when multiple exist on a row", () => {
        const words: OcrWord[] = [
            word("楽天", 20, 200),
            word("¥74,530", 260, 200),
            word("-¥2,670", 330, 200),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result[0].valuation, 74530)
    })

    it("handles multiple holdings", () => {
        const words: OcrWord[] = [
            word("NTT", 20, 100),
            word("¥14,950", 280, 100),
            word("三菱重", 20, 140),
            word("¥38,060", 280, 140),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result.length, 2)
        assert.deepEqual(result[0], { name: "NTT", valuation: 14950 })
        assert.deepEqual(result[1], { name: "三菱重", valuation: 38060 })
    })

    it("strips trailing ellipsis from fund names", () => {
        const words: OcrWord[] = [
            word("eMAXIS", 20, 300),
            word("Slim", 70, 300),
            word("全世界株式...", 120, 300),
            word("¥84,797", 280, 300),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result[0].name, "eMAXIS Slim 全世界株式")
        assert.equal(result[0].valuation, 84797)
    })

    it("extracts valuation when OCR misreads yen as backslash", () => {
        const words: OcrWord[] = [
            word("NTT", 20, 100),
            word("\\14,950", 280, 100),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.deepEqual(result, [{ name: "NTT", valuation: 14950 }])
    })

    it("skips profit-loss-only rows", () => {
        const words: OcrWord[] = [
            word("NTT", 20, 100),
            word("\\14,950", 280, 100),
            word("Y450", 300, 130),
            word("(+3.1%)", 360, 130),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result.length, 1)
        assert.equal(result[0].valuation, 14950)
    })

    it("extracts valuation-only rows without a name", () => {
        const words: OcrWord[] = [
            word("\\14,950", 280, 100),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result.length, 1)
        assert.equal(result[0].name, "")
        assert.equal(result[0].valuation, 14950)
    })
})
