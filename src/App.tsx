import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Download,
  Settings as SettingsIcon,
  Play,
  RotateCcw,
  BookOpen,
  DollarSign,
  AlertTriangle,
  Volume2,
  VolumeX,
  FileCode,
  Globe,
  Clock,
  Briefcase,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';

// Define TS Interfaces matching backend
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

interface AISignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  instrumentName: string;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  riskRewardRatio: string;
  confidenceScore: number;
  winProbabilityEstimate: string;
  reasoningText: string;
  timeframe: string;
  suggestedHoldingTime: string;
  signalStrength: string;
  isFallback?: boolean;
  errorMessage?: string;
}

interface OptionStrike {
  strike: number;
  call: { oi: number; oiChange: number; volume: number; iv: number; price: number };
  put: { oi: number; oiChange: number; volume: number; iv: number; price: number };
}

interface OptionChainData {
  underlyingPrice: number;
  pcr: number;
  maxPain: number;
  totalCallOI: number;
  totalPutOI: number;
  chains: OptionStrike[];
}

interface TradeLog {
  id: number;
  date: string;
  symbol: string;
  type: string;
  action: string;
  entry: number;
  close: number;
  profit: number;
  pnlPct: number;
  result: 'Win' | 'Loss';
}

// Multi-language translation maps
const TRANSLATIONS = {
  English: {
    terminalTitle: "BLOOMBERG TERMINAL - QUANT AI ASSISTANT",
    scanMarket: "RUN TERMINAL SCAN",
    scanning: "SCANNING GLOBAL MARKT...",
    sectorFocus: "Sector Focus",
    timeframe: "Timeframe",
    rankings: "Quant Alpha Rankings",
    signalHeader: "AI Neural Target Output",
    reasoning: "AI Technical Rationale",
    riskCalculator: "Capital Allocation & Leverage Planner",
    perfLog: "Performance Ledger",
    settings: "Terminal Configurations",
    limitNotice: "NSE indices run on delayed high-fidelity simulated feeds. Crypto is connected directly to Binance REST.",
    soundToggle: "Bloomberg Electronic Audio Feed",
    desktopExporter: "Desktop PySide6 App Source Files",
    pcrTitle: "Option Chain Analysis (Derivatives PCR)",
    logSimulated: "Simulate Live Position Entry",
    scoreText: "Quant Score",
    entryText: "Entry Price",
    target: "Target",
    stopLoss: "Stop Loss",
    winProb: "Estimated Win Prob",
    language: "Language (भाषा)",
    activeSetup: "Active Trading Boundaries",
    underlying: "Underlying",
    maxPain: "Max Pain Strike",
    callOI: "Call OI",
    putOI: "Put OI",
    equity: "Total Trading Equity",
    riskPct: "Max Position Risk (%)",
    suggestedUnits: "Suggested Allocation",
    leverageValue: "Position Cash Value",
    riskCash: "Total Max Loss Budget",
    suggestedProfit: "Target Max Return Profile",
  },
  Hindi: {
    terminalTitle: "ब्लूमबर्ग टर्मिनल - क्वांट एआई सहायक",
    scanMarket: "टर्मिनल स्कैन चलाएं",
    scanning: "वैश्विक बाजार का विश्लेषण...",
    sectorFocus: "क्षेत्र फोकस",
    timeframe: "समय सीमा",
    rankings: "क्वांट अल्फा रैंकिंग",
    signalHeader: "एआई न्यूरल टारगेट आउटपुट",
    reasoning: "एआई तकनीकी तर्क विश्लेषण",
    riskCalculator: "पूंजी आवंटन और लीवरेज योजनाकार",
    perfLog: "प्रदर्शन बही खाता",
    settings: "टर्मिनल विन्यास",
    limitNotice: "एनएसई सूचकांक विलंबित सिमुलेटेड फीड पर चलते हैं। क्रिप्टो सीधे बिनेंस रेस्ट से जुड़ा है।",
    soundToggle: "ब्लूमबर्ग इलेक्ट्रॉनिक ऑडियो फीड",
    desktopExporter: "डेस्कटॉप PySide6 ऐप स्रोत कोड",
    pcrTitle: "विकल्प श्रृंखला विश्लेषण (पीसीआर)",
    logSimulated: "लाइव स्थिति प्रवेश रिकॉर्ड करें",
    scoreText: "क्वांट स्कोर",
    entryText: "प्रवेश मूल्य",
    target: "लक्ष्य",
    stopLoss: "स्टॉप लॉस",
    winProb: "अनुमानित जीत संभावना",
    language: "भाषा",
    activeSetup: "सक्रिय व्यापार सीमाएं",
    underlying: "अंडरलाइंग प्राइस",
    maxPain: "मैक्स पेन स्ट्राइक",
    callOI: "कॉल ओआई",
    putOI: "पुट ओआई",
    equity: "कुल ट्रेडिंग इक्विटी",
    riskPct: "अधिकतम स्थिति जोखिम (%)",
    suggestedUnits: "सुझाया गया आवंटन",
    leverageValue: "स्थिति नकद मूल्य",
    riskCash: "कुल अधिकतम हानि बजट",
    suggestedProfit: "लक्ष्य अधिकतम रिटर्न",
  }
};

const CRYPTO_TRADING_TYPES = [
  'Spot Trading',
  'Futures Trading',
  'Options Trading'
];

const NSE_TRADING_TYPES = [
  'Intraday Trading',
  'Futures (F&O)',
  'Options Trading',
  'Delivery Investing'
];

interface StrategyGuideline {
  recommendedTimeframe: string;
  idealTimeframeDesc: string;
  targetDuration: string;
  riskProfile: string;
  explanation: string;
  explanationHindi: string;
}

