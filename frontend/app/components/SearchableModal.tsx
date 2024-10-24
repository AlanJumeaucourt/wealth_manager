import { colors } from '@/constants/colors';
import { darkTheme } from '@/constants/theme';
import { Account } from '@/types/account';
import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Modal from 'react-native-modal';
import sharedStyles from '../styles/sharedStyles';

interface SearchableModalProps {
    data: Account[];
    onSelect: (id: number | string) => void;
    placeholder: string;
    label: string;
    allowCustomValue?: boolean;
    searchable?: boolean;
    onSearch?: (query: string) => void;
    renderCustomItem?: (item: any) => React.ReactNode;
}

const SearchableModal: React.FC<SearchableModalProps> = ({ 
    data, 
    onSelect, 
    placeholder, 
    label, 
    allowCustomValue = false, 
    searchable = true,
    onSearch,
    renderCustomItem 
}) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Only filter locally if no onSearch prop is provided
    const filteredData = onSearch 
        ? data 
        : (searchable ? data.filter(item => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
          ) : data);

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        if (onSearch) {
            onSearch(text);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            <Pressable
                style={styles.input}
                onPress={() => setModalVisible(true)}
            >
                <Text style={styles.placeholder}>{placeholder}</Text>
            </Pressable>

            <Modal
                isVisible={modalVisible}
                onBackdropPress={() => setModalVisible(false)}
                onSwipeComplete={() => setModalVisible(false)}
                style={styles.modal}
                swipeDirection="down"
                propagateSwipe
            >
                <View style={styles.modalContent}>
                    <KeyboardAvoidingView
                        contentContainerStyle={styles.scrollViewContent}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        {searchable && (
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search..."
                                placeholderTextColor={colors.lightText}
                                value={searchQuery}
                                onChangeText={handleSearchChange}
                            />
                        )}
                        <FlatList
                            style={styles.flatList}
                            data={filteredData}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={styles.item}
                                    onPress={() => {
                                        onSelect(item.id);
                                        setModalVisible(false);
                                    }}
                                >
                                    {renderCustomItem ? (
                                        renderCustomItem(item)
                                    ) : (
                                        <View style={styles.itemRow}>
                                            <Text style={styles.itemText}>{item.name}</Text>
                                            {item.type !== 'expense' && item.type !== 'income' && (
                                                <Text style={styles.balanceText}>{item.balance.toFixed(2)} €</Text>
                                            )}
                                        </View>
                                    )}
                                </Pressable>
                            )}
                            showsVerticalScrollIndicator={true}
                        />
                        <View style={styles.buttonContainer}>
                            {allowCustomValue && (
                                <Pressable
                                    style={styles.submitButton}
                                    onPress={() => {
                                        onSelect(searchQuery);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.submitButtonText}>Add</Text>
                                </Pressable>
                            )}
                            <Pressable
                                style={[styles.closeButton, !allowCustomValue && styles.centeredButton]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.closeButtonText}>Close</Text>
                            </Pressable>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: darkTheme.spacing.s,
    },
    label: {
        fontSize: 16,
        color: darkTheme.colors.text,
        marginBottom: darkTheme.spacing.xs,
    },
    input: {
        height: 50,
        borderColor: darkTheme.colors.border,
        borderWidth: 1,
        borderRadius: darkTheme.borderRadius.m,
        paddingHorizontal: darkTheme.spacing.m,
        justifyContent: 'center',
        backgroundColor: darkTheme.colors.surface,
    },
    placeholder: {
        color: darkTheme.colors.textTertiary,
    },
    modal: {
        justifyContent: 'flex-end',
        margin: 0,
        marginBottom: 20,
    },
    modalContent: {
        backgroundColor: darkTheme.colors.surface,
        borderTopLeftRadius: darkTheme.borderRadius.l,
        borderTopRightRadius: darkTheme.borderRadius.l,
        padding: darkTheme.spacing.m,
        height: '80%',
        marginBottom: 20,
    },
    searchInput: {
        height: 40,
        borderColor: darkTheme.colors.border,
        borderWidth: 1,
        borderRadius: darkTheme.borderRadius.m,
        paddingHorizontal: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.m,
        width: '100%',
        color: darkTheme.colors.text,
        backgroundColor: darkTheme.colors.surface,
        
    },
    item: {
        padding: darkTheme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: darkTheme.colors.border,
        width: '100%',
        marginBottom: 20,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    itemText: {
        fontSize: 16,
        color: darkTheme.colors.text,
        marginRight: darkTheme.spacing.m,
    },
    balanceText: {
        fontSize: 16,
        color: darkTheme.colors.textTertiary,
    },
    submitButton: {
        marginTop: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.m,
        padding: darkTheme.spacing.m,
        backgroundColor: darkTheme.colors.primary,
        borderRadius: darkTheme.borderRadius.m,
        flex: 1,
        marginRight: darkTheme.spacing.m,
    },
    submitButtonText: {
        color: darkTheme.colors.surface,
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '600',
    },
    closeButton: {
        marginTop: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.m,
        padding: darkTheme.spacing.m,
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.m,
        borderWidth: 1,
        borderColor: darkTheme.colors.border,
        flex: 1,
    },
    closeButtonText: {
        color: darkTheme.colors.text,
        fontSize: 16,
        textAlign: 'center',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: darkTheme.spacing.m,
        marginBottom: Platform.OS === 'ios' ? darkTheme.spacing.m : 0,
    },
    centeredButton: {
        justifyContent: 'center',
    },
    flatListContainer: {
        maxHeight: 300,
        width: '100%',
        marginBottom: 20,
    },
    flatList: {
        width: '100%',
        marginBottom: 20,
    },
    scrollViewContent: {
        flexGrow: 1,
        justifyContent: 'center',
        marginBottom: 20,
    },
});

export default SearchableModal;
