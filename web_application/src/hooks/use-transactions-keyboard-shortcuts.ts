import { useToast } from "@/hooks/use-toast";
import { useDialogStore } from "@/store/dialogStore";
import { Transaction } from "@/types";
import { useEffect } from "react";

interface UseTransactionsKeyboardShortcutsProps {
  selectedRowId: number | null;
  transactions: Transaction[];
  isAddingTransaction: boolean;
  setIsAddingTransaction: (value: boolean) => void;
  handlePageChange: (page: number) => void;
  totalPages: number;
  tableRef: React.RefObject<HTMLTableElement>;
}

export function useTransactionsKeyboardShortcuts({
  selectedRowId,
  transactions,
  isAddingTransaction,
  setIsAddingTransaction,
  handlePageChange,
  totalPages,
  tableRef,
}: UseTransactionsKeyboardShortcutsProps) {
  const { setEditTransaction, setDeleteTransaction } = useDialogStore();
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts from triggering if an input or textarea is focused
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // Add new transaction (Ctrl + N or Cmd + N)
      if ((event.ctrlKey || event.metaKey) && event.key === "n") {
        event.preventDefault();
        if (!isAddingTransaction) {
          setIsAddingTransaction(true);
        }
      }

      // Edit transaction (Ctrl + E or Cmd + E)
      if ((event.ctrlKey || event.metaKey) && event.key === "e") {
        event.preventDefault();
        if (selectedRowId) {
          const transaction = transactions.find((t) => t.id === selectedRowId);
          if (transaction) {
            setEditTransaction(transaction);
          }
        }
      }

      // Delete transaction (Ctrl + D or Cmd + D)
      if ((event.ctrlKey || event.metaKey) && event.key === "d") {
        event.preventDefault();
        if (selectedRowId) {
          const transaction = transactions.find((t) => t.id === selectedRowId);
          if (transaction) {
            setDeleteTransaction(transaction);
          }
        }
      }

      // Go to first page (Home key)
      if (event.key === "Home") {
        event.preventDefault();
        if (tableRef.current) {
          tableRef.current.scrollTop = 0;
          handlePageChange(1);
        }
      }

      // Go to last page (End key)
      if (event.key === "End") {
        event.preventDefault();
        if (tableRef.current) {
          tableRef.current.scrollTop = tableRef.current.scrollHeight;
          handlePageChange(totalPages);
        }
      }

      // Go to previous page (Page Up or Arrow Left)
      if (event.key === "PageUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        handlePageChange(Math.max(1, currentPage - 1));
      }

      // Go to next page (Page Down or Arrow Right)
      if (event.key === "PageDown" || event.key === "ArrowRight") {
        event.preventDefault();
        handlePageChange(Math.min(totalPages, currentPage + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedRowId,
    transactions,
    isAddingTransaction,
    setIsAddingTransaction,
    handlePageChange,
    totalPages,
    tableRef,
    setEditTransaction,
    setDeleteTransaction,
  ]);
}
