import { gateway } from './GatewayService';
import { db } from './DatabaseService';
import { FixMsgType, FixTag, createFixMessage, parseFixMessage, SOH } from './FixProtocol';
import { OrderSide, OrderType, User } from '../types';

export interface FixLogEntry {
    direction: 'IN' | 'OUT';
    timestamp: number;
    raw: string;
    msgType: string;
}

class FixGatewayService {
    private sessionActive = false;
    private serverSeqNum = 1;
    private incomingSeqNum = 1;
    private logCallback: ((entry: FixLogEntry) => void) | null = null;
    private currentUser: User | null = null;

    // Simulate connecting a specific user via FIX
    public connect(user: User) {
        this.currentUser = user;
        this.sessionActive = true;
        this.serverSeqNum = 1;
        this.incomingSeqNum = 1;
    }

    public disconnect() {
        this.sessionActive = false;
        this.currentUser = null;
    }

    public setLogCallback(cb: (entry: FixLogEntry) => void) {
        this.logCallback = cb;
    }

    private log(direction: 'IN' | 'OUT', raw: string, msgType: string) {
        if (this.logCallback) {
            this.logCallback({ direction, timestamp: Date.now(), raw, msgType });
        }
    }

    public async receiveMessage(rawFix: string) {
        const tags = parseFixMessage(rawFix);
        const msgType = tags[FixTag.MsgType];
        
        // Sequence check simulation
        const msgSeq = parseInt(tags[FixTag.MsgSeqNum]);
        if (!isNaN(msgSeq)) {
             if (msgSeq > this.incomingSeqNum) {
                 // Gap detected - In real FIX we would send ResendRequest
                 console.warn(`FIX Sequence Gap: Expected ${this.incomingSeqNum}, Got ${msgSeq}`);
             }
             this.incomingSeqNum = msgSeq + 1;
        }

        this.log('IN', rawFix, msgType);

        if (!this.currentUser) {
            this.sendReject(tags, "Session not authenticated. Use UI to select FIX User.");
            return;
        }

        try {
            switch (msgType) {
                case FixMsgType.Logon:
                    this.handleLogon(tags);
                    break;
                case FixMsgType.Heartbeat:
                    // Simple Heartbeat response if needed, or just ack
                    // Usually we don't respond to Heartbeat unless it's a Test Request response
                    break;
                case FixMsgType.TestRequest:
                    this.handleTestRequest(tags);
                    break;
                case FixMsgType.NewOrderSingle:
                    await this.handleNewOrderSingle(tags);
                    break;
                case FixMsgType.OrderCancelRequest:
                    await this.handleOrderCancel(tags);
                    break;
                default:
                    // Ignore unknown
                    break;
            }
        } catch (e: any) {
            this.sendReject(tags, e.message);
        }
    }

    private send(msgType: string, tags: Record<number, string | number>) {
        // Auto-fill TargetCompID from current user if not present
        if (!tags[FixTag.TargetCompID] && this.currentUser) {
            tags[FixTag.TargetCompID] = this.currentUser.username.toUpperCase();
        }

        const raw = createFixMessage(msgType, tags, this.serverSeqNum++);
        this.log('OUT', raw, msgType);
    }

    private sendReject(refTags: Record<number, string>, reason: string) {
        this.send(FixMsgType.Reject, {
            [FixTag.TargetCompID]: refTags[FixTag.SenderCompID] || 'UNKNOWN',
            45: refTags[FixTag.MsgSeqNum] || 0, // RefSeqNum
            58: reason // Text
        });
    }

    private handleLogon(tags: Record<number, string>) {
        // Simple accept
        this.send(FixMsgType.Logon, {
            [FixTag.TargetCompID]: tags[FixTag.SenderCompID],
            98: 0, // EncryptMethod
            108: 30 // HeartBtInt
        });
    }

    private handleTestRequest(tags: Record<number, string>) {
        this.send(FixMsgType.Heartbeat, {
            [FixTag.TargetCompID]: tags[FixTag.SenderCompID],
            [FixTag.TestReqID]: tags[FixTag.TestReqID]
        });
    }

