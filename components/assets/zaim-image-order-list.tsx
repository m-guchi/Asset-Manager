"use client"

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import type { ParsedHolding } from "@/lib/zaim-screenshot"

export interface ImageQueueItem {
    id: string
    name: string
    previewUrl: string
    file: File
    holdings?: ParsedHolding[]
}

interface ZaimImageOrderListProps {
    items: ImageQueueItem[]
    onReorder: (items: ImageQueueItem[]) => void
}

function SortableImageRow({ item, index }: { item: ImageQueueItem; index: number }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
        position: "relative" as const,
    }

    const firstName = item.holdings?.find((h) => h.name.trim())?.name
    const lastName = item.holdings
        ? [...item.holdings].reverse().find((h) => h.name.trim())?.name
        : undefined

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 rounded-md border bg-card p-3 ${
                isDragging ? "shadow-md ring-2 ring-primary/20" : ""
            }`}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground shrink-0 self-stretch flex items-center"
            >
                <GripVertical className="h-5 w-5" />
            </div>

            <div className="h-44 w-[5.5rem] shrink-0 overflow-hidden rounded-md border bg-muted shadow-sm">
                {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.previewUrl}
                        alt=""
                        className="h-full w-full object-cover object-top"
                    />
                ) : null}
            </div>

            <div className="flex-1 min-w-0 self-center">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-muted-foreground shrink-0">
                        {index + 1}.
                    </span>
                    <span className="text-sm font-medium truncate">{item.name}</span>
                </div>
                {item.holdings !== undefined && (
                    <p className="text-xs text-muted-foreground truncate mt-1">
                        {item.holdings.length}行読み取り
                        {firstName && (
                            <>
                                {" · "}
                                {firstName}
                                {lastName && lastName !== firstName ? ` … ${lastName}` : ""}
                            </>
                        )}
                    </p>
                )}
            </div>
        </div>
    )
}

export function ZaimImageOrderList({ items, onReorder }: ZaimImageOrderListProps) {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return

        onReorder(arrayMove(items, oldIndex, newIndex))
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                Zaimの一覧で<strong>上から下</strong>の順になるよう、画像を並べ替えてから読み取りを開始してください。
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 max-h-[min(420px,50vh)] overflow-y-auto pr-1">
                        {items.map((item, index) => (
                            <SortableImageRow key={item.id} item={item} index={index} />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}

export function buildQueueItemsFromFiles(files: File[]): ImageQueueItem[] {
    return files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        file,
        previewUrl: URL.createObjectURL(file),
    }))
}

export function revokeQueuePreviewUrls(items: ImageQueueItem[]): void {
    for (const item of items) {
        if (item.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(item.previewUrl)
        }
    }
}
