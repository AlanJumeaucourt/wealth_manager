import concurrent.futures  # {{ edit_1: Added import for concurrency }}
import logging
import time  # Added for cache expiration
from io import StringIO
from typing import Any, TypedDict, Optional, Dict

import pandas as pd
import requests
from faker import Faker
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry  # Corrected import

fake = Faker()

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Add a cache for accounts
_accounts_cache: Optional[Dict[str, Any]] = None
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
    "Crédit Agricole LDDS": "savings",
    "Crédit Agricole Courant": "checking",
    "Lendermarket P2P": "investment",
    "Boursorama Espèce CTO": "investment",
    "Fortuneo Courant": "investment",
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
    "Prêt Etudiant CA": "savings",
    "Crédit Agricole LEP": "savings",
    "Natixis PEG": "investment",
    "Boursorama CTO": "investment",
    "Boursorama PEA": "investment",
    "Natixis PERCO": "investment",
    "LouveInvest SCPI": "investment",
    'Balance initiale pour "Prêt Etudiant CA"': "income",
    "Initial balance account of Prêt Etudiant CA": "income",
    "Robocash P2P": "investment",
    "Miimosa P2P": "investment",
}

# Initialize an empty account dictionary
account_dictionary: dict[str, str] = {}


def create_user(name: str, email: str, password: str):
    url = "http://localhost:5000/users/register"  # Adjust the URL if necessary
    headers = {"Content-Type": "application/json"}
    data = {"name": name, "email": email, "password": password}
    response = requests.post(url, json=data, headers=headers)
    return response


def login_user(email: str, password: str):
    url = "http://localhost:5000/users/login"  # Adjust the URL if necessary
    headers = {"Content-Type": "application/json"}
    data = {"email": email, "password": password}
    response = requests.post(url, json=data, headers=headers)
    return response


def bank_id_from_bank_name(bank_name: str) -> int:
    banks = get_banks_from_api()
    # print(f"{banks=}")
    bank_id_mapping = {f"{bank['name']}": bank["id"] for bank in banks}
    result = bank_id_mapping.get(f"{bank_name}", None)
    if result is None:
        # logging.info(f"Bank not found, creating new bank: {bank_name}")
        create_bank_in_api(bank_name)
        banks = get_banks_from_api()
        bank_id_mapping = {f"{bank['name']}": bank["id"] for bank in banks}
        result = bank_id_mapping.get(f"{bank_name}", None)
        # logging.info(f"Created bank: {bank_name}, ID: {result}")
        if result is None:
            raise Exception(f"Failed to create bank: {bank_name}")
    return result


def bank_id_from_account_name(account_name: str) -> int:
    if account_name.startswith("Boursorama"):
        return bank_id_from_bank_name("Boursorama")
    if account_name.startswith("Crédit Agricole"):
        return bank_id_from_bank_name("Crédit Agricole")
    if "P2P" in account_name:
        return bank_id_from_bank_name("P2P")
    return bank_id_from_bank_name("Other")


def get_user_from_api(user_id: int):
    url = f"http://localhost:5000/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }
    response = requests.get(url, headers=headers)
    return response


def get_banks_from_api() -> list[dict[str, Any]]:
    url = "http://localhost:5000/banks"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }
    response = requests.get(url, headers=headers)
    if response.status_code == 200 or response.status_code == 201:
        return response.json()["items"]  # Assuming the response is a list of banks
    logging.error(f"Failed to retrieve banks: {response.status_code}, {response.text}")
    return []


def delete_user():
    url = "http://localhost:5000/users"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }
    response = requests.delete(url, headers=headers)
    return response


def get_accounts_from_api() -> list[dict[str, Any]]:
    global _accounts_cache, _accounts_cache_timestamp

    # Use a lock to ensure thread safety when accessing the cache
    with _cache_lock:
        current_time = time.time()

        # Check if cache is valid
        if (_accounts_cache is not None and
            current_time - _accounts_cache_timestamp < _CACHE_EXPIRY_SECONDS):
            logging.debug("Using cached accounts data")
            return _accounts_cache

        # Cache is invalid or doesn't exist, fetch from API
        url = "http://localhost:5000/accounts?per_page=1000"
        headers = {
            "Authorization": f"Bearer {jwt_token}",
            "Content-Type": "application/json",
        }

        logging.info("Fetching accounts from API")
        response = requests.get(url, headers=headers)

        if response.status_code == 200 or response.status_code == 201:
            # Update cache
            _accounts_cache = response.json()["items"]
            _accounts_cache_timestamp = current_time
            return _accounts_cache

        logging.error(
            f"Failed to retrieve accounts: {response.status_code}, {response.text}"
        )
        return []


