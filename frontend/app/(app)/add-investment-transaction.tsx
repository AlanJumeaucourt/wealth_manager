import { createAsset, createInvestmentTransaction, fetchAssets, updateInvestmentTransaction } from '@/app/api/bankApi';
import { BackButton } from '@/app/components/BackButton';
import SearchableModal from '@/app/components/SearchableModal';
import StockSearchModal from '@/app/components/StockSearchModal';
import { darkTheme } from '@/constants/theme';
import { sharedStyles } from '@/styles/sharedStyles';
import { Account } from '@/types/account';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Button, Surface, Text, TextInput } from 'react-native-paper';
import { useSelector } from 'react-redux';

interface InvestmentTransaction {
    id: number;
    from_account_id: number;
    to_account_id: number;
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

interface BackButtonProps {
    onPress: () => void;
}

interface SearchableModalProps {
    data: any[];
    onSelect: (value: string | number) => void;
    placeholder: string;
    label: string;
    allowCustomValue: boolean;
}

interface StockSearchModalProps {
    onSelect: (symbol: string, name: string) => void;
    placeholder: string;
    label: string;
}

// Add RootState type for useSelector
interface RootState {
    accounts: {
        accounts: Account[];
    };
}

// Add interface for Asset
interface Asset {
    id: number;
    symbol: string;
    name: string;
}

export default function AddInvestmentTransactionScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    let transaction: InvestmentTransaction | undefined;

    try {
        transaction = params.transaction ? JSON.parse(params.transaction as string) : undefined;
    } catch (error) {
        console.error('Error parsing transaction:', error);
        transaction = undefined;
    }

    // Fix the useSelector type
    const accounts = useSelector((state: RootState) =>
        state.accounts.accounts.filter((account: Account) =>
            transaction ? account.id === transaction.from_account_id : true
        )
    );

    // Add state for selected account name
    const [selectedAccountName, setSelectedAccountName] = useState<string>(
        transaction ? accounts.find((acc: Account) => acc.id === transaction.from_account_id)?.name || '' : ''
    );

    // Initialize state with transaction data if editing
    const [fromAccountId, setFromAccountId] = useState<number | null>(
        transaction ? transaction.from_account_id : null
    );
    const [toAccountId, setToAccountId] = useState<number | null>(
        transaction ? transaction.to_account_id : null
    );
    const [assetSymbol, setAssetSymbol] = useState(transaction ? transaction.asset_symbol : '');
    const [assetName, setAssetName] = useState(transaction ? transaction.asset_name : '');
    const [activityType, setActivityType] = useState<'buy' | 'sell' | 'deposit' | 'withdrawal'>(
        transaction ? transaction.activity_type : 'buy'
    );
    const [transactionDate, setTransactionDate] = useState(
        transaction ? new Date(transaction.date) : new Date()
    );
    const [quantity, setQuantity] = useState(transaction ? transaction.quantity.toString() : '');
    const [unitPrice, setUnitPrice] = useState(transaction ? transaction.unit_price.toString() : '');
    const [fee, setFee] = useState(transaction ? transaction.fee.toString() : '0');
    const [tax, setTax] = useState(transaction ? transaction.tax.toString() : '0');
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

    // Add new state for assets
    const [assets, setAssets] = useState<Asset[]>([]);
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(
        transaction ? transaction.asset_id : null
    );

    // Add useEffect to fetch assets
    useEffect(() => {
        const loadAssets = async () => {
            try {
                const fetchedAssets = await fetchAssets();
                setAssets(fetchedAssets);
            } catch (error) {
                console.error('Error loading assets:', error);
            }
        };
        loadAssets();
    }, []);

    // Add function to handle asset selection
    const handleAssetSelect = async (symbol: string, name: string) => {
        setAssetSymbol(symbol);
        setAssetName(name);

        // Find existing asset or create new one
        let asset = assets.find(a => a.symbol === symbol);

        if (!asset) {
            try {
                // Create new asset if it doesn't exist
                asset = await createAsset({ symbol, name });
                setAssets([...assets, asset]);
            } catch (error) {
                console.error('Error creating asset:', error);
                Alert.alert('Error', 'Failed to create asset');
                return;
            }
        }

        setSelectedAssetId(asset.id);
    };

    const showDatePicker = () => {
        setDatePickerVisibility(true);
    };

    const hideDatePicker = () => {
        setDatePickerVisibility(false);
    };

    const handleConfirm = (date: Date) => {
        setTransactionDate(date);
        hideDatePicker();
    };

