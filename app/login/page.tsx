"use client"

import * as React from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Hexagon, Mail, Lock, User as UserIcon, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUp, resetPasswordRequest } from "@/app/actions/auth-actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function LoginPage() {
    const [isLoading, setIsLoading] = React.useState<string | null>(null)
    const [activeTab, setActiveTab] = React.useState("login")
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
    const [showPassword, setShowPassword] = React.useState(false)
    const [validationErrors, setValidationErrors] = React.useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: ""
    })
    const router = useRouter()

    const MAX_LENGTHS = {
        name: 50,
        email: 255,
        password: 72
    }

    const validateField = (name: string, value: string, allValues?: { password?: string, confirmPassword?: string }) => {
        let error = ""
        if (name === "name" && value.length > MAX_LENGTHS.name) {
            error = `名前は${MAX_LENGTHS.name}文字以内で入力してください`
        } else if (name === "email" && value.length > MAX_LENGTHS.email) {
            error = `メールアドレスは${MAX_LENGTHS.email}文字以内で入力してください`
        } else if (name === "password") {
            if (value.length > MAX_LENGTHS.password) {
                error = `パスワードは${MAX_LENGTHS.password}文字以内で入力してください`
            }
            // パスワード変更時に確認用パスワードとの一致をチェック
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

    const hasValidationErrors = Object.values(validationErrors).some(error => error !== "")

    const handleGoogleLogin = async () => {
        setIsLoading("google")
        setErrorMessage(null)
        try {
            await signIn("google", { callbackUrl: "/" })
        } catch (error) {
            console.error("Login failed:", error)
            setErrorMessage("Googleログインに失敗しました")
            toast.error("Googleログインに失敗しました")
        } finally {
            setIsLoading(null)
        }
    }

    const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading("email")
        setErrorMessage(null)
        const formData = new FormData(e.currentTarget)
        const email = formData.get("email") as string
        const password = formData.get("password") as string

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
                callbackUrl: "/"
            })

            if (result?.error) {
                setErrorMessage(result.error)
                toast.error(result.error)
            } else {
                toast.success("ログインしました")
                router.push("/")
                router.refresh()
            }
        } catch (error) {
            console.error("Login failed:", error)
            setErrorMessage("ログイン中にエラーが発生しました")
            toast.error("ログイン中にエラーが発生しました")
        } finally {
            setIsLoading(null)
        }
    }

    const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading("register")
        setErrorMessage(null)
        const form = e.currentTarget
        const formData = new FormData(form)
        const password = formData.get("password") as string
        const confirmPassword = formData.get("confirmPassword") as string

        if (password !== confirmPassword) {
            setErrorMessage("パスワードが一致しません")
            toast.error("パスワードが一致しません")
            setIsLoading(null)
            return
        }

        try {
            const result = await signUp(formData)
            if (result.error) {
                setErrorMessage(result.error)
                toast.error(result.error)
            } else {
                toast.success(result.message || "確認メールを送信しました。メールをチェックしてください。")
                setActiveTab("login")
                form.reset()
            }
        } catch (error) {
            console.error("Registration failed:", error)
            setErrorMessage("登録中にエラーが発生しました")
            toast.error("登録中にエラーが発生しました")
        } finally {
            setIsLoading(null)
        }
    }

    const handleResetRequest = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading("reset")
        setErrorMessage(null)
        const formData = new FormData(e.currentTarget)
        const email = formData.get("email") as string

        try {
            const result = await resetPasswordRequest(email)
            if (result.error) {
                setErrorMessage(result.error)
                toast.error(result.error)
            } else {
                toast.success(result.success)
                setActiveTab("login")
            }
        } catch (error) {
            console.error("Reset request failed:", error)
            setErrorMessage("エラーが発生しました")
            toast.error("エラーが発生しました")
        } finally {
            setIsLoading(null)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden transition-colors duration-500">
            {/* Ambient Background Blur */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),rgba(0,0,0,0))] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.15),rgba(0,0,0,0))]" />

            {/* Animated Gradient Orbs */}
            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />

            <Card className="z-10 w-full max-w-md border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl transition-all duration-300 overflow-hidden">
                <CardHeader className="space-y-4 pb-4 text-center pt-8">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border shadow-inner group transition-transform duration-500 hover:scale-110">
                        <Hexagon className="h-8 w-8 text-foreground fill-foreground/5 transition-all duration-500 group-hover:fill-primary/20 group-hover:text-primary" strokeWidth={1.5} />
                    </div>
                </CardHeader>

                <CardContent className="px-8 pb-8">
                    {/* Error Message Display */}
                    {errorMessage && (
                        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-3">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground font-bold text-[10px]">!</span>
                            {errorMessage}
                        </div>
                    )}

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50 p-1">
                            <TabsTrigger value="login" className="rounded-md transition-all duration-200">ログイン</TabsTrigger>
                            <TabsTrigger value="register" className="rounded-md transition-all duration-200">新規登録</TabsTrigger>
                        </TabsList>

                        <TabsContent value="login" className="space-y-6 focus-visible:outline-none">
                            <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
                                <div className="space-y-2">
                                    <Label htmlFor="email">メールアドレス</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input id="email" name="email" type="email" placeholder="example@minagu.work" className="pl-10 bg-background/50" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">パスワード</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            className="pl-10 pr-10 bg-background/50"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("forgot")}
                                        className="text-xs text-primary hover:underline transition-all opacity-80 hover:opacity-100"
                                    >
                                        パスワードを忘れましたか？
                                    </button>
                                </div>
                                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 transition-all duration-300" disabled={!!isLoading}>
                                    {isLoading === "email" ? (
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                    ) : "ログイン"}
                                </Button>
                            </form>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-border/50" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-transparent px-2 text-muted-foreground">または</span>
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                className="w-full h-11 border-border bg-background/30 hover:bg-accent/50 transition-all duration-300 group shadow-sm"
                                onClick={handleGoogleLogin}
                                disabled={!!isLoading}
                            >
                                {isLoading === "google" ? (
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
                                ) : (
                                    <>
                                        <svg className="mr-3 h-5 w-5 transform transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        <span className="font-medium">Googleでログイン</span>
                                    </>
                                )}
                            </Button>
                        </TabsContent>

                        <TabsContent value="register" className="space-y-6 focus-visible:outline-none">
                            <form onSubmit={handleRegister} className="space-y-4" noValidate>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-name">お名前</Label>
                                    <div className="relative">
                                        <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="reg-name"
                                            name="name"
                                            type="text"
                                            placeholder="名前 (任意)"
                                            className={`pl-10 bg-background/50 ${validationErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                            maxLength={MAX_LENGTHS.name + 1}
                                            onChange={(e) => validateField("name", e.target.value)}
                                        />
                                    </div>
                                    {validationErrors.name && <p className="text-[10px] text-destructive animate-in fade-in slide-in-from-top-1">{validationErrors.name}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-email">メールアドレス</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="reg-email"
                                            name="email"
                                            type="email"
                                            placeholder="example@minagu.work"
                                            className={`pl-10 bg-background/50 ${validationErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                            maxLength={MAX_LENGTHS.email + 1}
                                            onChange={(e) => validateField("email", e.target.value)}
                                        />
                                    </div>
                                    {validationErrors.email && <p className="text-[10px] text-destructive animate-in fade-in slide-in-from-top-1">{validationErrors.email}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-password">パスワード</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="reg-password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            className={`pl-10 pr-10 bg-background/50 ${validationErrors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
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
                                    <Label htmlFor="reg-confirm-password">パスワード（確認）</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="reg-confirm-password"
                                            name="confirmPassword"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            className={`pl-10 pr-10 bg-background/50 ${validationErrors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                            onChange={(e) => {
                                                const form = e.target.form;
                                                const passwordVal = form ? (new FormData(form).get("password") as string) : "";
                                                validateField("confirmPassword", e.target.value, { password: passwordVal });
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
                                    {validationErrors.confirmPassword && (
                                        <p className="text-[10px] text-destructive animate-in fade-in slide-in-from-top-1">
                                            {validationErrors.confirmPassword}
                                        </p>
                                    )}
                                </div>
                                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 transition-all duration-300 mt-2" disabled={!!isLoading || hasValidationErrors}>
                                    {isLoading === "register" ? (
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                    ) : "アカウント作成"}
                                </Button>
                            </form>
                        </TabsContent>
                        <TabsContent value="forgot" className="space-y-6 focus-visible:outline-none">
                            <div className="space-y-2 text-center">
                                <h3 className="text-lg font-medium">パスワードの再設定</h3>
                                <p className="text-xs text-muted-foreground">登録済みのメールアドレスを入力してください。再設定用のリンクをお送りします。</p>
                            </div>
                            <form onSubmit={handleResetRequest} className="space-y-4" noValidate>
                                <div className="space-y-2">
                                    <Label htmlFor="forgot-email">メールアドレス</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input id="forgot-email" name="email" type="email" placeholder="example@minagu.work" className="pl-10 bg-background/50" required />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 transition-all duration-300" disabled={!!isLoading}>
                                    {isLoading === "reset" ? (
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                    ) : "再設定メールを送信"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full text-xs"
                                    onClick={() => setActiveTab("login")}
                                >
                                    ログイン画面に戻る
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-muted-foreground px-2">
                            ログインすることで、
                            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground transition-colors">利用規約</Link>
                            と
                            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground transition-colors">プライバシーポリシー</Link>
                            に同意したものとみなされます。
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="fixed bottom-8 text-center w-full">
                <p className="text-muted-foreground text-xs tracking-widest uppercase opacity-50">
                    Designed for visual excellence
                </p>
            </div>
        </div>
    )
}
