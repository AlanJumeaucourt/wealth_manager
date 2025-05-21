import re
from datetime import date, datetime

from marshmallow import (
    Schema,
    ValidationError,
    fields,
    validate,
    validates_schema,
)


def validate_date_format(date_str: str) -> bool:
    """Validate that the date string matches accepted formats.

    - 'YYYY-MM-DDThh:mm:ss'
    - 'YYYY-MM-DDThh:mm:ss.mmmmmm' (isoformat with microseconds)
    - 'YYYY-MM-DD'
    - 'YYYY-MM-DDThh:mm:ssZ' (with UTC timezone)
    - 'YYYY-MM-DDThh:mm:ss+HH:MM' (with timezone offset)
    """
    if not date_str:
        raise ValidationError("Date string cannot be empty")

    try:
        # First try to parse with isoformat (handles microseconds and timezones)
        try:
            parsed_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return True
        except ValueError:
            # If isoformat fails, try our specific formats
            full_datetime_pattern = r"^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$"
            date_only_pattern = r"^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$"

            if re.match(full_datetime_pattern, date_str):
                datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S")
                return True
            if re.match(date_only_pattern, date_str):
                datetime.strptime(date_str, "%Y-%m-%d")
                return True
            raise ValidationError(
                "Date must be in format 'YYYY-MM-DD' or 'YYYY-MM-DDThh:mm:ss'"
            )

    except ValueError as e:
        raise ValidationError(f"Invalid date values: {e!s}")
    except Exception as e:
        raise ValidationError(f"Invalid date format: {e!s}")


