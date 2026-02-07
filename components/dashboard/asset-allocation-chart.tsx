"use client"

import * as React from "react"
import { Label, Pie, PieChart, Legend } from "recharts"

import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

import { Category, TagGroup } from "@/types/asset"

const chartConfigBase = {
    value: {
        label: "Amount",
    },
} satisfies ChartConfig

export function AssetAllocationChart({
    categories,
    allCategories = [],
    tagGroups = []
}: {
    categories: Category[],
    allCategories?: Category[],
    tagGroups?: TagGroup[]
}) {
    const [mode, setMode] = React.useState<"category" | "tag">("category")
    const [selectedTagGroup, setSelectedTagGroup] = React.useState<number | null>(null)

    // Set first tag group as default when switching to tag mode
    React.useEffect(() => {
        if (mode === "tag" && selectedTagGroup === null && tagGroups.length > 0) {
            setSelectedTagGroup(tagGroups[0].id)
        }
    }, [mode, tagGroups, selectedTagGroup])

    // Logic to transform data based on mode
    const chartData = React.useMemo(() => {
        if (mode === "category") {
            // Default mode: Use top-level categories (aggregated values)
            return categories
                .filter(c => c.currentValue > 0)
                .map(c => ({
                    name: c.name,
                    value: c.currentValue,
                    fill: c.color || "var(--chart-1)",
                    isLiability: !!c.isLiability
                }))
        } else {
            const activeGroup = tagGroups.find(g => g.id === selectedTagGroup)
            if (!activeGroup) return []

            // Tag mode: Use ALL categories (flat list) and sum OWN values
            const sourceData = allCategories.length > 0 ? allCategories : categories;
            const targetTags = activeGroup.options?.map(o => o.name) || activeGroup.tags || []

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
                    // Special case: if we are processing a root that has own value, we take it.
                    // But if it's a root folder without direct records, its currentValue is already handled.
                    const sign = cat.isLiability ? -1 : 1;
                    tagMap.set(matchingTag, (tagMap.get(matchingTag) || 0) + (val * sign));
                }
            });

            return targetTags.map((tagName: string, i: number) => ({
                name: tagName,
                value: Math.max(0, tagMap.get(tagName) || 0),
                fill: `var(--chart-${(i % 5) + 1})`,
                isLiability: false
            })).filter(d => d.value > 0)
        }
    }, [categories, allCategories, mode, selectedTagGroup, tagGroups])

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
        // Only sum the displayed asset values (excluding liabilities)
        // This naturally excludes categories that don't belong to any tag in the group
        return chartData
            .filter(d => !d.isLiability)
            .reduce((acc, curr) => acc + curr.value, 0)
    }, [chartData])

    const displayData = React.useMemo(() => {
        return chartData
            .filter(d => !d.isLiability)
    }, [chartData])

    return (
        <Card className="flex flex-col">
            <CardHeader className="items-center pb-0 pt-2">
                <div className="w-full flex items-center gap-2 overflow-x-auto pb-1 mt-1 no-scrollbar max-w-full">
                    <div className="flex bg-muted/50 rounded-md p-0.5 border">
                        <button
                            onClick={() => setMode("category")}
                            className={`px-2 py-1 text-[10px] rounded-md transition-all whitespace-nowrap ${mode === "category"
                                ? "bg-background text-foreground shadow-sm font-bold"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        >
                            全体
                        </button>
                        {tagGroups.map(g => (
                            <button
                                key={g.id}
                                onClick={() => { setMode("tag"); setSelectedTagGroup(g.id); }}
                                className={`px-2 py-1 text-[10px] rounded-md transition-all whitespace-nowrap ${mode === "tag" && selectedTagGroup === g.id
                                    ? "bg-background text-foreground shadow-sm font-bold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                            >
                                {g.name}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 pb-2 pt-0">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto h-[300px] w-full min-w-0"
                >
                    <PieChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
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
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
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
                                // Hide labels for very small sectors to avoid overlap
                                const percent = (value / totalValue) * 100;
                                if (percent < 8) return null;

                                const RADIAN = Math.PI / 180;
                                // Position in the middle of the donut ring
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
                <style jsx global>{`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                `}</style>
            </CardContent>
            {/* Removed Footer text per user request */}
        </Card>
    )
}
