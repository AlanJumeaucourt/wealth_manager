import { useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useState, useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { VictoryAxis, VictoryChart, VictoryLine, VictoryScatter, VictoryTheme } from 'victory-native';
import Ionicons from '@expo/vector-icons/Ionicons'
import { Button } from 'react-native-paper';
import { LineChart } from 'react-native-gifted-charts';
import { Dimensions } from 'react-native';

import { darkTheme } from '@/constants/theme';
import sharedStyles from './styles/sharedStyles';
import { Menu } from 'react-native-paper';
import AddInvestmentTransactionScreen from './AddInvestmentTransactionScreen';
import InvestmentTransactionListScreen from './InvestmentTransactionListScreen';
import { getPortfolioSummary, getPortfolioPerformance, getAssetTransactions, getStockPrices } from './api/bankApi';
import { 
    InvestmentStackParamList,
    StockDetailProps,
    StockPositionItemProps,
    PortfolioPosition,
    PerformanceData,
    AssetTransactions
} from '@/types/investment';
import { StackNavigationProp } from '@react-navigation/stack';
import { InvestmentSkeleton } from './components/InvestmentSkeleton';

type InvestmentScreenNavigationProp = StackNavigationProp<InvestmentStackParamList>;

// Types
type Asset = {
  name: string;
  value: number;
  allocation: number;
  performance: number;
};

type HistoricalData = {
  date: string;
  value: number;
};

type StockPosition = {
  symbol: string;
  name: string;
  purchases: {
    date: string;
    quantity: number;
    price: number;
  }[];
  sells: {
    date: string;
    quantity: number;
    price: number;
  }[];
  currentPrice: number;
};

type StockHistoricalData = {
  date: string;
  price: number;
};

// Mock data
const investmentAssets: Asset[] = [
  { name: 'Actions', value: 50000, allocation: 50, performance: 8.5 },
  { name: 'Obligations', value: 30000, allocation: 30, performance: 3.2 },
  { name: 'Immobilier', value: 15000, allocation: 15, performance: 5.7 },
  { name: 'Liquidités', value: 5000, allocation: 5, performance: 0.5 },
];

const historicalPerformance: HistoricalData[] = [
  { date: '2023-01', value: 95000 },
  { date: '2023-02', value: 97000 },
  { date: '2023-03', value: 98500 },
  { date: '2023-04', value: 101000 },
  { date: '2023-05', value: 100000 },
];

const stockPositions: StockPosition[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    purchases: [
      { date: '2022-01-15', quantity: 10, price: 150 },
      { date: '2022-06-30', quantity: 5, price: 140 },
      { date: '2023-02-10', quantity: 8, price: 160 },
    ],
    sells: [
      { date: '2022-01-16', quantity: 10, price: 152 },
    ],
    currentPrice: 175,
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    purchases: [
      { date: '2022-03-20', quantity: 5, price: 2500 },
      { date: '2022-09-05', quantity: 3, price: 2400 },
    ],
    sells: [
      { date: '2022-03-22', quantity: 5, price: 2520 },
    ],
    currentPrice: 2700,
  },
  // Ajoutez d'autres positions si nécessaire
];

// Add mock historical data for stocks
const stockHistoricalData: { [key: string]: StockHistoricalData[] } = {
  AAPL: [
    { date: '2022-01-01', price: 140 },
    { date: '2022-04-01', price: 155 },
    { date: '2022-07-01', price: 145 },
    { date: '2022-10-01', price: 160 },
    { date: '2023-01-01', price: 170 },
    { date: '2023-04-01', price: 175 },
  ],
  GOOGL: [
    { date: '2022-01-01', price: 2400 },
    { date: '2022-04-01', price: 2500 },
    { date: '2022-07-01', price: 2300 },
    { date: '2022-10-01', price: 2600 },
    { date: '2023-01-01', price: 2650 },
    { date: '2023-04-01', price: 2700 },
  ],
};

const Stack = createStackNavigator();

