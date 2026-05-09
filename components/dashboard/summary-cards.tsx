"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, Wallet } from "lucide-react"

interface SummaryCardsProps {
    netWorth: number
    realizedProfit: number
    totalProfit: number
    totalProfitRate: number
    dailyChange: number
    monthlyChange: number
}

const formatAmount = (value: number) => {
    return new Intl.NumberFormat("ja-JP", {
        maximumFractionDigits: 0,
    }).format(Math.round(value))
}

const formatSigned = (value: number, withPlus = true) => {
    if (value === 0) return "±0"
    const sign = withPlus && value > 0 ? "+" : ""
    return `${sign}${formatAmount(value)}`
}

const AmountYen = ({ value, positiveAsGain = false, withPlus = true }: { value: number, positiveAsGain?: boolean, withPlus?: boolean }) => {
    const colorClass = positiveAsGain
        ? (value >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500")
        : "text-foreground"

    return (
        <div className={`flex items-baseline gap-0.5 ${colorClass}`}>
            <span className="text-base md:text-2xl font-bold tracking-tight tabular-nums">{formatSigned(value, withPlus)}</span>
            <span className="text-[10px] md:text-xs opacity-75">円</span>
        </div>
    )
}

export function SummaryCards({
    netWorth,
    realizedProfit,
    totalProfit,
    totalProfitRate,
    dailyChange,
    monthlyChange,
}: SummaryCardsProps) {
    const cardBase = "flex flex-col gap-1 p-3 md:p-6 border-r border-b md:border-b-0 border-border/50 transition-colors hover:bg-muted/30 col-span-1"

    return (
        <Card className="overflow-hidden border shadow-sm">
            <CardContent className="p-0">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className={cardBase}>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Wallet className="h-4 w-4" />
                            <span className="text-[10px] md:text-sm font-medium">資産評価額</span>
                        </div>
                        <AmountYen value={netWorth} withPlus={false} />
                    </div>

                    <div className={cardBase}>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <TrendingUp className={`h-4 w-4 ${realizedProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`} />
                            <span className="text-[10px] md:text-sm font-medium">実現損益</span>
                        </div>
                        <AmountYen value={realizedProfit} positiveAsGain />
                    </div>

                    <div className={cardBase}>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <TrendingUp className={`h-4 w-4 ${totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`} />
                            <span className="text-[10px] md:text-sm font-medium">評価損益</span>
                        </div>
                        <AmountYen value={totalProfit} positiveAsGain />
                        <div className={`text-[10px] md:text-xs font-medium ${totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                            {totalProfitRate > 0 ? "+" : totalProfitRate < 0 ? "" : "±"}{Math.abs(totalProfitRate).toFixed(1)}%
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 p-3 md:p-6 border-b md:border-b-0 border-border/50 transition-colors hover:bg-muted/30 col-span-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-[10px] md:text-sm font-medium">損益額推移</span>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-baseline gap-1">
                                <span className="text-[10px] md:text-xs text-muted-foreground">1日前比</span>
                                <span className={`text-sm md:text-lg font-bold tabular-nums ${dailyChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                    {formatSigned(dailyChange)}
                                </span>
                                <span className="text-[9px] md:text-[10px] text-muted-foreground">円</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-[10px] md:text-xs text-muted-foreground">30日前比</span>
                                <span className={`text-sm md:text-lg font-bold tabular-nums ${monthlyChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                    {formatSigned(monthlyChange)}
                                </span>
                                <span className="text-[9px] md:text-[10px] text-muted-foreground">円</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
