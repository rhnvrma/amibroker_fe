
"use client";

import React from "react";
import { useWatchlist } from "@/contexts/watchlist-context";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Star } from "lucide-react";
import { WatchlistActions } from "./watchlist-actions";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "./ui/badge";

export function SidebarNav() {
  const { watchlists, activeWatchlist, setActiveWatchlistId, addWatchlist } = useWatchlist();
  const [isAdding, setIsAdding] = React.useState(false);
  const [newWatchlistName, setNewWatchlistName] = React.useState("");

  const parentRef = React.useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: watchlists.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // Corresponds to h-9
    gap: 4, // Corresponds to gap-1 in SidebarMenu
  });

  const handleAddWatchlist = () => {
    if (newWatchlistName.trim()) {
      addWatchlist(newWatchlistName.trim());
      setNewWatchlistName("");
      setIsAdding(false);
    }
  };

  return (
    <>
      <SidebarGroup className="flex-1 flex flex-col">
        <div className="px-2 pb-2">
          {isAdding ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddWatchlist()}
                onBlur={() => {
                  setIsAdding(false);
                  setNewWatchlistName("");
                }}
                placeholder="New watchlist name"
              />
              <Button size="icon" onClick={handleAddWatchlist}>
                <Plus />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4" /> Create Watchlist
            </Button>
          )}
        </div>
        <div ref={parentRef} className="overflow-y-auto flex-1">
          <SidebarMenu style={{ height: `${rowVirtualizer.getTotalSize()}px` }} className="relative">
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const watchlist = watchlists[virtualItem.index];
              return (
                <SidebarMenuItem 
                  key={watchlist.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <SidebarMenuButton
                    onClick={() => setActiveWatchlistId(watchlist.id)}
                    isActive={activeWatchlist?.id === watchlist.id}
                    className="justify-start pr-12 h-full"
                  >
                    {watchlist.isDefault && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                    <span className="truncate grow">{watchlist.name}</span>
                    <Badge variant="secondary">{watchlist.items.length}</Badge>
                  </SidebarMenuButton>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <WatchlistActions watchlist={watchlist} />
                  </div>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>
      </SidebarGroup>
    </>
  );
}
