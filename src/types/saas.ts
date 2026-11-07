/**
 * AETHER Multi-Tenant SaaS, RBAC, Subscriptions & Audit Types
 */

export type UserRole = 
  | 'OWNER' 
  | 'ENERGY_MANAGER' 
  | 'ANALYST' 
  | 'AUDITOR' 
  | 'RESIDENT_VIEWER';

export interface TenantContext {
  tenantId: string;
  userId: string;
  userEmail: string;
  role: UserRole;
  accessibleHomeIds: string[]; // If empty and role is OWNER/ENERGY_MANAGER, has access to all homes in tenant
}

export type SubscriptionTier = 
  | 'STARTER_HOME'      // Free / Trial (1 home, 3 devices, 1-min telemetry)
  | 'SMART_RESIDENCE'   // Pro (up to 5 homes, 25 devices, 1 Hz real-time, Full NILM)
  | 'ESTATE_ENTERPRISE';// Unlimited homes & devices, dedicated LLM capacity, custom SLA

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED';
  currentPeriodEnd: string;
  maxHomes: number;
  maxDevicesPerHome: number;
  telemetryIntervalSeconds: number;
  allowRealtimeWebSocket: boolean;
  allowAutonomousControl: boolean; // Always false by default for safety
  geminiCallsPerDay: number;
  usedGeminiCallsToday: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  plan: SubscriptionPlan;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  assignedHomeIds: string[];
  invitedAt: string;
  joinedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  action: string;
  category: 'AUTH' | 'SECURITY' | 'PAIRING' | 'DEVICE' | 'SUBSCRIPTION' | 'AI_DECISION' | 'DATA_EXPORT';
  details: Record<string, any>;
  ipAddress?: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}
