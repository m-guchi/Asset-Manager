"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Edit2, Check, X } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

export default function SettingsPage() {
    const { theme, setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true)
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
