"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Plus, History, RefreshCw, Edit2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
    Area,
    AreaChart,
    CartesianGrid,
    XAxis,
    YAxis,
    ResponsiveContainer,
    ComposedChart,
    Line
} from "recharts"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

import { getCategoryDetails } from "../../actions/categories"
import { updateValuation, addTransaction, deleteHistoryItem, updateHistoryItem } from "../../actions/assets"

export default function AssetDetailPage() {
    const params = useParams()
    const router = useRouter()
    const id = Number(params.id)

    const [category, setCategory] = React.useState<any>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const [timeRange, setTimeRange] = React.useState("1Y")
    const [isTrxModalOpen, setIsTrxModalOpen] = React.useState(false)
    const [editingItem, setEditingItem] = React.useState<any>(null)

    const fetchData = React.useCallback(async () => {
        setIsLoading(true)
        const data = await getCategoryDetails(id)
        if (data) {
            setCategory(data)
        }
        setIsLoading(false)
    }, [id])

    React.useEffect(() => {
        fetchData()
    }, [fetchData])

    const [newTrx, setNewTrx] = React.useState({
        date: new Date().toISOString().split('T')[0],
        type: "VALUATION",
        amount: "",
        valuation: "",
        memo: ""
    })

    // Update default values when category loads or edit starts
    React.useEffect(() => {
        if (category && !editingItem) {
            setNewTrx(prev => ({
                ...prev,
                type: category.isCash ? "VALUATION" : "TRANSACTION",
                valuation: category.currentValue.toString()
            }))
        }
    }, [category, editingItem])

    const handleAddTrx = async () => {
        if (!newTrx.valuation) {
            toast.error("評価額を入力してください")
            return
        }

        let res;
        if (editingItem) {
            const [type, itemId] = editingItem.id.split('-')
            res = await updateHistoryItem(type as any, Number(itemId), newTrx)
        } else {
            if (newTrx.type === 'VALUATION') {
                res = await updateValuation(id, Number(newTrx.valuation), new Date(newTrx.date))
            } else {
                const amt = Number(newTrx.amount) || 0
                res = await addTransaction(id, {
                    type: amt >= 0 ? "DEPOSIT" : "WITHDRAW",
                    amount: Math.abs(amt),
                    valuation: Number(newTrx.valuation),
                    date: new Date(newTrx.date),
                    memo: newTrx.memo
                })
            }
        }

        if (res.success) {
            toast.success(editingItem ? "更新しました" : "記録しました")
            setIsTrxModalOpen(false)
            setEditingItem(null)
            fetchData()
        } else {
            toast.error("保存に失敗しました")
        }
    }

    const handleDelete = async (itemIdStr: string) => {
        if (!confirm("この記録を削除してもよろしいですか？")) return
        const [type, itemId] = itemIdStr.split('-')
        const res = await deleteHistoryItem(type as any, Number(itemId))
        if (res.success) {
            toast.success("削除しました")
            fetchData()
        } else {
            toast.error("削除に失敗しました")
        }
    }

    const openEdit = (item: any) => {
        setEditingItem(item)
        setNewTrx({
            date: new Date(item.date).toISOString().split('T')[0],
            type: item.type === 'VALUATION' ? 'VALUATION' : 'TRANSACTION',
            amount: Math.abs(item.amount || 0).toString(),
            valuation: item.pointInTimeValuation.toString(),
            memo: item.memo || ""
        })
        setIsTrxModalOpen(true)
    }

    if (isLoading && !category) {
        return <div className="p-8 text-center"><RefreshCw className="animate-spin inline mr-2" />読み込み中...</div>
    }

    if (!category) {
        return <div className="p-8 text-center text-muted-foreground">資産が見つかりません</div>
    }

    const profit = category.currentValue - category.costBasis
    const profitPercent = category.costBasis > 0 ? (profit / category.costBasis) * 100 : 0
    const isPositive = profit >= 0

    const formatXAxis = (tickItem: number) => {
        const date = new Date(tickItem)
        return `${date.getFullYear()}/${date.getMonth() + 1}`
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="flex items-center gap-4 w-full">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-3 min-w-0 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight break-all">{category.name}</h1>
                            {!category.isCash && (
                                <Badge variant={isPositive ? "default" : "destructive"} className="shrink-0">
                                    {isPositive ? '+' : ''}{profitPercent.toFixed(1)}%
                                </Badge>
                            )}
                            {category.isLiability && <Badge variant="destructive" className="shrink-0">負債</Badge>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 pl-12 flex-wrap">
                    {category.tags.map((tag: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs font-normal text-muted-foreground">
                            {tag}
                        </Badge>
                    ))}
                </div>
            </div>

            <Card className="overflow-hidden border shadow-sm">
                <CardContent className="p-0">
                    <div className={`grid ${category.isCash ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'}`}>
                        <div className={`flex flex-col gap-1 p-4 md:p-6 ${!category.isCash ? 'border-r' : ''} border-border/50`}>
                            <span className="text-xs md:text-sm font-medium text-muted-foreground">{category.isLiability ? '借入残高' : '現在評価額'}</span>
                            <div className={`text-lg md:text-2xl font-bold tracking-tight ${category.isLiability ? 'text-red-500' : ''}`}>
                                {category.isLiability ? '-' : ''}¥{category.currentValue.toLocaleString()}
                            </div>
                        </div>
                        {!category.isCash && (
                            <>
                                <div className="flex flex-col gap-1 p-4 md:p-6 border-b md:border-b-0 md:border-r border-border/50">
                                    <span className="text-xs md:text-sm font-medium text-muted-foreground">{category.isLiability ? '当初借入額' : '取得原価'}</span>
                                    <div className="text-lg md:text-2xl font-bold tracking-tight">¥{category.costBasis.toLocaleString()}</div>
                                </div>
                                <div className="flex flex-col gap-1 p-4 md:p-6 border-r border-border/50">
                                    <span className="text-xs md:text-sm font-medium text-muted-foreground">評価損益</span>
                                    <div className={`text-lg md:text-2xl font-bold tracking-tight tabular-nums ${isPositive ? "text-green-500" : "text-red-500"}`}>
                                        {isPositive ? '+' : ''}¥{profit.toLocaleString()}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 p-4 md:p-6">
                                    <span className="text-xs md:text-sm font-medium text-muted-foreground">損益率</span>
                                    <div className={`text-lg md:text-2xl font-bold tracking-tight ${isPositive ? "text-green-500" : "text-red-500"}`}>
                                        {isPositive ? '+' : ''}{profitPercent.toFixed(2)}%
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>資産推移</CardTitle>
                    <div className="flex bg-muted rounded-md p-1">
                        {["1M", "3M", "1Y", "ALL"].map((range) => {
                            const label = { "1M": "1ヶ月", "3M": "3ヶ月", "1Y": "1年", "ALL": "全期間" }[range] || range;
                            return (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${timeRange === range
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        {category && (
                            <ChartContainer
                                config={(() => {
                                    const c: any = {
                                        value: {
                                            label: "評価額",
                                            color: category.color || "hsl(var(--primary))",
                                        },
                                        cost: {
                                            label: "取得原価",
                                            color: "hsl(var(--muted-foreground))",
                                        },
                                    };
                                    if (category.children && category.children.length > 0) {
                                        category.children.forEach((child: any) => {
                                            c[`child_${child.id}`] = {
                                                label: child.name,
                                                color: child.color || "#cccccc"
                                            };
                                        });
                                    }
                                    return c;
                                })()}
                                className="h-full w-full"
                            >
                                <ComposedChart
                                    data={(() => {
                                        if (!category.history || category.history.length === 0) return []
                                        const now = new Date()
                                        const cutoff = new Date()
                                        let isAll = false

                                        // Normalize cutoff to start of day
                                        cutoff.setHours(0, 0, 0, 0)

                                        if (timeRange === "1M") cutoff.setMonth(now.getMonth() - 1)
                                        else if (timeRange === "3M") cutoff.setMonth(now.getMonth() - 3)
                                        else if (timeRange === "1Y") cutoff.setFullYear(now.getFullYear() - 1)
                                        else isAll = true

                                        const allData = category.history.map((h: any) => ({ ...h, date: new Date(h.date).getTime() }))
                                        if (isAll) return allData

                                        const cutoffTime = cutoff.getTime()
                                        const filtered = allData.filter((h: any) => h.date >= cutoffTime)

                                        const beforeCutoff = [...category.history]
                                            .reverse()
                                            .find((h: any) => new Date(h.date).getTime() < cutoffTime)

                                        if (beforeCutoff) {
                                            const startPoint = {
                                                ...beforeCutoff,
                                                date: cutoffTime
                                            }
                                            return [startPoint, ...filtered]
                                        }
                                        return filtered
                                    })()}
                                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="date"
                                        type="number"
                                        domain={['dataMin', 'dataMax']}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        className="text-[10px]"
                                        tickFormatter={(tick) => {
                                            const date = new Date(tick)
                                            if (timeRange === "1M" || timeRange === "3M") {
                                                return `${date.getMonth() + 1}/${date.getDate()}`
                                            }
                                            return `${date.getFullYear()}/${date.getMonth() + 1}`
                                        }}
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        tickFormatter={(val) => `${(val / 10000).toFixed(0)}万`}
                                        width={45}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={4}
                                        className="text-[10px]"
                                    />
                                    <ChartTooltip
                                        cursor={false}
                                        content={
                                            <ChartTooltipContent
                                                indicator="dot"
                                                labelFormatter={(_, payload) => {
                                                    if (!payload || !payload.length || !payload[0].payload) return "";
                                                    const d = new Date(payload[0].payload.date);
                                                    if (isNaN(d.getTime())) return "";
                                                    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
                                                }}
                                                formatter={(value: any, name: any, item: any, index: any) => (
                                                    <div className="flex w-full items-center justify-between gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="h-2.5 w-2.5 rounded-[2px]"
                                                                style={{ backgroundColor: item.color }}
                                                            />
                                                            <span className="text-muted-foreground">{name}</span>
                                                        </div>
                                                        <span className="font-mono font-medium tabular-nums text-foreground">
                                                            ¥{Number(value).toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                            />
                                        }
                                    />
                                    {category.children && category.children.length > 0 ? (
                                        category.children.map((child: any) => (
                                            <Area
                                                key={child.id}
                                                type="monotone"
                                                dataKey={`child_${child.id}`}
                                                name={child.name}
                                                stackId="1"
                                                stroke={child.color}
                                                fill={child.color}
                                                fillOpacity={0.6}
                                                strokeWidth={2}
                                            />
                                        ))
                                    ) : (
                                        <Area
                                            type="linear"
                                            dataKey="value"
                                            name="評価額"
                                            stroke="var(--color-value)"
                                            fill="var(--color-value)"
                                            fillOpacity={0.3}
                                            strokeWidth={2}
                                            stackId="1" // Consistent
                                        />
                                    )}
                                    {!category.isCash && (
                                        <Line
                                            type="monotone"
                                            dataKey="cost"
                                            name="取得原価"
                                            stroke="#888888"
                                            strokeWidth={2}
                                            strokeDasharray="4 4"
                                            dot={false}
                                        />
                                    )}
                                </ComposedChart>
                            </ChartContainer>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-bold">取引・評価履歴</h2>
                </div>

                <Dialog open={isTrxModalOpen} onOpenChange={(open) => {
                    setIsTrxModalOpen(open);
                    if (!open) {
                        setEditingItem(null);
                        setNewTrx({
                            date: new Date().toISOString().split('T')[0],
                            type: category.isCash ? "VALUATION" : "TRANSACTION",
                            amount: "",
                            valuation: category.currentValue.toString(),
                            memo: ""
                        });
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> 取引・評価を追加</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>{editingItem ? "履歴を編集" : "履歴を追加"}</DialogTitle>
                            <DialogDescription>{editingItem ? "過去の記録を修正します。" : "入出金または評価額の更新を記録します。"}</DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-5 py-4">
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-semibold">日付</Label>
                                <Input type="date" value={newTrx.date} onChange={(e) => setNewTrx({ ...newTrx, date: e.target.value })} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-semibold">種別</Label>
                                <Select value={newTrx.type} onValueChange={(v) => setNewTrx({ ...newTrx, type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {!category.isCash && <SelectItem value="TRANSACTION">入出金</SelectItem>}
                                        <SelectItem value="VALUATION">評価額のみ更新</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {newTrx.type === 'TRANSACTION' && (
                                <div className="flex flex-col gap-2">
                                    <Label className="text-xs font-semibold">取引金額 (マイナスで出金)</Label>
                                    <Input type="number" value={newTrx.amount} onChange={(e) => setNewTrx({ ...newTrx, amount: e.target.value })} />
                                </div>
                            )}
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-semibold">取引後/更新後の評価額</Label>
                                <Input type="number" value={newTrx.valuation} onChange={(e) => setNewTrx({ ...newTrx, valuation: e.target.value })} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs font-semibold">備考</Label>
                                <Input value={newTrx.memo} onChange={(e) => setNewTrx({ ...newTrx, memo: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button className="w-full" onClick={handleAddTrx}>{editingItem ? "更新する" : "保存する"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[110px]">日付</TableHead>
                                <TableHead>種別</TableHead>
                                <TableHead className="text-right">収支額</TableHead>
                                <TableHead className="text-right">評価額</TableHead>
                                <TableHead className="hidden md:table-cell">備考</TableHead>
                                <TableHead className="text-right w-[100px]">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {category.transactions.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell className="text-xs font-medium text-muted-foreground">
                                        {new Date(item.date).toISOString().slice(0, 10)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={item.type === 'DEPOSIT' ? 'default' : item.type === 'WITHDRAW' ? 'secondary' : (item.type === 'VALUATION' || item.type === 'VALUATION_ONLY') ? 'outline' : 'outline'}>
                                            {item.type === 'DEPOSIT' ? '入金' : item.type === 'WITHDRAW' ? '出金' : '評価更新'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {item.amount !== 0 ? `¥${item.amount.toLocaleString()}` : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        ¥{item.pointInTimeValuation?.toLocaleString() || "0"}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{item.memo}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(item.id)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
