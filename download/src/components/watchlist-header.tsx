
"use client";

import { AddItemDialog } from "@/components/add-item-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWatchlist } from "@/contexts/watchlist-context";
import type { WatchlistItem } from "@/lib/types";
import { ArrowDown, ArrowUp, Plus, Search, Trash2, CheckCircle } from "lucide-react";
import { useState } from "react";
import { DeleteDialog } from "./delete-dialog";
import { FinalizeDialog } from "./finalize-dialog";

type SortKey = keyof Omit<WatchlistItem, 'id'>;
type SortDirection = "asc" | "desc";

interface WatchlistHeaderProps {
  watchlistName: string;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortKey: SortKey;
  setSortKey: (key: SortKey) => void;
  sortDirection: SortDirection;
  setSortDirection: (dir: SortDirection) => void;
  selectedItemIds: string[];
  setSelectedItemIds: (ids: string[]) => void;
}

export function WatchlistHeader({
  watchlistName,
  searchTerm,
  setSearchTerm,
  sortKey,
  setSortKey,
  sortDirection,
  setSortDirection,
  selectedItemIds,
  setSelectedItemIds,
}: WatchlistHeaderProps) {
  const { deleteItems } = useWatchlist();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false);

  const handleSortDirectionToggle = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  }

  const handleDeleteSelected = () => {
    deleteItems(selectedItemIds);
    setSelectedItemIds([]);
    setIsDeleteDialogOpen(false);
  }

  const numSelected = selectedItemIds.length;

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <h2 className="text-3xl font-bold tracking-tight hidden md:block">{watchlistName}</h2>
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dateAdded">Date Added</SelectItem>
              <SelectItem value="trading_symbol">Trading Symbol</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="strike_price">Strike Price</SelectItem>
              <SelectItem value="instrument_key">Instrument Key</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleSortDirectionToggle}>
              {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>

          {numSelected > 0 ? (
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete ({numSelected})
            </Button>
          ) : (
            <AddItemDialog>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </AddItemDialog>
          )}

          <Button variant="default" onClick={() => setIsFinalizeDialogOpen(true)}>
              <CheckCircle className="mr-2 h-4 w-4" /> Finalize
          </Button>
        </div>
      </div>
      <DeleteDialog
        isOpen={isDeleteDialogOpen}
        setIsOpen={setIsDeleteDialogOpen}
        onConfirm={handleDeleteSelected}
        title={`Delete ${numSelected} item${numSelected > 1 ? 's' : ''}?`}
        description={`Are you sure you want to delete the selected ${numSelected > 1 ? 'items' : 'item'}? This action cannot be undone.`}
      />
      <FinalizeDialog 
        isOpen={isFinalizeDialogOpen}
        setIsOpen={setIsFinalizeDialogOpen}
      />
    </>
  );
}
