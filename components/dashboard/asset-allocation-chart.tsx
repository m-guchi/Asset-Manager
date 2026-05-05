"use client"

import * as React from "react"
import { Label, Pie, PieChart, Legend } from "recharts"

import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

import { Category, TagGroup, HistoryPoint } from "@/types/asset"

const chartConfigBase = {
    value: {
        label: "Amount",
    },
} satisfies ChartConfig

export function AssetAllocationChart({
    categories,
    allCategories = [],
    tagGroups = [],
    mode,
    selectedTagGroup,
    activePoint
}: {
    categories: Category[],
    allCategories?: Category[],
    tagGroups?: TagGroup[],
    mode: "total" | "tag",
    selectedTagGroup: number,
    activePoint?: HistoryPoint | null
}) {
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
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
    const chartData = React.useMemo(() => {
        if (mode === "total") {
            // "total" mode uses top-level categories
            if (activePoint) {
                return categories
                    .filter(c => !c.parentId)
                    .map(c => {
                        const val = Number(activePoint[`category_${c.id}`]) || 0;
                        return {
                            name: c.name,
                            value: val,
                            fill: c.color || "var(--chart-1)",
                            isLiability: false
                        };
                    }).filter(d => d.value > 0)
            } else {
                return categories
                    .filter(c => !c.parentId && c.currentValue > 0)
                    .map(c => ({
                        name: c.name,
                        value: c.currentValue,
                        fill: c.color || "var(--chart-1)",
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

            return targetTags.map((tagName: string, i: number) => ({
                name: tagName,
                value: Math.max(0, tagMap.get(tagName) || 0),
                fill: `var(--chart-${(i % 5) + 1})`,
                isLiability: false
            })).filter(d => d.value > 0)
        }
    }, [categories, allCategories, mode, selectedTagGroup, tagGroups, activePoint])

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

    return (
        <div className="flex flex-col h-full px-2 sm:px-4 py-0 w-full">
            <div className={`flex ${isMobile ? "flex-row items-center" : "flex-col"} w-full h-full`}>
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto h-[350px] sm:h-[400px] w-full min-w-0 flex-1"
                >
                    <PieChart margin={{ 
                        top: 0, 
                        bottom: 0, 
                        left: 0, 
                        right: 0 
                    }}>
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    hideLabel
                                    formatter={(value, name, props) => {
                                        const val = Number(value);
                                        const percent = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : "0.0";
                                        return (
                                            <div className="flex flex-col gap-0.5 min-w-[120px]">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: props.color || props.payload?.fill }} />
                                                    <span className="font-bold text-sm">{name}</span>
                                                </div>
                                                <div className="flex flex-col pl-4 text-xs text-muted-foreground">
                                                    <span>¥{val.toLocaleString()}</span>
                                                    <span className="font-medium text-foreground">{percent}%</span>
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                            }
                        />

                        <Pie
                            data={displayData}
                            dataKey="value"
                            nameKey="name"
                            startAngle={90}
                            endAngle={-270}
                            innerRadius={60}
                            outerRadius={100}
                            isAnimationActive={true}
                            animationBegin={0}
                            animationDuration={800}
                            animationEasing="ease-out"
                            labelLine={false}
                            label={({ name, value, cx, cy, midAngle, innerRadius, outerRadius }) => {
                                const percent = (value / totalValue) * 100;
                                if (percent < 8) return null;

                                const RADIAN = Math.PI / 180;
                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                return (
                                    <g style={{ animation: 'fadeIn 0.5s ease-out 0.3s both' }}>
                                        <text
                                            x={x}
                                            y={y}
                                            className="fill-foreground text-[9px] md:text-[10px] font-bold pointer-events-none"
                                            textAnchor="middle"
                                            dominantBaseline="central"
                                        >
                                            <tspan x={x} dy="-0.6em">{name}</tspan>
                                            <tspan x={x} dy="1.2em" className="font-medium opacity-90">
                                                {`${Math.round(value / 10000).toLocaleString()}万`}
                                            </tspan>
                                        </text>
                                    </g>
                                );
                            }}
                            strokeWidth={2}
                        >
                            <Label
                                content={({ viewBox }) => {
                                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                        return (
                                            <g style={{ animation: 'fadeIn 0.6s ease-out 0.2s both' }}>
                                                <text
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                >
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={viewBox.cy}
                                                        className="fill-foreground text-xl font-bold md:text-2xl"
                                                    >
                                                        {`¥${Math.round(totalValue / 10000).toLocaleString()}万`}
                                                    </tspan>
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={(viewBox.cy || 0) + 24}
                                                        className="fill-muted-foreground text-[10px]"
                                                    >
                                                        合計資産
                                                    </tspan>
                                                </text>
                                            </g>
                                        )
                                    }
                                }}
                            />
                        </Pie>
                    </PieChart>
                </ChartContainer>

                {/* カスタム凡例（旧最上部バーの内容） */}
                <div className={`flex ${isMobile ? "flex-col justify-center pl-4 border-l gap-y-2" : "flex-row flex-wrap justify-center gap-x-4 gap-y-2 py-4 border-t"} shrink-0 min-w-[120px]`}>
                    {!activePoint ? (
                        <span className="text-[10px] text-muted-foreground animate-pulse font-medium">
                            計算中...
                        </span>
                    ) : (
                        mode === "total" ? (
                            <>
                                {categories.filter(c => !c.parentId && !c.isLiability).map((cat, i) => {
                                    const val = Number(activePoint[`category_${cat.id}`]) || 0
                                    if (val === 0) return null
                                    const color = cat.color || `var(--chart-${(i % 5) + 1})`
                                    return (
                                        <div key={cat.id} className={`grid ${isMobile ? "grid-cols-[auto_1fr_80px_auto] w-full items-baseline" : "flex items-baseline"} gap-x-1 shrink-0`}>
                                            <div className="w-1.5 h-1.5 rounded-full translate-y-[-1px]" style={{ backgroundColor: color }} />
                                            <span className="text-[9px] text-muted-foreground font-bold whitespace-nowrap">{cat.name}</span>
                                            <span className="text-[11px] font-bold tabular-nums text-right">
                                                {Math.round(val).toLocaleString()}
                                            </span>
                                            <span className="text-[8px] font-medium opacity-70">円</span>
                                        </div>
                                    )
                                })}
                            </>
                        ) : (
                            activeKeys.map((key, i) => {
                                const k = `tag_${selectedTagGroup}_${key}`
                                const val = (activePoint as Record<string, unknown>)[k] || 0
                                if (val === 0) return null
                                const color = `var(--chart-${(i % 5) + 1})`
                                return (
                                    <div key={key} className={`grid ${isMobile ? "grid-cols-[auto_1fr_80px_auto] w-full items-baseline" : "flex items-baseline"} gap-x-1 shrink-0`}>
                                        <div className="w-1.5 h-1.5 rounded-full translate-y-[-1px]" style={{ backgroundColor: color }} />
                                        <span className="text-[9px] text-muted-foreground font-bold whitespace-nowrap">{key}</span>
                                        <span className="text-[11px] font-bold tabular-nums text-right">
                                            {Math.round(Number(val)).toLocaleString()}
                                        </span>
                                        <span className="text-[8px] font-medium opacity-70">円</span>
                                    </div>
                                )
                            })
                        )
                    )}
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
