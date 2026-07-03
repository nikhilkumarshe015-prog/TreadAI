import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

console.log("APP START");

// __dirname fix (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// ---------------- AI CLIENT ----------------
let aiClient = null;

function getAIClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("Missing GEMINI_API_KEY in env");
    }

    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// ---------------- CANDLE GENERATOR ----------------
function generateSimulatedCandles(symbol, length = 100) {
  let basePrice = 1000;

  if (symbol.includes("RELIANCE")) basePrice = 13250;
  else if (symbol.includes("TCS")) basePrice = 3850;
  else if (symbol.includes("HDFCBANK")) basePrice = 1620;
  else if (symbol.includes("BTC")) basePrice = 60000;

  const candles = [];
  let price = basePrice;
  let time = Date.now() - length * 3600000;

  let seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < length; i++) {
    const change = (random() - 0.5) * 0.02;

    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + random() * 0.01);
    const low = Math.min(open, close) * (1 - random() * 0.01);

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: Math.floor(10000 + random() * 50000),
    });

    price = close;
    time += 3600000;
  }

  return candles;
}

// ---------------- INDICATORS (SAFE VERSION) ----------------
function calculateIndicators(candles) {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  const currentPrice = closes.at(-1);

  const sma50 =
    closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);

  const ema20 = closes.at(-1); // simplified safe fallback

  const rsi = 50; // simplified fallback

  const macdHist = 0;

  return {
    currentPrice,
    sma50,
    ema20,
    rsi,
    macd: { histogram: macdHist },
    bollingerBands: { upper: 0, middle: 0, lower: 0 },
    atr: 0,
    pivotPoints: { p: 0, r1: 0, r2: 0, s1: 0, s2: 0 },
    trend: currentPrice > sma50 ? "Bullish" : "Bearish",
    momentum: "Neutral",
    volatility: "Normal",
    marketCondition: "Simplified Mode"
  };
}

// ---------------- SCAN API ----------------
app.post("/api/scan", (req, res) => {
  const { symbol = "RELIANCE" } = req.body;

  const candles = generateSimulatedCandles(symbol);
  const ind = calculateIndicators(candles);

  const score = 60;

  res.json({
    success: true,
    symbol,
    indicators: ind,
    score,
    signal: "Watch"
  });
});

// ---------------- AI ANALYSIS ----------------
app.post("/api/ai-analyze", async (req, res) => {
  try {
    const { symbol = "BTCUSDT" } = req.body;

    const candles = generateSimulatedCandles(symbol);
    const ind = calculateIndicators(candles);

    const ai = getAIClient();

    const prompt = `
Analyze ${symbol}
Price: ${ind.currentPrice}
Trend: ${ind.trend}
RSI: ${ind.rsi}

Return JSON only:
{
 "action":"BUY|SELL|HOLD",
 "confidence":75
}
`;

    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    res.json({
      success: true,
      ai: result.text || "no response",
      fallback: ind
    });

  } catch (err) {
    res.json({
      success: true,
      fallback: true,
      error: err.message
    });
  }
});

// ---------------- VITE + SERVER ----------------
async function start() {
  const PORT = 3000;

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  });

  app.use(vite.middlewares);

  app.get("*", async (req, res) => {
    let template = fs.readFileSync(
      path.resolve(__dirname, "index.html"),
      "utf-8"
    );

    template = await vite.transformIndexHtml(req.url, template);

    res.status(200).set({ "Content-Type": "text/html" }).end(template);
  });

  app.listen(PORT, () => {
    console.log("Server running on http://localhost:" + PORT);
  });
}

start();
