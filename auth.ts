import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { NextAuthOptions } from "next-auth"
import { seedDummyData } from "@/lib/db/seed"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
    providers: [
        GoogleProvider({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("メールアドレスとパスワードを入力してください")
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                })

                if (!user || !user.password) {
                    throw new Error("ユーザーが見つからないか、パスワードが設定されていません")
                }

                if (!user.emailVerified) {
                    throw new Error("メールアドレスの確認が完了していません。メールをチェックしてください。")
                }

                const isValid = await bcrypt.compare(credentials.password, user.password)

                if (!isValid) {
                    throw new Error("パスワードが正しくありません")
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    hasCompletedTutorial: user.hasCompletedTutorial,
                }
            }
        })
    ],
    session: {
        strategy: "jwt"
    },
    secret: process.env.NEXTAUTH_SECRET,
    useSecureCookies: process.env.NODE_ENV === "production",
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.name = user.name;
                token.email = user.email;
                token.hasCompletedTutorial = (user as any).hasCompletedTutorial;
            }
            if (trigger === "update") {
                if (session?.name) token.name = session.name;
                if (session?.email) token.email = session.email;
                if (session?.hasCompletedTutorial !== undefined) token.hasCompletedTutorial = session.hasCompletedTutorial;
            } else if (token.id) {
                // 定期的にDBから最新情報を取得してトークンを更新
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { name: true, email: true, hasCompletedTutorial: true }
                });
                if (dbUser) {
                    token.name = dbUser.name;
                    token.email = dbUser.email;
                    token.hasCompletedTutorial = dbUser.hasCompletedTutorial;
                }
            }
            return token;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session({ session, token }: { session: any; token: any }) {
            if (session.user) {
                session.user.id = token.id || token.sub;
                session.user.name = token.name;
                session.user.email = token.email;
                session.user.hasCompletedTutorial = token.hasCompletedTutorial;
            }
            return session;
        },
    },
    events: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async createUser({ user }: { user: any }) {
            if (user.id) {
                await seedDummyData(user.id);
            }
        },
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    debug: process.env.NODE_ENV === "development",
}
