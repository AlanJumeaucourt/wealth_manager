import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBanks } from '../actions/bankActions';

const BankList = () => {
    const dispatch = useDispatch();
    const { banks, loading, error } = useSelector((state) => state.banks);

    useEffect(() => {
        dispatch(fetchBanks());
    }, [dispatch]);

    if (loading) return <p>Loading banks...</p>;
    if (error) return <p>Error: {error.message}</p>;

    return (
        <div>
            <h1>Banks</h1>
            <ul>
                {banks.map((bank) => (
                    <li key={bank.id}>{bank.name}</li>
                ))}
            </ul>
        </div>
    );
};

export default BankList;