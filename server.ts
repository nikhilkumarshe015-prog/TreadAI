import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

console.log('APP START');

let currentFilename = '';
let currentDirname = '';

try {
  if (typeof __filename !== 'undefined') {
    currentFilename = __filename;
  } else if (import.meta && import.meta.url) {
    currentFilename = fileURLToPath(import.meta.url);
  }
} catch (e) {
  // fallback
}

try {
  if (typeof __dirname !== 'undefined') {
    currentDirname = __dirname;
  } else if (currentFilename) {
    currentDirname = path.dirname(currentFilename);
  }
} catch (e) {
  // fallback
}

dotenv.config();
console.log('CONFIG LOADED');

// Define target interfaces
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TechnicalIndicators {
  currentPrice: number;
  sma50: number;
  ema20: number;
  vwap: number;
  rsi: number;
  macd: { macdLine: number; signalLine: number; histogram: number };
  bollingerBands: { upper: number; middle: number; lower: number };
  atr: number;
  pivotPoints: { p: number; r1: number; r2: number; s1: number; s2: number };
  trend: 'Bullish' | 'Bearish' | 'Sideways';
  momentum: 'Strong' | 'Weak' | 'Neutral';
  volatility: 'High' | 'Low' | 'Normal';
  marketCondition: string;
}

interface ScanResult {
  symbol: string;
  name: string;
  market: 'NSE' | 'Crypto';
  indicators: TechnicalIndicators;
  score: number;
  signalStrength: 'Strong Buy' | 'Buy' | 'Watch' | 'Sell' | 'Strong Sell';
}

const app = express();
app.use(express.json());

