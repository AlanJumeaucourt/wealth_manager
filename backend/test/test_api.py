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
        self.name: str = fake.name()
        self.email: str = fake.email()
        self.password: str = fake.password()
        self.create_user()
        self.login_user()
        self.create_bank()
        self.create_accounts()

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

    def create_bank(self):
        url = f'{self.base_url}/banks/'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        data = {
            'name': fake.company()
        }
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 201)
        bank_data = response.json()
        self.bank_id = bank_data['id']

    def create_accounts(self):
        self.account1 = self.create_account("Account 1", "checking", self.bank_id)
        self.account2 = self.create_account("Account 2", "savings", self.bank_id)

    def create_account(self, name: str, account_type: str, bank_id: int):
        url = f'{self.base_url}/accounts'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        data = {
            'name': name,
            'type': account_type,
            'currency': 'EUR',
            'bank_id': bank_id,
            'tags': 'tag1,tag2'
        }
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 201)
        return response.json()['id']

    def test_create_transaction(self):
        transaction_id = self.create_transaction()
        self.assertIsNotNone(transaction_id)

    def test_get_transaction(self):
        transaction_id = self.create_transaction()
        self.get_transaction(transaction_id)

    def test_update_transaction(self):
        transaction_id = self.create_transaction()
        self.update_transaction(transaction_id)

    def test_delete_transaction(self):
        transaction_id = self.create_transaction()
        self.delete_transaction(transaction_id)

    def test_create_transaction_with_faulty_token(self):
        faulty_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        self.create_transaction_with_faulty_token(faulty_token)

    def create_transaction(self):
        url = f'{self.base_url}/transactions'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        transaction_date = datetime.now().isoformat()
        data = {
            'date': transaction_date,
            'date_accountability': transaction_date,  # Ajout du nouveau champ
            'description': fake.sentence(),
            'amount': round(fake.random.uniform(10, 1000), 2),
            'from_account_id': self.account1,
            'to_account_id': self.account2,
            'category': 'Transfer',
            'subcategory': 'Transfer',
            'related_transaction_id': None,
            'type': 'transfer'
        }
        response = requests.post(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 201)
        transaction_data = response.json()
        self.assertIn('id', transaction_data)
        return transaction_data['id']

    def get_transaction(self, transaction_id: int):
        url = f'{self.base_url}/transactions/{transaction_id}'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        response = requests.get(url, headers=headers)
        self.assertEqual(response.status_code, 200)
        transaction_data = response.json()
        self.assertEqual(transaction_data['id'], transaction_id)
        # Vérification de la présence du nouveau champ
        self.assertIn('date_accountability', transaction_data)
        self.assertIsInstance(transaction_data['date_accountability'], str)

    def update_transaction(self, transaction_id: int):
        url = f'{self.base_url}/transactions/{transaction_id}'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        new_description = fake.sentence()
        new_date = datetime.now().isoformat()
        data = {
            'description': new_description,
            'date_accountability': new_date  # Ajout du nouveau champ
        }
        response = requests.put(url, headers=headers, json=data)
        self.assertEqual(response.status_code, 200)
        updated_transaction = response.json()
        self.assertEqual(updated_transaction['id'], transaction_id)
        self.assertIsInstance(updated_transaction['date'], str)
        self.assertIsInstance(updated_transaction['date_accountability'], str)  # Vérification du nouveau champ
        self.assertEqual(updated_transaction['description'], new_description)
        self.assertIsInstance(updated_transaction['amount'], float)
        self.assertEqual(updated_transaction['from_account_id'], self.account1)
        self.assertEqual(updated_transaction['to_account_id'], self.account2)
        self.assertEqual(updated_transaction['category'], 'Transfer')
        self.assertEqual(updated_transaction['subcategory'], 'Transfer')
        self.assertEqual(updated_transaction['related_transaction_id'], None)
        self.assertEqual(updated_transaction['type'], 'transfer')

    def delete_transaction(self, transaction_id: int):
        url = f'{self.base_url}/transactions/{transaction_id}'
        headers = {
            'Authorization': f'Bearer {self.jwt_token}'
        }
        response = requests.delete(url, headers=headers)
        self.assertEqual(response.status_code, 204)

    def create_transaction_with_faulty_token(self, faulty_token: str):
        url = f'{self.base_url}/transactions'
        headers = {
            'Authorization': f'Bearer {faulty_token}'
        }
        transaction_date = datetime.now().isoformat()
        data = {
            'date': transaction_date,
            'date_accountability': transaction_date,  # Ajout du nouveau champ
            'description': fake.sentence(),
            'amount': round(fake.random.uniform(10, 1000), 2),
            'from_account_id': self.account1,
            'to_account_id': self.account2,
            'category': fake.word(),
            'subcategory': fake.word(),
            'type': 'transfer'
        }
        response = requests.post(url, headers=headers, json=data)
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

if __name__ == '__main__':
    unittest.main()
