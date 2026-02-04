"use client"

import React, { useState, useCallback, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Plus, Tag as TagIcon, LayoutGrid, Trash2, Edit2, Loader2, Save, ChevronUp, ChevronDown, AlertCircle, GripVertical, Check, X, ArrowDownUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { getCategories, saveCategory, deleteCategory, updateCategoryOrder, reorderCategoriesAction } from "../actions/categories"
import { getTags, saveTag, deleteTag, getTagGroups, saveTagGroup, deleteTagGroup } from "../actions/tags"
import { updateValuation } from "../actions/assets"
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
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// アセット管理のメインコンテンツ
function AssetsContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const activeTab = searchParams.get("tab") || "categories"

    const [categories, setCategories] = useState<any[]>([])
    const [tags, setTags] = useState<any[]>([])
    const [tagGroups, setTagGroups] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [catData, tagData, groupData] = await Promise.all([
                getCategories(),
                getTags(),
                getTagGroups()
            ])
            setCategories(catData)
            setTags(tagData)
            setTagGroups(groupData)
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

    const handleTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", value)
        router.push(`?${params.toString()}`)
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
        <div className="flex flex-col gap-6 p-4 md:p-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">資産管理</h1>
                    <p className="text-muted-foreground">
                        資産、タグ、タググループの管理。
                    </p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="categories" className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        資産
                    </TabsTrigger>
                    <TabsTrigger value="tags" className="flex items-center gap-2">
                        <TagIcon className="h-4 w-4" />
                        タグ
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="categories" className="space-y-4">
                    <CategoryManagement categories={categories} tags={tags} onRefresh={fetchData} />
                </TabsContent>

                <TabsContent value="tags" className="space-y-4">
                    <TagManagement tags={tags} tagGroups={tagGroups} onRefresh={fetchData} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default function AssetsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center p-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">読み込み中...</span>
            </div>
        }>
            <AssetsContent />
        </Suspense>
    )
}

