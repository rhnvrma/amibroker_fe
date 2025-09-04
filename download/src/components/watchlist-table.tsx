
"use client";

import type { WatchlistItem } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ItemActions } from "./item-actions";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = keyof Omit<WatchlistItem, 'id'>;
type SortDirection = "asc" | "desc";

interface WatchlistTableProps {
  items: WatchlistItem[];
  selectedItemIds: string[];
  setSelectedItemIds: (ids: string[]) => void;
  sortKey: SortKey;
  sortDirection: SortDirection;
  setSortKey: (key: SortKey) => void;
  setSortDirection: (dir: SortDirection) => void;
}

const tableColumns: { key: SortKey; label: string; className: string }[] = [
    { key: 'trading_symbol', label: 'Trading Symbol', className: 'w-[25%] p-2' },
    { key: 'name', label: 'Name', className: 'w-[15%] p-2' },
    { key: 'strike_price', label: 'Strike Price', className: 'w-[15%] p-2' },
    { key: 'instrument_key', label: 'Instrument Key', className: 'w-[25%] p-2' },
    { key: 'expiry', label: 'expiry', className: 'w-[15%] p-2' },
];

export function WatchlistTable({ 
    items, 
    selectedItemIds, 
    setSelectedItemIds,
    sortKey,
    sortDirection,
    setSortKey,
    setSortDirection
}: WatchlistTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 65, // Estimate height of a row
    gap: 0,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "INR", // This can be adapted based on instrument currency
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedItemIds(checked ? items.map(item => item.id) : []);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedItemIds(
      checked
        ? [...selectedItemIds, id]
        : selectedItemIds.filter(itemId => itemId !== id)
    );
  };
  
  const isAllSelected = items.length > 0 && selectedItemIds.length === items.length;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <div ref={parentRef} className="rounded-lg border bg-card overflow-auto h-[calc(100vh-14rem)] relative">
      <Table>
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow className="flex w-full">
            <TableHead className="p-2 w-[4%] flex-shrink-0">
               <Checkbox 
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all rows"
                className="translate-y-[2px]"
               />
            </TableHead>
            {tableColumns.map(col => (
                <TableHead key={col.key} className={cn(col.className, 'flex-shrink-0')}>
                     <Button variant="ghost" onClick={() => handleSort(col.key)} className="px-2 py-1 h-auto -ml-2">
                        {col.label}
                        <ArrowUpDown className={cn(
                            "ml-2 h-4 w-4",
                            sortKey !== col.key && "text-muted-foreground/50"
                        )} />
                    </Button>
                </TableHead>
            ))}
            <TableHead className="text-right p-2 w-[10%] flex-shrink-0">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px` }} className="relative">
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index];
            const isSelected = selectedItemIds.includes(item.id);
            return (
              <TableRow 
                key={item.id} 
                className="absolute w-full hover:bg-muted/50 flex items-center"
                data-state={isSelected ? "selected" : ""}
                style={{
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <TableCell className="p-2 w-[4%] flex-shrink-0">
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)}
                    aria-label={`Select row for ${item.name}`}
                    className="translate-y-[2px]"
                  />
                </TableCell>
                <TableCell className="w-[25%] p-2 flex-shrink-0">
                  <div className="font-medium">{item.trading_symbol}</div>
                  <div className="text-sm text-muted-foreground">{item.underlying_symbol}</div>
                </TableCell>
                <TableCell className="w-[15%] p-2 flex-shrink-0">{item.name}</TableCell>
                <TableCell className="w-[15%] p-2 flex-shrink-0">{formatCurrency(item.strike_price)}</TableCell>
                <TableCell className="w-[25%] p-2 flex-shrink-0 truncate">{item.instrument_key}</TableCell>
                <TableCell className="w-[15%] p-2 flex-shrink-0">{formatDate(item.expiry)}</TableCell>
                <TableCell className="text-right w-[10%] p-2 flex-shrink-0">
                  <div className="flex justify-end">
                    <ItemActions item={item} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
