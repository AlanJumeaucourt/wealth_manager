type AssetTransaction = {
    id: number;
    date: string;
    quantity: number;
    price: number;
    fee: number;
    tax: number;
    account_name: string;
};

type AssetTransactions = {
    buys: AssetTransaction[];
    sells: AssetTransaction[];
    deposits: AssetTransaction[];
    withdrawals: AssetTransaction[];
};