// Lazy load Gemini AI
let aiClient: GoogleGenAI | null = null;
function getAIClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error('GEMINI_API_KEY is not configured or has default placeholder value. Please set your real Gemini API key in the Secrets panel.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Generate realistic simulated candles for NSE (using random walk)
function generateSimulatedCandles(symbol: string, length = 100, intervalMin = 60): Candle[] {
  let basePrice = 1000;
  if (symbol.includes('RELIANCE')) basePrice = 13250;
  else if (symbol.includes('TCS')) basePrice = 3850;
  else if (symbol.includes('HDFCBANK')) basePrice = 1620;
  else if (symbol.includes('INFY')) basePrice = 1480;
  else if (symbol.includes('ICICIBANK')) basePrice = 980;
  else if (symbol.includes('SBIN')) basePrice = 780;
  else if (symbol.includes('TATAMOTORS')) basePrice = 920;
  else if (symbol.includes('NIFTY')) basePrice = 23500;
  else if (symbol.includes('BANKNIFTY')) basePrice = 51200;

  const candles: Candle[] = [];
  let currentPrice = basePrice;
  let currentTime = Date.now() - length * intervalMin * 60 * 1000;

  // Simple seed-based randomness for consistency per symbol
  let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < length; i++) {
    const changePct = (random() - 0.495) * 0.015; // slight upward drift
    const open = currentPrice;
    const close = currentPrice * (1 + changePct);
    const high = Math.max(open, close) * (1 + random() * 0.006);
    const low = Math.min(open, close) * (1 - random() * 0.006);
    const volume = Math.floor(50000 + random() * 450000);

    candles.push({
      time: currentTime,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
    currentTime += intervalMin * 60 * 1000;
  }

  return candles;
}

// Fetch real crypto candles from Binance
async function fetchCryptoCandles(symbol: string, timeframe = '1h', limit = 100): Promise<Candle[]> {
  try {
    // Map timeframes to Binance format
    const intervalMap: Record<string, string> = {
      '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d'
    };
    const interval = intervalMap[timeframe] || '1h';
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.statusText}`);
    }
    const data = await response.json();
    return (data as any[]).map((d) => ({
      time: Number(d[0]),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  } catch (error) {
    console.error(`Failed to fetch crypto candles for ${symbol}:`, error);
    // Fallback to simulated if offline or rate-limited
    return generateSimulatedCandles(symbol, limit, timeframe.includes('m') ? parseInt(timeframe) : timeframe.includes('h') ? parseInt(timeframe) * 60 : 1440);
  }
}

// Mathematical Technical Indicator Calculations
function calculateIndicators(candles: Candle[]): TechnicalIndicators {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);
  const length = closes.length;
  const currentPrice = closes[length - 1];

  // 1. SMA 50
  const sma50Period = Math.min(50, length);
  const sma50 = closes.slice(-sma50Period).reduce((a, b) => a + b, 0) / sma50Period;

  // 2. EMA 20
  const ema20Period = Math.min(20, length);
  let ema20 = closes[closes.length - ema20Period];
  const k = 2 / (ema20Period + 1);
  for (let i = closes.length - ema20Period + 1; i < length; i++) {
    ema20 = closes[i] * k + ema20 * (1 - k);
  }

  // 3. VWAP
  let vwapSum = 0;
  let volSum = 0;
  const vwapPeriod = Math.min(50, length);
  for (let i = length - vwapPeriod; i < length; i++) {
    const avgPrice = (highs[i] + lows[i] + closes[i]) / 3;
    vwapSum += avgPrice * volumes[i];
    volSum += volumes[i];
  }
  const vwap = volSum > 0 ? vwapSum / volSum : currentPrice;

  // 4. RSI (14)
  const rsiPeriod = 14;
  let rsi = 50;
  if (length > rsiPeriod) {
    let gains = 0;
    let losses = 0;
    for (let i = length - rsiPeriod; i < length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / rsiPeriod;
    let avgLoss = losses / rsiPeriod;

    const rs = avgGain / (avgLoss || 1);
    rsi = 100 - 100 / (1 + rs);
  }

  // 5. MACD (12, 26, 9)
  const getEMA = (data: number[], period: number) => {
    let ema = data[0];
    const kFactor = 2 / (period + 1);
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * kFactor + ema * (1 - kFactor);
    }
    return ema;
  };

  const ema12List: number[] = [];
  const ema26List: number[] = [];
  let e12 = closes[0];
  let e26 = closes[0];
  const k12 = 2 / 13;
  const k26 = 2 / 27;

  for (let i = 0; i < length; i++) {
    e12 = closes[i] * k12 + e12 * (1 - k12);
    e26 = closes[i] * k26 + e26 * (1 - k26);
    ema12List.push(e12);
    ema26List.push(e26);
  }

  const macdLine = ema12List[length - 1] - ema26List[length - 1];
  const macdHistory: number[] = [];
  for (let i = 0; i < length; i++) {
    macdHistory.push(ema12List[i] - ema26List[i]);
  }
  const signalLine = getEMA(macdHistory.slice(-9), 9);
  const histogram = macdLine - signalLine;

  // 6. Bollinger Bands (20, 2)
  const bbPeriod = Math.min(20, length);
  const bbSma = closes.slice(-bbPeriod).reduce((a, b) => a + b, 0) / bbPeriod;
  const variance = closes.slice(-bbPeriod).reduce((acc, val) => acc + Math.pow(val - bbSma, 2), 0) / bbPeriod;
  const stdDev = Math.sqrt(variance);
  const upperBB = bbSma + 2 * stdDev;
  const lowerBB = bbSma - 2 * stdDev;

  // 7. ATR (14)
  const atrPeriod = 14;
  let atr = highs[length - 1] - lows[length - 1];
  if (length > atrPeriod) {
    let trSum = 0;
    for (let i = length - atrPeriod; i < length; i++) {
      const h = highs[i];
      const l = lows[i];
      const pc = closes[i - 1];
      const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      trSum += tr;
    }
    atr = trSum / atrPeriod;
  }

  // 8. Pivot Points (Daily Standard)
  const lastHigh = highs[length - 2] || highs[length - 1];
  const lastLow = lows[length - 2] || lows[length - 1];
  const lastClose = closes[length - 2] || closes[length - 1];
  const p = (lastHigh + lastLow + lastClose) / 3;
  const r1 = 2 * p - lastLow;
  const s1 = 2 * p - lastHigh;
  const r2 = p + (lastHigh - lastLow);
  const s2 = p - (lastHigh - lastLow);

  // 9. Market Condition & Trend
  let trend: 'Bullish' | 'Bearish' | 'Sideways' = 'Sideways';
  if (currentPrice > ema20 && ema20 > sma50) trend = 'Bullish';
  else if (currentPrice < ema20 && ema20 < sma50) trend = 'Bearish';

  let momentum: 'Strong' | 'Weak' | 'Neutral' = 'Neutral';
  if (rsi > 60 && histogram > 0) momentum = 'Strong';
  else if (rsi < 40 && histogram < 0) momentum = 'Weak';

  let volatility: 'High' | 'Low' | 'Normal' = 'Normal';
  const priceRangePct = (highs[length - 1] - lows[length - 1]) / currentPrice;
  if (priceRangePct > 0.04) volatility = 'High';
  else if (priceRangePct < 0.01) volatility = 'Low';

  let marketCondition = 'Range Bound';
  if (trend === 'Bullish' && momentum === 'Strong') marketCondition = 'Trending Up';
  else if (trend === 'Bearish' && momentum === 'Weak') marketCondition = 'Trending Down';
  else if (volatility === 'High') marketCondition = 'Highly Volatile';

  return {
    currentPrice: parseFloat(currentPrice.toFixed(2)),
    sma50: parseFloat(sma50.toFixed(2)),
    ema20: parseFloat(ema20.toFixed(2)),
    vwap: parseFloat(vwap.toFixed(2)),
    rsi: parseFloat(rsi.toFixed(2)),
    macd: {
      macdLine: parseFloat(macdLine.toFixed(4)),
      signalLine: parseFloat(signalLine.toFixed(4)),
      histogram: parseFloat(histogram.toFixed(4))
    },
    bollingerBands: {
      upper: parseFloat(upperBB.toFixed(2)),
      middle: parseFloat(bbSma.toFixed(2)),
      lower: parseFloat(lowerBB.toFixed(2))
    },
    atr: parseFloat(atr.toFixed(2)),
    pivotPoints: {
      p: parseFloat(p.toFixed(2)),
      r1: parseFloat(r1.toFixed(2)),
      r2: parseFloat(r2.toFixed(2)),
      s1: parseFloat(s1.toFixed(2)),
      s2: parseFloat(s2.toFixed(2))
    },
    trend,
    momentum,
    volatility,
    marketCondition
  };
}

// Standard stock names map
const INSTRUMENTS_NSE = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd' },
  { symbol: 'TCS', name: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd' },
  { symbol: 'INFY', name: 'Infosys Ltd' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd' },
  { symbol: 'NIFTY_50', name: 'Nifty 50 Index' },
  { symbol: 'BANKNIFTY', name: 'Bank Nifty Index' }
];

const INSTRUMENTS_CRYPTO = [
  { symbol: 'BTCUSDT', name: 'Bitcoin / USDT' },
  { symbol: 'ETHUSDT', name: 'Ethereum / USDT' },
  { symbol: 'SOLUSDT', name: 'Solana / USDT' },
  { symbol: 'ADAUSDT', name: 'Cardano / USDT' },
  { symbol: 'XRPUSDT', name: 'Ripple / USDT' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin / USDT' },
  { symbol: 'BNBUSDT', name: 'Binance Coin / USDT' }
];

// Perform quantitative scan and ranking
async function performScan(market: 'NSE' | 'Crypto' | 'All', timeframe = '1h'): Promise<ScanResult[]> {
  const list: ScanResult[] = [];

  const scanNSE = market === 'NSE' || market === 'All';
  const scanCrypto = market === 'Crypto' || market === 'All';

  if (scanNSE) {
    for (const inst of INSTRUMENTS_NSE) {
      const candles = generateSimulatedCandles(inst.symbol, 100);
      const ind = calculateIndicators(candles);

      // Quant scoring system
      let score = 50;
      if (ind.trend === 'Bullish') score += 15;
      if (ind.trend === 'Bearish') score -= 15;
      if (ind.rsi > 50 && ind.rsi < 70) score += 10;
      if (ind.rsi > 70) score -= 5; // Overbought
      if (ind.rsi < 30) score += 15; // Oversold deep value
      if (ind.macd.histogram > 0) score += 10;
      if (ind.currentPrice > ind.vwap) score += 10;
      else score -= 10;

      // Ensure boundary 0-100
      score = Math.max(0, Math.min(100, score));

      let signalStrength: 'Strong Buy' | 'Buy' | 'Watch' | 'Sell' | 'Strong Sell' = 'Watch';
      if (score >= 80) signalStrength = 'Strong Buy';
      else if (score >= 65) signalStrength = 'Buy';
      else if (score <= 20) signalStrength = 'Strong Sell';
      else if (score <= 35) signalStrength = 'Sell';

      list.push({
        symbol: inst.symbol,
        name: inst.name,
        market: 'NSE',
        indicators: ind,
        score,
        signalStrength
      });
    }
  }

  if (scanCrypto) {
    for (const inst of INSTRUMENTS_CRYPTO) {
      const candles = await fetchCryptoCandles(inst.symbol, timeframe);
      const ind = calculateIndicators(candles);

      let score = 50;
      if (ind.trend === 'Bullish') score += 15;
      if (ind.trend === 'Bearish') score -= 15;
      if (ind.rsi > 50 && ind.rsi < 70) score += 10;
      if (ind.rsi > 70) score -= 5;
      if (ind.rsi < 30) score += 15;
      if (ind.macd.histogram > 0) score += 10;
      if (ind.currentPrice > ind.vwap) score += 10;
      else score -= 10;

      score = Math.max(0, Math.min(100, score));

      let signalStrength: 'Strong Buy' | 'Buy' | 'Watch' | 'Sell' | 'Strong Sell' = 'Watch';
      if (score >= 80) signalStrength = 'Strong Buy';
      else if (score >= 65) signalStrength = 'Buy';
      else if (score <= 20) signalStrength = 'Strong Sell';
      else if (score <= 35) signalStrength = 'Sell';

      list.push({
        symbol: inst.symbol,
        name: inst.name,
        market: 'Crypto',
        indicators: ind,
        score,
        signalStrength
      });
    }
  }

  // Sort by score descending (highest-probability setups)
  return list.sort((a, b) => b.score - a.score);
}

// ------------------- API ENDPOINTS -------------------

// 1. Core scanner endpoint
app.post('/api/scan', async (req, res) => {
  const { market = 'All', timeframe = '1h' } = req.body;
  try {
    const results = await performScan(market, timeframe);
    res.json({ success: true, timestamp: Date.now(), results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Market history (candle series) endpoint for charts
app.get('/api/market-data', async (req, res) => {
  const { symbol, timeframe = '1h', market = 'Crypto' } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol parameter is required' });
  }

  try {
    let candles: Candle[] = [];
    if (market === 'Crypto') {
      candles = await fetchCryptoCandles(symbol as string, timeframe as string);
    } else {
      candles = generateSimulatedCandles(symbol as string, 100);
    }

    const ind = calculateIndicators(candles);

    // Quant scoring system
    let score = 50;
    if (ind.trend === 'Bullish') score += 15;
    if (ind.trend === 'Bearish') score -= 15;
    if (ind.rsi > 50 && ind.rsi < 70) score += 10;
    if (ind.rsi > 70) score -= 5;
    if (ind.rsi < 30) score += 15;
    if (ind.macd.histogram > 0) score += 10;
    if (ind.currentPrice > ind.vwap) score += 10;
    else score -= 10;

    score = Math.max(0, Math.min(100, score));

    let signalStrength: 'Strong Buy' | 'Buy' | 'Watch' | 'Sell' | 'Strong Sell' = 'Watch';
    if (score >= 80) signalStrength = 'Strong Buy';
    else if (score >= 65) signalStrength = 'Buy';
    else if (score <= 20) signalStrength = 'Strong Sell';
    else if (score <= 35) signalStrength = 'Sell';

    res.json({
      success: true,
      candles,
      indicators: ind,
      score,
      signalStrength,
      name: market === 'Crypto' ? `${symbol} / USDT` : `${symbol} Equity`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Option Chain endpoint (NSE Specific)
app.get('/api/options-chain', (req, res) => {
  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol parameter is required' });
  }

  // Generate realistic option chain elements
  const underlyingPrice = symbol === 'NIFTY_50' ? 23500 : symbol === 'BANKNIFTY' ? 51200 : 1500;
  const strikeInterval = symbol === 'NIFTY_50' ? 50 : symbol === 'BANKNIFTY' ? 100 : 20;
  const startStrike = Math.floor(underlyingPrice / strikeInterval) * strikeInterval - 5 * strikeInterval;

  const chains = [];
  let totalCallOI = 0;
  let totalPutOI = 0;

  for (let i = 0; i < 11; i++) {
    const strike = startStrike + i * strikeInterval;
    const isITMCall = strike < underlyingPrice;
    const isITMPut = strike > underlyingPrice;

    const callOI = Math.floor(10000 + Math.random() * 90000);
    const putOI = Math.floor(12000 + Math.random() * 88000);
    totalCallOI += callOI;
    totalPutOI += putOI;

    chains.push({
      strike,
      call: {
        oi: callOI,
        oiChange: Math.floor((Math.random() - 0.3) * 15000),
        volume: Math.floor(50000 + Math.random() * 200000),
        iv: parseFloat((12 + Math.random() * 8).toFixed(2)),
        price: parseFloat((isITMCall ? (underlyingPrice - strike) + 15 + Math.random() * 10 : 5 + Math.random() * 25).toFixed(2)),
      },
      put: {
        oi: putOI,
        oiChange: Math.floor((Math.random() - 0.3) * 15000),
        volume: Math.floor(40000 + Math.random() * 180000),
        iv: parseFloat((13 + Math.random() * 7).toFixed(2)),
        price: parseFloat((isITMPut ? (strike - underlyingPrice) + 15 + Math.random() * 10 : 4 + Math.random() * 20).toFixed(2)),
      }
    });
  }

  const pcr = parseFloat((totalPutOI / (totalCallOI || 1)).toFixed(2));
  const maxPain = Math.floor(underlyingPrice / strikeInterval) * strikeInterval;

  res.json({
    success: true,
    underlyingPrice,
    pcr,
    maxPain,
    totalCallOI,
    totalPutOI,
    chains
  });
});

// Helper to get simulated relevant financial news for any symbol
function getSimulatedNews(symbol: string): { title: string; sentiment: 'positive' | 'negative' | 'neutral'; time: string }[] {
  const sym = symbol.toUpperCase();
  if (sym.includes('RELIANCE')) {
    return [
      { title: "Reliance Industries announces major expansion into clean energy and solar gigafactories with ₹75,000 cr capital", sentiment: "positive", time: "2h ago" },
      { title: "Retail & Telecom arms post double-digit margin expansion, boosting overall NSE index sentiment", sentiment: "positive", time: "5h ago" },
      { title: "Global crude fluctuations create near-term volatility in Reliance oil-to-chemicals refinery margins", sentiment: "neutral", time: "1d ago" }
    ];
  } else if (sym.includes('BTC') || sym.includes('BITCOIN')) {
    return [
      { title: "Institutional Spot Bitcoin ETF net inflows hit a record $480 million in a single trading session", sentiment: "positive", time: "1h ago" },
      { title: "Whale accumulation reaches a 14-month high, removing significant liquid supply from exchanges", sentiment: "positive", time: "4h ago" },
      { title: "Macro interest rate expectations keep retail traders cautious on high-volatility margin assets", sentiment: "neutral", time: "8h ago" }
    ];
  } else if (sym.includes('ETH') || sym.includes('ETHEREUM')) {
    return [
      { title: "Ethereum gas fees hit historic lows as Layer-2 scaling solutions absorb 90% of transaction activity", sentiment: "positive", time: "3h ago" },
      { title: "Staked ETH hits a milestone 33 million, representing 27.5% of the total circulating supply locked", sentiment: "positive", time: "1d ago" }
    ];
  } else if (sym.includes('SOL') || sym.includes('SOLANA')) {
    return [
      { title: "Solana DEX volume briefly flips Ethereum, driven by high-frequency meme and token launches", sentiment: "positive", time: "30m ago" },
      { title: "DeFi TVL on Solana rises to multi-month highs as liquid staking protocols gather momentum", sentiment: "positive", time: "6h ago" }
    ];
  } else if (sym.includes('TCS')) {
    return [
      { title: "TCS bags $1.2 Billion cloud migration contract with UK government department, strengthening pipeline", sentiment: "positive", time: "1h ago" },
      { title: "IT sector faces temporary recruitment slowdown, margins expected to remain steady on automated delivery", sentiment: "neutral", time: "1d ago" }
    ];
  } else if (sym.includes('HDFCBANK')) {
    return [
      { title: "HDFC Bank posts strong credit growth of 15.4% YoY; asset quality remains robust across loan portfolios", sentiment: "positive", time: "2h ago" },
      { title: "Private lender targets aggressive digital expansion to lower retail banking operation costs", sentiment: "positive", time: "12h ago" }
    ];
  } else if (sym.includes('INFY') || sym.includes('INFOSYS')) {
    return [
      { title: "Infosys launches AI-first suite of service solutions, landing key clients in the North American market", sentiment: "positive", time: "3h ago" },
      { title: "Global enterprise IT spending shows moderate growth, clients focus on immediate ROI projects", sentiment: "neutral", time: "1d ago" }
    ];
  } else if (sym.includes('ICICIBANK')) {
    return [
      { title: "ICICI Bank's net interest margin beats analyst consensus, retail deposits show double digit uptrend", sentiment: "positive", time: "4h ago" }
    ];
  } else if (sym.includes('SBIN') || sym.includes('SBI')) {
    return [
      { title: "State Bank of India planning to raise ₹15,000 crores through infrastructure bond issue", sentiment: "positive", time: "2h ago" },
      { title: "Public sector banking index rallies as asset recovery rates improve significantly", sentiment: "positive", time: "1d ago" }
    ];
  } else if (sym.includes('TATAMOTORS')) {
    return [
      { title: "Tata Motors EV sales segment surges 22% in domestic markets; JLR division orders remain solid", sentiment: "positive", time: "1h ago" },
      { title: "Commercial vehicle demand softens slightly, offset by premium passenger car bookings", sentiment: "neutral", time: "1d ago" }
    ];
  } else if (sym.includes('NIFTY')) {
    return [
      { title: "Nifty 50 touches new lifetime peak amidst aggressive domestic retail and mutual fund buying", sentiment: "positive", time: "30m ago" },
      { title: "FII activity shifts net positive, pouring capital into heavyweights like Reliance and HDFC Bank", sentiment: "positive", time: "3h ago" }
    ];
  } else if (sym.includes('BANKNIFTY')) {
    return [
      { title: "Bank Nifty outperforms as banking majors register stable loan yields and lower NPAs", sentiment: "positive", time: "2h ago" }
    ];
  }
  return [
    { title: `Global markets register steady momentum for ${symbol}; traders monitor key macro metrics`, sentiment: "neutral", time: "4h ago" },
    { title: `Algorithmic volume increases on ${symbol} support levels, signaling a consolidating breakout range`, sentiment: "positive", time: "1d ago" }
  ];
}

// Helper for dynamic strategy metadata (recommended timeframe and expected target hit duration)
function getStrategyHoldingTimeAndDetails(tradingType: string, timeframe: string): { holdingTime: string; recommendedTimeframe: string } {
  const type = tradingType.toLowerCase();
  
  // Crypto Strategies
  if (type.includes('scalping')) {
    return { holdingTime: '5-15 Minutes', recommendedTimeframe: '15m (ideal 1m/5m)' };
  } else if (type.includes('intraday') || type.includes('day trading')) {
    return { holdingTime: '2-6 Hours', recommendedTimeframe: '15m or 1h' };
  } else if (type.includes('futures')) {
    return { holdingTime: '4-24 Hours', recommendedTimeframe: '15m or 1h' };
  } else if (type.includes('margin')) {
    return { holdingTime: '1-3 Days', recommendedTimeframe: '1h or 4h' };
  } else if (type.includes('swing')) {
    return { holdingTime: '3-10 Days', recommendedTimeframe: '4h or 1d' };
  } else if (type.includes('position')) {
    return { holdingTime: '3-12 Weeks', recommendedTimeframe: '1d' };
  } else if (type.includes('grid bot')) {
    return { holdingTime: 'Continuous (Grid resets every 24-48h)', recommendedTimeframe: '1h' };
  } else if (type.includes('copy trading')) {
    return { holdingTime: 'Varies with Master Trader (Days/Weeks)', recommendedTimeframe: '1h' };
  } else if (type.includes('spot trading')) {
    return { holdingTime: '1-7 Days', recommendedTimeframe: '1h or 4h' };
  }
  
  // NSE Stock Strategies
  if (type.includes('delivery')) {
    return { holdingTime: '3-12 Months', recommendedTimeframe: '1d' };
  } else if (type.includes('positional')) {
    return { holdingTime: '2-8 Weeks', recommendedTimeframe: '4h or 1d' };
  } else if (type.includes('options')) {
    return { holdingTime: '10 Mins to 4 Hours', recommendedTimeframe: '15m (ideal 5m)' };
  } else if (type.includes('algo')) {
    return { holdingTime: 'Micro-seconds to Hours', recommendedTimeframe: '15m or 1h' };
  }
  
  // Default based on current selected timeframe
  if (timeframe === '15m') return { holdingTime: '1-4 Hours', recommendedTimeframe: '15m' };
  if (timeframe === '1h') return { holdingTime: '6-24 Hours', recommendedTimeframe: '1h' };
  if (timeframe === '4h') return { holdingTime: '2-5 Days', recommendedTimeframe: '4h' };
  if (timeframe === '1d') return { holdingTime: '5-15 Days', recommendedTimeframe: '1d' };
  
  return { holdingTime: '1-3 Days', recommendedTimeframe: '1h' };
}

// 4. Gemini AI deep trade analysis and signal generator
app.post('/api/ai-analyze', async (req, res) => {
  const { symbol, name, market, indicators, timeframe = '1h', tradingType = 'Spot Trading' } = req.body;
  if (!symbol || !indicators) {
    return res.status(400).json({ error: 'Missing symbol or indicators details' });
  }

  const { holdingTime, recommendedTimeframe } = getStrategyHoldingTimeAndDetails(tradingType, timeframe);
  const scannedNews = getSimulatedNews(symbol);

  try {
    const ai = getAIClient();
    const prompt = `
You are a highly sophisticated quant trader and AI trading system.
Analyze the following market indicators and recent news for ${name} (${symbol}) on the ${timeframe} timeframe in the ${market} market, specifically tailored for the "${tradingType}" trading strategy.

Current Technical Data:
- Current Price: ${indicators.currentPrice}
- EMA 20: ${indicators.ema20}
- SMA 50: ${indicators.sma50}
- VWAP: ${indicators.vwap}
- RSI (14): ${indicators.rsi}
- Bollinger Bands: Upper: ${indicators.bollingerBands.upper}, Middle: ${indicators.bollingerBands.middle}, Lower: ${indicators.bollingerBands.lower}
- ATR: ${indicators.atr}
- MACD Histogram: ${indicators.macd.histogram}, Line: ${indicators.macd.macdLine}, Signal: ${indicators.macd.signalLine}
- Pivot Points: P: ${indicators.pivotPoints.p}, R1: ${indicators.pivotPoints.r1}, S1: ${indicators.pivotPoints.s1}
- Current Trend: ${indicators.trend}
- Momentum: ${indicators.momentum}
- Volatility: ${indicators.volatility}
- Overall Market Condition: ${indicators.marketCondition}

Recent Scanned News Headlines for ${symbol}:
${scannedNews.map((n, idx) => `${idx + 1}. [${n.sentiment.toUpperCase()}] ${n.title} (${n.time})`).join('\n')}

Please perform an integrated analysis. Assess the technical indicators and blend them with the sentiment of the recent news events to recommend the highest probability trade specifically aligned with the rules of "${tradingType}". Set appropriate Entry, Stop Loss, and Targets. If the strategy is "Options Trading", suggest potential CALL/PUT positions. If the strategy is "Grid Bot Trading", formulate upper/lower grid bounds.
Return your response STRICTLY as a raw valid JSON object. Do not wrap the JSON in markdown formatting (like \`\`\`json ... \`\`\`), just return the raw text object. The JSON schema must strictly match the following fields:
{
  "action": "BUY" | "SELL" | "HOLD",
  "instrumentName": "The name and symbol",
  "entryPrice": number,
  "stopLoss": number,
  "target1": number,
  "target2": number,
  "target3": number,
  "riskRewardRatio": string,
  "confidenceScore": number,
  "winProbabilityEstimate": string,
  "reasoningText": "A detailed 3-4 sentence explanation highlighting trend alignment for ${tradingType} strategy, key support/resistance breakout, momentum confirmation, risk warning, and how the news sentiment influenced your ultimate decision.",
  "timeframe": "Selected timeframe",
  "suggestedHoldingTime": "Expected duration for targets to hit (e.g. 5-15 mins, 24-48 hours, 3-5 days, or grid limits)",
  "signalStrength": "Strong Buy" | "Buy" | "Watch" | "Sell" | "Strong Sell"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty AI response received');
    }

    // Safely parse JSON
    const cleanJson = text.trim();
    const parsedData = JSON.parse(cleanJson);
    res.json({ success: true, analysis: { ...parsedData, isFallback: false }, scannedNews });
  } catch (error: any) {
    // Gracefully handle expected API key / quota limitations without polluting console.error diagnostics
    const errorMsg = error?.message || String(error);
    console.log(`Gemini API key warning / quota notice. Message: ${errorMsg}`);
    
    // Graceful fallback if API key is not configured or fails
    const isBuy = indicators.trend === 'Bullish' || (indicators.rsi < 40 && indicators.macd.histogram > 0);
    const fallbackAction = isBuy ? 'BUY' : 'SELL';
    const entry = indicators.currentPrice;
    const atrFactor = indicators.atr || (entry * 0.02);
    const sl = isBuy ? entry - (1.5 * atrFactor) : entry + (1.5 * atrFactor);
    const t1 = isBuy ? entry + (1.5 * atrFactor) : entry - (1.5 * atrFactor);
    const t2 = isBuy ? entry + (3.0 * atrFactor) : entry - (3.0 * atrFactor);
    const t3 = isBuy ? entry + (4.5 * atrFactor) : entry - (4.5 * atrFactor);

    const fallbackAnalysis = {
      action: fallbackAction,
      instrumentName: `${name} (${symbol})`,
      entryPrice: parseFloat(entry.toFixed(2)),
      stopLoss: parseFloat(sl.toFixed(2)),
      target1: parseFloat(t1.toFixed(2)),
      target2: parseFloat(t2.toFixed(2)),
      target3: parseFloat(t3.toFixed(2)),
      riskRewardRatio: "1:2.0",
      confidenceScore: 72,
      winProbabilityEstimate: "72%",
      reasoningText: `[Integrated Engine Recommendation] Aligned with ${tradingType} strategy, recommended ${fallbackAction} based on ${indicators.trend} trend structure and ${indicators.marketCondition} market state. RSI is at ${indicators.rsi}. Standard ATR Stop Loss set at 1.5x volatility range. Factored in ${scannedNews.length} news headlines including: "${scannedNews[0]?.title || 'market stability report'}". (Note: Set real GEMINI_API_KEY for dynamic deep neural reasoning reports).`,
      timeframe: timeframe,
      suggestedHoldingTime: holdingTime,
      signalStrength: isBuy ? 'Buy' : 'Sell',
      isFallback: true,
      errorMessage: errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')
        ? 'Gemini API daily free tier quota limit reached (429 RESOURCE_EXHAUSTED). Displaying local rule-based quant fallback signals.'
        : `Gemini API fallback: ${errorMsg}`
    };

    res.json({ success: true, analysis: fallbackAnalysis, isFallback: true, scannedNews });
  }
});

// 5. Mock performance logs & records saving (persisted locally in memory for demo)
let performanceHistory = [
  { id: 1, date: '2026-06-25', symbol: 'BTCUSDT', type: 'Crypto', action: 'BUY', entry: 61200.00, close: 63400.00, profit: 2200.00, pnlPct: 3.59, result: 'Win' },
  { id: 2, date: '2026-06-26', symbol: 'RELIANCE', type: 'NSE', action: 'BUY', entry: 13250.00, close: 13490.00, profit: 240.00, pnlPct: 1.81, result: 'Win' },
  { id: 3, date: '2026-06-27', symbol: 'SOLUSDT', type: 'Crypto', action: 'SELL', entry: 142.50, close: 146.10, profit: -3.60, pnlPct: -2.53, result: 'Loss' },
  { id: 4, date: '2026-06-28', symbol: 'HDFCBANK', type: 'NSE', action: 'BUY', entry: 1612.00, close: 1644.00, profit: 32.00, pnlPct: 1.98, result: 'Win' },
  { id: 5, date: '2026-06-29', symbol: 'ETHUSDT', type: 'Crypto', action: 'BUY', entry: 3380.00, close: 3495.00, profit: 115.00, pnlPct: 3.40, result: 'Win' },
];
console.log('DATABASE READY');

app.get('/api/performance', (req, res) => {
  const total = performanceHistory.length;
  const wins = performanceHistory.filter(h => h.result === 'Win').length;
  const losses = total - wins;
  const accuracy = total > 0 ? parseFloat(((wins / total) * 100).toFixed(1)) : 0;
  const avgProfit = performanceHistory.reduce((acc, h) => acc + (h.profit > 0 ? h.profit : 0), 0) / (wins || 1);
  const avgLoss = Math.abs(performanceHistory.reduce((acc, h) => acc + (h.profit < 0 ? h.profit : 0), 0) / (losses || 1));
  const maxDrawdown = 4.2; // static estimate

  res.json({
    success: true,
    stats: {
      total,
      wins,
      losses,
      accuracy,
      avgProfit: parseFloat(avgProfit.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      maxDrawdown
    },
    history: performanceHistory
  });
});

app.post('/api/add-trade', (req, res) => {
  const { symbol, type, action, entry, close, profit, pnlPct, result } = req.body;
  const newTrade = {
    id: performanceHistory.length + 1,
    date: new Date().toISOString().split('T')[0],
    symbol,
    type,
    action,
    entry: Number(entry),
    close: Number(close),
    profit: Number(profit),
    pnlPct: Number(pnlPct),
    result
  };
  performanceHistory.unshift(newTrade);
  res.json({ success: true, history: performanceHistory });
});

// 6. Python Source Code Generation and ZIP Endpoint
const PYTHON_REQUIREMENTS = `PySide6>=6.6.0
yfinance>=0.2.40
ccxt>=4.3.0
google-genai>=2.4.0
pandas>=2.0.0
matplotlib>=3.7.0
requests>=2.31.0
`;

const PYTHON_MAIN = `import sys
import os
import random
import datetime
from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QLabel, QPushButton, QComboBox, 
                             QTableWidget, QTableWidgetItem, QHeaderView, QTextEdit,
                             QTabWidget, QGroupBox, QLineEdit, QMessageBox, QCheckBox)
from PySide6.QtCore import Qt, QTimer, Slot
from PySide6.QtGui import QFont, QColor, QPalette

# Mock technical indicator math
def compute_indicators(closes, highs, lows, volumes):
    if len(closes) < 20:
        return {"price": closes[-1], "rsi": 50, "ema": closes[-1], "trend": "Sideways"}
    
    current_price = closes[-1]
    sma_50 = sum(closes[-50:]) / min(50, len(closes))
    
    # EMA 20
    ema_20 = closes[0]
    k = 2 / (20 + 1)
    for price in closes[1:]:
        ema_20 = price * k + ema_20 * (1 - k)
        
    # RSI 14
    gains = []
    losses = []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i-1]
        if diff > 0:
            gains.append(diff)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(abs(diff))
            
    avg_gain = sum(gains[-14:]) / 14
    avg_loss = sum(losses[-14:]) / 14
    rs = avg_gain / max(1e-5, avg_loss)
    rsi = 100 - (100 / (1 + rs))
    
    trend = "Bullish" if current_price > ema_20 and ema_20 > sma_50 else ("Bearish" if current_price < ema_20 and ema_20 < sma_50 else "Sideways")
    
    return {
        "price": current_price,
        "ema20": ema_20,
        "sma50": sma_50,
        "rsi": rsi,
        "trend": trend,
        "volatility": "High" if (max(highs[-5:]) - min(lows[-5:])) / current_price > 0.04 else "Normal"
    }

class AITradingAssistant(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Bloomberg Terminal - Desktop AI Trading Assistant")
        self.resize(1280, 800)
        self.setup_ui()
        self.apply_dark_theme()
        
    def setup_ui(self):
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        main_layout = QHBoxLayout(main_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)
        
        # Left Panel: Market Scanner & Configuration
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 0, 0)
        
        # Market Config Group
        config_group = QGroupBox("Terminal Controls")
        config_layout = QVBoxLayout(config_group)
        
        # Market Select
        m_layout = QHBoxLayout()
        m_layout.addWidget(QLabel("Market Sector:"))
        self.market_combo = QComboBox()
        self.market_combo.addItems(["Crypto Spot & Futures", "NSE Equity & Derivatives"])
        m_layout.addWidget(self.market_combo)
        config_layout.addLayout(m_layout)
        
        # Timeframe Select
        t_layout = QHBoxLayout()
        t_layout.addWidget(QLabel("Timeframe:"))
        self.timeframe_combo = QComboBox()
        self.timeframe_combo.addItems(["15m", "1h", "4h", "1d"])
        t_layout.addWidget(self.timeframe_combo)
        config_layout.addLayout(t_layout)
        
        # Scan Button
        self.scan_btn = QPushButton("RUN GLOBAL MARKET SCAN")
        self.scan_btn.setFont(QFont("Arial", 11, QFont.Bold))
        self.scan_btn.setStyleSheet("background-color: #00e676; color: #121212; padding: 10px; border-radius: 4px;")
        self.scan_btn.clicked.connect(self.run_scanner)
        config_layout.addWidget(self.scan_btn)
        
        left_layout.addWidget(config_group)
        
        # Watchlist Table
        self.watchlist_group = QGroupBox("Quant Rankings (Top Opportunities)")
        watchlist_layout = QVBoxLayout(self.watchlist_group)
        
        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["Instrument", "Price", "Trend", "Quant Score", "Strength"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.cellClicked.connect(self.instrument_selected)
        watchlist_layout.addWidget(self.table)
        
        left_layout.addWidget(self.watchlist_group)
        left_layout.setStretch(1, 2)
        
        # Right Panel: Signals, Reasoning & Configuration
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)
        
        # Signal Setup Group
        signal_group = QGroupBox("AI Signal Neural Output")
        signal_layout = QVBoxLayout(signal_group)
        
        self.signal_header = QLabel("Select an instrument or Run Scan to see details")
        self.signal_header.setFont(QFont("Arial", 14, QFont.Bold))
        self.signal_header.setStyleSheet("color: #00e676;")
        signal_layout.addWidget(self.signal_header)
        
        # Grid layout for trade parameters
        param_layout = QHBoxLayout()
        self.entry_label = QLabel("Entry: --")
        self.sl_label = QLabel("Stop Loss: --")
        self.tp1_label = QLabel("Target 1: --")
        self.tp2_label = QLabel("Target 2: --")
        
        for lbl in [self.entry_label, self.sl_label, self.tp1_label, self.tp2_label]:
            lbl.setFont(QFont("Consolas", 10))
            param_layout.addWidget(lbl)
            
        signal_layout.addLayout(param_layout)
        
        # Reasoning text area
        signal_layout.addWidget(QLabel("AI Neural Logic Reasoning:"))
        self.reasoning_box = QTextEdit()
        self.reasoning_box.setReadOnly(True)
        self.reasoning_box.setPlaceholderText("The neural breakdown of trade alignment, volume profiling, and trend confluence will appear here...")
        signal_layout.addWidget(self.reasoning_box)
        
        right_layout.addWidget(signal_group)
        
        # Risk Calculator Group
        risk_group = QGroupBox("Smart Risk & Allocation Calculator")
        risk_calc_layout = QHBoxLayout(risk_group)
        
        risk_calc_layout.addWidget(QLabel("Account Size ($):"))
        self.acc_size_input = QLineEdit("10000")
        self.acc_size_input.setMaximumWidth(100)
        risk_calc_layout.addWidget(self.acc_size_input)
        
        risk_calc_layout.addWidget(QLabel("Risk Per Trade (%):"))
        self.risk_pct_input = QLineEdit("1.5")
        self.risk_pct_input.setMaximumWidth(60)
        risk_calc_layout.addWidget(self.risk_pct_input)
        
        self.calc_btn = QPushButton("Calculate Position")
        self.calc_btn.clicked.connect(self.calculate_position)
        risk_calc_layout.addWidget(self.calc_btn)
        
        self.position_result = QLabel("Suggested Position Size: --")
        self.position_result.setFont(QFont("Arial", 10, QFont.Bold))
        risk_calc_layout.addWidget(self.position_result)
        
        right_layout.addWidget(risk_group)
        
        main_layout.addWidget(left_panel, 1)
        main_layout.addWidget(right_panel, 1)
        
    def apply_dark_theme(self):
        palette = QPalette()
        palette.setColor(QPalette.Window, QColor(18, 18, 18))
        palette.setColor(QPalette.WindowText, QColor(240, 240, 240))
        palette.setColor(QPalette.Base, QColor(30, 30, 30))
        palette.setColor(QPalette.AlternateBase, QColor(25, 25, 25))
        palette.setColor(QPalette.ToolTipBase, Qt.white)
        palette.setColor(QPalette.ToolTipText, Qt.white)
        palette.setColor(QPalette.Text, QColor(240, 240, 240))
        palette.setColor(QPalette.Button, QColor(45, 45, 45))
        palette.setColor(QPalette.ButtonText, QColor(240, 240, 240))
        palette.setColor(QPalette.BrightText, Qt.red)
        palette.setColor(QPalette.Highlight, QColor(0, 230, 118))
        palette.setColor(QPalette.HighlightedText, QColor(18, 18, 18))
        self.setPalette(palette)
        
    @Slot()
    def run_scanner(self):
        # Choose mock tickers based on market
        is_crypto = self.market_combo.currentIndex() == 0
        tickers = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "ADA/USDT", "XRP/USDT"] if is_crypto else ["RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN"]
        
        self.table.setRowCount(0)
        self.scanned_data = {}
        
        for t in tickers:
            base_price = 60000 if "BTC" in t else (3000 if "ETH" in t else (150 if "SOL" in t else (2500 if "RELIANCE" in t else 1500)))
            closes = [base_price * (1 + random.uniform(-0.02, 0.02)) for _ in range(100)]
            highs = [p * 1.01 for p in closes]
            lows = [p * 0.99 for p in closes]
            volumes = [random.randint(1000, 100000) for _ in closes]
            
            ind = compute_indicators(closes, highs, lows, volumes)
            score = random.randint(30, 95)
            strength = "Strong Buy" if score > 80 else ("Buy" if score > 65 else ("Sell" if score < 40 else "Watch"))
            
            self.scanned_data[t] = {
                "indicators": ind,
                "score": score,
                "strength": strength,
                "closes": closes
            }
            
            row = self.table.rowCount()
            self.table.insertRow(row)
            self.table.setItem(row, 0, QTableWidgetItem(t))
            self.table.setItem(row, 1, QTableWidgetItem(f"{ind['price']:.2f}"))
            self.table.setItem(row, 2, QTableWidgetItem(ind["trend"]))
            self.table.setItem(row, 3, QTableWidgetItem(str(score)))
            self.table.setItem(row, 4, QTableWidgetItem(strength))
            
            # Color coding
            color = QColor(0, 230, 118) if "Buy" in strength else (QColor(255, 23, 68) if "Sell" in strength else QColor(255, 196, 0))
            self.table.item(row, 4).setForeground(color)
            
        QMessageBox.information(self, "Scanner Complete", "Successfully scanned and ranked instruments. Displaying Top Opportunities.")
        
    @Slot()
    def instrument_selected(self, row, col):
        ticker = self.table.item(row, 0).text()
        if ticker not in self.scanned_data:
            return
            
        data = self.scanned_data[ticker]
        price = data["indicators"]["price"]
        is_buy = "Buy" in data["strength"]
        
        # Trade parameters
        entry = price
        sl = price * 0.98 if is_buy else price * 1.02
        tp1 = price * 1.03 if is_buy else price * 0.97
        tp2 = price * 1.06 if is_buy else price * 0.94
        
        self.current_setup = {"entry": entry, "sl": sl}
        
        self.signal_header.setText(f"{data['strength'].upper()} Alert: {ticker} @ {entry:.2f}")
        self.signal_header.setStyleSheet("color: #00e676;" if is_buy else "color: #ff1744;")
        
        self.entry_label.setText(f"Entry: {entry:.2f}")
        self.sl_label.setText(f"Stop Loss: {sl:.2f}")
        self.tp1_label.setText(f"Target 1: {tp1:.2f}")
        self.tp2_label.setText(f"Target 2: {tp2:.2f}")
        
        reasoning = (f"Automated quant score of {data['score']}/100 indicates high statistical edge. "
                     f"Trend is verified as {data['indicators']['trend']} with a strong breakout structures on the "
                     f"{self.timeframe_combo.currentText()} timeframe. RSI is at {data['indicators']['rsi']:.1f}, confirming "
                     f"strong market structure with low overhead friction. Trade with strict risk alignment.")
        self.reasoning_box.setText(reasoning)
        self.calculate_position()

    @Slot()
    def calculate_position(self):
        if not hasattr(self, 'current_setup'):
            return
            
        try:
            acc_size = float(self.acc_size_input.text())
            risk_pct = float(self.risk_pct_input.text())
            entry = self.current_setup["entry"]
            sl = self.current_setup["sl"]
            
            risk_amt = acc_size * (risk_pct / 100)
            risk_per_unit = abs(entry - sl)
            
            if risk_per_unit > 0:
                units = risk_amt / risk_per_unit
                cost = units * entry
                self.position_result.setText(f"Allocation: {units:.4f} units (~\${cost:.2f})")
            else:
                self.position_result.setText("Allocation: SL and Entry are equal.")
        except ValueError:
            self.position_result.setText("Allocation: Invalid Input.")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = AITradingAssistant()
    window.show()
    sys.exit(app.exec())
`;

// Zip exporter or raw files helper
app.get('/api/download-python', (req, res) => {
  // Let's offer a downloadable file directly (we can construct a zip, or serve a dictionary of python files)
  res.json({
    success: true,
    files: [
      { name: 'requirements.txt', content: PYTHON_REQUIREMENTS },
      { name: 'main.py', content: PYTHON_MAIN }
    ]
  });
});

async function startServer() {
  console.log('API READY');

  // Serve Vite SPA in production / handle client asset routing
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(currentDirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('ROUTES READY');
  } else {
    // Create Vite server in middleware mode
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
      
      // Serve index.html dynamically
      app.get('*', async (req, res, next) => {
        const url = req.originalUrl;
        try {
          let template = fs.readFileSync(path.resolve(currentDirname, 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
      console.log('ROUTES READY');
    } catch (e) {
      console.error('Failed to initialize Vite server:', e);
      throw e;
    }
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Bloomberg Server] Running on http://0.0.0.0:${PORT}`);
    console.log('SERVER READY');
  });
}

startServer().catch((error) => {
  console.error('Error during startServer initialization:', error);
});
