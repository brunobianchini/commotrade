
import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Play, Wifi, RefreshCcw, XSquare } from 'lucide-react';
import { fixGateway, FixLogEntry } from '../services/FixGatewayService';
import { auth } from '../services/AuthService';
import { SOH, FIX_VERSION } from '../services/FixProtocol';

const FixTerminal: React.FC = () => {
    const [logs, setLogs] = useState<FixLogEntry[]>([]);
    const [input, setInput] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const logEndRef = useRef<HTMLDivElement>(null);
    const user = auth.getUser();
    const [seqNum, setSeqNum] = useState(1);
    const [lastClOrdId, setLastClOrdId] = useState('');

    useEffect(() => {
        fixGateway.setLogCallback((entry) => {
            setLogs(prev => [...prev.slice(-49), entry]); // Keep last 50
        });

        if (user) {
            fixGateway.connect(user);
            setIsConnected(true);
        }

        return () => {
            fixGateway.disconnect();
            fixGateway.setLogCallback(() => {});
        };
    }, []);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleSend = () => {
        if (!input) return;
        fixGateway.receiveMessage(input);
        setInput('');
    };

    const generateMsg = (type: 'LOGON' | 'NEW_ORDER' | 'CANCEL') => {
        let body = '';
        const now = new Date().toISOString();
        const sender = user ? user.username.toUpperCase() : 'CLIENT';
        
        let msgType = 'A';
        if (type === 'NEW_ORDER') msgType = 'D';
        if (type === 'CANCEL') msgType = 'F';

        // Basic header construction
        const header = `8=${FIX_VERSION}${SOH}9=000${SOH}35=${msgType}${SOH}49=${sender}${SOH}56=COMMOTRADE${SOH}34=${seqNum}${SOH}52=${now}${SOH}`;

        if (type === 'LOGON') {
            body = `98=0${SOH}108=30${SOH}`;
        } else if (type === 'NEW_ORDER') {
            const newId = `ClOrd-${Date.now()}`;
            setLastClOrdId(newId);
            body = `11=${newId}${SOH}55=XAU/USD${SOH}54=1${SOH}38=10${SOH}40=2${SOH}44=2030.50${SOH}`;
        } else if (type === 'CANCEL') {
            if (!lastClOrdId) {
                alert("Generate a New Order first to have an ID to cancel.");
                return;
            }
            body = `11=Cxl-${Date.now()}${SOH}41=${lastClOrdId}${SOH}55=XAU/USD${SOH}54=1${SOH}`;
        }

        // We don't calc checksum for input simulation if we don't want to enforce it on receiveMessage side tightly
        // But let's append a dummy checksum
        const msg = `${header}${body}10=000${SOH}`;
        setInput(msg);
        setSeqNum(prev => prev + 1);
    };

    return (
        <div className="h-full bg-slate-950 p-6 flex flex-col">
             <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Terminal className="text-emerald-500" /> FIX 4.4 Gateway
                        </h2>
                        <p className="text-slate-400 text-sm">Financial Information eXchange Protocol Interface</p>
                    </div>
                    <div className={`px-4 py-2 rounded-full border flex items-center gap-2 text-sm font-mono ${isConnected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                        <Wifi size={14} /> {isConnected ? 'SESSION ACTIVE' : 'DISCONNECTED'}
                    </div>
                </div>

                {/* Terminal Screen */}
                <div className="flex-1 bg-slate-900 border border-slate-700 rounded-t-xl overflow-hidden flex flex-col font-mono text-xs">
                    <div className="bg-slate-800 px-4 py-2 text-slate-400 flex justify-between">
                        <span>Console Output</span>
                        <span className="text-slate-500">TargetCompID: COMMOTRADE</span>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto space-y-2">
                        {logs.length === 0 && (
                            <div className="text-slate-600 italic text-center mt-10">No traffic detected. Send a Logon message.</div>
                        )}
                        {logs.map((log, idx) => (
                            <div key={idx} className={`flex gap-3 ${log.direction === 'IN' ? 'text-indigo-300' : 'text-emerald-300'}`}>
                                <span className="text-slate-600 min-w-[60px]">{new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}</span>
                                <span className={`font-bold min-w-[30px]`}>{log.direction === 'IN' ? '>>' : '<<'}</span>
                                <span className="break-all">{log.raw.split(SOH).join(' | ')}</span>
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="bg-slate-800 border-x border-b border-slate-700 rounded-b-xl p-4">
                    <div className="flex gap-2 mb-3">
                        <button onClick={() => generateMsg('LOGON')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded border border-slate-600 flex items-center gap-1">
                            <RefreshCcw size={12} /> Gen Logon (A)
                        </button>
                        <button onClick={() => generateMsg('NEW_ORDER')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded border border-slate-600 flex items-center gap-1">
                            <Play size={12} /> Gen NewOrder (D)
                        </button>
                        <button onClick={() => generateMsg('CANCEL')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded border border-slate-600 flex items-center gap-1">
                            <XSquare size={12} /> Gen Cancel (F)
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-600 rounded p-3 text-slate-200 font-mono text-sm focus:border-emerald-500 outline-none"
                            placeholder="Enter raw FIX message (use | for SOH)..."
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button onClick={handleSend} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 rounded font-bold flex items-center gap-2">
                            <Send size={16} /> SEND
                        </button>
                    </div>
                </div>
             </div>
        </div>
    );
};

export default FixTerminal;
