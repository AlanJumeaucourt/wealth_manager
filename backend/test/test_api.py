# ruff: noqa: S101 plr2004

import time
import unittest
from datetime import datetime
from typing import Any, Literal, TypedDict, cast

import requests
from faker import Faker
from faker.providers import DynamicProvider

fake = Faker()

BankProvider = DynamicProvider(
    provider_name="bank_name",
    elements=[
        "JP Morgan Chase",
        "Wells Fargo",
        "Citibank",
        "HSBC",
        "Chase",
        "Bank of America",
        "Goldman Sachs",
    ],
)

fake.add_provider(BankProvider)

# Type aliases
JsonDict = dict[str, Any]
AccountId = int


class TransactionData(TypedDict):
    date: str
    date_accountability: str
    description: str
    amount: float
    from_account_id: int
    to_account_id: int
    type: str
    category: str
    subcategory: str | None


class AccountData(TypedDict):
    name: str
    type: str
    bank_id: int


# Add new type alias for account types
AccountType = Literal["checking", "savings", "investment", "expense", "income"]


class TestBase(unittest.TestCase):
    """Base test class with common functionality."""

    base_url = "http://100.80.185.72:8000/api/v1"
    _test_users: list[dict[str, int | str]] = []
    jwt_token: str | None = None

    def assert_response(
        self,
        response: requests.Response,
        expected_status: int,
        message: str | None = None,
    ):
        """Assert response status code and optionally check response content."""
        try:
            assert (
                response.status_code == expected_status
            ), f"{message or 'Unexpected status code'}: expected {expected_status}, got {response.status_code}. Response: {response.json()}"
        except AssertionError:
            print(f"\nResponse body: {response.json()}")
            raise

    def assert_valid_response(
        self, response: requests.Response, expected_fields: list[str] | None = None
    ):
        """Assert response is valid and contains expected fields."""
        self.assert_response(response, 200)
        if expected_fields:
            data = response.json()
            for field in expected_fields:
                assert field in data, f"Missing field: {field}"

    def assert_created(
        self, response: requests.Response, expected_fields: list[str] | None = None
    ):
        """Assert resource was created and contains expected fields."""
        self.assert_response(response, 201)
        if expected_fields:
            data = response.json()
            for field in expected_fields:
                assert field in data, f"Missing field: {field}"

    def assert_validation_error(
        self, response: requests.Response, message: str | None = None
    ):
        """Assert response is a validation error."""
        self.assert_response(response, 422, message)
        assert "Validation error" in response.json()

    def register_test_user(
        self, user_data: dict[str, str]
    ) -> tuple[int | None, str | None]:
        """Register a test user and store their credentials."""
        url = f"{self.base_url}/users/signup"
        register_response = requests.post(url=url, json=user_data)
        if register_response.status_code == 201:
            user_id = register_response.json()["id"]
            # Login to get token
            login_response = requests.post(
                f"{self.base_url}/login/access-token",
                json={"username": user_data["username"], "password": user_data["password"]},
            )
            if login_response.status_code == 200:
                print(login_response.json())
                token = login_response.json()["access_token"]
                self._test_users.append({"id": user_id, "token": token})
                return user_id, token
        return None, None

    @classmethod
    def tearDownClass(cls):
        """Clean up all test users after all tests are done."""
        for user in cls._test_users:
            url = f"{cls.base_url}/users/{user['id']}"
            headers = {"Authorization": f"Bearer {user['token']}"}
            response = requests.delete(url, headers=headers)
            if response.status_code != 204:
                print(
                    f"Warning: Failed to delete user {user['id']}, status: {response.status_code}"
                )
        cls._test_users.clear()

    def create_test_accounts(self, bank_id: int, types: list[str]) -> list[int]:
        """Helper to create multiple test accounts"""
        accounts: list[int] = []
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        for acc_type in types:
            response = requests.post(
                f"{self.base_url}/accounts",
                headers=headers,
                json={"name": f"Test {acc_type}", "type": acc_type, "bank_id": bank_id},
            )
            assert response.status_code == 201
            accounts.append(cast(int, response.json()["id"]))

        return accounts

    def create_base_transaction_data(self, from_id: int, to_id: int) -> TransactionData:
        """Create base transaction data with proper typing"""
        return {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "description": "Test transaction",
            "amount": 100.00,
            "from_account_id": from_id,
            "to_account_id": to_id,
            "type": "transfer",
            "category": "Test",
            "subcategory": None,
        }


