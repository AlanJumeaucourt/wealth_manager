import { combineReducers } from 'redux';
import accountReducer from './accountReducer';
import apiReducer from './apiReducer';
import bankReducer from './bankReducer';
import transactionReducer from './transactionReducer';

const rootReducer = combineReducers({
    api: apiReducer,
    accounts: accountReducer,
    banks: bankReducer,
    transactions: transactionReducer,
});

export default rootReducer;