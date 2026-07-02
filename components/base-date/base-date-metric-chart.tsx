"use client"
import * as React from "react"
import { CartesianGrid, XAxis, YAxis, ReferenceLine, ReferenceDot, ComposedChart, Line } from "recharts"

import { ChartConfig, ChartContainer } from "@/components/ui/chart"
import { HistoryPoint, TagGroup, Category } from "@/types/asset"
import { clampDomainOffset } from "@/lib/chart-domain"
import { applyPnlWithZeroTransitions, isPlottablePnlValue } from "@/lib/chart-pnl"
import { applyBaseDateDiff, findNearestPointByTimestamp } from "@/lib/chart-base-diff"

export type BaseDateMetric = "value" | "cost" | "pnl" | "pnlValue" | "realizedGain"

interface ChartPoint extends HistoryPoint {
    timestamp: number
}

function seriesKeysForMetric(
    metric: BaseDateMetric,
    mode: "total" | "tag",
    selectedTagGroup: number,
    activeKeys: string[],
    topLevelCategories: Category[]
): { valKey: string; diffKey: string }[] {
    if (mode === "tag") {
        return activeKeys.map((key) => ({
            valKey:
                metric === "value" ? `tag_${selectedTagGroup}_${key}`
                    : metric === "cost" ? `tag_cost_${selectedTagGroup}_${key}`
                        : metric === "pnl" ? `tag_pnl_${selectedTagGroup}_${key}`
                            : metric === "pnlValue" ? `tag_pnl_value_${selectedTagGroup}_${key}`
                                : `tag_realized_gain_${selectedTagGroup}_${key}`,
            diffKey: `tag_base_diff_${selectedTagGroup}_${key}`,
        }))
    }
    return topLevelCategories
        .filter((c) => !c.isLiability)
        .map((cat) => ({
            valKey:
                metric === "value" ? `category_${cat.id}`
                    : metric === "cost" ? `category_cost_${cat.id}`
                        : metric === "pnl" ? `pnl_${cat.id}`
                            : metric === "pnlValue" ? `pnl_value_${cat.id}`
                                : `realized_gain_${cat.id}`,
            diffKey: `base_diff_${cat.id}`,
        }))
}

interface BaseDateMetricChartProps {
    data?: HistoryPoint[]
    tagGroups?: TagGroup[]
    categories?: Category[]
    mode: "total" | "tag"
    selectedTagGroup: number
    metric: BaseDateMetric
    metricLabel: string
    baseDate: Date | null
    timeRange: string
    domainOffset: number
    onDomainOffsetChange: (updater: (prev: number) => number) => void
}

