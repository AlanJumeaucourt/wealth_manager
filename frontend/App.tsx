import { darkTheme } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import store from '@/store';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isLoading, checkAuthStatus } = useAuth();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await checkAuthStatus();
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        // Hide splash screen once we're done checking auth
        await SplashScreen.hideAsync();
      }
    };

    initializeApp();
  }, []);

  // Show splash screen while checking auth
  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <PaperProvider theme={darkTheme}>
        <SafeAreaProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </SafeAreaProvider>
      </PaperProvider>
    </Provider>
  );
} 