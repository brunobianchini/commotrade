import React, { useEffect, useState } from 'react';
import { infraService } from '../services/InfrastructureService';
import { SystemHealth } from '../types';
import { Server, Activity, Network, Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const SystemStatus: React.FC = () => {
    const [health, setHealth] = useState<SystemHealth>(infraService.getSystemHealth());
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setHealth(infraService.getSystemHealth());
            setLogs(infraService.getClusterLogs());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        if (status === 'HEALTHY' || status === 'SYNCED') return 'text-emerald-500';
        if (status === 'DEGRADED' || status === 'DRIFT') return 'text-amber-500';
        return 'text-rose-500';
    };

    return (
        <div className="absolute top-16 right-6 w-96 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-4">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                <Server size={18} className="text-indigo-400" /> System Status Monitor
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Activity size={10} /> Cluster Status</div>
                    <div className={`font-mono font-bold ${getStatusColor(health.clusterStatus)} flex items-center gap-2`}>
                        {health.clusterStatus === 'HEALTHY' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                        {health.clusterStatus}
                    </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                     <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Network size={10} /> Network Latency</div>
                     <div className="font-mono font-bold text-white">
                         {health.networkLatency.toFixed(2)} ms
                     </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                     <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Clock size={10} /> PTP Time Sync</div>
                     <div className={`font-mono font-bold ${getStatusColor(health.ptpSyncStatus)}`}>
                         {health.ptpSyncStatus}
                     </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                     <div className="text-xs text-slate-500 mb-1">Throughput</div>
                     <div className="font-mono font-bold text-indigo-400">
                         {health.matchingEngineThroughput} TPS
                     </div>
                </div>
            </div>

            <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <div className="text-xs font-bold text-slate-400 mb-2 uppercase">Infrastructure Logs</div>
                <div className="space-y-1">
                    {logs.map((log, i) => (
                        <div key={i} className="text-[10px] font-mono text-slate-500 truncate">
                            {log}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SystemStatus;