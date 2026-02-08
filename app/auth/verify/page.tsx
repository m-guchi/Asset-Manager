
"use client"

import { verifyEmail } from "@/app/actions/auth-actions"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

function VerifyContent() {
    const searchParams = useSearchParams()
    const token = searchParams.get("token")
    const router = useRouter()
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
    const [message, setMessage] = useState("認証中...")

    useEffect(() => {
        if (!token) {
            setStatus("error")
            setMessage("トークンが見つかりません")
            return
        }

        verifyEmail(token)
            .then((result) => {
                if (result.error) {
                    setStatus("error")
                    setMessage(result.error)
                    toast.error(result.error)
                } else {
                    setStatus("success")
                    setMessage(result.success || "認証成功")
                    toast.success(result.success)
                }
            })
            .catch(() => {
                setStatus("error")
                setMessage("エラーが発生しました")
                toast.error("エラーが発生しました")
            })
    }, [token])

    return (
        <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl">
            <CardHeader>
                <CardTitle className="text-center">メールアドレス確認</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 text-center">
                {status === "loading" && (
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                )}
                <p className={status === "error" ? "text-destructive" : "text-foreground"}>{message}</p>

                {status !== "loading" && (
                    <Button asChild className="mt-4">
                        <Link href="/login">ログインページへ戻る</Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}

export default function VerifyPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),rgba(0,0,0,0))] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.15),rgba(0,0,0,0))]" />
            <Suspense fallback={<div>Loading...</div>}>
                <VerifyContent />
            </Suspense>
        </div>
    )
}
