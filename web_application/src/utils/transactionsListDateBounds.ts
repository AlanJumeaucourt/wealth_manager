/**
 * Default date window for transaction lists that should match the main Transactions page:
 * include history through today and exclude future-dated rows.
 */
export function transactionsThroughTodayRange(): { from_date: string; to_date: string } {
  return {
    from_date: "1970-01-01",
    to_date: new Date().toISOString().split("T")[0],
  };
}
