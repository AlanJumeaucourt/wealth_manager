import { fetchTransactions } from '@/actions/transactionActions';
import { BackButton } from '@/app/components/BackButton';
import { expenseCategories, incomeCategories } from '@/constants/categories';
import { colors } from '@/constants/colors';
import { darkTheme } from '@/constants/theme';
import { Account } from '@/types/account';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-elements';
import { Menu } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { RootStackParamList } from '../types/navigation';
import { Transaction } from '../types/transaction';
import { deleteTransaction } from './api/bankApi';
import sharedStyles from './styles/sharedStyles';

type TransactionDetailsRouteProp = RouteProp<RootStackParamList, 'TransactionDetails'>;

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

function findCategoryIcon(categoryName: string, subcategoryName?: string) {
  const allCategories = [...expenseCategories, ...incomeCategories];
  const category = allCategories.find(cat => cat.name === categoryName);
  console.log('category in findCategoryIcon : ', category);
  if (!category) return null;

  if (subcategoryName) {
    const subCategory = category.subCategories?.find(sub => sub.name === subcategoryName);
    return subCategory ? { iconName: subCategory.iconName, iconSet: subCategory.iconSet } : null;
  }

  return { iconName: category.iconName, iconSet: category.iconSet };
}

// Implement findCategoryByName function
function findCategoryByName(categoryName: string) {
  const allCategories = [...expenseCategories, ...incomeCategories];
  return allCategories.find(cat => cat.name === categoryName);
}

export default function TransactionDetailsScreen() {
  const route = useRoute<TransactionDetailsRouteProp>();
  const navigation = useNavigation();
  const transaction = route.params?.transaction as Transaction; // Ensure transaction is correctly typed
  console.log('route.params in TransactionDetailsScreen : ', route.params);
  const dispatch = useDispatch();
  const { accounts, error: accountsError } = useSelector((state: any) => state.accounts || {});

  const [NewTransaction, setNewTransaction] = useState(transaction);

  const handleEdit = () => {
    console.log('transaction in handleEdit : ', transaction);
    navigation.navigate('AddTransaction', { transaction: transaction }); // Ensure this matches the expected type
    closeMenu();
  };

  if (accountsError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error loading accounts: {accountsError instanceof Error ? accountsError.message : String(accountsError)}</Text>
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

  const [visible, setVisible] = React.useState(false);
  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

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
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.headerContainer}>
            <View style={[styles.iconContainer, { backgroundColor: getIconBackgroundColor(transaction.type) }]}>
              <Icon
                name={getIconName(transaction.type)}
                type="font-awesome"
                color={darkTheme.colors.surface}
                size={30}
              />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{transaction.description}</Text>
              <Text style={styles.date}>{format(parseISO(transaction.date), 'dd MMMM yyyy')}</Text>
            </View>
          </View>
          <Text style={[styles.amount, { color: getAmountColor(transaction.type) }]}>
            {formatAmount(transaction.amount, transaction.type)}
          </Text>

          <View style={styles.categoryContainer}>
            {categoryIcon && (
              <View style={[styles.iconCircle, { backgroundColor: findCategoryByName(transaction.category)?.color }]}>
                {categoryIcon.iconSet === 'Ionicons' && (
                  <Ionicons name={categoryIcon.iconName as any} size={16} color="white" />
                )}
              </View>
            )}
            <View style={styles.legendLabelContainer}>
              <Text style={styles.legendLabel} numberOfLines={1} ellipsizeMode="tail">
                {transaction.subcategory ? `${transaction.category} - ${transaction.subcategory}` : transaction.category}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailsContainer}>
            <DetailRow icon="exchange" label="Type" value={capitalizeFirstLetter(transaction.type)} />
            <Pressable onPress={() => navigation.navigate('TransactionsScreenAccount', { account: accounts.find(account => account.id === transaction.from_account_id) })}>
              <DetailRow icon="arrow-right" label="From" value={accountNameFromId(transaction.from_account_id, accounts)} />
            </Pressable>
            <Pressable onPress={() => navigation.navigate('TransactionsScreenAccount', { account: accounts.find(account => account.id === transaction.to_account_id) })}>
              <DetailRow icon="arrow-left" label="To" value={accountNameFromId(transaction.to_account_id, accounts)} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

interface DetailRowProps {
  icon: string;
  label: string;
  value: string; transactionIcon
}

const DetailRow: React.FC<DetailRowProps> = ({ icon, label, value }) => (
  <View style={styles.detailRow}>
    <Icon name={icon} type="font-awesome" color="#517fa4" size={18} />
    <View style={styles.detailTextContainer}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

const getIconName = (type: string) => {
  switch (type) {
    case 'income':
      return 'arrow-down';
    case 'expense':
      return 'arrow-up';
    default:
      return 'exchange';
  }
};

const getIconBackgroundColor = (type: string) => {
  switch (type) {
    case 'income':
      return '#4CAF50';
    case 'expense':
      return '#F44336';
    default:
      return '#2196F3';
  }
};

const getAmountColor = (type: string) => {
  switch (type) {
    case 'income':
      return '#4CAF50';
    case 'expense':
      return '#F44336';
    default:
      return '#2196F3';
  }
};

const capitalizeFirstLetter = (string: string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  menuButton: {
    marginRight: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 16,
  },
  scrollContent: {
    flexGrow: 1,
    padding: darkTheme.spacing.m,
  },
  card: {
    backgroundColor: darkTheme.colors.surface,
    borderRadius: darkTheme.borderRadius.l,
    padding: darkTheme.spacing.l,
    ...darkTheme.shadows.medium,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: darkTheme.spacing.m,
  },
  iconContainer: {
    borderRadius: darkTheme.borderRadius.xl,
    padding: darkTheme.spacing.m,
    marginRight: darkTheme.spacing.m,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: darkTheme.colors.text,
    marginBottom: darkTheme.spacing.xs,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: darkTheme.spacing.m,
    textAlign: 'center',
  },
  date: {
    fontSize: 16,
    color: darkTheme.colors.textSecondary,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: darkTheme.spacing.m,
  },
  category: {
    fontSize: 18,
    color: darkTheme.colors.text,
    marginLeft: darkTheme.spacing.m,
  },
  divider: {
    height: 1,
    backgroundColor: darkTheme.colors.border,
    marginVertical: darkTheme.spacing.m,
  },
  detailsContainer: {
    marginBottom: darkTheme.spacing.m,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: darkTheme.spacing.m,
  },
  detailTextContainer: {
    marginLeft: darkTheme.spacing.m,
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: darkTheme.colors.textSecondary,
    marginBottom: darkTheme.spacing.xs,
  },
  detailValue: {
    fontSize: 16,
    color: darkTheme.colors.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editButton: {
    backgroundColor: darkTheme.colors.success,
    borderRadius: 8,
    paddingVertical: 12,
    flex: 1,
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: darkTheme.colors.error,
    borderRadius: 8,
    paddingVertical: 12,
    flex: 1,
    marginLeft: 10,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    color: darkTheme.colors.textSecondary,
  },
  iconCircle: {
    borderRadius: 16,
    padding: 8,
    marginRight: 10,
  },
  legendLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendLabel: {
    fontSize: 16,
    color: darkTheme.colors.text,
    flex: 1,
    flexWrap: 'wrap',
  },
  subCategoryLabel: {
    fontSize: 14,
    color: darkTheme.colors.textSecondary,
  },
});
