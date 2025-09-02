"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/sidebar-nav";
import { WatchtowerLogo } from "@/components/icons";
import { WatchlistContent } from "@/components/watchlist-content";

export function Dashboard() {
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
      </Sidebar>
      <SidebarInset>
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <SidebarTrigger className="md:hidden" />
            <h1 className="text-2xl font-semibold grow md:hidden">Watchtower</h1>
          </div>
          <WatchlistContent />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
