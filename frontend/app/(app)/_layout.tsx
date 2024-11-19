import { darkTheme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: darkTheme.colors.background,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
    </Stack>
  );
} 