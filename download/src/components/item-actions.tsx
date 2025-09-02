
"use client";

import { useWatchlist } from "@/contexts/watchlist-context";
import type { WatchlistItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { DeleteDialog } from "./delete-dialog";

interface ItemActionsProps {
  item: WatchlistItem;
}

export function ItemActions({ item }: ItemActionsProps) {
  const { deleteItem } = useWatchlist();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <>
      {/* The AddItemDialog is no longer used for editing. The button is kept for layout consistency but is non-functional for edit. A full implementation would have an edit dialog. */}
       <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit Item</span>
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsDeleteOpen(true)}>
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete Item</span>
      </Button>

      <DeleteDialog
        isOpen={isDeleteOpen}
        setIsOpen={setIsDeleteOpen}
        onConfirm={() => deleteItem(item.id)}
        title={`Delete "${item.name}"?`}
        description={`Are you sure you want to delete this item? This action cannot be undone.`}
      />
    </>
  );
}
