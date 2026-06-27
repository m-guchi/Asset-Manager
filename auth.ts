import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { NextAuthOptions } from "next-auth"
import { seedDummyData } from "@/lib/db/seed"
import { sendLoginNotification, sendRegisterNotification } from "@/lib/discord"
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
    cookies: {
        sessionToken: {
            name:
                process.env.NODE_ENV === "production"
                    ? "__Secure-next-auth.session-token"
                    : "next-auth.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
        callbackUrl: {
            name:
                process.env.NODE_ENV === "production"
                    ? "__Secure-next-auth.callback-url"
                    : "next-auth.callback-url",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
        csrfToken: {
            name:
                process.env.NODE_ENV === "production"
                    ? "__Host-next-auth.csrf-token"
                    : "next-auth.csrf-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
        pkceCodeVerifier: {
            name:
                process.env.NODE_ENV === "production"
                    ? "__Secure-next-auth.pkce.code_verifier"
                    : "next-auth.pkce.code_verifier",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 15,
            },
        },
        state: {
            name:
                process.env.NODE_ENV === "production"
                    ? "__Secure-next-auth.state"
                    : "next-auth.state",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 15,
            },
        },
    },
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.name = user.name;
                token.email = user.email;
                token.hasCompletedTutorial = user.hasCompletedTutorial;
            }
            if (trigger === "update") {
                if (session?.name) token.name = session.name;
                if (session?.email) token.email = session.email;
                if (session?.hasCompletedTutorial !== undefined) token.hasCompletedTutorial = session.hasCompletedTutorial;
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
        async signIn({ user, account }: { user: any; account: any }) {
            await sendLoginNotification({
                email: user.email,
                name: user.name,
                provider: account?.provider,
            })
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async createUser({ user }: { user: any }) {
            if (user.id) {
                await seedDummyData(user.id)
                await sendRegisterNotification({
                    email: user.email,
                    name: user.name,
                    provider: "google",
                })
            }
        },
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    debug: process.env.NODE_ENV === "development",
}
