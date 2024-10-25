import unittest
import requests
from faker import Faker
from datetime import datetime

fake = Faker()

from faker.providers import DynamicProvider

BankProvider = DynamicProvider(
     provider_name="bank_name",
     elements=["JP Morgan Chase", "Wells Fargo", "Citibank", "HSBC", "Chase", "Bank of America", "HSBC"],
)

fake.add_provider(BankProvider)

class TestUserAPI(unittest.TestCase):
    base_url = 'http://localhost:5000'
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

    def create_user(self):
        url = f'{self.base_url}/users/register'
        data = {
            'name': self.name,
            'email': self.email,
            'password': self.password
        }
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 201)
        user_data = response.json()
        self.user_id = user_data['id']
        self.assertEqual(user_data['email'], self.email)
        self.assertEqual(user_data['name'], self.name)
        self.assertIn('id', user_data)
        self.assertIsInstance(user_data['id'], int)
        self.assertIn('last_login', user_data)
        self.assertIsInstance(user_data['last_login'], str)

    def login_user(self):
        url = f'{self.base_url}/users/login'
        data = {
            'email': self.email,
            'password': self.password
        }
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 200)
        login_data = response.json()
        self.assertIn('access_token', login_data)
        self.assertIsInstance(login_data['access_token'], str)
        self.jwt_token = login_data['access_token']

    def get_user(self):
        url = f'{self.base_url}/users/{self.user_id}'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 200)
        user_data = response.json()
        self.assertEqual(user_data['email'], self.email)
        self.assertEqual(user_data['name'], self.name)
        self.assertIn('id', user_data)
        self.assertIn('last_login', user_data)
        self.assertIsInstance(user_data['last_login'], str)

    def update_user(self):
        url = f'{self.base_url}/users/{self.user_id}'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        self.new_name = fake.name()
        self.new_email = fake.email()
        data = {
            'name': self.new_name,
            'email': self.new_email
        }
        response = requests.put(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 200)
        updated_user = response.json()
        self.assertEqual(updated_user['name'], self.new_name)
        self.assertEqual(updated_user['email'], self.new_email)
        self.assertEqual(updated_user['id'], self.user_id)
        self.assertIsInstance(updated_user['last_login'], str)

    def get_updated_user(self):
        url = f'{self.base_url}/users/{self.user_id}'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 200)
        user_data = response.json()
        self.assertEqual(user_data['email'], self.new_email)
        self.assertEqual(user_data['name'], self.new_name)
        self.assertIn('id', user_data)
        self.assertEqual(user_data['id'], self.user_id)
        self.assertIn('last_login', user_data)
        self.assertIsInstance(user_data['last_login'], str)

    def delete_user(self):
        url = f'{self.base_url}/users/{self.user_id}'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        response = requests.delete(url, headers=headers)
        self.assertEqual(response.status_code, 204)

        # Verify that the user is deleted by trying to get it
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 404)

    def test_create_duplicate_user(self):
        # First, create a user
        self.create_user()

        # Try to create another user with the same email
        url = f'{self.base_url}/users/register'
        data = {
            'name': fake.name(),
            'email': self.email,  # Use the same email as the first user
            'password': fake.password()
        }
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 422)
        self.assertIn('error', response.json())
        self.assertIn('already exists', response.json()['error'])

    def test_login_with_invalid_credentials(self):
        url = f'{self.base_url}/users/login'
        data = {
            'email': fake.email(),
            'password': fake.password()
        }
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 401)
        self.assertIn('error', response.json())

    def test_get_other_user(self):
        self.create_user()  # Create a user to get a valid JWT token
        self.login_user()
        url = f'{self.base_url}/users/99999'  # Assume 99999 is a non-existent user ID
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 403)
        self.assertIn('error', response.json())

    def test_update_user_without_token(self):
        self.create_user()
        url = f'{self.base_url}/users/{self.user_id}'
        data = {
            'name': fake.name(),
            'email': fake.email()
        }
        response = requests.put(url, json=data)
        self.assertEqual(response.status_code, 401)
        self.assertIn('msg', response.json())

    def test_delete_user_without_token(self):
        self.create_user()
        url = f'{self.base_url}/users/{self.user_id}'
        response = requests.delete(url)
        self.assertEqual(response.status_code, 401)
        self.assertIn('msg', response.json())

    def verify_token(self):
        url = f'{self.base_url}/verify-token'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Token is valid"})

