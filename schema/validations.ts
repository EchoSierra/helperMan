import { z } from 'zod';

/**
 * Validation schemas for the various entities in the system.
 * These ensure data integrity at the application layer before hitting the database.
 */

export const UserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']),
  role: z.enum(['EMPLOYEE', 'MAINTAINER', 'ADMIN']),
});

export const IdentitySchema = z.object({
  profileData: z.any().optional(), // Dynamic JSON data
});

export const QualificationSchema = z.object({
  title: z.string().min(1, "Qualification title is required"),
  category: z.string().optional(),
  issuer: z.string().optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  isVerified: z.boolean().default(false),
  metadata: z.any().optional(), // Dynamic JSON data
});

export const EquipmentSchema = z.object({
  name: z.string().min(1, "Equipment name is required"),
  type: z.string().optional(),
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'IN_REPAIR']),
  attributes: z.any().optional(), // Dynamic JSON data
});

export const AuditLogSchema = z.object({
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'PERMISSION_CHANGE']),
  actorId: z.string().optional(),
  targetType: z.string(),
  targetId: z.string().optional(),
  oldValue: z.any().optional(),
  newValue: z.any().optional(),
  ipAddress: z.string().optional(),
  timestamp: z.coerce.date().default(() => new Date()),
});
