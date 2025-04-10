import {
  API_URL,
  QueryKeys,
  useAccounts,
  useAllCategories,
  useAssets,
  useBanks,
  useBatchCreateAccounts,
  useBatchCreateAssets,
  useBatchCreateBanks,
  useBatchCreateInvestments,
  useBatchCreateRefundGroups,
  useBatchCreateRefundItems,
  useBatchCreateTransactions,
  useBatchDeleteAccounts,
  useBatchDeleteBanks,
  useBatchDeleteInvestments,
  useBatchDeleteRefundGroups,
  useBatchDeleteRefundItems,
  useBatchDeleteTransactions,
  useInvestments,
  useRefundGroups,
  useRefundItems,
  useTransactions,
  useWealthOverTime
} from "@/api/queries"
import { PageContainer } from "@/components/layout/PageContainer"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Download, FileJson, FileType, Loader2, Trash2, Upload } from "lucide-react"
import { useEffect, useState } from "react"

// Define supported export/import formats
type ExportFormat = "json" | "csv" | "xlsx"

// Define data types that can be exported/imported
type DataType =
  | "all"
  | "accounts"
  | "banks"
  | "transactions"
  | "investments"
  | "assets"
  | "wealthOverTime"
  | "refundGroups"
  | "refundItems"
  | "categories"

interface DataSelection {
  dataType: DataType
  selected: boolean
  count?: number
  displayName: string
  description: string
}

