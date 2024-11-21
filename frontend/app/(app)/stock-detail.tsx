import { getAssetTransactions, getStockInfo, getStockPrices } from "@/app/api/bankApi";
import { darkTheme } from "@/constants/theme";
import { sharedStyles } from "@/styles/sharedStyles";
import { AssetTransaction, AssetTransactions } from "@/types/investment";
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LineChart } from 'react-native-gifted-charts';
import { ActivityIndicator } from "react-native-paper";
import { BackButton } from "../components/BackButton";

// Add type for chart data point
type ChartDataPoint = {
    date: string;
    close: number;
    value?: number;
    showLabel?: boolean;
};

// Add new type for stock info
type StockInfo = {
    info: {
        currency: string;
        dayHigh: number;
        dayLow: number;
        fiftyDayAverage: number;
        fiftyTwoWeekHigh: number;
        fiftyTwoWeekLow: number;
        regularMarketVolume: number;
        totalAssets: number;
        ytdReturn: number;
        beta3Year?: number;
    };
    fund_sector_weightings?: {
        [key: string]: number;
    };
};

const TransactionCard = ({ transaction, isBuy, onPress }: {
    transaction: AssetTransaction;
    isBuy: boolean;
    onPress?: () => void;
}) => {
    const total = (transaction.quantity * transaction.price) + (isBuy ? 1 : -1) * transaction.fee;

    return (
        <Pressable
            style={styles.transactionCard}
            onPress={onPress}
            android_ripple={{ color: `${darkTheme.colors.primary}20` }}
        >
            <View style={styles.transactionHeader}>
                <View style={styles.transactionTypeContainer}>
                    <View style={[
                        styles.transactionTypeTag,
                        isBuy ? styles.buyIcon : styles.sellIcon
                    ]}>
                        <Ionicons
                            name={isBuy ? "arrow-down" : "arrow-up"}
                            size={14}
                            color={darkTheme.colors.surface}
                        />
                    </View>
                    <View style={styles.transactionInfo}>
                        <View style={styles.transactionMainInfo}>
                            <Text style={[
                                styles.transactionType,
                                isBuy ? styles.buyText : styles.sellText
                            ]}>
                                {transaction.quantity.toLocaleString()} shares
                            </Text>
                            <Text style={styles.priceText}>
                                @ {transaction.price.toLocaleString()}€
                            </Text>
                        </View>
                        <Text style={styles.transactionDateText}>
                            {new Date(transaction.date).toLocaleDateString(undefined, {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                            })}
                        </Text>
                    </View>
                </View>
                <View style={styles.transactionTotalContainer}>
                    <Text style={styles.feeText}>Fee: {transaction.fee.toLocaleString()}€</Text>
                    <Text style={styles.totalValueText}>
                        {isBuy ? '-' : '+'}{total.toLocaleString()}€
                    </Text>
                </View>
            </View>
        </Pressable>
    );
};

