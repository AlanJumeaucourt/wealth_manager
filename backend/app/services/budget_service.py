from collections import defaultdict

from app.database import DatabaseManager
from app.exceptions import NoResultFoundError

db_manager = DatabaseManager()


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
        results = db_manager.execute_select(query, (start_date, end_date, user_id))
    except NoResultFoundError:
        return []
    # Organize results by category and subcategory
    category_summary = defaultdict(lambda: {"amount": 0, "subcategories": {}})

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
    summary = [
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

    return summary
