import * as Sentry from "@sentry/browser";
import axios from 'axios';
import { useRouter } from 'expo-router'; // Use only useRouter
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { API_URL } from '../../config';
import { useAuth } from '../../context/AuthContext'; // Ensure this does not import components that depend on it

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter(); // Use useRouter for navigation
  const { login } = useAuth(); // Use the useAuth hook to get login

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
        // router.replace('/AccountsScreen'); // Use router for navigation
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
      {/* Temporary replacement for the logo */}
      <Text style={styles.logoText}>Wealth Manager</Text>
      <Text style={styles.title}>Welcome Back</Text>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        mode="outlined"
        style={styles.input}
        secureTextEntry
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Button
        mode="contained"
        onPress={handleLogin}
        style={styles.button}
        loading={loading}
        disabled={loading}
      >
        Login
      </Button>
      <Pressable onPress={() => router.push('/register')}>
        <Text style={styles.registerLink}>Don't have an account? Register here</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    marginBottom: 10,
  },
  button: {
    marginTop: 10,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
  registerLink: {
    marginTop: 15,
    color: '#3498db',
    textAlign: 'center',
  },
});