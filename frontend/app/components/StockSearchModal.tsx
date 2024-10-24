import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { darkTheme } from '@/constants/theme';
import { searchStocks } from '../api/bankApi';
import SearchableModal from './SearchableModal';

interface StockSearchModalProps {
    onSelect: (symbol: string, name: string) => void;
    placeholder?: string;
    label?: string;
}

// Modified to match Account interface requirements
interface StockResult {
    id: number;
    name: string;
    symbol: string;
    type: 'investment';  // Set as 'investment' to match Account type
    exchange: string;
    currency: string;
    balance: number;
    bank_id: number;
    tags: string[];
}

export default function StockSearchModal({
    onSelect,
    placeholder = "Search for a stock or ETF",
    label = "Select Asset",
}: StockSearchModalProps) {
    const [searchResults, setSearchResults] = useState<StockResult[]>([]);

    const handleSearch = async (query: string) => {
        try {
            const results = await searchStocks(query);
            // Transform the API results to match the Account interface
            const transformedResults: StockResult[] = results.map((result: any, index: number) => ({
                id: index,
                name: `${result.name} (${result.exchange})`,
                symbol: result.symbol,
                type: 'investment',
                exchange: result.exchange,
                currency: result.currency,
                balance: 0,
                bank_id: 0,
                tags: []
            }));
            setSearchResults(transformedResults);
        } catch (error) {
            console.error('Error searching stocks:', error);
            setSearchResults([]);
        }
    };

    const renderStockItem = (item: StockResult) => (
        <View style={styles.stockItem}>
            <Text style={styles.symbolText}>{item.symbol}</Text>
            <Text style={styles.nameText} numberOfLines={2}>
                {item.name}
                {item.currency && ` • ${item.currency}`}
            </Text>
        </View>
    );

    return (
        <SearchableModal
            data={searchResults}
            onSelect={(id) => {
                const selectedStock = searchResults.find(stock => stock.id === id);
                if (selectedStock) {
                    onSelect(selectedStock.symbol, selectedStock.name);
                }
            }}
            placeholder={placeholder}
            label={label}
            allowCustomValue={false}
            searchable={true}
            onSearch={handleSearch}
            renderCustomItem={renderStockItem}
        />
    );
}

const styles = StyleSheet.create({
    stockItem: {
        paddingVertical: 8,
    },
    symbolText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
    },
    nameText: {
        fontSize: 14,
        color: darkTheme.colors.textSecondary,
        marginTop: 2,
    }
});
