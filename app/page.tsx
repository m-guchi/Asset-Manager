import { getDashboardData } from "./actions/dashboard";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const dynamic = "force-dynamic";

export default async function Page() {
    const { categories, history, tagGroups, defaultTimeRange } = await getDashboardData();

    return (
        <DashboardContent
            initialCategories={categories}
            initialHistory={history}
            initialTagGroups={tagGroups}
            defaultTimeRange={defaultTimeRange}
        />
    );
}
