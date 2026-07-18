"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Edit2, Loader2, ArrowDownUp, Check, X, GripVertical, AlertCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { getIndices, getIndexHistories, saveIndex, deleteIndex, reorderIndicesAction } from "@/app/actions/indices"
import { IndexCompareReport } from "@/components/indices/index-compare-report"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface IndexItem {
    id: number
    name: string
    symbol: string
    color: string
    order: number
    hidden: boolean
    latestValue: number | null
    latestRecordedAt: string | null
}

interface IndexHistoryItem {
    id: number
    name: string
    color: string
    values: { recordedAt: string; value: number }[]
}

const PRESET_COLORS = [
    "#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#0891b2", "#7c3aed", "#db2777", "#ea580c", "#4b5563",
    "#3b82f6", "#ef4444", "#22c55e", "#eab308", "#06b6d4", "#8b5cf6", "#ec4899", "#f97316", "#6b7280",
]

const TEMPLATES = [
    { name: "S&P500", symbol: "^GSPC" },
    { name: "日経平均", symbol: "^N225" },
    { name: "TOPIX", symbol: "1306.T" },
    { name: "金", symbol: "GC=F" },
    { name: "ビットコイン", symbol: "BTC-USD" },
]

export default function IndicesPage() {
    const [indices, setIndices] = useState<IndexItem[]>([])
    const [histories, setHistories] = useState<IndexHistoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isReordering, setIsReordering] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingIndex, setEditingIndex] = useState<IndexItem | null>(null)
    const [indexToDelete, setIndexToDelete] = useState<number | null>(null)
    const [isDeleting, setIsDeleting] = useState<number | null>(null)

    const fetchData = useCallback(async () => {
        try {
            const [indicesData, historiesData] = await Promise.all([getIndices(), getIndexHistories()])
            setIndices(indicesData)
            setHistories(historiesData)
        } catch (error) {
            console.error("Fetch indices error:", error)
            toast.error("データの取得に失敗しました")
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleSave = async (formData: { id?: number; name: string; symbol: string; color: string }) => {
        const res = await saveIndex(formData)
        if (res.success) {
            toast.success(editingIndex ? "指数を更新しました" : "指数を登録しました")
            setIsDialogOpen(false)
            setEditingIndex(null)
            fetchData()
        } else {
            toast.error(res.error || "保存に失敗しました")
        }
    }

    const confirmDelete = async () => {
        if (!indexToDelete) return
        setIsDeleting(indexToDelete)
        try {
            await deleteIndex(indexToDelete)
            toast.success("指数を削除しました")
            fetchData()
        } catch (error) {
            console.error("Delete index error:", error)
            toast.error("削除に失敗しました")
        } finally {
            setIsDeleting(null)
            setIndexToDelete(null)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">読み込み中...</span>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 px-2 py-4 md:px-4 md:py-8">
            {histories.length > 0 && <IndexCompareReport indices={histories} />}

            <Card>
                <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle>指数一覧</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                        {!isReordering ? (
                            <>
                                <Button variant="outline" size="sm" onClick={() => setIsReordering(true)}>
                                    <ArrowDownUp className="h-4 w-4 mr-2" />
                                    並び替え
                                </Button>
                                <Dialog
                                    open={isDialogOpen}
                                    onOpenChange={(open) => {
                                        setIsDialogOpen(open)
                                        if (!open) setEditingIndex(null)
                                    }}
                                >
                                    <DialogTrigger asChild>
                                        <Button size="sm" className="flex items-center gap-2">
                                            <Plus className="h-4 w-4" />
                                            追加
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>{editingIndex ? "指数の編集" : "指数の登録"}</DialogTitle>
                                        </DialogHeader>
                                        <IndexForm
                                            initialData={editingIndex}
                                            onSave={handleSave}
                                            onCancel={() => setIsDialogOpen(false)}
                                        />
                                    </DialogContent>
                                </Dialog>
                            </>
                        ) : (
                            <Button variant="ghost" size="sm" onClick={() => setIsReordering(false)}>
                                <X className="h-4 w-4 mr-2" />
                                キャンセル
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {indices.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            まだ指数が登録されていません。「追加」から登録してください。
                        </p>
                    ) : isReordering ? (
                        <IndexReorderMode
                            indices={indices}
                            onRefresh={fetchData}
                            onComplete={() => setIsReordering(false)}
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>指数名</TableHead>
                                    <TableHead>シンボル</TableHead>
                                    <TableHead className="text-right">最新値</TableHead>
                                    <TableHead className="text-right">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {indices.map((idx) => (
                                    <TableRow key={idx.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: idx.color }} />
                                                {idx.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{idx.symbol}</TableCell>
                                        <TableCell className="text-right">
                                            {idx.latestValue !== null
                                                ? idx.latestValue.toLocaleString("ja-JP", { maximumFractionDigits: 2 })
                                                : "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setEditingIndex(idx)
                                                        setIsDialogOpen(true)
                                                    }}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive"
                                                    disabled={isDeleting === idx.id}
                                                    onClick={() => setIndexToDelete(idx.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>

                <Dialog open={!!indexToDelete} onOpenChange={(open) => !open && setIndexToDelete(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>指数の削除</DialogTitle>
                            <DialogDescription>
                                この指数を削除してもよろしいですか？<br />
                                取得済みの値データもすべて削除されます。この操作は取り消せません。
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIndexToDelete(null)}>
                                キャンセル
                            </Button>
                            <Button variant="destructive" onClick={confirmDelete} disabled={!!isDeleting}>
                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                削除する
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </Card>
        </div>
    )
}

function IndexForm({
    initialData,
    onSave,
    onCancel,
}: {
    initialData: IndexItem | null
    onSave: (data: { id?: number; name: string; symbol: string; color: string }) => Promise<void>
    onCancel: () => void
}) {
    const [name, setName] = useState(initialData?.name || "")
    const [symbol, setSymbol] = useState(initialData?.symbol || "")
    const [color, setColor] = useState(initialData?.color || PRESET_COLORS[0])
    const [isSaving, setIsSaving] = useState(false)

    const applyTemplate = (template: (typeof TEMPLATES)[number]) => {
        setName(template.name)
        setSymbol(template.symbol)
    }

    const handleSubmit = async () => {
        setIsSaving(true)
        try {
            await onSave({ id: initialData?.id, name, symbol, color })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="grid gap-4 py-4">
            {!initialData && (
                <div className="grid gap-2">
                    <Label>よく使う指数から選択</Label>
                    <div className="flex flex-wrap gap-2">
                        {TEMPLATES.map((t) => (
                            <button
                                key={t.symbol}
                                type="button"
                                onClick={() => applyTemplate(t)}
                                className="px-3 py-1 text-xs rounded-md border bg-muted/30 hover:bg-muted transition-colors"
                            >
                                {t.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div className="grid gap-2">
                <Label htmlFor="name">名称</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="symbol">シンボル（Yahoo Finance表記）</Label>
                <Input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="例: ^GSPC" />
                <p className="text-[10px] text-muted-foreground">
                    Yahoo Financeで使われている銘柄コードを入力してください（例: S&P500は^GSPC、ビットコインはBTC-USD）。
                </p>
                <a
                    href="https://finance.yahoo.com/lookup/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline w-fit"
                >
                    <ExternalLink className="h-3 w-3" />
                    Yahoo Financeでシンボルを検索する（英語サイト）
                </a>
            </div>
            <div className="grid gap-2">
                <Label>表示色</Label>
                <div className="grid grid-cols-9 gap-2 p-1 border rounded-md bg-muted/5">
                    {PRESET_COLORS.map((c) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={`h-6 w-full rounded-sm transition-all hover:scale-110 flex items-center justify-center ${color === c ? "ring-2 ring-primary ring-offset-1 z-10" : "opacity-80 hover:opacity-100"}`}
                            style={{ backgroundColor: c }}
                            title={c}
                        >
                            {color === c && <Check className="h-3 w-3 text-white mix-blend-difference" />}
                        </button>
                    ))}
                </div>
            </div>

            <DialogFooter className="pt-4 mt-2">
                <Button variant="outline" onClick={onCancel}>
                    キャンセル
                </Button>
                <Button onClick={handleSubmit} disabled={!name || !symbol || isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    保存
                </Button>
            </DialogFooter>
        </div>
    )
}

function IndexReorderMode({
    indices,
    onRefresh,
    onComplete,
}: {
    indices: IndexItem[]
    onRefresh: () => void
    onComplete: () => void
}) {
    const [items, setItems] = useState<IndexItem[]>(indices)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        setItems(indices)
    }, [indices])

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            setItems((current) => {
                const oldIndex = current.findIndex((i) => i.id === active.id)
                const newIndex = current.findIndex((i) => i.id === over.id)
                if (oldIndex === -1 || newIndex === -1) return current
                return arrayMove(current, oldIndex, newIndex)
            })
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        const updates = items.map((idx, index) => ({ id: idx.id, order: index }))
        const res = await reorderIndicesAction(updates)
        if (res.success) {
            toast.success("並び順を保存しました")
            onRefresh()
            onComplete()
        } else {
            toast.error("保存に失敗しました")
        }
        setIsSaving(false)
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border border-dashed">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    ドラッグ＆ドロップで並び替えできます
                </span>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    保存して終了
                </Button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-2">
                        {items.map((idx) => (
                            <SortableIndexItem key={idx.id} id={idx.id}>
                                <div className="flex items-center gap-3 p-3 bg-card border rounded-md shadow-sm">
                                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                                    <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: idx.color }} />
                                    <span className="font-medium">{idx.name}</span>
                                </div>
                            </SortableIndexItem>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}

function SortableIndexItem({ id, children }: { id: number; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
        opacity: isDragging ? 0.5 : 1,
    }
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {children}
        </div>
    )
}
