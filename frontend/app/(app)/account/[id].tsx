import { fetchAccounts } from '@/actions/accountActions';
import { deleteAccount, getAccountBalance } from '@/app/api/bankApi';
import { BackButton } from '@/app/components/BackButton';
import TransactionList from '@/app/components/TransactionList'; // import the TransactionList component
import { darkTheme } from '@/constants/theme';
import { sharedStyles } from '@/styles/sharedStyles';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { ActivityIndicator, Menu } from 'react-native-paper';
import { useDispatch } from 'react-redux';

export default function TransactionsScreen() {
  const dispatch = useDispatch();
  const params = useLocalSearchParams();
  const router = useRouter();
  const account = params.account ? JSON.parse(params.account as string) : undefined;
  const [visible, setVisible] = useState(false);
  const [balanceData, setBalanceData] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [chartWidth, setChartWidth] = useState(Dimensions.get('window').width - 40);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const handleEditAccount = () => {
    router.push({
      pathname: '/add-account',
      params: { account: JSON.stringify(account) }
    });
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
                router.back();
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

  useEffect(() => {
    const fetchBalanceData = async () => {
      try {
        setIsLoading(true);
        const response = await getAccountBalance(account.id);
        if (response) {
          setBalanceData(response);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching account balance data:', error);
        setIsLoading(false);
      }
    };

    fetchBalanceData();

    const handleResize = () => {
      setChartWidth(Dimensions.get('window').width - 40);
    };

    const subscription = Dimensions.addEventListener('change', handleResize);
    return () => {
      subscription?.remove();
    };
  }, [account.id]);

  const formatCompactNumber = (number: number) => {
    if (number >= 1_000_000) {
      return (number / 1_000_000).toFixed(2) + 'M';
    } else if (number >= 1_000) {
      return (number / 1_000).toFixed(2) + 'k';
    }
    return number.toFixed(2);
  };

  const formatData = () => {
    return Object.entries(balanceData)
      .map(([date, value]) => ({
        value: typeof value === 'number' ? value : parseFloat(String(value)),
        date
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const calculateSpacing = (width: number, dataLength: number): number => {
    const minSpacing = 0.1;
    const maxSpacing = 100;
    return Math.max(
      minSpacing,
      Math.min(maxSpacing, (width - 30) / (dataLength + 1))
    );
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

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator animating={true} size="large" color={darkTheme.colors.primary} />
          </View>
        ) : (
          <View style={styles.graphContainer}>
            <LineChart
              areaChart
              data={formatData()}
              width={chartWidth}
              height={100}
              spacing={calculateSpacing(chartWidth, Object.keys(balanceData).length)}
              adjustToWidth={true}
              color={darkTheme.colors.primary}
              startFillColor={`${darkTheme.colors.primary}40`}
              endFillColor={`${darkTheme.colors.primary}10`}
              thickness={1.5}
              startOpacity={0.9}
              endOpacity={0.2}
              initialSpacing={10}
              noOfSections={2}
              yAxisColor="transparent"
              xAxisColor="transparent"
              formatYLabel={(value) => formatCompactNumber(Number(value)) + '€'}
              yAxisTextStyle={{ color: darkTheme.colors.textTertiary }}
              hideRules
              hideDataPoints
              showVerticalLines={false}
              yAxisTextNumberOfLines={1}
              yAxisLabelSuffix="€"
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
  graphContainer: {
    backgroundColor: darkTheme.colors.surface,
    padding: darkTheme.spacing.m,
    marginVertical: darkTheme.spacing.m,
    borderRadius: darkTheme.borderRadius.l,
    ...darkTheme.shadows.medium,
  },
  loadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
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
});
