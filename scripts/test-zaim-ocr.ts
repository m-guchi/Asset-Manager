import { createWorker } from "tesseract.js"
import { parseZaimHoldings, mergeParsedHoldings } from "../lib/zaim-screenshot/parser"
import type { OcrWord } from "../lib/zaim-screenshot/types"

const images = [process.argv[2], process.argv[3]].filter(Boolean)

async function ocrImage(path: string) {
    const worker = await createWorker("jpn")
    try {
        const { data } = await worker.recognize(path, {}, { blocks: true })
        const words: OcrWord[] = []
        for (const block of data.blocks ?? []) {
            for (const paragraph of block.paragraphs) {
                for (const line of paragraph.lines) {
                    for (const word of line.words) {
                        const text = word.text.trim()
                        if (!text) continue
                        words.push({
                            text,
                            x: word.bbox.x0,
                            y: word.bbox.y0,
                            width: word.bbox.x1 - word.bbox.x0,
                            height: word.bbox.y1 - word.bbox.y0,
                        })
                    }
                }
            }
        }
        const imageWidth = words.length > 0 ? Math.max(...words.map((w) => w.x + w.width)) : 400
        return { words, imageWidth }
    } finally {
        await worker.terminate()
    }
}

async function main() {
    const allHoldings = []
    for (const img of images) {
        console.log("\n=== OCR:", img.split("/").pop(), "===")
        const { words, imageWidth } = await ocrImage(img)
        console.log("words:", words.length, "imageWidth:", imageWidth)
        const holdings = parseZaimHoldings(words, imageWidth)
        console.log("holdings:", holdings.length)
        holdings.forEach((h, i) =>
            console.log(`  ${i + 1}. ${h.name || "(no name)"} = ¥${h.valuation.toLocaleString()}`)
        )
        allHoldings.push(...holdings)
    }

    const merged = mergeParsedHoldings(allHoldings)
    console.log("\n=== MERGED:", merged.length, "items ===")
    merged.forEach((h, i) =>
        console.log(`  ${i + 1}. ${h.name || "(no name)"} = ¥${h.valuation.toLocaleString()}`)
    )
}

main().catch(console.error)
