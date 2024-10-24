import apiClient from '@/app/api/axiosConfig';
import axios from 'axios';
import { Dispatch } from 'redux';

export const FETCH_DATA_REQUEST = 'FETCH_DATA_REQUEST';
export const FETCH_DATA_SUCCESS = 'FETCH_DATA_SUCCESS';
export const FETCH_DATA_FAILURE = 'FETCH_DATA_FAILURE';

export const fetchData = () => async (dispatch: Dispatch) => {
    dispatch({ type: FETCH_DATA_REQUEST });
    try {
        const response = await apiClient.get('/accounts?per_page=1000&page=1');
        console.log("fetchData response", response.data);
        dispatch({ type: FETCH_DATA_SUCCESS, payload: response.data });
    } catch (error) {
        console.log("fetchData error", error);
        dispatch({ type: FETCH_DATA_FAILURE, error });
    }
};