import { Trade, DailyReport, User, Invoice } from '../types';
import { db } from './DatabaseService';

// Module 12: Back-Office & Reporting
// Handles Facturation, Fees, Regulatory Reporting, and Accounting
class BackOfficeService {
    private readonly EXCHANGE_FEE_BPS = 2; // 2 basis points (0.02%)
    private exchangeRevenueAccount: number = 0;
    private invoices: Invoice[] = [];

    public calculateAndCollectFee(trade: Trade): number {
        const notional = trade.price * trade.size;
        const fee = notional * (this.EXCHANGE_FEE_BPS / 10000);
        
        // Deduct from User Balances (Real-time Fee Collection)
        if(trade.buyerUserId) {
            const b = db.getBalance(trade.buyerUserId);
            db.updateBalance(trade.buyerUserId, { free: b.free - fee, total: b.total - fee });
        }
        if(trade.sellerUserId) {
            const s = db.getBalance(trade.sellerUserId);
            db.updateBalance(trade.sellerUserId, { free: s.free - fee, total: s.total - fee });
        }

        this.exchangeRevenueAccount += fee * 2; // Charged to both sides
        
        db.logAudit('SYSTEM', 'FEE_COLLECTION', `Collected $${(fee*2).toFixed(2)} on Trade ${trade.id}`);
        return fee;
    }

    public generateDailyReport(): DailyReport {
        const trades = db.getAllTrades();
        // Filter for "today" (last 24h simulation)
        const today = Date.now() - 86400000;
        const recentTrades = trades.filter(t => t.timestamp > today);

        const totalVolume = recentTrades.reduce((acc, t) => acc + (t.price * t.size), 0);
        const uniqueTraders = new Set([...recentTrades.map(t => t.buyerUserId), ...recentTrades.map(t => t.sellerUserId)]).size;

        return {
            date: new Date().toISOString().split('T')[0],
            totalVolume,
            totalTrades: recentTrades.length,
            totalFeesCollected: totalVolume * (this.EXCHANGE_FEE_BPS / 10000) * 2,
            activeTraders: uniqueTraders,
            incidents: db.getSurveillanceAlerts().length
        };
    }

    public generateMonthlyInvoices(): Invoice[] {
        const users = db.getUsers();
        const trades = db.getAllTrades();
        const now = Date.now();
        const startOfMonth = now - (30 * 24 * 60 * 60 * 1000);

        this.invoices = [];

        users.forEach(user => {
            const userTrades = trades.filter(t => 
                (t.buyerUserId === user.id || t.sellerUserId === user.id) && 
                t.timestamp >= startOfMonth
            );

            if (userTrades.length > 0) {
                const vol = userTrades.reduce((acc, t) => acc + (t.price * t.size), 0);
                const fees = vol * (this.EXCHANGE_FEE_BPS / 10000); // Simple fee logic
                
                this.invoices.push({
                    id: `INV-${new Date().getFullYear()}-${user.username.toUpperCase()}`,
                    userId: user.id,
                    periodStart: startOfMonth,
                    periodEnd: now,
                    tradingVolume: vol,
                    totalFees: fees,
                    status: 'PENDING',
                    generatedAt: now
                });
            }
        });

        return this.invoices;
    }

    public getInvoices(): Invoice[] {
        return this.invoices;
    }

    public getExchangeRevenue(): number {
        return this.exchangeRevenueAccount;
    }
}

export const backOfficeService = new BackOfficeService();