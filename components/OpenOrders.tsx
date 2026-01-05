import React, { useState, useEffect } from 'react';
import { Order, OrderSide } from '../types';
import { subscribeToOpenOrders, cancelUserOrder } from '../services/marketService';
import { XCircle, Clock } from 'lucide-react';

const OpenOrders: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        const unsub = subscribeToOpenOrders(setOrders);
        return () => unsub();
    }, []);

    const handleCancel = async (orderId: string) => {
        try {
            await cancelUserOrder(orderId);
            // Optimistic update
            setOrders(prev => prev.filter(o => o.id !== orderId));
        } catch (e: any) {
            alert("Cancel failed: " + e.message);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden font-mono text-xs">
            <div className="px-3 py-2 border-b border-slate-800 font-semibold text-slate-300 flex justify-between items-center">
                <span>Working Orders</span>
                <span className="text-[10px] text-slate-500">{orders.length} Active</span>
            </div>
            
            <div className="grid grid-cols-5 px-2 py-1 text-slate-500 border-b border-slate-800/50 text-[10px] uppercase tracking-wider">
                <div className="text-left col-span-2">Info</div>
                <div className="text-right">Price</div>
                <div className="text-right">Filled</div>
                <div className="text-right">Action</div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
                {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2">
                        <Clock size={16} />
                        <span>No working orders</span>
                    </div>
                ) : (
                    orders.map((order) => (
                        <div key={order.id} className="grid grid-cols-5 px-2 py-2 hover:bg-slate-800/30 transition-colors border-b border-slate-800/20 items-center">
                            <div className="col-span-2 flex flex-col">
                                <span className={`font-bold ${order.side === OrderSide.BUY ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {order.side} {order.type}
                                </span>
                                <span className="text-[10px] text-slate-500">{new Date(order.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="text-right text-slate-300">
                                {order.type === 'MARKET' ? 'MKT' : order.price.toFixed(2)}
                            </div>
                            <div className="text-right text-slate-400">
                                {order.size - order.remainingSize} / {order.size}
                            </div>
                            <div className="text-right flex justify-end">
                                <button 
                                    onClick={() => handleCancel(order.id)}
                                    className="p-1 hover:bg-rose-900/30 text-slate-500 hover:text-rose-400 rounded transition-colors"
                                    title="Cancel Order"
                                >
                                    <XCircle size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default OpenOrders;