const StockDetail: React.FC<StockDetailProps> = ({ route }) => {
    const { symbol, name } = route.params;
    const [transactions, setTransactions] = useState<AssetTransactions | null>(null);
    const [historicalPrices, setHistoricalPrices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartWidth, setChartWidth] = useState(Dimensions.get('window').width - 40);

    useEffect(() => {
        const handleResize = () => {
            setChartWidth(Dimensions.get('window').width - 40);
        };

        const subscription = Dimensions.addEventListener('change', handleResize);

        return () => {
            subscription?.remove();
        };
    }, []);

    const calculateSpacing = (width: number, dataLength: number): number => {
        const minSpacing = 1;
        const maxSpacing = 10;
        const calculatedSpacing = Math.max(minSpacing, Math.min(maxSpacing, (width - 60) / (dataLength + 1)));
        return calculatedSpacing;
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [transactionsData, pricesData] = await Promise.all([
                    getAssetTransactions(symbol),
                    getStockPrices(symbol, '1Y')
                ]);
                
                setTransactions(transactionsData);
                setHistoricalPrices(pricesData.prices || []);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [symbol]);

    if (loading || !transactions) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={darkTheme.colors.primary} />
            </View>
        );
    }

    // Format data for the chart
    const formatChartData = () => {
        // First, create the price line data
        const priceData = historicalPrices.map(point => ({
            value: point.close,
            date: point.date,
            dataPointText: '',
            showDataPoint: false
        }));

        // Add buy points
        const buyPoints = transactions?.buys.map(buy => ({
            value: buy.price,
            date: buy.date,
            dataPointText: `↑\n${buy.quantity}`,
            showDataPoint: true,
            dataPointColor: darkTheme.colors.success,
            customDataPoint: () => (
                <View style={[styles.transactionPoint, { backgroundColor: darkTheme.colors.success }]}>
                    <Text style={styles.transactionPointText}>B</Text>
                </View>
            )
        })) || [];

        // Add sell points
        const sellPoints = transactions?.sells.map(sell => ({
            value: sell.price,
            date: sell.date,
            dataPointText: `↓\n${sell.quantity}`,
            showDataPoint: true,
            dataPointColor: darkTheme.colors.error,
            customDataPoint: () => (
                <View style={[styles.transactionPoint, { backgroundColor: darkTheme.colors.error }]}>
                    <Text style={styles.transactionPointText}>S</Text>
                </View>
            )
        })) || [];

        // Combine all data points and sort by date
        return [...priceData, ...buyPoints, ...sellPoints]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    const chartData = formatChartData();

    const formatDateLabels = (data: any[]) => {
        if (data.length <= 8) return data;
        const step = Math.floor(data.length / 8);
        return data.map((item, index) => ({
            ...item,
            showLabel: index % step === 0 && index < data.length - step/2
        }));
    };

    const minValue = (data: any[]) => {
        return Math.min(...data.map(item => item.value)) - 0.2 * Math.min(...data.map(item => item.value));
    };

    return (
        <View style={[sharedStyles.container]}>
            <View style={sharedStyles.header}>
                <Image
                    source={require('./../assets/images/logo-removebg-white.png')}
                    style={{ width: 30, height: 30 }}
                    resizeMode="contain"
                />
                <View style={sharedStyles.headerTitleContainer}>
                    <Text style={sharedStyles.headerTitle}>{name} ({symbol})</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>

                
                {chartData.length > 0 ? (
                    <View style={styles.chartContainer}>
                        <LineChart
                            areaChart
                            data={formatDateLabels(chartData)}
                            width={chartWidth}
                            height={200}
                            spacing={calculateSpacing(chartWidth, chartData.length)}
                            color={darkTheme.colors.primary}
                            startFillColor={`${darkTheme.colors.primary}40`}
                            endFillColor={`${darkTheme.colors.primary}10`}
                            thickness={1.4}
                            startOpacity={0.9}
                            endOpacity={0.2}
                            initialSpacing={0}
                            noOfSections={4}
                            yAxisColor="transparent"
                            xAxisColor="transparent"
                            yAxisTextStyle={{ color: darkTheme.colors.textTertiary }}
                            hideRules
                            showVerticalLines={false}
                            xAxisLabelTextStyle={{ 
                                color: darkTheme.colors.textTertiary, 
                                fontSize: 10,
                                width: 60,
                                textAlign: 'center'
                            }}
                            yAxisTextNumberOfLines={1}
                            yAxisLabelSuffix="€"
                            yAxisLabelPrefix=""
                            rulesType="solid"
                            xAxisThickness={0}
                            rulesColor="rgba(0, 0, 0, 0.1)"
                            curved
                            animateOnDataChange
                            yAxisOffset={minValue(chartData)}
                            animationDuration={1000}
                            xAxisLabelsVerticalShift={20}
                            getLabel={(item) => item.showLabel ? new Date(item.date).toLocaleDateString('fr-FR', {
                                month: 'short',
                                year: '2-digit'
                            }) : ''}
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
                                            <Text style={styles.tooltipValue}>
                                                {item.value.toLocaleString()} €
                                            </Text>
                                            <Text style={styles.tooltipDate}>
                                                {new Date(item.date).toLocaleDateString()}
                                            </Text>
                                        </View>
                                    );
                                },
                            }}
                        />
                    </View>
                ) : (
                    <View style={styles.noDataContainer}>
                        <Text style={styles.noDataText}>No price data available</Text>
                    </View>
                )}

                <View style={styles.legendContainer}>
                    <Text style={styles.legendText}>
                        <View style={[styles.legendDot, { backgroundColor: "#c43a31" }]} /> Stock Price
                    </Text>
                    <Text style={styles.legendText}>
                        <View style={[styles.legendDot, { backgroundColor: "green" }]} /> Purchase Points
                    </Text>
                    <Text style={styles.legendText}>
                        <View style={[styles.legendDot, { backgroundColor: "red" }]} /> Sell Points
                    </Text>
                </View>
                <View style={styles.transactionList}>
                    <Text style={styles.transactionTitle}>Transactions</Text>
                    {[...transactions.buys, ...transactions.sells]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((transaction, index, array) => {
                            const isBuy = transactions.buys.includes(transaction);
                            return (
                                <View key={`transaction-${index}`}>
                                    <View style={styles.transactionItem}>
                                        <View style={styles.transactionIconContainer}>
                                            <View style={[styles.transactionIcon, isBuy ? styles.buyIcon : styles.sellIcon]}>
                                                <Ionicons 
                                                    name={isBuy ? "arrow-down" : "arrow-up"} 
                                                    size={14} 
                                                    color={darkTheme.colors.surface} 
                                                />
                                            </View>
                                        </View>
                                        <View style={styles.transactionContent}>
                                            <View style={styles.transactionRow}>
                                                <Text style={styles.transactionQuantity}>
                                                    {isBuy ? '+' : '-'}{transaction.quantity} shares
                                                </Text>
                                                <Text style={styles.transactionPrice}>
                                                    {transaction.price.toLocaleString()}€
                                                </Text>
                                            </View>
                                            <View style={styles.transactionDetails}>
                                                <Text style={styles.transactionDate}>
                                                    {new Date(transaction.date).toLocaleDateString(undefined, { 
                                                        month: 'short', 
                                                        day: '2-digit',
                                                        year: 'numeric'
                                                    })}
                                                </Text>
                                                <Text style={styles.transactionAccount}>
                                                    {transaction.account_name}
                                                </Text>
                                            </View>
                                            <View style={styles.transactionFooter}>
                                                <Text style={styles.transactionFee}>
                                                    Fee: {transaction.fee.toLocaleString()}€
                                                </Text>
                                                <Text style={styles.transactionTotal}>
                                                    Total: {((transaction.quantity * transaction.price) + (isBuy ? 1 : -1) * transaction.fee).toLocaleString()}€
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    {index < array.length - 1 && <View style={styles.transactionSeparator} />}
                                </View>
                            );
                    })}
                </View>
            </ScrollView>
        </View>
    );
};

