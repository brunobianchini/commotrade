import React, { useMemo, useState } from 'react';
import { ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { OHLCV } from '../services/marketService';

interface MarketChartProps {
  data: OHLCV[];
  color?: string;
}

const MarketChart: React.FC<MarketChartProps> = ({ data, color = "#10b981" }) => {
  const [timeframe, setTimeframe] = useState('1m');

  // Filter data based on view width (simplified zoom simulation)
  const visibleData = useMemo(() => {
     // For demo, we just slice the last N points to keep the chart readable
     // In a real app, 'timeframe' would trigger a backend aggregation query
     return data.slice(-100); 
  }, [data]);

  const minPrice = useMemo(() => Math.min(...visibleData.map(d => d.low)) * 0.9995, [visibleData]);
  const maxPrice = useMemo(() => Math.max(...visibleData.map(d => d.high)) * 1.0005, [visibleData]);

  // Calculate Simple Moving Average (SMA 20)
  const dataWithSMA = useMemo(() => {
      return visibleData.map((point, index, array) => {
          if (index < 20) return { ...point, sma: null };
          const slice = array.slice(index - 20, index);
          const sum = slice.reduce((a, b) => a + b.close, 0);
          return { ...point, sma: sum / 20 };
      });
  }, [visibleData]);

  const formatTime = (timestamp: number) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs font-mono z-50">
          <p className="text-slate-400 border-b border-slate-800 pb-1 mb-1">{new Date(d.time).toLocaleString()}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
             <span className="text-slate-500">Open:</span> <span className="text-slate-200 text-right">{d.open.toFixed(2)}</span>
             <span className="text-slate-500">High:</span> <span className="text-emerald-400 text-right">{d.high.toFixed(2)}</span>
             <span className="text-slate-500">Low:</span> <span className="text-rose-400 text-right">{d.low.toFixed(2)}</span>
             <span className="text-slate-500">Close:</span> <span className="text-indigo-400 text-right">{d.close.toFixed(2)}</span>
             <span className="text-slate-500">Vol:</span> <span className="text-amber-400 text-right">{d.volume}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
      {/* Chart Toolbar */}
      <div className="px-4 py-2 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                XAU/USD <span className="text-slate-500 font-normal">Gold Spot</span>
            </h3>
            <div className="h-4 w-px bg-slate-700"></div>
            <div className="text-xs text-slate-400 flex gap-2">
                <span>O: <span className="text-slate-300">{visibleData[visibleData.length-1]?.open.toFixed(2)}</span></span>
                <span>H: <span className="text-emerald-500">{visibleData[visibleData.length-1]?.high.toFixed(2)}</span></span>
                <span>L: <span className="text-rose-500">{visibleData[visibleData.length-1]?.low.toFixed(2)}</span></span>
                <span>C: <span className="text-indigo-400">{visibleData[visibleData.length-1]?.close.toFixed(2)}</span></span>
            </div>
        </div>
        
        <div className="flex gap-1 text-[10px] font-bold text-slate-500">
          {['1m', '5m', '15m', '1h', '4h', '1D'].map(tf => (
              <button 
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded transition-colors ${timeframe === tf ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-slate-300'}`}
              >
                  {tf}
              </button>
          ))}
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 min-h-0 relative group">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dataWithSMA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 10, fill: '#64748b' }} 
              axisLine={false}
              tickLine={false}
              minTickGap={50}
              tickFormatter={formatTime}
            />
            
            {/* Price Axis */}
            <YAxis 
              yAxisId="right"
              domain={[minPrice, maxPrice]} 
              tick={{ fontSize: 10, fill: '#94a3b8' }} 
              orientation="right"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => value.toFixed(2)}
              width={50}
            />

            {/* Volume Axis (Hidden scale) */}
            <YAxis 
                yAxisId="left"
                orientation="left"
                axisLine={false}
                tick={false}
                width={0}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} />

            {/* Volume Bars */}
            <Bar 
                yAxisId="left"
                dataKey="volume" 
                fill="#334155" 
                opacity={0.3}
                barSize={4}
            />

            {/* SMA Indicator */}
            <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="sma" 
                stroke="#f59e0b" 
                strokeWidth={1} 
                dot={false}
                activeDot={false}
                isAnimationActive={false}
            />

            {/* Main Price Line Area */}
            <Area 
              yAxisId="right"
              type="monotone" 
              dataKey="close" 
              stroke={color} 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPrice)" 
              isAnimationActive={false}
            />
            
            {/* Current Price Line */}
            <ReferenceLine 
                yAxisId="right"
                y={visibleData[visibleData.length - 1]?.close} 
                stroke={color} 
                strokeDasharray="3 3" 
                label={{ 
                    position: 'right', 
                    value: visibleData[visibleData.length - 1]?.close.toFixed(2), 
                    fill: color, 
                    fontSize: 10,
                    fontWeight: 'bold',
                    fillOpacity: 1
                }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        
        {/* Chart Watermark */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-slate-800 text-6xl font-black opacity-20 pointer-events-none select-none">
            COMMOTRADE
        </div>
      </div>
    </div>
  );
};

export default MarketChart;