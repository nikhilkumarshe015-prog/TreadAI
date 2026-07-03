"""
Indicators Module for AI Trading Assistant
Calculates professional trading indicators using pandas.
"""

from typing import Dict, Any, List
import pandas as pd
import numpy as np


def compute_sma(df: pd.DataFrame, period: int = 50) -> pd.Series:
    """Calculates Simple Moving Average."""
    try:
        return df['Close'].rolling(window=period).mean()
    except Exception as e:
        print(f"Error computing SMA: {e}")
        return pd.Series(dtype='float64')


def compute_ema(df: pd.DataFrame, period: int = 20) -> pd.Series:
    """Calculates Exponential Moving Average."""
    try:
        return df['Close'].ewm(span=period, adjust=False).mean()
    except Exception as e:
        print(f"Error computing EMA: {e}")
        return pd.Series(dtype='float64')


def compute_vwap(df: pd.DataFrame) -> pd.Series:
    """Calculates Volume Weighted Average Price."""
    try:
        typical_price = (df['High'] + df['Low'] + df['Close']) / 3
        tp_v = typical_price * df['Volume']
        return tp_v.cumsum() / df['Volume'].cumsum()
    except Exception as e:
        print(f"Error computing VWAP: {e}")
        return df['Close']  # Fallback


def compute_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Calculates Relative Strength Index."""
    try:
        delta = df['Close'].diff()
        gain = (delta.where(delta > 0, 0)).copy()
        loss = (-delta.where(delta < 0, 0)).copy()

        avg_gain = gain.rolling(window=period).mean()
        avg_loss = loss.rolling(window=period).mean()

        # Wilders smoothing
        for i in range(period, len(df)):
            avg_gain.iloc[i] = (avg_gain.iloc[i-1] * (period - 1) + gain.iloc[i]) / period
            avg_loss.iloc[i] = (avg_loss.iloc[i-1] * (period - 1) + loss.iloc[i]) / period

        rs = avg_gain / np.where(avg_loss == 0, 1e-5, avg_loss)
        return 100 - (100 / (1 + rs))
    except Exception as e:
        print(f"Error computing RSI: {e}")
        return pd.Series(50, index=df.index)


def compute_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, pd.Series]:
    """Calculates MACD, Signal Line, and Histogram."""
    try:
        fast_ema = df['Close'].ewm(span=fast, adjust=False).mean()
        slow_ema = df['Close'].ewm(span=slow, adjust=False).mean()
        macd_line = fast_ema - slow_ema
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        return {
            "macd": macd_line,
            "signal": signal_line,
            "histogram": histogram
        }
    except Exception as e:
        print(f"Error computing MACD: {e}")
        zero_series = pd.Series(0.0, index=df.index)
        return {"macd": zero_series, "signal": zero_series, "histogram": zero_series}


def compute_bollinger_bands(df: pd.DataFrame, period: int = 20, num_std: int = 2) -> Dict[str, pd.Series]:
    """Calculates Bollinger Bands (Upper, Middle, Lower)."""
    try:
        middle = df['Close'].rolling(window=period).mean()
        std_dev = df['Close'].rolling(window=period).std()
        upper = middle + (num_std * std_dev)
        lower = middle - (num_std * std_dev)
        return {"upper": upper, "middle": middle, "lower": lower}
    except Exception as e:
        print(f"Error computing BB: {e}")
        return {"upper": df['Close'], "middle": df['Close'], "lower": df['Close']}


def compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Calculates Average True Range."""
    try:
        high_low = df['High'] - df['Low']
        high_close = np.abs(df['High'] - df['Close'].shift())
        low_close = np.abs(df['Low'] - df['Close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        return true_range.rolling(window=period).mean()
    except Exception as e:
        print(f"Error computing ATR: {e}")
        return pd.Series(0.0, index=df.index)


def compute_pivot_points(df: pd.DataFrame) -> Dict[str, float]:
    """Calculates Daily Pivot Points based on previous candle."""
    try:
        if len(df) < 2:
            return {"p": 0.0, "r1": 0.0, "r2": 0.0, "s1": 0.0, "s2": 0.0}
        prev = df.iloc[-2]
        high, low, close = prev['High'], prev['Low'], prev['Close']
        p = (high + low + close) / 3
        r1 = (2 * p) - low
        s1 = (2 * p) - high
        r2 = p + (high - low)
        s2 = p - (high - low)
        return {
            "p": float(p),
            "r1": float(r1),
            "r2": float(r2),
            "s1": float(s1),
            "s2": float(s2)
        }
    except Exception as e:
        print(f"Error computing pivot points: {e}")
        return {"p": 0.0, "r1": 0.0, "r2": 0.0, "s1": 0.0, "s2": 0.0}


def analyze_market_conditions(df: pd.DataFrame, ind: Dict[str, Any]) -> Dict[str, Any]:
    """Analyzes market conditions (trend, momentum, volatility, fake breakouts, etc.)"""
    try:
        current_price = df['Close'].iloc[-1]
        ema20 = ind["ema20"].iloc[-1]
        sma50 = ind["sma50"].iloc[-1]
        rsi = ind["rsi"].iloc[-1]
        atr = ind["atr"].iloc[-1]

        # Trend Determination
        if current_price > ema20 and ema20 > sma50:
            trend = "Bullish"
        elif current_price < ema20 and ema20 < sma50:
            trend = "Bearish"
        else:
            trend = "Sideways"

        # Momentum Determination
        if rsi > 65:
            momentum = "Strong Bullish"
        elif rsi < 35:
            momentum = "Strong Bearish"
        elif 45 <= rsi <= 55:
            momentum = "Neutral/Flat"
        else:
            momentum = "Moderate"

        # Volatility Determination
        vol_pct = atr / current_price
        if vol_pct > 0.035:
            volatility = "High Volatility"
        elif vol_pct < 0.012:
            volatility = "Low Volatility"
        else:
            volatility = "Normal"

        # Market State / Warning Detection
        state = "Range Bound"
        if trend == "Bullish" and momentum == "Strong Bullish":
            state = "Strong Trending Up"
        elif trend == "Bearish" and momentum == "Strong Bearish":
            state = "Strong Trending Down"
        elif volatility == "High Volatility" and trend == "Sideways":
            state = "High Range Chop"

        # Fake Breakout warning
        bb = ind["bb"]
        upper_bb = bb["upper"].iloc[-1]
        lower_bb = bb["lower"].iloc[-1]
        prev_close = df['Close'].iloc[-2]
        prev_high = df['High'].iloc[-2]

        fake_breakout = False
        if prev_high > upper_bb and prev_close < upper_bb and current_price < upper_bb:
            fake_breakout = True  # Pierce and reject upper band
        elif df['Low'].iloc[-2] < lower_bb and prev_close > lower_bb and current_price > lower_bb:
            fake_breakout = True

        return {
            "trend": trend,
            "momentum": momentum,
            "volatility": volatility,
            "state": state,
            "fake_breakout_risk": fake_breakout
        }
    except Exception as e:
        print(f"Error determining market conditions: {e}")
        return {
            "trend": "Sideways",
            "momentum": "Neutral",
            "volatility": "Normal",
            "state": "Unknown",
            "fake_breakout_risk": False
        }
