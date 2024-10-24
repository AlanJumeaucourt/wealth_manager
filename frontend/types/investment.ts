// Basic investment types
export interface InvestmentTransaction {
    id: number;
    user_id: number;
    account_id: number;
    asset_symbol: string;
    asset_name: string;
    activity_type: 'buy' | 'sell' | 'deposit' | 'withdrawal';
    date: string;
    quantity: number;
    unit_price: number;
    fee: number;
    tax: number;
    transaction_related_id?: number;
}

// Portfolio types
export interface PortfolioPosition {
    asset_symbol: string;
    asset_name: string;
    total_quantity: number;
    average_price: number;
    total_invested: number;
    current_price: number;
    total_value: number;
    unrealized_gain: number;
    performance: number;
    transaction_ids: string;
}

export interface PerformanceData {
    date: string;
    cumulative_value: number;
}

// Transaction history types
export interface AssetTransaction {
    id: number;
    date: string;
    quantity: number;
    price: number;
    fee: number;
    tax: number;
}

export interface AssetTransactions {
    buys: AssetTransaction[];
    sells: AssetTransaction[];
    deposits: AssetTransaction[];
    withdrawals: AssetTransaction[];
}

// Navigation types
export type InvestmentStackParamList = {
    InvestmentOverview: undefined;
    StockDetail: {
        symbol: string;
        name: string;
    };
    AddInvestmentTransaction: {
        transaction?: InvestmentTransaction;
    };
    InvestmentTransactionList: undefined;
};

// Component prop types
export interface StockDetailProps {
    route: {
        params: {
            symbol: string;
            name: string;
        };
    };
}

export interface StockPositionItemProps {
    position: PortfolioPosition;
    onPress: () => void;
}

// API response types
export interface PortfolioSummaryResponse {
    positions: PortfolioPosition[];
    total_invested: number;
    total_value: number;
    total_gain: number;
}

export interface PortfolioPerformanceResponse {
    performance_data: PerformanceData[];
}

export interface AssetTransactionsResponse {
    transactions: AssetTransactions;
}
