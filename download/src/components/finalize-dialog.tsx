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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, TriangleAlert } from "lucide-react";
import { useWatchlist } from "@/contexts/watchlist-context";

interface FinalizeDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function FinalizeDialog({
  isOpen,
  setIsOpen,
}: FinalizeDialogProps) {
  const { exportDefaultWatchlistJson, activeWatchlist } = useWatchlist();

  const handleFinalize = async () => {
    exportDefaultWatchlistJson();
    await window.electron.saveAccessToken();
    setIsOpen(false);
  }

  const symbolCount = activeWatchlist?.items.length || 0;
  const showWarning = symbolCount > 250;

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
        
        {showWarning && (
            <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Caution</AlertTitle>
                <AlertDescription>
                    You've slected too many symbols, System has not gone under stress testing, please proceed with caution.
                </AlertDescription>
            </Alert>
        )}

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
