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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWatchlist } from "@/contexts/watchlist-context";
import type { WatchlistItem } from "@/lib/types";
import { useState, useMemo, type ReactNode, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "./ui/scroll-area";
import { Checkbox } from "./ui/checkbox";
import { useVirtualizer } from "@tanstack/react-virtual";

interface AddItemDialogProps {
  children: ReactNode;
}

export function AddItemDialog({ children }: AddItemDialogProps) {
  const { addItems, activeWatchlist, availableItems, instrumentData } = useWatchlist();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<Omit<WatchlistItem, 'id' | 'dateAdded'>[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [selectedUnderlying, setSelectedUnderlying] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
  const [selectedStrike, setSelectedStrike] = useState<string | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  // DEBUG: Log the instrument data received from the context
  useEffect(() => {
    if (isOpen) {
        // console.log("DEBUG: Instrument data from context:", instrumentData);
    }
  }, [instrumentData, isOpen]);


  const segmentOptions = useMemo(() => Array.from(instrumentData.keys()), [instrumentData]);

  const underlyingOptions = useMemo(() => {
    // console.log("DEBUG: Recalculating underlying options. Current segment:", selectedSegment);
    if (!selectedSegment) {
        // console.log("DEBUG: No segment selected, returning empty array.");
        return [];
    }
    const underlyingMap = instrumentData.get(selectedSegment);
    // console.log("DEBUG: Found underlying map for segment:", underlyingMap);

    if (underlyingMap) {
        const options = Array.from(underlyingMap.keys());
        // console.log("DEBUG: Calculated underlying options:", options);
        return options;
    }

    // console.log("DEBUG: No underlying map found, returning empty array.");
    return [];
  }, [selectedSegment, instrumentData]);

  const { expiryOptions, strikeOptions } = useMemo(() => {
    if (!selectedSegment || !selectedUnderlying) return { expiryOptions: [], strikeOptions: [] };
    const underlyingMap = instrumentData.get(selectedSegment);
    if (!underlyingMap) return { expiryOptions: [], strikeOptions: [] };
    const instrument = underlyingMap.get(selectedUnderlying);
    if (!instrument) return { expiryOptions: [], strikeOptions: [] };
    return {
      expiryOptions: Array.from(instrument.expiries),
      strikeOptions: Array.from(instrument.strikes).map(String),
    };
  }, [selectedSegment, selectedUnderlying, instrumentData]);

  useEffect(() => {
    setSelectedUnderlying(null);
    setSelectedExpiry(null);
    setSelectedStrike(null);
  }, [selectedSegment]);

  useEffect(() => {
    setSelectedExpiry(null);
    setSelectedStrike(null);
  }, [selectedUnderlying]);


  const filteredItems = useMemo(() => {
    const existingKeys = new Set(activeWatchlist?.items.map(item => item.instrument_key));
    let items = availableItems.filter(item => {
        if (existingKeys.has(item.instrument_key)) return false;
        const segmentMatch = !selectedSegment || item.segment === selectedSegment;
        const underlyingMatch = !selectedUnderlying || item.underlying_symbol === selectedUnderlying;
        const expiryMatch = !selectedExpiry || item.expiry === selectedExpiry;
        const strikeMatch = !selectedStrike || String(item.strike_price) === selectedStrike;
        return segmentMatch && underlyingMatch && expiryMatch && strikeMatch;
    });
    if (searchTerm) {
      const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.trim() !== '');
      items = items.filter(item => {
        return searchTerms.every(term =>
          item.name.toLowerCase().includes(term) ||
          item.trading_symbol.toLowerCase().includes(term) ||
          item.instrument_key.toLowerCase().includes(term) ||
          item.strike_price.toString().toLowerCase().includes(term)
        );
      });
    }
    return items;
  }, [searchTerm, activeWatchlist, availableItems, selectedSegment, selectedUnderlying, selectedExpiry, selectedStrike]);

  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
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
    if (!item) return;
    const isSelected = selectedItems.some(selected => selected.instrument_key === item.instrument_key);
    if (event.nativeEvent.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const itemsToSelect = filteredItems.slice(start, end + 1);
      setSelectedItems(prev => {
        const newSelectedSymbols = new Set(prev.map(i => i.instrument_key));
        if (!isSelected) {
            itemsToSelect.forEach(itemToAdd => newSelectedSymbols.add(itemToAdd.instrument_key));
        } else {
            const itemsToDeselectSymbols = new Set(itemsToSelect.map(i => i.instrument_key));
            itemsToDeselectSymbols.forEach(symbol => newSelectedSymbols.delete(symbol));
        }
        return availableItems.filter(i => newSelectedSymbols.has(i.instrument_key));
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
        setSelectedSegment(null);
        setSelectedUnderlying(null);
        setSelectedExpiry(null);
        setSelectedStrike(null);
    }
  }

  const handleSegmentChange = (value: string) => {
    console.log("DEBUG: Segment changed to:", value);
    setSelectedSegment(value);
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
            <div className="flex flex-col gap-4 overflow-hidden">
                <div className="grid grid-cols-2 gap-2">
                    <Select onValueChange={handleSegmentChange} value={selectedSegment || ""}>
                        <SelectTrigger><SelectValue placeholder="Select Segment" /></SelectTrigger>
                        <SelectContent>
                            {segmentOptions.map((segment, index) => <SelectItem key={`${segment}-${index}`} value={segment}>{segment}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select onValueChange={setSelectedUnderlying} value={selectedUnderlying || ""} disabled={!selectedSegment}>
                        <SelectTrigger><SelectValue placeholder="Select Underlying" /></SelectTrigger>
                        <SelectContent>
                            {underlyingOptions.map((underlying, index) => <SelectItem key={`${underlying}-${index}`} value={underlying}>{underlying}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select onValueChange={setSelectedExpiry} value={selectedExpiry || ""} disabled={!selectedUnderlying}>
                        <SelectTrigger><SelectValue placeholder="Select Expiry" /></SelectTrigger>
                        <SelectContent>
                            {expiryOptions.map((expiry, index) => <SelectItem key={`${expiry}-${index}`} value={expiry}>{expiry}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select onValueChange={setSelectedStrike} value={selectedStrike || ""} disabled={!selectedUnderlying}>
                        <SelectTrigger><SelectValue placeholder="Select Strike" /></SelectTrigger>
                        <SelectContent>
                            {strikeOptions.map((strike, index) => <SelectItem key={`${strike}-${index}`} value={strike}>{strike}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
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
                            if (!item) return null;
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