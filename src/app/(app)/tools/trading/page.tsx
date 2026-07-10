'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AltArrowLeft as ArrowLeft } from '@solar-icons/react';
import styles from './Trading.module.css';

interface Candle {
  close: number;
}

export default function TradingPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(1000);

  // Price Tick Feed
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState(100);
  const [priceChangePct, setPriceChangePct] = useState(0);
  const [priceChangeVal, setPriceChangeVal] = useState(0);
  const [marketStatus, setMarketStatus] = useState<'NORMAL' | 'ARA' | 'ARB'>('NORMAL');

  // Input state
  const [amountInput, setAmountInput] = useState<string>('');

  // Position details (persisted in localStorage)
  const [positionAmount, setPositionAmount] = useState(0);
  const [averagePrice, setAveragePrice] = useState(0);

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load balance & positions initially
  useEffect(() => {
    const savedBalance = localStorage.getItem('finy_game_balance');
    if (savedBalance) {
      setBalance(Number(savedBalance));
    }
    
    const savedPos = localStorage.getItem('finy_trading_pos');
    if (savedPos) {
      try {
        const parsed = JSON.parse(savedPos);
        setPositionAmount(parsed.amount || 0);
        setAveragePrice(parsed.avgPrice || 0);
      } catch (e) {}
    }
  }, []);

  // Update game balance helper
  const updateBalance = (newVal: number) => {
    const rounded = Math.round(newVal * 100) / 100;
    setBalance(rounded);
    localStorage.setItem('finy_game_balance', String(rounded));
  };

  // Update position helper
  const updatePosition = (amount: number, avgPrice: number) => {
    const roundedAmt = Math.round(amount * 10000) / 10000;
    const roundedPrice = Math.round(avgPrice * 100) / 100;
    setPositionAmount(roundedAmt);
    setAveragePrice(roundedAmt > 0 ? roundedPrice : 0);
    localStorage.setItem(
      'finy_trading_pos', 
      JSON.stringify({ amount: roundedAmt, avgPrice: roundedAmt > 0 ? roundedPrice : 0 })
    );
  };

  // Synthesize trading audio
  const playSound = (type: 'buy' | 'sell' | 'win') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'buy') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'sell') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(550, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {}
  };

  // Seeded deterministic pseudo-random generator
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    const r = x - Math.floor(x);
    return r < 0 ? r + 1 : r;
  };

  // Calculate price history anchored deterministically on UTC midnight
  const calculatePriceHistory = () => {
    const currentTick = Math.floor(Date.now() / 2000);
    const startOfDayTick = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 2000);
    const anchorTick = startOfDayTick - 20;

    const history: Candle[] = [];
    const dayIndex = Math.floor(startOfDayTick / 43200);
    
    // Base day price (seeded deterministically per day)
    let price = 50 + seededRandom(dayIndex) * 150; 

    let prevPrice = price;
    let lastDiff = 0;
    let lastPct = 0;
    let lastStatus: 'NORMAL' | 'ARA' | 'ARB' = 'NORMAL';

    for (let i = anchorTick; i <= currentTick; i++) {
      const rand = seededRandom(i);
      let changePercent = 0;
      let status: 'NORMAL' | 'ARA' | 'ARB' = 'NORMAL';

      if (rand < 0.08) {
        // ARA Limit Up: +20% to +35%
        changePercent = 20 + seededRandom(i + 0.1) * 15;
        status = 'ARA';
      } else if (rand < 0.16) {
        // ARB Limit Down: -15% to -30%
        changePercent = -(15 + seededRandom(i + 0.2) * 15);
        status = 'ARB';
      } else if (rand < 0.35) {
        // Volatile: -7% to +7%
        changePercent = (seededRandom(i + 0.3) - 0.5) * 14;
      } else {
        // Sideways: -2% to +2%
        changePercent = (seededRandom(i + 0.4) - 0.5) * 4;
      }

      const diff = (price * changePercent) / 100;
      prevPrice = price;
      price = price + diff;
      if (price < 1) price = 1;

      if (i === currentTick) {
        lastDiff = price - prevPrice;
        lastPct = changePercent;
        lastStatus = status;
      }

      if (i >= currentTick - 19) {
        history.push({ close: Math.round(price * 100) / 100 });
      }
    }

    return {
      history,
      currentPrice: Math.round(price * 100) / 100,
      priceChangeVal: Math.round(lastDiff * 100) / 100,
      priceChangePct: Math.round(lastPct * 100) / 100,
      marketStatus: lastStatus
    };
  };

  // Real-time ticking feed loop
  useEffect(() => {
    const updateChart = () => {
      const data = calculatePriceHistory();
      setCandles(data.history);
      setCurrentPrice(data.currentPrice);
      setPriceChangeVal(data.priceChangeVal);
      setPriceChangePct(data.priceChangePct);
      setMarketStatus(data.marketStatus);
    };

    updateChart();

    // Check every 1s to capture boundary changes instantly
    const interval = setInterval(updateChart, 1000);
    return () => clearInterval(interval);
  }, []);

  // Draw simple line chart
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI retina screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    // Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 30; i < height; i += 30) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Min and Max prices for layout scaling
    const prices = candles.map(c => c.close);
    const minVal = Math.min(...prices);
    const maxVal = Math.max(...prices);
    const range = (maxVal - minVal) || 10;

    const padTop = 15;
    const padBottom = 15;
    const plotHeight = height - padTop - padBottom;

    const getPriceY = (val: number) => {
      return padTop + plotHeight - ((val - minVal) / range) * plotHeight;
    };

    // Calculate step width
    const stepX = width / (candles.length - 1);

    // 1. Draw glowing gradient fill under the line chart
    const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
    const isBullish = candles[candles.length - 1].close >= candles[0].close;
    const lineColor = isBullish ? '#10B981' : '#EF4444';

    fillGrad.addColorStop(0, isBullish ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)');
    fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');

    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.moveTo(0, height);
    candles.forEach((c, idx) => {
      const x = idx * stepX;
      const y = getPriceY(c.close);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // 2. Draw line path
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 4;
    
    ctx.beginPath();
    candles.forEach((c, idx) => {
      const x = idx * stepX;
      const y = getPriceY(c.close);
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow

    // 3. Draw pulsating endpoint dot
    const endX = width;
    const endY = getPriceY(candles[candles.length - 1].close);
    
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(endX - 3, endY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(endX - 3, endY, 3, 0, Math.PI * 2);
    ctx.stroke();

  }, [candles]);

  // Handle transaction orders
  const handleBuyOrder = () => {
    const buyValue = Number(amountInput);
    if (isNaN(buyValue) || buyValue <= 0 || buyValue > balance) return;

    playSound('buy');
    const buyQty = buyValue / currentPrice;
    
    let newQty = buyQty;
    let newAvg = currentPrice;

    if (positionAmount > 0) {
      const totalCost = positionAmount * averagePrice + buyValue;
      newQty = positionAmount + buyQty;
      newAvg = totalCost / newQty;
    }

    updatePosition(newQty, newAvg);
    updateBalance(balance - buyValue);
    setAmountInput('');
  };

  const handleSellOrder = () => {
    if (positionAmount <= 0) return;

    playSound('sell');
    const cashGained = positionAmount * currentPrice;

    // Check if profit realized
    if (currentPrice > averagePrice) {
      playSound('win');
    }

    updatePosition(0, 0);
    updateBalance(balance + cashGained);
    setAmountInput('');
  };

  // Helper quick percent pill fill
  const handlePercentPill = (pct: number) => {
    if (pct === 100) {
      // Set to max available
      setAmountInput(String(balance));
    } else {
      setAmountInput(String(Math.round((balance * pct / 100) * 100) / 100));
    }
  };

  // Real-time calculations
  const isProfit = currentPrice >= averagePrice;
  const originalCost = positionAmount * averagePrice;
  const currentVal = positionAmount * currentPrice;
  const unrealizedPnL = positionAmount > 0 ? (currentVal - originalCost) : 0;
  const pnlPercent = positionAmount > 0 && originalCost > 0 ? (unrealizedPnL / originalCost) * 100 : 0;

  // Disable button validators
  const inputNum = Number(amountInput);
  const isBuyDisabled = isNaN(inputNum) || inputNum <= 0 || inputNum > balance;
  const isSellDisabled = positionAmount <= 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="back">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>Simulasi Trading</h2>
        <div style={{ width: 20 }} />
      </header>

      {/* 1. Saldo (Balance) at the very top */}
      <div className={styles.balanceSection}>
        <span className={styles.balanceLabel}>SALDO FINY TOKEN</span>
        <h1 className={styles.balanceVal}>₣ {balance.toLocaleString('id-ID')}</h1>
      </div>

      {/* 2. Chart Card (Chart & Current Price) */}
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div className={styles.assetInfo}>
            <div className={styles.assetBadge}>₣</div>
            <span className={styles.assetName}>Finy Token (FT)</span>
          </div>

          <div className={styles.priceWrapper}>
            <span className={styles.currentPrice}>₣ {currentPrice.toLocaleString('id-ID')}</span>
            <span className={`${styles.priceChange} ${priceChangeVal >= 0 ? styles.changeBullish : styles.changeBearish}`}>
              {priceChangeVal >= 0 ? '▲' : '▼'} {Math.abs(priceChangeVal).toFixed(2)} ({priceChangePct >= 0 ? '+' : ''}{priceChangePct}%)
            </span>
          </div>
        </div>

        <div className={styles.chartWrapper}>
          <canvas ref={chartCanvasRef} className={styles.chartCanvas} />
        </div>

        <div className={styles.marketTicker}>
          {marketStatus === 'ARA' ? '🚨 ARA! Harga melejit naik luar biasa' : marketStatus === 'ARB' ? '❄️ ARB! Harga terkunci jatuh terendah' : '⚡ Pergerakan pasar wajar & fluktuatif'}
        </div>
      </div>

      {/* 3. Control Row (Input & Realtime P&L) */}
      <div className={styles.controlRow}>
        {/* Left: Input amount */}
        <div className={styles.inputCard}>
          <span className={styles.controlLabel}>JUMLAH BELI (₣)</span>
          <div className={styles.inputFieldWrapper}>
            <span className={styles.currencySymbol}>₣</span>
            <input 
              type="number"
              step="any"
              placeholder="0.00"
              className={styles.amountInput}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
            />
          </div>
          <div className={styles.percentPills}>
            <button className={styles.percentPill} onClick={() => handlePercentPill(25)}>25%</button>
            <button className={styles.percentPill} onClick={() => handlePercentPill(50)}>50%</button>
            <button className={styles.percentPill} onClick={() => handlePercentPill(100)}>MAX</button>
          </div>
        </div>

        {/* Right: Realtime P&L & Position */}
        <div className={styles.pnlCard}>
          <span className={styles.controlLabel}>POSISI & P&L</span>
          <div className={styles.pnlWrapper}>
            <span className={`${styles.pnlVal} ${positionAmount > 0 && unrealizedPnL >= 0 ? styles.profitText : positionAmount > 0 ? styles.lossText : ''}`}>
              {positionAmount > 0 
                ? `${unrealizedPnL >= 0 ? '+' : ''}₣${unrealizedPnL.toFixed(2)}` 
                : '₣ 0.00'}
            </span>
            <span className={`${styles.pnlSub} ${positionAmount > 0 && unrealizedPnL >= 0 ? styles.profitText : positionAmount > 0 ? styles.lossText : ''}`}>
              {positionAmount > 0 
                ? `(${unrealizedPnL >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)` 
                : '0.00%'}
            </span>
          </div>
          <span className={styles.controlLabel} style={{ fontSize: '9px', marginTop: '2px' }}>
            Posisi: {positionAmount.toFixed(2)} FT (Avg: ₣{averagePrice.toFixed(2)})
          </span>
        </div>
      </div>

      {/* 4. Action Row (Sell on Left, Buy on Right) */}
      <div className={styles.actionRow}>
        <button 
          className={styles.sellBtn} 
          onClick={handleSellOrder}
          disabled={isSellDisabled}
        >
          JUAL SEMUA (Sell All)
        </button>
        <button 
          className={styles.buyBtn} 
          onClick={handleBuyOrder}
          disabled={isBuyDisabled}
        >
          BELI (Buy)
        </button>
      </div>
    </div>
  );
}
