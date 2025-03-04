import random
from datetime import datetime, timedelta
from typing import Any

import requests


class WealthManagerAPI:
    def __init__(self, base_url: str = "http://localhost:5000") -> None:
        self.base_url = base_url
        self.jwt_token: str | None = None
        self.accounts: dict[str, int] = {}  # Store account IDs by name

    def _make_request(
        self, method: str, endpoint: str, data: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Make HTTP request to the API with proper headers."""
        url = f"{self.base_url}{endpoint}"
        headers = (
            {"Authorization": f"Bearer {self.jwt_token}"} if self.jwt_token else {}
        )

        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=10)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            if response.status_code in [200, 201, 204]:
                return response.json() if response.content else {}
            print(f"Error {response.status_code}: {response.json()}")
            raise Exception(f"Error {response.status_code}: {response.json()}")
            return {}

        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise e

    def register_user(self, name: str, email: str, password: str) -> bool:
        """Register a new user"""
        data = {"name": name, "email": email, "password": password}
        response = self._make_request("POST", "/users/register", data)
        return bool(response)

    def login(self, email: str, password: str) -> bool:
        """Login and get JWT token"""
        data = {"email": email, "password": password}
        try:
            response = self._make_request("POST", "/users/login", data)
        except Exception as e:
            if "401" in str(e) and "authentication_failed" in str(e):
                print("Invalid credentials")
                return False
            else:
                raise e
        if "access_token" in response:
            self.jwt_token = response["access_token"]
            print(f"Logged in with JWT token: {self.jwt_token}")
            return True
        return False

    def create_bank(self, name: str) -> int | None:
        """Create a bank and return its ID"""
        response = self._make_request(
            method="POST", endpoint="/banks/", data={"name": name}
        )
        return response.get("id")

    def create_account(self, name: str, account_type: str, bank_id: int) -> int | None:
        """Create an account and return its ID"""
        data = {"name": name, "type": account_type, "bank_id": bank_id}
        response = self._make_request(method="POST", endpoint="/accounts", data=data)
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
        date: str | None = None,
        subcategory: str | None = None,
    ) -> int | None:
        """Create a transaction and return its ID."""
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
        response = self._make_request(
            method="POST", endpoint="/transactions", data=data
        )
        return response.get("id")

    def delete_user(self) -> bool:
        """Delete the current user."""
        response = self._make_request(method="DELETE", endpoint="/users/")
        return response == {}

    def create_asset(self, symbol: str, name: str) -> int | None:
        """Create an asset and return its ID."""
        data = {"symbol": symbol, "name": name}
        response = self._make_request(method="POST", endpoint="/assets/", data=data)
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
        date: str | None = None,
    ) -> int | None:
        """Create an investment transaction and return its ID."""
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
        response = self._make_request(
            method="POST", endpoint="/investments/", data=data
        )
        return response.get("transaction_id")


class TestDataCreator:
    def __init__(self) -> None:
        self.api = WealthManagerAPI()
        self.test_user = {
            "name": "Test User",
            "email": "test@example.com",
            "password": "test123",
        }
        self.number_of_months = 36

    def create_test_data(self) -> bool:
        """Create all test data."""
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
        """Create user and accounts."""
        # Create and login user
        if not self.api.register_user(**self.test_user):
            print("Failed to create user")
            return False

        if not self.api.login(self.test_user["email"], self.test_user["password"]):
            print("Failed to login")
            return False

        # Create banks
        banks = ["Chase Bank", "Bank of America", "Boursorama"]
        bank_ids: dict[str, int] = {}

        for bank_name in banks:
            bank_id = self.api.create_bank(bank_name)
            if bank_id:
                bank_ids[bank_name] = bank_id
                print(f"Created bank '{bank_name}' with ID: {bank_id}")
            else:
                print(f"Failed to create bank '{bank_name}'")
                return False

        # Create accounts
        accounts: list[tuple[str, str, int]] = [
            ("Checking Account", "checking", bank_ids["Chase Bank"]),
            ("Savings Account", "savings", bank_ids["Bank of America"]),
            ("Investment Account", "investment", bank_ids["Boursorama"]),
            ("Salary Account", "income", bank_ids["Chase Bank"]),
            ("Expenses Account", "expense", bank_ids["Chase Bank"]),
        ]

        for account_name, account_type, bank_id in accounts:
            account_id = self.api.create_account(
                name=account_name, account_type=account_type, bank_id=bank_id
            )
            if account_id:
                print(
                    f"Created {account_type} account '{account_name}' with ID: {account_id}"
                )
            else:
                print(f"Failed to create account '{account_name}'")
                return False

        return True

    def _create_transactions(self) -> bool:
        """Create sample transactions for the past year."""
        print("\nCreating sample transactions...")

        current_date = datetime.now()
        start_date = current_date - timedelta(days=self.number_of_months * 30)

        # Generate monthly transactions for the past year
        for month_offset in range(self.number_of_months):
            transaction_date = start_date + timedelta(days=30 * month_offset)

            # Monthly transactions template
            monthly_transactions = [
                # Monthly salary
                {
                    "amount": 5000.00,
                    "from_account": "Salary Account",
                    "to_account": "Checking Account",
                    "transaction_type": "income",
                    "description": "Monthly Salary",
                    "category": "Salaires",
                    "date": transaction_date.isoformat(),
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
                    "date": (transaction_date + timedelta(days=2)).isoformat(),
                },
                # Fixed expenses
                {
                    "amount": 1200.00,
                    "from_account": "Checking Account",
                    "to_account": "Expenses Account",
                    "transaction_type": "expense",
                    "description": "Monthly Rent",
                    "category": "Logement",
                    "subcategory": "Loyer",
                    "date": (transaction_date + timedelta(days=5)).isoformat(),
                },
                {
                    "amount": 50.00,
                    "from_account": "Checking Account",
                    "to_account": "Expenses Account",
                    "transaction_type": "expense",
                    "description": "Internet Bill",
                    "category": "Abonnements",
                    "subcategory": "Internet",
                    "date": (transaction_date + timedelta(days=7)).isoformat(),
                },
                {
                    "amount": 80.00,
                    "from_account": "Checking Account",
                    "to_account": "Expenses Account",
                    "transaction_type": "expense",
                    "description": "Mobile Phone Bill",
                    "category": "Abonnements",
                    "subcategory": "Téléphonie mobile",
                    "date": (transaction_date + timedelta(days=7)).isoformat(),
                },
                {
                    "amount": 45.00,
                    "from_account": "Checking Account",
                    "to_account": "Expenses Account",
                    "transaction_type": "expense",
                    "description": "Electricity Bill",
                    "category": "Logement",
                    "subcategory": "Electricité",
                    "date": (transaction_date + timedelta(days=10)).isoformat(),
                },
            ]

            # Add variable expenses (2-4 grocery trips per month)
            num_grocery_trips = random.randint(2, 4)
            for _ in range(num_grocery_trips):
                grocery_amount = round(random.uniform(150, 300), 2)
                grocery_day = random.randint(1, 28)
                monthly_transactions.append(
                    {
                        "amount": grocery_amount,
                        "from_account": "Checking Account",
                        "to_account": "Expenses Account",
                        "transaction_type": "expense",
                        "description": "Grocery Shopping",
                        "category": "Alimentation & Restauration",
                        "subcategory": "Supermarché / Epicerie",
                        "date": (
                            transaction_date.replace(day=1)
                            + timedelta(days=grocery_day)
                        ).isoformat(),
                    }
                )

            # Add random entertainment expenses (1-3 per month)
            num_entertainment = random.randint(1, 3)
            for _ in range(num_entertainment):
                entertainment_amount = round(random.uniform(20, 100), 2)
                entertainment_day = random.randint(1, 28)
                monthly_transactions.append(
                    {
                        "amount": entertainment_amount,
                        "from_account": "Checking Account",
                        "to_account": "Expenses Account",
                        "transaction_type": "expense",
                        "description": "Entertainment",
                        "category": "Loisirs & Sorties",
                        "subcategory": "Bars / Clubs",
                        "date": (
                            transaction_date.replace(day=1)
                            + timedelta(days=entertainment_day)
                        ).isoformat(),
                    }
                )

            # Create all transactions for the month
            for transaction in monthly_transactions:
                transaction_id = self.api.create_transaction(**transaction)
                if transaction_id:
                    print(
                        f"Created transaction: {transaction['description']} on {transaction['date'].split('T')[0]} (ID: {transaction_id})"
                    )
                else:
                    print(f"Failed to create transaction: {transaction['description']}")
                    return False

        return True

    def _create_investment_assets(self) -> bool:
        """Create sample investment assets and positions with periodic investments and some sells"""
        print("\nCreating investment assets...")

        # Sample assets data with initial prices and monthly price trends
        assets = [
            {
                "symbol": "PE500.PA",
                "name": "Amundi PEA S&P 500 ESG UCITS ETF Acc",
                "initial_price": 100.50,
                "monthly_trend": 0.008,  # ~10% annual growth
            },
            {
                "symbol": "LYPS.DE",
                "name": "Amundi S&P 500 II UCITS ETF",
                "initial_price": 95.75,
                "monthly_trend": 0.007,  # ~8.7% annual growth
            },
            {
                "symbol": "IWDA.AS",
                "name": "iShares Core MSCI World UCITS ETF USD (Acc)",
                "initial_price": 78.25,
                "monthly_trend": 0.006,  # ~7.4% annual growth
            },
        ]

        # Create assets
        asset_ids = {}
        for asset in assets:
            asset_id = self.api.create_asset(str(asset["symbol"]), str(asset["name"]))
            if asset_id:
                asset_ids[asset["symbol"]] = asset_id
                print(
                    f"Created asset '{asset['name']}' ({asset['symbol']}) with ID: {asset_id}"
                )
            else:
                print(f"Failed to create asset '{asset['symbol']}'")
                return False

        # Investment strategy for each asset
        investment_strategies = [
            {
                "symbol": "PE500.PA",
                "monthly_base_amount": 1000.0,  # Base monthly investment
                "fee": 1.50,
                "tax": 0.0,
            },
            {
                "symbol": "LYPS.DE",
                "monthly_base_amount": 500.0,
                "fee": 1.25,
                "tax": 0.0,
            },
            {
                "symbol": "IWDA.AS",
                "monthly_base_amount": 250.0,
                "fee": 1.75,
                "tax": 0.0,
            },
        ]

        # Track total quantities owned for each asset
        owned_quantities = {
            strategy["symbol"]: 0.0 for strategy in investment_strategies
        }

        # Generate transactions for the past year
        current_date = datetime.now()
        start_date = current_date - timedelta(days=self.number_of_months * 30)

        # For each month in the past year
        for month_offset in range(self.number_of_months):
            transaction_date = start_date + timedelta(days=30 * month_offset)

            # Calculate market volatility for this month (-5% to +5% from trend)
            market_factor = 1.0 + random.uniform(-0.05, 0.05)

            for asset, strategy in zip(assets, investment_strategies, strict=False):
                symbol = strategy["symbol"]

                # Calculate price with trend and volatility
                trend_factor = 1.0 + (asset["monthly_trend"] * month_offset)
                price = float(asset["initial_price"] * trend_factor * market_factor)

                # Regular monthly investment (with some randomness)
                investment_amount = float(
                    strategy["monthly_base_amount"] * random.uniform(0.8, 1.2)
                )
                quantity = round(investment_amount / price, 6)

                # Create buy transaction
                buy_id = self.api.create_investment_transaction(
                    from_account="Checking Account",
                    to_account="Investment Account",
                    asset_id=asset_ids[symbol],
                    activity_type="buy",
                    quantity=float(quantity),
                    unit_price=float(price),
                    fee=float(strategy["fee"]),
                    tax=float(strategy["tax"]),
                    date=transaction_date.isoformat(),
                )

                # 15% chance of additional purchase during market dips
                if random.random() < 0.15 and market_factor < 0.98:
                    dip_date = transaction_date + timedelta(days=random.randint(5, 25))
                    dip_quantity = float(quantity * random.uniform(0.3, 0.7))
                    dip_price = float(
                        price * random.uniform(0.95, 0.98)
                    )  # Slight discount

                    dip_id = self.api.create_investment_transaction(
                        from_account="Checking Account",
                        to_account="Investment Account",
                        asset_id=asset_ids[symbol],
                        activity_type="buy",
                        quantity=dip_quantity,
                        unit_price=dip_price,
                        fee=float(strategy["fee"]),
                        tax=float(strategy["tax"]),
                        date=dip_date.isoformat(),
                    )

                    if dip_id:
                        owned_quantities[symbol] += dip_quantity
                        dip_total = (dip_quantity * dip_price) + strategy["fee"]
                        print(
                            f"Created dip buy: {dip_quantity:.6f} {symbol} at {dip_price:.2f}€ (Total: {dip_total:.2f}€)"
                        )

                # 10% chance of taking profits if we have enough shares and price is up
                if (
                    random.random() < 0.10
                    and owned_quantities[symbol] > quantity * 3
                    and market_factor > 1.02
                ):
                    sell_date = transaction_date + timedelta(days=random.randint(5, 25))
                    sell_quantity = float(
                        owned_quantities[symbol] * random.uniform(0.1, 0.2)
                    )
                    sell_price = float(
                        price * random.uniform(1.02, 1.05)
                    )  # Slight premium

                    sell_id = self.api.create_investment_transaction(
                        from_account="Investment Account",
                        to_account="Checking Account",
                        asset_id=asset_ids[symbol],
                        activity_type="sell",
                        quantity=sell_quantity,
                        unit_price=sell_price,
                        fee=float(strategy["fee"]),
                        tax=float(strategy["tax"]),
                        date=sell_date.isoformat(),
                    )

                    if sell_id:
                        owned_quantities[symbol] -= sell_quantity
                        sell_total = (sell_quantity * sell_price) - strategy["fee"]
                        print(
                            f"Created profit taking: {sell_quantity:.6f} {symbol} at {sell_price:.2f}€ (Total: {sell_total:.2f}€)"
                        )

                        # Create corresponding transfer
                        self.api.create_transaction(
                            amount=float(sell_total),
                            from_account="Investment Account",
                            to_account="Checking Account",
                            transaction_type="transfer",
                            description=f"Sell {sell_quantity:.6f} {symbol} (profit taking)",
                            category="Banque",
                            subcategory="Services Bancaires",
                            date=sell_date.isoformat(),
                        )

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
        print("Failed to delete test user")
        return False

    def show_test_data(self) -> None:
        """Display a summary of the test data."""
        if not self.api.login(self.test_user["email"], self.test_user["password"]):
            print("Failed to login to show test data")
            return

        print("\nTest Data Summary:")
        print("==================")

        # Show user info
        print("\nUser Information:")
        print("-----------------")
        user_response = self.api._make_request(method="GET", endpoint="/users/")
        if user_response:
            print(f"Name: {user_response.get('name')}")
            print(f"Email: {user_response.get('email')}")
            print(f"Last Login: {user_response.get('last_login')}")

        # Show banks
        print("\nBanks:")
        print("------")
        banks_response = self.api._make_request("GET", "/banks/")
        if banks_response:
            for bank in banks_response["items"]:
                print(f"- {bank['name']} (ID: {bank['id']})")

        # Show accounts with balances
        print("\nAccounts:")
        print("---------")
        accounts_response = self.api._make_request("GET", "/accounts")
        if accounts_response:
            for account in accounts_response["items"]:
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
        portfolio_response = self.api._make_request(
            "GET", "/investments/portfolio/summary"
        )
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
