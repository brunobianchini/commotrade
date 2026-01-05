import React, { useState } from 'react';
import { OrderSide, OrderType, TimeInForce } from '../types';
import { Wallet, Settings2, Clock, CheckCircle, Shield, AlertTriangle, ArrowRightLeft, Spline } from 'lucide-react';

interface OrderEntryProps {
  currentPrice: number;
  onSubmit: (side: OrderSide, type: OrderType, size: number, price?: number, options?: any) => void;
}

const OrderEntry: React.FC<OrderEntryProps> = ({ currentPrice, onSubmit }) => {
  const [side, setSide] = useState<OrderSide>(OrderSide.BUY);
  const [type, setType] = useState<OrderType>(OrderType.LIMIT);
  
  // Standard Fields
  const [price, setPrice] = useState<string>(currentPrice.toFixed(2));
  const [stopPrice, setStopPrice] = useState<string>(currentPrice.toFixed(2));
  const [size, setSize] = useState<string>('1');
  
  // Advanced Fields
  const [trailingDist, setTrailingDist] = useState<string>('5.00'); // Distance in points
  const [ocoLimit, setOcoLimit] = useState<string>((currentPrice * 1.01).toFixed(2)); // Take Profit
  const [ocoStop, setOcoStop] = useState<string>((currentPrice * 0.99).toFixed(2)); // Stop Loss

  const [tif, setTif] = useState<TimeInForce>(TimeInForce.GTC);
  const [isIceberg, setIsIceberg] = useState<boolean>(false);
  const [visibleSize, setVisibleSize] = useState<string>('');
  
  // Confirmation State
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState('');

  // Calculate Notional
  let estimatedPrice = currentPrice;
  if (type === OrderType.LIMIT) estimatedPrice = parseFloat(price);
  if (type === OrderType.STOP) estimatedPrice = parseFloat(stopPrice);
  if (type === OrderType.OCO) estimatedPrice = parseFloat(ocoLimit);
  if (type === OrderType.TRAILING_STOP) estimatedPrice = currentPrice; // Market on trigger

  const total = (isNaN(estimatedPrice) ? 0 : estimatedPrice) * (parseFloat(size) || 0);
  const marginReq = total * 0.10; // 10% Margin

  // Validation Helpers
  const handlePositiveChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') { setter(val); return; }
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) { setter(val); }
  };

  const isSignificantDeviation = (inputPrice: string) => {
      const p = parseFloat(inputPrice);
      if (isNaN(p) || p === 0 || currentPrice === 0) return false;
      const diff = Math.abs(p - currentPrice) / currentPrice;
      return diff > 0.05; // 5% Deviation
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sizeNum = parseFloat(size);
    if (isNaN(sizeNum) || sizeNum <= 0) return;

    let submitPrice = 0;
    const options: any = { icebergVisibleSize: isIceberg ? parseFloat(visibleSize) : undefined };

    // Package Payload based on Type
    switch(type) {
        case OrderType.LIMIT:
            submitPrice = parseFloat(price);
            if (isNaN(submitPrice) || submitPrice <= 0) return;
            break;
        case OrderType.STOP:
            submitPrice = 0; // Trigger market usually, or use limit logic. 
            // For this engine, Stop Orders park until `price` (Stop Price) is hit.
            options.stopPrice = parseFloat(stopPrice);
            if (isNaN(options.stopPrice) || options.stopPrice <= 0) return;
            break;
        case OrderType.TRAILING_STOP:
            options.trailingDistance = parseFloat(trailingDist);
            if (isNaN(options.trailingDistance) || options.trailingDistance <= 0) return;
            break;
        case OrderType.OCO:
            // OCO requires two prices: Limit (Profit) and Stop (Loss)
            // We pass them to parent to split into 2 orders
            submitPrice = parseFloat(ocoLimit);
            options.stopPrice = parseFloat(ocoStop);
            if (isNaN(submitPrice) || isNaN(options.stopPrice)) return;
            // Basic Logic Check for OCO
            if (side === OrderSide.BUY) {
                if (submitPrice >= currentPrice || options.stopPrice <= currentPrice) {
                    // Buy OCO: Limit should be below (Buy Dip), Stop above (Buy Breakout)? 
                    // OR: Buy Entry? Usually OCO is for Exits. 
                    // Let's assume Entry: Buy Limit Lower, Buy Stop Higher (Breakout)
                    // Or Exit: Sell Limit Higher (Profit), Sell Stop Lower (Loss)
                }
            }
            break;
        default: // Market
            submitPrice = 0;
    }

    if (isIceberg && (parseFloat(visibleSize) <= 0 || parseFloat(visibleSize) > sizeNum)) return;

    // Formatting Confirm Message
    let desc = `${side} ${size} ${type}`;
    if (type === OrderType.LIMIT) desc += ` @ ${submitPrice}`;
    if (type === OrderType.OCO) desc += ` [TP: ${submitPrice} / SL: ${options.stopPrice}]`;
    if (type === OrderType.TRAILING_STOP) desc += ` (Trail: ${options.trailingDistance})`;

    onSubmit(side, type, sizeNum, submitPrice, options);

    setConfirmationDetails(desc);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2500);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col h-full relative overflow-hidden">
      {/* Confirmation Overlay */}
      {showConfirmation && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="text-emerald-500" size={32} />
          </div>
          <h3 className="text-white font-bold text-lg mb-1">Order Sent</h3>
          <div className="bg-slate-800 rounded px-3 py-2 border border-slate-700 mt-2">
            <code className="text-xs text-indigo-300 font-mono">{confirmationDetails}</code>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-200">Order Entry</h3>
        <div className="flex gap-2">
           <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] border border-indigo-500/20 flex items-center">DMA</span>
          <button className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded">
            <Wallet size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 bg-slate-800 p-1 rounded-md mb-4">
        <button 
          type="button"
          onClick={() => setSide(OrderSide.BUY)}
          className={`py-1.5 text-sm font-medium rounded transition-colors ${side === OrderSide.BUY ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Buy
        </button>
        <button 
          type="button"
          onClick={() => setSide(OrderSide.SELL)}
          className={`py-1.5 text-sm font-medium rounded transition-colors ${side === OrderSide.SELL ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Sell
        </button>
      </div>

      {/* Advanced Order Type Selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
        {[OrderType.LIMIT, OrderType.MARKET, OrderType.STOP, OrderType.TRAILING_STOP, OrderType.OCO].map(t => (
          <button 
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-3 py-1 text-[10px] font-bold whitespace-nowrap rounded-full border transition-all ${type === t ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 shadow-indigo-500/20 shadow-md' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-3">
        
        {/* Dynamic Inputs based on Type */}
        {type === OrderType.LIMIT && (
          <div className="animate-in fade-in slide-in-from-right-1">
            <label className="block text-xs text-slate-500 mb-1 flex justify-between">
                <span>Limit Price</span>
                {isSignificantDeviation(price) && <span className="text-amber-500 font-bold flex items-center gap-1"><AlertTriangle size={10} /> Deviation</span>}
            </label>
            <input 
              type="number" value={price} onChange={handlePositiveChange(setPrice)}
              className={`w-full bg-slate-950 border rounded p-2 text-right text-sm text-white focus:outline-none transition-colors ${isSignificantDeviation(price) ? 'border-amber-500 text-amber-100' : 'border-slate-700 focus:border-indigo-500'}`}
              step="0.01" required
            />
          </div>
        )}

        {type === OrderType.STOP && (
          <div className="animate-in fade-in slide-in-from-right-1">
            <label className="block text-xs text-rose-400 mb-1">Stop Price</label>
            <input 
              type="number" value={stopPrice} onChange={handlePositiveChange(setStopPrice)}
              className="w-full bg-slate-950 border border-rose-900/50 rounded p-2 text-right text-sm text-white focus:border-rose-500"
              step="0.01" required
            />
          </div>
        )}

        {type === OrderType.TRAILING_STOP && (
          <div className="animate-in fade-in slide-in-from-right-1">
            <label className="block text-xs text-indigo-400 mb-1 flex items-center gap-1">
                <Spline size={12} /> Trailing Distance (Pts)
            </label>
            <input 
              type="number" value={trailingDist} onChange={handlePositiveChange(setTrailingDist)}
              className="w-full bg-slate-950 border border-indigo-900/50 rounded p-2 text-right text-sm text-white focus:border-indigo-500"
              step="0.1" required
            />
            <p className="text-[10px] text-slate-500 mt-1 text-right">Pegs to market price moving favorable</p>
          </div>
        )}

        {type === OrderType.OCO && (
          <div className="animate-in fade-in slide-in-from-right-1 p-3 bg-slate-800/50 rounded border border-slate-700 flex flex-col gap-3">
             <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                 <ArrowRightLeft size={12} /> One Cancels Other Group
             </div>
             <div>
                <label className="block text-[10px] text-emerald-500 mb-1">Take Profit (Limit)</label>
                <input 
                  type="number" value={ocoLimit} onChange={handlePositiveChange(setOcoLimit)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-right text-sm text-emerald-400 focus:border-emerald-500"
                  step="0.01" required
                />
             </div>
             <div>
                <label className="block text-[10px] text-rose-500 mb-1">Stop Loss (Stop)</label>
                <input 
                  type="number" value={ocoStop} onChange={handlePositiveChange(setOcoStop)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-right text-sm text-rose-400 focus:border-rose-500"
                  step="0.01" required
                />
             </div>
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-500 mb-1">Size (Lots)</label>
          <input 
            type="number" value={size} onChange={handlePositiveChange(setSize)}
            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-right text-sm text-white focus:border-indigo-500"
            min="0.01" step="0.01" required
          />
        </div>

        {/* TIF & Iceberg */}
        <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                <Clock size={10} /> TIF
              </label>
              <select 
                value={tif} onChange={(e) => setTif(e.target.value as TimeInForce)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:border-indigo-500"
              >
                <option value={TimeInForce.GTC}>GTC</option>
                <option value={TimeInForce.IOC}>IOC</option>
                <option value={TimeInForce.FOK}>FOK</option>
              </select>
            </div>
            
            <div className="flex items-end">
               <button 
                type="button"
                onClick={() => setIsIceberg(!isIceberg)}
                className={`w-full p-2 border rounded text-xs flex items-center justify-center gap-1 transition-colors ${isIceberg ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}
               >
                 <Settings2 size={12} /> Iceberg
               </button>
            </div>
        </div>

        {isIceberg && (
           <div className="animate-in fade-in slide-in-from-top-1">
            <label className="block text-xs text-slate-500 mb-1">Visible Size</label>
            <input 
              type="number" value={visibleSize} onChange={handlePositiveChange(setVisibleSize)}
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-right text-sm text-white focus:border-indigo-500"
              min="0.01" max={size} step="0.01" placeholder="Display Qty" required
            />
          </div>
        )}

        <div className="mt-auto pt-2 border-t border-slate-800">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Notional</span>
            <span className="text-white font-mono">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mb-4 items-center">
             <span className="flex items-center gap-1"><Shield size={10} className="text-emerald-500"/> Margin (10%)</span>
             <span className="text-emerald-400 font-mono">${marginReq.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          
          <button 
            type="submit"
            className={`w-full py-3 rounded font-bold text-white shadow-lg transition-all active:scale-[0.98] ${side === OrderSide.BUY ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20'}`}
          >
            {side} {type.replace('_', ' ')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrderEntry;
