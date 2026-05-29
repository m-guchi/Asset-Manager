"use client"

import React, { useCallback, useRef, useState } from "react"
import { ImagePlus, Loader2, AlertTriangle } from "lucide-react"
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
    mergeMatchResults,
    processZaimScreenshots,
    type MatchResult,
    type ValuationCategoryRef,
} from "@/lib/zaim-screenshot"

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

export function ZaimScreenshotImportDialog({
    open,
    onOpenChange,
    categories,
    onApply,
}: ZaimScreenshotImportDialogProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [stage, setStage] = useState<"preprocess" | "ocr" | "parse" | null>(null)
    const [fileIndex, setFileIndex] = useState(0)
    const [fileCount, setFileCount] = useState(0)
    const [results, setResults] = useState<MatchResult[]>([])

    const resetState = useCallback(() => {
        setIsProcessing(false)
        setProgress(0)
        setStage(null)
        setFileIndex(0)
        setFileCount(0)
        setResults([])
        if (fileInputRef.current) fileInputRef.current.value = ""
    }, [])

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) resetState()
        onOpenChange(nextOpen)
    }

    const processFiles = async (files: File[], append: boolean) => {
        if (files.length === 0) {
            toast.error("画像ファイルを選択してください")
            return
        }

        setIsProcessing(true)
        if (!append) {
            setResults([])
        }
        setProgress(0)
        setFileCount(files.length)

        try {
            const matches = await processZaimScreenshots(files, categories, (p, s, index, count) => {
                setProgress(Math.round(p * 100))
                setStage(s)
                setFileIndex(index)
                setFileCount(count)
            })

            if (matches.length === 0 && !append) {
                toast.warning(
                    "銘柄を読み取れませんでした。Zaimの証券口座・保有銘柄一覧画面のスクショか確認してください。"
                )
            } else if (!append && categories.length > 0) {
                const assigned = matches.filter((m) => m.categoryId !== null).length
                if (assigned !== categories.length || matches.length !== categories.length) {
                    toast.warning(
                        `読取 ${matches.length}行 / 登録 ${categories.length}項目 — 件数が一致しません。Zaim表示名の順序を確認してください。`
                    )
                }
            }

            setResults((prev) => (append ? mergeMatchResults(prev, matches) : matches))

            if (append && matches.length > 0) {
                toast.success(`${files.length}枚から${matches.length}件を追加しました`)
            }
        } catch (error) {
            console.error("Zaim screenshot OCR error:", error)
            toast.error("画像の読み取りに失敗しました")
        } finally {
            setIsProcessing(false)
            setStage(null)
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = getImageFiles(e.target.files)
        if (fileInputRef.current) fileInputRef.current.value = ""
        if (files.length === 0) return

        const append = results.length > 0
        await processFiles(files, append)
    }

    const updateResult = (index: number, patch: Partial<MatchResult>) => {
        setResults((prev) =>
            prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
        )
    }

    const handleApply = () => {
        const valuations: Record<number, number> = {}

        for (const result of results) {
            if (!result.selected || result.categoryId === null) continue
            valuations[result.categoryId] = result.valuation
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

    const selectedCount = results.filter((r) => r.selected && r.categoryId !== null).length

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-[640px]">
                <DialogHeader>
                    <DialogTitle>Zaim画面から読み込み</DialogTitle>
                    <DialogDescription asChild>
                        <div className="space-y-1 text-sm text-muted-foreground">
                            <p>
                                Zaimアプリの<strong>証券口座 → 保有銘柄一覧</strong>
                                のスクリーンショット専用です。
                                <strong>Zaim表示名を設定した{categories.length}項目</strong>と、スクショの上から順に1対1で照合します。
                            </p>
                            <p>表示名未設定の項目はZaimに表示されないため、読込対象外です（手入力してください）。</p>
                            <p>OCRは100%正確ではありません。反映後・保存前に必ず内容を確認してください。</p>
                        </div>
                    </DialogDescription>
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

                    {!isProcessing && results.length === 0 && categories.length === 0 && (
                        <div className="flex flex-col items-center gap-3 py-6 border border-dashed rounded-lg px-4 text-center">
                            <p className="text-sm text-muted-foreground">
                                Zaim表示名が設定された項目がありません。
                            </p>
                            <p className="text-xs text-muted-foreground">
                                「表示設定」でZaimに表示される項目にZaim表示名を登録してください。
                            </p>
                        </div>
                    )}

                    {!isProcessing && results.length === 0 && categories.length > 0 && (
                        <div className="flex flex-col items-center gap-3 py-6 border border-dashed rounded-lg">
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <ImagePlus className="mr-2 h-4 w-4" />
                                画像を選択（複数可）
                            </Button>
                            <p className="text-xs text-muted-foreground text-center px-4">
                                スクロールして撮った複数枚をまとめて選択できます。初回は日本語OCRデータ（約15MB）のダウンロードで数十秒かかる場合があります。
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

                    {results.length > 0 && !isProcessing && (
                        <>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{results.length}件読み取り</span>
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

                            {results.some((r) => r.confidence === "low" || r.confidence === "none") && (
                                <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>
                                        一致度が低い、または未一致の銘柄があります。金額とカテゴリを確認してください。
                                    </span>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto min-h-0 border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-8" />
                                            <TableHead>カテゴリ</TableHead>
                                            <TableHead>OCR読取名</TableHead>
                                            <TableHead className="text-right">評価額</TableHead>
                                            <TableHead className="w-16">信頼度</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.map((result, index) => {
                                            const isWarning =
                                                result.confidence === "low" ||
                                                result.confidence === "none"

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
                                                            disabled={result.categoryId === null}
                                                            onCheckedChange={(checked) =>
                                                                updateResult(index, {
                                                                    selected: checked === true,
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
                                                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                                                        {result.ocrName}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Input
                                                            type="number"
                                                            className="h-8 text-right text-xs w-24 ml-auto"
                                                            value={result.valuation}
                                                            onChange={(e) =>
                                                                updateResult(index, {
                                                                    valuation: parseFloat(
                                                                        e.target.value
                                                                    ) || 0,
                                                                })
                                                            }
                                                        />
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
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {results.some((r) => r.confidence === "none") && (
                                <p className="text-xs text-muted-foreground">
                                    余分に読み取った行があります。Zaim表示名の件数・順序とスクショが一致しているか確認してください。
                                </p>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    {results.length > 0 && !isProcessing && (
                        <Button variant="outline" onClick={resetState}>
                            最初からやり直す
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => handleOpenChange(false)}>
                        キャンセル
                    </Button>
                    {results.length > 0 && !isProcessing && (
                        <Button onClick={handleApply} disabled={selectedCount === 0}>
                            {selectedCount}件をフォームに反映
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
