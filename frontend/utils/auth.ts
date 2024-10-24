import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { useRouter } from 'expo-router'; // Import useRouter
import { useAuth } from '../context/AuthContext'; // Ensure correct import

export const setAuthToken = (token: string) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

export const login = async (email: string, password: string) => {
  try {
    const response = await axios.post(`${API_URL}/users/login`, { email, password }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Login response:', response.data);  // Add this line for debugging
    const { access_token } = response.data;
    if (access_token) {
      await AsyncStorage.setItem('accessToken', access_token);
      setAuthToken(access_token);
      return access_token;
    } else {
      throw new Error('No access token received');
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Login error:', error.response?.data || error.message);
    } else {
      console.error('Non-Axios error:', error);
    }
    throw error;
  }
};

export const register = async (name: string, email: string, password: string) => {
  try {
    const response = await axios.post(`${API_URL}/users/register`, { name, email, password });
    return response.data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const logout = async () => {
  await AsyncStorage.removeItem('accessToken');
  setAuthToken('');
};

export const verifyToken = async () => {
  try {
    const response = await axios.get(`${API_URL}/users/verify-token`);
    return response.data.message === "Token is valid";
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
};

export const setupAxiosInterceptors = (router: any) => {
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response && error.response.status === 401) {
        await AsyncStorage.removeItem('accessToken');
        setAuthToken('');
        router.push('/');
      }
      return Promise.reject(error);
    }
  );
};