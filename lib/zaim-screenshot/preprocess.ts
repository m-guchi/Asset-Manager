const MIN_WIDTH = 800
const SCALE_FACTOR = 2

/**
 * Prepares a Zaim screenshot for OCR: upscale if small, boost contrast for dark-mode UI.
 */
export async function preprocessScreenshot(file: File): Promise<HTMLCanvasElement> {
    const image = await loadImage(file)
    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height

    let targetWidth = sourceWidth
    let targetHeight = sourceHeight

    if (sourceWidth < MIN_WIDTH) {
        targetWidth = sourceWidth * SCALE_FACTOR
        targetHeight = sourceHeight * SCALE_FACTOR
    }

    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext("2d")
    if (!ctx) {
        throw new Error("Canvas context unavailable")
    }

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const gray = 0.299 * r + 0.587 * g + 0.114 * b

        const inverted = 255 - gray
        const contrast = 1.4
        const adjusted = Math.min(255, Math.max(0, (inverted - 128) * contrast + 128))

        data[i] = adjusted
        data[i + 1] = adjusted
        data[i + 2] = adjusted
    }

    ctx.putImageData(imageData, 0, 0)
    return canvas
}

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()

        img.onload = () => {
            URL.revokeObjectURL(url)
            resolve(img)
        }
        img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error("Failed to load image"))
        }
        img.src = url
    })
}
