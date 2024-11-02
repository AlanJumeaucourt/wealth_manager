import { Tabs } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { darkTheme } from '../../../constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: string = 'circle';

          switch (route.name) {
            case 'accounts':
              iconName = 'account-circle';
              break;
            case 'transactions':
              iconName = 'swap-horizontal';
              break;
            case 'investment':
              iconName = 'trending-up';
              break;
            case 'budget':
              iconName = 'wallet';
              break;
            case 'wealth':
              iconName = 'finance';
              break;
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
    />
  );
} 