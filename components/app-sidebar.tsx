"use client"

import * as React from "react"
import Link from "next/link"
import {
    PieChart,
    LayoutDashboard,
    Settings,
    Wallet,
    ArrowRightLeft,
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
} from "@/components/ui/sidebar"

// Menus mostly for navigation
const data = {
    navMain: [
        {
            title: "Dashboard",
            url: "/",
            icon: LayoutDashboard,
        },
        {
            title: "Assets",
            url: "/assets",
            icon: Wallet,
        },
        {
            title: "Transactions",
            url: "/transactions",
            icon: ArrowRightLeft,
        },
        {
            title: "Settings",
            url: "/settings",
            icon: Settings,
        },
    ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                    <PieChart className="size-4" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
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
                <SidebarMenu className="p-2 gap-2">
                    {data.navMain.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild tooltip={item.title}>
                                <Link href={item.url}>
                                    <item.icon />
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                <div className="p-4 text-xs text-center text-muted-foreground opacity-50">
                    version 0.1.0
                </div>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
