export const formatCurrency = (amount: string | number, currency: string = "USD"): string => {
  try {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericAmount)
  } catch (error) {
    console.error("Error formatting currency:", error)
    return `${amount} ${currency}`
  }
}
