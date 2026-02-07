import { getCategories } from "./actions/categories";
import { getHistoryData } from "./actions/history";
import { getTagGroups } from "./actions/tags";
import { getDefaultTimeRange } from "./actions/settings";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const dynamic = "force-dynamic";

export default async function Page() {
    // 1. Fetch ALL necessary data on the server side
    const [categories, history, tagGroups, defaultTimeRange] = await Promise.all([
        getCategories().catch(() => []),
        getHistoryData().catch(() => []),
        getTagGroups().catch(() => []),
        getDefaultTimeRange().catch(() => "1Y")
    ]);

    // 2. Pass everything as initial props to the client content
    return (
        <DashboardContent
            initialCategories={categories}
            initialHistory={history}
            initialTagGroups={tagGroups}
            defaultTimeRange={defaultTimeRange}
        />
    );
}
