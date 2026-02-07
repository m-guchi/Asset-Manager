"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { setDefaultTimeRangeAction, getDefaultTimeRange } from "@/app/actions/settings"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export default function SettingsPage() {
    const { theme, setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [defaultTimeRange, setDefaultTimeRange] = useState("1Y")

    // Avoid hydration mismatch
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true)
        // Fetch saved setting
        getDefaultTimeRange().then(range => setDefaultTimeRange(range))
    }, [])

    if (!mounted) return null

    const isSystem = theme === "system"
    const isDark = resolvedTheme === "dark"

    const toggleSystem = (checked: boolean) => {
        setTheme(checked ? "system" : (resolvedTheme || "light"))
        toast.success(checked ? "システム設定に同期しました" : "手動設定に切り替えました")
    }

    const toggleTheme = (checked: boolean) => {
        setTheme(checked ? "dark" : "light")
        toast.success(checked ? "テーマを固定しました" : "テーマを固定しました")
    }

    const handleTimeRangeChange = async (value: string) => {
        setDefaultTimeRange(value)
        await setDefaultTimeRangeAction(value)
        toast.success("デフォルトの時間軸を更新しました")
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">設定</h1>
                <p className="text-muted-foreground">
                    アプリケーション全体の設定
                </p>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>表示設定</CardTitle>
                        <CardDescription>
                            画面の表示に関する設定を行います。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="use-system">システム設定を使用する</Label>
                                <div className="text-sm text-muted-foreground">
                                    OSの外観設定と同期します
                                </div>
                            </div>
                            <Switch
                                id="use-system"
                                checked={isSystem}
                                onCheckedChange={toggleSystem}
                            />
                        </div>

                        <div className={`flex items-center justify-between space-x-2 transition-opacity ${isSystem ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                            <div className="space-y-0.5">
                                <Label htmlFor="dark-mode">ダークモードの固定</Label>
                                <div className="text-sm text-muted-foreground">
                                    外観を常に{isDark ? "ダーク" : "ライト"}モードに固定します
                                </div>
                            </div>
                            <Switch
                                id="dark-mode"
                                checked={isDark}
                                onCheckedChange={toggleTheme}
                                disabled={isSystem}
                            />
                        </div>

                        <div className="flex items-center justify-between space-x-2 border-t pt-4">
                            <div className="space-y-0.5">
                                <Label htmlFor="default-range">デフォルトの時間軸</Label>
                                <div className="text-sm text-muted-foreground">
                                    ダッシュボードの初期表示範囲を設定します
                                </div>
                            </div>
                            <div className="w-[120px]">
                                <Select value={defaultTimeRange} onValueChange={handleTimeRangeChange}>
                                    <SelectTrigger id="default-range">
                                        <SelectValue placeholder="選択..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1M">1ヶ月</SelectItem>
                                        <SelectItem value="3M">3ヶ月</SelectItem>
                                        <SelectItem value="1Y">1年</SelectItem>
                                        <SelectItem value="ALL">全範囲</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>アプリケーション情報</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="font-medium">Version</div>
                            <div className="text-muted-foreground">{process.env.NEXT_PUBLIC_APP_VERSION}</div>
                            <div className="font-medium">Build</div>
                            <div className="text-muted-foreground capitalize">{process.env.NODE_ENV}</div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
