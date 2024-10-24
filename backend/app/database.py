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
        # connection.execute("PRAGMA foreign_keys = ON;")
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
        Create the necessary tables, views and indexes in the database if they do not exist.
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
                        FOREIGN KEY (user_id) REFERENCES users(id));
                    """,
            """CREATE TABLE IF NOT EXISTS accounts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT, 
                        user_id INTEGER NOT NULL,
                        name TEXT NOT NULL, 
                        type TEXT CHECK(type IN ('investment', 'income', 'expense', 'checking', 'savings')) NOT NULL, 
                        bank_id INTEGER NOT NULL,
                        currency TEXT NOT NULL, 
                        tags TEXT,
                        FOREIGN KEY (user_id) REFERENCES users(id),
                        FOREIGN KEY (bank_id) REFERENCES banks(id));
                    """,
            """CREATE TABLE IF NOT EXISTS transactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT, 
                        user_id INTEGER NOT NULL,
                        date TIMESTAMP NOT NULL,
                        date_accountability TIMESTAMP NOT NULL,  # Added field
                        description TEXT NOT NULL,
                        amount DECIMAL(10, 2) NOT NULL,
                        from_account_id INTEGER NOT NULL,
                        to_account_id INTEGER NOT NULL,
                        category TEXT,
                        subcategory TEXT,
                        related_transaction_id INTEGER,
                        type TEXT CHECK(type IN ('expense', 'income', 'transfer')) NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users(id),
                        FOREIGN KEY (from_account_id) REFERENCES accounts(id),
                        FOREIGN KEY (to_account_id) REFERENCES accounts(id));
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
                        FOREIGN KEY (user_id) REFERENCES users(id),
                        FOREIGN KEY (account_id) REFERENCES accounts(id),
                        FOREIGN KEY (transaction_related_id) REFERENCES investment_transactions(id)
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
            "CREATE INDEX IF NOT EXISTS idx_investment_transactions_account ON investment_transactions(account_id);"
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
                
                # Create indexes
                for index in indexes:
                    cursor.execute(index)
                
                connection.commit()
            except Exception as e:
                print(f"Error creating tables, views or indexes: {e}")
                connection.rollback()
                raise
            finally:
                cursor.close()

    def delete_all_data_from_user(self, user_id: int):
        """
        Delete all data associated with a specific user.

        :param user_id: The ID of the user whose data should be deleted.
        """
        self.execute_delete("DELETE FROM investment_transactions WHERE user_id = ?", [user_id])
        self.execute_delete("DELETE FROM transactions WHERE user_id = ?", [user_id])
        self.execute_delete("DELETE FROM accounts WHERE user_id = ?", [user_id])
        self.execute_delete("DELETE FROM banks WHERE user_id = ?", [user_id])
        self.execute_delete("DELETE FROM users WHERE id = ?", [user_id])

if __name__ == "__main__":
    db = DatabaseManager()
    db.create_tables()
