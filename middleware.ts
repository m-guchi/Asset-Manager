import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export default async function middleware(request: NextRequest) {
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    })

    const { pathname } = request.nextUrl

    // basePath (/asset-manager) を考慮した相対パスの計算
    // pathname は通常 "/asset-manager" や "/asset-manager/dashboard" になる
    const relativePath = pathname === "/asset-manager"
        ? "/"
        : pathname.replace("/asset-manager/", "/")

    console.log(`[Middleware Debug] pathname: ${pathname}, relativePath: ${relativePath}, hasToken: ${!!token}`);

    // Auth 関連の API や静的ファイルはスキップ
    if (
        pathname.includes("/api/auth") ||
        pathname.includes("_next") ||
        pathname.includes("favicon.ico") ||
        pathname.includes("manifest.json") ||
        pathname.includes("/terms") ||
        pathname.includes("/privacy")
    ) {
        return NextResponse.next()
    }

    // ログインページへのアクセス
    if (relativePath === "/login" || relativePath === "/login/") {
        if (token) {
            return NextResponse.redirect(new URL("/asset-manager", request.url))
        }
        return NextResponse.next()
    }

    // 未ログイン時の保護
    if (!token) {
        console.log(`[Middleware] Redirecting to login from: ${pathname}`);
        const loginUrl = new URL("/asset-manager/login", request.url)
        // 無限ループ防止のため、現在のパスがすでに /login でないことを確認
        if (relativePath !== "/login") {
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
