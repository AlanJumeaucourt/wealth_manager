import { API_URL } from '@/config';
import { darkTheme } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import * as Sentry from "@sentry/browser";
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { login, checkAuthStatus } = useAuth();

  useEffect(() => {
    const initAuth = async () => {
      await checkAuthStatus();
    };
    initAuth();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      console.log(`Sending login request to ${API_URL}/users/login:`, { email, password });
      const response = await axios.post(`${API_URL}/users/login`, {
        email,
        password,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // Set a timeout of 10 seconds
      });

      console.log('Login response:', response);

      if (response && response.data) {
        await login(response.data.access_token); // Use the login method from context
        console.log('Token stored, redirecting to home');
        Sentry.setUser({ email: email });
        router.replace('/'); // Use Expo Router's replace for navigation
      } else {
        console.log('Invalid response data:', response);
        setError('Invalid response from server');
      }
    } catch (error) {
      console.error('Login error:', JSON.stringify(error, null, 2));
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error('Error data:', error.response.data);
          console.error('Error status:', error.response.status);
          console.error('Error headers:', error.response.headers);
          setError(`Server error: ${error.response.status} - ${error.response.data?.error || 'Unknown error'}`);
        } else if (error.request) {
          console.error('Error request:', error.request);
          setError('No response received from server. Please check your internet connection and server status.');
        } else {
          console.error('Error message:', error.message);
          setError(`An error occurred: ${error.message}`);
        }
      } else {
        console.error('Non-Axios error:', error);
        setError(`An unexpected error occurred: ${(error as Error).message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Image
          source={require('@/assets/images/logo-removebg-white.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.logoText}>WealthManager</Text>
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Welcome Back</Text>
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          theme={darkTheme}
          textColor={darkTheme.colors.text}
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          style={styles.input}
          secureTextEntry
          theme={darkTheme}
          textColor={darkTheme.colors.text}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button
          mode="contained"
          onPress={handleLogin}
          style={styles.button}
          loading={loading}
          disabled={loading}
          theme={darkTheme}
        >
          Login
        </Button>
        <Pressable onPress={() => router.push('/register')}>
          <Text style={styles.registerLink}>Don't have an account? Register here</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkTheme.colors.background,
  },
  headerContainer: {
    flex: 0.8,
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: darkTheme.colors.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  contentContainer: {
    flex: 1.2,
    justifyContent: 'flex-start',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: darkTheme.colors.text,
  },
  input: {
    marginBottom: 10,
    backgroundColor: darkTheme.colors.surface,
  },
  button: {
    marginTop: 10,
    backgroundColor: darkTheme.colors.primary,
  },
  errorText: {
    color: darkTheme.colors.error,
    textAlign: 'center',
    marginBottom: 10,
  },
  registerLink: {
    marginTop: 15,
    color: darkTheme.colors.primary,
    textAlign: 'center',
  },
});