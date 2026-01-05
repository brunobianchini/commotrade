
import { WarehouseReceipt, BlockchainTransaction, User, SREStatus, UserRole } from '../types';
import { db } from './DatabaseService';
import { securityService } from './SecurityService';

// Module 10: SRE & Central Registry (Blockchain)
// Handles Full Lifecycle of Electronic Warehouse Receipts
class SREService {
    
    // 1. MINT (Issuance) - Initiated by Warehouse Operator
    public mintReceipt(data: Partial<WarehouseReceipt>, operator: User): WarehouseReceipt {
        if (operator.role !== UserRole.WAREHOUSE_OPS && operator.role !== UserRole.EXCHANGE_STAFF) {
            throw new Error("Access Denied: Only Warehouse Operators can mint receipts.");
        }

        const receiptId = `WR-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`;
        // Generate hash representing the digital asset on-chain
        const txHash = securityService.generateHash(receiptId + data.commodity + Date.now());

        const receipt: WarehouseReceipt = {
            id: receiptId,
            commodity: data.commodity!,
            grade: data.grade!,
            quantity: data.quantity!,
            location: data.location!,
            status: SREStatus.PENDING_APPROVAL, // Must be validated by Registry Manager
            ownerHash: operator.id, // Temporarily held by Warehouse until approved/allocated
            createdBy: operator.id,
            timestamp: Date.now(),
            txHash: txHash
        };

        db.createReceipt(receipt);
        this.recordTransaction(receipt.id, '0x0000000000000000', operator.id, 'MINT', txHash);
        
        return receipt;
    }

    // 2. VALIDATE (Approval) - Performed by Registry Manager (Segregation of Duties)
    public approveReceipt(receiptId: string, manager: User) {
        if (manager.role !== UserRole.REGISTRY_MGR && manager.role !== UserRole.EXCHANGE_STAFF) {
            throw new Error("Access Denied: Only Registry Managers can approve receipts.");
        }

        const receipt = db.getReceipt(receiptId);
        if (!receipt) throw new Error("Receipt not found");
        if (receipt.status !== SREStatus.PENDING_APPROVAL) throw new Error("Receipt is not pending approval");

        const txHash = securityService.generateHash(receiptId + 'APPROVE' + Date.now());
        
        receipt.status = SREStatus.VALID;
        receipt.approvedBy = manager.id;
        receipt.txHash = txHash;

        db.updateReceipt(receipt);
        this.recordTransaction(receiptId, receipt.createdBy, receipt.ownerHash, 'APPROVE', txHash);
        db.logAudit(manager.id, 'SRE_APPROVE', `Approved WR ${receiptId}`);
    }

    // 3. TRANSFER (Settlement)
    public transferReceipt(receiptId: string, fromUserId: string, toUserId: string, executor?: User) {
        const receipt = db.getReceipt(receiptId);
        if (!receipt) throw new Error("Receipt not found");
        
        // System/Exchange Staff can override ownership check for DVP Settlement
        const isSystemExec = executor?.role === UserRole.EXCHANGE_STAFF || executor?.role === UserRole.REGISTRY_MGR;

        if (receipt.ownerHash !== fromUserId && !isSystemExec) {
            throw new Error("Transfer Failed: You do not own this receipt.");
        }
        
        if (receipt.status !== SREStatus.VALID) {
             throw new Error(`Transfer Failed: Receipt is ${receipt.status} (Must be VALID)`);
        }

        const txHash = securityService.generateHash(receiptId + fromUserId + toUserId + Date.now());
        
        receipt.ownerHash = toUserId;
        receipt.txHash = txHash;
        
        db.updateReceipt(receipt);
        this.recordTransaction(receiptId, fromUserId, toUserId, 'TRANSFER', txHash);
        
        db.logAudit(executor ? executor.id : fromUserId, 'SRE_TRANSFER', `Transferred ${receiptId} to ${toUserId}`);
    }

    // 4. PLEDGE (Financing) - Lock asset for collateral
    public pledgeReceipt(receiptId: string, userId: string) {
        const receipt = db.getReceipt(receiptId);
        if (!receipt) throw new Error("Receipt not found");
        if (receipt.ownerHash !== userId) throw new Error("Not owner");
        if (receipt.status !== SREStatus.VALID) throw new Error("Cannot pledge: Receipt is not VALID");

        const txHash = securityService.generateHash(receiptId + 'PLEDGE' + Date.now());
        
        receipt.status = SREStatus.PLEDGED;
        receipt.txHash = txHash;
        
        db.updateReceipt(receipt);
        this.recordTransaction(receiptId, userId, 'CLEARING_HOUSE_COLLATERAL', 'PLEDGE', txHash);
        db.logAudit(userId, 'SRE_PLEDGE', `Pledged WR ${receiptId}`);
    }

