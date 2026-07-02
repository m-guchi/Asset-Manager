import { getDashboardData } from "@/app/actions/dashboard"
import { BaseDateReport } from "@/components/base-date/base-date-report"

export const dynamic = "force-dynamic"

export default async function Page() {
    const { categories, history, tagGroups, defaultTimeRange } = await getDashboardData()
    const topLevelCategories = categories.filter((c) => !c.parentId)

    return (
        <div className="flex flex-col gap-2 px-1 py-2 md:px-2 md:py-4">
            <BaseDateReport
                historyData={history}
                categories={topLevelCategories}
                tagGroups={tagGroups}
                initialTimeRange={defaultTimeRange}
            />
        </div>
    )
}
