import yfinance as yf
from typing import List, Dict, Optional, TypedDict, Any, Callable
from datetime import datetime, timedelta
import requests
from urllib.parse import quote_plus
import json
from app.database import DatabaseManager
import logging
import threading
from queue import Queue
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)


class StockInfo(TypedDict):
    symbol: str
    name: str
    type: str
    exchange: str
    currency: str
    current_price: Optional[float]
    previous_close: Optional[float]
    market_cap: Optional[float]
    volume: Optional[int]
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
    """Manages cache operations in a separate thread"""

    def __init__(self):
        self.queue = Queue()
        self.worker = threading.Thread(target=self._process_queue, daemon=True)
        self.worker.start()
        self.db_manager = DatabaseManager()

    def _process_queue(self):
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

    def add_task(self, func: Callable, *args, **kwargs):
        """Add a task to the queue"""
        self.queue.put((func, args, kwargs))

    def _update_cache(self, symbol: str, data: Dict[str, Any], cache_type: str) -> None:
        """Update the cache with new data"""
        try:
            query = """
            INSERT INTO stock_cache (symbol, data, last_updated)
            VALUES (?, ?, ?)
            ON CONFLICT(symbol) DO UPDATE SET
                data = excluded.data,
                last_updated = excluded.last_updated
            """
            self.db_manager.execute_update(
                query, (symbol, json.dumps(data), datetime.now().isoformat())
            )
            logger.info(f"Cache UPDATED for {symbol} ({cache_type})")
        except Exception as e:
            logger.error(f"Error updating cache for {symbol} ({cache_type}): {e}")

    def _get_cached_data(
        self, symbol: str, cache_type: str
    ) -> Optional[Dict[str, Any]]:
        """Get data from cache"""
        try:
            query = "SELECT data, last_updated FROM stock_cache WHERE symbol = ?"
            result = self.db_manager.execute_select(query, (symbol,))
            if result:
                return json.loads(result[0]["data"])
        except Exception as e:
            logger.error(f"Error reading cache for {symbol} ({cache_type}): {e}")
        return None


class StockService:
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.cache_manager = CacheManager()
        self.cache_durations = {
            "asset_info": timedelta(minutes=15),
            "historical_prices": timedelta(days=1),
            "search_assets": timedelta(weeks=1),
        }
        # Create a thread pool for concurrent API calls
        self.executor = ThreadPoolExecutor(max_workers=10)

    def _fetch_and_cache(
        self, symbol: str, data: Dict[str, Any], cache_type: str
    ) -> None:
        """Background task to update cache"""
        self.cache_manager.add_task(
            self.cache_manager._update_cache, symbol, data, cache_type
        )

    def _fetch_ticker_info(self, symbol: str) -> Optional[Dict]:
        """Fetch ticker info in a separate thread"""
        try:
            ticker = yf.Ticker(symbol)
            return ticker.info
        except Exception as e:
            logger.error(f"Error fetching ticker info for {symbol}: {e}")
            return None

    def get_asset_info(self, symbol: str) -> Optional[StockInfo]:
        """Get detailed information about a specific asset."""
        logger.info(f"Getting asset info for {symbol}")

        # First try to get from cache without waiting
        try:
            cached_data = self.cache_manager._get_cached_data(symbol, "asset_info")
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

            # Update cache in background
            self._fetch_and_cache(symbol, result, "asset_info")
            return result

        except Exception as e:
            logger.error(f"Error in get_asset_info for {symbol}: {str(e)}")
            return None

    def get_historical_prices(
        self, symbol: str, period: Optional[str] = "max"
    ) -> List[HistoricalPrice]:
        """Get historical price data for an asset."""
        logger.info(f"Getting historical prices for {symbol} (period: {period})")
        cache_key = f"{symbol}_historical_{period}"

        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period, interval="1d")

            result: List[HistoricalPrice] = [
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
            self._fetch_and_cache(cache_key, result, "historical_prices")
            return result

        except Exception as e:
            logger.error(f"Error in get_historical_prices for {symbol}: {str(e)}")
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

    def search_assets(self, query: str) -> List[AssetSearchResult]:
        """Search for stocks and ETFs."""
        cache_key = f"search_{query}"
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
            results: List[AssetSearchResult] = []
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
            logger.error(f"Error in search_assets: {str(e)}")
            return []

    def _format_ticker_result(self, info: Dict) -> AssetSearchResult:
        return {
            "symbol": info.get("symbol", ""),
            "name": info.get("longName", ""),
            "type": info.get("quoteType", ""),
            "exchange": info.get("exchange", ""),
            "currency": info.get("currency", ""),
        }

    def _format_search_result(self, quote: Dict) -> AssetSearchResult:
        return {
            "symbol": quote.get("symbol", ""),
            "name": quote.get("longname", quote.get("shortname", "")),
            "type": quote.get("quoteType", ""),
            "exchange": quote.get("exchange", ""),
            "currency": "",
        }

    def get_current_price(self, symbol: str) -> Optional[float]:
        """Get the current price of an asset."""
        logger.info(f"Getting current price for {symbol}")
        try:
            cached_data = self.cache_manager._get_cached_data(symbol, "asset_info")
            if cached_data and cached_data.get("current_price"):
                return cached_data["current_price"]

            ticker = yf.Ticker(symbol)
            info = ticker.info
            price = float(info.get("regularMarketPrice", 0))
            logger.info(f"Successfully fetched current price for {symbol}: {price}")
            return price
        except Exception as e:
            logger.error(f"Error getting current price for {symbol}: {str(e)}")
            return None
