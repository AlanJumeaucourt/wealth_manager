import os
import sqlite3
from typing import Optional, Union, List, Dict, Any
from enum import Enum

if __name__ != "__main__":
    from app.exceptions import QueryExecutionError, NoResultFoundError
else:
    from exceptions import QueryExecutionError, NoResultFoundError


class QueryType(Enum):
    SELECT = "select"
    INSERT = "insert"
    INSERT_RETURNING = "insert_returning"
    UPDATE = "update"
    UPDATE_RETURNING = "update_returning"
    DELETE = "delete"


class DatabaseManager:
    """Manages database connections and executes raw SQL queries."""

    def __init__(self):
        self.db_dir = os.environ.get(
            "SQLITE_DB_DIR",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "instance"),
        )
        self.db_name = os.path.join(self.db_dir, "wealth_manager.db")

        # Ensure directory exists with proper permissions
        os.makedirs(self.db_dir, exist_ok=True)

        # Set permissions if running as root (development only)
        if os.geteuid() == 0:  # Only run if root
            os.chmod(self.db_dir, 0o777)

    def connect_to_database(self):
        """
        Establish a connection to the SQLite database.

        :return: A connection object to the SQLite database.
        """
        try:
            connection = sqlite3.connect(self.db_name)
            # sqlite3.register_adapter(datetime, lambda dt: dt.isoformat())
            # sqlite3.register_converter(
            #     "timestamp", lambda s: datetime.fromisoformat(s.decode())
            # )
            connection.execute("PRAGMA foreign_keys = ON;")
            return connection
        except sqlite3.OperationalError as e:
            print(f"Error connecting to database: {e}")
            print(f"Database directory: {self.db_dir}")
            print(f"Database path: {self.db_name}")
            print(f"Directory exists: {os.path.exists(self.db_dir)}")
            print(f"Directory permissions: {oct(os.stat(self.db_dir).st_mode)[-3:]}")
            raise

    def execute_select(
        self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None
    ) -> List[Dict[str, Any]]:
        result = self.__execute_raw_sql(query, QueryType.SELECT, params)
        if not result:
            raise NoResultFoundError("No result found for select query", query, params)
        return result

    def execute_insert(
        self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None
    ) -> int:
        result = self.__execute_raw_sql(query, QueryType.INSERT, params)
        if not result:
            raise NoResultFoundError("No result found for insert query", query, params)
        return result

    def execute_insert_returning(
        self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None
    ) -> Dict[str, Any]:
        result = self.__execute_raw_sql(query, QueryType.INSERT_RETURNING, params)
        if not result:
            raise NoResultFoundError(
                "No result found for insert returning query", query, params
            )
        return result

    def execute_update(
        self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None
    ) -> int:
        result = self.__execute_raw_sql(query, QueryType.UPDATE, params)
        if not result:
            raise NoResultFoundError("No result found for update query", query, params)
        return result

    def execute_update_returning(
        self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None
    ) -> Dict[str, Any]:
        result = self.__execute_raw_sql(query, QueryType.UPDATE_RETURNING, params)
        if not result:
            raise NoResultFoundError(
                "No result found for update returning query", query, params
            )
        return result

    def execute_delete(
        self, query: str, params: Optional[Union[tuple[Any, ...], list[Any]]] = None
    ) -> bool:
        result = self.__execute_raw_sql(query, QueryType.DELETE, params)
        if not result:
            raise NoResultFoundError("No result found for delete query", query, params)
        return result

    def __execute_raw_sql(
        self,
        query: str,
        query_type: QueryType,
        params: Optional[Union[tuple[Any, ...], list[Any]]] = None,
    ) -> Any:
        """
        Execute a raw SQL query and return the results.

        :param query: The SQL query to execute.
        :param params: Optional parameters for the SQL query.
        :return: The results of the query, or the last row ID for insert operations.
        """
        with self.connect_to_database() as connection:
            connection.row_factory = sqlite3.Row
            cursor = connection.cursor()
            try:
                if params:
                    # Convert tuple to list if necessary
                    params_list = list(params) if isinstance(params, tuple) else params
                    cursor.execute(query, params_list)
                else:
                    cursor.execute(query)

                if query_type == QueryType.SELECT:
                    results = cursor.fetchall()
                    return [dict(row) for row in results]

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
                raise QueryExecutionError(
                    f"Error executing query: {err}", query, params
                )
            finally:
                cursor.close()

    def create_tables(self):
        """
        Create the necessary tables, views, triggers and indexes in the database if they do not exist.
        """
        tables = [
            """--sql
                CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        last_login TIMESTAMP);
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS banks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL CHECK (type IN ('investment', 'income', 'expense', 'checking', 'savings')),
                    bank_id INTEGER NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
                );
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    date TIMESTAMP NOT NULL,
                    date_accountability TIMESTAMP NOT NULL,
                    description TEXT NOT NULL,
                    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
                    from_account_id INTEGER NOT NULL,
                    to_account_id INTEGER NOT NULL,
                    category TEXT NOT NULL,
                    subcategory TEXT,
                    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE CASCADE
                );
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS assets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    symbol TEXT NOT NULL,
                    name TEXT NOT NULL,
                    UNIQUE(symbol, user_id)
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS investment_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    from_account_id INTEGER NOT NULL,
                    to_account_id INTEGER NOT NULL,
                    asset_id INTEGER NOT NULL,
                    activity_type TEXT NOT NULL CHECK (activity_type IN ('buy', 'sell', 'deposit', 'withdrawal')),
                    date TIMESTAMP NOT NULL,
                    quantity DECIMAL(10,6) NOT NULL,
                    unit_price DECIMAL(10,2) NOT NULL,
                    fee DECIMAL(10,2) NOT NULL,
                    tax DECIMAL(10,2) NOT NULL,
                    total_paid DECIMAL(10,2),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                    FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
                );
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS account_assets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    account_id INTEGER NOT NULL,
                    asset_id INTEGER NOT NULL,
                    quantity DECIMAL(10,6) NOT NULL,
                    UNIQUE(account_id, asset_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
                );
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS stock_cache (
                    symbol TEXT NOT NULL,
                    cache_type TEXT NOT NULL,
                    data TEXT NOT NULL,
                    last_updated TEXT NOT NULL,
                    PRIMARY KEY (symbol, cache_type)
                );
            """,
        ]

        views = [
            """--sql
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
                    COALESCE(SUM(ti.amount), 0) as current_balance
                FROM accounts a
                    LEFT JOIN transaction_impacts ti ON a.id = ti.account_id
                    GROUP BY a.id, a.user_id, a.name, a.type;
            """,
        ]

        triggers = [
            """--sql
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
            """--sql
                CREATE TRIGGER IF NOT EXISTS trg_calculate_total_paid_investment_transaction
                AFTER INSERT ON investment_transactions
                FOR EACH ROW
                BEGIN
                    UPDATE investment_transactions
                    SET total_paid = (NEW.quantity * NEW.unit_price) + NEW.fee + NEW.tax
                    WHERE id = NEW.id;
                END;
            """,
            """--sql
                CREATE TRIGGER IF NOT EXISTS trg_calculate_total_paid_investment_transaction_update
                AFTER UPDATE ON investment_transactions
                FOR EACH ROW
                BEGIN
                    UPDATE investment_transactions
                    SET total_paid = (NEW.quantity * NEW.unit_price) + NEW.fee + NEW.tax
                    WHERE id = NEW.id;
                END;
            """,
        ]

        indexes = [
            # Users table - email is used for login/authentication
            "CREATE INDEX IF NOT EXISTS idx_banks_user_id ON banks(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON accounts(user_id, type);",
            "CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);",
            "CREATE INDEX IF NOT EXISTS idx_transactions_user_date_acc ON transactions(user_id, date_accountability);",
            "CREATE INDEX IF NOT EXISTS idx_transactions_accounts ON transactions(from_account_id, to_account_id);",
            "CREATE INDEX IF NOT EXISTS idx_investment_transactions_user_date ON investment_transactions(user_id, date);",
            "CREATE INDEX IF NOT EXISTS idx_investment_transactions_user_asset ON investment_transactions(user_id, asset_id);",
        ]

        with self.connect_to_database() as connection:
            cursor = connection.cursor()
            try:
                # Create tables
                for table in tables:
                    self.execute_delete(table)

                # Create views
                for view in views:
                    self.execute_delete(view)

                # Create triggers
                for trigger in triggers:
                    self.execute_delete(trigger)

                # Create indexes
                for index in indexes:
                    self.execute_delete(index)

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
            [current_password, user_id, current_password],
        )


if __name__ == "__main__":
    print("Creating tables, views, triggers and indexes")
    db = DatabaseManager()
    db.create_tables()
