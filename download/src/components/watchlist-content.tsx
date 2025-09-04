"use client";

import { useWatchlist } from "@/contexts/watchlist-context";
import { WatchlistHeader } from "./watchlist-header";
import { WatchlistTable } from "./watchlist-table";
import { useState, useMemo } from "react";
import type { WatchlistItem } from "@/lib/types";

type SortKey = keyof Omit<WatchlistItem, 'id'>;
type SortDirection = "asc" | "desc";

export function WatchlistContent() {
  const { activeWatchlist } = useWatchlist();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('expiry');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const filteredItems = useMemo(() => {
    if (!activeWatchlist) return [];
    let items = [...activeWatchlist.items];

    if (searchTerm) {
      const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.trim() !== '');
      items = items.filter(item => {
        return searchTerms.every(term => 
          item.name.toLowerCase().includes(term) ||
          item.trading_symbol.toLowerCase().includes(term) ||
          item.instrument_key.toLowerCase().includes(term) ||
          item.strike_price.toString().toLowerCase().includes(term) ||
          item.segment.toLowerCase().includes(term)
        );
      });
    }

    items.sort((a, b) => {
        const aValue = a[sortKey];
        const bValue = b[sortKey];

        if (aValue < bValue) {
            return sortDirection === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
    });


    return items;
  }, [searchTerm, activeWatchlist, sortKey, sortDirection]);

  if (!activeWatchlist) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Select a watchlist to view its items, or create a new one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WatchlistHeader
        watchlistName={activeWatchlist.name}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedItemIds={selectedItemIds}
        setSelectedItemIds={setSelectedItemIds}
      />
      <WatchlistTable
        items={filteredItems}
        selectedItemIds={selectedItemIds}
        setSelectedItemIds={setSelectedItemIds}
        sortKey={sortKey}
        sortDirection={sortDirection}
        setSortKey={setSortKey}
        setSortDirection={setSortDirection}
      />
    </div>
  );
}