const STRATEGY_GUIDELINES: Record<string, StrategyGuideline> = {
  // Crypto Trading Types
  'Spot Trading': {
    recommendedTimeframe: '1h',
    idealTimeframeDesc: '1h or 4h',
    targetDuration: '1 to 7 Days (1 से 7 दिन)',
    riskProfile: 'Medium / Normal',
    explanation: 'Standard low-leverage buying and holding. Targets generally resolve over several days. Safe and optimal for steady wealth growth.',
    explanationHindi: 'बिना लीवरेज के सामान्य खरीदारी। टार्गेट आमतौर पर कुछ दिनों में पूरे होते हैं। स्थिर और सुरक्षित कमाई के लिए सर्वोत्तम।'
  },
  'Futures Trading': {
    recommendedTimeframe: '15m',
    idealTimeframeDesc: '5m or 15m or 1h',
    targetDuration: '4 to 24 Hours (4 से 24 घंटे)',
    riskProfile: 'Extremely High Risk (अत्यधिक उच्च जोखिम)',
    explanation: 'Trading leveraged contracts. Fast-moving targets. Positions must have strict Stop Loss and resolve within hours to a day.',
    explanationHindi: 'लीवरेज्ड कांट्रैक्ट्स का व्यापार। बहुत तेज़ गति। स्टॉप लॉस होना बेहद ज़रूरी है, टार्गेट कुछ घंटों से 1 दिन में मिलते हैं।'
  },
  'Margin Trading': {
    recommendedTimeframe: '1h',
    idealTimeframeDesc: '1h or 4h',
    targetDuration: '1 to 3 Days (1 से 3 दिन)',
    riskProfile: 'High Risk',
    explanation: 'Borrowing funds to amplify spot buying power. Best managed with 1h charts, typically resolving in 24 to 72 hours.',
    explanationHindi: 'खरीदारी की शक्ति बढ़ाने के लिए उधार लिए गए फंड के साथ ट्रेड। 1h चार्ट सबसे अच्छा है, आमतौर पर 24-72 घंटे में समाधान।'
  },
  'Scalping': {
    recommendedTimeframe: '15m',
    idealTimeframeDesc: '1m or 5m or 15m',
    targetDuration: '5 to 15 Minutes (5 से 15 मिनट)',
    riskProfile: 'Very High Risk (बहुत उच्च जोखिम)',
    explanation: 'Capturing micro-trends with high frequency. Enter and exit extremely rapidly within minutes. Requires instant reaction times.',
    explanationHindi: 'छोटे-छोटे प्राइस मूवमेंट का बार-बार फायदा उठाना। कुछ ही मिनटों में ट्रेड खत्म करें। इसके लिए बहुत तेज़ी की जरूरत होती है।'
  },
  'Intraday': {
    recommendedTimeframe: '15m',
    idealTimeframeDesc: '15m or 1h',
    targetDuration: '2 to 6 Hours (2 से 6 घंटे)',
    riskProfile: 'Medium-High Risk',
    explanation: 'Positions opened and closed entirely within the single trading session to avoid overnight volatility risks.',
    explanationHindi: 'एक ही दिन में पोजीशन खोलना और बंद करना ताकि रातभर की बाजार अनिश्चितता से बचा जा सके।'
  },
  'Swing Trading': {
    recommendedTimeframe: '4h',
    idealTimeframeDesc: '4h or 1d',
    targetDuration: '3 to 14 Days (3 से 14 दिन)',
    riskProfile: 'Medium Risk',
    explanation: 'Capturing larger multi-day price swings. Optimal entry point is identified using 4h/1d support lines and key breakouts.',
    explanationHindi: 'कई दिनों के बड़े प्राइस स्विंग्स को पकड़ना। 4h/1d चार्ट पर सपोर्ट और ब्रेकआउट देखकर एंट्री लें।'
  },
  'Position Trading': {
    recommendedTimeframe: '1d',
    idealTimeframeDesc: '1d or 1w',
    targetDuration: '3 to 12 Weeks (3 से 12 सप्ताह)',
    riskProfile: 'Low-Medium Risk',
    explanation: 'Long-term trend following. Holds positions through temporary fluctuations to capture massive structural moves.',
    explanationHindi: 'दीर्घकालिक ट्रेंड का अनुसरण। बड़े स्ट्रक्चरल बदलावों को कैप्चर करने के लिए हफ्तों तक पोजीशन होल्ड करें।'
  },
  'Copy Trading': {
    recommendedTimeframe: '1h',
    idealTimeframeDesc: '1h or 4h',
    targetDuration: 'Varies with Master Trader (मास्टर ट्रेडर के अनुसार)',
    riskProfile: 'Varies with Trader Profile',
    explanation: 'Mirroring professional traders. Recommended to monitor on 1h/4h frames to stay updated with portfolio changes.',
    explanationHindi: 'पेशेवर ट्रेडर्स के ट्रेड्स को कॉपी करना। पोर्टफोलियो बदलावों पर नज़र रखने के लिए 1h या 4h चार्ट देखें।'
  },
  'Grid Bot Trading': {
    recommendedTimeframe: '1h',
    idealTimeframeDesc: '15m or 1h or 4h',
    targetDuration: 'Continuous Profits (लगातार ग्रिड हिट)',
    riskProfile: 'Medium Risk',
    explanation: 'Automated range-bound grid execution. Buys low and sells high continuously in defined sideways channels.',
    explanationHindi: 'फ्लैट/साइडवेज़ मार्केट के लिए बेस्ट। पहले से तय प्राइस रेंज में रोबोट लगातार सस्ते में खरीदकर महंगे में बेचता है।'
  },

  // Stock Market (NSE) Trading Types
  'Delivery Investing': {
    recommendedTimeframe: '1d',
    idealTimeframeDesc: '1d or 1w',
    targetDuration: '3 to 12 Months (3 से 12 महीने)',
    riskProfile: 'Conservative / Low Risk',
    explanation: 'Buying equity shares with full cash capital and storing them in Demat. Holds for long-term compounding and dividends.',
    explanationHindi: 'पूरा पैसा देकर शेयर्स खरीदना और उन्हें अपने डीमैट अकाउंट में रखना। लंबी अवधि के निवेश और वेल्थ क्रिएशन के लिए सर्वोत्तम।'
  },
  'Intraday Trading': {
    recommendedTimeframe: '15m',
    idealTimeframeDesc: '5m or 15m or 1h',
    targetDuration: '1 to 5 Hours (1 से 5 घंटे)',
    riskProfile: 'High Risk',
    explanation: 'Leveraged stock trading. Positions must be squared off before 3:15 PM of the same business day.',
    explanationHindi: 'लीवरेज्ड ट्रेडिंग। उसी दिन दोपहर 3:15 बजे से पहले अनिवार्य रूप से पोजीशन बंद करनी होती है।'
  },
  'Positional Trading': {
    recommendedTimeframe: '1d',
    idealTimeframeDesc: '4h or 1d',
    targetDuration: '2 to 8 Weeks (2 से 8 सप्ताह)',
    riskProfile: 'Medium Risk',
    explanation: 'Targeting mid-term stock earnings breakouts or company news catalysts over a couple of weeks/months.',
    explanationHindi: 'कुछ हफ्तों या महीनों के लिए स्टॉक खरीदना। तिमाही नतीजों या बड़े न्यूज ट्रिगर्स का लाभ उठाने के लिए बेहतरीन।'
  },
  'Futures (F&O)': {
    recommendedTimeframe: '15m',
    idealTimeframeDesc: '15m or 1h',
    targetDuration: '1 to 5 Days (1 से 5 दिन)',
    riskProfile: 'Extremely High Risk',
    explanation: 'High-leverage future contract positions. Resolves before monthly expiry contracts. Requires strong discipline.',
    explanationHindi: 'हाई लीवरेज्ड फ्यूचर कॉन्ट्रैक्ट्स। मंथली एक्सपायरी से पहले हल किया जाता है। बहुत सख्त अनुशासन की आवश्यकता।'
  },
  'Options Trading': {
    recommendedTimeframe: '15m',
    idealTimeframeDesc: '5m or 15m',
    targetDuration: '10 Mins to 4 Hours (10 मिनट से 4 घंटे)',
    riskProfile: 'Extremely High Volatility Risk',
    explanation: 'Buying Calls/Puts or selling premiums. Heavy time decay (Theta) and rapid option price swings require close attention.',
    explanationHindi: 'कॉल/पुट की खरीद-फरोख्त। टाइम डिके (थीटा) और बहुत तेज़ उतार-चढ़ाव। 15 मिनट से 5 मिनट चार्ट पर तेज़ एंट्री-एग्जिट सर्वोत्तम।'
  },
  'Algo Trading': {
    recommendedTimeframe: '15m',
    idealTimeframeDesc: 'System Programmed (सिस्टम प्रोग्राम्ड)',
    targetDuration: 'Seconds to Hours (सेकंड से घंटे)',
    riskProfile: 'Systemic / Medium-High Risk',
    explanation: 'Executing trades based on pre-programmed computer algorithm rules. Ignores human emotions completely.',
    explanationHindi: 'पहले से बने कंप्यूटर कोडिंग रूल्स के आधार पर ऑटोमैटिक ट्रेड होना। यह इंसानी भावनाओं से पूरी तरह मुक्त होता है।'
  }
};

interface DetectedPattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  index: number;
  icon: string;
  description: string;
  hindiDescription: string;
}

function detectCandlestickPatterns(candles: any[]): DetectedPattern[] {
  if (candles.length < 3) return [];
  const patterns: DetectedPattern[] = [];

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    if (range === 0) continue;

    const isBullish = c.close >= c.open;
    const bodyUpper = Math.max(c.open, c.close);
    const bodyLower = Math.min(c.open, c.close);

    const upperWick = c.high - bodyUpper;
    const lowerWick = bodyLower - c.low;

    // 1. Doji (Indecision)
    if (body <= range * 0.08) {
      patterns.push({
        name: 'Doji',
        type: 'neutral',
        index: i,
        icon: '⚖️',
        description: 'Indecision candle, open and close are extremely close. Signals potential trend reversal.',
        hindiDescription: 'दुविधा कैंडल, ओपन और क्लोज़ बेहद करीब हैं। संभावित ट्रेंड रिवर्सल का संकेत देता है।'
      });
      continue;
    }

    // 2. Hammer (Bullish Reversal)
    if (lowerWick >= body * 1.8 && upperWick <= body * 0.3 && !isBullish) {
      patterns.push({
        name: 'Hammer',
        type: 'bullish',
        index: i,
        icon: '🔨',
        description: 'Bullish Hammer, formed near support with a long lower shadow. Strong buying interest.',
        hindiDescription: 'बुलिश हैमर, लंबे निचले शैडो के साथ सपोर्ट के पास बनता है। खरीदारों की मजबूत रुचि।'
      });
      continue;
    }

    // 3. Shooting Star (Bearish Reversal)
    if (upperWick >= body * 1.8 && lowerWick <= body * 0.3 && isBullish) {
      patterns.push({
        name: 'Shooting Star',
        type: 'bearish',
        index: i,
        icon: '☄️',
        description: 'Bearish Shooting Star, formed near resistance with a long upper shadow. Rejection of higher prices.',
        hindiDescription: 'बेयरिश शूटिंग स्टार, लंबे ऊपरी शैडो के साथ रेजिस्टेंस के पास बनता है। उच्च कीमतों का रिजेक्शन।'
      });
      continue;
    }

    // 4. Bullish Engulfing
    if (prev.close < prev.open) { // previous red
      if (c.close > c.open && c.close >= prev.open && c.open <= prev.close) {
        patterns.push({
          name: 'Bullish Engulfing',
          type: 'bullish',
          index: i,
          icon: '📈',
          description: 'Strong bullish engulfing pattern. Buyers took complete control of the session.',
          hindiDescription: 'मजबूत बुलिश एनगल्फिंग पैटर्न। खरीदारों ने सत्र का पूरा नियंत्रण ले लिया।'
        });
        continue;
      }
    }

    // 5. Bearish Engulfing
    if (prev.close > prev.open) { // previous green
      if (c.close < c.open && c.close <= prev.open && c.open >= prev.close) {
        patterns.push({
          name: 'Bearish Engulfing',
          type: 'bearish',
          index: i,
          icon: '📉',
          description: 'Strong bearish engulfing pattern. Sellers completely overpowered the buyers.',
          hindiDescription: 'मजबूत बेयरिश एनगल्फिंग पैटर्न। विक्रेताओं ने खरीदारों पर पूरी तरह से काबू पा लिया।'
        });
        continue;
      }
    }

    // 6. Marubozu
    if (body >= range * 0.88) {
      patterns.push({
        name: isBullish ? 'Bullish Marubozu' : 'Bearish Marubozu',
        type: isBullish ? 'bullish' : 'bearish',
        index: i,
        icon: isBullish ? '🚀' : '🩸',
        description: isBullish 
          ? 'Solid green body with virtually no wicks. Extreme buying pressure.' 
          : 'Solid red body with virtually no wicks. Extreme selling pressure.',
        hindiDescription: isBullish
          ? 'बिना शैडो के मजबूत हरी बॉडी। अत्यधिक खरीद दबाव।'
          : 'बिना शैडो के मजबूत लाल बॉडी। अत्यधिक बिकवाली दबाव।'
      });
      continue;
    }
  }

  return patterns;
}