def create_bank_in_api(bank_name: str):
    url = "http://localhost:5000/banks"  # Adjust the URL if necessary
    headers = {
        "Authorization": f"Bearer {jwt_token}",  # Replace with actual JWT token
        "Content-Type": "application/json",
    }
    data = {"name": bank_name}
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
    account_name: str, account_type: str, currency: str, bank_id: int
):
    url = "http://localhost:5000/accounts"  # Adjust the URL if necessary
    headers = {
        "Authorization": f"Bearer {jwt_token}",  # Replace with actual JWT token
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


def get_account_id_from_name(account_name: str, account_type: str):
    try:
        accounts = get_accounts_from_api()
        logging.debug(f"Accounts retrieved: {accounts}")
        # Create a unique key for each account based on name and type
        account_id_mapping = {
            f"{account['name']}|{account['type']}": account["id"]
            for account in accounts
        }
        result = account_id_mapping.get(f"{account_name}|{account_type}", None)
        if result is None:
            # logging.info(f"Account not found, creating new account: {account_name}, {account_type}")
            create_account_in_api(
                account_name,
                account_type,
                "EUR",
                bank_id_from_account_name(account_name),
            )

            # Invalidate cache to ensure we get the newly created account
            with _cache_lock:
                global _accounts_cache_timestamp
                _accounts_cache_timestamp = 0

            accounts = get_accounts_from_api()
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


def create_transaction_in_api(transaction_data: dict[str, Any]) -> requests.Response:
    url = "http://localhost:5000/transactions"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }
    logging.info(
        f"Creating transaction: {transaction_data['date'][:10]} - {transaction_data['from_account_id']} - {transaction_data['to_account_id']} - {transaction_data['amount']} - {transaction_data['type']} - {transaction_data['category']} - {transaction_data['subcategory']} - {transaction_data['description']}"
    )
    response = requests.post(url, json=transaction_data, headers=headers)
    return response


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


def csv_firefly_to_api(file_path: str):
    try:
        # Load the CSV file
        df: pd.DataFrame = pd.read_csv(file_path)
        df = df.sort_values(by="date", ascending=True)
        # logging.debug(f"CSV loaded with columns: {df.columns}")

        # Check if 'budget' column exists
        if "budget" in df.columns:
            # # print all unique budgets
            unique_budgets = df["budget"].unique()
            # logging.info(f"Different Budgets: {unique_budgets}")
            # Transform budgets to categories
            transformed_categories = transform_budgets_to_categories(
                unique_budgets, "income"
            )
            # logging.info(f"Transformed Categories: {transformed_categories}")
        else:
            logging.warning("Error: 'budget' column not found in the CSV file.")

        # Process transactions
        if "source_name" in df.columns and "destination_name" in df.columns:
            # logging.info("Processing Transactions:")
            for index, row in df.iterrows():
                # logging.debug(f"Processing row {index}: {row}")
                source_account_type = account_name_type_mapping.get(
                    row["source_name"],
                    account_type_mapping.get(row["source_type"], "Unknown"),
                )
                destination_account_type = account_name_type_mapping.get(
                    row["destination_name"],
                    account_type_mapping.get(row["destination_type"], "Unknown"),
                )

                # Ignore investment transactions as they are add later as invesment transactions
                if (
                    destination_account_type == "investment"
                    and source_account_type == "investment"
                ):
                    if "achat" in row["description"].lower():
                        continue

                # Get account IDs from names and types
                from_account_id = get_account_id_from_name(
                    str(row["source_name"]), source_account_type
                )

                if row["destination_name"] == "Prêt Etudiant CA":
                    transaction_type = "transfer"
                    to_account_id = get_account_id_from_name(
                        "Prêt Etudiant CA", "savings"
                    )
                else:
                    transaction_type = handle_transaction_type(row["type"])
                    to_account_id = get_account_id_from_name(
                        str(row["destination_name"]), destination_account_type
                    )

                if from_account_id is None or to_account_id is None:
                    logging.warning(
                        f"Account ID not found for transaction: {row['source_name']} or {row['destination_name']}"
                    )
                    continue

                category = transform_budget_to_categories(
                    str(row["budget"]), transaction_type
                )["category"]
                sub_category = transform_budget_to_categories(
                    str(row["budget"]), transaction_type
                )["subCategory"]

                if transaction_type == "income":
                    category = category_to_category_mapping.get(
                        row["category"], category
                    )

                transaction_data = {
                    "from_account_id": from_account_id,
                    "to_account_id": to_account_id,
                    "amount": abs(float(row["amount"])),
                    "description": (
                        row["description"] if not pd.isna(row["description"]) else ""
                    ),
                    "type": transaction_type,
                    "date": row["date"][:10],
                    "date_accountability": row["date"][:10],
                    "category": category,
                    "subcategory": sub_category,
                }
                # logging.debug(f"Transaction data: {transaction_data}")
                try:
                    response = create_transaction_in_api(transaction_data)
                    if response.status_code == 201:
                        # logging.info(f"Created Transaction: {transaction_data}, Response: {response.json()}")
                        pass
                    else:
                        logging.error(
                            f"Failed to create Transaction: {transaction_data}, Response: {response.text}"
                        )
                except Exception as e:
                    logging.exception(
                        f"An error occurred while creating transaction: {e}"
                    )
                    raise
        # # print account dictionary
        # logging.info("Account Dictionary:")
        # for account, account_type in account_dictionary.items():
        # logging.info(f"Account: {account}, Type: {account_type}")

    except FileNotFoundError:
        logging.exception(f"Error: The file '{file_path}' was not found.")
    except Exception as e:
        logging.exception(f"An error occurred: {e}")
        raise


