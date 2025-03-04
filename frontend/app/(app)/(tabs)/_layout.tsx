import { darkTheme } from '@/constants/theme';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Calculate bottom padding based on platform and safe area
  const bottomPadding = Platform.select({
    ios: Math.max(insets.bottom, 20), // At least 20 points on iOS
    android: 8, // Default padding on Android
    default: 8,
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: darkTheme.colors.surface,
          borderTopColor: darkTheme.colors.border,
          borderTopWidth: 1,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          height: 60 + (Platform.OS === 'ios' ? insets.bottom : 0), // Adjust height for iOS
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: darkTheme.colors.primary,
        tabBarInactiveTintColor: darkTheme.colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginBottom: 4,
        },
        tabBarItemStyle: {
          padding: 4,
        }
      }}
    >
      <Tabs.Screen
        name="accounts"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="account-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="swap-horizontal" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="investment"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="trending-up" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wealth"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="finance" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
