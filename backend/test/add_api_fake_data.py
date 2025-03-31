import random
from datetime import datetime, timedelta, date
from typing import Any, List, Dict, Tuple, Optional
import calendar
import math
import logging
from dataclasses import dataclass
from enum import Enum
import threading
from queue import Queue
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import argparse

import requests

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TransactionType(Enum):
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"

@dataclass
class TransactionPattern:
    description: str
    category: str
    subcategory: str | None
    base_amount: float
    variance: float  # Percentage of variance allowed (0.1 = 10%)
    day_of_month: int | None  # Fixed day or None for random
    frequency: str  # 'monthly', 'weekly', 'biweekly', 'variable'
    probability: float = 1.0  # Probability of occurrence when frequency is 'variable'

class MarketSimulator:
    def __init__(self, base_volatility: float = 0.05):
        self.base_volatility = base_volatility
        self.market_sentiment = 0.0  # Range from -1 (very bearish) to 1 (very bullish)
        self.trend_momentum = 0.0

    def update_market_conditions(self) -> None:
        # Update market sentiment (mean-reverting random walk)
        self.market_sentiment += random.uniform(-0.2, 0.2)
        self.market_sentiment = max(-1.0, min(1.0, self.market_sentiment * 0.95))

        # Update momentum (also mean-reverting)
        self.trend_momentum += random.uniform(-0.1, 0.1)
        self.trend_momentum = max(-0.5, min(0.5, self.trend_momentum * 0.9))

    def get_market_factor(self) -> float:
        # Combine base volatility, sentiment and momentum
        volatility = self.base_volatility * (1.0 + abs(self.market_sentiment))
        base_change = random.gauss(0, volatility)
        sentiment_impact = self.market_sentiment * 0.02  # Max 2% impact from sentiment
        momentum_impact = self.trend_momentum * 0.01    # Max 1% impact from momentum

        return 1.0 + base_change + sentiment_impact + momentum_impact

class WealthManagerAPI:
    def __init__(self, base_url: str | None = None) -> None:
        # Read from environment variable with fallback
        self.base_url = base_url or os.environ.get("BACKEND_URL", "http://localhost:5000")
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

    def create_refund_group(self, name: str, description: str | None = None) -> int | None:
        """Create a refund group and return its ID."""
        data = {"name": name}
        if description:
            data["description"] = description
        response = self._make_request(method="POST", endpoint="/refund_groups/", data=data)
        return response.get("id")

    def create_refund_item(
        self,
        income_transaction_id: int,
        expense_transaction_id: int,
        amount: float,
        refund_group_id: int | None = None,
        description: str | None = None,
    ) -> int | None:
        """Create a refund item and return its ID."""
        data = {
            "income_transaction_id": income_transaction_id,
            "expense_transaction_id": expense_transaction_id,
            "amount": amount,
        }
        if refund_group_id:
            data["refund_group_id"] = refund_group_id
        if description:
            data["description"] = description
        response = self._make_request(method="POST", endpoint="/refund_items/", data=data)
        return response.get("id")

@dataclass
class APITask:
    method: str
    endpoint: str
    data: Dict[str, Any]
    description: str
    callback: Optional[callable] = None

class APIWorker(threading.Thread):
    def __init__(self, api, task_queue: Queue, batch_size: int = 10, batch_delay: float = 0.01):
        super().__init__()
        self.api = api
        self.task_queue = task_queue
        self.batch_size = batch_size
        self.batch_delay = batch_delay
        self.daemon = True
        self.running = True
        self.success_count = 0
        self.error_count = 0

    def run(self):
        while self.running:
            batch = []
            # Collect up to batch_size tasks
            try:
                while len(batch) < self.batch_size and not self.task_queue.empty():
                    task = self.task_queue.get_nowait()
                    if task is None:  # Shutdown signal
                        self.running = False
                        break
                    batch.append(task)
            except Queue.Empty:
                pass

            # Process batch
            if batch:
                for task in batch:
                    try:
                        response = self.api._make_request(task.method, task.endpoint, task.data)
                        if task.callback:
                            task.callback(response)
                        self.success_count += 1
                        if task.description:
                            logger.debug(f"Successfully processed: {task.description}")
                    except Exception as e:
                        self.error_count += 1
                        logger.error(f"Error processing task: {task.description} - {str(e)}")
                        raise e
                    finally:
                        self.task_queue.task_done()

                # Small delay between batches to prevent overwhelming the API
                time.sleep(self.batch_delay)
            else:
                # No tasks available, small sleep to prevent CPU spinning
                time.sleep(0.1)

    def stop(self):
        self.running = False
        self.task_queue.put(None)  # Send shutdown signal