export function ExportImportPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json")
  const [importFormat, setImportFormat] = useState<ExportFormat>("json")
  const [importFile, setImportFile] = useState<File | null>(null)
  const [exportInProgress, setExportInProgress] = useState(false)
  const [importInProgress, setImportInProgress] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [exportProgress, setExportProgress] = useState(0)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeTab, setActiveTab] = useState("export")
  const [readableExport, setReadableExport] = useState(false)

  // Load all data and count items - we only need the total counts, not the actual data
  // Using per_page=1 to minimize data transfer but still get the total counts
  const { data: accounts } = useAccounts({ per_page: 1, page: 1 })
  const { data: banks } = useBanks({ per_page: 1, page: 1 })
  const { data: transactions } = useTransactions({ per_page: 1, page: 1 })
  const { data: investments } = useInvestments({ per_page: 1, page: 1 })
  const { data: assets } = useAssets({ per_page: 1, page: 1 })
  const { data: refundGroups } = useRefundGroups({ per_page: 1, page: 1 })
  const { data: refundItems } = useRefundItems({ per_page: 1, page: 1 })
  const { data: categories } = useAllCategories()
  const { data: wealthData } = useWealthOverTime()

  // Delete mutations
  const deleteAccounts = useBatchDeleteAccounts()
  const deleteBanks = useBatchDeleteBanks()
  const deleteTransactions = useBatchDeleteTransactions()
  const deleteInvestments = useBatchDeleteInvestments()
  const deleteRefundGroups = useBatchDeleteRefundGroups()
  const deleteRefundItems = useBatchDeleteRefundItems()

  // Add mutation hooks for batch creation
  const batchCreateBanks = useBatchCreateBanks()
  const batchCreateAccounts = useBatchCreateAccounts()
  const batchCreateAssets = useBatchCreateAssets()
  const batchCreateTransactions = useBatchCreateTransactions()
  const batchCreateInvestments = useBatchCreateInvestments()
  const batchCreateRefundGroups = useBatchCreateRefundGroups()
  const batchCreateRefundItems = useBatchCreateRefundItems()

  // Data selection state for export, delete, and import
  const [dataSelections, setDataSelections] = useState<DataSelection[]>([
    {
      dataType: "all",
      selected: true,
      displayName: "All Data",
      description: "Export/import all data from the application"
    },
    {
      dataType: "accounts",
      selected: false,
      count: 0, // Will be updated in useEffect
      displayName: "Accounts",
      description: "Bank and investment accounts"
    },
    {
      dataType: "banks",
      selected: false,
      count: 0, // Will be updated in useEffect
      displayName: "Banks",
      description: "Financial institutions"
    },
    {
      dataType: "transactions",
      selected: false,
      count: 0, // Will be updated in useEffect
      displayName: "Transactions",
      description: "Income, expenses and transfers"
    },
    {
      dataType: "investments",
      selected: false,
      count: 0, // Will be updated in useEffect
      displayName: "Investments",
      description: "Investment transactions"
    },
    {
      dataType: "assets",
      selected: false,
      count: 0, // Will be updated in useEffect
      displayName: "Assets",
      description: "Investment assets and securities"
    },
    {
      dataType: "wealthOverTime",
      selected: false,
      count: 0, // Will be updated in useEffect
      displayName: "Wealth History",
      description: "Historical wealth data over time"
    },
    {
      dataType: "refundGroups",
      selected: false,
      count: 0, // Will be updated in useEffect
      displayName: "Refund Groups",
      description: "Grouped refund items"
    },
    {
      dataType: "refundItems",
      selected: false,
      count: 0, // Will be updated in useEffect
      displayName: "Refund Items",
      description: "Individual refund transactions"
    },
    {
      dataType: "categories",
      selected: false,
      count: 0, // Will be updated in useEffect
      displayName: "Categories",
      description: "Transaction categories and subcategories"
    },
  ])

  // Update counts when data changes
  useEffect(() => {
    // Skip if any data is missing
    if (!accounts || !banks || !transactions || !investments || !assets || !refundGroups || !refundItems) {
      return;
    }

    // Create a completely new array to ensure React detects the state change
    const newDataSelections = dataSelections.map(selection => {
      // Create a new object for each selection
      const newSelection = { ...selection };

      // Set the count based on the data type
      switch (newSelection.dataType) {
        case "accounts":
          newSelection.count = accounts.total || 0;
          break;
        case "banks":
          newSelection.count = banks.total || 0;
          break;
        case "transactions":
          newSelection.count = transactions.total || 0;
          break;
        case "investments":
          newSelection.count = investments.total || 0;
          break;
        case "assets":
          newSelection.count = assets.total || 0;
          break;
        case "wealthOverTime":
          newSelection.count = wealthData?.length || 0;
          break;
        case "refundGroups":
          newSelection.count = refundGroups.total || 0;
          break;
        case "refundItems":
          newSelection.count = refundItems.total || 0;
          break;
        case "categories":
          newSelection.count = categories ? Object.keys(categories).length : 0;
          break;
      }

      return newSelection;
    });

    // Update the state with the completely new array
    setDataSelections(newDataSelections);

  }, [accounts, banks, transactions, investments, assets, wealthData, refundGroups, refundItems, categories]);

  // Toggle selection of a data type
  const toggleDataSelection = (dataType: DataType) => {
    if (dataType === "all") {
      // If selecting "all", deselect others
      const newAllSelected = !dataSelections.find(d => d.dataType === "all")?.selected

      setDataSelections(
        dataSelections.map(selection => ({
          ...selection,
          selected: selection.dataType === "all" ? newAllSelected : false
        }))
      )
    } else {
      // If selecting a specific item, deselect "all"
      setDataSelections(
        dataSelections.map(selection => {
          if (selection.dataType === dataType) {
            return { ...selection, selected: !selection.selected }
          } else if (selection.dataType === "all") {
            return { ...selection, selected: false }
          }
          return selection
        })
      )
    }
  }

  // Handle export operation
  const handleExport = async () => {
    setExportInProgress(true)
    setExportProgress(0)

    try {
      // Determine what to export
      const selectedDataTypes = dataSelections
        .filter(d => d.selected)
        .map(d => d.dataType)

      // If 'all' is selected, include everything
      const exportAll = selectedDataTypes.includes('all')
      const dataToExport: Record<string, any> = {}

      // Fetch and compile all selected data
      let progressStep = 0
      const totalSteps = exportAll ? 10 : selectedDataTypes.length

      // Function to update progress and fetch actual data
      const fetchData = async (dataType: DataType, fetchFn: () => Promise<any>) => {
        try {
          const data = await fetchFn()
          dataToExport[dataType] = data
          progressStep++
          setExportProgress(Math.round((progressStep / totalSteps) * 100))
          return true
        } catch (error) {
          console.error(`Error exporting ${dataType}:`, error)
          toast({
            title: `Error exporting ${dataType}`,
            description: "Could not fetch the requested data",
            variant: "destructive",
          })
          return false
        }
      }

      // Process data types based on selection
      const typesToProcess = exportAll
        ? ["accounts", "banks", "transactions", "investments", "assets",
           "wealthOverTime", "refundGroups", "refundItems", "categories"]
        : selectedDataTypes

      const token = localStorage.getItem("access_token")
      if (!token) {
        throw new Error("Authentication token not found")
      }

      // Cache for mapping IDs to names
      let cachedBanks: Record<number, string> = {}
      let cachedAccounts: Record<number, string> = {}
      let cachedAssets: Record<number, string> = {}

      // Fetch banks, accounts and assets first if we're doing readable export
      // We need this data to replace IDs with names later
      if (readableExport) {
        // Fetch all banks
        const banksResponse = await fetch(`${API_URL}/banks?per_page=1000`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (banksResponse.ok) {
          const data = await banksResponse.json()
          cachedBanks = data.items.reduce((acc: Record<number, string>, bank: any) => {
            acc[bank.id] = bank.name
            return acc
          }, {})
        }

        // Fetch all accounts
        const accountsResponse = await fetch(`${API_URL}/accounts?per_page=1000`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (accountsResponse.ok) {
          const data = await accountsResponse.json()
          cachedAccounts = data.items.reduce((acc: Record<number, string>, account: any) => {
            acc[account.id] = account.name
            return acc
          }, {})
        }

        // Fetch all assets
        const assetsResponse = await fetch(`${API_URL}/assets?per_page=1000`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (assetsResponse.ok) {
          const data = await assetsResponse.json()
          cachedAssets = data.items.reduce((acc: Record<number, string>, asset: any) => {
            acc[asset.id] = asset.name
            return acc
          }, {})
        }
      }

      for (const dataType of typesToProcess) {
        switch (dataType) {
          case "accounts":
            await fetchData(dataType, async () => {
              const response = await fetch(`${API_URL}/accounts?per_page=1000`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (!response.ok) throw new Error(`Failed to fetch accounts: ${response.statusText}`)
              const data = await response.json()

              // Convert data to readable format if needed
              if (readableExport) {
                return data.items.map((account: any) => {
                  const result = { ...account }
                  if (account.bank_id && cachedBanks[account.bank_id]) {
                    result.bank = cachedBanks[account.bank_id]
                    delete result.bank_id
                  }
                  return result
                })
              }

              return data.items
            })
            break

          case "banks":
            await fetchData(dataType, async () => {
              const response = await fetch(`${API_URL}/banks?per_page=1000`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (!response.ok) throw new Error(`Failed to fetch banks: ${response.statusText}`)
              const data = await response.json()
              return data.items
            })
            break

          case "transactions":
            await fetchData(dataType, async () => {
              const response = await fetch(`${API_URL}/transactions?per_page=10000`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (!response.ok) throw new Error(`Failed to fetch transactions: ${response.statusText}`)
              const data = await response.json()

              // Convert data to readable format if needed
              if (readableExport) {
                return data.items.map((transaction: any) => {
                  const result = { ...transaction }

                  if (transaction.from_account_id && cachedAccounts[transaction.from_account_id]) {
                    result.from_account = cachedAccounts[transaction.from_account_id]
                    delete result.from_account_id
                  }

                  if (transaction.to_account_id && cachedAccounts[transaction.to_account_id]) {
                    result.to_account = cachedAccounts[transaction.to_account_id]
                    delete result.to_account_id
                  }

                  return result
                })
              }

              return data.items
            })
            break

          case "investments":
            await fetchData(dataType, async () => {
              const response = await fetch(`${API_URL}/investments?per_page=1000`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (!response.ok) throw new Error(`Failed to fetch investments: ${response.statusText}`)
              const data = await response.json()

              // Convert data to readable format if needed
              if (readableExport) {
                return data.items.map((investment: any) => {
                  const result = { ...investment }

                  if (investment.from_account_id && cachedAccounts[investment.from_account_id]) {
                    result.from_account = cachedAccounts[investment.from_account_id]
                    delete result.from_account_id
                  }

                  if (investment.to_account_id && cachedAccounts[investment.to_account_id]) {
                    result.to_account = cachedAccounts[investment.to_account_id]
                    delete result.to_account_id
                  }

                  if (investment.asset_id && cachedAssets[investment.asset_id]) {
                    result.asset = cachedAssets[investment.asset_id]
                    delete result.asset_id
                  }

                  return result
                })
              }

              return data.items
            })
            break

          case "assets":
            await fetchData(dataType, async () => {
              const response = await fetch(`${API_URL}/assets?per_page=1000`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (!response.ok) throw new Error(`Failed to fetch assets: ${response.statusText}`)
              const data = await response.json()
              return data.items
            })
            break

          case "wealthOverTime":
            await fetchData(dataType, async () => {
              // Get date range for wealth over time (last 24 months)
              const endDate = new Date().toISOString().split('T')[0]
              const startDate = new Date()
              startDate.setMonth(startDate.getMonth() - 24)
              const startDateStr = startDate.toISOString().split('T')[0]

              const response = await fetch(`${API_URL}/accounts/balance_over_time?start_date=${startDateStr}&end_date=${endDate}`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (!response.ok) throw new Error(`Failed to fetch wealth history: ${response.statusText}`)
              const data = await response.json()
              return Object.entries(data).map(([date, value]) => ({
                date,
                value,
              }))
            })
            break

          case "refundGroups":
            await fetchData(dataType, async () => {
              const response = await fetch(`${API_URL}/refund_groups?per_page=1000`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (!response.ok) throw new Error(`Failed to fetch refund groups: ${response.statusText}`)
              const data = await response.json()
              return data.items
            })
            break

          case "refundItems":
            await fetchData(dataType, async () => {
              const response = await fetch(`${API_URL}/refund_items?per_page=1000`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (!response.ok) throw new Error(`Failed to fetch refund items: ${response.statusText}`)
              const data = await response.json()

              // Convert data to readable format if needed
              if (readableExport) {
                return data.items.map((item: any) => {
                  const result = { ...item }

                  if (item.expense_transaction_id && dataToExport.transactions) {
                    const transaction = dataToExport.transactions.find(
                      (t: any) => t.id === item.expense_transaction_id || t.original_id === item.expense_transaction_id
                    )
                    if (transaction) {
                      result.expense_transaction = transaction.description || `Transaction #${item.expense_transaction_id}`
                      delete result.expense_transaction_id
                    }
                  }

                  if (item.income_transaction_id && dataToExport.transactions) {
                    const transaction = dataToExport.transactions.find(
                      (t: any) => t.id === item.income_transaction_id || t.original_id === item.income_transaction_id
                    )
                    if (transaction) {
                      result.income_transaction = transaction.description || `Transaction #${item.income_transaction_id}`
                      delete result.income_transaction_id
                    }
                  }

                  if (item.refund_group_id && dataToExport.refundGroups) {
                    const group = dataToExport.refundGroups.find(
                      (g: any) => g.id === item.refund_group_id || g.original_id === item.refund_group_id
                    )
                    if (group) {
                      result.refund_group = group.name || `Group #${item.refund_group_id}`
                      delete result.refund_group_id
                    }
                  }

                  return result
                })
              }

              return data.items
            })
            break

          case "categories":
            await fetchData(dataType, async () => {
              const response = await fetch(`${API_URL}/budgets/categories`, {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (!response.ok) throw new Error(`Failed to fetch categories: ${response.statusText}`)
              return await response.json()
            })
            break
        }
      }

      // If it's readable export, preserve original IDs for future imports
      if (readableExport) {
        // For each data type, add original_id before removing the id
        Object.keys(dataToExport).forEach(dataType => {
          if (Array.isArray(dataToExport[dataType])) {
            dataToExport[dataType] = dataToExport[dataType].map((item: any) => {
              if (item.id) {
                item.original_id = item.id
              }
              return item
            })
          }
        })
      }

      // Generate export file based on format
      let outputData: string
      let mimeType: string

      if (exportFormat === 'json') {
        outputData = JSON.stringify(dataToExport, null, 2)
        mimeType = 'application/json'
      } else if (exportFormat === 'csv') {
        // Simple CSV conversion - in real app would use a proper CSV library
        // This is just a placeholder for demonstration
        outputData = 'Data exported in JSON format as CSV conversion requires processing'
        mimeType = 'text/csv'
      } else {
        // For xlsx would use a library like xlsx in a real implementation
        outputData = 'Data exported in JSON format as XLSX conversion requires processing'
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }

      const blob = new Blob([outputData], { type: mimeType })
      const url = URL.createObjectURL(blob)

      // Create download link and trigger download
      const downloadDate = new Date().toISOString().split('T')[0]
      const exportModeText = readableExport ? 'readable' : 'raw'
      const filename = `wealth_manager_export_${exportModeText}_${downloadDate}.${exportFormat}`

      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Export successful",
        description: `Data successfully exported to ${filename}`,
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "Export failed",
        description: `An error occurred during the export process: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setExportInProgress(false)
      setExportProgress(100)
      // Reset progress after a short delay
      setTimeout(() => setExportProgress(0), 1000)
    }
  }

  // Handle import operation
  const handleImport = async () => {
    if (!importFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to import",
        variant: "destructive",
      })
      return
    }

    setImportInProgress(true)
    setImportProgress(0)

    try {
      // Read the file
      const fileReader = new FileReader()

      fileReader.onload = async (event) => {
        try {
          // Update progress
          setImportProgress(20)

          const content = event.target?.result as string
          let importedData: Record<string, any>

          try {
            importedData = JSON.parse(content)
          } catch (error) {
            throw new Error("Invalid JSON format. Please check your import file.")
          }

          // Validate imported data structure
          if (!importedData || typeof importedData !== 'object') {
            throw new Error("Invalid data format in import file")
          }

          setImportProgress(30)

          // Process account references - map names to IDs if needed
          // This will be used when importing from readable format exports
          const accountNameToIdMap: Record<string, number> = {}
          const bankNameToIdMap: Record<string, number> = {}
          const assetNameToIdMap: Record<string, number> = {}

          // Check if we need to resolve names (readable format import)
          const isReadableImport = importedData.transactions &&
            Array.isArray(importedData.transactions) &&
            importedData.transactions.length > 0 &&
            (importedData.transactions[0].from_account || importedData.transactions[0].to_account)

          if (isReadableImport) {
            // Fetch existing data to map names to IDs
            const token = localStorage.getItem("access_token")
            if (!token) {
              throw new Error("Authentication token not found")
            }

            // Fetch account information to map names to IDs
            const accountsResponse = await fetch(`${API_URL}/accounts?per_page=1000`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (accountsResponse.ok) {
              const accountsData = await accountsResponse.json()
              accountsData.items.forEach((account: any) => {
                accountNameToIdMap[account.name] = account.id
              })
            }

            // Fetch bank information
            const banksResponse = await fetch(`${API_URL}/banks?per_page=1000`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (banksResponse.ok) {
              const banksData = await banksResponse.json()
              banksData.items.forEach((bank: any) => {
                bankNameToIdMap[bank.name] = bank.id
              })
            }

            // Fetch asset information
            const assetsResponse = await fetch(`${API_URL}/assets?per_page=1000`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (assetsResponse.ok) {
              const assetsData = await assetsResponse.json()
              assetsData.items.forEach((asset: any) => {
                assetNameToIdMap[asset.name] = asset.id
                assetNameToIdMap[asset.symbol] = asset.id // Also map by symbol
              })
            }
          }

          // Process each data type in a specific order to maintain referential integrity
          // The order is important: first banks, then accounts, then assets, etc.
          const importOrder = [
            "banks",
            "accounts",
            "assets",
            "categories",
            "refundGroups",
            "transactions",
            "investments",
            "refundItems"
          ]

          let currentProgress = 30
          const progressStep = 60 / importOrder.length

          // Map to store original IDs to new IDs
          const idMappings: Record<string, Record<number, number>> = {
            transactions: {},
            accounts: {},
            banks: {},
            assets: {},
            refundGroups: {}
          }

          // Process data in the correct order using batch operations where possible
          for (const dataType of importOrder) {
            try {
              if (!importedData[dataType] || !Array.isArray(importedData[dataType]) || importedData[dataType].length === 0) {
                continue // Skip empty arrays
              }

              console.log(`Processing ${dataType}...`)

              switch (dataType) {
                case "banks":
                  // Create a map of bank names to their new IDs that will be created
                  // This is crucial for handling readable imports
                  const createdBankMap: Record<string, number> = {}

                  // Prepare bank data for batch creation
                  const bankItems = importedData.banks.map((bank: any) => {
                    const bankData = { ...bank }
                    // Store original data for mapping
                    const originalId = bankData.original_id || bankData.id
                    const bankName = bankData.name

                    // Delete IDs as the API will assign new ones
                    delete bankData.id
                    delete bankData.original_id

                    return bankData
                  })

                  // Use batch create operation
                  const bankResult = await batchCreateBanks.mutateAsync(bankItems)
                  console.log("Banks batch creation result:", bankResult)

                  // Update mappings
                  if (bankResult.successful && bankResult.successful.length > 0) {
                    // Match original banks to created ones by name
                    bankResult.successful.forEach((newBank: any) => {
                      const originalBank = importedData.banks.find((bank: any) => bank.name === newBank.name)
                      if (originalBank) {
                        const originalId = originalBank.original_id || originalBank.id
                        if (originalId) {
                          idMappings.banks[originalId] = newBank.id
                        }
                        // Also store by name for readable imports
                        bankNameToIdMap[newBank.name] = newBank.id
                      }
                    })
                  }

                  // Handle failures
                  if (bankResult.failed && bankResult.failed.length > 0) {
                    bankResult.failed.forEach((failure: any) => {
                      console.error("Failed to create bank:", failure)
                    })
                    throw new Error(`Failed to create ${bankResult.failed.length} banks`)
                  }

                  break

                case "accounts":
                  // Prepare account data for batch creation
                  const accountItems = importedData.accounts.map((account: any) => {
                    const accountData = { ...account }
                    // Store original data for mapping
                    const originalId = accountData.original_id || accountData.id
                    const accountName = accountData.name

                    // Delete fields that should not be sent
                    delete accountData.id
                    delete accountData.original_id
                    delete accountData.balance
                    delete accountData.market_value

                    // Handle readable format conversions
                    if (accountData.bank && !accountData.bank_id) {
                      // Convert bank name to bank_id using our updated map
                      if (bankNameToIdMap[accountData.bank]) {
                        accountData.bank_id = bankNameToIdMap[accountData.bank]
                      } else {
                        throw new Error(`Could not find bank '${accountData.bank}' when importing account '${accountData.name}'`);
                      }
                      delete accountData.bank
                    }

                    // Map old bank_id to new one if available
                    if (accountData.bank_id && idMappings.banks[accountData.bank_id]) {
                      accountData.bank_id = idMappings.banks[accountData.bank_id]
                    }

                    return accountData
                  })

                  // Use batch create operation
                  const accountResult = await batchCreateAccounts.mutateAsync(accountItems)
                  console.log("Accounts batch creation result:", accountResult)

                  // Update mappings
                  if (accountResult.successful && accountResult.successful.length > 0) {
                    // Match original accounts to created ones by name
                    accountResult.successful.forEach((newAccount: any) => {
                      const originalAccount = importedData.accounts.find((acc: any) => acc.name === newAccount.name)
                      if (originalAccount) {
                        const originalId = originalAccount.original_id || originalAccount.id
                        if (originalId) {
                          idMappings.accounts[originalId] = newAccount.id
                        }
                        // Also store by name for further references
                        accountNameToIdMap[newAccount.name] = newAccount.id
                      }
                    })
                  }

                  // Handle failures
                  if (accountResult.failed && accountResult.failed.length > 0) {
                    accountResult.failed.forEach((failure: any) => {
                      console.error("Failed to create account:", failure)
                    })
                    throw new Error(`Failed to create ${accountResult.failed.length} accounts`)
                  }

                  break

                case "assets":
                  // Prepare asset data for batch creation
                  const assetItems = importedData.assets.map((asset: any) => {
                    const assetData = { ...asset }
                    // Store original data for mapping
                    const originalId = assetData.original_id || assetData.id

                    // Delete IDs as the API will assign new ones
                    delete assetData.id
                    delete assetData.original_id

                    return assetData
                  })

                  // Use batch create operation
                  const assetResult = await batchCreateAssets.mutateAsync(assetItems)
                  console.log("Assets batch creation result:", assetResult)

                  // Update mappings
                  if (assetResult.successful && assetResult.successful.length > 0) {
                    assetResult.successful.forEach((newAsset: any) => {
                      const originalAsset = importedData.assets.find(
                        (ast: any) => ast.symbol === newAsset.symbol || ast.name === newAsset.name
                      )
                      if (originalAsset) {
                        const originalId = originalAsset.original_id || originalAsset.id
                        if (originalId) {
                          idMappings.assets[originalId] = newAsset.id
                        }
                        // Also store by name and symbol for references
                        assetNameToIdMap[newAsset.name] = newAsset.id
                        if (newAsset.symbol) {
                          assetNameToIdMap[newAsset.symbol] = newAsset.id
                        }
                      }
                    })
                  }

                  // Handle failures
                  if (assetResult.failed && assetResult.failed.length > 0) {
                    assetResult.failed.forEach((failure: any) => {
                      console.error("Failed to create asset:", failure)
                    })
                    throw new Error(`Failed to create ${assetResult.failed.length} assets`)
                  }

                  break

                case "transactions":
                  // Filter out transactions that are marked as investments - backend will handle these
                  const nonInvestmentTransactions = importedData.transactions.filter((tx: any) =>
                    !tx.is_investment && tx.is_investment !== 1
                  )

                  // Only proceed if we have non-investment transactions to import
                  if (nonInvestmentTransactions.length === 0) {
                    console.log("No non-investment transactions to import")
                    break
                  }

                  // Prepare transaction data for batch creation
                  const transactionItems = nonInvestmentTransactions.map((transaction: any) => {
                    const transactionData = { ...transaction }
                    const originalId = transactionData.original_id || transactionData.id

                    // Delete fields that should not be sent
                    delete transactionData.id
                    delete transactionData.original_id
                    delete transactionData.refunded_amount
                    delete transactionData.refund_items

                    // Handle readable format conversions
                    if (transactionData.from_account && !transactionData.from_account_id) {
                      if (accountNameToIdMap[transactionData.from_account]) {
                        transactionData.from_account_id = accountNameToIdMap[transactionData.from_account]
                      } else {
                        throw new Error(`Could not find account '${transactionData.from_account}' when importing transaction '${transactionData.description}'`);
                      }
                      delete transactionData.from_account
                    }

                    if (transactionData.to_account && !transactionData.to_account_id) {
                      if (accountNameToIdMap[transactionData.to_account]) {
                        transactionData.to_account_id = accountNameToIdMap[transactionData.to_account]
                      } else {
                        throw new Error(`Could not find account '${transactionData.to_account}' when importing transaction '${transactionData.description}'`);
                      }
                      delete transactionData.to_account
                    }

                    // Map IDs to newly created ones
                    if (transactionData.from_account_id && idMappings.accounts[transactionData.from_account_id]) {
                      transactionData.from_account_id = idMappings.accounts[transactionData.from_account_id]
                    }

                    if (transactionData.to_account_id && idMappings.accounts[transactionData.to_account_id]) {
                      transactionData.to_account_id = idMappings.accounts[transactionData.to_account_id]
                    }

                    return transactionData
                  })

                  // Use batch create operation
                  const transactionResult = await batchCreateTransactions.mutateAsync(transactionItems)
                  console.log("Transactions batch creation result:", transactionResult)

                  // Update mappings
                  if (transactionResult.successful && transactionResult.successful.length > 0) {
                    transactionResult.successful.forEach((newTransaction: any) => {
                      // Try to match by description, date and amount since IDs will be different
                      const originalTransaction = importedData.transactions.find((tx: any) =>
                        !tx.is_investment &&
                        tx.description === newTransaction.description &&
                        tx.amount === newTransaction.amount &&
                        tx.date === newTransaction.date
                      )

                      if (originalTransaction) {
                        const originalId = originalTransaction.original_id || originalTransaction.id
                        if (originalId) {
                          idMappings.transactions[originalId] = newTransaction.id
                        }
                      }
                    })
                  }

                  // Handle failures
                  if (transactionResult.failed && transactionResult.failed.length > 0) {
                    transactionResult.failed.forEach((failure: any) => {
                      console.error("Failed to create transaction:", failure)
                    })
                    throw new Error(`Failed to create ${transactionResult.failed.length} transactions`)
                  }

                  break

                case "investments":
                  // Prepare investment data for batch creation
                  const investmentItems = importedData.investments.map((investment: any) => {
                    const investmentData: any = {
                      // Include only fields expected by the API
                      asset_id: null,
                      date: null,
                      fee: 0,
                      from_account_id: null,
                      to_account_id: null,
                      quantity: 0,
                      tax: 0,
                      unit_price: 0,
                      activity_type: null,  // Required field
                    }

                    // Copy valid fields from the import data
                    if (investment.asset_id) investmentData.asset_id = investment.asset_id
                    if (investment.date) investmentData.date = investment.date
                    if (investment.fee !== undefined) investmentData.fee = investment.fee
                    if (investment.from_account_id) investmentData.from_account_id = investment.from_account_id
                    if (investment.to_account_id) investmentData.to_account_id = investment.to_account_id
                    if (investment.quantity !== undefined) investmentData.quantity = investment.quantity
                    if (investment.tax !== undefined) investmentData.tax = investment.tax
                    if (investment.unit_price !== undefined) investmentData.unit_price = investment.unit_price

                    // Handle activity_type (map from investment_type if needed)
                    if (investment.activity_type) {
                      // Ensure the activity_type is one of the allowed values
                      const validActivityTypes = ["Buy", "Sell", "Dividend", "Interest", "Deposit", "Withdrawal"]
                      investmentData.activity_type = validActivityTypes.includes(investment.activity_type)
                        ? investment.activity_type
                        : "Buy" // Default to Buy if invalid
                    } else if (investment.investment_type) {
                      // Map investment_type to activity_type with proper capitalization
                      // Must be one of: Buy, Sell, Dividend, Interest, Deposit, Withdrawal
                      const typeMap: Record<string, string> = {
                        "buy": "Buy",
                        "sell": "Sell",
                        "dividend": "Dividend",
                        "interest": "Interest",
                        "deposit": "Deposit",
                        "withdrawal": "Withdrawal"
                      }

                      // Convert to lowercase for case-insensitive matching
                      const normalizedType = investment.investment_type.toLowerCase()
                      investmentData.activity_type = typeMap[normalizedType] || "Buy" // Default to Buy if no match
                    }

                    // Delete fields that should not be sent
                    delete investmentData.id
                    delete investmentData.original_id
                    delete investmentData.description
                    delete investmentData.date_accountability
                    delete investmentData.investment_type
                    delete investmentData.total_paid
                    delete investmentData.transaction_id // Don't include transaction_id, backend will create the transaction

                    // Handle transaction relationship - not needed as backend will create transactions

                    // Handle readable format conversions
                    if (investment.from_account && !investmentData.from_account_id) {
                      if (accountNameToIdMap[investment.from_account]) {
                        investmentData.from_account_id = accountNameToIdMap[investment.from_account]
                      } else {
                        throw new Error(`Could not find account '${investment.from_account}' when importing investment`);
                      }
                    }

                    if (investment.to_account && !investmentData.to_account_id) {
                      if (accountNameToIdMap[investment.to_account]) {
                        investmentData.to_account_id = accountNameToIdMap[investment.to_account]
                      } else {
                        throw new Error(`Could not find account '${investment.to_account}' when importing investment`);
                      }
                    }

                    // Handle asset reference
                    if (investment.asset && !investmentData.asset_id) {
                      if (assetNameToIdMap[investment.asset]) {
                        investmentData.asset_id = assetNameToIdMap[investment.asset]
                      } else {
                        throw new Error(`Could not find asset '${investment.asset}' when importing investment`);
                      }
                    }

                    // Map IDs to newly created ones
                    if (investmentData.from_account_id && idMappings.accounts[investmentData.from_account_id]) {
                      investmentData.from_account_id = idMappings.accounts[investmentData.from_account_id]
                    }

                    if (investmentData.to_account_id && idMappings.accounts[investmentData.to_account_id]) {
                      investmentData.to_account_id = idMappings.accounts[investmentData.to_account_id]
                    }

                    if (investmentData.asset_id && idMappings.assets[investmentData.asset_id]) {
                      investmentData.asset_id = idMappings.assets[investmentData.asset_id]
                    }

                    return investmentData
                  })

                  // Use batch create operation
                  const investmentResult = await batchCreateInvestments.mutateAsync(investmentItems)
                  console.log("Investments batch creation result:", investmentResult)

                  // Handle failures
                  if (investmentResult.failed && investmentResult.failed.length > 0) {
                    investmentResult.failed.forEach((failure: any) => {
                      console.error("Failed to create investment:", failure)
                    })
                    throw new Error(`Failed to create ${investmentResult.failed.length} investments`)
                  }

                  break

                case "refundGroups":
                  // Prepare refund group data for batch creation
                  const refundGroupItems = importedData.refundGroups.map((group: any) => {
                    const groupData = { ...group }
                    const originalId = groupData.original_id || groupData.id

                    // Delete IDs as the API will assign new ones
                    delete groupData.id
                    delete groupData.original_id

                    return groupData
                  })

                  // Use batch create operation
                  const refundGroupResult = await batchCreateRefundGroups.mutateAsync(refundGroupItems)
                  console.log("Refund groups batch creation result:", refundGroupResult)

                  // Update mappings
                  if (refundGroupResult.successful && refundGroupResult.successful.length > 0) {
                    refundGroupResult.successful.forEach((newGroup: any) => {
                      const originalGroup = importedData.refundGroups.find((g: any) => g.name === newGroup.name)
                      if (originalGroup) {
                        const originalId = originalGroup.original_id || originalGroup.id
                        if (originalId) {
                          idMappings.refundGroups[originalId] = newGroup.id
                        }
                      }
                    })
                  }

                  // Handle failures
                  if (refundGroupResult.failed && refundGroupResult.failed.length > 0) {
                    refundGroupResult.failed.forEach((failure: any) => {
                      console.error("Failed to create refund group:", failure)
                    })
                    throw new Error(`Failed to create ${refundGroupResult.failed.length} refund groups`)
                  }

                  break

                case "refundItems":
                  // Prepare refund item data for batch creation
                  const refundItemItems = importedData.refundItems.map((refundItem: any) => {
                    const refundItemData: any = { ...refundItem }

                    // Delete fields that should not be sent
                    delete refundItemData.id
                    delete refundItemData.original_id

                    // Handle transaction references by name
                    if (refundItemData.expense_transaction && !refundItemData.expense_transaction_id) {
                      // Try to find transaction by multiple fields for more reliable matching
                      const matchingTransaction = importedData.transactions.find((tx: any) => {
                        // First, try to match by ID if available
                        if (tx.id && tx.id.toString() === refundItemData.expense_transaction) {
                          return true
                        }

                        // If expense_transaction is a number, it might be an ID reference
                        if (!isNaN(Number(refundItemData.expense_transaction))) {
                          return tx.id === Number(refundItemData.expense_transaction)
                        }

                        // Next, try to match by combination of description and amount if possible
                        if (tx.description === refundItemData.expense_transaction) {
                          if (refundItemData.amount && tx.amount) {
                            // If we have amount, match on that too for better precision
                            return Math.abs(tx.amount) === Math.abs(refundItemData.amount)
                          }
                          return true // Fall back to description-only if no amount
                        }

                        return false
                      })

                      if (matchingTransaction) {
                        const txId = matchingTransaction.original_id || matchingTransaction.id
                        if (idMappings.transactions[txId]) {
                          refundItemData.expense_transaction_id = idMappings.transactions[txId]
                        } else {
                          throw new Error(`Could not find expense transaction mapping for "${refundItemData.expense_transaction}"`)
                        }
                      } else {
                        throw new Error(`Could not find expense transaction "${refundItemData.expense_transaction}" when importing refund item`)
                      }

                      delete refundItemData.expense_transaction
                    }

                    if (refundItemData.income_transaction && !refundItemData.income_transaction_id) {
                      // Try to find transaction by multiple fields for more reliable matching
                      const matchingTransaction = importedData.transactions.find((tx: any) => {
                        // First, try to match by ID if available
                        if (tx.id && tx.id.toString() === refundItemData.income_transaction) {
                          return true
                        }

                        // If income_transaction is a number, it might be an ID reference
                        if (!isNaN(Number(refundItemData.income_transaction))) {
                          return tx.id === Number(refundItemData.income_transaction)
                        }

                        // Next, try to match by combination of description and amount if possible
                        if (tx.description === refundItemData.income_transaction) {
                          if (refundItemData.amount && tx.amount) {
                            // For income transactions, typically the amount would be positive
                            return Math.abs(tx.amount) === Math.abs(refundItemData.amount)
                          }
                          return true // Fall back to description-only if no amount
                        }

                        return false
                      })

                      if (matchingTransaction) {
                        const txId = matchingTransaction.original_id || matchingTransaction.id
                        if (idMappings.transactions[txId]) {
                          refundItemData.income_transaction_id = idMappings.transactions[txId]
                        } else {
                          throw new Error(`Could not find income transaction mapping for "${refundItemData.income_transaction}"`)
                        }
                      } else {
                        throw new Error(`Could not find income transaction "${refundItemData.income_transaction}" when importing refund item`)
                      }

                      delete refundItemData.income_transaction
                    }

                    // Ensure the required fields are set
                    if (!refundItemData.expense_transaction_id) {
                      throw new Error("Missing required field expense_transaction_id for refund item")
                    }

                    if (!refundItemData.income_transaction_id) {
                      throw new Error("Missing required field income_transaction_id for refund item")
                    }

                    // Handle refund group reference by name
                    if (refundItemData.refund_group && !refundItemData.refund_group_id) {
                      // Try to find refund group by name
                      const matchingGroup = importedData.refundGroups.find((group: any) =>
                        group.name === refundItemData.refund_group
                      )

                      if (matchingGroup) {
                        const groupId = matchingGroup.original_id || matchingGroup.id
                        if (idMappings.refundGroups[groupId]) {
                          refundItemData.refund_group_id = idMappings.refundGroups[groupId]
                        } else {
                          throw new Error(`Could not find refund group mapping for "${refundItemData.refund_group}"`)
                        }
                      } else {
                        throw new Error(`Could not find refund group "${refundItemData.refund_group}" when importing refund item`)
                      }

                      delete refundItemData.refund_group
                    }

                    // Map IDs to newly created ones
                    if (refundItemData.expense_transaction_id && idMappings.transactions[refundItemData.expense_transaction_id]) {
                      refundItemData.expense_transaction_id = idMappings.transactions[refundItemData.expense_transaction_id]
                    }

                    if (refundItemData.income_transaction_id && idMappings.transactions[refundItemData.income_transaction_id]) {
                      refundItemData.income_transaction_id = idMappings.transactions[refundItemData.income_transaction_id]
                    }

                    if (refundItemData.refund_group_id && idMappings.refundGroups[refundItemData.refund_group_id]) {
                      refundItemData.refund_group_id = idMappings.refundGroups[refundItemData.refund_group_id]
                    }

                    // Set user ID to current user
                    refundItemData.user_id = "1"

                    return refundItemData
                  })

                  // Use batch create operation
                  const refundItemResult = await batchCreateRefundItems.mutateAsync(refundItemItems)
                  console.log("Refund items batch creation result:", refundItemResult)

                  // Handle failures
                  if (refundItemResult.failed && refundItemResult.failed.length > 0) {
                    refundItemResult.failed.forEach((failure: any) => {
                      console.error("Failed to create refund item:", failure)
                    })
                    throw new Error(`Failed to create ${refundItemResult.failed.length} refund items`)
                  }

                  break

                case "categories":
                  if (importedData.categories && Object.keys(importedData.categories).length > 0) {
                    // For categories we just update the complete structure through a special endpoint
                    const token = localStorage.getItem("access_token")
                    await fetch(`${API_URL}/budgets/categories/import`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(importedData.categories)
                    })
                  }
                  break
              }

              // Update progress
              currentProgress += progressStep
              setImportProgress(Math.min(90, Math.round(currentProgress)))

            } catch (error) {
              console.error(`Error in data type ${dataType}:`, error)
              toast({
                title: `Import failed for ${dataType}`,
                description: `${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: "destructive",
              })
              // Exit the import process instead of continuing
              setImportProgress(0)
              setImportInProgress(false)
              return // Exit early from the onload handler
            }
          }

          setImportProgress(100)
          toast({
            title: "Import successful",
            description: "Data has been successfully imported",
          })

          // Refresh all data by invalidating relevant queries
          queryClient.invalidateQueries({ queryKey: QueryKeys.wealthOverTime })

          // Reset import state after delay
          setTimeout(() => {
            setImportFile(null)
            setImportInProgress(false)
            setImportProgress(0)
          }, 1000)

          // Invalidate all queries to refresh data
          try {
            // Invalidate all known queries
            Object.keys(QueryKeys).forEach(key => {
              if (typeof QueryKeys[key as keyof typeof QueryKeys] === "function") {
                // For parameterized queries, invalidate the base query
                queryClient.invalidateQueries({
                  queryKey: (QueryKeys[key as keyof typeof QueryKeys] as Function)()
                })
              } else {
                // For simple queries
                queryClient.invalidateQueries({
                  queryKey: QueryKeys[key as keyof typeof QueryKeys]
                })
              }
            })

            console.log("All queries invalidated after import")
          } catch (invalidationError) {
            console.error("Error invalidating queries after import:", invalidationError)
          }
        } catch (error) {
          console.error("Import processing error:", error)
          toast({
            title: "Import failed",
            description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            variant: "destructive",
          })
          setImportInProgress(false)
        }
      }

      fileReader.onerror = () => {
        toast({
          title: "File read error",
          description: "Failed to read the import file",
          variant: "destructive",
        })
        setImportInProgress(false)
      }

      fileReader.readAsText(importFile)
    } catch (error) {
      console.error("Import error:", error)
      toast({
        title: "Import failed",
        description: `An error occurred during the import process: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
      setImportInProgress(false)
    }
  }

  // Handle delete operation
  const handleDelete = async () => {
    if (!confirmDelete) {
      toast({
        title: "Confirmation required",
        description: "Please confirm deletion by checking the confirmation box",
        variant: "destructive",
      })
      return
    }

    setDeleteInProgress(true)

    try {
      // Determine what to delete
      const selectedDataTypes = dataSelections
        .filter(d => d.selected)
        .map(d => d.dataType)

      const deleteAll = selectedDataTypes.includes('all')

      // The backend has cascade deletion, so we have a simplified approach:
      // - If 'all' is selected we need to delete both banks (which cascade to accounts and transactions)
      //   and assets (which might not be connected to banks)

      // Get IDs for selected data types
      let accountIds: number[] = []
      let bankIds: number[] = []
      let transactionIds: number[] = []
      let investmentIds: number[] = []
      let refundGroupIds: number[] = []
      let refundItemIds: number[] = []
      let assetIds: number[] = []

      // If deleting all, we need to get both bank IDs and asset IDs
      if (deleteAll) {
        // Fetch banks for cascade deletion
        const banksResponse = await fetch(`${API_URL}/banks?per_page=1000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        })
        if (banksResponse.ok) {
          const data = await banksResponse.json()
          bankIds = data.items.map((bank: any) => bank.id)
        }

        // Also fetch assets because they need to be deleted separately
        const assetsResponse = await fetch(`${API_URL}/assets?per_page=1000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        })
        if (assetsResponse.ok) {
          const data = await assetsResponse.json()
          assetIds = data.items.map((asset: any) => asset.id)
        }

        const refundItemsResponse = await fetch(`${API_URL}/refund_items?per_page=1000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        })
        if (refundItemsResponse.ok) {
          const data = await refundItemsResponse.json()
          refundItemIds = data.items.map((item: any) => item.id)
        }

        // Delete assets first
        if (assetIds.length > 0) {
          try {
            // There might not be a batch delete for assets, so create one if needed
            const token = localStorage.getItem("access_token")
            for (const assetId of assetIds) {
              await fetch(`${API_URL}/assets/${assetId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              })
            }
            console.log(`Deleted ${assetIds.length} assets`)
          } catch (error) {
            console.error("Error deleting assets:", error)
          }
        }

        // Delete refund items
        if (refundItemIds.length > 0) {
          const result = await deleteRefundItems.mutateAsync(refundItemIds)
          console.log("Deleted refund items:", result)
        }

        // Then delete banks which will cascade to accounts, transactions, etc.
        if (bankIds.length > 0) {
          const result = await deleteBanks.mutateAsync(bankIds)
          console.log("Deleted banks (and cascaded data):", result)
        }

        toast({
          title: "Deletion successful",
          description: "All data has been deleted from the system",
        })

        // Reset delete state
        setConfirmDelete(false)
        setDeleteInProgress(false)
        return // Exit early
      }

      // For specific selections, including assets
      if (selectedDataTypes.includes('assets')) {
        const assetsResponse = await fetch(`${API_URL}/assets?per_page=1000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        })
        if (assetsResponse.ok) {
          const data = await assetsResponse.json()
          assetIds = data.items.map((asset: any) => asset.id)
        }
      }

      // If we're not deleting all data or banks specifically, fetch IDs for selected data types
      if (selectedDataTypes.includes('accounts')) {
        const accountsResponse = await fetch(`${API_URL}/accounts?per_page=1000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        })
        if (accountsResponse.ok) {
          const data = await accountsResponse.json()
          accountIds = data.items.map((account: any) => account.id)
        }
      }

      if (selectedDataTypes.includes('banks')) {
        const banksResponse = await fetch(`${API_URL}/banks?per_page=1000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        })
        if (banksResponse.ok) {
          const data = await banksResponse.json()
          bankIds = data.items.map((bank: any) => bank.id)
        }
      }

      if (selectedDataTypes.includes('transactions')) {
        const transactionsResponse = await fetch(`${API_URL}/transactions?per_page=10000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        })
        if (transactionsResponse.ok) {
          const data = await transactionsResponse.json()
          transactionIds = data.items.map((transaction: any) => transaction.id)
        }
      }

      if (selectedDataTypes.includes('investments')) {
        const investmentsResponse = await fetch(`${API_URL}/investments?per_page=1000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        })
        if (investmentsResponse.ok) {
          const data = await investmentsResponse.json()
          investmentIds = data.items.map((investment: any) => investment.id)
        }
      }

      if (selectedDataTypes.includes('refundGroups')) {
        const refundGroupsResponse = await fetch(`${API_URL}/refund_groups?per_page=1000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        })
        if (refundGroupsResponse.ok) {
          const data = await refundGroupsResponse.json()
          refundGroupIds = data.items.map((group: any) => group.id)
        }
      }

      if (selectedDataTypes.includes('refundItems')) {
        const refundItemsResponse = await fetch(`${API_URL}/refund_items?per_page=1000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
        })
        if (refundItemsResponse.ok) {
          const data = await refundItemsResponse.json()
          refundItemIds = data.items.map((item: any) => item.id)
        }
      }

      // Delete data for specific data types
      // Note: The order still matters for non-cascading specific deletions

      // Process refund items
      if (selectedDataTypes.includes('refundItems') && refundItemIds.length > 0) {
        const result = await deleteRefundItems.mutateAsync(refundItemIds)
        console.log("Deleted refund items:", result)
      }

      // Process refund groups
      if (selectedDataTypes.includes('refundGroups') && refundGroupIds.length > 0) {
        const result = await deleteRefundGroups.mutateAsync(refundGroupIds)
        console.log("Deleted refund groups:", result)
      }

      // Process investments
      if (selectedDataTypes.includes('investments') && investmentIds.length > 0) {
        const result = await deleteInvestments.mutateAsync(investmentIds)
        console.log("Deleted investments:", result)
      }

      // Process transactions
      if (selectedDataTypes.includes('transactions') && transactionIds.length > 0) {
        const result = await deleteTransactions.mutateAsync(transactionIds)
        console.log("Deleted transactions:", result)
      }

      // Process accounts
      if (selectedDataTypes.includes('accounts') && accountIds.length > 0) {
        const result = await deleteAccounts.mutateAsync(accountIds)
        console.log("Deleted accounts:", result)
      }

      // Process banks
      if (selectedDataTypes.includes('banks') && bankIds.length > 0) {
        const result = await deleteBanks.mutateAsync(bankIds)
        console.log("Deleted banks:", result)
      }

      // Process assets
      if (selectedDataTypes.includes('assets') && assetIds.length > 0) {
        // There might not be a batch delete for assets, so do it one by one
        try {
          const token = localStorage.getItem("access_token")
          for (const assetId of assetIds) {
            await fetch(`${API_URL}/assets/${assetId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            })
          }
          console.log(`Deleted ${assetIds.length} assets`)
        } catch (error) {
          console.error("Error deleting assets:", error)
          toast({
            title: "Asset deletion warning",
            description: "Some assets may not have been deleted properly",
            variant: "destructive",
          })
        }
      }

      toast({
        title: "Deletion successful",
        description: "Selected data has been deleted from the system",
      })

      // Reset delete state
      setConfirmDelete(false)
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Deletion failed",
        description: `An error occurred during the deletion process: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setDeleteInProgress(false)
    }
  }

  // Handle file selection for import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0])
    }
  }

  // Format byte size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes'
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    else return (bytes / 1048576).toFixed(1) + ' MB'
  }

  return (
    <PageContainer title="Data Manager">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="delete">Delete</TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>
                Export your data in different formats for backup or analysis
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Format Selection */}
              <div className="space-y-2">
                <Label htmlFor="format">Export Format</Label>
                <Select
                  value={exportFormat}
                  onValueChange={(value: ExportFormat) => setExportFormat(value)}
                  disabled={exportInProgress}
                >
                  <SelectTrigger id="format" className="w-[180px]">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4" />
                        <span>JSON</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileType className="h-4 w-4" />
                        <span>CSV</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="xlsx">
                      <div className="flex items-center gap-2">
                        <FileType className="h-4 w-4" />
                        <span>Excel (XLSX)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Export Mode Selection */}
              <div className="space-y-2">
                <Label htmlFor="export-mode">Export Mode</Label>
                <div className="flex items-center justify-between border rounded-md p-3">
                  <div className="space-y-0.5">
                    <div className="font-medium">
                      {readableExport ? 'Readable Export' : 'Raw Export'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {readableExport
                        ? 'Replace IDs with actual name values for readability'
                        : 'Export raw data with original IDs'}
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">Raw</span>
                      <Switch
                        checked={readableExport}
                        onCheckedChange={setReadableExport}
                        disabled={exportInProgress}
                      />
                      <span className="text-sm text-muted-foreground">Readable</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Selection */}
              <div className="space-y-2">
                <Label>Data to Export</Label>
                <div className="border rounded-md p-4 space-y-4">
                  <Accordion type="multiple" defaultValue={["data-selection"]}>
                    <AccordionItem value="data-selection">
                      <AccordionTrigger>
                        Select Data to Export
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                          {dataSelections.map((dataSelection) => (
                            <div
                              key={dataSelection.dataType}
                              className={`flex items-start space-x-2 border rounded-md p-3 hover:bg-muted/50 transition-colors ${
                                dataSelection.selected ? 'bg-primary/5 border-primary/30' : ''
                              }`}
                              onClick={() => toggleDataSelection(dataSelection.dataType)}
                            >
                              <Checkbox
                                checked={dataSelection.selected}
                                onCheckedChange={() => toggleDataSelection(dataSelection.dataType)}
                                className="mt-1"
                              />
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {dataSelection.displayName}
                                  {dataSelection.count !== undefined && (
                                    <span className="ml-2 text-sm text-muted-foreground">
                                      ({dataSelection.count} items)
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {dataSelection.description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>

              {/* Export Progress */}
              {exportProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Export progress</span>
                    <span>{exportProgress}%</span>
                  </div>
                  <Progress value={exportProgress} className="h-2" />
                </div>
              )}
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("import")}>
                Go to Import
              </Button>
              <Button
                onClick={handleExport}
                disabled={exportInProgress || !dataSelections.some(d => d.selected)}
              >
                {exportInProgress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Data
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Data</CardTitle>
              <CardDescription>
                Import previously exported data back into the system
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Format Selection */}
              <div className="space-y-2">
                <Label htmlFor="import-format">Import Format</Label>
                <Select
                  value={importFormat}
                  onValueChange={(value: ExportFormat) => setImportFormat(value)}
                  disabled={importInProgress}
                >
                  <SelectTrigger id="import-format" className="w-[180px]">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4" />
                        <span>JSON</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileType className="h-4 w-4" />
                        <span>CSV</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="xlsx">
                      <div className="flex items-center gap-2">
                        <FileType className="h-4 w-4" />
                        <span>Excel (XLSX)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="import-file">Select File</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="import-file"
                    type="file"
                    accept={
                      importFormat === "json" ? ".json" :
                      importFormat === "csv" ? ".csv" :
                      ".xlsx"
                    }
                    onChange={handleFileChange}
                    disabled={importInProgress}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setImportFile(null)}
                    disabled={!importFile || importInProgress}
                  >
                    Clear
                  </Button>
                </div>

                {importFile && (
                  <div className="text-sm text-muted-foreground mt-2">
                    Selected: {importFile.name} ({formatFileSize(importFile.size)})
                  </div>
                )}
              </div>

              {/* Import Progress */}
              {importProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Import progress</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  Importing data will merge with existing data. Back up your data before importing if concerned.
                </AlertDescription>
              </Alert>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("export")}>
                Go to Export
              </Button>
              <Button
                onClick={handleImport}
                disabled={importInProgress || !importFile}
              >
                {importInProgress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Data
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Delete Tab */}
        <TabsContent value="delete" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Delete Data</CardTitle>
              <CardDescription>
                Permanently remove data from the system
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Data Selection */}
              <div className="space-y-2">
                <Label>Data to Delete</Label>
                <div className="border rounded-md p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dataSelections.map((dataSelection) => (
                      <div
                        key={dataSelection.dataType}
                        className={`flex items-start space-x-2 border rounded-md p-3 hover:bg-muted/50 transition-colors ${
                          dataSelection.selected ? 'bg-destructive/5 border-destructive/30' : ''
                        }`}
                        onClick={() => toggleDataSelection(dataSelection.dataType)}
                      >
                        <Checkbox
                          checked={dataSelection.selected}
                          onCheckedChange={() => toggleDataSelection(dataSelection.dataType)}
                          className="mt-1"
                        />
                        <div className="space-y-1">
                          <div className="font-medium">
                            {dataSelection.displayName}
                            {dataSelection.count !== undefined && (
                              <span className="ml-2 text-sm text-muted-foreground">
                                ({dataSelection.count} items)
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {dataSelection.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Delete Confirmation */}
              <div className="border border-destructive/50 rounded-md p-4 bg-destructive/5">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="confirm-delete"
                    checked={confirmDelete}
                    onCheckedChange={(value) => setConfirmDelete(value === true)}
                    disabled={deleteInProgress}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="confirm-delete" className="font-semibold">
                      I understand this is a permanent operation
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Deleted data cannot be recovered unless you have an export backup.
                      This action will permanently remove the selected data from the system.
                    </p>
                  </div>
                </div>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  We recommend exporting your data before deletion as a backup measure.
                </AlertDescription>
              </Alert>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("export")}>
                Export First (Recommended)
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteInProgress || !confirmDelete || !dataSelections.some(d => d.selected)}
              >
                {deleteInProgress ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Data
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
