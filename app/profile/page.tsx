"use client"

import * as React from "react"
import { User, LogOut, Mail, ShieldCheck, Edit2, Lock, ChevronRight, AlertCircle, Trash2, Eye, EyeOff } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateName, requestEmailChange, requestPasswordChange, getPendingEmailChange, cancelEmailChange, deleteAccount } from "@/app/actions/user-actions"
import { toast } from "sonner"

export default function ProfilePage() {
    const handleDeleteAccount = async () => {
        setIsLoading("delete")
        const res = await deleteAccount(confirmDeletionPassword)
        if (res.success) {
            toast.success(res.success)
            signOut({ callbackUrl: "/login" })
        } else {
            toast.error(res.error)
            setIsLoading(null)
            setConfirmDeletionPassword("")
            setIsDialogOpen(false)
        }
    }

    const { data: session, update } = useSession()
    const [isLoading, setIsLoading] = React.useState<string | null>(null)
    const [isEditingName, setIsEditingName] = React.useState(false)
    const [isEditingEmail, setIsEditingEmail] = React.useState(false)
    const [isEditingPassword, setIsEditingPassword] = React.useState(false)
    const [pendingEmail, setPendingEmail] = React.useState<string | null>(null)

    // Form states
    const [newName, setNewName] = React.useState("")
    const [newEmail, setNewEmail] = React.useState("")
    const [newPassword, setNewPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")
    const [confirmDeletionPassword, setConfirmDeletionPassword] = React.useState("")
    const [showDeletePassword, setShowDeletePassword] = React.useState(false)
    const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false)
    const [isDialogOpen, setIsDialogOpen] = React.useState(false)

    const fetchPendingEmail = React.useCallback(async () => {
        const pending = await getPendingEmailChange()
        setPendingEmail(pending?.newEmail || null)
    }, [])

    React.useEffect(() => {
        if (session?.user?.name) setNewName(session.user.name)
        if (session?.user?.email) setNewEmail(session.user.email)
        fetchPendingEmail()
    }, [session, fetchPendingEmail])

    const handleLogout = () => {
        signOut({ callbackUrl: "/login" })
    }

    const handleUpdateName = async () => {
        if (!newName || newName === session?.user?.name) {
            setIsEditingName(false)
            return
        }
        setIsLoading("name")
        const res = await updateName(newName)
        if (res.success) {
            toast.success(res.success)
            await update({ name: newName })
            setIsEditingName(false)
        } else {
            toast.error(res.error)
        }
        setIsLoading(null)
    }

    const handleRequestEmailChange = async () => {
        if (!newEmail || newEmail === session?.user?.email) {
            setIsEditingEmail(false)
            return
        }
        setIsLoading("email")
        const res = await requestEmailChange(newEmail)
        if (res.success) {
            toast.success(res.success)
            setIsEditingEmail(false)
            fetchPendingEmail()
        } else {
            toast.error(res.error)
        }
        setIsLoading(null)
    }

    const handleCancelEmailChange = async () => {
        setIsLoading("cancel-email")
        const res = await cancelEmailChange()
        if (res.success) {
            toast.success(res.success)
            setPendingEmail(null)
        } else {
            toast.error(res.error)
        }
        setIsLoading(null)
    }

    const handleRequestPasswordChange = async () => {
        if (!newPassword || newPassword !== confirmPassword) {
            toast.error("パスワードが一致しません")
            return
        }
        setIsLoading("password")
        const res = await requestPasswordChange(newPassword)
        if (res.success) {
            toast.success(res.success)
            setIsEditingPassword(false)
            setNewPassword("")
            setConfirmPassword("")
        } else {
            toast.error(res.error)
        }
        setIsLoading(null)
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="grid gap-8">
                {/* User Info Card */}
                <Card className="overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-xl transition-all duration-300">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <User className="h-5 w-5 text-primary" />
                            基本情報
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {/* Profile Header */}
                        <div className="flex flex-col md:flex-row items-center gap-6 p-6 rounded-2xl bg-muted/30 border border-border shadow-inner">
                            {session?.user?.image ? (
                                <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-background shadow-xl relative group">
                                    <Image
                                        src={session.user.image}
                                        alt={session.user.name || "User"}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                </div>
                            ) : (
                                <div className="h-24 w-24 rounded-full bg-primary/5 flex items-center justify-center border-4 border-background shadow-xl text-primary">
                                    <User className="h-12 w-12" />
                                </div>
                            )}
                            <div className="flex-1 text-center md:text-left space-y-2">
                                <h3 className="text-2xl font-bold tracking-tight">{session?.user?.name || "ユーザー"}</h3>
                                <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                                    <Mail className="h-4 w-4" />
                                    <span className="text-sm">{session?.user?.email}</span>
                                </div>
                                <div className="flex items-center justify-center md:justify-start gap-2 text-[10px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400 mt-3 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full w-fit">
                                    <ShieldCheck className="h-3 w-3" />
                                    <span>認証済み</span>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleLogout}
                                className="group gap-2 border-destructive/20 hover:bg-destructive hover:text-white transition-all duration-300"
                            >
                                <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                                ログアウト
                            </Button>
                        </div>

                        {/* Settings Sections */}
                        <div className="space-y-6">
                            {/* Name Edit */}
                            <div className="rounded-xl border border-border bg-background/50 p-6 space-y-4 transition-all hover:bg-muted/10">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-sm">ユーザー名</h4>
                                        <p className="text-xs text-muted-foreground">アプリ内で表示される名前です。</p>
                                    </div>
                                    {!isEditingName && (
                                        <Button variant="ghost" size="sm" onClick={() => setIsEditingName(true)} className="text-primary hover:text-primary hover:bg-primary/10">
                                            <Edit2 className="h-4 w-4 mr-2" /> 編集
                                        </Button>
                                    )}
                                </div>

                                {isEditingName ? (
                                    <div className="flex gap-2 animate-in slide-in-from-top-2 duration-300">
                                        <Input
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="max-w-md h-10"
                                            autoFocus
                                        />
                                        <Button size="sm" onClick={handleUpdateName} disabled={isLoading === "name"} className="h-10">
                                            {isLoading === "name" ? "保存中..." : "保存"}
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => {
                                            setIsEditingName(false)
                                            setNewName(session?.user?.name || "")
                                        }} className="h-10">
                                            キャンセル
                                        </Button>
                                    </div>
                                ) : (
                                    <p className="text-sm font-medium pl-1">{session?.user?.name || "未設定"}</p>
                                )}
                            </div>

                            {/* Email Edit */}
                            <div className="rounded-xl border border-border bg-background/50 p-6 space-y-4 transition-all hover:bg-muted/10">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-sm">メールアドレス</h4>
                                        <p className="text-xs text-muted-foreground">ログインに使用するメールアドレスです。変更には認証が必要です。</p>
                                    </div>
                                    {!isEditingEmail && (
                                        <Button variant="ghost" size="sm" onClick={() => setIsEditingEmail(true)} className="text-primary hover:text-primary hover:bg-primary/10">
                                            <Edit2 className="h-4 w-4 mr-2" /> 変更
                                        </Button>
                                    )}
                                </div>

                                {isEditingEmail ? (
                                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex gap-2">
                                            <Input
                                                type="email"
                                                value={newEmail}
                                                onChange={(e) => setNewEmail(e.target.value)}
                                                className="max-w-md h-10"
                                                autoFocus
                                            />
                                            <Button size="sm" onClick={handleRequestEmailChange} disabled={isLoading === "email"} className="h-10">
                                                {isLoading === "email" ? "送信中..." : "確認メールを送信"}
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                setIsEditingEmail(false)
                                                setNewEmail(session?.user?.email || "")
                                            }} className="h-10">
                                                キャンセル
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-md border border-amber-500/20">
                                            <AlertCircle className="h-3 w-3" />
                                            <span>新しいメールアドレスで承認されるまで、現在のメールアドレスが維持されます。</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm font-medium pl-1">{session?.user?.email}</p>
                                        {pendingEmail && (
                                            <div className="flex flex-col gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 animate-in zoom-in-95 duration-300">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                                        変更保留中
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={handleCancelEmailChange}
                                                        disabled={isLoading === "cancel-email"}
                                                        className="h-7 text-[10px] px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        {isLoading === "cancel-email" ? "キャンセル中..." : "リクエストを取り消す"}
                                                    </Button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-xs font-medium">{pendingEmail}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-muted-foreground">新しいメールアドレスに届いたリンクをクリックして、変更を完了してください。</p>
                                                    <p className="text-[9px] text-muted-foreground/70 bg-muted/50 p-1.5 rounded border border-border/50">
                                                        ※メールが届かない場合は、入力したメールアドレスが既に他のアカウントで登録されている可能性があります。その場合、セキュリティ保護のため確認メールは送信されません。
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Password Edit */}
                            <div className="rounded-xl border border-border bg-background/50 p-6 space-y-4 transition-all hover:bg-muted/10">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-sm">パスワード</h4>
                                        <p className="text-xs text-muted-foreground">アカウントのセキュリティを強化します。変更にはメール認証が必要です。</p>
                                    </div>
                                    {!isEditingPassword && (
                                        <Button variant="ghost" size="sm" onClick={() => setIsEditingPassword(true)} className="text-primary hover:text-primary hover:bg-primary/10">
                                            <Lock className="h-4 w-4 mr-2" /> 変更
                                        </Button>
                                    )}
                                </div>

                                {isEditingPassword ? (
                                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 max-w-md">
                                        <div className="space-y-2">
                                            <Label htmlFor="new-password">新しいパスワード</Label>
                                            <Input
                                                id="new-password"
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="••••••••"
                                            />
                                            <p className="text-[10px] text-muted-foreground opacity-70">※最大72文字まで指定可能です</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="confirm-password">確認用パスワード</Label>
                                            <Input
                                                id="confirm-password"
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={handleRequestPasswordChange} disabled={isLoading === "password"} className="h-10">
                                                {isLoading === "password" ? "送信中..." : "変更をリクエスト"}
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                setIsEditingPassword(false)
                                                setNewPassword("")
                                                setConfirmPassword("")
                                            }} className="h-10">
                                                キャンセル
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-md border border-amber-500/20">
                                            <AlertCircle className="h-3 w-3" />
                                            <span>メールで届くリンクをクリックして承認するまで、パスワードは変更されません。</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm font-medium pl-1 text-muted-foreground">••••••••••••</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/20 border-t border-border p-4 flex justify-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Security Protocol Active</p>
                    </CardFooter>
                </Card>

                {/* Danger Zone */}
                <Card className="border-destructive/20 bg-destructive/5 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            危険な操作
                        </CardTitle>
                        <CardDescription>
                            アカウントの削除を行うと、すべてのデータが完全に失われ、復元することはできません。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-6">
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <Button
                                variant="destructive"
                                className="w-full md:w-auto font-semibold"
                                onClick={() => setIsDialogOpen(true)}
                                disabled={isLoading === "delete"}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                アカウントを削除する
                            </Button>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>退会の確認</DialogTitle>
                                    <DialogDescription>
                                        本当にアカウントを削除しますか？<br />
                                        この操作は取り消せません。資産データ、トランザクション、設定など、すべてのデータが完全に失われます。
                                    </DialogDescription>
                                </DialogHeader>

                                {/* パスワード設定済みユーザー向けの入力欄（サーバー側で判定されるため、常に表示するか、ソーシャルログインなら隠す） */}
                                {/* ここでは、セッション情報から画像があればソーシャルログインと推測し、画像がなければパスワード入力を表示する例 */}
                                {!session?.user?.image && (
                                    <div className="space-y-2 py-4">
                                        <Label htmlFor="delete-password">確認のためパスワードを入力してください</Label>
                                        <div className="relative">
                                            <Input
                                                id="delete-password"
                                                type={showDeletePassword ? "text" : "password"}
                                                value={confirmDeletionPassword}
                                                onChange={(e) => setConfirmDeletionPassword(e.target.value)}
                                                placeholder="パスワード"
                                                className="pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowDeletePassword(!showDeletePassword)}
                                                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button
                                        variant="destructive"
                                        onClick={handleDeleteAccount}
                                        disabled={isLoading === "delete" || (!session?.user?.image && !confirmDeletionPassword)}
                                    >
                                        {isLoading === "delete" ? "削除中..." : "すべてを削除して退会する"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setIsDialogOpen(false)
                                            setConfirmDeletionPassword("")
                                        }}
                                        disabled={isLoading === "delete"}
                                    >
                                        キャンセル
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
