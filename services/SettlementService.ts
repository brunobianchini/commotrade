import { Trade, OrderSide, SREStatus, User, UserRole, SwiftMessage } from '../types';
import { db } from './DatabaseService';
import { sreService } from './SREService';

// Module 9: Settlement & DVP
// Implements Atomic Swap: Cash for Warehouse Receipt + SWIFT/Fiat Bridge
class SettlementService {
    
    private systemExecutor: User = {
        id: 'sys_executor',
        username: 'system',
        passwordHash: '',
        role: UserRole.EXCHANGE_STAFF,
        fullName: 'Settlement Engine',
        firm: 'Exchange',
        status: 'ACTIVE'
    };

    private swiftMessages: SwiftMessage[] = [];

    public executeDVP(trade: Trade) {
        console.log(`[Settlement] Executing DVP for Trade ${trade.id}`);

        // 1. Fiat Settlement (Mock SWIFT/Stripe)
        this.processFiatSettlement(trade);

        // 2. Asset Delivery (SRE Transfer)
        if (trade.sellerUserId && trade.buyerUserId && trade.symbol === 'XAU/USD') {
             this.processAssetDelivery(trade);
        }
    }

    private processFiatSettlement(trade: Trade) {
        // Module 9.1: SWIFT MT103 Generation (Payment Instruction)
        const amount = trade.price * trade.size;
        
        // Generate Mock SWIFT Message
        const swiftMsg = this.generateSwiftMT103(
            trade.buyerUserId || 'UNKNOWN',
            trade.sellerUserId || 'UNKNOWN',
            amount,
            'USD',
            `TRD-${trade.id}`
        );
        
        this.swiftMessages.push(swiftMsg);
        db.logAudit('SYSTEM', 'SWIFT_GEN', `Generated MT103 ${swiftMsg.id} for $${amount}`);
        
        // In a real system, this would call the Stripe API or SWIFT Gateway here.
        // Mock Stripe Intent:
        // stripe.paymentIntents.create({ amount: amount * 100, currency: 'usd' ... });
    }

    private generateSwiftMT103(senderId: string, receiverId: string, amount: number, currency: string, ref: string): SwiftMessage {
        return {
            id: `MT103-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            type: 'MT103',
            senderBic: `BANK${senderId.toUpperCase().substring(0,4)}US33`,
            receiverBic: `BANK${receiverId.toUpperCase().substring(0,4)}US33`,
            amount: amount,
            currency: currency,
            reference: ref,
            timestamp: Date.now(),
            status: 'SENT'
        };
    }

    public getSwiftMessages(): SwiftMessage[] {
        return this.swiftMessages;
    }

    private processAssetDelivery(trade: Trade) {
         // Find Seller's Receipts
         const sellerReceipts = db.getReceipts().filter(r => 
             r.ownerHash === trade.sellerUserId && 
             r.status === SREStatus.VALID &&
             r.commodity === 'Gold Bullion'
         );
        
         let remainingToSettle = trade.size; 

         if (sellerReceipts.length > 0) {
             for (const receipt of sellerReceipts) {
                 if (remainingToSettle <= 0) break;

                 try {
                     if (receipt.quantity === remainingToSettle) {
                         sreService.transferReceipt(receipt.id, trade.sellerUserId!, trade.buyerUserId!, this.systemExecutor);
                         remainingToSettle = 0;
                         db.logAudit('SYSTEM', 'DVP_SUCCESS', `Transferred WR ${receipt.id} to ${trade.buyerUserId}`);
                     } else if (receipt.quantity > remainingToSettle) {
                         const [transferPart, remainderPart] = sreService.splitReceipt(receipt.id, remainingToSettle, this.systemExecutor);
                         sreService.transferReceipt(transferPart.id, trade.sellerUserId!, trade.buyerUserId!, this.systemExecutor);
                         remainingToSettle = 0;
                         db.logAudit('SYSTEM', 'DVP_SPLIT_SUCCESS', `Split WR ${receipt.id}. Transferred ${transferPart.id} to buyer.`);
                     } else {
                         sreService.transferReceipt(receipt.id, trade.sellerUserId!, trade.buyerUserId!, this.systemExecutor);
                         remainingToSettle -= receipt.quantity;
                         db.logAudit('SYSTEM', 'DVP_PARTIAL', `Transferred WR ${receipt.id}. Remaining: ${remainingToSettle}`);
                     }
                 } catch (e: any) {
                     db.logAudit('SYSTEM', 'DVP_FAILURE', `Settlement Error: ${e.message}`);
                 }
             }
         }
    }
}

export const settlementService = new SettlementService();