"use client"

import React, { useCallback, useMemo, useRef, useState } from "react"
import { ImagePlus, Loader2, AlertTriangle, ScanSearch, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {
    combineAndMatchHoldings,
    extractHoldingsSequencesFromFiles,
    matchHoldingsToCategories,
    rematchResultsToCategories,
    type MatchResult,
    type ParsedHolding,
    type ValuationCategoryRef,
    type YenAmountCandidate,
} from "@/lib/zaim-screenshot"
import {
    formatValuationDiff,
    isLargeValuationDiff,
    LARGE_VALUATION_DIFF_RATIO,
} from "@/lib/valuation-diff"
import {
    OcrSourcePreviewDialog,
    dismissAdoptedOnImage,
    excludeValuationCandidate,
    getActiveValuation,
    hasAdoptedValuation,
    selectValuationCandidate,
} from "@/components/assets/ocr-source-preview"
import { ZaimImageReadCheck } from "@/components/assets/zaim-image-read-check"
import {
    ZaimImageOrderList,
    buildQueueItemsFromFiles,
    revokeQueuePreviewUrls,
    type ImageQueueItem,
} from "@/components/assets/zaim-image-order-list"

interface ZaimScreenshotImportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    categories: ValuationCategoryRef[]
    onApply: (valuations: Record<number, number>) => void
}

const CONFIDENCE_LABELS: Record<MatchResult["confidence"], string> = {
    high: "高",
    medium: "中",
    low: "低",
    order: "順序",
    none: "未一致",
}

const CONFIDENCE_VARIANTS: Record<
    MatchResult["confidence"],
    "default" | "secondary" | "outline" | "destructive"
> = {
    high: "default",
    medium: "secondary",
    low: "outline",
    order: "secondary",
    none: "destructive",
}

interface ImportTableRow {
    key: string
    label: string
    current: number | null
    result: MatchResult | null
    resultIndex: number | null
    categoryIndex: number | null
    isExtra: boolean
}

function buildImportTableRows(
    categories: ValuationCategoryRef[],
    results: MatchResult[]
): ImportTableRow[] {
    const resultByCategoryId = new Map<
        number,
        { result: MatchResult; index: number }
    >()
    const claimedIndices = new Set<number>()

    for (let index = 0; index < results.length; index++) {
        const result = results[index]
        if (
            result.categoryId !== null &&
            hasAdoptedValuation(result) &&
            !resultByCategoryId.has(result.categoryId)
        ) {
            resultByCategoryId.set(result.categoryId, { result, index })
            claimedIndices.add(index)
        }
    }

    const rows: ImportTableRow[] = categories.map((category, categoryIndex) => {
        const matched = resultByCategoryId.get(category.id)
        return {
            key: `cat-${category.id}`,
            label: category.name,
            current: category.currentValue ?? 0,
            result: matched?.result ?? null,
            resultIndex: matched?.index ?? null,
            categoryIndex,
            isExtra: false,
        }
    })

    for (let index = 0; index < results.length; index++) {
        const result = results[index]
        if (hasAdoptedValuation(result) && !claimedIndices.has(index)) {
            rows.push({
                key: `extra-${index}`,
                label:
                    result.categoryName ??
                    (result.ocrName.trim() || `(行${index + 1})`),
                current: null,
                result,
                resultIndex: index,
                categoryIndex: null,
                isExtra: true,
            })
        }
    }

    return rows
}

function getImageFiles(fileList: FileList | null): File[] {
    if (!fileList) return []
    return Array.from(fileList).filter((file) => file.type.startsWith("image/"))
}

function matchFromQueue(
    items: ImageQueueItem[],
    categories: ValuationCategoryRef[]
): MatchResult[] {
    return combineAndMatchHoldings(
        items.map((item) => item.holdings ?? []),
        categories
    )
}

function tagHoldingsWithImageId(
    holdings: ParsedHolding[],
    imageId: string
): ParsedHolding[] {
    return holdings.map((holding) => ({
        ...holding,
        source: holding.source
            ? { ...holding.source, sourceImageId: imageId }
            : undefined,
    }))
}

