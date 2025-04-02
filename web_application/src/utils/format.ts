export const formatCurrency = (amount: string, currency: string): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(amount))
  } catch (error) {
    console.error("Error formatting currency:", error)
    return `${amount} ${currency}`
  }
}
