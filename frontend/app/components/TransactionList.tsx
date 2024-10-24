import { findCategoryByName } from '@/utils/categoryUtils';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { useSelector } from 'react-redux';
import { colors } from '../../constants/colors';
import { darkTheme } from '../../constants/theme';
import { Transaction } from '../../types/transaction';
import { fetchTransactions } from '../api/bankApi';

interface TransactionListProps {
  accountId?: number;
}

// Add these new interfaces
interface TransactionResponse {
  transactions: Transaction[];
  total_amount: number;
  count: number;
}

const getIconName = (transaction: Transaction) => {
  if (transaction.subcategory) {
    return findCategoryByName(transaction.category)?.subCategories?.find((sub: any) => sub.name === transaction.subcategory)?.iconName || "help-circle-outline";
  }
  return findCategoryByName(transaction.category)?.iconName || "help-circle-outline";
};

const TransactionList: React.FC<TransactionListProps> = ({ accountId }) => {
  const { accounts, loading: accountsLoading, error: accountsError } = useSelector((state: any) => state.accounts || {});
  const navigation = useNavigation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false); // Loading state
  const [searchQuery, setSearchQuery] = useState(''); // Reintroduce searchQuery without debounce
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchStats, setSearchStats] = useState<{ total: number; count: number } | null>(null);

  // Fetch transactions when the component mounts or when the page or search query changes
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingMore(true);
      const numberofTransactionFetch = 50;
      const response = await fetchTransactions(numberofTransactionFetch, page, accountId, searchQuery);
      if ('transactions' in response) {
        // Update transactions
        setTransactions(prevTransactions => 
          page === 1 ? response.transactions : [...prevTransactions, ...response.transactions]
        );
        // Only update search stats if it's the first page or if we don't have stats yet
        if (searchQuery && (page === 1 || !searchStats)) {
          setSearchStats({
            total: response.total_amount,
            count: response.count
          });
        }
      }
      setIsLoadingMore(false);
    };

    fetchData();
  }, [page, accountId, searchQuery]);

  const loadMoreTransactions = () => {
    if (!isLoadingMore) {
      setPage(prevPage => prevPage + 1);
    }
  };

  const filteredTransactions = useMemo(() => {
    if (accountId) {
      return transactions.filter(transaction => 
        transaction.from_account_id === accountId || 
        transaction.to_account_id === accountId
      );
    }
    return transactions;
  }, [transactions, accountId]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    (filteredTransactions || []).forEach(transaction => {
      if (!groups[transaction.date]) {
        groups[transaction.date] = [];
      }
      groups[transaction.date].push(transaction);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [filteredTransactions]);

  const formatAmount = (amount: number, type: string) => {
    const formattedAmount = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return type === 'expense' ? `-${formattedAmount} €` : `${formattedAmount} €`;
  };

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return format(date, "EEEE, d MMMM yyyy");
  };

  const calculateDayTotal = (transactions: Transaction[]) => {
    return transactions.reduce((total, transaction) => {
      if (transaction.type === 'expense') return total - transaction.amount;
      if (transaction.type === 'income') return total + transaction.amount;
      if (transaction.type === 'transfer') {
        if (accountId) {
          if (transaction.from_account_id === accountId) {
            return total - transaction.amount;
          } else if (transaction.to_account_id === accountId) {
            return total + transaction.amount;
          }
        }
      }
      return total;
    }, 0);
  };

  const accountNameFromId = (accountId: number) => {
    if (!accounts || !Array.isArray(accounts)) {
      return accountId.toString();
    }
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : accountId.toString();
  };

  const handlePress = (transaction: Transaction) => {
    navigation.navigate('TransactionDetails', { transaction });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
    setTransactions([]);
    // Reset search stats when starting a new search
    setSearchStats(null);
  };

  // Add this component to display search results
  const renderSearchStats = () => {
    if (!searchStats || !searchQuery) return null;
    
    return (
      <View style={styles.searchStatsContainer}>
        <Text style={styles.searchStatsText}>
          Found {searchStats.count} transactions
        </Text>
        <Text style={[
          styles.searchStatsAmount,
          searchStats.total >= 0 ? styles.positiveTotal : styles.negativeTotal
        ]}>
          Total: {formatAmount(Math.abs(searchStats.total), searchStats.total >= 0 ? 'income' : 'expense')}
        </Text>
      </View>
    );
  };

  if (accountsLoading) {
    return <Text>Loading accounts...</Text>;
  }

  if (accountsError) {
    return <Text>Error loading accounts: {accountsError instanceof Error ? accountsError.message : String(accountsError)}</Text>;
  }

  // Footer component for loading indicator
  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#0000ff" />
      </View>
    );
  };

  return (
    <>
      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Transactions"
            value={searchQuery}
            onChangeText={handleSearch} // Update search handling
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} style={styles.searchClearButton}>
              <Ionicons name="close-circle-outline" size={20} color={"red"} />
            </TouchableOpacity>
          )}
        </View>
      )}
      {renderSearchStats()}
      <FlatList
        data={groupedTransactions}
        keyExtractor={([date]) => date}
        style={{ flex: 1, paddingBottom: 150 }}
        renderItem={({ item: [date, transactions] }) => {
          const dayTotal = calculateDayTotal(transactions);
          return (
            <View key={date} style={styles.dateGroup}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{formatDate(date)}</Text>
                <Text style={[styles.dayTotal, dayTotal >= 0 ? styles.positiveTotal : styles.negativeTotal]}>
                  {formatAmount(Math.abs(dayTotal), dayTotal >= 0 ? 'income' : 'expense')}
                </Text>
              </View>
              <View style={styles.transactionsContainer}>
                {transactions.map((item, index) => (
                  <Pressable
                    key={`${item.id}-${date}`}
                    onPress={() => handlePress(item)}
                    style={[
                      styles.transactionItem,
                      index === 0 && styles.firstTransaction,
                      index === transactions.length - 1 && styles.lastTransaction,
                    ]}
                  >
                    <View style={styles.transactionIcon}>
                      <View style={[styles.iconCircle, { backgroundColor: findCategoryByName(item.category)?.color }, { marginRight: 10 }]}>
                        <Ionicons
                          name={
                            findCategoryByName(item.category)?.subCategories?.find(
                              sub => sub.name.toLowerCase() === item.subcategory.toLowerCase()
                            )?.iconName || "chevron-forward"
                          }
                          size={20}
                          color={colors.white}
                        />
                      </View>
                    </View>
                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionDescription}>{item.description}</Text>
                      {item.type === 'transfer' && (
                        <Text style={styles.transferDetails}>
                          {accountNameFromId(item.from_account_id)} → {accountNameFromId(item.to_account_id)}
                        </Text>
                      )}
                      {item.type === 'expense' && !accountId && (
                        <Text style={styles.expenseDetails}>{accountNameFromId(item.from_account_id)}</Text>
                      )}
                      {item.type === 'income' && !accountId && (
                        <Text style={styles.incomeDetails}>{accountNameFromId(item.to_account_id)}</Text>
                      )}
                      {item.category && !item.subcategory && item.type != 'transfer' && (
                        <Text style={styles.categoryDetails}>{item.category}</Text>
                      )}
                      {item.subcategory && item.type != 'transfer' && (
                        <Text style={styles.subcategoryDetails}>{item.category} - {item.subcategory}</Text>
                      )}
                    </View>
                    <Text style={[
                      styles.transactionAmount,
                      item.type === 'expense' ? styles.expense :
                        item.type === 'income' ? styles.income : styles.transfer
                    ]}>
                      {formatAmount(item.amount, item.type)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        }}
        onEndReached={loadMoreTransactions} // Load more transactions when reaching the end
        onEndReachedThreshold={0.5} // Adjust threshold to prevent premature triggering
        contentContainerStyle={styles.contentTransactionList}
        ListFooterComponent={renderFooter}
        onScroll={({ nativeEvent }) => {
          if (nativeEvent.contentOffset.y < -50) { // Adjust threshold as needed
            setIsSearchVisible(true);
          }
        }}
        onScrollEndDrag={({ nativeEvent }) => {
          if (nativeEvent.contentOffset.y >= 0) {
            setIsSearchVisible(false);
          }
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  contentTransactionList: {
    flexGrow: 1,
  },
  footer: {
    padding: darkTheme.spacing.m,
    alignItems: 'center',
  },
  dateGroup: {
    marginBottom: darkTheme.spacing.m,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: darkTheme.spacing.s,
    paddingHorizontal: darkTheme.spacing.m,
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: darkTheme.colors.text,
  },
  dayTotal: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  positiveTotal: {
    color: darkTheme.colors.success,
  },
  negativeTotal: {
    color: darkTheme.colors.text,
  },
  transactionsContainer: {
    backgroundColor: darkTheme.colors.surface,
    borderRadius: darkTheme.borderRadius.l,
    overflow: 'hidden',
    ...darkTheme.shadows.medium,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: darkTheme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: darkTheme.colors.border,
  },
  firstTransaction: {
    borderTopLeftRadius: darkTheme.borderRadius.l,
    borderTopRightRadius: darkTheme.borderRadius.l,
  },
  lastTransaction: {
    borderBottomLeftRadius: darkTheme.borderRadius.l,
    borderBottomRightRadius: darkTheme.borderRadius.l,
    borderBottomWidth: 0,
  },
  transactionDescription: {
    fontSize: 14,
    flex: 1,
    paddingBottom: 5,
    fontWeight: 'bold',
    color: darkTheme.colors.text,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  expense: {
    color: darkTheme.colors.text,
    fontWeight: 'normal',
  },
  income: {
    color: darkTheme.colors.success,
    fontWeight: 'normal',
  },
  transfer: {
    color: darkTheme.colors.info,
    fontWeight: 'normal',
  },
  transactionDetails: {
    flex: 1,
  },
  transferDetails: {
    fontSize: 14,
    color: darkTheme.colors.info,
    fontWeight: '300',
  },
  expenseDetails: {
    fontSize: 14,
    color: darkTheme.colors.textSecondary,
    fontWeight: '300',
  },
  incomeDetails: {
    fontSize: 14,
    color: darkTheme.colors.textSecondary,
    fontWeight: '300',
  },
  categoryDetails: {
    fontSize: 14,
    color: darkTheme.colors.textSecondary,
    fontWeight: '300',
  },
  subcategoryDetails: {
    fontSize: 14,
    color: darkTheme.colors.textSecondary,
    fontWeight: '300',
  },
  iconCircle: {
    borderRadius: darkTheme.borderRadius.xl,
    padding: darkTheme.spacing.s,
    marginRight: darkTheme.spacing.m,
  },
  transactionIcon: {
    marginRight: darkTheme.spacing.s,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: darkTheme.colors.surface,
    marginBottom: darkTheme.spacing.s,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderColor: darkTheme.colors.border,
    borderWidth: 1,
    borderRadius: darkTheme.borderRadius.m,
    paddingHorizontal: 10,
    backgroundColor: darkTheme.colors.background,
    color: darkTheme.colors.text,
  },
  searchClearButton: {
    marginHorizontal: 10,
  },
  noResultsText: {
    textAlign: 'center',
    marginTop: 20,
    color: darkTheme.colors.textSecondary,
    fontSize: 16,
  },
  searchStatsContainer: {
    backgroundColor: darkTheme.colors.surface,
    padding: darkTheme.spacing.m,
    marginBottom: darkTheme.spacing.s,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchStatsText: {
    color: darkTheme.colors.text,
    fontSize: 14,
  },
  searchStatsAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TransactionList;
