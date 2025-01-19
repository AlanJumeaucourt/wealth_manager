import json
import logging
import os
from collections.abc import Sequence
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


class Requisition(TypedDict):
    """GoCardless requisition."""

    id: str
    created: str
    status: str
    institution_id: str
    link: str
    reference: str


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

    def get_institutions(self) -> Sequence[Institution]:
        """Get list of available banks."""
        try:
            # Get institutions from cache if available
            cached_data = self._get_cached_data("institutions", "institutions")
            if cached_data:
                return cast(Sequence[Institution], cached_data)

            # Fetch from GoCardless API
            institutions = self.client.institution.get_institutions()

            # Format the response
            formatted_institutions = [
                {
                    "id": inst["id"],
                    "name": inst["name"],
                    "logo": inst.get("logo", ""),
                    "countries": inst.get("countries", []),
                }
                for inst in institutions
            ]

            # Cache the results
            self._update_cache("institutions", formatted_institutions, "institutions")

            return cast(Sequence[Institution], formatted_institutions)
        except Exception as e:
            logger.error(f"Error fetching institutions: {e}")
            raise

    def create_requisition(self, institution_id: str, user_id: int) -> Requisition:
        """Create a new requisition for bank connection."""
        try:
            # Create requisition with GoCardless
            reference = datetime.now().strftime("%Y%m%d%H%M%S")
            requisition = self.client.initialize_session(
                redirect_uri="wealthapp://",
                institution_id=institution_id,
                reference_id=reference,
            )

            # Store requisition in database
            self._store_requisition(
                requisition.requisition_id,
                requisition.link,
                user_id,
                institution_id,
            )

            return cast(
                Requisition,
                {
                    "id": requisition.requisition_id,
                    "institution_id": institution_id,
                    "link": requisition.link,
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
                Requisition,
                {
                    "id": requisition["id"],
                    "created": requisition["created"],
                    "status": requisition["status"],
                    "link": requisition.get("link", ""),
                    "reference": requisition["reference"],
                },
            )
        except Exception as e:
            logger.error(f"Error getting requisition status: {e}")
            raise

    def get_accounts(self, requisition_id: str) -> Sequence[Account]:
        """Get accounts for a requisition."""
        try:
            # Get accounts from GoCardless
            requisition = self.client.requisition.get_requisition_by_id(requisition_id)
            accounts_list = requisition.get("accounts", [])

            accounts = []
            for account_id in accounts_list:
                # Get account details and balances
                account = self.client.account_api(account_id).get_metadata()
                balances = self.client.account_api(account_id).get_balances()
                print(f"{account=}")
                print(f"{balances=}")

                accounts.append(
                    cast(
                        Account,
                        {
                            "id": account_id,
                            "created": datetime.now().isoformat(),
                            "last_accessed": datetime.now().isoformat(),
                            "iban": account["account"].get("iban", ""),
                            "status": account["account"].get("status", ""),
                            "institution_id": account["account"].get(
                                "institution_id", ""
                            ),
                            "owner_name": account["account"].get("ownerName", ""),
                            "currency": balances["balances"][0]["currency"],
                            "balance": float(
                                balances["balances"][0]["balanceAmount"]["amount"]
                            ),
                            "account_type": account["account"].get(
                                "cashAccountType", ""
                            ),
                        },
                    )
                )

            return accounts
        except Exception as e:
            logger.error(f"Error getting accounts: {e}")
            raise e

    def link_accounts_to_user(
        self, requisition_id: str, account_ids: list[str], user_id: int
    ) -> None:
        """Link accounts to user."""
        try:
            # Get accounts details
            accounts = self.get_accounts(requisition_id)

            # Store accounts in database
            for account in accounts:
                if account["id"] in account_ids:
                    self._store_account(account, user_id)

        except Exception as e:
            logger.error(f"Error linking accounts: {e}")
            raise

    def _store_requisition(
        self, requisition_id: str, link: str, user_id: int, institution_id: str
    ) -> None:
        """Store requisition in database."""
        try:
            query = """--sql
            INSERT INTO gocardless_requisitions (
                requisition_id, link, user_id, institution_id
            ) VALUES (?, ?, ?, ?)
            """
            self.db_manager.execute_update(
                query=query,
                params=[
                    requisition_id,
                    link,
                    user_id,
                    institution_id,
                ],
            )
        except Exception as e:
            logger.error(f"Error storing requisition: {e}")
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