def transform_budget_to_categories(budget: str, transaction_type: str) -> CategoryInfo:
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
    # print(f"{category_info=}")
    if category_info:
        return category_info
    if transaction_type == "income":
        return {"category": "Autres rentrées", "subCategory": None}
    return {"category": "Divers", "subCategory": "A catégoriser"}


def transform_budgets_to_categories(
    budgets: list[str], transaction_type: str
) -> list[CategoryInfo]:
    categories: list[CategoryInfo] = []
    for budget in budgets:
        categories.append(transform_budget_to_categories(budget, transaction_type))
    return categories


def get_transactions_from_api() -> requests.Response:
    url = "http://localhost:5000/transactions?per_page=1000&page=1"  # Adjust the URL if necessary
    headers = {
        "Authorization": f"Bearer {jwt_token}",  # Replace with actual JWT token
        "Content-Type": "application/json",
    }
    response = requests.get(url, headers=headers)
    return response


def get_wealth_from_api() -> requests.Response:
    url = "http://localhost:5000/accounts/balance_over_time?start_date=2024-01-01&end_date=2024-08-12"  # Adjust the URL if necessary
    headers = {
        "Authorization": f"Bearer {jwt_token}",  # Replace with actual JWT token
        "Content-Type": "application/json",
    }
    response = requests.get(url, headers=headers)
    return response


name: str = "a"
email: str = "a@a.com"
password: str = "aaaaaa"

# Login the user to get the JWT token
login_user_r = login_user(email, password)

# if login_user_r.status_code == 200:
#     # print("User logged in successfully.")
#     # print(f"{login_user_r.json()=}")
#     jwt_token = login_user_r.json()["access_token"]
#     print(login_user_r.json()["access_token"])
#     assert isinstance(login_user_r.json()["access_token"], str)
#     delete_user()
# else:
#     logging.error(
#         f"Failed to log in user: {login_user_r.status_code}, {login_user_r.text}"
#     )

# create_user_r = create_user(name, email, password)
# if create_user_r.status_code == 201:
#     # print("User created successfully.")
#     # print(f"{create_user_r.json()=}")
#     user_data = create_user_r.json()
#     assert user_data["email"] == email
#     assert isinstance(user_data["id"], int)
#     assert isinstance(user_data["last_login"], str)
#     assert user_data["name"] == name
#     assert user_data["password"] == password
# else:
#     logging.error(
#         f"Failed to create user: {create_user_r.status_code}, {create_user_r.text}"
#     )

# Login the user to get the JWT token
login_user_r = login_user(email, password)

if login_user_r.status_code == 200:
    # print("User logged in successfully.")
    # print(f"{login_user_r.json()=}")
    jwt_token = login_user_r.json()["access_token"]
    print(login_user_r.json()["access_token"])
    assert isinstance(login_user_r.json()["access_token"], str)
else:
    logging.error(
        f"Failed to log in user: {login_user_r.status_code}, {login_user_r.text}"
    )