class TestDataCreator:
    def __init__(self, number_of_months: int = 12) -> None:
        self.api = WealthManagerAPI()
        self.test_user = {
            "name": "Test User",
            "email": "test@example.com",
            "password": "test123",
        }
        self.number_of_months = number_of_months
        self.market_simulator = MarketSimulator()

        # Initialize task queue and worker
        self.task_queue = Queue()
        self.api_worker = APIWorker(self.api, self.task_queue)
        self.api_worker.start()

        # Store local data
        self.transactions: List[Dict[str, Any]] = []
        self.investment_transactions: List[Dict[str, Any]] = []
        self.refunds: List[Dict[str, Any]] = []

        # Define common transaction patterns
        self.income_patterns = [
            TransactionPattern(
                description="Monthly Salary",
                category="Salaires",
                subcategory=None,
                base_amount=5000.00,
                variance=0.1,  # 10% variance for bonuses/overtime
                day_of_month=25,  # Paid on 25th
                frequency="monthly"
            ),
            TransactionPattern(
                description="Freelance Work",
                category="Revenus complémentaires",
                subcategory="Freelance",
                base_amount=500.00,
                variance=0.5,  # High variance
                day_of_month=None,
                frequency="variable",
                probability=0.3  # 30% chance each month
            ),
            TransactionPattern(
                description="Dividend Payment",
                category="Revenus financiers",
                subcategory="Dividendes",
                base_amount=200.00,
                variance=0.2,
                day_of_month=15,
                frequency="monthly"  # Could be quarterly in reality
            )
        ]

        self.expense_patterns = [
            # Housing
            TransactionPattern(
                description="Monthly Rent",
                category="Logement",
                subcategory="Loyer",
                base_amount=1200.00,
                variance=0.0,  # Fixed amount
                day_of_month=5,
                frequency="monthly"
            ),
            TransactionPattern(
                description="Electricity Bill",
                category="Logement",
                subcategory="Electricité",
                base_amount=45.00,
                variance=0.3,  # Seasonal variation
                day_of_month=10,
                frequency="monthly"
            ),
            TransactionPattern(
                description="Water Bill",
                category="Logement",
                subcategory="Eau",
                base_amount=30.00,
                variance=0.2,
                day_of_month=15,
                frequency="monthly"
            ),

            # Subscriptions
            TransactionPattern(
                description="Internet Bill",
                category="Abonnements",
                subcategory="Internet",
                base_amount=50.00,
                variance=0.0,
                day_of_month=7,
                frequency="monthly"
            ),
            TransactionPattern(
                description="Mobile Phone Bill",
                category="Abonnements",
                subcategory="Téléphonie mobile",
                base_amount=80.00,
                variance=0.0,
                day_of_month=7,
                frequency="monthly"
            ),
            TransactionPattern(
                description="Netflix Subscription",
                category="Abonnements",
                subcategory="Streaming",
                base_amount=15.99,
                variance=0.0,
                day_of_month=3,
                frequency="monthly"
            ),
            TransactionPattern(
                description="Spotify Premium",
                category="Abonnements",
                subcategory="Streaming",
                base_amount=9.99,
                variance=0.0,
                day_of_month=21,
                frequency="monthly"
            ),

            # Regular expenses
            TransactionPattern(
                description="Grocery Shopping",
                category="Alimentation & Restauration",
                subcategory="Supermarché / Epicerie",
                base_amount=85.00,
                variance=0.4,
                day_of_month=None,
                frequency="weekly"
            ),
            TransactionPattern(
                description="Restaurant Lunch",
                category="Alimentation & Restauration",
                subcategory="Restaurant",
                base_amount=15.00,
                variance=0.3,
                day_of_month=None,
                frequency="variable",
                probability=0.6  # 60% chance each workday
            ),

            # Transportation
            TransactionPattern(
                description="Public Transport Pass",
                category="Transport",
                subcategory="Transport en commun",
                base_amount=75.00,
                variance=0.0,
                day_of_month=1,
                frequency="monthly"
            ),
            TransactionPattern(
                description="Fuel",
                category="Transport",
                subcategory="Carburant",
                base_amount=60.00,
                variance=0.3,
                day_of_month=None,
                frequency="biweekly"
            ),

            # Entertainment
            TransactionPattern(
                description="Cinema",
                category="Loisirs & Sorties",
                subcategory="Cinéma",
                base_amount=25.00,
                variance=0.2,
                day_of_month=None,
                frequency="variable",
                probability=0.4
            ),
            TransactionPattern(
                description="Restaurant Dinner",
                category="Alimentation & Restauration",
                subcategory="Restaurant",
                base_amount=45.00,
                variance=0.5,
                day_of_month=None,
                frequency="variable",
                probability=0.3
            ),
            TransactionPattern(
                description="Bar/Pub",
                category="Loisirs & Sorties",
                subcategory="Bars / Clubs",
                base_amount=35.00,
                variance=0.6,
                day_of_month=None,
                frequency="variable",
                probability=0.35
            ),

            # Shopping
            TransactionPattern(
                description="Clothing",
                category="Shopping",
                subcategory="Vêtements",
                base_amount=120.00,
                variance=0.7,
                day_of_month=None,
                frequency="variable",
                probability=0.25
            ),
            TransactionPattern(
                description="Amazon Shopping",
                category="Shopping",
                subcategory="E-commerce",
                base_amount=50.00,
                variance=0.8,
                day_of_month=None,
                frequency="variable",
                probability=0.4
            ),

            # Health
            TransactionPattern(
                description="Pharmacy",
                category="Santé",
                subcategory="Pharmacie",
                base_amount=25.00,
                variance=0.6,
                day_of_month=None,
                frequency="variable",
                probability=0.3
            ),
            TransactionPattern(
                description="Gym Membership",
                category="Sport",
                subcategory="Salle de sport",
                base_amount=45.00,
                variance=0.0,
                day_of_month=5,
                frequency="monthly"
            )
        ]

        self.transfer_patterns = [
            TransactionPattern(
                description="Monthly Savings",
                category="Banque",
                subcategory="Epargne",
                base_amount=1000.00,
                variance=0.2,
                day_of_month=26,  # Day after salary
                frequency="monthly"
            ),
            TransactionPattern(
                description="Investment Transfer",
                category="Banque",
                subcategory="Investissement",
                base_amount=500.00,
                variance=0.3,
                day_of_month=27,  # Two days after salary
                frequency="monthly"
            )
        ]

    def _queue_api_task(self, method: str, endpoint: str, data: Dict[str, Any], description: str, callback: Optional[callable] = None) -> None:
        """Queue an API task for async processing."""
        task = APITask(method=method, endpoint=endpoint, data=data, description=description, callback=callback)
        self.task_queue.put(task)

    def _wait_for_tasks(self) -> None:
        """Wait for all queued tasks to complete."""
        total_tasks = self.task_queue.qsize()
        last_progress = 0
        last_update_time = time.time()
        update_interval = 2.0  # Update progress every 2 seconds

        while not self.task_queue.empty():
            remaining = self.task_queue.qsize()
            completed = total_tasks - remaining
            progress = (completed / total_tasks) * 100 if total_tasks > 0 else 0

            current_time = time.time()
            if current_time - last_update_time >= update_interval:
                success_rate = (self.api_worker.success_count / completed * 100) if completed > 0 else 0
                logger.info(
                    f"Progress: {progress:.1f}% ({completed}/{total_tasks} tasks) - "
                    f"Success rate: {success_rate:.1f}% - "
                    f"Errors: {self.api_worker.error_count}"
                )
                last_update_time = current_time

            time.sleep(0.1)  # Small sleep to prevent CPU spinning

        self.task_queue.join()
        logger.info(
            f"API tasks completed - "
            f"Success: {self.api_worker.success_count}, "
            f"Errors: {self.api_worker.error_count}"
        )

    def create_test_data(self) -> bool:
        """Create all test data."""
        logger.info("Creating test data...")

        try:
            if not self._create_user_and_accounts():
                return False

            # Generate all data locally first
            logger.info("Phase 1/2: Generating data locally")
            self._generate_transactions()
            self._generate_investment_transactions()
            self._generate_refunds()
            logger.info("Local data generation complete")

            # Now queue all API tasks
            logger.info("Phase 2/2: Processing API tasks")
            self._queue_all_data()

            # Wait for all tasks to complete
            self._wait_for_tasks()

            logger.info("\nTest data creation completed!")
            logger.info("\nTest user credentials:")
            logger.info("Email: test@example.com")
            logger.info("Password: test123")
        except Exception as e:
            logger.error(f"Error during test data creation: {str(e)}")
            return False
        finally:
            self.api_worker.stop()

    def _generate_transactions(self) -> None:
        """Generate all transactions locally."""
        logger.info("Generating transactions...")

        current_date = datetime.now()
        start_date = current_date - timedelta(days=self.number_of_months * 30)

        # Iterate through each day in the date range
        current = start_date
        while current <= current_date:
            # Process all transaction patterns
            for pattern in (self.income_patterns + self.expense_patterns + self.transfer_patterns):
                if self._should_generate_transaction(pattern, current):
                    amount = self._generate_transaction_amount(pattern, current)

                    # Determine accounts based on transaction type
                    if pattern in self.income_patterns:
                        from_account = "Salary Account"
                        to_account = "Checking Account"
                        trans_type = TransactionType.INCOME.value
                    elif pattern in self.expense_patterns:
                        from_account = "Checking Account"
                        to_account = "Expenses Account"
                        trans_type = TransactionType.EXPENSE.value
                    else:  # Transfer patterns
                        from_account = "Checking Account"
                        to_account = "Savings Account" if "Savings" in pattern.description else "Investment Account"
                        trans_type = TransactionType.TRANSFER.value

                    # Store transaction locally
                    transaction = {
                        "amount": amount,
                        "from_account": from_account,
                        "to_account": to_account,
                        "transaction_type": trans_type,
                        "description": pattern.description,
                        "category": pattern.category,
                        "subcategory": pattern.subcategory,
                        "date": current.isoformat()
                    }
                    self.transactions.append(transaction)

            current += timedelta(days=1)

        logger.info(f"Generated {len(self.transactions)} transactions")

    def _generate_investment_transactions(self) -> None:
        """Generate all investment transactions locally."""
        logger.info("Generating investment transactions...")

        # Create assets data structure
        assets = [
            {
                "symbol": "PE500.PA.FAKE",
                "name": "Amundi PEA S&P 500 ESG UCITS ETF Acc",
                "initial_price": 33.00,
                "beta": 1.0,  # Market sensitivity
                "expense_ratio": 0.0015,  # 0.15% annual fee
                "dividend_yield": 0.0,  # Accumulating ETF
                "volatility": 0.15  # Base volatility
            },
            {
                "symbol": "LYPS.DE.FAKE",
                "name": "Amundi S&P 500 II UCITS ETF",
                "initial_price": 40.00,
                "beta": 0.95,
                "expense_ratio": 0.0018,
                "dividend_yield": 0.02,  # 2% annual dividend yield
                "volatility": 0.14
            },
            {
                "symbol": "IWDA.AS.FAKE",
                "name": "iShares Core MSCI World UCITS ETF USD (Acc)",
                "initial_price": 76.25,
                "beta": 0.98,
                "expense_ratio": 0.002,
                "dividend_yield": 0.0,
                "volatility": 0.13
            },
            {
                "symbol": "VWCE.DE.FAKE",
                "name": "Vanguard FTSE All-World UCITS ETF USD Acc",
                "initial_price": 95.50,
                "beta": 1.02,
                "expense_ratio": 0.0022,
                "dividend_yield": 0.0,
                "volatility": 0.14
            },
            {
                "symbol": "EUNA.PA.FAKE",
                "name": "Amundi EURO STOXX 50 UCITS ETF EUR",
                "initial_price": 125.30,
                "beta": 1.15,
                "expense_ratio": 0.0015,
                "dividend_yield": 0.025,
                "volatility": 0.18
            }
        ]

        # Initialize portfolio tracking
        portfolio = {
            symbol: {
                "quantity": 0.0,
                "cost_basis": 0.0,
                "last_price": asset["initial_price"]
            }
            for symbol, asset in zip([a["symbol"] for a in assets], assets)
        }

        current_date = datetime.now()
        start_date = current_date - timedelta(days=self.number_of_months * 30)

        # Store asset creation tasks for later
        self.assets_to_create = assets

        # Investment strategies with target allocations and rebalancing rules
        investment_strategies = [
            {
                "symbol": "PE500.PA.FAKE",
                "target_allocation": 0.35,  # 35% of portfolio
                "monthly_base_amount": 1000.0,
                "rebalance_threshold": 0.05,  # Rebalance when 5% off target
                "broker_fee": 1.50
            },
            {
                "symbol": "LYPS.DE.FAKE",
                "target_allocation": 0.15,
                "monthly_base_amount": 500.0,
                "rebalance_threshold": 0.05,
                "broker_fee": 1.25
            },
            {
                "symbol": "IWDA.AS.FAKE",
                "target_allocation": 0.20,
                "monthly_base_amount": 600.0,
                "rebalance_threshold": 0.05,
                "broker_fee": 1.75
            },
            {
                "symbol": "VWCE.DE.FAKE",
                "target_allocation": 0.20,
                "monthly_base_amount": 600.0,
                "rebalance_threshold": 0.05,
                "broker_fee": 1.50
            },
            {
                "symbol": "EUNA.PA.FAKE",
                "target_allocation": 0.10,
                "monthly_base_amount": 300.0,
                "rebalance_threshold": 0.05,
                "broker_fee": 1.50
            }
        ]

        # Generate all investment transactions
        current = start_date
        while current <= current_date:
            self.market_simulator.update_market_conditions()

            # Calculate portfolio value
            total_value = sum(
                pos["quantity"] * pos["last_price"]
                for pos in portfolio.values()
            )

            for asset, strategy in zip(assets, investment_strategies):
                symbol = asset["symbol"]

                # Update price
                market_factor = self.market_simulator.get_market_factor()
                beta_impact = (market_factor - 1.0) * asset["beta"]
                volatility_impact = random.gauss(0, asset["volatility"] / math.sqrt(252))
                expense_impact = -asset["expense_ratio"] / 252

                daily_return = beta_impact + volatility_impact + expense_impact
                new_price = portfolio[symbol]["last_price"] * (1.0 + daily_return)
                portfolio[symbol]["last_price"] = round(new_price, 2)

                # Store investment transactions
                if current.day == 27:  # Monthly investment
                    investment_amount = strategy["monthly_base_amount"] * random.uniform(0.8, 1.2)
                    quantity = round(investment_amount / new_price, 6)

                    self.investment_transactions.append({
                        "type": "buy",
                        "symbol": symbol,
                        "quantity": quantity,
                        "price": new_price,
                        "fee": strategy["broker_fee"],
                        "date": current.isoformat(),
                        "from_account": "Checking Account",
                        "to_account": "Investment Account"
                    })

                    portfolio[symbol]["quantity"] += quantity
                    portfolio[symbol]["cost_basis"] += investment_amount

                # Store dividend transactions
                if asset["dividend_yield"] > 0 and current.day == 15:
                    monthly_yield = asset["dividend_yield"] / 12
                    dividend_amount = portfolio[symbol]["quantity"] * new_price * monthly_yield
                    if dividend_amount > 0:
                        self.transactions.append({
                            "amount": round(dividend_amount, 2),
                            "from_account": "Dividend Account",
                            "to_account": "Checking Account",
                            "transaction_type": "income",
                            "description": f"Dividend payment from {symbol}",
                            "category": "Revenus financiers",
                            "subcategory": "Dividendes",
                            "date": current.isoformat()
                        })

                # Store rebalancing transactions
                if current.day == 28 and total_value > 0:
                    current_allocation = (portfolio[symbol]["quantity"] * new_price) / total_value
                    target_allocation = strategy["target_allocation"]

                    if abs(current_allocation - target_allocation) > strategy["rebalance_threshold"]:
                        desired_value = total_value * target_allocation
                        current_value = portfolio[symbol]["quantity"] * new_price
                        value_difference = desired_value - current_value

                        if abs(value_difference) > 100:
                            quantity_difference = value_difference / new_price
                            activity_type = "buy" if value_difference > 0 else "sell"

                            self.investment_transactions.append({
                                "type": activity_type,
                                "symbol": symbol,
                                "quantity": abs(quantity_difference),
                                "price": new_price,
                                "fee": strategy["broker_fee"],
                                "date": current.isoformat(),
                                "from_account": "Checking Account" if activity_type == "buy" else "Investment Account",
                                "to_account": "Investment Account" if activity_type == "buy" else "Checking Account"
                            })

                            if activity_type == "buy":
                                portfolio[symbol]["quantity"] += abs(quantity_difference)
                                portfolio[symbol]["cost_basis"] += abs(value_difference)
                            else:
                                portfolio[symbol]["quantity"] -= abs(quantity_difference)
                                portfolio[symbol]["cost_basis"] -= abs(value_difference)

            current += timedelta(days=1)

        logger.info(f"Generated {len(self.investment_transactions)} investment transactions")

    def _queue_all_data(self) -> None:
        """Queue all generated data for API processing."""
        total_items = (
            len(self.transactions) +
            len(self.investment_transactions) +
            len(self.refunds) +
            len(self.refund_groups_to_create) +
            len(self.assets_to_create)
        )
        logger.info(f"Queueing {total_items} items for API processing...")

        # Queue regular transactions first (we need their IDs for refunds)
        transaction_id_map = {}  # Map temporary IDs to actual API IDs

        for idx, transaction in enumerate(self.transactions):
            # Convert transaction data to API format
            api_transaction = {
                "amount": transaction["amount"],
                "from_account_id": self.api.accounts[transaction["from_account"]],
                "to_account_id": self.api.accounts[transaction["to_account"]],
                "type": transaction["transaction_type"],
                "description": transaction["description"],
                "category": transaction["category"],
                "date": transaction["date"],
                "date_accountability": transaction["date"]
            }
            if transaction.get("subcategory"):
                api_transaction["subcategory"] = transaction["subcategory"]

            # Store callback to capture the API-assigned ID
            def create_callback(temp_id, idx=idx, desc=transaction["description"]):
                def callback(response):
                    if response and "id" in response:
                        transaction_id_map[temp_id] = response["id"]
                        logger.info(f"Transaction {idx+1}/{len(self.transactions)}: {desc} - ID: {response['id']}")
                return callback

            self._queue_api_task(
                method="POST",
                endpoint="/transactions",
                data=api_transaction,
                description=f"Transaction {idx+1}/{len(self.transactions)}: {transaction['description']}",
                callback=create_callback(transaction.get("id"))
            )

        # Queue asset creation first (we need asset IDs for investment transactions)
        asset_ids = {}
        for asset in self.assets_to_create:
            def create_asset_callback(symbol=asset["symbol"]):
                def callback(response):
                    if response and "id" in response:
                        asset_ids[symbol] = response["id"]
                        logger.info(f"Created asset {symbol} with ID: {response['id']}")
                return callback

            self._queue_api_task(
                method="POST",
                endpoint="/assets",
                data={"symbol": asset["symbol"], "name": asset["name"]},
                description=f"Creating asset {asset['symbol']}",
                callback=create_asset_callback()
            )

        # Wait for asset IDs to be available
        def wait_for_asset_ids():
            while len(asset_ids) < len(self.assets_to_create):
                time.sleep(0.1)
            return True

        # Queue investment transactions
        for idx, transaction in enumerate(self.investment_transactions):
            def create_investment_task():
                wait_for_asset_ids()  # Ensure we have all asset IDs
                return {
                    "from_account_id": self.api.accounts[transaction["from_account"]],
                    "to_account_id": self.api.accounts[transaction["to_account"]],
                    "asset_id": asset_ids[transaction["symbol"]],
                    "activity_type": transaction["type"],  # 'buy' or 'sell'
                    "quantity": transaction["quantity"],
                    "unit_price": transaction["price"],
                    "fee": transaction.get("fee", 0.0),
                    "tax": transaction.get("tax", 0.0),
                    "date": transaction["date"]
                }

            self._queue_api_task(
                method="POST",
                endpoint="/investments",
                data=create_investment_task(),
                description=f"Investment transaction {idx+1}/{len(self.investment_transactions)}: {transaction['type']} {transaction['symbol']}",
                callback=lambda response: logger.info(f"Created investment transaction: {response.get('transaction_id')}")
            )

        # Queue refund groups first
        refund_group_id_map = {}  # Map group names to actual API IDs

        for group in self.refund_groups_to_create:
            def create_group_callback(group_name):
                def callback(response):
                    if response and "id" in response:
                        refund_group_id_map[group_name] = response["id"]
                return callback

            self._queue_api_task(
                method="POST",
                endpoint="/refund_groups/",
                data={"name": group["name"], "description": group["description"]},
                description=f"Creating refund group {group['name']}",
                callback=create_group_callback(group["name"])
            )

        # Queue refunds last (after we have all necessary IDs)
        for idx, refund in enumerate(self.refunds):
            def create_refund_task():
                # Wait for necessary IDs to be available
                while (refund["expense_transaction_id"] not in transaction_id_map or
                       refund["income_transaction_id"] not in transaction_id_map or
                       refund["group"] not in refund_group_id_map):
                    time.sleep(0.1)

                return {
                    "income_transaction_id": transaction_id_map[refund["income_transaction_id"]],
                    "expense_transaction_id": transaction_id_map[refund["expense_transaction_id"]],
                    "amount": refund["amount"],
                    "refund_group_id": refund_group_id_map[refund["group"]],
                    "description": refund["description"]
                }

            self._queue_api_task(
                method="POST",
                endpoint="/refund_items/",
                data=create_refund_task(),
                description=f"Refund {idx+1}/{len(self.refunds)}"
            )

        logger.info(f"Queued {len(self.transactions) + len(self.investment_transactions) + len(self.refunds)} total items for processing")

    def _apply_seasonal_factor(self, pattern: TransactionPattern, date: datetime) -> float:
        """Apply seasonal adjustments to transaction amounts."""
        month = date.month
        day_of_week = date.weekday()

        seasonal_factor = 1.0

        # Electricity/heating seasonal variation
        if pattern.subcategory == "Electricité":
            # Higher in winter months (November-February)
            if month in [11, 12, 1, 2]:
                seasonal_factor *= 1.5
            # Lower in spring/fall
            elif month in [3, 4, 9, 10]:
                seasonal_factor *= 1.2
            # Lowest in summer
            else:
                seasonal_factor *= 0.8

        # Restaurant/Bar patterns
        if pattern.subcategory in ["Restaurant", "Bars / Clubs"]:
            # More spending on weekends
            if day_of_week >= 5:  # Saturday and Sunday
                seasonal_factor *= 1.4
            # More spending during summer months
            if month in [6, 7, 8]:
                seasonal_factor *= 1.3

        # Shopping patterns
        if pattern.category == "Shopping":
            # Holiday season shopping (November-December)
            if month in [11, 12]:
                seasonal_factor *= 1.8
            # Summer sales (July)
            elif month == 7:
                seasonal_factor *= 1.5

        # Grocery patterns
        if pattern.subcategory == "Supermarché / Epicerie":
            # More grocery shopping on weekends
            if day_of_week >= 5:
                seasonal_factor *= 1.3
            # Holiday season
            if month == 12:
                seasonal_factor *= 1.4

        return seasonal_factor

    def _generate_transaction_amount(self, pattern: TransactionPattern, date: datetime) -> float:
        """Generate a realistic transaction amount based on the pattern and date."""
        base = pattern.base_amount
        variance = pattern.variance

        # Apply seasonal factors
        seasonal_factor = self._apply_seasonal_factor(pattern, date)

        # Apply random variance
        variance_factor = 1.0 + random.uniform(-variance, variance)

        # Combine factors and round to 2 decimal places
        amount = base * seasonal_factor * variance_factor
        return round(amount, 2)

    def _should_generate_transaction(self, pattern: TransactionPattern, date: datetime) -> bool:
        """Determine if a transaction should be generated for this pattern and date."""
        if pattern.frequency == "monthly":
            return pattern.day_of_month == date.day

        elif pattern.frequency == "weekly":
            # Generate for each Monday (or specified day of week)
            return date.weekday() == 0

        elif pattern.frequency == "biweekly":
            # Generate every other Monday
            week_number = date.isocalendar()[1]
            return date.weekday() == 0 and week_number % 2 == 0

        elif pattern.frequency == "variable":
            # For variable frequency, use probability
            if pattern.subcategory in ["Restaurant", "Bars / Clubs"]:
                # Higher probability on weekends
                if date.weekday() >= 5:
                    return random.random() < (pattern.probability * 1.5)
            return random.random() < pattern.probability

            return False

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
            ("Dividend Account", "income", bank_ids["Chase Bank"]),
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

    def _generate_refunds(self) -> None:
        """Generate sample refund groups and refund items with realistic patterns."""
        logger.info("Generating refund data with realistic patterns...")

        # Use local transactions instead of fetching from API
        expense_transactions = [t for t in self.transactions if t["transaction_type"] == "expense"]
        income_transactions = [t for t in self.transactions if t["transaction_type"] == "income"]

        if not expense_transactions or not income_transactions:
            logger.error("Not enough transactions to create refunds")
            return

        # Define refund groups with more detailed descriptions
        refund_groups = [
            {
                "name": "Healthcare Reimbursements",
                "description": "Medical expenses reimbursed by insurance (70% coverage for standard care, 100% for hospitalization)",
            },
            {
                "name": "Work Expenses",
                "description": "Professional expenses reimbursed by employer (transport, meals, equipment)",
            },
            {
                "name": "Shared Expenses",
                "description": "Regular expenses shared with roommates (rent, utilities, groceries)",
            },
            {
                "name": "Online Shopping Returns",
                "description": "Product returns and service cancellations",
            },
            {
                "name": "Social Activities",
                "description": "Group expenses split between friends (restaurants, events, trips)",
            },
            {
                "name": "Insurance Claims",
                "description": "Various insurance reimbursements (home, travel, electronics)",
            }
        ]

        # Store refund groups for later API creation
        self.refund_groups_to_create = refund_groups

        # Categorize expenses for more realistic refund scenarios
        categorized_expenses = {
            "healthcare": [t for t in expense_transactions
                         if "Santé" in t.get("category", "")],
            "groceries": [t for t in expense_transactions
                         if "Supermarché" in t.get("subcategory", "")],
            "restaurants": [t for t in expense_transactions
                          if "Restaurant" in t.get("subcategory", "")],
            "transport": [t for t in expense_transactions
                         if "Transport" in t.get("category", "")],
            "shopping": [t for t in expense_transactions
                        if "Shopping" in t.get("category", "") or
                        "Amazon" in t.get("description", "")],
            "entertainment": [t for t in expense_transactions
                            if "Loisirs" in t.get("category", "") or
                            "Entertainment" in t.get("description", "")]
        }

        # Get salary transactions for work expense refunds
        salary_transactions = [t for t in income_transactions
                             if "Salary" in t.get("description", "")]

        # Create various realistic refund scenarios
        refund_scenarios = []

        # Helper to generate a unique temporary ID for transactions
        def get_temp_id(transaction, prefix="T"):
            # Create a unique ID based on transaction details
            return f"{prefix}{hash(transaction['date'] + transaction['description'] + str(transaction['amount']))}"

        # Add temporary IDs to all transactions for reference
        for t in expense_transactions + income_transactions:
            t["id"] = get_temp_id(t)

        # 1. Healthcare reimbursements
        for expense in categorized_expenses["healthcare"]:
            # Different reimbursement rates based on amount
            if expense["amount"] > 200:  # Likely a major procedure
                refund_rate = 1.0  # 100% coverage
            else:
                refund_rate = 0.7  # Standard 70% coverage

            # Add delay for insurance processing (15-45 days)
            refund_date = (
                datetime.fromisoformat(expense["date"])
                + timedelta(days=random.randint(15, 45))
            ).isoformat()

            refund_scenarios.append({
                "expense_transaction_id": expense["id"],
                "income_transaction_id": random.choice(income_transactions)["id"],
                "amount": round(expense["amount"] * refund_rate, 2),
                "group": "Healthcare Reimbursements",
                "description": f"Health insurance reimbursement for {expense['description']}",
                "date": refund_date
            })

        # Continue with other refund scenarios...
        # (keeping the same logic but using local transaction IDs)

        # Store refund scenarios for later API creation
        self.refunds = refund_scenarios
        logger.info(f"Generated {len(refund_scenarios)} refund scenarios")

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

        # Show refund groups
        print("\nRefund Groups:")
        print("-------------")
        refund_groups_response = self.api._make_request("GET", "/refund_groups/")
        if refund_groups_response and "items" in refund_groups_response:
            for group in refund_groups_response["items"]:
                print(f"- {group['name']}")
                if group.get('description'):
                    print(f"  Description: {group['description']}")
                print(f"  ID: {group['id']}")
                print()

        # Show refund items
        print("\nRefund Items:")
        print("------------")
        refund_items_response = self.api._make_request("GET", "/refund_items/")
        if refund_items_response and "items" in refund_items_response:
            for item in refund_items_response["items"]:
                print(f"- {item.get('description', 'Refund')}")
                print(f"  Amount: ${item['amount']:.2f}")
                print(f"  Income Transaction: {item['income_transaction_id']}")
                print(f"  Expense Transaction: {item['expense_transaction_id']}")
                if item.get('refund_group_id'):
                    print(f"  Group ID: {item['refund_group_id']}")
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
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Generate test data for WealthManager API')
    parser.add_argument(
        '--months',
        type=int,
        default=12,
        help='Number of months of historical data to generate (default: 12)'
    )
    parser.add_argument(
        '--backend-url',
        type=str,
        help='Backend API URL (default: from BACKEND_URL env var or http://localhost:5000)'
    )
    args = parser.parse_args()

    # Create test data creator with command line arguments
    creator = TestDataCreator(number_of_months=args.months)
    if args.backend_url:
        creator.api.base_url = args.backend_url

    creator.delete_test_data()
    creator.create_test_data()
    creator.show_test_data()


if __name__ == "__main__":
    main()
