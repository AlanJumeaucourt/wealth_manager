import yfinance as yf
from typing import List, Dict, Optional
import pandas as pd
from datetime import datetime, timedelta
import requests
from urllib.parse import quote_plus

class StockService:
    def __init__(self):
        self.cache = {}  # Simple in-memory cache
        self.cache_duration = timedelta(minutes=15)  # Cache results for 15 minutes

    def search_assets(self, query: str) -> List[Dict[str, str]]:
        """
        Search for stocks and ETFs using both Yahoo Finance APIs.
        Combines direct symbol lookup and name-based search.
        """
        try:
            results = []
            # First try direct symbol lookup
            try:
                ticker = yf.Ticker(query)
                info = ticker.info
                if info and 'symbol' in info:
                    results.append({
                        'symbol': info.get('symbol', ''),
                        'name': info.get('longName', ''),
                        'type': info.get('quoteType', ''),
                        'exchange': info.get('exchange', ''),
                        'currency': info.get('currency', '')
                    })
            except Exception:
                pass

            # Then use Yahoo Finance search API
            search_url = f"https://query2.finance.yahoo.com/v1/finance/search?q={quote_plus(query)}&quotesCount=20&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(search_url, headers=headers)
            search_data = response.json()

            if 'quotes' in search_data:
                for quote in search_data['quotes']:
                    # Skip if we already have this symbol
                    if any(r['symbol'] == quote.get('symbol') for r in results):
                        continue

                    # Get additional info using yfinance
                    try:
                        ticker = yf.Ticker(quote.get('symbol', ''))
                        info = ticker.info
                        results.append({
                            'symbol': quote.get('symbol', ''),
                            'name': info.get('longName', quote.get('longname', quote.get('shortname', ''))),
                            'type': info.get('quoteType', quote.get('quoteType', '')),
                            'exchange': info.get('exchange', quote.get('exchange', '')),
                            'currency': info.get('currency', '')
                        })
                    except Exception as e:
                        print(f"Error fetching additional info for {quote.get('symbol')}: {str(e)}")
                        # Fall back to basic info from search
                        results.append({
                            'symbol': quote.get('symbol', ''),
                            'name': quote.get('longname', quote.get('shortname', '')),
                            'type': quote.get('quoteType', ''),
                            'exchange': quote.get('exchange', ''),
                            'currency': ''
                        })

            # Remove duplicates and None values
            cleaned_results = []
            seen_symbols = set()
            for result in results:
                symbol = result['symbol']
                if symbol and symbol not in seen_symbols and all(result.values()):
                    cleaned_results.append(result)
                    seen_symbols.add(symbol)

            return cleaned_results

        except Exception as e:
            print(f"Error in search_assets: {str(e)}")
            return []

    def get_asset_info(self, symbol: str) -> Optional[Dict]:
        """Get detailed information about a specific asset."""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            return {
                'symbol': symbol,
                'name': info.get('longName', ''),
                'type': info.get('quoteType', ''),
                'exchange': info.get('exchange', ''),
                'currency': info.get('currency', ''),
                'current_price': info.get('regularMarketPrice', None),
                'previous_close': info.get('regularMarketPreviousClose', None),
                'market_cap': info.get('marketCap', None),
                'volume': info.get('volume', None),
                'description': info.get('longBusinessSummary', '')
            }
        except Exception as e:
            print(f"Error in get_asset_info: {str(e)}")
            return None

    def get_historical_prices(self, symbol: str, period: str = '1y') -> List[Dict]:
        """Get historical price data for an asset."""
        try:
            ticker = yf.Ticker(symbol)
            # Get historical data with daily interval
            hist = ticker.history(period=period, interval='1d')
            
            # Format the response
            return [{
                'date': index.strftime('%Y-%m-%d'),
                'value': float(row['Close']),  # Use closing price as the value
                'volume': int(row['Volume']),
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close'])
            } for index, row in hist.iterrows()]
        except Exception as e:
            print(f"Error in get_historical_prices for {symbol}: {str(e)}")
            return []

    def get_current_price(self, symbol: str) -> Optional[float]:
        """Get the current price of an asset."""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            return float(info.get('regularMarketPrice', 0))
        except Exception as e:
            print(f"Error getting current price for {symbol}: {str(e)}")
            return None
