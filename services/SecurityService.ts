
import { User, UserRole } from '../types';

// Module 1 & 2: Infrastructure & Security
// Implements Rate Limiting, Input Sanitization, Session Validation, RBAC, and HSM Simulation
class SecurityService {
  private requestCounts: Map<string, number[]> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS_PER_MIN = 100; // 100 req/min per user

  // Permission Map (RBAC)
  private readonly permissions: Record<UserRole, string[]> = {
      [UserRole.TRADER]: ['ORDER_SUBMIT', 'ORDER_CANCEL', 'VIEW_MARKET', 'VIEW_SRE', 'SRE_PLEDGE', 'SRE_REDEEM', 'SRE_TRANSFER', 'CONNECT_FIX'],
      [UserRole.BROKER]: ['ORDER_SUBMIT', 'ORDER_CANCEL', 'VIEW_MARKET', 'VIEW_SRE', 'SRE_PLEDGE', 'SRE_REDEEM', 'SRE_TRANSFER', 'CONNECT_FIX'],
      [UserRole.RISK_MGR]: ['VIEW_MARKET', 'VIEW_RISK', 'KILL_SWITCH', 'FORCE_CANCEL', 'SRE_UNPLEDGE', 'VIEW_SRE'],
      [UserRole.EXCHANGE_STAFF]: ['VIEW_MARKET', 'VIEW_RISK', 'VIEW_BACKOFFICE', 'MANAGE_MARKET', 'RUN_EOD', 'RUN_FIXING', 'SRE_MINT', 'SRE_APPROVE', 'SRE_SPLIT', 'VIEW_SRE', 'SRE_DELIVER', 'SRE_UNPLEDGE', 'FORCE_CANCEL', 'KILL_SWITCH', 'CONNECT_FIX'],
      [UserRole.REGULATOR]: ['VIEW_MARKET', 'VIEW_RISK', 'VIEW_BACKOFFICE', 'VIEW_SURVEILLANCE', 'VIEW_SRE'],
      [UserRole.WAREHOUSE_OPS]: ['SRE_MINT', 'SRE_DELIVER', 'VIEW_SRE'],
      [UserRole.REGISTRY_MGR]: ['SRE_APPROVE', 'SRE_SPLIT', 'VIEW_SRE'],
      [UserRole.RECONCILIATION]: ['VIEW_BACKOFFICE']
  };

  // Prevent XSS/Injection
  public sanitizeInput(input: string): string {
    return input.replace(/[<>&'"]/g, (char) => {
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&#39;';
        case '"': return '&quot;';
        default: return char;
      }
    });
  }

  // Rate Limiting (Token Bucket simulation)
  public checkRateLimit(userId: string): boolean {
    const now = Date.now();
    let timestamps = this.requestCounts.get(userId) || [];
    
    // Filter out old timestamps
    timestamps = timestamps.filter(t => now - t < this.RATE_LIMIT_WINDOW);
    
    if (timestamps.length >= this.MAX_REQUESTS_PER_MIN) {
      console.warn(`[Security] Rate limit exceeded for user ${userId}`);
      return false;
    }

    timestamps.push(now);
    this.requestCounts.set(userId, timestamps);
    return true;
  }

  public validateSession(user: User | null): boolean {
    if (!user) return false;
    if (user.status === 'SUSPENDED') {
      throw new Error("Security Alert: User account is suspended.");
    }
    return true;
  }

  // RBAC Enforcement
  public verifyPermission(user: User, action: string): boolean {
      const allowedActions = this.permissions[user.role] || [];
      if (!allowedActions.includes(action)) {
          // console.warn(`[Security] Access Denied: User ${user.username} (${user.role}) attempted ${action}`);
          return false;
      }
      return true;
  }

  // Simulation of SHA-256 for integrity checks
  public generateHash(data: string): string {
    let hash = 0, i, chr;
    if (data.length === 0) return hash.toString(16);
    for (i = 0; i < data.length; i++) {
      chr = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
  }

  // HSM Simulation: Signs critical payloads
  public signPayload(data: any, userId: string): string {
      const payloadString = JSON.stringify(data);
      const hash = this.generateHash(payloadString + userId + Date.now());
      return `SIG-RSA-4096-${hash.substring(0, 16).toUpperCase()}`;
  }
}

export const securityService = new SecurityService();