# Add helper class for test data creation
class TestDataFactory:
    """Factory class for creating test data with proper typing"""

    def __init__(self, base_url: str, jwt_token: str):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {jwt_token}"}

    def create_bank(self, name: str | None = None) -> int:
        """Create a bank with a unique name"""
        bank_name = name if name else f"{fake.bank_name()} {fake.uuid4()}"
        response = requests.post(
            f"{self.base_url}/banks/", headers=self.headers, json={"name": bank_name}
        )
        if response.status_code != 201:
            raise Exception(f"Failed to create bank: {response.json()}")
        return cast(int, response.json()["id"])

    def create_account(self, name: str, acc_type: str, bank_id: int) -> int:
        response = requests.post(
            f"{self.base_url}/accounts",
            headers=self.headers,
            json={"name": name, "type": acc_type, "bank_id": bank_id},
        )
        assert response.status_code == 201
        return cast(int, response.json()["id"])

    def create_transaction(self, data: TransactionData) -> JsonDict:
        response = requests.post(
            f"{self.base_url}/transactions", headers=self.headers, json=data
        )
        assert response.status_code == 201
        return response.json()


class TestUserAPI(TestBase):
    jwt_token = None

    def setUp(self):
        self.name = fake.name()
        self.email = fake.email()
        self.password = fake.password()

    def test_user_operations(self):
        # 1. Create user
        self.create_user()

        self.login_user()

        # 2. Get user
        self.get_user()

        # 3. Update user
        self.update_user()

        # 4. Get user with modified values
        self.get_updated_user()

        # 5. Delete user
        self.delete_user()

    def create_user(self) -> None:
        data = {"name": self.name, "email": self.email, "password": self.password}
        user_id, token = self.register_test_user(data)
        self.user_id = user_id
        self.jwt_token = token

        # Make a new request to get user data since we need the response
        url = f"{self.base_url}/users/{self.user_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)

        assert response.status_code == 200
        user_data = response.json()
        assert user_data["email"] == self.email
        assert user_data["name"] == self.name
        assert "id" in user_data
        assert isinstance(user_data["id"], int)
        assert "last_login" in user_data
        assert isinstance(user_data["last_login"], str)

    def login_user(self):
        url = f"{self.base_url}/login/access-token"
        data = {"username": self.username, "password": self.password}
        response = requests.post(url, json=data)
        assert response.status_code == 200
        login_data = response.json()
        assert "access_token" in login_data
        assert isinstance(login_data["access_token"], str)
        self.jwt_token = login_data["access_token"]
        print(self.jwt_token)

    def get_user(self):
        url = f"{self.base_url}/users/{self.user_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        assert response.status_code == 200
        user_data = response.json()
        assert user_data["email"] == self.email
        assert user_data["name"] == self.name
        assert "id" in user_data
        assert "last_login" in user_data
        assert isinstance(user_data["last_login"], str)

    def update_user(self):
        url = f"{self.base_url}/users/{self.user_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        self.new_name = fake.name()
        self.new_email = fake.email()
        data = {"name": self.new_name, "email": self.new_email}
        response = requests.put(url, headers=headers, json=data)
        assert response.status_code == 200
        updated_user = response.json()
        assert updated_user["name"] == self.new_name
        assert updated_user["email"] == self.new_email
        assert updated_user["id"] == self.user_id
        assert isinstance(updated_user["last_login"], str)

    def get_updated_user(self):
        url = f"{self.base_url}/users/{self.user_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        assert response.status_code == 200
        user_data = response.json()
        assert user_data["email"] == self.new_email
        assert user_data["name"] == self.new_name
        assert "id" in user_data
        assert user_data["id"] == self.user_id
        assert "last_login" in user_data
        assert isinstance(user_data["last_login"], str)

    def delete_user(self):
        url = f"{self.base_url}/users/{self.user_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.delete(url, headers=headers)
        assert response.status_code == 204

        # Verify that the user is deleted by trying to get it
        response = requests.get(url, headers=headers)
        assert response.status_code == 404

    def test_create_duplicate_user(self):
        # First, create a user
        self.create_user()

        # Try to create another user with the same email
        url = f"{self.base_url}/users/register"
        data = {
            "name": fake.name(),
            "email": self.email,  # Use the same email as the first user
            "password": fake.password(),
        }
        response = requests.post(url, json=data)
        assert response.status_code == 422
        assert "error" in response.json()
        assert "already exists" in response.json()["error"]

    def test_login_with_invalid_credentials(self):
        url = f"{self.base_url}/login/access-token"
        data = {"username": fake.email(), "password": fake.password()}
        response = requests.post(url, json=data)
        assert response.status_code == 401
        assert "error" in response.json()

    def test_get_other_user(self):
        self.create_user()  # Create a user to get a valid JWT token
        self.login_user()
        url = f"{self.base_url}/users/99999"  # Assume 99999 is a non-existent user ID
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        assert response.status_code == 403
        assert "error" in response.json()

    def test_update_user_without_token(self):
        self.create_user()
        url = f"{self.base_url}/users/{self.user_id}"
        data = {"name": fake.name(), "email": fake.email()}
        response = requests.put(url, json=data)
        assert response.status_code == 401
        assert "msg" in response.json()

    def test_delete_user_without_token(self):
        self.create_user()
        url = f"{self.base_url}/users/{self.user_id}"
        response = requests.delete(url)
        assert response.status_code == 401
        assert "msg" in response.json()

    def verify_token(self):
        url = f"{self.base_url}/verify-token"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        assert response.status_code == 200
        assert response.json() == {"message": "Token is valid"}


