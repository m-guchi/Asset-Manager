"use client"

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts"

import {
    ChartConfig,
    ChartContainer,
} from "@/components/ui/chart"

import { Category, TagGroup, HistoryPoint } from "@/types/asset"

const chartConfigBase = {
    value: {
        label: "Amount",
    },
} satisfies ChartConfig

interface ChartDataItem {
    id: number;
    name: string;
    value: number;
    fill: string;
    isLiability: boolean;
}

export function AssetAllocationChart({
    categories,
    allCategories = [],
    tagGroups = [],
    mode,
    selectedTagGroup,
    activePoint,
    selectedAssetKey,
    onAssetClick
}: {
    categories: Category[],
    allCategories?: Category[],
    tagGroups?: TagGroup[],
    mode: "total" | "tag",
    selectedTagGroup: number,
    activePoint?: HistoryPoint | null,
    selectedAssetKey?: string | null,
    onAssetClick?: (key: string | null) => void
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
        if (mode === "total") {
            // "total" mode uses top-level categories
            if (activePoint) {
                return categories
                    .filter(c => !c.parentId)
                    .map(c => {
                        const val = Number(activePoint[`category_${c.id}`]) || 0;
                        return {
                            id: c.id,
                            name: c.name,
                            value: val,
                            fill: c.color || "var(--chart-1)",
                            isLiability: false
                        };
                    }).filter(d => d.value > 0)
            } else {
                return categories
                    .filter(c => !c.parentId && c.currentValue > 0)
                    .map((c, i) => ({
                        id: c.id,
                        name: c.name,
                        value: c.currentValue,
                        fill: `var(--chart-${(i % 12) + 1})`,
                        isLiability: false
                    }))
            }
        } else {
            const activeGroup = tagGroups.find(g => g.id === selectedTagGroup)
            if (!activeGroup) return []
            const targetTags = activeGroup.options?.map(o => o.name) || activeGroup.tags || []

            // If we have an activePoint from the history chart, use it to sync values to the selected date
            if (activePoint) {
                return targetTags.map((tagName: string, i: number) => {
                    const key = `tag_${selectedTagGroup}_${tagName}`
                    const val = Number(activePoint[key]) || 0
                    return {
                        id: i,
                        name: tagName,
                        value: Math.max(0, val),
                        fill: `var(--chart-${(i % 5) + 1})`,
                        isLiability: false
                    }
                }).filter(d => d.value > 0)
            }

            // Fallback: use live data if no active point
            const sourceData = allCategories.length > 0 ? allCategories : categories;
            const tagMap = new Map<string, number>();
            targetTags.forEach(t => tagMap.set(t, 0));

            // Helper to find effective tag for a category in the current group
            const findEffectiveTag = (cat: Category): string | null => {
                // 1. Check direct tags in this group
                const directTag = cat.tagSettings?.find((s) => s.groupId === selectedTagGroup)?.optionName;
                if (directTag && targetTags.includes(directTag)) return directTag;

                // Fallback to legacy string check if tagSettings is missing
                const stringMatch = targetTags.find(t => cat.tags?.includes(t));
                if (stringMatch) return stringMatch;

                // 2. Inherit from parent
                if (cat.parentId) {
                    const parent = sourceData.find(p => p.id === cat.parentId);
                    if (parent) return findEffectiveTag(parent);
                }

                return null;
            };

            sourceData.forEach(cat => {
                const matchingTag = findEffectiveTag(cat);
                if (matchingTag) {
                    // Use ownValue for more precise non-overlapping sum in flat processing
                    const val = (cat.ownValue !== undefined) ? cat.ownValue : (cat.parentId ? cat.currentValue : 0);
                    tagMap.set(matchingTag, (tagMap.get(matchingTag) || 0) + val);
                }
            });

            return activeKeys.map((keyName, i) => ({
                id: i,
                name: keyName,
                value: Math.max(0, tagMap.get(keyName) || 0),
                fill: `var(--chart-${(i % 5) + 1})`,
                isLiability: false
            })).filter(d => d.value > 0)
        }
    }, [categories, allCategories, mode, selectedTagGroup, tagGroups, activePoint, activeKeys])

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
                <div className="w-[100px] sm:w-[140px] flex items-center justify-center shrink-0">
                    <ChartContainer
                        config={chartConfig}
                        className="w-full h-full min-h-[250px]"
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
                                    if (val === 0) return null
                                    const key = `category_${cat.id}`
                                    const isDimmed = selectedAssetKey && selectedAssetKey !== key
                                    
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
                                                        {Math.round(val).toLocaleString()}
                                                    </span>
                                                    <span className="text-[7px] font-medium opacity-70">円</span>
                                                </div>
                                                <div className="flex items-baseline gap-0.5">
                                                    <span className="text-[11px] font-normal opacity-70">(</span>
                                                    <span className="text-[11px] font-normal">
                                                        {totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : "0.0"}
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
                                    if (Number(val) === 0) return null
                                    const key = `tag_${selectedTagGroup}_${keyName}`
                                    const isDimmed = selectedAssetKey && selectedAssetKey !== key
                                    
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
                                                        {Math.round(Number(val)).toLocaleString()}
                                                    </span>
                                                    <span className="text-[7px] font-medium opacity-70">円</span>
                                                </div>
                                                <div className="flex items-baseline gap-0.5">
                                                    <span className="text-[11px] font-normal opacity-70">(</span>
                                                    <span className="text-[11px] font-normal">
                                                        {totalValue > 0 ? ((Number(val) / totalValue) * 100).toFixed(1) : "0.0"}
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
