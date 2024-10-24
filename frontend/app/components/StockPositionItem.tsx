import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { darkTheme } from '@/constants/theme';

const StockPositionItem: React.FC<StockPositionItemProps> = ({ position, onPress }) => {
    const formatCurrency = (value: number) => value.toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    });

    const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

    return (
        <Pressable onPress={onPress} style={styles.stockPositionItem}>
            <Text style={styles.stockSymbol}>{position.asset_symbol}</Text>
            <Text style={styles.stockName}>{position.asset_name}</Text>
            <Text style={styles.stockDetails}>
                Quantity: {position.total_quantity.toLocaleString()}
            </Text>
            <Text style={styles.stockDetails}>
                Average Price: {formatCurrency(position.average_price)}
            </Text>
            {position.current_price > 0 ? (
                <Text style={styles.stockDetails}>
                    Current Price: {formatCurrency(position.current_price)}
                </Text>
            ) : (
                <Text style={styles.warningText}>Current price unavailable</Text>
            )}
            <Text style={[
                styles.stockPerformance, 
                position.performance >= 0 ? styles.positivePerformance : styles.negativePerformance
            ]}>
                Performance: {formatPercentage(position.performance)}
            </Text>
            <View style={styles.valueContainer}>
                <Text style={styles.stockValue}>
                    Total Value: {formatCurrency(position.total_value)}
                </Text>
                <Text style={[
                    styles.gainLoss,
                    position.unrealized_gain >= 0 ? styles.positivePerformance : styles.negativePerformance
                ]}>
                    {formatCurrency(position.unrealized_gain)}
                </Text>
            </View>
        </Pressable>
    );
};

// Add to styles
const styles = StyleSheet.create({
    // ... existing styles ...
    warningText: {
        color: darkTheme.colors.warning,
        fontSize: 14,
        fontStyle: 'italic',
    },
});
