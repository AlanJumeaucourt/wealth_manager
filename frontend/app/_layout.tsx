import { AuthProvider } from '@/context/AuthContext';
import { Slot, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { darkTheme } from '../constants/theme';
import store from '../store';

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
                  paddingBottom: Platform.OS === 'ios' ? 20 : 0,
                },
                animation: 'slide_from_right',
              }}
            />
          </SafeAreaProvider>
        </AuthProvider>
      </PaperProvider>
    </Provider>
  );
}