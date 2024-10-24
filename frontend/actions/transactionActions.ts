import apiClient from '@/app/api/axiosConfig';
import { Dispatch } from 'redux';

export const FETCH_TRANSACTIONS_REQUEST = 'FETCH_TRANSACTIONS_REQUEST';
export const FETCH_TRANSACTIONS_SUCCESS = 'FETCH_TRANSACTIONS_SUCCESS';
export const FETCH_TRANSACTIONS_FAILURE = 'FETCH_TRANSACTIONS_FAILURE';

export const fetchTransactions = () => async (dispatch: Dispatch) => {
    dispatch({ type: FETCH_TRANSACTIONS_REQUEST });
    try {
        const response = await apiClient.get('/transactions?per_page=100&page=1&sort_by=date&sort_order=desc');
        console.log("fetchTransactions response ", response.data);
        dispatch({ type: FETCH_TRANSACTIONS_SUCCESS, payload: response.data });
    } catch (error) {
        console.log("fetchTransactions error", error);
        dispatch({ type: FETCH_TRANSACTIONS_FAILURE, error });
    }
};