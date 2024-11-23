import re
from datetime import datetime

from marshmallow import (
    Schema,
    ValidationError,
    fields,
    validate,
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
    """Custom field for date validation."""

    def _deserialize(self, value: str, attr: str, data: dict, **kwargs) -> str:
        if value is None:
            return None
        validate_date_format(value)
        return value

    def _serialize(self, value: str, attr: str, obj: dict, **kwargs) -> str:
        if value is None:
            return None
        # If it's already a string, just return it
        if isinstance(value, str):
            return value
        # If it's a datetime object, convert to ISO format
        if isinstance(value, datetime):
            return value.isoformat()
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
        validate=validate.OneOf(["buy", "sell", "deposit", "withdrawal"]),
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
