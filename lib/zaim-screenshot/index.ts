import { preprocessScreenshot } from "./preprocess"
import { createOcrWorker, terminateOcrWorker, type OcrWorker } from "./ocr"
import { parseZaimHoldings, mergeParsedHoldings } from "./parser"
import { matchHoldingsToCategories } from "./matcher"
import type { MatchResult, ParsedHolding, ValuationCategoryRef } from "./types"

export { filterZaimImportCategories } from "./filter-categories"
export type { OcrWord, ParsedHolding, MatchConfidence, MatchResult, ValuationCategoryRef } from "./types"
export { normalizeName, levenshteinDistance, matchHoldingsToCategories, mergeMatchResults } from "./matcher"
export { parseZaimHoldings, mergeParsedHoldings } from "./parser"

export type ProcessProgressCallback = (
    progress: number,
    stage: "preprocess" | "ocr" | "parse",
    fileIndex: number,
    fileCount: number
) => void

async function extractHoldingsFromFile(
    file: File,
    worker: OcrWorker,
    onFileProgress?: (progress: number, stage: "preprocess" | "ocr" | "parse") => void
): Promise<ParsedHolding[]> {
    onFileProgress?.(0, "preprocess")
    const canvas = await preprocessScreenshot(file)

    onFileProgress?.(0.1, "ocr")
    const { words, imageWidth } = await worker.recognize(canvas, (p) => {
        onFileProgress?.(0.1 + p * 0.85, "ocr")
    })

    onFileProgress?.(0.98, "parse")
    const holdings = parseZaimHoldings(words, imageWidth)
    onFileProgress?.(1, "parse")
    return holdings
}

export async function processZaimScreenshots(
    files: File[],
    categories: ValuationCategoryRef[],
    onProgress?: ProcessProgressCallback
): Promise<MatchResult[]> {
    if (files.length === 0) return []

    const worker = await createOcrWorker()

    try {
        const allHoldings: ParsedHolding[] = []

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const holdings = await extractHoldingsFromFile(file, worker, (p, stage) => {
                const overall = (i + p) / files.length
                onProgress?.(overall, stage, i + 1, files.length)
            })
            allHoldings.push(...holdings)
        }

        onProgress?.(1, "parse", files.length, files.length)
        const merged = mergeParsedHoldings(allHoldings)
        return matchHoldingsToCategories(merged, categories)
    } finally {
        await terminateOcrWorker(worker)
    }
}

export async function processZaimScreenshot(
    file: File,
    categories: ValuationCategoryRef[],
    onProgress?: (progress: number, stage: "preprocess" | "ocr" | "parse") => void
): Promise<MatchResult[]> {
    return processZaimScreenshots([file], categories, (p, stage) => {
        onProgress?.(p, stage)
    })
}
