import pandas as pd
from io import StringIO
from regex import R
import requests
import logging
from typing import TypedDict, List, Dict, Any
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry  # Corrected import
from faker import Faker
import concurrent.futures  # {{ edit_1: Added import for concurrency }}

fake = Faker()

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)


class CategoryInfo(TypedDict):
    category: str
    subCategory: str


# Define the mapping of budgets to categories and subcategories
budget_to_category_mapping: Dict[str, CategoryInfo] = {
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
account_dictionary: Dict[str, str] = {}


def create_user(name: str, email: str, password: str):
    url = "http://100.121.97.42:5000/users/register"  # Adjust the URL if necessary
    headers = {"Content-Type": "application/json"}
    data = {"name": name, "email": email, "password": password}
    response = requests.post(url, json=data, headers=headers)
    return response


def login_user(email: str, password: str):
    url = "http://100.121.97.42:5000/users/login"  # Adjust the URL if necessary
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
    elif account_name.startswith("Crédit Agricole"):
        return bank_id_from_bank_name("Crédit Agricole")
    elif "P2P" in account_name:
        return bank_id_from_bank_name("P2P")
    else:
        return bank_id_from_bank_name("Other")


def get_user_from_api(user_id: int):
    url = f"http://100.121.97.42:5000/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }
    response = requests.get(url, headers=headers)
    return response


def get_banks_from_api() -> List[Dict[str, Any]]:
    url = "http://100.121.97.42:5000/banks"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }
    response = requests.get(url, headers=headers)
    if response.status_code == 200 or response.status_code == 201:
        return response.json()  # Assuming the response is a list of banks
    else:
        logging.error(
            f"Failed to retrieve banks: {response.status_code}, {response.text}"
        )
        return []


def delete_user():
    url = f"http://100.121.97.42:5000/users"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }
    response = requests.delete(url, headers=headers)
    return response


def get_accounts_from_api() -> List[Dict[str, Any]]:
    url = "http://100.121.97.42:5000/accounts?per_page=1000"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }
    response = requests.get(url, headers=headers)
    if response.status_code == 200 or response.status_code == 201:
        return response.json()  # Assuming the response is a list of accounts
    else:
        logging.error(
            f"Failed to retrieve accounts: {response.status_code}, {response.text}"
        )
        return []


def create_bank_in_api(bank_name: str):
    url = "http://100.121.97.42:5000/banks"  # Adjust the URL if necessary
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
        logging.error(f"An error occurred during POST request: {e}")
        raise


def create_account_in_api(
    account_name: str, account_type: str, currency: str, bank_id: int
):
    url = "http://100.121.97.42:5000/accounts"  # Adjust the URL if necessary
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
        logging.error(f"An error occurred during POST request: {e}")
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
        logging.error(f"An error occurred in get_account_id_from_name: {e}")
        raise


def create_transaction_in_api(transaction_data: Dict[str, Any]) -> requests.Response:
    url = "http://100.121.97.42:5000/transactions"
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
    elif transaction_type == "Withdrawal":
        return "expense"
    elif transaction_type == "Transfer":
        return "transfer"
    elif transaction_type == "Opening balance":
        return "income"
    else:
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
            transformed_categories = transform_budgets_to_categories(unique_budgets)
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

                category = transform_budget_to_categories(str(row["budget"]))[
                    "category"
                ]
                sub_category = transform_budget_to_categories(str(row["budget"]))[
                    "subCategory"
                ]

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
                    logging.error(f"An error occurred while creating transaction: {e}")
                    raise
        # # print account dictionary
        # logging.info("Account Dictionary:")
        # for account, account_type in account_dictionary.items():
        # logging.info(f"Account: {account}, Type: {account_type}")

    except FileNotFoundError:
        logging.error(f"Error: The file '{file_path}' was not found.")
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        raise


def transform_budget_to_categories(budget: str) -> CategoryInfo:
    """
    Transforms a budget string into a dictionary containing category and subcategory information.

    Args:
    budget (str): The budget string to be transformed.

    Returns:
    CategoryInfo: A dictionary containing 'category' and 'subCategory' information.
    """
    if pd.isna(budget):
        return {"category": "Divers", "subCategory": "A catégoriser"}
    category_info = budget_to_category_mapping.get(budget)
    # print(f"{category_info=}")
    if category_info:
        return category_info
    else:
        return {"category": "Divers", "subCategory": "A catégoriser"}


def transform_budgets_to_categories(budgets: List[str]) -> List[CategoryInfo]:
    categories: List[CategoryInfo] = []
    for budget in budgets:
        categories.append(transform_budget_to_categories(budget))
    return categories


def get_transactions_from_api() -> requests.Response:
    url = "http://100.121.97.42:5000/transactions?per_page=1000&page=1"  # Adjust the URL if necessary
    headers = {
        "Authorization": f"Bearer {jwt_token}",  # Replace with actual JWT token
        "Content-Type": "application/json",
    }
    response = requests.get(url, headers=headers)
    return response


def get_wealth_from_api() -> requests.Response:
    url = "http://100.121.97.42:5000/accounts/balance_over_time?start_date=2024-01-01&end_date=2024-08-12"  # Adjust the URL if necessary
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

if login_user_r.status_code == 200:
    # print("User logged in successfully.")
    # print(f"{login_user_r.json()=}")
    jwt_token = login_user_r.json()["access_token"]
    print(login_user_r.json()["access_token"])
    assert isinstance(login_user_r.json()["access_token"], str)
    delete_user()
else:
    logging.error(
        f"Failed to log in user: {login_user_r.status_code}, {login_user_r.text}"
    )

