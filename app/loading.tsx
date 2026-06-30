import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function Loading() {
    return (
        <div className="flex flex-col gap-2 px-1 py-2 md:px-2 md:py-4">
            <section>
                <Card className="overflow-hidden border shadow-sm">
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 md:p-6">
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                    </CardContent>
                </Card>
            </section>

            <section className="mb-2">
                <Skeleton className="h-80 rounded-xl" />
            </section>

            <section>
                <Skeleton className="h-64 rounded-xl" />
            </section>
        </div>
    )
}
