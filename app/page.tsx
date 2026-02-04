"use client"

import * as React from "react"
import { SummaryCards } from "@/components/dashboard/summary-cards"
import { AssetAllocationChart } from "@/components/dashboard/asset-allocation-chart"
import { AssetHistoryChart } from "@/components/dashboard/asset-history-chart"
import { CategoryList } from "@/components/dashboard/category-list"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Pencil, RefreshCw } from "lucide-react"
import { getCategories } from "./actions/categories"
import { getTagGroups } from "./actions/tags"
import { getHistoryData } from "./actions/history"
import { toast } from "sonner"

interface Category {
    id: number
    name: string
    currentValue: number
    costBasis: number
    ownValue: number
    ownCostBasis: number
    color: string
    order: number
    isCash?: boolean
    isLiability?: boolean
    tags: string[]
    conflicts?: string[]
    parentId?: number | null
}

export default function Page() {
    const [categories, setCategories] = React.useState<Category[]>([])
    const [historyData, setHistoryData] = React.useState<any[]>([])
    const [tagGroups, setTagGroups] = React.useState<any[]>([])
    const [isLoading, setIsLoading] = React.useState(true)

    const fetchData = React.useCallback(async () => {
        setIsLoading(true)
        try {
            console.log("Fetching dashboard data...");
            const [catData, histData, tagData] = await Promise.all([
                getCategories().catch(e => { console.error("getCategories error:", e); return []; }),
                getHistoryData().catch(e => { console.error("getHistoryData error:", e); return []; }),
                getTagGroups().catch(e => { console.error("getTagGroups error:", e); return []; })
            ])

            console.log("Fetched categories count:", catData?.length);
            setCategories(catData || [])
            setHistoryData(histData || [])
            setTagGroups(tagData || [])
        } catch (err) {
            console.error("Critical Fetch error:", err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    React.useEffect(() => {
        fetchData()
    }, [fetchData])

    const topLevelCategories = categories.filter(c => !c.parentId)

    const totalAssets = topLevelCategories
        .filter(c => !c.isLiability)
        .reduce((acc, cat) => acc + cat.currentValue, 0)

    const totalLiabilities = topLevelCategories
        .filter(c => c.isLiability)
        .reduce((acc, cat) => acc + cat.currentValue, 0)

    const netWorth = totalAssets - totalLiabilities

    const totalCost = topLevelCategories
        .filter(c => !c.isLiability)
        .reduce((acc, cat) => {
            return acc + (cat.isCash ? cat.currentValue : cat.costBasis)
        }, 0)

    const totalProfit = totalAssets - totalCost
    const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">データを読み込み中...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2 p-2 md:p-4">
            {/* Database Setup Alert (Visible if no categories found) */}
            {/* 1. Summary Cards */}
            {/* 1. Summary Cards */}
            <section>
                <SummaryCards
                    netWorth={totalAssets} // Passing Gross Assets as the headline per request
                    totalAssets={totalAssets}
                    totalLiabilities={totalLiabilities}
                    totalProfit={totalProfit}
                    profitPercent={profitPercent}
                />
            </section>





            {/* 2. Charts Section */}
            <section className="grid gap-2 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-full md:col-span-1 lg:col-span-4 min-w-0">
                    <AssetHistoryChart data={historyData} tagGroups={tagGroups} />
                </div>
                <div className="col-span-full md:col-span-1 lg:col-span-3 min-w-0">
                    <AssetAllocationChart categories={topLevelCategories} allCategories={categories} tagGroups={tagGroups} />
                </div>
            </section>

            {/* 3. Category List */}
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