const StockPositionItem: React.FC<StockPositionItemProps> = ({ position, onPress }) => {
    return (
        <Pressable onPress={onPress} style={styles.stockPositionItem}>
            <Text style={styles.stockSymbol}>{position.asset_symbol}</Text>
            <Text style={styles.stockName}>{position.asset_name}</Text>
            <Text style={styles.stockDetails}>
                Quantity: {position.total_quantity.toLocaleString()}
            </Text>
            <Text style={styles.stockDetails}>
                Average Price: {position.average_price.toLocaleString()} €
            </Text>
            <Text style={styles.stockDetails}>
                Current Price: {position.current_price.toLocaleString()} €
            </Text>
            <Text style={[
                styles.stockPerformance, 
                position.performance >= 0 ? styles.positivePerformance : styles.negativePerformance
            ]}>
                Performance: {position.performance.toFixed(2)}%
            </Text>
            <View style={styles.valueContainer}>
                <Text style={styles.stockValue}>
                    Total Value: {position.total_value.toLocaleString()} €
                </Text>
                <Text style={[
                    styles.gainLoss,
                    position.unrealized_gain >= 0 ? styles.positivePerformance : styles.negativePerformance
                ]}>
                    {position.unrealized_gain >= 0 ? '+' : ''}{position.unrealized_gain.toLocaleString()} €
                </Text>
            </View>
        </Pressable>
    );
};

