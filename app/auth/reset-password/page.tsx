"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, Eye, EyeOff, Hexagon } from "lucide-react"
import { resetPassword } from "@/app/actions/auth-actions"
import { toast } from "sonner"
import { Suspense } from "react"

function ResetPasswordForm() {
    const searchParams = useSearchParams()
    const token = searchParams.get("token")
    const router = useRouter()
    const [isLoading, setIsLoading] = React.useState(false)
    const [showPassword, setShowPassword] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [validationErrors, setValidationErrors] = React.useState<{ [key: string]: string }>({})

    const MAX_LENGTHS = {
        password: 72
    }

    const validateField = (name: string, value: string, allValues?: { password?: string, confirmPassword?: string }) => {
        let error = ""
        if (name === "password") {
            if (value.length > MAX_LENGTHS.password) {
                error = `パスワードは${MAX_LENGTHS.password}文字以内で入力してください`
            }
            const confirmVal = allValues?.confirmPassword
            if (confirmVal && value !== confirmVal) {
                setValidationErrors(prev => ({ ...prev, confirmPassword: "パスワードが一致しません" }))
            } else if (confirmVal && value === confirmVal) {
                setValidationErrors(prev => ({ ...prev, confirmPassword: "" }))
            }
        } else if (name === "confirmPassword") {
            const passwordVal = allValues?.password
            if (passwordVal && value !== passwordVal) {
                error = "パスワードが一致しません"
            }
        }
        setValidationErrors(prev => ({ ...prev, [name]: error }))
    }

    const hasValidationErrors = Object.values(validationErrors).some(err => err !== "")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!token) return

        setIsLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const password = formData.get("password") as string
        const confirmPassword = formData.get("confirmPassword") as string

        if (password !== confirmPassword) {
            setError("パスワードが一致しません")
            setIsLoading(false)
            return
        }

        try {
            const result = await resetPassword(token, password)
            if (result.error) {
                setError(result.error)
                toast.error(result.error)
            } else {
                toast.success(result.success)
                router.push("/login")
            }
        } catch (err) {
            setError("エラーが発生しました")
            toast.error("エラーが発生しました")
        } finally {
            setIsLoading(null)
        }
    }

    if (!token) {
        return (
            <div className="text-center space-y-4">
                <p className="text-destructive">無効なリクエストです。トークンが見つかりません。</p>
                <Button onClick={() => router.push("/login")}>ログイン画面へ戻る</Button>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                </div>
            )}
            <div className="space-y-2">
                <Label htmlFor="password">新しいパスワード</Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className={`pl-10 pr-10 ${validationErrors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        required
                        onChange={(e) => {
                            const form = e.target.form;
                            const confirmVal = form ? (new FormData(form).get("confirmPassword") as string) : "";
                            validateField("password", e.target.value, { confirmPassword: confirmVal });
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
                {!validationErrors.password && <p className="text-[10px] text-muted-foreground opacity-70">※最大{MAX_LENGTHS.password}文字まで指定可能です</p>}
                {validationErrors.password && <p className="text-[10px] text-destructive animate-in fade-in slide-in-from-top-1">{validationErrors.password}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="confirmPassword">パスワードの確認</Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className={`pl-10 pr-10 ${validationErrors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        required
                        onChange={(e) => {
                            const form = e.target.form;
                            const passwordVal = form ? (new FormData(form).get("password") as string) : "";
                            validateField("confirmPassword", e.target.value, { password: passwordVal });
                        }}
                    />
                </div>
                {validationErrors.confirmPassword && (
                    <p className="text-[10px] text-destructive animate-in fade-in slide-in-from-top-1">
                        {validationErrors.confirmPassword}
                    </p>
                )}
            </div>
            <Button type="submit" className="w-full" disabled={!!isLoading || hasValidationErrors}>
                {isLoading ? "更新中..." : "パスワードを更新"}
            </Button>
        </form>
    )
}

export default function ResetPasswordPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
            {/* Ambient Background Blur */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),rgba(0,0,0,0))]" />

            <Card className="z-10 w-full max-w-md border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center pt-8">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border mb-4">
                        <Hexagon className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">パスワードの再設定</CardTitle>
                    <CardDescription>新しいパスワードを入力してください</CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                    <Suspense fallback={<div className="text-center">読み込み中...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}
