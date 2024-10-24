import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { darkTheme } from '../constants/theme';

export default function RootLayout() {
  return (
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
  );
}

