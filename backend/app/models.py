from dataclasses import dataclass, field
from datetime import date, datetime


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
        if self.activity_type not in [
            "buy",
            "sell",
            "dividend",
            "interest",
            "deposit",
            "withdrawal",
        ]:
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


@dataclass
class CustomPrice:
    """Data class for custom price entries."""

    id: int | None = None
    symbol: str = ""
    date: str = ""
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    close: float = 0.0
    volume: int = 0
    created_at: str | None = None
    updated_at: str | None = None
    user_id: int | None = None


@dataclass
class Liability:
    """Represents a liability (loan, debt, etc.)."""

    user_id: int
    name: str
    liability_type: str
    principal_amount: float
    interest_rate: float
    start_date: date
    compounding_period: str
    payment_frequency: str
    direction: str
    description: str | None = field(default=None)
    end_date: date | None = field(default=None)
    payment_amount: float | None = field(default=None)
    deferral_period_months: int = field(default=0)
    deferral_type: str = field(default="none")
    account_id: int | None = field(default=None)
    lender_name: str | None = field(default=None)
    created_at: datetime | None = field(default=None)
    updated_at: datetime | None = field(default=None)
    id: int | None = field(default=None)

    def __post_init__(self) -> None:
        valid_liability_types = [
            "standard_loan",
            "partial_deferred_loan",
            "total_deferred_loan",
            "mortgage",
            "credit_card",
            "line_of_credit",
            "other",
        ]
        if self.liability_type not in valid_liability_types:
            raise ValueError(
                f"Invalid liability type. Must be one of: {', '.join(valid_liability_types)}"
            )
        if self.compounding_period not in ["daily", "monthly", "quarterly", "annually"]:
            raise ValueError("Invalid compounding period.")
        if self.payment_frequency not in [
            "weekly",
            "bi-weekly",
            "monthly",
            "quarterly",
            "annually",
        ]:
            raise ValueError("Invalid payment frequency.")
        if self.deferral_type not in ["none", "partial", "total"]:
            raise ValueError("Invalid deferral type.")
        if self.direction not in ["i_owe", "they_owe"]:
            raise ValueError("Invalid direction.")


@dataclass
class LiabilityPaymentDetail:
    """Represents a payment for a liability."""

    transaction_id: int
    user_id: int
    liability_id: int
    payment_date: date
    amount: float
    principal_amount: float
    interest_amount: float
    extra_payment: float = field(default=0.0)
    created_at: datetime | None = field(default=None)
    updated_at: datetime | None = field(default=None)
