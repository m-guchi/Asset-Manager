"use client"
import * as React from "react"
import { Area, CartesianGrid, XAxis, ResponsiveContainer, YAxis, ReferenceLine, ReferenceDot, ComposedChart, Line } from "recharts"
import { Check, ChevronDown } from "lucide-react"

import { ChartConfig, ChartContainer } from "@/components/ui/chart"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { HistoryPoint, TagGroup, Category, ChartViewMode } from "@/types/asset"

const VIEW_MODE_OPTIONS = [
    { value: "value", label: "評価額" },
    { value: "percent", label: "構成比" },
    { value: "pnl", label: "損益率" },
    { value: "pnlValue", label: "損益額" },
] as const satisfies readonly { value: ChartViewMode; label: string }[]

const VIEW_MODE_LABELS = Object.fromEntries(
    VIEW_MODE_OPTIONS.map(({ value, label }) => [value, label])
) as Record<ChartViewMode, string>

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
    mode: "total" | "tag";
    selectedTagGroup: number;
    onActivePointChange?: (point: ChartPoint | null) => void;
    categories?: Category[];
    selectedAssetKey?: string | null;
    viewMode: ChartViewMode;
    onViewModeChange: (mode: ChartViewMode) => void;
}

export function AssetHistoryChart({
    data = [],
    tagGroups = mockTagGroups,
    initialTimeRange = "1Y",
    mode,
    selectedTagGroup,
    onActivePointChange,
    categories = [],
    selectedAssetKey,
    viewMode,
    onViewModeChange
}: AssetHistoryChartProps) {
    const [isMounted, setIsMounted] = React.useState(false);
    const [timeRange, setTimeRange] = React.useState(initialTimeRange)
    const showPercent = viewMode === "percent"
    const isPnlRateMode = viewMode === "pnl"
    const isPnlValueMode = viewMode === "pnlValue"
    const isAnyPnlMode = isPnlRateMode || isPnlValueMode
    const [isAnimating, setIsAnimating] = React.useState(false)
    const [viewModeOpen, setViewModeOpen] = React.useState(false)

    // ドラッグ(スワイプ)用ステート
    const [dragStartX, setDragStartX] = React.useState<number | null>(null)
    const [domainOffset, setDomainOffset] = React.useState<number>(0)
    const chartRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setIsAnimating(true)
        const timer = setTimeout(() => setIsAnimating(false), 1500)
        return () => clearTimeout(timer)
    }, [mode, selectedTagGroup, showPercent, timeRange])

    React.useEffect(() => {
        setIsMounted(true);
        const savedRange = localStorage.getItem("defaultTimeRange");
        if (savedRange) {
            setTimeRange(savedRange);
        }
    }, []);

    const handleTimeRangeChange = (range: string) => {
        setTimeRange(range);
        setDomainOffset(0); // リセット
        localStorage.setItem("defaultTimeRange", range);
    }

    const activeKeys = React.useMemo(() => {
        if (mode === "tag") {
            const grp = tagGroups.find((g: TagGroup) => g.id === selectedTagGroup)
            const keys = grp?.options?.map((o: { name: string }) => o.name) || grp?.tags || []
            return Array.from(new Set(keys.map((k: string) => String(k).trim())))
        }
        return []
    }, [mode, selectedTagGroup, tagGroups])

    // 全データの加工 (フィルタリングなし)
    const allProcessedData = React.useMemo(() => {
        if (!data || data.length === 0) return []
        const topLevelCategories = categories.filter(c => !c.parentId)
        return data
            .map((p: HistoryPoint) => {
                const d = new Date(p.date)
                const point: ChartPoint = {
                    ...p,
                    totalAssets: Number(p.totalAssets || 0),
                    totalCost: Number(p.totalCost || 0),
                    netWorth: Number(p.netWorth ?? p.totalAssets ?? 0),
                    timestamp: isNaN(d.getTime()) ? 0 : d.getTime()
                }

                if (mode === "tag") {
                    activeKeys.forEach((key: string) => {
                        const k = `tag_${selectedTagGroup}_${key}`
                        if (point[k as keyof ChartPoint] === undefined || point[k as keyof ChartPoint] === null) {
                            (point as Record<string, unknown>)[k] = 0
                        }
                    })
                }

                // カテゴリ別損益率を計算
                topLevelCategories.forEach(cat => {
                    const val = Number((point as Record<string, unknown>)[`category_${cat.id}`] || 0)
                    const cost = Number((point as Record<string, unknown>)[`category_cost_${cat.id}`] || 0)
                    ;(point as Record<string, unknown>)[`pnl_${cat.id}`] = cost > 0 ? ((val - cost) / cost) * 100 : 0
                    ;(point as Record<string, unknown>)[`pnl_value_${cat.id}`] = val - cost
                })

                // タグ別損益率を計算
                if (mode === "tag") {
                    activeKeys.forEach((key: string) => {
                        const valKey = `tag_${selectedTagGroup}_${key}`
                        const costKey = `tag_cost_${selectedTagGroup}_${key}`
                        const val = Number((point as Record<string, unknown>)[valKey] || 0)
                        const cost = Number((point as Record<string, unknown>)[costKey] || 0)
                        ;(point as Record<string, unknown>)[`tag_pnl_${selectedTagGroup}_${key}`] = cost > 0 ? ((val - cost) / cost) * 100 : 0
                        ;(point as Record<string, unknown>)[`tag_pnl_value_${selectedTagGroup}_${key}`] = val - cost
                    })
                }

                return point
            })
            .filter(p => p.timestamp > 0)
            .sort((a, b) => a.timestamp - b.timestamp)
    }, [data, activeKeys, mode, selectedTagGroup, categories])

    const baseWindowMs = React.useMemo(() => {
        if (timeRange === "ALL") return null;
        const now = new Date();
        const past = new Date();
        if (timeRange === "1M") past.setMonth(now.getMonth() - 1);
        else if (timeRange === "3M") past.setMonth(now.getMonth() - 3);
        else if (timeRange === "1Y") past.setFullYear(now.getFullYear() - 1);
        return now.getTime() - past.getTime();
    }, [timeRange]);

    const currentDomain = React.useMemo(() => {
        if (!allProcessedData.length) return ['dataMin', 'dataMax'] as [number | 'dataMin', number | 'dataMax'];
        
        const dataMinTime = allProcessedData[0].timestamp;
        const dataMaxTime = allProcessedData[allProcessedData.length - 1].timestamp;

        let minT, maxT;
        if (timeRange === "ALL") {
            const dataRange = dataMaxTime - dataMinTime;
            // 右側に全体幅の10%にあたる余白を持たせる
            const rightPadding = dataRange / 9;
            maxT = dataMaxTime + rightPadding + domainOffset;
            minT = dataMinTime + domainOffset;
        } else {
            const windowMs = baseWindowMs || 0;
            const rightPadding = windowMs * 0.1;
            maxT = dataMaxTime + rightPadding + domainOffset;
            minT = maxT - windowMs;
        }

        return [minT, maxT] as [number, number];
    }, [allProcessedData, timeRange, domainOffset, baseWindowMs]);

    const activePoint = React.useMemo(() => {
        if (!allProcessedData.length) return null;
        
        let minT = 0;
        let maxT = 0;

        if (currentDomain[0] === 'dataMin') {
            minT = allProcessedData[0].timestamp;
            maxT = allProcessedData[allProcessedData.length - 1].timestamp;
        } else {
            minT = currentDomain[0] as number;
            maxT = currentDomain[1] as number;
        }

        const targetTime = maxT - (maxT - minT) * 0.1;

        // targetTime に一番近いデータを検索
        return allProcessedData.reduce((prev, curr) => 
            Math.abs(curr.timestamp - targetTime) < Math.abs(prev.timestamp - targetTime) ? curr : prev
        );
    }, [allProcessedData, currentDomain]);

    const visiblePnlDomain = React.useMemo(() => {
        if (!allProcessedData.length) return [-1, 1] as [number, number]

        const dataMaxTime = allProcessedData[allProcessedData.length - 1].timestamp
        const rawMinT = currentDomain[0] === "dataMin" ? allProcessedData[0].timestamp : (currentDomain[0] as number)
        const rawMaxT = currentDomain[1] === "dataMax" ? dataMaxTime : (currentDomain[1] as number)
        // 右側は未来余白を含むため、実データ最大時刻でクランプ
        const minT = rawMinT
        const maxT = Math.min(rawMaxT, dataMaxTime)

        const visiblePoints = allProcessedData.filter((p) => p.timestamp >= minT && p.timestamp <= maxT)
        if (!visiblePoints.length) return [-1, 1] as [number, number]

        const seriesKeys =
            mode === "tag"
                ? activeKeys
                      .filter((key) => !selectedAssetKey || selectedAssetKey === `tag_${selectedTagGroup}_${key}`)
                      .map((key) => `tag_pnl_${selectedTagGroup}_${key}`)
                : categories
                      .filter((c) => !c.parentId && !c.isLiability)
                      .filter((c) => !selectedAssetKey || selectedAssetKey === `category_${c.id}`)
                      .map((c) => `pnl_${c.id}`)

        if (!seriesKeys.length) return [-1, 1] as [number, number]

        let minValue = Number.POSITIVE_INFINITY
        let maxValue = Number.NEGATIVE_INFINITY

        visiblePoints.forEach((point) => {
            seriesKeys.forEach((key) => {
                const value = Number((point as Record<string, unknown>)[key])
                if (!Number.isFinite(value)) return
                if (value < minValue) minValue = value
                if (value > maxValue) maxValue = value
            })
        })

        if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return [-1, 1] as [number, number]

        if (minValue === maxValue) {
            const pad = Math.max(Math.abs(minValue) * 0.2, 5)
            const domainMin = Math.min(minValue - pad, 0)
            const domainMax = Math.max(maxValue + pad, 0)
            return [domainMin, domainMax] as [number, number]
        }

        const span = maxValue - minValue
        const pad = Math.max(span * 0.1, 2)
        const domainMin = Math.min(minValue - pad, 0)
        const domainMax = Math.max(maxValue + pad, 0)
        return [domainMin, domainMax] as [number, number]
    }, [allProcessedData, currentDomain, mode, activeKeys, selectedTagGroup, categories, selectedAssetKey])

    const visiblePnlValueDomain = React.useMemo(() => {
        if (!allProcessedData.length) return [-10000, 10000] as [number, number]

        const dataMaxTime = allProcessedData[allProcessedData.length - 1].timestamp
        const rawMinT = currentDomain[0] === "dataMin" ? allProcessedData[0].timestamp : (currentDomain[0] as number)
        const rawMaxT = currentDomain[1] === "dataMax" ? dataMaxTime : (currentDomain[1] as number)
        const minT = rawMinT
        const maxT = Math.min(rawMaxT, dataMaxTime)

        const visiblePoints = allProcessedData.filter((p) => p.timestamp >= minT && p.timestamp <= maxT)
        if (!visiblePoints.length) return [-10000, 10000] as [number, number]

        const seriesKeys =
            mode === "tag"
                ? activeKeys
                      .filter((key) => !selectedAssetKey || selectedAssetKey === `tag_${selectedTagGroup}_${key}`)
                      .map((key) => `tag_pnl_value_${selectedTagGroup}_${key}`)
                : categories
                      .filter((c) => !c.parentId && !c.isLiability)
                      .filter((c) => !selectedAssetKey || selectedAssetKey === `category_${c.id}`)
                      .map((c) => `pnl_value_${c.id}`)

        if (!seriesKeys.length) return [-10000, 10000] as [number, number]

        let minValue = Number.POSITIVE_INFINITY
        let maxValue = Number.NEGATIVE_INFINITY

        visiblePoints.forEach((point) => {
            seriesKeys.forEach((key) => {
                const value = Number((point as Record<string, unknown>)[key])
                if (!Number.isFinite(value)) return
                if (value < minValue) minValue = value
                if (value > maxValue) maxValue = value
            })
        })

        if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return [-10000, 10000] as [number, number]

        if (minValue === maxValue) {
            const pad = Math.max(Math.abs(minValue) * 0.2, 10000)
            return [minValue - pad, maxValue + pad] as [number, number]
        }

        const span = maxValue - minValue
        const pad = Math.max(span * 0.1, 10000)
        return [minValue - pad, maxValue + pad] as [number, number]
    }, [allProcessedData, currentDomain, mode, activeKeys, selectedTagGroup, categories, selectedAssetKey])

    // Y軸のドメイン計算
    const yAxisDomain = React.useMemo(() => {
        if (viewMode === "percent") return [0, 1] as [number, number]
        if (viewMode === "pnl") return visiblePnlDomain
        if (viewMode === "pnlValue") return visiblePnlValueDomain
        return ['auto', 'auto']
    }, [viewMode, visiblePnlDomain, visiblePnlValueDomain])

    const [debouncedActivePoint, setDebouncedActivePoint] = React.useState<ChartPoint | null>(null);

    React.useEffect(() => {
        // ドラッグ中なら何もしない
        if (dragStartX !== null) return;
        
        // ドラッグ停止後、少し遅延を入れてから確定させる（レンダリング負荷軽減）
        const timer = setTimeout(() => {
            setDebouncedActivePoint(activePoint);
        }, 150);
        return () => clearTimeout(timer);
    }, [activePoint, dragStartX]);

    React.useEffect(() => {
        if (onActivePointChange && debouncedActivePoint) {
            onActivePointChange(debouncedActivePoint);
        }
    }, [debouncedActivePoint, onActivePointChange]);

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

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        setDragStartX(clientX);
        // ドラッグ開始時にアニメーションをオフにする（カクつき防止）
        setIsAnimating(false);
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (dragStartX === null || !allProcessedData.length) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const dx = clientX - dragStartX;
        
        if (chartRef.current && currentDomain[0] !== 'dataMin') {
            const width = chartRef.current.clientWidth;
            const [minT, maxT] = currentDomain as [number, number];
            const timePerPixel = (maxT - minT) / width;
            
            const timeShift = -dx * timePerPixel;
            
            const dataMinTime = allProcessedData[0].timestamp;
            const dataMaxTime = allProcessedData[allProcessedData.length - 1].timestamp;

            setDomainOffset(prev => {
                let newOffset = prev + timeShift;
                // 未来方向への移動制限（ドメイン初期位置が上限）
                if (newOffset > 0) newOffset = 0;
                
                // 過去方向への移動制限
                // 最初のデータ(dataMinTime)が点線の位置(右から10%)に来る限界までスクロールを許可する
                const minOffset = dataMinTime - dataMaxTime;
                
                if (minOffset >= 0) {
                    newOffset = 0;
                } else if (newOffset < minOffset) {
                    // 左へ引っ張りすぎた場合
                    newOffset = minOffset;
                }
                
                return newOffset;
            });
            setDragStartX(clientX);
        }
    };

    const handleMouseUp = () => {
        setDragStartX(null);
    };

    if (!isMounted) {
        return (
            <div className="h-full min-h-[300px] flex items-center justify-center bg-muted/5 border-dashed">
                <p className="text-xs text-muted-foreground animate-pulse">グラフを構成中...</p>
            </div>
        );
    }

    const formatXAxis = (tickItem: number) => {
        const date = new Date(tickItem)
        if (isNaN(date.getTime())) return ""
        return `${date.getFullYear()}/${date.getMonth() + 1}`
    }

    const shouldHighlightOnlySelected = viewMode === "value"
    const isDimmedKey = (key: string) => !shouldHighlightOnlySelected && !!selectedAssetKey && selectedAssetKey !== key

    return (
        <div className="flex flex-col h-full min-h-[400px] w-full pt-1">
            <div className="flex flex-col flex-1 p-0 relative min-h-0 overflow-hidden w-full">
                <ChartContainer config={chartConfig} className="flex-1 min-h-0 w-full text-[10px]">
                    <div className="flex flex-col h-full w-full">
                        <div 
                            className="flex-1 w-full min-h-[250px] px-2 py-2 select-none" 
                            ref={chartRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleMouseDown}
                            onTouchMove={handleMouseMove}
                            onTouchEnd={handleMouseUp}
                            style={{ touchAction: "none", cursor: dragStartX !== null ? "grabbing" : "grab" }}
                        >
                            <ResponsiveContainer width="100%" height="100%" style={{ pointerEvents: "none" }}>
                                <ComposedChart
                                    key={`${mode}-${selectedTagGroup}-${showPercent}-${timeRange}`}
                                    data={allProcessedData}
                                    stackOffset={showPercent ? "expand" : "none"}
                                    margin={{ top: 25, right: 30, left: 10, bottom: 0 }}
                                >
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.2} />
                                    
                                    <XAxis
                                        dataKey="timestamp"
                                        type="number"
                                        domain={currentDomain}
                                        tickFormatter={formatXAxis}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.5 }}
                                        tickMargin={10}
                                        allowDataOverflow={true}
                                    />
                                    <YAxis
                                        tickFormatter={(val) => {
                                            if (viewMode === "percent") return `${(val * 100).toFixed(0)}%`
                                            if (viewMode === "pnl") return `${val.toFixed(1)}%`
                                            if (viewMode === "pnlValue") return `${Math.round(val / 10000)}万`
                                            return `${Math.round(val / 10000)}万`
                                        }}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.5 }}
                                        width={40}
                                        domain={yAxisDomain}
                                        allowDataOverflow={isAnyPnlMode}
                                    />
                                    {activePoint && (
                                        <ReferenceLine
                                            x={activePoint.timestamp}
                                            stroke="#888888"
                                            strokeOpacity={0.6}
                                            strokeWidth={1}
                                            strokeDasharray="5 5"
                                            label={(props: Record<string, unknown>) => {
                                                const viewBox = props.viewBox as {x: number, y: number};
                                                const d = new Date(activePoint.timestamp);
                                                const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
                                                return (
                                                    <text
                                                        x={viewBox.x}
                                                        y={15}
                                                        fill="#888888"
                                                        fontSize={10}
                                                        fontWeight="bold"
                                                        textAnchor="middle"
                                                    >
                                                        {dateStr}
                                                    </text>
                                                );
                                            }}
                                        />
                                    )}

                                    {/* 評価額・割合モード時の面グラフ */}
                                    {!isAnyPnlMode && mode === "total" && [...categories].reverse().filter((cat: Category) => {
                                        if (cat.isLiability) return false
                                        if (!shouldHighlightOnlySelected) return true
                                        return !selectedAssetKey || selectedAssetKey === `category_${cat.id}`
                                    }).map((cat: Category) => {
                                        const topLevelCategories = categories.filter(c => !c.parentId);
                                        const colorIndex = topLevelCategories.findIndex(tc => tc.id === cat.id);
                                        const color = cat.color || `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`;
                                        const key = `category_${cat.id}`
                                        const isDimmed = isDimmedKey(key)
                                        return (
                                            <Area
                                                key={cat.id}
                                                dataKey={`category_${cat.id}`}
                                                stackId="1"
                                                type="linear"
                                                stroke={color}
                                                fill={color}
                                                fillOpacity={isDimmed ? 0.15 : 0.4}
                                                strokeOpacity={isDimmed ? 0.35 : 1}
                                                isAnimationActive={isAnimating}
                                                animationDuration={1200}
                                            />
                                        );
                                    })}

                                    {!isAnyPnlMode && mode === "tag" && [...activeKeys].reverse().filter((key) => {
                                        if (!shouldHighlightOnlySelected) return true
                                        return !selectedAssetKey || selectedAssetKey === `tag_${selectedTagGroup}_${key}`
                                    }).map((key) => {
                                        const activeGroup = tagGroups.find(g => g.id === selectedTagGroup)
                                        const targetTags = activeGroup?.options?.map(o => o.name) || activeGroup?.tags || []
                                        const colorIndex = targetTags.indexOf(key);
                                        const color = `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`;
                                        const keyName = `tag_${selectedTagGroup}_${key}`
                                        const isDimmed = isDimmedKey(keyName)
                                        return (
                                            <Area
                                                key={key}
                                                dataKey={`tag_${selectedTagGroup}_${key}`}
                                                stackId="1"
                                                type="linear"
                                                stroke={color}
                                                fill={color}
                                                fillOpacity={isDimmed ? 0.15 : 0.4}
                                                strokeOpacity={isDimmed ? 0.35 : 1}
                                                isAnimationActive={isAnimating}
                                                animationDuration={1200}
                                            />
                                        );
                                    })}

                                    {/* 損益率モード時の折れ線グラフ */}
                                    {isAnyPnlMode && mode === "total" && categories.filter(c => !c.parentId && !c.isLiability).map(cat => {
                                        const topLevel = categories.filter(c => !c.parentId && !c.isLiability)
                                        const colorIndex = topLevel.findIndex(c => c.id === cat.id)
                                        const color = cat.color || `var(--chart-${(colorIndex % 12) + 1})`
                                        const key = `category_${cat.id}`
                                        const isDimmed = isDimmedKey(key)
                                        
                                        return (
                                            <Line
                                                key={cat.id}
                                                dataKey={isPnlRateMode ? `pnl_${cat.id}` : `pnl_value_${cat.id}`}
                                                type="linear"
                                                stroke={color}
                                                strokeWidth={1.5}
                                                strokeOpacity={isDimmed ? 0.35 : 1}
                                                dot={false}
                                                isAnimationActive={isAnimating}
                                            />
                                        )
                                    })}

                                    {isAnyPnlMode && mode === "tag" && activeKeys.map(key => {
                                        const activeGroup = tagGroups.find(g => g.id === selectedTagGroup)
                                        const targetTags = activeGroup?.options?.map(o => o.name) || activeGroup?.tags || []
                                        const colorIndex = targetTags.indexOf(key)
                                        const color = `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`
                                        const keyName = `tag_${selectedTagGroup}_${key}`
                                        const isDimmed = isDimmedKey(keyName)
                                        
                                        return (
                                            <Line
                                                key={key}
                                                dataKey={isPnlRateMode ? `tag_pnl_${selectedTagGroup}_${key}` : `tag_pnl_value_${selectedTagGroup}_${key}`}
                                                type="linear"
                                                stroke={color}
                                                strokeWidth={1.5}
                                                strokeOpacity={isDimmed ? 0.35 : 1}
                                                dot={false}
                                                isAnimationActive={isAnimating}
                                            />
                                        )
                                    })}

                                    {isAnyPnlMode && (
                                        <ReferenceLine 
                                            y={0} 
                                            stroke="currentColor" 
                                            strokeOpacity={0.4} 
                                            strokeDasharray="4 4" 
                                        />
                                    )}

                                    {/* 交点の丸マーク */}
                                    {activePoint && (() => {
                                        if (isAnyPnlMode) {
                                            // 損益率モード: 各カテゴリ/タグ独立
                                            if (mode === "tag") {
                                                return activeKeys.map(key => {
                                                    const dataKey = isPnlRateMode ? `tag_pnl_${selectedTagGroup}_${key}` : `tag_pnl_value_${selectedTagGroup}_${key}`
                                                    const val = Number((activePoint as Record<string, unknown>)[dataKey] || 0)
                                                    const activeGroup = tagGroups.find(g => g.id === selectedTagGroup)
                                                    const targetTags = activeGroup?.options?.map(o => o.name) || activeGroup?.tags || []
                                                    const colorIndex = targetTags.indexOf(key)
                                                    const color = `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`
                                                    const keyName = `tag_${selectedTagGroup}_${key}`
                                                    const isDimmed = isDimmedKey(keyName)
                                                    
                                                    return (
                                                        <ReferenceDot
                                                            key={key}
                                                            x={activePoint.timestamp}
                                                            y={val}
                                                            r={3}
                                                            fill={color}
                                                            fillOpacity={isDimmed ? 0.35 : 1}
                                                            stroke="var(--background)"
                                                            strokeWidth={2}
                                                            isFront={true}
                                                        />
                                                    )
                                                })
                                            } else {
                                                return categories.filter(c => !c.parentId && !c.isLiability).map(cat => {
                                                    const dataKey = isPnlRateMode ? `pnl_${cat.id}` : `pnl_value_${cat.id}`
                                                    const val = Number((activePoint as Record<string, unknown>)[dataKey] || 0)
                                                    const topLevel = categories.filter(c => !c.parentId && !c.isLiability)
                                                    const colorIndex = topLevel.findIndex(c => c.id === cat.id)
                                                    const color = cat.color || `var(--chart-${(colorIndex % 12) + 1})`
                                                    const key = `category_${cat.id}`
                                                    const isDimmed = isDimmedKey(key)
                                                    
                                                    return (
                                                        <ReferenceDot
                                                            key={cat.id}
                                                            x={activePoint.timestamp}
                                                            y={val}
                                                            r={3}
                                                            fill={color}
                                                            fillOpacity={isDimmed ? 0.35 : 1}
                                                            stroke="var(--background)"
                                                            strokeWidth={2}
                                                            isFront={true}
                                                        />
                                                    )
                                                })
                                            }
                                        }

                                        // 評価額・割合モード: 積み上げ
                                        let cumulativeY = 0;
                                        if (mode === "tag") {
                                            const reversedActiveKeys = [...activeKeys].reverse();
                                            const sum = reversedActiveKeys.reduce((a: number, key: string) => a + Number((activePoint as Record<string, unknown>)[`tag_${selectedTagGroup}_${key}`] || 0), 0) || 1;
                                            
                                            return reversedActiveKeys.filter((key: string) => {
                                                if (!shouldHighlightOnlySelected) return true
                                                return !selectedAssetKey || selectedAssetKey === `tag_${selectedTagGroup}_${key}`
                                            }).map((key: string) => {
                                                const val = Number((activePoint as Record<string, unknown>)[`tag_${selectedTagGroup}_${key}`] || 0);
                                                if (val === 0) return null;
                                                const yVal = viewMode === "percent" ? (val / sum) : val;
                                                cumulativeY += yVal;
                                                
                                                const activeGroup = tagGroups.find(g => g.id === selectedTagGroup)
                                                const targetTags = activeGroup?.options?.map(o => o.name) || activeGroup?.tags || []
                                                const colorIndex = targetTags.indexOf(key);
                                                const color = `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`;
                                                const keyName = `tag_${selectedTagGroup}_${key}`
                                                const isDimmed = isDimmedKey(keyName)
                                                
                                                return (
                                                    <ReferenceDot
                                                        key={key}
                                                        x={activePoint.timestamp}
                                                        y={cumulativeY}
                                                        r={4}
                                                        fill={color}
                                                        fillOpacity={isDimmed ? 0.35 : 1}
                                                        stroke="var(--background)"
                                                        strokeWidth={2}
                                                        isFront={true}
                                                    />
                                                )
                                            })
                                        } else {
                                            const displayCats = categories.filter((cat: Category) => !cat.isLiability && !cat.parentId);
                                            const reversedCats = [...displayCats].reverse();
                                            const sum = reversedCats.reduce((a: number, cat: Category) => a + Number((activePoint as Record<string, unknown>)[`category_${cat.id}`] || 0), 0) || 1;

                                            return reversedCats.filter((cat: Category) => {
                                                if (!shouldHighlightOnlySelected) return true
                                                return !selectedAssetKey || selectedAssetKey === `category_${cat.id}`
                                            }).map((cat: Category) => {
                                                const val = Number(activePoint[`category_${cat.id}`] || 0);
                                                if (val === 0) return null;
                                                const yVal = viewMode === "percent" ? (val / sum) : val;
                                                cumulativeY += yVal;
                                                
                                                const topLevelCategories = categories.filter(c => !c.parentId);
                                                const colorIndex = topLevelCategories.findIndex(tc => tc.id === cat.id);
                                                const color = cat.color || `var(--chart-${((colorIndex >= 0 ? colorIndex : 0) % 12) + 1})`;
                                                const key = `category_${cat.id}`
                                                const isDimmed = isDimmedKey(key)
                                                
                                                return (
                                                    <ReferenceDot
                                                        key={cat.id}
                                                        x={activePoint.timestamp}
                                                        y={cumulativeY}
                                                        r={4}
                                                        fill={color}
                                                        fillOpacity={isDimmed ? 0.35 : 1}
                                                        stroke="var(--background)"
                                                        strokeWidth={2}
                                                        isFront={true}
                                                    />
                                                )
                                            })
                                        }
                                    })()}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex items-center justify-between px-4 pb-4 mt-0 shrink-0 gap-2 overflow-x-auto no-scrollbar">
                            <div className="flex bg-muted/50 rounded-md p-0.5 border shrink-0">
                                {["1M", "3M", "1Y", "ALL"].map((range) => {
                                    const label = { "1M": "1ヶ月", "3M": "3ヶ月", "1Y": "1年", "ALL": "全期間" }[range] || range;
                                    return (
                                        <button
                                            key={range}
                                            onClick={() => handleTimeRangeChange(range)}
                                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all whitespace-nowrap ${timeRange === range
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"}`}
                                        >
                                            {label}
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="flex bg-muted/50 rounded-md p-0.5 border shrink-0">
                                <Popover open={viewModeOpen} onOpenChange={setViewModeOpen}>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="px-4 py-1.5 text-[11px] font-bold rounded-md transition-all whitespace-nowrap bg-background text-foreground shadow-sm flex items-center gap-2 hover:bg-muted/80"
                                        >
                                            <span className="opacity-50">表示:</span>
                                            <span>{VIEW_MODE_LABELS[viewMode]}</span>
                                            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent side="top" align="end" className="w-auto min-w-[7rem] p-1">
                                        <div className="flex flex-col gap-0.5">
                                            {VIEW_MODE_OPTIONS.map(({ value, label }) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => {
                                                        onViewModeChange(value)
                                                        setViewModeOpen(false)
                                                    }}
                                                    className={`flex w-full items-center justify-between gap-4 rounded-sm px-3 py-1.5 text-left text-[11px] font-medium transition-colors ${viewMode === value
                                                        ? "bg-accent font-bold text-accent-foreground"
                                                        : "text-foreground hover:bg-muted"}`}
                                                >
                                                    {label}
                                                    {viewMode === value && <Check className="h-3 w-3 shrink-0" />}
                                                </button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>
                </ChartContainer>
            </div>
        </div>
    )
}
