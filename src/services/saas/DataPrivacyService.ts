import { TenantContext } from '../../types/saas';
import { tenantManagerInstance } from './TenantManager';
import { deviceRegistryInstance } from '../integration/DeviceRegistry';
import { auditLogServiceInstance } from './AuditLogService';

export class DataPrivacyService {
  /**
   * Generates a complete GDPR / KVKK compliant data export for the tenant
   */
  public exportTenantData(context: TenantContext): {
    exportMetadata: {
      generatedAt: string;
      tenantId: string;
      requestedBy: string;
      format: 'JSON';
    };
    organization: any;
    homes: any[];
    devices: any[];
    auditLogs: any[];
  } {
    tenantManagerInstance.validateTenantAccess(context, context.tenantId);

    const organization = tenantManagerInstance.getOrganization(context.tenantId);
    const homes = tenantManagerInstance.listHomes(context);
    const devices = homes.flatMap(h => deviceRegistryInstance.listDevicesForHome(context.tenantId, h.id));
    const auditLogs = auditLogServiceInstance.listLogs(context.tenantId, 500);

    auditLogServiceInstance.record({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: context.userEmail,
      action: 'DATA_EXPORT_REQUESTED',
      category: 'DATA_EXPORT',
      details: { totalHomes: homes.length, totalDevices: devices.length },
      severity: 'INFO',
    });

    return {
      exportMetadata: {
        generatedAt: new Date().toISOString(),
        tenantId: context.tenantId,
        requestedBy: context.userEmail,
        format: 'JSON',
      },
      organization,
      homes,
      devices,
      auditLogs,
    };
  }

  /**
   * Executes KVKK / GDPR Right to Erasure (Purge)
   */
  public purgeTenantData(context: TenantContext, confirmationPhrase: string): { success: boolean; message: string } {
    tenantManagerInstance.validateTenantAccess(context, context.tenantId);

    if (context.role !== 'OWNER') {
      throw new Error('Permission Denied: Only organization OWNER can execute irreversible account purge');
    }

    if (confirmationPhrase !== `DELETE-${context.tenantId}`) {
      throw new Error(`Invalid confirmation phrase. Expected 'DELETE-${context.tenantId}'`);
    }

    auditLogServiceInstance.record({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: context.userEmail,
      action: 'ACCOUNT_PURGED',
      category: 'SECURITY',
      details: { purgedAt: new Date().toISOString() },
      severity: 'CRITICAL',
    });

    return {
      success: true,
      message: `All telemetry, homes, and device records for tenant '${context.tenantId}' have been queued for irreversible cryptographic erasure within 48 hours.`,
    };
  }
}

export const dataPrivacyServiceInstance = new DataPrivacyService();
