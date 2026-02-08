import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export default async function middleware(request: NextRequest) {
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    })

    const { pathname } = request.nextUrl

    console.log(`[Middleware Debug] pathname: ${pathname}, hasToken: ${!!token}`);

    // Auth 関連、静的ファイル、PWA/SEO 関連のファイルは認証をスキップ
    if (
        pathname.includes("/api/auth") ||
        pathname.includes("_next") ||
        pathname.startsWith("/icon.svg") ||
        pathname.startsWith("/favicon.ico") ||
        pathname.startsWith("/manifest.json") ||
        pathname.startsWith("/robots.txt") ||
        pathname.startsWith("/sitemap.xml") ||
        pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$/) ||
        pathname.includes("/terms") ||
        pathname.includes("/privacy")
    ) {
        return NextResponse.next()
    }

    // ログインページへのアクセス
    if (pathname === "/login" || pathname === "/login/") {
        if (token) {
            return NextResponse.redirect(new URL("/", request.url))
        }
        return NextResponse.next()
    }

    // 未ログイン時の保護
    if (!token) {
        console.log(`[Middleware] Redirecting to login from: ${pathname}`);
        const loginUrl = new URL("/login", request.url)
        // 無限ループ防止のため、現在のパスがすでに /login でないことを確認
        if (pathname !== "/login") {
            loginUrl.searchParams.set("callbackUrl", request.url)
            return NextResponse.redirect(loginUrl)
        }
    }

    return NextResponse.next()
}

export const config = {
    // すべてのリクエストに対して実行し、内部で除外パスを判定する方式に変更
    matcher: ["/:path*"],
}
