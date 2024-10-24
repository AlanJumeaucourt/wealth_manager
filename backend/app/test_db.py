import sqlite3
from typing import Optional, Any

# Connect to the database
conn = sqlite3.connect('wealthmanager.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

def execute_sql(query: str, params: Optional[Any] = None):
    connection = sqlite3.connect('wealthmanager.db')
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()
    try:
        if params:
            print(f"Executing query: {query}")
            print(f"With params: {params}")
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        return cursor.fetchall()
    except Exception as err:
        print(f"Error: {err}")
        print(f"Query: {query}")
        print(f"Params: {params}")
        raise
    finally:
        cursor.close()
        
user_id = 1
query = """SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment')"""

balance_query = f"""
WITH RECURSIVE date_range AS (
-- Start the recursion with the minimum transaction date
SELECT MIN(date) AS date
FROM transactions
WHERE user_id = ?

UNION ALL

-- Recursively generate the next date by adding 1 day
SELECT date(date, '+1 day')
FROM date_range
WHERE date < (SELECT MAX(date) FROM transactions WHERE user_id = ?)
)
SELECT 
    dr.date, 
    COALESCE(SUM(CASE
        WHEN t.type = 'income' AND t.to_account_id IN ({query}) THEN t.amount
        WHEN t.type = 'expense' AND t.from_account_id IN ({query}) THEN -t.amount
        ELSE 0 
    END), 0) AS daily_balance,
    COALESCE(SUM(SUM(CASE 
        WHEN t.type = 'income' AND t.to_account_id IN ({query}) THEN t.amount
        WHEN t.type = 'expense' AND t.from_account_id IN ({query}) THEN -t.amount
        ELSE 0 
    END)) OVER (ORDER BY dr.date), 0) AS cumulative_balance
FROM date_range dr
LEFT JOIN transactions t 
    ON dr.date = t.date AND t.user_id = ?
GROUP BY dr.date
ORDER BY dr.date;
"""
# params = [str(user_id)] * 7

# print(f"Executing balance query: {balance_query}")
# print(f"With params: {params}")

# Execute the query
# results = execute_sql(balance_query, params)

# Fetch the results
# results = cursor.fetchall()

# Check the results
# [print(dict(row)) for row in results]


query = """SELECT * FROM transactions"""

# Execute the query
results = execute_sql(query)

# Fetch the results
results = cursor.fetchall()

print(results)

# Close the connection
conn.close()