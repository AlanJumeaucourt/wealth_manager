import React, { useEffect, useState } from 'react';
import { View, TextInput, FlatList, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { fetchAccounts } from '../api/bankApi';
import { Account } from '../../types/account';
import { Ionicons } from '@expo/vector-icons';
import { darkTheme } from '../../constants/theme';

const AccountList: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const fetchedAccounts = await fetchAccounts(50, page, searchQuery);
      setAccounts(prev => page === 1 ? fetchedAccounts : [...prev, ...fetchedAccounts]);
      setIsLoading(false);
    };

    fetchData();
  }, [page, searchQuery]);

  const loadMoreAccounts = () => {
    if (!isLoading) {
      setPage(prev => prev + 1);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
    setAccounts([]);
  };

  return (
    <>
      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Accounts"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#000" />
            </TouchableOpacity>
          )}
        </View>
      )}
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.accountItem}>
            <Text style={styles.accountName}>{item.name}</Text>
            <Text style={styles.accountType}>{item.type}</Text>
          </View>
        )}
        onEndReached={loadMoreAccounts}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isLoading ? <ActivityIndicator size="small" color="#0000ff" /> : null}
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
        contentContainerStyle={styles.contentAccountList}
      />
    </>
  );
};

const styles = StyleSheet.create({
  contentAccountList: {
    flexGrow: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: darkTheme.colors.surface,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderColor: darkTheme.colors.border,
    borderWidth: 1,
    borderRadius: darkTheme.borderRadius.m,
    paddingHorizontal: 10,
    backgroundColor: darkTheme.colors.background,
  },
  accountItem: {
    padding: darkTheme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: darkTheme.colors.border,
  },
  accountName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: darkTheme.colors.text,
  },
  accountType: {
    fontSize: 14,
    color: darkTheme.colors.textSecondary,
  },
});

export default AccountList;
