import React from 'react';
import { Trade, OrderSide } from '../types';

interface RecentTradesProps {
  trades: Trade[];
}

const RecentTrades: React.FC<RecentTradesProps> = ({ trades }) => {
  return (
    <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden font-mono text-xs">
      <div className="px-3 py-2 border-b border-slate-800 font-semibold text-slate-300 flex justify-between items-center">
        <span>Market Trades</span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] text-slate-500 uppercase">Live Feed</span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 px-2 py-1 text-slate-500 border-b border-slate-800/50 text-[10px] uppercase tracking-wider">
        <div className="text-left">Price</div>
        <div className="text-center">Size</div>
        <div className="text-right">Time</div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {trades.map((trade) => (
          <div key={trade.id} className="grid grid-cols-3 px-2 py-0.5 hover:bg-slate-800/30 transition-colors">
            <div className={`text-left font-medium ${trade.side === OrderSide.BUY ? 'text-emerald-500' : 'text-rose-500'}`}>
              {trade.price.toFixed(2)}
            </div>
            <div className="text-center text-slate-300">
              {trade.size}
            </div>
            <div className="text-right text-slate-500">
              {new Date(trade.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentTrades;