import { getAssetById, getInvestmentTransactions } from '@/app/api/bankApi';
import { BackButton } from '@/app/components/BackButton';
import { darkTheme } from '@/constants/theme';
import { sharedStyles } from '@/styles/sharedStyles';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

interface InvestmentTransaction {
    id: number;
    account_id: number;
    asset_id: number;
    asset_symbol: string;
    asset_name: string;
    activity_type: 'buy' | 'sell' | 'deposit' | 'withdrawal';
    date: string;
    quantity: number;
    unit_price: number;
    fee: number;
    tax: number;
}

interface Asset {
    id: number;
    symbol: string;
    name: string;
}

export default function InvestmentTransactionListScreen() {
    const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const [assetsCache, setAssetsCache] = useState<Record<number, Asset>>({});

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        try {
            const response = await getInvestmentTransactions();
            setTransactions(response);
        } catch (error) {
            console.error('Error fetching investment transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAssetDetails = async (assetId: number) => {
        if (assetsCache[assetId]) {
            return assetsCache[assetId];
        }

        try {
            const asset = await getAssetById(assetId);
            setAssetsCache(prev => ({
                ...prev,
                [assetId]: asset
            }));
            return asset;
        } catch (error) {
            console.error('Error fetching asset details:', error);
            return null;
        }
    };

    useEffect(() => {
        const loadAssetDetails = async () => {
            const assetIds = transactions
                .map(t => t.asset_id)
                .filter((id, index, self) => self.indexOf(id) === index);

            for (const assetId of assetIds) {
                await fetchAssetDetails(assetId);
            }
        };

        if (transactions.length > 0) {
            loadAssetDetails();
        }
    }, [transactions]);

    const getActivityTypeColor = (type: string) => {
        switch (type) {
            case 'buy':
                return darkTheme.colors.success;
            case 'sell':
                return darkTheme.colors.error;
            case 'deposit':
                return darkTheme.colors.info;
            case 'withdrawal':
                return darkTheme.colors.warning;
            default:
                return darkTheme.colors.surface;
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    };

    console.log(transactions);

    const renderTransaction = ({ item }: { item: InvestmentTransaction }) => {
        const totalValue = item.quantity * item.unit_price;
        const totalCost = totalValue + item.fee + item.tax;
        const asset = assetsCache[item.asset_id];

        return (
            <Pressable
                style={styles.transactionCard}
                onPress={() => {
                    const transactionString = JSON.stringify(item);
                    router.push({
                        pathname: 'add-investment-transaction',
                        params: { transaction: transactionString }
                    });
                }}
            >
                <View style={styles.transactionHeader}>
                    <View style={styles.symbolContainer}>
                        <Text style={styles.symbolText}>{asset?.symbol || 'Loading...'}</Text>

                        <Text style={styles.dateText}>
                            {new Date(item.date).toLocaleDateString()}
                        </Text>
                    </View>
                    <View style={[
                        styles.activityType,
                        { backgroundColor: getActivityTypeColor(item.activity_type) }
                    ]}>
                        <Text style={styles.activityTypeText}>
                            {item.activity_type.toUpperCase()}
                        </Text>
                    </View>
                </View>

                <Text style={styles.assetName} numberOfLines={1}>
                    {asset?.name || 'Loading...'}
                </Text>

                <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Quantity:</Text>
                        <Text style={styles.detailValue}>{item.quantity}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Unit Price:</Text>
                        <Text style={styles.detailValue}>{formatCurrency(item.unit_price)}</Text>
                    </View>
                    {(item.fee > 0 || item.tax > 0) && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Fees & Tax:</Text>
                            <Text style={[styles.detailValue, { color: "#ff471a" }]}>
                                - {formatCurrency(item.fee + item.tax)}
                            </Text>
                        </View>
                    )}
                    <View style={[styles.detailRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={styles.totalValue}>{formatCurrency(totalCost)}</Text>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={sharedStyles.container}>
            <View style={sharedStyles.header}>
                <BackButton />
                <Text style={styles.title}>Investment Transactions</Text>
                <Pressable
                    style={styles.addButton}
                    onPress={() => router.push('add-investment-transaction')}
                >
                    <Ionicons name="add" size={24} color={darkTheme.colors.text} />
                </Pressable>
            </View>

            {loading ? (
                <ActivityIndicator style={styles.loader} />
            ) : (
                <FlatList
                    data={transactions}
                    renderItem={renderTransaction}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
        flex: 1,
        textAlign: 'center',
    },
    addButton: {
        padding: 8,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        padding: 16,
        gap: 16,
    },
    transactionCard: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: 12,
        padding: 16,
        elevation: 2,
    },
    transactionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    symbolContainer: {
        flex: 1,
    },
    symbolText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
    },
    dateText: {
        fontSize: 14,
        color: darkTheme.colors.textSecondary,
        marginTop: 4,
    },
    activityType: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    activityTypeText: {
        color: darkTheme.colors.white,
        fontSize: 12,
        fontWeight: 'bold',
    },
    assetName: {
        fontSize: 14,
        color: darkTheme.colors.textSecondary,
        marginBottom: 12,
    },
    detailsContainer: {
        gap: 8,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 14,
        color: darkTheme.colors.textSecondary,
    },
    detailValue: {
        fontSize: 14,
        color: darkTheme.colors.text,
    },
    totalRow: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: darkTheme.colors.border,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
    },
});
