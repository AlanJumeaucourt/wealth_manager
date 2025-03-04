import { API_URL } from '@/config';
import { darkTheme } from '@/constants/theme';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    setError('');
    try {
      console.log('Sending registration request:', { name, email, password });
      const response = await axios.post(`${API_URL}/users/register`, {
        name,
        email,
        password,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Registration response:', response);

      if (response.status === 201) {
        router.replace('/');
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Registration error:', error.response ? error.response.data : error.message);
      setError('An error occurred during registration: ' + (error.response ? error.response.data.error : error.message));
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
        <Text style={styles.title}>Create Account</Text>
        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
          theme={darkTheme}
          textColor={darkTheme.colors.text}
        />
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
        <TextInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          mode="outlined"
          style={styles.input}
          secureTextEntry
          theme={darkTheme}
          textColor={darkTheme.colors.text}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button
          mode="contained"
          onPress={handleRegister}
          style={styles.button}
          loading={loading}
          disabled={loading}
          theme={darkTheme}
        >
          Register
        </Button>
        <Pressable onPress={() => router.push('/')}>
          <Text style={styles.loginLink}>Already have an account? Login here</Text>
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
    alignItems: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  contentContainer: {
    flex: 1.5,
    justifyContent: 'flex-start',
    padding: 20,
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
  loginLink: {
    marginTop: 15,
    color: darkTheme.colors.primary,
    textAlign: 'center',
  },
});
