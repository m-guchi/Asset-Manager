import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const PUBLIC_PATH_PREFIXES = [
    "/api/auth",
    "/auth/verify",
    "/auth/reset-password",
    "/auth/confirm-email-change",
    "/auth/confirm-password-change",
    "/terms",
    "/privacy",
]

const PUBLIC_PATHS = new Set([
    "/login",
    "/icon.svg",
    "/favicon.ico",
    "/manifest.json",
    "/robots.txt",
    "/sitemap.xml",
])

function isPublicPath(pathname: string): boolean {
    if (PUBLIC_PATHS.has(pathname)) return true
    if (pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$/)) return true
    return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (isPublicPath(pathname)) {
        if (pathname === "/login" || pathname === "/login/") {
            const token = await getToken({
                req: request,
                secret: process.env.NEXTAUTH_SECRET,
            })
            if (token) {
                return NextResponse.redirect(new URL("/", request.url))
            }
        }
        return NextResponse.next()
    }

    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
        const loginUrl = new URL("/login", request.url)
        loginUrl.searchParams.set("callbackUrl", request.url)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|_next/webpack-hmr).*)",
    ],
}
