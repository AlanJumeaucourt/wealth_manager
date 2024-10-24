import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import rootReducer from './reducers'; // Ensure the correct path to your root reducer

// Create the Redux store with middleware
const store = createStore(
    rootReducer,
    applyMiddleware(thunk)
);

export default store;