import { fetchTransactions } from '@/app/api/bankApi';
import { darkTheme } from '@/constants/theme';
import { Transaction } from '@/types/transaction';
import { findCategoryByName } from '@/utils/categoryUtils';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';

interface TransactionListProps {
  accountId?: number;
}

// Add these new interfaces
interface TransactionResponse {
  transactions: Transaction[];
  total_amount: number;
  count: number;
}

const getIconName = (transaction: Transaction): keyof typeof Ionicons.glyphMap => {
  if (transaction.subcategory) {
    return (findCategoryByName(transaction.category)?.subCategories?.find((sub: any) => sub.name === transaction.subcategory)?.iconName || "help-circle-outline") as keyof typeof Ionicons.glyphMap;
  }
  return (findCategoryByName(transaction.category)?.iconName || "help-circle-outline") as keyof typeof Ionicons.glyphMap;
};

const TransactionList: React.FC<TransactionListProps> = ({ accountId }) => {
  const { accounts, loading: accountsLoading, error: accountsError } = useSelector((state: any) => state.accounts || {});
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false); // Loading state
  const [searchQuery, setSearchQuery] = useState(''); // Reintroduce searchQuery without debounce
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchStats, setSearchStats] = useState<{ total: number; count: number } | null>(null);
  const [forceShowSearch, setForceShowSearch] = useState(false);

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
    router.push({
      pathname: '/transaction/[id]',
      params: { transaction: JSON.stringify(transaction) }
    });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
    setTransactions([]);
    setSearchStats(null);
    if (query.length > 0) {
      setForceShowSearch(true);
    } else {
      setForceShowSearch(false);
    }
  };

  // Add this component to display search results
  const renderSearchStats = () => {
    if (!searchStats || !searchQuery) return null;

    return (
      <View style={styles.searchStatsContainer}>
        <View style={styles.searchStatsContent}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={darkTheme.colors.textSecondary}
            style={styles.searchStatsIcon}
          />
          <View>
            <Text style={styles.searchStatsText}>
              Found <Text style={styles.searchStatsHighlight}>{searchStats.count}</Text> transactions
            </Text>
            <Text style={[
              styles.searchStatsAmount,
              searchStats.total >= 0 ? styles.positiveTotal : styles.negativeTotal
            ]}>
              Total: {formatAmount(Math.abs(searchStats.total), searchStats.total >= 0 ? 'income' : 'expense')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Update the transaction item styling and add animations
  const TransactionItem = ({ item, onPress }: { item: Transaction; onPress: () => void }) => {
    const getTransactionColor = (type: string) => {
      switch (type) {
        case 'expense':
          return darkTheme.colors.error;
        case 'income':
          return darkTheme.colors.success;
        default:
          return darkTheme.colors.info;
      }
    };

    return (
      <Pressable
        style={styles.transactionItem}
        onPress={onPress}
        android_ripple={{ color: 'rgba(0, 0, 0, 0.1)' }}
      >
        <View style={styles.transactionIcon}>
          <View style={[
            styles.iconCircle,
            { backgroundColor: findCategoryByName(item.category)?.color || darkTheme.colors.primary }
          ]}>
            <Ionicons
              name={getIconName(item)}
              size={20}
              color={darkTheme.colors.surface}
            />
          </View>
        </View>

        <View style={styles.transactionContent}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionDescription} numberOfLines={1}>
              {item.description}
            </Text>
            <Text style={[
              styles.transactionAmount,
              { color: getTransactionColor(item.type) }
            ]}>
              {formatAmount(item.amount, item.type)}
            </Text>
          </View>

          <View style={styles.transactionDetails}>
            {item.type === 'transfer' ? (
              <Text style={styles.transferDetails}>
                {' '}{accountNameFromId(item.from_account_id)} → {accountNameFromId(item.to_account_id)}
              </Text>
            ) : (
              <Text style={styles.categoryText}>
                {item.subcategory ? `${item.subcategory}` : item.category}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
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
      {(isSearchVisible || forceShowSearch || searchStats) && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons
              name="search-outline"
              size={20}
              color={darkTheme.colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search transactions..."
              placeholderTextColor={darkTheme.colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => handleSearch('')}
                style={styles.searchClearButton}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={darkTheme.colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
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
                  <React.Fragment key={item.id}>
                    <TransactionItem
                      item={item}
                      onPress={() => handlePress(item)}
                    />
                    {index < transactions.length - 1 && (
                      <View style={styles.transactionDivider} />
                    )}
                  </React.Fragment>
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
          if (nativeEvent.contentOffset.y < -50) {
            setIsSearchVisible(true);
          }
        }}
        onScrollEndDrag={({ nativeEvent }) => {
          if (nativeEvent.contentOffset.y >= 0 && !forceShowSearch && !searchStats) {
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
    paddingBottom: 150,
  },
  footer: {
    padding: darkTheme.spacing.m,
    alignItems: 'center',
  },
  dateGroup: {
    marginBottom: darkTheme.spacing.s, // Reduced from m to s
    paddingHorizontal: darkTheme.spacing.m, // Added horizontal padding
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: darkTheme.spacing.m,
    paddingVertical: darkTheme.spacing.xs, // Reduced from s to xs
    backgroundColor: `${darkTheme.colors.primary}10`,
    borderRadius: darkTheme.borderRadius.m,
    marginBottom: darkTheme.spacing.s,
  },
  dateHeaderText: {
    fontSize: 13, // Reduced from 14
    fontWeight: '600',
    color: darkTheme.colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayTotal: {
    fontSize: 14,
    fontWeight: '600',
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
    alignItems: 'center',
    padding: darkTheme.spacing.s, // Reduced from m to s
    backgroundColor: darkTheme.colors.surface,
    marginBottom: 1,
    borderRadius: darkTheme.borderRadius.m,
  },
  transactionIcon: {
    marginRight: darkTheme.spacing.m,
  },
  iconCircle: {
    width: 36, // Reduced from 40
    height: 36, // Reduced from 40
    borderRadius: 18, // Adjusted for new size
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionContent: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: darkTheme.spacing.xs,
  },
  transactionDescription: {
    fontSize: 15, // Reduced from 16
    fontWeight: '600',
    color: darkTheme.colors.text,
    flex: 1,
    marginRight: darkTheme.spacing.s,
  },
  transactionAmount: {
    fontSize: 15, // Reduced from 16
    fontWeight: '600',
  },
  transactionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transferDetails: {
    fontSize: 13, // Reduced from 14
    color: darkTheme.colors.info,
    fontWeight: '500',
  },
  categoryText: {
    fontSize: 13, // Reduced from 14
    color: darkTheme.colors.textSecondary,
    fontWeight: '500',
  },
  searchContainer: {
    margin: darkTheme.spacing.m,
    backgroundColor: darkTheme.colors.surface,
    borderRadius: darkTheme.borderRadius.l,
    overflow: 'hidden',
    ...darkTheme.shadows.medium,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkTheme.colors.surface,
    paddingHorizontal: darkTheme.spacing.m,
    height: 44,
  },
  searchIcon: {
    marginRight: darkTheme.spacing.s,
  },
  searchInput: {
    flex: 1,
    color: darkTheme.colors.text,
    fontSize: 16,
    height: '100%',
    paddingVertical: 0, // Remove default padding
  },
  searchClearButton: {
    padding: darkTheme.spacing.xs,
    marginLeft: darkTheme.spacing.xs,
  },
  searchStatsContainer: {
    marginHorizontal: darkTheme.spacing.m,
    marginBottom: darkTheme.spacing.m,
    backgroundColor: darkTheme.colors.surface,
    borderRadius: darkTheme.borderRadius.l,
    overflow: 'hidden',
    ...darkTheme.shadows.medium,
  },
  searchStatsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${darkTheme.colors.primary}10`,
    padding: darkTheme.spacing.m,
  },
  searchStatsIcon: {
    marginRight: darkTheme.spacing.m,
  },
  searchStatsText: {
    fontSize: 14,
    color: darkTheme.colors.textSecondary,
    marginBottom: darkTheme.spacing.xs,
  },
  searchStatsHighlight: {
    color: darkTheme.colors.text,
    fontWeight: '600',
  },
  searchStatsAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: darkTheme.spacing.xl,
  },
  noResultsText: {
    fontSize: 16,
    color: darkTheme.colors.textSecondary,
    textAlign: 'center',
    marginTop: darkTheme.spacing.m,
  },
  transactionDivider: {
    height: 1,
    backgroundColor: `${darkTheme.colors.text}10`,
    marginHorizontal: darkTheme.spacing.m,
  },
});

export default TransactionList;
