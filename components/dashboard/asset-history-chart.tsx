"use client"
import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, Legend, YAxis } from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
} from "@/components/ui/chart"

// --- Types ---
interface HistoryPoint {
    date: string
    totalAssets: number
    totalCost: number
    [key: string]: any
}

interface TagGroup {
    id: number
    name: string
    tags: string[]
}

// Color Mapping
const CUSTOM_COLORS: Record<string, string> = {
    "安全資産": "#3b82f6",
    "リスク資産": "#22c55e",
    "超ハイリスク": "#f97316",
    "円建て": "#3b82f6",
    "ドル建て": "#1d4ed8",
    "負債": "#ef4444",
}

const mockTagGroups: TagGroup[] = [
    { id: 1, name: "資産クラス別", tags: ["安全資産", "リスク資産"] },
    { id: 2, name: "通貨別", tags: ["円建て", "ドル建て"] },
    { id: 3, name: "分類詳細", tags: ["現金・預金", "投資信託", "株式"] },
]

export function AssetHistoryChart({
    data = [],
    tagGroups = mockTagGroups
}: {
    data?: HistoryPoint[],
    tagGroups?: TagGroup[]
}) {
    const [mode, setMode] = React.useState<"total" | "tag">("total")
    const [selectedTagGroup, setSelectedTagGroup] = React.useState<number>(1)
    const [timeRange, setTimeRange] = React.useState("1Y")

    const activeKeys = React.useMemo(() => {
        if (mode === "tag") {
            return tagGroups.find(g => g.id === selectedTagGroup)?.tags || []
        }
        return []
    }, [mode, selectedTagGroup, tagGroups])

    const formatXAxis = (tickItem: string) => {
        const date = new Date(tickItem)
        if (timeRange === "1M" || timeRange === "3M") {
            return `${date.getMonth() + 1}/${date.getDate()}`
        }
        return `${date.getFullYear()}/${date.getMonth() + 1}`
    }

    // Filter data based on timeRange and ensure it starts from the left edge
    const { filteredData, cutoffTime } = React.useMemo(() => {
        if (!data.length) return { filteredData: [], cutoffTime: null }

        const now = new Date()
        const cutoff = new Date()
        let isAll = false;

        // Normalize cutoff to start of day for cleaner transitions
        cutoff.setHours(0, 0, 0, 0)

        if (timeRange === "1M") cutoff.setMonth(now.getMonth() - 1)
        else if (timeRange === "3M") cutoff.setMonth(now.getMonth() - 3)
        else if (timeRange === "1Y") cutoff.setFullYear(now.getFullYear() - 1)
        else isAll = true;

        if (isAll) {
            return {
                filteredData: data.map(point => ({ ...point, date: new Date(point.date).getTime() })),
                cutoffTime: null
            }
        }

        const cTime = cutoff.getTime()
        const filtered = data
            .filter(point => new Date(point.date).getTime() >= cTime)
            .map(p => ({ ...p, date: new Date(p.date).getTime() }))

        // Find the point just before the cutoff to use as starting point (estimation)
        const beforeCutoff = [...data].reverse().find(point => new Date(point.date).getTime() < cTime)

        if (beforeCutoff) {
            const startPoint = {
                ...beforeCutoff,
                date: cTime // Set to exact cutoff time for left-edge start
            }
            return {
                filteredData: [startPoint, ...filtered],
                cutoffTime: cTime
            }
        }

        return {
            filteredData: filtered,
            cutoffTime: cTime
        }
    }, [data, timeRange])

    if (data.length === 0) {
        return (
            <Card className="h-full flex flex-col items-center justify-center p-8 text-center bg-muted/20 border-dashed">
                <p className="text-muted-foreground">履歴データがありません</p>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-2 w-full min-w-0">
                    <div className="flex items-center justify-between">
                        <CardTitle>資産推移</CardTitle>
                        <div className="flex bg-muted rounded-md p-1 ml-auto">
                            {["1M", "3M", "1Y", "ALL"].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${timeRange === range
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full max-w-full">
                        <div className="flex bg-muted/50 rounded-md p-0.5 border">
                            <button
                                onClick={() => setMode("total")}
                                className={`px-2 py-1 text-[10px] rounded-md transition-all whitespace-nowrap ${mode === "total"
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
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={filteredData}
                            margin={{ top: 10, right: 10, left: 5, bottom: 0 }}
                        >
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis
                                dataKey="date"
                                type="number"
                                domain={['dataMin', 'dataMax']}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tickFormatter={formatXAxis}
                                minTickGap={30}
                                padding={{ left: 0, right: 0 }}
                                allowDataOverflow={true}
                                interval="preserveStartEnd"
                                className="text-[10px]"
                            />
                            <YAxis
                                tickFormatter={(val) => `${(val / 10000).toFixed(0)}万`}
                                width={45}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={4}
                                className="text-[10px]"
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                                itemStyle={{ color: 'var(--foreground)' }}
                                labelFormatter={(label) => {
                                    const d = new Date(label)
                                    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
                                }}
                                formatter={(value: number) => `¥${value.toLocaleString()}`}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />

                            {mode === "total" && (
                                <Area
                                    dataKey="totalAssets"
                                    name="評価額"
                                    type="linear"
                                    fill="var(--chart-1)"
                                    fillOpacity={0.4}
                                    stroke="var(--chart-1)"
                                />
                            )}
                            {mode === "total" && (
                                <Area
                                    dataKey="totalCost"
                                    name="取得原価"
                                    type="linear"
                                    fill="none"
                                    stroke="#888888"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                />
                            )}
                            {mode === "tag" && activeKeys.map((key, i) => (
                                <Area
                                    key={key}
                                    dataKey={`tag_${key}`}
                                    name={key}
                                    type="linear"
                                    fill={CUSTOM_COLORS[key] || `var(--chart-${(i % 5) + 1})`}
                                    fillOpacity={0.6}
                                    stroke={CUSTOM_COLORS[key] || `var(--chart-${(i % 5) + 1})`}
                                    stackId="1"
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