const InvestmentOverview: React.FC = () => {
    const navigation = useNavigation<InvestmentScreenNavigationProp>();
    const [selectedPeriod, setSelectedPeriod] = useState('1Y');
    const [positions, setPositions] = useState<PortfolioPosition[]>([]);
    const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [visible, setVisible] = useState(false);
    const [totalValue, setTotalValue] = useState(0);
    const [totalGain, setTotalGain] = useState(0);
    const [totalPerformance, setTotalPerformance] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [chartWidth, setChartWidth] = useState(Dimensions.get('window').width - 40);

    // Add resize handler
    useEffect(() => {
        const handleResize = () => {
            setChartWidth(Dimensions.get('window').width - 40);
        };

        const subscription = Dimensions.addEventListener('change', handleResize);

        return () => {
            subscription?.remove();
        };
    }, []);

    // Add spacing calculation
    const calculateSpacing = (width: number, dataLength: number): number => {
        const minSpacing = 1;
        const maxSpacing = 10;
        const calculatedSpacing = Math.max(minSpacing, Math.min(maxSpacing, (width - 60) / (dataLength + 1)));
        return calculatedSpacing;
    };

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [summaryResponse, performanceResponse] = await Promise.all([
                getPortfolioSummary(),
                getPortfolioPerformance(selectedPeriod)
            ]);

            if (!summaryResponse || !summaryResponse.positions) {
                throw new Error('Invalid response from server');
            }

            setPositions(summaryResponse.positions);
            setPerformanceData(performanceResponse?.performance_data || []);

            // Update total values with safe defaults
            setTotalValue(summaryResponse.total_value || 0);
            setTotalGain(summaryResponse.total_gain || 0);
            if (summaryResponse.total_invested && summaryResponse.total_invested !== 0) {
                setTotalPerformance((summaryResponse.total_gain / Math.abs(summaryResponse.total_invested)) * 100);
            } else {
                setTotalPerformance(0);
            }

        } catch (error) {
            console.error('Error fetching investment data:', error);
            setError('Failed to load investment data');
            setPositions([]);
            setPerformanceData([]);
            setTotalValue(0);
            setTotalGain(0);
            setTotalPerformance(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedPeriod]);

    if (loading) {
        return <InvestmentSkeleton />;
    }

    if (error) {
        return (
            <View style={[sharedStyles.container, styles.centerContainer]}>
                <Text style={styles.errorText}>{error}</Text>
                <Button mode="contained" onPress={fetchData} style={styles.retryButton}>
                    Retry
                </Button>
            </View>
        );
    }

    const openMenu = () => setVisible(true);
    const closeMenu = () => setVisible(false);

    const formatDateLabels = (data: PerformanceData[]) => {
        if (data.length <= 8) return data;

        // Calculate step size to get approximately 8 points
        const step = Math.floor(data.length / 8);
        
        // Mark points for label display
        return data.map((item, index) => ({
            ...item,
            showLabel: index % step === 0 && index < data.length - step/2 // Avoid label at the very end
        }));
    };

    return (
        <View style={[sharedStyles.container]}>
            <View style={sharedStyles.header}>
                <Image
                    source={require('./../assets/images/logo-removebg-white.png')}
                    style={{ width: 30, height: 30 }}
                    resizeMode="contain"
                />
                <Text style={sharedStyles.headerTitle}>Investissements</Text>
                <Menu
                    visible={visible}
                    onDismiss={closeMenu}
                    anchor={
                        <Pressable style={styles.menuButton} onPress={openMenu}>
                            <Ionicons name="ellipsis-vertical" size={24} color={darkTheme.colors.text} />
                        </Pressable>
                    }
                >
                    <Menu.Item onPress={() => navigation.navigate('AddInvestmentTransaction')} title="Add investment transaction" />
                    <Menu.Item onPress={() => navigation.navigate('InvestmentTransactionList')} title="Show list investments" />
                </Menu>
            </View>
            <View style={sharedStyles.body}>
                <ScrollView style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Investissements</Text>
                        <Text style={styles.totalValue}>
                            {totalValue.toLocaleString()} €
                        </Text>
                        <Text style={[
                            styles.totalGain,
                            totalGain >= 0 ? styles.positivePerformance : styles.negativePerformance
                        ]}>
                            {totalGain >= 0 ? '+' : ''}{totalGain.toLocaleString()} € 
                            ({totalPerformance.toFixed(2)}%)
                        </Text>
                    </View>

                    <View style={styles.periodSelector}>
                        {['1M', '3M', '6M', '1A', 'Max'].map((period) => (
                            <Pressable
                                key={period}
                                style={[styles.periodButton, selectedPeriod === period && styles.selectedPeriod]}
                                onPress={() => setSelectedPeriod(period)}
                            >
                                <Text style={[styles.periodButtonText, selectedPeriod === period && styles.selectedPeriodText]}>
                                    {period}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {performanceData.length > 0 ? (
                        <View style={styles.chartContainer}>
                            <LineChart
                                areaChart
                                data={formatDateLabels(performanceData).map(item => ({
                                    value: item.cumulative_value,
                                    date: item.date,
                                    showLabel: item.showLabel
                                }))}
                                width={chartWidth}
                                height={200}
                                spacing={calculateSpacing(chartWidth, performanceData.length)}
                                adjustToWidth={true}
                                color={darkTheme.colors.primary}
                                startFillColor={`${darkTheme.colors.primary}40`}
                                endFillColor={`${darkTheme.colors.primary}10`}
                                thickness={1.5}
                                startOpacity={0.9}
                                endOpacity={0.2}
                                initialSpacing={0}
                                noOfSections={4}
                                maxVisiblePoints={8} // Add this line
                                yAxisColor="transparent"
                                xAxisColor="transparent"
                                yAxisTextStyle={{ color: darkTheme.colors.textTertiary }}
                                hideRules
                                hideDataPoints
                                showVerticalLines={false}
                                xAxisLabelTextStyle={{ 
                                    color: darkTheme.colors.textTertiary, 
                                    fontSize: 10,
                                    width: 60, // Add fixed width for labels
                                    textAlign: 'center'
                                }}
                                yAxisTextNumberOfLines={1}
                                yAxisLabelSuffix="€"
                                yAxisLabelPrefix=""
                                rulesType="solid"
                                xAxisThickness={0}
                                rulesColor="rgba(0, 0, 0, 0.1)"
                                curved
                                animateOnDataChange
                                animationDuration={1000}
                                xAxisLabelsVerticalShift={20}
                                getLabel={(item) => item.showLabel ? new Date(item.date).toLocaleDateString('fr-FR', {
                                    month: 'short',
                                    year: '2-digit'
                                }) : ''}
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
                                                <Text style={styles.tooltipValue}>
                                                    {item.value.toLocaleString()} €
                                                </Text>
                                                <Text style={styles.tooltipDate}>
                                                    {new Date(item.date).toLocaleDateString()}
                                                </Text>
                                            </View>
                                        );
                                    },
                                }}
                            />
                        </View>
                    ) : (
                        <View style={styles.noDataContainer}>
                            <Text style={styles.noDataText}>No performance data available</Text>
                        </View>
                    )}

                    <View style={styles.assetList}>
                        <Text style={styles.assetListTitle}>Répartition des actifs</Text>
                        {investmentAssets.map((asset, index) => (
                            <View key={index} style={styles.assetItem}>
                                <View style={styles.assetInfo}>
                                    <Text style={styles.assetName}>{asset.name}</Text>
                                    <Text style={styles.assetAllocation}>{asset.allocation}%</Text>
                                </View>
                                <View style={styles.assetInfo}>
                                    <Text style={styles.assetValue}>{asset.value.toLocaleString()} €</Text>
                                    <Text style={[styles.assetPerformance, asset.performance >= 0 ? styles.positivePerformance : styles.negativePerformance]}>
                                        {asset.performance >= 0 ? '+' : ''}{asset.performance.toFixed(2)}%
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <View style={styles.stockPositionsContainer}>
                        <Text style={styles.sectionTitle}>Portfolio Positions</Text>
                        {positions.length > 0 ? (
                            positions.map((position, index) => (
                                <StockPositionItem
                                    key={index}
                                    position={position}
                                    onPress={() => navigation.navigate('StockDetail', { 
                                        symbol: position.asset_symbol,
                                        name: position.asset_name 
                                    })}
                                />
                            ))
                        ) : (
                            <View style={styles.noDataContainer}>
                                <Text style={styles.noDataText}>No positions available</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
};

export default function InvestmentScreen() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen
                name="InvestmentOverview"
                component={InvestmentOverview}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="StockDetail"
                component={StockDetail}
                options={({ route }) => ({ title: route.params.symbol })}
            />
            <Stack.Screen
                name="InvestmentTransactionList"
                component={InvestmentTransactionListScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="AddInvestmentTransaction"
                component={AddInvestmentTransactionScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: darkTheme.colors.background,
    },
    container: {
        flex: 1,
    },
    header: {
        padding: darkTheme.spacing.l,
        backgroundColor: darkTheme.colors.surface,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: darkTheme.spacing.m,
        color: darkTheme.colors.text,
    },
    totalValue: {
        fontSize: 36,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
    },
    performanceText: {
        fontSize: 16,
        color: darkTheme.colors.textSecondary,
    },
    chartContainer: {
        backgroundColor: darkTheme.colors.surface,
        padding: darkTheme.spacing.m,
        marginHorizontal: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.l,
        borderRadius: darkTheme.borderRadius.l,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    periodSelector: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: darkTheme.colors.surface,
        padding: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.l,
    },
    periodButton: {
        paddingVertical: darkTheme.spacing.s,
        paddingHorizontal: darkTheme.spacing.m,
        borderRadius: darkTheme.borderRadius.l,
    },
    selectedPeriod: {
        backgroundColor: darkTheme.colors.primary,
    },
    periodButtonText: {
        color: darkTheme.colors.textSecondary,
    },
    selectedPeriodText: {
        color: darkTheme.colors.surface,
    },
    assetList: {
        backgroundColor: darkTheme.colors.surface,
        padding: darkTheme.spacing.l,
    },
    assetListTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: darkTheme.spacing.m,
        color: darkTheme.colors.text,
    },
    assetItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: darkTheme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: darkTheme.colors.border,
    },
    assetInfo: {
        flexDirection: 'column',
    },
    assetName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
    },
    assetAllocation: {
        fontSize: 14,
        color: darkTheme.colors.textSecondary,
    },
    assetValue: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'right',
        color: darkTheme.colors.text,
    },
    assetPerformance: {
        fontSize: 14,
        textAlign: 'right',
    },
    positivePerformance: {
        color: darkTheme.colors.success,
    },
    negativePerformance: {
        color: darkTheme.colors.error,
    },
    stockPositionsContainer: {
        backgroundColor: darkTheme.colors.surface,
        padding: darkTheme.spacing.l,
        marginTop: darkTheme.spacing.l,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: darkTheme.spacing.m,
        color: darkTheme.colors.text,
    },
    stockPositionItem: {
        borderBottomWidth: 1,
        borderBottomColor: darkTheme.colors.border,
        paddingVertical: darkTheme.spacing.m,
    },
    stockSymbol: {
        fontSize: 18,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
    },
    stockName: {
        fontSize: 16,
        color: darkTheme.colors.textSecondary,
        marginBottom: darkTheme.spacing.s,
    },
    stockDetails: {
        fontSize: 14,
        marginBottom: 2,
        color: darkTheme.colors.text,
    },
    stockPerformance: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: darkTheme.spacing.s,
    },
    stockValue: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: darkTheme.spacing.s,
        color: darkTheme.colors.text,
    },
    modalContent: {
        padding: darkTheme.spacing.l,
        backgroundColor: darkTheme.colors.surface,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: darkTheme.spacing.l,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: darkTheme.spacing.m,
    },
    legendText: {
        flexDirection: 'row',
        alignItems: 'center',
        color: darkTheme.colors.text,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: darkTheme.spacing.s,
    },
    transactionList: {
        marginTop: darkTheme.spacing.l,
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.m,
        paddingVertical: darkTheme.spacing.s,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    transactionTitle: {
        fontSize: 16,
        fontWeight: '600',
        paddingHorizontal: darkTheme.spacing.m,
        paddingTop: darkTheme.spacing.m,
        paddingBottom: darkTheme.spacing.s,
        color: darkTheme.colors.textSecondary,
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: darkTheme.spacing.m,
        paddingVertical: darkTheme.spacing.m, // Increased padding
        backgroundColor: darkTheme.colors.surface,
    },
    transactionIconContainer: {
        marginRight: darkTheme.spacing.m,
    },
    transactionIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buyIcon: {
        backgroundColor: darkTheme.colors.success,
    },
    sellIcon: {
        backgroundColor: darkTheme.colors.error,
    },
    transactionContent: {
        flex: 1,
    },
    transactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    transactionQuantity: {
        fontSize: 15,
        fontWeight: '500',
        color: darkTheme.colors.text,
    },
    transactionPrice: {
        fontSize: 15,
        fontWeight: '600',
        color: darkTheme.colors.text,
    },
    transactionDate: {
        fontSize: 13,
        color: darkTheme.colors.textTertiary,
        marginTop: 2,
    },
    menuButton: {
        marginRight: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noDataContainer: {
        padding: darkTheme.spacing.l,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noDataText: {
        color: darkTheme.colors.textSecondary,
        fontSize: 16,
    },
    valueContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: darkTheme.spacing.s,
    },
    gainLoss: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    totalGain: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: darkTheme.spacing.xs,
    },
    centerContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: darkTheme.colors.error,
        fontSize: 16,
        marginBottom: darkTheme.spacing.m,
    },
    retryButton: {
        marginTop: darkTheme.spacing.m,
    },
    tooltipContainer: {
        backgroundColor: darkTheme.colors.surface,
        padding: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: darkTheme.colors.primary,
    },
    tooltipValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: darkTheme.colors.primary,
        textAlign: 'center',
    },
    tooltipDate: {
        fontSize: 12,
        color: darkTheme.colors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    transactionPoint: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: darkTheme.colors.surface,
    },
    transactionPointText: {
        color: darkTheme.colors.surface,
        fontSize: 12,
        fontWeight: 'bold',
    },
    transactionDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 2,
    },
    transactionAccount: {
        fontSize: 13,
        color: darkTheme.colors.primary,
        fontWeight: '500',
    },
    transactionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
        paddingTop: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: darkTheme.colors.border,
    },
    transactionFee: {
        fontSize: 13,
        color: darkTheme.colors.textTertiary,
    },
    transactionTotal: {
        fontSize: 13,
        fontWeight: '600',
        color: darkTheme.colors.text,
    },
    transactionSeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: darkTheme.colors.border,
        marginHorizontal: darkTheme.spacing.m,
    },
});
