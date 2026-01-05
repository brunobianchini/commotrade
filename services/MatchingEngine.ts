import { Order, OrderSide, OrderType, Trade, OrderBookEntry, MarketPhase, FixingResult } from '../types';

export class MatchingEngine {
  private bids: Order[] = [];
  private asks: Order[] = [];
  private stopOrders: Order[] = []; // Parked Stop Orders
  private trades: Trade[] = [];
  private symbol: string;
  private currentPrice: number;
  private marketPhase: MarketPhase = MarketPhase.CONTINUOUS_TRADING;
  
  // Circuit Breaker Config
  private lastReferencePrice: number;
  private readonly VOLATILITY_THRESHOLD = 0.05; // 5% move triggers halt
  private lastCircuitBreakerTime: number = 0;

  constructor(symbol: string, initialPrice: number) {
    this.symbol = symbol;
    this.currentPrice = initialPrice;
    this.lastReferencePrice = initialPrice;
  }

  public getMarketPhase(): MarketPhase {
      return this.marketPhase;
  }

  public setMarketPhase(phase: MarketPhase) {
      const prevPhase = this.marketPhase;
      this.marketPhase = phase;
      
      // Transition TO Auction logic
      if ((phase === MarketPhase.OPEN_AUCTION || phase === MarketPhase.CLOSE_AUCTION) && prevPhase !== phase) {
          console.log(`[MatchingEngine] Entering ${phase}. Orders will queue.`);
      }
      
      // Transition FROM Auction TO Continuous -> Run Uncrossing
      if (prevPhase === MarketPhase.OPEN_AUCTION && phase === MarketPhase.CONTINUOUS_TRADING) {
          this.runAuctionMatch();
      }
      
      // Run Close Auction
      if (phase === MarketPhase.CLOSED && prevPhase === MarketPhase.CLOSE_AUCTION) {
          this.runAuctionMatch();
      }
  }

  private checkCircuitBreaker(newPrice: number) {
      if (this.marketPhase !== MarketPhase.CONTINUOUS_TRADING) return;

      const change = Math.abs((newPrice - this.lastReferencePrice) / this.lastReferencePrice);
      if (change > this.VOLATILITY_THRESHOLD) {
          this.marketPhase = MarketPhase.CIRCUIT_BREAKER_HALT;
          this.lastCircuitBreakerTime = Date.now();
          console.warn(`[MatchingEngine] CIRCUIT BREAKER TRIPPED on ${this.symbol}. Market Halted.`);
          
          // Auto-resume after 5 seconds for simulation
          setTimeout(() => {
              this.marketPhase = MarketPhase.CONTINUOUS_TRADING;
              this.lastReferencePrice = newPrice; // Reset reference
              console.warn(`[MatchingEngine] Market Resumed.`);
          }, 5000);
      }
  }

  public cancelOrder(orderId: string): Order | null {
      // Check Bids
      let idx = this.bids.findIndex(o => o.id === orderId);
      if (idx !== -1) {
          const [removed] = this.bids.splice(idx, 1);
          return removed;
      }
      
      // Check Asks
      idx = this.asks.findIndex(o => o.id === orderId);
      if (idx !== -1) {
          const [removed] = this.asks.splice(idx, 1);
          return removed;
      }

      // Check Stop Orders
      idx = this.stopOrders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
          const [removed] = this.stopOrders.splice(idx, 1);
          return removed;
      }

