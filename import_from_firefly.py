import concurrent.futures
import logging
import time  # Added for cache expiration
from io import StringIO
from typing import Any, TypedDict
from datetime import datetime

import pandas as pd
import requests
from faker import Faker
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry  # Corrected import

fake = Faker()

logger = logging.getLogger(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Add a cache for accounts
_accounts_cache: dict[str, Any] | None = None
_accounts_cache_timestamp: float = 0
_CACHE_EXPIRY_SECONDS: int = 300  # Cache expires after 5 minutes

# Add a lock for thread safety
import threading

_cache_lock = threading.Lock()


class CategoryInfo(TypedDict):
    category: str
    subCategory: str | None


# Define the mapping of budgets to categories and subcategories
budget_to_category_mapping: dict[str, CategoryInfo] = {
    "Auto & Transports": {
        "category": "Auto & Transports",
        "subCategory": "Auto & Transports - Autres",
    },
    "Logement": {"category": "Logement", "subCategory": "Loyer"},
    "Alimentation & Restaurant": {
        "category": "Alimentation & Restauration",
        "subCategory": "Alimentation & Restauration - Autres",
    },
    "Banque": {"category": "Banque", "subCategory": "Banque - Autres"},
    "Loisir & Sorties": {
        "category": "Loisirs & Sorties",
        "subCategory": "Loisirs & Sorties - Autres",
    },
    "Assurance": {"category": "Divers", "subCategory": "A catégoriser"},
    "Achat & Shopping": {
        "category": "Achats & Shopping",
        "subCategory": "Achats & Shopping - Autres",
    },
    "Autres": {"category": "Divers", "subCategory": "A catégoriser"},
}

category_to_category_mapping = {
    "Salaire": "Salaires",
    "Aides sociales": "Allocations et pensions",
    "Ajustement Lydia": "Autres rentrées",
    "Ajustement Yuzu": "Autres rentrées",
    "Anniversaire": "Autres rentrées",
    "Epargne / invest": "Investissements",
    "Prêt étudiant": "Autres rentrées",
    "Primes": "Autres rentrées",
    "Primes employeur": "Autres rentrées",
    "Remboursements": "Remboursements",
    "Retour Crypto": "Autres rentrées",
    "Ventes": "Autres rentrées",
    "": "Autres",
}

# Define account type mappings
account_type_mapping = {
    "Revenue account": "income",
    "Expense account": "expense",
}

# Account name to type mapping
account_name_type_mapping = {
    "Boursorama Courant": "checking",
    "Caisse Épargne Courant": "checking",
    "Crédit Agricole LDDS": "savings",
    "Crédit Agricole Courant": "checking",
    "Lendermarket P2P": "investment",
    "Boursorama Espèce CTO": "investment",
    "Fortuneo Courant": "checking",
    "Edenred Ticket restaurant": "checking",
    "Boursorama Espèce PEA": "investment",
    "Abeille Vie Assurance Vie": "investment",
    "Raizers P2P": "investment",
    "Twino P2P": "investment",
    "BienPreter P2P": "investment",
    "Crédit Agricole Livret Jeune": "savings",
    "Fortuneo Espèce CTO": "investment",
    "Lydia Courant": "checking",
    "Yuzu Crypto": "investment",
    "Wiseed P2P": "investment",
    "Prêt Etudiant CA": "loan",
    "Prêt Etudiant CE": "loan",
    "Crédit Agricole LEP": "savings",
    "Natixis PEG": "investment",
    "Boursorama CTO": "investment",
    "Boursorama PEA": "investment",
    "Natixis PERCO": "investment",
    "LouveInvest SCPI": "investment",
    'Balance initiale pour "Prêt Etudiant CA"': "expense",
    'Balance initiale pour "Prêt Etudiant CE"': "expense",
    "Initial balance account of Prêt Etudiant CA": "expense",
    "Initial balance account of Prêt Etudiant CE": "expense",
    "Robocash P2P": "investment",
    "Miimosa P2P": "investment",
    "Cardif PER": "investment",
    "Revolut": "checking",
    "Solde initial du compte Prêt Etudiant CA": "expense",
    "Solde initial du compte Prêt Etudiant CE": "expense",
    "Paypal Alan": "checking",
}

bank_website_mapping = {
    "Boursorama": "https://clients.boursobank.com/",
    "Crédit Agricole": "https://www.credit-agricole.fr/ca-normandie-seine/particulier/acceder-a-mes-comptes.html",
    "Caisse d'Epargne": "https://www.caisse-epargne.fr/",
}

# Initialize an empty account dictionary
account_dictionary: dict[str, str] = {}


class WealthManagerApi:
    def __init__(
        self,
        base_url: str,
        name: str,
        email: str,
        password: str,
        delete_if_exists: bool = False,
    ):
        self.base_url = base_url
        self.name = name
        self.email = email
        self.password = password

        create_user_r = self.create_user()
        if create_user_r.status_code == 201:
            user_data = create_user_r.json()
            assert user_data["email"] == self.email
            assert isinstance(user_data["id"], int)
            assert isinstance(user_data["last_login"], str)
            assert user_data["name"] == self.name
            assert user_data["password"] == self.password
            logging.info(f"Successfully created user: {self.email}")
            # Login to get JWT token after creating user
            self._login_user()
        elif create_user_r.status_code == 422:
            # User already exists
            logging.info(f"User already exists: {self.email}")

            if delete_if_exists:
                # Login, delete user, and recreate
                self._login_user()
                logging.info(f"Deleting existing user: {self.email}")
                self.delete_user()

                # Recreate user
                create_user_r = self.create_user()
                if create_user_r.status_code == 201:
                    logging.info(f"Successfully recreated user: {self.email}")
                    self._login_user()
                else:
                    logging.error(
                        f"Failed to recreate user: {create_user_r.status_code}, {create_user_r.text}"
                    )
                    raise Exception(
                        f"Failed to recreate user: {create_user_r.status_code}"
                    )
            else:
                # Just login with existing user
                self._login_user()
        else:
            logging.error(
                f"Failed to create user: {create_user_r.status_code}, {create_user_r.text}"
            )
            raise Exception(f"Failed to create user: {create_user_r.status_code}")

        # Verify we have a valid JWT token
        if not hasattr(self, "jwt_token") or not self.jwt_token:
            raise Exception("Failed to obtain valid JWT token during initialization")

    def _login_user(self):
        """Internal method to login and set JWT token"""
        login_user_r = self.login_user()
        if login_user_r.status_code == 200 or login_user_r.status_code == 201:
            self.jwt_token = login_user_r.json()["access_token"]
            logging.info(f"Successfully logged in user: {self.email}")
        else:
            logging.error(
                f"Failed to log in user: {login_user_r.status_code}, {login_user_r.text}"
            )
            raise Exception(f"Failed to log in user: {login_user_r.status_code}")

    def create_user(self):
        headers = {"Content-Type": "application/json"}
        data = {"name": self.name, "email": self.email, "password": self.password}
        url = f"{self.base_url}/users/register"
        logging.info(f"Creating user: {data} {url}")
        response = requests.post(url, json=data, headers=headers)
        return response

    def login_user(self):
        url = f"{self.base_url}/users/login"  # Adjust the URL if necessary
        headers = {"Content-Type": "application/json"}
        data = {"email": self.email, "password": self.password}
        response = requests.post(url, json=data, headers=headers)
        return response

    def get_or_create_asset(self, symbol: str) -> int:
        """Get asset ID from symbol or create if it doesn't exist.

        Args:
            symbol (str): The asset symbol (e.g. "AAPL", "IDUS.L")

        Returns:
            int: The asset ID

        """
        # First try to get the asset
        url = f"{self.base_url}/assets?symbol={symbol}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)

        if 200 <= response.status_code < 300:
            assets = response.json()
            if len(assets["items"]) > 0:
                return assets["items"][0]["id"]

        # If not found, create it
        url = f"{self.base_url}/assets"
        data = {
            "symbol": symbol,
            "name": symbol,  # You might want to fetch the actual name from an API
        }
        response = requests.post(url, headers=headers, json=data)

        if 200 <= response.status_code < 300:
            return response.json()["id"]
        raise Exception(f"Failed to create asset: {response.text}")

    def create_investment_transaction_in_api(
        self,
        transaction_data: dict[str, Any],
    ) -> requests.Response:
        """Create an investment transaction in the API.

        Args:
            transaction_data (Dict[str, Any]): The investment transaction data

        Returns:
            requests.Response: The API response

        """
        url = f"{self.base_url}/investments"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.post(url, headers=headers, json=transaction_data)
        return response

    def bank_id_from_bank_name(self, bank_name: str) -> int:
        banks = self.get_banks_from_api()
        # print(f"{banks=}")
        bank_id_mapping = {f"{bank['name']}": bank["id"] for bank in banks}
        result = bank_id_mapping.get(f"{bank_name}", None)
        if result is None:
            # logging.info(f"Bank not found, creating new bank: {bank_name}")
            self.create_bank_in_api(bank_name, bank_website_mapping.get(bank_name))
            banks = self.get_banks_from_api()
            bank_id_mapping = {f"{bank['name']}": bank["id"] for bank in banks}
            result = bank_id_mapping.get(f"{bank_name}", None)
            # logging.info(f"Created bank: {bank_name}, ID: {result}")
            if result is None:
                raise Exception(f"Failed to create bank: {bank_name}")
        return result

    def bank_id_from_account_name(self, account_name: str) -> int:
        if account_name.startswith("Boursorama"):
            return self.bank_id_from_bank_name("Boursorama")
        if account_name.startswith("Crédit Agricole"):
            return self.bank_id_from_bank_name("Crédit Agricole")
        if account_name.startswith("Fortuneo"):
            return self.bank_id_from_bank_name("Fortuneo")
        if (
            account_name.startswith("Prêt Etudiant CA")
            or "Prêt Etudiant CA" in account_name
        ):
            return self.bank_id_from_bank_name("Crédit Agricole")
        if (
            account_name.startswith("Prêt Etudiant CE")
            or "Prêt Etudiant CE" in account_name
        ):
            return self.bank_id_from_bank_name("Caisse d'Epargne")
        if account_name.startswith("Solde initial du compte Prêt"):
            return self.bank_id_from_bank_name("Crédit Agricole")
        if account_name.startswith('Balance initiale pour "Prêt'):
            return self.bank_id_from_bank_name("Crédit Agricole")
        if "P2P" in account_name:
            return self.bank_id_from_bank_name("P2P")
        return self.bank_id_from_bank_name("Other")

    def get_user_from_api(self, user_id: int):
        url = f"{self.base_url}/users/{user_id}"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)
        return response

    def get_banks_from_api(self) -> list[dict[str, Any]]:
        url = f"{self.base_url}/banks"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)
        if 200 <= response.status_code < 300:
            return response.json()["items"]  # Assuming the response is a list of banks
        logging.error(
            f"Failed to retrieve banks: {response.status_code}, {response.text}"
        )
        return []

    def delete_user(self):
        url = f"{self.base_url}/users/"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.delete(url, headers=headers)
        return response

    def get_accounts_from_api(self) -> list[dict[str, Any]]:
        global _accounts_cache, _accounts_cache_timestamp

        # Use a lock to ensure thread safety when accessing the cache
        with _cache_lock:
            current_time = time.time()

            # Check if cache is valid
            if (
                _accounts_cache is not None
                and current_time - _accounts_cache_timestamp < _CACHE_EXPIRY_SECONDS
            ):
                logging.debug("Using cached accounts data")
                return _accounts_cache

            # Cache is invalid or doesn't exist, fetch from API
            url = f"{self.base_url}/accounts?per_page=1000"
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json",
            }

            logging.info("Fetching accounts from API")
            response = requests.get(url, headers=headers)

            if 200 <= response.status_code < 300:
                # Update cache
                _accounts_cache = response.json()["items"]
                _accounts_cache_timestamp = current_time
                return _accounts_cache

            logging.error(
                f"Failed to retrieve accounts: {response.status_code}, {response.text}"
            )
            return []

    def create_bank_in_api(self, bank_name: str, website: str | None = None):
        url = f"{self.base_url}/banks"  # Adjust the URL if necessary
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        data = {"name": bank_name}
        if website:
            data["website"] = website
        # Set up a session with retries and increased timeout
        session = requests.Session()
        retries = Retry(total=5, backoff_factor=1, status_forcelist=[502, 503, 504])
        session.mount("http://", HTTPAdapter(max_retries=retries))

        try:
            # logging.debug(f"Sending POST request to {url} with data: {data}")
            response = session.post(
                url, json=data, headers=headers, timeout=10
            )  # Increase timeout to 10 seconds
            return response
            # logging.debug(f"Received response: {response.status_code} - {response.text}")
        except requests.exceptions.RequestException as e:
            logging.exception(f"An error occurred during POST request: {e}")
            raise

    def create_account_in_api(
        self, account_name: str, account_type: str, currency: str, bank_id: int
    ):
        url = f"{self.base_url}/accounts"  # Adjust the URL if necessary
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        data = {
            "name": account_name,
            "type": account_type,
            "bank_id": bank_id,
        }

        # Set up a session with retries and increased timeout
        session = requests.Session()
        retries = Retry(total=5, backoff_factor=1, status_forcelist=[502, 503, 504])
        session.mount("http://", HTTPAdapter(max_retries=retries))

        try:
            logging.info(f"Sending POST request to {url} with data: {data}")
            response = session.post(
                url, json=data, headers=headers, timeout=10
            )  # Increase timeout to 10 seconds
            logging.info(f"Received response: {response.status_code} - {response.text}")
            return response

        except requests.exceptions.RequestException as e:
            logging.exception(f"An error occurred during POST request: {e}")
            raise

    def get_account_id_from_name(self, account_name: str, account_type: str):
        try:
            accounts = self.get_accounts_from_api()
            logging.debug(f"Accounts retrieved: {accounts}")
            # Create a unique key for each account based on name and type
            account_id_mapping = {
                f"{account['name']}|{account['type']}": account["id"]
                for account in accounts
            }
            result = account_id_mapping.get(f"{account_name}|{account_type}", None)
            if result is None:
                # logging.info(f"Account not found, creating new account: {account_name}, {account_type}")
                self.create_account_in_api(
                    account_name,
                    account_type,
                    "EUR",
                    self.bank_id_from_account_name(account_name),
                )

                # Invalidate cache to ensure we get the newly created account
                with _cache_lock:
                    global _accounts_cache_timestamp
                    _accounts_cache_timestamp = 0

                accounts = self.get_accounts_from_api()
                account_id_mapping = {
                    f"{account['name']}|{account['type']}": account["id"]
                    for account in accounts
                }
                result = account_id_mapping.get(f"{account_name}|{account_type}", None)
                print(f"{result=}")
                # logging.info(f"Created account: {account_name}|{account_type}, ID: {result}")
                if result is None:
                    raise Exception(
                        f"Failed to create account: {account_name}|{account_type}"
                    )
            return result
        except Exception as e:
            logging.exception(f"An error occurred in get_account_id_from_name: {e}")
            raise

    def create_transaction_in_api(
        self,
        transaction_data: dict[str, Any],
    ) -> requests.Response:
        url = f"{self.base_url}/transactions"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        # logging.info(
        #     f"Creating transaction: {transaction_data['date'][:10]} - {transaction_data['from_account_id']} - {transaction_data['to_account_id']} - {transaction_data['amount']} - {transaction_data['type']} - {transaction_data['category']} - {transaction_data['subcategory']} - {transaction_data['description']}"
        # )
        response = requests.post(url, json=transaction_data, headers=headers)
        if 200 <= response.status_code < 300:
            logging.info(
                f"Transaction created: {transaction_data['date'][:10]} - {transaction_data['from_account_id']} - {transaction_data['to_account_id']} - {transaction_data['amount']} - {transaction_data['type']} - {transaction_data['category']} - {transaction_data['subcategory']} - {transaction_data['description']}"
            )
            return response
        logger.error(
            f"Failed to create transaction: {response.status_code} {response.text} , {transaction_data}"
        )
        raise Exception(
            f"Failed to create transaction: {response.text}, {transaction_data}"
        )

    def create_liability_in_api(
        self,
        liability_data: dict[str, Any],
    ) -> requests.Response:
        url = f"{self.base_url}/liabilities"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.post(url, json=liability_data, headers=headers)
        return response

    def get_liabilities_from_api(self) -> list[dict[str, Any]]:
        """Fetch all liabilities from the API."""
        url = f"{self.base_url}/liabilities?per_page=1000"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()["items"]
        logger.error(f"Failed to retrieve liabilities: {response.status_code}, {response.text}")
        return []

    def record_liability_payment(self, payment_data: dict[str, Any]) -> requests.Response:
        """Record a liability payment.

        Args:
            payment_data: Dictionary with payment details
                liability_id: int
                payment_date: str (YYYY-MM-DD)
                amount: float
                principal_amount: float
                interest_amount: float
                extra_payment: float
                transaction_id: int (optional)

        Returns:
            requests.Response: API response
        """
        url = f"{self.base_url}/liability_payments"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.post(url, json=payment_data, headers=headers)
        return response

    def create_specific_liabilities(self) -> dict[str, int]:
        """Create specific predefined liabilities if they don't exist.

        Returns:
            dict: Mapping of liability names to their IDs
        """
        existing_liabilities = self.get_liabilities_from_api()
        liability_ids = {}

        # Check if Prêt Etudiant CA exists
        ca_loan_exists = any(liability["name"] == "Prêt Etudiant CA" for liability in existing_liabilities)
        ce_loan_exists = any(liability["name"] == "Prêt Etudiant CE" for liability in existing_liabilities)

        # Get account IDs for both loans
        ca_account_id = self.get_account_id_from_name("Prêt Etudiant CA", "loan")
        ce_account_id = self.get_account_id_from_name("Prêt Etudiant CE", "loan")

        if not ca_loan_exists and ca_account_id:
            # Create CA loan
            ca_loan_data = {
                "name": "Prêt Etudiant CA",
                "description": "",
                "liability_type": "standard_loan",
                "principal_amount": 15000,
                "interest_rate": 0.9,
                "start_date": "2023-03-04",
                "compounding_period": "monthly",
                "payment_frequency": "monthly",
                "deferral_period_months": 0,
                "deferral_type": "none",
                "direction": "i_owe",
                "account_id": ca_account_id,
                "end_date": "2028-03-04"
            }

            ca_response = self.create_liability_in_api(ca_loan_data)
            if 200 <= ca_response.status_code < 300:
                liability_ids["Prêt Etudiant CA"] = ca_response.json()["id"]
                logger.info(f"Created liability: Prêt Etudiant CA with ID {liability_ids['Prêt Etudiant CA']}")
            else:
                logger.error(f"Failed to create CA liability: {ca_response.status_code}, {ca_response.text}")
        else:
            # Get existing liability ID
            for liability in existing_liabilities:
                if liability["name"] == "Prêt Etudiant CA":
                    liability_ids["Prêt Etudiant CA"] = liability["id"]
                    break

        if not ce_loan_exists and ce_account_id:
            # Create CE loan
            ce_loan_data = {
                "name": "Prêt Etudiant CE",
                "description": "",
                "liability_type": "total_deferred_loan",
                "deferral_period_months": 60,
                "deferral_type": "total",
                "principal_amount": 20000,
                "interest_rate": 2.3,
                "start_date": "2025-05-05",
                "compounding_period": "monthly",
                "payment_frequency": "monthly",
                "direction": "i_owe",
                "account_id": ce_account_id,
                "end_date": "2035-05-05"
            }

            ce_response = self.create_liability_in_api(ce_loan_data)
            if 200 <= ce_response.status_code < 300:
                liability_ids["Prêt Etudiant CE"] = ce_response.json()["id"]
                logger.info(f"Created liability: Prêt Etudiant CE with ID {liability_ids['Prêt Etudiant CE']}")
            else:
                logger.error(f"Failed to create CE liability: {ce_response.status_code}, {ce_response.text}")
        else:
            # Get existing liability ID
            for liability in existing_liabilities:
                if liability["name"] == "Prêt Etudiant CE":
                    liability_ids["Prêt Etudiant CE"] = liability["id"]
                    break

        return liability_ids

    def link_transactions_to_liabilities(self, file_path: str):
        """Find relevant transactions and link them to the corresponding liabilities as payments.

        Args:
            file_path: Path to the CSV file with transactions
        """
        # Create liabilities if they don't exist
        liability_ids = self.create_specific_liabilities()
        if not liability_ids:
            logger.error("No liabilities found or created. Cannot link transactions.")
            return

        # Load transactions from CSV
        df = pd.read_csv(file_path)

        # Get existing transactions from API
        existing_transactions = self.get_transactions_from_api(999999).json().get("items", [])

        # Get existing liability payments to avoid duplicates
        all_liability_payments = self.get_liability_payments_from_api()

        # Find CA loan transactions
        ca_loan_transactions = df[
            (df["destination_name"] == "Prêt Etudiant CA") |
            ((df["source_name"] == "Prêt Etudiant CA") & (df["description"].str.contains("REALISATION DE PRET", na=False)))
        ]

        # Find CE loan transactions
        ce_loan_transactions = df[
            (df["destination_name"] == "Prêt Etudiant CE") |
            ((df["source_name"] == "Prêt Etudiant CE") & (df["description"].str.contains("BPCE FINANCEMENT", na=False)))
        ]

        # Process CA loan transactions
        ca_loan_id = liability_ids.get("Prêt Etudiant CA")
        if ca_loan_id:
            # Get amortization schedule for CA loan
            ca_amortization = self.get_liability_by_id(ca_loan_id).get("amortization_schedule", [])
            ca_schedule_map = {item["payment_date"]: item for item in ca_amortization}

            for _, row in ca_loan_transactions.iterrows():
                # Find the transaction ID in the existing transactions
                transaction_id = None
                transaction_amount = abs(float(row["amount"]))
                transaction_date = row["date"][:10]

                for existing_tx in existing_transactions:
                    if (existing_tx["date"] == transaction_date and
                        abs(abs(existing_tx["amount"]) - transaction_amount) < 0.01):
                        transaction_id = existing_tx["id"]
                        break

                if transaction_id:
                    # Check if this payment already exists
                    if not any(
                        payment["liability_id"] == ca_loan_id and
                        payment["transaction_id"] == transaction_id
                        for payment in all_liability_payments
                    ):
                        # Find matching schedule entry
                        schedule_entry = ca_schedule_map.get(transaction_date)

                        # If no exact match, look for entries within a 5-day window
                        if not schedule_entry:
                            transaction_date_obj = datetime.strptime(transaction_date, "%Y-%m-%d").date()
                            for schedule_date, entry in ca_schedule_map.items():
                                schedule_date_obj = datetime.strptime(schedule_date, "%Y-%m-%d").date()
                                if abs((schedule_date_obj - transaction_date_obj).days) <= 5:
                                    schedule_entry = entry
                                    break

                        # Use schedule amounts if available, otherwise use defaults
                        if schedule_entry:
                            principal_amount = schedule_entry["principal_amount"]
                            interest_amount = schedule_entry["interest_amount"]
                            extra_payment = schedule_entry.get("extra_payment", 0.0)
                        else:
                            # Fallback to simple split if no schedule entry found
                            principal_amount = transaction_amount
                            interest_amount = 0
                            extra_payment = 0

                        # Create payment
                        payment_data = {
                            "liability_id": ca_loan_id,
                            "payment_date": transaction_date,
                            "amount": transaction_amount,
                            "principal_amount": principal_amount,
                            "interest_amount": interest_amount,
                            "extra_payment": extra_payment,
                            "transaction_id": transaction_id
                        }
                        print(f"{payment_data=}")

                        payment_response = self.record_liability_payment(payment_data)
                        if 200 <= payment_response.status_code < 300:
                            logger.info(f"Recorded payment for CA loan: {transaction_amount} on {transaction_date} (Principal: {principal_amount}, Interest: {interest_amount})")
                        else:
                            logger.error(f"Failed to record CA payment: {payment_response.status_code}, {payment_response.text}")

        # Process CE loan transactions
        ce_loan_id = liability_ids.get("Prêt Etudiant CE")
        if ce_loan_id:
            # Get amortization schedule for CE loan
            ce_amortization = self.get_liability_by_id(ce_loan_id).get("amortization_schedule", [])
            ce_schedule_map = {item["payment_date"]: item for item in ce_amortization}

            for _, row in ce_loan_transactions.iterrows():
                # Find the transaction ID in the existing transactions
                transaction_id = None
                transaction_amount = abs(float(row["amount"]))
                transaction_date = row["date"][:10]

                for existing_tx in existing_transactions:
                    if (existing_tx["date"] == transaction_date and
                        abs(abs(existing_tx["amount"]) - transaction_amount) < 0.01):
                        transaction_id = existing_tx["id"]
                        break

                if transaction_id:
                    # Check if this payment already exists
                    if not any(
                        payment["liability_id"] == ce_loan_id and
                        payment["transaction_id"] == transaction_id
                        for payment in all_liability_payments
                    ):
                        # Find matching schedule entry
                        schedule_entry = ce_schedule_map.get(transaction_date)

                        # If no exact match, look for entries within a 5-day window
                        if not schedule_entry:
                            transaction_date_obj = datetime.strptime(transaction_date, "%Y-%m-%d").date()
                            for schedule_date, entry in ce_schedule_map.items():
                                schedule_date_obj = datetime.strptime(schedule_date, "%Y-%m-%d").date()
                                if abs((schedule_date_obj - transaction_date_obj).days) <= 5:
                                    schedule_entry = entry
                                    break

                        # Use schedule amounts if available, otherwise use defaults
                        if schedule_entry:
                            principal_amount = schedule_entry["principal_amount"]
                            interest_amount = schedule_entry["interest_amount"]
                            extra_payment = schedule_entry.get("extra_payment", 0.0)
                        else:
                            # Fallback to simple split if no schedule entry found
                            principal_amount = transaction_amount
                            interest_amount = 0
                            extra_payment = 0

                        # Create payment
                        payment_data = {
                            "liability_id": ce_loan_id,
                            "payment_date": transaction_date,
                            "amount": transaction_amount,
                            "principal_amount": principal_amount,
                            "interest_amount": interest_amount,
                            "extra_payment": extra_payment,
                            "transaction_id": transaction_id
                        }

                        payment_response = self.record_liability_payment(payment_data)
                        if 200 <= payment_response.status_code < 300:
                            logger.info(f"Recorded payment for CE loan: {transaction_amount} on {transaction_date} (Principal: {principal_amount}, Interest: {interest_amount})")
                        else:
                            logger.error(f"Failed to record CE payment: {payment_response.status_code}, {payment_response.text}")

    def get_liability_payments_from_api(self) -> list[dict[str, Any]]:
        """Fetch all liability payments from the API."""
        url = f"{self.base_url}/liability_payments?per_page=1000"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()["items"]
        logger.error(f"Failed to retrieve liability payments: {response.status_code}, {response.text}")
        return []

    @staticmethod
    def handle_transaction_type(transaction_type: str) -> str:
        if transaction_type == "Deposit":
            return "income"
        if transaction_type == "Withdrawal":
            return "expense"
        if transaction_type == "Transfer":
            return "transfer"
        if transaction_type == "Opening balance":
            return "income"
        raise ValueError(f"Unknown transaction type: {transaction_type}")

    @staticmethod
    def transform_budget_to_categories(
        budget: str, transaction_type: str
    ) -> CategoryInfo:
        """Transforms a budget string into a dictionary containing category and subcategory information.

        Args:
        budget (str): The budget string to be transformed.

        Returns:
        CategoryInfo: A dictionary containing 'category' and 'subCategory' information.

        """
        if pd.isna(budget):
            if transaction_type == "income":
                return {"category": "Autres rentrées", "subCategory": None}
            return {"category": "Divers", "subCategory": "A catégoriser"}
        category_info = budget_to_category_mapping.get(budget)
        if transaction_type == "income":
            return {"category": "Autres rentrées", "subCategory": None}
        # print(f"{category_info=}")
        if category_info:
            return category_info
        return {"category": "Divers", "subCategory": "A catégoriser"}

    @staticmethod
    def transform_budgets_to_categories(
        self, budgets: list[str], transaction_type: str
    ) -> list[CategoryInfo]:
        categories: list[CategoryInfo] = []
        for budget in budgets:
            categories.append(
                self.transform_budget_to_categories(budget, transaction_type)
            )
        return categories

    def get_transactions_from_api(
        self, number_of_transactions: int = 1000
    ) -> requests.Response:
        url = f"{self.base_url}/transactions?per_page={number_of_transactions}&page=1"  # Adjust the URL if necessary
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)
        return response

    def get_wealth_from_api(self) -> requests.Response:
        url = f"{self.base_url}/accounts/balance_over_time?start_date=2024-01-01&end_date=2024-08-12"  # Adjust the URL if necessary
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)
        return response

    def get_dividend_transactions(
        self, number_of_transactions: int = 1000
    ) -> list[dict[str, Any]]:
        """Get dividend transactions from the API.

        Returns:
            list[dict[str, Any]]: List of dividend transactions

        """
        url = f"{self.base_url}/transactions?subcategory=Dividends&per_page={number_of_transactions}"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)
        if 200 <= response.status_code < 300:
            return response.json().get("items", [])
        logger.error(
            f"Failed to retrieve dividend transactions: {response.status_code}, {response.text}"
        )
        return []

    def get_liability_by_id(self, liability_id: int) -> dict[str, Any]:
        """Get a liability by ID with its amortization schedule.

        Args:
            liability_id (int): The ID of the liability to fetch

        Returns:
            dict[str, Any]: The liability data with amortization schedule
        """
        url = f"{self.base_url}/liabilities/{liability_id}"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            liability_data = response.json()

            # Get amortization schedule
            schedule_url = f"{self.base_url}/liabilities/{liability_id}/amortization"
            schedule_response = requests.get(schedule_url, headers=headers)
            if schedule_response.status_code == 200:
                liability_data["amortization_schedule"] = schedule_response.json()
            else:
                logger.error(f"Failed to get amortization schedule: {schedule_response.status_code}, {schedule_response.text}")
                liability_data["amortization_schedule"] = []

            return liability_data
        logger.error(f"Failed to get liability: {response.status_code}, {response.text}")
        return {}


