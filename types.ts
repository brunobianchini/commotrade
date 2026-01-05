
export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
  STOP = 'STOP',
  TRAILING_STOP = 'TRAILING_STOP',
  OCO = 'OCO' // One Cancels Other
}

export enum TimeInForce {
  DAY = 'DAY',
  GTC = 'GTC', // Good Till Cancel
  IOC = 'IOC', // Immediate or Cancel
  FOK = 'FOK'  // Fill or Kill
}

export enum MarketPhase {
  PRE_OPEN = 'PRE_OPEN',
  OPEN_AUCTION = 'OPEN_AUCTION',
  CONTINUOUS_TRADING = 'CONTINUOUS_TRADING',
  CIRCUIT_BREAKER_HALT = 'CIRCUIT_BREAKER_HALT',
  CLOSE_AUCTION = 'CLOSE_AUCTION',
  CLOSED = 'CLOSED',
  FIXING = 'FIXING' // New Phase for Daily Fixing
}

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  size: number;
  remainingSize: number;
  timestamp: number;
  status: 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED';
  rejectionReason?: string;
  // Advanced Order Attributes
  icebergVisibleSize?: number;
  trailingDistance?: number; // For Trailing Stop
  ocoGroupId?: string; // Links OCO legs
  stopPrice?: number; // Trigger price for STOP/OCO
}

export interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
  orderCount: number;
}

export interface Trade {
  id: string;
  symbol: string;
  price: number;
  size: number;
  side: OrderSide;
  timestamp: number;
  makerOrderId?: string;
  takerOrderId?: string;
  buyerUserId?: string; // For settlement
  sellerUserId?: string; // For settlement
  fee?: number; // Transaction fee
}

export interface AccountBalance {
  userId: string;
  currency: string;
  free: number;
  locked: number; // Margin or active orders
  total: number;
  dailyLoss: number; // For Risk Mgmt
}

export interface Position {
  userId: string;
  symbol: string;
  size: number;
  averageEntryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  marginUsed: number;
}

export enum SREStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL', // Created by Operator, waiting for Registry Mgr
  VALID = 'VALID',                       // Tradable / Good for Delivery
  PLEDGED = 'PLEDGED',                   // Locked for collateral
  DELIVERY_REQUESTED = 'DELIVERY_REQUESTED', // Owner asked for physical load-out
  DELIVERED = 'DELIVERED',               // Physical load-out complete (Burned)
  SPLIT = 'SPLIT'                        // Parent receipt invalid after split
}

export interface WarehouseReceipt {
  id: string;
  commodity: string;
  grade: string;
  quantity: number;
  location: string;
  status: SREStatus;
  ownerHash: string; // Map to User ID in this system
  createdBy: string; // Warehouse Operator ID
  approvedBy?: string; // Registry Manager ID
  timestamp: number;
  txHash: string; // Blockchain Transaction Hash
  parentId?: string; // For lineage
}

export interface BlockchainTransaction {
  hash: string;
  receiptId: string;
  from: string;
  to: string;
  action: 'MINT' | 'APPROVE' | 'TRANSFER' | 'PLEDGE' | 'UNPLEDGE' | 'REQUEST_DELIVERY' | 'DELIVERED' | 'SPLIT';
  timestamp: number;
  blockNumber: number;
}

export interface MarketTicker {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  status: MarketPhase;
}

// --- NEW AUTH & ROLE TYPES ---

export enum UserRole {
  TRADER = 'TRADER',
  BROKER = 'BROKER',
  EXCHANGE_STAFF = 'EXCHANGE_STAFF',
  REGULATOR = 'REGULATOR',
  WAREHOUSE_OPS = 'WAREHOUSE_OPS',
  REGISTRY_MGR = 'REGISTRY_MGR',
  RECONCILIATION = 'RECONCILIATION',
  RISK_MGR = 'RISK_MGR'
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  fullName: string;
  firm: string;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface AuditLog {
  id: string;
  timestamp: number;
  actorId: string;
  action: string;
  details: string;
  ipAddress?: string;
  signature?: string; // New: HSM Signature
}

export interface SurveillanceAlert {
  id: string;
  timestamp: number;
  type: 'WASH_TRADE' | 'LAYERING' | 'PRICE_MANIPULATION' | 'SPOOFING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  targetUserId: string;
  details: string;
  status: 'OPEN' | 'INVESTIGATING' | 'CLOSED';
}

export interface DailyReport {
  date: string;
  totalVolume: number;
  totalTrades: number;
  totalFeesCollected: number;
  activeTraders: number;
  incidents: number;
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD', // New Aggregated View
  TRADING = 'TRADING',
  SRE_REGISTRY = 'SRE_REGISTRY',
  RISK_OPS = 'RISK_OPS',
  SURVEILLANCE = 'SURVEILLANCE',
  BACK_OFFICE = 'BACK_OFFICE',
  FIX_CONNECTIVITY = 'FIX_CONNECTIVITY'
}

// --- NEW GO-LIVE TYPES ---

export interface SystemHealth {
  clusterStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  activeNodes: number;
  networkLatency: number; // in ms
  matchingEngineThroughput: number; // orders per second
  ptpSyncStatus: 'SYNCED' | 'DRIFT'; // Precision Time Protocol
  lastHeartbeat: number;
}

export interface Invoice {
  id: string;
  userId: string;
  periodStart: number;
  periodEnd: number;
  tradingVolume: number;
  totalFees: number;
  status: 'PENDING' | 'PAID';
  generatedAt: number;
}

export interface StressTestResult {
  scenarioName: string;
  affectedUsers: { userId: string, shortfall: number }[];
  totalSystemShortfall: number;
  timestamp: number;
}

export interface SwiftMessage {
  id: string;
  type: 'MT103' | 'MT202';
  senderBic: string;
  receiverBic: string;
  amount: number;
  currency: string;
  reference: string;
  timestamp: number;
  status: 'SENT' | 'ACKNOWLEDGED';
}

export interface FixingResult {
    symbol: string;
    fixingPrice: number;
    volumeProcessed: number;
    timestamp: number;
    algorithm: 'VWAP' | 'AUCTION';
}

export interface SettlementBatch {
    id: string;
    date: string;
    netObligations: { userId: string; amount: number }[]; // Positive = Receivable, Negative = Payable
    totalSettled: number;
    status: 'PENDING' | 'COMPLETED';
}