      return null;
  }

  public getOrderBook(): { bids: OrderBookEntry[], asks: OrderBookEntry[] } {
    const groupOrders = (orders: Order[]) => {
      const map = new Map<number, number>();
      orders.forEach(o => {
        const p = parseFloat(o.price.toFixed(2));
        map.set(p, (map.get(p) || 0) + o.remainingSize);
      });
      return map;
    };

    const bidMap = groupOrders(this.bids);
    const askMap = groupOrders(this.asks);

    const bids: OrderBookEntry[] = Array.from(bidMap.entries())
      .map(([price, size]) => ({ price, size, total: 0, orderCount: 0 }))
      .sort((a, b) => b.price - a.price);

    const asks: OrderBookEntry[] = Array.from(askMap.entries())
      .map(([price, size]) => ({ price, size, total: 0, orderCount: 0 }))
      .sort((a, b) => a.price - b.price);

    let bidTotal = 0;
    bids.forEach(b => { bidTotal += b.size; b.total = bidTotal; });

    let askTotal = 0;
    asks.forEach(a => { askTotal += a.size; a.total = askTotal; });

    return { bids, asks };
  }

  public processOrder(order: Order): Trade[] {
    // If Halted, reject or queue (Simulation: Reject)
    if (this.marketPhase === MarketPhase.CIRCUIT_BREAKER_HALT || this.marketPhase === MarketPhase.CLOSED) {
        throw new Error(`Market is currently ${this.marketPhase}`);
    }

    // In Auction phase, we just accept orders into book, no matching yet
    if (this.marketPhase === MarketPhase.OPEN_AUCTION || this.marketPhase === MarketPhase.CLOSE_AUCTION || this.marketPhase === MarketPhase.FIXING) {
        this.addToBook(order);
        return [];
    }

    // Stop Orders are Parked, not Matched immediately
    if (order.type === OrderType.STOP) {
        this.stopOrders.push(order);
        console.log(`[MatchingEngine] Stop Order Parked: ${order.id} @ ${order.price}`);
        return [];
    }

    const executedTrades: Trade[] = [];

    if (order.type === OrderType.MARKET) {
      this.matchMarketOrder(order, executedTrades);
    } else {
      this.matchLimitOrder(order, executedTrades);
    }

    if (executedTrades.length > 0) {
      const lastTradePrice = executedTrades[executedTrades.length - 1].price;
      this.currentPrice = lastTradePrice;
      this.trades.push(...executedTrades);
      
      // Check Circuit Breaker
      this.checkCircuitBreaker(lastTradePrice);

      // Trigger Stop Orders based on new price
      const triggeredStops = this.checkStopOrders(lastTradePrice);
      if (triggeredStops.length > 0) {
          executedTrades.push(...triggeredStops);
      }
    }

    return executedTrades;
  }

  private checkStopOrders(currentPrice: number): Trade[] {
      const triggeredTrades: Trade[] = [];
      const remainingStops: Order[] = [];

      for (const order of this.stopOrders) {
          let triggered = false;
          // Buy Stop: Trigger if Price >= Stop Price (Momentum)
          if (order.side === OrderSide.BUY && currentPrice >= order.price) {
              triggered = true;
          }
          // Sell Stop: Trigger if Price <= Stop Price (Stop Loss)
          else if (order.side === OrderSide.SELL && currentPrice <= order.price) {
              triggered = true;
          }

          if (triggered) {
              console.log(`[MatchingEngine] Stop Order Triggered: ${order.id}`);
              // Convert to Market Order and execute immediately
              const marketOrder = { ...order, type: OrderType.MARKET };
              this.matchMarketOrder(marketOrder, triggeredTrades);
              if (marketOrder.remainingSize > 0) {
                  // Partial fill or no fill on stop trigger? (Simplified: Kill remainder or leave as market)
                  // In this sim, we assume deep liquidity, but strictly should go to book if Limit Stop
              }
          } else {
              remainingStops.push(order);
          }
      }
      this.stopOrders = remainingStops;
      
      if (triggeredTrades.length > 0) {
          this.trades.push(...triggeredTrades);
      }
      return triggeredTrades;
  }

  private matchMarketOrder(order: Order, trades: Trade[]) {
    const book = order.side === OrderSide.BUY ? this.asks : this.bids;
    
    if (order.side === OrderSide.BUY) {
      this.asks.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
    } else {
      this.bids.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
    }

    while (order.remainingSize > 0 && book.length > 0) {
      const bestMatch = book[0];
      const tradeSize = Math.min(order.remainingSize, bestMatch.remainingSize);
      const tradePrice = bestMatch.price;

      trades.push(this.createTrade(order, tradePrice, tradeSize));

      order.remainingSize -= tradeSize;
      bestMatch.remainingSize -= tradeSize;

      if (bestMatch.remainingSize <= 0) {
        book.shift();
      }
    }
  }

  private matchLimitOrder(order: Order, trades: Trade[]) {
    const book = order.side === OrderSide.BUY ? this.asks : this.bids;
    
    let matchFound = true;
    while (matchFound && order.remainingSize > 0 && book.length > 0) {
      const bestMatch = book[0];
      
      const isMatch = order.side === OrderSide.BUY 
        ? order.price >= bestMatch.price 
        : order.price <= bestMatch.price;

      if (!isMatch) {
        matchFound = false;
        break;
      }

      const tradeSize = Math.min(order.remainingSize, bestMatch.remainingSize);
      
      trades.push(this.createTrade(order, bestMatch.price, tradeSize));

      order.remainingSize -= tradeSize;
      bestMatch.remainingSize -= tradeSize;

      if (bestMatch.remainingSize <= 0) {
        book.shift();
      }
    }

    if (order.remainingSize > 0) {
        this.addToBook(order);
    }
  }

  private addToBook(order: Order) {
      if (order.side === OrderSide.BUY) {
        this.bids.push(order);
        this.bids.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
      } else {
        this.asks.push(order);
        this.asks.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
      }
  }

  private createTrade(order: Order, price: number, size: number): Trade {
      return {
        id: Math.random().toString(36).substring(7).toUpperCase(),
        symbol: this.symbol,
        price: price,
        size: size,
        side: order.side,
        timestamp: Date.now()
      };
  }

  // IOSCO Compliant Auction Matching Algorithm (Equilibrium Price / Maximize Volume)
  private runAuctionMatch() {
      console.log("[MatchingEngine] Running Equilibrium Auction Match...");
      
      if (this.bids.length === 0 || this.asks.length === 0) return;

      const prices = new Set<number>();
      this.bids.forEach(o => prices.add(o.price));
      this.asks.forEach(o => prices.add(o.price));
      const sortedPrices = Array.from(prices).sort((a, b) => a - b);

      let maxVolume = 0;
      let equilibriumPrice = 0;
      let imbalance = Number.MAX_SAFE_INTEGER;

      for (const p of sortedPrices) {
          const buyVolume = this.bids.reduce((sum, b) => (b.price >= p ? sum + b.remainingSize : sum), 0);
          const sellVolume = this.asks.reduce((sum, a) => (a.price <= p ? sum + a.remainingSize : sum), 0);
          
          const executableVolume = Math.min(buyVolume, sellVolume);
          const currentImbalance = Math.abs(buyVolume - sellVolume);

          if (executableVolume > maxVolume) {
              maxVolume = executableVolume;
              equilibriumPrice = p;
              imbalance = currentImbalance;
          } else if (executableVolume === maxVolume && currentImbalance < imbalance) {
              equilibriumPrice = p;
              imbalance = currentImbalance;
          }
      }

      if (maxVolume === 0) return;

      console.log(`[Auction] Equilibrium Price Found: ${equilibriumPrice} (Vol: ${maxVolume})`);

      this.bids.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
      this.asks.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);

      const auctionTrades: Trade[] = [];

      let bidIdx = 0;
      let askIdx = 0;

      while (bidIdx < this.bids.length && askIdx < this.asks.length) {
          const bid = this.bids[bidIdx];
          const ask = this.asks[askIdx];

          if (bid.price < equilibriumPrice || ask.price > equilibriumPrice) break;

          const tradeSize = Math.min(bid.remainingSize, ask.remainingSize);
          
          auctionTrades.push({
            id: 'AUC-' + Math.random().toString(36).substring(7).toUpperCase(),
            symbol: this.symbol,
            price: equilibriumPrice,
            size: tradeSize,
            side: OrderSide.BUY, 
            timestamp: Date.now(),
            makerOrderId: ask.id,
            takerOrderId: bid.id
          });

          bid.remainingSize -= tradeSize;
          ask.remainingSize -= tradeSize;

          if (bid.remainingSize <= 0) {
              this.bids.splice(bidIdx, 1); 
          } else {
              bidIdx++;
          }

          if (ask.remainingSize <= 0) {
              this.asks.splice(askIdx, 1);
          } else {
              askIdx++;
          }
      }
      
      if (auctionTrades.length > 0) {
          this.trades.push(...auctionTrades);
          this.currentPrice = equilibriumPrice;
      }
  }

  // IOSCO Requirement: Daily Fixing (Reference Price)
  public runFixing(): FixingResult {
      console.log("[MatchingEngine] Running Daily Fixing...");
      
      // Calculate Volume Weighted Average Price (VWAP) of the last 100 trades or last 10 minutes
      const recentTrades = this.trades.slice(-50); // Simulating time window
      let totalVol = 0;
      let totalNotional = 0;
      
      recentTrades.forEach(t => {
          totalVol += t.size;
          totalNotional += (t.price * t.size);
      });
      
      const fixingPrice = totalVol > 0 ? (totalNotional / totalVol) : this.currentPrice;
      
      this.currentPrice = fixingPrice; // Update reference
      this.lastReferencePrice = fixingPrice; // Reset circuit breakers
      
      return {
          symbol: this.symbol,
          fixingPrice: parseFloat(fixingPrice.toFixed(2)),
          volumeProcessed: totalVol,
          timestamp: Date.now(),
          algorithm: 'VWAP'
      };
  }

  public getRecentTrades(): Trade[] {
    return [...this.trades].reverse().slice(0, 50);
  }

  public getLastPrice(): number {
    return this.currentPrice;
  }
}