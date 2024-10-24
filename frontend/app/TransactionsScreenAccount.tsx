import { fetchAccounts } from '@/actions/accountActions';
import { Account } from '@/types/account';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Menu } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { darkTheme } from '../constants/theme';
import { deleteAccount } from './api/bankApi';
import { BackButton } from './components/BackButton';
import TransactionList from './components/TransactionList'; // Import the TransactionList component
import sharedStyles from './styles/sharedStyles';

type RouteParams = {
  account: Account;
};

export default function TransactionsScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const { account } = route.params as RouteParams;
  const [visible, setVisible] = useState(false);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const handleEditAccount = () => {
    navigation.navigate('AddAccount', { account });
    closeMenu();
  };

  const handleDeleteAccount = async () => {
    try {
      Alert.alert(
        'Delete Account',
        'Are you sure you want to delete this account?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteAccount(account.id, () => {
                dispatch(fetchAccounts());
                navigation.goBack();
                Alert.alert('Success', 'Account deleted successfully.');
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'There was an error deleting the account.');
    }
  };

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
          <Menu.Item onPress={handleEditAccount} title="Edit Account" />
          <Menu.Item onPress={handleDeleteAccount} title="Delete Account" />
        </Menu>
      </View>
      <View style={[sharedStyles.body, { paddingHorizontal: darkTheme.spacing.s }]}>
        <View style={styles.accountHeader}>
          <Text style={styles.accountName}>{account.name}</Text>
          <Text style={styles.accountBalance}>
            {account.balance.toLocaleString()} €
          </Text>
        </View>
        <View style={styles.transactionsContainer}>
          <TransactionList accountId={account.id} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: darkTheme.spacing.s,
    padding: darkTheme.spacing.m,
    borderRadius: darkTheme.borderRadius.l,
    ...darkTheme.shadows.small,
  },
  menuButton: {
    marginRight: 16,
  },
  accountName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: darkTheme.colors.text,
  },
  accountBalance: {
    fontSize: 20,
    color: darkTheme.colors.primary,
    fontWeight: '600',
  },
  transactionsContainer: {
    flex: 1,
  },
});