export function BaseDateMetricChart({
    data = [],
    tagGroups = [],
    categories = [],
    mode,
    selectedTagGroup,
    metric,
    metricLabel,
    baseDate,
    timeRange,
    domainOffset,
    onDomainOffsetChange,
}: BaseDateMetricChartProps) {
    const [isMounted, setIsMounted] = React.useState(false)
    const [dragStartX, setDragStartX] = React.useState<number | null>(null)
    const [showLegend, setShowLegend] = React.useState(false)
    const chartRef = React.useRef<HTMLDivElement>(null)
    const dragRafRef = React.useRef<number | null>(null)
    const dragShiftRef = React.useRef(0)

    React.useEffect(() => {
        setIsMounted(true)
        return () => {
            if (dragRafRef.current !== null) cancelAnimationFrame(dragRafRef.current)
        }
    }, [])

    const activeKeys = React.useMemo(() => {
        if (mode === "tag") {
            const grp = tagGroups.find((g) => g.id === selectedTagGroup)
            const keys = grp?.options?.map((o) => o.name) || grp?.tags || []
            return Array.from(new Set(keys.map((k) => String(k).trim())))
        }
        return []
    }, [mode, selectedTagGroup, tagGroups])

    const topLevelCategories = React.useMemo(() => categories.filter((c) => !c.parentId), [categories])

    const allProcessedData = React.useMemo(() => {
        if (!data || data.length === 0) return []

        const points = data
            .map((p: HistoryPoint) => {
                const d = new Date(p.date)
                const point: ChartPoint = {
                    ...p,
                    timestamp: isNaN(d.getTime()) ? 0 : d.getTime(),
                }
                if (mode === "tag") {
                    activeKeys.forEach((key) => {
                        const k = `tag_${selectedTagGroup}_${key}`
                        if (point[k] === undefined || point[k] === null) point[k] = 0
                    })
                }
                return point
            })
            .filter((p) => p.timestamp > 0)
            .sort((a, b) => a.timestamp - b.timestamp)

        const pnlSeries =
            mode === "tag"
                ? activeKeys.map((key) => ({
                    valKey: `tag_${selectedTagGroup}_${key}`,
                    costKey: `tag_cost_${selectedTagGroup}_${key}`,
                    pnlRateKey: `tag_pnl_${selectedTagGroup}_${key}`,
                    pnlValueKey: `tag_pnl_value_${selectedTagGroup}_${key}`,
                }))
                : topLevelCategories
                    .filter((c) => !c.isLiability)
                    .map((cat) => ({
                        valKey: `category_${cat.id}`,
                        costKey: `category_cost_${cat.id}`,
                        pnlRateKey: `pnl_${cat.id}`,
                        pnlValueKey: `pnl_value_${cat.id}`,
                    }))
        applyPnlWithZeroTransitions(points as unknown as Array<Record<string, number | null>>, pnlSeries)

        if (points.length > 0) {
            const seriesKeys = seriesKeysForMetric(metric, mode, selectedTagGroup, activeKeys, topLevelCategories)
            const targetBaseTime = baseDate ? baseDate.getTime() : points[0].timestamp
            applyBaseDateDiff(points as unknown as Array<Record<string, unknown> & { timestamp: number }>, targetBaseTime, seriesKeys)
        }

        return points
    }, [data, activeKeys, mode, selectedTagGroup, topLevelCategories, metric, baseDate])

    const baseWindowMs = React.useMemo(() => {
        if (timeRange === "ALL") return null
        const now = new Date()
        const past = new Date()
        if (timeRange === "1M") past.setMonth(now.getMonth() - 1)
        else if (timeRange === "3M") past.setMonth(now.getMonth() - 3)
        else if (timeRange === "1Y") past.setFullYear(now.getFullYear() - 1)
        return now.getTime() - past.getTime()
    }, [timeRange])

    const currentDomain = React.useMemo(() => {
        if (!allProcessedData.length) return ["dataMin", "dataMax"] as [number | "dataMin", number | "dataMax"]

        const dataMinTime = allProcessedData[0].timestamp
        const dataMaxTime = allProcessedData[allProcessedData.length - 1].timestamp

        let minT, maxT
        if (timeRange === "ALL") {
            const dataRange = dataMaxTime - dataMinTime
            const rightPadding = dataRange / 9
            maxT = dataMaxTime + rightPadding + domainOffset
            minT = dataMinTime + domainOffset
        } else {
            const windowMs = baseWindowMs || 0
            const rightPadding = windowMs * 0.1
            maxT = dataMaxTime + rightPadding + domainOffset
            minT = maxT - windowMs
        }

        return [minT, maxT] as [number, number]
    }, [allProcessedData, timeRange, domainOffset, baseWindowMs])

    const activePoint = React.useMemo(() => {
        if (!allProcessedData.length) return null
        let minT = 0
        let maxT = 0
        if (currentDomain[0] === "dataMin") {
            minT = allProcessedData[0].timestamp
            maxT = allProcessedData[allProcessedData.length - 1].timestamp
        } else {
            minT = currentDomain[0] as number
            maxT = currentDomain[1] as number
        }
        const targetTime = maxT - (maxT - minT) * 0.1
        return findNearestPointByTimestamp(allProcessedData, targetTime)
    }, [allProcessedData, currentDomain])

    const baseAnchorPoint = React.useMemo(() => {
        if (!baseDate || !allProcessedData.length) return null
        return findNearestPointByTimestamp(allProcessedData, baseDate.getTime())
    }, [baseDate, allProcessedData])

    const seriesDiffKeys = React.useMemo(
        () => seriesKeysForMetric(metric, mode, selectedTagGroup, activeKeys, topLevelCategories).map((s) => s.diffKey),
        [metric, mode, selectedTagGroup, activeKeys, topLevelCategories]
    )

    const legendItems = React.useMemo(() => {
        if (mode === "tag") {
            const activeGroup = tagGroups.find((g) => g.id === selectedTagGroup)
            const targetTags = activeGroup?.options?.map((o) => o.name) || activeGroup?.tags || []
            return activeKeys.map((key) => {
                const colorIndex = targetTags.indexOf(key)
                return {
                    key,
                    name: key,
                    color: `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`,
                    diffKey: `tag_base_diff_${selectedTagGroup}_${key}`,
                }
            })
        }
        return topLevelCategories
            .filter((c) => !c.isLiability)
            .map((cat, index) => ({
                key: String(cat.id),
                name: cat.name,
                color: cat.color || `var(--chart-${(index % 12) + 1})`,
                diffKey: `base_diff_${cat.id}`,
            }))
    }, [mode, activeKeys, selectedTagGroup, tagGroups, topLevelCategories])

    const visibleDiffDomain = React.useMemo(() => {
        if (!allProcessedData.length) return [-10000, 10000] as [number, number]

        const dataMaxTime = allProcessedData[allProcessedData.length - 1].timestamp
        const rawMinT = currentDomain[0] === "dataMin" ? allProcessedData[0].timestamp : (currentDomain[0] as number)
        const rawMaxT = currentDomain[1] === "dataMax" ? dataMaxTime : (currentDomain[1] as number)
        const minT = rawMinT
        const maxT = Math.min(rawMaxT, dataMaxTime)

        const visiblePoints = allProcessedData.filter((p) => p.timestamp >= minT && p.timestamp <= maxT)
        if (!visiblePoints.length || !seriesDiffKeys.length) return [-10000, 10000] as [number, number]

        let minValue = Number.POSITIVE_INFINITY
        let maxValue = Number.NEGATIVE_INFINITY

        visiblePoints.forEach((point) => {
            seriesDiffKeys.forEach((key) => {
                const raw = (point as Record<string, unknown>)[key]
                if (!isPlottablePnlValue(raw)) return
                const value = Number(raw)
                if (value < minValue) minValue = value
                if (value > maxValue) maxValue = value
            })
        })

        if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return [-10000, 10000] as [number, number]

        const isRateMetric = metric === "pnl"
        const minPad = isRateMetric ? 2 : 10000

        if (minValue === maxValue) {
            const pad = Math.max(Math.abs(minValue) * 0.2, minPad)
            return [Math.min(minValue - pad, 0), Math.max(maxValue + pad, 0)] as [number, number]
        }

        const span = maxValue - minValue
        const pad = Math.max(span * 0.1, minPad)
        return [Math.min(minValue - pad, 0), Math.max(maxValue + pad, 0)] as [number, number]
    }, [allProcessedData, currentDomain, seriesDiffKeys, metric])

    const chartConfig = React.useMemo(() => {
        const config: ChartConfig = {}
        activeKeys.forEach((key) => {
            config[`tag_${selectedTagGroup}_${key}`] = { label: key }
        })
        return config
    }, [activeKeys, selectedTagGroup])

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
        setDragStartX(clientX)
    }

    const scheduleDomainOffset = React.useCallback((timeShift: number, dataMinTime: number, dataMaxTime: number) => {
        dragShiftRef.current += timeShift
        if (dragRafRef.current !== null) return
        dragRafRef.current = requestAnimationFrame(() => {
            const shift = dragShiftRef.current
            dragShiftRef.current = 0
            dragRafRef.current = null
            onDomainOffsetChange((prev) => clampDomainOffset(prev + shift, dataMinTime, dataMaxTime))
        })
    }, [onDomainOffsetChange])

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (dragStartX === null || !allProcessedData.length) return
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
        const dx = clientX - dragStartX

        if (chartRef.current && currentDomain[0] !== "dataMin") {
            const width = chartRef.current.clientWidth
            const [minT, maxT] = currentDomain as [number, number]
            const timePerPixel = (maxT - minT) / width
            const timeShift = -dx * timePerPixel
            const dataMinTime = allProcessedData[0].timestamp
            const dataMaxTime = allProcessedData[allProcessedData.length - 1].timestamp
            scheduleDomainOffset(timeShift, dataMinTime, dataMaxTime)
            setDragStartX(clientX)
        }
    }

    const handleMouseUp = () => setDragStartX(null)

    if (!isMounted) {
        return (
            <div className="flex items-center justify-center bg-muted/5 border-dashed" style={{ height: 220 }}>
                <p className="text-xs text-muted-foreground animate-pulse">グラフを構成中...</p>
            </div>
        )
    }

    const formatXAxis = (tickItem: number) => {
        const date = new Date(tickItem)
        if (isNaN(date.getTime())) return ""
        return `${date.getFullYear()}/${date.getMonth() + 1}`
    }

    const formatYAxis = (val: number) => {
        if (metric === "pnl") return `${val.toFixed(1)}pt`
        return `${Math.round(val / 10000)}万`
    }

    const formatLegendValue = (val: number) => {
        const sign = val > 0 ? "+" : ""
        if (metric === "pnl") return `${sign}${val.toFixed(1)}pt`
        return `${sign}${Math.round(val).toLocaleString()}円`
    }

    return (
        <div className="flex flex-col w-full">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground">{metricLabel}</span>
                <button
                    type="button"
                    onClick={() => setShowLegend((v) => !v)}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                >
                    {showLegend ? "凡例を隠す" : "凡例を表示"}
                </button>
            </div>
            {showLegend && (
                <div className="px-4 pb-1 flex flex-col gap-1">
                    {legendItems.map((item) => {
                        const raw = activePoint ? (activePoint as Record<string, unknown>)[item.diffKey] : null
                        const val = isPlottablePnlValue(raw) ? Number(raw) : null
                        return (
                            <div key={item.key} className="flex items-center gap-2 text-[11px]">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="text-muted-foreground truncate flex-1">{item.name}</span>
                                <span
                                    className={`font-bold tabular-nums ${val !== null && val < 0 ? "text-rose-500" : val !== null && val > 0 ? "text-emerald-500" : ""}`}
                                >
                                    {val === null ? "--" : formatLegendValue(val)}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
            <div
                className="flex-none w-full px-2 pb-2 select-none shrink-0"
                ref={chartRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
                style={{ height: 220, touchAction: "none", cursor: dragStartX !== null ? "grabbing" : "grab" }}
            >
                <ChartContainer config={chartConfig} className="h-full w-full aspect-auto min-h-0 text-[10px] pointer-events-none">
                    <ComposedChart
                        key={`${mode}-${selectedTagGroup}-${metric}-${timeRange}`}
                        data={allProcessedData}
                        margin={{ top: 20, right: 30, left: 10, bottom: 12 }}
                    >
                        <CartesianGrid vertical={false} stroke="currentColor" strokeDasharray="3 3" strokeOpacity={0.2} />

                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            domain={currentDomain}
                            tickFormatter={formatXAxis}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "currentColor", fontSize: 10, opacity: 0.5 }}
                            tickMargin={10}
                            allowDataOverflow={true}
                        />
                        <YAxis
                            tickFormatter={formatYAxis}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "currentColor", fontSize: 10, opacity: 0.5 }}
                            width={44}
                            domain={visibleDiffDomain}
                            allowDataOverflow={true}
                        />

                        {activePoint && (
                            <ReferenceLine
                                x={activePoint.timestamp}
                                stroke="#888888"
                                strokeOpacity={0.6}
                                strokeWidth={1}
                                strokeDasharray="5 5"
                                label={(props: Record<string, unknown>) => {
                                    const viewBox = props.viewBox as { x: number; y: number }
                                    const d = new Date(activePoint.timestamp)
                                    const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
                                    return (
                                        <text x={viewBox.x} y={12} fill="#888888" fontSize={10} fontWeight="bold" textAnchor="middle">
                                            {dateStr}
                                        </text>
                                    )
                                }}
                            />
                        )}

                        {baseAnchorPoint && (
                            <ReferenceLine
                                x={baseAnchorPoint.timestamp}
                                stroke="var(--chart-1)"
                                strokeOpacity={0.6}
                                strokeWidth={1.5}
                            />
                        )}

                        <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 4" />

                        {mode === "total" &&
                            topLevelCategories
                                .filter((c) => !c.isLiability)
                                .map((cat, index) => {
                                    const color = cat.color || `var(--chart-${(index % 12) + 1})`
                                    return (
                                        <Line
                                            key={cat.id}
                                            dataKey={`base_diff_${cat.id}`}
                                            type="linear"
                                            stroke={color}
                                            strokeWidth={1.5}
                                            dot={false}
                                            isAnimationActive={false}
                                        />
                                    )
                                })}

                        {mode === "tag" &&
                            activeKeys.map((key) => {
                                const activeGroup = tagGroups.find((g) => g.id === selectedTagGroup)
                                const targetTags = activeGroup?.options?.map((o) => o.name) || activeGroup?.tags || []
                                const colorIndex = targetTags.indexOf(key)
                                const color = `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`
                                return (
                                    <Line
                                        key={key}
                                        dataKey={`tag_base_diff_${selectedTagGroup}_${key}`}
                                        type="linear"
                                        stroke={color}
                                        strokeWidth={1.5}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                )
                            })}

                        {activePoint &&
                            (mode === "tag"
                                ? activeKeys.map((key) => {
                                    const dataKey = `tag_base_diff_${selectedTagGroup}_${key}`
                                    const raw = (activePoint as Record<string, unknown>)[dataKey]
                                    if (!isPlottablePnlValue(raw)) return null
                                    const val = Number(raw || 0)
                                    const activeGroup = tagGroups.find((g) => g.id === selectedTagGroup)
                                    const targetTags = activeGroup?.options?.map((o) => o.name) || activeGroup?.tags || []
                                    const colorIndex = targetTags.indexOf(key)
                                    const color = `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`
                                    return (
                                        <ReferenceDot
                                            key={key}
                                            x={activePoint.timestamp}
                                            y={val}
                                            r={3}
                                            fill={color}
                                            stroke="var(--background)"
                                            strokeWidth={2}
                                            isFront={true}
                                        />
                                    )
                                })
                                : topLevelCategories
                                    .filter((c) => !c.isLiability)
                                    .map((cat, index) => {
                                        const dataKey = `base_diff_${cat.id}`
                                        const raw = (activePoint as Record<string, unknown>)[dataKey]
                                        if (!isPlottablePnlValue(raw)) return null
                                        const val = Number(raw || 0)
                                        const color = cat.color || `var(--chart-${(index % 12) + 1})`
                                        return (
                                            <ReferenceDot
                                                key={cat.id}
                                                x={activePoint.timestamp}
                                                y={val}
                                                r={3}
                                                fill={color}
                                                stroke="var(--background)"
                                                strokeWidth={2}
                                                isFront={true}
                                            />
                                        )
                                    }))}
                    </ComposedChart>
                </ChartContainer>
            </div>
        </div>
    )
}
