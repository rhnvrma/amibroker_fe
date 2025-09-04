// src/components/dashboard.tsx
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
import { useWatchlist } from "@/contexts/watchlist-context";
import { useLoginDialog } from "@/contexts/login-dialog-context";
import { isElectron } from "@/lib/utils";

export function Dashboard() {
  const { refreshItems } = useWatchlist();
  const { openLoginDialog } = useLoginDialog();

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
               <SidebarMenuButton className="w-full" onClick={() => refreshItems(true)}>
                <RefreshCw />
                Refresh Items
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="w-full"
                onClick={() => openLoginDialog()}
              >
                <KeyRound />
                Generate Token
              </SidebarMenuButton>
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