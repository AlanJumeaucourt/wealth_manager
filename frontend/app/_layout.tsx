import { darkTheme } from '@/constants/theme';
import { AuthProvider } from '@/context/AuthContext';
import store from '@/store';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PaperProvider>
        <AuthProvider>
          <SafeAreaProvider>
            <StatusBar style="light" backgroundColor={darkTheme.colors.background} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: darkTheme.colors.background,
                },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
            </Stack>
          </SafeAreaProvider>
        </AuthProvider>
      </PaperProvider>
    </Provider>
  );
}