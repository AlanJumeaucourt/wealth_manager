import { useTransactions } from "@/api/queries";
import { TransactionResponse } from "@/api/types";

interface TransactionListProps {
  filters?: {
    type?: 'income' | 'expense';
    category?: string;
  };
}

export function TransactionList({ filters }: TransactionListProps) {
  const { data: transactions = [] as TransactionResponse[] } = useTransactions({
    type: filters?.type,
    category: filters?.category
  });

  // Ensure transactions is always treated as an array
  const transactionArray = Array.isArray(transactions) ? transactions : [transactions];

  const sortedTransactions = [...transactionArray].sort((a, b) =>
    Math.abs(b.amount) - Math.abs(a.amount)
  );

  return (
    <div className="space-y-4">
      {sortedTransactions.map((transaction) => (
        <TransactionItem
          key={transaction.id}
          transaction={transaction}
        />
      ))}
    </div>
  );
}
