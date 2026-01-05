import React from 'react';
import { Position } from '../types';

interface PositionTableProps {
  position: Position | null;
}

const PositionTable: React.FC<PositionTableProps> = ({ position }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-full">
      <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <h3 className="font-semibold text-slate-300 text-sm">Open Positions</h3>
        <span className="text-xs text-slate-500">
          Unrealized P&L: 
          <span className={`font-mono ml-2 ${(position?.unrealizedPnl || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {(position?.unrealizedPnl || 0) >= 0 ? '+' : ''}
            ${(position?.unrealizedPnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950 text-xs text-slate-500 sticky top-0 z-10">
            <tr>
              <th className="p-3 font-medium">Symbol</th>
              <th className="p-3 font-medium text-right">Size</th>
              <th className="p-3 font-medium text-right">Entry</th>
              <th className="p-3 font-medium text-right">Mark</th>
              <th className="p-3 font-medium text-right">P&L</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {position && position.size !== 0 ? (
              <tr className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="p-3 font-medium text-slate-200">{position.symbol}</td>
                <td className={`p-3 text-right ${position.size > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {position.size > 0 ? '+' : ''}{position.size}
                </td>
                <td className="p-3 text-right text-slate-400">{position.averageEntryPrice.toFixed(2)}</td>
                <td className="p-3 text-right text-slate-200">{position.markPrice.toFixed(2)}</td>
                <td className={`p-3 text-right font-mono ${position.unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {position.unrealizedPnl >= 0 ? '+' : ''}{position.unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-600 text-xs italic">
                  No open positions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PositionTable;