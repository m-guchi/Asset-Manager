"use client"

import * as React from "react"
import { User, LogOut, Mail, ShieldCheck } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function ProfilePage() {
    const { data: session } = useSession()

    const handleLogout = () => {
        signOut({ callbackUrl: "/asset-manager/login" })
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 max-w-4xl mx-auto">
            <div className="grid gap-6">
                {/* User Info Card */}
                <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <User className="h-5 w-5 text-primary" />
                            アカウント情報
                        </CardTitle>
                        <CardDescription>
                            ログイン中のGoogleアカウントのプロファイル情報です。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl bg-white/50 dark:bg-black/20 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800">
                            {session?.user?.image ? (
                                <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-primary/20 shadow-xl relative">
                                    <Image
                                        src={session.user.image}
                                        alt={session.user.name || "User"}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/20 shadow-xl text-primary">
                                    <User className="h-12 w-12" />
                                </div>
                            )}
                            <div className="flex-1 text-center md:text-left space-y-1">
                                <h3 className="text-2xl font-bold">{session?.user?.name || "ユーザー"}</h3>
                                <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                                    <Mail className="h-4 w-4" />
                                    <span>{session?.user?.email}</span>
                                </div>
                                <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-2 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full w-fit">
                                    <ShieldCheck className="h-3 w-3" />
                                    <span>認証済み</span>
                                </div>
                            </div>
                            <div className="flex md:block">
                                <Button
                                    variant="outline"
                                    onClick={handleLogout}
                                    className="gap-2 border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition-all duration-300"
                                >
                                    <LogOut className="h-4 w-4" />
                                    ログアウト
                                </Button>
                            </div>
                        </div>

                        <Separator className="my-4" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border space-y-1">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">ユーザー名</p>
                                <p className="font-medium text-zinc-900 dark:text-zinc-100">{session?.user?.name || "未設定"}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border space-y-1">
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">メールアドレス</p>
                                <p className="font-medium text-zinc-900 dark:text-zinc-100">{session?.user?.email || "未設定"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
