import { Trade, OrderSide, Position, StressTestResult, SettlementBatch } from '../types';
import { db } from './DatabaseService';

// Module 8: Clearing House
// "Novation, Margining, Netting, Stress Testing"
class ClearingHouse {
    
    public processTrade(trade: Trade) {
        // console.log(`[ClearingHouse] Processing Novation for Trade ${trade.id}`);
        // Logic remains same as previous implementation for novation...
        if (trade.buyerUserId) {
            this.updateAccount(trade.buyerUserId, trade, OrderSide.BUY);
        }

        if (trade.sellerUserId) {
            this.updateAccount(trade.sellerUserId, trade, OrderSide.SELL);
        }
    }

    private updateAccount(userId: string, trade: Trade, side: OrderSide) {
        const pos = db.getPosition(userId, trade.symbol);
        const signedTradeSize = side === OrderSide.BUY ? trade.size : -trade.size;
        const totalCost = (pos.size * pos.averageEntryPrice) + (signedTradeSize * trade.price);
        const newSize = pos.size + signedTradeSize;
        
        if ((pos.size > 0 && signedTradeSize < 0) || (pos.size < 0 && signedTradeSize > 0)) {
            const closingSize = Math.min(Math.abs(pos.size), Math.abs(signedTradeSize));
            const pnl = (trade.price - pos.averageEntryPrice) * closingSize * (pos.size > 0 ? 1 : -1);
            pos.realizedPnl += pnl;
            const balance = db.getBalance(userId);
            db.updateBalance(userId, {
                free: balance.free + pnl,
                total: balance.total + pnl
            });
            db.logAudit(userId, 'CLEARING_PNL', `Realized PnL: ${pnl.toFixed(2)} on ${trade.symbol}`);
        }

        if (newSize === 0) {
            pos.averageEntryPrice = 0;
        } else if ((pos.size >= 0 && newSize > 0) || (pos.size <= 0 && newSize < 0)) {
             pos.averageEntryPrice = Math.abs(totalCost / newSize);
        }
        if (Math.sign(pos.size) !== Math.sign(newSize) && pos.size !== 0 && newSize !== 0) {
             pos.averageEntryPrice = trade.price;
        }

        pos.size = newSize;
        db.savePosition(pos);
    }

    // --- STRESS TESTING (IOSCO Principle) ---
    public runStressTest(priceDropPercentage: number): StressTestResult {
        const users = db.getUsers();
        const affectedUsers: { userId: string, shortfall: number }[] = [];
        let totalSystemShortfall = 0;

        users.forEach(user => {
            const pos = db.getPosition(user.id, 'XAU/USD');
            const balance = db.getBalance(user.id);
            
            if (pos.size > 0) {
                // Scenario: Price Crashes
                const simulatedPrice = pos.markPrice * (1 - priceDropPercentage);
                const simulatedPnL = (simulatedPrice - pos.averageEntryPrice) * pos.size;
                const equity = balance.total + simulatedPnL;

                if (equity < 0) {
                    affectedUsers.push({ userId: user.username, shortfall: Math.abs(equity) });
                    totalSystemShortfall += Math.abs(equity);
                }
            }
        });

        db.logAudit('SYSTEM', 'STRESS_TEST', `Ran scenario -${(priceDropPercentage*100)}%. System Shortfall: $${totalSystemShortfall.toFixed(2)}`);
        
        return {
            scenarioName: `Market Crash -${(priceDropPercentage*100)}%`,
            affectedUsers,
            totalSystemShortfall,
            timestamp: Date.now()
        };
    }

    // --- END OF DAY NETTING ---
    public runEndOfDayProcess(): SettlementBatch {
        const users = db.getUsers();
        const netObligations: { userId: string; amount: number }[] = [];
        let totalSettled = 0;

        // Simplified Netting: Net Realized PnL + Open PnL Mark-to-Market Settlement
        // In real life, we net payables vs receivables across all instruments
        users.forEach(user => {
            const pos = db.getPosition(user.id, 'XAU/USD');
            // Check realized PnL from trades today (simplified by just checking Free balance changes in simulation, 
            // but here we calculate based on positions)
            
            // Mark-to-Market Settlement
            if (pos.unrealizedPnl !== 0) {
                // In daily settlement, we realize the UPL daily to reset cost basis
                // For this simulation, we just report the net equity position change
                netObligations.push({
                    userId: user.username,
                    amount: pos.unrealizedPnl
                });
                totalSettled += Math.abs(pos.unrealizedPnl);
            }
        });

        return {
            id: `EOD-${new Date().toISOString().split('T')[0]}`,
            date: new Date().toISOString(),
            netObligations,
            totalSettled,
            status: 'COMPLETED'
        };
    }
}

export const clearingHouse = new ClearingHouse();