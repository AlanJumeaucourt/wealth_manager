import { useAuth } from '@/context/AuthContext';
import { Redirect } from 'expo-router';

export default function Index() {
  const { isLoggedIn } = useAuth();

  // Redirect to the appropriate screen based on auth status
  if (isLoggedIn) {
    return <Redirect href="/(app)/(tabs)/accounts" />;
  }

  return <Redirect href="/(auth)/login" />;
}
