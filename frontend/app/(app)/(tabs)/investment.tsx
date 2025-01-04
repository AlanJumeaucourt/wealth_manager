import { getPortfolioPerformance, getPortfolioSummary } from '@/app/api/bankApi';
import { InvestmentSkeleton } from '@/app/components/InvestmentSkeleton';
import { darkTheme } from '@/constants/theme';
import { sharedStyles } from '@/styles/sharedStyles';
import {
    PerformanceData,
    PortfolioPosition,
    StockPositionItemProps
} from '@/types/investment';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Button, Menu } from 'react-native-paper';
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


const StockPositionItem = ({ position, onPress, index }: StockPositionItemProps & { index: number }) => (
    <Pressable
        onPress={onPress}
        style={[
            styles.positionCard,
            index % 2 === 0 ? styles.evenPosition : styles.oddPosition
        ]}
    >
        <View style={styles.positionMain}>
            {/* Left side - Symbol and Name with Asset Type Indicator */}
            <View style={styles.positionLeft}>
                <View style={styles.symbolWrapper}>
                    <View style={[
                        styles.assetTypeIndicator,
                        getAssetTypeStyle(position.asset_symbol)
                    ]} />
                    <Text style={styles.symbolText}>{position.asset_symbol}</Text>
                </View>
                <Text style={styles.nameText} numberOfLines={1}>{position.asset_name}</Text>
            </View>

            {/* Right side - Value and Performance */}
            <View style={styles.positionRight}>
                <Text style={styles.positionValue}>
                    {position.total_value.toLocaleString()} €
                </Text>
                <View style={[
                    styles.miniPerformanceChip,
                    position.performance >= 0 ? styles.positiveChip : styles.negativeChip
                ]}>
                    <Text style={[
                        styles.miniPerformanceText,
                        position.performance >= 0 ? styles.positiveText : styles.negativeText
                    ]}>
                        {position.performance >= 0 ? '+' : ''}{position.performance.toFixed(1)}%
                    </Text>
                </View>
            </View>
        </View>

        {/* Bottom row - Quantity and Prices */}
        <View style={styles.positionDetails}>
            <Text style={styles.detailText}>
                {position.total_quantity.toLocaleString()} × {position.current_price.toLocaleString()} €
            </Text>
            <Text style={[
                styles.gainLossText,
                position.unrealized_gain >= 0 ? styles.positiveText : styles.negativeText
            ]}>
                {position.unrealized_gain >= 0 ? '+' : ''}{position.unrealized_gain.toLocaleString()} €
            </Text>
        </View>
    </Pressable>
);

// Helper function to determine asset type style
const getAssetTypeStyle = (symbol: string) => {
    // You can customize this logic based on your asset types
    if (symbol.includes('ETF')) return styles.etfIndicator;
    if (symbol.length > 4) return styles.cryptoIndicator;
    return styles.stockIndicator;
};

const PortfolioSummary = ({ totalValue, totalGain, totalPerformance }: {
    totalValue: number;
    totalGain: number;
    totalPerformance: number;
}) => (
    <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>Portfolio Total</Text>
            <View style={styles.refreshButton}>
                <Ionicons name="refresh-outline" size={20} color={darkTheme.colors.primary} />
            </View>
        </View>
        <Text style={styles.summaryValue}>{totalValue.toLocaleString()} €</Text>
        <View style={styles.performanceRow}>
            <View style={[
                styles.performanceChip,
                totalGain >= 0 ? styles.positiveChip : styles.negativeChip
            ]}>
                <Ionicons
                    name={totalGain >= 0 ? "trending-up" : "trending-down"}
                    size={16}
                    color={totalGain >= 0 ? darkTheme.colors.success : darkTheme.colors.error}
                />
                <Text style={[
                    styles.performanceText,
                    totalGain >= 0 ? styles.positiveText : styles.negativeText
                ]}>
                    {totalGain >= 0 ? '+' : ''}{totalGain.toLocaleString()} € ({totalPerformance.toFixed(2)}%)
                </Text>
            </View>
        </View>
    </View>
);

