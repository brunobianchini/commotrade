
import React, { useState } from 'react';
import { MarketTicker, OrderBookEntry, Trade, Position, Order, AccountBalance, OrderSide, OrderType, User } from '../types';
import MarketChart from './MarketChart';
import OrderBook from './OrderBook';
import OrderEntry from './OrderEntry';
import PositionTable from './PositionTable';
import OpenOrders from './OpenOrders';
import RecentTrades from './RecentTrades';
import { OHLCV } from '../services/marketService';
import { LayoutDashboard, TrendingUp, DollarSign, Wallet, Activity, ArrowUpRight, ArrowDownRight, Eye, EyeOff, Layers, List } from 'lucide-react';

interface TraderDashboardProps {
  user: User;
  ticker: MarketTicker;
  chartData: OHLCV[];
  orderBook: { bids: OrderBookEntry[]; asks: OrderBookEntry[] };
  recentTrades: Trade[];
  position: Position | null;
  balance: { free: number, total: number };
  onOrderSubmit: (side: OrderSide, type: OrderType, size: number, price?: number, options?: any) => void;
}

const TraderDashboard: React.FC<TraderDashboardProps> = ({
  user, ticker, chartData, orderBook, recentTrades, position, balance, onOrderSubmit
}) => {
  // Widget Visibility State
  const [widgets, setWidgets] = useState({
    chart: true,
    depth: true,
    entry: true,
    trades: true,
    positions: true,
    orders: true
  });

  const [bottomTab, setBottomTab] = useState<'POSITIONS' | 'ORDERS'>('POSITIONS');

  // KPI Calculations
  const unrealizedPnL = position ? position.unrealizedPnl : 0;
  const realizedPnL = position ? position.realizedPnl : 0;
  const totalPnL = unrealizedPnL + realizedPnL;
  const marginUsed = balance.total - balance.free;
  const marginUsagePercent = balance.total > 0 ? (marginUsed / balance.total) * 100 : 0;

  const toggleWidget = (key: keyof typeof widgets) => {
    setWidgets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="h-full bg-slate-950 flex flex-col overflow-hidden">
      
      {/* 1. TOP KPI BAR */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shadow-md z-10">
        
        {/* Equity Card */}
        <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800 flex items-center justify-between">
           <div>
              <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Total Equity</span>
              <span className="text-xl font-mono text-white font-bold">${balance.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
           </div>
           <div className="h-10 w-10 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400">
              <DollarSign size={20} />
           </div>
        </div>

        {/* P&L Card */}
        <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800 flex items-center justify-between">
           <div>
              <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Daily P&L</span>
              <div className="flex items-end gap-2">
                 <span className={`text-xl font-mono font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                 </span>
                 <span className="text-[10px] text-slate-500 mb-1">
                   (Unrealized: {unrealizedPnL > 0 ? '+' : ''}{unrealizedPnL.toFixed(0)})
                 </span>
              </div>
           </div>
           <div className={`h-10 w-10 rounded-full flex items-center justify-center ${totalPnL >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <TrendingUp size={20} />
           </div>
        </div>

        {/* Buying Power Card */}
        <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800 flex items-center justify-between">
           <div>
              <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Buying Power</span>
              <span className="text-xl font-mono text-white font-bold">${balance.free.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
           </div>
           <div className="h-10 w-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400">
              <Wallet size={20} />
           </div>
        </div>

        {/* Margin Health Card */}
        <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800 flex flex-col justify-center">
           <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-500 font-bold uppercase">Margin Usage</span>
              <span className="text-xs font-mono text-white">{marginUsagePercent.toFixed(1)}%</span>
           </div>
           <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
               <div 
                 className={`h-full rounded-full transition-all duration-500 ${marginUsagePercent > 80 ? 'bg-rose-500' : marginUsagePercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                 style={{ width: `${marginUsagePercent}%` }}
               ></div>
           </div>
        </div>
      </div>

      {/* 2. TOOLBAR */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex items-center gap-4 overflow-x-auto">
        <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
            <LayoutDashboard size={12} /> Widgets
        </span>
        <div className="h-4 w-px bg-slate-700"></div>
        {Object.entries(widgets).map(([key, isActive]) => (
            <button
                key={key}
                onClick={() => toggleWidget(key as keyof typeof widgets)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors border ${isActive ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
            >
                {isActive ? <Eye size={10} /> : <EyeOff size={10} />}
                {key}
            </button>
        ))}
      </div>

      {/* 3. MAIN GRID LAYOUT */}
      <div className="flex-1 p-2 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 h-full">
              
              {/* LEFT COLUMN: Chart */}
              {widgets.chart && (
                  <div className={`col-span-12 ${widgets.depth || widgets.entry ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col h-full gap-2`}>
                      <div className="flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-lg">
                          <MarketChart data={chartData} />
                      </div>
                      
                      {/* BOTTOM TABS PANEL (Positions / Orders) inside Left Column for desktop density */}
                      <div className="h-1/3 min-h-[200px] bg-slate-900 border border-slate-800 rounded-lg flex flex-col">
                          <div className="flex border-b border-slate-800">
                              <button 
                                onClick={() => setBottomTab('POSITIONS')}
                                className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-r border-slate-800 ${bottomTab === 'POSITIONS' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                              >
                                  <Layers size={14} /> Positions
                              </button>
                              <button 
                                onClick={() => setBottomTab('ORDERS')}
                                className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-r border-slate-800 ${bottomTab === 'ORDERS' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                              >
                                  <List size={14} /> Working Orders
                              </button>
                          </div>
                          <div className="flex-1 overflow-hidden relative">
                              {bottomTab === 'POSITIONS' && widgets.positions && <PositionTable position={position} />}
                              {bottomTab === 'ORDERS' && widgets.orders && <OpenOrders />}
                          </div>
                      </div>
                  </div>
              )}

              {/* RIGHT COLUMN: Order Book, Entry, Trades */}
              {(widgets.depth || widgets.entry || widgets.trades) && (
                  <div className={`col-span-12 ${widgets.chart ? 'lg:col-span-4' : 'lg:col-span-12'} flex flex-col gap-2 h-full overflow-y-auto`}>
                      
                      {/* Order Entry */}
                      {widgets.entry && (
                          <div className="flex-none">
                              <OrderEntry currentPrice={ticker.price} onSubmit={onOrderSubmit} />
                          </div>
                      )}

                      {/* Order Book */}
                      {widgets.depth && (
                          <div className="flex-1 min-h-[300px]">
                              <OrderBook bids={orderBook.bids} asks={orderBook.asks} currentPrice={ticker.price} />
                          </div>
                      )}

                      {/* Recent Trades */}
                      {widgets.trades && (
                          <div className="h-48 flex-none">
                              <RecentTrades trades={recentTrades} />
                          </div>
                      )}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default TraderDashboard;
