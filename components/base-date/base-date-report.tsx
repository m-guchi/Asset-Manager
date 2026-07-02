"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { CalendarIcon } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Category, HistoryPoint, TagGroup } from "@/types/asset"
import type { BaseDateMetric } from "@/components/base-date/base-date-metric-chart"

const BaseDateMetricChart = dynamic(
    () => import("@/components/base-date/base-date-metric-chart").then((m) => m.BaseDateMetricChart),
    { ssr: false, loading: () => <Skeleton className="w-full" style={{ height: 220 }} /> }
)

const METRICS: { metric: BaseDateMetric; label: string }[] = [
    { metric: "value", label: "評価額" },
    { metric: "cost", label: "取得額" },
    { metric: "pnl", label: "損益率" },
    { metric: "pnlValue", label: "損益額" },
    { metric: "realizedGain", label: "実現益" },
]

function formatDateLabel(d: Date): string {
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

interface BaseDateReportProps {
    historyData: HistoryPoint[]
    categories: Category[]
    tagGroups: TagGroup[]
    initialTimeRange: string
}

export function BaseDateReport({
    historyData,
    categories,
    tagGroups,
    initialTimeRange,
}: BaseDateReportProps) {
    const [mode, setMode] = React.useState<"total" | "tag">("total")
    const [selectedTagGroup, setSelectedTagGroup] = React.useState<number>(tagGroups[0]?.id ?? 1)
    const [timeRange, setTimeRange] = React.useState(initialTimeRange)
    const [baseDate, setBaseDate] = React.useState<Date | undefined>(undefined)
    const [baseDatePickerOpen, setBaseDatePickerOpen] = React.useState(false)
    const [domainOffset, setDomainOffset] = React.useState(0)
    const [visibleMetrics, setVisibleMetrics] = React.useState<Record<BaseDateMetric, boolean>>({
        value: true,
        cost: true,
        pnl: true,
        pnlValue: true,
        realizedGain: true,
    })

    const toggleMetric = (metric: BaseDateMetric) => {
        setVisibleMetrics((prev) => ({ ...prev, [metric]: !prev[metric] }))
    }

    // 期間ボタンが変わったら、手動でずらした位置をリセットする
    React.useEffect(() => {
        setDomainOffset(0)
    }, [timeRange])

    const sortedTimestamps = React.useMemo(() => {
        return historyData
            .map((p) => new Date(p.date).getTime())
            .filter((t) => !isNaN(t))
            .sort((a, b) => a - b)
    }, [historyData])

    // 未選択なら、表示中の期間の開始日をデフォルトの基準日にする
    React.useEffect(() => {
        if (baseDate || !sortedTimestamps.length) return
        const now = new Date()
        const past = new Date()
        if (timeRange === "1M") past.setMonth(now.getMonth() - 1)
        else if (timeRange === "3M") past.setMonth(now.getMonth() - 3)
        else if (timeRange === "1Y") past.setFullYear(now.getFullYear() - 1)
        else {
            setBaseDate(new Date(sortedTimestamps[0]))
            return
        }
        const clamped = Math.max(past.getTime(), sortedTimestamps[0])
        setBaseDate(new Date(clamped))
    }, [baseDate, sortedTimestamps, timeRange])

    return (
        <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-3 pt-3 border-b gap-2">
                <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
                    <div className="flex bg-muted/50 rounded-md p-0.5 border shrink-0">
                        <button
                            onClick={() => setMode("total")}
                            className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all whitespace-nowrap ${mode === "total"
                                ? "bg-background text-foreground shadow-sm font-bold"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        >
                            全体
                        </button>
                        {tagGroups.map((grp) => (
                            <button
                                key={grp.id}
                                onClick={() => {
                                    setMode("tag")
                                    setSelectedTagGroup(grp.id)
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

                <div className="w-full flex flex-wrap items-center gap-2">
                    <div className="flex bg-muted/50 rounded-md p-0.5 border shrink-0">
                        {["1M", "3M", "1Y", "ALL"].map((range) => {
                            const label = { "1M": "1ヶ月", "3M": "3ヶ月", "1Y": "1年", "ALL": "全期間" }[range] || range
                            return (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all whitespace-nowrap ${timeRange === range
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    {label}
                                </button>
                            )
                        })}
                    </div>

                    <div className="flex flex-wrap items-center gap-1 shrink-0">
                        {METRICS.map(({ metric, label }) => (
                            <button
                                key={metric}
                                type="button"
                                onClick={() => toggleMetric(metric)}
                                aria-pressed={visibleMetrics[metric]}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-md border transition-all whitespace-nowrap ${visibleMetrics[metric]
                                    ? "bg-background text-foreground shadow-sm border-border"
                                    : "bg-transparent text-muted-foreground border-transparent opacity-50 hover:opacity-80"}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="ml-auto shrink-0">
                        <Popover open={baseDatePickerOpen} onOpenChange={setBaseDatePickerOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="px-3 py-1.5 text-[11px] font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 bg-background text-foreground shadow-sm border hover:bg-muted/80"
                                >
                                    <CalendarIcon className="h-3 w-3 opacity-50" />
                                    <span className="opacity-50">基準日:</span>
                                    <span>{baseDate ? formatDateLabel(baseDate) : "--"}</span>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent side="bottom" align="end" className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={baseDate}
                                    onSelect={(d) => {
                                        if (d) {
                                            setBaseDate(d)
                                            setBaseDatePickerOpen(false)
                                        }
                                    }}
                                    disabled={(date) => {
                                        if (!sortedTimestamps.length) return true
                                        return (
                                            date.getTime() < sortedTimestamps[0] ||
                                            date.getTime() > sortedTimestamps[sortedTimestamps.length - 1]
                                        )
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0 divide-y">
                {METRICS.every(({ metric }) => !visibleMetrics[metric]) && (
                    <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                        表示するグラフを選択してください
                    </p>
                )}
                {METRICS.filter(({ metric }) => visibleMetrics[metric]).map(({ metric, label }) => (
                    <BaseDateMetricChart
                        key={metric}
                        data={historyData}
                        categories={categories}
                        tagGroups={tagGroups}
                        mode={mode}
                        selectedTagGroup={selectedTagGroup}
                        metric={metric}
                        metricLabel={label}
                        baseDate={baseDate ?? null}
                        timeRange={timeRange}
                        domainOffset={domainOffset}
                        onDomainOffsetChange={setDomainOffset}
                    />
                ))}
            </CardContent>
        </Card>
    )
}
