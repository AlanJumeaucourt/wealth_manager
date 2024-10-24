import { useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchTransactionsForCategory } from './api/bankApi'; // Assume this function fetches transactions

export default function BudgetDetailScreen() {
  const route = useRoute();
  const { category, subcategory, transactionIds } = route.params as { category: string; subcategory?: string; transactionIds: string[] };
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const data = await fetchTransactionsForCategory(category, transactionIds);
        setTransactions(data);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      }
    };

    fetchTransactions();
  }, [category, transactionIds]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {subcategory ? `${category} - ${subcategory}` : category} - Last 6 Months
      </Text>
      {/* Render transactions */}
      {transactions.map((transaction, index) => (
        <View key={index} style={styles.transactionItem}>
          <Text style={styles.transactionText}>{transaction.description}</Text>
          <Text style={styles.transactionAmount}>{transaction.amount.toLocaleString()} €</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 8,
  },
  transactionText: {
    fontSize: 16,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
