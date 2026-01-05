
import { User, UserRole, Order, Trade, Position, WarehouseReceipt, AuditLog, AccountBalance, SurveillanceAlert, BlockchainTransaction, SREStatus } from '../types';

// Initial Seed Data
const SEED_USERS: User[] = [
  { id: 'u1', username: 'trader1', passwordHash: 'pass', role: UserRole.TRADER, fullName: 'John Trader', firm: 'Alpha Capital', status: 'ACTIVE' },
  { id: 'u2', username: 'broker1', passwordHash: 'pass', role: UserRole.BROKER, fullName: 'Sarah Broker', firm: 'Prime Brokerage Ltd', status: 'ACTIVE' },
  { id: 'u3', username: 'risk1', passwordHash: 'pass', role: UserRole.RISK_MGR, fullName: 'Mike Risk', firm: 'CommoTrade Exchange', status: 'ACTIVE' },
  { id: 'u4', username: 'reg1', passwordHash: 'pass', role: UserRole.REGULATOR, fullName: 'Jane Regulator', firm: 'CFTC Node', status: 'ACTIVE' },
  { id: 'u5', username: 'wh1', passwordHash: 'pass', role: UserRole.WAREHOUSE_OPS, fullName: 'Bob Warehouse', firm: 'Rotterdam Port', status: 'ACTIVE' },
  { id: 'u6', username: 'staff1', passwordHash: 'pass', role: UserRole.EXCHANGE_STAFF, fullName: 'Admin Staff', firm: 'CommoTrade Operations', status: 'ACTIVE' },
  { id: 'u7', username: 'registry1', passwordHash: 'pass', role: UserRole.REGISTRY_MGR, fullName: 'Alice Registry', firm: 'Central Registry Authority', status: 'ACTIVE' },
  { id: 'market_maker_bot', username: 'mm_bot', passwordHash: 'secure', role: UserRole.EXCHANGE_STAFF, fullName: 'Liquidity Provider', firm: 'Exchange MM', status: 'ACTIVE' },
];

const SEED_RECEIPTS: WarehouseReceipt[] = [
  { id: 'WR-2024-001', commodity: 'Cocoa Beans', grade: 'Grade A', quantity: 50, location: 'Abidjan WH-01', status: SREStatus.VALID, ownerHash: 'u1', createdBy: 'u5', approvedBy: 'u7', timestamp: Date.now(), txHash: '0xabc...' },
  { id: 'WR-2024-004', commodity: 'Gold Bullion', grade: '999.9 Fine', quantity: 100, location: 'London Vault', status: SREStatus.VALID, ownerHash: 'u2', createdBy: 'u5', approvedBy: 'u7', timestamp: Date.now(), txHash: '0xdef...' },
];

const SEED_BALANCES: Record<string, AccountBalance> = {
    'u1': { userId: 'u1', currency: 'USD', free: 100000, locked: 0, total: 100000, dailyLoss: 0 },
    'u2': { userId: 'u2', currency: 'USD', free: 500000, locked: 0, total: 500000, dailyLoss: 0 },
    'market_maker_bot': { userId: 'market_maker_bot', currency: 'USD', free: 100000000, locked: 0, total: 100000000, dailyLoss: 0 }
};

class DatabaseService {
  private users: User[] = [];
  private orders: Order[] = [];
  private trades: Trade[] = [];
  private positions: Record<string, Position> = {};
  private balances: Record<string, AccountBalance> = {};
  private receipts: WarehouseReceipt[] = [];
  private auditLogs: AuditLog[] = [];
  private alerts: SurveillanceAlert[] = [];
  private blockchainTxs: BlockchainTransaction[] = [];

  constructor() {
    this.load();
  }

  private load() {
    const loadItem = (key: string, defaultVal: any) => {
      const stored = localStorage.getItem(`ct_${key}`);
      return stored ? JSON.parse(stored) : defaultVal;
    };

    this.users = loadItem('users', SEED_USERS);
    this.orders = loadItem('orders', []);
    this.trades = loadItem('trades', []);
    this.positions = loadItem('positions', {});
    this.balances = loadItem('balances', SEED_BALANCES);
    this.receipts = loadItem('receipts', SEED_RECEIPTS);
    this.auditLogs = loadItem('auditLogs', []);
    this.alerts = loadItem('alerts', []);
    this.blockchainTxs = loadItem('blockchainTxs', []);
  }

