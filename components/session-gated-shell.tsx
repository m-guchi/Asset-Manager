import { headers } from "next/headers";
import { shouldSkipServerSession } from "@/lib/public-paths";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { PageTitle } from "@/components/page-title";
import { TutorialDialogLazy as TutorialDialog } from "@/components/TutorialDialogLazy";

export async function SessionGatedShell({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    await new Promise((r) => setTimeout(r, 3000));
    const pathname = (await headers()).get("x-pathname") ?? "";
    const skipSession = shouldSkipServerSession(pathname);
    const session = skipSession
        ? null
        : await (async () => {
            const { getServerSession } = await import("next-auth");
            const { authOptions } = await import("@/auth");
            return getServerSession(authOptions);
        })();

    return session ? (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-2 backdrop-blur-sm bg-background/50 sticky top-0 z-10 transition-all duration-200">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <div className="flex items-center gap-2">
                        <PageTitle />
                    </div>
                </header>
                <div className="flex flex-1 flex-col gap-4 px-2 pb-4 pt-0">
                    {children}
                </div>
                <TutorialDialog />
            </SidebarInset>
        </SidebarProvider>
    ) : (
        <div className="min-h-screen">
            {children}
        </div>
    );
}
