"use client"

import * as React from "react"
import Link from "next/link"
import {
    PieChart,
    LayoutDashboard,
    Settings,
    Wallet,
    ArrowRightLeft,
    Database,
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar"

// Menus mostly for navigation
const data = {
    navMain: [
        {
            title: "ダッシュボード",
            url: "/",
            icon: LayoutDashboard,
        },
        {
            title: "資産管理",
            url: "/assets",
            icon: Wallet,
        },
        {
            title: "取引履歴",
            url: "/transactions",
            icon: ArrowRightLeft,
        },
        {
            title: "評価額一括更新",
            url: "/assets/valuation",
            icon: Wallet,
        },
    ],
    navSecondary: [
        {
            title: "データ管理",
            url: "/data-management",
            icon: Database,
        },
        {
            title: "設定",
            url: "/settings",
            icon: Settings,
        },
    ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { isMobile, setOpenMobile } = useSidebar()

    return (
        <Sidebar collapsible="icon" {...props} className="border-r-0">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/" onClick={() => isMobile && setOpenMobile(false)}>
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                    <img src="/asset-manager/icon.svg" alt="App Logo" className="size-4" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                                    <span className="truncate font-semibold uppercase tracking-widest">
                                        ASSETS
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        Portfolio Tracker
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu className="p-2 gap-2.5">
                    {data.navMain.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild tooltip={item.title} size="lg">
                                <Link href={item.url} onClick={() => isMobile && setOpenMobile(false)}>
                                    <item.icon />
                                    <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="mt-auto">
                <div className="mx-4 mb-3 border-t pt-2 opacity-50" />
                <SidebarMenu className="p-2 pt-0 gap-2.5">
                    {data.navSecondary.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild tooltip={item.title} size="lg">
                                <Link href={item.url} onClick={() => isMobile && setOpenMobile(false)}>
                                    <item.icon />
                                    <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
                <div className="p-2 pb-6 text-[10px] text-center text-muted-foreground opacity-30 group-data-[collapsible=icon]:hidden">
                    version {process.env.NEXT_PUBLIC_APP_VERSION}
                </div>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
