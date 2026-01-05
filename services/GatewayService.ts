import { User, Order, Trade } from '../types';
import { securityService } from './SecurityService';
import { db } from './DatabaseService';
import { riskEngine } from './RiskEngine';
import { MatchingEngine } from './MatchingEngine';
import { clearingHouse } from './ClearingHouse';
import { settlementService } from './SettlementService';
import { surveillanceService } from './SurveillanceService';
import { backOfficeService } from './BackOfficeService';

// Module 2: API Gateway & IAM
// Acts as the single entry point for all frontend requests.
// Enforces Authentication, Rate Limiting, RBAC, and Audit Logging.
class GatewayService {
    // We inject the matching engine here (acting as the Core Service downstream)
    private matchingEngine: MatchingEngine;

    constructor(engine: MatchingEngine) {
        this.matchingEngine = engine;
    }

    // --- ROUTING: Order Management ---
    public async routeOrderSubmission(order: Order, user: User): Promise<Trade[]> {
        // 1. IAM & Security Layer
        this.enforceSecurity(user, 'ORDER_SUBMIT');

        try {
            // 2. Pre-Trade Risk Layer (Module 4)
            riskEngine.validateOrder(order, user);

            // 3. Persistence (OMS)
            db.saveOrder(order);

            // 4. Core Trading Layer (Module 5)
            const trades = this.matchingEngine.processOrder(order);

            // 5. Post-Trade Processing (Async in real system, Sync here for consistency)
            if (trades.length > 0) {
                trades.forEach(t => this.processTradePostExecution(t, user, order));
                
                // Update Order Status
                order.status = 'FILLED';
                order.remainingSize = 0;
                db.updateOrder(order);
            }
            
            // 6. Surveillance (Module 11)
            const userOrders = db.getOrdersByUser(user.id);
            surveillanceService.analyzeOrderPattern(user.id, userOrders);
            
            // 7. Secure Audit Log (HSM Signed)
            const signature = securityService.signPayload(order, user.id);
            db.logAudit(user.id, 'ORDER_SUBMIT', `Order ${order.id} submitted. Sig: ${signature}`, signature);

            return trades;

        } catch (error: any) {
             // Handle Rejections
             db.logAudit(user.id, 'ORDER_REJECT', error.message);
             if (error.message.includes("Risk")) {
                 riskEngine.restoreMargin(order);
             }
             throw error;
        }
    }

    public async routeOrderCancellation(orderId: string, user: User) {
        this.enforceSecurity(user, 'ORDER_CANCEL');

        const order = db.getOrder(orderId);
        if (!order) throw new Error("Order not found");
        
        // RBAC Exception: Risk Managers can force cancel
        const isOwner = order.userId === user.id;
        const canForceCancel = securityService.verifyPermission(user, 'FORCE_CANCEL');

        if (!isOwner && !canForceCancel) throw new Error("Unauthorized to cancel this order");
        if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') throw new Error("Order already finished");

        // 1. Remove from Matching Engine
        const removedOrder = this.matchingEngine.cancelOrder(orderId);
        
        if (removedOrder) {
            // 2. Release Margin (Risk Engine)
            riskEngine.restoreMargin(removedOrder);

            // 3. Update OMS
            removedOrder.status = 'CANCELLED';
            db.updateOrder(removedOrder);
            
            const signature = securityService.signPayload({ action: 'CANCEL', orderId }, user.id);
            db.logAudit(user.id, 'ORDER_CANCEL', `Order ${orderId} cancelled.`, signature);
        } else {
            throw new Error("Order not found in matching engine (may have just filled).");
        }
    }

    public routeFixing(user: User) {
        this.enforceSecurity(user, 'RUN_FIXING');
        const result = this.matchingEngine.runFixing();
        const signature = securityService.signPayload(result, user.id);
        db.logAudit(user.id, 'MARKET_FIXING', `Official Price ${result.fixingPrice} set.`, signature);
        return result;
    }

    public routeEOD(user: User) {
        this.enforceSecurity(user, 'RUN_EOD');
        const batch = clearingHouse.runEndOfDayProcess();
        const signature = securityService.signPayload(batch, user.id);
        db.logAudit(user.id, 'EOD_NETTING', `EOD Batch ${batch.id} completed.`, signature);
        return batch;
    }

    // --- Internal Helpers ---

    private enforceSecurity(user: User, action: string) {
        if (!securityService.validateSession(user)) {
            throw new Error("Gateway: Invalid Session");
        }
        if (!securityService.checkRateLimit(user.id)) {
            throw new Error("Gateway: Rate limit exceeded");
        }
        if (!securityService.verifyPermission(user, action)) {
            throw new Error(`Gateway: Access Denied for ${action}`);
        }
    }

    private processTradePostExecution(t: Trade, user: User, order: Order) {
        // Annotate Trade
        t.buyerUserId = t.side === 'BUY' ? user.id : t.takerOrderId?.startsWith('MM') ? 'market_maker_bot' : 'unknown';
        t.sellerUserId = t.side === 'SELL' ? user.id : t.takerOrderId?.startsWith('MM') ? 'market_maker_bot' : 'unknown';
        
        // Module 12: Back-Office (Fee Calc)
        t.fee = backOfficeService.calculateAndCollectFee(t);

        // Record
        db.recordTrade(t);

        // Module 8: Clearing
        clearingHouse.processTrade(t);

        // Module 9: Settlement
        settlementService.executeDVP(t);

        // Module 11: Surveillance
        surveillanceService.analyzeTrade(t);
    }
}

// Instantiate with the global engine from a common source in real app, 
// here we accept it via injection or singleton export in marketService
export let gateway: GatewayService | null = null;

export const initGateway = (engine: MatchingEngine) => {
    gateway = new GatewayService(engine);
    return gateway;
}