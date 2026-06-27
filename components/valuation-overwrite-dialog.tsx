"use client"

import { formatCalendarDayKey } from "@/lib/valuation-day"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export type ValuationOverwriteItem = {
    label: string
    existingValue: number
    newValue: number
    dayKey: string
}

type ValuationOverwriteDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    items: ValuationOverwriteItem[]
    onConfirm: () => void
    isSubmitting?: boolean
}

function formatDayLabel(dayKey: string): string {
    return formatCalendarDayKey(dayKey)
}

export function ValuationOverwriteDialog({
    open,
    onOpenChange,
    items,
    onConfirm,
    isSubmitting = false,
}: ValuationOverwriteDialogProps) {
    const dayKey = items[0]?.dayKey
    const dayLabel = dayKey ? formatDayLabel(dayKey) : ""

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>評価額の上書き確認</DialogTitle>
                    <DialogDescription>
                        {items.length > 1
                            ? dayLabel
                                ? `${dayLabel}に登録済みの評価額があります。以下の内容で上書きしますか？`
                                : "登録済みの評価額があります。以下の内容で上書きしますか？"
                            : dayLabel
                                ? `${dayLabel}にはすでに評価額の記録があります。新しい値で上書きしますか？`
                                : "すでに評価額の記録があります。新しい値で上書きしますか？"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                    {items.map((item) => (
                        <div key={item.label} className="flex flex-col gap-1">
                            <span className="font-medium">{item.label}</span>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>現在: ¥{item.existingValue.toLocaleString()}</span>
                                <span>→</span>
                                <span className="font-semibold text-foreground">
                                    ¥{item.newValue.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        キャンセル
                    </Button>
                    <Button onClick={onConfirm} disabled={isSubmitting}>
                        上書きする
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