def process_investment_csv(
    csv_data: str, account_name: str, wealthmanager_api: WealthManagerApi | None = None
):
    """Process investment transactions from CSV data.

    Args:
        csv_data (str): CSV string containing investment transactions
        account_name (str): Name of the investment account (e.g. "Boursorama CTO", "Boursorama PEA")
        wealthmanager_api (WealthManagerApi, optional): API instance. If None, will only analyze without syncing.

    """
    # Read the CSV data into a DataFrame
    df = pd.read_csv(
        StringIO(csv_data),
        comment="#",
        skip_blank_lines=True,
        engine="python",  # Use python engine for more flexible parsing
        on_bad_lines="warn",  # Skip lines that can't be parsed correctly
    )
    df = df.sort_values(by="date", ascending=True)

    # Fetch existing investments and dividends - we need this even in dry run mode to show accurate missing count
    existing_investments = []
    existing_dividends = []
    if wealthmanager_api:
        # Get existing investments
        url = f"{wealthmanager_api.base_url}/investments?per_page=1000"
        headers = {
            "Authorization": f"Bearer {wealthmanager_api.jwt_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)
        existing_investments = deduplicate_investments(response.json().get("items", []))
        logger.info(
            f"Existing investment transactions: length {len(existing_investments)}"
        )
        if existing_investments:
            logger.info(
                f"Sample existing investment structure: {existing_investments[0]}"
            )

        # Get existing dividends
        existing_dividends = wealthmanager_api.get_dividend_transactions()
        logger.info(f"Existing dividend transactions: length {len(existing_dividends)}")
        if existing_dividends:
            logger.info(f"Sample existing dividend structure: {existing_dividends[0]}")

    # Account details
    if "cto" in account_name.lower():
        account_type = account_name_type_mapping.get("Boursorama CTO", "investment")
        cash_account_name = "Boursorama Espèce CTO"
    elif "pea" in account_name.lower():
        account_type = account_name_type_mapping.get(account_name, "investment")
        cash_account_name = "Boursorama Espèce PEA"
    else:
        logger.error(f"Unknown account type: {account_name}")
        return

    # Get account IDs if we have an API connection (needed for checking what would be missing)
    boursorama_id = None
    boursorama_espece_id = None
    asset_ids = {}  # Cache for asset IDs

    if wealthmanager_api:
        # Get account IDs
        boursorama_id = wealthmanager_api.get_account_id_from_name(
            account_name, account_type
        )
        boursorama_espece_id = wealthmanager_api.get_account_id_from_name(
            cash_account_name, "investment"
        )

    missing_investments = []
    missing_dividends = []
    total_transactions = 0
    already_exists = 0
    dividends_already_exist = 0

    # Process each transaction
    for _, row in df.iterrows():
        total_transactions += 1
        # Handle different activity types
        if row["activityType"] in ["BUY", "SELL", "DIVIDEND"]:
            # In dry run mode without API, we need to skip ID validation
            if not wealthmanager_api:
                print(
                    f"Transaction: {row['activityType']} {row['quantity']} {row['symbol']} @ {row['unitPrice']} on {row['date'][:10]}"
                )
                continue

            # Get asset ID if needed
            if row["symbol"] not in asset_ids:
                asset_ids[row["symbol"]] = wealthmanager_api.get_or_create_asset(
                    row["symbol"]
                )

            # Create investment transaction structure for comparison
            from_id = boursorama_espece_id
            to_id = boursorama_id

            # Reverse from and to account if the activity is a SELL
            if row["activityType"] == "SELL":
                from_id, to_id = to_id, from_id

            investment_data = {
                "from_account_id": from_id,
                "to_account_id": to_id,
                "asset_id": asset_ids[row["symbol"]],
                "activity_type": row["activityType"].lower().title(),
                "date": row["date"][:10],
                "quantity": float(row["quantity"]),
                "unit_price": float(row["unitPrice"]),
                "fee": float(row["fee"]),
                "tax": 0.0,  # Add tax field if available in your CSV
            }

            # Check if the investment transaction already exists
            is_missing = not any(
                existing_investment["from_account_id"]
                == investment_data["from_account_id"]
                and existing_investment["to_account_id"]
                == investment_data["to_account_id"]
                and existing_investment["asset_id"] == investment_data["asset_id"]
                and existing_investment["investment_type"]
                == investment_data["activity_type"]
                and existing_investment["date"] == investment_data["date"]
                and existing_investment["quantity"] == investment_data["quantity"]
                and abs(
                    existing_investment["unit_price"] - investment_data["unit_price"]
                )
                < 0.001
                and abs(existing_investment["fee"] - investment_data["fee"]) < 0.001
                for existing_investment in existing_investments
            )

            if is_missing:
                missing_investments.append(investment_data)
                print(
                    f"Would add investment: {row['activityType']} {row['quantity']} {row['symbol']} @ {row['unitPrice']} on {row['date'][:10]}"
                )

                # Only sync if requested
                if wealthmanager_api and getattr(
                    wealthmanager_api, "sync_enabled", True
                ):
                    try:
                        response = (
                            wealthmanager_api.create_investment_transaction_in_api(
                                investment_data
                            )
                        )
                        if 200 <= response.status_code < 300:
                            logger.info(
                                f"Created investment transaction: {investment_data['activity_type']} "
                                f"{investment_data['quantity']} {row['symbol']} @ {investment_data['unit_price']}"
                            )
                        else:
                            logger.error(
                                f"Failed to create investment transaction: {response.text} {investment_data}"
                            )
                    except Exception as e:
                        logger.exception(f"Error creating investment transaction: {e}")

            else:
                already_exists += 1
                print(
                    f"Already exists: {row['activityType']} {row['quantity']} {row['symbol']} @ {row['unitPrice']} on {row['date'][:10]}"
                )
    print(f"\nSummary for {account_name}:")
    print(f"Total transactions in CSV: {total_transactions}")

    if wealthmanager_api:
        print(f"Transactions already in database: {already_exists}")
        print(f"Transactions that would be added: {len(missing_investments)}")

        if getattr(wealthmanager_api, "sync_enabled", False):
            if len(missing_investments) > 0 or len(missing_dividends) > 0:
                print(
                    f"Added {len(missing_investments)} new investment transactions and {len(missing_dividends)} new dividend transactions to the database"
                )
            else:
                print("No new transactions were added (all already exist)")
        elif len(missing_investments) > 0 or len(missing_dividends) > 0:
            print("Use --sync to add these transactions to the database")
    else:
        print("Unable to check against database (no API connection)")
        print("Use --sync to check against existing transactions and add missing ones")


def fetch_and_filter_transactions(
    file_path: str, wealthmanager_api: WealthManagerApi, add_transactions: bool = False
):
    try:
        # Load the CSV file
        df: pd.DataFrame = pd.read_csv(file_path)
        df = df.sort_values(by="date", ascending=True)

        # Fetch existing transactions and accounts from the API - we need this even in dry run
        existing_transactions = []
        existing_accounts = []
        missing_accounts = set()
        missing_transactions = []
        total_transactions = 0
        already_exists = 0

        if wealthmanager_api:
            existing_transactions_response = (
                wealthmanager_api.get_transactions_from_api(999999).json()
            )
            existing_transactions = existing_transactions_response.get("items", [])
            existing_accounts = wealthmanager_api.get_accounts_from_api()
            logger.info(f"Existing transactions: length {len(existing_transactions)}")
            logger.info(f"Existing accounts: length {len(existing_accounts)}")

        print(f"First 10 transactions: {df.head(10)}")

        # Check for missing accounts
        for index, row in df.iterrows():
            total_transactions += 1
            source_account_type = account_name_type_mapping.get(
                row["source_name"],
                account_type_mapping.get(row["source_type"], "Unknown"),
            )
            destination_account_type = account_name_type_mapping.get(
                row["destination_name"],
                account_type_mapping.get(row["destination_type"], "Unknown"),
            )

            # Skip investment transactions - they're handled separately
            if (
                row["source_name"] == "Boursorama Espèce CTO"
                and row["destination_name"] == "Boursorama CTO"
            ) or (
                row["source_name"] == "Boursorama Espèce PEA"
                and row["destination_name"] == "Boursorama PEA"
            ):
                continue

            # Check for missing accounts if we have an API connection
            if wealthmanager_api:
                if not any(
                    f"{row['source_name']}|{source_account_type}" in account
                    for account in missing_accounts
                ):
                    if not any(
                        account["name"] == row["source_name"]
                        and account["type"] == source_account_type
                        for account in existing_accounts
                    ):
                        missing_accounts.add(
                            f"{row['source_name']}|{source_account_type}"
                        )

                if not any(
                    f"{row['destination_name']}|{destination_account_type}" in account
                    for account in missing_accounts
                ):
                    if not any(
                        account["name"] == row["destination_name"]
                        and account["type"] == destination_account_type
                        for account in existing_accounts
                    ):
                        missing_accounts.add(
                            f"{row['destination_name']}|{destination_account_type}"
                        )

        batch_size = 100  # Define the size of each batch
        batches = [df[i : i + batch_size] for i in range(0, len(df), batch_size)]

        # Process transactions with our API instance (which may or may not sync)
        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = [
                executor.submit(
                    process_batch,
                    batch,
                    existing_transactions,
                    wealthmanager_api,
                    wealthmanager_api.sync_enabled if wealthmanager_api else False,
                )
                for batch in batches
            ]
            for future in concurrent.futures.as_completed(futures):
                batch_results = future.result()
                missing_transactions.extend(batch_results["missing"])
                already_exists += batch_results["existing"]

        # Print summary
        print(f"\nSummary for {file_path}:")
        print(f"Total transactions in CSV: {total_transactions}")

        if wealthmanager_api:
            print(f"Missing accounts that would be created: {len(missing_accounts)}")
            if missing_accounts:
                print(f"Account names: {missing_accounts}")

            print(f"Transactions already in database: {already_exists}")
            print(f"Transactions that would be added: {len(missing_transactions)}")

            if getattr(wealthmanager_api, "sync_enabled", False):
                # Create missing accounts and add missing transactions only if sync is enabled
                if missing_accounts:
                    print(f"Creating {len(missing_accounts)} missing accounts...")
                    for account in missing_accounts:
                        name, acc_type = account.split("|")
                        bank_id = wealthmanager_api.bank_id_from_account_name(name)
                        wealthmanager_api.create_account_in_api(
                            name, acc_type, "EUR", bank_id
                        )

                if missing_transactions:
                    print(f"Adding {len(missing_transactions)} missing transactions...")
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        futures = [
                            executor.submit(
                                wealthmanager_api.create_transaction_in_api, transaction
                            )
                            for transaction in missing_transactions
                        ]
                        for future in concurrent.futures.as_completed(futures):
                            response = future.result()
                            if 200 <= response.status_code < 300:
                                logger.info(f"Created transaction: {response.json()}")
                            else:
                                logger.error(
                                    f"Failed to create transaction: {response.text}"
                                )
                    print(
                        f"Successfully added {len(missing_transactions)} transactions"
                    )
                else:
                    print("No new transactions were added (all already exist)")
            elif len(missing_transactions) > 0:
                print("Use --sync to add these transactions to the database")
            else:
                print("Unable to check against database (no API connection)")
                print(
                    "Use --sync to check against existing transactions and add missing ones"
                )

    except FileNotFoundError:
        logger.exception(f"Error: The file '{file_path}' was not found.")
    except Exception as e:
        logger.exception(f"An error occurred: {e}")
        raise


def process_batch(
    batch: pd.DataFrame,
    existing_transactions: list[dict[str, Any]],
    wealthmanager_api: WealthManagerApi,
    add_transactions: bool,
) -> dict[str, Any]:
    batch_missing_transactions = []
    batch_existing_transactions = 0

    # If we're not syncing, we still want to identify what would be added
    if not add_transactions or wealthmanager_api is None:
        for _, row in batch.iterrows():
            # Skip investment transactions as they are handled separately
            if (
                row["source_name"] == "Boursorama Espèce CTO"
                and row["destination_name"] == "Boursorama CTO"
            ) or (
                row["source_name"] == "Boursorama Espèce PEA"
                and row["destination_name"] == "Boursorama PEA"
            ):
                continue

            # Track transactions that would be added if syncing
            transaction_data = {
                "date": row["date"][:10],
                "source": row["source_name"],
                "destination": row["destination_name"],
                "amount": abs(float(row["amount"])),
                "type": row["type"],
                "description": row["description"]
                if not pd.isna(row["description"])
                else "",
            }
            batch_missing_transactions.append(transaction_data)

            print(
                f"Transaction: {row['date'][:10]} - {row['source_name']} -> {row['destination_name']} - {row['amount']} - {row['type']} - {row['budget']} - {row['description']}"
            )

        return {"missing": batch_missing_transactions, "existing": 0}

    # Pre-fetch account IDs for all accounts in the batch to reduce API calls
    account_names = set()
    for _, row in batch.iterrows():
        source_account_type = account_name_type_mapping.get(
            row["source_name"], account_type_mapping.get(row["source_type"], "Unknown")
        )
        destination_account_type = account_name_type_mapping.get(
            row["destination_name"],
            account_type_mapping.get(row["destination_type"], "Unknown"),
        )
        account_names.add((row["source_name"], source_account_type))
        account_names.add((row["destination_name"], destination_account_type))

    # Get account IDs for all accounts in the batch
    account_ids = {}
    for name, acc_type in account_names:
        try:
            account_id = wealthmanager_api.get_account_id_from_name(name, acc_type)
            if account_id:
                account_ids[f"{name}|{acc_type}"] = account_id
        except Exception as e:
            logger.exception(f"Error getting account ID for {name}|{acc_type}: {e}")

    # Process each transaction in the batch
    for _, row in batch.iterrows():
        # Skip investment transactions as they are handled separately
        if (
            row["source_name"] == "Boursorama Espèce CTO"
            and row["destination_name"] == "Boursorama CTO"
        ) or (
            row["source_name"] == "Boursorama Espèce PEA"
            and row["destination_name"] == "Boursorama PEA"
        ):
            continue

        # Get account types
        source_account_type = account_name_type_mapping.get(
            row["source_name"], account_type_mapping.get(row["source_type"], "Unknown")
        )
        destination_account_type = account_name_type_mapping.get(
            row["destination_name"],
            account_type_mapping.get(row["destination_type"], "Unknown"),
        )

        # Get account IDs using composite key
        source_account_id = account_ids.get(
            f"{row['source_name']}|{source_account_type}"
        )
        destination_account_id = account_ids.get(
            f"{row['destination_name']}|{destination_account_type}"
        )

        # Handle special cases for transaction types
        if row["destination_name"] == "Prêt Etudiant CA":
            print(f"{transaction_type=} {destination_account_id=}")
            transaction_type = "transfer"
            destination_account_id = account_ids.get("Prêt Etudiant CA|loan")
            print(f"{transaction_type=} {destination_account_id=}")
        elif row["destination_name"] == "Solde initial du compte Prêt Etudiant CA":
            # transaction_type = "expense"
            # destination_account_id = account_ids.get(
            #     "Solde initial du compte Prêt Etudiant CA|expense"
            # )
            # print(f"{row['description']=}")
            continue
        elif row["destination_name"] == "Prêt Etudiant CE":
            transaction_type = "transfer"
            destination_account_id = account_ids.get("Prêt Etudiant CE|loan")
        elif row["destination_name"] == 'Balance initiale pour "Prêt Etudiant CE"':
            # transaction_type = "expense"
            # destination_account_id = account_ids.get(
            #     'Balance initiale pour "Prêt Etudiant CE"|expense'
            # )
            continue
        elif "REALISATION DE PRET" in row["description"]:
            transaction_type = "transfer"
            source_account_id = account_ids.get("Prêt Etudiant CA|loan")
        elif "BPCE FINANCEMENT" in row["description"]:
            transaction_type = "transfer"
            source_account_id = account_ids.get("Prêt Etudiant CE|loan")
        else:
            transaction_type = wealthmanager_api.handle_transaction_type(row["type"])

        if not source_account_id or not destination_account_id:
            logger.warning(
                f"Skipping transaction due to missing account IDs: {row['source_name']}|{source_account_type} : {source_account_id} -> {row['destination_name']}|{destination_account_type} : {destination_account_id}"
            )
            exit(1)
            continue
        # Check if transaction already exists
        # print(existing_transactions)
        is_missing = not any(
            transaction["date"] == row["date"][:10]
            and transaction["from_account_id"] == source_account_id
            and transaction["to_account_id"] == destination_account_id
            and transaction["amount"] == abs(float(row["amount"]))
            and transaction["type"] == transaction_type
            for transaction in existing_transactions
        )

        if is_missing:
            print(
                f"Missing transaction: {row['date'][:10]} - {row['source_name']} -> {row['destination_name']} - {row['amount']} - {row['type']} - {row['budget']} - {row['description']}"
            )
            # Create transaction data
            transaction_data = {
                "date": row["date"][:10],
                "from_account_id": source_account_id,
                "to_account_id": destination_account_id,
                "amount": abs(float(row["amount"])),
                "type": transaction_type,
                "description": row["description"]
                if not pd.isna(row["description"])
                else "",
                "date_accountability": row["date"][:10],
                "category": wealthmanager_api.transform_budget_to_categories(
                    str(row["budget"]), row["type"]
                )["category"],
                "subcategory": wealthmanager_api.transform_budget_to_categories(
                    str(row["budget"]), row["type"]
                )["subCategory"],
            }
            batch_missing_transactions.append(transaction_data)
            print(f"Missing transaction: {transaction_data}")
        else:
            batch_existing_transactions += 1

        print(
            f"Transaction: {row['date'][:10]} - {row['source_name']} -> {row['destination_name']} - {row['amount']} - {row['type']} - {row['budget']} - {row['description']}"
        )

    return {
        "missing": batch_missing_transactions,
        "existing": batch_existing_transactions,
    }


def deduplicate_investments(investments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate investment transactions based on key attributes.

    Args:
        investments (list[dict[str, Any]]): List of investment transactions

    Returns:
        list[dict[str, Any]]: Deduplicated list of investment transactions

    """
    seen = set()
    unique_investments = []

    for investment in investments:
        # Create a unique key based on key attributes
        key = (
            investment["asset_id"],
            investment["date"],
            investment["from_account_id"],
            investment["to_account_id"],
            investment["investment_type"],
            investment["quantity"],
            investment["unit_price"],
            investment["fee"],
            investment["tax"],
        )

        if key not in seen:
            seen.add(key)
            unique_investments.append(investment)

    return unique_investments


import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Import data from Firefly CSV to WealthManager API"
    )
    parser.add_argument("csv_file", help="Path to the Firefly CSV file to import")
    parser.add_argument(
        "--sync", action="store_true", help="Sync data to WealthManager API"
    )
    parser.add_argument(
        "--delete-user", action="store_true", help="Delete user if exists and recreate"
    )
    parser.add_argument(
        "--investment", action="store_true", help="Process as investment transactions"
    )
    parser.add_argument(
        "--investment-account",
        choices=["CTO", "PEA"],
        help="Investment account type (required if --investment is used)",
    )
    parser.add_argument(
        "--api-url", default="http://localhost:5000", help="WealthManager API URL"
    )
    parser.add_argument(
        "--user-email", default="a@a.com", help="User email for WealthManager API"
    )
    parser.add_argument(
        "--user-password", default="aaaaaa", help="User password for WealthManager API"
    )
    parser.add_argument(
        "--user-name", default="Alan J", help="User name for WealthManager API"
    )
    parser.add_argument(
        "--create-liabilities", action="store_true",
        help="Create predefined liabilities (Prêt Etudiant CA and CE)"
    )
    parser.add_argument(
        "--link-liability-payments", action="store_true",
        help="Link transactions to liabilities as payments"
    )

    args = parser.parse_args()

    # Initialize API with user deletion preference
    api = WealthManagerApi(
        base_url=args.api_url,
        name=args.user_name,
        email=args.user_email,
        password=args.user_password,
        delete_if_exists=args.delete_user,
    )

    # Set a flag to indicate whether syncing is enabled
    api.sync_enabled = args.sync

    if args.investment:
        if not args.investment_account:
            parser.error("--investment-account is required when using --investment")

        with open(args.csv_file) as f:
            csv_data = f.read()

        account_name = f"Boursorama {args.investment_account}"
        process_investment_csv(csv_data, account_name, api)
        print(f"Processed investment transactions for {account_name}")

    # Only run this if no other operation was specified
    # fetch_and_filter_transactions(args.csv_file, api, args.sync)
    print(f"Processed transactions from {args.csv_file}")

    # if args.create_liabilities:
    #     if api.sync_enabled:
    #         print("Creating predefined liabilities...")
    #         liability_ids = api.create_specific_liabilities()
    #         print(f"Liability IDs: {liability_ids}")
    #     else:
    #         print("DRY RUN - Would create predefined liabilities (use --sync to create)")

    if args.link_liability_payments:
        if api.sync_enabled:
            print(f"Linking transactions from {args.csv_file} to liabilities as payments...")
            api.link_transactions_to_liabilities(args.csv_file)
        else:
            print("DRY RUN - Would link transactions to liabilities (use --sync to create)")

    if args.sync:
        print("Data has been synced to the WealthManager API.")
    else:
        print("DRY RUN ONLY - No data has been synced to the WealthManager API.")
        print("Use --sync flag to perform actual synchronization.")

    print("Done!")
