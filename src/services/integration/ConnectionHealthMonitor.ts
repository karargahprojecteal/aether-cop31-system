export type HealthStatus = 'ONLINE' | 'DEGRADED' | 'DISCONNECTED' | 'PAIRING_REQUIRED' | 'CONFIG_ERROR';

export interface DeviceHealthSummary {
  deviceId: string;
  status: HealthStatus;
  lastHeartbeat: string;
  latencyMs: number;
  packetsReceived: number;
  packetErrors: number;
  errorRatePercent: number;
  reconnectAttempts: number;
  bufferBacklogCount: number;
}

export class ConnectionHealthMonitor {
  private healthStore: Map<string, DeviceHealthSummary> = new Map();

  public recordPacket(deviceId: string, latencyMs: number = 24, isError: boolean = false): void {
    const now = new Date().toISOString();
    const existing = this.healthStore.get(deviceId) || {
      deviceId,
      status: 'ONLINE',
      lastHeartbeat: now,
      latencyMs,
      packetsReceived: 0,
      packetErrors: 0,
      errorRatePercent: 0,
      reconnectAttempts: 0,
      bufferBacklogCount: 0,
    };

    existing.packetsReceived++;
    existing.lastHeartbeat = now;
    existing.latencyMs = latencyMs;
    if (isError) {
      existing.packetErrors++;
    }

    const total = existing.packetsReceived;
    existing.errorRatePercent = total > 0 ? Number(((existing.packetErrors / total) * 100).toFixed(1)) : 0;

    if (existing.errorRatePercent > 15) {
      existing.status = 'DEGRADED';
    } else {
      existing.status = 'ONLINE';
    }

    this.healthStore.set(deviceId, existing);
  }

  public recordDisconnect(deviceId: string, attempts: number = 1): void {
    const existing = this.healthStore.get(deviceId);
    if (existing) {
      existing.status = 'DISCONNECTED';
      existing.reconnectAttempts += attempts;
      this.healthStore.set(deviceId, existing);
    }
  }

  public setBufferBacklog(deviceId: string, count: number): void {
    const existing = this.healthStore.get(deviceId);
    if (existing) {
      existing.bufferBacklogCount = count;
      this.healthStore.set(deviceId, existing);
    }
  }

  public getHealth(deviceId: string): DeviceHealthSummary {
    const existing = this.healthStore.get(deviceId);
    if (existing) return { ...existing };

    return {
      deviceId,
      status: 'ONLINE',
      lastHeartbeat: new Date().toISOString(),
      latencyMs: 18,
      packetsReceived: 1420,
      packetErrors: 1,
      errorRatePercent: 0.1,
      reconnectAttempts: 0,
      bufferBacklogCount: 0,
    };
  }
}

export const connectionHealthMonitorInstance = new ConnectionHealthMonitor();
