import { Account } from '@/types/account';
import { AssetTransactionsResponse, InvestmentTransaction, PortfolioPerformanceResponse, PortfolioSummaryResponse } from '@/types/investment';
import { Transaction } from '@/types/transaction';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosError } from 'axios';
import apiClient from './axiosConfig';
import { BudgetSummaryResponse } from '@/types/budget';

const handleApiError = async (error: unknown, message: string) => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    console.error(message, axiosError.response?.data || axiosError.message);
    if (axiosError.response?.status === 401) {
      // Unauthorized, token might be invalid or expired
      await AsyncStorage.removeItem('accessToken');
      throw new Error('UNAUTHORIZED');
    }
  } else {
    console.error(message, error);
  }
  throw error;
};

// Add a request interceptor to add the bearer token synchronously
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    console.log("token", token);
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      config.headers['Content-Type'] = 'application/json';
    } else {
      // Optionally handle the case where no token is available
      console.warn('No access token found');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add new interface for paginated response
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  count: number;
  page: number;
  per_page: number;
}

export const fetchBanks = async () => {
  try {
    const response = await apiClient.get('/banks');
    console.log('Banks response:', response.data);
    return response.data.items;
  } catch (error) {
    return handleApiError(error, 'Error fetching banks');
  }
};

export const createBank = async (name: string) => {
  try {
    const response = await apiClient.post('/banks', JSON.stringify({ name }), {
      headers: {
        'Content-Type': 'application/json'
      },
      transformRequest: [(data, headers) => {
        headers['Content-Type'] = 'application/json';
        return JSON.stringify(data);
      }]
    });
    console.log('Bank created:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error creating bank');
  }
};

export const deleteBank = async (bankId: number) => {
  try {
    const response = await apiClient.delete(`/banks/${bankId}`);
    console.log('Bank deleted:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error deleting bank');
  }
};

export const fetchAccounts = async (perPage: number, page: number, search?: string): Promise<PaginatedResponse<Account>> => {
  try {
    const params = new URLSearchParams({
      per_page: perPage.toString(),
      page: page.toString(),
    });

    if (search) {
      params.append('search', search);
    }

    const response = await apiClient.get(`/accounts?${params.toString()}`);
    console.log('Accounts response:', response.data);

    return response.data.items;
  } catch (error) {
    return handleApiError(error, 'Error fetching accounts');
  }
};

export const createAccount = async (accountData: {
  name: string;
  type: string;
  bank_id: number;
  currency: string;
}) => {
  try {
    const response = await apiClient.post('/accounts', accountData, {
      transformRequest: [(data, headers) => {
        headers['Content-Type'] = 'application/json';
        return JSON.stringify(data);
      }]
    });
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error creating account');
  }
};

export const deleteAccount = async (accountId: number, onSuccess?: () => void) => {
  try {
    const response = await apiClient.delete(`/accounts/${accountId}`);
    if (response.status === 204 && onSuccess) {
      onSuccess();
    }
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error deleting account');
  }
};

export const updateAccount = async (accountId: number, accountData: Account) => {
  try {
    const response = await apiClient.put(`/accounts/${accountId}`, accountData, {
      transformRequest: [(data, headers) => {
        headers['Content-Type'] = 'application/json';
        return JSON.stringify(data);
      }]
    });
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error updating account');
  }
};

export const getAccountBalance = async (accountId: number) => {
  try {
    const response = await apiClient.get(`/accounts/${accountId}/balance`);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error fetching account balance');
  }
};

export const updateTransaction = async (transactionId: number, transactionData: Transaction) => {
  try {
    const response = await apiClient.put(`/transactions/${transactionId}`, transactionData, {
      transformRequest: [(data, headers) => {
        headers['Content-Type'] = 'application/json';
        return JSON.stringify(data);
      }]
    });
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error updating transaction');
  }
}

export const fetchTransactions = async (
  perPage: number,
  page: number,
  accountId?: number,
  search?: string
): Promise<{
  items: Transaction[];
  total: number;
  total_amount: number;
  count: number;
  page: number;
  per_page: number;
}> => {
  try {
    const response = await apiClient.get(
      `/transactions?per_page=${perPage}&page=${page}&sort_by=date&sort_order=desc${
        accountId ? `&account_id=${accountId}` : ''
      }${search ? `&search=${search}` : ''}`
    );
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error fetching transactions');
  }
};

export const createTransaction = async (transactionData: {
  date: string;
  description: string;
  amount: number;
  type: string;
  fromAccountId: number;
  toAccountId: number;
  category: string;
  subCategory: string | null;
}) => {
  try {
    const response = await apiClient.post('/transactions', transactionData);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error creating transaction');
  }
};

