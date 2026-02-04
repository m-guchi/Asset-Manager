"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, Banknote, Percent } from "lucide-react"

interface SummaryCardsProps {
    netWorth: number
    totalAssets: number
    totalLiabilities: number
    totalProfit: number
    profitPercent: number
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
        maximumFractionDigits: 0,
    }).format(value)
}

export function SummaryCards({
    netWorth,
    totalAssets,
    totalLiabilities,
    totalProfit,
    profitPercent,
}: SummaryCardsProps) {
    const isPositive = totalProfit >= 0

    return (
        <Card className="overflow-hidden border shadow-sm">
            <CardContent className="p-0">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {/* Evaluated Assets (Headline) */}
                    <div className="flex flex-col gap-1 p-3 md:p-6 border-r border-b md:border-b-0 border-border/50 transition-colors hover:bg-muted/30 col-span-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Wallet className="h-4 w-4" />
                            <span className="text-[10px] md:text-sm font-medium">評価資産</span>
                        </div>
                        <div className="text-base md:text-2xl font-bold tracking-tight truncate">
                            {formatCurrency(netWorth)} {/* The 'netWorth' prop now contains totalAssets */}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Gross Assets</div>
                    </div>

                    {/* Liability / Net Worth Breakdown */}
                    <div className="flex flex-col gap-1 p-3 md:p-5 border-b md:border-r md:border-b-0 border-border/50 transition-colors hover:bg-muted/30 col-span-1">
                        <div className="flex flex-col gap-1 pr-2">
                            <div className="flex justify-between items-baseline border-b border-border/30 pb-1">
                                <span className="text-[9px] text-muted-foreground font-medium uppercase">負債</span>
                                <span className="text-sm md:text-base font-bold text-red-500">¥{(totalLiabilities === 0 ? 0 : -totalLiabilities).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-baseline pt-1">
                                <span className="text-[9px] text-muted-foreground font-medium uppercase">純資産</span>
                                <span className="text-sm md:text-base font-bold text-primary">¥{(totalAssets - totalLiabilities).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="mt-auto text-[9px] text-muted-foreground uppercase tracking-wider pt-1">Balance</div>
                    </div>

                    {/* Profit/Loss */}
                    <div className="flex flex-col gap-1 p-4 md:p-6 border-r border-border/50 transition-colors hover:bg-muted/30 col-span-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <TrendingUp className={`h-4 w-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
                            <span className="text-xs md:text-sm font-medium">評価損益</span>
                        </div>
                        <div className={`text-lg md:text-2xl font-bold tracking-tight tabular-nums ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {isPositive ? '+' : ''}{formatCurrency(totalProfit)}
                        </div>
                        <div className="flex items-center gap-1">
                            {isPositive ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
                            <span className={`text-[10px] uppercase tracking-wider ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                {isPositive ? 'Profit' : 'Loss'}
                            </span>
                        </div>
                    </div>

                    {/* Profit Percent */}
                    <div className="flex flex-col gap-1 p-4 md:p-6 transition-colors hover:bg-muted/30 col-span-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Percent className="h-4 w-4" />
                            <span className="text-xs md:text-sm font-medium">損益率</span>
                        </div>
                        <div className={`text-lg md:text-2xl font-bold tracking-tight ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {isPositive ? '+' : ''}{profitPercent.toFixed(2)}%
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Performance</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