    const handleSubmit = async () => {
        if (!fromAccountId || !toAccountId) {
            Alert.alert('Error', 'Please select source and destination accounts');
            return;
        }

        if (!selectedAssetId) {
            Alert.alert('Error', 'Please select an asset');
            return;
        }

        const transactionData = {
            from_account_id: fromAccountId,
            to_account_id: toAccountId,
            asset_id: selectedAssetId,
            activity_type: activityType,
            date: transactionDate.toISOString(),
            quantity: parseFloat(quantity),
            unit_price: parseFloat(unitPrice),
            fee: parseFloat(fee),
            tax: parseFloat(tax)
        };

        try {
            if (transaction) {
                await updateInvestmentTransaction(transaction.id, transactionData);
                Alert.alert('Success', 'Investment transaction updated successfully!');
            } else {
                await createInvestmentTransaction(transactionData);
                Alert.alert('Success', 'Investment transaction created successfully!');
            }
            router.back();
        } catch (error) {
            console.error('Error saving investment transaction:', error);
            Alert.alert('Error', `Failed to ${transaction ? 'update' : 'create'} investment transaction`);
        }
    };

    const getActivityTypeColor = (type: string) => {
        switch (type) {
            case 'buy':
                return darkTheme.colors.success; // Green for buying
            case 'sell':
                return darkTheme.colors.error;   // Red for selling
            case 'deposit':
                return darkTheme.colors.info;    // Blue for deposits
            case 'withdrawal':
                return darkTheme.colors.warning; // Orange for withdrawals
            default:
                return darkTheme.colors.surface;
        }
    };

    const calculateTotal = () => {
        const qty = parseFloat(quantity) || 0;
        const price = parseFloat(unitPrice) || 0;
        const fees = parseFloat(fee) || 0;
        const taxes = parseFloat(tax) || 0;
        return (qty * price) + fees + taxes;
    };

    const handleClose = () => {
        router.back();
    };

    const getAccountsByType = (type: string) => {
        return accounts.filter((account: Account) => account.type === type);
    };

