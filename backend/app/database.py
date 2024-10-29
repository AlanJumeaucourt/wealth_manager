import sqlite3
from typing import Optional, Union, List, Dict, Any
from enum import Enum
from app.exceptions import QueryExecutionError, NoResultFoundError


class QueryType(Enum):
    SELECT = "select"
    INSERT = "insert"
    INSERT_RETURNING = "insert_returning"
    UPDATE = "update"
    UPDATE_RETURNING = "update_returning"
    DELETE = "delete"


class DatabaseManager:
    """Manages database connections and executes raw SQL queries."""

    def __init__(self, db_name: str = "/etc/wealth/backend/app/wealthmanager.db"):
        """
        Initialize the DatabaseManager with the database name.

        :param db_name: The name of the SQLite database file.
        """
        self.db_name = db_name

    def connect_to_database(self):
        """
        Establish a connection to the SQLite database.

        :return: A connection object to the SQLite database.
        """
        connection = sqlite3.connect(self.db_name)
        # sqlite3.register_adapter(datetime, lambda dt: dt.isoformat())
        # sqlite3.register_converter(
        #     "timestamp", lambda s: datetime.fromisoformat(s.decode())
        # )
        connection.execute("PRAGMA foreign_keys = ON;")
        return connection
    
    def execute_select(self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None) -> List[Dict[str, Any]]:
        result = self.__execute_raw_sql(query, QueryType.SELECT, params)
        if not result:
            raise NoResultFoundError("No result found for select query", query, params)
        return result

    def execute_insert(self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None) -> int:
        result = self.__execute_raw_sql(query, QueryType.INSERT, params)
        if not result:
            raise NoResultFoundError("No result found for insert query", query, params)
        return result

    def execute_insert_returning(self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None) -> Dict[str, Any]:
        result = self.__execute_raw_sql(query, QueryType.INSERT_RETURNING, params)
        if not result:
            raise NoResultFoundError("No result found for insert returning query", query, params)
        return result

    def execute_update(self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None) -> int:
        result = self.__execute_raw_sql(query, QueryType.UPDATE, params)
        if not result:
            raise NoResultFoundError("No result found for update query", query, params)
        return result
    
    def execute_update_returning(self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None) -> Dict[str, Any]:
        result = self.__execute_raw_sql(query, QueryType.UPDATE_RETURNING, params)
        if not result:
            raise NoResultFoundError("No result found for update returning query", query, params)
        return result
    
    def execute_delete(self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None) -> bool:
        result = self.__execute_raw_sql(query, QueryType.DELETE, params)
        if not result:
            raise NoResultFoundError("No result found for delete query", query, params)
        return result
    
    
    
    def __execute_raw_sql(
        self, query: str, query_type: QueryType, params: Optional[Union[tuple[Any, ...], list[Any]]] = None, 
    ) -> Any:
        """
        Execute a raw SQL query and return the results.

        :param query: The SQL query to execute.
        :param params: Optional parameters for the SQL query.
        :return: The results of the query, or the last row ID for insert operations.
        """
        with self.connect_to_database() as connection:  # Use 'with' block for connection
            connection.row_factory = sqlite3.Row
            cursor = connection.cursor()
            try:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)

                if query_type == QueryType.SELECT:
                    results = cursor.fetchall()
                    return [
                        dict(row) for row in results
                    ]
                    
                                
                elif query_type == QueryType.INSERT:
                    connection.commit()
                    return cursor.lastrowid
                
                elif query_type == QueryType.INSERT_RETURNING:
                    result = cursor.fetchall()
                    connection.commit()
                    return dict(result[0])

                elif query_type == QueryType.UPDATE:
                    connection.commit()
                    return cursor.lastrowid
                
                elif query_type == QueryType.UPDATE_RETURNING:
                    result = cursor.fetchall()
                    connection.commit()
                    return dict(result[0])
                
                elif query_type == QueryType.DELETE:
                    connection.commit()
                    return True
               
            except Exception as err:
                raise QueryExecutionError(f"Error executing query: {err}", query, params)
            finally:
                cursor.close()

    def create_tables(self):
        """
        Create the necessary tables, views, triggers and indexes in the database if they do not exist.
        """
        tables = [
            """CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT, 
                        name TEXT NOT NULL, 
                        email TEXT UNIQUE NOT NULL, 
                        password TEXT NOT NULL, 
                        last_login TIMESTAMP);
                    """,
            """CREATE TABLE IF NOT EXISTS banks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT, 
                        user_id INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
                    """,
            """CREATE TABLE IF NOT EXISTS accounts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT, 
                        user_id INTEGER NOT NULL,
                        name TEXT NOT NULL, 
                        type TEXT CHECK(type IN ('investment', 'income', 'expense', 'checking', 'savings')) NOT NULL, 
                        bank_id INTEGER NOT NULL,
                        currency TEXT NOT NULL, 
                        tags TEXT,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE);
                    """,
            """CREATE TABLE IF NOT EXISTS transactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT, 
                        user_id INTEGER NOT NULL,
                        date TIMESTAMP NOT NULL,
                        date_accountability TIMESTAMP NOT NULL,
                        description TEXT NOT NULL,
                        amount DECIMAL(10, 2) NOT NULL,
                        from_account_id INTEGER NOT NULL,
                        to_account_id INTEGER NOT NULL,
                        category TEXT,
                        subcategory TEXT,
                        related_transaction_id INTEGER,
                        type TEXT CHECK(type IN ('expense', 'income', 'transfer')) NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                        FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE CASCADE);
                    """,
            """CREATE TABLE IF NOT EXISTS investment_transactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        account_id INTEGER NOT NULL,
                        asset_symbol TEXT NOT NULL,
                        asset_name TEXT NOT NULL,
                        activity_type TEXT CHECK(activity_type IN ('buy', 'sell', 'deposit', 'withdrawal')) NOT NULL,
                        date TIMESTAMP NOT NULL,
                        quantity DECIMAL(10, 6) NOT NULL,
                        unit_price DECIMAL(10, 2) NOT NULL,
                        fee DECIMAL(10, 2) NOT NULL,
                        tax DECIMAL(10, 2) NOT NULL,
                        transaction_related_id INTEGER,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                        FOREIGN KEY (transaction_related_id) REFERENCES investment_transactions(id) ON DELETE SET NULL
                    );""",
        ]
        
        views = [
            """
            CREATE VIEW IF NOT EXISTS account_balances AS
            WITH transaction_impacts AS (
                -- Incoming transactions (positive impact)
                SELECT 
                    to_account_id as account_id,
                    CASE 
                        WHEN type = 'income' THEN amount
                        WHEN type = 'transfer' THEN amount
                        ELSE 0 
                    END as amount
                FROM transactions
                
                UNION ALL
                
                -- Outgoing transactions (negative impact)
                SELECT 
                    from_account_id as account_id,
                    CASE 
                        WHEN type = 'expense' THEN -amount
                        WHEN type = 'transfer' THEN -amount
                        ELSE 0 
                    END as amount
                FROM transactions
            )
            SELECT 
                a.id as account_id,
                a.user_id,
                a.name as account_name,
                a.type as account_type,
                a.currency,
                COALESCE(SUM(ti.amount), 0) as current_balance
            FROM accounts a
            LEFT JOIN transaction_impacts ti ON a.id = ti.account_id
            GROUP BY a.id, a.user_id, a.name, a.type, a.currency;
            """
        ]
        
        triggers = [
            """
            CREATE TRIGGER IF NOT EXISTS trg_create_investment_transfer
            AFTER INSERT ON investment_transactions
            FOR EACH ROW
            WHEN NEW.activity_type IN ('buy', 'sell')
            BEGIN
                INSERT INTO transactions (
                    user_id,
                    date,
                    date_accountability,
                    description,
                    amount,
                    from_account_id,
                    to_account_id,
                    type,
                    category,
                    subcategory,
                    related_transaction_id
                )
                SELECT
                    NEW.user_id,
                    DATETIME('now'),
                    NEW.date,
                    NEW.activity_type || ' ' || NEW.quantity || ' ' || NEW.asset_symbol || ' @ ' || NEW.unit_price,
                    (NEW.quantity * NEW.unit_price) + NEW.fee + NEW.tax,
                    CASE 
                        WHEN NEW.activity_type = 'buy' THEN 
                            (SELECT c.id
                             FROM accounts i
                             JOIN accounts c ON c.name = i.name || ' cash'
                             WHERE i.id = NEW.account_id
                             AND i.user_id = NEW.user_id
                             AND c.type = 'checking'
                             LIMIT 1)
                        ELSE NEW.account_id 
                    END,
                    CASE 
                        WHEN NEW.activity_type = 'buy' THEN NEW.account_id 
                        ELSE (SELECT c.id
                              FROM accounts i
                              JOIN accounts c ON c.name = i.name || ' cash'
                              WHERE i.id = NEW.account_id
                              AND i.user_id = NEW.user_id
                              AND c.type = 'checking'
                              LIMIT 1)
                    END,
                    'transfer',
                    'Investment',
                    NEW.activity_type,
                    NEW.id;
            END;
            """,
            """
            CREATE TRIGGER IF NOT EXISTS trg_validate_transaction
            BEFORE INSERT ON transactions
            BEGIN
                -- Get account types for validation
                WITH account_types AS (
                    SELECT 
                        NEW.from_account_id as account_id,
                        type as from_type,
                        (SELECT type FROM accounts WHERE id = NEW.to_account_id) as to_type
                    FROM accounts 
                    WHERE id = NEW.from_account_id
                )
                SELECT
                    CASE
                        -- Validate income transactions
                        WHEN NEW.type = 'income' AND (
                            (SELECT to_type FROM account_types) NOT IN ('checking', 'savings', 'investment')
                        ) THEN
                            RAISE(ABORT, 'Income cannot be received in this type of account')
                        WHEN NEW.type = 'income' AND (
                            (SELECT from_type FROM account_types) != 'income'
                        ) THEN
                            RAISE(ABORT, 'Income must originate from an income account')
                            
                        -- Validate expense transactions
                        WHEN NEW.type = 'expense' AND (
                            (SELECT from_type FROM account_types) NOT IN ('checking', 'savings', 'investment')
                        ) THEN
                            RAISE(ABORT, 'Expenses cannot be paid from this type of account')
                        WHEN NEW.type = 'expense' AND (
                            (SELECT to_type FROM account_types) != 'expense'
                        ) THEN
                            RAISE(ABORT, 'Expenses must go to an expense account')
                            
                        -- Validate transfer transactions
                        WHEN NEW.type = 'transfer' AND (
                            (SELECT from_type FROM account_types) NOT IN ('checking', 'savings', 'investment')
                        ) THEN
                            RAISE(ABORT, 'Cannot transfer from this type of account')
                        WHEN NEW.type = 'transfer' AND (
                            (SELECT to_type FROM account_types) NOT IN ('checking', 'savings', 'investment')
                        ) THEN
                            RAISE(ABORT, 'Cannot transfer to this type of account')
                    END;
            END;
            """,
            """
            CREATE TRIGGER IF NOT EXISTS trg_create_investment_cash_account
            AFTER INSERT ON accounts
            WHEN NEW.type = 'investment'
            BEGIN
                INSERT INTO accounts (
                    user_id,
                    name,
                    type,
                    currency,
                    bank_id,
                    tags
                )
                VALUES (
                    NEW.user_id,
                    NEW.name || ' cash',
                    'checking',
                    NEW.currency,
                    NEW.bank_id,
                    'investment_cash'
                );
            END;
            """
        ]
        
        indexes = [
            # Users table - email is used for login/authentication
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
            
            # Banks table - frequently queried by user_id
            "CREATE INDEX IF NOT EXISTS idx_banks_user_id ON banks(user_id);",
            
            # Accounts table - most important queries
            "CREATE INDEX IF NOT EXISTS idx_accounts_user_id_type ON accounts(user_id, type);",
            
            # Transactions table - most important queries
            "CREATE INDEX IF NOT EXISTS idx_transactions_user_id_date ON transactions(user_id, date);",
            "CREATE INDEX IF NOT EXISTS idx_transactions_user_id_date_accountability ON transactions(user_id, date_accountability);",
            "CREATE INDEX IF NOT EXISTS idx_transactions_account_ids ON transactions(from_account_id, to_account_id);",
            
            # Investment transactions table - most important queries
            "CREATE INDEX IF NOT EXISTS idx_investment_transactions_user_id_date ON investment_transactions(user_id, date);",
            "CREATE INDEX IF NOT EXISTS idx_investment_transactions_user_asset ON investment_transactions(user_id, asset_symbol);",
            "CREATE INDEX IF NOT EXISTS idx_investment_transactions_account ON investment_transactions(account_id);",
        ]
        
        with self.connect_to_database() as connection:
            cursor = connection.cursor()
            try:
                # Create tables
                for table in tables:
                    cursor.execute(table)
                
                # Create views
                for view in views:
                    cursor.execute(view)
                
                # Create triggers
                for trigger in triggers:
                    print(trigger)
                    cursor.execute(trigger)
                
                # Create indexes
                for index in indexes:
                    cursor.execute(index)
                
                connection.commit()
                print("Tables, views, triggers and indexes created successfully")
            except Exception as e:
                print(f"Error creating tables, views, triggers or indexes: {e}")
                connection.rollback()
                raise
            finally:
                cursor.close()


    def update_user_login(self, user_id: int, current_password: str):
        """
        Update user's last login time via trigger.
        
        :param user_id: The ID of the user who is logging in
        :param current_password: The user's current password (for trigger condition)
        """
        self.execute_update(
            "UPDATE users SET password = ? WHERE id = ? AND password = ?",
            [current_password, user_id, current_password]
        )

if __name__ == "__main__":
    print("Creating tables, views, triggers and indexes")
    db = DatabaseManager()
    db.create_tables()
