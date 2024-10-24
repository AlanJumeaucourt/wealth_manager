import { Account } from '@/types/account';
import { Bank } from '@/types/bank';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAccounts } from '../actions/accountActions';
import { fetchBanks } from '../actions/bankActions';
import { darkTheme } from '../constants/theme';
import { createAccount, createBank, deleteBank, updateAccount } from './api/bankApi';
import { AddButton } from './components/AddButton';
import { BackButton } from './components/BackButton';
import { DeleteButton } from './components/DeleteButton';
import sharedStyles from './styles/sharedStyles';

export default function AddAccountScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const dispatch = useDispatch();
    const { banks } = useSelector((state: any) => state.banks);
    console.log('banks in AddAccountScreen : ', banks);

    const account = route.params?.account as Account;
    const [formData, setFormData] = useState({
        AccountName: account ? account.name : '',
        AccountType: account ? account.type : '',
        AccountBankId: account ? account.bank_id : '',
        AccountCurrency: account ? account.currency : 'EUR',
        newBankName: '',
    });
    const [isAddingNewBank, setIsAddingNewBank] = useState(false);

    const accountTypes = ['checking', 'savings', 'investment'];

    useEffect(() => {
        dispatch(fetchBanks());
    }, [dispatch]);

    const handleChange = (name: string, value: string) => {
        setFormData(prevState => ({
            ...prevState,
            [name]: value,
        }));
    };

    const handleBankSelection = (itemValue: string) => {
        if (itemValue === 'add_new') {
            setIsAddingNewBank(true);
            setFormData(prevState => ({
                ...prevState,
                AccountBankId: '',
            }));
        } else {
            setIsAddingNewBank(false);
            setFormData(prevState => ({
                ...prevState,
                AccountBankId: parseInt(itemValue),
            }));
        }
    };

    const handleAddOrUpdateAccount = async () => {
        const { AccountName, AccountType, AccountBankId: selectedBank, AccountCurrency, newBankName } = formData;

        if (!AccountName || !AccountType || (!selectedBank && !newBankName) || !AccountCurrency) {
            console.error('Please fill in all fields');
            return;
        }

        let bankId = parseInt(selectedBank);

        if (isAddingNewBank) {
            try {
                const newBank = await createBank(newBankName);
                bankId = newBank.id;
            } catch (error) {
                console.error('Error adding bank:', error);
                return;
            }
        }

        const accountData = {
            name: AccountName,
            type: AccountType,
            bank_id: bankId,
            currency: AccountCurrency,
        };

        try {
            if (account) {
                // Update existing account logic here
                await updateAccount(account.id, accountData);
                Alert.alert('Account updated successfully!');
                navigation.goBack();
            } else {
                await createAccount(accountData);
                Alert.alert('Account created successfully!');
                navigation.goBack();
            }
            dispatch(fetchAccounts());
        } catch (error) {
            console.error('Error adding account:', error);
            Alert.alert('An error occurred. Please try again.');
        }
    };

    const showAccountTypePicker = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', ...accountTypes],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex !== 0) {
                        setFormData(prevState => ({
                            ...prevState,
                            AccountType: accountTypes[buttonIndex - 1],
                        }));
                    }
                }
            );
        }
    };

    const showBankPicker = () => {
        if (Platform.OS === 'ios') {
            const options = ['Cancel', ...banks.map((bank: Bank) => bank.name), 'Add new bank'];
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: options,
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex === 0) {
                        return;
                    } else if (buttonIndex === options.length - 1) {
                        handleBankSelection('add_new');
                    } else {
                        handleBankSelection(banks[buttonIndex - 1].id.toString());
                    }
                }
            );
        }
    };

    const options = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];
    const showCurrencyPicker = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', ...options],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex !== 0) {
                        setFormData(prevState => ({
                            ...prevState,
                            AccountCurrency: options[buttonIndex - 1],
                        }));
                    }
                }
            );
        }
    };

    const renderPicker = (label: string, value: string, pickerWidth: number = 100, onPress: () => void) => {
        const pickerStyle = StyleSheet.create({
            pickerContainer: {
                marginBottom: 16,
            },
            pickerButton: {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: darkTheme.colors.surface,
                borderRadius: darkTheme.borderRadius.m,
                padding: darkTheme.spacing.m,
                marginBottom: darkTheme.spacing.s,
                borderWidth: 1,
                borderColor: darkTheme.colors.border,
                width: `${pickerWidth}%`,
            },
            pickerLabel: {
                fontSize: 16,
                color: darkTheme.colors.text,
            },
            pickerValue: {
                fontSize: 16,
                color: darkTheme.colors.textSecondary,
            },
            picker: {
                backgroundColor: darkTheme.colors.surface,
                color: darkTheme.colors.text,
                borderRadius: darkTheme.borderRadius.m,
                borderWidth: 1,
                borderColor: darkTheme.colors.border,
                marginBottom: 16,
            },

        })

        if (Platform.OS === 'ios') {
            return (
                <TouchableOpacity onPress={onPress} style={pickerStyle.pickerButton}>
                    <Text style={pickerStyle.pickerLabel}>
                        {value ? value : `Select ${label}`}
                    </Text>
                </TouchableOpacity>
            );
        } else {
            return (
                <View>
                    <Picker
                        selectedValue={value}
                        onValueChange={onPress}
                        style={pickerStyle.picker}
                    >
                        {options.map((option, index) => (
                            <Picker.Item key={index} value={option} label={option} />
                        ))}
                    </Picker>
                </View>
            );
        }
    };

    const handleDeleteBank = async (bankId: number) => {
        try {
            await deleteBank(bankId); // Ensure this returns a promise
            dispatch(fetchBanks());
            setSelectedBank('');
        } catch (error) {
            console.error('Error deleting bank:', error);
            throw error; // Rethrow the error to be caught in DeleteButton
        }
    };

    const handleAddBank = async () => {
        if (!newBankName) {
            console.error('Please enter a bank name');
            return;
        }

        try {
            await createBank(newBankName);
            dispatch(fetchBanks());
            setNewBankName('');
            setIsAddingNewBank(false);
            Alert.alert('Bank created successfully!');
        } catch (error) {
            console.error('Error adding bank:', error);
            Alert.alert('An error occurred. Please try again.');
        }
    };

    return (
        <View style={sharedStyles.container}>
            <View style={sharedStyles.header}>
                <BackButton />
                <View style={sharedStyles.headerTitleContainer}>
                    <Text style={sharedStyles.headerTitle}>{account ? `Edit Account` : 'Add New Account'}</Text>
                </View>
                <Image
                    source={require('./../assets/images/logo-removebg-white.png')}
                    style={{ width: 30, height: 30 }}
                    resizeMode="contain"
                />
            </View>
            <View style={sharedStyles.body}>
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <Text style={styles.label}>Account Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter account name"
                        placeholderTextColor={darkTheme.colors.textSecondary}
                        value={formData.AccountName}
                        onChangeText={value => handleChange('AccountName', value)}
                    />

                    <Text style={styles.label}>Account Type</Text>
                    {renderPicker(
                        'Account Type',
                        formData.AccountType,
                        100,
                        Platform.OS === 'ios' ? showAccountTypePicker : (itemValue) => setNewAccountType(itemValue)
                    )}

                    <Text style={styles.label}>Bank</Text>
                    {!isAddingNewBank && (
                        <View style={styles.bankSelectionContainer}>
                            {renderPicker(
                                'Bank',
                                formData.AccountBankId ? banks.find((bank: Bank) => bank.id === formData.AccountBankId)?.name : '',
                                isAddingNewBank ? 85 : 100,
                                Platform.OS === 'ios' ? showBankPicker : () => handleBankSelection(itemValue)
                            )}
                            <View style={styles.deleteButtonContainer}>
                                <DeleteButton
                                    deleteText=""
                                    deleteTextAlert="Are you sure you want to delete this bank?"
                                    deleteFunction={() => handleDeleteBank(parseInt(formData.AccountBankId))} // This should return a promise
                                />
                            </View>
                        </View>
                    )}
                    {isAddingNewBank && (
                        <View style={styles.bankSelectionContainer}>
                            <TextInput
                                style={[styles.input, { width: '85%' }]}
                                placeholder="Enter new bank name"
                                placeholderTextColor={darkTheme.colors.textSecondary}
                                value={formData.newBankName}
                                onChangeText={value => handleChange('newBankName', value)}
                            />
                            <View style={styles.addButtonContainer}>
                                <AddButton
                                    addText=""
                                    addTextAlert="Are you sure you want to add this bank?"
                                    addFunction={handleAddBank}
                                />
                            </View>
                        </View>
                    )}

                    <Text style={styles.label}>Currency</Text>
                    {renderPicker(
                        'Currency',
                        formData.AccountCurrency,
                        100,
                        Platform.OS === 'ios' ? showCurrencyPicker : (itemValue) => setNewAccountCurrency(itemValue)
                    )}

                    <Button mode="contained" onPress={handleAddOrUpdateAccount} style={styles.editButton}>
                        {account ? 'Update Account' : 'Add Account'}
                    </Button>
                    <Button mode="contained" onPress={() => navigation.goBack()} style={styles.closeButton}>
                        Close
                    </Button>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
        padding: darkTheme.spacing.m,
    },
    formContainer: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.l,
        padding: darkTheme.spacing.m,
        ...darkTheme.shadows.medium,
    },
    label: {
        fontSize: 16,
        color: darkTheme.colors.text,
        marginBottom: darkTheme.spacing.s,
        marginTop: darkTheme.spacing.m,
    },
    input: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.m,
        borderWidth: 1,
        borderColor: darkTheme.colors.border,
        color: darkTheme.colors.text,
        paddingHorizontal: darkTheme.spacing.m,
        paddingVertical: darkTheme.spacing.s,
        marginBottom: darkTheme.spacing.s,
    },
    editButton: {
        marginTop: darkTheme.spacing.l,
        marginBottom: darkTheme.spacing.m,
        backgroundColor: darkTheme.colors.primary,
    },
    closeButton: {
        marginTop: darkTheme.spacing.m,
        backgroundColor: darkTheme.colors.primary,
    },
    bankSelectionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: darkTheme.spacing.s,
    },
    deleteButtonContainer: {
        width: '15%',
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    addButtonContainer: {
        width: '15%',
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.m,
        padding: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.s,
        borderWidth: 1,
        borderColor: darkTheme.colors.border,
    },
    pickerLabel: {
        fontSize: 16,
        color: darkTheme.colors.text,
    },
    pickerValue: {
        fontSize: 16,
        color: darkTheme.colors.textSecondary,
    },
    picker: {
        backgroundColor: darkTheme.colors.surface,
        color: darkTheme.colors.text,
        borderRadius: darkTheme.borderRadius.m,
        borderWidth: 1,
        borderColor: darkTheme.colors.border,
    },
});