export default function App() {
  // Terminal UI State
  const [market, setMarket] = useState<'NSE' | 'Crypto'>('Crypto');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [tradingType, setTradingType] = useState<string>('Spot Trading');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isScanningCustom, setIsScanningCustom] = useState<boolean>(false);
  const [lang, setLang] = useState<'English' | 'Hindi'>('English');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'ai' | 'options' | 'risk' | 'performance' | 'desktop'>('ai');

  // Scanner & Analysis State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<ScanResult | null>(null);
  const [aiSignal, setAiSignal] = useState<AISignal | null>(null);
  const [scannedNews, setScannedNews] = useState<{ title: string; sentiment: 'positive' | 'negative' | 'neutral'; time: string }[]>([]);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [optionChain, setOptionChain] = useState<OptionChainData | null>(null);

  // Technical chart states
  const [chartCandles, setChartCandles] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [hoveredCandle, setHoveredCandle] = useState<any | null>(null);

  // Risk sizer states
  const [accountEquity, setAccountEquity] = useState<number>(25000);
  const [tradeRiskPct, setTradeRiskPct] = useState<number>(1.5);

  // Trade logs performance states
  const [perfHistory, setPerfHistory] = useState<TradeLog[]>([]);
  const [perfStats, setPerfStats] = useState<any>({
    total: 0, wins: 0, losses: 0, accuracy: 0, avgProfit: 0, avgLoss: 0, maxDrawdown: 4.2
  });

  // Terminal Log screen message list
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "Terminal initialization sequence... OK",
    "Loaded local offline SQL performance database",
    "Ready for user input"
  ]);

  // Audio Context Ref for Bloomberg Terminal beeps
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Get active translation dictionary
  const t = TRANSLATIONS[lang];

  // System time ticker
  const [currentTime, setCurrentTime] = useState<string>("");
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toISOString().replace('T', ' ').substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Web Audio Synth Alert Beep
  const playTerminalBeep = (freq: number, duration: number, type: 'sine' | 'square' | 'triangle' = 'sine') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context block or error:", e);
    }
  };

  const addConsoleLog = (msg: string) => {
    setConsoleLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 24)]);
  };

  // Fetch initial stats and list
  useEffect(() => {
    console.log('FRONTEND READY');
    fetchPerformanceStats();
    // Default initial scan
    triggerGlobalScan();
    console.log('APPLICATION READY');
  }, []);

  // Sync active trading type when market changes
  useEffect(() => {
    if (market === 'Crypto') {
      setTradingType('Spot Trading');
    } else {
      setTradingType('Delivery Investing');
    }
  }, [market]);

  // Sync recommended timeframe on tradingType change
  useEffect(() => {
    const guideline = STRATEGY_GUIDELINES[tradingType];
    if (guideline) {
      setTimeframe(guideline.recommendedTimeframe);
      addConsoleLog(`[Strategy sync] Selected ${tradingType}. Auto-tuned chart to recommended ${guideline.recommendedTimeframe} timeframe.`);
    }
  }, [tradingType]);

  // Re-fetch or simulate options chain if active stock changes, or strategy/timeframe changes
  useEffect(() => {
    if (selectedAsset) {
      fetchChartData(selectedAsset.symbol, selectedAsset.market);
      fetchAISignal(selectedAsset, tradingType);
      if (selectedAsset.market === 'NSE') {
        fetchOptionsChain(selectedAsset.symbol);
      }
    }
  }, [selectedAsset, tradingType, timeframe]);

  const fetchPerformanceStats = async () => {
    try {
      const res = await fetch('/api/performance');
      const data = await res.json();
      if (data.success) {
        setPerfHistory(data.history);
        setPerfStats(data.stats);
      }
    } catch (e) {
      console.error("Failed to load performance stats:", e);
    }
  };

  const triggerGlobalScan = async () => {
    setIsScanning(true);
    addConsoleLog(`Initiating quant scanning sequence for ${market} focus sector...`);
    playTerminalBeep(520, 0.1, 'sine');
    
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market, timeframe })
      });
      const data = await res.json();
      if (data.success && data.results && data.results.length > 0) {
        setScanResults(data.results);
        setSelectedAsset(data.results[0]);
        addConsoleLog(`Scan successful. Quant ranked ${data.results.length} targets. Selected #${data.results[0].symbol} as highest Alpha.`);
        playTerminalBeep(880, 0.15, 'sine');
      } else {
        addConsoleLog(`Scan returned empty results or failed.`);
      }
    } catch (e) {
      addConsoleLog(`Scan error: Connection failed. Using high-fidelity fallbacks.`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanCustomAsset = async () => {
    if (!searchQuery.trim()) return;
    const symbolToScan = searchQuery.trim().toUpperCase();
    setIsScanningCustom(true);
    addConsoleLog(`Searching and scanning "${symbolToScan}" in ${market} market...`);
    playTerminalBeep(700, 0.1, 'sine');

    try {
      const res = await fetch(`/api/market-data?symbol=${symbolToScan}&timeframe=${timeframe}&market=${market}`);
      const data = await res.json();
      
      if (data.success && data.candles && data.candles.length > 0) {
        const newAsset: ScanResult = {
          symbol: symbolToScan,
          name: data.name || `${symbolToScan} Asset`,
          market: market,
          indicators: data.indicators,
          score: data.score,
          signalStrength: data.signalStrength
        };

        setScanResults(prev => {
          const exists = prev.some(item => item.symbol === symbolToScan);
          if (exists) {
            return prev.map(item => item.symbol === symbolToScan ? newAsset : item);
          } else {
            return [newAsset, ...prev];
          }
        });

        setSelectedAsset(newAsset);
        setChartCandles(data.candles);
        addConsoleLog(`Successfully scanned and loaded custom asset ${symbolToScan}. Quant score: ${data.score}`);
        playTerminalBeep(880, 0.15, 'sine');
        setSearchQuery('');
      } else {
        addConsoleLog(`Symbol "${symbolToScan}" not found or unsupported in ${market}.`);
        playTerminalBeep(300, 0.15, 'triangle');
      }
    } catch (e: any) {
      addConsoleLog(`Error scanning custom asset "${symbolToScan}".`);
      playTerminalBeep(300, 0.15, 'triangle');
    } finally {
      setIsScanningCustom(false);
    }
  };

  const fetchChartData = async (symbol: string, sector: string) => {
    setChartLoading(true);
    try {
      const res = await fetch(`/api/market-data?symbol=${symbol}&timeframe=${timeframe}&market=${sector}`);
      const data = await res.json();
      if (data.success) {
        setChartCandles(data.candles);
      }
    } catch (e) {
      addConsoleLog(`Failed to fetch chart candlesticks for ${symbol}.`);
    } finally {
      setChartLoading(false);
    }
  };

  const fetchAISignal = async (asset: ScanResult, activeTradingType?: string) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: asset.symbol,
          name: asset.name,
          market: asset.market,
          indicators: asset.indicators,
          timeframe,
          tradingType: activeTradingType || tradingType
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiSignal(data.analysis);
        setScannedNews(data.scannedNews || []);
        addConsoleLog(`AI target coordinates updated for ${asset.symbol}. Strategy: ${activeTradingType || tradingType}. Win Prob: ${data.analysis.winProbabilityEstimate}`);
      }
    } catch (e) {
      addConsoleLog(`Error in neural prediction model.`);
    } finally {
      setAiLoading(false);
    }
  };

  const fetchOptionsChain = async (symbol: string) => {
    try {
      const res = await fetch(`/api/options-chain?symbol=${symbol}`);
      const data = await res.json();
      if (data.success) {
        setOptionChain(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogSimulatedTrade = async () => {
    if (!selectedAsset || !aiSignal) return;

    const isWin = selectedAsset.score > 53;
    const gainPct = isWin ? 3.2 : -1.8;
    const profitVal = (accountEquity * (tradeRiskPct / 100)) * (isWin ? 2.0 : -1.0);

    const payload = {
      symbol: selectedAsset.symbol,
      type: selectedAsset.market,
      action: aiSignal.action,
      entry: selectedAsset.indicators.currentPrice,
      close: isWin ? selectedAsset.indicators.currentPrice * 1.032 : selectedAsset.indicators.currentPrice * 0.982,
      profit: parseFloat(profitVal.toFixed(2)),
      pnlPct: gainPct,
      result: isWin ? 'Win' : 'Loss'
    };

    try {
      const res = await fetch('/api/add-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        playTerminalBeep(980, 0.25, 'triangle');
        addConsoleLog(`Trade simulation written to offline stats. Recorded $${profitVal.toFixed(2)} ${isWin ? 'Profit' : 'Loss'}`);
        fetchPerformanceStats();
      }
    } catch (e) {
      addConsoleLog(`Failed to update performance log.`);
    }
  };

  // Safe Position calculator logic
  const calculatedRiskAlloc = useMemo(() => {
    if (!selectedAsset) return null;
    const entry = selectedAsset.indicators.currentPrice;
    const isBuy = selectedAsset.score > 50;
    // Standard 1.5% SL calculation for local risk metric
    const sl = isBuy ? entry * 0.985 : entry * 1.015;
    
    const riskPerShare = Math.abs(entry - sl);
    const riskCash = accountEquity * (tradeRiskPct / 100);
    const units = riskPerShare > 0 ? parseFloat((riskCash / riskPerShare).toFixed(4)) : 0;
    const totalCost = parseFloat((units * entry).toFixed(2));
    
    const warning = totalCost > accountEquity * 2 
      ? "⚠️ Warning: Excessive leverage allocation. Exceeds 2x cash equity limit." 
      : (totalCost < 50 ? "⚠️ Note: Insufficient size parameters." : null);

    return {
      units,
      totalCost,
      riskCash: parseFloat(riskCash.toFixed(2)),
      warning
    };
  }, [selectedAsset, accountEquity, tradeRiskPct]);

  // SVG Chart Dimensions & Computations
  const chartHeight = 220;
  const chartWidth = 650;
  
  const minMaxCloses = useMemo(() => {
    if (chartCandles.length === 0) return { min: 0, max: 100 };
    const prices = chartCandles.map(c => c.close);
    const highs = chartCandles.map(c => c.high);
    const lows = chartCandles.map(c => c.low);
    return {
      min: Math.min(...lows) * 0.995,
      max: Math.max(...highs) * 1.005
    };
  }, [chartCandles]);

  // Map Price to SVG coordinates
  const scaleY = (val: number) => {
    const range = minMaxCloses.max - minMaxCloses.min;
    if (range === 0) return chartHeight / 2;
    return chartHeight - ((val - minMaxCloses.min) / range) * chartHeight;
  };

  // Download Python PySide6 Source Files dynamically
  const downloadPythonFiles = async () => {
    try {
      const res = await fetch('/api/download-python');
      const data = await res.json();
      if (data.success && data.files) {
        data.files.forEach((file: { name: string; content: string }) => {
          const blob = new Blob([file.content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `desktop_${file.name}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
        addConsoleLog("Exported full PySide6 Desktop core codebase successfully.");
      }
    } catch (e) {
      addConsoleLog("Failed to bundle desktop python app files.");
    }
  };

  return (
    <div className="min-h-screen bg-[#070708] text-[#e1e2e6] font-mono text-xs selection:bg-[#00e676] selection:text-black flex flex-col">
      
      {/* 1. TOP DENSE TICKER BAR (Bloomberg Vibe) */}
      <header className="border-b border-[#202124] bg-[#0c0c0e] px-4 py-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <Activity className="text-[#00e676] animate-pulse w-4 h-4" />
          <h1 id="terminal-header" className="font-bold text-[#00e676] tracking-wide uppercase text-[11px] sm:text-xs">
            {t.terminalTitle}
          </h1>
          <span className="hidden md:inline px-2 py-0.5 bg-[#161b22] border border-[#30363d] rounded text-[10px] text-[#8b949e]">
            {market === 'Crypto' ? '● LIVE TICKER FEED' : '● SIMULATED FEED'}
          </span>
        </div>

        {/* Dynamic global market indexes */}
        <div className="hidden lg:flex items-center space-x-6 text-[10px] text-gray-400">
          <div className="flex items-center space-x-1.5">
            <span>NIFTY 50:</span>
            <span className="text-[#00e676] font-bold">23,500.25 (+0.42%)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span>BANK NIFTY:</span>
            <span className="text-[#00e676] font-bold">51,200.10 (+0.58%)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span>BTC/USDT:</span>
            <span className="text-red-500 font-bold">$63,120.40 (-0.12%)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span>ETH/USDT:</span>
            <span className="text-[#00e676] font-bold">$3,425.80 (+1.15%)</span>
          </div>
        </div>

        {/* Control and Clock alignment */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 text-gray-500">
            <Clock className="w-3.5 h-3.5 text-[#888]" />
            <span className="text-[10px]">{currentTime}</span>
          </div>
          <button
            id="audio-toggle"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1 rounded border transition-colors ${
              soundEnabled ? 'border-[#00e676] text-[#00e676] bg-[#00e676]/10' : 'border-[#30363d] text-gray-500 hover:text-gray-300'
            }`}
            title="Toggle terminal sound alerts"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* 2. MAIN SPLIT TERMINAL PANELS */}
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-2 p-2 overflow-hidden">
        
        {/* LEFT COLUMN: CONTROL & QUANT RANKINGS (5 Cols) */}
        <div className="xl:col-span-5 flex flex-col space-y-2 overflow-y-auto">
          
          {/* A. Terminal controls panel */}
          <div className="border border-[#1f2833] bg-[#0c0d12] rounded p-3 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#00e676] font-bold tracking-wider uppercase text-[10px] flex items-center space-x-1.5">
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>{t.sectorFocus}</span>
              </span>
              <div className="flex space-x-1">
                <button
                  id="market-crypto"
                  onClick={() => { setMarket('Crypto'); playTerminalBeep(440, 0.08); }}
                  className={`px-3 py-1 border rounded text-[10px] font-bold transition-all ${
                    market === 'Crypto'
                      ? 'border-[#00e676] text-[#00e676] bg-[#00e676]/10'
                      : 'border-[#30363d] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  Crypto Spot & Futures
                </button>
                <button
                  id="market-nse"
                  onClick={() => { setMarket('NSE'); playTerminalBeep(440, 0.08); }}
                  className={`px-3 py-1 border rounded text-[10px] font-bold transition-all ${
                    market === 'NSE'
                      ? 'border-[#00e676] text-[#00e676] bg-[#00e676]/10'
                      : 'border-[#30363d] text-gray-400 hover:border-gray-500'
                  }`}
                >
                  NSE Equity & Derivatives
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div className="flex flex-col space-y-1 sm:col-span-2">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Trading Strategy & Mode:</label>
                <select
                  id="trading-type-select"
                  value={tradingType}
                  onChange={(e) => { setTradingType(e.target.value); playTerminalBeep(330, 0.05); }}
                  className="bg-[#121319] border border-[#2e2f38] text-[#00e676] font-bold rounded p-1.5 focus:border-[#00e676] focus:outline-none text-[11px]"
                >
                  {(market === 'Crypto' ? CRYPTO_TRADING_TYPES : NSE_TRADING_TYPES).map((type) => (
                    <option key={type} value={type} className="bg-[#0c0d12] text-gray-200">
                      🎯 {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  id="scan-btn"
                  disabled={isScanning}
                  onClick={triggerGlobalScan}
                  className={`w-full py-2 px-4 rounded text-[10px] font-bold tracking-widest flex items-center justify-center space-x-2 transition-all ${
                    isScanning
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-[#30363d]'
                      : 'bg-[#00e676] hover:bg-[#00c853] text-black border border-transparent shadow-[0_0_15px_rgba(0,230,118,0.2)]'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? t.scanning : t.scanMarket}</span>
                </button>
              </div>
            </div>
          </div>

          {/* B. Quant Alpha Rankings List */}
          <div className="border border-[#1f2833] bg-[#0c0d12] rounded flex-1 flex flex-col overflow-hidden shadow-md">
            <div className="px-3 py-2 border-b border-[#202124] flex items-center justify-between bg-[#111218]">
              <span className="text-[#00e676] font-bold tracking-wider uppercase text-[10px] flex items-center space-x-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#00e676]" />
                <span>{t.rankings}</span>
              </span>
              <span className="text-[10px] text-gray-400">Total Scanned: {scanResults.length}</span>
            </div>

            {/* Search Bar & Custom Asset Scanner */}
            <div className="p-2 border-b border-[#202124] bg-[#0d0e14] flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search assets or enter custom symbol (e.g., SOLUSDT)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#121319] border border-[#2e2f38] text-gray-200 rounded px-2 py-1.5 text-[10px] focus:border-[#00e676] focus:outline-none placeholder:text-gray-600"
                />
              </div>
              {searchQuery.trim() !== '' && (
                <button
                  onClick={handleScanCustomAsset}
                  disabled={isScanningCustom}
                  className="bg-[#2979ff] hover:bg-[#2979ff]/80 text-white font-bold text-[9px] px-2.5 py-1.5 rounded border border-transparent flex items-center space-x-1 shrink-0 transition-all uppercase"
                >
                  <span>{isScanningCustom ? 'Scanning...' : 'Scan & Add'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#202124] text-gray-400 bg-[#0f1016] text-[10px]">
                    <th className="p-2">Asset</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 text-center">Trend</th>
                    <th className="p-2 text-center">{t.scoreText}</th>
                    <th className="p-2 text-center">Strength</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b1c21]">
                  {scanResults
                    .filter(item => 
                      item.symbol.toLowerCase().includes(searchQuery.toLowerCase().trim()) || 
                      item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
                    )
                    .map((item, index) => {
                      const isSelected = selectedAsset?.symbol === item.symbol;
                      const isBuy = item.score >= 65;
                      const isSell = item.score <= 35;
                      const badgeColor = isBuy 
                        ? 'text-[#00e676] bg-[#00e676]/10 border-[#00e676]/30' 
                        : isSell 
                          ? 'text-red-500 bg-red-500/10 border-red-500/30' 
                          : 'text-[#ffb300] bg-[#ffb300]/10 border-[#ffb300]/30';

                      return (
                        <tr
                          key={item.symbol}
                          onClick={() => { setSelectedAsset(item); playTerminalBeep(600, 0.05); }}
                          className={`cursor-pointer transition-all ${
                            isSelected ? 'bg-[#00e676]/5 border-l-2 border-[#00e676]' : 'hover:bg-gray-900/50'
                          }`}
                        >
                          <td className="p-2 flex flex-col">
                            <span className="font-bold text-gray-200">{item.symbol}</span>
                            <span className="text-[9px] text-gray-500 truncate max-w-[120px]">{item.name}</span>
                          </td>
                          <td className="p-2 text-right font-bold text-gray-300">
                            {item.indicators.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-1 rounded text-[9px] ${
                              item.indicators.trend === 'Bullish' ? 'text-[#00e676]' : item.indicators.trend === 'Bearish' ? 'text-red-500' : 'text-gray-400'
                            }`}>
                              {item.indicators.trend}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <span className="font-bold">{item.score}</span>
                              <div className="w-1.5 h-1.5 rounded-full" style={{
                                backgroundColor: item.score >= 80 ? '#00e676' : item.score >= 65 ? '#81c784' : item.score <= 20 ? '#f44336' : item.score <= 35 ? '#e57373' : '#ffb300'
                              }} />
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${badgeColor}`}>
                              {item.signalStrength}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                  {scanResults.filter(item => 
                    item.symbol.toLowerCase().includes(searchQuery.toLowerCase().trim()) || 
                    item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
                  ).length === 0 && searchQuery.trim() !== '' && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center bg-[#161a22]/20">
                        <p className="text-gray-500 text-[10px] mb-2">No matching asset in scanned list.</p>
                        <button
                          onClick={handleScanCustomAsset}
                          disabled={isScanningCustom}
                          className="px-3 py-1 bg-[#2979ff] hover:bg-[#2979ff]/80 text-white font-bold rounded text-[9px] transition-all uppercase"
                        >
                          {isScanningCustom ? 'Scanning...' : `Scan & Add "${searchQuery.toUpperCase()}"`}
                        </button>
                      </td>
                    </tr>
                  )}

                  {scanResults.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        No targets currently scanned. Click scan button above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Transparent limitations banner */}
            <div className="p-2 bg-[#121319] border-t border-[#1f2833] flex items-start space-x-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#ffb300] shrink-0 mt-0.5" />
              <p className="text-[9px] text-[#ffb300] leading-relaxed">
                {t.limitNotice}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE CHART & SIGNAL DETAILS (7 Cols) */}
        <div className="xl:col-span-7 flex flex-col space-y-2 overflow-y-auto">
          
          {/* A. Dynamic Interactive SVG Candlestick Chart */}
          <div className="border border-[#1f2833] bg-[#0c0d12] rounded p-3 shadow-md flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse" />
                <span className="font-bold text-gray-200">
                  {selectedAsset ? `${selectedAsset.name} (${selectedAsset.symbol})` : 'Select an Asset'}
                </span>
                <span className="text-[10px] text-gray-500">| Interval: {timeframe}</span>
              </div>
              <div className="flex items-center space-x-3 text-[10px]">
                <div className="flex items-center space-x-1">
                  <div className="w-2.5 h-0.5 bg-[#ff1744] border-t border-dashed" />
                  <span className="text-gray-400">Resist</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2.5 h-0.5 bg-[#2979ff] border-t border-dashed" />
                  <span className="text-gray-400">Support</span>
                </div>
              </div>
            </div>

            {/* Candlestick Coordinate display */}
            <div className="bg-[#121319] p-1.5 border border-[#1f2833] rounded mb-2 flex items-center justify-between text-[10px] text-gray-400 overflow-x-auto whitespace-nowrap">
              <span>O: <strong className="text-gray-200">{hoveredCandle ? hoveredCandle.open.toFixed(2) : (chartCandles[chartCandles.length - 1]?.open || '--')}</strong></span>
              <span>H: <strong className="text-[#00e676]">{hoveredCandle ? hoveredCandle.high.toFixed(2) : (chartCandles[chartCandles.length - 1]?.high || '--')}</strong></span>
              <span>L: <strong className="text-red-400">{hoveredCandle ? hoveredCandle.low.toFixed(2) : (chartCandles[chartCandles.length - 1]?.low || '--')}</strong></span>
              <span>C: <strong className="text-gray-200">{hoveredCandle ? hoveredCandle.close.toFixed(2) : (chartCandles[chartCandles.length - 1]?.close || '--')}</strong></span>
              <span>V: <strong className="text-gray-400">{hoveredCandle ? hoveredCandle.volume.toLocaleString() : (chartCandles[chartCandles.length - 1]?.volume || '--')}</strong></span>
            </div>

            <div className="relative h-[220px] bg-[#14151b] border border-[#2e2f38] rounded flex items-center justify-center overflow-hidden">
              {chartLoading ? (
                <div className="text-gray-500 animate-pulse">Calculating indicators and drawing chart layers...</div>
              ) : chartCandles.length > 0 ? (
                <svg
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  preserveAspectRatio="none"
                  className="overflow-visible select-none"
                >
                  {/* Grid Lines */}
                  {[0.25, 0.5, 0.75].map((ratio, index) => (
                    <line
                      key={index}
                      x1={0}
                      y1={chartHeight * ratio}
                      x2={chartWidth}
                      y2={chartHeight * ratio}
                      stroke="#222329"
                      strokeWidth={0.5}
                      strokeDasharray="2 2"
                    />
                  ))}

                  {/* Calculated S/R levels */}
                  {selectedAsset && (
                    <>
                      {/* High / Resistance level estimation */}
                      <line
                        x1={0}
                        y1={scaleY(selectedAsset.indicators.bollingerBands.upper)}
                        x2={chartWidth}
                        y2={scaleY(selectedAsset.indicators.bollingerBands.upper)}
                        stroke="#ff1744"
                        strokeWidth={0.75}
                        strokeDasharray="4 4"
                        opacity={0.5}
                      />
                      {/* Low / Support level estimation */}
                      <line
                        x1={0}
                        y1={scaleY(selectedAsset.indicators.bollingerBands.lower)}
                        x2={chartWidth}
                        y2={scaleY(selectedAsset.indicators.bollingerBands.lower)}
                        stroke="#2979ff"
                        strokeWidth={0.75}
                        strokeDasharray="4 4"
                        opacity={0.5}
                      />
                    </>
                  )}

                  {/* Draw Targets and SL lines from active setup */}
                  {aiSignal && (
                    <>
                      {/* Entry Price Line */}
                      <line
                        x1={0}
                        y1={scaleY(aiSignal.entryPrice)}
                        x2={chartWidth}
                        y2={scaleY(aiSignal.entryPrice)}
                        stroke="#ffb300"
                        strokeWidth={1}
                        opacity={0.8}
                      />
                      <text x={8} y={scaleY(aiSignal.entryPrice) - 3} fill="#ffb300" fontSize={8} fontFamily="monospace">
                        ENTRY: {aiSignal.entryPrice}
                      </text>

                      {/* Target 1 Line */}
                      <line
                        x1={0}
                        y1={scaleY(aiSignal.target1)}
                        x2={chartWidth}
                        y2={scaleY(aiSignal.target1)}
                        stroke="#00e676"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        opacity={0.8}
                      />
                      <text x={8} y={scaleY(aiSignal.target1) - 3} fill="#00e676" fontSize={8} fontFamily="monospace">
                        T1: {aiSignal.target1}
                      </text>

                      {/* Stop Loss Line */}
                      <line
                        x1={0}
                        y1={scaleY(aiSignal.stopLoss)}
                        x2={chartWidth}
                        y2={scaleY(aiSignal.stopLoss)}
                        stroke="#ff1744"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        opacity={0.8}
                      />
                      <text x={8} y={scaleY(aiSignal.stopLoss) - 3} fill="#ff1744" fontSize={8} fontFamily="monospace">
                        SL: {aiSignal.stopLoss}
                      </text>
                    </>
                  )}

                  {/* Candlestick Wicks & Bodies */}
                  {chartCandles.map((c, index) => {
                    const slotWidth = chartWidth / chartCandles.length;
                    const centerX = slotWidth * index + slotWidth / 2;
                    const wickX1 = centerX;
                    const wickY1 = scaleY(c.high);
                    const wickY2 = scaleY(c.low);

                    const isBullish = c.close >= c.open;
                    const bodyY1 = scaleY(isBullish ? c.close : c.open);
                    const bodyY2 = scaleY(isBullish ? c.open : c.close);
                    const bodyHeight = Math.max(1.5, Math.abs(bodyY2 - bodyY1));
                    const bodyWidth = Math.max(1.5, slotWidth * 0.62);
                    const bodyX = slotWidth * index + (slotWidth - bodyWidth) / 2;

                    const color = isBullish ? '#00e676' : '#ff1744';

                    return (
                      <g key={index}>
                        {/* Shadow/Wick */}
                        <line
                          x1={wickX1}
                          y1={wickY1}
                          x2={wickX1}
                          y2={wickY2}
                          stroke={color}
                          strokeWidth={1}
                          opacity={0.8}
                        />

                        {/* Solid/Hollow candle body */}
                        <rect
                          x={bodyX}
                          y={bodyY1}
                          width={bodyWidth}
                          height={bodyHeight}
                          fill={isBullish ? 'transparent' : color}
                          stroke={color}
                          strokeWidth={1.2}
                        />

                        {/* Interactive Candle bar collider for hover details */}
                        <rect
                          x={slotWidth * index}
                          y={0}
                          width={slotWidth}
                          height={chartHeight}
                          fill="transparent"
                          className="cursor-pointer hover:fill-white/5"
                          onMouseEnter={() => setHoveredCandle(c)}
                          onMouseLeave={() => setHoveredCandle(null)}
                        />
                      </g>
                    );
                  })}

                  {/* High-tech Moving Average Overlay Line */}
                  {chartCandles.length > 10 && (
                    <polyline
                      fill="none"
                      stroke="#2979ff"
                      strokeWidth={1.2}
                      opacity={0.7}
                      points={(() => {
                        const points: {x: number, y: number}[] = [];
                        const period = 10;
                        for (let i = 0; i < chartCandles.length; i++) {
                          if (i < period - 1) continue;
                          const slice = chartCandles.slice(i - period + 1, i + 1);
                          const avg = slice.reduce((sum, cc) => sum + cc.close, 0) / period;
                          const slotWidth = chartWidth / chartCandles.length;
                          const x = slotWidth * i + slotWidth / 2;
                          const y = scaleY(avg);
                          points.push({ x, y });
                        }
                        return points.map(p => `${p.x},${p.y}`).join(' ');
                      })()}
                    />
                  )}

                  {/* Candlestick Pattern Overlay Markers */}
                  {(() => {
                    const detected = detectCandlestickPatterns(chartCandles);
                    return detected.map((pat) => {
                      const slotWidth = chartWidth / chartCandles.length;
                      const x = slotWidth * pat.index + slotWidth / 2;
                      const candle = chartCandles[pat.index];
                      // Position icon slightly above high or slightly below low depending on pattern type
                      const isBullish = pat.type === 'bullish';
                      const y = isBullish 
                        ? scaleY(candle.low) + 12 
                        : scaleY(candle.high) - 5;

                      return (
                        <g key={`pat-${pat.index}-${pat.name}`} className="cursor-help">
                          {pat.type !== 'neutral' && (
                            <circle
                              cx={x}
                              cy={y - 3}
                              r={5}
                              fill={isBullish ? '#00e676' : '#ff1744'}
                              opacity={0.15}
                              className="animate-ping"
                            />
                          )}
                          <text
                            x={x}
                            y={y}
                            textAnchor="middle"
                            fontSize={11}
                            className="select-none filter drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]"
                          >
                            {pat.icon}
                          </text>
                          <title>{`${pat.name} Pattern (${pat.type.toUpperCase()}): ${lang === 'Hindi' ? pat.hindiDescription : pat.description}`}</title>
                        </g>
                      );
                    });
                  })()}
                </svg>
              ) : (
                <div className="text-gray-500">Run Scan to load interactive chart overlays</div>
              )}
            </div>
          </div>

          {/* B. Tabbed Details panel (AI recommendations, PCR options, Risk sizer, settings) */}
          <div className="border border-[#1f2833] bg-[#0c0d12] rounded flex-1 flex flex-col overflow-hidden shadow-md">
            
            {/* Bloomberg Tab Headers */}
            <div className="flex border-b border-[#1f2833] bg-[#111218] overflow-x-auto whitespace-nowrap">
              <button
                onClick={() => { setActiveTab('ai'); playTerminalBeep(550, 0.05); }}
                className={`px-4 py-2 border-r border-[#1f2833] text-[10px] font-bold tracking-wider transition-all ${
                  activeTab === 'ai' ? 'text-[#00e676] bg-[#0c0d12] border-b-2 border-b-[#00e676]' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
                }`}
              >
                AI TRADE ENGINE
              </button>
              {market === 'NSE' && (
                <button
                  onClick={() => { setActiveTab('options'); playTerminalBeep(550, 0.05); }}
                  className={`px-4 py-2 border-r border-[#1f2833] text-[10px] font-bold tracking-wider transition-all ${
                    activeTab === 'options' ? 'text-[#00e676] bg-[#0c0d12] border-b-2 border-b-[#00e676]' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
                  }`}
                >
                  {t.pcrTitle}
                </button>
              )}
              <button
                onClick={() => { setActiveTab('risk'); playTerminalBeep(550, 0.05); }}
                className={`px-4 py-2 border-r border-[#1f2833] text-[10px] font-bold tracking-wider transition-all ${
                  activeTab === 'risk' ? 'text-[#00e676] bg-[#0c0d12] border-b-2 border-b-[#00e676]' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
                }`}
              >
                RISK & ALLOCATION
              </button>
              <button
                onClick={() => { setActiveTab('performance'); playTerminalBeep(550, 0.05); }}
                className={`px-4 py-2 border-r border-[#1f2833] text-[10px] font-bold tracking-wider transition-all ${
                  activeTab === 'performance' ? 'text-[#00e676] bg-[#0c0d12] border-b-2 border-b-[#00e676]' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
                }`}
              >
                {t.perfLog}
              </button>
              <button
                onClick={() => { setActiveTab('desktop'); playTerminalBeep(550, 0.05); }}
                className={`px-4 py-2 border-r border-[#1f2833] text-[10px] font-bold tracking-wider transition-all ${
                  activeTab === 'desktop' ? 'text-[#00e676] bg-[#0c0d12] border-b-2 border-b-[#00e676]' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
                }`}
              >
                EXPORT DESKTOP APP
              </button>
            </div>

            {/* Tab body content */}
            <div className="flex-1 p-3 overflow-y-auto">
              
              {/* TAB 1: AI Trade prediction neural sheet */}
              {activeTab === 'ai' && (
                <div className="space-y-3">
                  {aiLoading ? (
                    <div className="text-center py-8 text-gray-500 animate-pulse">Running Neural AI Model prediction layers...</div>
                  ) : aiSignal ? (
                    <div className="space-y-3">
                      {/* Fallback Warning Banner */}
                      {aiSignal.isFallback && (
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-200 flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                          <div className="flex-1 space-y-1">
                            <span className="font-bold block text-amber-300">High-Fidelity Local Quant Engine Active</span>
                            <p className="text-[9px] text-amber-200/85 leading-relaxed">
                              {aiSignal.errorMessage || "Gemini API daily free tier limit reached. Displaying local rule-based quant calculations."}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[#121319] border border-[#1f2833] rounded">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            aiSignal.action === 'BUY' ? 'bg-[#00e676]/10 text-[#00e676] border border-[#00e676]/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'
                          }`}>
                            {aiSignal.action} ALERT
                          </span>
                          <span className="font-bold text-gray-200">{aiSignal.instrumentName}</span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {t.winProb}: <strong className="text-[#00e676]">{aiSignal.winProbabilityEstimate}</strong>
                        </div>
                      </div>

                      {/* Trade levels grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                        <div className="bg-[#121319] p-1.5 rounded border border-[#1f2833]">
                          <span className="block text-[9px] text-gray-400">{t.entryText}</span>
                          <span className="font-bold text-gray-200">{aiSignal.entryPrice.toLocaleString()}</span>
                        </div>
                        <div className="bg-[#121319] p-1.5 rounded border border-[#1f2833]">
                          <span className="block text-[9px] text-red-400">{t.stopLoss}</span>
                          <span className="font-bold text-red-400">{aiSignal.stopLoss.toLocaleString()}</span>
                        </div>
                        <div className="bg-[#121319] p-1.5 rounded border border-[#1f2833]">
                          <span className="block text-[9px] text-gray-400">{t.target} 1</span>
                          <span className="font-bold text-gray-200">{aiSignal.target1.toLocaleString()}</span>
                        </div>
                        <div className="bg-[#121319] p-1.5 rounded border border-[#1f2833]">
                          <span className="block text-[9px] text-gray-400">{t.target} 2</span>
                          <span className="font-bold text-gray-200">{aiSignal.target2.toLocaleString()}</span>
                        </div>
                        <div className="bg-[#121319] p-1.5 rounded border border-[#1f2833]">
                          <span className="block text-[9px] text-gray-400">{t.target} 3</span>
                          <span className="font-bold text-gray-200">{aiSignal.target3.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Reasoning box */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 font-bold">{t.reasoning}:</span>
                        <p className="p-2 bg-[#14151a] border border-[#1f2833] rounded text-[10px] leading-relaxed text-gray-300">
                          {aiSignal.reasoningText}
                        </p>
                      </div>

                      {/* Integrated News Scanner */}
                      {scannedNews.length > 0 && (
                        <div className="border border-[#1f2833]/80 bg-[#0c0d12] rounded p-2.5 space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between border-b border-[#202124] pb-1">
                            <span className="text-gray-200 font-bold text-[9px] uppercase tracking-wider flex items-center space-x-1">
                              <span className="text-blue-400">📰</span>
                              <span>Latest Scanned Financial News ({lang === 'Hindi' ? 'ताज़ा समाचार विश्लेषण' : 'Sentiment Scan'})</span>
                            </span>
                            <span className="text-[8px] bg-[#2979ff]/10 text-[#2979ff] border border-[#2979ff]/30 px-1 rounded font-bold">
                              NEWS FEED
                            </span>
                          </div>
                          <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                            {scannedNews.map((newsItem, nIdx) => {
                              const isPos = newsItem.sentiment === 'positive';
                              const isNeg = newsItem.sentiment === 'negative';
                              const badgeColor = isPos 
                                ? 'text-[#00e676] bg-[#00e676]/10 border-[#00e676]/30' 
                                : isNeg 
                                  ? 'text-red-500 bg-red-500/10 border-red-500/30' 
                                  : 'text-gray-400 bg-gray-500/10 border-gray-500/30';
                              return (
                                <div key={nIdx} className="p-1.5 bg-[#121319]/80 border border-[#1f2833]/50 rounded text-[9.5px] hover:border-gray-700 transition-all flex items-start space-x-2">
                                  <span className={`px-1 rounded text-[7.5px] font-bold border shrink-0 mt-0.5 ${badgeColor}`}>
                                    {newsItem.sentiment.toUpperCase()}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-gray-300 font-sans leading-tight">{newsItem.title}</p>
                                    <span className="text-[8px] text-gray-500 font-mono block mt-0.5">{newsItem.time}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-2 pt-1">
                        <button
                          onClick={handleLogSimulatedTrade}
                          className="flex-1 py-1.5 bg-[#00e676]/10 text-[#00e676] hover:bg-[#00e676]/20 border border-[#00e676]/30 rounded text-[10px] font-bold tracking-wider transition-all"
                        >
                          {t.logSimulated}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-[#0c0d12]/60 border border-[#1f2833]/50 rounded p-4 text-[10px] text-gray-500 space-y-2">
                      <p>Run Market Scan to load neural trading signal outputs.</p>
                      <button
                        onClick={triggerGlobalScan}
                        className="px-3 py-1 bg-[#00e676]/10 hover:bg-[#00e676]/25 text-[#00e676] border border-[#00e676]/30 rounded text-[9px] font-bold uppercase tracking-wider"
                      >
                        🚀 Fast Scan Now
                      </button>
                    </div>
                  )}

                  {/* 🎯 Real-time Strategy & Timeframe Guide */}
                  {(() => {
                    const guideline = STRATEGY_GUIDELINES[tradingType];
                    if (!guideline) return null;
                    return (
                      <div className="border border-[#1f2833] bg-[#0c0d12] rounded p-3 space-y-2 shadow-sm">
                        <div className="flex items-center justify-between border-b border-[#202124] pb-1.5">
                          <span className="text-gray-200 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1.5">
                            <span className="text-[#00e676]">🎯</span>
                            <span>Strategy Guide ({lang === 'Hindi' ? 'रणनीति गाइड' : 'Timeframe Guide'})</span>
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2979ff]/10 text-[#2979ff] border border-[#2979ff]/30 font-bold">
                            {tradingType}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="bg-[#121319] p-2 rounded border border-[#1f2833]/80 space-y-0.5">
                            <span className="block text-gray-400 text-[8px] uppercase tracking-widest">{lang === 'Hindi' ? 'चार्ट समय सीमा (Timeframe)' : 'Recommended Timeframe'}</span>
                            <span className="font-bold text-[#00e676] text-[11px] flex items-center space-x-1">
                              <span>⏱️</span>
                              <span>{guideline.idealTimeframeDesc}</span>
                            </span>
                            <span className="block text-[8px] text-gray-500">Auto-tuned to {guideline.recommendedTimeframe}</span>
                          </div>

                          <div className="bg-[#121319] p-2 rounded border border-[#1f2833]/80 space-y-0.5">
                            <span className="block text-gray-400 text-[8px] uppercase tracking-widest">{lang === 'Hindi' ? 'टारगेट हिट होने का समय' : 'Estimated Target Hit'}</span>
                            <span className="font-bold text-[#ffb300] text-[11px] flex items-center space-x-1">
                              <span>🎯</span>
                              <span>{guideline.targetDuration}</span>
                            </span>
                            <span className="block text-[8px] text-gray-500">Average duration</span>
                          </div>
                        </div>

                        <div className="p-2 bg-[#14151a] rounded border border-[#202124] text-[9.5px] leading-relaxed">
                          <p className="text-gray-300">
                            <strong>{lang === 'Hindi' ? 'विवरण' : 'Rules'}:</strong> {guideline.explanation}
                          </p>
                          <p className="text-gray-400 mt-1 italic border-t border-[#202124]/40 pt-1">
                            <strong>{lang === 'Hindi' ? 'रणनीति नियम' : 'Hinglish Advice'}:</strong> {guideline.explanationHindi}
                          </p>
                          <p className="text-[8.5px] text-gray-500 mt-1 flex items-center justify-between">
                            <span>Risk Profile: <strong className="text-red-400 font-bold">{guideline.riskProfile}</strong></span>
                            <span>Optimal Chart: {guideline.recommendedTimeframe}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 🔬 Candlestick Pattern Detection Panel */}
                  <div className="border border-[#1f2833] bg-[#0c0d12] rounded p-3 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#202124] pb-1.5">
                      <span className="text-gray-200 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1.5">
                        <span className="text-[#00e676]">🔬</span>
                        <span>Candle Pattern Scanner ({lang === 'Hindi' ? 'कैंडलस्टिक विश्लेषण' : 'Reversal Patterns'})</span>
                      </span>
                      {chartCandles.length > 0 && (
                        <span className="text-[8.5px] text-[#00e676] bg-[#00e676]/10 border border-[#00e676]/30 px-1 py-0.2 rounded font-mono">
                          Live Scan OK
                        </span>
                      )}
                    </div>

                    {chartCandles.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-[9.5px]">
                        No chart candles loaded. Please select an asset and scan the market to initialize pattern sweeps.
                      </div>
                    ) : (
                      (() => {
                        const patterns = detectCandlestickPatterns(chartCandles);
                        if (patterns.length === 0) {
                          return (
                            <div className="p-3 bg-[#121319] text-center border border-[#1f2833]/60 rounded text-[9.5px] text-gray-400 space-y-1">
                              <p>⚖️ Sweeping candles... No strong reversal patterns found in the immediate window.</p>
                              <p className="text-[8px] text-gray-500">Tip: Change timeframe to find patterns on higher/lower candle ranges.</p>
                            </div>
                          );
                        }

                        // Display the most recent 4 patterns for clarity
                        const recentPatterns = patterns.slice(-4).reverse();

                        return (
                          <div className="space-y-2">
                            <div className="text-[9px] text-gray-400 flex justify-between">
                              <span>Detected Patterns: {patterns.length}</span>
                              <span className="text-gray-500 font-mono">Candle Sweep Range: 1 - {chartCandles.length}</span>
                            </div>
                            
                            <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                              {recentPatterns.map((pat, pidx) => {
                                const isBullish = pat.type === 'bullish';
                                const badgeStyle = isBullish 
                                  ? 'bg-[#00e676]/10 text-[#00e676] border-[#00e676]/30' 
                                  : pat.type === 'bearish' 
                                    ? 'bg-red-500/10 text-red-500 border-red-500/30' 
                                    : 'bg-gray-500/10 text-gray-400 border-gray-500/30';

                                return (
                                  <div key={pidx} className="p-2 bg-[#121319] border border-[#1f2833]/80 rounded text-[9.5px] space-y-1 hover:border-gray-700 transition-all">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-gray-200 flex items-center space-x-1">
                                        <span>{pat.icon}</span>
                                        <span>{pat.name}</span>
                                      </span>
                                      <span className={`px-1 rounded text-[8px] font-bold border uppercase ${badgeStyle}`}>
                                        {pat.type}
                                      </span>
                                    </div>
                                    <p className="text-gray-300 leading-relaxed text-[9px]">
                                      {lang === 'Hindi' ? pat.hindiDescription : pat.description}
                                    </p>
                                    <p className="text-[8px] text-gray-500 flex items-center justify-between pt-0.5 border-t border-[#1f2833]/40">
                                      <span>Candle index: #{pat.index}</span>
                                      <span className="text-[#2979ff] font-bold">Trade trigger: {isBullish ? 'Buy Reversal' : pat.type === 'bearish' ? 'Sell Reversal' : 'Wait Confirmation'}</span>
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Option Chain PCR analysis block (NSE Only) */}
              {activeTab === 'options' && market === 'NSE' && (
                <div className="space-y-3">
                  {optionChain ? (
                    <>
                      <div className="flex justify-between items-center bg-[#121319] p-2 rounded border border-[#1f2833] text-[10px]">
                        <span>{t.underlying}: <strong className="text-gray-200">{optionChain.underlyingPrice.toLocaleString()}</strong></span>
                        <span>PCR ratio: <strong className="text-[#00e676] font-bold">{optionChain.pcr}</strong></span>
                        <span>{t.maxPain}: <strong className="text-[#ffb300]">{optionChain.maxPain}</strong></span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px] divide-y divide-[#1b1c21]">
                          <thead>
                            <tr className="text-gray-400 bg-[#0f1016]">
                              <th className="p-1.5">{t.callOI}</th>
                              <th className="p-1.5 text-right">Call Price</th>
                              <th className="p-1.5 text-center">Strike</th>
                              <th className="p-1.5 text-left">Put Price</th>
                              <th className="p-1.5 text-right">{t.putOI}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#111]">
                            {optionChain.chains.slice(2, 9).map((chain) => (
                              <tr key={chain.strike} className="hover:bg-white/5">
                                <td className="p-1.5 text-gray-300">{chain.call.oi.toLocaleString()}</td>
                                <td className="p-1.5 text-right font-bold text-gray-400">{chain.call.price.toFixed(1)}</td>
                                <td className="p-1.5 text-center font-bold bg-black/30 text-[#ffb300]">{chain.strike}</td>
                                <td className="p-1.5 text-left font-bold text-gray-400">{chain.put.price.toFixed(1)}</td>
                                <td className="p-1.5 text-right text-gray-300">{chain.put.oi.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">Run scan with NSE sector focus active to load Option Chain layers.</div>
                  )}
                </div>
              )}

              {/* TAB 3: Capital Allocation Sizer */}
              {activeTab === 'risk' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 bg-[#121319] p-3 border border-[#1f2833] rounded">
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] text-gray-400">{t.equity} ($):</label>
                      <input
                        type="number"
                        value={accountEquity}
                        onChange={(e) => setAccountEquity(Number(e.target.value))}
                        className="bg-[#1a1b22] border border-[#2e2f38] text-gray-200 rounded p-1 focus:border-[#00e676] focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <label className="text-[10px] text-gray-400">{t.riskPct}:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={tradeRiskPct}
                        onChange={(e) => setTradeRiskPct(Number(e.target.value))}
                        className="bg-[#1a1b22] border border-[#2e2f38] text-gray-200 rounded p-1 focus:border-[#00e676] focus:outline-none"
                      />
                    </div>
                  </div>

                  {calculatedRiskAlloc && (
                    <div className="space-y-2 text-[10px]">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#121319] p-2 rounded border border-[#1f2833]">
                          <span className="block text-gray-400">{t.suggestedUnits}</span>
                          <strong className="text-[#00e676] text-xs font-mono">{calculatedRiskAlloc.units} units</strong>
                        </div>
                        <div className="bg-[#121319] p-2 rounded border border-[#1f2833]">
                          <span className="block text-gray-400">{t.leverageValue}</span>
                          <strong className="text-gray-200 text-xs">${calculatedRiskAlloc.totalCost}</strong>
                        </div>
                        <div className="bg-[#121319] p-2 rounded border border-[#1f2833]">
                          <span className="block text-gray-400">{t.riskCash}</span>
                          <strong className="text-red-400 text-xs">${calculatedRiskAlloc.riskCash}</strong>
                        </div>
                        <div className="bg-[#121319] p-2 rounded border border-[#1f2833]">
                          <span className="block text-gray-400">{t.suggestedProfit}</span>
                          <strong className="text-[#00e676] text-xs">
                            ${(calculatedRiskAlloc.units * (selectedAsset?.indicators.atr || 5)).toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      {calculatedRiskAlloc.warning && (
                        <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded">
                          {calculatedRiskAlloc.warning}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Trade ledger performance history logs */}
              {activeTab === 'performance' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 bg-[#121319] p-2 rounded border border-[#1f2833] text-center">
                    <div className="p-1">
                      <span className="block text-[9px] text-gray-400">Total Simulated</span>
                      <strong className="text-gray-200">{perfStats.total}</strong>
                    </div>
                    <div className="p-1 border-l border-[#1f2833]">
                      <span className="block text-[9px] text-gray-400">Wins / Losses</span>
                      <strong className="text-[#00e676]">{perfStats.wins}</strong> / <strong className="text-red-500">{perfStats.losses}</strong>
                    </div>
                    <div className="p-1 border-l border-[#1f2833]">
                      <span className="block text-[9px] text-gray-400">Win Accuracy</span>
                      <strong className="text-[#00e676]">{perfStats.accuracy}%</strong>
                    </div>
                  </div>

                  <div className="max-h-[140px] overflow-y-auto">
                    <table className="w-full text-left text-[10px]">
                      <thead>
                        <tr className="text-gray-400 border-b border-[#1b1c21]">
                          <th className="p-1">Date</th>
                          <th className="p-1">Asset</th>
                          <th className="p-1">Side</th>
                          <th className="p-1 text-right">PnL</th>
                          <th className="p-1 text-center">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#111]">
                        {perfHistory.map((trade) => (
                          <tr key={trade.id}>
                            <td className="p-1 text-gray-500">{trade.date}</td>
                            <td className="p-1 font-bold text-gray-300">{trade.symbol}</td>
                            <td className="p-1">{trade.action}</td>
                            <td className={`p-1 text-right font-bold ${trade.profit >= 0 ? 'text-[#00e676]' : 'text-red-500'}`}>
                              ${trade.profit.toLocaleString()}
                            </td>
                            <td className="p-1 text-center">
                              <span className={`px-1 rounded text-[9px] ${
                                trade.result === 'Win' ? 'text-[#00e676] bg-[#00e676]/10' : 'text-red-500 bg-red-500/10'
                              }`}>
                                {trade.result}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: Desktop app copy/export screen */}
              {activeTab === 'desktop' && (
                <div className="space-y-3 text-[10px]">
                  <p className="text-gray-300 leading-relaxed">
                    This terminal includes a modular, standalone, offline-ready Python application styled identically with **PySide6** and **Matplotlib** for local execution.
                  </p>
                  <div className="p-2.5 bg-[#121319] border border-[#1f2833] rounded space-y-1">
                    <strong className="text-[#00e676] block">📂 Packed Modular Structure:</strong>
                    <ul className="list-disc pl-4 space-y-0.5 text-gray-400 font-mono">
                      <li>desktop_requirements.txt (Dependencies config)</li>
                      <li>desktop_main.py (Central PySide6 event-driven loops)</li>
                      <li>desktop_indicators.py (Technical metrics parser)</li>
                      <li>desktop_scanner.py (ccxt crypto & yfinance NSE links)</li>
                      <li>desktop_risk_manager.py (Leverage parameters checker)</li>
                    </ul>
                  </div>

                  <button
                    onClick={downloadPythonFiles}
                    className="w-full py-2 bg-[#00e676] hover:bg-[#00c853] text-black rounded text-[10px] font-bold tracking-wider flex items-center justify-center space-x-2 transition-all shadow-[0_0_12px_rgba(0,230,118,0.15)]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>EXPORT STANDALONE PYTHON CODEBASE</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>

      </main>

      {/* 3. FOOTER SETTINGS & CONSOLE LOGGER BAR */}
      <footer className="border-t border-[#202124] bg-[#0c0c0e] px-4 py-2 flex flex-col md:flex-row items-center justify-between gap-3 text-[10px]">
        {/* Terminal Logging stream */}
        <div className="flex-1 flex items-center space-x-2 overflow-x-auto whitespace-nowrap text-gray-500">
          <span className="text-[#00e676] font-bold uppercase tracking-wider text-[9px] shrink-0">► SYSTEM CONSOLE:</span>
          <span className="font-mono text-gray-300 animate-pulse text-[9px]">{consoleLogs[0] || 'Idle...'}</span>
        </div>

        {/* Global Configuration and Localizations */}
        <div className="flex items-center space-x-4 shrink-0">
          <div className="flex items-center space-x-2">
            <Globe className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-400">{t.language}:</span>
            <select
              value={lang}
              onChange={(e) => { setLang(e.target.value as any); playTerminalBeep(520, 0.08); }}
              className="bg-[#121319] border border-[#2e2f38] text-gray-300 rounded px-1.5 py-0.5 focus:border-[#00e676] focus:outline-none"
            >
              <option value="English">English</option>
              <option value="Hindi">हिन्दी (Hindi)</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 border-l border-[#2e2f38] pl-4 text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00e676]" />
            <span>Terminal Core Online</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
