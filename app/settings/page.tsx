"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export default function SettingsPage() {
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
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="dark-mode">ダークモード</Label>
                                <div className="text-sm text-muted-foreground">
                                    常にダークモードを有効にする（現在はシステム設定に従います）
                                </div>
                            </div>
                            <Switch id="dark-mode" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="show-cents">セント（小数点以下）を表示</Label>
                                <div className="text-sm text-muted-foreground">
                                    資産額の小数点以下を表示します
                                </div>
                            </div>
                            <Switch id="show-cents" />
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
                            <div className="text-muted-foreground">0.1.0</div>
                            <div className="font-medium">Build</div>
                            <div className="text-muted-foreground">Development</div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
