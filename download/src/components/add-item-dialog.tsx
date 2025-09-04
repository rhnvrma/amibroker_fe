"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWatchlist } from "@/contexts/watchlist-context";
import type { WatchlistItem } from "@/lib/types";
import { useState, useMemo, type ReactNode, useRef } from "react";
import { Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "./ui/scroll-area";
import { Checkbox } from "./ui/checkbox";
import { useVirtualizer } from "@tanstack/react-virtual";

interface AddItemDialogProps {
  children: ReactNode;
}

export function AddItemDialog({ children }: AddItemDialogProps) {
  const { addItems, activeWatchlist, availableItems } = useWatchlist();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<Omit<WatchlistItem, 'id' | 'dateAdded'>[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    const existingKeys = new Set(activeWatchlist?.items.map(item => item.instrument_key));
    
    let items = availableItems.filter(item => !existingKeys.has(item.instrument_key));
    
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
    return items;
  }, [searchTerm, activeWatchlist, availableItems]);

  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52, // Corresponds to p-2 (8px*2) + font sizes and line heights
    gap: 0,
  });

  const handleSelect = (item: Omit<WatchlistItem, 'id' | 'dateAdded'>) => {
    setSelectedItems(prev => {
        const isSelected = prev.some(selected => selected.instrument_key === item.instrument_key);
        if (isSelected) {
            return prev.filter(selected => selected.instrument_key !== item.instrument_key);
        } else {
            return [...prev, item];
        }
    });
  }

  const handleRowClick = (index: number, event: React.MouseEvent<HTMLDivElement>) => {
    const item = filteredItems[index];
    const isSelected = selectedItems.some(selected => selected.instrument_key === item.instrument_key);
    
    if (event.nativeEvent.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const itemsToSelect = filteredItems.slice(start, end + 1);

      setSelectedItems(prev => {
        const newSelectedSymbols = new Set(prev.map(i => i.instrument_key));
        if (!isSelected) { // If the current item is not selected, select the range
            itemsToSelect.forEach(itemToAdd => newSelectedSymbols.add(itemToAdd.instrument_key));
        } else { // If the current item is selected, deselect the range
            const itemsToDeselectSymbols = new Set(itemsToSelect.map(i => i.instrument_key));
            itemsToDeselectSymbols.forEach(symbol => newSelectedSymbols.delete(symbol));
        }
        const newSelectedItems = availableItems.filter(i => newSelectedSymbols.has(i.instrument_key));
        return newSelectedItems;
      });

    } else {
        handleSelect(item);
        setLastSelectedIndex(index);
    }
  };


  const handleSubmit = () => {
    if (selectedItems.length > 0) {
      addItems(selectedItems);
      setIsOpen(false);
      setSelectedItems([]);
      setSearchTerm("");
      setLastSelectedIndex(null);
    } else {
        toast({
            variant: "destructive",
            title: "No items selected",
            description: "Please select at least one item to add.",
        });
    }
  };
  
  const resetState = () => {
    if (!isOpen) {
        setSearchTerm("");
        setSelectedItems([]);
        setLastSelectedIndex(null);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); resetState(); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Instruments to Watchlist</DialogTitle>
          <DialogDescription>
            Search for instruments and add them to your watchlist.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
            {/* Left Pane */}
            <div className="flex flex-col gap-4 overflow-hidden">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search instruments..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div ref={parentRef} className="flex-1 border rounded-md overflow-y-auto">
                    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {rowVirtualizer.getVirtualItems().map(virtualItem => {
                            const item = filteredItems[virtualItem.index];
                            const isSelected = selectedItems.some(selected => selected.instrument_key === item.instrument_key);
                            return (
                                <div 
                                  key={item.instrument_key} 
                                  onClick={(e) => handleRowClick(virtualItem.index, e)}
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualItem.size}px`,
                                    transform: `translateY(${virtualItem.start}px)`,
                                  }}
                                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                >
                                    <Checkbox
                                        id={`select-${item.instrument_key}`}
                                        checked={isSelected}
                                        className="pointer-events-none"
                                    />
                                    <label htmlFor={`select-${item.instrument_key}`} className="flex-1 cursor-pointer pointer-events-none">
                                        <div className="font-medium">{item.trading_symbol}</div>
                                        <div className="text-sm text-muted-foreground">{item.name}</div>
                                    </label>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
            {/* Right Pane */}
            <div className="flex flex-col gap-4 overflow-hidden">
                <h3 className="font-semibold">{selectedItems.length} items selected</h3>
                <ScrollArea className="flex-1 border rounded-md">
                    <div className="p-2">
                        {selectedItems.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10">
                                Selected items will appear here.
                            </div>
                        ) : (
                            selectedItems.map(item => (
                                <div key={item.instrument_key} className="flex items-center justify-between p-2 rounded-md">
                                    <div>
                                        <div className="font-medium">{item.trading_symbol}</div>
                                        <div className="text-sm text-muted-foreground">{item.name}</div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSelect(item)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Add {selectedItems.length > 0 ? selectedItems.length : ''} Items</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}