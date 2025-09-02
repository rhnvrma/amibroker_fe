
"use client";

import React, { useMemo, useState } from "react";
import { useWatchlist } from "@/contexts/watchlist-context";
import { WatchlistHeader } from "@/components/watchlist-header";
import { WatchlistTable } from "@/components/watchlist-table";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { AddItemDialog } from "./add-item-dialog";
import { Plus } from "lucide-react";
import type { WatchlistItem } from "@/lib/types";

type SortKey = keyof Omit<WatchlistItem, 'id'>;
type SortDirection = "asc" | "desc";

export function WatchlistContent() {
  const { activeWatchlist } = useWatchlist();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("dateAdded");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const filteredAndSortedItems = useMemo(() => {
    if (!activeWatchlist?.items) return [];

    let items = [...activeWatchlist.items];

    // Filter by search term
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(lowercasedTerm) ||
          item.trading_symbol.toLowerCase().includes(lowercasedTerm) ||
          item.instrument_key.toLowerCase().includes(lowercasedTerm)
      );
    }

    // Sort
    items.sort((a, b) => {
      let valA, valB;

      if (sortKey === "dateAdded") {
        valA = new Date(a.dateAdded).getTime();
        valB = new Date(b.dateAdded).getTime();
      } else {
        valA = a[sortKey];
        valB = b[sortKey];
      }
      
      if(typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return items;
  }, [activeWatchlist, searchTerm, sortKey, sortDirection]);
  
  // Reset selection when watchlist changes or items are filtered
  React.useEffect(() => {
    setSelectedItemIds([]);
  }, [activeWatchlist, searchTerm, sortKey, sortDirection]);

  if (!activeWatchlist) {
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] rounded-lg border-2 border-dashed bg-card">
            <h2 className="text-2xl font-semibold text-muted-foreground">No Watchlist Selected</h2>
            <p className="text-muted-foreground">Create or select a watchlist to get started.</p>
        </div>
    )
  }

  return (
    <div className="space-y-4">
      <WatchlistHeader
        watchlistName={activeWatchlist.name}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortKey={sortKey}
        setSortKey={setSortKey}
        sortDirection={sortDirection}
        setSortDirection={setSortDirection}
        selectedItemIds={selectedItemIds}
        setSelectedItemIds={setSelectedItemIds}
      />
      {filteredAndSortedItems.length > 0 ? (
        <WatchlistTable 
          items={filteredAndSortedItems} 
          selectedItemIds={selectedItemIds}
          setSelectedItemIds={setSelectedItemIds}
          sortKey={sortKey}
          sortDirection={sortDirection}
          setSortKey={setSortKey}
          setSortDirection={setSortDirection}
        />
      ) : (
        <Card className="text-center py-16">
          <CardHeader>
            <CardTitle className="text-xl text-muted-foreground">This watchlist is empty</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">Add your first item to start tracking.</p>
            <AddItemDialog>
              <Button>
                 <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </AddItemDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
