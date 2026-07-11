"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { prisma } from "@/lib/prisma"
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

export async function deleteAccount() {
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
