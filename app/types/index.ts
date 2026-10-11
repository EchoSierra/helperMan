export type UserRole = 'EMPLOYEE' | 'MAINTAINER' | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

export type AppStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'AVAILABLE' | 'ASSIGNED' | 'IN_REPAIR';

// Identity Data
export interface IdentityProfile {
  blood_group?: string;
  preferred_contact?: string;
  access_level?: string;
  [key: string]: any; // For dynamic fields
}

// Qualification Data
export interface Qualification {
  id: string;
  userId: string;
  title: string;
  category: string;
  issuer: string;
  validFrom: Date;
  validUntil: Date;
  isVerified: boolean;
  metadata: Record<string, any>; // For dynamic attributes
}

// Equipment Data
export interface EquipmentItem {
  id: string;
  name: string;
  type: string;
  status: AppStatus;
  currentHolderId?: string;
  attributes: Record<string, any>;
}

// Audit Log
export interface AuditLogEntry {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'PERMISSION_CHANGE';
  actorId: string;
  targetType: 'USER' | 'IDENTITY' | 'QUALIFICATION' | 'EQUIPMENT' | 'SYSTEM';
  targetId: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  timestamp: Date;
}
