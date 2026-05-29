"use client"

import React, { useCallback, useMemo, useRef, useState } from "react"
import { ImagePlus, Loader2, AlertTriangle, ScanSearch, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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

function getImageFiles(fileList: FileList | null): File[] {
    if (!fileList) return []
    return Array.from(fileList).filter((file) => file.type.startsWith("image/"))
}

function getCurrentValueMap(categories: ValuationCategoryRef[]): Map<number, number> {
    return new Map(categories.map((c) => [c.id, c.currentValue ?? 0]))
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
        (r) => r.selected && r.categoryId !== null && hasAdoptedValuation(r)
    ).length
    const currentValueMap = getCurrentValueMap(categories)

    const tableResultEntries = useMemo(
        () =>
            results
                .map((result, index) => ({ result, index }))
                .filter(({ result }) => hasAdoptedValuation(result)),
        [results]
    )

    const hasLargeDiff = results.some((r) => {
        if (r.categoryId === null) return false
        const active = getActiveValuation(r)
        if (active === null) return false
        const current = currentValueMap.get(r.categoryId) ?? 0
        return isLargeValuationDiff(current, active)
    })

    const tableTotals = useMemo(() => {
        let readTotal = 0
        let currentTotal = 0
        let diffTotal = 0
        for (const result of results) {
            const active = getActiveValuation(result)
            if (active === null) continue
            readTotal += active
            if (result.categoryId !== null) {
                const current = currentValueMap.get(result.categoryId) ?? 0
                currentTotal += current
                diffTotal += active - current
            }
        }
        return { readTotal, currentTotal, diffTotal }
    }, [results, currentValueMap])

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
                            <>
                                <div className="flex items-center justify-between gap-2 flex-wrap">
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
                                    <div className="flex-1 min-h-0 overflow-hidden border rounded-md p-3 bg-muted/10">
                                        <ZaimImageReadCheck
                                            items={queueItems}
                                            results={results}
                                            onSelectCandidate={applySelectCandidate}
                                            onDismissAdopted={applyDismissAdopted}
                                            onExcludeCandidate={applyExcludeCandidate}
                                            onRemoveResult={removeResult}
                                        />
                                    </div>
                                )}

                                {results.length > 0 && resultView === "table" && (
                                    <>
                                        {tableResultEntries.some(
                                            ({ result: r }) =>
                                                r.confidence === "low" || r.confidence === "none"
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

                                        {tableResultEntries.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-6 border rounded-md">
                                                採用中の行がありません。「画像で確認」から金額を採用するか、灰色の枠をクリックして再採用してください。
                                            </p>
                                        ) : (
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
                                                    {tableResultEntries.map(({ result, index }) => {
                                                        const isConfidenceWarning =
                                                            result.confidence === "low" ||
                                                            result.confidence === "none"
                                                        const current =
                                                            result.categoryId !== null
                                                                ? (currentValueMap.get(
                                                                      result.categoryId
                                                                  ) ?? 0)
                                                                : null
                                                        const activeValuation =
                                                            getActiveValuation(result)
                                                        const diff =
                                                            current !== null &&
                                                            activeValuation !== null
                                                                ? activeValuation - current
                                                                : null
                                                        const isDiffWarning =
                                                            current !== null &&
                                                            activeValuation !== null &&
                                                            isLargeValuationDiff(
                                                                current,
                                                                activeValuation
                                                            )
                                                        const isWarning =
                                                            isConfidenceWarning || isDiffWarning

                                                        return (
                                                            <TableRow
                                                                key={`${result.ocrName}-${index}`}
                                                                className={
                                                                    isWarning
                                                                        ? "bg-amber-50/50 dark:bg-amber-900/10"
                                                                        : undefined
                                                                }
                                                            >
                                                                <TableCell>
                                                                    <Checkbox
                                                                        checked={result.selected}
                                                                        disabled={
                                                                            result.categoryId ===
                                                                            null
                                                                        }
                                                                        onCheckedChange={(
                                                                            checked
                                                                        ) =>
                                                                            updateResult(index, {
                                                                                selected:
                                                                                    checked ===
                                                                                    true,
                                                                            })
                                                                        }
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-xs font-medium">
                                                                    {result.categoryName ?? (
                                                                        <span className="text-muted-foreground">
                                                                            未一致
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 text-right text-xs w-24 ml-auto"
                                                                        value={result.valuation}
                                                                        onChange={(e) =>
                                                                            updateResult(index, {
                                                                                valuation:
                                                                                    parseFloat(
                                                                                        e.target.value
                                                                                    ) || 0,
                                                                                imageDismissedCandidate:
                                                                                    undefined,
                                                                            })
                                                                        }
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs whitespace-nowrap">
                                                                    {diff !== null &&
                                                                    current !== null ? (
                                                                        <div className="flex flex-col items-end leading-tight gap-0.5">
                                                                            <span className="tabular-nums text-muted-foreground">
                                                                                ¥
                                                                                {current.toLocaleString()}
                                                                            </span>
                                                                            <span
                                                                                className={`tabular-nums ${
                                                                                    isDiffWarning
                                                                                        ? "font-semibold text-amber-700 dark:text-amber-300"
                                                                                        : diff > 0
                                                                                          ? "text-emerald-600 dark:text-emerald-400"
                                                                                          : diff < 0
                                                                                            ? "text-red-600 dark:text-red-400"
                                                                                            : "text-muted-foreground"
                                                                                }`}
                                                                            >
                                                                                {formatValuationDiff(
                                                                                    diff
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">
                                                                            —
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge
                                                                        variant={
                                                                            CONFIDENCE_VARIANTS[
                                                                                result.confidence
                                                                            ]
                                                                        }
                                                                        className="text-[10px]"
                                                                    >
                                                                        {
                                                                            CONFIDENCE_LABELS[
                                                                                result.confidence
                                                                            ]
                                                                        }
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center justify-end gap-0.5">
                                                                        {result.source ? (
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7"
                                                                                title="読取位置・金額候補"
                                                                                onClick={() =>
                                                                                    setPreviewIndex(
                                                                                        index
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
                                                                                removeResult(index)
                                                                            }
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </Button>
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
                                        )}

                                        {tableResultEntries.some(
                                            ({ result: r }) => r.confidence === "none"
                                        ) && (
                                            <p className="text-xs text-muted-foreground">
                                                余分に読み取った行があります。Zaim表示名の件数・順序とスクショが一致しているか確認してください。
                                            </p>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        {queueItems.length > 0 && !isProcessing && (
                            <Button variant="outline" onClick={resetState}>
                                最初からやり直す
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => handleOpenChange(false)}>
                            キャンセル
                        </Button>
                        {awaitingOcr && !isProcessing && queueItems.length > 0 && (
                            <Button onClick={runOcr}>
                                {queueItems.some((i) => i.holdings !== undefined)
                                    ? "追加画像を読み取り"
                                    : "読み取り開始"}
                            </Button>
                        )}
                        {hasResults && !isProcessing && results.length > 0 && (
                            <Button onClick={handleApply} disabled={selectedCount === 0}>
                                {selectedCount}件をフォームに反映
                            </Button>
                        )}
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
