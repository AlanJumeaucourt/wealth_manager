import { API_URL } from '@/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Create an instance of Axios
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

let navigationCallback: ((screen: string) => void) | null = null;

// Add a request interceptor
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('accessToken');
      if (navigationCallback) {
        navigationCallback('Login');
      }
    }
    return Promise.reject(error);
  }
);

export const setNavigationCallback = (callback: (screen: string) => void) => {
  navigationCallback = callback;
};

export default apiClient;