import { z } from 'zod';
import type { AuditLogEntry } from '../types/erp';
import { getCryptographicRandomHex } from './auth.ts';

/**
 * Zod Schema for validating full ERP Backup & Restore bundles.
 */
export const ErpBackupSchema = z.object({
  version: z.string().min(1),
  exportedAt: z.string().min(1),
  institution: z.string().optional(),
  data: z.object({
    students: z.array(
      z.object({
        id: z.string().min(1),
        rollNo: z.string().min(1),
        name: z.string().min(1),
        course: z.string().min(1),
        semester: z.number().int().min(1).max(12),
        totalFee: z.number().min(0).optional().default(0),
        paidFee: z.number().min(0).optional().default(0),
        pendingFee: z.number().min(0).optional().default(0),
      }).passthrough()
    ),
    transactions: z.array(
      z.object({
        id: z.string().min(1),
        studentId: z.string().min(1),
        amount: z.number().min(0),
        status: z.enum(['Success', 'Pending', 'Failed']),
      }).passthrough()
    ).optional().default([]),
    grades: z.array(
      z.object({
        id: z.string().min(1),
        studentId: z.string().min(1),
        subjectCode: z.string().min(1),
        semester: z.number().int().min(1).max(12),
        totalMarks: z.number().min(0),
      }).passthrough()
    ).optional().default([]),
    attendance: z.array(z.record(z.string(), z.unknown())).optional().default([]),
    feeHeads: z.array(z.record(z.string(), z.unknown())).optional().default([]),
    notices: z.array(z.record(z.string(), z.unknown())).optional().default([]),
    resultDeclarations: z.array(z.record(z.string(), z.unknown())).optional().default([]),
    auditLogs: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  }).passthrough(),
});

export type ValidatedErpBackup = z.infer<typeof ErpBackupSchema>;

export interface BackupValidationResult {
  valid: boolean;
  data?: ValidatedErpBackup;
  errors: string[];
  issues?: string[];
}

/**
 * Validates an untrusted JSON backup object against the strict Zod institutional schema.
 */
export function validateErpBackupBundle(payload: unknown): BackupValidationResult {
  const parsed = ErpBackupSchema.safeParse(payload);
  if (parsed.success) {
    return { valid: true, data: parsed.data, errors: [], issues: [] };
  }
  const errors = parsed.error.issues.map(
    (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`
  );
  return { valid: false, errors, issues: errors };
}

/**
 * Constructs an immutable audit trail entry recording who, when, oldValue, and newValue.
 */
export function buildAuditLogEntry(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  module?: AuditLogEntry['module'];
  entityType?: AuditLogEntry['entityType'];
  entityId?: string;
  action: string;
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  summary?: string;
}): AuditLogEntry {
  return {
    id: `AUD-${Date.now()}-${getCryptographicRandomHex(4).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    actorId: params.actorId || 'SYSTEM',
    actorName: params.actorName || 'Institutional System',
    actorRole: params.actorRole || 'system',
    module: params.module || params.entityType || 'SYSTEM',
    entityType: params.entityType || (params.module as AuditLogEntry['entityType']) || 'SYSTEM',
    entityId: params.entityId || params.targetId || 'SYSTEM',
    action: params.action,
    targetId: params.targetId || params.entityId || 'SYSTEM',
    oldValue: params.oldValue,
    newValue: params.newValue,
    reason: params.reason,
    summary: params.summary || params.reason,
  };
}
