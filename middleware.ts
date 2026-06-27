import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { getSessionCookieName } from "@/lib/auth-cookie"
import { isPublicPath } from "@/lib/public-paths"

async function getTokenSafe(request: NextRequest) {
    try {
        return await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET,
        })
    } catch {
        return null
    }
}

function attachPathHeader(response: NextResponse, pathname: string): NextResponse {
    response.headers.set("x-pathname", pathname)
    return response
}

function clearSessionCookie(response: NextResponse): void {
    response.cookies.set(getSessionCookieName(), "", {
        maxAge: 0,
        path: "/",
    })
}

export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const sessionCookie = request.cookies.get(getSessionCookieName())

    if (isPublicPath(pathname)) {
        if (pathname === "/login" || pathname === "/login/") {
            if (!sessionCookie?.value) {
                return attachPathHeader(NextResponse.next(), pathname)
            }

            const token = await getTokenSafe(request)
            if (token) {
                return NextResponse.redirect(new URL("/", request.url))
            }

            const response = attachPathHeader(NextResponse.next(), pathname)
            if (sessionCookie?.value) {
                clearSessionCookie(response)
            }
            return response
        }

        return attachPathHeader(NextResponse.next(), pathname)
    }

    if (!sessionCookie?.value) {
        const loginUrl = new URL("/login", request.url)
        loginUrl.searchParams.set("callbackUrl", request.url)
        return NextResponse.redirect(loginUrl)
    }

    const token = await getTokenSafe(request)
    if (!token) {
        const loginUrl = new URL("/login", request.url)
        loginUrl.searchParams.set("callbackUrl", request.url)
        const response = NextResponse.redirect(loginUrl)
        clearSessionCookie(response)
        return response
    }

    return attachPathHeader(NextResponse.next(), pathname)
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|_next/webpack-hmr).*)",
    ],
}
