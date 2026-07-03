"""
Risk Management Module for AI Trading Assistant
Calculates trade sizes, allocations, max risk thresholds, and warns about poor setups.
"""

from typing import Dict, Any, Tuple

class RiskManager:
    @staticmethod
    def calculate_position(
        account_size: float,
        risk_percentage: float,
        entry: float,
        stop_loss: float,
        targets: list
    ) -> Dict[str, Any]:
        """
        Calculates suggested position size, reward/risk ratios, and warning flags.
        """
        try:
            if entry <= 0 or stop_loss <= 0:
                return {"error": "Invalid price parameters"}

            risk_per_share = abs(entry - stop_loss)
            if risk_per_share == 0:
                return {"error": "Entry and Stop Loss cannot be equal"}

            # Risk amount
            risk_cash = account_size * (risk_percentage / 100.0)
            
            # Position size units
            units = risk_cash / risk_per_share
            total_cost = units * entry

            # Risk/Reward calculations
            avg_target = sum(targets) / len(targets) if targets else entry * 1.05
            reward_per_share = abs(avg_target - entry)
            rr_ratio = reward_per_share / risk_per_share if risk_per_share > 0 else 0

            # Warnings
            warning = None
            if rr_ratio < 1.5:
                warning = "⚠️ Risk-Reward Ratio is sub-optimal (< 1.5). Consider skipping this trade."
            elif total_cost > account_size * 2:
                warning = "⚠️ High Leverage Alert: Position size exceeds 2x your account equity."

            max_suggested_loss = risk_cash
            max_suggested_profit = units * (targets[2] - entry if len(targets) >= 3 else reward_per_share)

            return {
                "units": float(round(units, 4)),
                "total_cost": float(round(total_cost, 2)),
                "risk_cash": float(round(risk_cash, 2)),
                "rr_ratio": float(round(rr_ratio, 2)),
                "max_suggested_loss": float(round(max_suggested_loss, 2)),
                "max_suggested_profit": float(round(abs(max_suggested_profit), 2)),
                "warning": warning
            }
        except Exception as e:
            return {"error": f"Calculation error: {e}"}
