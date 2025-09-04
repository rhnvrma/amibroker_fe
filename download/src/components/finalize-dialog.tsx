"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle } from "lucide-react";
import { useWatchlist } from "@/contexts/watchlist-context";

interface FinalizeDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function FinalizeDialog({
  isOpen,
  setIsOpen,
}: FinalizeDialogProps) {
  const { exportDefaultWatchlistCsv } = useWatchlist();

  const handleFinalize = async () => {
    exportDefaultWatchlistCsv();
    await window.electron.saveAccessToken();
    setIsOpen(false);
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
            <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
          <AlertDialogTitle className="text-center">Changes Finalized</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            All your changes have been saved. Please restart Amibroker for them to take full effect.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={handleFinalize}
          >
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}