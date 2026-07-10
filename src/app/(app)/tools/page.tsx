'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AltArrowLeft as ArrowLeft, Gamepad } from '@solar-icons/react';
import styles from './Tools.module.css';

// Type definitions
interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  type: 'normal' | 'lucky' | 'rare';
}

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function ToolsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'clicker' | 'scratch' | 'trading'>('clicker');
  
  // Game Balance (persisted in localStorage)
  const [balance, setBalance] = useState<number>(1000);

  // Load balance initially
  useEffect(() => {
    const savedBalance = localStorage.getItem('finy_game_balance');
    if (savedBalance) {
      setBalance(Number(savedBalance));
    } else {
      localStorage.setItem('finy_game_balance', '1000');
    }
  }, []);

  // Sync balance to localStorage
  const updateBalance = (newVal: number) => {
    const rounded = Math.round(newVal * 100) / 100;
    setBalance(rounded);
    localStorage.setItem('finy_game_balance', String(rounded));
  };

  // Synthesize game sound effects using Web Audio API
  const playSound = (type: 'coin' | 'scratch' | 'success' | 'trade') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'scratch') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } else if (type === 'trade') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(330, ctx.currentTime); // E4
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15); // A4
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  // ==========================================
  // 1. PIGGY CLICKER GAME LOGIC
  // ==========================================
  const [floatTexts, setFloatTexts] = useState<FloatingText[]>([]);
  const [piggyScale, setPiggyScale] = useState(1);

  const handlePiggyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Squishy animation scale trigger
    setPiggyScale(0.9);
    setTimeout(() => setPiggyScale(1), 80);

    // Get click coordinates relative to the clicker area
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Roll random chance prize
    const roll = Math.random() * 100;
    let earned = 0;
    let type: 'normal' | 'lucky' | 'rare' = 'normal';

    if (roll < 1) {
      // 1% Rare Jackpot: ₣1000 - ₣5000
      earned = Math.floor(Math.random() * 4001) + 1000;
      type = 'rare';
      playSound('success');
    } else if (roll < 10) {
      // 9% Lucky: ₣5 - ₣100
      earned = Math.floor(Math.random() * 96) + 5;
      type = 'lucky';
      playSound('coin');
    } else {
      // 90% Normal: ₣1 - ₣20
      earned = Math.floor(Math.random() * 20) + 1;
      type = 'normal';
      playSound('coin');
    }

    updateBalance(balance + earned);

    // Add floating text
    const textId = Date.now() + Math.random();
    const newText: FloatingText = {
      id: textId,
      text: `+₣${earned}`,
      x,
      y,
      type
    };

    setFloatTexts(prev => [...prev, newText]);

    // Cleanup text after 800ms
    setTimeout(() => {
      setFloatTexts(prev => prev.filter(t => t.id !== textId));
    }, 800);
  };

  // ==========================================
  // 2. SCRATCH CARD GAME LOGIC
  // ==========================================
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [scratchDone, setScratchDone] = useState(false);
  const [scratchReward, setScratchReward] = useState(0);
  const [scratchQuote, setScratchQuote] = useState('');

  const scratchQuotes = [
    '“Hemat pangkal kaya, rajin menabung tiada tara.”',
    '“Jangan membeli barang karena diskonnya, tapi karena butuh.”',
    '“Investasi terbaik adalah investasi leher ke atas (belajar).”',
    '“Sedikit demi sedikit, lama-lama dompet jadi bukit.”',
    '“Disiplin hari ini adalah kebebasan finansial hari esok.”',
    '“Uang mengalir pada mereka yang menghargai setiap koinnya.”'
  ];

  // Initialize/Reset scratch card canvas
  const initScratchCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset state
    setScratchDone(false);
    
    // Choose random reward (₣50 to ₣500)
    const reward = Math.floor(Math.random() * 451) + 50;
    setScratchReward(reward);
    setScratchQuote(scratchQuotes[Math.floor(Math.random() * scratchQuotes.length)]);

    // Clear and draw silver cover
    ctx.clearRect(0, 0, 280, 180);
    ctx.fillStyle = '#CBD5E1'; // Slate-300
    ctx.fillRect(0, 0, 280, 180);

    // Decorative texture/dots
    ctx.fillStyle = '#94A3B8';
    for (let i = 0; i < 280; i += 15) {
      for (let j = 0; j < 180; j += 15) {
        ctx.beginPath();
        ctx.arc(i + 5, j + 5, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Centered Instruction text
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GOSOK KARTU DISINI', 140, 95);
  };

  useEffect(() => {
    if (activeTab === 'scratch') {
      setTimeout(initScratchCard, 100);
    }
  }, [activeTab]);

  const drawScratch = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || scratchDone) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear circular path
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Play scratching sound periodically
    if (Math.random() < 0.15) {
      playSound('scratch');
    }

    // Check scratch percentage
    checkScratchProgress();
  };

  const checkScratchProgress = () => {
    const canvas = canvasRef.current;
    if (!canvas || scratchDone) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate transparency
    try {
      const imageData = ctx.getImageData(0, 0, 280, 180);
      const pixels = imageData.data;
      let transparentCount = 0;
      
      // Sample pixels to save processing power
      for (let i = 3; i < pixels.length; i += 16) {
        if (pixels[i] === 0) transparentCount++;
      }
      
      const totalSampled = pixels.length / 16;
      const percent = (transparentCount / totalSampled) * 100;

      // If more than 40% cleared, auto clear card and reward user
      if (percent > 40) {
        setScratchDone(true);
        ctx.clearRect(0, 0, 280, 180);
        updateBalance(balance + scratchReward);
        playSound('success');
      }
    } catch (e) {
      console.log(e);
    }
  };

  // Touch and mouse scratch event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsScratching(true);
    const rect = e.currentTarget.getBoundingClientRect();
    drawScratch(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isScratching) return;
    const rect = e.currentTarget.getBoundingClientRect();
    drawScratch(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseUp = () => setIsScratching(false);

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsScratching(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    drawScratch(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isScratching) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    drawScratch(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  // ==========================================
  // 3. TRADING SIMULATION LOGIC
  // ==========================================
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState(100);
  const [marketStatus, setMarketStatus] = useState<'NORMAL' | 'ARA' | 'ARB'>('NORMAL');

  // Trade position state
  const [positionAmount, setPositionAmount] = useState(0);
  const [averagePrice, setAveragePrice] = useState(0);

  // Populate initial 16 candles
  const initTradingSimulator = () => {
    const list: Candle[] = [];
    let price = 100;
    for (let i = 0; i < 16; i++) {
      const volatility = 4;
      const change = (Math.random() - 0.48) * volatility;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;
      
      list.push({ open, high, low, close });
      price = close;
    }
    setCandles(list);
    setCurrentPrice(Math.round(price * 100) / 100);
  };

  // Start real-time price feed loop
  useEffect(() => {
    if (activeTab !== 'trading') return;

    initTradingSimulator();

    // Check saved positions
    const savedPos = localStorage.getItem('finy_trading_pos');
    if (savedPos) {
      try {
        const parsed = JSON.parse(savedPos);
        setPositionAmount(parsed.amount || 0);
        setAveragePrice(parsed.avgPrice || 0);
      } catch (e) {}
    }

    const interval = setInterval(() => {
      setCandles(prev => {
        if (prev.length === 0) return prev;

        const lastCandle = prev[prev.length - 1];
        let open = lastCandle.close;
        let close = open;
        let high = open;
        let low = open;

        // Roll phase trends
        const roll = Math.random() * 100;
        let currentStatus: 'NORMAL' | 'ARA' | 'ARB' = 'NORMAL';
        let changePercent = 0;

        if (roll < 8) {
          // 8% Auto Rejection Atas (ARA) Limit Up: +22% to +35%
          changePercent = 22 + Math.random() * 13;
          currentStatus = 'ARA';
        } else if (roll < 16) {
          // 8% Auto Rejection Bawah (ARB) Limit Down: -15% to -30%
          changePercent = -(15 + Math.random() * 15);
          currentStatus = 'ARB';
        } else if (roll < 35) {
          // 19% Volatile Swing: -8% to +8%
          changePercent = (Math.random() - 0.5) * 16;
        } else {
          // 65% Sideways Swing: -2% to +2%
          changePercent = (Math.random() - 0.5) * 4;
        }

        const change = (open * changePercent) / 100;
        close = open + change;
        
        // Add wicks
        high = Math.max(open, close) + Math.random() * (open * 0.02);
        low = Math.min(open, close) - Math.random() * (open * 0.02);

        // Limit minimum price to 1
        if (close < 1) close = 1;
        if (low < 1) low = 1;

        const nextCandle = { open, high, low, close };
        const nextList = [...prev.slice(1), nextCandle];
        
        setCurrentPrice(Math.round(close * 100) / 100);
        setMarketStatus(currentStatus);

        return nextList;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [activeTab]);

  // Persist position to localStorage
  const updatePosition = (amount: number, avgPrice: number) => {
    setPositionAmount(amount);
    setAveragePrice(avgPrice);
    localStorage.setItem('finy_trading_pos', JSON.stringify({ amount, avgPrice }));
  };

  // Draw candlestick chart on canvas
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI display
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear chart
    ctx.clearRect(0, 0, width, height);

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 40; i < height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Determine min/max price range to scale properly
    const minVal = Math.min(...candles.map(c => Math.min(c.open, c.close, c.low)));
    const maxVal = Math.max(...candles.map(c => Math.max(c.open, c.close, c.high)));
    const range = (maxVal - minVal) || 10;
    
    // Padding
    const padTop = 20;
    const padBottom = 20;
    const plotHeight = height - padTop - padBottom;

    const getPriceY = (val: number) => {
      return padTop + plotHeight - ((val - minVal) / range) * plotHeight;
    };

    // Plot candles
    const candleWidth = Math.floor(width / candles.length) - 6;
    candles.forEach((c, idx) => {
      const x = idx * (width / candles.length) + 3;
      const openY = getPriceY(c.open);
      const closeY = getPriceY(c.close);
      const highY = getPriceY(c.high);
      const lowY = getPriceY(c.low);

      const isBullish = c.close >= c.open;
      const color = isBullish ? '#10B981' : '#EF4444'; // Emerald / Red

      // Draw wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, highY);
      ctx.lineTo(x + candleWidth / 2, lowY);
      ctx.stroke();

      // Draw candle body
      ctx.fillStyle = color;
      const bodyHeight = Math.abs(closeY - openY) || 1;
      const bodyY = Math.min(openY, closeY);

      // Rounded rectangle body
      ctx.beginPath();
      ctx.rect(x, bodyY, candleWidth, bodyHeight);
      ctx.fill();
    });

    // Draw average buy price line if position exists
    if (positionAmount > 0) {
      const avgY = getPriceY(averagePrice);
      if (avgY >= 0 && avgY <= height) {
        ctx.strokeStyle = '#3B82F6'; // Blue
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, avgY);
        ctx.lineTo(width, avgY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#3B82F6';
        ctx.font = '9px sans-serif';
        ctx.fillText(`BELI RATA-RATA: ₣${averagePrice}`, 6, avgY - 4);
      }
    }
  }, [candles, averagePrice, positionAmount]);

  // Trading Actions
  const handleBuy = () => {
    if (balance <= 0) return;
    playSound('trade');

    // Calculate new position
    const buyQty = balance / currentPrice;
    let newAvg = currentPrice;
    let newQty = buyQty;

    if (positionAmount > 0) {
      const totalCost = positionAmount * averagePrice + balance;
      newQty = positionAmount + buyQty;
      newAvg = totalCost / newQty;
    }

    updatePosition(newQty, newAvg);
    updateBalance(0);
  };

  const handleSell = () => {
    if (positionAmount <= 0) return;
    playSound('trade');

    // Sell entire position
    const payout = positionAmount * currentPrice;
    updateBalance(balance + payout);
    updatePosition(0, 0);
  };

  // Real-time PnL Calculations
  const currentVal = positionAmount * currentPrice;
  const originalCost = positionAmount * averagePrice;
  const unrealizedPnL = positionAmount > 0 ? (currentVal - originalCost) : 0;
  const pnlPercent = positionAmount > 0 && originalCost > 0 ? (unrealizedPnL / originalCost) * 100 : 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Finy Tools & Games</h2>
        <Gamepad size={20} />
      </header>

      {/* Shared Token Balance Display */}
      <div className={styles.balanceBar}>
        <span className={styles.balanceLabel}>SALDO TOKEN FINY</span>
        <span className={styles.balanceVal}>₣ {balance.toLocaleString('id-ID')}</span>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'clicker' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('clicker')}
        >
          🐷 Celengan Ketuk
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'scratch' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('scratch')}
        >
          🎫 Scratch Card
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'trading' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('trading')}
        >
          📈 Trading Sim
        </button>
      </div>

      {/* ======================================================= */}
      {/* 1. IDLE PIGGY CLICKER TAB */}
      {/* ======================================================= */}
      {activeTab === 'clicker' && (
        <div className={styles.gameContainer}>
          <div 
            className={styles.clickerArea} 
            onClick={handlePiggyClick}
            style={{ transform: `scale(${piggyScale})` }}
          >
            {/* Vector Piggy Bank Illustration */}
            <svg viewBox="0 0 160 160" className={styles.piggySvg}>
              {/* Ears */}
              <polygon points="50,45 35,20 60,35" fill="#EC4899" stroke="#DB2777" strokeWidth="3" />
              <polygon points="110,45 125,20 100,35" fill="#EC4899" stroke="#DB2777" strokeWidth="3" />

              {/* Legs */}
              <rect x="52" y="125" width="20" height="25" rx="5" fill="#DB2777" />
              <rect x="88" y="125" width="20" height="25" rx="5" fill="#DB2777" />

              {/* Body */}
              <ellipse cx="80" cy="88" rx="56" ry="46" fill="#F472B6" stroke="#DB2777" strokeWidth="4" />

              {/* Coin Slot */}
              <rect x="73" y="48" width="14" height="6" rx="2" fill="#475569" />

              {/* Eyes */}
              <circle cx="58" cy="80" r="5" fill="#1E293B" />
              <circle cx="102" cy="80" r="5" fill="#1E293B" />
              <circle cx="56" cy="78" r="1.5" fill="#FFFFFF" />
              <circle cx="100" cy="78" r="1.5" fill="#FFFFFF" />

              {/* Snout */}
              <ellipse cx="80" cy="98" rx="16" ry="12" fill="#F43F5E" stroke="#E11D48" strokeWidth="3" />
              <circle cx="74" cy="98" r="2.5" fill="#881337" />
              <circle cx="86" cy="98" r="2.5" fill="#881337" />

              {/* Cheek Blush */}
              <circle cx="44" cy="92" r="6" fill="#FB7185" opacity="0.6" />
              <circle cx="116" cy="92" r="6" fill="#FB7185" opacity="0.6" />
            </svg>

            {/* Rendering Floating Texts */}
            {floatTexts.map((item) => (
              <span 
                key={item.id} 
                className={`${styles.floatingText} ${
                  item.type === 'rare' ? styles.textRare : item.type === 'lucky' ? styles.textLucky : styles.textNormal
                }`}
                style={{ left: item.x, top: item.y }}
              >
                {item.text}
              </span>
            ))}
          </div>

          <p className={styles.instructions}>
            Ketuk celengan babi di atas untuk mengumpulkan koin! 
            <br />
            Normal: ₣1 - ₣20 | Lucky: ₣5 - ₣100 | Rare Jackpot: ₣1000 - ₣5000!
          </p>
        </div>
      )}

      {/* ======================================================= */}
      {/* 2. SCRATCH CARD TAB */}
      {/* ======================================================= */}
      {activeTab === 'scratch' && (
        <div className={styles.scratchContainer}>
          <div className={styles.scratchOuter}>
            <div className={styles.scratchUnderlay}>
              <span className={styles.scratchPrize}>+₣{scratchReward}</span>
              <p className={styles.scratchQuote}>{scratchQuote}</p>
            </div>
            
            <canvas 
              ref={canvasRef} 
              className={styles.scratchCanvas}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            />
          </div>

          <button 
            className={styles.scratchBtn} 
            onClick={initScratchCard}
            disabled={!scratchDone}
          >
            {scratchDone ? 'Gosok Kartu Baru' : 'Selesaikan Gosokan Ini'}
          </button>

          <p className={styles.instructions}>
            Gosok permukaan perak di atas kartu menggunakan kursor/jari Anda hingga bersih untuk mengklaim koin bonus harian!
          </p>
        </div>
      )}

      {/* ======================================================= */}
      {/* 3. TRADING SIMULATOR TAB */}
      {/* ======================================================= */}
      {activeTab === 'trading' && (
        <div className={styles.tradingGrid}>
          {/* Status Label Ticker */}
          <div 
            className={`${styles.marketStatus} ${
              marketStatus === 'ARA' ? styles.statusAra : marketStatus === 'ARB' ? styles.statusArb : styles.statusNormal
            }`}
          >
            <span>KONDISI PASAR</span>
            <span>
              {marketStatus === 'ARA' ? '🔥 ARA (Auto Rejection Atas)' : marketStatus === 'ARB' ? '❄️ ARB (Auto Rejection Bawah)' : '⚙️ SIDEWAYS / FLUKTUASI'}
            </span>
          </div>

          {/* Candle Canvas Chart */}
          <div className={styles.chartContainer}>
            <canvas ref={chartCanvasRef} className={styles.chartCanvas} />
          </div>

          {/* User Position & Trade Data */}
          <div className={styles.tradeDetails}>
            <div className={styles.tradeCard}>
              <span className={styles.tradeLabel}>HARGA ASSET SAAT INI</span>
              <span className={styles.tradeVal}>₣ {currentPrice.toLocaleString('id-ID')}</span>
            </div>
            <div className={styles.tradeCard}>
              <span className={styles.tradeLabel}>MILIK ANDA (POSISI)</span>
              <span className={styles.tradeVal}>{positionAmount.toFixed(4)} Token</span>
            </div>
            <div className={styles.tradeCard}>
              <span className={styles.tradeLabel}>BELI RATA-RATA</span>
              <span className={styles.tradeVal}>
                {positionAmount > 0 ? `₣ ${averagePrice.toLocaleString('id-ID')}` : '-'}
              </span>
            </div>
            <div className={styles.tradeCard}>
              <span className={styles.tradeLabel}>REAL-TIME P&L</span>
              <span 
                className={`${styles.tradeVal} ${
                  unrealizedPnL > 0 ? styles.pnlProfit : unrealizedPnL < 0 ? styles.pnlLoss : ''
                }`}
              >
                {positionAmount > 0 
                  ? `${unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)} (${pnlPercent.toFixed(2)}%)` 
                  : '₣ 0.00 (0%)'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.tradeActions}>
            <button 
              className={styles.buyBtn} 
              onClick={handleBuy} 
              disabled={balance <= 0}
            >
              BELI SEMUA (All-In)
            </button>
            <button 
              className={styles.sellBtn} 
              onClick={handleSell} 
              disabled={positionAmount <= 0}
            >
              JUAL SEMUA (Close)
            </button>
          </div>

          <p className={styles.instructions}>
            Gunakan Saldo Token Anda untuk berspekulasi. Beli posisi saat harga rendah (misal ARB) dan jual saat harga melonjak tinggi (misal ARA)!
          </p>
        </div>
      )}
    </div>
  );
}
