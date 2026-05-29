import { preprocessScreenshot } from "./preprocess"
import { createOcrWorker, terminateOcrWorker, type OcrWorker } from "./ocr"
import { parseZaimHoldings } from "./parser"
import { matchHoldingsToCategories } from "./matcher"
import { concatenateHoldingsInOrder } from "./stitch-holdings"
import type { MatchResult, ParsedHolding, ValuationCategoryRef, OcrValuationSource } from "./types"

export { filterZaimImportCategories } from "./filter-categories"
export type { OcrWord, OcrBoundingBox, OcrValuationSource, YenAmountCandidate, YenAmountKind, ParsedHolding, MatchConfidence, MatchResult, ValuationCategoryRef } from "./types"
export {
    normalizeName,
    levenshteinDistance,
    matchHoldingsToCategories,
    rematchResultsToCategories,
    mergeMatchResults,
} from "./matcher"
export { parseZaimHoldings, mergeParsedHoldings, classifyYenAmountKind, extractYenAmountCandidates } from "./parser"
export {
    concatenateHoldingsInOrder,
    mergeTwoHoldingsSequences,
    findOverlapLength,
    holdingsAreSameItem,
} from "./stitch-holdings"

export type ProcessProgressCallback = (
    progress: number,
    stage: "preprocess" | "ocr" | "parse",
    fileIndex: number,
    fileCount: number
) => void

async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Failed to read image file"))
        reader.readAsDataURL(file)
    })
}

function attachSourceToHoldings(
    holdings: ParsedHolding[],
    imageDataUrl: string,
    ocrImageWidth: number,
    ocrImageHeight: number
): ParsedHolding[] {
    return holdings.map((holding) => {
        if (!holding.valuationBbox) return holding
        const source: OcrValuationSource = {
            imageDataUrl,
            ocrImageWidth,
            ocrImageHeight,
            valuationBbox: holding.valuationBbox,
            amountCandidates: holding.amountCandidates,
        }
        return {
            name: holding.name,
            valuation: holding.valuation,
            amountCandidates: holding.amountCandidates,
            source,
        }
    })
}

async function extractHoldingsFromFile(
    file: File,
    worker: OcrWorker,
    onFileProgress?: (progress: number, stage: "preprocess" | "ocr" | "parse") => void
): Promise<ParsedHolding[]> {
    onFileProgress?.(0, "preprocess")
    const [canvas, imageDataUrl] = await Promise.all([
        preprocessScreenshot(file),
        fileToDataUrl(file),
    ])

    onFileProgress?.(0.1, "ocr")
    const { words, imageWidth, imageHeight } = await worker.recognize(canvas, (p) => {
        onFileProgress?.(0.1 + p * 0.85, "ocr")
    })

    onFileProgress?.(0.98, "parse")
    const holdings = parseZaimHoldings(words, imageWidth)
    onFileProgress?.(1, "parse")
    return attachSourceToHoldings(holdings, imageDataUrl, imageWidth, imageHeight)
}

export async function extractHoldingsSequencesFromFiles(
    files: File[],
    onProgress?: ProcessProgressCallback
): Promise<ParsedHolding[][]> {
    if (files.length === 0) return []

    const worker = await createOcrWorker()

    try {
        const sequences: ParsedHolding[][] = []

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const holdings = await extractHoldingsFromFile(file, worker, (p, stage) => {
                const overall = (i + p) / files.length
                onProgress?.(overall, stage, i + 1, files.length)
            })
            sequences.push(holdings)
        }

        onProgress?.(1, "parse", files.length, files.length)
        return sequences
    } finally {
        await terminateOcrWorker(worker)
    }
}

export function combineAndMatchHoldings(
    sequences: ParsedHolding[][],
    categories: ValuationCategoryRef[]
): MatchResult[] {
    const merged = concatenateHoldingsInOrder(sequences)
    return matchHoldingsToCategories(merged, categories)
}

export async function processZaimScreenshots(
    files: File[],
    categories: ValuationCategoryRef[],
    onProgress?: ProcessProgressCallback
): Promise<MatchResult[]> {
    const sequences = await extractHoldingsSequencesFromFiles(files, onProgress)
    return combineAndMatchHoldings(sequences, categories)
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
