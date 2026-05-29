"use client"

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts"

import {
    ChartConfig,
    ChartContainer,
} from "@/components/ui/chart"

import { Category, TagGroup, HistoryPoint, ChartViewMode } from "@/types/asset"

const chartConfigBase = {
    value: {
        label: "Amount",
    },
} satisfies ChartConfig

interface ChartDataItem {
    id: string | number;
    name: string;
    value: number;
    fill: string;
    isLiability: boolean;
}

export function AssetAllocationChart({
    categories,
    tagGroups = [],
    mode,
    selectedTagGroup,
    activePoint,
    selectedAssetKey,
    onAssetClick,
    viewMode
}: {
    categories: Category[],
    tagGroups?: TagGroup[],
    mode: "total" | "tag",
    selectedTagGroup: number,
    activePoint?: HistoryPoint | null,
    selectedAssetKey?: string | null,
    onAssetClick?: (key: string | null) => void,
    viewMode?: ChartViewMode
}) {
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const activeKeys = React.useMemo(() => {
        if (mode === "tag") {
            const grp = tagGroups.find(g => g.id === selectedTagGroup)
            const keys = grp?.options?.map(o => o.name) || grp?.tags || []
            return Array.from(new Set(keys.map(k => String(k).trim())))
        }
        return []
    }, [mode, selectedTagGroup, tagGroups])

    // Logic to transform data based on mode
    const chartData = React.useMemo((): ChartDataItem[] => {
        const topLevelCategories = categories.filter(c => !c.parentId);
        const useCost = viewMode === "cost";
        
        if (mode === "total") {
            // "total" mode uses top-level categories
            const items = topLevelCategories.map(c => {
                const val = activePoint
                    ? (Number((activePoint as unknown as Record<string, number | string>)[useCost ? `category_cost_${c.id}` : `category_${c.id}`]) || 0)
                    : (useCost ? (c.isCash ? c.currentValue : c.costBasis) : (c.currentValue || 0));
                const colorIndex = topLevelCategories.findIndex(tc => tc.id === c.id);
                return {
                    id: c.id,
                    name: c.name,
                    value: val,
                    fill: c.color || `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`,
                    isLiability: false
                };
            });
            return items.filter(d => d.value > 0);
        } else {
            const activeGroup = tagGroups.find(g => g.id === selectedTagGroup)
            if (!activeGroup) return []
            const targetTags = (activeGroup.options?.map(o => String(o.name).trim()) || activeGroup.tags?.map(t => String(t).trim()) || []) as string[];

            if (activePoint) {
                return targetTags.map((tagName: string) => {
                    const key = useCost ? `tag_cost_${selectedTagGroup}_${tagName}` : `tag_${selectedTagGroup}_${tagName}`;
                    const val = Number((activePoint as unknown as Record<string, number | string>)[key]) || 0;
                    const colorIndex = targetTags.indexOf(tagName);
                    return {
                        id: tagName,
                        name: tagName,
                        value: val,
                        fill: `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`,
                        isLiability: false
                    }
                }).filter((d: ChartDataItem) => d.value > 0);
            }

            // Fallback: sum up categories if no active point
            const tagMap = new Map<string, number>();
            targetTags.forEach(t => tagMap.set(t, 0));

            const findEffectiveTag = (cat: Category): string | null => {
                const directTag = cat.tagSettings?.find((s) => s.groupId === selectedTagGroup)?.optionName;
                if (directTag && targetTags.includes(directTag)) return directTag;
                const stringMatch = targetTags.find(t => cat.tags?.includes(t));
                return stringMatch || (cat.parentId ? findEffectiveTag(categories.find(p => p.id === cat.parentId) as Category) : null);
            };

            categories.forEach(cat => {
                const matchingTag = findEffectiveTag(cat);
                if (matchingTag) {
                    const val = useCost
                        ? (cat.isCash ? (cat.ownValue ?? cat.currentValue) : (cat.ownCostBasis ?? cat.costBasis))
                        : ((cat.ownValue !== undefined) ? cat.ownValue : (cat.parentId ? cat.currentValue : 0));
                    tagMap.set(matchingTag, (tagMap.get(matchingTag) || 0) + (Number(val) || 0));
                }
            });

            return targetTags.map((tagName: string) => {
                const val = tagMap.get(tagName) || 0;
                const colorIndex = targetTags.indexOf(tagName);
                return {
                    id: tagName,
                    name: tagName,
                    value: Math.max(0, val),
                    fill: `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`,
                    isLiability: false
                }
            }).filter(d => d.value > 0);
        }
    }, [categories, mode, selectedTagGroup, tagGroups, activePoint, viewMode])

    const chartConfig = React.useMemo(() => {
        const config: ChartConfig = { ...chartConfigBase }
        chartData.forEach((d) => {
            config[d.name] = {
                label: d.name,
                color: d.fill
            }
        })
        return config
    }, [chartData])

    const totalValue = React.useMemo(() => {
        return chartData
            .filter(d => !d.isLiability)
            .reduce((acc, curr) => acc + curr.value, 0)
    }, [chartData])

    const displayData = React.useMemo(() => {
        return chartData.filter(d => !d.isLiability)
    }, [chartData])

    const stackedData = React.useMemo(() => {
        const item: Record<string, number | string> = { name: "Allocation" };
        displayData.forEach(d => {
            item[d.name] = d.value;
        });
        return [item];
    }, [displayData]);

    if (!isMounted) return null

    return (
        <div className="flex flex-col h-[300px] w-full">
            <div className="flex-1 flex flex-row min-h-0">
                <div className="w-[100px] sm:w-[140px] flex flex-col items-center justify-center shrink-0 pt-4">
                    {/* 合計評価額を表示 (万円単位) */}
                    <div className="mb-2 flex items-baseline gap-0.5">
                        <span className="text-[14px] font-bold tabular-nums leading-none">
                            {Math.round(totalValue / 10000).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-medium opacity-70 leading-none">万円</span>
                    </div>
                    
                    <ChartContainer
                        config={chartConfig}
                        className="w-full flex-1 min-h-0"
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={stackedData}
                                layout="horizontal"
                                margin={{ top: 20, right: 10, left: 10, bottom: 20 }}
                                barSize={40}
                            >
                                <XAxis type="category" dataKey="name" hide />
                                <YAxis 
                                    type="number" 
                                    width={0} 
                                    tick={false} 
                                    axisLine={false} 
                                    tickLine={false}
                                    domain={[0, totalValue || 'auto']} 
                                />

                                {displayData.slice().reverse().map((entry, index) => {
                                    const key = mode === "total" ? `category_${entry.id}` : `tag_${selectedTagGroup}_${entry.name}`;
                                    const isDimmed = selectedAssetKey && selectedAssetKey !== key;
                                    // 逆順に描画するため、index 0 が一番上（最後）になる
                                    const isTop = index === displayData.length - 1;
                                    const isBottom = index === 0;
                                    return (
                                        <Bar
                                            key={entry.name}
                                            dataKey={entry.name}
                                            stackId="a"
                                            fill={entry.fill}
                                            fillOpacity={isDimmed ? 0.3 : 1}
                                            radius={isTop ? [4, 4, 0, 0] : isBottom ? [0, 0, 4, 4] : [0, 0, 0, 0]}
                                            onClick={() => {
                                                onAssetClick?.(selectedAssetKey === key ? null : key);
                                            }}
                                            style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                                        />
                                    );
                                })}

                                {/* 0%, 20%, 40%, 60%, 80%, 100% の補助線 (点線で洗練されたデザインに) */}
                                {totalValue > 0 && [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((percent) => (
                                    <ReferenceLine
                                        key={percent}
                                        y={totalValue * percent}
                                        stroke="currentColor"
                                        strokeOpacity={0.2}
                                        strokeDasharray="3 3"
                                        isFront={true}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </div>

                <div className="flex-1 flex flex-col py-4 border-l max-h-full overflow-y-auto overflow-x-hidden scrollbar-hide gap-y-2">
                    <div className="flex flex-col gap-y-1.5 px-4">
                        {!activePoint ? (
                            <span className="text-[10px] text-muted-foreground animate-pulse font-medium">
                                計算中...
                            </span>
                        ) : (
                            <>
                                {mode === "total" && categories.filter(c => !c.parentId && !c.isLiability).map((cat) => {
                                    const val = Number(activePoint[`category_${cat.id}`]) || 0
                                    const cost = Number(activePoint[`category_cost_${cat.id}`] || 0)
                                    const displayVal = viewMode === "cost" ? cost : val
                                    if (displayVal === 0) return null
                                    const key = `category_${cat.id}`
                                    const isDimmed = selectedAssetKey && selectedAssetKey !== key
                                    const pnlValue = val - cost
                                    const pnlRate = cost > 0 ? ((pnlValue) / cost) * 100 : 0
                                    const displayPrimaryValue = viewMode === "pnl" || viewMode === "pnlValue" ? pnlValue : displayVal
                                    
                                    // グラフ本体と同じロジックで色を決定
                                    const topLevelCategories = categories.filter(c => !c.parentId);
                                    const colorIndex = topLevelCategories.findIndex(tc => tc.id === cat.id);
                                    const color = cat.color || `var(--chart-${(colorIndex % 12) + 1})`;
                                    
                                    return (
                                        <div 
                                            key={cat.id} 
                                            className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-2 shrink-0 cursor-pointer transition-opacity ${isDimmed ? "opacity-30" : "opacity-100"}`}
                                            onClick={() => {
                                                onAssetClick?.(selectedAssetKey === key ? null : key);
                                            }}
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                            <span className="text-[10px] text-muted-foreground font-bold truncate">{cat.name}</span>
                                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                <div className="flex items-baseline gap-0.5">
                                                    <span className="text-[11px] font-bold tabular-nums">
                                                        {Math.round(displayPrimaryValue).toLocaleString()}
                                                    </span>
                                                    <span className="text-[7px] font-medium opacity-70">円</span>
                                                </div>
                                                <div className="flex items-baseline gap-0.5">
                                                    <span className="text-[11px] font-normal opacity-70">(</span>
                                                    <span className={`text-[11px] font-normal ${viewMode === "pnl" || viewMode === "pnlValue" ? (pnlValue >= 0 ? "text-emerald-500" : "text-rose-500") : ""}`}>
                                                        {viewMode === "pnl" ? (() => {
                                                            return (pnlRate > 0 ? "+" : "") + pnlRate.toFixed(1)
                                                        })() : viewMode === "pnlValue" ? (
                                                            (pnlRate > 0 ? "+" : "") + pnlRate.toFixed(1)
                                                        ) : (totalValue > 0 ? ((displayVal / totalValue) * 100).toFixed(1) : "0.0")}
                                                    </span>
                                                    <span className="text-[7px] font-normal opacity-70">%</span>
                                                    <span className="text-[11px] font-normal opacity-70">)</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                {mode === "tag" && activeKeys.map((keyName) => {
                                    const k = `tag_${selectedTagGroup}_${keyName}`
                                    const val = (activePoint as Record<string, unknown>)[k] || 0
                                    const cost = Number((activePoint as Record<string, unknown>)[`tag_cost_${selectedTagGroup}_${keyName}`] || 0)
                                    const displayVal = viewMode === "cost" ? cost : Number(val)
                                    if (displayVal === 0) return null
                                    const key = `tag_${selectedTagGroup}_${keyName}`
                                    const isDimmed = selectedAssetKey && selectedAssetKey !== key
                                    const pnlValue = Number(val) - cost
                                    const pnlRate = cost > 0 ? (pnlValue / cost) * 100 : 0
                                    const displayPrimaryValue = viewMode === "pnl" || viewMode === "pnlValue" ? pnlValue : displayVal
                                    
                                    // グラフ本体と同じロジックで色を決定
                                    const activeGroup = tagGroups.find(g => g.id === selectedTagGroup)
                                    const targetTags = activeGroup?.options?.map(o => o.name) || activeGroup?.tags || []
                                    const colorIndex = targetTags.indexOf(keyName);
                                    const color = `var(--chart-${(colorIndex % 12) + 1})`;
                                    
                                    return (
                                        <div 
                                            key={keyName} 
                                            className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-2 shrink-0 cursor-pointer transition-opacity ${isDimmed ? "opacity-30" : "opacity-100"}`}
                                            onClick={() => {
                                                onAssetClick?.(selectedAssetKey === key ? null : key);
                                            }}
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                            <span className="text-[10px] text-muted-foreground font-bold truncate">{keyName}</span>
                                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                <div className="flex items-baseline gap-0.5">
                                                    <span className="text-[11px] font-bold tabular-nums">
                                                        {Math.round(displayPrimaryValue).toLocaleString()}
                                                    </span>
                                                    <span className="text-[7px] font-medium opacity-70">円</span>
                                                </div>
                                                <div className="flex items-baseline gap-0.5">
                                                    <span className="text-[11px] font-normal opacity-70">(</span>
                                                    <span className={`text-[11px] font-normal ${viewMode === "pnl" || viewMode === "pnlValue" ? (pnlValue >= 0 ? "text-emerald-500" : "text-rose-500") : ""}`}>
                                                        {viewMode === "pnl" ? (() => {
                                                            return (pnlRate > 0 ? "+" : "") + pnlRate.toFixed(1)
                                                        })() : viewMode === "pnlValue" ? (
                                                            (pnlRate > 0 ? "+" : "") + pnlRate.toFixed(1)
                                                        ) : (totalValue > 0 ? ((displayVal / totalValue) * 100).toFixed(1) : "0.0")}
                                                    </span>
                                                    <span className="text-[7px] font-normal opacity-70">%</span>
                                                    <span className="text-[11px] font-normal opacity-70">)</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </>
                        )}
                    </div>
                </div>
            </div>
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    )
}