# create_bank_in_api('Fake')
# # print(create_account_in_api('Fake', 'expense', 'EUR', 1).json())
transaction_data = {
    "from_account_id": 1,
    "to_account_id": 2,
    "amount": 100,
    "description": "Test",
    "type": "expense",
    "date": "2024-01-01",
    "category": "Test",
    "subcategory": "Test",
}

# print(get_accounts_from_api())
# # print(create_transaction_in_api(transaction_data).json())
# # Call the function with the path to your CSV file
# csv_firefly_to_api("2024_10_04_transaction_export.csv")

# # print(get_accounts_from_api())
# # print(get_transactions_from_api().json())
# print(get_wealth_from_api().json())


def fetch_and_filter_transactions(file_path: str, add_transactions: bool = False):
    try:
        # Load the CSV file
        df: pd.DataFrame = pd.read_csv(file_path)
        df = df.sort_values(by="date", ascending=True)

        # Fetch existing transactions and accounts from the API
        existing_transactions_response = get_transactions_from_api().json()
        existing_transactions = existing_transactions_response.get("items", [])
        existing_accounts = get_accounts_from_api()

        missing_accounts = set()
        missing_transactions = []

        print(f"First 10 transactions: {df.head(10)}")
        # Check for missing accounts
        for index, row in df.iterrows():
            source_account_type = account_name_type_mapping.get(
                row["source_name"],
                account_type_mapping.get(row["source_type"], "Unknown"),
            )
            destination_account_type = account_name_type_mapping.get(
                row["destination_name"],
                account_type_mapping.get(row["destination_type"], "Unknown"),
            )

            if not any(
                f"{row['source_name']}|{source_account_type}" in account
                for account in missing_accounts
            ):
                if not any(
                    account["name"] == row["source_name"]
                    and account["type"] == source_account_type
                    for account in existing_accounts
                ):
                    missing_accounts.add(f"{row['source_name']}|{source_account_type}")

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

        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = [
                executor.submit(process_batch, batch, existing_transactions)
                for batch in batches
            ]
            for future in concurrent.futures.as_completed(futures):
                missing_transactions.extend(future.result())

        print(f"Missing accounts: {missing_accounts}")
        print(f"Missing transactions: {missing_transactions}")

        if add_transactions:
            for account in missing_accounts:
                name, acc_type = account.split("|")
                bank_id = bank_id_from_account_name(name)
                create_account_in_api(name, acc_type, "EUR", bank_id)

            with concurrent.futures.ThreadPoolExecutor() as executor:
                futures = [executor.submit(create_transaction_in_api, transaction) for transaction in missing_transactions]
                for future in concurrent.futures.as_completed(futures):
                    print(future.result().json())

    except FileNotFoundError:
        logging.exception(f"Error: The file '{file_path}' was not found.")
    except Exception as e:
        logging.exception(f"An error occurred: {e}")
        raise