    private async handleNewOrderSingle(tags: Record<number, string>) {
        if (!gateway || !this.currentUser) return;

        // Map FIX tags to Internal Order
        const symbol = tags[FixTag.Symbol]; // 55
        const side = tags[FixTag.Side] === '1' ? OrderSide.BUY : OrderSide.SELL; // 54
        const qty = parseFloat(tags[FixTag.OrderQty]); // 38
        const price = parseFloat(tags[FixTag.Price]); // 44
        const ordType = tags[FixTag.OrdType] === '1' ? OrderType.MARKET : OrderType.LIMIT; // 40

        // Submit via Gateway
        try {
            const trades = await gateway.routeOrderSubmission({
                id: 'FIX-' + tags[FixTag.ClOrdID], // Use Client ID as Ref
                userId: this.currentUser.id,
                symbol,
                side,
                type: ordType,
                price: price || 0,
                size: qty,
                remainingSize: qty, // Will be updated by gateway logic
                timestamp: Date.now(),
                status: 'OPEN'
            }, this.currentUser);

            // Send Execution Report (New/Filled)
            this.send(FixMsgType.ExecutionReport, {
                [FixTag.TargetCompID]: tags[FixTag.SenderCompID],
                [FixTag.OrderID]: 'ORD-' + Date.now(),
                [FixTag.ClOrdID]: tags[FixTag.ClOrdID],
                [FixTag.ExecID]: 'EXEC-' + Date.now(),
                [FixTag.ExecType]: trades.length > 0 ? 'F' : '0', // F=Trade, 0=New
                [FixTag.OrdStatus]: trades.length > 0 ? '2' : '0', // 2=Filled, 0=New
                [FixTag.Symbol]: symbol,
                [FixTag.Side]: tags[FixTag.Side],
                [FixTag.OrderQty]: qty,
                [FixTag.LeavesQty]: trades.length > 0 ? 0 : qty,
                [FixTag.CumQty]: trades.length > 0 ? qty : 0,
                [FixTag.AvgPx]: trades.length > 0 ? trades[0].price : 0
            });

        } catch (e: any) {
            this.sendReject(tags, "Order Rejected: " + e.message);
        }
    }

    private async handleOrderCancel(tags: Record<number, string>) {
        if (!gateway || !this.currentUser) return;

        const origClOrdId = tags[FixTag.OrigClOrdID];
        const clOrdId = tags[FixTag.ClOrdID];
        
        // Find internal order ID. In simulation, we prefixed 'FIX-' to ClOrdId in NewOrderSingle
        const orderIdToCancel = 'FIX-' + origClOrdId;
        
        // Verify order exists in DB to get details for report
        const order = db.getOrder(orderIdToCancel);

        if (!order) {
            // Send Order Cancel Reject
            this.send(FixMsgType.OrderCancelReject, {
                 [FixTag.TargetCompID]: tags[FixTag.SenderCompID],
                 [FixTag.OrderID]: 'UNKNOWN',
                 [FixTag.ClOrdID]: clOrdId,
                 [FixTag.OrigClOrdID]: origClOrdId,
                 [FixTag.OrdStatus]: '8', // Rejected
                 58: "Unknown Order ID"
            });
            return;
        }

        try {
            await gateway.routeOrderCancellation(orderIdToCancel, this.currentUser);
            
            // Send Execution Report (Cancelled)
            this.send(FixMsgType.ExecutionReport, {
                [FixTag.TargetCompID]: tags[FixTag.SenderCompID],
                [FixTag.OrderID]: order.id,
                [FixTag.ClOrdID]: clOrdId,
                [FixTag.OrigClOrdID]: origClOrdId,
                [FixTag.ExecID]: 'EXEC-CXL-' + Date.now(),
                [FixTag.ExecType]: '4', // Canceled
                [FixTag.OrdStatus]: '4', // Canceled
                [FixTag.Symbol]: order.symbol,
                [FixTag.Side]: order.side === 'BUY' ? '1' : '2',
                [FixTag.OrderQty]: order.size,
                [FixTag.LeavesQty]: 0,
                [FixTag.CumQty]: 0,
                [FixTag.AvgPx]: 0
            });

        } catch (e: any) {
             this.send(FixMsgType.OrderCancelReject, {
                 [FixTag.TargetCompID]: tags[FixTag.SenderCompID],
                 [FixTag.OrderID]: order.id,
                 [FixTag.ClOrdID]: clOrdId,
                 [FixTag.OrigClOrdID]: origClOrdId,
                 [FixTag.OrdStatus]: '8', // Rejected
                 58: "Cancel Failed: " + e.message
            });
        }
    }
}

export const fixGateway = new FixGatewayService();