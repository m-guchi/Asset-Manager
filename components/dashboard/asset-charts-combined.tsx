"use client"

import * as React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { HistoryPoint, Category, TagGroup } from "@/types/asset"
import { AssetHistoryChart } from "@/components/dashboard/asset-history-chart"
import { AssetAllocationChart } from "@/components/dashboard/asset-allocation-chart"

interface AssetChartsCombinedProps {
    historyData: HistoryPoint[];
    categories: Category[];
    allCategories?: Category[];
    tagGroups: TagGroup[];
    initialTimeRange: string;
}

export function AssetChartsCombined({
    historyData,
    categories,
    allCategories = [],
    tagGroups,
    initialTimeRange
}: AssetChartsCombinedProps) {
    const [mode, setMode] = React.useState<"total" | "tag">("total")
    const [selectedTagGroup, setSelectedTagGroup] = React.useState<number>(1)
    const [activePoint, setActivePoint] = React.useState<HistoryPoint | null>(null)

    React.useEffect(() => {
        if (tagGroups && tagGroups.length > 0) {
            const exists = tagGroups.find(g => g.id === selectedTagGroup)
            if (!exists) setSelectedTagGroup(tagGroups[0].id)
        }
    }, [tagGroups, selectedTagGroup])

    const activeKeys = React.useMemo(() => {
        if (mode === "tag") {
            const grp = tagGroups.find(g => g.id === selectedTagGroup)
            const keys = grp?.options?.map(o => o.name) || grp?.tags || []
            return Array.from(new Set(keys.map(k => String(k).trim())))
        }
        return []
    }, [mode, selectedTagGroup, tagGroups])

    return (
        <Card className="flex flex-col overflow-hidden">
            <CardHeader className="items-center pb-1 pt-3 border-b">
                <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
                    <div className="flex bg-muted/50 rounded-md p-0.5 border">
                        <button
                            onClick={() => setMode("total")}
                            className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all whitespace-nowrap ${mode === "total"
                                ? "bg-background text-foreground shadow-sm font-bold"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        >
                            全体
                        </button>
                        {tagGroups && tagGroups.map(grp => (
                            <button
                                key={grp.id}
                                onClick={() => {
                                    setMode("tag");
                                    setSelectedTagGroup(grp.id);
                                }}
                                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all whitespace-nowrap ${mode === "tag" && selectedTagGroup === grp.id
                                    ? "bg-background text-foreground shadow-sm font-bold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                            >
                                {grp.name}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>

            {/* 各項目の数値（共通バー） */}
            <div className="px-4 py-2 border-b border-border/40 bg-muted/10 min-h-[44px] flex items-center shrink-0 w-full m-0">
                {!activePoint ? (
                    <div className="w-full text-center">
                        <span className="text-[10px] text-muted-foreground animate-pulse font-medium">
                            グラフ情報を計算中...
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full">
                        {mode === "total" ? (
                            <>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-totalAssets)" }} />
                                    <span className="text-[9px] text-muted-foreground font-bold">評価額</span>
                                    <span className="text-[11px] font-bold">¥{Math.round(activePoint.totalAssets || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 pl-1">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#888888" }} />
                                    <span className="text-[9px] text-muted-foreground font-bold">取得原価</span>
                                    <span className="text-[11px] font-bold text-[#888888]">¥{Math.round(activePoint.totalCost || 0).toLocaleString()}</span>
                                </div>
                            </>
                        ) : (
                            activeKeys.map((key, i) => {
                                const k = `tag_${selectedTagGroup}_${key}`
                                const val = (activePoint as any)[k] || 0
                                if (val === 0) return null
                                const color = `var(--chart-${(i % 5) + 1})`
                                return (
                                    <div key={key} className="flex items-center gap-1.5 shrink-0">
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                        <span className="text-[9px] text-muted-foreground font-bold">{key}</span>
                                        <span className="text-[11px] font-bold">
                                            ¥{Math.round(Number(val)).toLocaleString()}
                                        </span>
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}
            </div>

            <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-1 lg:col-span-4 min-w-0 flex flex-col relative w-full h-full">
                    <AssetHistoryChart 
                        data={historyData} 
                        tagGroups={tagGroups} 
                        initialTimeRange={initialTimeRange} 
                        mode={mode} 
                        selectedTagGroup={selectedTagGroup}
                        onActivePointChange={setActivePoint}
                    />
                </div>
                {/* 境界線を1本にする：PC時は左ボーダー、スマホ時は上ボーダー */}
                <div className="col-span-1 md:col-span-1 lg:col-span-3 min-w-0 flex flex-col pt-2 pb-2 relative lg:border-l lg:border-t-0 border-t w-full h-full">
                    <AssetAllocationChart 
                        categories={categories} 
                        allCategories={allCategories} 
                        tagGroups={tagGroups} 
                        mode={mode} 
                        selectedTagGroup={selectedTagGroup}
                        activePoint={activePoint}
                    />
                </div>
            </CardContent>
        </Card>
    )
}
