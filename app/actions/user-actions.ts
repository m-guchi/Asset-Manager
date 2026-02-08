"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { generateEmailChangeToken, generatePasswordChangeToken } from "@/lib/tokens"
import {
    sendEmailChangeVerificationEmail,
    sendEmailChangeNotificationEmail,
    sendPasswordChangeVerificationEmail
} from "@/lib/mail"
import { revalidatePath } from "next/cache"

export async function updateName(name: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return { error: "認証が必要です" }
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { name }
        })
        revalidatePath("/profile")
        return { success: "ユーザー名を更新しました" }
    } catch (error) {
        console.error("Update name error:", error)
        return { error: "更新に失敗しました" }
    }
}

export async function requestEmailChange(newEmail: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return { error: "認証が必要です" }
    }

    if (session.user.email === newEmail) {
        return { error: "現在のメールアドレスと同じです" }
    }

    const existingUser = await prisma.user.findUnique({
        where: { email: newEmail }
    })

    try {
        const token = await generateEmailChangeToken(session.user.email, newEmail)

        // セキュリティ上の理由により、既に登録されている場合は確認メールを送信しない
        if (!existingUser) {
            await sendEmailChangeVerificationEmail(newEmail, token.token)
        }

        return { success: "新しいメールアドレスに確認メールを送信しました" }
    } catch (error) {
        console.error("Request email change error:", error)
        return { error: "リクエストに失敗しました" }
    }
}

export async function requestPasswordChange(newPassword: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return { error: "認証が必要です" }
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        const token = await generatePasswordChangeToken(session.user.email, hashedPassword)
        await sendPasswordChangeVerificationEmail(session.user.email, token.token)
        return { success: "登録済みのメールアドレスに確認メールを送信しました" }
    } catch (error) {
        console.error("Request password change error:", error)
        return { error: "リクエストに失敗しました" }
    }
}

export async function confirmEmailChange(token: string) {
    const existingToken = await prisma.emailChangeToken.findUnique({
        where: { token }
    })

    if (!existingToken) {
        return { error: "トークンが無効です" }
    }

    const hasExpired = new Date(existingToken.expires) < new Date()
    if (hasExpired) {
        return { error: "トークンの有効期限が切れています" }
    }

    const existingUser = await prisma.user.findUnique({
        where: { email: existingToken.identifier } // old email
    })

    if (!existingUser) {
        return { error: "ユーザーが見つかりません" }
    }

    try {
        await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                email: existingToken.newEmail,
                emailVerified: new Date()
            }
        })

        await prisma.emailChangeToken.delete({
            where: { token }
        })

        // 古いメアドに通知
        await sendEmailChangeNotificationEmail(existingToken.identifier, existingToken.newEmail)

        return {
            success: "メールアドレスを更新しました",
            newEmail: existingToken.newEmail
        }
    } catch (error) {
        console.error("Confirm email change error:", error)
        return { error: "更新に失敗しました" }
    }
}

export async function confirmPasswordChange(token: string) {
    const existingToken = await prisma.passwordChangeToken.findUnique({
        where: { token }
    })

    if (!existingToken) {
        return { error: "トークンが無効です" }
    }

    const hasExpired = new Date(existingToken.expires) < new Date()
    if (hasExpired) {
        return { error: "トークンの有効期限が切れています" }
    }

    const existingUser = await prisma.user.findUnique({
        where: { email: existingToken.identifier }
    })

    if (!existingUser) {
        return { error: "ユーザーが見つかりません" }
    }

    try {
        await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                password: existingToken.newPassword
            }
        })

        await prisma.passwordChangeToken.delete({
            where: { token }
        })

        return { success: "パスワードを更新しました" }
    } catch (error) {
        console.error("Confirm password change error:", error)
        return { error: "更新に失敗しました" }
    }
}

export async function getPendingEmailChange() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return null

    try {
        const pending = await prisma.emailChangeToken.findFirst({
            where: { identifier: session.user.email }
        })
        return pending ? { newEmail: pending.newEmail } : null
    } catch (error) {
        console.error("Get pending email error:", error)
        return null
    }
}

export async function cancelEmailChange() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return { error: "認証が必要です" }
    }

    try {
        await prisma.emailChangeToken.deleteMany({
            where: { identifier: session.user.email }
        })
        return { success: "リクエストを取り消しました" }
    } catch (error) {
        console.error("Cancel email change error:", error)
        return { error: "取り消しに失敗しました" }
    }
}

export async function deleteAccount(password?: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return { error: "認証が必要です" }
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id }
        })

        if (!user) {
            return { error: "ユーザーが見つかりません" }
        }

        // パスワードが設定されているユーザーの場合、パスワード検証を必須にする
        if (user.password) {
            if (!password) {
                return { error: "確認のためパスワードを入力してください" }
            }
            const isPasswordValid = await bcrypt.compare(password, user.password)
            if (!isPasswordValid) {
                return { error: "パスワードが正しくありません" }
            }
        }

        // 子関係のあるデータを先に削除して制約エラーを回避
        await prisma.transaction.deleteMany({ where: { userId: session.user.id } })
        await prisma.asset.deleteMany({ where: { userId: session.user.id } })

        // カテゴリの親子関係を解消して自己参照制約によるエラー(P2014)を回避
        await prisma.category.updateMany({
            where: { userId: session.user.id },
            data: { parentId: null }
        })

        await prisma.user.delete({
            where: { id: session.user.id }
        })
        return { success: "アカウントを削除しました" }
    } catch (error) {
        console.error("Delete account error:", error)
        return { error: "アカウントの削除に失敗しました" }
    }
}

export async function completeTutorial() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return { error: "認証が必要です" }
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { hasCompletedTutorial: true }
        })
        revalidatePath("/")
        return { success: "チュートリアルを完了しました" }
    } catch (error) {
        console.error("Complete tutorial error:", error)
        return { error: "更新に失敗しました" }
    }
}
