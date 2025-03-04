from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class User:
    """Represents a user in the system."""

    name: str
    email: str
    password: str
    last_login: datetime | None = field(default=None)  # Made last_login optional
    id: int | None = field(default=None)  # Added id field


@dataclass
class Bank:
    """Represents a bank associated with a user."""

    user_id: int
    name: str
    website: str | None = field(default=None)
    id: int | None = field(default=None)  # Added id field


@dataclass
class Account:
    """Represents an account associated with a user."""

    user_id: int
    name: str
    type: str
    bank_id: int  # Corrected from bankId to bank_id for consistency
    id: int | None = field(default=None)  # Added id field


@dataclass
class Transaction:
    """Represents a transaction between accounts."""

    user_id: int
    date: datetime
    date_accountability: datetime
    description: str
    amount: float
    from_account_id: int
    to_account_id: int
    type: str
    category: str
    subcategory: str | None = field(default=None)
    is_investment: bool = field(default=False)
    id: int | None = field(default=None)

    def __post_init__(self) -> None:
        if self.type not in ["expense", "income", "transfer"]:
            raise ValueError("Invalid transaction type.")


@dataclass
class Asset:
    """Represents an asset."""

    user_id: int
    symbol: str
    name: str
    id: int | None = field(default=None)


@dataclass
class InvestmentTransaction:
    """Represents an investment transaction."""

    user_id: int
    from_account_id: int
    to_account_id: int
    asset_id: int
    activity_type: str
    date: datetime
    quantity: float
    unit_price: float
    fee: float
    tax: float
    total_paid: float | None = field(default=None)
    id: int | None = field(default=None)

    def __post_init__(self) -> None:
        if self.activity_type not in ["buy", "sell", "deposit", "withdrawal"]:
            raise ValueError("Invalid activity type.")


@dataclass
class AccountAsset:
    """Represents an asset associated with an account."""

    user_id: int
    account_id: int
    asset_id: int
    quantity: float
    id: int | None = field(default=None)


@dataclass
class RefundGroup:
    """Represents a group of related refunds."""

    user_id: int
    name: str
    description: str | None = field(default=None)
    id: int | None = field(default=None)


@dataclass
class RefundItem:
    """Represents a refund linking an income transaction to an expense transaction."""

    user_id: int
    income_transaction_id: int
    expense_transaction_id: int
    amount: float
    refund_group_id: int | None = field(default=None)
    description: str | None = field(default=None)
    id: int | None = field(default=None)