export const StockDetails: React.FC = () => {
    const { symbol, name } = useLocalSearchParams<{ symbol: string; name: string }>();
    const [transactions, setTransactions] = useState<AssetTransactions | null>(null);
    const [historicalPrices, setHistoricalPrices] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartWidth, setChartWidth] = useState(Dimensions.get('window').width - 40);
    const router = useRouter();
    const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
    const [stockName, setStockName] = useState(name);

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
        const minSpacing = 0.1;
        const maxSpacing = 100;
        const calculatedSpacing = Math.max(minSpacing, Math.min(maxSpacing, (width - 80) / (dataLength + 1)));
        return calculatedSpacing;
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [transactionsData, pricesData, stockInfoData] = await Promise.all([
                    getAssetTransactions(symbol),
                    getStockPrices(symbol, 'max'),
                    getStockInfo(symbol)
                ]);

                if (stockInfoData?.info?.longName) {
                    setStockName(stockInfoData.info.longName);
                }
                console.log(pricesData);

                if (transactionsData && 'buys' in transactionsData && Array.isArray(transactionsData.buys)) {
                    const firstBuyDate = transactionsData.buys.reduce((minDate: string, current: AssetTransaction) =>
                        current.date < minDate ? current.date : minDate,
                        transactionsData.buys[0]?.date
                    );
                    if (pricesData && pricesData) {
                        const filteredPrices = pricesData.filter((price: { date: string }) =>
                            price.date >= firstBuyDate
                        );
                        setHistoricalPrices(filteredPrices || []);
                    }
                    setTransactions(transactionsData);

                } else {
                    setTransactions(null);
                    setHistoricalPrices([]);
                }

                setStockInfo(stockInfoData);
            } catch (error) {
                console.error('Error fetching data:', error);
                setTransactions(null);
                setHistoricalPrices([]);
                setStockInfo(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [symbol]);

    const handleTransactionPress = (transaction: AssetTransaction, isBuy: boolean) => {
        router.push({
            pathname: '/add-investment-transaction',
            params: {
                transaction: JSON.stringify({
                    id: transaction.id,
                    account_id: transaction.account_id,
                    account_name: transaction.account_name,
                    asset_symbol: symbol,
                    asset_name: name,
                    activity_type: isBuy ? 'buy' : 'sell',
                    date: transaction.date,
                    quantity: transaction.quantity,
                    unit_price: transaction.price,
                    fee: transaction.fee,
                    tax: transaction.tax
                })
            }
        });
    };

    if (loading || !transactions) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={darkTheme.colors.primary} />
            </View>
        );
    }

    // Format data for the chart
    const formatChartData = () => {
        if (!transactions) return { mainData: [], secondaryData: [] };

        // Create the price line data (main data)
        const mainData = historicalPrices.map(point => ({
            value: point.close,
            date: point.date,
            showLabel: false
        }));

        // Create a map of all dates from mainData
        const allDates = new Map(mainData.map(point => [point.date, true]));

        // Create transaction points data
        const transactionPoints = new Map();

        // Add buy points
        transactions.buys?.forEach(buy => {
            transactionPoints.set(buy.date, {
                value: buy.price,
                date: buy.date,
                showDataPoint: true,
                dataPointColor: darkTheme.colors.success,
            });
        });

        // Add sell points
        transactions.sells?.forEach(sell => {
            transactionPoints.set(sell.date, {
                value: sell.price,
                date: sell.date,
                showDataPoint: true,
                dataPointColor: darkTheme.colors.error,
                dataPointShape: 'custom',
                customDataPoint: () => (
                    <View style={[styles.transactionPoint, { backgroundColor: darkTheme.colors.error }]}>
                    </View>
                )
            });
        });

        // Create secondary data with all dates
        const secondaryData = mainData.map(point => {
            const transactionPoint = transactionPoints.get(point.date);
            if (transactionPoint) {
                return transactionPoint;
            }
            return {
                value: 0,
                date: point.date,
                showDataPoint: false,
                dataPointColor: 'transparent',
                dataPointShape: 'custom',
                customDataPoint: () => null
            };
        });

        return {
            mainData: mainData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
            secondaryData: secondaryData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        };
    };

    const chartData = formatChartData();

    const formatDateLabels = (data: any[]) => {
        if (data.length <= 8) return data;
        const step = Math.floor(data.length / 8);
        return data.map((item, index) => ({
            ...item,
            showLabel: index % step === 0 && index < data.length - step / 2
        }));
    };

    const minValue = (data: any[]) => {
        return Math.min(...data.map(item => item.value)) - 0.2 * Math.min(...data.map(item => item.value));
    };

    console.log(chartData);

    // Add new component for stock metrics
    const StockMetrics = ({ info }: { info: StockInfo['info'] }) => (
        <View style={styles.metricsContainer}>
            <View style={styles.metricRow}>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Day Range</Text>
                    <Text style={styles.metricValue}>
                        {info.dayLow.toFixed(2)} - {info.dayHigh.toFixed(2)} {info.currency}
                    </Text>
                </View>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>52 Week Range</Text>
                    <Text style={styles.metricValue}>
                        {info.fiftyTwoWeekLow.toFixed(2)} - {info.fiftyTwoWeekHigh.toFixed(2)} {info.currency}
                    </Text>
                </View>
            </View>
            <View style={styles.metricRow}>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>50 Day Avg</Text>
                    <Text style={styles.metricValue}>
                        {info.fiftyDayAverage.toFixed(2)} {info.currency}
                    </Text>
                </View>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Volume</Text>
                    <Text style={styles.metricValue}>
                        {info.regularMarketVolume.toLocaleString()}
                    </Text>
                </View>
            </View>
            <View style={styles.metricRow}>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>YTD Return</Text>
                    <Text style={[styles.metricValue, { color: info.ytdReturn >= 0 ? darkTheme.colors.success : darkTheme.colors.error }]}>
                        {(info.ytdReturn * 100).toFixed(2)}%
                    </Text>
                </View>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Beta (3Y)</Text>
                    <Text style={styles.metricValue}>
                        {info.beta3Year ? info.beta3Year.toFixed(2) : 'N/A'}
                    </Text>
                </View>
            </View>
        </View>
    );

    // Add sector weightings component
    const SectorWeightings = ({ sectors }: { sectors: StockInfo['fund_sector_weightings'] }) => (
        <View style={styles.sectorsContainer}>
            <Text style={styles.sectionTitle}>Sector Weightings</Text>
            {sectors && Object.entries(sectors).map(([sector, weight]) => (
                <View key={sector} style={styles.sectorRow}>
                    <Text style={styles.sectorName}>
                        {sector.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </Text>
                    <View style={styles.sectorBarContainer}>
                        <View style={[styles.sectorBar, { width: `${weight * 100}%` }]} />
                        <Text style={styles.sectorWeight}>{(weight * 100).toFixed(1)}%</Text>
                    </View>
                </View>
            ))}
        </View>
    );

    return (
        <View style={sharedStyles.container}>
            <View style={sharedStyles.header}>
                <BackButton />
                <View style={sharedStyles.headerTitleContainer}>
                    <Text style={sharedStyles.headerTitle}>{stockName}</Text>
                    <Text style={styles.headerSubtitle}>{symbol}</Text>
                </View>
                <Image
                    source={require('@/assets/images/logo-removebg-white.png')}
                    style={{ width: 30, height: 30 }}
                    resizeMode="contain"
                />
            </View>
            <View style={sharedStyles.body}>
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Price Chart Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Price History</Text>
                        {chartData.mainData.length > 0 ? (
                            <View style={styles.chartContainer}>
                                <LineChart
                                    areaChart
                                    data={formatDateLabels(chartData.mainData).map(item => ({
                                        value: item.value,
                                        date: new Date(item.date).getTime(),
                                    }))}
                                    secondaryData={chartData.secondaryData.map(item => ({
                                        value: item.value,
                                        date: new Date(item.date).getTime(),
                                        showDataPoint: item.value !== 0,  // Only show data point if value is not 0
                                        dataPointColor: item.dataPointColor,
                                        dataPointShape: 'custom',
                                        customDataPoint: item.value !== 0 ? item.customDataPoint : undefined
                                    }))}
                                    width={chartWidth}
                                    height={200}
                                    spacing={calculateSpacing(chartWidth, chartData.mainData.length)}
                                    adjustToWidth={true}
                                    color={darkTheme.colors.primary}
                                    startFillColor={`${darkTheme.colors.primary}40`}
                                    endFillColor={`${darkTheme.colors.primary}10`}
                                    thickness={1.5}
                                    secondaryLineConfig={{
                                        color: 'transparent',
                                        thickness: 0,
                                        hideDataPoints: false,
                                        dataPointsShape: 'custom',
                                        dataPointsWidth: 24,
                                        dataPointsHeight: 24,
                                        dataPointsColor: 'transparent',
                                        curved: false,
                                        startFillColor: 'transparent',
                                        endFillColor: 'transparent',
                                        startOpacity: 0,
                                        endOpacity: 0
                                    }}
                                    startOpacity={0.9}
                                    endOpacity={0.2}
                                    noOfSections={4}
                                    yAxisColor="transparent"
                                    xAxisColor="transparent"
                                    yAxisTextStyle={{ color: darkTheme.colors.textTertiary }}
                                    hideRules
                                    hideDataPoints
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
                                    animationDuration={1000}
                                    xAxisLabelsVerticalShift={20}
                                    getCustomDataPoint={(value: number) => {
                                        const date = new Date(value);
                                        return date.toLocaleDateString('fr-FR', {
                                            month: 'short',
                                            year: '2-digit'
                                        });
                                    }}
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
                                <View style={styles.legendContainer}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: darkTheme.colors.primary }]} />
                                        <Text style={styles.legendText}>Stock Price</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: darkTheme.colors.success }]} />
                                        <Text style={styles.legendText}>Buy</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: darkTheme.colors.error }]} />
                                        <Text style={styles.legendText}>Sell</Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.noDataContainer}>
                                <Text style={styles.noDataText}>No price data available</Text>
                            </View>
                        )}
                    </View>

                    {/* Key Metrics Section */}
                    {stockInfo && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Key Metrics</Text>
                            <StockMetrics info={stockInfo.info} />
                        </View>
                    )}

                    {/* Sector Weightings Section */}
                    {stockInfo?.fund_sector_weightings &&
                        Object.keys(stockInfo.fund_sector_weightings).length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Sector Weightings</Text>
                                <SectorWeightings sectors={stockInfo.fund_sector_weightings} />
                            </View>
                        )}

                    {/* Transactions Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Transaction History</Text>
                        <View style={styles.transactionList}>
                            {[...transactions.buys, ...transactions.sells]
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((transaction, index) => {
                                    const isBuy = transactions.buys.includes(transaction);
                                    return (
                                        <TransactionCard
                                            key={`transaction-${index}`}
                                            transaction={transaction}
                                            isBuy={isBuy}
                                            onPress={() => handleTransactionPress(transaction, isBuy)}
                                        />
                                    );
                                })}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    transactionCard: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.m,
        marginBottom: darkTheme.spacing.s,
        overflow: 'hidden',
    },
    transactionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: darkTheme.spacing.m,
    },
    transactionTypeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: darkTheme.spacing.s,
    },
    transactionTypeTag: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    transactionInfo: {
        gap: 2,
    },
    transactionMainInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: darkTheme.spacing.s,
    },
    transactionType: {
        fontSize: 15,
        fontWeight: '600',
    },
    priceText: {
        fontSize: 14,
        color: darkTheme.colors.textSecondary,
    },
    transactionDateText: {
        fontSize: 12,
        color: darkTheme.colors.textTertiary,
    },
    transactionTotalContainer: {
        alignItems: 'flex-end',
    },
    feeText: {
        fontSize: 12,
        color: darkTheme.colors.textTertiary,
    },
    totalValueText: {
        fontSize: 15,
        fontWeight: '600',
        color: darkTheme.colors.text,
    },
    buyText: {
        color: darkTheme.colors.success,
    },
    sellText: {
        color: darkTheme.colors.error,
    },
    buyIcon: {
        backgroundColor: darkTheme.colors.success,
    },
    sellIcon: {
        backgroundColor: darkTheme.colors.error,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chartContainer: {
        backgroundColor: darkTheme.colors.surface,
        padding: darkTheme.spacing.m,
        borderRadius: darkTheme.borderRadius.l,
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
    noDataContainer: {
        padding: darkTheme.spacing.l,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noDataText: {
        color: darkTheme.colors.textSecondary,
        fontSize: 16,
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
    },
    transactionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: darkTheme.colors.textSecondary,
        marginBottom: darkTheme.spacing.m,
    },
    transactionPoint: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    transactionPointText: {
        color: darkTheme.colors.surface,
        fontSize: 12,
        fontWeight: 'bold',
    },
    modalContent: {
        padding: darkTheme.spacing.l,
    },
    backButton: {
        padding: darkTheme.spacing.s,
        marginRight: darkTheme.spacing.m,
    },
    headerSubtitle: {
        fontSize: 14,
        color: darkTheme.colors.textSecondary,
        marginTop: 2,
    },
    metricsContainer: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.l,
        padding: darkTheme.spacing.m,
        marginTop: darkTheme.spacing.l,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: darkTheme.spacing.m,
    },
    metric: {
        flex: 1,
    },
    metricLabel: {
        fontSize: 12,
        color: darkTheme.colors.textTertiary,
        marginBottom: 4,
    },
    metricValue: {
        fontSize: 14,
        color: darkTheme.colors.text,
        fontWeight: '600',
    },
    sectorsContainer: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.l,
        padding: darkTheme.spacing.m,
        marginTop: darkTheme.spacing.l,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: darkTheme.colors.text,
        marginBottom: darkTheme.spacing.m,
    },
    sectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: darkTheme.spacing.s,
    },
    sectorName: {
        flex: 1,
        fontSize: 14,
        color: darkTheme.colors.text,
    },
    sectorBarContainer: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: darkTheme.spacing.s,
    },
    sectorBar: {
        height: 8,
        backgroundColor: darkTheme.colors.primary,
        borderRadius: 4,
    },
    sectorWeight: {
        fontSize: 12,
        color: darkTheme.colors.textSecondary,
        width: 45,
    },
    headerLeft: {
        flex: 1,
        alignItems: 'flex-start',
    },
    headerCenter: {
        flex: 2,
        alignItems: 'center',
    },
    headerRight: {
        flex: 1,
        alignItems: 'flex-end',
    },
    scrollContainer: {
        flexGrow: 1,
        paddingHorizontal: darkTheme.spacing.m,
        paddingBottom: darkTheme.spacing.xl,
        paddingTop: darkTheme.spacing.m,
    },
    section: {
        marginBottom: darkTheme.spacing.l,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: darkTheme.colors.text,
        marginBottom: darkTheme.spacing.m,
        paddingHorizontal: darkTheme.spacing.s,
    },
    chartContainer: {
        backgroundColor: darkTheme.colors.surface,
        padding: darkTheme.spacing.m,
        borderRadius: darkTheme.borderRadius.l,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: darkTheme.spacing.m,
        marginTop: darkTheme.spacing.m,
        paddingTop: darkTheme.spacing.m,
        borderTopWidth: 1,
        borderTopColor: darkTheme.colors.border,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: darkTheme.spacing.xs,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 12,
        color: darkTheme.colors.textSecondary,
    },
    metricsContainer: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.l,
        padding: darkTheme.spacing.l,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    transactionList: {
        gap: darkTheme.spacing.s,
    },
    transactionCard: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.m,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
});

export default StockDetails;