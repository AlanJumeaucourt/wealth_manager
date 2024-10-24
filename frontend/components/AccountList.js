import React, { useEffect } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAccounts } from '../actions/accountActions';

const AccountList = () => {
    const dispatch = useDispatch();
    const { accounts, loading, error } = useSelector((state) => state.accounts);

    useEffect(() => {
        dispatch(fetchAccounts());
    }, [dispatch]);

    useEffect(() => {
        console.log("accounts", accounts);
    }, [accounts]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>Accounts</Text>
            <FlatList
                data={accounts}
                renderItem={({ item }) => (
                    <Text key={item.id}>{item.name} - {item.balance}</Text>
                )}
            />
        </View>
    );
};

export default AccountList;