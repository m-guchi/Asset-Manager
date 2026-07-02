import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/providers/session-provider";
import { SessionGatedShell } from "@/components/session-gated-shell";
import { AppStartupFallback } from "@/components/app-startup-fallback";

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
import { GoogleAnalytics } from "@next/third-parties/google";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const gaId = process.env.NEXT_PUBLIC_GA_ID;

    return (
        <html lang="ja" suppressHydrationWarning>
            <body className={`${inter.className} antialiased bg-background text-foreground`}>
                {gaId && <GoogleAnalytics gaId={gaId} />}
                <AuthProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <Suspense fallback={<AppStartupFallback />}>
                            <SessionGatedShell>{children}</SessionGatedShell>
                        </Suspense>
                        <Toaster />
                    </ThemeProvider>
                </AuthProvider>
            </body>
        </html>
    );
}

