def calculate_account_balance(account_id: int) -> float:
    """
    Calculate the balance of an account by summing up the amounts of all transactions associated with it.

    Args:
        account_id (int): The ID of the account for which to calculate the balance.

    Returns:
        float: The balance of the account.
    """
    # Query the database to get all transactions for the given account
    transactions = db_manager.execute_raw_sql(
        "SELECT amount FROM transactions WHERE account_id = ?",
        (account_id,),
    )

    # Sum the amounts of all transactions
    balance = sum(transaction["amount"] for transaction in transactions)

    return balance
