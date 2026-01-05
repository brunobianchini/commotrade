
import React, { useState, useEffect } from 'react';
import { ViewMode, MarketTicker, OrderBookEntry, Trade, Position, OrderSide, OrderType, UserRole, MarketPhase } from './types';
import { subscribeToMarketData, submitUserOrder, getCurrentUserPosition, getInitialHistory, OHLCV, startMarketReplay, stopMarketReplay, cancelUserOrder, setReplaySpeed } from './services/marketService';
import { auth } from './services/AuthService';
import { db } from './services/DatabaseService';
import { riskEngine } from './services/RiskEngine';
import { backOfficeService } from './services/BackOfficeService';
import { clearingHouse } from './services/ClearingHouse';
import { settlementService } from './services/SettlementService';
import { gateway } from './services/GatewayService';
import { securityService } from './services/SecurityService';
import MarketChart from './components/MarketChart';
import OrderBook from './components/OrderBook';
import OrderEntry from './components/OrderEntry';
import PositionTable from './components/PositionTable';
import SRECertificates from './components/SRECertificates';
import AIAnalysis from './components/AIAnalysis';
import RecentTrades from './components/RecentTrades';
import OpenOrders from './components/OpenOrders';
import Login from './components/Login';
import SystemStatus from './components/SystemStatus';
import FixTerminal from './components/FixTerminal';
import TraderDashboard from './components/TraderDashboard';
import { Activity, Layers, BarChart3, Settings, Bell, Search, Hexagon, Wifi, LogOut, ShieldAlert, Wallet, Eye, AlertOctagon, Power, FileBarChart, PieChart, Landmark, PlayCircle, StopCircle, Zap, FileText, Globe, Gavel, Scale, FastForward, Terminal, LayoutDashboard } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState(auth.getUser());
  const [view, setView] = useState<ViewMode>(ViewMode.DASHBOARD); // Default to Dashboard
  const [ticker, setTicker] = useState<MarketTicker>({
    symbol: 'XAU/USD', price: 0, change: 0, changePercent: 0, volume: 0, high: 0, low: 0, status: MarketPhase.CONTINUOUS_TRADING
  });
  
  // Initialize Chart with History
  const [chartData, setChartData] = useState<OHLCV[]>(getInitialHistory());
  
  const [orderBook, setOrderBook] = useState<{ bids: OrderBookEntry[]; asks: OrderBookEntry[] }>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [balance, setBalance] = useState<{free: number, total: number}>({ free: 0, total: 0});
  const [marketHalted, setMarketHalted] = useState(false);
  const [showSystemStatus, setShowSystemStatus] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeedState] = useState(1);

  // Back Office & Stress Test State
  const [dailyReport, setDailyReport] = useState(backOfficeService.generateDailyReport());
  const [invoices, setInvoices] = useState(backOfficeService.getInvoices());
  const [stressResult, setStressResult] = useState<any>(null);
  const [fixingResult, setFixingResult] = useState<any>(null);
  const [eodBatch, setEodBatch] = useState<any>(null);

  // Force re-render for alerts
  const [alertUpdate, setAlertUpdate] = useState(0);

  useEffect(() => {
    setUser(auth.getUser());
    setMarketHalted(riskEngine.isMarketHalted());
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToMarketData(
      (newTicker) => {
        setTicker(newTicker);
        setChartData(prev => {
           // We need to convert the ticker update into a candle update for the chart
           const lastCandle = prev[prev.length - 1];
           const now = Date.now();
           const currentMinute = Math.floor(now / 60000) * 60000;

           // If new minute, create new candle
           if (lastCandle.time < currentMinute) {
               return [...prev, {
                   time: currentMinute,
                   open: newTicker.price,
                   high: newTicker.price,
                   low: newTicker.price,
                   close: newTicker.price,
                   volume: 0 // Accumulate volume
               }];
           } else {
               // Update existing candle
               const updatedCandle = {
                   ...lastCandle,
                   high: Math.max(lastCandle.high, newTicker.price),
                   low: Math.min(lastCandle.low, newTicker.price),
                   close: newTicker.price,
                   volume: lastCandle.volume + 1 // Simply counting ticks as volume for real-time
               };
               return [...prev.slice(0, -1), updatedCandle];
           }
        });

        setPosition({...getCurrentUserPosition()});
        
        const bal = db.getBalance(user.id);
        setBalance({ free: bal.free, total: bal.total });
        
        const engineHalt = newTicker.status === MarketPhase.CIRCUIT_BREAKER_HALT || newTicker.status === MarketPhase.CLOSED;
        setMarketHalted(riskEngine.isMarketHalted() || engineHalt);

        if(view === ViewMode.BACK_OFFICE) {
            setDailyReport(backOfficeService.generateDailyReport());
        }
      },
      (newBook) => setOrderBook(newBook),
      (newTrades) => setRecentTrades(newTrades)
    );

    return () => unsubscribe();
  }, [user, view]);

  const handleOrderSubmit = async (side: OrderSide, type: OrderType, size: number, price?: number, options?: any) => {
    try {
        if (type === OrderType.OCO) {
            // OCO Split Logic: Submit Limit Order (Price) and Stop Order (options.stopPrice)
            const groupId = 'OCO-' + Date.now();
            
            // 1. Submit Limit Leg
            await submitUserOrder(side, OrderType.LIMIT, size, price, { ...options, ocoGroupId: groupId });
            
            // 2. Submit Stop Leg (Assuming Stop Loss, so same side typically for exits, or breakout entry?)
            // If Entry OCO (Buy Limit + Buy Stop): Side remains same.
            // If Exit OCO (Sell Limit + Sell Stop): Side remains same.
            // Using logic that OCO order entry sends same side for both legs (Entry Strategy)
            await submitUserOrder(side, OrderType.STOP, size, 0, { ...options, stopPrice: options.stopPrice, ocoGroupId: groupId });
            
        } else {
            // Standard submission (Limit, Market, Stop, Trailing)
            await submitUserOrder(side, type, size, price, options);
        }
    } catch (e: any) {
        alert("ORDER REJECTED: " + e.message);
    }
  };

  const handleLogout = () => {
      auth.logout();
      setUser(null);
  };
  
  const toggleKillSwitch = () => {
      if (user) {
          try {
             riskEngine.toggleGlobalKillSwitch(!riskEngine.isMarketHalted(), user);
          } catch (e: any) {
              alert(e.message);
          }
      }
  };

  const handleReplayToggle = () => {
      if (isReplaying) {
          stopMarketReplay();
          setIsReplaying(false);
      } else {
          startMarketReplay();
          setIsReplaying(true);
      }
  };

  const handleReplaySpeedChange = (speed: number) => {
      setReplaySpeedState(speed);
      setReplaySpeed(speed);
  };

  const handleResolveAlert = (id: string) => {
      db.updateAlertStatus(id, 'CLOSED');
      setAlertUpdate(prev => prev + 1);
  };

  const runStressTest = () => {
      const result = clearingHouse.runStressTest(0.20); // 20% crash
      setStressResult(result);
  };

  const generateInvoices = () => {
      const invs = backOfficeService.generateMonthlyInvoices();
      setInvoices(invs);
  };

  const runFixing = () => {
      if(user && gateway) {
          try {
             const res = gateway.routeFixing(user);
             setFixingResult(res);
          } catch(e: any) {
              alert(e.message);
          }
      }
  };

  const runEOD = () => {
      if(user && gateway) {
          try {
              const batch = gateway.routeEOD(user);
              setEodBatch(batch);
          } catch(e: any) {
              alert(e.message);
          }
      }
  }

  if (!user) {
      return <Login onLoginSuccess={() => setUser(auth.getUser())} />;
  }

  // Permission Checks
  const hasPermission = (perm: string) => securityService.verifyPermission(user, perm);
  
  const canViewMarket = hasPermission('VIEW_MARKET');
  const canViewSRE = hasPermission('VIEW_SRE');
  const canConnectFix = hasPermission('CONNECT_FIX');
  const canViewRisk = hasPermission('VIEW_RISK');
  const canViewSurveillance = hasPermission('VIEW_SURVEILLANCE');
  const canViewBackOffice = hasPermission('VIEW_BACKOFFICE');
  const canSubmitOrders = hasPermission('ORDER_SUBMIT');
  const canKillSwitch = hasPermission('KILL_SWITCH');
  const canManageMarket = hasPermission('MANAGE_MARKET');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar */}
      <aside className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 z-20">
        <div className="mb-8 text-indigo-500 animate-pulse">
          <Hexagon size={32} strokeWidth={2.5} />
        </div>
        
        <nav className="flex flex-col gap-4 w-full">
          {canViewMarket && (
              <>
                 <NavItem icon={<LayoutDashboard size={20} />} active={view === ViewMode.DASHBOARD} onClick={() => setView(ViewMode.DASHBOARD)} label="Pro Dashboard" />
                 <NavItem icon={<Activity size={20} />} active={view === ViewMode.TRADING} onClick={() => setView(ViewMode.TRADING)} label="Classic View" />
              </>
          )}
          {canViewSRE && (
             <NavItem icon={<Layers size={20} />} active={view === ViewMode.SRE_REGISTRY} onClick={() => setView(ViewMode.SRE_REGISTRY)} label="SRE" />
          )}
          
          {canConnectFix && (
              <NavItem icon={<Terminal size={20} />} active={view === ViewMode.FIX_CONNECTIVITY} onClick={() => setView(ViewMode.FIX_CONNECTIVITY)} label="FIX API" />
          )}

          {canViewRisk && (
             <NavItem icon={<BarChart3 size={20} />} active={view === ViewMode.RISK_OPS} onClick={() => setView(ViewMode.RISK_OPS)} label="Risk/Audit" />
          )}
          {canViewSurveillance && (
             <NavItem icon={<Eye size={20} />} active={view === ViewMode.SURVEILLANCE} onClick={() => setView(ViewMode.SURVEILLANCE)} label="Surveillance" />
          )}
          {canViewBackOffice && (
              <NavItem icon={<FileBarChart size={20} />} active={view === ViewMode.BACK_OFFICE} onClick={() => setView(ViewMode.BACK_OFFICE)} label="Back-Office" />
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-4 items-center">
          <NavItem icon={<Settings size={20} />} onClick={() => setShowSystemStatus(!showSystemStatus)} label="System Status" />
          <button onClick={handleLogout} className="text-rose-400 hover:text-rose-300 p-2" title="Logout">
             <LogOut size={20} />
          </button>
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold shadow-lg shadow-indigo-500/20 cursor-pointer" title={user.role}>
            {user.username.substring(0, 2).toUpperCase()}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        
        {showSystemStatus && <SystemStatus />}

        {marketHalted && (
            <div className="bg-rose-600 text-white font-bold text-center py-1 px-4 text-xs tracking-widest uppercase animate-pulse shadow-lg z-50">
                ⚠ Market Halted - {ticker.status === MarketPhase.CIRCUIT_BREAKER_HALT ? "Volatility Circuit Breaker Active" : "Global Kill Switch Active"} ⚠
            </div>
        )}

        {/* Header (Only show in views other than Dashboard which has its own header) */}
        {view !== ViewMode.DASHBOARD && (
          <header className="h-14 bg-slate-900/50 backdrop-blur border-b border-slate-800 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <h1 className="font-bold text-lg tracking-tight text-white">CommoTrade <span className="text-indigo-400 font-light">Operational</span></h1>
              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                  {user.role}
              </span>
              
              {canSubmitOrders && (
                  <div className="flex items-center gap-3 px-3 py-1 bg-slate-900 rounded-lg border border-slate-800 ml-4">
                      <Wallet size={14} className="text-indigo-400" />
                      <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-bold">Free Margin</span>
                          <span className="text-xs font-mono text-white">${balance.free.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                       <div className="w-px h-6 bg-slate-800 mx-1"></div>
                       <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-bold">Total Equity</span>
                          <span className="text-xs font-mono text-emerald-400">${balance.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                  </div>
              )}
              
              {canKillSwitch && (
                  <button 
                      onClick={toggleKillSwitch}
                      className={`ml-4 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${riskEngine.isMarketHalted() ? 'bg-rose-600 text-white border-rose-500 shadow-rose-900/50 shadow-lg' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                  >
                      <Power size={14} />
                      {riskEngine.isMarketHalted() ? 'RESUME MARKET' : 'KILL SWITCH'}
                  </button>
              )}

              {canManageMarket && (
                   <div className="ml-2 flex items-center gap-2">
                       <button 
                          onClick={handleReplayToggle}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${isReplaying ? 'bg-amber-600 text-white border-amber-500 animate-pulse' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                      >
                          {isReplaying ? <StopCircle size={14} /> : <PlayCircle size={14} />}
                          {isReplaying ? 'STOP REPLAY' : 'MARKET REPLAY'}
                      </button>
                      {isReplaying && (
                          <div className="flex bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                              {[1, 5, 10].map(s => (
                                  <button 
                                      key={s}
                                      onClick={() => handleReplaySpeedChange(s)}
                                      className={`px-2 py-1 text-[10px] font-bold ${replaySpeed === s ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                                  >
                                      {s}x
                                  </button>
                              ))}
                          </div>
                      )}
                   </div>
              )}

              <div className="h-4 w-px bg-slate-700 mx-2"></div>
              
              <div className="flex gap-6 overflow-hidden mask-linear-fade text-xs font-mono">
                <div className="flex gap-2 items-center min-w-max cursor-pointer bg-slate-800 px-3 py-1 rounded border border-indigo-500/30">
                    <span className="font-bold text-white">XAU/USD</span>
                    <span className={ticker.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {ticker.price.toFixed(2)}
                    </span>
                    {ticker.status !== MarketPhase.CONTINUOUS_TRADING && (
                        <span className="text-[10px] px-1 bg-amber-500/20 text-amber-500 rounded">{ticker.status}</span>
                    )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
                  <Wifi size={10} /> Fully Operational
                </span>
                <span className="text-[10px] text-slate-600 font-mono">Modules 1-12 Active</span>
              </div>
            </div>
          </header>
        )}

        {/* Dynamic View Content */}
        <div className="flex-1 overflow-hidden relative">
          
          {view === ViewMode.DASHBOARD && (
            <TraderDashboard 
              user={user}
              ticker={ticker}
              chartData={chartData}
              orderBook={orderBook}
              recentTrades={recentTrades}
              position={position}
              balance={balance}
              onOrderSubmit={handleOrderSubmit}
            />
          )}

          {view === ViewMode.TRADING && (
            <div className="grid grid-cols-12 grid-rows-12 gap-1 p-2 h-full">
              <div className="col-span-12 md:col-span-8 lg:col-span-8 row-span-7 bg-slate-900 rounded-lg">
                <MarketChart data={chartData} />
              </div>
              <div className="col-span-12 md:col-span-4 lg:col-span-2 row-span-7">
                <OrderBook bids={orderBook.bids} asks={orderBook.asks} currentPrice={ticker.price} />
              </div>
              <div className="col-span-12 md:col-span-4 lg:col-span-2 row-span-7">
                <RecentTrades trades={recentTrades} />
              </div>
              <div className="col-span-12 md:col-span-8 lg:col-span-5 row-span-5">
                <PositionTable position={position} />
              </div>
              <div className="col-span-12 md:col-span-4 lg:col-span-2 row-span-5">
                 <OpenOrders />
              </div>
               <div className="col-span-12 md:col-span-4 lg:col-span-2 row-span-5">
                <AIAnalysis ticker={ticker} marketTrend={chartData.map(d => d.close)} />
              </div>
              <div className="col-span-12 md:col-span-4 lg:col-span-3 row-span-5 relative">
                {canSubmitOrders && !marketHalted ? (
                    <OrderEntry currentPrice={ticker.price} onSubmit={handleOrderSubmit} />
                ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-lg h-full flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                        <ShieldAlert size={32} className="mb-2 opacity-50" />
                        <h3 className="font-bold text-slate-400">Trading Restricted</h3>
                        <p className="text-xs">
                            {marketHalted ? "Market Halted (Risk/Volatility)." : `Your role (${user.role}) is not authorized.`}
                        </p>
                    </div>
                )}
              </div>
            </div>
          )}

          {view === ViewMode.SRE_REGISTRY && <SRECertificates />}
          
          {view === ViewMode.FIX_CONNECTIVITY && <FixTerminal />}

          {view === ViewMode.SURVEILLANCE && (
              <div className="h-full bg-slate-950 p-6 overflow-y-auto">
                 <div className="max-w-6xl mx-auto">
                     {/* Surveillance Logic ... */}
                     <div className="flex justify-between items-center mb-6">
                         <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                             <Eye className="text-amber-500" /> Market Surveillance
                         </h2>
                         <div className="px-3 py-1 bg-amber-900/20 border border-amber-900/50 text-amber-500 text-xs rounded-full font-mono animate-pulse">
                             Detection Engine Active
                         </div>
                     </div>
                     {/* ... Existing Surveillance Table ... */}
                     <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-950 text-slate-200">
                                <tr>
                                    <th className="p-4">Time</th>
                                    <th className="p-4">Severity</th>
                                    <th className="p-4">Alert Type</th>
                                    <th className="p-4">Target Entity</th>
                                    <th className="p-4">Details</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {db.getSurveillanceAlerts().length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center italic text-slate-600">No active alerts. Market behavior is normal.</td></tr>
                                ) : (
                                    db.getSurveillanceAlerts().slice().reverse().map((alert) => (
                                    <tr key={alert.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                        <td className="p-4 font-mono text-xs">{new Date(alert.timestamp).toLocaleTimeString()}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                alert.severity === 'HIGH' || alert.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'
                                            }`}>
                                                {alert.severity}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold text-white">{alert.type}</td>
                                        <td className="p-4 font-mono text-xs text-indigo-400">{alert.targetUserId}</td>
                                        <td className="p-4 max-w-md truncate" title={alert.details}>{alert.details}</td>
                                        <td className="p-4 text-xs font-bold">
                                            <span className={alert.status === 'CLOSED' ? 'text-emerald-500' : 'text-amber-500'}>
                                                {alert.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {alert.status === 'OPEN' && (
                                                <button onClick={() => handleResolveAlert(alert.id)} className="text-xs bg-slate-800 hover:bg-emerald-900/50 hover:text-emerald-400 border border-slate-700 px-2 py-1 rounded transition-colors">
                                                    RESOLVE
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                 </div>
              </div>
          )}

          {view === ViewMode.BACK_OFFICE && (
              <div className="h-full bg-slate-950 p-6 overflow-y-auto">
                  <div className="max-w-6xl mx-auto">
                      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                          <Landmark className="text-indigo-500" /> Back-Office & Reporting
                      </h2>

                      {/* EXCHANGE OPERATIONS CONTROL PANEL */}
                      {(canManageMarket) && (
                          <div className="grid grid-cols-2 gap-6 mb-8">
                               <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 flex flex-col gap-4">
                                   <div className="flex justify-between items-center">
                                       <h3 className="font-bold text-white flex items-center gap-2"><Gavel size={18} /> Daily Fixing</h3>
                                       <button onClick={runFixing} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded text-sm font-bold shadow-lg">Run Fixing Auction</button>
                                   </div>
                                   {fixingResult && (
                                       <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs font-mono">
                                           <div className="text-amber-500 font-bold mb-1">OFFICIAL FIXING PUBLISHED</div>
                                           <div>Price: {fixingResult.fixingPrice}</div>
                                           <div>Vol: {fixingResult.volumeProcessed}</div>
                                           <div className="text-slate-500">Algo: {fixingResult.algorithm}</div>
                                       </div>
                                   )}
                               </div>
                               
                               <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 flex flex-col gap-4">
                                   <div className="flex justify-between items-center">
                                       <h3 className="font-bold text-white flex items-center gap-2"><Scale size={18} /> EOD Settlement</h3>
                                       <button onClick={runEOD} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-bold shadow-lg">Run Netting Batch</button>
                                   </div>
                                    {eodBatch && (
                                       <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs font-mono">
                                           <div className="text-indigo-500 font-bold mb-1">BATCH {eodBatch.id} COMPLETED</div>
                                           <div>Settled: ${eodBatch.totalSettled.toFixed(2)}</div>
                                           <div>Accounts Processed: {eodBatch.netObligations.length}</div>
                                       </div>
                                   )}
                               </div>
                          </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                          {/* Key Stats */}
                          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
                              <div className="text-slate-500 text-xs uppercase font-bold mb-2">Total Volume (24h)</div>
                              <div className="text-2xl font-mono text-white">${dailyReport.totalVolume.toLocaleString()}</div>
                          </div>
                           <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
                              <div className="text-slate-500 text-xs uppercase font-bold mb-2">Exchange Fees Collected</div>
                              <div className="text-2xl font-mono text-emerald-400">${dailyReport.totalFeesCollected.toFixed(2)}</div>
                          </div>
                           <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
                              <div className="text-slate-500 text-xs uppercase font-bold mb-2">Active Traders</div>
                              <div className="text-2xl font-mono text-indigo-400">{dailyReport.activeTraders}</div>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Daily Report */}
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                            <h3 className="text-lg font-bold text-slate-300 mb-4">Daily Reconciliation Report</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                    <span className="text-slate-500">Report Date</span>
                                    <span className="text-white">{dailyReport.date}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                    <span className="text-slate-500">Total Trades Executed</span>
                                    <span className="text-white">{dailyReport.totalTrades}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-800 pb-2">
                                    <span className="text-slate-500">Exchange Revenue Account</span>
                                    <span className="text-emerald-500 font-mono">${backOfficeService.getExchangeRevenue().toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="mt-6">
                                <button 
                                    onClick={() => window.print()}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                                >
                                    Export to PDF (Regulator Format)
                                </button>
                            </div>
                        </div>

                        {/* Invoicing Section (Module 12) */}
                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-slate-300">Member Invoicing</h3>
                                <button onClick={generateInvoices} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded border border-slate-700">Generate Cycle</button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {invoices.length === 0 && <p className="text-xs text-slate-500">No invoices generated for this period.</p>}
                                {invoices.map(inv => (
                                    <div key={inv.id} className="flex justify-between items-center p-2 bg-slate-950 rounded border border-slate-800">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white">{inv.id}</span>
                                            <span className="text-[10px] text-slate-500">Vol: ${inv.tradingVolume.toLocaleString()}</span>
                                        </div>
                                        <span className="text-xs font-mono text-indigo-400">${inv.totalFees.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                      </div>

                      {/* SWIFT Messages (Module 9) */}
                      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-lg p-6">
                          <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                              <Globe size={16} /> SWIFT Settlement Messages (MT103)
                          </h3>
                           <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs text-slate-400 font-mono">
                                    <thead className="bg-slate-950 text-slate-300 border-b border-slate-800">
                                        <tr>
                                            <th className="p-2">Message Ref</th>
                                            <th className="p-2">Sender BIC</th>
                                            <th className="p-2">Receiver BIC</th>
                                            <th className="p-2">Amount</th>
                                            <th className="p-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {settlementService.getSwiftMessages().map(msg => (
                                            <tr key={msg.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                                <td className="p-2">{msg.reference}</td>
                                                <td className="p-2">{msg.senderBic}</td>
                                                <td className="p-2">{msg.receiverBic}</td>
                                                <td className="p-2 text-white">{msg.amount.toFixed(2)} {msg.currency}</td>
                                                <td className="p-2 text-emerald-500">{msg.status}</td>
                                            </tr>
                                        ))}
                                        {settlementService.getSwiftMessages().length === 0 && (
                                            <tr><td colSpan={5} className="p-4 text-center text-slate-600">No settlement messages generated yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                           </div>
                      </div>
                  </div>
              </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Helper for Sidebar items
const NavItem: React.FC<{ icon: React.ReactNode, active?: boolean, onClick: () => void, label: string }> = ({ icon, active, onClick, label }) => (
  <button 
    onClick={onClick}
    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}
  >
    {icon}
    <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-700 z-50">
      {label}
    </span>
  </button>
);

export default App;
