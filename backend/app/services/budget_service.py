from collections import defaultdict
from typing import Literal, TypedDict

from app.database import DatabaseManager
from app.exceptions import NoResultFoundError

db_manager = DatabaseManager()


class TransactionSummary(TypedDict):
    amount: float
    count: int


def get_budget_summary(start_date: str, end_date: str, user_id: int):
    query = """
    SELECT
        category,
        subcategory,
        SUM(amount) as amount,
        GROUP_CONCAT(id) as transactions_related
    FROM
        transactions
    WHERE
        date_accountability BETWEEN ? AND ? and user_id = ?
    GROUP BY
        category, subcategory
    """

    try:
        results = db_manager.execute_select(
            query=query, params=[start_date, end_date, user_id]
        )
    except NoResultFoundError:
        return []
    # Organize results by category and subcategory
    category_summary = defaultdict(
        lambda: {"amount": 0, "subcategories": defaultdict(dict)}
    )

    for row in results:
        category = row["category"]
        subcategory = row["subcategory"]
        amount = row["amount"]
        transactions_related = (
            row["transactions_related"].split(",")
            if row["transactions_related"]
            else []
        )

        if subcategory not in category_summary[category]["subcategories"]:
            category_summary[category]["subcategories"][subcategory] = {
                "amount": 0,
                "transactions_related": [],
            }

        category_summary[category]["subcategories"][subcategory]["amount"] += amount
        category_summary[category]["subcategories"][subcategory][
            "transactions_related"
        ].extend(transactions_related)

    # Convert to desired output format
    return [
        {
            "category": category,
            "amount": sum(sub["amount"] for sub in data["subcategories"].values()),
            "subcategories": [
                {
                    "subcategory": subcategory,
                    "amount": sub_data["amount"],
                    "transactions_related": sub_data["transactions_related"],
                }
                for subcategory, sub_data in data["subcategories"].items()
            ],
        }
        for category, data in category_summary.items()
    ]


def get_transactions_by_categories(
    start_date: str,
    end_date: str,
    user_id: int,
    transaction_type: Literal["income", "expense", "transfer"],
) -> dict[str, TransactionSummary]:
    db = DatabaseManager()

    query = """
    SELECT
        t.category,
        t.subcategory,
        SUM(t.amount) as total_amount,
        COUNT(*) as transaction_count,
        GROUP_CONCAT(json_object(
            'id', t.id,
            'date', t.date,
            'date_accountability', t.date_accountability,
            'description', t.description,
            'amount', t.amount,
            'from_account_id', t.from_account_id,
            'to_account_id', t.to_account_id,
            'category', t.category,
            'subcategory', t.subcategory
        )) as transactions_json
    FROM transactions t
    WHERE
        t.user_id = ?
        AND t.type = ?
        AND t.date_accountability BETWEEN ? AND ?
    GROUP BY t.category, t.subcategory
    ORDER BY t.category, t.subcategory
    """

    try:
        results = db.execute_select(
            query=query, params=[user_id, transaction_type, start_date, end_date]
        )
    except NoResultFoundError:
        return {}

    # Transform the results into the required format
    categorized_data = {}
    for row in results:
        category = row["category"]
        if category not in categorized_data:
            categorized_data[category] = {"amount": 0, "count": 0, "transactions": []}

        # Parse the transactions JSON string into a list
        transactions = eval("[" + row["transactions_json"] + "]")

        categorized_data[category]["amount"] += row["total_amount"]
        categorized_data[category]["count"] += row["transaction_count"]
        categorized_data[category]["transactions"].extend(transactions)

    return categorized_data
