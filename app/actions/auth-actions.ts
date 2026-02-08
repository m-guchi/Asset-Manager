"use server"

import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { seedDummyData } from "@/lib/db/seed"
import { generateVerificationToken } from "@/lib/tokens"
import { sendVerificationEmail } from "@/lib/mail"

export async function signUp(formData: FormData) {
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const name = formData.get("name") as string

    if (!email || !password) {
        return { error: "メールアドレスとパスワードは必須です" }
    }

    try {
        // パスワードのハッシュ化（更新時も使用するため先に計算）
        const hashedPassword = await bcrypt.hash(password, 10)

        // 既存ユーザーの確認
        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        let userId: string;

        if (existingUser) {
            if (existingUser.emailVerified) {
                return { error: "このメールアドレスは既に登録されています" }
            }

            // 未認証の場合は情報を更新（再登録・修正を許可）
            const updatedUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    password: hashedPassword,
                    name: name || email.split("@")[0],
                }
            })
            userId = updatedUser.id;
        } else {
            // 新規作成
            const newUser = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name: name || email.split("@")[0],
                }
            })
            userId = newUser.id;

            // 新規作成時のみ初期データを投入
            await seedDummyData(userId)
        }

        // トークン生成とメール送信（新規・更新に関わらず常に最新のものを送る）
        const verificationToken = await generateVerificationToken(email)
        await sendVerificationEmail(verificationToken.identifier, verificationToken.token)

        return { success: true, message: "確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。" }
    } catch (error) {
        console.error("Sign up error details:", error)
        if (error instanceof Error) {
            return { error: `登録エラー: ${error.message}` }
        }
        return { error: "登録中に不明なエラーが発生しました" }
    }
}

export async function verifyEmail(token: string) {
    if (!token) {
        return { error: "トークンが見つかりません" }
    }

    const existingToken = await prisma.verificationToken.findFirst({
        where: { token }
    })

    if (!existingToken) {
        return { error: "トークンが無効または期限切れです" }
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

    await prisma.user.update({
        where: { id: existingUser.id },
        data: {
            emailVerified: new Date(),
            // email: existingToken.identifier, // メール変更時のロジックとしても使える
        }
    })

    await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: existingToken.identifier, token } }
    })

    return { success: "メールアドレスが確認されました！ログインしてください。" }
}