function CategoryManagement({ categories, tags, onRefresh }: { categories: any[], tags: any[], onRefresh: () => void }) {
    const [isReordering, setIsReordering] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<any>(null)
    const [isDeleting, setIsDeleting] = useState<number | null>(null)

    const handleSave = async (formData: any) => {
        try {
            await saveCategory(formData)
            toast.success(editingCategory ? "資産を更新しました" : "資産を作成しました")
            setIsDialogOpen(false)
            onRefresh()
        } catch (err) {
            toast.error("保存に失敗しました")
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("この資産を削除してもよろしいですか？履歴データもすべて削除されます。")) return
        setIsDeleting(id)
        try {
            await deleteCategory(id)
            toast.success("資産を削除しました")
            onRefresh()
        } catch (err) {
            toast.error("削除に失敗しました")
        } finally {
            setIsDeleting(null)
        }
    }



    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>資産管理</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                    {!isReordering ? (
                        <>
                            <Button variant="outline" size="sm" onClick={() => setIsReordering(true)}>
                                <ArrowDownUp className="h-4 w-4 mr-2" />
                                並び替え
                            </Button>
                            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                                setIsDialogOpen(open)
                                if (!open) setEditingCategory(null)
                            }}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="flex items-center gap-2">
                                        <Plus className="h-4 w-4" />
                                        追加
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{editingCategory ? "資産の編集" : "新規資産作成"}</DialogTitle>
                                    </DialogHeader>
                                    <CategoryForm
                                        initialData={editingCategory}
                                        allTags={tags}
                                        allCategories={categories}
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
                {isReordering ? (
                    <CategoryReorderMode categories={categories} onRefresh={onRefresh} onComplete={() => setIsReordering(false)} />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>

                                <TableHead>名前</TableHead>
                                <TableHead>タイプ</TableHead>
                                <TableHead>タグ</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.map((cat, idx) => {
                                const isChild = !!cat.parentId
                                return (
                                    <TableRow key={cat.id} className={isChild ? "bg-muted/30" : ""}>

                                        <TableCell className="font-medium p-0">
                                            <div className={`flex items-center gap-2 px-4 py-3 ${isChild ? "ml-6" : ""}`}>
                                                <Link
                                                    href={`/assets/${cat.id}`}
                                                    className="flex items-center gap-2 hover:underline decoration-primary transition-all"
                                                >
                                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                                                    <span className={isChild ? "text-sm text-muted-foreground" : "font-bold"}>{cat.name}</span>
                                                </Link>
                                                {cat.conflicts && cat.conflicts.length > 0 && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <AlertCircle className="h-4 w-4 text-destructive animate-pulse cursor-help" />
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-destructive text-destructive-foreground border-none">
                                                                <p className="font-bold">タグ重複の警告</p>
                                                                <p className="text-xs">
                                                                    同じグループ({cat.conflicts.join(", ")})内の複数のタグが設定されています。
                                                                </p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={cat.isLiability ? "destructive" : cat.isCash ? "outline" : "secondary"} className={isChild ? "opacity-70 scale-90" : ""}>
                                                {cat.isLiability ? "負債" : cat.isCash ? "現金・預金" : "投資商品"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {cat.tags?.map((t: any, idx: number) => (
                                                    <Badge key={`${cat.id}-tag-${idx}`} variant="outline" className="text-[10px]">
                                                        {t}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => { setEditingCategory(cat); setIsDialogOpen(true); }}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" disabled={isDeleting === cat.id} onClick={() => handleDelete(cat.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}

function CategoryForm({ initialData, allTags, allCategories, onSave, onCancel }: any) {
    const [name, setName] = useState(initialData?.name || "")
    const [color, setColor] = useState(initialData?.color || "#3b82f6")
    const [isCash, setIsCash] = useState(initialData?.isCash || false)
    const [isLiability, setIsLiability] = useState(initialData?.isLiability || false)
    const [parentId, setParentId] = useState<number | null>(initialData?.parentId || null)
    const [selectedTags, setSelectedTags] = useState<string[]>(
        initialData?.tags || []
    )

    // Filter categories that can be a parent (no infinite recursion, etc.)
    const possibleParents = allCategories.filter((c: any) => c.id !== initialData?.id && !c.parentId)

    return (
        <div className="grid gap-4 py-4">
            <div className="grid gap-2">
                <Label htmlFor="name">名称</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
                <Label>表示色</Label>
                <div className="flex gap-2">
                    <Input type="color" className="w-12 p-1 h-10" value={color} onChange={(e) => setColor(e.target.value)} />
                    <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="parent">親アセット（合算先）</Label>
                <Select value={parentId?.toString() || "0"} onValueChange={(v) => setParentId(v === "0" ? null : parseInt(v))}>
                    <SelectTrigger>
                        <SelectValue placeholder="なし" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0">なし（単独アセット）</SelectItem>
                        {possibleParents.map((p: any) => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                    指定すると、この資産の額は親アセットに合算されて表示されます。
                </p>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <Label>現金・預金として扱う</Label>
                <Switch checked={isCash} onCheckedChange={setIsCash} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <Label className="text-destructive">負債（マイナス資産）</Label>
                <Switch checked={isLiability} onCheckedChange={setIsLiability} />
            </div>
            <div className="grid gap-2">
                <Label>タグ</Label>
                <div className="flex flex-wrap gap-2 pt-2">
                    {allTags.map((tag: any) => (
                        <Badge
                            key={tag.id}
                            variant={selectedTags.includes(tag.name) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                                if (selectedTags.includes(tag.name)) {
                                    setSelectedTags(selectedTags.filter(t => t !== tag.name))
                                } else {
                                    setSelectedTags([...selectedTags, tag.name])
                                }
                            }}
                        >
                            {tag.name}
                        </Badge>
                    ))}
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>キャンセル</Button>
                <Button onClick={() => onSave({ id: initialData?.id, name, color, isCash, isLiability, tags: selectedTags, parentId })}>
                    保存
                </Button>
            </DialogFooter>
        </div>
    )
}


// Reordering Components
function CategoryReorderMode({ categories, onRefresh, onComplete }: { categories: any[], onRefresh: () => void, onComplete: () => void }) {
    const [items, setItems] = useState(categories)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        setItems(categories)
    }, [categories])

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const topLevel = items.filter(c => !c.parentId)

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setItems((currentItems) => {
                const oldIndex = topLevel.findIndex(c => c.id === active.id)
                const newIndex = topLevel.findIndex(c => c.id === over.id)
                if (oldIndex === -1 || newIndex === -1) return currentItems

                const newTopLevel = arrayMove(topLevel, oldIndex, newIndex)

                // Reconstruct full list
                const newFullList: any[] = []
                newTopLevel.forEach(parent => {
                    newFullList.push(parent)
                    // Find children in original items and append
                    const children = currentItems.filter(c => c.parentId === parent.id)
                    children.forEach(child => newFullList.push(child))
                })

                return newFullList
            });
        }
    };

    const handleSave = async () => {
        setIsSaving(true)
        const currentTopLevel = items.filter(c => !c.parentId)
        const updates = currentTopLevel.map((cat, index) => ({
            id: cat.id,
            order: index
        }))

        const res = await reorderCategoriesAction(updates)
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
                    ドラッグ＆ドロップで並び替えできます（親カテゴリ単位）
                </span>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    保存して終了
                </Button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={topLevel.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-2">
                        {topLevel.map(parent => (
                            <SortableCategoryItem key={parent.id} category={parent}>
                                <div className="flex items-center gap-3 p-3 bg-card border rounded-md shadow-sm">
                                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                                    <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: parent.color }} />
                                    <span className="font-medium">{parent.name}</span>
                                    <Badge variant="outline" className="ml-auto text-xs font-normal text-muted-foreground">
                                        現在: ¥{Number(parent.currentValue).toLocaleString()}
                                    </Badge>
                                </div>
                                {items.filter(c => c.parentId === parent.id).length > 0 && (
                                    <div className="ml-8 mt-1 pl-4 border-l-2 border-dashed space-y-1">
                                        {items.filter(c => c.parentId === parent.id).map(child => (
                                            <div key={child.id} className="flex items-center gap-2 p-2 bg-muted/20 border rounded text-xs text-muted-foreground">
                                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: child.color }} />
                                                <span>{child.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </SortableCategoryItem>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}

function SortableCategoryItem({ category, children }: { category: any, children: React.ReactNode }) {
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
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {children}
        </div>
    );
}

function TagManagement({ tags, tagGroups, onRefresh }: { tags: any[], tagGroups: any[], onRefresh: () => void }) {
    const [isTagGroupDialogOpen, setIsTagGroupDialogOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState<any>(null)

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>タグ</CardTitle>
                        <CardDescription>資産の特徴（アセットクラス、地域など）を定義します。</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag: any) => (
                            <div key={tag.id} className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
                                <span className="text-sm">{tag.name}</span>
                                <button className="text-muted-foreground hover:text-destructive" onClick={async () => {
                                    if (confirm("削除しますか？")) { await deleteTag(tag.id); onRefresh(); }
                                }}>×</button>
                            </div>
                        ))}
                        <AddTagTrigger onAdd={onRefresh} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>タググループ</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setIsTagGroupDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {tagGroups.map(group => (
                            <div key={group.id} className="flex flex-col gap-2 rounded-lg border p-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{group.name}</span>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingGroup(group); setIsTagGroupDialogOpen(true); }}>
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={async () => {
                                            if (confirm("削除しますか？")) { await deleteTagGroup(group.id); onRefresh(); }
                                        }}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {group.tags?.map((t: any) => (
                                        <Badge key={t.id} variant="secondary" className="text-[10px]">{t.name}</Badge>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isTagGroupDialogOpen} onOpenChange={(open) => { setIsTagGroupDialogOpen(open); if (!open) setEditingGroup(null); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>タググループ設定</DialogTitle></DialogHeader>
                    <TagGroupForm initialData={editingGroup} allTags={tags} onSave={async (data: any) => {
                        await saveTagGroup(data); setIsTagGroupDialogOpen(false); onRefresh();
                    }} onCancel={() => setIsTagGroupDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    )
}

function AddTagTrigger({ onAdd }: { onAdd: () => void }) {
    const [name, setName] = useState("")
    const handleAdd = async () => {
        if (!name.trim()) return
        try {
            await saveTag({ name, color: "#94a3b8" })
            setName("")
            onAdd()
        } catch (err) {
            toast.error("追加に失敗しました")
        }
    }
    return (
        <div className="flex gap-1">
            <Input className="h-7 w-24 text-xs" placeholder="新規タグ" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAdd}><Plus className="h-3 w-3" /></Button>
        </div>
    )
}

function TagGroupForm({ initialData, allTags, onSave, onCancel }: any) {
    const [name, setName] = useState(initialData?.name || "")
    const [selectedTags, setSelectedTags] = useState<number[]>(initialData?.tags?.map((t: any) => t.id) || [])
    return (
        <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>グループ名</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid gap-2">
                <Label>対象タグ</Label>
                <div className="flex flex-wrap gap-2 pt-2">
                    {allTags.map((tag: any) => (
                        <Badge key={tag.id} variant={selectedTags.includes(tag.id) ? "default" : "outline"} className="cursor-pointer" onClick={() => {
                            setSelectedTags(selectedTags.includes(tag.id) ? selectedTags.filter(id => id !== tag.id) : [...selectedTags, tag.id])
                        }}>{tag.name}</Badge>
                    ))}
                </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={onCancel}>キャンセル</Button><Button onClick={() => onSave({ id: initialData?.id, name, tagIds: selectedTags })}>保存</Button></DialogFooter>
        </div>
    )
}