create_user_r = create_user(name, email, password)
if create_user_r.status_code == 201:
    # print("User created successfully.")
    # print(f"{create_user_r.json()=}")
    user_data = create_user_r.json()
    assert user_data["email"] == email
    assert isinstance(user_data["id"], int)
    assert isinstance(user_data["last_login"], str)
    assert user_data["name"] == name
    assert user_data["password"] == password
else:
    logging.error(
        f"Failed to create user: {create_user_r.status_code}, {create_user_r.text}"
    )

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
csv_firefly_to_api("2024_10_04_transaction_export.csv")

# # print(get_accounts_from_api())
# # print(get_transactions_from_api().json())
# print(get_wealth_from_api().json())


def fetch_and_filter_transactions(file_path: str, add_transactions: bool = False):
    try:
        # Load the CSV file
        df: pd.DataFrame = pd.read_csv(file_path)
        df = df.sort_values(by="date", ascending=True)

        # Fetch existing transactions and accounts from the API
        existing_transactions = get_transactions_from_api().json()
        existing_accounts = get_accounts_from_api()

        missing_accounts = (
            set()
        )  # {{ edit_2: Changed missing_accounts to a set to ensure uniqueness }}
        missing_transactions = []

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

            # {{ edit_3: Use add() instead of append() for missing_accounts }}
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

        # {{ edit_4: Introduced batch processing for missing transactions }}
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
            # {{ edit_5: Create missing accounts before adding transactions }}
            for account in missing_accounts:
                name, acc_type = account.split("|")
                bank_id = bank_id_from_account_name(name)
                create_account_in_api(name, acc_type, "EUR", bank_id)

            for transaction in missing_transactions:
                print(create_transaction_in_api(transaction).json())

    except FileNotFoundError:
        logging.error(f"Error: The file '{file_path}' was not found.")
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        raise


# {{ edit_3: Added helper function to process a batch of transactions }}
def process_batch(
    batch: pd.DataFrame, existing_transactions: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    batch_missing_transactions = []
    for index, row in batch.iterrows():
        source_account_type = account_name_type_mapping.get(
            row["source_name"], account_type_mapping.get(row["source_type"], "Unknown")
        )
        destination_account_type = account_name_type_mapping.get(
            row["destination_name"],
            account_type_mapping.get(row["destination_type"], "Unknown"),
        )

        transaction_data = {
            "from_account_id": get_account_id_from_name(
                str(row["source_name"]), source_account_type
            ),
            "to_account_id": get_account_id_from_name(
                str(row["destination_name"]), destination_account_type
            ),
            "amount": abs(float(row["amount"])),
            "description": (
                row["description"] if not pd.isna(row["description"]) else ""
            ),
            "type": handle_transaction_type(row["type"]),
            "date": row["date"][:10],
            "date_accountability": row["date"][:10],
            "category": transform_budget_to_categories(str(row["budget"]))["category"],
            "subcategory": transform_budget_to_categories(str(row["budget"]))[
                "subCategory"
            ],
        }

        if row["destination_name"] == "Prêt Etudiant CA":
            transaction_data["type"] = "transfer"
            transaction_data["to_account_id"] = get_account_id_from_name(
                "Prêt Etudiant CA", "savings"
            )

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
# fetch_and_filter_transactions('2024_10_04_transaction_export.csv', True)


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
                "asset_id": get_or_create_asset(
                    row["symbol"]
                ),  # You'll need to implement this
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
                logging.error(f"Error creating investment transaction: {e}")

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
                "category": "Investments",
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
                logging.error(f"Error creating transaction: {e}")


def get_or_create_asset(symbol: str) -> int:
    """Get asset ID from symbol or create if it doesn't exist.

    Args:
        symbol (str): The asset symbol (e.g. "AAPL", "IDUS.L")

    Returns:
        int: The asset ID
    """
    # First try to get the asset
    url = f"http://100.121.97.42:5000/assets?symbol={symbol}"
    headers = {"Authorization": f"Bearer {jwt_token}"}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        assets = response.json()
        if assets:
            return assets[0]["id"]

    # If not found, create it
    url = "http://100.121.97.42:5000/assets"
    data = {
        "symbol": symbol,
        "name": symbol,  # You might want to fetch the actual name from an API
    }
    response = requests.post(url, headers=headers, json=data)

    if response.status_code == 201:
        return response.json()["id"]
    else:
        raise Exception(f"Failed to create asset: {response.text}")


def create_investment_transaction_in_api(
    transaction_data: Dict[str, Any]
) -> requests.Response:
    """Create an investment transaction in the API.

    Args:
        transaction_data (Dict[str, Any]): The investment transaction data

    Returns:
        requests.Response: The API response
    """
    url = "http://100.121.97.42:5000/investments"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }
    response = requests.post(url, headers=headers, json=transaction_data)
    return response


CTO_CSV_INVESTMENT = r"""
date,symbol,quantity,activityType,unitPrice,currency,fee
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
2024-05-20,PE500.PA,15,BUY,40.072,EUR,3.01
2024-04-30,PE500.PA,8,BUY,39.187,EUR,1.57
2024-04-23,PE500.PA,8,BUY,38.372,EUR,1.53
2023-09-08,PE500.PA,8,BUY,33.785,EUR,1.35
2023-08-16,PE500.PA,9,BUY,33.118,EUR,1.49
2022-12-23,ACA.PA,1,BUY,9.74,EUR,1.05
"""

process_investment_csv(CTO_CSV_INVESTMENT, "Boursorama CTO")
process_investment_csv(PEA_CSV_INVESTMENT, "Boursorama PEA")
