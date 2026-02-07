"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun, Clock, Info, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export default function SettingsPage() {
    const { setTheme, theme, systemTheme } = useTheme()

    // In a real app, this would be persisted in local storage or user preferences in DB
    const [defaultTimeRange, setDefaultTimeRange] = React.useState("1Y")
    // Add mounted state to prevent hydration mismatch
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
        // Load preference from local storage on mount
        const savedRange = localStorage.getItem("defaultTimeRange")
        if (savedRange) setDefaultTimeRange(savedRange)
    }, [])

    const handleTimeRangeChange = (value: string) => {
        setDefaultTimeRange(value)
        localStorage.setItem("defaultTimeRange", value)
    }

    // Prevent rendering theme-dependent UI until mounted
    if (!mounted) {
        return <div className="p-8">Loading settings...</div>
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">設定</h1>
            </div>

            <div className="grid gap-6">
                {/* Visual Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Monitor className="h-5 w-5" />
                            外観設定
                        </CardTitle>
                        <CardDescription>
                            アプリケーションのテーマを設定します。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col space-y-3">
                            <Label>テーマモード</Label>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant={theme === "light" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setTheme("light")}
                                    className="min-w-[100px] justify-start"
                                >
                                    <Sun className="mr-2 h-4 w-4" />
                                    ライト
                                    {theme === "light" && <Check className="ml-auto h-4 w-4" />}
                                </Button>
                                <Button
                                    variant={theme === "dark" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setTheme("dark")}
                                    className="min-w-[100px] justify-start"
                                >
                                    <Moon className="mr-2 h-4 w-4" />
                                    ダーク
                                    {theme === "dark" && <Check className="ml-auto h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 border-t pt-4">
                            <Switch
                                id="system-mode"
                                checked={theme === "system"}
                                onCheckedChange={(checked) => setTheme(checked ? "system" : (systemTheme || "light"))}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="system-mode" className="cursor-pointer">システム設定に従う</Label>
                                <p className="text-sm text-muted-foreground">
                                    デバイスのシステム設定に合わせてテーマを自動で切り替えます。
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Dashboard Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            ダッシュボード設定
                        </CardTitle>
                        <CardDescription>
                            ダッシュボードの表示設定を管理します。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="default-range">資産推移グラフの初期表示期間</Label>
                            <Select value={defaultTimeRange} onValueChange={handleTimeRangeChange}>
                                <SelectTrigger id="default-range">
                                    <SelectValue placeholder="期間を選択" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1M">1ヶ月</SelectItem>
                                    <SelectItem value="3M">3ヶ月</SelectItem>
                                    <SelectItem value="1Y">1年</SelectItem>
                                    <SelectItem value="ALL">全期間</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground">
                                開いたときに最初に表示される期間を設定します。
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* App Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5" />
                            アプリケーション情報
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Version</span>
                            <span className="font-mono">{process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Environment</span>
                            <span className="font-mono">{process.env.NODE_ENV}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
