import { useAddCustomPrice, useBatchAddCustomPrices, useBatchDeleteCustomPrices, useCustomPrices, useDeleteCustomPrice } from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/datePicker"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { AlertTriangle, Download, Plus, Save, Trash, Upload, X } from "lucide-react"
import { useEffect, useState } from "react"


interface CustomPriceDialogProps {
  symbol: string
  currency?: string
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

interface PriceRow {
  id: string
  date: Date
  close: string
  open: string
  high: string
  low: string
  volume: string
  isNew: boolean
  isEdited: boolean
  selected?: boolean
}

export function CustomPriceDialog({
  symbol,
  currency = "USD",
  isOpen,
  onOpenChange,
}: CustomPriceDialogProps) {
  const [rows, setRows] = useState<PriceRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(isOpen || false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedCount, setSelectedCount] = useState(0)
  const [selectAll, setSelectAll] = useState(false)

  // Query for existing data
  const { data: customPrices, isLoading } = useCustomPrices(symbol)
  const addPrice = useAddCustomPrice()
  const batchAddPrices = useBatchAddCustomPrices()
  const deletePrice = useDeleteCustomPrice()
  const batchDeletePrices = useBatchDeleteCustomPrices()
  const queryClient = useQueryClient()

  // Initialize rows from customPrices
  useEffect(() => {
    if (customPrices && customPrices.length > 0) {
      const formattedRows = customPrices
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((price: any) => ({
          id: price.date,
          date: new Date(price.date),
          close: price.close.toString(),
          open: price.open.toString(),
          high: price.high.toString(),
          low: price.low.toString(),
          volume: price.volume.toString(),
          isNew: false,
          isEdited: false,
          selected: false
        }));
      setRows(formattedRows);
    }
  }, [customPrices]);

  // Update selected count when rows change
  useEffect(() => {
    const count = rows.filter(row => row.selected).length;
    setSelectedCount(count);
    setSelectAll(count > 0 && count === rows.length);
  }, [rows]);

  // Handle dialog open/close
  useEffect(() => {
    if (isOpen !== undefined) {
      setDialogOpen(isOpen)
    }
  }, [isOpen])

  const addNewRow = () => {
    const today = new Date()
    const newRow: PriceRow = {
      id: `new-${Date.now()}`,
      date: today,
      close: "",
      open: "",
      high: "",
      low: "",
      volume: "0",
      isNew: true,
      isEdited: false,
      selected: false
    }
    setRows(prev => [newRow, ...prev])
    setIsEditing(true)
  }

  const updateRow = (id: string, field: keyof PriceRow, value: any) => {
    setRows(prev =>
      prev.map(row => {
        if (row.id === id) {
          const updatedRow = {
            ...row,
            [field]: value,
            isEdited: field !== 'selected' && !row.isNew // Only mark as edited if it's not a new row and not toggling selection
          }

          // Auto-fill other price fields with close price if they're empty
          if (field === 'close' && value !== "") {
            if (row.open === "") updatedRow.open = value
            if (row.high === "") updatedRow.high = value
            if (row.low === "") updatedRow.low = value
          }

          return updatedRow
        }
        return row
      })
    )

    // Only set isEditing if we're changing data fields, not selection status
    if (field !== 'selected') {
      setIsEditing(true)
    }
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setRows(prev =>
      prev.map(row => ({ ...row, selected: checked }))
    );
  }

  const toggleRowSelection = (id: string, checked: boolean) => {
    updateRow(id, 'selected', checked);
  }

  const deleteSelectedRows = () => {
    const selectedRows = rows.filter(row => row.selected);
    if (selectedRows.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedRows.length} selected price entries?`)) {
      return;
    }

    // Delete new rows immediately from state
    const newSelectedRows = selectedRows.filter(row => row.isNew);
    if (newSelectedRows.length > 0) {
      setRows(prev => prev.filter(row => !(row.isNew && row.selected)));
    }

    // Delete existing rows via API using batch operation
    const existingSelectedRows = selectedRows.filter(row => !row.isNew);
    if (existingSelectedRows.length === 0) return;

    // Extract dates for batch deletion
    const dates = existingSelectedRows.map(row => format(row.date, "yyyy-MM-dd"));

    batchDeletePrices.mutate(
      {
        symbol,
        dates
      },
      {
        onSuccess: (response) => {
          // If we have specific information about successful deletions, use it
          if (response.details?.successful && Array.isArray(response.details.successful)) {
            // Remove specific rows that were successfully deleted
            setRows(prev => prev.filter(row => {
              const formattedDate = format(row.date, "yyyy-MM-dd");
              // Keep the row if it's not in the successful deletion list
              return !response.details.successful.includes(formattedDate);
            }));
          } else {
            // Fallback: just remove all selected rows
            setRows(prev => prev.filter(row => !row.selected));
          }

          toast({
            title: "Success",
            description: response.message || `Deleted ${response.details?.total_successful || selectedRows.length} price entries`
          });

          if (response.details?.total_failed > 0) {
            toast({
              title: "Warning",
              description: `Failed to delete ${response.details.total_failed} price entries`,
              variant: "destructive"
            });
          }
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to delete price entries",
            variant: "destructive"
          });
        }
      }
    );
  }

  const deleteAllRows = () => {
    if (rows.length === 0) return;

    if (!confirm(`Are you sure you want to delete ALL price entries for ${symbol}? This cannot be undone.`)) {
      return;
    }

    // Delete new rows immediately from state
    const newRows = rows.filter(row => row.isNew);
    if (newRows.length > 0) {
      setRows(prev => prev.filter(row => !row.isNew));
    }

    // Delete existing rows via API using batch operation
    const existingRows = rows.filter(row => !row.isNew);
    if (existingRows.length === 0) return;

    // Extract dates for batch deletion
    const dates = existingRows.map(row => format(row.date, "yyyy-MM-dd"));

    batchDeletePrices.mutate(
      {
        symbol,
        dates
      },
      {
        onSuccess: (response) => {
          // Remove all rows from state
          setRows([]);

          toast({
            title: "Success",
            description: response.message || `Deleted all price entries for ${symbol}`
          });

          if (response.details?.total_failed > 0) {
            toast({
              title: "Warning",
              description: `Failed to delete ${response.details.total_failed} price entries`,
              variant: "destructive"
            });
          }
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to delete price entries",
            variant: "destructive"
          });
        }
      }
    );
  }

  const deleteRow = (id: string) => {
    // If it's a new row, just remove it from state
    const rowToDelete = rows.find(row => row.id === id)
    if (rowToDelete?.isNew) {
      setRows(prev => prev.filter(row => row.id !== id))
      return
    }

    // Otherwise, call API to delete
    deletePrice.mutate(
      {
        symbol,
        date: format(rowToDelete?.date || new Date(), "yyyy-MM-dd")
      },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "Custom price deleted successfully"
          })
          setRows(prev => prev.filter(row => row.id !== id))
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: `Failed to delete custom price: ${error instanceof Error ? error.message : "Unknown error"}`,
            variant: "destructive"
          })
        }
      }
    )
  }

  const saveChanges = async () => {
    // Validate all rows to be saved
    const invalidRows = rows.filter(row => {
      return !row.date || isNaN(parseFloat(row.close)) || isNaN(parseFloat(row.open)) ||
             isNaN(parseFloat(row.high)) || isNaN(parseFloat(row.low)) || isNaN(parseFloat(row.volume));
    });

    if (invalidRows.length > 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Some rows have invalid data. Please correct them before saving."
      });
      return;
    }

    setIsEditing(true);

    try {
      // Handle new rows
      const newRows = rows.filter(row => row.isNew);
      if (newRows.length > 0) {
        const newRowsPromises = newRows.map(async (row) => {
          const formattedDate = new Date(row.date).toISOString().split('T')[0];

          await addPrice.mutateAsync({
            symbol,
            date: formattedDate,
            price: {
              open: parseFloat(row.open),
              high: parseFloat(row.high),
              low: parseFloat(row.low),
              close: parseFloat(row.close),
              volume: parseFloat(row.volume)
            }
          });
        });

        await Promise.all(newRowsPromises);
      }

      // Handle edited rows
      const editedRows = rows.filter(row => row.isEdited);
      if (editedRows.length > 0) {
        const editRowsPromises = editedRows.map(async (row) => {
          const formattedDate = new Date(row.date).toISOString().split('T')[0];

          await deletePrice.mutateAsync({
            symbol,
            date: formattedDate
          });

          await addPrice.mutateAsync({
            symbol,
            date: formattedDate,
            price: {
              open: parseFloat(row.open),
              high: parseFloat(row.high),
              low: parseFloat(row.low),
              close: parseFloat(row.close),
              volume: parseFloat(row.volume)
            }
          });
        });

        await Promise.all(editRowsPromises);
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['customPrices', symbol] });

      // Reset states
      setRows(prev => prev.map(row => ({ ...row, isNew: false, isEdited: false })));

      toast({
        title: "Success",
        description: "Custom prices saved successfully.",
      });

    } catch (error) {
      console.error("Error saving custom prices:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save custom prices. Please try again."
      });
    } finally {
      setIsEditing(false);
    }
  };

  const exportToCsv = () => {
    if (rows.length === 0) {
      toast({
        title: "Info",
        description: "No data to export"
      })
      return
    }

    // Create CSV content
    const headers = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume']
    const csvContent = [
      headers.join(','),
      ...rows.map(row => [
        format(row.date, 'yyyy-MM-dd'),
        row.open,
        row.high,
        row.low,
        row.close,
        row.volume
      ].join(','))
    ].join('\n')

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${symbol}_prices.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Success",
      description: "Data exported to CSV"
    })
  }

  const importFromCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string
        const lines = csvText.split('\n')

        // Skip header row if present - check for both English and French headers
        const hasHeaders = lines[0].toLowerCase().includes('date') ||
          lines[0].toLowerCase().includes('ouv') ||
          lines[0].toLowerCase().includes('haut') ||
          lines[0].toLowerCase().includes('bas') ||
          lines[0].toLowerCase().includes('clot')

        const startRow = hasHeaders ? 1 : 0

        const newRows: PriceRow[] = []
        for (let i = startRow; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          // Split by tab or comma (to support both formats)
          const values = line.includes('\t') ? line.split('\t') : line.split(',')
          if (values.length < 2) continue // Need at least date and close

          const dateStr = values[0].trim()
          let date: Date
          try {
            // Support both DD/MM/YYYY and YYYY-MM-DD formats
            if (dateStr.includes('/')) {
              // Handle French date format (DD/MM/YYYY)
              const parts = dateStr.split(' ')[0].split('/')
              if (parts.length === 3) {
                const day = parseInt(parts[0])
                const month = parseInt(parts[1]) - 1 // JS months are 0-indexed
                const year = parseInt(parts[2])
                date = new Date(year, month, day)
              } else {
                continue // Invalid date format
              }
            } else {
              // Standard ISO format
              date = new Date(dateStr)
            }

            if (isNaN(date.getTime())) continue // Skip invalid dates
          } catch {
            continue // Skip invalid dates
          }

          // Map CSV values to row based on detected format
          let open = "", high = "", low = "", close = "", volume = "0"

          // Check for French format (date, ouv, haut, bas, clot, vol)
          if (lines[0].toLowerCase().includes('ouv') && values.length >= 5) {
            // Parse French format
            open = values[1].trim().replace(',', '.')   // Convert comma to decimal point
            high = values[2].trim().replace(',', '.')
            low = values[3].trim().replace(',', '.')
            close = values[4].trim().replace(',', '.')
            volume = values.length > 5 ? values[5].trim().replace(',', '.') : "0"
          }
          // Check for English format (date, open, high, low, close, volume)
          else if (values.length >= 5) {
            // Standard OHLCV format
            open = values[1].trim().replace(',', '.')
            high = values[2].trim().replace(',', '.')
            low = values[3].trim().replace(',', '.')
            close = values[4].trim().replace(',', '.')
            volume = values.length > 5 ? values[5].trim().replace(',', '.') : "0"
          }
          // Simple date,price format
          else if (values.length >= 2) {
            close = values[1].trim().replace(',', '.')
            open = close
            high = close
            low = close
          }

          // Ensure all values are valid numbers
          if (!close || isNaN(parseFloat(close))) continue

          newRows.push({
            id: `import-${Date.now()}-${i}`,
            date,
            open,
            high,
            low,
            close,
            volume,
            isNew: true,
            isEdited: false,
            selected: false
          })
        }

        if (newRows.length > 0) {
          // Sort by date descending and add to existing rows
          newRows.sort((a, b) => b.date.getTime() - a.date.getTime())
          setRows(prev => [...newRows, ...prev])
          setIsEditing(true)

          toast({
            title: "Success",
            description: `Imported ${newRows.length} price entries`
          })
        } else {
          toast({
            title: "Warning",
            description: "No valid data found in CSV file",
            variant: "destructive"
          })
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to parse CSV file",
          variant: "destructive"
        })
      }
    }
    reader.readAsText(file)

    // Reset file input
    e.target.value = ''
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && isEditing) {
      // Show warning if closing with unsaved changes
      if (confirm("You have unsaved changes. Are you sure you want to close?")) {
        setDialogOpen(false)
        if (onOpenChange) onOpenChange(false)
      }
    } else {
      setDialogOpen(open)
      if (onOpenChange) onOpenChange(open)
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Manage Custom Prices</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Custom Prices for {symbol}</DialogTitle>
          <DialogDescription>
            Manage custom prices for this asset when market data is unavailable.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 py-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={addNewRow}
              variant="outline"
              size="sm"
              className="gap-1 h-8"
            >
              <Plus className="h-4 w-4" /> Add Row
            </Button>

            <Button
              onClick={saveChanges}
              variant="default"
              size="sm"
              className="gap-1 h-8"
              disabled={!isEditing || addPrice.isPending}
            >
              <Save className="h-4 w-4" /> Save Changes
            </Button>

            {selectedCount > 0 && (
              <Button
                onClick={deleteSelectedRows}
                variant="destructive"
                size="sm"
                className="gap-1 h-8"
                disabled={deletePrice.isPending}
              >
                <Trash className="h-4 w-4" /> Delete Selected ({selectedCount})
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={exportToCsv}
              variant="outline"
              size="sm"
              className="gap-1 h-8"
            >
              <Download className="h-4 w-4" /> Export
            </Button>

            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-8"
                onClick={() => document.getElementById('csv-upload')?.click()}
              >
                <Upload className="h-4 w-4" /> Import
              </Button>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={importFromCsv}
              />
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={deleteAllRows}
                    variant="destructive"
                    size="sm"
                    className="gap-1 h-8"
                    disabled={rows.length === 0 || deletePrice.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Delete all price entries</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Excel-like table */}
        <div className="border rounded-md overflow-hidden flex-1 overflow-y-auto min-h-[300px]">
          <table className="w-full border-collapse">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr className="text-left border-b">
                <th className="px-3 py-2 w-[40px]">
                  <Checkbox
                    checked={selectAll}
                    onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                    aria-label="Select all rows"
                  />
                </th>
                <th className="px-3 py-2 font-medium text-sm">Date</th>
                <th className="px-3 py-2 font-medium text-sm">Open</th>
                <th className="px-3 py-2 font-medium text-sm">High</th>
                <th className="px-3 py-2 font-medium text-sm">Low</th>
                <th className="px-3 py-2 font-medium text-sm">Close *</th>
                <th className="px-3 py-2 font-medium text-sm">Volume</th>
                <th className="px-3 py-2 w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-muted-foreground">Loading prices...</td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b hover:bg-muted/30 transition-colors",
                      (row.isNew || row.isEdited) && "bg-muted/20",
                      row.selected && "bg-primary/10"
                    )}
                  >
                    <td className="p-2 text-center">
                      <Checkbox
                        checked={row.selected}
                        onCheckedChange={(checked) => toggleRowSelection(row.id, checked === true)}
                        aria-label="Select row"
                      />
                    </td>
                    <td className="p-2">
                      <DatePicker
                        selectedDate={row.date}
                        onDateChange={(date) => updateRow(row.id, 'date', date || new Date())}
                        minDate={new Date(2000, 0, 1)}
                        maxDate={new Date()}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.0001"
                        value={row.open}
                        onChange={(e) => updateRow(row.id, 'open', e.target.value)}
                        placeholder="Same as close"
                        className="border-none focus-visible:ring-1 h-8 py-1"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.0001"
                        value={row.high}
                        onChange={(e) => updateRow(row.id, 'high', e.target.value)}
                        placeholder="Same as close"
                        className="border-none focus-visible:ring-1 h-8 py-1"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.0001"
                        value={row.low}
                        onChange={(e) => updateRow(row.id, 'low', e.target.value)}
                        placeholder="Same as close"
                        className="border-none focus-visible:ring-1 h-8 py-1"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.0001"
                        value={row.close}
                        onChange={(e) => updateRow(row.id, 'close', e.target.value)}
                        placeholder="Required"
                        className="border-none focus-visible:ring-1 h-8 py-1 font-medium"
                        required
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="1"
                        value={row.volume}
                        onChange={(e) => updateRow(row.id, 'volume', e.target.value)}
                        placeholder="0"
                        className="border-none focus-visible:ring-1 h-8 py-1"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteRow(row.id)}
                      >
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-muted-foreground">
                    No custom prices defined for this asset yet.
                    <div className="mt-2">
                      <Button
                        onClick={addNewRow}
                        variant="outline"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add a price entry
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-muted-foreground mt-2">
          * Close price is required for all entries. Other fields will use the close price if left empty.
        </div>
      </DialogContent>
    </Dialog>
  )
}



