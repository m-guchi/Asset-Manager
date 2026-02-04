"use client"

import * as React from "react"
import { Label, Pie, PieChart } from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

interface Category {
    id: number
    name: string
    currentValue: number
    costBasis: number
    color: string
    isCash?: boolean
    isLiability?: boolean
    tags: string[]
}

interface TagGroup {
    id: number
    name: string
    tags?: string[]
    options?: { id: number, name: string }[]
}

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
    categories: any[],
    allCategories?: any[],
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

    const availableTags = React.useMemo(() => {
        // Use allCategories for tag extraction to include child tags
        const source = allCategories.length > 0 ? allCategories : categories
        return Array.from(new Set(source.flatMap(d => d.tags))).sort()
    }, [categories, allCategories])

    // Logic to transform data based on mode
    const chartData = React.useMemo(() => {
        if (mode === "category") {
            // Default mode: Use top-level categories (aggregated values)
            return categories
                .filter(c => c.currentValue > 0)
                .map(c => ({
                    name: c.name,
                    value: c.currentValue, // Top-level uses aggregated currentValue
                    fill: c.color || "var(--chart-1)",
                    isLiability: !!c.isLiability
                }))
        } else {
            const activeGroup = tagGroups.find(g => g.id === selectedTagGroup)
            if (!activeGroup) return []

            // Tag mode: Use ALL categories (flat list) and sum OWN values to avoid double counting
            const sourceData = allCategories.length > 0 ? allCategories : categories;

            // Support both new 'options' structure and legacy 'tags' array
            const targetTags = activeGroup.options?.map(o => o.name) || activeGroup.tags || []

            return targetTags.map((tagName: string, i: number) => {
                const groupCategories = sourceData.filter(c => c.tags.includes(tagName))
                const total = groupCategories
                    .reduce((sum, c) => {
                        // Use ownValue for granular aggregation
                        // If ownValue is missing (legacy), fallback to currentValue but that might double count if hierarchy exists
                        const val = (c.ownValue !== undefined) ? c.ownValue : c.currentValue;
                        return sum + (c.isLiability ? -val : val)
                    }, 0)

                return {
                    name: tagName,
                    value: Math.max(0, total),
                    fill: `var(--chart-${(i % 5) + 1})`,
                    isLiability: false // Aggregated tags are treated as net positive for the pie chart
                }
            }).filter(d => d.value > 0)
        }
    }, [categories, allCategories, mode, selectedTagGroup, tagGroups])

    const activeGroupName = tagGroups.find(g => g.id === selectedTagGroup)?.name || "タグ別"

    const chartConfig = React.useMemo(() => {
        const config: any = { ...chartConfigBase }
        chartData.forEach((d) => {
            config[d.name] = { // Changed from d.category to d.name
                label: d.name,
                color: d.fill
            }
        })
        return config
    }, [chartData])


    const totalValue = React.useMemo(() => {
        // Exclude liabilities from the pie chart total
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
            <CardHeader className="items-center pb-0 pt-4">
                <CardTitle className="text-lg">資産構成比</CardTitle>
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
                    className="mx-auto h-[220px] w-full min-w-0"
                >
                    <PieChart margin={{ top: 0, bottom: 0, left: 20, right: 20 }}>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                            data={displayData}
                            dataKey="value"
                            nameKey="name"
                            startAngle={90}
                            endAngle={-270}
                            innerRadius={30}
                            outerRadius={70}
                            labelLine={true}
                            label={({ name, value, cx, cy, midAngle, outerRadius }) => {
                                const RADIAN = Math.PI / 180;
                                const radius = outerRadius + 20;
                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                return (
                                    <text
                                        x={x}
                                        y={y}
                                        className="fill-foreground text-[10px] md:text-xs font-medium"
                                        textAnchor={x > cx ? "start" : "end"}
                                        dominantBaseline="central"
                                    >
                                        {`${name}`}
                                        <tspan x={x} dy="1.2em" className="fill-muted-foreground font-normal">
                                            {`¥${(value / 10000).toLocaleString()}万`}
                                        </tspan>
                                    </text>
                                );
                            }}
                            strokeWidth={2}
                        />
                    </PieChart>
                </ChartContainer>
            </CardContent>
            {/* Removed Footer text per user request */}
        </Card>
    )
}