# {{ edit_3: Added helper function to process a batch of transactions }}
def process_batch(
    batch: pd.DataFrame, existing_transactions: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    batch_missing_transactions = []

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

        account_names.add((str(row["source_name"]), source_account_type))
        account_names.add((str(row["destination_name"]), destination_account_type))

    # Create a local mapping of account names to IDs
    account_id_mapping = {}
    for name, acc_type in account_names:
        try:
            account_id_mapping[(name, acc_type)] = get_account_id_from_name(name, acc_type)
        except Exception as e:
            logging.error(f"Error getting account ID for {name}|{acc_type}: {e}")

    for index, row in batch.iterrows():
        source_account_type = account_name_type_mapping.get(
            row["source_name"], account_type_mapping.get(row["source_type"], "Unknown")
        )
        destination_account_type = account_name_type_mapping.get(
            row["destination_name"],
            account_type_mapping.get(row["destination_type"], "Unknown"),
        )

        # Use the local mapping instead of calling get_account_id_from_name again
        from_account_id = account_id_mapping.get(
            (str(row["source_name"]), source_account_type)
        )
        to_account_id = account_id_mapping.get(
            (str(row["destination_name"]), destination_account_type)
        )

        if row["destination_name"] == "Prêt Etudiant CA":
            transaction_type = "transfer"
            to_account_id = account_id_mapping.get(("Prêt Etudiant CA", "savings"))
        else:
            transaction_type = handle_transaction_type(row["type"])

        if from_account_id is None or to_account_id is None:
            logging.warning(
                f"Account ID not found for transaction: {row['source_name']} or {row['destination_name']}"
            )
            continue

        transaction_data = {
            "from_account_id": from_account_id,
            "to_account_id": to_account_id,
            "amount": abs(float(row["amount"])),
            "description": (
                row["description"] if not pd.isna(row["description"]) else ""
            ),
            "type": transaction_type,
            "date": row["date"][:10],
            "date_accountability": row["date"][:10],
            "category": transform_budget_to_categories(str(row["budget"]), row["type"])[
                "category"
            ],
            "subcategory": transform_budget_to_categories(
                str(row["budget"]), row["type"]
            )["subCategory"],
        }

        # Check if the transaction is missing
        is_missing = not any(
            existing_transaction["from_account_id"]
            == transaction_data["from_account_id"]
            and existing_transaction["to_account_id"]
            == transaction_data["to_account_id"]
            and existing_transaction["amount"] == transaction_data["amount"]
            and existing_transaction["date"] == transaction_data["date"]
            for existing_transaction in existing_transactions
        )

        if is_missing:
            batch_missing_transactions.append(transaction_data)
            print(f"Missing transaction : {transaction_data}")

    return batch_missing_transactions


# Call the function with the path to your CSV file
fetch_and_filter_transactions("firefly_export.csv", True)
exit(1)

def process_investment_csv(csv_data: str, account_name: str):
    """Process investment transactions from CSV data.

    Args:
        csv_data (str): CSV string containing investment transactions
        account_name (str): Name of the investment account (e.g. "Boursorama CTO", "Boursorama PEA")

    """
    # Read the CSV data into a DataFrame
    df = pd.read_csv(StringIO(csv_data))
    df = df.sort_values(by="date", ascending=True)

    if "cto" in account_name.lower():
        # Get account ID for the investment account
        account_type = account_name_type_mapping.get("Boursorama CTO", "investment")
        boursorama_id = get_account_id_from_name(account_name, account_type)
        boursorama_espece_id = get_account_id_from_name(
            "Boursorama Espèce CTO", "investment"
        )
    elif "pea" in account_name.lower():
        account_type = account_name_type_mapping.get(account_name, "investment")
        boursorama_id = get_account_id_from_name("Boursorama PEA", account_type)
        boursorama_espece_id = get_account_id_from_name(
            "Boursorama Espèce PEA", "investment"
        )

    # Process each transaction
    for _, row in df.iterrows():
        # Handle different activity types
        if row["activityType"] in ["BUY", "SELL"]:
            # Create investment transaction
            if "cto" in account_name.lower():
                from_id = boursorama_espece_id
                to_id = boursorama_id
            else:
                from_id = boursorama_espece_id
                to_id = boursorama_id

            investment_data = {
                "from_account_id": from_id,
                "to_account_id": to_id,
                "asset_id": get_or_create_asset(row["symbol"]),
                "activity_type": row["activityType"].lower(),
                "date": row["date"][:10],
                "quantity": float(row["quantity"]),
                "unit_price": float(row["unitPrice"]),
                "fee": float(row["fee"]),
                "tax": 0.0,  # Add tax field if available in your CSV
            }

            try:
                response = create_investment_transaction_in_api(investment_data)
                if response.status_code == 201:
                    logging.info(
                        f"Created investment transaction: {investment_data['activity_type']} "
                        f"{investment_data['quantity']} {row['symbol']} @ {investment_data['unit_price']}"
                    )
                else:
                    logging.error(
                        f"Failed to create investment transaction: {response.text}"
                    )
            except Exception as e:
                logging.exception(f"Error creating investment transaction: {e}")

            response = create_transaction_in_api(
                {
                    "amount": float(row["fee"] + row["unitPrice"] * row["quantity"]),
                    "from_account_id": from_id,
                    "to_account_id": to_id,
                    "type": "transfer",
                    "description": f"{row['activityType'].capitalize()} {row['quantity']:.6f} {row['symbol']} at {row['unitPrice']}€",
                    "category": "Banque",
                    "subcategory": "Services Bancaires",
                    "date": row["date"][:10],
                    "date_accountability": row["date"][:10],
                }
            )

            if response.status_code != 201:
                logging.error(f"Failed to create transfer transaction: {response.text}")
                exit(1)

        elif row["activityType"] == "DIVIDEND":
            # Create regular transaction for dividends
            if "cto" in account_name.lower():
                to_id = boursorama_espece_id
            else:
                to_id = boursorama_id

            transaction_data = {
                "from_account_id": get_account_id_from_name(
                    f"Dividends-{row['symbol']}", "income"
                ),
                "to_account_id": to_id,
                "amount": float(row["quantity"]) * float(row["unitPrice"]),
                "description": f"Dividend from {row['symbol']}",
                "type": "income",
                "date": row["date"][:10],
                "date_accountability": row["date"][:10],
                "category": "Investissements",
                "subcategory": "Dividends",
            }

            # Create the regular transaction
            try:
                response = create_transaction_in_api(transaction_data)
                if response.status_code == 201:
                    logging.info(
                        f"Created transaction: {transaction_data['description']}"
                    )
                else:
                    logging.error(f"Failed to create transaction: {response.text}")
            except Exception as e:
                logging.exception(f"Error creating transaction: {e}")


def get_or_create_asset(symbol: str) -> int:
    """Get asset ID from symbol or create if it doesn't exist.

    Args:
        symbol (str): The asset symbol (e.g. "AAPL", "IDUS.L")

    Returns:
        int: The asset ID

    """
    # First try to get the asset
    url = f"http://localhost:5000/assets?symbol={symbol}"
    headers = {"Authorization": f"Bearer {jwt_token}"}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        assets = response.json()
        if len(assets["items"]) > 0:
            return assets["items"][0]["id"]

    # If not found, create it
    url = "http://localhost:5000/assets"
    data = {
        "symbol": symbol,
        "name": symbol,  # You might want to fetch the actual name from an API
    }
    response = requests.post(url, headers=headers, json=data)

    if response.status_code == 201:
        return response.json()["id"]
    raise Exception(f"Failed to create asset: {response.text}")


def create_investment_transaction_in_api(
    transaction_data: dict[str, Any],
) -> requests.Response:
    """Create an investment transaction in the API.

    Args:
        transaction_data (Dict[str, Any]): The investment transaction data

    Returns:
        requests.Response: The API response

    """
    url = "http://localhost:5000/investments"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }
    response = requests.post(url, headers=headers, json=transaction_data)
    return response


