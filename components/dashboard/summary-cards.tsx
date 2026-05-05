"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, Wallet } from "lucide-react"

interface SummaryCardsProps {
    netWorth: number
    totalProfit: number
    profitPercent: number
    dailyChange: number
    dailyChangeRate: number
    monthlyChange: number
    monthlyChangeRate: number
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
        maximumFractionDigits: 0,
    }).format(value)
}

const PerformanceValue = ({ amount, rate, label }: { amount: number, rate: number, label: string }) => {
    const isPositive = amount >= 0
    const colorClass = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'
    
    return (
        <div className="flex flex-col gap-1 p-3 md:p-6 border-r border-border/50 transition-colors hover:bg-muted/30">
            <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className={`h-4 w-4 ${colorClass}`} />
                <span className="text-[10px] md:text-sm font-medium">{label}</span>
            </div>
            <div className={`text-sm md:text-xl font-bold tracking-tight tabular-nums ${colorClass}`}>
                {isPositive ? '+' : ''}{formatCurrency(amount)}
            </div>
            <div className={`text-[10px] md:text-xs font-medium ${colorClass}`}>
                {isPositive ? '+' : ''}{rate.toFixed(2)}%
            </div>
        </div>
    )
}

export function SummaryCards({
    netWorth,
    totalProfit,
    profitPercent,
    dailyChange,
    dailyChangeRate,
    monthlyChange,
    monthlyChangeRate,
}: SummaryCardsProps) {
    const isTotalPositive = totalProfit >= 0

    return (
        <Card className="overflow-hidden border shadow-sm">
            <CardContent className="p-0">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {/* 1. Evaluated Assets */}
                    <div className="flex flex-col gap-1 p-3 md:p-6 border-r border-b md:border-b-0 border-border/50 transition-colors hover:bg-muted/30 col-span-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Wallet className="h-4 w-4" />
                            <span className="text-[10px] md:text-sm font-medium">評価資産</span>
                        </div>
                        <div className="text-base md:text-2xl font-bold tracking-tight truncate">
                            {formatCurrency(netWorth)}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Net Worth</div>
                    </div>

                    {/* 2. Total Profit/Loss */}
                    <div className="flex flex-col gap-1 p-3 md:p-6 border-r border-b md:border-b-0 border-border/50 transition-colors hover:bg-muted/30 col-span-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <TrendingUp className={`h-4 w-4 ${isTotalPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`} />
                            <span className="text-[10px] md:text-sm font-medium">通算損益</span>
                        </div>
                        <div className={`text-base md:text-2xl font-bold tracking-tight tabular-nums ${isTotalPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            {isTotalPositive ? '+' : ''}{formatCurrency(totalProfit)}
                        </div>
                        <div className={`text-[10px] md:text-xs font-medium ${isTotalPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            {isTotalPositive ? '+' : ''}{profitPercent.toFixed(2)}%
                        </div>
                    </div>

                    {/* 3. Daily Performance */}
                    <PerformanceValue 
                        amount={dailyChange} 
                        rate={dailyChangeRate} 
                        label="1日前比" 
                    />

                    {/* 4. Monthly Performance */}
                    <PerformanceValue 
                        amount={monthlyChange} 
                        rate={monthlyChangeRate} 
                        label="30日前比" 
                    />
                </div>
            </CardContent>
        </Card>
    )
}
