// src/contexts/watchlist-context.tsx
"use client";

import type { Watchlist, WatchlistItem } from "@/lib/types";
import { initialData } from "@/lib/initial-data";
import { useToast } from "@/hooks/use-toast";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

// This will hold the items fetched from the backend.
let availableItems: Omit<WatchlistItem, "id" | "dateAdded">[] = [];

export function updateAvailableItems(items: Omit<WatchlistItem, "id" | "dateAdded">[]) {
  availableItems = items;
}
interface WatchlistContextType {
  watchlists: Watchlist[];
  activeWatchlist: Watchlist | null;
  setActiveWatchlistId: (id: string) => void;
  addWatchlist: (name: string) => void;
  renameWatchlist: (id: string, newName: string) => void;
  deleteWatchlist: (id: string) => void;
  setDefaultWatchlist: (id: string) => void;
  addItem: (item: Omit<WatchlistItem, "id" | "dateAdded">) => void;
  addItems: (items: Omit<WatchlistItem, "id" | "dateAdded">[]) => void;
  updateItem: (item: WatchlistItem) => void;
  deleteItem: (itemId: string) => void;
  deleteItems: (itemIds: string[]) => void;
  importWatchlist: (file: File) => void;
  exportWatchlist: () => void;
  refreshItems: (showToast?: boolean) => Promise<void>;
  availableItems: Omit<WatchlistItem, "id" | "dateAdded">[];
  exportDefaultWatchlistJson: () => void;
}

const WatchlistContext = createContext<WatchlistContextType | null>(null);

const LOCAL_STORAGE_KEY = "watchtower_data_v2";

// Helper to get initial state
const getInitialState = () => {
  try {
    const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedData) {
      const parsedData = JSON.parse(storedData) as Watchlist[];
      
      // Synchronize with available items
      const availableKeys = new Set(availableItems.map(item => item.instrument_key));
      const syncedWatchlists = parsedData.map((watchlist: Watchlist) => ({
        ...watchlist,
        items: watchlist.items.filter(item => availableKeys.has(item.instrument_key))
      }));
      
      return syncedWatchlists;
    }
  } catch (error) {
    console.error("Failed to parse data from localStorage, using initial data.", error);
  }
  
  // If no stored data or parsing failed, save initial data to localStorage
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData));
  return initialData;
};


