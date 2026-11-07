import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService } from '../services/persistence/DatabaseService';
import { TenantRepository } from '../services/persistence/TenantRepository';
import { PairingRepository } from '../services/persistence/PairingRepository';

describe('Integration: Pairing Security, Concurrency, and Atomic Redemption', () => {
  let dbService: DatabaseService;
  let tenantRepo: TenantRepository;
  let pairingRepo: PairingRepository;

  const tenantA = 'tenant-pairing-a';
  const tenantB = 'tenant-pairing-b';
  const homeA = 'home-pairing-a';
  const homeB = 'home-pairing-b';

  beforeEach(() => {
    dbService = DatabaseService.createIsolatedInstance(':memory:');
    tenantRepo = new TenantRepository(dbService.getDb());
    pairingRepo = new PairingRepository(dbService.getDb(), tenantRepo);

    // Seed tenants and homes
    tenantRepo.createOrganization({
      id: tenantA,
      name: 'Tenant A Org',
      slug: 'tenant-a-org',
      contactEmail: 'a@pairing.test',
      plan: {
        tier: 'STARTER_HOME',
        status: 'ACTIVE',
        currentPeriodEnd: new Date().toISOString(),
        maxHomes: 2,
        maxDevicesPerHome: 5,
        telemetryIntervalSeconds: 60,
        allowRealtimeWebSocket: false,
        allowAutonomousControl: false,
        geminiCallsPerDay: 10,
        usedGeminiCallsToday: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, {
      tier: 'STARTER_HOME',
      status: 'ACTIVE',
      currentPeriodEnd: new Date().toISOString(),
      maxHomes: 2,
      maxDevicesPerHome: 5,
      telemetryIntervalSeconds: 60,
      allowRealtimeWebSocket: false,
      allowAutonomousControl: false,
      geminiCallsPerDay: 10,
      usedGeminiCallsToday: 0,
    });

    tenantRepo.createOrganization({
      id: tenantB,
      name: 'Tenant B Org',
      slug: 'tenant-b-org',
      contactEmail: 'b@pairing.test',
      plan: {
        tier: 'STARTER_HOME',
        status: 'ACTIVE',
        currentPeriodEnd: new Date().toISOString(),
        maxHomes: 2,
        maxDevicesPerHome: 5,
        telemetryIntervalSeconds: 60,
        allowRealtimeWebSocket: false,
        allowAutonomousControl: false,
        geminiCallsPerDay: 10,
        usedGeminiCallsToday: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, {
      tier: 'STARTER_HOME',
      status: 'ACTIVE',
      currentPeriodEnd: new Date().toISOString(),
      maxHomes: 2,
      maxDevicesPerHome: 5,
      telemetryIntervalSeconds: 60,
      allowRealtimeWebSocket: false,
      allowAutonomousControl: false,
      geminiCallsPerDay: 10,
      usedGeminiCallsToday: 0,
    });

    tenantRepo.createHome({
      id: homeA,
      tenantId: tenantA,
      name: 'Home A',
      address: 'Addr A',
      city: 'Istanbul',
      housingType: 'APARTMENT_FLAT',
      squareMeters: 100,
      residentCount: 2,
      meterInfrastructure: 'IN_UNIT_BREAKER_PANEL',
      primaryHeating: 'HEAT_PUMP',
      hasSolarPv: false,
      hasEvCharger: false,
      tariffPlan: 'TURKISH_EPDK_3_TIME',
      isPrimary: true,
      createdAt: new Date().toISOString(),
    });

    tenantRepo.createHome({
      id: homeB,
      tenantId: tenantB,
      name: 'Home B',
      address: 'Addr B',
      city: 'Ankara',
      housingType: 'APARTMENT_FLAT',
      squareMeters: 100,
      residentCount: 2,
      meterInfrastructure: 'IN_UNIT_BREAKER_PANEL',
      primaryHeating: 'HEAT_PUMP',
      hasSolarPv: false,
      hasEvCharger: false,
      tariffPlan: 'TURKISH_EPDK_3_TIME',
      isPrimary: true,
      createdAt: new Date().toISOString(),
    });
  });

  it('stores only salted SHA-256 hashes in database table, never raw plaintext tokens', () => {
    const { plainToken, record } = pairingRepo.generatePairingToken(tenantA, homeA, 'SMART_PLUG', 'SMART_PLUG');
    expect(plainToken.length).toBe(8);

    // Query raw database row directly
    const dbRow = dbService.getDb().prepare(`SELECT * FROM pairing_tokens WHERE tenant_id = ?`).get(tenantA) as any;
    expect(dbRow).toBeDefined();

    // Plaintext token must NEVER appear anywhere in the database row!
    expect(dbRow.token_hash).not.toBe(plainToken);
    expect(dbRow.token_hash.length).toBe(64); // SHA-256 hex string
    expect(dbRow.token_salt).toBeDefined();
    expect(JSON.stringify(dbRow)).not.toContain(plainToken);
  });

  it('prevents concurrent double-redemption via atomic compare-and-swap SQL guarantee', async () => {
    const { plainToken } = pairingRepo.generatePairingToken(tenantA, homeA, 'SUB_METER_RELAY', 'LOCAL_GATEWAY');

    // Launch two concurrent redemption attempts simultaneously
    const attempt1 = Promise.resolve(
      pairingRepo.redeemPairingToken(tenantA, plainToken, { name: 'Device Worker 1' }, '10.0.0.1')
    );
    const attempt2 = Promise.resolve(
      pairingRepo.redeemPairingToken(tenantA, plainToken, { name: 'Device Worker 2' }, '10.0.0.2')
    );

    const [res1, res2] = await Promise.all([attempt1, attempt2]);

    // Exactly one attempt must succeed and one must be rejected
    const successCount = (res1.success ? 1 : 0) + (res2.success ? 1 : 0);
    expect(successCount).toBe(1);

    const failed = res1.success ? res2 : res1;
    expect(failed.success).toBe(false);
    expect(failed.error).toMatch(/already been consumed|concurrently consumed/i);
  });

  it('strictly blocks cross-tenant redemption attempts', () => {
    // Generate token under Tenant A
    const { plainToken } = pairingRepo.generatePairingToken(tenantA, homeA, 'SMART_PLUG', 'SMART_PLUG');

    // Tenant B attempts to redeem Tenant A's token
    const crossAttempt = pairingRepo.redeemPairingToken(tenantB, plainToken, { name: 'Intruder Plug' });
    expect(crossAttempt.success).toBe(false);
    expect(crossAttempt.error).toMatch(/Invalid pairing token|Access denied/i);
  });

  it('locks out pairing attempts after 5 consecutive failures per IP and tenant', () => {
    const attackerIp = '198.51.100.42';
    const fakeToken = 'INVALID9';

    for (let i = 0; i < 5; i++) {
      const res = pairingRepo.redeemPairingToken(tenantA, fakeToken, { name: 'Brute' }, attackerIp);
      expect(res.success).toBe(false);
    }

    // 6th attempt is blocked by lockout
    const sixth = pairingRepo.redeemPairingToken(tenantA, fakeToken, { name: 'Brute' }, attackerIp);
    expect(sixth.success).toBe(false);
    expect(sixth.error).toMatch(/locked/i);
  });
});
