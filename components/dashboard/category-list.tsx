"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { AlertCircle } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface Category {
    id: number
    name: string
    currentValue: number // aggregated
    costBasis: number // aggregated
    ownValue: number
    ownCostBasis: number
    color: string
    order: number
    parentId?: number | null
    isCash?: boolean
    isLiability?: boolean
    conflicts?: string[]
}

export function CategoryList({ categories = [] }: { categories?: Category[] }) {
    if (categories.length === 0) return null

    // Separate parents and children
    const topLevel = categories.filter(c => !c.parentId)

    const renderCategoryCard = (category: Category, isChild = false) => {
        const valueToUse = isChild ? category.ownValue : category.currentValue
        const costToUse = category.isCash ? valueToUse : (isChild ? category.ownCostBasis : category.costBasis)
        const profit = valueToUse - costToUse
        const profitPercent = costToUse > 0 ? (profit / costToUse) * 100 : 0
        const isPositive = profit >= 0

        return (
            <Link href={`/assets/${category.id}`} key={category.id} className="block w-full">
                <Card className={`overflow-hidden h-full cursor-pointer hover:shadow-md transition-all border-l-0 relative group ${isChild ? 'bg-muted/30Scale text-sm' : ''}`}>
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover:w-2" style={{ backgroundColor: category.color }} />
                    <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-0.5 pl-3 pt-2 ${isChild ? 'pb-0' : ''}`}>
                        <CardTitle className={`${isChild ? 'text-[10px]' : 'text-xs'} font-medium flex items-center gap-2 text-muted-foreground/80`}>
                            {category.name}
                            {category.isLiability && <Badge variant="destructive" className="text-[8px] py-0 h-3.5">負債</Badge>}
                        </CardTitle>
                        {!isChild && category.conflicts && category.conflicts.length > 0 && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertCircle className="h-3 w-3 text-destructive animate-pulse" />
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-destructive text-destructive-foreground border-none">
                                        <p className="font-bold text-xs">タグ重複の警告</p>
                                        <p className="text-[10px]">グループ({category.conflicts.join(", ")})内で重複があります</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </CardHeader>
                    <CardContent className={`pl-3 pr-3 ${isChild ? 'pb-1.5' : 'pb-2'}`}>
                        <div className="flex items-baseline justify-between gap-2">
                            <span className={`text-base font-bold tracking-tight ${category.isLiability ? "text-red-500" : ""}`}>
                                {category.isLiability ? "-" : ""}¥{valueToUse.toLocaleString()}
                            </span>

                            <span className={`text-xs font-bold whitespace-nowrap ${category.isCash ? "text-muted-foreground" : (isPositive ? "text-green-500" : "text-red-500")}`}>
                                {category.isCash ? '±0' : (
                                    <>
                                        {isPositive ? '+' : ''}¥{profit.toLocaleString()}
                                        <span className="text-[9px] ml-1 opacity-70 font-normal">
                                            ({isPositive ? '+' : ''}{profitPercent.toFixed(1)}%)
                                        </span>
                                    </>
                                )}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </Link>
        )
    }

    return (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {topLevel.map((parent) => {
                const children = categories.filter(c => c.parentId === parent.id)
                return (
                    <div key={parent.id} className="flex flex-col gap-1 p-2 rounded-lg border bg-card/50 shadow-sm">
                        {renderCategoryCard(parent)}
                        {children.length > 0 && (
                            <div className="flex flex-col gap-1 ml-3 pl-2 border-l-2 border-muted border-dashed mt-0.5 pb-0.5">
                                {children.map(child => renderCategoryCard(child, true))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
