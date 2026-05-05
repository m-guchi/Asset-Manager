"use client"

import * as React from "react"
import { SummaryCards } from "@/components/dashboard/summary-cards"
import { AssetChartsCombined } from "@/components/dashboard/asset-charts-combined"
import { CategoryList } from "@/components/dashboard/category-list"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Pencil, RefreshCw } from "lucide-react"
import { getCategories } from "@/app/actions/categories"
import { getTagGroups } from "@/app/actions/tags"
import { getHistoryData } from "@/app/actions/history"
import { Category, HistoryPoint, TagGroup } from "@/types/asset"

interface DashboardContentProps {
    initialCategories: Category[];
    initialHistory: HistoryPoint[];
    initialTagGroups: TagGroup[];
    defaultTimeRange: string;
}

export function DashboardContent({
    initialCategories,
    initialHistory,
    initialTagGroups,
    defaultTimeRange
}: DashboardContentProps) {
    const [categories, setCategories] = React.useState<Category[]>(initialCategories)
    const [historyData, setHistoryData] = React.useState<HistoryPoint[]>(initialHistory)
    const [tagGroups, setTagGroups] = React.useState<TagGroup[]>(initialTagGroups)
    const [isLoading, setIsLoading] = React.useState(false)

    const fetchData = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const [catData, histData, tagData] = await Promise.all([
                getCategories(),
                getHistoryData(),
                getTagGroups()
            ])
            setCategories(catData || [])
            setHistoryData(histData || [])
            setTagGroups(tagData || [])
        } catch (err) {
            console.error("Fetch error:", err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const topLevelCategories = categories.filter(c => !c.parentId)
    const totalAssets = topLevelCategories
        .reduce((acc, cat) => acc + cat.currentValue, 0)
    const totalCost = topLevelCategories
        .reduce((acc, cat) => acc + (cat.isCash ? cat.currentValue : cat.costBasis), 0)
    const totalProfit = totalAssets - totalCost
    const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

    return (
        <div className="flex flex-col gap-2 px-1 py-2 md:px-2 md:py-4">
            <section>
                <SummaryCards
                    netWorth={totalAssets}
                    totalAssets={totalAssets}
                    totalCost={totalCost}
                    totalProfit={totalProfit}
                    profitPercent={profitPercent}
                />
            </section>

            <section className="mb-2">
                <AssetChartsCombined
                    historyData={historyData}
                    categories={topLevelCategories}
                    allCategories={categories}
                    tagGroups={tagGroups}
                    initialTimeRange={defaultTimeRange}
                />
            </section>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold tracking-tight">アセット構成</h2>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={fetchData} title="データを更新">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Link href="/assets/valuation">
                            <Button variant="outline" size="sm">
                                <Pencil className="mr-2 h-4 w-4" /> 評価額を一括更新
                            </Button>
                        </Link>
                    </div>
                </div>
                <CategoryList categories={categories} />
            </section>
        </div>
    )
}
