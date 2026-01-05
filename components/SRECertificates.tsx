
import React, { useState, useEffect } from 'react';
import { WarehouseReceipt, UserRole, BlockchainTransaction, SREStatus } from '../types';
import { db } from '../services/DatabaseService';
import { auth } from '../services/AuthService';
import { sreService } from '../services/SREService';
import { securityService } from '../services/SecurityService';
import { Box, ShieldCheck, Truck, Lock, FileText, QrCode, Link as LinkIcon, Activity, PlusCircle, ArrowRightLeft, CheckCircle, Unlock, Flame, AlertCircle, History } from 'lucide-react';

const SRECertificates: React.FC = () => {
  const [receipts, setReceipts] = useState<WarehouseReceipt[]>([]);
  const [txs, setTxs] = useState<BlockchainTransaction[]>([]);
  const [showMintModal, setShowMintModal] = useState(false);
  
  // Lineage State
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [lineage, setLineage] = useState<BlockchainTransaction[]>([]);

  const user = auth.getUser();
  
  // Permission Checks
  const canMint = user && securityService.verifyPermission(user, 'SRE_MINT');
  const canApprove = user && securityService.verifyPermission(user, 'SRE_APPROVE');
  const canPledge = user && securityService.verifyPermission(user, 'SRE_PLEDGE');
  const canRedeem = user && securityService.verifyPermission(user, 'SRE_REDEEM');
  const canDeliver = user && securityService.verifyPermission(user, 'SRE_DELIVER');
  const canUnpledge = user && securityService.verifyPermission(user, 'SRE_UNPLEDGE');

  useEffect(() => {
    // Filter out SPLIT receipts to keep view clean, sort by new
    const loadData = () => {
        setReceipts(db.getReceipts().filter(r => r.status !== SREStatus.SPLIT).reverse());
        setTxs(db.getBlockchainTxs());
    };
    
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleMint = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    const formData = new FormData(e.currentTarget);
    try {
        sreService.mintReceipt({
            commodity: formData.get('commodity') as string,
            grade: formData.get('grade') as string,
            quantity: Number(formData.get('quantity')),
            location: formData.get('location') as string,
        }, user);
        
        setShowMintModal(false);
    } catch (err: any) {
        alert(err.message);
    }
  };

  const handleApprove = (id: string) => {
      if(!user) return;
      try {
          sreService.approveReceipt(id, user);
      } catch (e: any) { alert(e.message); }
  };

  const handlePledge = (id: string) => {
      if(!user) return;
      try {
          sreService.pledgeReceipt(id, user.id);
      } catch (e: any) { alert(e.message); }
  };

  const handleUnpledge = (id: string) => {
      if(!user) return;
      try {
          sreService.unpledgeReceipt(id, user);
      } catch (e: any) { alert(e.message); }
  };

  const handleRequestDelivery = (id: string) => {
      if(!user) return;
      try {
          sreService.requestDelivery(id, user.id);
      } catch (e: any) { alert(e.message); }
  };

  const handleConfirmDelivery = (id: string) => {
      if(!user) return;
      try {
          sreService.completeDelivery(id, user);
      } catch (e: any) { alert(e.message); }
  };

  const handleTrace = (id: string) => {
      const receiptTxs = db.getBlockchainTxs().filter(tx => tx.receiptId === id || tx.receiptId.startsWith(id)); // Simple matching
      setLineage(receiptTxs.reverse());
      setSelectedReceipt(id);
  };

  const getStatusColor = (status: SREStatus) => {
      switch(status) {
          case SREStatus.VALID: return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
          case SREStatus.PENDING_APPROVAL: return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
          case SREStatus.PLEDGED: return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
          case SREStatus.DELIVERY_REQUESTED: return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
          case SREStatus.DELIVERED: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
          default: return 'bg-slate-500/10 text-slate-500';
      }
  };

  return (
    <div className="h-full bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-mono border border-indigo-500/30">Hyperledger Fabric</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono border border-emerald-500/30"><Activity size={10} /> Node Active</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Box className="text-indigo-500" /> 
              SRE Registry (Warehouse Receipts)
            </h2>
            <p className="text-slate-400 text-sm">Blockchain-verified ownership of physical commodities. ISO 20022 Compliant.</p>
          </div>
          <div className="flex gap-3">
             {canMint && (
                 <button 
                    onClick={() => setShowMintModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
                 >
                    <PlusCircle size={18} /> Mint Receipt
                 </button>
             )}
             <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg font-medium border border-slate-700 transition-all flex items-center gap-2">
                <LinkIcon size={16} /> Block Explorer
             </button>
          </div>
        </div>

        {/* Mint Modal */}
        {showMintModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg">
                    <h3 className="text-xl font-bold text-white mb-4">Mint New Warehouse Receipt</h3>
                    <form onSubmit={handleMint} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Commodity</label>
                                <input name="commodity" required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="e.g. Gold Bullion" />
                            </div>
                             <div>
                                <label className="block text-xs text-slate-400 mb-1">Grade</label>
                                <input name="grade" required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="e.g. 999.9 Fine" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Quantity (MT)</label>
                                <input name="quantity" type="number" required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                            </div>
                             <div>
                                <label className="block text-xs text-slate-400 mb-1">Location</label>
                                <input name="location" required className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => setShowMintModal(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700">Cancel</button>
                            <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500">Mint (Sign & Publish)</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Provenance/Lineage Modal */}
        {selectedReceipt && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-2xl h-[80vh] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <History className="text-indigo-500"/> Asset Lineage: {selectedReceipt}
                        </h3>
                        <button onClick={() => setSelectedReceipt(null)} className="text-slate-400 hover:text-white">✕</button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 relative">
                        {/* Timeline */}
                        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-800"></div>
                        
                        <div className="space-y-6">
                            {lineage.map((tx, idx) => (
                                <div key={tx.hash} className="relative pl-14 group">
                                    <div className={`absolute left-[21px] top-1 w-3 h-3 rounded-full border-2 border-slate-950 z-10 ${idx === 0 ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg hover:border-indigo-500/50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tx.action === 'MINT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-indigo-300'}`}>
                                                {tx.action}
                                            </span>
                                            <span className="text-xs text-slate-500 font-mono">{new Date(tx.timestamp).toLocaleString()}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <span className="text-slate-500 block mb-1">From</span>
                                                <span className="font-mono text-slate-300">{tx.from}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block mb-1">To</span>
                                                <span className="font-mono text-slate-300">{tx.to}</span>
                                            </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-600 flex items-center gap-1">
                                            <LinkIcon size={8} /> Tx: {tx.hash}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {receipts.length === 0 && (
             <div className="col-span-4 py-12 text-center text-slate-500 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
                <AlertCircle className="mx-auto mb-2 opacity-50" size={32} />
                No active receipts found in registry.
             </div>
          )}
          {receipts.map((receipt) => (
            <div key={receipt.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-indigo-500/50 transition-colors group relative overflow-hidden">
               {/* Decorative background pattern */}
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all"></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="p-2 bg-slate-800 rounded-lg text-indigo-400">
                  <FileText size={24} />
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStatusColor(receipt.status)}`}>
                  {receipt.status.replace('_', ' ')}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-100 mb-1">{receipt.commodity}</h3>
              <p className="text-sm text-slate-500 mb-4">{receipt.grade}</p>

              <div className="space-y-3 text-sm text-slate-300 mb-6">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Receipt ID</span>
                  <span className="font-mono text-xs bg-slate-950 px-1 py-0.5 rounded cursor-pointer hover:text-indigo-400 underline" onClick={() => handleTrace(receipt.id)}>{receipt.id}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                   <span className="text-slate-500">Parent ID</span>
                   <span className="font-mono text-xs text-slate-600">{receipt.parentId ? receipt.parentId : '-'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Quantity</span>
                  <span className="font-bold">{receipt.quantity} MT</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Owner</span>
                  <span className="font-mono text-xs text-indigo-300">{receipt.ownerHash}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tx Hash</span>
                  <span className="font-mono text-[10px] text-indigo-400 bg-indigo-900/10 px-1 rounded flex items-center gap-1" title={receipt.txHash}>
                      {receipt.txHash.substring(0, 8)}... <LinkIcon size={8} />
                  </span>
                </div>
              </div>

              {/* Action Buttons based on Permissions */}
              <div className="flex gap-2 flex-wrap">
                {canApprove && receipt.status === SREStatus.PENDING_APPROVAL && (
                   <button onClick={() => handleApprove(receipt.id)} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold text-white transition-colors flex items-center justify-center gap-1">
                      <CheckCircle size={14} /> APPROVE
                   </button>
                )}
                
                {/* Owner Specific Actions requiring Permission */}
                {receipt.status === SREStatus.VALID && receipt.ownerHash === user?.id && (
                   <>
                    {canPledge && (
                      <button onClick={() => handlePledge(receipt.id)} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white transition-colors flex items-center justify-center gap-1">
                          <Lock size={14} /> PLEDGE
                      </button>
                    )}
                    {canRedeem && (
                      <button onClick={() => handleRequestDelivery(receipt.id)} className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 rounded text-xs font-bold text-white transition-colors flex items-center justify-center gap-1">
                          <Truck size={14} /> REDEEM
                      </button>
                    )}
                   </>
                )}
                
                {canUnpledge && receipt.status === SREStatus.PLEDGED && (
                    <button onClick={() => handleUnpledge(receipt.id)} className="w-full py-2 bg-indigo-500 hover:bg-indigo-400 rounded text-xs font-bold text-white transition-colors flex items-center justify-center gap-1">
                        <Unlock size={14} /> RELEASE PLEDGE (RISK)
                    </button>
                )}

                {canDeliver && receipt.status === SREStatus.DELIVERY_REQUESTED && (
                    <button onClick={() => handleConfirmDelivery(receipt.id)} className="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded text-xs font-bold text-white transition-colors flex items-center justify-center gap-1">
                        <Flame size={14} /> CONFIRM LOAD-OUT
                    </button>
                )}
                
                {/* Universal Trace Button */}
                <button onClick={() => handleTrace(receipt.id)} className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 transition-colors flex items-center justify-center gap-1 border border-slate-700">
                    <History size={12} /> TRACE LINEAGE
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Blockchain Ledger View */}
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <ArrowRightLeft className="text-emerald-500" /> Public Ledger (Latest Transactions)
        </h3>
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
             <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-950 text-slate-200">
                    <tr>
                        <th className="p-4">Tx Hash</th>
                        <th className="p-4">Block</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Receipt ID</th>
                        <th className="p-4">From</th>
                        <th className="p-4">To</th>
                    </tr>
                </thead>
                <tbody className="font-mono text-xs">
                    {txs.slice().reverse().slice(0, 10).map(tx => (
                        <tr key={tx.hash} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="p-4 text-indigo-400">{tx.hash.substring(0, 16)}...</td>
                            <td className="p-4">{tx.blockNumber}</td>
                            <td className="p-4 font-bold text-white">{tx.action}</td>
                            <td className="p-4">{tx.receiptId}</td>
                            <td className="p-4">{tx.from.substring(0, 10)}</td>
                            <td className="p-4">{tx.to.substring(0, 10)}</td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
      </div>
    </div>
  );
};

export default SRECertificates;
