"use client"

import type { CSSProperties } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import type { OcrValuationSource, YenAmountCandidate } from "@/lib/zaim-screenshot"

interface OcrSourcePreviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    source: OcrValuationSource | null
    title: string
    valuation?: number
    amountCandidates?: YenAmountCandidate[]
    onSelectCandidate?: (candidate: YenAmountCandidate) => void
    onExcludeCandidate?: (candidate: YenAmountCandidate) => void
}

function bboxToPercentStyle(
    bbox: { x: number; y: number; width: number; height: number },
    ocrWidth: number,
    ocrHeight: number
): CSSProperties {
    return {
        left: `${(bbox.x / ocrWidth) * 100}%`,
        top: `${(bbox.y / ocrHeight) * 100}%`,
        width: `${(bbox.width / ocrWidth) * 100}%`,
        height: `${(bbox.height / ocrHeight) * 100}%`,
    }
}

function kindLabel(kind: YenAmountCandidate["kind"]): string {
    return kind === "profit_loss" ? "損益" : "評価額"
}

export function OcrSourcePreviewDialog({
    open,
    onOpenChange,
    source,
    title,
    valuation,
    amountCandidates = [],
    onSelectCandidate,
    onExcludeCandidate,
}: OcrSourcePreviewDialogProps) {
    if (!source) return null

    const candidates =
        amountCandidates.length > 0
            ? amountCandidates
            : (source.amountCandidates ?? [])

    const selectedStyle = bboxToPercentStyle(
        source.valuationBbox,
        source.ocrImageWidth,
        source.ocrImageHeight
    )

    const canEdit = Boolean(onSelectCandidate && onExcludeCandidate)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                nested
                className="max-h-[90vh] flex flex-col sm:max-w-[420px] p-0 gap-0 overflow-hidden"
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
                    <DialogTitle className="text-base">{title}</DialogTitle>
                    <DialogDescription className="text-xs">
                        {valuation !== undefined && (
                            <>
                                読取評価額: ¥{valuation.toLocaleString()}
                                {" · "}
                            </>
                        )}
                        {canEdit && candidates.length > 0
                            ? "評価額として使う金額を選ぶか、誤検出を除外してください"
                            : "オレンジ枠がOCRで認識した金額の位置です"}
                    </DialogDescription>
                </DialogHeader>

                <div className="overflow-y-auto min-h-0 px-4 pb-4 space-y-3">
                    <div className="relative w-full rounded-md border bg-muted/30 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={source.imageDataUrl}
                            alt="OCR元画像"
                            className="w-full h-auto block"
                        />
                        {candidates.map((candidate) => {
                            const isSelected = candidate.value === valuation
                            const style = bboxToPercentStyle(
                                candidate.bbox,
                                source.ocrImageWidth,
                                source.ocrImageHeight
                            )
                            return (
                                <div
                                    key={`${candidate.value}-${candidate.bbox.x}`}
                                    className={`absolute border-2 pointer-events-none ${
                                        isSelected
                                            ? "border-amber-500 bg-amber-400/25"
                                            : candidate.kind === "profit_loss"
                                              ? "border-red-400/80 bg-red-400/15"
                                              : "border-slate-400/80 bg-slate-400/15"
                                    }`}
                                    style={style}
                                />
                            )
                        })}
                        {candidates.length === 0 && (
                            <div
                                className="absolute border-2 border-amber-500 bg-amber-400/25 pointer-events-none"
                                style={selectedStyle}
                            />
                        )}
                    </div>

                    {canEdit && candidates.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                                検出した金額
                            </p>
                            <ul className="space-y-1.5">
                                {candidates.map((candidate) => {
                                    const isSelected = candidate.value === valuation
                                    return (
                                        <li
                                            key={`${candidate.value}-${candidate.bbox.x}`}
                                            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                                                isSelected
                                                    ? "border-amber-400 bg-amber-50/50 dark:bg-amber-900/10"
                                                    : "border-border"
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                className="flex-1 text-left tabular-nums"
                                                onClick={() => onSelectCandidate?.(candidate)}
                                            >
                                                <span className="font-medium">
                                                    ¥{candidate.value.toLocaleString()}
                                                </span>
                                                <span className="text-muted-foreground ml-2">
                                                    {kindLabel(candidate.kind)}
                                                    {candidate.ocrText !==
                                                        `¥${candidate.value}` && (
                                                        <span className="ml-1 opacity-70">
                                                            ({candidate.ocrText})
                                                        </span>
                                                    )}
                                                </span>
                                                {isSelected && (
                                                    <span className="ml-2 text-amber-700 dark:text-amber-300">
                                                        使用中
                                                    </span>
                                                )}
                                            </button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                                title="この金額を除外"
                                                onClick={() =>
                                                    onExcludeCandidate?.(candidate)
                                                }
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-4 py-3 border-t shrink-0 sm:justify-center">
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full sm:w-auto min-w-[8rem]"
                        onClick={() => onOpenChange(false)}
                    >
                        一覧に戻る
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function candidateMatches(
    a: { value: number; bbox: { x: number } },
    b: { value: number; bbox: { x: number } }
): boolean {
    return a.value === b.value && a.bbox.x === b.bbox.x
}

export function selectValuationCandidate(
    result: {
        valuation: number
        source?: OcrValuationSource
        amountCandidates?: YenAmountCandidate[]
        imageDismissedCandidate?: YenAmountCandidate
    },
    candidate: YenAmountCandidate
) {
    const amountCandidates = result.amountCandidates ?? result.source?.amountCandidates ?? []
    return {
        valuation: candidate.value,
        amountCandidates,
        imageDismissedCandidate: undefined,
        source: result.source
            ? {
                  ...result.source,
                  valuationBbox: candidate.bbox,
                  amountCandidates,
              }
            : undefined,
    }
}

/** 評価額を採用している（画像上の採用解除中ではない） */
export function hasAdoptedValuation(result: {
    imageDismissedCandidate?: YenAmountCandidate
}): boolean {
    return !result.imageDismissedCandidate
}

/** 選択中（採用解除・未選択を除く）の項目だけを対象に、読取順の表示番号（1始まり）を globalIndex → 番号 で返す */
export function buildActiveDisplayNumberByIndex(
    results: Array<{ imageDismissedCandidate?: YenAmountCandidate; selected: boolean }>
): Map<number, number> {
    const map = new Map<number, number>()
    let displayNumber = 0
    for (let index = 0; index < results.length; index++) {
        if (!results[index].imageDismissedCandidate && results[index].selected) {
            displayNumber++
            map.set(index, displayNumber)
        }
    }
    return map
}

/** 一覧・合計・反映に使う採用中の読取額（未採用なら null） */
export function getActiveValuation(result: {
    imageDismissedCandidate?: YenAmountCandidate
    valuation: number
}): number | null {
    if (result.imageDismissedCandidate) return null
    return result.valuation
}

/** 画像上で採用を外す（候補は残し灰色枠で表示。読取額は未採用扱い） */
export function dismissAdoptedOnImage(
    result: {
        valuation: number
        source?: OcrValuationSource
        amountCandidates?: YenAmountCandidate[]
    },
    dismissed: YenAmountCandidate
) {
    const amountCandidates = result.amountCandidates ?? result.source?.amountCandidates ?? []
    return {
        valuation: result.valuation,
        amountCandidates,
        imageDismissedCandidate: dismissed,
        source: result.source
            ? {
                  ...result.source,
                  valuationBbox: dismissed.bbox,
                  amountCandidates,
              }
            : undefined,
    }
}

export function excludeValuationCandidate(
    result: {
        valuation: number
        source?: OcrValuationSource
        amountCandidates?: YenAmountCandidate[]
        imageDismissedCandidate?: YenAmountCandidate
    },
    toExclude: YenAmountCandidate
): {
    valuation: number
    amountCandidates: YenAmountCandidate[]
    source?: OcrValuationSource
    imageDismissedCandidate?: YenAmountCandidate
} {
    const amountCandidates = (
        result.amountCandidates ??
        result.source?.amountCandidates ??
        []
    ).filter(
        (c) => !(c.value === toExclude.value && c.bbox.x === toExclude.bbox.x)
    )

    if (amountCandidates.length === 0) {
        return { valuation: 0, amountCandidates: [], source: undefined }
    }

    const clearedDismissed = result.imageDismissedCandidate &&
        candidateMatches(result.imageDismissedCandidate, toExclude)
            ? undefined
            : result.imageDismissedCandidate

    const stillSelected = amountCandidates.some((c) => c.value === result.valuation)
    const next =
        stillSelected
            ? amountCandidates.find((c) => c.value === result.valuation)!
            : (amountCandidates.find((c) => c.kind === "valuation") ?? amountCandidates[0])

    return {
        valuation: next.value,
        amountCandidates,
        imageDismissedCandidate: clearedDismissed,
        source: result.source
            ? {
                  ...result.source,
                  valuationBbox: next.bbox,
                  amountCandidates,
              }
            : undefined,
    }
}
