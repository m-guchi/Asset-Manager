"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, ShieldCheck } from "lucide-react"
import { confirmPasswordChange } from "@/app/actions/user-actions"
import { toast } from "sonner"
import { Suspense } from "react"
import { Logo } from "@/components/Logo"

function ConfirmPasswordChangeContent() {
    const searchParams = useSearchParams()
    const token = searchParams.get("token")
    const router = useRouter()
    const [isLoading, setIsLoading] = React.useState(true)
    const [result, setResult] = React.useState<{ success?: string; error?: string } | null>(null)

    React.useEffect(() => {
        if (!token) {
            setIsLoading(false)
            setResult({ error: "トークンが見つかりません" })
            return
        }

        const handleVerify = async () => {
            try {
                const response = await confirmPasswordChange(token)
                setResult(response)
                if (response.success) {
                    toast.success(response.success)
                } else if (response.error) {
                    toast.error(response.error)
                }
            } catch {
                setResult({ error: "確認中にエラーが発生しました" })
            } finally {
                setIsLoading(false)
            }
        }

        handleVerify()
    }, [token])

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground animate-pulse text-sm">パスワードを更新中...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 pt-4 text-center">
            {result?.success ? (
                <>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold">変更されました！</h3>
                        <p className="text-sm text-muted-foreground">パスワードの変更が完了しました。新しいパスワードで引き続きご利用いただけます。</p>
                    </div>
                </>
            ) : (
                <>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <Lock className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-destructive">エラーが発生しました</h3>
                        <p className="text-sm text-muted-foreground">{result?.error || "確認に失敗しました。リンクが無効、または期限切れの可能性があります。"}</p>
                    </div>
                </>
            )}

            <Button onClick={() => router.push("/")} className="w-full h-11 transition-all duration-300">
                ダッシュボードへ戻る
            </Button>
        </div>
    )
}

export default function ConfirmPasswordChangePage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),rgba(0,0,0,0))]" />

            <Card className="z-10 w-full max-w-md border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-4 pb-4 text-center pt-8">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border shadow-inner group transition-transform duration-500 hover:scale-110">
                        <Logo className="h-9 w-9 text-foreground transition-all duration-500 group-hover:text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">パスワード変更の確認</CardTitle>
                    <CardDescription>変更リクエストの認証を行っています</CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                    <Suspense fallback={<div className="text-center py-8">読み込み中...</div>}>
                        <ConfirmPasswordChangeContent />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}
