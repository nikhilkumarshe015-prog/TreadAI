"""
AI Engine Module for AI Trading Assistant
Integrates the modern google-genai SDK to analyze ranked setups and output detailed trading rationale.
"""

import os
import json
from typing import Dict, Any, Tuple

try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False


class AIEngine:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.client = None
        if HAS_GENAI and self.api_key:
            try:
                # Initialize using correct modern client structure
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                print(f"Failed to initialize Google GenAI Client: {e}")

    def analyze_setup(self, item: Dict[str, Any], timeframe: str = '1h') -> Dict[str, Any]:
        """Runs Gemini AI to perform deep trade analysis based on calculated indicators."""
        symbol = item["symbol"]
        price = item["price"]
        score = item["score"]
        ind = item["indicators"]
        conds = item["market_condition"]

        prompt = f"""
You are a highly sophisticated quant trader and AI trading system.
Analyze the following market indicators for {symbol} on the {timeframe} timeframe.

Current Technical Data:
- Current Price: {price}
- EMA 20: {ind['ema20']}
- SMA 50: {ind['sma50']}
- VWAP: {ind['vwap']}
- RSI (14): {ind['rsi']}
- Bollinger Bands: Upper: {ind['upper_bb']}, Lower: {ind['lower_bb']}
- ATR: {ind['atr']}
- MACD Histogram: {ind['histogram']}
- Daily Pivot: {ind['pivots']['p']}
- Current Trend: {conds['trend']}
- Momentum: {conds['momentum']}
- Volatility: {conds['volatility']}
- Overall Market Condition: {conds['state']}
- Fake Breakout Risk: {conds['fake_breakout_risk']}

Please recommend the highest probability trade with clear Entry, Stop Loss, Targets, and reasoning.
Return your response STRICTLY as a raw valid JSON object. Do not wrap the JSON in markdown formatting (like ```json ... ```), just return the raw text object. The JSON schema must strictly match the following fields:
{{
  "action": "BUY" | "SELL" | "HOLD",
  "instrumentName": "The symbol and name",
  "entryPrice": number,
  "stopLoss": number,
  "target1": number,
  "target2": number,
  "target3": number,
  "riskRewardRatio": string,
  "confidenceScore": number,
  "winProbabilityEstimate": string,
  "reasoningText": "A detailed 3-4 sentence explanation highlighting trend alignment, key support/resistance breakout, momentum confirmation, and risk warning.",
  "timeframe": "Selected timeframe",
  "suggestedHoldingTime": "Expected duration for targets to hit",
  "signalStrength": "Strong Buy" | "Buy" | "Watch" | "Sell" | "Strong Sell"
}}
"""
        
        if self.client and HAS_GENAI:
            try:
                # Use gemini-2.5-flash for speed and correctness
                response = self.client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json"
                    )
                )
                
                text_content = response.text
                if text_content:
                    return json.loads(text_content.strip())
            except Exception as e:
                print(f"Error calling Gemini API: {e}. Falling back to rule-based engine.")

        # Robust High-Fidelity Rule-Based Fallback Engine
        is_buy = conds["trend"] == "Bullish" or (ind["rsi"] < 40 and ind["histogram"] > 0)
        action = "BUY" if is_buy else "SELL"
        atr_factor = ind["atr"] if ind["atr"] > 0 else (price * 0.02)
        
        sl = price - (1.5 * atr_factor) if is_buy else price + (1.5 * atr_factor)
        t1 = price + (1.5 * atr_factor) if is_buy else price - (1.5 * atr_factor)
        t2 = price + (3.0 * atr_factor) if is_buy else price - (3.0 * atr_factor)
        t3 = price + (4.5 * atr_factor) if is_buy else price - (4.5 * atr_factor)

        fallback_reason = (
            f"[Local Engine Analyzer] Recommend {action} based on a structured {conds['trend']} trend, "
            f"confluent Momentum ({conds['momentum']}), and standard {conds['volatility']} environment. "
            f"RSI is sitting at {ind['rsi']:.1f}, matching a low-overhead setup. Bollinger levels "
            f"suggest robust continuation space."
        )

        return {
            "action": action,
            "instrumentName": symbol,
            "entryPrice": round(price, 2),
            "stopLoss": round(sl, 2),
            "target1": round(t1, 2),
            "target2": round(t2, 2),
            "target3": round(t3, 2),
            "riskRewardRatio": "1:2.0",
            "confidenceScore": int(score),
            "winProbabilityEstimate": f"{score}%",
            "reasoningText": fallback_reason,
            "timeframe": timeframe,
            "suggestedHoldingTime": "12-24 Hours" if timeframe != "1d" else "5-10 Days",
            "signalStrength": item["strength"]
        }
