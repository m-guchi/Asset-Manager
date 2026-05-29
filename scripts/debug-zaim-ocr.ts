import { createWorker } from "tesseract.js"
import { parseZaimHoldings } from "../lib/zaim-screenshot/parser"
import type { OcrWord } from "../lib/zaim-screenshot/types"

const path = process.argv[2]

async function ocrImage(filePath: string) {
    const worker = await createWorker("jpn")
    try {
        const { data } = await worker.recognize(filePath, {}, { blocks: true })
        const words: OcrWord[] = []
        for (const block of data.blocks ?? []) {
            for (const paragraph of block.paragraphs) {
                for (const line of paragraph.lines) {
                    console.log("LINE:", line.text)
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
        return { words, imageWidth: Math.max(...words.map((w) => w.x + w.width), 400) }
    } finally {
        await worker.terminate()
    }
}

async function main() {
    const { words, imageWidth } = await ocrImage(path)
    console.log("\nimageWidth:", imageWidth, "word count:", words.length)
    console.log("\nSample words with ¥ or numbers:")
    words.filter((w) => /[¥￥\d]/.test(w.text)).slice(0, 30).forEach((w) =>
        console.log(`  "${w.text}" @ x=${w.x} y=${w.y}`)
    )
    const holdings = parseZaimHoldings(words, imageWidth)
    console.log("\nParsed holdings:", holdings.length)
    holdings.forEach((h) => console.log(`  ${h.name} = ${h.valuation}`))
}

main().catch(console.error)