const PeriodSelector = ({ selectedPeriod, onPeriodChange }: {
    selectedPeriod: string;
    onPeriodChange: (period: string) => void;
}) => (
    <View style={styles.periodContainer}>
        {['1M', '3M', '6M', '1Y', 'Max'].map((period) => (
            <TouchableOpacity
                key={period}
                style={[
                    styles.periodChip,
                    selectedPeriod === period && styles.selectedPeriodChip
                ]}
                onPress={() => onPeriodChange(period)}
            >
                <Text style={[
                    styles.periodText,
                    selectedPeriod === period && styles.selectedPeriodText
                ]}>
                    {period}
                </Text>
            </TouchableOpacity>
        ))}
    </View>
);


const InvestmentOverview: React.FC = () => {
    const router = useRouter();
    const [selectedPeriod, setSelectedPeriod] = useState('1Y');
    const [positions, setPositions] = useState<PortfolioPosition[]>([]);
    const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [visible, setVisible] = useState(false);
    const [totalValue, setTotalValue] = useState(0);
    const [totalGain, setTotalGain] = useState(0);
    const [totalPerformance, setTotalPerformance] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [chartWidth, setChartWidth] = useState(Dimensions.get('window').width);
    const [showHidden, setShowHidden] = useState(false);

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
        const minSpacing = 0.1;
        const maxSpacing = 100;
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

            if (!summaryResponse || !summaryResponse.assets) {
                throw new Error('Invalid response from server: Missing assets');
            }

            setPositions(summaryResponse.assets.map(asset => ({
                asset_symbol: asset.symbol,
                asset_name: asset.name,
                total_value: asset.current_value,
                total_quantity: asset.shares,
                current_price: asset.current_price,
                unrealized_gain: asset.gain_loss,
                performance: asset.gain_loss_percentage,
            })));
            setPerformanceData(performanceResponse?.data_points || []);

            // Update total values with safe defaults
            setTotalValue(summaryResponse.total_value || 0);
            setTotalGain(summaryResponse.total_gain_loss || 0);
            if (summaryResponse.total_cost && summaryResponse.total_cost !== 0) {
                setTotalPerformance((summaryResponse.total_gain_loss / Math.abs(summaryResponse.total_cost)) * 100);
            } else {
                setTotalPerformance(0);
            }

        } catch (error) {
            console.error('Error fetching investment data:', error);
            setError(error.message || 'Failed to load investment data');
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
            showLabel: index % step === 0 && index < data.length - step / 2 // Avoid label at the very end
        }));
    };

    const sortedPositions = [...positions].sort((a, b) => b.total_quantity - a.total_quantity);

    // Split positions into visible and hidden
    const visiblePositions = sortedPositions.filter(pos => pos.total_quantity > 0);
    const hiddenPositions = sortedPositions.filter(pos => pos.total_quantity === 0);

    return (
        <View style={[sharedStyles.container]}>
            <View style={sharedStyles.header}>
                <Image
                    source={require('@/assets/images/logo-removebg-white.png')}
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
                    <Menu.Item
                        onPress={() => {
                            closeMenu();
                            router.push('/add-investment-transaction');
                        }}
                        title="Add investment transaction"
                    />
                    <Menu.Item
                        onPress={() => {
                            closeMenu();
                            router.push('list-investment-transaction');
                        }}
                        title="Show list investments"
                    />
                </Menu>
            </View>
            <View style={sharedStyles.body}>
                <ScrollView style={styles.container}>
                    <View style={styles.header}>
                        <PortfolioSummary
                            totalValue={totalValue}
                            totalGain={totalGain}
                            totalPerformance={totalPerformance}
                        />
                    </View>

                    <PeriodSelector
                        selectedPeriod={selectedPeriod}
                        onPeriodChange={(period) => setSelectedPeriod(period)}
                    />

                    {performanceData.length > 0 ? (
                        <View style={styles.chartContainer}>
                            <LineChart
                                areaChart
                                data={formatDateLabels(performanceData).map(item => ({
                                    value: item.value,
                                    date: item.date,
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
                                initialSpacing={20}
                                noOfSections={4}
                                yAxisColor="transparent"
                                xAxisColor="transparent"
                                yAxisTextStyle={{ color: darkTheme.colors.textTertiary }}
                                hideRules
                                hideDataPoints
                                showVerticalLines={false}
                                xAxisLabelTexts={formatDateLabels(performanceData).map(item =>
                                    item.showLabel ? new Date(item.date).toLocaleDateString('fr-FR', {
                                        month: 'short',
                                        year: '2-digit'
                                    }) : ''
                                )}
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
                        {visiblePositions.length > 0 ? (
                            visiblePositions.map((position, index) => (
                                <StockPositionItem
                                    key={position.asset_symbol}
                                    position={position}
                                    index={index}
                                    onPress={() => router.push({
                                        pathname: '/(app)/stock-detail',
                                        params: {
                                            symbol: position.asset_symbol,
                                            name: position.asset_name
                                        }
                                    })}
                                />
                            ))
                        ) : (
                            <View style={styles.noDataContainer}>
                                <Text style={styles.noDataText}>No positions available</Text>
                            </View>
                        )}

                        {/* Hidden Positions Section */}
                        {hiddenPositions.length > 0 && (
                            <View style={styles.hiddenPositionsContainer}>
                                <TouchableOpacity
                                    onPress={() => setShowHidden(!showHidden)}
                                    style={styles.toggleButton}
                                >
                                    <Text style={styles.toggleButtonText}>
                                        {showHidden ? 'Hide Hidden Positions' : `Show Hidden Positions (${hiddenPositions.length})`}
                                    </Text>
                                </TouchableOpacity>
                                {showHidden && hiddenPositions.map((position, index) => (
                                    <StockPositionItem
                                        key={`hidden-${position.asset_symbol}`}
                                        position={position}
                                        index={index}
                                        onPress={() => router.push({
                                            pathname: '/(app)/stock-detail',
                                            params: {
                                                symbol: position.asset_symbol,
                                                name: position.asset_name
                                            }
                                        })}
                                    />
                                ))}
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
        <InvestmentOverview />
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
        padding: darkTheme.spacing.s,
        backgroundColor: darkTheme.colors.surface,
        marginBottom: darkTheme.spacing.m,
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
        padding: darkTheme.spacing.m,
        marginHorizontal: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.l,
        borderRadius: darkTheme.borderRadius.l,
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
        padding: darkTheme.spacing.m,
        marginHorizontal: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.l,
        borderRadius: darkTheme.borderRadius.l,
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
    summaryContainer: {
        backgroundColor: darkTheme.colors.surface,
        padding: darkTheme.spacing.l,
        marginHorizontal: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.m,
        borderRadius: darkTheme.borderRadius.l,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    summaryTitle: {
        fontSize: 16,
        color: darkTheme.colors.textSecondary,
        marginBottom: darkTheme.spacing.s,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    performanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: darkTheme.spacing.xs,
    },
    periodSelectorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: darkTheme.spacing.s,
        marginBottom: darkTheme.spacing.m,
        paddingHorizontal: darkTheme.spacing.m,
    },
    selectedPeriodButton: {
        backgroundColor: darkTheme.colors.primary,
    },
    transactionCard: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.m,
        marginBottom: darkTheme.spacing.s,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: `${darkTheme.colors.border}30`,
        // Ajoutez un style pour indiquer que c'est cliquable
        elevation: 2, // Pour Android
        shadowColor: '#000', // Pour iOS
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    transactionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
    transactionDate: {
        fontSize: 12,
        color: darkTheme.colors.textTertiary,
    },
    transactionTotal: {
        alignItems: 'flex-end',
    },
    feeText: {
        fontSize: 12,
        color: darkTheme.colors.textTertiary,
    },
    totalValue: {
        fontSize: 15,
        fontWeight: '600',
        color: darkTheme.colors.text, // Couleur neutre au lieu des couleurs success/error
    },
    buyText: {
        color: darkTheme.colors.success,
    },
    sellIcon: {
        backgroundColor: darkTheme.colors.error,
    },
    buyIcon: {
        backgroundColor: darkTheme.colors.success,
    },
    sellText: {
        color: darkTheme.colors.error,
    },
    transactionDateText: {
        fontSize: 12,
        color: darkTheme.colors.textTertiary,
    },
    transactionTotalContainer: {
        alignItems: 'flex-end',
    },
    feeTextStyle: {
        fontSize: 12,
        color: darkTheme.colors.textTertiary,
    },
    totalValueText: {
        fontSize: 15,
        fontWeight: '600',
        color: darkTheme.colors.text,
    },
    sellIconStyle: {
        backgroundColor: darkTheme.colors.error,
    },
    buyIconStyle: {
        backgroundColor: darkTheme.colors.success,
    },
    summaryCard: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.xl,
        padding: darkTheme.spacing.l,
        margin: darkTheme.spacing.s,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: darkTheme.spacing.s,
    },
    summaryLabel: {
        fontSize: 14,
        color: darkTheme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    summaryValue: {
        fontSize: 32,
        fontWeight: '700',
        color: darkTheme.colors.text,
        marginBottom: darkTheme.spacing.s,
    },
    performanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: darkTheme.spacing.s,
    },
    performanceChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: darkTheme.spacing.m,
        paddingVertical: darkTheme.spacing.s,
        borderRadius: darkTheme.borderRadius.full,
        gap: darkTheme.spacing.xs,
    },
    positiveChip: {
        backgroundColor: `${darkTheme.colors.success}15`,
    },
    negativeChip: {
        backgroundColor: `${darkTheme.colors.error}15`,
    },
    positiveText: {
        color: darkTheme.colors.success,
        fontWeight: '600',
    },
    negativeText: {
        color: darkTheme.colors.error,
        fontWeight: '600',
    },
    periodContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: darkTheme.spacing.s,
        marginBottom: darkTheme.spacing.l,
        paddingHorizontal: darkTheme.spacing.m,
    },
    periodChip: {
        paddingHorizontal: darkTheme.spacing.m,
        paddingVertical: darkTheme.spacing.s,
        borderRadius: darkTheme.borderRadius.full,
        backgroundColor: `${darkTheme.colors.primary}15`,
    },
    selectedPeriodChip: {
        backgroundColor: darkTheme.colors.primary,
    },
    periodText: {
        color: darkTheme.colors.primary,
        fontWeight: '600',
    },
    selectedPeriodText: {
        color: darkTheme.colors.surface,
    },
    positionCard: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.m,
        marginHorizontal: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.xs,
        padding: darkTheme.spacing.m,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    evenPosition: {
        backgroundColor: darkTheme.colors.surface,
    },
    oddPosition: {
        backgroundColor: `${darkTheme.colors.primary}08`, // Very subtle tint
    },
    symbolWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    assetTypeIndicator: {
        width: 4,
        height: 16,
        borderRadius: 2,
    },
    stockIndicator: {
        backgroundColor: darkTheme.colors.primary,
    },
    etfIndicator: {
        backgroundColor: darkTheme.colors.success,
    },
    cryptoIndicator: {
        backgroundColor: darkTheme.colors.warning,
    },
    positionMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: darkTheme.spacing.xs,
    },
    positionLeft: {
        flex: 1,
        marginRight: darkTheme.spacing.m,
    },
    positionRight: {
        alignItems: 'flex-end',
    },
    symbolText: {
        fontSize: 16,
        fontWeight: '600',
        color: darkTheme.colors.text,
    },
    nameText: {
        fontSize: 13,
        color: darkTheme.colors.textSecondary,
        marginLeft: 10, // Align with symbol text
    },
    positionValue: {
        fontSize: 15,
        fontWeight: '600',
        color: darkTheme.colors.text,
        marginBottom: 2,
    },
    miniPerformanceChip: {
        paddingHorizontal: darkTheme.spacing.s,
        paddingVertical: 2,
        borderRadius: darkTheme.borderRadius.s,
    },
    miniPerformanceText: {
        fontSize: 12,
        fontWeight: '600',
    },
    positionDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
        marginLeft: 10, // Align with name text
    },
    detailText: {
        fontSize: 13,
        color: darkTheme.colors.textSecondary,
    },
    gainLossText: {
        fontSize: 13,
        fontWeight: '500',
    },
    hiddenPositionsContainer: {
        marginTop: darkTheme.spacing.m,
    },
    toggleButton: {
        padding: darkTheme.spacing.s,
        backgroundColor: `${darkTheme.colors.primary}15`,
        borderRadius: darkTheme.borderRadius.s,
        alignItems: 'center',
        marginBottom: darkTheme.spacing.s,
    },
    toggleButtonText: {
        color: darkTheme.colors.primary,
        fontWeight: '600',
    },
});
