"use client"

import * as React from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Hexagon } from "lucide-react"

export default function LoginPage() {
    const [isLoading, setIsLoading] = React.useState<string | null>(null)

    const handleLogin = async (provider: string) => {
        setIsLoading(provider)
        try {
            await signIn(provider, { callbackUrl: "/asset-manager" })
        } catch (error) {
            console.error("Login failed:", error)
        } finally {
            setIsLoading(null)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),rgba(0,0,0,0))]" />

            <Card className="z-10 w-full max-w-md border-zinc-800/50 bg-zinc-900/50 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-4 pb-8 text-center pt-8">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/50 border border-zinc-700/50 shadow-inner">
                        <Hexagon className="h-8 w-8 text-white fill-white/10" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-3xl font-bold tracking-tight text-white">
                            Asset Manager
                        </CardTitle>
                        <CardDescription className="text-zinc-400 text-base">
                            あなたの資産を、より美しく管理しましょう。
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 pb-12 px-8">
                    <Button
                        variant="outline"
                        size="lg"
                        className="w-full h-14 border-zinc-700/50 bg-white/5 hover:bg-white/10 hover:border-zinc-500 text-white transition-all duration-300 group shadow-lg"
                        onClick={() => handleLogin("google")}
                        disabled={!!isLoading}
                    >
                        {isLoading === "google" ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        ) : (
                            <>
                                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                <span className="font-medium text-lg">Googleでログイン</span>
                            </>
                        )}
                    </Button>

                    <div className="pt-6 text-center">
                        <p className="text-sm text-zinc-500">
                            ログインすることで、
                            <a href="#" className="underline underline-offset-4 hover:text-white transition-colors">利用規約</a>
                            と
                            <a href="#" className="underline underline-offset-4 hover:text-white transition-colors">プライバシーポリシー</a>
                            に同意したものとみなされます。
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="fixed bottom-8 text-center w-full">
                <p className="text-zinc-600 text-xs tracking-widest uppercase">
                    Designed for visual excellence
                </p>
            </div>
        </div>
    )
}
