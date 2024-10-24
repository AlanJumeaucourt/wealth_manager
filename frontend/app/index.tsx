import { AuthProvider, useAuth } from '@/context/AuthContext'; // Ensure correct import path
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Sentry from "@sentry/react-native";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Provider } from 'react-redux';

import { darkTheme } from '../constants/theme';
import store from '../store';
import LoginScreen from './(auth)/login';
import RegisterScreen from './(auth)/register';
import AccountsScreen from './AccountsScreen';
import AddAccountScreen from './AddAccountScreen';
import AddTransactionScreen from './AddTransactionScreen';
import BudgetDetailScreen from './BudgetDetailScreen';
import BudgetScreen from './BudgetScreen';
import InvestmentScreen from './InvestmentScreen';
import TransactionDetails from './TransactionDetails';
import TransactionsScreen from './TransactionsScreen';
import TransactionsScreenAccount from './TransactionsScreenAccount';
import WealthDashboard from './WealthScreen';

// Initialize Sentry for error tracking
Sentry.init({
  dsn: "https://d12d7aa6d6edf166709997c29591227d@o4508077260996608.ingest.de.sentry.io/4508077266239568",
  tracesSampleRate: 1.0,
  _experiments: {
    profilesSampleRate: 1.0,
    replaysSessionSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
  },
  integrations: [
    Sentry.mobileReplayIntegration(),
  ],
});

Sentry.mobileReplayIntegration({
  maskAllText: true,
  maskAllImages: true,
  maskAllVectors: true,
});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack Navigator for Accounts Tab
function AccountsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AccountsMain"
        component={AccountsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddAccount"
        component={AddAccountScreen}
        options={{ title: 'Add Account', headerShown: false }}
      />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{ title: 'Add Transaction', headerShown: false }}
      />
      <Stack.Screen
        name="TransactionsScreenAccount"
        component={TransactionsScreenAccount}
        options={{ title: 'Transaction Details', headerShown: false }}
      />
      <Stack.Screen
        name="TransactionDetails"
        component={TransactionDetails}
        options={{ title: 'Transaction Details', headerShown: false }}
      />
      {/* Add more screens related to Accounts here */}
    </Stack.Navigator>
  );
}

// Stack Navigator for Transactions Tab
function TransactionsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="TransactionsMain"
        component={TransactionsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{ title: 'Add Transaction', headerShown: false }}
      />
      <Stack.Screen
        name="TransactionsScreenAccount"
        component={TransactionsScreenAccount}
        options={{ title: 'Account Transactions', headerShown: false }}
      />
      <Stack.Screen
        name="BudgetDetail"
        component={BudgetDetailScreen}
        options={{ title: 'Budget Details', headerShown: false }}
      />
      {/* Add more screens related to Transactions here */}
    </Stack.Navigator>
  );
}

// Stack Navigator for Investment Tab
function InvestmentStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="InvestmentMain"
        component={InvestmentScreen}
        options={{ headerShown: false }}
      />
      {/* Add more screens related to Investment here */}
    </Stack.Navigator>
  );
}

// Stack Navigator for Budget Tab
function BudgetStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="BudgetMain"
        component={BudgetScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BudgetDetail"
        component={BudgetDetailScreen}
        options={{ title: 'Budget Details', headerShown: false }}
      />
      {/* Add more screens related to Budget here */}
    </Stack.Navigator>
  );
}

// Stack Navigator for Wealth Tab
function WealthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="WealthMain"
        component={WealthDashboard}
        options={{ headerShown: false }}
      />
      {/* Add more screens related to Wealth here */}
    </Stack.Navigator>
  );
}

// Main Tabs Navigator with Nested Stack Navigators
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: string = 'circle';

          switch (route.name) {
            case 'Accounts':
              iconName = 'account-circle';
              break;
            case 'Transactions':
              iconName = 'swap-horizontal';
              break;
            case 'Investment':
              iconName = 'trending-up';
              break;
            case 'Budget':
              iconName = 'wallet';
              break;
            case 'Wealth':
              iconName = 'finance';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        headerShown: false,
        tabBarActiveTintColor: darkTheme.colors.primary,
        tabBarInactiveTintColor: darkTheme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: darkTheme.colors.surface,
          borderTopColor: darkTheme.colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginBottom: 4,
        },
        tabBarItemStyle: {
          padding: 4,
        },
      })}
    >
      <Tab.Screen name="Accounts" component={AccountsStack} />
      <Tab.Screen name="Transactions" component={TransactionsStack} />
      <Tab.Screen name="Investment" component={InvestmentStack} />
      <Tab.Screen name="Budget" component={BudgetStack} />
      <Tab.Screen name="Wealth" component={WealthStack} />
    </Tab.Navigator>
  );
}

// Define AuthStack
function AuthStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      {/* Add more authentication-related screens here if needed */}
    </Stack.Navigator>
  );
}

function Appdd() {
  const { isLoggedIn, checkAuthStatus } = useAuth(); // Destructure checkAuthStatus
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      await checkAuthStatus(); // Use the exposed checkAuthStatus
      setLoading(false);
    };
    initializeAuth();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={darkTheme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer independent={true}>
      {isLoggedIn ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          {/* Add any additional logged-in screens here */}
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="AuthStack" component={AuthStackNavigator} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <PaperProvider>
        <AuthProvider>
          <Appdd />
        </AuthProvider>
      </PaperProvider>
    </Provider>
  );
}


const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: darkTheme.colors.background,
  },
});

export { AuthStackNavigator as AuthStack, MainTabs };

