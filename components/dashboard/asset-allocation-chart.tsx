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
    tags: string[]
}

const chartConfigBase = {
    value: {
        label: "Amount",
    },
} satisfies ChartConfig

export function AssetAllocationChart({
    categories,
    tagGroups = []
}: {
    categories: any[],
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
        return Array.from(new Set(categories.flatMap(d => d.tags))).sort()
    }, [categories])

    // Logic to transform data based on mode
    const chartData = React.useMemo(() => {
        if (mode === "category") {
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

            return activeGroup.tags.map((tagName, i) => {
                const groupCategories = categories.filter(c => c.tags.includes(tagName))
                const total = groupCategories
                    .reduce((sum, c) => sum + (c.isLiability ? -c.currentValue : c.currentValue), 0)

                return {
                    name: tagName,
                    value: Math.max(0, total),
                    fill: `var(--chart-${(i % 5) + 1})`,
                    isLiability: false // Aggregated tags are treated as net positive for the pie chart
                }
            }).filter(d => d.value > 0)
        }
    }, [categories, mode, selectedTagGroup, tagGroups])

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
        return chartData.filter(d => !d.isLiability)
    }, [chartData])

    return (
        <Card className="flex flex-col">
            <CardHeader className="items-center pb-0 pt-4">
                <CardTitle className="text-lg">資産構成比</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                    <CardDescription className="text-[10px] md:text-xs">
                        集計軸:
                    </CardDescription>
                    <div className="flex bg-muted/50 rounded-md p-0.5 border">
                        <button
                            onClick={() => setMode("category")}
                            className={`px-2 py-0.5 text-[10px] rounded-sm transition-all ${mode === "category"
                                ? "bg-background text-foreground shadow-sm font-bold"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        >
                            資産別
                        </button>
                        <button
                            onClick={() => setMode("tag")}
                            className={`px-2 py-0.5 text-[10px] rounded-sm transition-all ${mode === "tag"
                                ? "bg-background text-foreground shadow-sm font-bold"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        >
                            タグ別
                        </button>
                    </div>
                </div>

                {mode === "tag" && (
                    <div className="flex flex-wrap gap-1 mt-1 justify-center">
                        {tagGroups.map(g => (
                            <div
                                key={g.id}
                                className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer border transition-colors ${selectedTagGroup === g.id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                                    }`}
                                onClick={() => setSelectedTagGroup(g.id === selectedTagGroup ? null : g.id)}
                            >
                                {g.name}
                            </div>
                        ))}
                    </div>
                )}
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
                            nameKey="category"
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
