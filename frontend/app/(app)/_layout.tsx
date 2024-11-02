import { Stack, Tabs } from 'expo-router';
import { useEffect } from 'react';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { darkTheme } from '../../constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useRouter, Redirect } from 'expo-router';

export default function AppLayout() {
  const { isLoggedIn, checkAuthStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const initializeAuth = async () => {
      await checkAuthStatus();
    };
    initializeAuth();
  }, []);

  if (!isLoggedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack>
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="transaction/[id]"
        options={{ 
          presentation: 'modal',
          headerShown: false 
        }}
      />
      <Stack.Screen
        name="add-transaction"
        options={{ 
          presentation: 'modal',
          headerShown: false 
        }}
      />
      {/* Add other modal/detail screens here */}
    </Stack>
  );
} 