"use client"

import { useMemo, useState, type CSSProperties } from "react"
import { ChevronDown, ChevronUp, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildActiveDisplayNumberByIndex } from "@/components/assets/ocr-source-preview"
import type { MatchResult, YenAmountCandidate } from "@/lib/zaim-screenshot"
import type { ImageQueueItem } from "@/components/assets/zaim-image-order-list"

export function bboxToPercentStyle(
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

function groupResultsByImage(
    items: ImageQueueItem[],
    results: MatchResult[]
): { item: ImageQueueItem; results: { result: MatchResult; globalIndex: number }[] }[] {
    const unassigned = [...results.entries()]

    const grouped = items.map((item) => {
        const matched: { result: MatchResult; globalIndex: number }[] = []

        for (let i = unassigned.length - 1; i >= 0; i--) {
            const [globalIndex, result] = unassigned[i]
            if (result.source?.sourceImageId === item.id) {
                matched.push({ result, globalIndex })
                unassigned.splice(i, 1)
            }
        }

        matched.sort((a, b) => a.globalIndex - b.globalIndex)
        return { item, results: matched }
    })

    if (unassigned.length > 0) {
        let offset = 0
        for (const group of grouped) {
            const count = group.item.holdings?.length ?? 0
            if (group.results.length === 0 && count > 0) {
                const slice = unassigned
                    .filter(([idx]) => idx >= offset && idx < offset + count)
                    .map(([globalIndex, result]) => ({ result, globalIndex }))
                group.results.push(...slice)
            }
            offset += count
        }
    }

    return grouped
}

function getCandidatesForResult(result: MatchResult): YenAmountCandidate[] {
    if (result.amountCandidates?.length) return result.amountCandidates
    if (result.source?.amountCandidates?.length) return result.source.amountCandidates
    if (result.source?.valuationBbox) {
        return [
            {
                value: result.valuation,
                bbox: result.source.valuationBbox,
                ocrText: "",
                kind: "valuation",
            },
        ]
    }
    return []
}

function candidateKey(candidate: YenAmountCandidate): string {
    return `${candidate.bbox.x}:${candidate.bbox.y}:${candidate.value}`
}

function isSelectedCandidate(result: MatchResult, candidate: YenAmountCandidate): boolean {
    if (result.imageDismissedCandidate) return false
    return (
        result.source?.valuationBbox.x === candidate.bbox.x &&
        result.source?.valuationBbox.y === candidate.bbox.y &&
        result.valuation === candidate.value
    )
}

const ADOPTED_OVERLAY_CLASS =
    "border-amber-500 bg-amber-400/30 ring-1 ring-amber-500/50"

const DISMISSED_OVERLAY_CLASS =
    "border-slate-400/80 bg-slate-400/20 hover:bg-slate-400/30"

function getAdoptedCandidate(result: MatchResult): YenAmountCandidate | null {
    if (result.imageDismissedCandidate) return null
    const candidates = getCandidatesForResult(result)
    const adopted = candidates.find((c) => isSelectedCandidate(result, c))
    if (adopted) return adopted
    if (result.source?.valuationBbox && result.valuation > 0) {
        return {
            value: result.valuation,
            bbox: result.source.valuationBbox,
            ocrText: "",
            kind: "valuation",
        }
    }
    return null
}

function kindLabel(kind: YenAmountCandidate["kind"]): string {
    return kind === "profit_loss" ? "損益" : "評価額"
}

function isDisplayNumberOverExpected(
    displayNumber: number | undefined,
    expectedCategoryCount: number
): boolean {
    return (
        displayNumber !== undefined &&
        expectedCategoryCount > 0 &&
        displayNumber > expectedCategoryCount
    )
}

function displayNumberBadgeClass(
    displayNumber: number,
    expectedCategoryCount: number,
    size: "sm" | "md" = "md"
): string {
    const over = isDisplayNumberOverExpected(displayNumber, expectedCategoryCount)
    const sizeClass =
        size === "sm"
            ? "h-5 w-5 text-[10px]"
            : "h-4 min-w-4 text-[9px] leading-none"
    return `flex shrink-0 items-center justify-center rounded-full font-bold text-white ${sizeClass} ${
        over ? "bg-red-500" : "bg-amber-500"
    }`
}

function ResultEntryEditor({
    result,
    globalIndex,
    displayNumber,
    expectedCategoryCount,
    onSelectCandidate,
    onExcludeCandidate,
    onRemoveResult,
}: {
    result: MatchResult
    globalIndex: number
    displayNumber?: number
    expectedCategoryCount: number
    onSelectCandidate?: (resultIndex: number, candidate: YenAmountCandidate) => void
    onExcludeCandidate?: (resultIndex: number, candidate: YenAmountCandidate) => void
    onRemoveResult?: (resultIndex: number) => void
}) {
    const candidates = getCandidatesForResult(result)
    const canEdit = Boolean(onSelectCandidate && onExcludeCandidate)

    return (
        <li className="rounded-md border bg-background/80 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5">
                <span
                    className={`${displayNumber !== undefined ? displayNumberBadgeClass(displayNumber, expectedCategoryCount, "sm") : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold bg-muted text-muted-foreground"}`}
                >
                    {displayNumber ?? "—"}
                </span>
                <span className="truncate text-xs font-medium flex-1 min-w-0">
                    {result.categoryName ??
                        (result.ocrName.trim() ||
                            (displayNumber !== undefined
                                ? `(行${displayNumber})`
                                : `(行${globalIndex + 1})`))}
                </span>
                <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                    {result.imageDismissedCandidate ? (
                        "未採用"
                    ) : (
                        <>¥{result.valuation.toLocaleString()}</>
                    )}
                </span>
                {onRemoveResult && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        title="この行を削除"
                        onClick={() => onRemoveResult(globalIndex)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>

            {canEdit && candidates.length > 0 && (
                <ul className="border-t px-1 py-1 space-y-0.5">
                    {candidates.map((candidate) => {
                        const selected = isSelectedCandidate(result, candidate)
                        return (
                            <li
                                key={candidateKey(candidate)}
                                className={`flex items-center gap-1 rounded px-1 py-0.5 text-[11px] ${
                                    selected ? "bg-amber-50/80 dark:bg-amber-900/15" : ""
                                }`}
                            >
                                <button
                                    type="button"
                                    className="flex-1 text-left tabular-nums min-w-0 truncate"
                                    onClick={() => onSelectCandidate?.(globalIndex, candidate)}
                                >
                                    <span className="font-medium">
                                        ¥{candidate.value.toLocaleString()}
                                    </span>
                                    <span className="text-muted-foreground ml-1.5">
                                        {kindLabel(candidate.kind)}
                                    </span>
                                    {selected && (
                                        <span className="text-amber-700 dark:text-amber-300 ml-1.5">
                                            使用中
                                        </span>
                                    )}
                                </button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                    title="この金額を除外"
                                    onClick={() => onExcludeCandidate?.(globalIndex, candidate)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </li>
    )
}

function ImageReadCheckCard({
    item,
    imageIndex,
    resultEntries,
    displayNumberByIndex,
    expectedCategoryCount,
    onSelectCandidate,
    onDismissAdopted,
    onExcludeCandidate,
    onRemoveResult,
}: {
    item: ImageQueueItem
    imageIndex: number
    resultEntries: { result: MatchResult; globalIndex: number }[]
    displayNumberByIndex: Map<number, number>
    expectedCategoryCount: number
    onSelectCandidate?: (resultIndex: number, candidate: YenAmountCandidate) => void
    onDismissAdopted?: (resultIndex: number, candidate: YenAmountCandidate) => void
    onExcludeCandidate?: (resultIndex: number, candidate: YenAmountCandidate) => void
    onRemoveResult?: (resultIndex: number) => void
}) {
    const sourceMeta = resultEntries.find((e) => e.result.source)?.result.source
    const canEdit = Boolean(onSelectCandidate && onDismissAdopted)
    const [listOpen, setListOpen] = useState(false)

    return (
        <div className="rounded-lg border bg-card min-w-0">
            <div className="px-3 py-2 border-b bg-muted/30 min-w-0">
                <span className="text-sm font-medium break-words">
                    {imageIndex + 1}. {item.name}
                </span>
                <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                    {resultEntries.length}行読み取り
                </span>
            </div>

            <div className="p-3 space-y-3 min-w-0">
                <div className="relative w-full max-w-[280px] mx-auto rounded-md border bg-muted/30 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="w-full h-auto block"
                    />
                    {sourceMeta &&
                        resultEntries.map(({ result, globalIndex }) => {
                            const adopted = getAdoptedCandidate(result)
                            const dismissed = result.imageDismissedCandidate
                            const overlay = adopted ?? dismissed
                            if (!overlay) return null

                            const isAdopted = adopted !== null
                            const displayNumber = displayNumberByIndex.get(globalIndex)
                            const style = bboxToPercentStyle(
                                overlay.bbox,
                                sourceMeta.ocrImageWidth,
                                sourceMeta.ocrImageHeight
                            )
                            const overlayClass = isAdopted
                                ? isDisplayNumberOverExpected(
                                      displayNumber,
                                      expectedCategoryCount
                                  )
                                    ? "border-red-500 bg-red-400/30 ring-1 ring-red-500/50"
                                    : ADOPTED_OVERLAY_CLASS
                                : DISMISSED_OVERLAY_CLASS

                            if (!canEdit) {
                                return (
                                    <div
                                        key={globalIndex}
                                        className={`absolute border-2 pointer-events-none ${overlayClass}`}
                                        style={style}
                                    >
                                        {isAdopted && displayNumber !== undefined && (
                                            <span
                                                className={`absolute -top-2 -left-1 ${displayNumberBadgeClass(displayNumber, expectedCategoryCount)}`}
                                            >
                                                {displayNumber}
                                            </span>
                                        )}
                                    </div>
                                )
                            }

                            return (
                                <button
                                    key={globalIndex}
                                    type="button"
                                    title={
                                        isAdopted
                                            ? `¥${overlay.value.toLocaleString()}をクリックで採用解除`
                                            : `¥${overlay.value.toLocaleString()}をクリックで採用`
                                    }
                                    className={`absolute border-2 cursor-pointer transition-colors ${overlayClass} ${
                                        isAdopted
                                            ? isDisplayNumberOverExpected(
                                                  displayNumber,
                                                  expectedCategoryCount
                                              )
                                                ? "hover:border-red-600 hover:ring-1 hover:ring-red-600/40"
                                                : "hover:border-destructive hover:ring-1 hover:ring-destructive/40"
                                            : "hover:border-amber-500 hover:ring-1 hover:ring-amber-500/40"
                                    }`}
                                    style={style}
                                    onClick={() => {
                                        if (isAdopted) {
                                            onDismissAdopted?.(globalIndex, overlay)
                                        } else {
                                            onSelectCandidate?.(globalIndex, overlay)
                                        }
                                    }}
                                >
                                    {isAdopted && displayNumber !== undefined && (
                                        <span
                                            className={`absolute -top-2 -left-1 pointer-events-none ${displayNumberBadgeClass(displayNumber, expectedCategoryCount)}`}
                                        >
                                            {displayNumber}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                </div>

                {resultEntries.length > 0 ? (
                    <div className="pt-1 pb-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto min-h-8 w-full text-xs text-muted-foreground whitespace-normal py-2 px-2 shrink-0"
                            onClick={() => setListOpen((open) => !open)}
                        >
                            {listOpen ? (
                                <span className="inline-flex items-center justify-center gap-1 flex-wrap">
                                    <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                                    リストを閉じる
                                </span>
                            ) : (
                                <span className="inline-flex items-center justify-center gap-1 flex-wrap">
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                    リスト表示（{resultEntries.length}件）
                                </span>
                            )}
                        </Button>
                        {listOpen && (
                            <ul className="space-y-2 mt-2">
                                {resultEntries.map(({ result, globalIndex }) => (
                                    <ResultEntryEditor
                                        key={globalIndex}
                                        result={result}
                                        globalIndex={globalIndex}
                                        displayNumber={displayNumberByIndex.get(globalIndex)}
                                        expectedCategoryCount={expectedCategoryCount}
                                        onSelectCandidate={onSelectCandidate}
                                        onExcludeCandidate={onExcludeCandidate}
                                        onRemoveResult={onRemoveResult}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">
                        この画像から銘柄は読み取れませんでした
                    </p>
                )}
            </div>
        </div>
    )
}

interface ZaimImageReadCheckProps {
    items: ImageQueueItem[]
    results: MatchResult[]
    expectedCategoryCount: number
    onSelectCandidate?: (resultIndex: number, candidate: YenAmountCandidate) => void
    onDismissAdopted?: (resultIndex: number, candidate: YenAmountCandidate) => void
    onExcludeCandidate?: (resultIndex: number, candidate: YenAmountCandidate) => void
    onRemoveResult?: (resultIndex: number) => void
}

export function ZaimImageReadCheck({
    items,
    results,
    expectedCategoryCount,
    onSelectCandidate,
    onDismissAdopted,
    onExcludeCandidate,
    onRemoveResult,
}: ZaimImageReadCheckProps) {
    const grouped = groupResultsByImage(items, results)
    const displayNumberByIndex = useMemo(
        () => buildActiveDisplayNumberByIndex(results),
        [results]
    )
    const canEdit = Boolean(onSelectCandidate && onDismissAdopted)

    return (
        <div className="space-y-3 min-h-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground shrink-0">
                <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-amber-500 bg-amber-400/30 shrink-0" />
                    採用中
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-slate-400/80 bg-slate-400/20 shrink-0" />
                    採用解除（クリックで再採用）
                </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 min-w-0 pb-2">
                {grouped.map(({ item, results: imageResults }, imageIndex) => (
                    <div key={item.id} className="min-w-0">
                    <ImageReadCheckCard
                        item={item}
                        imageIndex={imageIndex}
                        resultEntries={imageResults}
                        displayNumberByIndex={displayNumberByIndex}
                        expectedCategoryCount={expectedCategoryCount}
                        onSelectCandidate={onSelectCandidate}
                        onDismissAdopted={onDismissAdopted}
                        onExcludeCandidate={onExcludeCandidate}
                        onRemoveResult={onRemoveResult}
                    />
                    </div>
                ))}
            </div>

            {canEdit && (
                <p className="text-xs text-muted-foreground">
                    琥珀色の枠をクリックで灰色に（採用解除）、灰色をクリックで再採用。損益などは「リスト表示」から。
                </p>
            )}
        </div>
    )
}
