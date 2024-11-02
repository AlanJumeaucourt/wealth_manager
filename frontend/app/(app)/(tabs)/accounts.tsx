import { fetchWealthData } from '@/app/api/bankApi'; // Import the new API function
import { Account } from '@/types/account';
import { Bank } from '@/types/bank';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts'; // Import the LineChart component
import { ActivityIndicator, Button, Menu, Button as PaperButton, FAB } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAccounts } from '../../../actions/accountActions';
import { fetchBanks } from '../../../actions/bankActions';
import { colors } from '../../../constants/colors';
import { darkTheme } from '../../../constants/theme';
import sharedStyles from '../../styles/sharedStyles';
import { ThunkDispatch } from 'redux-thunk';
import { AnyAction } from 'redux';

interface DataPoint {
  value: number;
  date: string;
}
// Define the navigation param list
type RootStackParamList = {
  TransactionsScreen: { account: Account };
  TransactionsScreenAccount: { account: Account };
};

// Define the navigation prop type
type AccountsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TransactionsScreen' | 'TransactionsScreenAccount'>;

const filters = ['All', 'Checking', 'Savings', 'Investment'];

const Stack = createStackNavigator();

// Define the type for wealth data
type WealthDataPoint = { [date: string]: number };

export default function AccountsScreen() {
  const dispatch: ThunkDispatch<{}, {}, AnyAction> = useDispatch();
  const { accounts, accountsLoading, accountsError } = useSelector((state: any) => state.accounts);
  const { banks, banksLoading, banksError } = useSelector((state: any) => state.banks);
  const navigation = useNavigation<AccountsScreenNavigationProp>();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const router = useRouter();
  const [wealthData, setWealthData] = useState<WealthDataPoint[]>([]); // State to hold wealth data
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Ajoutez cet état
  const [isLoading, setIsLoading] = useState(true);
  const [chartWidth, setChartWidth] = useState(Dimensions.get('window').width - 80);
  const [fabOpen, setFabOpen] = useState(false);

  // Move the resize effect up here, before any conditional returns
  useEffect(() => {
    const handleResize = () => {
      setChartWidth(Dimensions.get('window').width - 40);
    };

    const subscription = Dimensions.addEventListener('change', handleResize);

    return () => {
      subscription?.remove();
    };
  }, []);

  const foundBankNameById = (bankId: number) => {
    return banks.find((bank: Bank) => bank.id === bankId)?.name;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6); // 6 months ago
        const endDate = new Date(); // Current date
        const response = await fetchWealthData(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
        // console.log("response", response);
        if (response) {
          setWealthData(response);
        }
        else {
          console.log("No response");
        }
        setIsLoading(false);
        // console.log("wealthData", wealthData);
      } catch (error) {
        console.error('Error fetching wealth data:', error);
        setIsLoading(false);
      }
    };

    // console.log("wealthData", wealthData);
    fetchData();
    dispatch(fetchAccounts());
    dispatch(fetchBanks());
  }, [dispatch, refreshKey]);

  useEffect(() => {
    const handleResize = () => {
      setChartWidth(Dimensions.get('window').width - 20); // Update width on resize
    };

    const subscription = Dimensions.addEventListener('change', handleResize); // Listen for dimension changes
    dispatch(fetchAccounts());
    dispatch(fetchBanks());

    return () => {
      subscription?.remove(); // Clean up the event listener on unmount
    };
  }, []);

  const filteredAccounts = useMemo(() => {
    if (selectedFilter === 'All') {
      return accounts.filter((account:
        Account) => account.type != 'income' && account.type != 'expense');
    }
    return accounts.filter((account: Account) => account.type === selectedFilter.toLowerCase());
  }, [selectedFilter, accounts, dispatch]);

  const groupedAccounts = useMemo(() => {
    const groups = filteredAccounts.reduce((groups: Record<string, Account[]>, account: Account) => {
      const bankName = foundBankNameById(account.bank_id);
      if (!groups[bankName as string]) {
        groups[bankName as string] = [];
      }
      groups[bankName as string].push(account);
      return groups;
    }, {} as Record<string, Account[]>);

    // Sort banks alphabetically
    const sortedGroups: Record<string, Account[]> = {};
    Object.keys(groups).sort().forEach(key => {
      // Sort accounts within each bank alphabetically
      sortedGroups[key] = groups[key].sort((a: Account, b: Account) => a.name.localeCompare(b.name));
    });

    return sortedGroups;
  }, [filteredAccounts, banks, accounts, dispatch]);

  const handleAccountPress = (account: Account) => {
    if (account.type === 'checking' || account.type === 'savings' || account.type === 'investment') {
      navigation.navigate('TransactionsScreenAccount', { account: account });
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    router.replace('/');
  };

  const formatCompactNumber = (number: number) => {
    if (number >= 1_000_000) {
      return (number / 1_000_000).toFixed(1) + 'M';
    } else if (number >= 1_000) {
      return (number / 1_000).toFixed(1) + 'k';
    }
    return number.toString();
  };

  const totalBalance = useMemo(() => {
    return filteredAccounts.reduce((sum: number, account: Account) => sum + account.balance, 0);
  }, [filteredAccounts, dispatch]);

  const renderFilterItem = ({ item }: { item: string }) => ( // Specify type for item
    <Pressable
      style={[
        styles.filterButton,
        selectedFilter === item && styles.selectedFilter,
      ]}
      onPress={() => setSelectedFilter(item)}
    >
      <Text style={[styles.filterText, selectedFilter === item && styles.selectedFilterText]}>
        {item}
      </Text>
    </Pressable>
  );

  const LogoutButton = () => (
    <Pressable
      style={styles.logoutButton}
      onPress={() => setIsLogoutModalVisible(true)}
    >
      <Ionicons name="log-out-outline" size={24} color={colors.text} />
    </Pressable>
  );

  const refreshPage = () => {
    setRefreshKey(prev => prev + 1);
  };

  const LogoutModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isLogoutModalVisible}
      onRequestClose={() => setIsLogoutModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Logout</Text>
          <Text style={styles.modalText}>Are you sure you want to logout?</Text>
          <View style={styles.modalButtons}>
            <PaperButton
              mode="outlined"
              onPress={() => setIsLogoutModalVisible(false)}
              style={styles.modalButton}
            >
              Cancel
            </PaperButton>
            <PaperButton
              mode="contained"
              onPress={handleLogout}
              style={styles.modalButton}
            >
              Logout
            </PaperButton>
            <PaperButton
              mode="contained"
              onPress={refreshPage}
              style={styles.modalButton}
            >
              refreshPage
            </PaperButton>
          </View>
        </View>
      </View>
    </Modal>
  );

  const formatNumber = (number: number) => {
    return number.toLocaleString('en-US', { style: 'currency', currency: 'EUR' });
  };

  const handlePointClick = (point: { x: number, y: number }) => {
    console.log(`Clicked on point: x=${point.x}, y=${point.y}`);
    // You can add more logic here to handle the click event
  };

  const formatData = (): DataPoint[] => {
    return Object.entries(wealthData)
      .map(([date, value]) => ({
        value: typeof value === 'number' ? value : parseFloat(String(value)),
        date
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const calculateMaxPoints = (dataLength: number): number => {
    // Fonction exponentielle décroissante pour calculer le nombre maximum de points
    const baseMax = 250; // Maximum points for a small dataset
    const minMax = 100; // Minimum points for a large dataset
    const decayFactor = 0.0005; // Decay factor

    return Math.max(
      Math.floor(baseMax * Math.exp(-decayFactor * dataLength)),
      minMax
    );
  };

  const reduceDataPoints = (data: DataPoint[]): DataPoint[] => {
    const maxPoints = calculateMaxPoints(data.length);
    if (data.length <= maxPoints) return data;
    const interval = Math.ceil(data.length / maxPoints);
    return data.filter((_, index) => index % interval === 0);
  };

  const data = reduceDataPoints(formatData()); // Prepare the data for the graph

  const minValue = () => {
    console.log("max value ", Math.max(...data.map(point => point.value)));

    const minValue = Math.min(...data.map(point => point.value));
    const valueRange = Math.max(...data.map(point => point.value)) - minValue;
    if (minValue < 0) {
      return minValue;
    }
    return Math.round(minValue - 0.125 * valueRange);
  };

  const calculateSpacing = (width: number, dataLength: number): number => {
    const minSpacing = 0.1;
    const maxSpacing = 100;
    const calculatedSpacing = Math.max(
      minSpacing,
      Math.min(maxSpacing, (width - 30) / (dataLength + 1))
    );
    return calculatedSpacing;
  };

  const [visible, setVisible] = useState(false);
  const openMenu = () => setVisible(true);
  const closeMenu = () => {
    setVisible(false);
  };

  // Update the account item styling
  const AccountItem = ({ account, onPress }: { account: Account; onPress: () => void }) => (
    <Pressable
      style={styles.accountItem}
      onPress={onPress}
    >
      <View style={styles.accountIconContainer}>
        <Image source={getAccountIcon(foundBankNameById(account.bank_id))} style={styles.accountIcon} />
      </View>
      <View style={styles.accountContent}>
        <View style={styles.accountHeader}>
          <Text style={styles.accountName}>{account.name}</Text>
          <Text style={styles.accountType}>{account.type}</Text>
        </View>
        <Text style={styles.accountBalance}>
          {formatNumber(account.balance)} €
        </Text>
      </View>
    </Pressable>
  );

  // Add this helper function
  const getAccountIcon = (bank: string | undefined): any => {
    if (!bank) return require('./../../../assets/images/icon.png');

    switch (bank.toLowerCase()) {
      case 'boursorama':
        return require('./../../../assets/images/boursorama.png');
      case 'crédit agricole':
        return require('./../../../assets/images/credit_agricole.png');
      case 'fortuneo':
        return require('./../../../assets/images/fortuneo.png');
      default:
        return require('./../../../assets/images/icon.png');
    }
  };

  return (
    <View style={[sharedStyles.container]}>
      <View style={sharedStyles.header}>
        <Image
          source={require('./../../../assets/images/logo-removebg-white.png')}
          style={{ width: 30, height: 30 }}
          resizeMode="contain"
        />
        <Text style={sharedStyles.headerTitle}>Accounts</Text>
        <Menu
          visible={visible}
          onDismiss={closeMenu}
          anchor={
            <Pressable style={styles.menuButton} onPress={openMenu}>
              <Ionicons name="ellipsis-vertical" size={24} color={darkTheme.colors.text} />
            </Pressable>
          }
        >
          <Menu.Item onPress={handleLogout} title="Logout" />
        </Menu>
      </View>
      <View style={sharedStyles.body}>
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {/* Total Balance */}
          <View style={styles.totalBalanceContainer}>
            <Text style={styles.totalBalance}>{formatCompactNumber(totalBalance)} €</Text>
            <Text style={styles.totalBalanceLabel}>total balance</Text>
          </View>

          {/* Wealth over time */}
          {isLoading && Object.keys(wealthData).length === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator animating={true} size="large" color={colors.primary} />
            </View>
          )}
          {data.length > 0 && (
            <View style={styles.graphContainer}>
              <LineChart
                areaChart
                data={data}
                width={chartWidth}
                height={100}
                spacing={calculateSpacing(chartWidth, data.length)}
                adjustToWidth={true}
                color={darkTheme.colors.primary}
                startFillColor={`${darkTheme.colors.primary}40`}
                endFillColor={`${darkTheme.colors.primary}10`}
                thickness={1.5}
                startOpacity={0.9}
                endOpacity={0.2}
                initialSpacing={10}
                noOfSections={2}
                yAxisOffset={minValue()}
                yAxisColor="transparent"
                xAxisColor="transparent"
                formatYLabel={(value: string) => formatCompactNumber(Number(value)) + '€'}
                yAxisTextStyle={{ color: darkTheme.colors.textTertiary }}
                hideRules
                hideDataPoints
                showVerticalLines={false}
                yAxisTextNumberOfLines={1}
                yAxisLabelSuffix="€"
                yAxisLabelPrefix=""
                rulesType="solid"
                xAxisThickness={0}
                rulesColor="rgba(0, 0, 0, 0.1)"
                curved
                animateOnDataChange
                animationDuration={1000}
                pointerConfig={{
                  showPointerStrip: true,
                  pointerStripWidth: 2,
                  pointerStripUptoDataPoint: true,
                  pointerStripColor: 'rgba(0, 0, 0, 0.5)',
                  width: 10,
                  height: 10,
                  radius: 6,
                  pointerLabelWidth: 120,
                  pointerLabelHeight: 90,
                  activatePointersOnLongPress: false,
                  autoAdjustPointerLabelPosition: true,
                  pointerLabelComponent: (items: any) => {
                    const item = items[0];
                    return (
                      <View style={styles.tooltipContainer}>
                        <Text style={styles.tooltipValue}>{item.value.toFixed(0)} €</Text>
                        <Text style={styles.tooltipDate}>{new Date(item.date).toDateString()}</Text>
                      </View>
                    );
                  },
                }}
              />
            </View>
          )}


          {/* Filters */}
          <View style={styles.filtersContainer}>
            <FlatList
              data={filters}
              renderItem={renderFilterItem}
              keyExtractor={(item) => item}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={false}
              contentContainerStyle={styles.filtersScrollViewContent}
            />
          </View>

          {/* Grouped Accounts List */}
          {Object.keys(groupedAccounts).length > 0 ? (
            <View>
              {Object.keys(groupedAccounts).map((bank) => (
                <View key={bank} style={styles.bankContainer}>
                  <Text style={styles.bankName}>{bank}</Text>
                  {groupedAccounts[bank].map((account: Account) => (
                    <AccountItem
                      key={account.id}
                      account={account}
                      onPress={() => handleAccountPress(account)}
                    />
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noAccountsText}>No accounts found for this filter.</Text>
          )}
        </ScrollView>
      </View>

      <FAB.Group
        open={fabOpen}
        icon={fabOpen ? 'close' : 'plus'}
        actions={[
          {
            icon: 'account-plus-outline',
            label: 'Add Account',
            onPress: () => navigation.navigate('AddAccount' as never),
          },
          {
            icon: 'plus',
            label: 'Add Transaction',
            onPress: () => navigation.navigate('AddTransaction' as never),
          },
          {
            icon: 'chart-line',
            label: 'Add Investment Transaction',
            onPress: () => navigation.navigate('AddInvestmentTransaction' as never),
          },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
        onPress={() => {
          if (fabOpen) {
            // Optional: Handle FAB press when menu is open
          }
        }}
        fabStyle={styles.fab}
      />

      <LogoutModal />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkTheme.colors.background,
    position: 'relative', // Ensure the container is relative for absolute positioning
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingTop: darkTheme.spacing.xl,
    paddingBottom: darkTheme.spacing.l,
  },
  totalBalanceContainer: {
    marginBottom: darkTheme.spacing.l,
    padding: darkTheme.spacing.l,
    backgroundColor: darkTheme.colors.surface,
    borderRadius: 12,
    marginHorizontal: darkTheme.spacing.m,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    alignItems: 'center',
  },
  totalBalanceLabel: {
    fontSize: 14,
    color: darkTheme.colors.textSecondary,
    marginBottom: darkTheme.spacing.s,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalBalance: {
    fontSize: 42,
    fontWeight: 'bold',
    color: darkTheme.colors.text,
    marginBottom: darkTheme.spacing.xs,
  },
  filtersContainer: {
    backgroundColor: 'transparent',
    marginBottom: darkTheme.spacing.m,
    paddingVertical: darkTheme.spacing.s,
    alignItems: 'center',
  },
  filterButton: {
    paddingVertical: darkTheme.spacing.s,
    paddingHorizontal: darkTheme.spacing.m,
    borderRadius: darkTheme.borderRadius.l,
    backgroundColor: darkTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: darkTheme.spacing.s,
  },
  selectedFilter: {
    backgroundColor: darkTheme.colors.primary,
  },
  filterText: {
    color: darkTheme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  selectedFilterText: {
    color: darkTheme.colors.background,
  },
  bankContainer: {
    backgroundColor: darkTheme.colors.surface,
    marginBottom: darkTheme.spacing.m,
    marginHorizontal: darkTheme.spacing.m,
    borderRadius: darkTheme.borderRadius.l,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  bankName: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: darkTheme.spacing.m,
    color: darkTheme.colors.text,
    backgroundColor: `${darkTheme.colors.primary}10`,
    borderBottomWidth: 1,
    borderBottomColor: darkTheme.colors.border,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: darkTheme.spacing.m,
    backgroundColor: darkTheme.colors.card,
    borderRadius: 10,
    marginVertical: darkTheme.spacing.s,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${darkTheme.colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: darkTheme.spacing.m,
  },
  accountContent: {
    flex: 1,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: darkTheme.spacing.xs,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: darkTheme.colors.text,
  },
  accountType: {
    fontSize: 12,
    color: darkTheme.colors.textSecondary,
    textTransform: 'capitalize',
    backgroundColor: `${darkTheme.colors.primary}20`,
    paddingHorizontal: darkTheme.spacing.s,
    paddingVertical: 2,
    borderRadius: darkTheme.borderRadius.s,
  },
  accountBalance: {
    fontSize: 18,
    fontWeight: 'bold',
    color: darkTheme.colors.primary,
  },
  graphContainer: {
    backgroundColor: darkTheme.colors.surface,
    padding: darkTheme.spacing.m,
    marginHorizontal: darkTheme.spacing.m,
    marginBottom: darkTheme.spacing.l,
    borderRadius: darkTheme.borderRadius.l,
    ...darkTheme.shadows.medium,
  },
  addButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    borderRadius: 30,
    padding: 16,
    backgroundColor: darkTheme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: darkTheme.spacing.l,
    paddingVertical: darkTheme.spacing.m,
    backgroundColor: darkTheme.colors.primary,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: darkTheme.colors.background,
  },
  modalContent: {
    backgroundColor: darkTheme.colors.surface,
    borderRadius: darkTheme.borderRadius.l,
    padding: darkTheme.spacing.l,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: darkTheme.spacing.s,
    color: darkTheme.colors.text,
  },
  modalText: {
    fontSize: 16,
    marginBottom: darkTheme.spacing.l,
    textAlign: 'center',
    color: darkTheme.colors.textSecondary,
  },
  noAccountsText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    color: colors.lightText,
  },
  bottomSheetContent: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 16,
    paddingBottom: 32, // Add extra padding at the bottom
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: colors.text,
  },
  input: {
    width: '100%',
    marginBottom: 16,
    backgroundColor: colors.white,
  },
  submitButton: {
    width: '100%',
    marginTop: 16,
    backgroundColor: colors.primary,
  },
  pickerContainer: {
    width: '100%',
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 12,
    color: colors.lightText,
    marginBottom: 4,
  },
  picker: {
    backgroundColor: colors.white,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.darkGray,
  },
  logoutButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersScrollViewContent: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    marginRight: 16,
  },
  tooltipContainer: {
    backgroundColor: darkTheme.colors.surface,
    padding: darkTheme.spacing.m,
    borderRadius: darkTheme.borderRadius.m,
    borderWidth: 1,
    borderColor: darkTheme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltipValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: darkTheme.colors.primary,
    textAlign: 'center',
  },
  tooltipDate: {
    fontSize: 12,
    color: darkTheme.colors.textSecondary,
    marginTop: darkTheme.spacing.xs,
    textAlign: 'center',
  },
  accountIcon: {
    width: 35,
    height: 35,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: darkTheme.spacing.m,
  },
  modalButton: {
    marginHorizontal: darkTheme.spacing.s,
    minWidth: 100,
  },
  accountItemTouchable: {
    activeOpacity: 0.7,
  },
  fab: {
    backgroundColor: darkTheme.colors.primary,
    // You can customize the FAB style further if needed
  },
});
