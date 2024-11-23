import unittest
import requests
from faker import Faker
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Union
import time

fake = Faker()

from faker.providers import DynamicProvider

BankProvider = DynamicProvider(
    provider_name="bank_name",
    elements=[
        "JP Morgan Chase",
        "Wells Fargo",
        "Citibank",
        "HSBC",
        "Chase",
        "Bank of America",
        "HSBC",
    ],
)

fake.add_provider(BankProvider)


class TestBase(unittest.TestCase):
    """Base test class with common functionality"""

    base_url = "http://localhost:5000"
    # Class variable to store all created users
    _test_users: List[Dict[str, Union[int, str]]] = []

    def register_test_user(
        self, user_data: Dict[str, str]
    ) -> Tuple[Optional[int], Optional[str]]:
        """Register a test user and store their credentials"""
        url = f"{self.base_url}/users/register"
        register_response = requests.post(url, json=user_data)
        if register_response.status_code == 201:
            user_id = register_response.json()["id"]
            # Login to get token
            login_response = requests.post(
                f"{self.base_url}/users/login",
                json={"email": user_data["email"], "password": user_data["password"]},
            )
            if login_response.status_code == 200:
                token = login_response.json()["access_token"]
                self._test_users.append({"id": user_id, "token": token})
                return user_id, token
        return None, None

    @classmethod
    def tearDownClass(cls):
        """Clean up all test users after all tests are done"""
        for user in cls._test_users:
            url = f"{cls.base_url}/users"
            headers = {"Authorization": f"Bearer {user['token']}"}
            response = requests.delete(url, headers=headers)
            if response.status_code != 204:
                print(
                    f"Warning: Failed to delete user {user['id']}, status: {response.status_code}"
                )
        cls._test_users.clear()


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

        self.assertEqual(response.status_code, 200)
        user_data = response.json()
        self.assertEqual(user_data["email"], self.email)
        self.assertEqual(user_data["name"], self.name)
        self.assertIn("id", user_data)
        self.assertIsInstance(user_data["id"], int)
        self.assertIn("last_login", user_data)
        self.assertIsInstance(user_data["last_login"], str)

    def login_user(self):
        url = f"{self.base_url}/users/login"
        data = {"email": self.email, "password": self.password}
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 200)
        login_data = response.json()
        self.assertIn("access_token", login_data)
        self.assertIsInstance(login_data["access_token"], str)
        self.jwt_token = login_data["access_token"]
        print(self.jwt_token)

    def get_user(self):
        url = f"{self.base_url}/users/{self.user_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 200)
        user_data = response.json()
        self.assertEqual(user_data["email"], self.email)
        self.assertEqual(user_data["name"], self.name)
        self.assertIn("id", user_data)
        self.assertIn("last_login", user_data)
        self.assertIsInstance(user_data["last_login"], str)

    def update_user(self):
        url = f"{self.base_url}/users/{self.user_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        self.new_name = fake.name()
        self.new_email = fake.email()
        data = {"name": self.new_name, "email": self.new_email}
        response = requests.put(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 200)
        updated_user = response.json()
        self.assertEqual(updated_user["name"], self.new_name)
        self.assertEqual(updated_user["email"], self.new_email)
        self.assertEqual(updated_user["id"], self.user_id)
        self.assertIsInstance(updated_user["last_login"], str)

    def get_updated_user(self):
        url = f"{self.base_url}/users/{self.user_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 200)
        user_data = response.json()
        self.assertEqual(user_data["email"], self.new_email)
        self.assertEqual(user_data["name"], self.new_name)
        self.assertIn("id", user_data)
        self.assertEqual(user_data["id"], self.user_id)
        self.assertIn("last_login", user_data)
        self.assertIsInstance(user_data["last_login"], str)

    def delete_user(self):
        url = f"{self.base_url}/users/{self.user_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.delete(url, headers=headers)
        self.assertEqual(response.status_code, 204)

        # Verify that the user is deleted by trying to get it
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 404)

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
        self.assertEqual(response.status_code, 422)
        self.assertIn("error", response.json())
        self.assertIn("already exists", response.json()["error"])

    def test_login_with_invalid_credentials(self):
        url = f"{self.base_url}/users/login"
        data = {"email": fake.email(), "password": fake.password()}
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.json())

    def test_get_other_user(self):
        self.create_user()  # Create a user to get a valid JWT token
        self.login_user()
        url = f"{self.base_url}/users/99999"  # Assume 99999 is a non-existent user ID
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 403)
        self.assertIn("error", response.json())

    def test_update_user_without_token(self):
        self.create_user()
        url = f"{self.base_url}/users/{self.user_id}"
        data = {"name": fake.name(), "email": fake.email()}
        response = requests.put(url, json=data)
        self.assertEqual(response.status_code, 401)
        self.assertIn("msg", response.json())

    def test_delete_user_without_token(self):
        self.create_user()
        url = f"{self.base_url}/users/{self.user_id}"
        response = requests.delete(url)
        self.assertEqual(response.status_code, 401)
        self.assertIn("msg", response.json())

    def verify_token(self):
        url = f"{self.base_url}/verify-token"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Token is valid"})


