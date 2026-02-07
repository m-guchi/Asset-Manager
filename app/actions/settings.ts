"use server"

import { cookies } from "next/headers"

const DEFAULT_TIME_RANGE_COOKIE = "default_time_range"

export async function setDefaultTimeRangeAction(range: string) {
    const cookieStore = await cookies()
    cookieStore.set(DEFAULT_TIME_RANGE_COOKIE, range, {
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: "/",
    })
    return { success: true }
}

export async function getDefaultTimeRange() {
    const cookieStore = await cookies()
    return cookieStore.get(DEFAULT_TIME_RANGE_COOKIE)?.value || "1Y"
}
