import os
import sqlite3
from enum import Enum
from pathlib import Path
from typing import Any

from .exceptions import NoResultFoundError, QueryExecutionError


class DatabaseError(Exception):
    """Raised when there are database configuration or access issues."""


class QueryType(Enum):
    SELECT = "select"
    INSERT = "insert"
    INSERT_RETURNING = "insert_returning"
    UPDATE = "update"
    UPDATE_RETURNING = "update_returning"
    DELETE = "delete"


class DatabaseManager:
    """Manages database connections and executes raw SQL queries."""

    def __init__(self) -> None:
        db_path = os.environ.get("SQLITE_DB_PATH")
        if not db_path:
            raise DatabaseError("SQLITE_DB_PATH environment variable must be set")

        self.db_path = Path(db_path)

        # Validate the path
        if not self.db_path.parent.exists():
            raise DatabaseError(
                f"Database directory does not exist: {self.db_path.parent}"
            )

        if not os.access(self.db_path.parent, os.W_OK):
            raise DatabaseError(
                f"No write permission in directory: {self.db_path.parent}"
            )

        # If database file exists, check if it's writable
        if self.db_path.exists() and not os.access(self.db_path, os.W_OK):
            raise DatabaseError(
                f"No write permission for database file: {self.db_path}"
            )

    def connect_to_database(self) -> sqlite3.Connection:
        """Establish a connection to the SQLite database.

        :return: A connection object to the SQLite database.
        :raises: DatabaseError if connection fails
        """
        try:
            connection = sqlite3.connect(self.db_path)
            connection.execute("PRAGMA foreign_keys = ON;")
        except sqlite3.OperationalError as e:
            error_msg = (
                f"Error connecting to database: {e}\n"
                f"Database directory: {self.db_path.parent}\n"
                f"Database path: {self.db_path}\n"
                f"Directory exists: {self.db_path.parent.exists()}\n"
                f"Directory permissions: {oct(self.db_path.parent.stat().st_mode)[-3:]}"
            )
            raise DatabaseError(error_msg) from e
        else:
            return connection

    def execute_select(
        self, query: str, params: list[Any] | None = None
    ) -> list[dict[str, Any]]:
        result = self.__execute_raw_sql(
            query=query, query_type=QueryType.SELECT, params=params
        )
        if not result:
            raise NoResultFoundError(
                message="No result found for select query",
                query=query,
                params=params or [],
            )
        return result

    def execute_insert(self, query: str, params: list[Any] | None = None) -> int:
        result = self.__execute_raw_sql(
            query=query, query_type=QueryType.INSERT, params=params or []
        )
        if not result:
            raise NoResultFoundError(
                message="No result found for insert query",
                query=query,
                params=params or [],
            )
        return result

    def execute_insert_returning(
        self, query: str, params: list[Any] | None = None
    ) -> dict[str, Any]:
        result = self.__execute_raw_sql(
            query=query, query_type=QueryType.INSERT_RETURNING, params=params
        )
        if not result:
            raise NoResultFoundError(
                message="No result found for insert returning query",
                query=query,
                params=params or [],
            )
        return result

    def execute_update(self, query: str, params: list[Any] | None = None) -> int:
        result = self.__execute_raw_sql(
            query=query, query_type=QueryType.UPDATE, params=params or []
        )
        if not result:
            raise NoResultFoundError(
                message="No result found for update query",
                query=query,
                params=params or [],
            )
        return result

    def execute_update_returning(
        self, query: str, params: list[Any] | None = None
    ) -> dict[str, Any]:
        result = self.__execute_raw_sql(
            query=query, query_type=QueryType.UPDATE_RETURNING, params=params
        )
        if not result:
            raise NoResultFoundError(
                message="No result found for update returning query",
                query=query,
                params=params or [],
            )
        return result

    def execute_delete(self, query: str, params: list[Any] | None = None) -> bool:
        result = self.__execute_raw_sql(
            query=query, query_type=QueryType.DELETE, params=params or []
        )
        if not result:
            raise NoResultFoundError(
                message="No result found for delete query",
                query=query,
                params=params or [],
            )
        return result

    def __execute_raw_sql(
        self,
        query: str,
        query_type: QueryType,
        params: list[Any] | None = None,
    ) -> Any:
        """Execute a raw SQL query and return the results.

        :param query: The SQL query to execute.
        :param query_type: The type of query to execute.
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

                if query_type == QueryType.INSERT:
                    connection.commit()
                    return cursor.lastrowid

                if query_type == QueryType.INSERT_RETURNING:
                    result = cursor.fetchall()
                    connection.commit()
                    return dict(result[0])

                if query_type == QueryType.UPDATE:
                    connection.commit()
                    return cursor.lastrowid

                if query_type == QueryType.UPDATE_RETURNING:
                    result = cursor.fetchall()
                    connection.commit()
                    return dict(result[0])

                if query_type == QueryType.DELETE:
                    connection.commit()
                    return True

            except Exception as err:
                raise QueryExecutionError(
                    message=f"Error executing query: {err}",
                    query=query,
                    params=params or [],
                ) from err
            finally:
                cursor.close()

    def create_tables(self) -> None:
        """Create the necessary tables, views, triggers and indexes in the database if they do not exist."""
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
                    website TEXT,
                    UNIQUE(user_id, name),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL CHECK (type IN (
                        'investment', 'income', 'expense', 'checking', 'savings'
                    )),
                    bank_id INTEGER NOT NULL,
                    UNIQUE(user_id, bank_id, name, type),
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
                    type TEXT NOT NULL CHECK (type IN (
                        'expense', 'income', 'transfer'
                    )),
                    is_investment BOOLEAN DEFAULT FALSE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                    FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE CASCADE
                );
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS investment_details (
                    transaction_id INTEGER PRIMARY KEY,
                    asset_id INTEGER NOT NULL,
                    quantity DECIMAL(10,6) NOT NULL,
                    unit_price DECIMAL(10,2) NOT NULL,
                    fee DECIMAL(10,2) NOT NULL,
                    tax DECIMAL(10,2) NOT NULL,
                    total_paid DECIMAL(10,2),
                    investment_type TEXT NOT NULL CHECK (investment_type IN (
                        'Buy', 'Sell', 'Dividend', 'Interest', 'Deposit', 'Withdrawal'
                    )),
                    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
                    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
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
                CREATE TABLE IF NOT EXISTS stock_cache (
                    symbol TEXT NOT NULL,
                    cache_type TEXT NOT NULL,
                    data TEXT NOT NULL,
                    last_updated TEXT NOT NULL,
                    PRIMARY KEY (symbol, cache_type)
                );
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS refund_groups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS refund_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    income_transaction_id INTEGER NOT NULL,
                    expense_transaction_id INTEGER NOT NULL,
                    amount REAL NOT NULL,
                    refund_group_id INTEGER,
                    description TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (income_transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
                    FOREIGN KEY (expense_transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
                    FOREIGN KEY (refund_group_id) REFERENCES refund_groups (id) ON DELETE CASCADE
                )
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS gocardless_requisitions (
                    requisition_id TEXT PRIMARY KEY,
                    link TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    institution_id TEXT NOT NULL,
                    reference TEXT,
                    agreement_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (agreement_id) REFERENCES gocardless_agreements (agreement_id) ON DELETE SET NULL
                )
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS gocardless_accounts (
                    account_id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    last_accessed TEXT NOT NULL,
                    iban TEXT,
                    institution_id TEXT NOT NULL,
                    status TEXT,
                    owner_name TEXT,
                    currency TEXT,
                    balance REAL,
                    account_type TEXT,
                    user_id INTEGER NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS gocardless_cache (
                    cache_key TEXT NOT NULL,
                    cache_type TEXT NOT NULL,
                    data TEXT NOT NULL,
                    last_updated TEXT NOT NULL,
                    PRIMARY KEY (cache_key, cache_type)
                )
            """,
            """--sql
                CREATE TABLE IF NOT EXISTS gocardless_agreements (
                    agreement_id TEXT PRIMARY KEY,
                    institution_id TEXT NOT NULL,
                    max_historical_days INTEGER NOT NULL,
                    access_valid_for_days INTEGER NOT NULL,
                    access_scope TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """,
        ]

        views = [
            """--sql
                CREATE VIEW IF NOT EXISTS account_balances AS
                SELECT
                    a.id as account_id,
                    a.user_id,
                    a.name as account_name,
                    a.type as account_type,
                    COALESCE(
                        (SELECT SUM(
                            CASE
                                WHEN from_account_id = a.id THEN -amount
                                WHEN to_account_id = a.id THEN amount
                            END
                        )
                        FROM transactions
                        WHERE from_account_id = a.id OR to_account_id = a.id
                        ), 0
                    ) as current_balance
                FROM accounts a
                GROUP BY a.id, a.user_id, a.name, a.type;
            """,
            """--sql
                CREATE VIEW IF NOT EXISTS asset_balances AS
                SELECT
                    t.user_id,
                    i.asset_id,
                    a.symbol,
                    a.name as asset_name,
                    SUM(
                        CASE
                            WHEN i.investment_type IN ('Buy', 'Deposit') THEN i.quantity
                            WHEN i.investment_type IN ('Sell', 'Withdrawal') THEN -i.quantity
                            ELSE 0
                        END
                    ) as quantity,
                    MAX(t.date) as last_transaction_date
                FROM investment_details i
                JOIN transactions t ON i.transaction_id = t.id
                JOIN assets a ON i.asset_id = a.id
                GROUP BY t.user_id, i.asset_id, a.symbol, a.name
                HAVING quantity > 0;
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
                            (SELECT to_type FROM account_types) NOT IN (
                                'checking', 'savings', 'investment'
                            )
                        ) THEN
                            RAISE(ABORT, 'Income cannot be received in this type of account')
                        WHEN NEW.type = 'income' AND (
                            (SELECT from_type FROM account_types) != 'income'
                        ) THEN
                            RAISE(ABORT, 'Income must originate from an income account')

                        -- Validate expense transactions
                        WHEN NEW.type = 'expense' AND (
                            (SELECT from_type FROM account_types) NOT IN (
                                'checking', 'savings', 'investment'
                            )
                        ) THEN
                            RAISE(ABORT, 'Expenses cannot be paid from this type of account')
                        WHEN NEW.type = 'expense' AND (
                            (SELECT to_type FROM account_types) != 'expense'
                        ) THEN
                            RAISE(ABORT, 'Expenses must go to an expense account')

                        -- Validate transfer transactions
                        WHEN NEW.type = 'transfer' AND (
                            (SELECT from_type FROM account_types) NOT IN (
                                'checking', 'savings', 'investment'
                            )
                        ) THEN
                            RAISE(ABORT, 'Cannot transfer from this type of account')
                        WHEN NEW.type = 'transfer' AND (
                            (SELECT to_type FROM account_types) NOT IN (
                                'checking', 'savings', 'investment'
                            )
                        ) THEN
                            RAISE(ABORT, 'Cannot transfer to this type of account')
                    END;
            END;

            """,
            """--sql
                CREATE TRIGGER IF NOT EXISTS trg_validate_account_bank_ownership_insert
                BEFORE INSERT ON accounts
                BEGIN
                    SELECT CASE
                        WHEN (
                            SELECT user_id
                            FROM banks
                            WHERE id = NEW.bank_id
                        ) != NEW.user_id
                        THEN RAISE(ABORT, 'Cannot insert account with bank owned by different user')
                    END;
                END;
            """,
            """--sql
                CREATE TRIGGER IF NOT EXISTS trg_validate_account_bank_ownership_update
                BEFORE UPDATE ON accounts
                WHEN NEW.bank_id != OLD.bank_id
                BEGIN
                    SELECT CASE
                        WHEN (
                            SELECT user_id
                            FROM banks
                            WHERE id = NEW.bank_id
                        ) != NEW.user_id
                        THEN RAISE(ABORT, 'Cannot update account to use bank owned by different user')
                    END;
                END;
            """,
            """--sql
                CREATE TRIGGER IF NOT EXISTS trg_validate_transaction_account_ownership_insert
                BEFORE INSERT ON transactions
                BEGIN
                    SELECT CASE
                        WHEN (
                            SELECT user_id
                            FROM accounts
                            WHERE id = NEW.from_account_id
                        ) != NEW.user_id OR
                        (
                            SELECT user_id
                            FROM accounts
                            WHERE id = NEW.to_account_id
                        ) != NEW.user_id
                        THEN RAISE(ABORT, 'Cannot insert transaction with accounts owned by different user')
                    END;
                END;
            """,
            """--sql
                CREATE TRIGGER IF NOT EXISTS trg_validate_transaction_account_ownership_update
                BEFORE UPDATE ON transactions
                WHEN NEW.from_account_id != OLD.from_account_id OR NEW.to_account_id != OLD.to_account_id
                BEGIN
                    SELECT CASE
                        WHEN (
                            SELECT user_id
                            FROM accounts
                            WHERE id = NEW.from_account_id
                        ) != NEW.user_id OR
                        (
                            SELECT user_id
                            FROM accounts
                            WHERE id = NEW.to_account_id
                        ) != NEW.user_id
                        THEN RAISE(ABORT, 'Cannot update transaction to use accounts owned by different user')
                    END;
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
            "CREATE INDEX IF NOT EXISTS idx_gocardless_requisitions_user ON gocardless_requisitions(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_gocardless_accounts_user ON gocardless_accounts(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_gocardless_accounts_institution ON gocardless_accounts(institution_id);",
            "CREATE INDEX IF NOT EXISTS idx_gocardless_agreements_user ON gocardless_agreements(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_gocardless_agreements_institution ON gocardless_agreements(institution_id);",
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

    def update_user_login(self, user_id: int, current_password: str) -> None:
        """Update user's last login time via trigger.

        :param user_id: The ID of the user who is logging in
        :param current_password: The user's current password (for trigger condition)
        """
        self.execute_update(
            query="UPDATE users SET password = ? WHERE id = ? AND password = ?",
            params=[current_password, user_id, current_password],
        )


if __name__ == "__main__":
    print("Creating tables, views, triggers and indexes")
    db = DatabaseManager()
    db.create_tables()
