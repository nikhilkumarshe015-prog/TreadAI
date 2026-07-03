"""
Chart Widget Module for AI Trading Assistant
Integrates Matplotlib into PySide6 to draw interactive and beautiful charts.
"""

import sys
from PySide6.QtWidgets import QWidget, QVBoxLayout
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas
import matplotlib.pyplot as plt
import pandas as pd


class CandlestickChartWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(0, 0, 0, 0)

        # Create Matplotlib Figure
        self.fig, self.ax = plt.subplots(figsize=(6, 4))
        self.fig.patch.set_facecolor('#121212')  # Match terminal background
        self.ax.set_facecolor('#1e1e1e')

        self.canvas = FigureCanvas(self.fig)
        self.layout.addWidget(self.canvas)

    def draw_chart(self, df: pd.DataFrame, symbol: str, setup: dict = None):
        """Draws a professional candlestick chart with overlays."""
        try:
            self.ax.clear()
            self.ax.set_facecolor('#181818')

            # Render standard close line as simple elegant area chart or candlesticks
            prices = df['Close'].tail(50)
            dates = range(len(prices))

            self.ax.plot(dates, prices, color='#00e676', linewidth=2, label=f'{symbol} Close')
            self.ax.fill_between(dates, prices, prices.min() * 0.99, color='#00e676', alpha=0.08)

            # Draw support and resistance estimates
            high_val = prices.max()
            low_val = prices.min()
            self.ax.axhline(high_val, color='#ff1744', linestyle='--', alpha=0.4, label='Resistance')
            self.ax.axhline(low_val, color='#2979ff', linestyle='--', alpha=0.4, label='Support')

            # If an AI trade setup is active, plot targets and stop-losses
            if setup:
                entry = setup.get("entryPrice", prices.iloc[-1])
                sl = setup.get("stopLoss")
                t1 = setup.get("target1")
                t2 = setup.get("target2")
                action = setup.get("action", "BUY")

                # Horizontal markers
                self.ax.axhline(entry, color='#ffc400', linestyle='-', linewidth=1.5, label=f'Entry: {entry}')
                if sl:
                    self.ax.axhline(sl, color='#f44336', linestyle=':', linewidth=1.5, label=f'Stop Loss: {sl}')
                if t1:
                    self.ax.axhline(t1, color='#4caf50', linestyle='-.', linewidth=1.5, label=f'Target 1: {t1}')
                if t2:
                    self.ax.axhline(t2, color='#81c784', linestyle='-.', linewidth=1.5, label=f'Target 2: {t2}')

                # Text annotations
                self.ax.text(0, entry, f" Entry {entry}", color='#ffc400', fontsize=8, va='bottom')
                if sl:
                    self.ax.text(0, sl, f" SL {sl}", color='#f44336', fontsize=8, va='bottom')
                if t1:
                    self.ax.text(0, t1, f" Target 1 {t1}", color='#4caf50', fontsize=8, va='bottom')

            # Style chart labels
            self.ax.set_title(f"Bloomberg Terminal - {symbol}", color='#ffffff', fontsize=11, fontweight='bold', loc='left')
            self.ax.tick_params(colors='#888888', labelsize=8)
            self.ax.grid(True, color='#2c2c2c', linestyle=':', alpha=0.5)

            # Legends
            legend = self.ax.legend(facecolor='#1e1e1e', edgecolor='#2c2c2c', loc='upper left')
            for text in legend.get_texts():
                text.set_color('#ffffff')
                text.set_size(7)

            self.fig.tight_layout()
            self.canvas.draw()
        except Exception as e:
            print(f"Failed to draw chart: {e}")
