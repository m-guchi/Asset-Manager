import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function proxy(request: NextRequest) {
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET
    })

    const { pathname } = request.nextUrl

    // ログインページへのアクセス
    if (pathname.startsWith("/login")) {
        if (token) {
            return NextResponse.redirect(new URL("/asset-manager", request.url))
        }
        return NextResponse.next()
    }

    // 保護されたルート
    if (!token) {
        return NextResponse.redirect(new URL("/asset-manager/login", request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
