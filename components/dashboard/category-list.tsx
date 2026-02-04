"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle, GripVertical, Check, X, ArrowDownUp } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
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
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { reorderCategoriesAction } from "@/app/actions/categories"
import { toast } from "sonner"

import { Category } from "@/types/asset"

// --- Sortable Item Component ---
function SortableCategoryItem({ category, children, isEditing }: { category: Category, children: React.ReactNode, isEditing: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} className={`flex flex-col gap-1 p-2 rounded-lg border bg-card/50 shadow-sm ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}`}>
            {isEditing && (
                <div {...attributes} {...listeners} className="absolute right-2 top-2 z-10 cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
            )}
            {children}
        </div>
    );
}

export function CategoryList({ categories: initialCategories = [] }: { categories?: Category[] }) {
    const [categories, setCategories] = useState(initialCategories)
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Sync with props
    useEffect(() => {
        setCategories(initialCategories)
    }, [initialCategories])

    // Sensors for drag interaction
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Filter top-level categories
    const topLevel = categories.filter(c => !c.parentId)

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setCategories((items) => {
                // Find indices in the FULL list, but simplistic arrayMove is for flat list.
                // We need to reorder specifically the top-level items while keeping children associated.
                // However, since we are only sorting the array of IDs passed to SortableContext,
                // we should manipulate `categories` array but carefully.

                // Strategy: 
                // 1. Get current top-level order
                const oldIndex = topLevel.findIndex(c => c.id === active.id)
                const newIndex = topLevel.findIndex(c => c.id === over.id)

                if (oldIndex === -1 || newIndex === -1) return items;

                // 2. Create a new sorted top-level array
                const newTopLevel = arrayMove(topLevel, oldIndex, newIndex);

                // 3. Reconstruct the full list: newTopLevel (and their children) + orphans (if any)
                // Actually, simple way: Map the new order to the items and update their 'order' property locally
                // But full replacement is easier.

                // Let's just create a new list where top-levels are reordered.
                // Items that are not top-level (children) will stick with their parent lookups, 
                // but we need to update the state so UI reflects the move.

                // We will rely on `topLevel` derived from state for rendering.
                // We just need to update `categories` state such that `filter(!parentId)` returns them in new order.
                // But arrayMove works on array indices. `categories` contains children mixed in.

                // Solution: Map reordered top-levels back to a new full array.
                const newCategories: Category[] = [];
                newTopLevel.forEach(parent => {
                    newCategories.push(parent);
                    // Add its children immediately after (to keep them together in the state array, though not strictly required for filter)
                    // But actually, the order in `categories` state doesn't matter for `topLevel` filter unless we sort `topLevel`.
                    // Wait, `topLevel` variable is `categories.filter(...)`. Filter preserves order.
                    // So we DO need to move the item within `categories` array.
                });

                // Complex shuffle:
                const oldCategories = [...items];
                const activeItemIndex = oldCategories.findIndex(c => c.id === active.id);
                // We need to find the target location in the big array.
                // Because `over.id` is another parent, we find its index.
                const overItemIndex = oldCategories.findIndex(c => c.id === over.id);

                return arrayMove(oldCategories, activeItemIndex, overItemIndex);
            });
        }
    };

    const handleSaveOrder = async () => {
        setIsSaving(true);
        // Calculate new order values based on current state array
        // We only care about top-level order
        const currentTopLevel = categories.filter(c => !c.parentId);
        const updates = currentTopLevel.map((cat, index) => ({
            id: cat.id,
            order: index
        }));

        const result = await reorderCategoriesAction(updates);
        if (result.success) {
            toast.success("並び順を保存しました");
            setIsEditing(false);
        } else {
            toast.error("保存に失敗しました");
        }
        setIsSaving(false);
    };

    const handleCancel = () => {
        setCategories(initialCategories);
        setIsEditing(false);
    };

    const renderCategoryCard = (category: Category, isChild = false) => {
        const valueToUse = (isChild ? category.ownValue : category.currentValue) ?? 0
        const costToUse = (category.isCash ? valueToUse : (isChild ? category.ownCostBasis : category.costBasis)) ?? 0
        const profit = valueToUse - costToUse
        const profitPercent = costToUse > 0 ? (profit / costToUse) * 100 : 0
        const isPositive = profit >= 0

        const cardContent = (
            <Card className={`overflow-hidden h-full cursor-pointer hover:shadow-md transition-all border-l-0 relative group ${isChild ? 'bg-muted/30Scale' : ''} ${!isChild && isEditing ? 'select-none pointer-events-none' : ''}`}>
                <div className="absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover:w-2" style={{ backgroundColor: category.color }} />
                <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-0 pl-3 pr-2 pt-1.5 ${isChild ? 'pt-1' : ''}`}>
                    <CardTitle className={`${isChild ? 'text-[10px]' : 'text-xs'} font-medium flex items-center gap-2 text-muted-foreground/80 truncate`}>
                        {category.name}
                        {category.isLiability && <Badge variant="destructive" className="text-[8px] py-0 h-3.5">負債</Badge>}
                    </CardTitle>
                    {!isChild && category.conflicts && category.conflicts.length > 0 && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertCircle className="h-3 w-3 text-destructive animate-pulse" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-destructive text-destructive-foreground border-none">
                                    <p className="font-bold text-xs">タグ重複の警告</p>
                                    <p className="text-[10px]">グループ({category.conflicts.join(", ")})内で重複があります</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </CardHeader>
                <CardContent className={`pl-3 pr-2 ${isChild ? 'pb-1' : 'pb-1.5'} pt-0`}>
                    <div className="flex items-baseline justify-between gap-1.5">
                        <span className={`${isChild ? 'text-sm' : 'text-base'} font-bold tracking-tight leading-none ${category.isLiability ? "text-red-500" : ""}`}>
                            {category.isLiability ? "-" : ""}¥{valueToUse.toLocaleString()}
                        </span>

                        <span className={`${isChild ? 'text-[10px]' : 'text-xs'} font-bold whitespace-nowrap leading-none ${category.isCash ? "text-muted-foreground" : (isPositive ? "text-green-500" : "text-red-500")}`}>
                            {category.isCash ? '±0' : (
                                <>
                                    {isPositive ? '+' : ''}¥{profit.toLocaleString()}
                                    <span className="text-[10px] ml-0.5 opacity-70 font-normal">
                                        ({isPositive ? '+' : ''}{profitPercent.toFixed(1)}%)
                                    </span>
                                </>
                            )}
                        </span>
                    </div>
                </CardContent>
            </Card>
        );

        if (isChild) {
            return (
                <Link href={`/assets/${category.id}`} key={category.id} className="block w-full">
                    {cardContent}
                </Link>
            )
        }

        return cardContent; // Wrap Link outside for Edit Mode handling in Parent
    }

    if (categories.length === 0) return null

    return (
        <div className="space-y-2">
            {/* Toolbar */}
            <div className="flex justify-end gap-2 text-sm">
                {!isEditing ? (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                        <ArrowDownUp className="mr-2 h-4 w-4" /> 並び替え
                    </Button>
                ) : (
                    <>
                        <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                            <X className="mr-2 h-4 w-4" /> キャンセル
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSaveOrder} disabled={isSaving}>
                            <Check className="mr-2 h-4 w-4" /> 保存完了
                        </Button>
                    </>
                )}
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={topLevel.map(c => c.id)}
                    strategy={rectSortingStrategy}
                    disabled={!isEditing}
                >
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                        {topLevel.map((parent) => {
                            const children = categories.filter(c => c.parentId === parent.id)
                            const parentCard = renderCategoryCard(parent);

                            return (
                                <SortableCategoryItem key={parent.id} category={parent} isEditing={isEditing}>
                                    {!isEditing ? (
                                        <Link href={`/assets/${parent.id}`} className="block w-full">
                                            {parentCard}
                                        </Link>
                                    ) : (
                                        <div className="block w-full">
                                            {parentCard}
                                        </div>
                                    )}

                                    {children.length > 0 && (
                                        <div className="flex flex-col gap-1 ml-3 pl-2 border-l-2 border-muted border-dashed mt-0.5 pb-0.5">
                                            {children.map(child => renderCategoryCard(child, true))}
                                        </div>
                                    )}
                                </SortableCategoryItem>
                            )
                        })}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}
