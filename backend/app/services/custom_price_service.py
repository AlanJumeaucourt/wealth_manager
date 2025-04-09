from datetime import datetime
from typing import Any

from app.models import CustomPrice
from app.services.base_service import BaseService


class CustomPriceService(BaseService[CustomPrice]):
    """Service for managing custom prices with batch operations support."""

    def __init__(self):
        super().__init__("custom_prices", CustomPrice)
        # Add additional fields that can be used in filters
        self.custom_allowed_filters = ["symbol", "date", "date_from", "date_to"]

    def get_by_symbol(self, symbol: str, user_id: int) -> list[CustomPrice]:
        """Get all custom prices for a symbol and user."""
        try:
            query = """--sql
            SELECT * FROM custom_prices
            WHERE symbol = ? AND user_id = ?
            ORDER BY date DESC
            """
            result = self.db_manager.execute_select(query, [symbol, user_id])
            if not result:
                return []

            return [CustomPrice(**row) for row in result]
        except Exception as e:
            print(f"Error getting custom prices for {symbol}: {e}")
            return []

    def add_price(
        self, symbol: str, date: str, price_data: dict[str, Any], user_id: int
    ) -> CustomPrice | None:
        """Add or update a custom price."""
        try:
            # Validate and sanitize inputs
            close_price = float(price_data.get("close", 0))
            if close_price <= 0:
                print(f"Invalid close price for {symbol}: {close_price}")
                return None

            # Use close price for all values if not provided
            open_price = float(price_data.get("open", close_price))
            high_price = float(price_data.get("high", close_price))
            low_price = float(price_data.get("low", close_price))
            volume = int(price_data.get("volume", 0))

            # Ensure high is the highest value
            high_price = max(high_price, open_price, close_price, low_price)
            # Ensure low is the lowest value
            low_price = min(low_price, open_price, close_price, high_price)

            now = datetime.now().isoformat()

            # Check if entry already exists
            check_query = """--sql
            SELECT id FROM custom_prices
            WHERE symbol = ? AND date = ? AND user_id = ?
            """
            existing = self.db_manager.execute_select(
                check_query, [symbol, date, user_id]
            )

            if existing:
                # Update existing entry
                id_ = existing[0]["id"]
                return self.update(
                    id_,
                    user_id,
                    {
                        "open": open_price,
                        "high": high_price,
                        "low": low_price,
                        "close": close_price,
                        "volume": volume,
                        "updated_at": now,
                    },
                )
            # Create new entry
            return self.create(
                {
                    "symbol": symbol,
                    "date": date,
                    "open": open_price,
                    "high": high_price,
                    "low": low_price,
                    "close": close_price,
                    "volume": volume,
                    "created_at": now,
                    "updated_at": now,
                    "user_id": user_id,
                }
            )
        except Exception as e:
            print(f"Error adding custom price for {symbol}: {e}")
            return None

    def delete_price(self, symbol: str, date: str, user_id: int) -> bool:
        """Delete a custom price."""
        try:
            query = """--sql
            SELECT id FROM custom_prices
            WHERE symbol = ? AND date = ? AND user_id = ?
            """
            result = self.db_manager.execute_select(query, [symbol, date, user_id])
            if not result:
                return False

            id_ = result[0]["id"]
            return self.delete(id_, user_id)
        except Exception as e:
            print(f"Error deleting custom price for {symbol} on {date}: {e}")
            return False

    def batch_add_prices(
        self, prices: list[dict[str, Any]], user_id: int
    ) -> dict[str, Any]:
        """Add or update multiple custom prices in a batch operation using BaseService."""
        if not prices:
            return {
                "successful": [],
                "failed": [],
                "total_successful": 0,
                "total_failed": 0,
            }

        # Process and validate each item
        validated_items = []
        unprocessed_items = []

        for price_data in prices:
            symbol = price_data.get("symbol")
            date = price_data.get("date")

            if not symbol or not date:
                unprocessed_items.append(
                    {"data": price_data, "error": "Missing symbol or date"}
                )
                continue

            try:
                # Get price data
                close_price = float(price_data.get("close", 0))
                if close_price <= 0:
                    unprocessed_items.append(
                        {"data": price_data, "error": "Invalid close price"}
                    )
                    continue

                # Use close price for all values if not provided
                open_price = float(price_data.get("open", close_price))
                high_price = float(price_data.get("high", close_price))
                low_price = float(price_data.get("low", close_price))
                volume = int(price_data.get("volume", 0))

                # Ensure high is the highest value
                high_price = max(high_price, open_price, close_price, low_price)
                # Ensure low is the lowest value
                low_price = min(low_price, open_price, close_price, high_price)

                now = datetime.now().isoformat()

                # Check if price already exists (for updating)
                check_query = """--sql
                SELECT id FROM custom_prices
                WHERE symbol = ? AND date = ? AND user_id = ?
                """
                existing = self.db_manager.execute_select(
                    check_query, [symbol, date, user_id]
                )

                if existing:
                    # For existing items, use batch_update
                    id_ = existing[0]["id"]
                    validated_items.append(
                        {
                            "id": id_,
                            "open": open_price,
                            "high": high_price,
                            "low": low_price,
                            "close": close_price,
                            "volume": volume,
                            "updated_at": now,
                        }
                    )
                else:
                    # For new items, use batch_create
                    validated_items.append(
                        {
                            "symbol": symbol,
                            "date": date,
                            "open": open_price,
                            "high": high_price,
                            "low": low_price,
                            "close": close_price,
                            "volume": volume,
                            "created_at": now,
                            "updated_at": now,
                            "user_id": user_id,
                        }
                    )
            except Exception as e:
                unprocessed_items.append({"data": price_data, "error": str(e)})

        # Split items into two groups: to update and to create
        to_update = [item for item in validated_items if "id" in item]
        to_create = [item for item in validated_items if "id" not in item]

        result = {
            "successful": [],
            "failed": unprocessed_items,
            "total_successful": 0,
            "total_failed": len(unprocessed_items),
        }

        # Process create batch
        if to_create:
            create_result = self.batch_create(to_create)
            result["successful"].extend(create_result["successful"])
            result["failed"].extend(create_result["failed"])
            result["total_successful"] += create_result["total_successful"]
            result["total_failed"] += create_result["total_failed"]

        # Process update batch
        if to_update:
            update_result = self.batch_update(user_id, to_update)
            result["successful"].extend(update_result["successful"])
            result["failed"].extend(update_result["failed"])
            result["total_successful"] += update_result["total_successful"]
            result["total_failed"] += update_result["total_failed"]

        return result

    def batch_delete_prices_by_dates(
        self, symbol: str, dates: list[str], user_id: int
    ) -> dict[str, Any]:
        """Delete multiple custom prices by dates for a symbol."""
        if not dates:
            return {
                "successful": [],
                "failed": [],
                "total_successful": 0,
                "total_failed": 0,
            }

        # Get IDs for the dates
        placeholders = ",".join(["?"] * len(dates))
        query = f"""--sql
        SELECT id, date FROM custom_prices
        WHERE symbol = ? AND date IN ({placeholders}) AND user_id = ?
        """

        params = [symbol, *dates, user_id]
        result = self.db_manager.execute_select(query, params)

        if not result:
            return {
                "successful": [],
                "failed": dates,
                "total_successful": 0,
                "total_failed": len(dates),
            }

        # Extract IDs and create date-to-id mapping
        ids = [row["id"] for row in result]
        date_to_id = {row["date"]: row["id"] for row in result}

        # Call batch_delete with IDs
        delete_result = self.batch_delete(user_id, ids)

        # Map back to dates for consistent API
        date_successful = []
        date_failed = []

        # Add successful deletions
        for id_ in delete_result["successful"]:
            # Find date corresponding to this ID
            for date, id_val in date_to_id.items():
                if id_val == id_:
                    date_successful.append(date)
                    break

        # Add failed deletions and dates not found
        for failed_item in delete_result["failed"]:
            failed_id = failed_item["id"]
            for date, id_val in date_to_id.items():
                if id_val == failed_id:
                    date_failed.append({"date": date, "error": failed_item["error"]})
                    break

        # Add dates that weren't found in the database
        for date in dates:
            if date not in date_to_id:
                date_failed.append({"date": date, "error": "Not found"})

        return {
            "successful": date_successful,
            "failed": date_failed,
            "total_successful": len(date_successful),
            "total_failed": len(date_failed),
        }
