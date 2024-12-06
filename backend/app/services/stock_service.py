import json
import logging
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from queue import Queue
from typing import Any, TypedDict
from urllib.parse import quote_plus

import requests
import yfinance as yf

from app.database import DatabaseManager

logger = logging.getLogger(__name__)


class StockInfo(TypedDict):
    symbol: str
    name: str
    type: str
    exchange: str
    currency: str
    current_price: float | None
    previous_close: float | None
    market_cap: float | None
    volume: int | None
    description: str


class HistoricalPrice(TypedDict):
    date: str
    value: float
    volume: int
    open: float
    high: float
    low: float
    close: float


class AssetSearchResult(TypedDict):
    symbol: str
    name: str
    type: str
    exchange: str
    currency: str


class CacheManager:
    """Manages cache operations in a separate thread."""

    def __init__(self) -> None:
        self.queue: Queue[tuple[Callable[..., Any], tuple, dict]] = Queue()
        self.worker = threading.Thread(target=self._process_queue, daemon=True)
        self.worker.start()
        self.db_manager = DatabaseManager()

    def _process_queue(self) -> None:
        while True:
            try:
                task = self.queue.get()
                if task is None:
                    break
                func, args, kwargs = task
                func(*args, **kwargs)
                self.queue.task_done()
            except Exception as e:
                logger.error(f"Error processing cache task: {e}")

    def add_task(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
        """Add a task to the queue."""
        self.queue.put((func, args, kwargs))

    def _update_cache(self, symbol: str, data: dict[str, Any], cache_type: str) -> None:
        """Update the cache with new data."""
        try:
            query = """--sql
            INSERT INTO stock_cache (symbol, cache_type, data, last_updated)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(symbol, cache_type) DO UPDATE SET
                data = excluded.data,
                last_updated = excluded.last_updated
            """
            self.db_manager.execute_update(
                query=query,
                params=[
                    symbol,
                    cache_type,
                    json.dumps(data),
                    datetime.now().isoformat(),
                ],
            )
            logger.info(f"Cache UPDATED for {symbol} ({cache_type})")
        except Exception as e:
            logger.error(f"Error updating cache for {symbol} ({cache_type}): {e}")

    def _get_cached_data(self, symbol: str, cache_type: str) -> dict[str, Any] | None:
        """Get data from cache."""
        try:
            query = """--sql
            SELECT data, last_updated
            FROM stock_cache
            WHERE symbol = ? AND cache_type = ?
            """
            result = self.db_manager.execute_select(query, (symbol, cache_type))
            if result:
                cached_data = json.loads(result[0]["data"])
                last_updated = datetime.fromisoformat(result[0]["last_updated"])

                # Check if cache is still valid based on duration
                cache_duration = self.db_manager.cache_durations.get(cache_type)
                if cache_duration and datetime.now() - last_updated > cache_duration:
                    return None

                return cached_data
        except Exception as e:
            logger.error(f"Error reading cache for {symbol} ({cache_type}): {e}")
        return None


class StockService:
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.cache_manager = CacheManager()
        self.cache_durations = {
            "basic_info": timedelta(minutes=15),
            "historical_prices": timedelta(days=1),
            "search_assets": timedelta(weeks=1),
            "stock_details": timedelta(hours=1),
        }
        # Create a thread pool for concurrent API calls
        self.executor = ThreadPoolExecutor(max_workers=10)
        self.base_url = "https://query1.finance.yahoo.com/v10/finance/quoteSummary/{}"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

    def _fetch_and_cache(
        self, symbol: str, data: dict[str, Any], cache_type: str
    ) -> None:
        """Background task to update cache"""
        self.cache_manager.add_task(
            self.cache_manager._update_cache, symbol, data, cache_type
        )

    def _fetch_ticker_info(self, symbol: str) -> dict[str, Any] | None:
        """Fetch ticker info in a separate thread"""
        try:
            ticker = yf.Ticker(symbol)
            return ticker.info
        except Exception as e:
            logger.error(f"Error fetching ticker info for {symbol}: {e}")
            return None

    def get_asset_info(self, symbol: str) -> StockInfo | None:
        """Get detailed information about a specific asset."""
        logger.info(f"Getting asset info for {symbol}")
        cache_key = f"{symbol}_basic_info"

        try:
            cached_data = self.cache_manager._get_cached_data(
                symbol=cache_key, cache_type="basic_info"
            )
            if cached_data:
                logger.info(f"Cache HIT for {symbol}")
                return cached_data
        except Exception:
            pass

        # Submit API call to thread pool
        future = self.executor.submit(self._fetch_ticker_info, symbol)
        try:
            info = future.result(timeout=5)  # 5 second timeout
            if not info:
                return None

            result: StockInfo = {
                "symbol": symbol,
                "name": info.get("longName", ""),
                "type": info.get("quoteType", ""),
                "exchange": info.get("exchange", ""),
                "currency": info.get("currency", ""),
                "current_price": info.get("regularMarketPrice"),
                "previous_close": info.get("regularMarketPreviousClose"),
                "market_cap": info.get("marketCap"),
                "volume": info.get("volume"),
                "description": info.get("longBusinessSummary", ""),
            }

            # Update cache in background with new cache key
            self._fetch_and_cache(
                symbol=cache_key, data=result, cache_type="basic_info"
            )

        except Exception as e:
            logger.error(f"Error in get_asset_info for {symbol}: {e!s}")
            return None

        else:
            return result

    def get_historical_prices(
        self, symbol: str, period: str | None = "max"
    ) -> list[HistoricalPrice]:
        """Get historical price data for an asset."""
        logger.info(f"Getting historical prices for {symbol} (period: {period})")
        cache_key = f"{symbol}_period_{period}"

        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period, interval="1d")

            result: list[HistoricalPrice] = [
                {
                    "date": index.strftime("%Y-%m-%d"),
                    "value": float(row["Close"]),
                    "volume": int(row["Volume"]),
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                }
                for index, row in hist.iterrows()
            ]

            # Update cache in background
            self._fetch_and_cache(
                symbol=cache_key, data=result, cache_type="historical_prices"
            )

        except Exception as e:
            logger.error(f"Error in get_historical_prices for {symbol}: {e!s}")
            # Try to get from cache if API fails
            cached_data = self.cache_manager._get_cached_data(
                cache_key, "historical_prices"
            )
            if cached_data:
                logger.info(
                    f"Returning cached data for {symbol} historical after API failure"
                )
                return cached_data
            return []

        else:
            return result

    def search_assets(self, query: str) -> list[AssetSearchResult]:
        """Search for stocks and ETFs."""
        cache_key = f"search_query_{query}"
        logger.info(f"Searching assets for query: {query}")

        # Try cache first without waiting
        try:
            cached_data = self.cache_manager._get_cached_data(
                cache_key, "search_assets"
            )
            if cached_data:
                logger.info(f"Cache HIT for search query: {query}")
                return cached_data
        except Exception:
            pass

        try:
            results: list[AssetSearchResult] = []
            futures = []

            # First try direct symbol lookup
            futures.append(self.executor.submit(self._fetch_ticker_info, query))

            # Then use Yahoo Finance search API
            search_url = f"https://query2.finance.yahoo.com/v1/finance/search?q={quote_plus(query)}&quotesCount=20&newsCount=0&enableFuzzyQuery=false"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }

            # Submit search API call to thread pool
            futures.append(
                self.executor.submit(requests.get, search_url, headers=headers)
            )

            # Process results as they complete
            for future in as_completed(futures, timeout=5):
                try:
                    result = future.result()
                    if isinstance(result, dict):  # Ticker info
                        if result and "symbol" in result:
                            results.append(self._format_ticker_result(result))
                    else:  # Search API response
                        search_data = result.json()
                        if "quotes" in search_data:
                            for quote in search_data["quotes"]:
                                if not any(
                                    r["symbol"] == quote.get("symbol") for r in results
                                ):
                                    results.append(self._format_search_result(quote))
                except Exception as e:
                    logger.error(f"Error processing search result: {e}")

            # Update cache in background
            if results:
                self._fetch_and_cache(cache_key, results, "search_assets")
            return results

        except Exception as e:
            logger.error(f"Error in search_assets: {e!s}")
            return []

    def _format_ticker_result(self, info: dict[str, Any]) -> AssetSearchResult:
        return {
            "symbol": info.get("symbol", ""),
            "name": info.get("longName", ""),
            "type": info.get("quoteType", ""),
            "exchange": info.get("exchange", ""),
            "currency": info.get("currency", ""),
        }

    def _format_search_result(self, quote: dict[str, Any]) -> AssetSearchResult:
        return {
            "symbol": quote.get("symbol", ""),
            "name": quote.get("longname", quote.get("shortname", "")),
            "type": quote.get("quoteType", ""),
            "exchange": quote.get("exchange", ""),
            "currency": "",
        }

    def get_current_price(self, symbol: str) -> float | None:
        """Get the current price of an asset."""
        logger.info(f"Getting current price for {symbol}")
        cache_key = f"{symbol}_basic_info"

        try:
            cached_data = self.cache_manager._get_cached_data(cache_key, "basic_info")
            if cached_data and cached_data.get("current_price"):
                return cached_data["current_price"]

            ticker = yf.Ticker(symbol)
            info = ticker.info
            price = float(info.get("regularMarketPrice", 0))
            logger.info(f"Successfully fetched current price for {symbol}: {price}")
            return price
        except Exception as e:
            logger.error(f"Error getting current price for {symbol}: {e!s}")
            return None

    def get_stock_details(self, symbol: str) -> dict[str, Any] | None:
        """Get detailed quote summary including comprehensive fund/stock information."""
        logger.info(f"Getting detailed quote summary for {symbol}")
        cache_key = f"{symbol}_full_details"

        # Try cache first
        try:
            cached_data = self.cache_manager._get_cached_data(
                cache_key, "stock_details"
            )
            if cached_data:
                logger.info(f"Cache HIT for {symbol} details")
                return cached_data
        except Exception as e:
            logger.error(f"Cache error for {symbol}: {e!s}")

        try:
            ticker = yf.Ticker(symbol)

            # Helper function to convert timestamps to strings
            def serialize_timestamp_dict(d: dict) -> dict:
                return {k.strftime("%Y-%m-%d"): v for k, v in d.items()}

            # Collect all available data
            details = {
                "info": ticker.info,  # Basic info
                "calendar": ticker.calendar,  # Earnings calendar
                "recommendations": (
                    ticker.recommendations.to_dict("records")
                    if hasattr(ticker, "recommendations")
                    else None
                ),
                "major_holders": (
                    ticker.major_holders.to_dict("records")
                    if hasattr(ticker, "major_holders")
                    else None
                ),
                "institutional_holders": (
                    [
                        {
                            "holder": str(holder[0]),
                            "shares": int(holder[1]),
                            "date_reported": (
                                holder[2].strftime("%Y-%m-%d") if holder[2] else None
                            ),
                            "value": float(holder[3]) if holder[3] else None,
                        }
                        for holder in ticker.institutional_holders.to_numpy().tolist()
                    ]
                    if hasattr(ticker, "institutional_holders")
                    and ticker.institutional_holders is not None
                    else None
                ),
                "dividends": (
                    serialize_timestamp_dict(ticker.dividends.to_dict())
                    if hasattr(ticker, "dividends")
                    else None
                ),
                "splits": (
                    serialize_timestamp_dict(ticker.splits.to_dict())
                    if hasattr(ticker, "splits")
                    else None
                ),
                "actions": (
                    {
                        k: serialize_timestamp_dict(v.to_dict())
                        for k, v in ticker.actions.items()
                    }
                    if hasattr(ticker, "actions")
                    else None
                ),
            }

            # Add fund-specific data if available
            try:
                if ticker.info.get("quoteType") == "ETF":
                    fund_details = {
                        "fund_sector_weightings": (
                            ticker.funds_data.sector_weightings
                            if hasattr(ticker, "funds_data")
                            and hasattr(ticker.funds_data, "sector_weightings")
                            else None
                        ),
                        "fund_top_holdings": (
                            ticker.funds_data.top_holdings.to_dict()
                            if hasattr(ticker, "funds_data")
                            and hasattr(ticker.funds_data, "top_holdings")
                            else None
                        ),
                        "fund_holding_info": (
                            ticker.funds_data.asset_classes
                            if hasattr(ticker, "funds_data")
                            and hasattr(ticker.funds_data, "asset_classes")
                            else None
                        ),
                        "fund_performance": (
                            ticker.funds_data.fund_overview
                            if hasattr(ticker, "funds_data")
                            and hasattr(ticker.funds_data, "fund_overview")
                            else None
                        ),
                        "fund_profile": (
                            ticker.funds_data.fund_operations.to_dict()
                            if hasattr(ticker, "funds_data")
                            and hasattr(ticker.funds_data, "fund_operations")
                            else None
                        ),
                    }
                    details.update(fund_details)

            except Exception as e:
                logger.warning(f"Error fetching fund-specific data for {symbol}: {e!s}")

            # Update cache in background with new cache key
            self._fetch_and_cache(cache_key, details, "stock_details")

            return details

        except Exception as e:
            logger.error(f"Error fetching stock details for {symbol}: {e!s}")
            return None
