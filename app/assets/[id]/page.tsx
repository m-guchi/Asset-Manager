"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Plus, History, RefreshCw, Edit2, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react"

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
    CartesianGrid,
    XAxis,
    YAxis,
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

interface TransactionItem {
    id: string;
    date: string | Date;
    type: string;
    amount: number;
    pointInTimeValuation: number | null;
    memo: string | null;
    realizedGain?: number | null;
    categoryName?: string;
    categoryColor?: string;
    profitRatio?: number | null;
    categoryId?: number;
}

interface CategoryDetail {
    id: number;
    name: string;
    color: string;
    currentValue: number;
    costBasis: number;
    isCash: boolean | null;
    isLiability: boolean | null;
    parent: { id: number; name: string } | null;
    children: { id: number; name: string; color: string; currentValue: number; isLiability: boolean | null }[];
    transactions: TransactionItem[];
    history: Record<string, string | number>[];
}

export default function AssetDetailPage() {
    const params = useParams()
    const id = Number((params as { id: string }).id)

    const [category, setCategory] = React.useState<CategoryDetail | null>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const [timeRange, setTimeRange] = React.useState("1Y")
    const [historyFilter, setHistoryFilter] = React.useState<string>("ALL")
    const [isTrxModalOpen, setIsTrxModalOpen] = React.useState(false)
    const [editingItem, setEditingItem] = React.useState<TransactionItem | null>(null)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
    const [deletingItemId, setDeletingItemId] = React.useState<string | null>(null)

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
        return category.transactions.filter((t: TransactionItem) => t.categoryName === historyFilter)
    }, [category, historyFilter])

    const [newTrx, setNewTrx] = React.useState({
        date: new Date().toISOString().split('T')[0],
        type: "VALUATION",
        amount: "",
        valuation: "",
        memo: "",
        realizedGain: undefined as number | null | undefined
    })
    const [saleAmount, setSaleAmount] = React.useState("")
    const [baseValuation, setBaseValuation] = React.useState(0)

    // Update default values when category loads or edit starts
    React.useEffect(() => {
        if (category && !editingItem) {
            setNewTrx(prev => ({
                ...prev,
                type: category.isCash ? "VALUATION" : "DEPOSIT",
                valuation: category.currentValue.toString(),
                realizedGain: undefined
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
            const [typeStr, itemId] = editingItem.id.split('-')
            const itemType = typeStr === 'tx' ? 'tx' : 'as'
            res = await updateHistoryItem(itemType, Number(itemId), newTrx)
        } else {
            if (newTrx.type === 'VALUATION') {
                res = await updateValuation(id, Number(newTrx.valuation), new Date(newTrx.date))
            } else {
                const amt = Number(newTrx.amount) || 0
                res = await addTransaction(id, {
                    type: (newTrx.type === 'DEPOSIT' || newTrx.type === 'WITHDRAW') ? newTrx.type : (amt >= 0 ? "DEPOSIT" : "WITHDRAW"),
                    amount: Math.abs(amt),
                    valuation: newTrx.valuation ? Number(newTrx.valuation) : undefined,
                    realizedGain: (newTrx.type === "WITHDRAW" || (newTrx.type === "TRANSACTION" && amt < 0)) ? newTrx.realizedGain : undefined,
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

    const handleDelete = (itemIdStr: string) => {
        setDeletingItemId(itemIdStr)
        setIsDeleteModalOpen(true)
    }

    const confirmDelete = async () => {
        if (!deletingItemId) return

        const [typeStr, itemId] = deletingItemId.split('-')
        const itemType = typeStr === 'tx' ? 'tx' : 'as'
        const res = await deleteHistoryItem(itemType, Number(itemId))

        if (res.success) {
            toast.success("削除しました")
            fetchData()
        } else {
            toast.error("削除に失敗しました")
        }
        setIsDeleteModalOpen(false)
        setDeletingItemId(null)
    }

    const openEdit = (item: TransactionItem) => {
        setEditingItem(item)
        // Calculate base valuation (valuation BEFORE this transaction)
        const signedAmount = item.type === 'WITHDRAW' ? -Math.abs(item.amount || 0) : Math.abs(item.amount || 0);
        const currentVal = item.pointInTimeValuation || 0;
        setBaseValuation(currentVal - signedAmount);

        setNewTrx({
            date: new Date(item.date).toISOString().split('T')[0],
            type: item.type,
            amount: Math.abs(item.amount || 0).toString(), // Always set amount as positive for editing
            valuation: item.pointInTimeValuation?.toString() || "",
            memo: item.memo || "",
            realizedGain: item.realizedGain
        })

        if (item.realizedGain !== undefined && item.realizedGain !== null) {
            const saleVal = Math.abs(item.amount) + item.realizedGain
            setSaleAmount(saleVal.toString())
        } else {
            setSaleAmount("")
        }
        setIsTrxModalOpen(true)
    }

    const handleSaleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSaleAmount(val);

        if (!val || isNaN(Number(val))) {
            setNewTrx(prev => ({ ...prev, amount: "", realizedGain: undefined }));
            return;
        }

        const saleNum = Number(val);
        if (baseValuation <= 0) { // Should not happen if category.currentValue is used for new transactions
            setNewTrx(prev => ({ ...prev, amount: "", realizedGain: undefined }));
            return;
        }

        // Calculate ratio based on baseValuation (valuation before this transaction)
        if (!category) return;
        const ratio = saleNum / baseValuation;
        const reduction = Math.floor(category.costBasis * ratio);
        const realized = saleNum - reduction;

        setNewTrx(prev => ({
            ...prev,
            amount: reduction.toString(), // 元本減少分は正の値
            realizedGain: realized,
            valuation: (baseValuation - saleNum).toString()
        }));
    };

    if (isLoading && !category) {
        return <div className="p-8 text-center"><RefreshCw className="animate-spin inline mr-2" />読み込み中...</div>
    }

    if (!category) {
        return <div className="p-8 text-center text-muted-foreground">資産が見つかりません</div>
    }

    const profit = (category?.currentValue ?? 0) - (category?.costBasis ?? 0)
    const profitPercent = (category?.costBasis ?? 0) > 0 ? (profit / (category?.costBasis ?? 1)) * 100 : 0
    const isPositive = profit >= 0

    const totalRealizedGain = (category?.transactions || []).reduce((sum: number, tx) => sum + Number(tx.realizedGain || 0), 0);
    const isRealizedPositive = totalRealizedGain >= 0;

    const totalDeposit = (category?.transactions || []).filter((tx) => tx.type === 'DEPOSIT').reduce((sum: number, tx) => sum + Math.abs(Number(tx.amount)), 0);
    const totalWithdrawal = (category?.transactions || []).filter((tx) => tx.type === 'WITHDRAW').reduce((sum: number, tx) => sum + Math.abs(Number(tx.amount)), 0);



    return (
        <div className="flex flex-col gap-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={category?.parent ? `/assets/${category.parent.id}` : "/"} className="p-2 -ml-2 hover:bg-muted/50 rounded-full transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        {category?.parent && (
                            <Link href={`/assets/${category.parent.id}`} className="text-xs text-muted-foreground hover:underline">
                                {category.parent.name} /
                            </Link>
                        )}
                        <h1 className="text-xl font-bold">{category?.name}</h1>
                    </div>
                </div>
            </div>

            {/* Main Stats */}
            <div className={`grid grid-cols-1 ${category.isCash ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-4`}>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">評価額</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ¥{((category?.isLiability ? -1 : 1) * (category?.currentValue || 0)).toLocaleString()}
                        </div>
                        {!category?.isCash && (
                            <div className={`text-sm mt-1 flex items-center gap-2 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                {isPositive ? '+' : '-'}¥{Math.abs(profit).toLocaleString()}
                                <span className="text-xs bg-muted/20 px-1.5 py-0.5 rounded text-muted-foreground">
                                    {(category?.costBasis || 0) > 0 ? `${isPositive ? '+' : ''}${profitPercent.toFixed(1)}%` : '-'}
                                </span>
                            </div>
                        )}
                        {/* Child Asset Breakdown */}
                        {category?.children && category.children.length > 0 && (
                            <div className="mt-4 pt-4 border-t space-y-2">
                                <div className="text-xs text-muted-foreground mb-2">内訳</div>
                                {category.children.map((child: CategoryDetail['children'][0]) => (
                                    <Link key={child.id} href={`/assets/${child.id}`} className="flex items-center justify-between text-sm group hover:bg-muted/50 p-1 rounded -mx-1 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: child.color }} />
                                            <span className="group-hover:underline">{child.name}</span>
                                        </div>
                                        <span className="font-mono">¥{((category?.isLiability || child.isLiability ? -1 : 1) * child.currentValue).toLocaleString()}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                {!category.isCash && (
                    <>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">取得原価</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-muted-foreground">¥{(category?.costBasis || 0).toLocaleString()}</div>
                                <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-dashed">
                                    <div className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                            <div className="bg-green-100 dark:bg-green-900/30 p-1 rounded-full text-green-600 dark:text-green-400">
                                                <ArrowDownRight className="h-3 w-3" />
                                            </div>
                                            <span>総入金額</span>
                                        </div>
                                        <span className="font-mono font-medium">¥{totalDeposit.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                            <div className="bg-red-100 dark:bg-red-900/30 p-1 rounded-full text-red-600 dark:text-red-400">
                                                <ArrowUpRight className="h-3 w-3" />
                                            </div>
                                            <span>総出金額</span>
                                        </div>
                                        <span className="font-mono font-medium">¥{totalWithdrawal.toLocaleString()}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">累計実現損益</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${isRealizedPositive ? 'text-green-600' : 'text-red-500'}`}>
                                    {isRealizedPositive ? '+' : '-'}¥{Math.abs(totalRealizedGain).toLocaleString()}
                                </div>
                                <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-dashed">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground">売却受取額</span>
                                        <span className="font-mono font-medium">¥{(totalWithdrawal + totalRealizedGain).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground">元本減少額</span>
                                        <span className="font-mono font-medium text-muted-foreground">-¥{totalWithdrawal.toLocaleString()}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Chart Section */}
            < Card >
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
                                    const c: Record<string, { label: string; color: string }> = {
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
                                        category.children.forEach((child) => {
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

                                        cutoff.setHours(0, 0, 0, 0)

                                        if (timeRange === "1M") cutoff.setMonth(now.getMonth() - 1)
                                        else if (timeRange === "3M") cutoff.setMonth(now.getMonth() - 3)
                                        else if (timeRange === "1Y") cutoff.setFullYear(now.getFullYear() - 1)
                                        else isAll = true

                                        const multiplier = category.isLiability ? -1 : 1;

                                        interface HistoryRecord {
                                            date: number;
                                            value: number;
                                            cost: number;
                                            [key: string]: number;
                                        }

                                        const allData: HistoryRecord[] = category.history.map((h) => {
                                            const hRecord = h as Record<string, string | number>;
                                            const point: HistoryRecord = {
                                                date: new Date(hRecord.date).getTime(),
                                                value: Number(hRecord.value || 0) * multiplier,
                                                cost: Number(hRecord.cost || 0) * multiplier
                                            }
                                            Object.keys(hRecord).forEach(k => {
                                                if (k.startsWith('child_')) {
                                                    point[k] = Number(hRecord[k] || 0) * multiplier;
                                                }
                                            });
                                            return point;
                                        })

                                        if (isAll) return allData

                                        const cutoffTime = cutoff.getTime()
                                        const filtered = allData.filter((h) => h.date >= cutoffTime)

                                        const beforeCutoff = allData.slice().reverse().find((h) => h.date < cutoffTime)

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
                                                formatter={(value, name, item) => (
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
                                        category.children.map((child) => (
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
                                                isAnimationActive={false}
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
                                            isAnimationActive={false}
                                        />
                                    )}
                                    {!category.isCash && (
                                        <Line
                                            type="stepAfter"
                                            dataKey="cost"
                                            name="取得原価"
                                            stroke="#888888"
                                            strokeWidth={2}
                                            strokeDasharray="4 4"
                                            dot={false}
                                            isAnimationActive={false}
                                            connectNulls
                                        />
                                    )}
                                </ComposedChart>
                            </ChartContainer>
                        )}
                    </div>
                </CardContent>
            </Card >

            {/* Transaction History */}
            {/* Transaction History */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <History className="h-5 w-5" />
                        取引・評価履歴
                    </h2>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        {category?.children && category.children.length > 0 && (
                            <Select value={historyFilter} onValueChange={setHistoryFilter}>
                                <SelectTrigger className="h-9 w-[140px] text-xs">
                                    <SelectValue placeholder="すべて表示" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">すべて表示</SelectItem>
                                    {category.children.map((child) => (
                                        <SelectItem key={child.id} value={child.id.toString()}>
                                            {child.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <Button onClick={() => {
                            setEditingItem(null)
                            setBaseValuation(category.currentValue)
                            setNewTrx({
                                date: new Date().toISOString().split('T')[0],
                                type: category.isCash ? "VALUATION" : "DEPOSIT",
                                amount: "",
                                valuation: category.currentValue.toString(),
                                memo: "",
                                realizedGain: undefined
                            })
                            setSaleAmount("")
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
                                filteredTransactions.map((item) => (
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
                                            <div className="flex flex-col items-end">
                                                <span>{(item.pointInTimeValuation !== null && item.pointInTimeValuation !== undefined) ? `¥${item.pointInTimeValuation.toLocaleString()}` : "-"}</span>
                                                {item.profitRatio !== undefined && item.profitRatio !== null && !category?.isCash && (
                                                    <span className={`text-xs ${item.profitRatio >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {item.profitRatio >= 0 ? '+' : ''}{item.profitRatio.toFixed(1)}%
                                                    </span>
                                                )}
                                            </div>
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
                } else if (!editingItem) {
                    setBaseValuation(category.currentValue);
                    setNewTrx({
                        date: new Date().toISOString().split('T')[0],
                        type: category.isCash ? "VALUATION" : "DEPOSIT",
                        amount: "",
                        valuation: category.currentValue.toString(),
                        memo: "",
                        realizedGain: undefined
                    });
                }
            }}>
                <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
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
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setNewTrx(prev => ({
                                        ...prev,
                                        date: val,
                                        valuation: editingItem ? "" : prev.valuation
                                    }));
                                }}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-semibold">種別</Label>
                            <Select
                                value={newTrx.type}
                                onValueChange={(val) => {
                                    setNewTrx({
                                        ...newTrx,
                                        type: val,
                                        amount: "",
                                        realizedGain: undefined,
                                        valuation: baseValuation.toString()
                                    })
                                    setSaleAmount("")
                                }}
                                disabled={category.isCash || !!editingItem}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DEPOSIT">入金・投資</SelectItem>
                                    <SelectItem value="WITHDRAW">売却・出金</SelectItem>
                                    <SelectItem value="VALUATION">評価額更新</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Sale Amount Input for Withdrawal */}
                        {newTrx.type === "WITHDRAW" && !category.isCash && (
                            <div className="flex flex-col gap-2 mb-4">
                                <Label className="text-xs font-semibold">売却金額 (手取り)</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        placeholder="いくらで売れましたか？"
                                        value={saleAmount}
                                        onChange={handleSaleAmountChange}
                                        className="font-mono"
                                    />
                                    <span className="text-sm font-medium">円</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                                    <span>現在評価額に対する割合:</span>
                                    <span className="font-mono">
                                        {saleAmount && !isNaN(Number(saleAmount))
                                            ? `${((Number(saleAmount) / (category.currentValue || 1)) * 100).toFixed(1)}%`
                                            : "-"}
                                    </span>
                                </div>
                            </div>
                        )}

                        {(newTrx.type === "DEPOSIT" || newTrx.type === "WITHDRAW") && !category.isCash && (
                            <>
                                <div className={`flex flex-col gap-2 ${newTrx.type === "WITHDRAW" ? "p-3 bg-muted/50 rounded-md border border-dashed" : ""}`}>
                                    <Label className="text-xs font-semibold">
                                        {newTrx.type === "WITHDRAW" ? "元本減少分 (自動計算可)" : "金額"}
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            placeholder="金額"
                                            value={newTrx.amount}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const numVal = Number(val);

                                                let updatedRealizedGain = newTrx.realizedGain;
                                                if (newTrx.type === "WITHDRAW" && saleAmount !== "" && !isNaN(numVal)) {
                                                    updatedRealizedGain = Number(saleAmount) - numVal;
                                                }

                                                setNewTrx({
                                                    ...newTrx,
                                                    amount: val,
                                                    realizedGain: updatedRealizedGain,
                                                    valuation: !isNaN(numVal) && newTrx.type === "DEPOSIT"
                                                        ? (baseValuation + numVal).toString()
                                                        : (!isNaN(numVal) && newTrx.type === "WITHDRAW" // 出金の場合はvaluationを減らす
                                                            ? (baseValuation - Number(saleAmount || 0)).toString() // 売却額分減るのが自然？それとも元本分？通常は売却額分資産価値が減る（現金化される）
                                                            : newTrx.valuation)
                                                });
                                            }}
                                        />
                                        <span className="text-sm font-medium">円</span>
                                    </div>
                                    {newTrx.type === "WITHDRAW" && (
                                        <p className="text-[10px] text-muted-foreground">
                                            ※売却金額を入力すると自動計算されますが、必要に応じて修正してください。
                                        </p>
                                    )}
                                </div>

                                {/* Realized Gain Display/Input */}
                                {newTrx.type === "WITHDRAW" && (
                                    <div className="flex flex-col gap-2 p-2 rounded bg-slate-50 dark:bg-slate-900 border">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium">実現損益</span>
                                            <span className={`font-mono font-bold ${(newTrx.realizedGain || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {(newTrx.realizedGain || 0) >= 0 ? '+' : ''}{Number(newTrx.realizedGain || 0).toLocaleString()} 円
                                            </span>
                                        </div>
                                    </div>
                                )}
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

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>記録の削除</DialogTitle>
                        <DialogDescription>
                            この記録を削除してもよろしいですか？この操作は取り消せません。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>キャンセル</Button>
                        <Button variant="destructive" onClick={confirmDelete}>削除する</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
