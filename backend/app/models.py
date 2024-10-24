from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

@dataclass
class User:
    """Represents a user in the system."""
    name: str
    email: str
    password: str
    last_login: Optional[datetime] = field(default=None)  # Made last_login optional
    id: Optional[int] = field(default=None)  # Added id field

@dataclass
class Bank:
    """Represents a bank associated with a user."""
    user_id: int
    name: str
    id: Optional[int] = field(default=None)  # Added id field

@dataclass
class Account:
    """Represents an account associated with a user."""
    user_id: int
    name: str
    type: str
    currency: str
    bank_id: int  # Corrected from bankId to bank_id for consistency
    tags: Optional[list[str]] = field(default_factory=list)  # Changed to list for consistency
    id: Optional[int] = field(default=None)  # Added id field

@dataclass
class Transaction:
    """Represents a transaction between accounts."""
    user_id: int
    date: datetime
    date_accountability: datetime  # Added field
    description: str
    amount: float
    from_account_id: int
    to_account_id: int
    type: str
    category: Optional[str] = field(default=None)
    subcategory: Optional[str] = field(default=None)
    related_transaction_id: Optional[int] = field(default=None)
    id: Optional[int] = field(default=None)

    def __post_init__(self):
        if self.type not in ['expense', 'income', 'transfer', 'refund']:
            raise ValueError("Invalid transaction type.")

@dataclass
class InvestmentTransaction:
    """Represents an investment transaction."""
    user_id: int
    account_id: int
    asset_symbol: str
    asset_name: str
    activity_type: str
    date: datetime
    quantity: float
    unit_price: float
    fee: float
    tax: float
    transaction_related_id: Optional[int] = field(default=None)
    id: Optional[int] = field(default=None)

    def __post_init__(self):
        if self.activity_type not in ['buy', 'sell', 'deposit', 'withdrawal']:
            raise ValueError("Invalid activity type.")
