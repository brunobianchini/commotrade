import { Order, OrderSide, User, UserRole } from '../types';
import { db } from './DatabaseService';

// Module 4: Pre-Trade Risk Engine
// "Vérification limites, Disponibilité cash, Kill switch"
class RiskEngine {
    private readonly MAX_ORDER_VALUE = 5000000; // $5M limit per order
    private readonly INITIAL_MARGIN_REQ = 0.10; // 10% Initial Margin
    private readonly SHORT_MARGIN_REQ = 0.50;   // 50% Margin for Short Selling (Riskier)
    private readonly MAX_DAILY_LOSS = 50000; // $50k Max Daily Loss per trader
    private globalKillSwitch: boolean = false;

    public validateOrder(order: Order, user: User): void {
        // 0. Global Kill Switch Check
        if (this.globalKillSwitch && user.role !== UserRole.EXCHANGE_STAFF) {
            throw new Error("MARKET HALTED: Global Kill Switch is Active.");
        }

        // 1. Regulatory Kill Switch / User Suspension Check
        if (user.status !== 'ACTIVE') {
             throw new Error("Risk Rejection: Account Suspended.");
        }
        
        // 2. Daily Loss Limit Check
        const balance = db.getBalance(user.id);
        if (balance.dailyLoss >= this.MAX_DAILY_LOSS) {
            throw new Error(`Risk Rejection: Daily Loss Limit Exceeded ($${this.MAX_DAILY_LOSS}).`);
        }
        
        // 3. Max Order Value Limit
        const estimatedValue = order.price * order.size;
        if (estimatedValue > this.MAX_ORDER_VALUE && user.role !== UserRole.EXCHANGE_STAFF) {
            throw new Error(`Risk Rejection: Order value $${estimatedValue} exceeds limit of $${this.MAX_ORDER_VALUE}`);
        }

        // 4. Cash Availability Check (Pre-Trade)
        if (order.side === OrderSide.BUY) {
            const requiredMargin = estimatedValue * this.INITIAL_MARGIN_REQ;
            
            if (balance.free < requiredMargin) {
                throw new Error(`Risk Rejection: Insufficient Buying Power. Required Margin: $${requiredMargin.toFixed(2)}, Free Balance: $${balance.free.toFixed(2)}`);
            }
            
            // Lock Margin (Pre-emptive)
            db.updateBalance(user.id, {
                free: balance.free - requiredMargin,
                locked: balance.locked + requiredMargin
            });
        }

        // 5. Short Selling Logic & Inventory Check
        if (order.side === OrderSide.SELL) {
             const position = db.getPosition(user.id, order.symbol);
             const currentInventory = position.size; // Can be positive (Long) or negative (Short)
             
             // Check if this is a Short Sell (Selling more than we own)
             if (currentInventory < order.size) {
                 // It is a short sell (at least partially)
                 const shortAmount = order.size - Math.max(0, currentInventory);
                 
                 // Short Selling requires higher margin or specific permissions
                 const requiredMargin = (shortAmount * order.price * this.SHORT_MARGIN_REQ);

                 if (balance.free < requiredMargin) {
                     throw new Error(`Risk Rejection: Insufficient Margin for Short Sell. Shorting ${shortAmount} units requires $${requiredMargin.toFixed(2)}.`);
                 }

                 // Log warning for Naked Short if no SRE backing (simplified check)
                 // In full system, we check SRE registry here.
                 console.warn(`[Risk] User ${user.id} initiating Short Position on ${order.symbol}.`);
                 
                 db.updateBalance(user.id, {
                    free: balance.free - requiredMargin,
                    locked: balance.locked + requiredMargin
                });
             } else {
                 // Closing a Long position - No margin needed, usually releases margin
                 // But strictly, we don't release until trade executes.
             }
        }
        
        db.logAudit(user.id, 'RISK_CHECK_PASS', `Order ${order.id} passed pre-trade risk checks.`);
    }

    public restoreMargin(order: Order) {
        // If order is cancelled or rejected after locking, unlock funds
        const balance = db.getBalance(order.userId);
        
        // Determine margin rate used
        const rate = (order.side === OrderSide.SELL) ? this.SHORT_MARGIN_REQ : this.INITIAL_MARGIN_REQ;
        
        // Ideally we track exact locked amount per order ID, but for simulation:
        const marginToUnlock = (order.price * order.remainingSize) * rate;
        
        db.updateBalance(order.userId, {
            free: balance.free + marginToUnlock,
            locked: Math.max(0, balance.locked - marginToUnlock)
        });
    }

    public toggleGlobalKillSwitch(active: boolean, adminUser: User) {
        if (adminUser.role !== UserRole.RISK_MGR && adminUser.role !== UserRole.EXCHANGE_STAFF) {
            throw new Error("Unauthorized Access to Kill Switch");
        }
        this.globalKillSwitch = active;
        db.logAudit(adminUser.id, 'KILL_SWITCH', `Global Kill Switch set to ${active}`);
    }

    public isMarketHalted(): boolean {
        return this.globalKillSwitch;
    }
}

export const riskEngine = new RiskEngine();