const PROD_AUTH_COOKIE_NAMES = [
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.callback-url",
    "__Host-next-auth.csrf-token",
    "__Secure-next-auth.pkce.code_verifier",
    "__Secure-next-auth.state",
] as const

const DEV_AUTH_COOKIE_NAMES = [
    "next-auth.session-token",
    "next-auth.callback-url",
    "next-auth.csrf-token",
    "next-auth.pkce.code_verifier",
    "next-auth.state",
] as const

export function getAuthCookieNames(): readonly string[] {
    return process.env.NODE_ENV === "production"
        ? PROD_AUTH_COOKIE_NAMES
        : DEV_AUTH_COOKIE_NAMES
}

export function getSessionCookieName(): string {
    return process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token"
}

export function hasAuthCookies(request: { cookies: { get: (name: string) => { value: string } | undefined } }): boolean {
    return getAuthCookieNames().some((name) => Boolean(request.cookies.get(name)?.value))
}

/** 壊れたセッションや OAuth 途中の Cookie をまとめて削除する */
export function clearAllAuthCookies(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }): void {
    const isProd = process.env.NODE_ENV === "production"
    for (const name of getAuthCookieNames()) {
        response.cookies.set(name, "", {
            maxAge: 0,
            path: "/",
            secure: isProd,
            httpOnly: true,
            sameSite: "lax",
        })
    }
}