    // 4b. UNPLEDGE (Release) - Risk Mgr only
    public unpledgeReceipt(receiptId: string, manager: User) {
        if (manager.role !== UserRole.RISK_MGR && manager.role !== UserRole.EXCHANGE_STAFF) {
             throw new Error("Access Denied: Only Risk Managers can release pledges.");
        }
        
        const receipt = db.getReceipt(receiptId);
        if (!receipt) throw new Error("Receipt not found");
        if (receipt.status !== SREStatus.PLEDGED) throw new Error("Receipt is not pledged");

        const txHash = securityService.generateHash(receiptId + 'UNPLEDGE' + Date.now());
        
        receipt.status = SREStatus.VALID;
        receipt.txHash = txHash;
        
        db.updateReceipt(receipt);
        this.recordTransaction(receiptId, 'CLEARING_HOUSE_COLLATERAL', receipt.ownerHash, 'UNPLEDGE', txHash);
        db.logAudit(manager.id, 'SRE_UNPLEDGE', `Released Pledge on WR ${receiptId}`);
    }

    // 5. REQUEST DELIVERY (Physical Load-out)
    public requestDelivery(receiptId: string, userId: string) {
        const receipt = db.getReceipt(receiptId);
        if (!receipt) throw new Error("Receipt not found");
        if (receipt.ownerHash !== userId) throw new Error("Not owner");
        if (receipt.status !== SREStatus.VALID) throw new Error("Cannot request delivery: Receipt is not VALID");

        const txHash = securityService.generateHash(receiptId + 'REQ_DEL' + Date.now());

        receipt.status = SREStatus.DELIVERY_REQUESTED;
        receipt.txHash = txHash;

        db.updateReceipt(receipt);
        this.recordTransaction(receiptId, userId, receipt.location, 'REQUEST_DELIVERY', txHash);
        db.logAudit(userId, 'SRE_DELIVERY_REQ', `Requested delivery for WR ${receiptId}`);
    }

    // 6. DELIVERED (Burn) - Confirmed by Warehouse Operator
    public completeDelivery(receiptId: string, operator: User) {
        if (operator.role !== UserRole.WAREHOUSE_OPS && operator.role !== UserRole.EXCHANGE_STAFF) {
            throw new Error("Access Denied: Only Warehouse Operators can confirm delivery.");
        }

        const receipt = db.getReceipt(receiptId);
        if (!receipt) throw new Error("Receipt not found");
        if (receipt.status !== SREStatus.DELIVERY_REQUESTED) throw new Error("Receipt is not waiting for delivery");

        const txHash = securityService.generateHash(receiptId + 'BURN' + Date.now());

        receipt.status = SREStatus.DELIVERED;
        receipt.txHash = txHash;
        // Ownership effectively nullified as asset leaves the ecosystem
        
        db.updateReceipt(receipt);
        this.recordTransaction(receiptId, receipt.ownerHash, '0x0000000000000000', 'DELIVERED', txHash);
        db.logAudit(operator.id, 'SRE_DELIVERED', `Physical delivery confirmed for WR ${receiptId}. Token Burned.`);
    }

    // 7. SPLIT (Fractionalization for Settlement)
    public splitReceipt(receiptId: string, amount: number, executor: User): WarehouseReceipt[] {
        // Only System (Exchange Staff) or Registry Mgr can split for settlement
        if (executor.role !== UserRole.EXCHANGE_STAFF && executor.role !== UserRole.REGISTRY_MGR) {
            throw new Error("Access Denied: Receipt splitting is a restricted registry operation.");
        }

        const original = db.getReceipt(receiptId);
        if (!original) throw new Error("Receipt not found");
        if (original.status !== SREStatus.VALID) throw new Error("Cannot split invalid receipt");
        if (amount >= original.quantity) throw new Error("Split amount must be less than total quantity");
        if (amount <= 0) throw new Error("Invalid split amount");

        // 1. Mark original as SPLIT (Burned/Archived)
        original.status = SREStatus.SPLIT;
        const splitTxHash = securityService.generateHash(receiptId + 'SPLIT' + Date.now());
        original.txHash = splitTxHash;
        db.updateReceipt(original);

        // 2. Create Child A (The amount to transfer)
        const childA: WarehouseReceipt = {
            ...original,
            id: original.id + '-A',
            quantity: amount,
            status: SREStatus.VALID,
            parentId: original.id,
            timestamp: Date.now(),
            txHash: securityService.generateHash(original.id + '-A' + Date.now())
        };

        // 3. Create Child B (The remainder)
        const childB: WarehouseReceipt = {
            ...original,
            id: original.id + '-B',
            quantity: original.quantity - amount,
            status: SREStatus.VALID,
            parentId: original.id,
            timestamp: Date.now(),
            txHash: securityService.generateHash(original.id + '-B' + Date.now())
        };

        db.createReceipt(childA);
        db.createReceipt(childB);

        this.recordTransaction(receiptId, original.ownerHash, original.ownerHash, 'SPLIT', splitTxHash);

        return [childA, childB];
    }

    private recordTransaction(receiptId: string, from: string, to: string, action: BlockchainTransaction['action'], hash: string) {
        const tx: BlockchainTransaction = {
            hash: hash,
            receiptId: receiptId,
            from: from,
            to: to,
            action: action,
            timestamp: Date.now(),
            blockNumber: Math.floor(Date.now() / 10000) // Simulated block height
        };
        db.saveBlockchainTx(tx);
    }
}

export const sreService = new SREService();
