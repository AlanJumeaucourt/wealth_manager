/* eslint-disable react-native/no-inline-styles */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFont } from '@shopify/react-native-skia';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { expenseCategories, incomeCategories } from '../constants/categories';
import { darkTheme } from '../constants/theme';
import { fetchBudgetSummary } from './api/bankApi';
import DonutChart from './components/DonutChart';
import sharedStyles from './styles/sharedStyles';

interface Data {
  value: number;
  percentage: number;
  color: string;
  category: string;
  subcategory?: string;
  iconName?: string;
  iconSet?: string;
  transactionIds?: string[];
  type?: 'income' | 'expense';
}

const RADIUS = 130;
const STROKE_WIDTH = 20;
const OUTER_STROKE_WIDTH = 30;
const GAP = 0.03;

type PeriodType = 'month' | 'quarter' | 'year';

type BudgetDetailParams = {
  category: string;
  subcategory: string | undefined;
  transactionIds: string[] | undefined;
};

type NavigationProp = {
  navigate: (screen: string, params: BudgetDetailParams) => void;
};

export default function BudgetScreen() {
  const [data, setData] = useState<Data[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [filterType, setFilterType] = useState<'Income' | 'Expense'>('Expense'); // {{ edit: Remove 'All' from filterType state }}
  const [totalValue, setTotalValue] = useState(0);
  const decimals = useSharedValue<number[]>([]);
  const navigation = useNavigation<NavigationProp>();
  const [allData, setAllData] = useState<Data[]>([]); // {{ edit: Add allData state }}
  // Add loading state
  const [isLoading, setIsLoading] = useState(true);
  // Add states to track data availability
  const [hasIncomeData, setHasIncomeData] = useState(false);
  const [hasExpenseData, setHasExpenseData] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        let startDate, endDate;

        switch (periodType) {
          case 'month':
            startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
            endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
            break;
          case 'quarter':
            const quarterStartMonth = Math.floor(currentDate.getMonth() / 3) * 3;
            startDate = new Date(currentDate.getFullYear(), quarterStartMonth, 1).toISOString().split('T')[0];
            endDate = new Date(currentDate.getFullYear(), quarterStartMonth + 3, 0).toISOString().split('T')[0];
            break;
          case 'year':
            startDate = new Date(currentDate.getFullYear(), 0, 1).toISOString().split('T')[0];
            endDate = new Date(currentDate.getFullYear(), 11, 31).toISOString().split('T')[0];
            break;
        }

        // Modifiez votre API pour utiliser date_accountability dans la requête
        const result = await fetchBudgetSummary(startDate, endDate, 'date_accountability');
        const budgetSummary = result.total_amount;

        if (!Array.isArray(budgetSummary)) {
          throw new Error('Expected budgetSummary to be an array');
        }

        // Assign 'type' to each budget item based on category
        const categorizedBudgetSummary = budgetSummary.map((item: any) => {
          let category = expenseCategories.find(cat => cat.name.toLowerCase() === item.category.toLowerCase());
          let type: 'expense' | 'income' = 'expense';

          if (!category) {
            category = incomeCategories.find(cat => cat.name.toLowerCase() === item.category.toLowerCase());
            if (category) {
              type = 'income';
            }
          }

          if (!category) {
            console.warn(`Category "${item.category}" not found in expense or income categories.`);
            type = 'expense'; // Defaulting to 'expense'
          }

          return {
            ...item,
            type, // Assign the determined type
          };
        });

        // Filter based on filterType
        let filterBudgetSummary = categorizedBudgetSummary;
        if (filterType === 'Income') {
          filterBudgetSummary = categorizedBudgetSummary.filter(item => item.type === 'income');
        } else if (filterType === 'Expense') {
          filterBudgetSummary = categorizedBudgetSummary.filter(item => item.type === 'expense');
        }

        filterBudgetSummary = filterBudgetSummary.filter(item => item.category !== 'Virements internes');

        const total = filterBudgetSummary.reduce(
          (acc: number, currentValue: { amount: number }) => acc + currentValue.amount,
          0,
        );

        const generatePercentages = filterBudgetSummary.map((item: any) => {
          let category = expenseCategories.find(cat => cat.name.toLowerCase() === item.category.toLowerCase());
          let type: 'expense' | 'income' = 'expense';

          if (!category) {
            category = incomeCategories.find(cat => cat.name.toLowerCase() === item.category.toLowerCase());
            if (category) {
              type = 'income';
            }
          }

          if (!category) {
            console.warn(`Category "${item.category}" not found in expense or income categories.`);
            type = 'expense'; // Defaulting to 'expense'
          }

          return {
            value: parseFloat(item.amount.toFixed(2)),
            percentage: (item.amount / total) * 100,
            color: category?.color || '#cccccc',
            category: item.category,
            subcategory: item.subcategory,
            iconName: category?.iconName,
            iconSet: category?.iconSet,
            transactionIds: item.transactions_related,
            type: type,
          };
        });

        const significantSegments = generatePercentages.filter(item => item.percentage >= 3);
        const otherSegments = generatePercentages.filter(item => item.percentage < 3);

        const otherTotal = otherSegments.reduce((acc, item) => acc + item.value, 0);
        const otherPercentage = otherSegments.reduce((acc, item) => acc + item.percentage, 0);

        if (otherSegments.length > 0) {
          significantSegments.push({
            value: parseFloat(otherTotal.toFixed(2)),
            percentage: otherPercentage,
            color: '#cccccc',
            category: 'Other',
            subcategory: undefined, // Add this line
            iconName: 'help-circle-outline',
            iconSet: 'Ionicons',
            transactionIds: otherSegments.flatMap(item => item.transactionIds || []),
            type: 'expense',
          });
        }


        // Sort segments by value, ensuring 'Other' is always last
        significantSegments.sort((a, b) => {
          if (a.category === 'Other') return 1;
          if (b.category === 'Other') return -1;
          return b.value - a.value;
        });

        const generateDecimals = significantSegments.map(
          (item) => item.percentage / 100,
        );

        const totalDecimals = generateDecimals.reduce((acc, val) => acc + val, 0);
        const normalizedDecimals = generateDecimals.map((decimal) => decimal / totalDecimals);

        decimals.value = [...normalizedDecimals];

        // Update data availability states
        setHasIncomeData(categorizedBudgetSummary.some(item => item.type === 'income'));
        setHasExpenseData(categorizedBudgetSummary.some(item => item.type === 'expense'));

        setData(significantSegments);
        setTotalValue(total)
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentDate, periodType, filterType]);

  const formatPeriod = (date: Date, type: PeriodType) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric' };
    switch (type) {
      case 'month':
        options.month = 'long';
        break;
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter} ${date.getFullYear()}`;
      case 'year':
        return date.getFullYear().toString();
    }
    return date.toLocaleString('default', options);
  };

  const changePeriod = (increment: number) => {
    const newDate = new Date(currentDate);
    switch (periodType) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + increment);
        break;
      case 'quarter':
        newDate.setMonth(newDate.getMonth() + (3 * increment));
        break;
      case 'year':
        newDate.setFullYear(newDate.getFullYear() + increment);
        break;
    }
    setCurrentDate(newDate);
  };

  const font = useFont(require('./../assets/fonts/Roboto-Bold.ttf'), 45);
  const smallFont = useFont(require('./../assets/fonts/Roboto-Light.ttf'), 25);

  if (!font || !smallFont) {
    return <View />;
  }

  function NoBudget({ type, hasOtherData }: { type: 'Income' | 'Expense'; hasOtherData: boolean }) {
    return (
      <View style={styles.noBudgetContainer}>
        <Ionicons
          name={type === 'Income' ? 'cash-outline' : 'wallet-outline'}
          size={64}
          color={darkTheme.colors.textSecondary}
        />
        <Text style={styles.noBudgetText}>
          No <Text style={{ fontWeight: 'bold' }}>{type.toLowerCase()}</Text> data available for this period
        </Text>
        {hasOtherData && (
          <TouchableOpacity onPress={() => setFilterType(type === 'Income' ? 'Expense' : 'Income')}>
            <Text style={styles.otherDataText}>
              But {type === 'Income' ? 'Expense' : 'Income'} data is available for this period.{'\n'}
            </Text>

          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[sharedStyles.container]}>
      <View style={sharedStyles.header}>
        <View style={styles.headerContent}>
          <Image
            source={require('./../assets/images/logo-removebg-white.png')}
            style={{ width: 30, height: 30 }}
            resizeMode="contain"
          />
          <View style={sharedStyles.headerTitleContainer}>
            <Text style={sharedStyles.headerTitle}>Budget</Text>
          </View>
        </View>
      </View>
      <View style={styles.periodSelector}>
        <Pressable onPress={() => changePeriod(-1)} style={styles.arrowButton}>
          <Ionicons name="chevron-back" size={24} color={darkTheme.colors.text} />
        </Pressable>
        <View>
          <Text style={styles.periodText}>{formatPeriod(currentDate, periodType)}</Text>
          <View style={styles.periodTypeSelector}>
            {['month', 'quarter', 'year'].map((type) => (
              <Pressable
                key={type}
                onPress={() => setPeriodType(type as PeriodType)}
                style={[
                  styles.periodTypeButton,
                  periodType === type && styles.activePeriodType,
                ]}
              >
                <Text
                  style={[
                    styles.periodTypeText,
                    periodType === type && styles.activePeriodTypeText,
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable onPress={() => changePeriod(1)} style={styles.arrowButton}>
          <Ionicons name="chevron-forward" size={24} color={darkTheme.colors.text} />
        </Pressable>
      </View>

      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Expense</Text>
        <Switch
          value={filterType === 'Income'}
          onValueChange={(value) => setFilterType(value ? 'Income' : 'Expense')}
          thumbColor={darkTheme.colors.surface}
          trackColor={{
            false: darkTheme.colors.error,
            true: darkTheme.colors.success,
          }}
        />
        <Text style={styles.filterLabel}>Income</Text>
      </View>

      {!isLoading && (
        filterType === 'Income' && !hasIncomeData ? (
          <NoBudget type="Income" hasOtherData={hasExpenseData} />
        ) : filterType === 'Expense' && !hasExpenseData ? (
          <NoBudget type="Expense" hasOtherData={hasIncomeData} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.chartContainer}>
              <DonutChart
                radius={RADIUS}
                gap={GAP}
                strokeWidth={STROKE_WIDTH}
                outerStrokeWidth={OUTER_STROKE_WIDTH}
                font={font}
                smallFont={smallFont}
                totalValue={totalValue}
                n={data.length}
                decimals={decimals}
                colors={data.map(item => item.color)}
                totalText={filterType === 'Income' ? 'Total Income' : 'Total Expense'}
              />
            </View>
            {data.map((item, index) => (
              <Pressable
                key={index}
                style={styles.legendItem}
                onPress={() =>
                  navigation.navigate('BudgetDetail', {
                    category: item.category,
                    subcategory: item.subcategory,
                    transactionIds: item.transactionIds,
                  })
                }
              >
                <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
                  {item.iconSet === 'Ionicons' && (
                    <Ionicons name={item.iconName as any} size={16} color={darkTheme.colors.surface} />
                  )}
                </View>
                <View style={styles.legendLabelContainer}>
                  <Text style={styles.legendLabel} numberOfLines={1} ellipsizeMode="tail">
                    {item.category}
                  </Text>
                  {item.subcategory && (
                    <Text style={styles.subCategoryLabel}>{item.subcategory}</Text>
                  )}
                </View>
                <Text style={styles.legendValue}>{item.value.toLocaleString()} €</Text>
              </Pressable>
            ))}
          </ScrollView>
        )
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          {/* Add your loading indicator here */}
          <ActivityIndicator size="large" color={darkTheme.colors.primary} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: darkTheme.spacing.m,
    paddingHorizontal: darkTheme.spacing.l,
    backgroundColor: darkTheme.colors.surface,
  },
  arrowButton: {
    padding: darkTheme.spacing.s,
  },
  periodText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: darkTheme.colors.text,
    textAlign: 'center',
  },
  periodTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: darkTheme.spacing.s,
  },
  periodTypeButton: {
    paddingHorizontal: darkTheme.spacing.m,
    paddingVertical: darkTheme.spacing.s,
    borderRadius: darkTheme.borderRadius.l,
    marginHorizontal: darkTheme.spacing.xs,
  },
  activePeriodType: {
    backgroundColor: darkTheme.colors.primary,
  },
  periodTypeText: {
    fontSize: 12,
    color: darkTheme.colors.textSecondary,
  },
  activePeriodTypeText: {
    color: darkTheme.colors.surface,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: darkTheme.spacing.m,
    backgroundColor: darkTheme.colors.surface,
  },
  filterLabel: {
    fontSize: 14,
    color: darkTheme.colors.text,
    marginHorizontal: darkTheme.spacing.m,
  },
  scrollViewContent: {
    alignItems: 'center',
    padding: darkTheme.spacing.m,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: darkTheme.spacing.m,
    backgroundColor: darkTheme.colors.surface,
    marginBottom: darkTheme.spacing.s,
    borderRadius: darkTheme.borderRadius.m,
    ...darkTheme.shadows.small,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendLabelContainer: {
    flex: 1,
    marginLeft: darkTheme.spacing.m,
  },
  legendLabel: {
    fontSize: 14,
    color: darkTheme.colors.text,
    fontWeight: '500',
  },
  subCategoryLabel: {
    fontSize: 12,
    color: darkTheme.colors.textSecondary,
    marginTop: 2,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: darkTheme.colors.text,
    marginLeft: darkTheme.spacing.m,
  },
  chartContainer: {
    width: RADIUS * 2,
    height: RADIUS * 2,
    marginTop: 10,
    marginBottom: darkTheme.spacing.m,
  },
  noBudgetContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: darkTheme.spacing.xl,
  },
  noBudgetText: {
    fontSize: 16,
    color: darkTheme.colors.textSecondary,
    textAlign: 'center',
    marginTop: darkTheme.spacing.m,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    width: 30,
    height: 30,
  },
  otherDataText: {
    fontSize: 14,
    color: darkTheme.colors.primary,
    textAlign: 'center',
    marginTop: darkTheme.spacing.m,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