class DateField(fields.Str):
    """Custom field for date validation and serialization.

    This field handles dates as strings in ISO format (YYYY-MM-DD).
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.format_func = self._format_date

    def _format_date(self, value):
        """Format the value as a date string."""
        if value is None:
            return None

        # If it's already a string in YYYY-MM-DD format, return it
        if isinstance(value, str):
            # For consistency, ensure it's in YYYY-MM-DD format
            if "T" in value:
                # If it has a time component, strip it
                value = value.split("T")[0]
            if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
                return value

        # If it's a date object, convert to ISO format string
        if isinstance(value, date):
            return value.isoformat()

        # If it's a datetime object, convert to date then ISO format string
        if isinstance(value, datetime):
            return value.date().isoformat()

        # For any other type, try to convert to string
        try:
            str_value = str(value)
            if re.match(r"^\d{4}-\d{2}-\d{2}$", str_value):
                return str_value
            # Try to parse as date
            parsed_date = datetime.strptime(str_value, "%Y-%m-%d").date()
            return parsed_date.isoformat()
        except (ValueError, TypeError):
            return str_value

    def _deserialize(self, value, attr, data, **kwargs):
        """Deserialize a value to a date string."""
        if value is None:
            return None

        # If it's a string, validate it
        if isinstance(value, str):
            # For consistency, ensure it's in YYYY-MM-DD format
            if "T" in value:
                # If it has a time component, strip it
                value = value.split("T")[0]

            # Simple validation for YYYY-MM-DD format
            if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
                return value

            # If it doesn't match the expected format, try to validate it
            try:
                validate_date_format(value)
                return value
            except ValidationError as e:
                raise ValidationError(f"Invalid date format: {value}") from e

        # If it's a date object, convert to ISO format string
        if isinstance(value, date):
            return value.isoformat()

        # If it's a datetime object, convert to ISO format string (date part only)
        if isinstance(value, datetime):
            return value.date().isoformat()

        # For any other type, try to convert to string
        try:
            str_value = str(value)
            validate_date_format(str_value)
            return str_value
        except ValidationError as e:
            raise ValidationError(f"Cannot convert to date: {value}") from e

    def _serialize(self, value, attr, obj, **kwargs):
        """Serialize a value to a date string."""
        if value is None:
            return None
        # If it's already a string, return it (assuming it's valid)
        if isinstance(value, str):
            # For consistency, ensure it's in YYYY-MM-DD format
            if "T" in value:
                # If it has a time component, strip it
                value = value.split("T")[0]

            # Simple validation for YYYY-MM-DD format
            if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
                return value

            # If it's not a valid date string, try to convert it
            try:
                # Try to parse it as a date
                parsed_date = datetime.strptime(value, "%Y-%m-%d").date()
                return parsed_date.isoformat()
            except ValueError:
                # If all else fails, just return the string
                return value

        # If it's a date object, convert to ISO format string
        if isinstance(value, date):
            return value.isoformat()

        # If it's a datetime object, convert to ISO format string (date part only)
        if isinstance(value, datetime):
            return value.date().isoformat()

        # For any other type, convert to string
        return str(value)


class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=6))
    last_login = fields.DateTime(dump_only=True)


class BankSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))
    website = fields.Str(allow_none=True, required=False)


class AccountSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))
    type = fields.Str(
        required=True,
        validate=validate.OneOf(
            [
                "asset",
                "investment",
                "income",
                "expense",
                "checking",
                "savings",
                "loan",
            ]
        ),
    )
    bank_id = fields.Int(required=True)
    balance = fields.Float(dump_only=True)  # Add this line


class TransactionSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    date = DateField(required=True)
    date_accountability = DateField(required=True)
    description = fields.Str(required=True, validate=validate.Length(min=1))
    amount = fields.Float(
        required=True, validate=validate.Range(min=0, min_inclusive=False)
    )
    from_account_id = fields.Int(required=True)
    to_account_id = fields.Int(required=True)
    category = fields.Str(required=True, validate=validate.Length(min=1))
    subcategory = fields.Str(allow_none=True, required=False)
    type = fields.Str(
        required=True,
        validate=validate.OneOf(["expense", "income", "transfer"]),
    )


class AssetSchema(Schema):
    user_id = fields.Int(required=True)
    id = fields.Int(dump_only=True)
    symbol = fields.Str(required=True, validate=validate.Length(min=1))
    name = fields.Str(required=True, validate=validate.Length(min=1))


class InvestmentTransactionSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    from_account_id = fields.Int(required=True)
    to_account_id = fields.Int(required=True)
    asset_id = fields.Int(required=True)
    activity_type = fields.Str(
        required=True,
        validate=validate.OneOf(
            ["Buy", "Sell", "Dividend", "Interest", "Deposit", "Withdrawal"]
        ),
    )
    date = DateField(required=True)
    quantity = fields.Float(required=True)
    unit_price = fields.Float(required=True)
    fee = fields.Float(required=True)
    tax = fields.Float(required=True)
    total_paid = fields.Float(required=True, dump_only=True)


class AccountAssetSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    account_id = fields.Int(required=True)
    asset_id = fields.Int(required=True)
    quantity = fields.Float(required=True)


class RefundGroupSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))
    description = fields.Str(allow_none=True, required=False)


class RefundItemSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    income_transaction_id = fields.Int(required=True)
    expense_transaction_id = fields.Int(required=True)
    amount = fields.Float(
        required=True, validate=validate.Range(min=0, min_inclusive=False)
    )
    refund_group_id = fields.Int(allow_none=True, required=False)
    description = fields.Str(allow_none=True, required=False)

    @validates_schema
    def validate_transactions(self, data, **kwargs):
        """Validate that income and expense transaction IDs are different."""
        if data.get("income_transaction_id") == data.get("expense_transaction_id"):
            raise ValidationError(
                "Income and expense transaction IDs must be different"
            )


class LiabilitySchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))
    description = fields.Str(allow_none=True, required=False)
    liability_type = fields.Str(
        required=True,
        validate=validate.OneOf(
            [
                "standard_loan",
                "partial_deferred_loan",
                "total_deferred_loan",
                "mortgage",
                "credit_card",
                "line_of_credit",
                "other",
            ]
        ),
    )
    principal_amount = fields.Float(
        required=True, validate=validate.Range(min=0, min_inclusive=True)
    )
    interest_rate = fields.Float(
        required=True, validate=validate.Range(min=0, min_inclusive=True)
    )
    start_date = DateField(required=True)
    end_date = DateField(allow_none=True, required=False)
    compounding_period = fields.Str(
        required=True,
        validate=validate.OneOf(["daily", "monthly", "quarterly", "annually"]),
    )
    payment_frequency = fields.Str(
        required=True,
        validate=validate.OneOf(
            ["weekly", "bi-weekly", "monthly", "quarterly", "annually"]
        ),
    )
    payment_amount = fields.Float(allow_none=True, required=False)
    deferral_period_months = fields.Int(required=False, default=0)
    deferral_type = fields.Str(
        required=False,
        default="none",
        validate=validate.OneOf(["none", "partial", "total"]),
    )
    direction = fields.Str(
        required=True,
        validate=validate.OneOf(["i_owe", "they_owe"]),
    )
    account_id = fields.Int(allow_none=True, required=False)
    lender_name = fields.Str(allow_none=True, required=False)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    # Calculated fields from the view
    principal_paid = fields.Float(dump_only=True)
    interest_paid = fields.Float(dump_only=True)
    remaining_balance = fields.Float(dump_only=True)
    missed_payments_count = fields.Int(dump_only=True)
    next_payment_date = DateField(dump_only=True)


class LiabilityPaymentSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    liability_id = fields.Int(required=True)
    payment_date = DateField(required=True)
    amount = fields.Float(
        required=True, validate=validate.Range(min=0, min_inclusive=True)
    )
    principal_amount = fields.Float(
        required=True, validate=validate.Range(min=0, min_inclusive=True)
    )
    interest_amount = fields.Float(
        required=True, validate=validate.Range(min=0, min_inclusive=True)
    )
    extra_payment = fields.Float(
        required=False, default=0.0, validate=validate.Range(min=0, min_inclusive=True)
    )
    transaction_id = fields.Int(allow_none=True, required=False)
    status = fields.Str(
        required=True,
        validate=validate.OneOf(["scheduled", "paid", "missed", "partial"]),
    )
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

    @validates_schema
    def validate_payment_amounts(self, data, **kwargs):
        """Validate that principal + interest = amount."""
        principal = data.get("principal_amount", 0)
        interest = data.get("interest_amount", 0)
        amount = data.get("amount", 0)
        extra = data.get("extra_payment", 0)

        if (
            abs((principal + interest + extra) - amount) > 0.01
        ):  # Allow for small floating point differences
            raise ValidationError(
                "Amount must equal principal + interest + extra payment"
            )