function resultToHolding(result: MatchResult): ParsedHolding {
    return {
        name: result.ocrName,
        valuation: result.valuation,
        source: result.source,
        amountCandidates: result.amountCandidates,
        valuationBbox: result.source?.valuationBbox,
        unreadable: result.unreadable,
        manual: result.manual,
    }
}

export function ZaimScreenshotImportDialog({
    open,
    onOpenChange,
    categories,
    onApply,
}: ZaimScreenshotImportDialogProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    /** 読取位置プレビューを閉じるとき、親ダイアログまで閉じない */
    const closingPreviewOnlyRef = useRef(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [stage, setStage] = useState<"preprocess" | "ocr" | "parse" | null>(null)
    const [fileIndex, setFileIndex] = useState(0)
    const [fileCount, setFileCount] = useState(0)
    const [queueItems, setQueueItems] = useState<ImageQueueItem[]>([])
    const [results, setResults] = useState<MatchResult[]>([])
    const [previewIndex, setPreviewIndex] = useState<number | null>(null)
    const [resultView, setResultView] = useState<"table" | "images">("images")

    const awaitingOcr = queueItems.some((item) => item.holdings === undefined)
    const hasResults = queueItems.length > 0 && !awaitingOcr

    const resetState = useCallback(() => {
        setQueueItems((prev) => {
            revokeQueuePreviewUrls(prev)
            return []
        })
        setIsProcessing(false)
        setProgress(0)
        setStage(null)
        setFileIndex(0)
        setFileCount(0)
        setResults([])
        setPreviewIndex(null)
        setResultView("images")
        if (fileInputRef.current) fileInputRef.current.value = ""
    }, [])

    const closePreviewOnly = useCallback(() => {
        closingPreviewOnlyRef.current = true
        setPreviewIndex(null)
    }, [])

    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (!nextOpen) {
                if (closingPreviewOnlyRef.current) {
                    closingPreviewOnlyRef.current = false
                    return
                }
                if (previewIndex !== null) {
                    setPreviewIndex(null)
                    return
                }
                resetState()
                onOpenChange(false)
                return
            }
            onOpenChange(true)
        },
        [previewIndex, onOpenChange, resetState]
    )

    const handlePreviewOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (!nextOpen) closePreviewOnly()
        },
        [closePreviewOnly]
    )

    const handleGoBack = useCallback(() => {
        if (previewIndex !== null) {
            closePreviewOnly()
            return
        }
        if (hasResults) {
            setQueueItems((prev) =>
                prev.map((item) => ({
                    id: item.id,
                    name: item.name,
                    previewUrl: item.previewUrl,
                    file: item.file,
                    holdings: undefined,
                }))
            )
            setResults([])
            setPreviewIndex(null)
            setResultView("images")
            return
        }
        if (queueItems.length > 0) {
            resetState()
            return
        }
        handleOpenChange(false)
    }, [
        previewIndex,
        hasResults,
        queueItems.length,
        closePreviewOnly,
        resetState,
        handleOpenChange,
    ])

    const addFilesToQueue = (files: File[], append: boolean) => {
        const newItems = buildQueueItemsFromFiles(files)

        setQueueItems((prev) => {
            if (!append) {
                revokeQueuePreviewUrls(prev)
                return newItems
            }
            return [...prev, ...newItems]
        })

        if (append) {
            toast.success(`${files.length}枚を追加しました。順序を確認して読み取りを開始してください。`)
        } else {
            setResults([])
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = getImageFiles(e.target.files)
        if (fileInputRef.current) fileInputRef.current.value = ""
        if (files.length === 0) return

        const append = queueItems.length > 0
        addFilesToQueue(files, append)
    }

    const handleQueueReorder = (items: ImageQueueItem[]) => {
        setQueueItems(items)
        if (!items.some((item) => item.holdings === undefined)) {
            setResults(matchFromQueue(items, categories))
        }
    }

    const runOcr = async () => {
        if (queueItems.length === 0) {
            toast.error("画像ファイルを選択してください")
            return
        }

        const pendingItems = queueItems.filter((item) => item.holdings === undefined)
        if (pendingItems.length === 0) {
            const matches = matchFromQueue(queueItems, categories)
            setResults(matches)
            return
        }

        setIsProcessing(true)
        setProgress(0)
        setFileCount(pendingItems.length)

        try {
            const files = pendingItems.map((item) => item.file)
            const sequences = await extractHoldingsSequencesFromFiles(
                files,
                (p, s, index, count) => {
                    setProgress(Math.round(p * 100))
                    setStage(s)
                    setFileIndex(index)
                    setFileCount(count)
                }
            )

            let seqIndex = 0
            const updatedItems = queueItems.map((item) => {
                if (item.holdings !== undefined) return item
                return {
                    ...item,
                    holdings: tagHoldingsWithImageId(
                        sequences[seqIndex++] ?? [],
                        item.id
                    ),
                }
            })

            setQueueItems(updatedItems)

            const matches = matchFromQueue(updatedItems, categories)
            setResults(matches)
            setResultView("images")

            if (matches.length === 0) {
                toast.warning(
                    "銘柄を読み取れませんでした。Zaimの証券口座・保有銘柄一覧画面のスクショか確認してください。"
                )
            } else if (categories.length > 0) {
                const assigned = matches.filter((m) => m.categoryId !== null).length
                if (assigned !== categories.length || matches.length !== categories.length) {
                    toast.warning(
                        `読取 ${matches.length}行 / 登録 ${categories.length}項目 — 件数が一致しません。画像の順序とZaim表示名を確認してください。`
                    )
                }
            }
        } catch (error) {
            console.error("Zaim screenshot OCR error:", error)
            toast.error("画像の読み取りに失敗しました")
        } finally {
            setIsProcessing(false)
            setStage(null)
        }
    }

    const updateResult = (index: number, patch: Partial<MatchResult>) => {
        setResults((prev) =>
            prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
        )
    }

    const removeResult = (index: number) => {
        const holdings = results.map(resultToHolding)
        holdings.splice(index, 1)
        setResults(matchHoldingsToCategories(holdings, categories))
        setPreviewIndex((prev) => {
            if (prev === null) return null
            if (prev === index) return null
            if (prev > index) return prev - 1
            return prev
        })
    }

    const insertManualResult = (categoryIndex: number) => {
        const holdings = results.map(resultToHolding)
        const insertAt = Math.min(categoryIndex, holdings.length)
        holdings.splice(insertAt, 0, {
            name: "",
            valuation: 0,
            // 誤って0円で反映されないよう、既存の「評価額未読取」行と同じ未選択状態にする
            unreadable: true,
            manual: true,
        })
        setResults(matchHoldingsToCategories(holdings, categories))
    }

    const rematchFromResults = useCallback(
        (items: MatchResult[]) => rematchResultsToCategories(items, categories),
        [categories]
    )

    const applySelectCandidate = (index: number, candidate: YenAmountCandidate) => {
        setResults((prev) => {
            const current = prev[index]
            if (!current) return prev
            const updated = prev.map((item, i) =>
                i === index
                    ? { ...current, ...selectValuationCandidate(current, candidate) }
                    : item
            )
            return rematchFromResults(updated)
        })
    }

    const applyDismissAdopted = (index: number, candidate: YenAmountCandidate) => {
        setResults((prev) => {
            const current = prev[index]
            if (!current) return prev
            const updated = prev.map((item, i) =>
                i === index
                    ? { ...current, ...dismissAdoptedOnImage(current, candidate) }
                    : item
            )
            return rematchFromResults(updated)
        })
    }

    const applyExcludeCandidate = (index: number, candidate: YenAmountCandidate) => {
        const current = results[index]
        if (!current) return

        const updated = excludeValuationCandidate(current, candidate)
        if (updated.amountCandidates.length === 0) {
            removeResult(index)
            toast.info("金額候補がなくなったため行を削除しました")
            return
        }

        updateResult(index, updated)
        if (candidate.kind === "profit_loss") {
            toast.success("損益の金額を除外しました")
        }
    }

    const previewResult = previewIndex !== null ? (results[previewIndex] ?? null) : null

    const handleSelectCandidate = (candidate: YenAmountCandidate) => {
        if (previewIndex === null) return
        applySelectCandidate(previewIndex, candidate)
    }

    const handleExcludeCandidate = (candidate: YenAmountCandidate) => {
        if (previewIndex === null) return
        applyExcludeCandidate(previewIndex, candidate)
    }

    const handleApply = () => {
        const valuations: Record<number, number> = {}

        for (const result of results) {
            if (!result.selected || result.categoryId === null) continue
            const active = getActiveValuation(result)
            if (active === null) continue
            valuations[result.categoryId] = active
        }

        if (Object.keys(valuations).length === 0) {
            toast.error("反映する項目を選択してください")
            return
        }

        onApply(valuations)
        toast.success(`${Object.keys(valuations).length}件をフォームに反映しました`)
        handleOpenChange(false)
    }

    const stageLabel =
        stage === "preprocess"
            ? "画像を前処理中..."
            : stage === "ocr"
              ? "文字を読み取り中..."
              : stage === "parse"
                ? "銘柄を解析中..."
                : "読み取り中..."

    const selectedCount = results.filter(
        (r) => r.selected && hasAdoptedValuation(r)
    ).length

    const adoptedCount = results.filter(
        (r) => hasAdoptedValuation(r) && !r.unreadable
    ).length

    const tableRows = useMemo(
        () => buildImportTableRows(categories, results),
        [categories, results]
    )

    const hasLargeDiff = tableRows.some(({ current, result, isExtra }) => {
        if (isExtra || !result || current === null) return false
        const active = getActiveValuation(result)
        if (active === null) return false
        return isLargeValuationDiff(current, active)
    })

    const tableTotals = useMemo(() => {
        let readTotal = 0
        let currentTotal = 0
        let diffTotal = 0
        for (const { current, result, isExtra } of tableRows) {
            if (!isExtra && current !== null) {
                currentTotal += current
            }
            if (!result) continue
            const active = getActiveValuation(result)
            if (active === null) continue
            readTotal += active
            if (!isExtra && current !== null) {
                diffTotal += active - current
            }
        }
        return { readTotal, currentTotal, diffTotal }
    }, [tableRows])

    const expectedCategoryCount = categories.length
    const readCountMatches = adoptedCount === expectedCategoryCount
    const hasExtraTableRows = tableRows.some((row) => row.isExtra)
    const hasMissingReads = tableRows.some(
        (row) => !row.isExtra && (row.result === null || row.result?.unreadable)
    )

    const showInitialDescription =
        !isProcessing && queueItems.length === 0 && categories.length > 0

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent
                    className="max-h-[90vh] flex flex-col sm:max-w-[780px]"
                    onInteractOutside={(e) => {
                        if (previewIndex !== null) e.preventDefault()
                    }}
                    onEscapeKeyDown={(e) => {
                        if (previewIndex !== null) {
                            e.preventDefault()
                            closePreviewOnly()
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Zaim画面から読み込み</DialogTitle>
                        {showInitialDescription && (
                            <DialogDescription asChild>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                    <p>
                                        Zaimアプリの<strong>証券口座 → 保有銘柄一覧</strong>
                                        のスクリーンショット専用です。
                                        <strong>Zaim表示名を設定した{categories.length}項目</strong>
                                        と、スクショの上から順に1対1で照合します。
                                    </p>
                                    <p>
                                        表示名未設定の項目はZaimに表示されないため、読込対象外です（手入力してください）。
                                    </p>
                                    <p>
                                        OCRは100%正確ではありません。反映後・保存前に必ず内容を確認してください。
                                    </p>
                                </div>
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        {!isProcessing && queueItems.length === 0 && categories.length === 0 && (
                            <div className="flex flex-col items-center gap-3 py-6 border border-dashed rounded-lg px-4 text-center">
                                <p className="text-sm text-muted-foreground">
                                    Zaim表示名が設定された項目がありません。
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    「表示設定」でZaimに表示される項目にZaim表示名を登録してください。
                                </p>
                            </div>
                        )}

                        {!isProcessing && queueItems.length === 0 && categories.length > 0 && (
                            <div className="flex flex-col items-center gap-3 py-6 border border-dashed rounded-lg">
                                <Button
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <ImagePlus className="mr-2 h-4 w-4" />
                                    画像を選択（複数可）
                                </Button>
                                <p className="text-xs text-muted-foreground text-center px-4">
                                    スクロールして撮った複数枚をまとめて選択できます。読み取り前に画像の順序を並べ替えられます。
                                    初回は日本語OCRデータ（約15MB）のダウンロードで数十秒かかる場合があります。
                                </p>
                            </div>
                        )}

                        {isProcessing && (
                            <div className="flex flex-col items-center gap-3 py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    {fileCount > 1
                                        ? `${fileIndex}/${fileCount}枚目: ${stageLabel}`
                                        : stageLabel}
                                </p>
                                <div className="w-full max-w-xs bg-muted rounded-full h-2">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">{progress}%</p>
                            </div>
                        )}

                        {!isProcessing && awaitingOcr && queueItems.length > 0 && (
                            <>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{queueItems.length}枚選択中</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <ImagePlus className="mr-1 h-3 w-3" />
                                        画像を追加
                                    </Button>
                                </div>
                                <div className="shrink-0 border rounded-md p-4 bg-muted/20">
                                    <ZaimImageOrderList
                                        items={queueItems}
                                        onReorder={handleQueueReorder}
                                    />
                                </div>
                            </>
                        )}

                        {!isProcessing && hasResults && (
                            <div className="flex flex-col flex-1 min-h-0 gap-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
                                    <span className="text-xs text-muted-foreground">
                                        {queueItems.length}枚 · {results.length}件読み取り
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {results.length > 0 && (
                                            <div className="flex rounded-md border p-0.5">
                                                <Button
                                                    type="button"
                                                    variant={
                                                        resultView === "images"
                                                            ? "secondary"
                                                            : "ghost"
                                                    }
                                                    size="sm"
                                                    className="h-7 text-xs px-2"
                                                    onClick={() => setResultView("images")}
                                                >
                                                    画像で確認
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={
                                                        resultView === "table"
                                                            ? "secondary"
                                                            : "ghost"
                                                    }
                                                    size="sm"
                                                    className="h-7 text-xs px-2"
                                                    onClick={() => setResultView("table")}
                                                >
                                                    一覧
                                                </Button>
                                            </div>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <ImagePlus className="mr-1 h-3 w-3" />
                                            画像を追加
                                        </Button>
                                    </div>
                                </div>

                                {results.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        銘柄を読み取れませんでした。スクショ内容を確認してください。
                                    </p>
                                )}

                                {results.length > 0 && resultView === "images" && (
                                    <div className="flex-1 min-h-0 overflow-y-auto border rounded-md p-3 pb-4 bg-muted/10">
                                        <ZaimImageReadCheck
                                            items={queueItems}
                                            results={results}
                                            expectedCategoryCount={expectedCategoryCount}
                                            onSelectCandidate={applySelectCandidate}
                                            onDismissAdopted={applyDismissAdopted}
                                            onExcludeCandidate={applyExcludeCandidate}
                                            onRemoveResult={removeResult}
                                        />
                                    </div>
                                )}

                                {hasResults && resultView === "table" && (
                                    <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-y-auto min-w-0">
                                        {tableRows.some(
                                            ({ result }) =>
                                                result &&
                                                (result.confidence === "low" ||
                                                    result.confidence === "none")
                                        ) && (
                                            <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                                <span>
                                                    一致度が低い、または未一致の銘柄があります。金額とカテゴリを確認してください。
                                                </span>
                                            </div>
                                        )}

                                        {hasLargeDiff && (
                                            <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                                <span>
                                                    現在の評価額との差が
                                                    {Math.round(LARGE_VALUATION_DIFF_RATIO * 100)}
                                                    %を超える項目があります。読み取りミスやカテゴリのずれがないか確認してください。
                                                </span>
                                            </div>
                                        )}

                                        {hasMissingReads && (
                                            <div className="flex items-start gap-2 rounded-md border border-red-300/50 bg-red-50/50 dark:bg-red-900/10 px-3 py-2 text-xs text-red-800 dark:text-red-200">
                                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                                <span>
                                                    読み取れていない項目があります。「画像で確認」でスクショ内容を確認してください。
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex-1 overflow-y-auto min-h-0 border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-8" />
                                                        <TableHead>カテゴリ</TableHead>
                                                        <TableHead className="text-right whitespace-nowrap">
                                                            読取
                                                        </TableHead>
                                                        <TableHead className="text-right whitespace-nowrap">
                                                            差分
                                                        </TableHead>
                                                        <TableHead className="w-14">信頼度</TableHead>
                                                        <TableHead className="w-16" />
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {tableRows.map((row) => {
                                                        const {
                                                            key,
                                                            label,
                                                            current,
                                                            result,
                                                            resultIndex,
                                                            isExtra,
                                                        } = row
                                                        const isMissing =
                                                            !isExtra && result === null
                                                        const isUnreadable =
                                                            !isExtra &&
                                                            result !== null &&
                                                            result.unreadable === true
                                                        const isConfidenceWarning =
                                                            !isMissing &&
                                                            !isUnreadable &&
                                                            result !== null &&
                                                            (result.confidence === "low" ||
                                                                result.confidence === "none")
                                                        const activeValuation = result
                                                            ? getActiveValuation(result)
                                                            : null
                                                        const diff =
                                                            current !== null &&
                                                            activeValuation !== null
                                                                ? activeValuation - current
                                                                : null
                                                        const isDiffWarning =
                                                            diff !== null &&
                                                            current !== null &&
                                                            activeValuation !== null &&
                                                            isLargeValuationDiff(
                                                                current,
                                                                activeValuation
                                                            )
                                                        const isWarning =
                                                            isMissing ||
                                                            isUnreadable ||
                                                            isExtra ||
                                                            isConfidenceWarning ||
                                                            isDiffWarning

                                                        return (
                                                            <TableRow
                                                                key={key}
                                                                className={
                                                                    isWarning
                                                                        ? isMissing || isUnreadable
                                                                            ? "bg-red-50/50 dark:bg-red-900/10"
                                                                            : "bg-amber-50/50 dark:bg-amber-900/10"
                                                                        : undefined
                                                                }
                                                            >
                                                                <TableCell>
                                                                    <Checkbox
                                                                        checked={
                                                                            result?.selected ??
                                                                            false
                                                                        }
                                                                        disabled={
                                                                            isMissing ||
                                                                            resultIndex === null
                                                                        }
                                                                        onCheckedChange={(
                                                                            checked
                                                                        ) => {
                                                                            if (
                                                                                resultIndex ===
                                                                                null
                                                                            )
                                                                                return
                                                                            updateResult(
                                                                                resultIndex,
                                                                                {
                                                                                    selected:
                                                                                        checked ===
                                                                                        true,
                                                                                }
                                                                            )
                                                                        }}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-xs font-medium">
                                                                    <span>{label}</span>
                                                                    {isExtra && (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="ml-1.5 text-[10px] align-middle"
                                                                        >
                                                                            余分
                                                                        </Badge>
                                                                    )}
                                                                    {result?.manual && (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="ml-1.5 text-[10px] align-middle"
                                                                        >
                                                                            手入力
                                                                        </Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {isMissing ||
                                                                    activeValuation === null ? (
                                                                        <span className="inline-flex h-8 items-center justify-end text-xs text-red-600 dark:text-red-400 w-24 ml-auto">
                                                                            未読取
                                                                        </span>
                                                                    ) : (
                                                                        <CurrencyInput
                                                                            className="h-8 text-right text-xs w-24 ml-auto"
                                                                            value={
                                                                                result!.valuation
                                                                            }
                                                                            onChange={(val) => {
                                                                                if (
                                                                                    resultIndex ===
                                                                                    null
                                                                                )
                                                                                    return
                                                                                const parsed =
                                                                                    parseFloat(val)
                                                                                if (
                                                                                    Number.isNaN(
                                                                                        parsed
                                                                                    )
                                                                                )
                                                                                    return
                                                                                updateResult(
                                                                                    resultIndex,
                                                                                    {
                                                                                        valuation:
                                                                                            parsed,
                                                                                        imageDismissedCandidate:
                                                                                            undefined,
                                                                                        unreadable:
                                                                                            false,
                                                                                    }
                                                                                )
                                                                            }}
                                                                        />
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs whitespace-nowrap">
                                                                    {current !== null ? (
                                                                        <div className="flex flex-col items-end leading-tight gap-0.5">
                                                                            <span className="tabular-nums text-muted-foreground">
                                                                                ¥
                                                                                {current.toLocaleString()}
                                                                            </span>
                                                                            {diff !== null ? (
                                                                                <span
                                                                                    className={`tabular-nums ${
                                                                                        isDiffWarning
                                                                                            ? "font-semibold text-amber-700 dark:text-amber-300"
                                                                                            : diff >
                                                                                                0
                                                                                              ? "text-emerald-600 dark:text-emerald-400"
                                                                                              : diff <
                                                                                                  0
                                                                                                ? "text-red-600 dark:text-red-400"
                                                                                                : "text-muted-foreground"
                                                                                    }`}
                                                                                >
                                                                                    {formatValuationDiff(
                                                                                        diff
                                                                                    )}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-muted-foreground">
                                                                                    —
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">
                                                                            —
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {isMissing ? (
                                                                        <Badge
                                                                            variant="destructive"
                                                                            className="text-[10px]"
                                                                        >
                                                                            未読取
                                                                        </Badge>
                                                                    ) : isUnreadable ? (
                                                                        <Badge
                                                                            variant="destructive"
                                                                            className="text-[10px]"
                                                                        >
                                                                            評価額未読取
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge
                                                                            variant={
                                                                                CONFIDENCE_VARIANTS[
                                                                                    result!
                                                                                        .confidence
                                                                                ]
                                                                            }
                                                                            className="text-[10px]"
                                                                        >
                                                                            {
                                                                                CONFIDENCE_LABELS[
                                                                                    result!
                                                                                        .confidence
                                                                                ]
                                                                            }
                                                                        </Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center justify-end gap-0.5">
                                                                        {!isMissing &&
                                                                        resultIndex !== null ? (
                                                                            <>
                                                                                {result!
                                                                                    .source ? (
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-7 w-7"
                                                                                        title="読取位置・金額候補"
                                                                                        onClick={() =>
                                                                                            setPreviewIndex(
                                                                                                resultIndex
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <ScanSearch className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                ) : null}
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                                    title="行を削除"
                                                                                    onClick={() =>
                                                                                        removeResult(
                                                                                            resultIndex
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </>
                                                                        ) : null}
                                                                        {!isExtra &&
                                                                        row.categoryIndex !==
                                                                            null ? (
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 text-muted-foreground"
                                                                                title="この位置に見落とした行を挿入"
                                                                                onClick={() =>
                                                                                    insertManualResult(
                                                                                        row.categoryIndex!
                                                                                    )
                                                                                }
                                                                            >
                                                                                <Plus className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        ) : null}
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                    <TableRow className="bg-muted/40 font-medium border-t-2 hover:bg-muted/40">
                                                        <TableCell />
                                                        <TableCell className="text-xs">
                                                            合計
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">
                                                            ¥
                                                            {tableTotals.readTotal.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs whitespace-nowrap">
                                                            <div className="flex flex-col items-end leading-tight gap-0.5">
                                                                <span className="tabular-nums text-muted-foreground">
                                                                    ¥
                                                                    {tableTotals.currentTotal.toLocaleString()}
                                                                </span>
                                                                <span
                                                                    className={`tabular-nums ${
                                                                        tableTotals.diffTotal > 0
                                                                            ? "text-emerald-600 dark:text-emerald-400"
                                                                            : tableTotals.diffTotal <
                                                                                0
                                                                              ? "text-red-600 dark:text-red-400"
                                                                              : "text-muted-foreground"
                                                                    }`}
                                                                >
                                                                    {formatValuationDiff(
                                                                        tableTotals.diffTotal
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell />
                                                        <TableCell />
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>

                                        {hasExtraTableRows && (
                                            <p className="text-xs text-muted-foreground">
                                                余分に読み取った行があります。Zaim表示名の件数・順序とスクショが一致しているか確認してください。
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex-col gap-3 sm:flex-row sm:gap-2">
                        {hasResults && !isProcessing && results.length > 0 && (
                            <div className="w-full sm:mr-auto text-left text-xs space-y-0.5 order-first sm:order-none">
                                <p
                                    className={`tabular-nums font-medium ${
                                        readCountMatches
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-red-600 dark:text-red-400"
                                    }`}
                                >
                                    読取件数 {adoptedCount}/{expectedCategoryCount}件
                                </p>
                                <p className="text-muted-foreground tabular-nums">
                                    合計金額 ¥{tableTotals.readTotal.toLocaleString()}
                                </p>
                            </div>
                        )}
                        <div className="flex flex-wrap justify-end gap-2 w-full sm:w-auto">
                        {!isProcessing && (
                            <Button variant="outline" onClick={handleGoBack}>
                                前に戻る
                            </Button>
                        )}
                        {awaitingOcr && !isProcessing && queueItems.length > 0 && (
                            <Button onClick={runOcr}>
                                {queueItems.some((i) => i.holdings !== undefined)
                                    ? "追加画像を読み取り"
                                    : "読み取り開始"}
                            </Button>
                        )}
                        {hasResults && !isProcessing && results.length > 0 && (
                            <Button onClick={handleApply} disabled={selectedCount === 0}>
                                フォームに反映
                            </Button>
                        )}
                        </div>
                    </DialogFooter>

                    <OcrSourcePreviewDialog
                        open={previewIndex !== null && previewResult !== null}
                        onOpenChange={handlePreviewOpenChange}
                        source={previewResult?.source ?? null}
                        title={
                            previewResult?.categoryName ??
                            previewResult?.ocrName ??
                            "読取位置"
                        }
                        valuation={
                            previewResult
                                ? (getActiveValuation(previewResult) ?? undefined)
                                : undefined
                        }
                        amountCandidates={previewResult?.amountCandidates}
                        onSelectCandidate={handleSelectCandidate}
                        onExcludeCandidate={handleExcludeCandidate}
                    />
                </DialogContent>
            </Dialog>
        </>
    )
}

export function ZaimScreenshotImportTrigger({
    categories,
    zaimImportCount,
    onApply,
}: {
    categories: ValuationCategoryRef[]
    zaimImportCount: number
    onApply: (valuations: Record<number, number>) => void
}) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => {
                    if (zaimImportCount === 0) {
                        toast.error("表示設定でZaim表示名を登録してください")
                        return
                    }
                    setOpen(true)
                }}
            >
                <ImagePlus className="mr-2 h-4 w-4" />
                Zaim画面から読み込み
            </Button>
            <ZaimScreenshotImportDialog
                open={open}
                onOpenChange={setOpen}
                categories={categories}
                onApply={onApply}
            />
        </>
    )
}
