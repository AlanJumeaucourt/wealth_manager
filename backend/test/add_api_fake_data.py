import requests
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta

class WealthManagerAPI:
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.jwt_token: Optional[str] = None
        self.accounts: Dict[str, int] = {}  # Store account IDs by name

    def _make_request(
        self, method: str, endpoint: str, data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to the API with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = (
            {"Authorization": f"Bearer {self.jwt_token}"} if self.jwt_token else {}
        )

        try:
            if method == "GET":
                response = requests.get(url, headers=headers)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            if response.status_code in [200, 201, 204]:
                return response.json() if response.content else {}
            else:
                print(f"Error {response.status_code}: {response.json()}")
                return {}

        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            return {}

    def register_user(self, name: str, email: str, password: str) -> bool:
        """Register a new user"""
        data = {"name": name, "email": email, "password": password}
        response = self._make_request("POST", "/users/register", data)
        return bool(response)

    def login(self, email: str, password: str) -> bool:
        """Login and get JWT token"""
        data = {"email": email, "password": password}
        response = self._make_request("POST", "/users/login", data)
        if "access_token" in response:
            self.jwt_token = response["access_token"]
            return True
        return False

    def create_bank(self, name: str) -> Optional[int]:
        """Create a bank and return its ID"""
        response = self._make_request("POST", "/banks/", {"name": name})
        return response.get("id")

    def create_account(
        self, name: str, account_type: str, bank_id: int
    ) -> Optional[int]:
        """Create an account and return its ID"""
        data = {"name": name, "type": account_type, "bank_id": bank_id}
        response = self._make_request("POST", "/accounts", data)
        account_id = response.get("id")
        if account_id:
            self.accounts[name] = account_id
        return account_id

    def create_transaction(
        self,
        amount: float,
        from_account: str,
        to_account: str,
        transaction_type: str,
        description: str,
        category: str,
        date: Optional[str] = None,
        subcategory: Optional[str] = None,
    ) -> Optional[int]:
        """Create a transaction and return its ID"""
        if not date:
            date = datetime.now().isoformat()

        data = {
            "amount": amount,
            "from_account_id": self.accounts[from_account],
            "to_account_id": self.accounts[to_account],
            "type": transaction_type,
            "description": description,
            "category": category,
            "subcategory": subcategory,
            "date": date,
            "date_accountability": date,
        }
        response = self._make_request("POST", "/transactions", data)
        return response.get("id")

    def delete_user(self) -> bool:
        """Delete the current user"""
        response = self._make_request("DELETE", "/users/")
        return response == {}

    def create_asset(self, symbol: str, name: str) -> Optional[int]:
        """Create an asset and return its ID"""
        data = {
            "symbol": symbol,
            "name": name
        }
        response = self._make_request("POST", "/assets/", data)
        return response.get("id")

    def create_investment_transaction(
        self,
        from_account: str,
        to_account: str,
        asset_id: int,
        activity_type: str,
        quantity: float,
        unit_price: float,
        fee: float = 0.0,
        tax: float = 0.0,
        date: Optional[str] = None,
    ) -> Optional[int]:
        """Create an investment transaction and return its ID"""
        if not date:
            date = datetime.now().isoformat()

        data = {
            "from_account_id": self.accounts[from_account],
            "to_account_id": self.accounts[to_account],
            "asset_id": asset_id,
            "activity_type": activity_type,
            "quantity": quantity,
            "unit_price": unit_price,
            "fee": fee,
            "tax": tax,
            "date": date,
        }
        response = self._make_request("POST", "/investments/", data)
        return response.get("id")


class TestDataCreator:
    def __init__(self):
        self.api = WealthManagerAPI()
        self.test_user = {
            "name": "Test User",
            "email": "test@example.com",
            "password": "test123",
        }

    def create_test_data(self) -> bool:
        """Create all test data"""
        print("Creating test data...")

        if not self._create_user_and_accounts():
            return False

        if not self._create_transactions():
            return False

        if not self._create_investment_assets():
            return False

        print("\nTest data creation completed!")
        print("\nTest user credentials:")
        print("Email: test@example.com")
        print("Password: test123")
        return True

    def _create_user_and_accounts(self) -> bool:
        """Create user and accounts"""
        # Create and login user
        if not self.api.register_user(**self.test_user):
            print("Failed to create user")
            return False

        if not self.api.login(self.test_user["email"], self.test_user["password"]):
            print("Failed to login")
            return False

        # Create banks
        banks = ["Chase Bank", "Bank of America", "Boursorama"]
        bank_ids: Dict[str, int] = {}

        for bank_name in banks:
            bank_id = self.api.create_bank(bank_name)
            if bank_id:
                bank_ids[bank_name] = bank_id
                print(f"Created bank '{bank_name}' with ID: {bank_id}")
            else:
                print(f"Failed to create bank '{bank_name}'")
                return False

        # Create accounts
        accounts: List[Tuple[str, str, int]] = [
            ("Checking Account", "checking", bank_ids["Chase Bank"]),
            ("Savings Account", "savings", bank_ids["Bank of America"]),
            ("Investment Account", "investment", bank_ids["Boursorama"]),
            ("Salary Account", "income", bank_ids["Chase Bank"]),
            ("Expenses Account", "expense", bank_ids["Chase Bank"]),
        ]

        for account_name, account_type, bank_id in accounts:
            account_id = self.api.create_account(account_name, account_type, bank_id)
            if account_id:
                print(
                    f"Created {account_type} account '{account_name}' with ID: {account_id}"
                )
            else:
                print(f"Failed to create account '{account_name}'")
                return False

        return True

    def _create_transactions(self) -> bool:
        """Create sample transactions"""
        print("\nCreating sample transactions...")

        # Sample transactions data
        current_date = datetime.now()
        transactions = [
            # Monthly salary
            {
                "amount": 5000.00,
                "from_account": "Salary Account",
                "to_account": "Checking Account",
                "transaction_type": "income",
                "description": "Monthly Salary",
                "category": "Salaires",
                "date": (current_date - timedelta(days=1)).isoformat(),
            },
            # Savings transfer
            {
                "amount": 1000.00,
                "from_account": "Checking Account",
                "to_account": "Savings Account",
                "transaction_type": "transfer",
                "description": "Monthly Savings",
                "category": "Banque",
                "subcategory": "Epargne",
                "date": (current_date - timedelta(days=1)).isoformat(),
            },
            # Investment transfer
            {
                "amount": 500.00,
                "from_account": "Checking Account",
                "to_account": "Investment Account",
                "transaction_type": "transfer",
                "description": "Investment Contribution",
                "category": "Banque",
                "subcategory": "Services Bancaires",
                "date": (current_date - timedelta(days=1)).isoformat(),
            },
            # Various expenses
            {
                "amount": 1200.00,
                "from_account": "Checking Account",
                "to_account": "Expenses Account",
                "transaction_type": "expense",
                "description": "Monthly Rent",
                "category": "Logement",
                "subcategory": "Loyer",
                "date": current_date.isoformat(),
            },
            {
                "amount": 200.00,
                "from_account": "Checking Account",
                "to_account": "Expenses Account",
                "transaction_type": "expense",
                "description": "Grocery Shopping",
                "category": "Alimentation & Restauration",
                "subcategory": "Supermarché / Epicerie",
                "date": current_date.isoformat(),
            },
            {
                "amount": 50.00,
                "from_account": "Checking Account",
                "to_account": "Expenses Account",
                "transaction_type": "expense",
                "description": "Internet Bill",
                "category": "Abonnements",
                "subcategory": "Internet",
                "date": current_date.isoformat(),
            },
            {
                "amount": 80.00,
                "from_account": "Checking Account",
                "to_account": "Expenses Account",
                "transaction_type": "expense",
                "description": "Mobile Phone Bill",
                "category": "Abonnements",
                "subcategory": "Téléphonie mobile",
                "date": current_date.isoformat(),
            },
            {
                "amount": 45.00,
                "from_account": "Checking Account",
                "to_account": "Expenses Account",
                "transaction_type": "expense",
                "description": "Electricity Bill",
                "category": "Logement",
                "subcategory": "Electricité",
                "date": current_date.isoformat(),
            },
        ]

        for transaction in transactions:
            transaction_id = self.api.create_transaction(**transaction)
            if transaction_id:
                print(
                    f"Created transaction: {transaction['description']} (ID: {transaction_id})"
                )
            else:
                print(f"Failed to create transaction: {transaction['description']}")
                return False

        return True

    def _create_investment_assets(self) -> bool:
        """Create sample investment assets and positions"""
        print("\nCreating investment assets...")

        # Sample assets data
        assets = [
            {"symbol": "PE500.PA", "name": "Amundi PEA S&P 500 ESG UCITS ETF Acc", "price": 100.50},
            {"symbol": "LYPS.DE", "name": "Amundi S&P 500 II UCITS ETF", "price": 95.75},
            {"symbol": "IWDA.AS", "name": "iShares Core MSCI World UCITS ETF USD (Acc)", "price": 78.25},
        ]

        asset_ids = {}
        for asset in assets:
            asset_id = self.api.create_asset(asset["symbol"], asset["name"])
            if asset_id:
                asset_ids[asset["symbol"]] = asset_id
                print(f"Created asset '{asset['name']}' ({asset['symbol']}) with ID: {asset_id}")
            else:
                print(f"Failed to create asset '{asset['symbol']}'")
                return False

        # Create investment transactions (buy orders)
        print("\nCreating investment transactions...")
        investment_positions = [
            {"symbol": "PE500.PA", "quantity": 50.0, "price": 100.50, "fee": 1.50},  # About 5000€
            {"symbol": "LYPS.DE", "quantity": 25.0, "price": 95.75, "fee": 1.25},    # About 2500€
            {"symbol": "IWDA.AS", "quantity": 40.0, "price": 78.25, "fee": 1.75}     # About 3000€
        ]

        current_date = datetime.now()
        for position in investment_positions:
            # Create buy transaction
            transaction_id = self.api.create_investment_transaction(
                from_account="Checking Account",
                to_account="Investment Account",
                asset_id=asset_ids[position["symbol"]],
                activity_type="buy",
                quantity=position["quantity"],
                unit_price=position["price"],
                fee=position["fee"],
                tax=0.0,
                date=(current_date - timedelta(days=1)).isoformat()
            )

            if transaction_id:
                total_amount = (position["quantity"] * position["price"]) + position["fee"]
                print(f"Created buy order for {position['quantity']} {position['symbol']} at {position['price']}€ (Total: {total_amount:.2f}€)")
            else:
                print(f"Failed to create buy order for {position['symbol']}")
                return False

            # Create corresponding money transfer transaction
            transfer = {
                "amount": total_amount,
                "from_account": "Checking Account",
                "to_account": "Investment Account",
                "transaction_type": "transfer",
                "description": f"Buy {position['quantity']} {position['symbol']}",
                "category": "Banque",
                "subcategory": "Services Bancaires",
                "date": (current_date - timedelta(days=1)).isoformat()
            }

            transfer_id = self.api.create_transaction(**transfer)
            if not transfer_id:
                print(f"Failed to create transfer for {position['symbol']} purchase")
                return False

        return True

    def delete_test_data(self) -> bool:
        """Delete test user and all associated data"""
        print("Deleting test user...")

        if not self.api.login(self.test_user["email"], self.test_user["password"]):
            print("Failed to login for deletion")
            return False

        if self.api.delete_user():
            print("Test user deletion completed!")
            return True
        else:
            print("Failed to delete test user")
            return False

    def show_test_data(self) -> None:
        """Display a summary of the test data"""
        if not self.api.login(self.test_user["email"], self.test_user["password"]):
            print("Failed to login to show test data")
            return

        print("\nTest Data Summary:")
        print("==================")

        # Show user info
        print("\nUser Information:")
        print("-----------------")
        user_response = self.api._make_request("GET", "/users/")
        if user_response:
            print(f"Name: {user_response.get('name')}")
            print(f"Email: {user_response.get('email')}")
            print(f"Last Login: {user_response.get('last_login')}")

        # Show banks
        print("\nBanks:")
        print("------")
        banks_response = self.api._make_request("GET", "/banks/")
        if banks_response:
            for bank in banks_response:
                print(f"- {bank['name']} (ID: {bank['id']})")

        # Show accounts with balances
        print("\nAccounts:")
        print("---------")
        accounts_response = self.api._make_request("GET", "/accounts")
        if accounts_response:
            for account in accounts_response:
                print(f"- {account['name']} ({account['type'].capitalize()})")
                print(f"  Balance: ${account.get('balance', 0):.2f}")

        # Show recent transactions
        print("\nRecent Transactions:")
        print("-------------------")
        transactions_response = self.api._make_request(
            "GET", "/transactions?per_page=10"
        )
        if transactions_response and "transactions" in transactions_response:
            for transaction in transactions_response["transactions"]:
                date = transaction["date"].split("T")[0]  # Get just the date part
                print(f"- {date} | {transaction['description']}")
                print(f"  Amount: ${transaction['amount']:.2f}")
                print(f"  Type: {transaction['type'].capitalize()}")
                print(f"  Category: {transaction['category']}")
                if transaction["subcategory"]:
                    print(f"  Subcategory: {transaction['subcategory']}")
                print()

        # Show wealth summary
        print("\nWealth Summary:")
        print("--------------")
        wealth_response = self.api._make_request("GET", "/accounts/wealth")
        if wealth_response:
            print(f"Total Balance: ${wealth_response.get('total_balance', 0):.2f}")
            print(
                f"Checking Balance: ${wealth_response.get('checking_balance', 0):.2f}"
            )
            print(f"Savings Balance: ${wealth_response.get('savings_balance', 0):.2f}")
            print(
                f"Investment Balance: ${wealth_response.get('investment_balance', 0):.2f}"
            )

        # Show investment positions
        print("\nInvestment Positions:")
        print("--------------------")
        portfolio_response = self.api._make_request("GET", "/investments/portfolio/summary")
        if portfolio_response and "positions" in portfolio_response:
            for position in portfolio_response["positions"]:
                print(f"- {position['asset_symbol']} ({position['asset_name']})")
                print(f"  Quantity: {position['total_quantity']:.6f}")
                print(f"  Average Price: ${position['average_price']:.2f}")
                print(f"  Current Price: ${position['current_price']:.2f}")
                print(f"  Total Value: ${position['total_value']:.2f}")
                print(f"  Unrealized Gain: ${position['unrealized_gain']:.2f}")
                print(f"  Performance: {position['performance']:.2f}%")
                print()

            print(f"Total Portfolio Value: ${portfolio_response['total_value']:.2f}")
            print(f"Total Invested: ${portfolio_response['total_invested']:.2f}")
            print(f"Total Gain: ${portfolio_response['total_gain']:.2f}")


def main():
    creator = TestDataCreator()
    creator.delete_test_data()
    creator.create_test_data()
    creator.show_test_data()


if __name__ == "__main__":
    main()
