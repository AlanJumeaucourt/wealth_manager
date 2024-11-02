import { fetchTransactions } from '@/actions/transactionActions';
import { BackButton } from '@/app/components/BackButton';
import { expenseCategories, incomeCategories } from '@/constants/categories';
import { darkTheme } from '@/constants/theme';
import { Account } from '@/types/account';
import { Transaction } from '@/types/transaction';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-elements';
import { Menu } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { deleteTransaction } from '../../api/bankApi';
import sharedStyles from '../../styles/sharedStyles';

export default function TransactionDetailsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const transaction = params.transaction ? JSON.parse(params.transaction as string) as Transaction : undefined;
  const dispatch = useDispatch();
  const { accounts, error: accountsError } = useSelector((state: any) => state.accounts || {});

  const [visible, setVisible] = React.useState(false);
  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const handleEdit = () => {
    router.push({
      pathname: '/(app)/add-transaction',
      params: { transaction: JSON.stringify(transaction) }
    });
    closeMenu();
  };

  const handleDeleteTransaction = async () => {
    try {
      Alert.alert('Are you sure you want to delete this transaction?', '', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(transaction.id);
            dispatch(fetchTransactions());
            router.back();
          },
        },
      ]);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  if (accountsError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Error loading accounts: {accountsError instanceof Error ? accountsError.message : String(accountsError)}
        </Text>
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Transaction details not available.</Text>
      </View>
    );
  }

  const categoryIcon = findCategoryIcon(transaction.category, transaction.subcategory);

  return (
    <View style={[sharedStyles.container]}>
      <View style={sharedStyles.header}>
        <BackButton />
        <Menu
          visible={visible}
          onDismiss={closeMenu}
          anchor={
            <Pressable style={styles.menuButton} onPress={openMenu}>
              <Ionicons name="ellipsis-vertical" size={24} color={darkTheme.colors.text} />
            </Pressable>
          }
        >
          <Menu.Item onPress={handleEdit} title="Edit Transaction" />
          <Menu.Item onPress={handleDeleteTransaction} title="Delete Transaction" />
        </Menu>
      </View>
      {/* Rest of your existing JSX remains the same */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          {/* ... existing card content ... */}
          <View style={styles.detailsContainer}>
            <DetailRow icon="exchange" label="Type" value={capitalizeFirstLetter(transaction.type)} />
            <Pressable onPress={() => router.push({
              pathname: '/(app)/(tabs)/transactions/account',
              params: { account: JSON.stringify(accounts.find(account => account.id === transaction.from_account_id)) }
            })}>
              <DetailRow icon="arrow-right" label="From" value={accountNameFromId(transaction.from_account_id, accounts)} />
            </Pressable>
            <Pressable onPress={() => router.push({
              pathname: '/(app)/(tabs)/transactions/account',
              params: { account: JSON.stringify(accounts.find(account => account.id === transaction.to_account_id)) }
            })}>
              <DetailRow icon="arrow-left" label="To" value={accountNameFromId(transaction.to_account_id, accounts)} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Keep all your existing helper functions and styles...
const formatAmount = (amount: number, type: string) => {
  const formattedAmount = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return type === 'expense' ? `-${formattedAmount} €` : `${formattedAmount} €`;
};

const accountNameFromId = (accountId: number, accounts: Account[] | undefined) => {
  if (!accounts || !Array.isArray(accounts)) {
    return accountId.toString();
  }
  const account = accounts.find(a => a.id === accountId);
  return account ? account.name : accountId.toString();
};

// ... rest of your helper functions and styles remain the same
