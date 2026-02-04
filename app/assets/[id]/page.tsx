"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Plus, History, RefreshCw, Edit2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
    const [historyFilter, setHistoryFilter] = React.useState<string>("ALL")
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

    // Filter transactions
    const filteredTransactions = React.useMemo(() => {
        if (!category) return []
        if (historyFilter === "ALL") return category.transactions
        return category.transactions.filter((t: any) => t.categoryId === Number(historyFilter))
    }, [category, historyFilter])

    const [newTrx, setNewTrx] = React.useState({
        date: new Date().toISOString().split('T')[0],
        type: "VALUATION",
        amount: "",
        valuation: "",
        memo: ""
    })
    const [isCalculateMode, setIsCalculateMode] = React.useState(false) // New state
    const [saleAmount, setSaleAmount] = React.useState("") // New state

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
        // Validation: Valuation is mandatory ONLY for 'VALUATION' type updates.
        // For 'TRANSACTION' (Deposit/Withdrawal), it is optional.
        if (newTrx.type === 'VALUATION' && !newTrx.valuation) {
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
                    valuation: newTrx.valuation ? Number(newTrx.valuation) : undefined,
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

    const [baseValuation, setBaseValuation] = React.useState(0) // New state for auto-calc base

    const openEdit = (item: any) => {
        setEditingItem(item)
        // Calculate base valuation (valuation BEFORE this transaction)
        const signedAmount = item.type === 'WITHDRAW' ? -Math.abs(item.amount || 0) : Math.abs(item.amount || 0);
        const currentVal = item.pointInTimeValuation || 0;
        setBaseValuation(currentVal - signedAmount);

        setNewTrx({
            date: new Date(item.date).toISOString().split('T')[0],
            type: item.type === 'VALUATION' ? 'VALUATION' : 'TRANSACTION',
            amount: signedAmount.toString(),
            valuation: item.pointInTimeValuation?.toString() || "",
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
        <div className="flex flex-col gap-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={category.parent ? `/assets/${category.parent.id}` : "/"} className="p-2 -ml-2 hover:bg-muted/50 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        {category.parent && (
                            <Link href={`/assets/${category.parent.id}`} className="text-xs text-muted-foreground hover:underline">
                                {category.parent.name} /
                            </Link>
                        )}
                        <h1 className="text-xl font-bold">{category.name}</h1>
                    </div>
                </div>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">評価額</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">¥{category.currentValue.toLocaleString()}</div>
                        <div className={`text-sm mt-1 flex items-center gap-2 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {isPositive ? '+' : ''}¥{Math.abs(profit).toLocaleString()}
                            <span className="text-xs bg-muted/20 px-1.5 py-0.5 rounded text-muted-foreground">
                                {category.costBasis > 0 ? `${isPositive ? '+' : ''}${profitPercent.toFixed(1)}%` : '-'}
                            </span>
                        </div>
                        {/* Child Asset Breakdown */}
                        {category.children && category.children.length > 0 && (
                            <div className="mt-4 pt-4 border-t space-y-2">
                                <div className="text-xs text-muted-foreground mb-2">内訳</div>
                                {category.children.map((child: any) => (
                                    <Link key={child.id} href={`/assets/${child.id}`} className="flex items-center justify-between text-sm group hover:bg-muted/50 p-1 rounded -mx-1 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: child.color }} />
                                            <span className="group-hover:underline">{child.name}</span>
                                        </div>
                                        <span className="font-mono">¥{child.currentValue.toLocaleString()}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">取得原価</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">¥{category.costBasis.toLocaleString()}</div>
                        <div className="text-sm mt-1 text-muted-foreground">
                            元本: ¥{category.costBasis.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Chart Section */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">資産推移</CardTitle>
                    <div className="flex bg-muted/50 rounded-md p-0.5 border">
                        {["1M", "3M", "1Y", "ALL"].map((range) => {
                            const label = { "1M": "1ヶ月", "3M": "3ヶ月", "1Y": "1年", "ALL": "全期間" }[range] || range;
                            return (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${timeRange === range
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
                        {category.history && (
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

                                        // Filter logic (same as before)
                                        const now = new Date()
                                        const cutoff = new Date()
                                        let isAll = false

                                        cutoff.setHours(0, 0, 0, 0)

                                        if (timeRange === "1M") cutoff.setMonth(now.getMonth() - 1)
                                        else if (timeRange === "3M") cutoff.setMonth(now.getMonth() - 3)
                                        else if (timeRange === "1Y") cutoff.setFullYear(now.getFullYear() - 1)
                                        else isAll = true

                                        const multiplier = category.isLiability ? -1 : 1;

                                        const allData = category.history.map((h: any) => {
                                            const point: any = {
                                                ...h,
                                                date: new Date(h.date).getTime(),
                                                value: h.value * multiplier,
                                                cost: h.cost * multiplier
                                            }
                                            // Make sure to flip child values too if they exist in history
                                            Object.keys(h).forEach(k => {
                                                if (k.startsWith('child_')) {
                                                    point[k] = h[k] * multiplier;
                                                }
                                            });
                                            return point;
                                        })

                                        if (isAll) return allData

                                        const cutoffTime = cutoff.getTime()
                                        const filtered = allData.filter((h: any) => h.date >= cutoffTime)

                                        const beforeCutoff = allData.slice().reverse().find((h: any) => h.date < cutoffTime)

                                        if (beforeCutoff) {
                                            const startPoint = { ...beforeCutoff, date: cutoffTime }
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
                                                            <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: item.color }} />
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
                                                type="linear"
                                                dataKey={`child_${child.id}`}
                                                name={child.name}
                                                stackId="1"
                                                stroke={child.color}
                                                fill={child.color}
                                                fillOpacity={0.2}
                                                strokeWidth={2}
                                            />
                                        ))
                                    ) : (
                                        <Area
                                            type="linear"
                                            dataKey="value"
                                            name="評価額"
                                            stroke={category.color || "hsl(var(--primary))"}
                                            fill={category.color || "hsl(var(--primary))"}
                                            fillOpacity={0.1}
                                            strokeWidth={2}
                                            stackId="1"
                                        />
                                    )}
                                    {!category.isCash && (
                                        <Line
                                            type="linear"
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

            {/* Transaction History */}
            {/* Transaction History */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <History className="h-5 w-5" />
                        取引・評価履歴
                    </h2>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        {category.children && category.children.length > 0 && (
                            <Select value={historyFilter} onValueChange={setHistoryFilter}>
                                <SelectTrigger className="h-9 w-[140px] text-xs">
                                    <SelectValue placeholder="すべて表示" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">すべて表示</SelectItem>
                                    {category.children.map((child: any) => (
                                        <SelectItem key={child.id} value={child.id.toString()}>
                                            {child.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <Button onClick={() => {
                            setEditingItem(null)
                            setNewTrx({
                                date: new Date().toISOString().split('T')[0],
                                type: category.isCash ? "VALUATION" : "TRANSACTION",
                                amount: "",
                                valuation: "",
                                memo: ""
                            })
                            setIsTrxModalOpen(true)
                        }} size="sm" className="h-9">
                            <Plus className="h-4 w-4 mr-2" />
                            取引・評価を追加
                        </Button>
                    </div>
                </div>

                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px]">日付</TableHead>
                                <TableHead className="w-[100px]">種別</TableHead>
                                <TableHead className="text-right">収支額</TableHead>
                                <TableHead className="text-right">評価額</TableHead>
                                <TableHead className="hidden md:table-cell">備考</TableHead>
                                <TableHead className="text-right w-[100px]">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTransactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        履歴がありません
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTransactions.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-xs font-medium text-muted-foreground">
                                            <div>{new Date(item.date).toISOString().slice(0, 10)}</div>
                                            {item.categoryName && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.categoryColor || '#888' }} />
                                                    <span className="text-[10px] opacity-90 truncate max-w-[80px]">{item.categoryName}</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={(item.type === 'DEPOSIT' || item.type === 'WITHDRAW') ? 'default' : 'outline'}>
                                                {(item.type === 'DEPOSIT' || item.type === 'WITHDRAW') ? '入出金' : '評価更新'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${item.type === 'DEPOSIT' ? 'text-green-600' : item.type === 'WITHDRAW' ? 'text-red-600' : ''}`}>
                                            {item.amount !== 0 ? `¥${(item.type === 'WITHDRAW' ? -item.amount : item.amount).toLocaleString()}` : "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(item.pointInTimeValuation !== null && item.pointInTimeValuation !== undefined) ? `¥${item.pointInTimeValuation.toLocaleString()}` : "-"}
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
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>

            {/* Dialog for Transaction */}
            <Dialog open={isTrxModalOpen} onOpenChange={(open) => {
                setIsTrxModalOpen(open)
                if (!open) {
                    setEditingItem(null)
                    setBaseValuation(0);
                    setSaleAmount("");
                    setIsCalculateMode(false);
                } else if (!editingItem) {
                    setBaseValuation(category.currentValue);
                    setNewTrx({
                        date: new Date().toISOString().split('T')[0],
                        type: category.isCash ? "VALUATION" : "TRANSACTION",
                        amount: "",
                        valuation: category.currentValue.toString(),
                        memo: ""
                    });
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem ? "履歴を編集" : "履歴を追加"}</DialogTitle>
                        <DialogDescription>{editingItem ? "過去の記録を修正します。" : "入出金または評価額の更新を記録します。"}</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 bg-muted/40 p-3 rounded-md border text-sm mt-2">
                        <div>
                            <span className="text-muted-foreground text-[10px] block mb-0.5">現在の評価額</span>
                            <span className="font-mono font-bold">¥{category.currentValue.toLocaleString()}</span>
                        </div>
                        {!category.isCash && (
                            <div>
                                <span className="text-muted-foreground text-[10px] block mb-0.5">現在の取得原価</span>
                                <span className="font-mono font-bold">¥{category.costBasis.toLocaleString()}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-5 py-4">
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-semibold">日付</Label>
                            <Input
                                type="date"
                                value={newTrx.date}
                                onChange={(e) => setNewTrx({ ...newTrx, date: e.target.value })}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-semibold">種別</Label>
                            <Select
                                value={newTrx.type}
                                onValueChange={(val) => setNewTrx({ ...newTrx, type: val })}
                                disabled={category.isCash || !!editingItem}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TRANSACTION">入出金</SelectItem>
                                    <SelectItem value="VALUATION">評価額更新</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {newTrx.type === "TRANSACTION" && !category.isCash && (
                            <>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="calcMode"
                                        checked={isCalculateMode}
                                        onChange={(e) => {
                                            setIsCalculateMode(e.target.checked);
                                            if (!e.target.checked) setSaleAmount("");
                                        }}
                                        className="rounded border-gray-300"
                                    />
                                    <label htmlFor="calcMode" className="text-sm cursor-pointer select-none">
                                        売却額から元本減少分を自動計算
                                    </label>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Label className="text-xs font-semibold">
                                        {isCalculateMode ? "売却金額 (手取り)" : "取引金額 (マイナスで出金)"}
                                    </Label>
                                    {isCalculateMode ? (
                                        <Input
                                            type="number"
                                            placeholder="例: 100000"
                                            value={saleAmount}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSaleAmount(val);

                                                if (!val) {
                                                    setNewTrx({ ...newTrx, amount: "" });
                                                    return;
                                                }

                                                if (baseValuation <= 0) return;

                                                const ratio = Number(val) / baseValuation;
                                                const reduction = Math.floor(category.costBasis * ratio);

                                                setNewTrx({
                                                    ...newTrx,
                                                    amount: (-reduction).toString(),
                                                    valuation: Math.floor(baseValuation - Number(val)).toString()
                                                });
                                            }}
                                        />
                                    ) : (
                                        <Input
                                            type="number"
                                            value={newTrx.amount}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const numVal = Number(val);
                                                setNewTrx({
                                                    ...newTrx,
                                                    amount: val,
                                                    valuation: !isNaN(numVal) ? (baseValuation + numVal).toString() : newTrx.valuation
                                                });
                                            }}
                                        />
                                    )}
                                    <p className="text-[10px] text-muted-foreground">
                                        {isCalculateMode
                                            ? "※この金額は元本計算のみに使用され、履歴には『元本の減少分』が記録されます。"
                                            : "※この金額は「取得原価」の計算に利用されます。売却時は、売却額ではなく「元本の減少分」を入力するとグラフが正確になります。"}
                                    </p>
                                </div>
                            </>
                        )}

                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-semibold">取引後/更新後の評価額</Label>
                            <Input
                                type="number"
                                value={newTrx.valuation}
                                onChange={(e) => setNewTrx({ ...newTrx, valuation: e.target.value })}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-semibold">備考</Label>
                            <Input
                                value={newTrx.memo}
                                onChange={(e) => setNewTrx({ ...newTrx, memo: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTrxModalOpen(false)}>キャンセル</Button>
                        <Button onClick={handleAddTrx}>保存する</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
