import React, { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LineChart } from 'react-native-gifted-charts';
import { darkTheme } from '../constants/theme';
import { fetchWealthData } from "./api/bankApi";
import sharedStyles from './styles/sharedStyles';

interface DataPoint {
    value: number;
    date: string;
}

export default function WealthScreen() {
    const [selectedRange, setSelectedRange] = useState("1Y");
    const [wealthData, setWealthData] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const endDate = new Date();
                const startDate = new Date();

                switch (selectedRange) {
                    case "1M":
                        startDate.setMonth(startDate.getMonth() - 1);
                        break;
                    case "3M":
                        startDate.setMonth(startDate.getMonth() - 3);
                        break;
                    case "6M":
                        startDate.setMonth(startDate.getMonth() - 6);
                        break;
                    case "1Y":
                        startDate.setFullYear(startDate.getFullYear() - 1);
                        break;
                    case "3Y":
                        startDate.setFullYear(startDate.getFullYear() - 3);
                        break;
                    case "5Y":
                        startDate.setFullYear(startDate.getFullYear() - 5);
                        break;
                    case "Max":
                        startDate.setFullYear(2000);
                        break;
                    default:
                        break;
                }

                const data = await fetchWealthData(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
                setWealthData(data);
            } catch (error) {
                console.error("Error fetching wealth data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [selectedRange]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={darkTheme.colors.primary} />
            </View>
        );
    }

    const formatData = (): DataPoint[] => {
        return Object.entries(wealthData).map(([date, value]) => ({
            value: parseFloat(value.toFixed(2)),
            date
        }));
    };

    const calculateMaxPoints = (dataLength: number): number => {
        // Fonction exponentielle décroissante pour calculer le nombre maximum de points
        const baseMax = 250; // Nombre maximum de points pour un petit ensemble de données
        const minMax = 100; // Nombre minimum de points pour un grand ensemble de données
        const decayFactor = 0.0005; // Facteur de décroissance, ajustez selon vos besoins

        return Math.max(
            Math.floor(baseMax * Math.exp(-decayFactor * dataLength)),
            minMax
        );
    };

    const reduceDataPoints = (data: DataPoint[]): DataPoint[] => {
        const maxPoints = calculateMaxPoints(data.length);
        if (data.length <= maxPoints) return data;
        const interval = Math.ceil(data.length / maxPoints);
        return data.filter((_, index) => index % interval === 0);
    };

    const data = reduceDataPoints(formatData());

    const minValue = () => {
        const maxValue = Math.max(...data.map(point => point.value));
        const minValue = Math.min(...data.map(point => point.value));
        const valueRange = maxValue - minValue;
        const value = minValue - (valueRange * 0.3)
        if (value < 0) {
            return 0;
        }
        return value;
    };

    const screenWidth = Dimensions.get('window').width;

    const calculateSpacing = (width: number, dataLength: number): number => {
        const minSpacing = 1; // Minimum spacing
        const maxSpacing = 10; // Maximum spacing
        const calculatedSpacing = Math.max(minSpacing, Math.min(maxSpacing, (width - 60) / (dataLength + 1))); // Adjusted width calculation
        return calculatedSpacing;
    };

    // Update the spacing calculation
    const spacing = calculateSpacing(screenWidth, data.length); // Calculate spacing based on width and data length


    return (
        <View style={[sharedStyles.container]}>
            <View style={sharedStyles.header}>
                <Image
                    source={require('./../assets/images/logo-removebg-white.png')}
                    style={{ width: 30, height: 30 }}
                    resizeMode="contain"
                />
                <View style={sharedStyles.headerTitleContainer}>
                    <Text style={sharedStyles.headerTitle}>Wealth over time</Text>
                </View>
            </View>
            <View style={sharedStyles.body}>
                <View style={styles.buttonContainer}>
                    {["1M", "3M", "6M", "1Y", "3Y", "5Y", "Max"].map((range) => (
                        <TouchableOpacity
                            key={range}
                            style={[
                                styles.button,
                                selectedRange === range && styles.selectedButton,
                            ]}
                            onPress={() => setSelectedRange(range)}
                        >
                            <Text style={[
                                styles.buttonText,
                                selectedRange === range && styles.selectedButtonText
                            ]}>
                                {range}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={darkTheme.colors.primary} />
                    </View>
                ) : (
                    <View style={styles.graphContainer}>
                        <LineChart
                            areaChart
                            data={data}
                            width={screenWidth - 60}
                            height={300}
                            spacing={spacing}
                            adjustToWidth={true}
                            color={darkTheme.colors.primary}
                            thickness={1.5}
                            startFillColor={`${darkTheme.colors.primary}40`}
                            endFillColor={`${darkTheme.colors.primary}10`}
                            startOpacity={0.9}
                            endOpacity={0.2}
                            initialSpacing={0}
                            noOfSections={5}
                            yAxisOffset={minValue()}
                            yAxisColor="transparent"
                            xAxisColor="transparent"
                            yAxisTextStyle={{ color: darkTheme.colors.textTertiary }}
                            xAxisTextStyle={{ color: darkTheme.colors.textTertiary }}
                            hideRules
                            hideDataPoints
                            showVerticalLines={false}
                            xAxisLabelTextStyle={{ color: darkTheme.colors.textTertiary, fontSize: 10 }}
                            yAxisTextNumberOfLines={1}
                            yAxisLabelSuffix="€"
                            yAxisLabelPrefix=""
                            rulesType="solid"
                            xAxisThickness={0}
                            rulesColor="rgba(0, 0, 0, 0.1)"
                            curved
                            animateOnDataChange
                            animationDuration={1000}
                            pointerConfig={{
                                showPointerStrip: true,
                                pointerStripWidth: 2,
                                pointerStripUptoDataPoint: true,
                                pointerStripColor: 'rgba(0, 0, 0, 0.5)',
                                width: 10,
                                height: 10,
                                radius: 6,
                                pointerLabelWidth: 150,
                                pointerLabelHeight: 90,
                                activatePointersOnLongPress: false,
                                autoAdjustPointerLabelPosition: true,
                                pointerLabelComponent: (items: any) => {
                                    const item = items[0];
                                    return (
                                        <View style={styles.tooltipContainer}>
                                            <Text style={styles.tooltipValue}>{item.value.toFixed(0)} €</Text>
                                            <Text style={styles.tooltipDate}>{new Date(item.date).toDateString()}</Text>
                                        </View>
                                    );
                                },
                            }}
                        />
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    subtitle: {
        fontSize: 16,
        color: darkTheme.colors.textSecondary,
        marginBottom: darkTheme.spacing.m,
    },
    buttonContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: darkTheme.spacing.s,
        marginVertical: darkTheme.spacing.m,
    },
    button: {
        paddingVertical: darkTheme.spacing.s,
        paddingHorizontal: darkTheme.spacing.m,
        borderRadius: darkTheme.borderRadius.m,
        backgroundColor: darkTheme.colors.surface,
    },
    selectedButton: {
        backgroundColor: darkTheme.colors.primary,
    },
    buttonText: {
        color: darkTheme.colors.textSecondary,
        fontSize: 14,
    },
    selectedButtonText: {
        color: darkTheme.colors.background,
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    graphContainer: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.l,
        padding: darkTheme.spacing.m,
        marginVertical: darkTheme.spacing.m,
        ...darkTheme.shadows.medium,
    },
    tooltipContainer: {
        backgroundColor: darkTheme.colors.surface,
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
        borderColor: darkTheme.colors.primary,
        borderWidth: 1,
    },
    tooltipValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: darkTheme.colors.primary,
    },
    tooltipDate: {
        fontSize: 14,
        color: 'gray',
        marginTop: 5,
    },
});
