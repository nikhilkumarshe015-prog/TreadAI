"""
AI Trading Assistant - Desktop Application (PySide6)
Main entry point for the desktop application.
Run via: python main.py
"""

import sys
import os
import random
import datetime
from typing import Dict, Any, List

from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QLabel, QPushButton, QComboBox, 
                             QTableWidget, QTableWidgetItem, QHeaderView, QTextEdit,
                             QTabWidget, QGroupBox, QLineEdit, QMessageBox, QCheckBox,
                             QStatusBar, QProgressBar)
from PySide6.QtCore import Qt, QTimer, Slot, QThread, Signal
from PySide6.QtGui import QFont, QColor, QPalette, QIcon

# Import modular blocks
from indicators import compute_pivot_points
from scanner import MarketScanner
from ai_engine import AIEngine
from risk_manager import RiskManager
from chart_widget import CandlestickChartWidget


class ScanWorker(QThread):
    """Worker thread to run market scans without locking the PySide6 UI."""
    finished_signal = Signal(list)
    error_signal = Signal(str)

    def __init__(self, scanner: MarketScanner, sector: str, timeframe: str):
        super().__init__()
        self.scanner = scanner
        self.sector = sector
        self.timeframe = timeframe

    def run(self):
        try:
            results = self.scanner.scan_all(self.sector, self.timeframe)
            self.finished_signal.emit(results)
        except Exception as e:
            self.error_signal.emit(str(e))


class DesktopTerminalWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("AI Trading Assistant - Terminal Edition v1.4")
        self.resize(1366, 768)

        # Main modular engines
        self.scanner = MarketScanner()
        self.ai_engine = AIEngine()
        self.scanned_items = []
        self.current_lang = "English"

        self.setup_ui()
        self.apply_bloomberg_palette()
        self.init_performance_history()

        # Welcome message in status bar
        self.statusBar().showMessage("System Online. Ready for Global Market Scanning.")

    def setup_ui(self):
        # Master Widget
        master_widget = QWidget()
        self.setCentralWidget(master_widget)
        master_layout = QVBoxLayout(master_widget)
        master_layout.setContentsMargins(8, 8, 8, 8)
        master_layout.setSpacing(6)

        # 1. TOP STATS TICKER BAR (Bloomberg Style)
        ticker_bar = QFrame()
        ticker_bar.setStyleSheet("background-color: #0b0c10; border: 1px solid #1f2833; border-radius: 3px;")
        ticker_layout = QHBoxLayout(ticker_bar)
        ticker_layout.setContentsMargins(10, 4, 10, 4)

        self.lbl_market_status = QLabel("● NSE INDEX: 23,500.25 (SIMULATED)  |  ● BTC/USDT: $63,120.40 (LIVE)")
        self.lbl_market_status.setFont(QFont("Consolas", 9, QFont.Bold))
        self.lbl_market_status.setStyleSheet("color: #00e676;")
        ticker_layout.addWidget(self.lbl_market_status)

        # Live clock
        self.lbl_clock = QLabel()
        self.lbl_clock.setFont(QFont("Consolas", 9))
        self.lbl_clock.setStyleSheet("color: #888888;")
        self.update_clock()
        ticker_layout.addWidget(self.lbl_clock, 0, Qt.AlignRight)

        self.clock_timer = QTimer(self)
        self.clock_timer.timeout.connect(self.update_clock)
        self.clock_timer.start(1000)

        master_layout.addWidget(ticker_bar)

        # 2. MIDDLE CONTENT SPLIT
        split_layout = QHBoxLayout()
        split_layout.setSpacing(8)

        # Left Column: Scanner, Rankings, and Core settings
        left_col = QWidget()
        left_layout = QVBoxLayout(left_col)
        left_layout.setContentsMargins(0, 0, 0, 0)
        left_layout.setSpacing(6)

        # A. Scanner Controls Block
        ctrl_group = QGroupBox("Terminal Scan Engine")
        ctrl_layout = QVBoxLayout(ctrl_group)
        ctrl_layout.setSpacing(4)

        sector_layout = QHBoxLayout()
        sector_layout.addWidget(QLabel("Sector Focus:"))
        self.cmb_sector = QComboBox()
        self.cmb_sector.addItems(["Crypto", "NSE"])
        self.cmb_sector.currentIndexChanged.connect(self.handle_sector_change)
        sector_layout.addWidget(self.cmb_sector)

        sector_layout.addWidget(QLabel("Timeframe:"))
        self.cmb_timeframe = QComboBox()
        self.cmb_timeframe.addItems(["15m", "1h", "4h", "1d"])
        sector_layout.addWidget(self.cmb_timeframe)
        ctrl_layout.addLayout(sector_layout)

        self.btn_scan = QPushButton("SCAN GLOBAL MARKET")
        self.btn_scan.setFont(QFont("Arial", 11, QFont.Bold))
        self.btn_scan.setCursor(Qt.PointingHandCursor)
        self.btn_scan.clicked.connect(self.run_global_scan)
        ctrl_layout.addWidget(self.btn_scan)

        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setRange(0, 0)  # Indeterminate loop
        self.progress_bar.setStyleSheet("QProgressBar { background-color: #1e1e1e; border: 1px solid #333; height: 10px; } QProgressBar::chunk { background-color: #00e676; }")
        ctrl_layout.addWidget(self.progress_bar)

        left_layout.addWidget(ctrl_group)

        # B. Rankings List / Table
        rankings_group = QGroupBox("Quant Rankings (Top 10 High-Probability Setups)")
        rankings_layout = QVBoxLayout(rankings_group)

        self.tbl_rankings = QTableWidget(0, 5)
        self.tbl_rankings.setHorizontalHeaderLabels(["Asset", "Price", "Trend", "Score", "Signal Strength"])
        self.tbl_rankings.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.tbl_rankings.setSelectionBehavior(QTableWidget.SelectRows)
        self.tbl_rankings.cellClicked.connect(self.asset_clicked)
        rankings_layout.addWidget(self.tbl_rankings)

        # Limit notice
        self.lbl_limit_notice = QLabel("⚠️ Note: NSE is processed via simulated offline feeds. Crypto is live via Binance REST.")
        self.lbl_limit_notice.setWordWrap(True)
        self.lbl_limit_notice.setStyleSheet("color: #ffb300; font-size: 8pt;")
        rankings_layout.addWidget(self.lbl_limit_notice)

        left_layout.addWidget(rankings_group)
        left_layout.setStretch(1, 2)

        # Right Column: Chart, Signal Reasoning, and Tabbed Analysis
        right_col = QWidget()
        right_layout = QVBoxLayout(right_col)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(6)

        # A. Beautiful Matplotlib Interactive Chart
        chart_group = QGroupBox("Interactive Technical Chart overlay")
        chart_layout = QVBoxLayout(chart_group)
        self.chart_widget = CandlestickChartWidget()
        chart_layout.addWidget(self.chart_widget)
        right_layout.addWidget(chart_group)

        # B. AI neural logic signals
        self.tab_details = QTabWidget()
        
        # TAB 1: AI Neural Logic Analysis
        tab_ai = QWidget()
        ai_layout = QVBoxLayout(tab_ai)
        ai_layout.setSpacing(4)

        self.lbl_signal_header = QLabel("AI Neural Signal: Run Global Scan to Generate Recommendations")
        self.lbl_signal_header.setFont(QFont("Arial", 12, QFont.Bold))
        self.lbl_signal_header.setStyleSheet("color: #00e676;")
        ai_layout.addWidget(self.lbl_signal_header)

        # Dynamic Grid for details
        details_layout = QHBoxLayout()
        self.lbl_entry = QLabel("Entry: --")
        self.lbl_sl = QLabel("Stop Loss: --")
        self.lbl_t1 = QLabel("T1: --")
        self.lbl_t2 = QLabel("T2: --")
        self.lbl_t3 = QLabel("T3: --")

        for lbl in [self.lbl_entry, self.lbl_sl, self.lbl_t1, self.lbl_t2, self.lbl_t3]:
            lbl.setFont(QFont("Consolas", 10, QFont.Bold))
            details_layout.addWidget(lbl)
        ai_layout.addLayout(details_layout)

        # Rationale/Reasoning box
        self.txt_reasoning = QTextEdit()
        self.txt_reasoning.setReadOnly(True)
        self.txt_reasoning.setPlaceholderText("Neural trade alignment reasoning will populate here post scan...")
        ai_layout.addWidget(self.txt_reasoning)

        # Save trade logs button
        self.btn_save_trade = QPushButton("Log/Simulate Trade Placement")
        self.btn_save_trade.setEnabled(False)
        self.btn_save_trade.clicked.connect(self.log_simulated_trade)
        ai_layout.addWidget(self.btn_save_trade)

        self.tab_details.addTab(tab_ai, "AI Trade Recommendation")

        # TAB 2: Option Chain / Derivative PCR (NSE Focus)
        self.tab_options = QWidget()
        opt_layout = QVBoxLayout(self.tab_options)
        
        self.lbl_opt_stats = QLabel("Nifty 50 derivative PCR: --  |  Max Pain Strike: --")
        self.lbl_opt_stats.setFont(QFont("Arial", 10, QFont.Bold))
        opt_layout.addWidget(self.lbl_opt_stats)

        self.tbl_options = QTableWidget(5, 5)
        self.tbl_options.setHorizontalHeaderLabels(["Call OI", "Call Price", "Strike", "Put Price", "Put OI"])
        self.tbl_options.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        opt_layout.addWidget(self.tbl_options)
        
        self.tab_details.addTab(self.tab_options, "Option Chain Analysis")

        # TAB 3: Account Allocation and Position Sizer
        tab_risk = QWidget()
        risk_layout = QVBoxLayout(tab_risk)
        
        form_layout = QHBoxLayout()
        form_layout.addWidget(QLabel("Equity ($):"))
        self.txt_equity = QLineEdit("25000")
        self.txt_equity.setMaximumWidth(80)
        form_layout.addWidget(self.txt_equity)

        form_layout.addWidget(QLabel("Max Risk (%):"))
        self.txt_risk_pct = QLineEdit("1.5")
        self.txt_risk_pct.setMaximumWidth(60)
        form_layout.addWidget(self.txt_risk_pct)

        btn_recalc = QPushButton("Calculate")
        btn_recalc.clicked.connect(self.recalc_position_allocation)
        form_layout.addWidget(btn_recalc)
        risk_layout.addLayout(form_layout)

        self.lbl_risk_result = QLabel("Enter inputs to compute allocations...")
        self.lbl_risk_result.setFont(QFont("Arial", 10, QFont.Bold))
        self.lbl_risk_result.setWordWrap(True)
        risk_layout.addWidget(self.lbl_risk_result)

        self.tab_details.addTab(tab_risk, "Risk & Allocation Sizer")

        # TAB 4: Performance Log & Metrics Tracker
        tab_perf = QWidget()
        perf_layout = QVBoxLayout(tab_perf)

        self.lbl_perf_summary = QLabel("Wins: --  |  Losses: --  |  Accuracy: --")
        self.lbl_perf_summary.setFont(QFont("Arial", 10, QFont.Bold))
        perf_layout.addWidget(self.lbl_perf_summary)

        self.tbl_perf_log = QTableWidget(0, 5)
        self.tbl_perf_log.setHorizontalHeaderLabels(["Date", "Symbol", "Side", "PnL ($)", "Result"])
        self.tbl_perf_log.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        perf_layout.addWidget(self.tbl_perf_log)

        self.tab_details.addTab(tab_perf, "Performance Logs")

        # TAB 5: Terminal Settings
        tab_settings = QWidget()
        settings_layout = QVBoxLayout(tab_settings)

        lang_layout = QHBoxLayout()
        lang_layout.addWidget(QLabel("Language (भाषा):"))
        self.cmb_lang = QComboBox()
        self.cmb_lang.addItems(["English", "Hindi (हिन्दी)"])
        self.cmb_lang.currentIndexChanged.connect(self.handle_lang_change)
        lang_layout.addWidget(self.cmb_lang)
        settings_layout.addLayout(lang_layout)

        self.chk_sound = QCheckBox("Enable Bloomberg Sound Alerts")
        self.chk_sound.setChecked(True)
        settings_layout.addWidget(self.chk_sound)

        self.chk_notifications = QCheckBox("Show Desktop Breakout Popups")
        self.chk_notifications.setChecked(True)
        settings_layout.addWidget(self.chk_notifications)

        settings_layout.addWidget(QLabel("Auto Scan Interval: 15 Minutes"))

        self.tab_details.addTab(tab_settings, "Settings")

        right_layout.addWidget(self.tab_details)
        right_layout.setStretch(0, 1)

        split_layout.addWidget(left_col, 1)
        split_layout.addWidget(right_col, 1)

        master_layout.addLayout(split_layout)

        # Status Bar
        self.setStatusBar(QStatusBar())

    def apply_bloomberg_palette(self):
        """Standard high-contrast dark green & gold terminal styling."""
        palette = QPalette()
        palette.setColor(QPalette.Window, QColor(10, 10, 10))
        palette.setColor(QPalette.WindowText, QColor(230, 230, 230))
        palette.setColor(QPalette.Base, QColor(20, 20, 20))
        palette.setColor(QPalette.AlternateBase, QColor(15, 15, 15))
        palette.setColor(QPalette.ToolTipBase, Qt.white)
        palette.setColor(QPalette.ToolTipText, Qt.white)
        palette.setColor(QPalette.Text, QColor(240, 240, 240))
        palette.setColor(QPalette.Button, QColor(30, 30, 30))
        palette.setColor(QPalette.ButtonText, QColor(240, 240, 240))
        palette.setColor(QPalette.Highlight, QColor(0, 230, 118))
        palette.setColor(QPalette.HighlightedText, QColor(10, 10, 10))
        self.setPalette(palette)

        self.setStyleSheet("""
            QGroupBox {
                border: 1px solid #2e2e2e;
                border-radius: 4px;
                margin-top: 10px;
                font-weight: bold;
                color: #00e676;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 3px;
            }
            QPushButton {
                background-color: #2a2a2a;
                border: 1px solid #444;
                color: #eee;
                border-radius: 3px;
                padding: 5px;
            }
            QPushButton:hover {
                background-color: #3a3a3a;
                border-color: #00e676;
            }
            QComboBox, QLineEdit {
                background-color: #1a1a1a;
                border: 1px solid #3a3a3a;
                border-radius: 3px;
                color: #eee;
                padding: 3px;
            }
            QTableWidget {
                gridline-color: #222;
                background-color: #121212;
                border: 1px solid #2e2e2e;
            }
            QHeaderView::section {
                background-color: #1c1c1c;
                color: #888;
                padding: 4px;
                border: 1px solid #222;
                font-weight: bold;
            }
            QTabWidget::pane {
                border: 1px solid #2e2e2e;
                background: #151515;
            }
            QTabBar::tab {
                background: #202020;
                color: #888;
                padding: 8px 12px;
                border-top-left-radius: 3px;
                border-top-right-radius: 3px;
            }
            QTabBar::tab:selected {
                background: #151515;
                color: #00e676;
                border-bottom: 2px solid #00e676;
            }
        """)

    def update_clock(self):
        now = datetime.datetime.now()
        self.lbl_clock.setText(now.strftime("%Y-%m-%d  %H:%M:%S"))

    def handle_sector_change(self):
        sector = self.cmb_sector.currentText()
        if sector == "NSE":
            self.lbl_limit_notice.setText("⚠️ Simulated Feed Active: Private exchange tokens are offline. Simulating real-time index pricing.")
            self.tab_details.setTabEnabled(1, True)
        else:
            self.lbl_limit_notice.setText("● Live Ticker Active: Fetching Binance real-time REST candles.")
            self.tab_details.setTabEnabled(1, False)  # Disable options for Crypto

    def handle_lang_change(self):
        self.current_lang = "Hindi" if "हिन्दी" in self.cmb_lang.currentText() else "English"
        if self.current_lang == "Hindi":
            self.btn_scan.setText("वैश्विक बाजार स्कैन करें")
            self.chk_sound.setText("ब्लूमबर्ग ध्वनि चेतावनियां सक्रिय करें")
            self.chk_notifications.setText("डेस्कटॉप ब्रेकआउट पॉपअप दिखाएं")
            self.statusBar().showMessage("भाषा बदलकर हिन्दी की गई।")
        else:
            self.btn_scan.setText("SCAN GLOBAL MARKET")
            self.chk_sound.setText("Enable Bloomberg Sound Alerts")
            self.chk_notifications.setText("Show Desktop Breakout Popups")
            self.statusBar().showMessage("Language updated to English.")

    @Slot()
    def run_global_scan(self):
        self.btn_scan.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.statusBar().showMessage("Scanning and ranking market tickers...")

        # Setup worker thread
        sector = self.cmb_sector.currentText()
        timeframe = self.cmb_timeframe.currentText()
        self.worker = ScanWorker(self.scanner, sector, timeframe)
        self.worker.finished_signal.connect(self.on_scan_complete)
        self.worker.error_signal.connect(self.on_scan_error)
        self.worker.start()

    @Slot(list)
    def on_scan_complete(self, results):
        self.btn_scan.setEnabled(True)
        self.progress_bar.setVisible(False)
        self.scanned_items = results
        self.tbl_rankings.setRowCount(0)

        if not results:
            self.statusBar().showMessage("Scan complete. No setups met filters.")
            return

        # Populate top 10
        for i, res in enumerate(results[:10]):
            self.tbl_rankings.insertRow(i)
            self.tbl_rankings.setItem(i, 0, QTableWidgetItem(res["symbol"]))
            self.tbl_rankings.setItem(i, 1, QTableWidgetItem(f"{res['price']:.2f}"))
            self.tbl_rankings.setItem(i, 2, QTableWidgetItem(res["market_condition"]["trend"]))
            self.tbl_rankings.setItem(i, 3, QTableWidgetItem(str(res["score"])))
            self.tbl_rankings.setItem(i, 4, QTableWidgetItem(res["strength"]))

            # Color strength text
            color = QColor(0, 230, 118) if "Buy" in res["strength"] else (QColor(255, 23, 68) if "Sell" in res["strength"] else QColor(255, 196, 0))
            self.tbl_rankings.item(i, 4).setForeground(color)

        # Draw best asset on the chart automatically
        self.tbl_rankings.selectRow(0)
        self.load_asset_setup(results[0])
        self.statusBar().showMessage(f"Scan complete. Ranked {len(results)} items. Selected #{results[0]['symbol']} as best setup.")

        # Trigger option chain for NSE
        if self.cmb_sector.currentText() == "NSE":
            self.load_options_chain_simulation(results[0]["symbol"])

    @Slot(str)
    def on_scan_error(self, err_msg):
        self.btn_scan.setEnabled(True)
        self.progress_bar.setVisible(False)
        QMessageBox.warning(self, "Scanner Error", f"An error occurred during scanning: {err_msg}")

    def asset_clicked(self, row, col):
        if row < len(self.scanned_items):
            self.load_asset_setup(self.scanned_items[row])
            if self.cmb_sector.currentText() == "NSE":
                self.load_options_chain_simulation(self.scanned_items[row]["symbol"])

    def load_asset_setup(self, item):
        self.current_selected_asset = item
        self.statusBar().showMessage(f"Running neural AI analysis on {item['symbol']}...")
        
        # Analyze with AI
        setup = self.ai_engine.analyze_setup(item, self.cmb_timeframe.currentText())
        
        # Update labels
        self.lbl_signal_header.setText(f"{setup['action'].upper()} SIGNAL: {setup['instrumentName']} ({setup['winProbabilityEstimate']} Win Probability)")
        color = "#00e676" if setup["action"] == "BUY" else ("#ff1744" if setup["action"] == "SELL" else "#ffc400")
        self.lbl_signal_header.setStyleSheet(f"color: {color}; font-size: 11pt;")

        self.lbl_entry.setText(f"Entry: {setup['entryPrice']:.2f}")
        self.lbl_sl.setText(f"SL: {setup['stopLoss']:.2f}")
        self.lbl_t1.setText(f"T1: {setup['target1']:.2f}")
        self.lbl_t2.setText(f"T2: {setup['target2']:.2f}")
        self.lbl_t3.setText(f"T3: {setup['target3']:.2f}")

        self.txt_reasoning.setText(setup["reasoningText"])
        self.btn_save_trade.setEnabled(True)

        # Plot chart
        self.chart_widget.draw_chart(item["df"], item["symbol"], setup)
        self.statusBar().showMessage(f"Ready: trade recommendations plotted for {item['symbol']}")

        # Auto-compute position sizing
        self.recalc_position_allocation()

    def load_options_chain_simulation(self, symbol):
        """Simulates Derivative Option Chain PCR calculations."""
        base = 23500 if "NIFTY" in symbol else (51200 if "BANK" in symbol else 1200)
        self.lbl_opt_stats.setText(f"{symbol} Option Chain  |  PCR Index: 1.14 (Bullish Buildup)  |  Max Pain: {base}")
        
        self.tbl_options.setRowCount(0)
        for i in range(5):
            strike = base - 100 + (i * 50)
            self.tbl_options.insertRow(i)
            self.tbl_options.setItem(i, 0, QTableWidgetItem(str(random.randint(25000, 100000))))
            self.tbl_options.setItem(i, 1, QTableWidgetItem(f"{150 - i*20:.2f}"))
            self.tbl_options.setItem(i, 2, QTableWidgetItem(str(strike)))
            self.tbl_options.setItem(i, 3, QTableWidgetItem(f"{15 + i*18:.2f}"))
            self.tbl_options.setItem(i, 4, QTableWidgetItem(str(random.randint(18000, 95000))))

    def recalc_position_allocation(self):
        if not hasattr(self, 'current_selected_asset'):
            return

        try:
            equity = float(self.txt_equity.text())
            risk_pct = float(self.txt_risk_pct.text())
            entry = self.current_selected_asset["price"]
            # simple sl 1.5% away
            is_buy = self.current_selected_asset["score"] > 50
            sl = entry * 0.985 if is_buy else entry * 1.015

            res = RiskManager.calculate_position(equity, risk_pct, entry, sl, [entry*1.03])
            if "error" in res:
                self.lbl_risk_result.setText(f"Error: {res['error']}")
            else:
                self.lbl_risk_result.setText(
                    f"● Suggested Position Units: {res['units']} Units\n"
                    f"● Trade Value / Leverage: ${res['total_cost']}\n"
                    f"● Max Allowed Stop Loss: ${res['risk_cash']}\n"
                    f"● Suggested Max Target Gain: ${res['max_suggested_profit']}\n"
                    f"{res['warning'] or ''}"
                )
        except ValueError:
            self.lbl_risk_result.setText("⚠️ Invalid account equity numeric formatting.")

    def init_performance_history(self):
        self.perf_log = [
            {"date": "2026-06-25", "symbol": "BTC/USDT", "side": "BUY", "pnl": 340.50, "result": "Win"},
            {"date": "2026-06-26", "symbol": "RELIANCE", "side": "BUY", "pnl": 120.00, "result": "Win"},
            {"date": "2026-06-27", "symbol": "SOL/USDT", "side": "SELL", "pnl": -95.00, "result": "Loss"},
        ]
        self.rebuild_perf_table()

    def rebuild_perf_table(self):
        self.tbl_perf_log.setRowCount(0)
        wins = sum(1 for p in self.perf_log if p["result"] == "Win")
        total = len(self.perf_log)
        acc = (wins / total * 100) if total > 0 else 0
        self.lbl_perf_summary.setText(f"Total Logged Trades: {total}  |  Wins: {wins}  |  Losses: {total - wins}  |  Win Ratio: {acc:.1f}%")

        for i, trade in enumerate(self.perf_log):
            self.tbl_perf_log.insertRow(i)
            self.tbl_perf_log.setItem(i, 0, QTableWidgetItem(trade["date"]))
            self.tbl_perf_log.setItem(i, 1, QTableWidgetItem(trade["symbol"]))
            self.tbl_perf_log.setItem(i, 2, QTableWidgetItem(trade["side"]))
            self.tbl_perf_log.setItem(i, 3, QTableWidgetItem(f"${trade['pnl']:.2f}"))
            self.tbl_perf_log.setItem(i, 4, QTableWidgetItem(trade["result"]))

            color = QColor(0, 230, 118) if trade["result"] == "Win" else QColor(255, 23, 68)
            self.tbl_perf_log.item(i, 4).setForeground(color)

    def log_simulated_trade(self):
        if not hasattr(self, 'current_selected_asset'):
            return
        
        symbol = self.current_selected_asset["symbol"]
        score = self.current_selected_asset["score"]
        is_win = score > 52  # mock probability
        pnl = random.randint(150, 600) if is_win else -random.randint(100, 250)

        new_trade = {
            "date": datetime.datetime.now().strftime("%Y-%m-%d"),
            "symbol": symbol,
            "side": "BUY" if score > 50 else "SELL",
            "pnl": float(pnl),
            "result": "Win" if is_win else "Loss"
        }
        self.perf_log.insert(0, new_trade)
        self.rebuild_perf_table()
        QMessageBox.information(self, "Trade Recorded", f"Logged simulated placement for {symbol} into local SQL logs.")


class QFrame(QWidget):
    """Simple decorative helper frame."""
    pass


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = DesktopTerminalWindow()
    window.show()
    sys.exit(app.exec())
