import json
import logging
import os
from datetime import datetime
from typing import Any, TypedDict, cast

from nordigen.nordigen import NordigenClient  # type: ignore[reportMissingTypeStubs]

from app.database import DatabaseManager

logger = logging.getLogger(__name__)


class Institution(TypedDict):
    """GoCardless institution."""

    id: str
    name: str
    logo: str
    countries: list[str]
    bic: str | None
    transaction_total_days: str | None
    max_access_valid_for_days: str | None


class Requisition(TypedDict):
    """GoCardless requisition."""

    id: str
    created: str
    status: str
    institution_id: str
    link: str
    reference: str
    accounts: list[str]
    redirect: str


class Account(TypedDict):
    id: str
    created: str
    last_accessed: str
    iban: str
    institution_id: str
    status: str
    owner_name: str
    currency: str
    balance: float
    account_type: str


class EndUserAgreement(TypedDict):
    """GoCardless end user agreement."""

    id: str
    created: str
    institution_id: str
    max_historical_days: int
    access_valid_for_days: int
    access_scope: list[str]
    accepted: str


class Token(TypedDict):
    """GoCardless token."""

    access: str
    access_expires: int
    refresh: str
    refresh_expires: int


class GoCardlessService:
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.client = NordigenClient(
            secret_id=os.environ.get("GOCARDLESS_SECRET_ID", ""),
            secret_key=os.environ.get("GOCARDLESS_SECRET_KEY", ""),
        )
        if not os.environ.get("GOCARDLESS_SECRET_ID") or not os.environ.get(
            "GOCARDLESS_SECRET_KEY"
        ):
            raise ValueError(
                "GoCardless credentials not found in environment variables"
            )
        self.token = self.client.generate_token()

    def get_institutions(self, country_code: str = "GB") -> list[Institution]:
        """Get list of available banks for a given country."""
        try:
            # Get institutions from cache if available
            cache_key = f"institutions_{country_code}"
            cached_data = self._get_cached_data(cache_key, "institutions")
            if cached_data:
                return cast("list[Institution]", cached_data)

            # Fetch from GoCardless API
            institutions = self.client.institution.get_institutions(
                country=country_code
            )

            # Format the response
            formatted_institutions = [
                {
                    "id": inst["id"],
                    "name": inst["name"],
                    "logo": inst.get("logo", ""),
                    "countries": inst.get("countries", []),
                    "bic": inst.get("bic", None),
                    "transaction_total_days": inst.get("transaction_total_days", None),
                    "max_access_valid_for_days": inst.get(
                        "max_access_valid_for_days", None
                    ),
                }
                for inst in institutions
            ]

            # Cache the results
            self._update_cache(cache_key, formatted_institutions, "institutions")

            return cast("list[Institution]", formatted_institutions)
        except Exception as e:
            logger.error(f"Error fetching institutions: {e}")
            raise

    def get_institution(self, institution_id: str) -> Institution:
        """Get details of a specific institution."""
        try:
            # Try to get from cache first
            cache_key = f"institution_{institution_id}"
            cached_data = self._get_cached_data(cache_key, "institution")
            if cached_data:
                return cast("Institution", cached_data)

            # Get all institutions and filter by ID
            country_codes = ["GB", "FR", "DE", "ES", "IT"]  # Add more as needed

            for country in country_codes:
                institutions = self.get_institutions(country)
                for institution in institutions:
                    if institution["id"] == institution_id:
                        # Cache for future use
                        self._update_cache(cache_key, institution, "institution")
                        return institution

            raise ValueError(f"Institution with ID {institution_id} not found")
        except Exception as e:
            logger.error(f"Error getting institution: {e}")
            raise

    def create_end_user_agreement(
        self,
        institution_id: str,
        max_historical_days: int = 90,
        access_valid_for_days: int = 90,
        access_scope: list[str] = ["balances", "details", "transactions"],
        user_id: int = 0,
    ) -> EndUserAgreement:
        """Create an end user agreement."""
        try:
            # Create agreement with GoCardless
            agreement = self.client.agreement.create_agreement(
                institution_id=institution_id,
                max_historical_days=max_historical_days,
                access_valid_for_days=access_valid_for_days,
                access_scope=access_scope,
            )

            # Store agreement in database
            self._store_agreement(
                agreement["id"],
                institution_id,
                max_historical_days,
                access_valid_for_days,
                access_scope,
                user_id,
            )

            return cast(
                "EndUserAgreement",
                {
                    "id": agreement["id"],
                    "created": agreement.get("created", datetime.now().isoformat()),
                    "institution_id": institution_id,
                    "max_historical_days": max_historical_days,
                    "access_valid_for_days": access_valid_for_days,
                    "access_scope": access_scope,
                    "accepted": agreement.get("accepted", ""),
                },
            )
        except Exception as e:
            logger.error(f"Error creating end user agreement: {e}")
            raise

    def create_requisition(
        self,
        institution_id: str,
        redirect_url: str,
        user_id: int = 0,
        reference: str | None = None,
        account_selection: bool = False,
    ) -> Requisition:
        """Create a new requisition for bank connection."""
        try:
            # Create requisition with GoCardless
            reference_id = reference or datetime.now().strftime("%Y%m%d%H%M%S")

            # Prepare requisition parameters
            requisition_params = {
                "redirect_uri": redirect_url,
                "institution_id": institution_id,
                "reference_id": reference_id,
            }

            # account_selection is a boolean parameter
            # We add it directly without conditionals as it's a valid parameter
            requisition_params["account_selection"] = bool(account_selection)

            requisition = self.client.initialize_session(**requisition_params)

            # Store requisition in database
            self._store_requisition(
                requisition.requisition_id,
                requisition.link,
                user_id,
                institution_id,
                reference_id,
            )

            return cast(
                "Requisition",
                {
                    "id": requisition.requisition_id,
                    "created": datetime.now().isoformat(),
                    "institution_id": institution_id,
                    "link": requisition.link,
                    "reference": reference_id,
                    "redirect": redirect_url,
                    "status": "CR",  # Created
                    "accounts": [],
                },
            )
        except Exception as e:
            logger.error(f"Error creating requisition: {e}")
            raise

    def get_requisition_status(self, requisition_id: str) -> Requisition:
        """Get status of a requisition."""
        try:
            requisition = self.client.requisition.get_requisition_by_id(requisition_id)
            print(f"{requisition=}")

            return cast(
                "Requisition",
                {
                    "id": requisition["id"],
                    "created": requisition.get("created", ""),
                    "status": requisition.get("status", ""),
                    "institution_id": requisition.get("institution_id", ""),
                    "link": requisition.get("link", ""),
                    "reference": requisition.get("reference", ""),
                    "accounts": requisition.get("accounts", []),
                    "redirect": requisition.get("redirect", ""),
                },
            )
        except Exception as e:
            logger.error(f"Error getting requisition status: {e}")
            raise

    def get_requisition_by_reference(self, reference: str, user_id: int) -> Requisition:
        """Get requisition by reference value."""
        try:
            # Query the database for the requisition with the given reference
            query = """--sql
            SELECT requisition_id, link, institution_id, reference, agreement_id
            FROM gocardless_requisitions
            WHERE reference = ? AND user_id = ?
            """
            result = self.db_manager.execute_select(query, [reference, user_id])

            if not result:
                raise ValueError(f"No requisition found with reference: {reference}")

            requisition_id = result[0]["requisition_id"]

            # Use the retrieved requisition_id to get the full status from GoCardless
            return self.get_requisition_status(requisition_id)
        except Exception as e:
            logger.error(f"Error getting requisition by reference: {e}")
            raise

    def get_accounts(self, requisition_id: str) -> list[Account]:
        """Get accounts for a requisition."""
        try:
            # Get accounts from GoCardless
            requisition = self.client.requisition.get_requisition_by_id(requisition_id)
            accounts_list = requisition.get("accounts", [])

            if not accounts_list:
                logger.warning(f"No accounts found for requisition {requisition_id}")
                return []

            logger.info(
                f"Found {len(accounts_list)} accounts for requisition {requisition_id}"
            )

            accounts = []
            for account_id in accounts_list:
                try:
                    # Get account details and balances
                    account_data = self.client.account_api(account_id).get_metadata()
                    balances_data = self.client.account_api(account_id).get_balances()

                    # Log details for debugging
                    logger.debug(f"Account metadata for {account_id}: {account_data}")
                    logger.debug(f"Balance data for {account_id}: {balances_data}")

                    account_info = account_data.get("account", {})
                    balance_info = (
                        balances_data.get("balances", [{}])[0]
                        if balances_data.get("balances")
                        else {}
                    )
                    balance_amount = balance_info.get("balanceAmount", {})

                    accounts.append(
                        cast(
                            "Account",
                            {
                                "id": account_id,
                                "created": datetime.now().isoformat(),
                                "last_accessed": datetime.now().isoformat(),
                                "iban": account_info.get("iban", ""),
                                "status": account_info.get("status", ""),
                                "institution_id": account_info.get(
                                    "institution_id", ""
                                ),
                                "owner_name": account_info.get("ownerName", ""),
                                "currency": balance_amount.get("currency", ""),
                                "balance": float(balance_amount.get("amount", 0)),
                                "account_type": account_info.get("cashAccountType", ""),
                            },
                        )
                    )
                except Exception as acc_error:
                    # Check for rate limit errors
                    error_str = str(acc_error)
                    if (
                        "429" in error_str
                        or "rate limit" in error_str.lower()
                        or "too many requests" in error_str.lower()
                    ):
                        logger.warning(
                            f"Rate limit exceeded when processing account {account_id}: {error_str}"
                        )
                        # Re-raise to be handled by the outer exception handler
                        raise
                    logger.error(f"Error processing account {account_id}: {acc_error}")
                    # Skip this account but continue with others
                    continue

            return accounts
        except Exception as e:
            logger.error(f"Error getting accounts: {e}")

            # Look for the exact pattern we see in the logs
            error_str = str(e)
            if (
                "429" in error_str
                or "rate limit" in error_str.lower()
                or "too many requests" in error_str.lower()
            ):
                # This handles various rate limit error formats
                import re

                from flask import jsonify, make_response

                # Extract information using string operations
                retry_after = None
                detail = "Rate limit exceeded"
                summary = "Rate limit exceeded"

                # Try to extract the retry time and detail
                detail_match = re.search(r"'detail': '([^']*)'", error_str)
                if detail_match:
                    detail = detail_match.group(1)

                    # Try to extract retry_after from the detail
                    time_match = re.search(r"try again in (\d+) seconds", detail)
                    if time_match:
                        retry_after = int(time_match.group(1))

                # Try to extract summary
                summary_match = re.search(r"'summary': '([^']*)'", error_str)
                if summary_match:
                    summary = summary_match.group(1)

                # Log detailed information about the rate limit
                logger.warning(
                    f"Rate limit exceeded when getting accounts. "
                    f"Detail: {detail}, Retry after: {retry_after}s, Summary: {summary}"
                )

                # Return structured error response
                error_response = {
                    "error": {
                        "detail": detail,
                        "retry_after": retry_after,
                        "summary": summary,
                    }
                }

                return make_response(jsonify(error_response), 429)

            # Re-raise other errors
            raise

    def get_account_details(
        self, account_id: str, update_cache: bool = False
    ) -> dict[str, Any]:
        """Get details for an account."""
        try:
            # Try to get from cache first if not updating
            if not update_cache:
                cache_key = f"account_details_{account_id}"
                cached_data = self._get_cached_data(cache_key, "account_details")
                if cached_data:
                    return cast("dict[str, Any]", cached_data)

            # Fetch from GoCardless API
            account_details = self.client.account_api(account_id).get_details()

            # Cache the results
            cache_key = f"account_details_{account_id}"
            self._update_cache(cache_key, account_details, "account_details")

            return account_details
        except Exception as e:
            logger.error(f"Error getting account details: {e}")
            # Handle rate limit errors using our helper method
            return self._check_rate_limit_error(e)

    def get_account_balances(
        self, account_id: str, update_cache: bool = False
    ) -> dict[str, Any]:
        """Get balances for an account."""
        try:
            # Try to get from cache first if not updating
            if not update_cache:
                cache_key = f"account_balances_{account_id}"
                cached_data = self._get_cached_data(cache_key, "account_balances")
                if cached_data:
                    return cast("dict[str, Any]", cached_data)

            # Fetch from GoCardless API
            balances = self.client.account_api(account_id).get_balances()

            # Cache the results
            cache_key = f"account_balances_{account_id}"
            self._update_cache(cache_key, balances, "account_balances")

            return balances
        except Exception as e:
            logger.error(f"Error getting account balances: {e}")
            # Handle rate limit errors using our helper method
            return self._check_rate_limit_error(e)

    def get_account_transactions(
        self,
        account_id: str,
        date_from: str | None = None,
        date_to: str | None = None,
        update_cache: bool = False,
    ) -> dict[str, Any]:
        """Get transactions for an account."""
        try:
            # Try to get from cache first if not updating
            if not update_cache:
                cache_key = f"account_transactions_{account_id}_{date_from}_{date_to}"
                cached_data = self._get_cached_data(cache_key, "account_transactions")
                if cached_data:
                    return cast("dict[str, Any]", cached_data)

            # Prepare parameters
            params = {}
            if date_from:
                params["date_from"] = date_from
            if date_to:
                params["date_to"] = date_to

            # Fetch from GoCardless API
            transactions = self.client.account_api(account_id).get_transactions(
                **params
            )

            # Cache the results
            cache_key = f"account_transactions_{account_id}_{date_from}_{date_to}"
            self._update_cache(cache_key, transactions, "account_transactions")

            return transactions
        except Exception as e:
            logger.error(f"Error getting account transactions: {e}")
            # Handle rate limit errors using our helper method
            return self._check_rate_limit_error(e)

    def link_accounts_to_user(
        self, requisition_id: str, account_ids: list[str], user_id: int
    ) -> None:
        """Link accounts to user."""
        try:
            # Get accounts details
            try:
                accounts = self.get_accounts(requisition_id)
                logger.info(
                    f"Retrieved {len(accounts)} accounts for requisition {requisition_id}"
                )
            except Exception as acc_error:
                # Check specifically for rate limit errors
                error_str = str(acc_error)
                if (
                    "429" in error_str
                    or "too many requests" in error_str.lower()
                    or "rate limit" in error_str.lower()
                ):
                    logger.warning(
                        f"Rate limit exceeded when fetching accounts: {error_str}"
                    )
                    # Re-raise to be caught by the outer try/except
                    raise
                logger.error(f"Failed to get accounts: {acc_error}")
                raise

            # Check if what we received is a Response object indicating an error
            if hasattr(accounts, "status_code") and accounts.status_code == 429:
                logger.warning(f"Rate limit response received: {accounts}")
                raise Exception(f"Rate limit exceeded: {accounts}")

            # Store accounts in database
            stored_accounts = 0
            for account in accounts:
                if account["id"] in account_ids:
                    try:
                        self._store_account(account, user_id)
                        stored_accounts += 1
                    except Exception as store_error:
                        logger.error(
                            f"Failed to store account {account['id']}: {store_error}"
                        )
                        # Continue with next account rather than failing everything
                        continue

            logger.info(
                f"Successfully stored {stored_accounts} accounts for user {user_id}"
            )

        except Exception as e:
            if (
                "429" in str(e)
                or "rate limit" in str(e).lower()
                or "too many requests" in str(e).lower()
            ):
                logger.warning(f"Rate limit exceeded when linking accounts: {e}")
            else:
                logger.error(f"Error linking accounts: {e}")
            raise

    def get_token(self, secret_id: str, secret_key: str) -> Token:
        """Get a GoCardless API token."""
        try:
            # Create a temporary client with provided credentials
            temp_client = NordigenClient(secret_id=secret_id, secret_key=secret_key)

            # Generate a token
            token_data = temp_client.generate_token()

            return cast(
                "Token",
                {
                    "access": token_data.get("access", ""),
                    "access_expires": token_data.get("access_expires", 86400),
                    "refresh": token_data.get("refresh", ""),
                    "refresh_expires": token_data.get("refresh_expires", 2592000),
                },
            )
        except Exception as e:
            logger.error(f"Error getting token: {e}")
            raise

    def _store_requisition(
        self,
        requisition_id: str,
        link: str,
        user_id: int,
        institution_id: str,
        reference: str = "",
        agreement_id: str | None = None,
    ) -> None:
        """Store requisition in database."""
        try:
            query = """--sql
            INSERT INTO gocardless_requisitions (
                requisition_id, link, user_id, institution_id, reference, agreement_id
            ) VALUES (?, ?, ?, ?, ?, ?)
            """
            self.db_manager.execute_update(
                query=query,
                params=[
                    requisition_id,
                    link,
                    user_id,
                    institution_id,
                    reference,
                    agreement_id,
                ],
            )
        except Exception as e:
            logger.error(f"Error storing requisition: {e}")
            raise

    def _store_agreement(
        self,
        agreement_id: str,
        institution_id: str,
        max_historical_days: int,
        access_valid_for_days: int,
        access_scope: list[str],
        user_id: int,
    ) -> None:
        """Store agreement in database."""
        try:
            query = """--sql
            INSERT INTO gocardless_agreements (
                agreement_id, institution_id, max_historical_days,
                access_valid_for_days, access_scope, user_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """
            self.db_manager.execute_update(
                query=query,
                params=[
                    agreement_id,
                    institution_id,
                    max_historical_days,
                    access_valid_for_days,
                    json.dumps(access_scope),
                    user_id,
                    datetime.now().isoformat(),
                ],
            )
        except Exception as e:
            logger.error(f"Error storing agreement: {e}")
            raise

    def _store_account(self, account: Account, user_id: int) -> None:
        """Store account in database."""
        try:
            query = """--sql
            INSERT INTO gocardless_accounts (
                account_id, created_at, last_accessed,
                iban, institution_id, status,
                owner_name, currency, balance,
                account_type, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            self.db_manager.execute_update(
                query=query,
                params=[
                    account["id"],
                    account["created"],
                    account["last_accessed"],
                    account["iban"],
                    account["institution_id"],
                    account["status"],
                    account["owner_name"],
                    account["currency"],
                    account["balance"],
                    account["account_type"],
                    user_id,
                ],
            )
        except Exception as e:
            logger.error(f"Error storing account: {e}")
            raise

    def _get_cached_data(self, key: str, cache_type: str) -> Any | None:
        """Get data from cache."""
        try:
            query = """--sql
            SELECT data, last_updated
            FROM gocardless_cache
            WHERE cache_key = ? AND cache_type = ?
            """
            result = self.db_manager.execute_select(
                query=query, params=[key, cache_type]
            )
            if result:
                return json.loads(result[0]["data"])
        except Exception as e:
            logger.error(f"Error reading cache: {e}")
        return None

    def _update_cache(self, key: str, data: Any, cache_type: str) -> None:
        """Update cache with new data."""
        try:
            query = """--sql
            INSERT INTO gocardless_cache (
                cache_key, cache_type, data, last_updated
            ) VALUES (?, ?, ?, ?)
            ON CONFLICT(cache_key, cache_type) DO UPDATE SET
                data = excluded.data,
                last_updated = excluded.last_updated
            """
            self.db_manager.execute_update(
                query=query,
                params=[key, cache_type, json.dumps(data), datetime.now().isoformat()],
            )
        except Exception as e:
            logger.error(f"Error updating cache: {e}")
            raise

    def get_user_accounts(self, user_id: int) -> list[Account]:
        """Get all GoCardless accounts for a user."""
        try:
            # Get accounts from database instead of fetching them for each requisition
            query = """--sql
            SELECT * FROM gocardless_accounts
            WHERE user_id = ?
            """
            accounts_data = self.db_manager.execute_select(query, [user_id])

            accounts = []
            for account_data in accounts_data:
                accounts.append(
                    cast(
                        "Account",
                        {
                            "id": account_data["account_id"],
                            "created": account_data["created_at"],
                            "last_accessed": account_data["last_accessed"],
                            "iban": account_data["iban"],
                            "institution_id": account_data["institution_id"],
                            "status": account_data["status"],
                            "owner_name": account_data["owner_name"],
                            "currency": account_data["currency"],
                            "balance": float(account_data["balance"]) if account_data["balance"] else 0,
                            "account_type": account_data["account_type"],
                        },
                    )
                )

            return accounts
        except Exception as e:
            logger.error(f"Error getting user accounts: {e}")
            raise

    def _check_rate_limit_error(self, e: Exception) -> Any:
        """Check if the exception is a rate limit error and raise appropriate HTTP error."""
        from flask import jsonify, make_response

        # Convert the exception to a string for safe pattern matching
        error_str = str(e)

        # Check for any rate limit indicator
        if (
            "429" in error_str
            or "rate limit" in error_str.lower()
            or "too many requests" in error_str.lower()
        ):
            # Extract information using string operations
            import re

            retry_after = None
            detail = "Rate limit exceeded"
            summary = "Rate limit exceeded"

            # Try to extract the retry time and detail
            detail_match = re.search(r"'detail': '([^']*)'", error_str)
            if detail_match:
                detail = detail_match.group(1)

                # Try to extract retry_after from the detail
                time_match = re.search(r"try again in (\d+) seconds", detail)
                if time_match:
                    retry_after = int(time_match.group(1))

            # Try to extract summary
            summary_match = re.search(r"'summary': '([^']*)'", error_str)
            if summary_match:
                summary = summary_match.group(1)

            # Log the rate limit with appropriate level
            logger.warning(
                f"Rate limit exceeded. Detail: {detail}, Retry after: {retry_after}s, Summary: {summary}"
            )

            # Return structured error response
            error_response = {
                "error": {
                    "detail": detail,
                    "retry_after": retry_after,
                    "summary": summary,
                }
            }

            return make_response(jsonify(error_response), 429)

        # If it's not a rate limit error, re-raise
        raise e
