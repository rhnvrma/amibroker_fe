"use client";

import { useWatchlist } from "@/contexts/watchlist-context";
import type { Watchlist } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  FileDown,
  FileUp,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { useState, useRef } from "react";
import { RenameDialog } from "./rename-dialog";
import { DeleteDialog } from "./delete-dialog";

interface WatchlistActionsProps {
  watchlist: Watchlist;
}

export function WatchlistActions({ watchlist }: WatchlistActionsProps) {
  const { deleteWatchlist, setDefaultWatchlist, importWatchlist, exportWatchlist } = useWatchlist();
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    importFileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importWatchlist(file);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Watchlist actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setIsRenameOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDefaultWatchlist(watchlist.id)}
            disabled={watchlist.isDefault}
          >
            <Star className="mr-2 h-4 w-4" /> Set as Default
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleImportClick}>
            <FileUp className="mr-2 h-4 w-4" /> Import Items
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportWatchlist}>
            <FileDown className="mr-2 h-4 w-4" /> Export Watchlist
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setIsDeleteOpen(true)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        type="file"
        ref={importFileInputRef}
        className="hidden"
        accept=".json"
        onChange={handleFileImport}
      />
      
      <RenameDialog
        isOpen={isRenameOpen}
        setIsOpen={setIsRenameOpen}
        watchlist={watchlist}
      />

      <DeleteDialog
        isOpen={isDeleteOpen}
        setIsOpen={setIsDeleteOpen}
        onConfirm={() => deleteWatchlist(watchlist.id)}
        title="Delete Watchlist"
        description={`Are you sure you want to delete "${watchlist.name}"? This action cannot be undone.`}
      />
    </>
  );
}
