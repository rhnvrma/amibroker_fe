"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/sidebar-nav";
import { WatchtowerLogo } from "@/components/icons";
import { WatchlistContent } from "@/components/watchlist-content";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "./ui/sidebar";
import { KeyRound, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useWatchlist } from "@/contexts/watchlist-context";

export function Dashboard() {
  const { refreshItems } = useWatchlist();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <WatchtowerLogo className="w-7 h-7 text-primary" />
            <span className="text-lg font-semibold">Watchtower</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="flex flex-col">
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="w-full" onClick={refreshItems}>
                <RefreshCw />
                Refresh Items
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/">
                <SidebarMenuButton className="w-full">
                  <KeyRound />
                  Generate Token
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <SidebarTrigger className="md:hidden" />
            <h1 className="text-2xl font-semibold grow md:hidden">
              Watchtower
            </h1>
          </div>
          <WatchlistContent />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}