  private save(key: string, data: any) {
    localStorage.setItem(`ct_${key}`, JSON.stringify(data));
  }

  // --- Users ---
  getUserByUsername(username: string): User | undefined {
    return this.users.find(u => u.username === username);
  }

  getUserById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getUsers(): User[] {
    return this.users;
  }

  // --- Financials ---
  getBalance(userId: string): AccountBalance {
    if (!this.balances[userId]) {
        this.balances[userId] = { userId, currency: 'USD', free: 0, locked: 0, total: 0, dailyLoss: 0 };
    }
    return this.balances[userId];
  }

  updateBalance(userId: string, updates: Partial<AccountBalance>) {
    const balance = this.getBalance(userId);
    Object.assign(balance, updates);
    balance.total = balance.free + balance.locked;
    this.balances[userId] = balance;
    this.save('balances', this.balances);
  }

  // --- Orders ---
  saveOrder(order: Order) {
    this.orders.push(order);
    this.save('orders', this.orders);
    this.logAudit(order.userId, 'ORDER_SUBMIT', `Order ${order.id} submitted: ${order.side} ${order.size} ${order.symbol}`);
  }

  getOrder(id: string): Order | undefined {
    return this.orders.find(o => o.id === id);
  }

  updateOrder(order: Order) {
    const idx = this.orders.findIndex(o => o.id === order.id);
    if (idx !== -1) {
        this.orders[idx] = order;
        this.save('orders', this.orders);
    }
  }
  
  getOrdersByUser(userId: string): Order[] {
      return this.orders.filter(o => o.userId === userId);
  }

  // --- Trades ---
  recordTrade(trade: Trade) {
    this.trades.push(trade);
    this.save('trades', this.trades);
  }

  getAllTrades(): Trade[] {
    return this.trades;
  }

  // --- Positions ---
  getPosition(userId: string, symbol: string): Position {
    const key = `${userId}_${symbol}`;
    if (!this.positions[key]) {
       this.positions[key] = {
        userId, symbol, size: 0, averageEntryPrice: 0, 
        markPrice: 0, unrealizedPnl: 0, realizedPnl: 0, marginUsed: 0
      };
    }
    return this.positions[key];
  }

  savePosition(position: Position) {
    const key = `${position.userId}_${position.symbol}`;
    this.positions[key] = position;
    this.save('positions', this.positions);
  }

  // --- SRE / Receipts ---
  createReceipt(receipt: WarehouseReceipt) {
    this.receipts.push(receipt);
    this.save('receipts', this.receipts);
    this.logAudit(receipt.createdBy, 'RECEIPT_MINT', `Minted WR ${receipt.id}`);
  }

  getReceipts(): WarehouseReceipt[] {
    return this.receipts;
  }

  getReceipt(id: string): WarehouseReceipt | undefined {
      return this.receipts.find(r => r.id === id);
  }

  updateReceipt(receipt: WarehouseReceipt) {
      const idx = this.receipts.findIndex(r => r.id === receipt.id);
      if (idx !== -1) {
          this.receipts[idx] = receipt;
          this.save('receipts', this.receipts);
      }
  }
  
  saveBlockchainTx(tx: BlockchainTransaction) {
      this.blockchainTxs.push(tx);
      this.save('blockchainTxs', this.blockchainTxs);
  }
  
  getBlockchainTxs(): BlockchainTransaction[] {
      return this.blockchainTxs;
  }

  // --- Surveillance ---
  saveSurveillanceAlert(alert: SurveillanceAlert) {
      this.alerts.push(alert);
      this.save('alerts', this.alerts);
  }

  getSurveillanceAlerts(): SurveillanceAlert[] {
      return this.alerts;
  }

  updateAlertStatus(alertId: string, status: SurveillanceAlert['status']) {
      const idx = this.alerts.findIndex(a => a.id === alertId);
      if(idx !== -1) {
          this.alerts[idx].status = status;
          this.save('alerts', this.alerts);
      }
  }

  // --- Audit ---
  logAudit(actorId: string, action: string, details: string, signature?: string) {
    const log: AuditLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      actorId,
      action,
      details,
      signature
    };
    this.auditLogs.unshift(log);
    this.save('auditLogs', this.auditLogs);
  }

  getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }
}

export const db = new DatabaseService();
