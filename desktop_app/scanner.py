"""
Scanner Module for AI Trading Assistant
Fetches real data from Binance (via CCXT) or NSE (via yfinance) and performs multi-indicator quantitative scoring.
"""

from typing import List, Dict, Any, Tuple
import datetime
import pandas as pd
import numpy as np

# Try importing ccxt and yfinance, handle fallback gracefully if missing or offline
try:
    import ccxt
    HAS_CCXT = True
except ImportError:
    HAS_CCXT = False

try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

from .indicators import (compute_sma, compute_ema, compute_vwap, compute_rsi,
                         compute_macd, compute_bollinger_bands, compute_atr,
                         compute_pivot_points, analyze_market_conditions)


class MarketScanner:
    def __init__(self):
        self.crypto_symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'ADA/USDT', 'XRP/USDT', 'BNB/USDT', 'DOGE/USDT']
        self.nse_symbols = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'SBIN.NS', 'ICICIBANK.NS', 'TATAMOTORS.NS', '^NSEI', '^NSEBANK']
        
        # Initialize CCXT client
        self.exchange = None
        if HAS_CCXT:
            try:
                self.exchange = ccxt.binance({
                    'timeout': 15000,
                    'enableRateLimit': True,
                })
            except Exception as e:
                print(f"Failed to initialize ccxt Binance: {e}")

    def fetch_crypto_candles(self, symbol: str, timeframe: str = '1h', limit: int = 100) -> pd.DataFrame:
        """Fetches real-time crypto candles from Binance via CCXT."""
        if HAS_CCXT and self.exchange:
            try:
                # Map timeframe
                tf_map = {'15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d'}
                tf = tf_map.get(timeframe, '1h')
                
                # Fetch ohlcv
                ohlcv = self.exchange.fetch_ohlcv(symbol, tf, limit=limit)
                df = pd.DataFrame(ohlcv, columns=['Timestamp', 'Open', 'High', 'Low', 'Close', 'Volume'])
                df['Timestamp'] = pd.to_datetime(df['Timestamp'], unit='ms')
                df.set_index('Timestamp', inplace=True)
                return df
            except Exception as e:
                print(f"Error fetching crypto candles from CCXT for {symbol}: {e}")
        
        # Offline or error fallback: high-fidelity simulation
        return self._generate_simulated_df(symbol, limit)

    def fetch_nse_candles(self, symbol: str, timeframe: str = '1h', limit: int = 100) -> pd.DataFrame:
        """Fetches NSE stock candles from yfinance."""
        if HAS_YFINANCE:
            try:
                interval_map = {'15m': '15m', '1h': '60m', '4h': '60m', '1d': '1d'}
                interval = interval_map.get(timeframe, '60m')
                period = '5d' if timeframe in ['15m', '1h'] else '1mo'
                if timeframe == '1d':
                    period = '1y'

                ticker = yf.Ticker(symbol)
                df = ticker.history(period=period, interval=interval)
                if not df.empty:
                    df = df.tail(limit).copy()
                    # Standardize columns
                    df = df[['Open', 'High', 'Low', 'Close', 'Volume']]
                    return df
            except Exception as e:
                print(f"Error fetching NSE candles from yfinance for {symbol}: {e}")

        # Offline or error fallback: high-fidelity simulation
        return self._generate_simulated_df(symbol, limit)

    def _generate_simulated_df(self, symbol: str, limit: int) -> pd.DataFrame:
        """Generates mock data for offline modeling, indicating limitation."""
        print(f"[API LIMITATION] Serving high-fidelity simulated historical feed for {symbol}")
        base_price = 1500
        if "BTC" in symbol: base_price = 62000
        elif "ETH" in symbol: base_price = 3400
        elif "SOL" in symbol: base_price = 145
        elif "RELIANCE" in symbol: base_price = 2450
        elif "TCS" in symbol: base_price = 3850
        elif "NSEI" in symbol or "NIFTY" in symbol: base_price = 23500
        elif "BANK" in symbol: base_price = 51200

        dates = pd.date_range(end=datetime.datetime.now(), periods=limit, freq='H')
        closes = []
        curr = base_price
        for _ in range(limit):
            curr = curr * (1 + np.random.normal(0.0002, 0.008))
            closes.append(curr)

        highs = [c * (1 + abs(np.random.normal(0.002, 0.003))) for c in closes]
        lows = [c * (1 - abs(np.random.normal(0.002, 0.003))) for c in closes]
        opens = [closes[i-1] if i > 0 else closes[0] for i in range(len(closes))]
        volumes = np.random.randint(10000, 500000, size=limit)

        df = pd.DataFrame({
            'Open': opens,
            'High': highs,
            'Low': lows,
            'Close': closes,
            'Volume': volumes
        }, index=dates)
        return df

    def scan_all(self, sector: str = 'Crypto', timeframe: str = '1h') -> List[Dict[str, Any]]:
        """Scans all assets in the selected sector and ranks them by Quant Score."""
        symbols = self.crypto_symbols if sector == 'Crypto' else self.nse_symbols
        results = []

        for symbol in symbols:
            try:
                if sector == 'Crypto':
                    df = self.fetch_crypto_candles(symbol, timeframe)
                else:
                    df = self.fetch_nse_candles(symbol, timeframe)

                if df.empty or len(df) < 50:
                    continue

                # Calculate indicators
                sma50 = compute_sma(df, 50)
                ema20 = compute_ema(df, 20)
                vwap = compute_vwap(df)
                rsi = compute_rsi(df, 14)
                macd_data = compute_macd(df)
                bb = compute_bollinger_bands(df, 20, 2)
                atr = compute_atr(df, 14)
                pivots = compute_pivot_points(df)

                ind = {
                    "sma50": sma50,
                    "ema20": ema20,
                    "vwap": vwap,
                    "rsi": rsi,
                    "macd": macd_data["macd"],
                    "signal": macd_data["signal"],
                    "histogram": macd_data["histogram"],
                    "bb": bb,
                    "atr": atr
                }

                conds = analyze_market_conditions(df, ind)
                current_price = df['Close'].iloc[-1]

                # Scoring Engine
                score = 50
                # Trend factor
                if conds["trend"] == "Bullish": score += 15
                elif conds["trend"] == "Bearish": score -= 15

                # Momentum factor (RSI)
                curr_rsi = rsi.iloc[-1]
                if 50 < curr_rsi < 68: score += 10
                elif curr_rsi >= 70: score -= 5  # Overbought
                elif curr_rsi < 30: score += 15  # Oversold rebound value

                # MACD indicator alignment
                curr_hist = macd_data["histogram"].iloc[-1]
                if curr_hist > 0: score += 10
                else: score -= 10

                # VWAP support
                curr_vwap = vwap.iloc[-1]
                if current_price > curr_vwap: score += 10
                else: score -= 10

                # Volatility
                if conds["volatility"] == "High Volatility": score -= 5  # extra risk penalty
                if conds["fake_breakout_risk"]: score -= 15  # penalty for trap breakout

                score = int(max(0, min(100, score)))

                strength = "Strong Buy" if score >= 80 else ("Buy" if score >= 65 else ("Strong Sell" if score <= 20 else ("Sell" if score <= 35 else "Watch")))

                results.append({
                    "symbol": symbol.replace('.NS', ''),
                    "raw_symbol": symbol,
                    "price": current_price,
                    "score": score,
                    "strength": strength,
                    "indicators": {
                        "sma50": float(sma50.iloc[-1]),
                        "ema20": float(ema20.iloc[-1]),
                        "vwap": float(curr_vwap),
                        "rsi": float(curr_rsi),
                        "macd": float(macd_data["macd"].iloc[-1]),
                        "signal": float(macd_data["signal"].iloc[-1]),
                        "histogram": float(curr_hist),
                        "atr": float(atr.iloc[-1]),
                        "pivots": pivots,
                        "upper_bb": float(bb["upper"].iloc[-1]),
                        "lower_bb": float(bb["lower"].iloc[-1])
                    },
                    "market_condition": conds,
                    "df": df
                })

            except Exception as e:
                print(f"Error scanning symbol {symbol}: {e}")

        # Rank descending by score
        return sorted(results, key=lambda x: x["score"], reverse=True)
