import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { Account } from './account';

export type RootStackParamList = {
  AccountsScreen: undefined;
  TransactionsScreen: { account: Account };
  TransactionsScreenAccount: { account: Account };
  // ... other screens ...
};

export type AccountsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AccountsScreen'>;
export type TransactionsScreenRouteProp = RouteProp<RootStackParamList, 'TransactionsScreen'>;
export type TransactionsScreenAccountRouteProp = RouteProp<RootStackParamList, 'TransactionsScreenAccount'>;