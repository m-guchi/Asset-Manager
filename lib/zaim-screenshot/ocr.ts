import type { OcrWord } from "./types"

interface TesseractWord {
    text: string
    bbox: { x0: number; y0: number; x1: number; y1: number }
}

interface TesseractPage {
    blocks: Array<{
        paragraphs: Array<{
            lines: Array<{
                words: TesseractWord[]
            }>
        }>
    }> | null
}

export type OcrWorker = {
    recognize: (
        canvas: HTMLCanvasElement,
        onProgress?: (progress: number) => void
    ) => Promise<{ words: OcrWord[]; imageWidth: number; imageHeight: number }>
    terminate: () => Promise<void>
}

export async function createOcrWorker(): Promise<OcrWorker> {
    const Tesseract = await import("tesseract.js")
    let progressCallback: ((progress: number) => void) | undefined

    const worker = await Tesseract.createWorker("jpn", 1, {
        logger: (message) => {
            if (message.status === "recognizing text" && progressCallback) {
                progressCallback(message.progress ?? 0)
            }
        },
    })

    return {
        recognize: async (canvas, onProgress) => {
            progressCallback = onProgress
            try {
                const { data } = await worker.recognize(canvas, {}, { blocks: true })
                const page = data as TesseractPage
                const words: OcrWord[] = []

                for (const block of page.blocks ?? []) {
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

                return {
                    words,
                    imageWidth: canvas.width,
                    imageHeight: canvas.height,
                }
            } finally {
                progressCallback = undefined
            }
        },
        terminate: async () => {
            await worker.terminate()
        },
    }
}

export async function terminateOcrWorker(worker: OcrWorker): Promise<void> {
    await worker.terminate()
}

export async function runOcr(
    canvas: HTMLCanvasElement,
    onProgress?: (progress: number) => void
): Promise<{ words: OcrWord[]; imageWidth: number; imageHeight: number }> {
    const worker = await createOcrWorker()
    try {
        return await worker.recognize(canvas, onProgress)
    } finally {
        await worker.terminate()
    }
}
