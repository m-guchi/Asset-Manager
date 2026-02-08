import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import GoogleProvider from "next-auth/providers/google"
import { NextAuthOptions } from "next-auth"
import { seedDummyData } from "@/lib/db/seed"

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
    providers: [
        GoogleProvider({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        }),
    ],
    session: {
        strategy: "jwt"
    },
    secret: process.env.NEXTAUTH_SECRET,
    useSecureCookies: process.env.NODE_ENV === "production",
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === "production" ? `__Secure-next-auth.session-token` : `next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/asset-manager",
                secure: process.env.NODE_ENV === "production",
            },
        },
        callbackUrl: {
            name: process.env.NODE_ENV === "production" ? `__Secure-next-auth.callback-url` : `next-auth.callback-url`,
            options: {
                sameSite: "lax",
                path: "/asset-manager",
                secure: process.env.NODE_ENV === "production",
            },
        },
        csrfToken: {
            name: process.env.NODE_ENV === "production" ? `__Host-next-auth.csrf-token` : `next-auth.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/asset-manager",
                secure: process.env.NODE_ENV === "production",
            },
        },
    },
    callbacks: {
        async redirect({ url, baseUrl }: { url: string, baseUrl: string }) {
            // baseUrl is usually process.env.NEXTAUTH_URL
            // If the redirect URL doesn't start with the expected subpath, prepend it.
            if (url.startsWith("/")) return `${baseUrl}${url}`
            else if (new URL(url).origin === new URL(baseUrl).origin) return url
            return baseUrl
        },
        session({ session, token }: { session: any, token: any }) {
            if (session.user && token.sub) {
                session.user.id = token.sub
            }
            return session
        },
    },
    events: {
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
