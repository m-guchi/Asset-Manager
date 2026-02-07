"use client"
import * as React from "react"
import { Area, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, YAxis, ReferenceLine, Line, ComposedChart } from "recharts"

import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
} from "@/components/ui/chart"

import { HistoryPoint, TagGroup } from "@/types/asset"

// Tag groups definition for demo or fallback
const mockTagGroups: TagGroup[] = [
    { id: 1, name: "目的別", tags: ["投資資金", "生活防衛費", "代替通貨"] },
    { id: 2, name: "資産クラス別", tags: ["安全資産", "リスク資産"] },
]

interface ChartPoint extends HistoryPoint {
    timestamp: number;
    totalAssets: number;
    totalCost: number;
    netWorth: number;
}

interface AssetHistoryChartProps {
    data?: HistoryPoint[];
    tagGroups?: TagGroup[];
    initialTimeRange?: string;
}

export function AssetHistoryChart({
    data = [],
    tagGroups = mockTagGroups,
    initialTimeRange = "1Y"
}: AssetHistoryChartProps) {
    const [isMounted, setIsMounted] = React.useState(false);
    const [mode, setMode] = React.useState<"total" | "tag">("total")
    const [selectedTagGroup, setSelectedTagGroup] = React.useState<number>(1)
    const [timeRange, setTimeRange] = React.useState(initialTimeRange)
    const [showPercent, setShowPercent] = React.useState(false)
    const [activePoint, setActivePoint] = React.useState<ChartPoint | null>(null)
    const [hoverPoint, setHoverPoint] = React.useState<ChartPoint | null>(null)
    const [isLocked, setIsLocked] = React.useState(false)
    const [showNetWorth, setShowNetWorth] = React.useState(false)
    const [isAnimating, setIsAnimating] = React.useState(false)

    // Trigger animation only when display settings change
    React.useEffect(() => {
        setIsAnimating(true)
        const timer = setTimeout(() => setIsAnimating(false), 1500)
        return () => clearTimeout(timer)
    }, [mode, selectedTagGroup, showNetWorth, showPercent, timeRange])

    React.useEffect(() => {
        setIsMounted(true);
        const savedRange = localStorage.getItem("defaultTimeRange");
        if (savedRange) {
            setTimeRange(savedRange);
        }
    }, []);

    // Ensure we have a valid group selected
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

    const filteredData = React.useMemo(() => {
        if (!data || data.length === 0) return []

        const now = new Date()
        const cutoff = new Date()
        const isAll = timeRange === "ALL"

        if (!isAll) {
            cutoff.setHours(0, 0, 0, 0)
            if (timeRange === "1M") cutoff.setMonth(now.getMonth() - 1)
            else if (timeRange === "3M") cutoff.setMonth(now.getMonth() - 3)
            else if (timeRange === "1Y") cutoff.setFullYear(now.getFullYear() - 1)
        }

        const cTime = cutoff.getTime()
        return data
            .map(p => {
                const d = new Date(p.date)
                const point: ChartPoint = {
                    ...p,
                    totalAssets: Number(p.totalAssets || 0),
                    totalCost: Number(p.totalCost || 0),
                    netWorth: Number(p.netWorth ?? p.totalAssets ?? 0),
                    timestamp: isNaN(d.getTime()) ? 0 : d.getTime()
                }

                if (mode === "tag") {
                    activeKeys.forEach(key => {
                        const k = `tag_${selectedTagGroup}_${key}`
                        if (point[k] === undefined || point[k] === null) {
                            point[k] = 0
                        }
                    })
                }

                return point
            })
            .filter(p => p.timestamp > 0)
            .filter(p => isAll || p.timestamp >= cTime)
            .sort((a, b) => a.timestamp - b.timestamp)
    }, [data, timeRange, activeKeys, mode, selectedTagGroup])

    const chartConfig = React.useMemo(() => {
        const config: ChartConfig = {
            totalAssets: { label: "評価額", color: "var(--chart-1)" },
            totalCost: { label: "取得原価", color: "#888888" },
        }
        activeKeys.forEach((key) => {
            config[`tag_${selectedTagGroup}_${key}`] = { label: key }
        })
        return config
    }, [activeKeys, selectedTagGroup])

    if (!isMounted) {
        return (
            <Card className="h-full min-h-[300px] flex items-center justify-center bg-muted/5 border-dashed">
                <p className="text-xs text-muted-foreground animate-pulse">グラフを構成中...</p>
            </Card>
        );
    }

    const formatXAxis = (tickItem: number) => {
        const date = new Date(tickItem)
        if (isNaN(date.getTime())) return ""
        return `${date.getFullYear()}/${date.getMonth() + 1}`
    }

    return (
        <Card className="flex flex-col h-full min-h-[450px]">
            <CardHeader className="items-center pb-0 pt-1.5">
                <div className="w-full flex items-center gap-2 overflow-x-auto pb-0.5 mt-0.5 no-scrollbar max-w-full">
                    <div className="flex bg-muted/50 rounded-md p-0.5 border" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setMode("total"); setShowPercent(false); }}
                            className={`px-2 py-1 text-[10px] rounded-md transition-all whitespace-nowrap ${mode === "total"
                                ? "bg-background text-foreground shadow-sm font-bold"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        >
                            全体
                        </button>
                        {tagGroups && tagGroups.map(grp => (
                            <button
                                key={grp.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMode("tag");
                                    setSelectedTagGroup(grp.id);
                                }}
                                className={`px-2 py-1 text-[10px] rounded-md transition-all whitespace-nowrap ${mode === "tag" && selectedTagGroup === grp.id
                                    ? "bg-background text-foreground shadow-sm font-bold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                            >
                                {grp.name}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex flex-col flex-1 p-0 relative min-h-0 overflow-hidden">
                <ChartContainer config={chartConfig} className="flex-1 min-h-0 w-full text-[10px]">
                    <div className="flex flex-col h-full w-full">
                        <div className="px-4 border-y border-border/40 bg-muted/10 h-11 flex items-center mt-0 shrink-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            {!activePoint ? (
                                <div className="w-full text-center">
                                    <span className="text-[10px] text-muted-foreground animate-pulse font-medium">
                                        グラフをホバーして詳細を表示
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 w-full overflow-x-auto no-scrollbar">
                                    <div className="bg-background border border-border/60 shadow-sm px-2 py-0.5 rounded text-[10px] font-bold shrink-0">
                                        {(() => {
                                            const d = new Date(activePoint.timestamp)
                                            return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
                                        })()}
                                    </div>
                                    <div className="flex items-center gap-4 flex-1 pr-2">
                                        {mode === "total" ? (
                                            <>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-totalAssets)" }} />
                                                    <span className="text-[9px] text-muted-foreground font-bold">{showNetWorth ? "純資産" : "評価額"}</span>
                                                    <span className="text-[11px] font-bold">¥{Math.round(showNetWorth ? activePoint.netWorth : activePoint.totalAssets).toLocaleString()}</span>
                                                </div>
                                                {!showNetWorth && (
                                                    <div className="flex items-center gap-1.5 shrink-0 border-l border-border/50 pl-4">
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#888888" }} />
                                                        <span className="text-[9px] text-muted-foreground font-bold">取得原価</span>
                                                        <span className="text-[11px] font-bold text-[#888888]">¥{Math.round(activePoint.totalCost).toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            activeKeys.map((key, i) => {
                                                const k = `tag_${selectedTagGroup}_${key}`
                                                const val = activePoint[k] || 0
                                                if (val === 0) return null
                                                const color = `var(--chart-${(i % 5) + 1})`
                                                return (
                                                    <div key={key} className={`flex items-center gap-1.5 shrink-0 ${i > 0 ? "border-l border-border/50 pl-4" : ""}`}>
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                                        <span className="text-[9px] text-muted-foreground font-bold">{key}</span>
                                                        <span className="text-[11px] font-bold">
                                                            {showPercent
                                                                ? `${((Number(activePoint[k] || 0) / (activeKeys.reduce((a, sky) => a + Number(activePoint[`tag_${selectedTagGroup}_${sky}`] || 0), 0) || 1)) * 100).toFixed(1)}%`
                                                                : `¥${Math.round(Number(activePoint[k] || 0)).toLocaleString()}`
                                                            }
                                                        </span>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 w-full min-h-0 px-2 py-2" onClick={(e) => e.stopPropagation()} style={{ touchAction: "none" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    key={`${mode}-${selectedTagGroup}-${showPercent}-${showNetWorth}-${timeRange}`}
                                    data={filteredData}
                                    onMouseMove={(e) => {
                                        if (e && e.activePayload && e.activePayload.length > 0) {
                                            const p = e.activePayload[0].payload as ChartPoint;
                                            setHoverPoint(p);
                                            if (!isLocked) setActivePoint(p);
                                        }
                                    }}
                                    // @ts-expect-error: Recharts internal event payload types are not fully exposed
                                    onTouchStart={(e) => {
                                        if (e && e.activePayload && e.activePayload.length > 0) {
                                            const p = e.activePayload[0].payload as ChartPoint;
                                            setHoverPoint(p);
                                            if (!isLocked) setActivePoint(p);
                                        }
                                    }}
                                    // @ts-expect-error: Recharts internal event payload types are not fully exposed
                                    onTouchMove={(e) => {
                                        if (e && e.activePayload && e.activePayload.length > 0) {
                                            const p = e.activePayload[0].payload as ChartPoint;
                                            setHoverPoint(p);
                                            if (!isLocked) setActivePoint(p);
                                        }
                                    }}
                                    onClick={(e) => {
                                        if (e && e.activePayload && e.activePayload.length > 0) {
                                            const p = e.activePayload[0].payload as ChartPoint;
                                            if (isLocked) {
                                                // If already locked, unlock it
                                                setIsLocked(false);
                                            } else {
                                                // If not locked, lock at the current hovered point
                                                setActivePoint(p);
                                                setIsLocked(true);
                                            }
                                        } else {
                                            setIsLocked(false);
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        setHoverPoint(null);
                                        if (!isLocked) setActivePoint(null);
                                    }}
                                    stackOffset={mode === "tag" && showPercent ? "expand" : "none"}
                                    margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                                >
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#888888" strokeOpacity={0.2} />
                                    <XAxis
                                        dataKey="timestamp"
                                        type="number"
                                        domain={['dataMin', 'dataMax']}
                                        tickFormatter={formatXAxis}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.5 }}
                                        tickMargin={10}
                                    />
                                    <YAxis
                                        tickFormatter={(val) => showPercent ? `${(val * 100).toFixed(0)}%` : `${Math.round(val / 10000)}万`}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.5 }}
                                        width={40}
                                        domain={showPercent ? [0, 1] : ['auto', 'auto']}
                                    />
                                    <Tooltip
                                        content={(props) => (
                                            <TooltipUpdater
                                                active={props.active}
                                                payload={props.payload}
                                                onUpdate={setActivePoint}
                                                isLocked={isLocked}
                                            />
                                        )}
                                        cursor={false}
                                        isAnimationActive={false}
                                    />
                                    {isLocked && activePoint && (
                                        <ReferenceLine
                                            x={activePoint.timestamp}
                                            stroke="currentColor"
                                            strokeOpacity={0.8}
                                            strokeWidth={1}
                                        />
                                    )}
                                    {hoverPoint && (!isLocked || (hoverPoint.timestamp !== activePoint?.timestamp)) && (
                                        <ReferenceLine
                                            x={hoverPoint.timestamp}
                                            stroke="currentColor"
                                            strokeOpacity={0.3}
                                            strokeWidth={1}
                                            strokeDasharray="3 3"
                                        />
                                    )}
                                    <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />

                                    {mode === "total" && (
                                        <Area
                                            dataKey={showNetWorth ? "netWorth" : "totalAssets"}
                                            type="linear"
                                            stroke="var(--color-totalAssets)"
                                            strokeWidth={2}
                                            fill="var(--color-totalAssets)"
                                            fillOpacity={0.2}
                                            isAnimationActive={isAnimating}
                                            animationDuration={1200}
                                        />
                                    )}
                                    {mode === "total" && !showNetWorth && (
                                        <Line
                                            dataKey="totalCost"
                                            type="stepAfter"
                                            stroke="#888888"
                                            strokeWidth={1.5}
                                            strokeDasharray="5 5"
                                            dot={false}
                                            isAnimationActive={isAnimating}
                                            animationDuration={1200}
                                            connectNulls
                                        />
                                    )}

                                    {mode === "tag" && activeKeys.map((key, i) => (
                                        <Area
                                            key={key}
                                            dataKey={`tag_${selectedTagGroup}_${key}`}
                                            stackId="1"
                                            type="linear"
                                            stroke={`var(--chart-${(i % 5) + 1})`}
                                            fill={`var(--chart-${(i % 5) + 1})`}
                                            fillOpacity={0.4}
                                            isAnimationActive={isAnimating}
                                            animationDuration={1200}
                                        />
                                    ))}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex items-center justify-between px-4 pb-4 mt-0 shrink-0">
                            <div className="flex bg-muted/50 rounded-md p-0.5 border">
                                {["1M", "3M", "1Y", "ALL"].map((range) => {
                                    const label = { "1M": "1ヶ月", "3M": "3ヶ月", "1Y": "1年", "ALL": "全期間" }[range] || range;
                                    return (
                                        <button
                                            key={range}
                                            onClick={() => {
                                                setTimeRange(range);
                                                localStorage.setItem("defaultTimeRange", range);
                                            }}
                                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${timeRange === range
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"}`}
                                        >
                                            {label}
                                        </button>
                                    )
                                })}
                            </div>
                            {mode === "tag" && (
                                <button
                                    onClick={() => setShowPercent(!showPercent)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md border transition-all ${showPercent
                                        ? "bg-foreground text-background"
                                        : "bg-background text-muted-foreground hover:text-foreground"}`}
                                >
                                    100%
                                </button>
                            )}
                            {mode === "total" && (
                                <button
                                    onClick={() => setShowNetWorth(!showNetWorth)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md border transition-all ${showNetWorth
                                        ? "bg-foreground text-background"
                                        : "bg-background text-muted-foreground hover:text-foreground"}`}
                                >
                                    負債を含める
                                </button>
                            )}
                        </div>
                    </div>
                </ChartContainer>
            </CardContent>

        </Card>
    )
}

// Helper component to sync Tooltip state with activePoint
function TooltipUpdater({
    active,
    payload,
    onUpdate,
    isLocked
}: {
    active?: boolean,
    payload?: { payload?: ChartPoint }[],
    onUpdate: (p: ChartPoint | null) => void,
    isLocked: boolean
}) {
    React.useEffect(() => {
        if (active && payload && payload.length > 0 && !isLocked && payload[0].payload) {
            onUpdate(payload[0].payload)
        }
    }, [active, payload, isLocked, onUpdate])
    return null
}