class TestBankAPI(TestBase):
    jwt_token = None

    def setUp(self):
        self.name = fake.name()
        self.email = fake.email()
        self.username = fake.email()
        self.password = fake.password()
        self.bank_name = f"{fake.bank_name()} {fake.uuid4()}"
        self.create_user()
        self.login_user()

    def create_user(self):
        data = {"username": self.username, "email": self.email, "password": self.password}
        user_id, token = self.register_test_user(data)
        self.user_id = user_id
        self.jwt_token = token

    def login_user(self):
        url = f"{self.base_url}/login/access-token"
        data = {"username": self.username, "password": self.password}
        response = requests.post(url, json=data)
        assert response.status_code == 200
        login_data = response.json()
        self.jwt_token = login_data["access_token"]

    def test_create_bank(self):
        bank_id = self.create_bank()
        assert bank_id is not None

    def test_get_bank(self):
        bank_id = self.create_bank()
        self.get_bank(bank_id)

    def test_update_bank(self):
        bank_id = self.create_bank()
        self.update_bank(bank_id)

    def test_delete_bank(self):
        bank_id = self.create_bank()
        self.delete_bank(bank_id)

    def test_create_bank_with_faulty_token(self):
        faulty_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        self.create_bank_with_faulty_token(faulty_token)

    def test_get_bank_with_faulty_token(self):
        bank_id = self.create_bank()
        faulty_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        self.get_bank_with_faulty_token(faulty_token, bank_id)

    def test_update_bank_with_faulty_token(self):
        bank_id = self.create_bank()
        faulty_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        self.update_bank_with_faulty_token(faulty_token, bank_id)

    def test_delete_bank_with_faulty_token(self):
        bank_id = self.create_bank()
        faulty_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        self.delete_bank_with_faulty_token(faulty_token, bank_id)

    def create_bank(self) -> int:
        """Create a bank with a unique name"""
        url = f"{self.base_url}/banks/"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        data = {"name": self.bank_name}
        response = requests.post(url, headers=headers, json=data)
        assert response.status_code == 201
        bank_data = response.json()
        assert "id" in bank_data
        return bank_data["id"]

    def get_bank(self, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        assert response.status_code == 200
        bank_data = response.json()
        assert bank_data["name"] == self.bank_name

    def update_bank(self, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        new_bank_name = fake.bank_name()
        data = {"name": new_bank_name}
        response = requests.put(url, headers=headers, json=data)
        assert response.status_code == 200
        updated_bank = response.json()
        assert updated_bank["name"] == new_bank_name

    def delete_bank(self, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.delete(url, headers=headers)
        assert response.status_code == 204

    def create_bank_with_faulty_token(self, faulty_token: str):
        url = f"{self.base_url}/banks/"
        headers = {"Authorization": f"Bearer {faulty_token}"}
        data = {"name": self.bank_name}
        response = requests.post(url, headers=headers, json=data)
        assert response.status_code == 401
        assert "msg" in response.json()

    def get_bank_with_faulty_token(self, faulty_token: str, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {faulty_token}"}
        response = requests.get(url, headers=headers)
        assert response.status_code == 401
        assert "msg" in response.json()

    def update_bank_with_faulty_token(self, faulty_token: str, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {faulty_token}"}
        new_bank_name = fake.bank_name()
        data = {"name": new_bank_name}
        response = requests.put(url, headers=headers, json=data)
        assert response.status_code == 401
        assert "msg" in response.json()

    def delete_bank_with_faulty_token(self, faulty_token: str, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {faulty_token}"}
        response = requests.delete(url, headers=headers)
        assert response.status_code == 401
        assert "msg" in response.json()


class TestTransactionAPI(TestBase):
    jwt_token = None
    accounts: list[AccountId] = []  # Type annotation for accounts list

    def setUp(self) -> None:
        self.name = fake.name()
        self.email = fake.email()
        self.password = fake.password()
        self.create_user_and_login()
        self.setup_accounts()

    def create_user_and_login(self) -> None:
        data = {"name": self.name, "email": self.email, "password": self.password}
        user_id, token = self.register_test_user(data)
        self.user_id = user_id
        self.jwt_token = token

    def setup_accounts(self) -> None:
        """Set up test accounts with unique names"""
        # Create a bank
        url = f"{self.base_url}/banks/"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        bank_name = f"{fake.bank_name()} {fake.uuid4()}"
        data = {"name": bank_name}
        response = requests.post(url, headers=headers, json=data)
        assert response.status_code == 201
        self.bank_id = response.json()["id"]

        # Create accounts
        url = f"{self.base_url}/accounts"
        self.accounts = []
        for acc_type in ["checking", "savings"]:
            account_name = f"Test {acc_type.capitalize()} {fake.uuid4()}"
            data: AccountData = {
                "name": account_name,
                "type": acc_type,
                "bank_id": self.bank_id,
            }
            response = requests.post(url, headers=headers, json=data)
            assert response.status_code == 201
            self.accounts.append(cast(AccountId, response.json()["id"]))

    def test_create_transaction(self):
        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        data = {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "description": "Test transaction",
            "amount": 100.00,
            "from_account_id": self.accounts[0],
            "to_account_id": self.accounts[1],
            "type": "transfer",
            "category": "Transfer",
            "subcategory": "Test",
        }
        response = requests.post(url, headers=headers, json=data)
        assert response.status_code == 201
        transaction = response.json()
        assert transaction["amount"] == 100.00
        assert transaction["description"] == "Test transaction"

    def test_get_transactions_with_filters(self) -> None:
        # Create a test transaction first
        self.test_create_transaction()

        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        # Test different filters
        filters: list[dict[str, int | str]] = [
            {"account_id": self.accounts[0]},
            {"type": "transfer"},
            {"category": "Transfer"},
            {"search": "Test"},
        ]

        for filter_params in filters:
            response = requests.get(url, headers=headers, params=filter_params)
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert "total_amount" in data
            assert "total" in data

    def test_transaction_pagination(self):
        # Create multiple transactions
        for _ in range(5):
            self.test_create_transaction()

        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        # Test pagination
        params = {"page": 1, "per_page": 2}
        response = requests.get(url, headers=headers, params=params)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2

    def test_transaction_date_validation(self):
        """Test transaction date validation"""
        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        valid_date = datetime.now().isoformat()
        test_cases = [
            {
                "date": None,
                "date_accountability": valid_date,
                "expected_status": 422,
                "desc": "Missing date",
            },
            {
                "date": valid_date,
                "date_accountability": None,
                "expected_status": 422,
                "desc": "Missing date_accountability",
            },
            {
                "date": "invalid-date",
                "date_accountability": valid_date,
                "expected_status": 422,
                "desc": "Invalid date format",
            },
            {
                "date": "2024-13-01T00:00:00",  # Invalid month
                "date_accountability": valid_date,
                "expected_status": 422,
                "desc": "Invalid month",
            },
            {
                "date": "2024-12-32T00:00:00",  # Invalid day
                "date_accountability": valid_date,
                "expected_status": 422,
                "desc": "Invalid day",
            },
            {
                "date": "2024-12-01T24:00:00",  # Invalid hour
                "date_accountability": valid_date,
                "expected_status": 422,
                "desc": "Invalid hour",
            },
            {
                "date": valid_date,
                "date_accountability": valid_date,
                "expected_status": 201,
                "desc": "Valid dates",
            },
        ]

        base_data = {
            "description": "Test transaction",
            "amount": 100.00,
            "from_account_id": self.accounts[0],
            "to_account_id": self.accounts[1],
            "type": "transfer",
            "category": "Test",
            "subcategory": "Test",
        }

        for case in test_cases:
            with self.subTest(msg=f"Testing {case['desc']}"):
                data = base_data.copy()
                if case["date"] is not None:
                    data["date"] = case["date"]
                if case["date_accountability"] is not None:
                    data["date_accountability"] = case["date_accountability"]

                response = requests.post(url, headers=headers, json=data)
                assert (
                    response.status_code == case["expected_status"]
                ), f"Failed for {case['desc']}: expected {case['expected_status']}, got {response.status_code}"

    def test_transaction_category_validation(self):
        """Test transaction category validation"""
        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        test_cases = [
            {
                "category": None,
                "subcategory": "Test",
                "expected_status": 422,
                "desc": "Missing category",
            },
            {
                "category": "",
                "subcategory": "Test",
                "expected_status": 422,
                "desc": "Empty category",
            },
            {
                "category": "Test",
                "subcategory": None,
                "expected_status": 201,  # Subcategory is optional
                "desc": "Missing subcategory",
            },
            {
                "category": "Test",
                "subcategory": "",
                "expected_status": 201,  # Empty subcategory is allowed
                "desc": "Empty subcategory",
            },
            {
                "category": "Test",
                "subcategory": "Test",
                "expected_status": 201,
                "desc": "Valid category and subcategory",
            },
        ]

        base_data = {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "description": "Test transaction",
            "amount": 100.00,
            "from_account_id": self.accounts[0],
            "to_account_id": self.accounts[1],
            "type": "transfer",
        }

        for case in test_cases:
            with self.subTest(msg=f"Testing {case['desc']}"):
                data = base_data.copy()
                if case["category"] is not None:
                    data["category"] = case["category"]
                if case["subcategory"] is not None:
                    data["subcategory"] = case["subcategory"]

                response = requests.post(url, headers=headers, json=data)
                assert (
                    response.status_code == case["expected_status"]
                ), f"Failed for {case['desc']}: expected {case['expected_status']}, got {response.status_code}"

    def test_transaction_validation_combinations(self):
        """Test combinations of invalid fields"""
        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        test_cases = [
            {
                "data": {
                    "date": None,
                    "amount": -100,
                    "type": "invalid",
                },
                "expected_status": 422,
                "desc": "Multiple invalid fields",
            },
            {
                "data": {
                    "date": "invalid-date",
                    "from_account_id": None,
                    "category": None,
                },
                "expected_status": 422,
                "desc": "Multiple missing required fields",
            },
            {
                "data": {
                    "amount": "invalid",
                    "type": "",
                    "category": "",
                },
                "expected_status": 422,
                "desc": "Multiple invalid types",
            },
        ]

        base_data = {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "description": "Test transaction",
            "amount": 100.00,
            "from_account_id": self.accounts[0],
            "to_account_id": self.accounts[1],
            "type": "transfer",
            "category": "Test",
            "subcategory": "Test",
        }

        for case in test_cases:
            with self.subTest(msg=f"Testing {case['desc']}"):
                data = base_data.copy()
                # Update with test case data
                data.update(case["data"])

                response = requests.post(url, headers=headers, json=data)
                try:
                    assert (
                        response.status_code == case["expected_status"]
                    ), f"Failed for {case['desc']}: expected {case['expected_status']}, got {response.status_code}. Response: {response.json()}"
                except AssertionError:
                    print(f"Response for failed test: {response.json()}")
                    raise

    def test_transaction_amount_validation(self):
        """Test transaction amount validation"""
        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        base_data = cast(
            dict[str, Any],
            {
                "date": datetime.now().isoformat(),
                "date_accountability": datetime.now().isoformat(),
                "description": "Test transaction",
                "amount": 100.00,
                "from_account_id": self.accounts[0],
                "to_account_id": self.accounts[1],
                "type": "transfer",
                "category": "Test",
                "subcategory": None,
            },
        )

        invalid_amounts: list[int | str | None] = [-100, 0, "invalid", None, ""]

        for amount in invalid_amounts:
            data = base_data.copy()
            data["amount"] = amount
            response = requests.post(url, headers=headers, json=data)
            self.assert_validation_error(
                response, f"Expected validation error for amount {amount}"
            )

    def test_transaction_type_validation(self):
        """Test transaction type validation"""
        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        # Add delay between requests
        REQUEST_DELAY = 0.1  # 100ms delay

        test_cases = [
            {
                "type": None,
                "expected_status": 422,
                "desc": "Missing type",
            },
            {
                "type": "",
                "expected_status": 422,
                "desc": "Empty type",
            },
            {
                "type": "invalid",
                "expected_status": 422,
                "desc": "Invalid type",
            },
            {
                "type": "transfer",
                "expected_status": 201,
                "desc": "Valid type - transfer",
            },
        ]

        base_data = {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "description": "Test transaction",
            "amount": 100.00,
            "category": "Test",
            "subcategory": "Test",
        }

        # Create accounts for specific transaction types
        account_types = {
            "checking": None,
            "savings": None,
            "income": None,
            "expense": None,
        }

        for acc_type in account_types:
            account_name = f"Test {acc_type.capitalize()} {fake.uuid4()}"
            data: AccountData = {
                "name": account_name,
                "type": acc_type,
                "bank_id": self.bank_id,
            }
            time.sleep(REQUEST_DELAY)  # Add delay before account creation
            response = requests.post(
                f"{self.base_url}/accounts", headers=headers, json=data
            )
            assert (
                response.status_code == 201
            ), f"Failed to create {acc_type} account: {response.json()}"
            account_types[acc_type] = cast(AccountId, response.json()["id"])

        # Add test cases for income and expense
        test_cases.extend(
            [
                {
                    "type": "income",
                    "expected_status": 201,
                    "desc": "Valid type - income",
                    "from_account_id": account_types["income"],
                    "to_account_id": account_types["checking"],
                },
                {
                    "type": "expense",
                    "expected_status": 201,
                    "desc": "Valid type - expense",
                    "from_account_id": account_types["checking"],
                    "to_account_id": account_types["expense"],
                },
            ]
        )

        for case in test_cases:
            with self.subTest(msg=case["desc"]):
                data = base_data.copy()
                if case["type"] is not None:
                    data["type"] = case["type"]

                # Use specific accounts for income/expense if provided
                data["from_account_id"] = case.get("from_account_id", self.accounts[0])
                data["to_account_id"] = case.get("to_account_id", self.accounts[1])

                time.sleep(REQUEST_DELAY)  # Add delay before transaction creation
                response = requests.post(url, headers=headers, json=data)
                try:
                    assert (
                        response.status_code == case["expected_status"]
                    ), f"Failed for {case['desc']}: expected {case['expected_status']}, got {response.status_code}. Response: {response.json()}"
                except AssertionError:
                    print(f"\nTest case: {case['desc']}")
                    print(f"Request data: {data}")
                    print(f"Response status: {response.status_code}")
                    print(f"Response body: {response.json()}")
                    raise

    def test_transaction_description_validation(self):
        """Test transaction description validation"""
        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        test_cases = [
            {
                "description": None,
                "expected_status": 422,
                "desc": "Missing description",
            },
            {
                "description": "",
                "expected_status": 422,
                "desc": "Empty description",
            },
            {
                "description": "Valid description",
                "expected_status": 201,
                "desc": "Valid description",
            },
        ]

        base_data = {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "amount": 100.00,
            "from_account_id": self.accounts[0],
            "to_account_id": self.accounts[1],
            "type": "transfer",
            "category": "Test",
            "subcategory": "Test",
        }

        for case in test_cases:
            with self.subTest(msg=f"Testing {case['desc']}"):
                data = base_data.copy()
                if case["description"] is not None:
                    data["description"] = case["description"]

                response = requests.post(url, headers=headers, json=data)
                assert (
                    response.status_code == case["expected_status"]
                ), f"Failed for {case['desc']}: expected {case['expected_status']}, got {response.status_code}"

    def test_transaction_search(self):
        """Test transaction search functionality"""
        # Create multiple transactions with different descriptions
        descriptions = [
            "Grocery shopping",
            "Rent payment",
            "Salary deposit",
            "Shopping at mall",
        ]

        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        # Create test transactions
        base_data = {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "amount": 100.00,
            "from_account_id": self.accounts[0],
            "to_account_id": self.accounts[1],
            "type": "transfer",
            "category": "Test",
            "subcategory": "Test",
        }

        for desc in descriptions:
            data = base_data.copy()
            data["description"] = desc
            response = requests.post(url, headers=headers, json=data)
            self.assert_created(response)

        # Test search functionality
        search_tests = [
            {"search": "shopping", "expected_count": 2},
            {"search": "rent", "expected_count": 1},
            {"search": "nomatch", "expected_count": 0},
        ]

        for test in search_tests:
            with self.subTest(msg=f"Testing search for '{test['search']}'"):
                response = requests.get(
                    url,
                    headers=headers,
                    params={"search": test["search"]},
                )
                self.assert_valid_response(response, ["items"])
                data = response.json()
                assert (
                    len(data["items"]) == test["expected_count"]
                ), f"Expected {test['expected_count']} results for search term '{test['search']}'"


class TestAccountAPI(TestBase):
    jwt_token: str | None = None
    accounts: list[AccountId] = []  # Type annotation for accounts list

    def setUp(self):
        self.name = fake.name()
        self.email = fake.email()
        self.password = fake.password()
        self.create_user_and_login()
        self.create_bank()

    def create_user_and_login(self) -> None:
        data = {"name": self.name, "email": self.email, "password": self.password}
        user_id, token = self.register_test_user(data)
        self.user_id = user_id
        self.jwt_token = token

    def create_bank(self):
        url = f"{self.base_url}/banks/"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        data = {"name": fake.bank_name()}
        response = requests.post(url, headers=headers, json=data)
        assert response.status_code == 201
        self.bank_id = response.json()["id"]

    def create_account(self, acc_type: str, bank_id: int) -> AccountId:
        """Create an account with a unique name"""
        url = f"{self.base_url}/accounts"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        account_name = f"Test {acc_type.capitalize()} {fake.uuid4()}"
        data: AccountData = {
            "name": account_name,
            "type": acc_type,
            "bank_id": bank_id,
        }
        response = requests.post(url, headers=headers, json=data)
        assert response.status_code == 201
        return cast(AccountId, response.json()["id"])

    def test_create_account_types(self):
        """Test creating different types of accounts"""
        account_types = ["checking", "savings", "investment", "expense", "income"]
        for acc_type in account_types:
            account_id = self.create_account(acc_type, self.bank_id)
            self.accounts.append(account_id)

            # Verify account was created correctly
            url = f"{self.base_url}/accounts/{account_id}"
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            response = requests.get(url, headers=headers)
            assert response.status_code == 200
            account_data = response.json()
            assert "type" in account_data
            assert account_data["type"] == acc_type

    def test_get_account_balance(self):
        """Test getting account balance"""
        # Create two accounts with unique names
        accounts: list[AccountId] = []
        for acc_type in ["checking", "savings"]:
            account_id = self.create_account(acc_type, self.bank_id)
            accounts.append(account_id)

        # Create a transaction
        transaction_url = f"{self.base_url}/transactions"
        transaction_data: TransactionData = {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "description": "Test transaction",
            "amount": 100.00,
            "from_account_id": accounts[0],
            "to_account_id": accounts[1],
            "type": "transfer",
            "category": "transfer",
            "subcategory": None,
        }
        response = requests.post(
            transaction_url,
            headers={"Authorization": f"Bearer {self.jwt_token}"},
            json=transaction_data,
        )
        assert response.status_code == 201

        # Check account balance
        url = f"{self.base_url}/accounts/{accounts[0]}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        assert response.status_code == 200
        account = response.json()
        assert "balance" in account

    def test_get_wealth_summary(self):
        """Test getting wealth summary"""
        # Create accounts first
        for acc_type in ["checking", "savings", "investment"]:
            account_id = self.create_account(acc_type, self.bank_id)
            self.accounts.append(account_id)

        url = f"{self.base_url}/accounts/wealth"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        assert response.status_code == 200
        data = response.json()

        required_fields = [
            "total_balance",
            "checking_balance",
            "savings_balance",
            "investment_balance",
        ]
        for field in required_fields:
            assert field in data


# Add new test class for validation scenarios
class TestValidation(TestBase):
    def setUp(self):
        self.name = fake.name()
        self.email = fake.email()
        self.password = fake.password()
        self.create_user_and_login()
        self.setup_test_data()

    def create_user_and_login(self):
        data = {"name": self.name, "email": self.email, "password": self.password}
        user_id, token = self.register_test_user(data)
        self.user_id = user_id
        self.jwt_token = token

    def setup_test_data(self):
        """Set up test data with unique bank name"""
        url = f"{self.base_url}/banks/"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        bank_name = f"{fake.bank_name()} {fake.uuid4()}"
        data = {"name": bank_name}
        response = requests.post(url, headers=headers, json=data)
        assert response.status_code == 201
        self.bank_id = response.json()["id"]

    def test_invalid_account_type(self):
        """Test creating account with invalid type"""
        url = f"{self.base_url}/accounts"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        invalid_types = ["invalid", "", None, "credit", 123]
        for invalid_type in invalid_types:
            data = {
                "name": "Test Account",
                "type": invalid_type,
                "bank_id": self.bank_id,
            }
            response = requests.post(url, headers=headers, json=data)
            assert response.status_code == 422
            assert "Validation error" in response.json()

    def test_invalid_transaction_amount(self):
        """Test creating transaction with invalid amount"""
        # First create accounts
        url = f"{self.base_url}/accounts"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        accounts = []
        for acc_type in ["checking", "savings"]:
            data = {
                "name": f"Test {acc_type}",
                "type": acc_type,
                "bank_id": self.bank_id,
            }
            response = requests.post(url, headers=headers, json=data)
            assert response.status_code == 201
            accounts.append(response.json()["id"])

        # Test invalid amounts
        url = f"{self.base_url}/transactions"
        invalid_amounts = [-100, 0, "invalid", None, ""]

        base_data = {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "description": "Test transaction",
            "from_account_id": accounts[0],
            "to_account_id": accounts[1],
            "type": "transfer",
            "category": "Test",
        }

        for amount in invalid_amounts:
            data = base_data.copy()
            data["amount"] = amount
            response = requests.post(url, headers=headers, json=data)
            self.assert_validation_error(
                response, f"Expected validation error for amount {amount}"
            )

    def test_invalid_date_formats(self):
        """Test transactions with invalid date formats"""
        # Create test accounts first
        url = f"{self.base_url}/accounts"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        accounts = []
        for acc_type in ["checking", "savings"]:
            data = {
                "name": f"Test {acc_type}",
                "type": acc_type,
                "bank_id": self.bank_id,
            }
            response = requests.post(url, headers=headers, json=data)
            assert response.status_code == 201
            accounts.append(response.json()["id"])

        # Test invalid date formats
        url = f"{self.base_url}/transactions"
        invalid_dates = [
            "2024/01/01",
            "01-01-2024",
            "2024-13-01",  # invalid month
            "2024-01-32",  # invalid day
            None,
            "",
            "invalid",
        ]

        base_data = {
            "description": "Test transaction",
            "amount": 100.00,
            "from_account_id": accounts[0],
            "to_account_id": accounts[1],
            "type": "transfer",
            "category": "Test",
        }

        for date in invalid_dates:
            data = base_data.copy()
            data["date"] = date
            data["date_accountability"] = datetime.now().isoformat()

            response = requests.post(url, headers=headers, json=data)
            assert (
                response.status_code == 422
            ), f"Expected 422 for date {date}, got {response.status_code}"
            assert "Validation error" in response.json()

    def test_search_special_characters(self):
        """Test search functionality with special characters"""
        # Create test accounts
        url = f"{self.base_url}/accounts"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        accounts = []
        for acc_type in ["checking", "savings"]:
            data = {
                "name": f"Test {acc_type}",
                "type": acc_type,
                "bank_id": self.bank_id,
            }
            response = requests.post(url, headers=headers, json=data)
            assert response.status_code == 201
            accounts.append(response.json()["id"])

        # Create transactions with special characters
        url = f"{self.base_url}/transactions"
        special_descriptions = [
            "Test % transaction",
            "Test _ transaction",
            "Test & transaction",
            "Test ' transaction",
            'Test " transaction',
            "Test ; transaction",
        ]

        base_data = {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "amount": 100.00,
            "from_account_id": accounts[0],
            "to_account_id": accounts[1],
            "type": "transfer",
            "category": "Test",
        }

        # Create transactions
        for desc in special_descriptions:
            data = base_data.copy()
            data["description"] = desc
            response = requests.post(url, headers=headers, json=data)
            assert response.status_code == 201

        # Test searching with special characters
        search_terms = ["%", "_", "&", "'", '"', ";"]
        for term in search_terms:
            response = requests.get(url, headers=headers, params={"search": term})
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            # Verify at least one transaction contains the search term
            found = False
            for transaction in data["items"]:
                if term in transaction["description"]:
                    found = True
                    break
            assert found, f"No transaction found containing term '{term}'"


if __name__ == "__main__":
    unittest.main()
