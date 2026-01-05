import { MatchingEngine } from './MatchingEngine';
import { Order, OrderSide, OrderType, Trade, MarketTicker, Position, MarketPhase } from '../types';
import { db } from './DatabaseService';
import { auth } from './AuthService';
import { initGateway, gateway } from './GatewayService';
import { riskEngine } from './RiskEngine';

// Core Matching Engine (In-Memory Singleton)
const engine = new MatchingEngine('XAU/USD', 2034.50);

// Initialize Gateway with the Engine
initGateway(engine);

// Replay State
let isReplaying = false;
let replayIndex = 0;
let historicalTrades: Trade[] = [];
let replaySpeedMultiplier = 1; // Default 1x

// --- HISTORICAL DATA GENERATION ---
export interface OHLCV {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

const generateHistoricalData = (hours: number): OHLCV[] => {
    const data: OHLCV[] = [];
    let price = 2030.00; // Start price 24h ago
    const now = Date.now();
    const minutes = hours * 60;
    
    for (let i = minutes; i > 0; i--) {
        const time = now - (i * 60 * 1000);
        const volatility = 0.8;
        const change = (Math.random() - 0.5) * volatility;
        
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * 0.2;
        const low = Math.min(open, close) - Math.random() * 0.2;
        const volume = Math.floor(Math.random() * 500) + 50;

        data.push({
            time,
            open,
            high,
            low,
            close,
            volume
        });
        price = close;
    }
    return data;
};

// Initial Seed History
const seedHistory = generateHistoricalData(24); // 24 Hours of history

// Market Maker Simulation (Internal Bot)
const MM_SPREAD = 0.50;
const MM_VOLATILITY = 0.8;
let currentFairPrice = engine.getLastPrice();

setInterval(() => {
  if (isReplaying || riskEngine.isMarketHalted() || engine.getMarketPhase() !== MarketPhase.CONTINUOUS_TRADING) return;

  const change = (Math.random() - 0.5) * MM_VOLATILITY;
  currentFairPrice += change;

  const sellOrder: Order = {
    id: 'MM-ASK-' + Date.now(),
    userId: 'market_maker_bot',
    symbol: 'XAU/USD',
    side: OrderSide.SELL,
    type: OrderType.LIMIT,
    price: parseFloat((currentFairPrice + (MM_SPREAD/2) + Math.random()*0.2).toFixed(2)),
    size: Math.floor(Math.random() * 5) + 1,
    remainingSize: Math.floor(Math.random() * 5) + 1,
    timestamp: Date.now(),
    status: 'OPEN'
  };

  const buyOrder: Order = {
    id: 'MM-BID-' + Date.now(),
    userId: 'market_maker_bot',
    symbol: 'XAU/USD',
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    price: parseFloat((currentFairPrice - (MM_SPREAD/2) - Math.random()*0.2).toFixed(2)),
    size: Math.floor(Math.random() * 5) + 1,
    remainingSize: Math.floor(Math.random() * 5) + 1,
    timestamp: Date.now(),
    status: 'OPEN'
  };

  try {
    engine.processOrder(sellOrder);
    engine.processOrder(buyOrder);
  } catch (e) {
      // MM Silent fail on halts
  }
}, 800); 

// ---- Public API (Consumed by React Frontend) ----

export const getInitialHistory = () => {
    return seedHistory;
};

export const subscribeToMarketData = (
  onTicker: (ticker: MarketTicker) => void,
  onBook: (book: { bids: any[], asks: any[] }) => void,
  onTrades: (trades: Trade[]) => void
) => {
  const interval = setInterval(() => {
    // If Replaying, we supply historical data slice instead of live engine data
    if (isReplaying) {
        if (replayIndex < historicalTrades.length) {
            const tradeSlice = historicalTrades.slice(0, replayIndex + 1);
            const currentTrade = historicalTrades[replayIndex];
            
            onTrades(tradeSlice.slice(-50).reverse()); // Show last 50 of replay
            onTicker({
                symbol: 'XAU/USD',
                price: currentTrade.price,
                change: 0,
                changePercent: 0,
                volume: tradeSlice.reduce((a, b) => a + b.size, 0),
                high: Math.max(...tradeSlice.map(t => t.price)),
                low: Math.min(...tradeSlice.map(t => t.price)),
                status: MarketPhase.CONTINUOUS_TRADING
            });
            // Order book replay is complex, we just clear it or show dummy for replay
            onBook({ bids: [], asks: [] });
            
            // Advance replay index based on speed multiplier
            replayIndex += replaySpeedMultiplier;
        }
    } else {
        // Live Feed
        const lastPrice = engine.getLastPrice();
        const book = engine.getOrderBook();
        const trades = engine.getRecentTrades();
        const phase = engine.getMarketPhase();

        onBook(book);
        onTrades(trades);
        
        // Calculate 24h change based on seed history start
        const startPrice = seedHistory[0].close;
        
        onTicker({
        symbol: 'XAU/USD',
        price: lastPrice,
        change: lastPrice - startPrice,
        changePercent: ((lastPrice - startPrice) / startPrice) * 100,
        volume: trades.reduce((acc, t) => acc + t.size, 0),
        high: Math.max(...trades.map(t => t.price), lastPrice),
        low: Math.min(...trades.map(t => t.price), lastPrice),
        status: phase
        });
    }
  }, 100); 
  return () => clearInterval(interval);
};

// Module 6: Market Data - Replay Feature
export const startMarketReplay = () => {
    historicalTrades = [...engine.getRecentTrades()].reverse(); // Get all trades ordered by time asc
    if(historicalTrades.length === 0) {
        historicalTrades = db.getAllTrades().slice(-200); // Fallback to DB
    }
    replayIndex = 0;
    isReplaying = true;
};

export const stopMarketReplay = () => {
    isReplaying = false;
};

export const setReplaySpeed = (speed: number) => {
    replaySpeedMultiplier = speed;
};

export const subscribeToOpenOrders = (
    onOrders: (orders: Order[]) => void
) => {
    const interval = setInterval(() => {
        const user = auth.getUser();
        if (user) {
            const allOrders = db.getOrdersByUser(user.id);
            const openOrders = allOrders.filter(o => o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED');
            onOrders(openOrders.reverse());
        }
    }, 500);
    return () => clearInterval(interval);
}

export interface OrderOptions {
  stopPrice?: number;
  icebergVisibleSize?: number;
  trailingDistance?: number;
  ocoGroupId?: string;
}

export const submitUserOrder = async (
    side: OrderSide, 
    type: OrderType, 
    quantity: number, 
    price?: number,
    options?: OrderOptions
): Promise<Trade[]> => {
    const user = auth.getUser();
    if (!user) throw new Error("Not Authenticated");
    if (!gateway) throw new Error("Gateway down");

    const order: Order = {
      id: 'USR-' + Date.now(),
      userId: user.id,
      symbol: 'XAU/USD',
      side,
      type,
      price: price || 0, 
      size: quantity,
      remainingSize: quantity,
      timestamp: Date.now(),
      status: 'OPEN',
      // Map advanced options
      icebergVisibleSize: options?.icebergVisibleSize,
      trailingDistance: options?.trailingDistance,
      ocoGroupId: options?.ocoGroupId,
      stopPrice: options?.stopPrice
    };

    return await gateway.routeOrderSubmission(order, user);
};

export const cancelUserOrder = async (orderId: string) => {
    const user = auth.getUser();
    if (!user) throw new Error("Not Authenticated");
    if (!gateway) throw new Error("Gateway down");

    await gateway.routeOrderCancellation(orderId, user);
}

export const getCurrentUserPosition = (): Position => {
    const user = auth.getUser();
    if (!user) return {
        userId: 'anon', symbol: 'XAU/USD', size: 0, averageEntryPrice: 0, 
        markPrice: 0, unrealizedPnl: 0, realizedPnl: 0, marginUsed: 0
    };
    
    const pos = db.getPosition(user.id, 'XAU/USD');
    const lastPrice = engine.getLastPrice();
    pos.markPrice = lastPrice;
    if (pos.size !== 0) {
        pos.unrealizedPnl = (lastPrice - pos.averageEntryPrice) * pos.size;
    }
    return pos;
};

export const commoditiesList = [
  { symbol: 'XAU/USD', name: 'Gold Spot', price: 2034.50 },
  { symbol: 'WTI/USD', name: 'Crude Oil', price: 78.40 },
  { symbol: 'NG/USD', name: 'Natural Gas', price: 2.15 },
  { symbol: 'C/USD', name: 'Corn', price: 432.00 },
  { symbol: 'KC/USD', name: 'Coffee C', price: 185.30 },
];
