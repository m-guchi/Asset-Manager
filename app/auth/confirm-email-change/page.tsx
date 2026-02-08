"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, ShieldCheck, Hexagon } from "lucide-react"
import { confirmEmailChange } from "@/app/actions/user-actions"
import { toast } from "sonner"
import { Suspense } from "react"
import { Logo } from "@/components/Logo"

import { useSession } from "next-auth/react"

function ConfirmEmailChangeContent() {
    const { update } = useSession()
    const searchParams = useSearchParams()
    const token = searchParams.get("token")
    const router = useRouter()
    const [isLoading, setIsLoading] = React.useState(true)
    const [result, setResult] = React.useState<{ success?: string; error?: string; newEmail?: string } | null>(null)

    React.useEffect(() => {
        if (!token) {
            setIsLoading(false)
            setResult({ error: "トークンが見つかりません" })
            return
        }

        const handleVerify = async () => {
            try {
                const response = await confirmEmailChange(token)
                setResult(response)
                if (response.success) {
                    toast.success(response.success)
                    if (response.newEmail) {
                        await update({ email: response.newEmail })
                    }
                } else if (response.error) {
                    toast.error(response.error)
                }
            } catch (error) {
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
                <p className="text-muted-foreground animate-pulse text-sm">メールアドレスを確認中...</p>
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
                        <h3 className="text-xl font-semibold">更新されました！</h3>
                        <p className="text-sm text-muted-foreground">メールアドレスの変更が完了しました。新しいメールアドレスで引き続きご利用いただけます。</p>
                    </div>
                </>
            ) : (
                <>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <Mail className="h-8 w-8" />
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

export default function ConfirmEmailChangePage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),rgba(0,0,0,0))]" />

            <Card className="z-10 w-full max-w-md border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-4 pb-4 text-center pt-8">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border shadow-inner group transition-transform duration-500 hover:scale-110">
                        <Logo className="h-9 w-9 text-foreground transition-all duration-500 group-hover:text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">メールアドレスの確認</CardTitle>
                    <CardDescription>変更リクエストの認証を行っています</CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                    <Suspense fallback={<div className="text-center py-8">読み込み中...</div>}>
                        <ConfirmEmailChangeContent />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}
