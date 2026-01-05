import { SystemHealth } from '../types';

// Module 1: Infrastructure & Technical Foundation
// Simulates Kubernetes status, Network Latency, and PTP Sync
class InfrastructureService {
  private health: SystemHealth = {
    clusterStatus: 'HEALTHY',
    activeNodes: 12, // Simulating a multi-cluster setup
    networkLatency: 0.4, // < 1ms requirement
    matchingEngineThroughput: 0,
    ptpSyncStatus: 'SYNCED',
    lastHeartbeat: Date.now()
  };

  public getSystemHealth(): SystemHealth {
    // Simulate real-time fluctuations
    this.health.networkLatency = 0.3 + (Math.random() * 0.5); // Random jitter between 0.3ms and 0.8ms
    this.health.matchingEngineThroughput = Math.floor(800 + Math.random() * 400); // 800-1200 TPS (~50k/min)
    this.health.lastHeartbeat = Date.now();
    
    // Simulate rare PTP drift
    if (Math.random() > 0.995) {
        this.health.ptpSyncStatus = 'DRIFT';
    } else {
        this.health.ptpSyncStatus = 'SYNCED';
    }

    return this.health;
  }
  
  public getClusterLogs(): string[] {
      return [
          `[K8s-Node-01] CPU Usage: 45% | Mem: 12GB/32GB`,
          `[K8s-Node-02] CPU Usage: 52% | Mem: 14GB/32GB`,
          `[Aeron-Bus] Multicast Stream Health: OK | Loss Rate: 0.00%`,
          `[Vault-HSM] Secrets Rotated successfully at ${new Date().toLocaleTimeString()}`
      ];
  }
}

export const infraService = new InfrastructureService();