class TestBankAPI(unittest.TestCase):
    base_url = 'http://localhost:5000'
    jwt_token = None

    def setUp(self):
        self.name: str = fake.name()
        self.email: str = fake.email()
        self.password: str = fake.password()
        self.bank_name: str = fake.company()
        self.create_user()
        self.login_user()

    def create_user(self):
        url = f'{self.base_url}/users/register'
        data = {
            'name': self.name,
            'email': self.email,
            'password': self.password
        }
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 201)
        user_data = response.json()
        self.user_id = user_data['id']

    def login_user(self):
        url = f'{self.base_url}/users/login'
        data = {
            'email': self.email,
            'password': self.password
        }
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 200)
        login_data = response.json()
        self.jwt_token = login_data['access_token']

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
        url = f'{self.base_url}/banks/'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        data = {
            'name': self.bank_name
        }
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 201)
        bank_data = response.json()
        self.assertIn('id', bank_data)
        return bank_data['id']

    def get_bank(self, bank_id: int):
        url = f'{self.base_url}/banks/{bank_id}'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 200)
        bank_data = response.json()
        self.assertEqual(bank_data['name'], self.bank_name)

    def update_bank(self, bank_id: int):
        url = f'{self.base_url}/banks/{bank_id}'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        new_bank_name = fake.company()
        data = {
            'name': new_bank_name
        }
        response = requests.put(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 200)
        updated_bank = response.json()
        self.assertEqual(updated_bank['name'], new_bank_name)

    def delete_bank(self, bank_id: int):
        url = f'{self.base_url}/banks/{bank_id}'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        response = requests.delete(url, headers=headers)
        self.assertEqual(response.status_code, 204)

    def create_bank_with_faulty_token(self, faulty_token: str):
        url = f'{self.base_url}/banks/'
        headers = {
            'Authorization': f'Bearer {faulty_token}'
        }
        data = {
            'name': self.bank_name
        }
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 401)
        self.assertIn('msg', response.json())

    def get_bank_with_faulty_token(self, faulty_token: str, bank_id: int):
        url = f'{self.base_url}/banks/{bank_id}'
        headers = {
            'Authorization': f'Bearer {faulty_token}'
        }
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 401)
        self.assertIn('msg', response.json())

    def update_bank_with_faulty_token(self, faulty_token: str, bank_id: int):
        url = f'{self.base_url}/banks/{bank_id}'
        headers = {
            'Authorization': f'Bearer {faulty_token}'
        }
        new_bank_name = fake.company()
        data = {
            'name': new_bank_name
        }
        response = requests.put(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 401)
        self.assertIn('msg', response.json())

    def delete_bank_with_faulty_token(self, faulty_token: str, bank_id: int):
        url = f'{self.base_url}/banks/{bank_id}'
        headers = {
            'Authorization': f'Bearer {faulty_token}'
        }
        response = requests.delete(url, headers=headers)
        self.assertEqual(response.status_code, 401)
        self.assertIn('msg', response.json())

    def tearDown(self):
        # Clean up: delete the user and associated data
        if hasattr(self, 'user_id'):
            url = f'{self.base_url}/users/{self.user_id}'
            headers = {
                'Authorization': f'Bearer {self.jwt_token}'
            }
            requests.delete(url, headers=headers)

class TestTransactionAPI(unittest.TestCase):
    base_url = 'http://localhost:5000'
    jwt_token = None

    def setUp(self):
        # Create test user and get token
        self.name = fake.name()
        self.email = fake.email()
        self.password = fake.password()
        self.create_user_and_login()
        self.setup_accounts()

    def create_user_and_login(self):
        # Create user
        url = f'{self.base_url}/users/register'
        data = {
            'name': self.name,
            'email': self.email,
            'password': self.password
        }
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 201)
        self.user_id = response.json()['id']

        # Login
        url = f'{self.base_url}/users/login'
        data = {
            'email': self.email,
            'password': self.password
        }
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 200)
        self.jwt_token = response.json()['access_token']

    def setup_accounts(self):
        # Create a bank
        url = f'{self.base_url}/banks/'
        headers = {'Authorization': f'Bearer {self.jwt_token}'}
        data = {'name': fake.bank_name()}
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 201)
        self.bank_id = response.json()['id']

        # Create two accounts
        url = f'{self.base_url}/accounts'
        self.accounts = []
        for acc_type in ['checking', 'savings']:
            data = {
                'name': f'Test {acc_type.capitalize()}',
                'type': acc_type,
                'currency': 'EUR',
                'bank_id': self.bank_id,
                'tags': 'test'
            }
            response = requests.post(url, headers=headers, json=data)
            self.assertEqual(response.status_code, 201)
            self.accounts.append(response.json()['id'])

    def test_create_transaction(self):
        url = f'{self.base_url}/transactions'
        headers = {'Authorization': f'Bearer {self.jwt_token}'}
        data = {
            'date': datetime.now().isoformat(),
            'date_accountability': datetime.now().isoformat(),
            'description': 'Test transaction',
            'amount': 100.00,
            'from_account_id': self.accounts[0],
            'to_account_id': self.accounts[1],
            'category': 'Transfer',
            'subcategory': 'Test',
            'type': 'transfer'
        }
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 201)
        transaction = response.json()
        self.assertEqual(transaction['amount'], 100.00)
        self.assertEqual(transaction['description'], 'Test transaction')

    def test_get_transactions_with_filters(self):
        # Create a test transaction first
        self.test_create_transaction()

        url = f'{self.base_url}/transactions'
        headers = {'Authorization': f'Bearer {self.jwt_token}'}
        
        # Test different filters
        filters = [
            {'account_id': self.accounts[0]},
            {'type': 'transfer'},
            {'category': 'Transfer'},
            {'search': 'Test'}
        ]

        for filter_params in filters:
            response = requests.get(url, headers=headers, params=filter_params)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn('transactions', data)
            self.assertIn('total_amount', data)
            self.assertIn('count', data)
            self.assertTrue(len(data['transactions']) > 0)

    def test_transaction_pagination(self):
        # Create multiple transactions
        for _ in range(5):
            self.test_create_transaction()

        url = f'{self.base_url}/transactions'
        headers = {'Authorization': f'Bearer {self.jwt_token}'}
        
        # Test pagination
        params = {'page': 1, 'per_page': 2}
        response = requests.get(url, headers=headers, params=params)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data['transactions']), 2)

    def tearDown(self):
        if hasattr(self, 'user_id'):
            url = f'{self.base_url}/users/{self.user_id}'
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            requests.delete(url, headers=headers)

