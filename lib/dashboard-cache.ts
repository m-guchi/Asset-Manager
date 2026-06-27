import { updateTag } from "next/cache"

const DASHBOARD_CACHE_PREFIX = "dashboard"

export function dashboardCacheTag(userId: string): string {
    return `${DASHBOARD_CACHE_PREFIX}-${userId}`
}

export function revalidateUserDashboard(userId: string): void {
    updateTag(dashboardCacheTag(userId))
}
