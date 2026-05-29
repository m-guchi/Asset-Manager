"use client"

import React, { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Settings, Eye, EyeOff, GripVertical } from "lucide-react"
import { ZaimScreenshotImportTrigger } from "@/components/assets/zaim-screenshot-import-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { getCategories, updateValuationSettingsAction } from "@/app/actions/categories"
import { updateValuation } from "@/app/actions/assets"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ValuationCategory {
    id: number;
    name: string;
    currentValue: number;
    valuationOrder: number | null;
    isValuationTarget: boolean | null;
    valuationAlias: string | null;
}

export default function BulkValuationPage() {
    const router = useRouter()
    const [categories, setCategories] = useState<ValuationCategory[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [valuations, setValuations] = useState<Record<number, number>>({})
    const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 10))
    const [isSaving, setIsSaving] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const catData = await getCategories()
            setCategories(catData)
        } catch (err) {
            console.error("Fetch error:", err)
            toast.error("データの取得に失敗しました")
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const dateObj = new Date(recordedAt)
            dateObj.setHours(12, 0, 0, 0)

            const entries = Object.entries(valuations)
            for (const [id, val] of entries) {
                await updateValuation(parseInt(id), val, dateObj)
            }

            toast.success("評価額を更新しました")
            setValuations({})
            fetchData()
            router.push('/assets')
        } catch (error) {
            console.error("Save error:", error);
            toast.error("更新に失敗しました")
        } finally {
            setIsSaving(false)
        }
    }

    const displayedCategories = React.useMemo(() => {
        return categories
            .filter(c => c.isValuationTarget)
            .sort((a, b) => (a.valuationOrder ?? 0) - (b.valuationOrder ?? 0))
    }, [categories])

    const zaimImportCategories = React.useMemo(() => {
        return displayedCategories.filter((c) => c.valuationAlias?.trim())
    }, [displayedCategories])

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
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <ZaimScreenshotImportTrigger
                    categories={zaimImportCategories.map((c) => ({
                        id: c.id,
                        name: c.name,
                        valuationAlias: c.valuationAlias,
                    }))}
                    zaimImportCount={zaimImportCategories.length}
                    onApply={(imported) =>
                        setValuations((prev) => ({ ...prev, ...imported }))
                    }
                />

                <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    表示設定
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle>入力フォーム</CardTitle>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="valuation-date" className="text-sm whitespace-nowrap">更新基準日:</Label>
                        <Input
                            id="valuation-date"
                            type="date"
                            className="w-[150px]"
                            value={recordedAt}
                            onChange={(e) => setRecordedAt(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 flex-1 overflow-y-auto min-h-0">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="px-1 w-[80px]">項目</TableHead>
                                <TableHead className="text-right px-1">現在評価額</TableHead>
                                <TableHead className="text-right px-1 w-16">前回</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayedCategories.map((cat) => (
                                <TableRow key={cat.id}>
                                    <TableCell className="font-medium text-xs break-words w-[80px] px-1 py-1 leading-tight">{cat.name}</TableCell>
                                    <TableCell className="px-1 py-1">
                                        <Input
                                            type="number"
                                            className={`text-right w-full h-10 text-base ${!valuations[cat.id] ? 'border-orange-300 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/10' : ''}`}
                                            placeholder={cat.currentValue.toString()}
                                            value={valuations[cat.id] || ""}
                                            onChange={(e) => setValuations({ ...valuations, [cat.id]: parseFloat(e.target.value) })}
                                        />
                                    </TableCell>
                                    <TableCell
                                        className="text-right px-1 py-1 opacity-50 text-[10px] text-muted-foreground w-16 whitespace-nowrap cursor-pointer hover:opacity-100 hover:text-primary transition-all underline decoration-dotted"
                                        onClick={() => setValuations({ ...valuations, [cat.id]: Number(cat.currentValue) })}
                                        title="前回値をコピー"
                                    >
                                        ¥{Number(cat.currentValue).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {displayedCategories.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                        表示対象の資産がありません。「表示設定」から確認してください。
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="flex justify-end border-t pt-4">
                    <Button disabled={isSaving || Object.keys(valuations).length === 0} onClick={handleSave}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {Object.keys(valuations).length}件の評価額を一括保存
                    </Button>
                </CardFooter>
            </Card>

            <ValuationSettingsDialog
                open={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                categories={categories}
                onSave={async (newSettings) => {
                    setIsLoading(true)
                    await updateValuationSettingsAction(newSettings)
                    await fetchData()
                    setIsSettingsOpen(false)
                    toast.success("表示設定を保存しました")
                }}
            />
        </div>
    )
}

function ValuationSettingsDialog({
    open,
    onOpenChange,
    categories,
    onSave
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    categories: ValuationCategory[],
    onSave: (settings: {
        id: number
        valuationOrder: number
        isValuationTarget: boolean
        valuationAlias: string | null
    }[]) => void
}) {
    // Determine initial order: 
    // sort by valuationOrder first. If same (e.g. 0), keep stable or sort by ID
    const sortedCats = React.useMemo(() => {
        return [...categories].sort((a, b) => {
            const ordA = a.valuationOrder ?? 0
            const ordB = b.valuationOrder ?? 0
            if (ordA !== ordB) return ordA - ordB
            return a.id - b.id
        })
    }, [categories])

    const [items, setItems] = useState<ValuationCategory[]>([])
    const [showHidden, setShowHidden] = useState(false)

    // Capture the open state to detect when it changes to true
    const [lastOpen, setLastOpen] = useState(false)

    if (open && !lastOpen) {
        setLastOpen(true)
        setItems(sortedCats)
        setShowHidden(false)
    } else if (!open && lastOpen) {
        setLastOpen(false)
        setShowHidden(false)
    }

    const hiddenCount = items.filter((i) => !i.isValuationTarget).length
    const visibleItems = showHidden ? items : items.filter((i) => i.isValuationTarget)

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            setItems((items) => {
                const visible = showHidden ? items : items.filter((i) => i.isValuationTarget)
                const hidden = showHidden ? [] : items.filter((i) => !i.isValuationTarget)
                const oldIndex = visible.findIndex((i) => i.id === active.id)
                const newIndex = visible.findIndex((i) => i.id === over.id)
                const reorderedVisible = arrayMove(visible, oldIndex, newIndex)
                return [...reorderedVisible, ...hidden]
            })
        }
    }

    const toggleVisibility = (id: number) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, isValuationTarget: !item.isValuationTarget } : item
        ))
    }

    const updateAlias = (id: number, valuationAlias: string) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, valuationAlias: valuationAlias || null } : item
        ))
    }

    const handleSave = () => {
        const settings = items.map((item, index) => ({
            id: item.id,
            valuationOrder: index,
            isValuationTarget: !!item.isValuationTarget,
            valuationAlias: item.valuationAlias?.trim() || null,
        }))
        onSave(settings)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] flex flex-col sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>表示設定</DialogTitle>
                    <DialogDescription>
                        評価額更新画面の表示順序・Zaim表示名・表示/非表示を設定します。
                        Zaim表示名を設定した項目のみスクショ読込対象です。Zaim上の表示順と同じ順に並べてください。
                    </DialogDescription>
                </DialogHeader>

                {hiddenCount > 0 && (
                    <div className="flex justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setShowHidden((prev) => !prev)}
                        >
                            {showHidden ? "非表示項目を隠す" : `すべて表示する（非表示 ${hiddenCount}件）`}
                        </Button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto pr-2 -mr-2 min-h-[300px]">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={visibleItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                                {visibleItems.map((item) => (
                                    <ValuationSettingItem
                                        key={item.id}
                                        item={item}
                                        onToggle={() => toggleVisibility(item.id)}
                                        onAliasChange={(alias) => updateAlias(item.id, alias)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>

                <DialogFooter className="pt-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
                    <Button onClick={handleSave}>保存</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ValuationSettingItem({
    item,
    onToggle,
    onAliasChange,
}: {
    item: ValuationCategory
    onToggle: () => void
    onAliasChange: (alias: string) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
        position: 'relative' as const,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`rounded-lg border bg-card ${isDragging ? 'shadow-md ring-2 ring-primary/20' : ''} ${!item.isValuationTarget ? 'opacity-60 bg-muted/50' : ''}`}
        >
            <div className="flex items-center gap-3 p-3">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground">
                    <GripVertical className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 shrink-0 ${item.isValuationTarget ? 'text-primary' : 'text-muted-foreground'}`}
                    onClick={onToggle}
                >
                    {item.isValuationTarget ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
            </div>

            {item.isValuationTarget && (
                <div className="px-3 pb-3 pt-0">
                    <Input
                        className="h-8 text-xs"
                        placeholder="Zaim表示名（例: NTT, 三菱重）※設定した項目のみスクショ読込対象"
                        value={item.valuationAlias ?? ""}
                        onChange={(e) => onAliasChange(e.target.value)}
                    />
                </div>
            )}
        </div>
    )
}