    return (
        <View style={sharedStyles.container}>
            <View style={sharedStyles.header}>
                <BackButton />
                <View style={sharedStyles.headerTitleContainer}>
                    <Text style={sharedStyles.headerTitle}>{transaction ? `Edit Investment Transaction` : 'Add New Investment Transaction'}</Text>
                </View>
                <Image
                    source={require('@/assets/images/logo-removebg-white.png')}
                    style={{ width: 30, height: 30 }}
                    resizeMode="contain"
                />
            </View>
            <ScrollView style={styles.scrollContainer}>
                <Surface style={styles.card}>
                    {/* Activity Type Selection */}
                    <Text style={styles.sectionTitle}>Transaction Type</Text>
                    <View style={styles.activityTypeContainer}>
                        {['buy', 'sell', 'deposit', 'withdrawal'].map((type) => (
                            <Pressable
                                key={type}
                                style={[
                                    styles.activityOption,
                                    activityType === type && {
                                        backgroundColor: getActivityTypeColor(type)
                                    }
                                ]}
                                onPress={() => setActivityType(type as typeof activityType)}
                            >
                                <Ionicons
                                    name={
                                        type === 'buy' || type === 'deposit'
                                            ? 'arrow-down-circle'
                                            : 'arrow-up-circle'
                                    }
                                    size={24}
                                    color={activityType === type ? darkTheme.colors.white : darkTheme.colors.text}
                                />
                                <Text style={[
                                    styles.activityText,
                                    activityType === type && styles.selectedActivityText
                                ]}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Account and Asset Selection */}
                    <View style={styles.section}>
                        {/* From Account Selection */}
                        <SearchableModal
                            data={getAccountsByType('investment')}
                            onSelect={(value) => {
                                if (typeof value === 'string') {
                                    setSelectedAccountName(value);
                                    setFromAccountId(null);
                                } else {
                                    setFromAccountId(value);
                                    const selectedAccount = accounts.find((account: Account) => account.id === value);
                                    setSelectedAccountName(selectedAccount ? selectedAccount.name : '');
                                }
                            }}
                            placeholder={selectedAccountName || "Select source account"}
                            label={activityType === 'buy' || activityType === 'deposit' ?
                                "From (Source) Account" :
                                "Investment Account"
                            }
                            allowCustomValue={false}
                        />

                        {/* To Account Selection */}
                        <SearchableModal
                            data={activityType === 'buy' || activityType === 'deposit' ?
                                getAccountsByType('investment') :
                                getAccountsByType('expense')
                            }
                            onSelect={(value) => {
                                if (typeof value === 'string') {
                                    setToAccountId(null);
                                } else {
                                    setToAccountId(value);
                                }
                            }}
                            placeholder={
                                accounts.find((acc: Account) => acc.id === toAccountId)?.name ||
                                "Select destination account"
                            }
                            label={activityType === 'buy' || activityType === 'deposit' ?
                                "To (Investment) Account" :
                                "To (Expense) Account"
                            }
                            allowCustomValue={false}
                        />

                        {/* Asset Selection */}
                        <StockSearchModal
                            onSelect={handleAssetSelect}
                            placeholder={assetSymbol || "Search for a stock or ETF"}
                            label="Asset"
                        />
                    </View>

                    {/* Transaction Details */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Transaction Details</Text>

                        <Pressable
                            onPress={showDatePicker}
                            style={styles.dateButton}
                        >
                            <Text style={styles.dateButtonLabel}>Date</Text>
                            <Text style={styles.dateButtonText}>
                                {transactionDate.toLocaleDateString()}
                            </Text>
                        </Pressable>

                        <DateTimePickerModal
                            isVisible={isDatePickerVisible}
                            mode="date"
                            onConfirm={handleConfirm}
                            onCancel={hideDatePicker}
                        />

                        <View style={styles.row}>
                            <View style={styles.halfWidth}>
                                <TextInput
                                    label="Quantity"
                                    value={quantity}
                                    onChangeText={setQuantity}
                                    keyboardType="numeric"
                                    style={styles.input}
                                    mode="outlined"
                                />
                            </View>
                            <View style={styles.halfWidth}>
                                <TextInput
                                    label="Unit Price"
                                    value={unitPrice}
                                    onChangeText={setUnitPrice}
                                    keyboardType="numeric"
                                    style={styles.input}
                                    mode="outlined"
                                    right={<TextInput.Affix text="€" />}
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.halfWidth}>
                                <TextInput
                                    label="Fee"
                                    value={fee}
                                    onChangeText={setFee}
                                    keyboardType="numeric"
                                    style={styles.input}
                                    mode="outlined"
                                    right={<TextInput.Affix text="€" />}
                                />
                            </View>
                            <View style={styles.halfWidth}>
                                <TextInput
                                    label="Tax"
                                    value={tax}
                                    onChangeText={setTax}
                                    keyboardType="numeric"
                                    style={styles.input}
                                    mode="outlined"
                                    right={<TextInput.Affix text="€" />}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Total Section */}
                    <View style={styles.totalSection}>
                        <Text style={styles.totalLabel}>Total Amount</Text>
                        <Text style={styles.totalValue}>
                            {calculateTotal().toLocaleString()}€
                        </Text>
                    </View>

                    <Button
                        mode="contained"
                        onPress={handleSubmit}
                        style={styles.submitButton}
                    >
                        {transaction ? 'Update Transaction' : 'Create Transaction'}
                    </Button>
                </Surface>
            </ScrollView>
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
    scrollContainer: {
        padding: 16,
    },
    card: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: 12,
        padding: 16,
        elevation: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: darkTheme.colors.text,
        marginBottom: 12,
    },
    activityTypeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 24,
    },
    activityOption: {
        flex: 1,
        minWidth: '45%',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: darkTheme.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    activityText: {
        color: darkTheme.colors.text,
        fontSize: 16,
    },
    selectedActivityText: {
        color: darkTheme.colors.white,
        fontWeight: '500',
    },
    section: {
        marginBottom: 24,
    },
    input: {
        marginBottom: 12,
        backgroundColor: darkTheme.colors.background,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    halfWidth: {
        flex: 1,
    },
    dateButton: {
        padding: 16,
        backgroundColor: darkTheme.colors.background,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: darkTheme.colors.border,
    },
    dateButtonLabel: {
        fontSize: 12,
        color: darkTheme.colors.textSecondary,
        marginBottom: 4,
    },
    dateButtonText: {
        fontSize: 16,
        color: darkTheme.colors.text,
    },
    totalSection: {
        borderTopWidth: 1,
        borderTopColor: darkTheme.colors.border,
        paddingTop: 16,
        marginTop: 24,
        marginBottom: 24,
    },
    totalLabel: {
        fontSize: 16,
        color: darkTheme.colors.textSecondary,
        marginBottom: 8,
    },
    totalValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
    },
    submitButton: {
        marginTop: 8,
    },
    modal: {
        justifyContent: 'flex-end',
        margin: 0,
    },
    modalContent: {
        backgroundColor: darkTheme.colors.surface,
        padding: 16,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    datePickerText: {
        color: darkTheme.colors.text,
    },
    datePickerHeaderText: {
        color: darkTheme.colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    closeButton: {
        marginTop: 16,
    },
    helperText: {
        fontSize: 12,
        color: darkTheme.colors.textSecondary,
        marginTop: 4,
        marginBottom: 16,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