CTO_CSV_INVESTMENT = r"""
date,symbol,quantity,activityType,unitPrice,currency,fee
2025-03-14,CSSPX.MI,8,SELL,542.9560,EUR,0
2025-03-04,CSSPX.MI,2,BUY,579.292,EUR,0
2025-02-24,CSSPX.MI,2,BUY,607.8000,EUR,0
2025-01-13,CSSPX.MI,3,BUY,602.222,EUR,0
2025-01-08,CSSPX.MI,1,BUY,607.956,EUR,0
2025-01-02,IDUS.L,20,BUY,57.280,EUR,0
2024-12-10,LYPS.DE,1,DIVIDEND,28.43,EUR,0
2024-12-10,IDUS.L,1,DIVIDEND,14.72,EUR,0
2024-11-01,IDUS.L,14,BUY,52.559,EUR,0
2024-10-08,IDUS.L,5,BUY,51.648,EUR,0
2024-09-27,IDUS.L,12,BUY,51.285,EUR,0
2024-09-16,IDUS.L,6,BUY,50.396,EUR,0
2024-09-12,IDUS.L,1,DIVIDEND,9.73,EUR,0
2024-09-11,IDUS.L,7,BUY,49.533,EUR,0
2024-08-05,IDUS.L,14,BUY,47.360,EUR,0
2024-07-05,IDUS.L,12,BUY,50.924,EUR,0
2024-07-02,IDUS.L,12,BUY,50.676,EUR,0
2024-06-19,IDUS.L,6,BUY,50.923,EUR,0
2024-06-13,IDUS.L,1,DIVIDEND,4.96,EUR,0
2024-06-11,IDUS.L,6,BUY,49.711,EUR,0
2024-05-28,IDUS.L,13,BUY,48.689,EUR,0
2024-05-24,IDUS.L,15,BUY,48.596,EUR,0
2024-05-20,IDUS.L,6,BUY,48.712,EUR,0
2024-05-08,OVH.PA,13,SELL,6.046,EUR,1.99
2024-04-23,IDUS.L,6,BUY,46.872,EUR,0
2024-03-14,IDUS.L,1,DIVIDEND,0.6,EUR,0
2024-03-05,IDUS.L,6,BUY,46.960,EUR,0
2024-02-21,LYPS.DE,7,BUY,47.014,EUR,1.99
2023-05-05,LYPS.DE,12,BUY,37.768,EUR,1.99
2023-04-19,OVH.PA,13,BUY,10.030,EUR,2.38
2023-04-11,LYPS.DE,13,BUY,38.610,EUR,3.01
2023-03-28,LYPS.DE,16,BUY,37.499,EUR,3.6
2023-03-23,LYPS.DE,10,BUY,37.142,EUR,1.99
"""

