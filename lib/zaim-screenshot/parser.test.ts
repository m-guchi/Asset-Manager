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

        assert.equal(result.length, 1)
        assert.equal(result[0].name, "NTT")
        assert.equal(result[0].valuation, 14950)
        assert.equal(result[0].valuationBbox?.x, 280)
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

    it("records valuation bbox from ocr words", () => {
        const words: OcrWord[] = [
            word("NTT", 20, 100),
            word("¥14,950", 280, 100, 60, 16),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result[0].valuation, 14950)
        assert.deepEqual(result[0].valuationBbox, { x: 280, y: 100, width: 60, height: 16 })
    })

    it("picks valuation column not profit-loss on the same row", () => {
        const words: OcrWord[] = [
            word("楽天", 20, 200),
            word("¥74,530", 260, 200),
            word("-¥2,670", 330, 200),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result[0].valuation, 74530)
        assert.equal(result[0].valuationBbox?.x, 260)
        assert.equal(result[0].amountCandidates?.length, 2)
        assert.equal(result[0].amountCandidates?.[1].kind, "profit_loss")
    })

    it("skips row when only profit-loss amounts are detected", () => {
        const words: OcrWord[] = [
            word("NTT", 20, 100),
            word("+¥450", 340, 100),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result.length, 0)
    })

    it("picks the largest yen amount when multiple exist on a row", () => {
        const words: OcrWord[] = [
            word("楽天", 20, 200),
            word("¥74,530", 260, 200),
            word("-¥2,670", 330, 200),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result[0].valuation, 74530)
        assert.equal(result[0].valuationBbox?.x, 260)
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
        assert.equal(result[0].name, "NTT")
        assert.equal(result[0].valuation, 14950)
        assert.equal(result[1].name, "三菱重")
        assert.equal(result[1].valuation, 38060)
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

        assert.equal(result.length, 1)
        assert.equal(result[0].name, "NTT")
        assert.equal(result[0].valuation, 14950)
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

    it("does not create a phantom holding from a wrapped fund name's profit/loss line even without a leading sign", () => {
        // 2行名の投信: 1行目=評価額、2行目=名前の続き（括弧が閉じない省略形）+ 符号なしの損益額(+%)
        const words: OcrWord[] = [
            word("SBI証券A", 20, 300, 60, 16),
            word("¥88,824", 280, 300),
            word("(為替ヘッジ…", 20, 340, 60, 16),
            word("¥33,813", 280, 340),
            word("(+13.3%)", 360, 340),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result.length, 1)
        assert.equal(result[0].name, "SBI証券A")
        assert.equal(result[0].valuation, 88824)
    })

    it("classifies an unsigned amount as profit-loss when the row contains a percent-in-parens", () => {
        const words: OcrWord[] = [
            word("eMAXIS", 20, 340, 60, 16),
            word("¥21,927", 280, 340),
            word("(+13.7%)", 360, 340),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        // 評価額として拾える候補が無いため行ごと破棄される
        assert.equal(result.length, 0)
    })

    it("keeps a placeholder holding when a name row has no readable yen amount, preserving order", () => {
        const words: OcrWord[] = [
            word("NTT", 20, 100),
            word("¥14,950", 280, 100),
            word("ソニー生命", 20, 140),
            word("三菱重", 20, 180),
            word("¥38,060", 280, 180),
        ]

        const result = parseZaimHoldings(words, imageWidth)

        assert.equal(result.length, 3)
        assert.equal(result[0].name, "NTT")
        assert.equal(result[0].unreadable, undefined)
        assert.equal(result[1].name, "ソニー生命")
        assert.equal(result[1].valuation, 0)
        assert.equal(result[1].unreadable, true)
        assert.equal(result[2].name, "三菱重")
        assert.equal(result[2].valuation, 38060)
    })
})