class TestBankAPI(TestBase):
    jwt_token = None

    def setUp(self):
        self.name: str = fake.name()
        self.email: str = fake.email()
        self.password: str = fake.password()
        self.bank_name: str = fake.company()
        self.create_user()
        self.login_user()

    def create_user(self):
        data = {"name": self.name, "email": self.email, "password": self.password}
        user_id, token = self.register_test_user(data)
        self.user_id = user_id
        self.jwt_token = token

    def login_user(self):
        url = f"{self.base_url}/users/login"
        data = {"email": self.email, "password": self.password}
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 200)
        login_data = response.json()
        self.jwt_token = login_data["access_token"]

    def test_create_bank(self):
        bank_id = self.create_bank()
        self.assertIsNotNone(bank_id)

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

    def create_bank(self):
        url = f"{self.base_url}/banks/"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        data = {"name": self.bank_name}
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 201)
        bank_data = response.json()
        self.assertIn("id", bank_data)
        return bank_data["id"]

    def get_bank(self, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 200)
        bank_data = response.json()
        self.assertEqual(bank_data["name"], self.bank_name)

    def update_bank(self, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        new_bank_name = fake.company()
        data = {"name": new_bank_name}
        response = requests.put(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 200)
        updated_bank = response.json()
        self.assertEqual(updated_bank["name"], new_bank_name)

    def delete_bank(self, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.delete(url, headers=headers)
        self.assertEqual(response.status_code, 204)

    def create_bank_with_faulty_token(self, faulty_token: str):
        url = f"{self.base_url}/banks/"
        headers = {"Authorization": f"Bearer {faulty_token}"}
        data = {"name": self.bank_name}
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 401)
        self.assertIn("msg", response.json())

    def get_bank_with_faulty_token(self, faulty_token: str, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {faulty_token}"}
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 401)
        self.assertIn("msg", response.json())

    def update_bank_with_faulty_token(self, faulty_token: str, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {faulty_token}"}
        new_bank_name = fake.company()
        data = {"name": new_bank_name}
        response = requests.put(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 401)
        self.assertIn("msg", response.json())

    def delete_bank_with_faulty_token(self, faulty_token: str, bank_id: int):
        url = f"{self.base_url}/banks/{bank_id}"
        headers = {"Authorization": f"Bearer {faulty_token}"}
        response = requests.delete(url, headers=headers)
        self.assertEqual(response.status_code, 401)
        self.assertIn("msg", response.json())


class TestTransactionAPI(TestBase):
    jwt_token = None

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
        # Create a bank
        url = f"{self.base_url}/banks/"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        data = {"name": fake.bank_name()}
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 201)
        self.bank_id = response.json()["id"]

        # Create two accounts
        url = f"{self.base_url}/accounts"
        self.accounts: List[int] = []
        for acc_type in ["checking", "savings"]:
            data = {
                "name": f"Test {acc_type.capitalize()}",
                "type": acc_type,
                "bank_id": self.bank_id,
            }
            response = requests.post(url, headers=headers, json=data)
            self.assertEqual(response.status_code, 201)
            self.accounts.append(response.json()["id"])

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
            "category": "Transfer",
            "subcategory": "Test",
            "type": "transfer",
        }
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 201)
        transaction = response.json()
        self.assertEqual(transaction["amount"], 100.00)
        self.assertEqual(transaction["description"], "Test transaction")

    def test_get_transactions_with_filters(self) -> None:
        # Create a test transaction first
        self.test_create_transaction()

        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        # Test different filters
        filters: List[Dict[str, Union[int, str]]] = [
            {"account_id": self.accounts[0]},
            {"type": "transfer"},
            {"category": "Transfer"},
            {"search": "Test"},
        ]

        for filter_params in filters:
            response = requests.get(url, headers=headers, params=filter_params)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn("transactions", data)
            self.assertIn("total_amount", data)
            self.assertIn("count", data)
            self.assertTrue(len(data["transactions"]) > 0)

    def test_transaction_pagination(self):
        # Create multiple transactions
        for _ in range(5):
            self.test_create_transaction()

        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        # Test pagination
        params = {"page": 1, "per_page": 2}
        response = requests.get(url, headers=headers, params=params)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["transactions"]), 2)

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
                self.assertEqual(
                    response.status_code,
                    case["expected_status"],
                    f"Failed for {case['desc']}: expected {case['expected_status']}, got {response.status_code}",
                )

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
                self.assertEqual(
                    response.status_code,
                    case["expected_status"],
                    f"Failed for {case['desc']}: expected {case['expected_status']}, got {response.status_code}",
                )

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
                    self.assertEqual(
                        response.status_code,
                        case["expected_status"],
                        f"Failed for {case['desc']}: expected {case['expected_status']}, got {response.status_code}. Response: {response.json()}",
                    )
                except AssertionError:
                    print(f"Response for failed test: {response.json()}")
                    raise

    def test_transaction_amount_validation(self):
        """Test transaction amount validation"""
        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        test_cases = [
            {
                "amount": 0,
                "expected_status": 422,
                "desc": "Zero amount",
            },
            {
                "amount": -100,
                "expected_status": 422,
                "desc": "Negative amount",
            },
            {
                "amount": "invalid",
                "expected_status": 422,
                "desc": "Invalid amount type",
            },
            {
                "amount": 100.00,
                "expected_status": 201,
                "desc": "Valid amount",
            },
        ]

        base_data = {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "description": "Test transaction",
            "from_account_id": self.accounts[0],
            "to_account_id": self.accounts[1],
            "type": "transfer",
            "category": "Test",
            "subcategory": "Test",
        }

        for case in test_cases:
            with self.subTest(msg=f"Testing {case['desc']}"):
                data = base_data.copy()
                data["amount"] = case["amount"]

                response = requests.post(url, headers=headers, json=data)
                self.assertEqual(
                    response.status_code,
                    case["expected_status"],
                    f"Failed for {case['desc']}: expected {case['expected_status']}, got {response.status_code}",
                )

    def test_transaction_type_validation(self):
        """Test transaction type validation"""
        url = f"{self.base_url}/transactions"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        # Add a small delay between requests for the dev server
        # can be set to 0 for production wsgi server
        REQUEST_DELAY = 0.05  # 100ms delay

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
            {
                "type": "income",
                "expected_status": 201,
                "desc": "Valid type - income",
                "from_account_type": "income",  # Add account type for income transaction
                "to_account_type": "checking",  # Income must go to checking/savings
            },
            {
                "type": "expense",
                "expected_status": 201,
                "desc": "Valid type - expense",
                "from_account_type": "checking",  # Expense must come from checking/savings
                "to_account_type": "expense",  # Must go to expense account
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

        for case in test_cases:
            with self.subTest(msg=f"Testing {case['desc']}"):
                # Add delay before each test case
                time.sleep(REQUEST_DELAY)

                # Create appropriate accounts for this test case if needed
                from_account_id = self.accounts[0]
                to_account_id = self.accounts[1]

                # For income/expense tests, create specific account types
                if "from_account_type" in case:
                    time.sleep(REQUEST_DELAY)  # Add delay before account creation
                    response = requests.post(
                        f"{self.base_url}/accounts",
                        headers=headers,
                        json={
                            "name": f"Test {case['from_account_type']} Account",
                            "type": case["from_account_type"],
                            "bank_id": self.bank_id,
                        },
                    )
                    if response.status_code != 201:
                        print(f"Failed to create from_account: {response.json()}")
                        self.fail(f"Could not create from_account: {response.json()}")
                    from_account_id = response.json()["id"]

                if "to_account_type" in case:
                    time.sleep(REQUEST_DELAY)  # Add delay before account creation
                    response = requests.post(
                        f"{self.base_url}/accounts",
                        headers=headers,
                        json={
                            "name": f"Test {case['to_account_type']} Account",
                            "type": case["to_account_type"],
                            "bank_id": self.bank_id,
                        },
                    )
                    if response.status_code != 201:
                        print(f"Failed to create to_account: {response.json()}")
                        self.fail(f"Could not create to_account: {response.json()}")
                    to_account_id = response.json()["id"]

                # Add delay before transaction creation
                time.sleep(REQUEST_DELAY)

                data = base_data.copy()
                if case["type"] is not None:
                    data["type"] = case["type"]
                data["from_account_id"] = from_account_id
                data["to_account_id"] = to_account_id

                response = requests.post(url, headers=headers, json=data)
                try:
                    self.assertEqual(
                        response.status_code,
                        case["expected_status"],
                        f"Failed for {case['desc']}: expected {case['expected_status']}, got {response.status_code}",
                    )
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
                self.assertEqual(
                    response.status_code,
                    case["expected_status"],
                    f"Failed for {case['desc']}: expected {case['expected_status']}, got {response.status_code}",
                )

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
            try:
                self.assertEqual(
                    response.status_code,
                    201,
                    f"Failed to create test transaction. Response: {response.json()}",
                )
            except AssertionError:
                print(f"Response for failed transaction creation: {response.json()}")
                raise

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
                try:
                    self.assertEqual(response.status_code, 200)
                    data = response.json()
                    self.assertEqual(
                        len(data["transactions"]),
                        test["expected_count"],
                        f"Expected {test['expected_count']} results for search term '{test['search']}', got {len(data['transactions'])}. Response: {data}",
                    )
                except AssertionError:
                    print(f"Response for failed search test: {response.json()}")
                    raise


class TestAccountAPI(TestBase):
    jwt_token = None

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
        self.assertEqual(response.status_code, 201)
        self.bank_id = response.json()["id"]

    def test_create_account_types(self):
        url = f"{self.base_url}/accounts"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        # Test creating different types of accounts
        account_types = ["checking", "savings", "investment", "expense", "income"]
        for acc_type in account_types:
            data = {
                "name": f"Test {acc_type.capitalize()}",
                "type": acc_type,
                "bank_id": self.bank_id,
            }
            response = requests.post(url, headers=headers, json=data)
            self.assertEqual(response.status_code, 201)
            account = response.json()
            self.assertEqual(account["type"], acc_type)

    def test_get_account_balance(self):
        # Create an account and some transactions
        url = f"{self.base_url}/accounts"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        # Create two accounts
        accounts = []
        for i in range(2):
            data = {
                "name": f"Test Account {i}",
                "type": "checking",
                "bank_id": self.bank_id,
            }
            response = requests.post(url, headers=headers, json=data)
            self.assertEqual(response.status_code, 201)
            accounts.append(response.json()["id"])

        # Create some transactions
        transaction_url = f"{self.base_url}/transactions"
        transaction_data = {
            "date": datetime.now().isoformat(),
            "date_accountability": datetime.now().isoformat(),
            "description": "Test transaction",
            "amount": 100.00,
            "from_account_id": accounts[0],
            "to_account_id": accounts[1],
            "type": "transfer",
            "category": "transfer",
        }
        response = requests.post(
            transaction_url, headers=headers, json=transaction_data
        )
        self.assertEqual(response.status_code, 201)

        # Get account balance
        response = requests.get(f"{url}/{accounts[0]}", headers=headers)
        self.assertEqual(response.status_code, 200)
        account = response.json()
        self.assertIn("balance", account)

    def test_get_wealth_summary(self):
        # Create accounts and transactions first
        self.test_get_account_balance()

        url = f"{self.base_url}/accounts/wealth"
        headers = {"Authorization": f"Bearer {self.jwt_token}"}

        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check for required fields in wealth summary
        required_fields = [
            "total_balance",
            "checking_balance",
            "savings_balance",
            "investment_balance",
        ]
        for field in required_fields:
            self.assertIn(field, data)


if __name__ == "__main__":
    unittest.main()