class TestAccountAPI(unittest.TestCase):
    base_url = 'http://localhost:5000'
    jwt_token = None

    def setUp(self):
        self.name = fake.name()
        self.email = fake.email()
        self.password = fake.password()
        self.create_user_and_login()
        self.create_bank()

    def create_user_and_login(self):
        # Create user
        url = f'{self.base_url}/users/register'
        data = {
            'name': self.name,
            'email': self.email,
            'password': self.password
        }
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 201)
        self.user_id = response.json()['id']

        # Login
        url = f'{self.base_url}/users/login'
        data = {
            'email': self.email,
            'password': self.password
        }
        response = requests.post(url, json=data)
        self.assertEqual(response.status_code, 200)
        self.jwt_token = response.json()['access_token']

    def create_bank(self):
        url = f'{self.base_url}/banks/'
        headers = {'Authorization': f'Bearer {self.jwt_token}'}
        data = {'name': fake.bank_name()}
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 201)
        self.bank_id = response.json()['id']

    def test_create_account_types(self):
        url = f'{self.base_url}/accounts'
        headers = {'Authorization': f'Bearer {self.jwt_token}'}
        
        # Test creating different types of accounts
        account_types = ['checking', 'savings', 'investment', 'expense', 'income']
        for acc_type in account_types:
            data = {
                'name': f'Test {acc_type.capitalize()}',
                'type': acc_type,
                'currency': 'EUR',
                'bank_id': self.bank_id,
                'tags': f'test,{acc_type}'
            }
            response = requests.post(url, headers=headers, json=data)
            self.assertEqual(response.status_code, 201)
            account = response.json()
            self.assertEqual(account['type'], acc_type)
            self.assertEqual(account['currency'], 'EUR')

    def test_get_account_balance(self):
        # Create an account and some transactions
        url = f'{self.base_url}/accounts'
        headers = {'Authorization': f'Bearer {self.jwt_token}'}
        
        # Create two accounts
        accounts = []
        for i in range(2):
            data = {
                'name': f'Test Account {i}',
                'type': 'checking',
                'currency': 'EUR',
                'bank_id': self.bank_id,
                'tags': 'test'
            }
            response = requests.post(url, headers=headers, json=data)
            self.assertEqual(response.status_code, 201)
            accounts.append(response.json()['id'])

        # Create some transactions
        transaction_url = f'{self.base_url}/transactions'
        transaction_data = {
            'date': datetime.now().isoformat(),
            'date_accountability': datetime.now().isoformat(),
            'description': 'Test transaction',
            'amount': 100.00,
            'from_account_id': accounts[0],
            'to_account_id': accounts[1],
            'type': 'transfer'
        }
        response = requests.post(transaction_url, headers=headers, json=transaction_data)
        self.assertEqual(response.status_code, 201)

        # Get account balance
        response = requests.get(f'{url}/{accounts[0]}', headers=headers)
        self.assertEqual(response.status_code, 200)
        account = response.json()
        self.assertIn('balance', account)

    def test_get_wealth_summary(self):
        # Create accounts and transactions first
        self.test_get_account_balance()

        url = f'{self.base_url}/accounts/wealth'
        headers = {'Authorization': f'Bearer {self.jwt_token}'}
        
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Check for required fields in wealth summary
        required_fields = ['total_balance', 'checking_balance', 'savings_balance', 'investment_balance']
        for field in required_fields:
            self.assertIn(field, data)

    def tearDown(self):
        if hasattr(self, 'user_id'):
            url = f'{self.base_url}/users/{self.user_id}'
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            requests.delete(url, headers=headers)

if __name__ == '__main__':
    unittest.main()