export const deleteTransaction = async (transactionId: number, onSuccess?: () => void) => {
  try {
    const response = await apiClient.delete(`/transactions/${transactionId}`);
    if (response.status === 200 && onSuccess) {
      onSuccess();
    }
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error deleting transaction');
  }
};

export const fetchWealthData = async (startDate: string, endDate: string) => {
  try {
    const response = await apiClient.get(`/accounts/balance_over_time?start_date=${startDate}&end_date=${endDate}`);
    // console.log("wealth data", response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error fetching wealth data');
  }
};

export const fetchBudgetSummary = async (startDate: string, endDate: string): Promise<BudgetSummaryResponse> => {
  try {
    const response = await apiClient.get(`/budgets/summary?start_date=${startDate}&end_date=${endDate}`);
    console.log("budget summary", response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error fetching budget summary');
  }
};

// Investment API calls
export const fetchInvestmentTransactions = async (
  perPage: number,
  page: number,
  accountId?: number
): Promise<PaginatedResponse<InvestmentTransaction>> => {
  try {
    const response = await apiClient.get(
      `/investments?per_page=${perPage}&page=${page}${
        accountId ? `&account_id=${accountId}` : ''
      }`
    );
    console.log('Investment transactions response:', response.data);
    return response.data.items;
  } catch (error) {
    return handleApiError(error, 'Error fetching investment transactions');
  }
};

export const createInvestmentTransaction = async (transactionData: {
  from_account_id: number;
  to_account_id: number;
  asset_id: number;
  activity_type: 'buy' | 'sell' | 'deposit' | 'withdrawal';
  date: string;
  quantity: number;
  unit_price: number;
  fee: number;
  tax: number;
}) => {
  try {
    const response = await apiClient.post('/investments', transactionData);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error creating investment transaction');
  }
};

export const updateInvestmentTransaction = async (
  transactionId: number,
  transactionData: Partial<Omit<InvestmentTransaction, 'id' | 'user_id' | 'account_name'>>
) => {
  try {
    const response = await apiClient.put(`/investments/${transactionId}`, transactionData);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error updating investment transaction');
  }
};

export const deleteInvestmentTransaction = async (transactionId: number) => {
  try {
    const response = await apiClient.delete(`/investments/${transactionId}`);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error deleting investment transaction');
  }
};

// Investment Portfolio API calls
export const getPortfolioSummary = async (): Promise<PortfolioSummaryResponse> => {
  try {
    const response = await apiClient.get('/investments/portfolio/summary');
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error fetching portfolio summary');
  }
};

export const getPortfolioPerformance = async (period: string = '1Y'): Promise<PortfolioPerformanceResponse> => {
  try {
    const response = await apiClient.get(`/investments/portfolio/performance?period=${period}`);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error fetching portfolio performance');
  }
};

export const getAssetTransactions = async (symbol: string): Promise<AssetTransactionsResponse> => {
  try {
    const response = await apiClient.get(`/investments/assets/${symbol}/transactions`);
    console.log(response);

    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error fetching asset transactions');
  }
};

export const searchStocks = async (query: string) => {
  try {
    const response = await apiClient.get(`/stocks/search?q=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error searching stocks');
  }
};

export const getStockInfo = async (symbol: string): Promise<StockInfo> => {
  try {
    const response = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}/details`);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error fetching stock info');
  }
};

export const getStockHistory = async (symbol: string, period: string = '1y') => {
  try {
    const response = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}/history?period=${period}`);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error fetching stock history');
  }
};

export const getInvestmentTransactions = async () => {
  try {
    const response = await apiClient.get('/investments');
    return response.data.items;
  } catch (error) {
    return handleApiError(error, 'Error fetching investment transactions');
  }
};

type StockPeriod = '1d' | '5d' | '7d' | '60d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max';

export const getStockPrices = async (symbol: string, period: StockPeriod) => {
  try {
    const response = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}/history?period=${period}`);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error fetching stock prices');
  }
};

export const getCurrentHistory = async (symbol: string) => {
  try {
    const response = await apiClient.get(`/stocks/${encodeURIComponent(symbol)}/history?period=max`);
    return response.data.price;
  } catch (error) {
    return handleApiError(error, 'Error fetching current stock price');
  }
};

export const fetchAssets = async () => {
  try {
    const response = await apiClient.get('/assets');
    return response.data.items;
  } catch (error) {
    return handleApiError(error, 'Error fetching assets');
  }
};

export const createAsset = async (assetData: { symbol: string; name: string }) => {
  try {
    const response = await apiClient.post('/assets', assetData);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error creating asset');
  }
};

export const getAssetById = async (assetId: number) => {
  try {
    const response = await apiClient.get(`/assets/${assetId}`);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Error fetching asset details');
  }
};
