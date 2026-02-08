import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { PageTitle } from "@/components/page-title";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/providers/session-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "資産管理",
    description: "資産の推移と構成を、美しく直感的に管理するポートフォリオ・トラッカー",
    manifest: "/manifest.json",
    icons: {
        icon: "/icon.svg",
        shortcut: "/icon.svg",
        apple: "/icon.svg",
    },
    appleWebApp: {
        capable: true,
        title: "資産管理",
        statusBarStyle: "black-translucent",
    },
};

import { Toaster } from "@/components/ui/sonner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await getServerSession(authOptions);

    return (
        <html lang="ja" suppressHydrationWarning>
            <body className={`${inter.className} antialiased bg-background text-foreground`}>
                <AuthProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        {session ? (
                            <SidebarProvider>
                                <AppSidebar />
                                <SidebarInset>
                                    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-sm bg-background/50 sticky top-0 z-10 transition-all duration-200">
                                        <SidebarTrigger className="-ml-1" />
                                        <Separator orientation="vertical" className="mr-2 h-4" />
                                        <div className="flex items-center gap-2">
                                            <PageTitle />
                                        </div>
                                    </header>
                                    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                                        {children}
                                    </div>
                                </SidebarInset>
                            </SidebarProvider>
                        ) : (
                            <div className="min-h-screen">
                                {children}
                            </div>
                        )}
                        <Toaster />
                    </ThemeProvider>
                </AuthProvider>
            </body>
        </html>
    );
}

