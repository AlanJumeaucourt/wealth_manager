import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, StyleSheet, Pressable } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import DatePicker from 'react-native-ui-datepicker';
import { Ionicons } from '@expo/vector-icons';
import { darkTheme } from '@/constants/theme';
import { Account } from '@/types/account';
import { RootState } from '@/store/store';
import { createInvestmentTransaction, updateInvestmentTransaction } from './api/bankApi';
import { BackButton } from './components/BackButton';
import SearchableModal from '@/app/components/SearchableModal';
import sharedStyles from './styles/sharedStyles';
import Modal from 'react-native-modal';
import StockSearchModal from './components/StockSearchModal';

interface InvestmentTransaction {
    id: number;
    account_id: number;
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
        state.accounts.accounts.filter(account => account.type === 'investment')
    );

    // Initialize state with transaction data if editing
    const [accountId, setAccountId] = useState<number | null>(transaction ? transaction.account_id : null);
    const [selectedAccountName, setSelectedAccountName] = useState<string>(
        transaction ? accounts.find(acc => acc.id === transaction.account_id)?.name || '' : ''
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
    const [showDatePicker, setShowDatePicker] = useState(false);

    const handleDateChange = (date: string) => {
        setTransactionDate(new Date(date));
        setShowDatePicker(false);
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

    return (
        <View style={sharedStyles.container}>
            <View style={sharedStyles.header}>
                <BackButton />
                <Text style={styles.title}>
                    {transaction ? 'Edit Investment Transaction' : 'Add Investment Transaction'}
                </Text>
            </View>

            <ScrollView style={styles.scrollContainer}>
                <View style={styles.form}>
                    {/* Account Selection using SearchableModal */}
                    <SearchableModal
                        data={accounts}
                        onSelect={(value) => {
                            if (typeof value === 'string') {
                                setSelectedAccountName(value);
                                setAccountId(null);
                            } else {
                                setAccountId(value);
                                const selectedAccount = accounts.find(account => account.id === value);
                                setSelectedAccountName(selectedAccount ? selectedAccount.name : '');
                            }
                        }}
                        placeholder={selectedAccountName || "Select an investment account"}
                        label="Investment Account"
                        allowCustomValue={false}
                    />

                    {/* Activity Type Selection with colors */}
                    <Text style={styles.label}>Activity Type</Text>
                    <View style={styles.pickerContainer}>
                        {['buy', 'sell', 'deposit', 'withdrawal'].map((type) => (
                            <Pressable
                                key={type}
                                style={[
                                    styles.activityOption,
                                    activityType === type && {
                                        ...styles.selectedActivity,
                                        backgroundColor: getActivityTypeColor(type)
                                    }
                                ]}
                                onPress={() => setActivityType(type as typeof activityType)}
                            >
                                <Text style={[
                                    styles.activityText,
                                    activityType === type && styles.selectedActivityText
                                ]}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Asset Information */}
                    <StockSearchModal
                        onSelect={(symbol, name) => {
                            setAssetSymbol(symbol);
                            setAssetName(name);
                        }}
                        placeholder={assetSymbol || "Search for a stock or ETF"}
                        label="Asset Symbol"
                    />

                    {/* Transaction Details */}
                    <Text style={styles.label}>Transaction Date</Text>
                    <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
                        <Text style={styles.dateButtonText}>
                            {transactionDate.toLocaleDateString()}
                        </Text>
                    </Pressable>

                    <TextInput
                        label="Quantity"
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                        style={styles.input}
                    />

                    <TextInput
                        label="Unit Price"
                        value={unitPrice}
                        onChangeText={setUnitPrice}
                        keyboardType="numeric"
                        style={styles.input}
                    />

                    <TextInput
                        label="Fee"
                        value={fee}
                        onChangeText={setFee}
                        keyboardType="numeric"
                        style={styles.input}
                    />

                    <TextInput
                        label="Tax"
                        value={tax}
                        onChangeText={setTax}
                        keyboardType="numeric"
                        style={styles.input}
                    />

                    <Button 
                        mode="contained" 
                        onPress={handleSubmit} 
                        style={styles.submitButton}
                    >
                        {transaction ? 'Update Transaction' : 'Create Transaction'}
                    </Button>
                </View>
            </ScrollView>

            {/* Date Picker Modal */}
            <Modal
                isVisible={showDatePicker}
                onBackdropPress={() => setShowDatePicker(false)}
                onSwipeComplete={() => setShowDatePicker(false)}
                style={styles.modal}
                swipeDirection="down"
                propagateSwipe
            >
                <View style={styles.modalContent}>
                    <DatePicker
                        date={transactionDate}
                        onChange={(params) => handleDateChange(params.date)}
                        mode="single"
                        calendarTextStyle={styles.datePicker}
                        selectedTextStyle={styles.datePicker}
                        weekDaysTextStyle={styles.datePicker}
                        monthContainerStyle={styles.monthContainerStyle}
                        yearContainerStyle={styles.monthContainerStyle}
                        selectedItemColor={darkTheme.colors.primary}
                        headerContainerStyle={styles.datePickerHeader}
                        headerTextStyle={styles.datePickerHeaderText}
                        dayContainerStyle={styles.datePickerDayContainer}
                        selectedRangeBackgroundColor={darkTheme.colors.primary}
                        weekDaysContainerStyle={styles.datePickerDayContainer}
                        timePickerContainerStyle={styles.datePicker}
                        buttonNextIcon={<Ionicons name="chevron-forward" size={24} color={darkTheme.colors.primary} />}
                        buttonPrevIcon={<Ionicons name="chevron-back" size={24} color={darkTheme.colors.primary} />}
                    />
                    <Button 
                        mode="outlined" 
                        onPress={() => setShowDatePicker(false)}
                        style={styles.closeButton}
                    >
                        Close
                    </Button>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: darkTheme.colors.background,
    },
    scrollContainer: {
        padding: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
        flex: 1,
        textAlign: 'center',
    },
    form: {
        gap: 16,
    },
    label: {
        fontSize: 16,
        color: darkTheme.colors.text,
        marginBottom: 8,
    },
    input: {
        backgroundColor: darkTheme.colors.surface,
        marginBottom: 16,
    },
    pickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
        alignItems: 'center',
        alignContent: 'center',
        alignSelf: 'center',
    },
    accountOption: {
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: darkTheme.colors.border,
    },
    selectedAccount: {
        backgroundColor: darkTheme.colors.primary,
    },
    accountText: {
        color: darkTheme.colors.text,
    },
    activityOption: {
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: darkTheme.colors.border,
        alignItems: 'center',
        minWidth: 5,
    },
    selectedActivity: {
    },
    activityText: {
        color: darkTheme.colors.text,
    },
    selectedActivityText: {
        color: darkTheme.colors.white,
        fontWeight: 'bold',
    },
    dateButton: {
        padding: 16,
        backgroundColor: darkTheme.colors.surface,
        borderRadius: 8,
        marginBottom: 16,
    },
    dateButtonText: {
        color: darkTheme.colors.text,
    },
    submitButton: {
        marginTop: 24,
    },
    modal: {
        justifyContent: 'flex-end',
        margin: 0,
    },
    datePicker: {
        width: '100%',
        color: darkTheme.colors.textSecondary,
        textAlign: 'center',
    },
    datePickerHeader: {
        backgroundColor: darkTheme.colors.surface,
        color: darkTheme.colors.text,
    },
    datePickerHeaderText: {
        color: darkTheme.colors.text,
    },
    datePickerDayContainer: {
        backgroundColor: darkTheme.colors.surface,
        color: darkTheme.colors.text,
    },
    monthContainerStyle: {
        backgroundColor: darkTheme.colors.surface,
        color: darkTheme.colors.text,
    },
    closeButton: {
        marginTop: darkTheme.spacing.m,
    },
});
