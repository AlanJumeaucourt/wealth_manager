import SearchableModal from '@/app/components/SearchableModal';
import { darkTheme } from '@/constants/theme';
import { RootState } from '@/store/store';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Modal from 'react-native-modal';
import { Button, Surface, Text, TextInput } from 'react-native-paper';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useSelector } from 'react-redux';
import { createInvestmentTransaction, updateInvestmentTransaction } from './api/bankApi';
import { BackButton } from './components/BackButton';
import StockSearchModal from './components/StockSearchModal';
import sharedStyles from './styles/sharedStyles';
import { Account } from '@/types/account';

interface InvestmentTransaction {
    id: number;
    account_id: number;
    account_name: string;
    asset_symbol: string;
    asset_name: string;
    activity_type: 'buy' | 'sell' | 'deposit' | 'withdrawal';
    date: string;
    quantity: number;
    unit_price: number;
    fee: number;
    tax: number;
}

export default function AddInvestmentTransactionScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const transaction = route.params?.transaction as InvestmentTransaction | undefined;
    const accounts = useSelector((state: RootState) =>
        state.accounts.accounts.filter((account: Account) => account.id === transaction?.account_id)
    );

    // Initialize state with transaction data if editing
    const [accountId, setAccountId] = useState<number | null>(transaction ? transaction.account_id : null);
    const [selectedAccountName, setSelectedAccountName] = useState<string>(
        transaction ? accounts.find((acc: Account) => acc.name === transaction.account_name)?.name || '' : ''
    );
    console.log(transaction);
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
        if (!accountId) {
            Alert.alert('Error', 'Please select an account');
            return;
        }

        const transactionData = {
            account_id: accountId,
            asset_symbol: assetSymbol,
            asset_name: assetName,
            activity_type: activityType,
            date: transactionDate.toISOString(),
            quantity: parseFloat(quantity),
            unit_price: parseFloat(unitPrice),
            fee: parseFloat(fee),
            tax: parseFloat(tax)
        };

        try {
            if (transaction) {
                // Update existing transaction
                await updateInvestmentTransaction(transaction.id, transactionData);
                Alert.alert('Success', 'Investment transaction updated successfully!');
            } else {
                // Create new transaction
                await createInvestmentTransaction(transactionData);
                Alert.alert('Success', 'Investment transaction created successfully!');
            }
            navigation.goBack();
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

    return (
        <View style={sharedStyles.container}>
            <View style={sharedStyles.header}>
                <BackButton />
                <Text style={styles.title}>
                    {transaction ? 'Edit Investment Transaction' : 'Add Investment Transaction'}
                </Text>
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
                        <SearchableModal
                            data={accounts}
                            onSelect={(value) => {
                                if (typeof value === 'string') {
                                    setSelectedAccountName(value);
                                    setAccountId(null);
                                } else {
                                    setAccountId(value);
                                    const selectedAccount = accounts.find((account: Account) => account.id === value);
                                    setSelectedAccountName(selectedAccount ? selectedAccount.name : '');
                                }
                            }}
                            placeholder={selectedAccountName || "Select an investment account"}
                            label="Investment Account"
                            allowCustomValue={false}
                            containerStyle={styles.input}
                        />

                        <StockSearchModal
                            onSelect={(symbol, name) => {
                                setAssetSymbol(symbol);
                                setAssetName(name);
                            }}
                            placeholder={assetSymbol || "Search for a stock or ETF"}
                            label="Asset"
                            containerStyle={styles.input}
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
});
