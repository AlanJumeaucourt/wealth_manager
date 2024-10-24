from marshmallow import Schema, fields, pre_dump, validate, pre_load, post_dump, post_load
from datetime import datetime
class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=6))
    last_login = fields.DateTime(dump_only=True)

class BankSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    name = fields.Str(required=True)

class AccountSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))
    type = fields.Str(required=True, validate=validate.OneOf(['asset', 'investment', 'income', 'expense', 'checking', 'savings']))
    bank_id = fields.Int(required=True)
    currency = fields.Str(required=True, validate=validate.Length(equal=3))
    tags = fields.List(fields.Str())
    balance = fields.Float(dump_only=True)  # Add this line

    @pre_load
    def process_tags(self, data, **kwargs):
        if 'tags' in data and isinstance(data['tags'], str):
            data['tags'] = [tag.strip() for tag in data['tags'].split(',') if tag.strip()]
        return data

    @post_dump
    def join_tags(self, data, **kwargs):
        if 'tags' in data and isinstance(data['tags'], list):
            data['tags'] = ','.join(data['tags'])
        return data

class TransactionSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    date = fields.Str(required=True)
    date_accountability = fields.Str(required=True)  # Added field
    description = fields.Str(required=True)
    amount = fields.Float(required=True)
    from_account_id = fields.Int(required=True)
    to_account_id = fields.Int(required=True)
    category = fields.Str(allow_none=True, required=False)
    subcategory = fields.Str(allow_none=True, required=False)
    related_transaction_id = fields.Int(allow_none=True)
    type = fields.Str(required=True, validate=validate.OneOf(['expense', 'income', 'transfer']))

class InvestmentTransactionSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(required=True)
    account_id = fields.Int(required=True)
    asset_symbol = fields.Str(required=True)
    asset_name = fields.Str(required=True)
    activity_type = fields.Str(required=True, validate=validate.OneOf(['buy', 'sell', 'deposit', 'withdrawal']))
    date = fields.DateTime(required=True)
    quantity = fields.Float(required=True)
    unit_price = fields.Float(required=True)
    fee = fields.Float(required=True)
    tax = fields.Float(required=True)
    transaction_related_id = fields.Int(allow_none=True)
