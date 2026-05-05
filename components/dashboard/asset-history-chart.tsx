"use client"
import * as React from "react"
import { Area, CartesianGrid, XAxis, ResponsiveContainer, YAxis, ReferenceLine, ReferenceDot, Line, ComposedChart } from "recharts"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ChartConfig, ChartContainer } from "@/components/ui/chart"
import { HistoryPoint, TagGroup } from "@/types/asset"

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
    const [isAnimating, setIsAnimating] = React.useState(false)

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

    React.useEffect(() => {
        if (tagGroups && tagGroups.length > 0) {
            const exists = tagGroups.find(g => g.id === selectedTagGroup)
            if (!exists) setSelectedTagGroup(tagGroups[0].id)
        }
    }, [tagGroups, selectedTagGroup])

    const handleTimeRangeChange = (range: string) => {
        setTimeRange(range);
        setDomainOffset(0); // リセット
        localStorage.setItem("defaultTimeRange", range);
    }

    const activeKeys = React.useMemo(() => {
        if (mode === "tag") {
            const grp = tagGroups.find(g => g.id === selectedTagGroup)
            const keys = grp?.options?.map(o => o.name) || grp?.tags || []
            return Array.from(new Set(keys.map(k => String(k).trim())))
        }
        return []
    }, [mode, selectedTagGroup, tagGroups])

    // 全データの加工 (フィルタリングなし)
    const allProcessedData = React.useMemo(() => {
        if (!data || data.length === 0) return []
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
                        if (point[k as keyof ChartPoint] === undefined || point[k as keyof ChartPoint] === null) {
                            (point as any)[k] = 0
                        }
                    })
                }
                return point
            })
            .filter(p => p.timestamp > 0)
            .sort((a, b) => a.timestamp - b.timestamp)
    }, [data, activeKeys, mode, selectedTagGroup])

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
                                        グラフ情報を計算中...
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 w-full overflow-x-auto no-scrollbar">

                                    <div className="flex items-center gap-4 flex-1 pr-2">
                                        {mode === "total" ? (
                                            <>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-totalAssets)" }} />
                                                    <span className="text-[9px] text-muted-foreground font-bold">評価額</span>
                                                    <span className="text-[11px] font-bold">¥{Math.round(activePoint.totalAssets).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 border-l border-border/50 pl-4">
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#888888" }} />
                                                    <span className="text-[9px] text-muted-foreground font-bold">取得原価</span>
                                                    <span className="text-[11px] font-bold text-[#888888]">¥{Math.round(activePoint.totalCost).toLocaleString()}</span>
                                                </div>
                                            </>
                                        ) : (
                                            activeKeys.map((key, i) => {
                                                const k = `tag_${selectedTagGroup}_${key}`
                                                const val = (activePoint as any)[k] || 0
                                                if (val === 0) return null
                                                const color = `var(--chart-${(i % 5) + 1})`
                                                return (
                                                    <div key={key} className={`flex items-center gap-1.5 shrink-0 ${i > 0 ? "border-l border-border/50 pl-4" : ""}`}>
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                                        <span className="text-[9px] text-muted-foreground font-bold">{key}</span>
                                                        <span className="text-[11px] font-bold">
                                                            {showPercent
                                                                ? `${((Number((activePoint as any)[k] || 0) / (activeKeys.reduce((a, sky) => a + Number((activePoint as any)[`tag_${selectedTagGroup}_${sky}`] || 0), 0) || 1)) * 100).toFixed(1)}%`
                                                                : `¥${Math.round(Number((activePoint as any)[k] || 0)).toLocaleString()}`
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

                        <div 
                            className="flex-1 w-full min-h-0 px-2 py-2 select-none" 
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
                                    stackOffset={mode === "tag" && showPercent ? "expand" : "none"}
                                    margin={{ top: 25, right: 30, left: 10, bottom: 0 }}
                                >
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#888888" strokeOpacity={0.2} />
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
                                        tickFormatter={(val) => showPercent ? `${(val * 100).toFixed(0)}%` : `${Math.round(val / 10000)}万`}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.5 }}
                                        width={40}
                                        domain={showPercent ? [0, 1] : ['auto', 'auto']}
                                    />
                                    {activePoint && (
                                        <ReferenceLine
                                            x={activePoint.timestamp}
                                            stroke="#888888"
                                            strokeOpacity={0.6}
                                            strokeWidth={1}
                                            strokeDasharray="5 5"
                                            label={(props: any) => {
                                                const { viewBox } = props;
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

                                    {mode === "total" && (
                                        <Area
                                            dataKey="totalAssets"
                                            type="linear"
                                            stroke="var(--color-totalAssets)"
                                            strokeWidth={2}
                                            fill="var(--color-totalAssets)"
                                            fillOpacity={0.2}
                                            isAnimationActive={isAnimating}
                                            animationDuration={1200}
                                        />
                                    )}
                                    {mode === "total" && (
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

                                    {/* 交点の丸マーク */}
                                    {activePoint && mode === "total" && (
                                        <ReferenceDot
                                            x={activePoint.timestamp}
                                            y={activePoint.totalAssets}
                                            r={4}
                                            fill="var(--color-totalAssets)"
                                            stroke="var(--background)"
                                            strokeWidth={2}
                                            isFront={true}
                                        />
                                    )}
                                    {activePoint && mode === "total" && activePoint.totalCost > 0 && (
                                        <ReferenceDot
                                            x={activePoint.timestamp}
                                            y={activePoint.totalCost}
                                            r={4}
                                            fill="#888888"
                                            stroke="var(--background)"
                                            strokeWidth={2}
                                            isFront={true}
                                        />
                                    )}
                                    {activePoint && mode === "tag" && (() => {
                                        let cumulativeY = 0;
                                        const sum = activeKeys.reduce((a, key) => a + Number((activePoint as any)[`tag_${selectedTagGroup}_${key}`] || 0), 0) || 1;
                                        
                                        return activeKeys.map((key, i) => {
                                            const val = Number((activePoint as any)[`tag_${selectedTagGroup}_${key}`] || 0);
                                            if (val === 0) return null;
                                            
                                            // showPercent の場合は 100% = 1 の割合
                                            const yVal = showPercent ? (val / sum) : val;
                                            cumulativeY += yVal;
                                            
                                            return (
                                                <ReferenceDot
                                                    key={key}
                                                    x={activePoint.timestamp}
                                                    y={cumulativeY}
                                                    r={4}
                                                    fill={`var(--chart-${(i % 5) + 1})`}
                                                    stroke="var(--background)"
                                                    strokeWidth={2}
                                                    isFront={true}
                                                />
                                            )
                                        })
                                    })()}
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
                                            onClick={() => handleTimeRangeChange(range)}
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

                        </div>
                    </div>
                </ChartContainer>
            </CardContent>

        </Card>
    )
}
