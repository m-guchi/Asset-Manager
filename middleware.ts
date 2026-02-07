import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export default async function middleware(request: NextRequest) {
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET
    })

    const { pathname } = request.nextUrl
    // 本番環境の basePath (/asset-manager) を考慮して、実際のサイト相対パスを取得
    const relativePath = pathname.replace(/^\/asset-manager/, "") || "/"

    // ログインページへのアクセス
    if (relativePath.startsWith("/login")) {
        if (token) {
            return NextResponse.redirect(new URL("/asset-manager", request.url))
        }
        return NextResponse.next()
    }

    // 保護されたルート
    if (!token) {
        // すでに /login にいない場合のみリダイレクト（無限ループ防止）
        if (!relativePath.startsWith("/login")) {
            return NextResponse.redirect(new URL("/asset-manager/login", request.url))
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