PEA_CSV_INVESTMENT = r"""
date,symbol,quantity,activityType,unitPrice,currency,fee
2025-05-20,ESE.PA,59,BUY,25.6122,EUR,6.00
2025-05-20,ESE.PA,167,BUY,25.6171,EUR,20.00
2024-05-20,PE500.PA,15,BUY,40.072,EUR,3.01
2024-04-30,PE500.PA,8,BUY,39.187,EUR,1.57
2024-04-23,PE500.PA,8,BUY,38.372,EUR,1.53
2023-09-08,PE500.PA,8,BUY,33.785,EUR,1.35
2023-08-16,PE500.PA,9,BUY,33.118,EUR,1.49
2022-12-23,ACA.PA,1,BUY,9.74,EUR,1.05
"""

# process_investment_csv(CTO_CSV_INVESTMENT, "Boursorama CTO")
# process_investment_csv(PEA_CSV_INVESTMENT, "Boursorama PEA")

ETIENNE_CSV_INVESTMENT = r"""
date,symbol,unitPrice,quantity,fee,activityType,currency
2022-12-21,ORA.PA,9.161,11,0.8,BUY,EUR
2022-12-27,GLE.PA,23.645,5,0.94,BUY,EUR
2023-01-16,TFI.PA,7.23,14,0.81,BUY,EUR
2023-02-08,ENGI.PA,13.098,8,0.83,BUY,EUR
2023-02-16,STLAP.PA,15.982,7,0.56,BUY,EUR
2023-02-28,ENGI.PA,13.986,8,0.56,SELL,EUR
2023-02-28,ORA.PA,10.86,11,0.6,SELL,EUR
2023-02-28,STLAP.PA,16.632,7,0.58,SELL,EUR
2023-02-28,TFI.PA,7.525,14,0.53,SELL,EUR
2023-02-28,GLE.PA,27.43,5,0.69,SELL,EUR
2023-03-01,VILLEMORIN,48.7,3,1.17,BUY,EUR
2023-03-01,BNP.PA,64.45,2,1.03,BUY,EUR
2023-03-01,CA.PA,18.34,6,0.88,BUY,EUR
2023-03-01,VIE.PA,28.21,4,0.9,BUY,EUR
2023-03-01,ACA.PA,11.478,9,0.83,BUY,EUR
2023-03-01,SGO.PA,57.76,2,0.93,BUY,EUR
2023-03-01,DG.PA,108,1,0.86,BUY,EUR
2023-03-15,GLE.PA,21.44,5,0.86,BUY,EUR
2023-03-15,STLAP.PA,15.744,7,0.55,BUY,EUR
2023-03-20,SGO.PA,50.67,2,0.81,BUY,EUR
2023-03-20,VIE.PA,26.2,5,1.05,BUY,EUR
2023-03-20,ACA.PA,9.829,11,0.86,BUY,EUR
2023-04-11,BN.PA,59.65,2,0.96,BUY,EUR
2023-04-11,AC.PA,30.82,4,0.99,BUY,EUR
2023-04-11,TTE.PA,58.45,2,0.94,BUY,EUR
2023-04-25,VIE.PA,3,1,0,DIVIDEND,EUR
2023-05-15,STLAP.PA,14.994,7,0.52,BUY,EUR
2023-05-15,TTE.PA,55.62,2,0.89,BUY,EUR
2023-04-24,STLAP.PA,7.97,1,0,DIVIDEND,EUR
2023-05-09,BN.PA,4,1,0,DIVIDEND,EUR
2023-05-09,VIE.PA,10.08,1,0,DIVEN,EURD
2023-05-22,BNP.PA,7.8,1,0,DIVIDEND,EUR
2023-05-23,AC.PA,4.2,1,0,DIVIDEND,EUR
2023-06-06,BN.PA,65.71,2,0.89,BUY,EUR
2023-06-09,DG.PA,106.86,1,0.85,BUY,EUR
2023-05-30,ACA.PA,21,1,0,DIVIDEND,EUR
2023-05-30,GLE.PA,8.5,1,0,DIVIDEND,EUR
2023-06-06,CA.PA,3.36,1,0,DIVIDEND,EUR
2023-06-12,SGO.PA,8,1,0,DIVIDEND,EUR
2023-07-12,CA.PA,17.15,6,31.51,BUY,EUR
2023-06-21,TTE.PA,2.96,1,0,DIVIDEND,EUR
2023-08-03,ERA.PA,74.3,2,1.19,BUY,EUR
2023-08-03,NK.PA,31.52,4,1.01,BUY,EUR
2023-09-11,ERA.PA,70.4,2,1.12,BUY,EUR
2023-09-11,NK.PA,29.92,4,0.96,BUY,EUR
2024-10-30,VIE.PA,25.72,5,1.03,BUY,EUR
2024-08-03,VILLEMORIN,62.6,3,0,SELL,EUR
2023-10-30,AC.PA,30,4,0.96,BUY,EUR
2023-10-30,CA.PA,16.46,7,0.93,BUY,EUR
2024-09-20,TTE.PA,2.96,1,0,DIVIDEND,EUR
2023-11-14,DG.PA,2.1,1,0,DIVIDEND,EUR
2024-01-02,CS.PA,29.74,4,0.95,BUY,EUR
2024-01-29,ALO.PA,11.6,9,0.83,BUY,EUR
2024-01-02,TTE.PA,2.96,1,0,DIVIDEND,EUR
2024-02-12,ALO.PA,11.715,11,1.03,BUY,EUR
2024-03-20,TTE.PA,2.96,1,0,DIVIDEND,EUR
2024-04-23,VIE.PA,6.9,1,0,DIVIDEND,EUR
2024-05-31,DG.PA,114.75,2,1.84,BUY,EUR
2024-05-31,SU.PA,227.9,2,3.36,BUY,EUR
2024-05-31,AI.PA,180.74,2,2.89,BUY,EUR
2024-04-22,STLAP.PA,18.45,1,0,DIVIDEND,EUR
2024-04-30,CS.PA,7.92,1,0,DIVIDEND,EUR
2024-05-03,BN.PA,8.4,1,0,DIVIDEND,EUR
2024-05-08,VIE.PA,17.5,1,0,DIVIDEND,EUR
2024-05-21,NK.PA,10.8,1,0,DIVIDEND,EUR
2024-05-21,BNP.PA,9.2,1,0,DIVIDEND,EUR
2024-05-27,GLE.PA,4.5,1,0,DIVIDEND,EUR
2024-05-28,CA.PA,16.53,1,0,DIVIDEND,EUR
2024-05-29,ACA.PA,21,1,0,DIVIDEND,EUR
2024-06-04,ERA.PA,6,1,0,DIVIDEND,EUR
2024-06-05,AC.PA,9.44,1,0,DIVIDEND,EUR
2024-06-10,SGO.PA,8.4,1,0,DIVIDEND,EUR
2024-07-25,STLAP.PA,16.376,7,0.57,BUY,EUR
2024-07-25,DG.PA,104.2,1,0.83,BUY,EUR
2024-07-25,AI.PA,163.88,1,1.31,BUY,EUR
2024-06-19,TTE.PA,3.16,1,0,DIVIDEND,EUR
2024-08-05,DG.PA,100.25,1,0.8,BUY,EUR
2024-08-05,VIE.PA,26.72,4,0.85,BUY,EUR
2024-08-05,SU.PA,198.22,1,1.58,BUY,EUR
2024-10-17,TTE.PA,60.14,2,0.96,BUY,EUR
2024-01-01,STLAP.PA,12.544,8,0.5,BUY,EUR
2024-09-25,TTE.PA,3.16,1,0,DIVIDEND,EUR
2024-10-15,DG.PA,6.3,1,0,DIVIDEND,EUR
2024-01-02,TTE.PA,4.74,1,0,DIVIDEND,EUR
2025-02-13,NK.PA,28.3,4,0.91,BUY,EUR
2025-02-13,TTE.PA,58.22,3,1.39,BUY,EUR
2025-02-17,BNP.PA,70.21,2,1.12,BUY,EUR
2025-02-18,ERA.PA,56.35,2,0.9,BUY,EUR
2025-03-06,AIR.PA,169.98,2,1.7,BUY,EUR
"""

# manque stellantis
process_investment_csv(ETIENNE_CSV_INVESTMENT, "Boursorama PEA")
