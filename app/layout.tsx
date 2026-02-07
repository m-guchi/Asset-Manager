import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";

import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Asset Manager",
    description: "資産の推移と構成を、美しく直感的に管理するポートフォリオ・トラッカー",
    manifest: "/asset-manager/manifest.json",
    icons: {
        icon: "/asset-manager/icon.svg",
        apple: "/asset-manager/icon.svg",
    },
    appleWebApp: {
        capable: true,
        title: "Asset Manager",
        statusBarStyle: "black-translucent",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ja" suppressHydrationWarning>
            <body className={`${inter.className} antialiased bg-background text-foreground`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <SidebarProvider>
                        <AppSidebar />
                        <SidebarInset>
                            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-sm bg-background/50 sticky top-0 z-10 transition-all duration-200">
                                <SidebarTrigger className="-ml-1" />
                                <Separator orientation="vertical" className="mr-2 h-4" />
                                <div className="flex items-center gap-2">
                                    <Link href="/" className="font-semibold text-sm hover:text-primary transition-colors">Dashboard</Link>
                                </div>
                            </header>
                            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                                {children}
                            </div>
                        </SidebarInset>
                    </SidebarProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