export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const { toast } = useToast();
  const [_, setRefreshed] = useState(false);

  const refreshItems = useCallback(async (showToast: boolean = true) => {
    try {
      const items = await window.electron.refreshItems();
      updateAvailableItems(items);
      setRefreshed(r => !r);
      if (showToast) {
        toast({
          title: "Items refreshed",
          description: "The list of available items has been updated.",
        });
      }
    } catch (error) {
      console.error("Failed to refresh items", error);
      toast({
        variant: "destructive",
        title: "Refresh failed",
        description: "Could not update the list of available items.",
      });
    }
  }, [toast]);

  // COMBINED EFFECT for initial startup logic
  useEffect(() => {
    const initializeData = async () => {
      // Refresh items silently on startup without a toast
      const refreshedItems = await window.electron.refreshItems();
      updateAvailableItems(refreshedItems);

      // Then load watchlists from local storage
      const data = getInitialState();
      setWatchlists(data);
      const defaultWatchlist = data.find((wl: Watchlist) => wl.isDefault);
      setActiveWatchlistId(defaultWatchlist ? defaultWatchlist.id : data[0]?.id || null);
    };

    initializeData();
  }, []);

  useEffect(() => {
    // This effect persists changes to watchlists back to localStorage.
    if (watchlists.length > 0) {
      try {
         localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(watchlists));
      } catch (error) {
        console.error("Failed to save data to localStorage", error);
      }
    }
  }, [watchlists]);

  const activeWatchlist = watchlists.find((wl) => wl.id === activeWatchlistId) || null;

  const addWatchlist = (name: string) => {
    const newWatchlist: Watchlist = {
      id: `wl-${Date.now()}`,
      name,
      items: [],
    };
    setWatchlists((prev) => [...prev, newWatchlist]);
    setActiveWatchlistId(newWatchlist.id);
  };

  const renameWatchlist = (id: string, newName: string) => {
    setWatchlists((prev) =>
      prev.map((wl) => (wl.id === id ? { ...wl, name: newName } : wl))
    );
    toast({ title: "Watchlist renamed" });
  };

  const deleteWatchlist = (id: string) => {
    setWatchlists((prev) => {
      const newWatchlists = prev.filter((wl) => wl.id !== id);
      if (activeWatchlistId === id) {
        const defaultWl = newWatchlists.find(wl => wl.isDefault);
        setActiveWatchlistId(defaultWl ? defaultWl.id : newWatchlists[0]?.id || null);
      }
      // If we delete the last watchlist, clear local storage
      if (newWatchlists.length === 0) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
      return newWatchlists;
    });
    toast({ title: "Watchlist deleted" });
  };

  const setDefaultWatchlist = (id: string) => {
    setWatchlists((prev) =>
      prev.map((wl) => ({ ...wl, isDefault: wl.id === id }))
    );
  };

  const addItem = (itemData: Omit<WatchlistItem, "id" | "dateAdded">) => {
    if (!activeWatchlistId) return;
    const newItem: WatchlistItem = {
      ...itemData,
      id: `item-${Date.now()}`,
      dateAdded: new Date().toISOString(),
    };
    setWatchlists((prev) =>
      prev.map((wl) =>
        wl.id === activeWatchlistId
          ? { ...wl, items: [...wl.items, newItem] }
          : wl
      )
    );
    toast({ title: "Item added" });
  };

  const addItems = (itemsData: Omit<WatchlistItem, "id" | "dateAdded">[]) => {
    if (!activeWatchlistId) return;
    const newItems: WatchlistItem[] = itemsData.map((item, index) => ({
      ...item,
      id: `item-${Date.now()}-${index}`,
      dateAdded: new Date().toISOString(),
    }))

    setWatchlists((prev) =>
      prev.map((wl) =>
        wl.id === activeWatchlistId
          ? { ...wl, items: [...wl.items, ...newItems] }
          : wl
      )
    );
    toast({ title: `${newItems.length} ${newItems.length > 1 ? 'items' : 'item'} added` });
  }

  const updateItem = (updatedItem: WatchlistItem) => {
    if (!activeWatchlistId) return;
    setWatchlists((prev) =>
      prev.map((wl) =>
        wl.id === activeWatchlistId
          ? {
              ...wl,
              items: wl.items.map((item) =>
                item.id === updatedItem.id ? updatedItem : item
              ),
            }
          : wl
      )
    );
    toast({ title: "Item updated" });
  };

  const deleteItem = (itemId: string) => {
    if (!activeWatchlistId) return;
    setWatchlists((prev) =>
      prev.map((wl) =>
        wl.id === activeWatchlistId
          ? { ...wl, items: wl.items.filter((item) => item.id !== itemId) }
          : wl
      )
    );
    toast({ title: "Item removed" });
  };
  
  const deleteItems = (itemIds: string[]) => {
    if (!activeWatchlistId) return;
    setWatchlists((prev) =>
      prev.map((wl) =>
        wl.id === activeWatchlistId
          ? { ...wl, items: wl.items.filter((item) => !itemIds.includes(item.id)) }
          : wl
      )
    );
    toast({ title: `${itemIds.length} ${itemIds.length > 1 ? 'items' : 'item'} removed` });
  }

  const importWatchlist = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const imported = JSON.parse(content) as Watchlist;
        // Basic validation
        if (imported.name && Array.isArray(imported.items)) {
          const newWatchlist = { ...imported, id: `wl-${Date.now()}`, isDefault: false };
          setWatchlists(prev => [...prev, newWatchlist]);
          setActiveWatchlistId(newWatchlist.id);
          toast({ title: `Watchlist "${newWatchlist.name}" imported.` });
        } else {
          throw new Error("Invalid file format");
        }
      } catch (e) {
        toast({ variant: "destructive", title: "Import failed", description: "Invalid watchlist file." });
      }
    };
    reader.readAsText(file);
  };
  
  const exportWatchlist = () => {
    if (!activeWatchlist) return;
    const dataStr = JSON.stringify(activeWatchlist, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${activeWatchlist.name.replace(/\s+/g, '_')}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast({ title: "Watchlist exported." });
  };

  const exportDefaultWatchlistJson = async () => {
    const defaultWatchlist = watchlists.find(wl => wl.isDefault);
    if (!defaultWatchlist) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "No default watchlist set.",
      });
      return;
    }

    const filename = `new_stocks.json`;
    try {
      const result = await window.electron.exportWatchlistJson(defaultWatchlist, filename);
      if (result.success) {
        toast({ title: `Watchlist "${defaultWatchlist.name}" exported.` });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: (error as Error).message,
      });
    }
  };

  return (
    <WatchlistContext.Provider
      value={{
        watchlists,
        activeWatchlist,
        setActiveWatchlistId,
        addWatchlist,
        renameWatchlist,
        deleteWatchlist,
        setDefaultWatchlist,
        addItem,
        addItems,
        updateItem,
        deleteItem,
        deleteItems,
        importWatchlist,
        exportWatchlist,
        refreshItems,
        availableItems,
        exportDefaultWatchlistJson,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error("useWatchlist must be used within a WatchlistProvider");
  }
  return context;
}