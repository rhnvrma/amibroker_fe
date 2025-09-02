"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWatchlist } from "@/contexts/watchlist-context";
import type { Watchlist } from "@/lib/types";
import { useState, useEffect } from "react";

interface RenameDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  watchlist: Watchlist;
}

export function RenameDialog({
  isOpen,
  setIsOpen,
  watchlist,
}: RenameDialogProps) {
  const { renameWatchlist } = useWatchlist();
  const [name, setName] = useState(watchlist.name);

  useEffect(() => {
    if (isOpen) {
      setName(watchlist.name);
    }
  }, [isOpen, watchlist.name]);

  const handleSave = () => {
    if (name.trim()) {
      renameWatchlist(watchlist.id, name.trim());
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Watchlist</DialogTitle>
          <DialogDescription>
            Enter a new name for your watchlist.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
