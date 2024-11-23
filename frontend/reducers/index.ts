import accountReducer from '@/reducers/accountReducer';
import apiReducer from '@/reducers/apiReducer';
import bankReducer from '@/reducers/bankReducer';
import transactionReducer from '@/reducers/transactionReducer';
import { combineReducers } from 'redux';

const rootReducer = combineReducers({
    api: apiReducer,
    accounts: accountReducer,
    banks: bankReducer,
    transactions: transactionReducer,
});

export default rootReducer;