import { headers } from "next/headers"

async function getClientInfo() {
    const headersList = await headers()
    const forwarded = headersList.get("x-forwarded-for")
    const clientIp =
        forwarded?.split(",")[0]?.trim() ??
        headersList.get("x-real-ip") ??
        "unknown"
    const userAgent = headersList.get("user-agent") ?? "unknown"
    return { clientIp, userAgent }
}

function formatJstTimestamp(): string {
    return new Date().toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    })
}

async function postSignalyWebhook(webhookUrl: string | undefined, content: string) {
    if (!webhookUrl) {
        console.warn("Signaly webhook URL not set; skipping notification")
        return
    }

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
        })

        if (!response.ok) {
            console.warn(`Signaly webhook failed: ${response.status} ${response.statusText}`)
        }
    } catch (error) {
        console.warn("Failed to send Signaly notification:", error)
    }
}

function formatProviderLabel(provider?: string | null) {
    if (provider === "google") return "Google"
    if (provider === "credentials") return "メール/パスワード"
    return provider ?? "不明"
}

export async function sendLoginNotification(options: {
    email?: string | null
    name?: string | null
    provider?: string | null
}) {
    const webhookUrl = process.env.SIGNALY_LOGIN_WEBHOOK_URL
    const { clientIp, userAgent } = await getClientInfo()
    const timestamp = formatJstTimestamp()

    const content = [
        "🔐 Asset Manager にログインしました",
        `**日時**: ${timestamp} (JST)`,
        `**メール**: ${options.email ?? "不明"}`,
        `**名前**: ${options.name ?? "不明"}`,
        `**認証方式**: ${formatProviderLabel(options.provider)}`,
        `**IP**: ${clientIp}`,
        `**User-Agent**: ${userAgent}`,
    ].join("\n")

    await postSignalyWebhook(webhookUrl, content)
}

export async function sendRegisterNotification(options: {
    email?: string | null
    name?: string | null
    provider: string
}) {
    const webhookUrl = process.env.SIGNALY_REGISTER_WEBHOOK_URL
    const { clientIp, userAgent } = await getClientInfo()
    const timestamp = formatJstTimestamp()

    const content = [
        "📝 Asset Manager に新規登録がありました",
        `**日時**: ${timestamp} (JST)`,
        `**メール**: ${options.email ?? "不明"}`,
        `**名前**: ${options.name ?? "不明"}`,
        `**登録方式**: ${formatProviderLabel(options.provider)}`,
        `**IP**: ${clientIp}`,
        `**User-Agent**: ${userAgent}`,
    ].join("\n")

    await postSignalyWebhook(webhookUrl, content)
}
