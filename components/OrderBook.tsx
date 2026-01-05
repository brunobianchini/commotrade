
import React from 'react';
import { OrderBookEntry } from '../types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface OrderBookProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  currentPrice: number;
}

const OrderBook: React.FC<OrderBookProps> = ({ bids, asks, currentPrice }) => {
  // Determine the max cumulative volume visible to normalize the depth bars
  // We take the max of total volume in the visible range (e.g. 15 rows)
  const VISIBLE_ROWS = 15;
  
  const maxBidTotal = bids.length > 0 ? bids[Math.min(bids.length, VISIBLE_ROWS) - 1]?.total || 0 : 0;
  const maxAskTotal = asks.length > 0 ? asks[Math.min(asks.length, VISIBLE_ROWS) - 1]?.total || 0 : 0;
  const maxTotal = Math.max(maxBidTotal, maxAskTotal, 1);

  // Best prices
  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const spread = (bestAsk && bestBid) ? bestAsk - bestBid : 0;
  const spreadPercent = bestAsk ? (spread / bestAsk) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden font-mono text-xs shadow-xl ring-1 ring-slate-800">
      
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex justify-between items-center z-10">
        <span className="font-semibold text-slate-300 flex items-center gap-2">
            Order Book
        </span>
        <div className="flex items-center gap-2 text-[10px]">
           <span className="flex items-center gap-1 text-slate-500">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Live
           </span>
        </div>
      </div>
      
      {/* Column Headers */}
      <div className="grid grid-cols-3 px-2 py-1.5 text-slate-500 border-b border-slate-800/50 text-[10px] uppercase font-bold tracking-wider bg-slate-950/50">
        <div className="text-left">Size</div>
        <div className="text-center">Price (USD)</div>
        <div className="text-right">Total</div>
      </div>

      {/* ASKS (Sell Orders) - Top Half - Reversed so Best Ask is at bottom */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        {[...asks].slice(0, VISIBLE_ROWS).reverse().map((ask, i, arr) => {
            // Logic: The last item in this reversed array is the Best Ask (asks[0])
            const isBestAsk = i === arr.length - 1;
            const depthPercent = (ask.total / maxTotal) * 100;
            
            return (
                <div 
                    key={`ask-${ask.price}`} 
                    className={`grid grid-cols-3 px-2 py-0.5 relative group cursor-pointer hover:bg-slate-800/40 transition-colors ${isBestAsk ? 'bg-rose-950/20' : ''}`}
                >
                    {/* Depth Bar (Right Aligned) */}
                    <div 
                        className="absolute top-0 right-0 bottom-0 bg-rose-500/10 transition-all duration-300 ease-out" 
                        style={{ width: `${depthPercent}%` }} 
                    />
                    
                    {/* Content */}
                    <div className={`relative z-10 text-left ${isBestAsk ? 'text-rose-200 font-medium' : 'text-slate-400'}`}>
                        {ask.size.toLocaleString()}
                    </div>
                    <div className={`relative z-10 text-center ${isBestAsk ? 'text-rose-400 font-bold text-sm scale-110 origin-center' : 'text-rose-500'}`}>
                        {ask.price.toFixed(2)}
                    </div>
                    <div className="relative z-10 text-right text-slate-500">
                        {ask.total.toLocaleString()}
                    </div>
                </div>
            );
        })}
      </div>

      {/* SPREAD INDICATOR */}
      <div className="py-1.5 bg-slate-900 border-y border-slate-800 flex justify-between items-center px-4 shadow-inner relative overflow-hidden">
          <div className="absolute inset-0 bg-slate-800/30"></div>
          
          <div className="relative z-10 flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Spread</span>
              <span className="text-xs text-slate-300 font-mono flex items-center gap-1">
                  {spread.toFixed(2)} 
                  <span className="text-[10px] text-slate-500">({spreadPercent.toFixed(3)}%)</span>
              </span>
          </div>

          <div className="relative z-10 flex flex-col items-end">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Last Traded</span>
               <div className="flex items-center gap-2">
                   {currentPrice > bestBid ? <TrendingUp size={12} className="text-emerald-500" /> : <TrendingDown size={12} className="text-rose-500" />}
                   <span className={`text-sm font-bold font-mono ${currentPrice >= bestBid ? 'text-emerald-400' : 'text-rose-400'}`}>
                       {currentPrice.toFixed(2)}
                   </span>
               </div>
          </div>
      </div>

      {/* BIDS (Buy Orders) - Bottom Half - Best Bid at Top */}
      <div className="flex-1 overflow-hidden">
        {bids.slice(0, VISIBLE_ROWS).map((bid, i) => {
            const isBestBid = i === 0;
            const depthPercent = (bid.total / maxTotal) * 100;
            
            return (
                <div 
                    key={`bid-${bid.price}`} 
                    className={`grid grid-cols-3 px-2 py-0.5 relative group cursor-pointer hover:bg-slate-800/40 transition-colors ${isBestBid ? 'bg-emerald-950/20' : ''}`}
                >
                    {/* Depth Bar (Right Aligned) */}
                    <div 
                        className="absolute top-0 right-0 bottom-0 bg-emerald-500/10 transition-all duration-300 ease-out" 
                        style={{ width: `${depthPercent}%` }} 
                    />

                    {/* Content */}
                    <div className={`relative z-10 text-left ${isBestBid ? 'text-emerald-200 font-medium' : 'text-slate-400'}`}>
                        {bid.size.toLocaleString()}
                    </div>
                    <div className={`relative z-10 text-center ${isBestBid ? 'text-emerald-400 font-bold text-sm scale-110 origin-center' : 'text-emerald-500'}`}>
                        {bid.price.toFixed(2)}
                    </div>
                    <div className="relative z-10 text-right text-slate-500">
                        {bid.total.toLocaleString()}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default OrderBook;
