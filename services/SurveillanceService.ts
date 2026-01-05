import { Trade, Order, SurveillanceAlert, User } from '../types';
import { db } from './DatabaseService';

// Module 11: Surveillance & Advanced Risk
// Detects Wash Trades, Layering, and Spoofing
class SurveillanceService {
    
    public analyzeTrade(trade: Trade) {
        // 1. Wash Trade Detection (Self-Match)
        // Note: Matching engine prevents self-match for liquidity, but if different accounts belong to same firm/group:
        if (trade.buyerUserId && trade.sellerUserId) {
             const buyer = db.getUserById(trade.buyerUserId);
             const seller = db.getUserById(trade.sellerUserId);
             
             if (buyer && seller && buyer.firm === seller.firm && buyer.firm !== 'Exchange MM') {
                 this.raiseAlert({
                     id: `ALRT-${Date.now()}`,
                     timestamp: Date.now(),
                     type: 'WASH_TRADE',
                     severity: 'HIGH',
                     targetUserId: buyer.firm, // Target the firm
                     details: `Potential Wash Trade detected between ${buyer.username} and ${seller.username} (Same Firm) on trade ${trade.id}`,
                     status: 'OPEN'
                 });
             }
        }
    }

    public analyzeOrderPattern(userId: string, orders: Order[]) {
        // 2. Layering/Spoofing Detection
        // Look for multiple orders on one side followed by a cancellation
        const recentOrders = orders.filter(o => Date.now() - o.timestamp < 10000); // Last 10 seconds
        const cancelled = recentOrders.filter(o => o.status === 'CANCELLED');
        
        if (recentOrders.length > 5 && cancelled.length > 3) {
            this.raiseAlert({
                id: `ALRT-Layer-${Date.now()}`,
                timestamp: Date.now(),
                type: 'LAYERING',
                severity: 'MEDIUM',
                targetUserId: userId,
                details: `High frequency order entry and cancellation detected for user ${userId}`,
                status: 'OPEN'
            });
        }
    }

    private raiseAlert(alert: SurveillanceAlert) {
        console.warn(`[Surveillance] ${alert.type}: ${alert.details}`);
        db.saveSurveillanceAlert(alert);
    }
}

export const surveillanceService = new SurveillanceService();