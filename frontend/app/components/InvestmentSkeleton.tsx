import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { darkTheme } from '@/constants/theme';

const SkeletonItem = () => {
    const animatedValue = new Animated.Value(0);

    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View style={[styles.skeletonItem, { opacity }]} />
    );
};

export const InvestmentSkeleton = () => {
    return (
        <View style={styles.container}>
            {/* Header Skeleton */}
            <View style={styles.headerSkeleton}>
                <SkeletonItem />
                <SkeletonItem />
            </View>

            {/* Chart Skeleton */}
            <View style={styles.chartSkeleton}>
                <SkeletonItem />
            </View>

            {/* Positions Skeleton */}
            <View style={styles.positionsSkeleton}>
                <SkeletonItem />
                <SkeletonItem />
                <SkeletonItem />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: darkTheme.spacing.m,
        backgroundColor: darkTheme.colors.background,
    },
    headerSkeleton: {
        gap: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.l,
    },
    chartSkeleton: {
        height: 200,
        marginBottom: darkTheme.spacing.l,
    },
    positionsSkeleton: {
        gap: darkTheme.spacing.m,
    },
    skeletonItem: {
        height: 60,
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.m,
    },
});
