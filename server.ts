import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import {
  isBcryptHash,
  validatePasswordComplexity,
  issuePasswordResetToken,
  verifyPasswordResetToken,
  constantTimeEqual,
} from './src/domain/auth.ts';
import {
  getFinancialYearCode,
  normalizeFinancialYearCode,
  formatSequentialReceiptNumber,
  toPaisa,
} from './src/domain/fees.ts';
import { canUserAccessModule } from './src/domain/rbac/permissions.ts';
import {
  validateErpBackupBundle,
  buildAuditLogEntry,
} from './src/domain/reports.ts';
import {
  checkPostDeclarationGradeLock,
  buildGradeUnlockRequest,
} from './src/domain/grades.ts';
import type {
  AuditLogEntry,
  ModulePermissionMap,
  SemesterResultDeclaration,
  UserAccount,
  UserRole,
} from './src/types/erp.ts';

// ---------------------------------------------------------------------------
// Load .env safely at boot (zero external dependencies) before reading secrets
// ---------------------------------------------------------------------------
function loadDotEnvIfPresent(): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn('[ENV WARNING] Could not parse .env file:', (err as Error).message);
  }
}

loadDotEnvIfPresent();

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = Number(process.argv[portArgIndex + 1]);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return Number(process.env.PORT || 3000);
}

function getHost(): string {
  const hostArgIndex = process.argv.indexOf('--host');
  if (hostArgIndex !== -1 && process.argv[hostArgIndex + 1]) {
    return process.argv[hostArgIndex + 1];
  }
  return process.env.HOST || '0.0.0.0';
}

const PORT = getPort();
const HOST = getHost();
const SESSION_COOKIE_NAME = 'rlsy_erp_sid';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_SESSION_SECRET = 'change-this-in-production-hmac-secret-256bit';
const PLACEHOLDER_WEBHOOK_SECRET = 'whsec_institutional_reconciliation_secret';

const isProductionMode =
  process.env.NODE_ENV === 'production' ||
  process.argv.includes('--prod') ||
  process.env.npm_lifecycle_event === 'start';

export const ERP_SESSION_SECRET = (() => {
  const envSecret = (process.env.ERP_SESSION_SECRET || '').trim();
  if (
    envSecret.length >= MIN_SECRET_LENGTH &&
    envSecret !== PLACEHOLDER_SESSION_SECRET
  ) {
    return envSecret;
  }
  console.warn(
    `[SECURITY WARNING] ERP_SESSION_SECRET is missing, shorter than ${MIN_SECRET_LENGTH} chars, or uses the example placeholder. Generating ephemeral 256-bit secret.`
  );
  return crypto.randomBytes(32).toString('hex');
})();

const WEBHOOK_SECRET = (() => {
  const envWebhook = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (
    envWebhook.length >= 16 &&
    envWebhook !== PLACEHOLDER_WEBHOOK_SECRET
  ) {
    return envWebhook;
  }
  console.warn(
    '[SECURITY WARNING] RAZORPAY_WEBHOOK_SECRET unset or using .env.example placeholder. Generating ephemeral 256-bit webhook secret.'
  );
  return crypto.randomBytes(32).toString('hex');
})();

interface ServerPaymentOrder {
  orderId: string;
  studentId: string;
  studentRollNo?: string;
  amountPaisa: number;
  feeHeadTitle: string;
  status: 'Pending' | 'Paid';
  createdBy: string;
  createdAt: number;
  paidAt?: number;
  paymentId?: string;
  receiptNo?: string;
}

interface ServerResetTokenRecord {
  tokenHash: string;
  userId: string;
  expiresAt: number;
}

interface ServerLockoutRecord {
  failedAttempts: number;
  lockedUntil: number;
}

interface ServerStudentRosterEntry {
  id: string;
  rollNo: string;
  dob?: string;
  name: string;
  email?: string;
  phone?: string;
  course: string;
  semester: number;
}

interface ServerStateStore {
  receiptSequencesByFY: Record<string, number>;
  auditLogs: AuditLogEntry[];
  users: UserAccount[];
  paymentOrders: Record<string, ServerPaymentOrder>;
  studentRoster: ServerStudentRosterEntry[];
  revokedSessionIds: Record<string, number>;
  loginLockouts: Record<string, ServerLockoutRecord>;
  activeResetTokens: Record<string, ServerResetTokenRecord>;
}

const BASELINE_SERVER_USERS: UserAccount[] = [
  {
    id: 'USR-SUPERADMIN',
    email: 'kumaripallawi061@gmail.com',
    mobile: '9800011111',
    password: '$2b$12$bys1JZYtSzMCDscs/TnOW.7I8Vuuzz6TvlPMNuKoEHpS5YBhtFhnm',
    name: 'Pallawi Kumari',
    role: 'superadmin',
    mustChangePassword: false,
    authProvider: 'google',
    createdAt: '2026-01-10 10:00 AM',
    designation: 'Executive Trustee & Super Admin',
    status: 'active',
    isActive: true,
    sessionVersion: 1,
  },
  {
    id: 'USR-PRINCIPAL',
    email: 'principal@rlsy.ac.in',
    mobile: '9431100001',
    password: '$2b$12$1TyxsXJUMGle13t2XJ9R5.Sc0Vb7vuGSmF2RxYq.KaTGH/dwQAU8y',
    name: 'Dr. S. N. Sharma',
    role: 'principal',
    mustChangePassword: true,
    onboardedBy: 'USR-SUPERADMIN',
    createdAt: '2026-01-15 11:30 AM',
    designation: 'Principal & Chief Executive DDO',
    status: 'active',
    isActive: true,
    sessionVersion: 1,
  },
  {
    id: 'USR-ACCOUNTANT',
    email: 'accountant@rlsy.ac.in',
    mobile: '9431100002',
    password: '$2b$12$SZbXZRFmj0sLBePFNAZTc.6M3WrGOXgM3MxE1uuKULpyIWWs1UCZG',
    name: 'Shri R. K. Jha',
    role: 'accountant',
    mustChangePassword: true,
    onboardedBy: 'USR-SUPERADMIN',
    createdAt: '2026-01-15 11:45 AM',
    designation: 'Senior Accounts Officer & Cashier',
    status: 'active',
    isActive: true,
    sessionVersion: 1,
  },
  {
    id: 'USR-FAC-001',
    email: 'rajesh.verma@rlsy.ac.in',
    mobile: '9431287654',
    password: '$2b$12$ZAFYrhCkZ1RV7OlW74lZPuOt35zcgTrQrAUbChVGtoo/THo1dzvWi',
    name: 'Prof. Rajesh Verma',
    role: 'faculty',
    mustChangePassword: true,
    onboardedBy: 'USR-PRINCIPAL',
    createdAt: '2026-02-01 09:00 AM',
    designation: 'Head of Department & Professor',
    department: 'Computer Science & Engineering',
    facultyId: 'FAC-001',
    status: 'active',
    isActive: true,
    sessionVersion: 1,
  },
  {
    id: 'USR-FAC-002',
    email: 'ananya.sen@rlsy.ac.in',
    mobile: '9431287655',
    password: '$2b$12$qJjEYRKf4a.7LSaLRlB71OyErbV7j/2EEHLsZatndGOOfR.3iCaGa',
    name: 'Dr. Ananya Sen',
    role: 'faculty',
    mustChangePassword: true,
    onboardedBy: 'USR-PRINCIPAL',
    createdAt: '2026-02-01 09:15 AM',
    designation: 'Associate Professor',
    department: 'Computer Science & Engineering',
    facultyId: 'FAC-002',
    status: 'active',
    isActive: true,
    sessionVersion: 1,
  },
  {
    id: 'USR-FAC-003',
    email: 'meenakshi.roy@rlsy.ac.in',
    mobile: '9431287656',
    password: '$2b$12$WLeWfFdq7bkURTMKU8lj0ufov1avtOu2xo/kU.Mj8RgujQsqQiqIW',
    name: 'Dr. Meenakshi Roy',
    role: 'faculty',
    mustChangePassword: true,
    onboardedBy: 'USR-PRINCIPAL',
    createdAt: '2026-10-18 02:00 PM',
    designation: 'Assistant Professor',
    department: 'Mathematics & Computing',
    facultyId: 'FAC-003',
    status: 'active',
    isActive: true,
    sessionVersion: 1,
  },
  {
    id: 'USR-STU-101',
    email: 'aarav.kumar@rlsy.ac.in',
    mobile: '9876543210',
    password: '$2b$12$4ZJozHZgegv8.OFLVxjWN.mnKO8LvhICr/g8HJtRCEG7FceZQ5kdW',
    name: 'Aarav Kumar',
    role: 'student',
    mustChangePassword: true,
    createdAt: '2026-07-20 10:00 AM',
    rollNo: '2025CS001',
    studentId: 'STU-101',
    status: 'active',
    isActive: true,
    sessionVersion: 1,
  },
  {
    id: 'USR-STU-102',
    email: 'priya.sharma@rlsy.ac.in',
    mobile: '9876543211',
    password: '$2b$12$IRNJROrROPg2RLOro4OQIu86MZs8c1jfYB.It6b2xlssuctZjCgnq',
    name: 'Priya Sharma',
    role: 'student',
    mustChangePassword: true,
    createdAt: '2026-07-20 10:15 AM',
    rollNo: '2025CS002',
    studentId: 'STU-102',
    status: 'active',
    isActive: true,
    sessionVersion: 1,
  },
  {
    id: 'USR-LIBRARIAN',
    email: 'librarian@rlsy.ac.in',
    mobile: '9431100003',
    password: '$2b$12$729FPWQIk3BMrGIYqJcYH.LAM62aPjT.Pzz/4.AZv11A5wg2n69IW',
    name: 'Dr. Sunita Mishra',
    role: 'librarian',
    mustChangePassword: true,
    onboardedBy: 'USR-SUPERADMIN',
    createdAt: '2026-03-01 10:00 AM',
    designation: 'Chief Librarian & Archival Head',
    status: 'active',
    isActive: true,
    sessionVersion: 1,
  },
  {
    id: 'USR-DEAN-ACAD',
    email: 'dean@rlsy.ac.in',
    mobile: '9431100004',
    password: '$2b$12$hiKkPbJlzZ0vK4S9HauhG.V9DyB.v8CCRWZRrFmEoVIq7AAnXzgRW',
    name: 'Prof. Harish Chandra',
    role: 'dean_academics',
    mustChangePassword: true,
    onboardedBy: 'USR-SUPERADMIN',
    createdAt: '2026-03-05 11:00 AM',
    designation: 'Dean of Academics & Examination',
    status: 'active',
    isActive: true,
    sessionVersion: 1,
  },
];

const BASELINE_STUDENT_ROSTER: ServerStudentRosterEntry[] = [
  {
    id: 'STU-101',
    rollNo: '2025CS001',
    dob: '2004-05-15',
    name: 'Aarav Kumar',
    email: 'aarav.kumar@rlsy.ac.in',
    phone: '+91 98765 43210',
    course: 'B.Tech Computer Science & Engineering',
    semester: 5,
  },
  {
    id: 'STU-102',
    rollNo: '2025CS002',
    dob: '2004-08-22',
    name: 'Priya Sharma',
    email: 'priya.sharma@rlsy.ac.in',
    phone: '+91 98765 43211',
    course: 'B.Tech Computer Science & Engineering',
    semester: 5,
  },
  {
    id: 'STU-103',
    rollNo: '2025CS003',
    dob: '2004-11-03',
    name: 'Rahul Verma',
    email: 'rahul.verma@rlsy.ac.in',
    phone: '+91 98765 43212',
    course: 'B.Tech Computer Science & Engineering',
    semester: 5,
  },
  {
    id: 'STU-104',
    rollNo: '2025CS004',
    dob: '2004-02-19',
    name: 'Ananya Roy',
    email: 'ananya.roy@rlsy.ac.in',
    phone: '+91 98765 43213',
    course: 'B.Tech Computer Science & Engineering',
    semester: 5,
  },
  {
    id: 'STU-105',
    rollNo: '2025CS005',
    dob: '2004-07-09',
    name: 'Vikramaditya Singh',
    email: 'vikram.singh@rlsy.ac.in',
    phone: '+91 98765 43214',
    course: 'B.Tech Computer Science & Engineering',
    semester: 5,
  },
  {
    id: 'STU-106',
    rollNo: '2025CS006',
    dob: '2004-09-27',
    name: 'Sneha Patel',
    email: 'sneha.patel@rlsy.ac.in',
    phone: '+91 98765 43215',
    course: 'B.Tech Computer Science & Engineering',
    semester: 5,
  },
  {
    id: 'STU-107',
    rollNo: '2025CS007',
    dob: '2004-12-12',
    name: 'Mohammad Zaid',
    email: 'm.zaid@rlsy.ac.in',
    phone: '+91 98765 43216',
    course: 'B.Tech Computer Science & Engineering',
    semester: 5,
  },
  {
    id: 'STU-108',
    rollNo: '2025CS008',
    dob: '2004-04-30',
    name: 'Divya Nair',
    email: 'divya.nair@rlsy.ac.in',
    phone: '+91 98765 43217',
    course: 'B.Tech Computer Science & Engineering',
    semester: 5,
  },
];

const SERVER_STATE_FILE = process.env.ERP_SERVER_STATE_FILE
  ? path.resolve(process.env.ERP_SERVER_STATE_FILE)
  : path.resolve(process.cwd(), '.erp-server-state.json');

function isSafeRecordKey(k: string): boolean {
  return Boolean(k && k !== '__proto__' && k !== 'constructor' && k !== 'prototype');
}

function toNullProtoSeqMap(input: unknown): Record<string, number> {
  const map: Record<string, number> = Object.create(null);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return map;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      map[k] = Math.floor(v);
    }
  }
  return map;
}

function toNullProtoOrdersMap(input: unknown): Record<string, ServerPaymentOrder> {
  const map: Record<string, ServerPaymentOrder> = Object.create(null);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return map;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (isSafeRecordKey(k) && v && typeof v === 'object') {
      map[k] = v as ServerPaymentOrder;
    }
  }
  return map;
}

function toNullProtoRevokedMap(input: unknown): Record<string, number> {
  const map: Record<string, number> = Object.create(null);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return map;
  const now = Date.now();
  for (const [sid, exp] of Object.entries(input as Record<string, unknown>)) {
    if (isSafeRecordKey(sid) && typeof exp === 'number' && Number.isFinite(exp) && exp > now) {
      map[sid] = exp;
    }
  }
  return map;
}

function toNullProtoLockoutsMap(input: unknown): Record<string, ServerLockoutRecord> {
  const map: Record<string, ServerLockoutRecord> = Object.create(null);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return map;
  const now = Date.now();
  for (const [id, rec] of Object.entries(input as Record<string, unknown>)) {
    if (!isSafeRecordKey(id) || !rec || typeof rec !== 'object') continue;
    const r = rec as Partial<ServerLockoutRecord>;
    const failedAttempts = typeof r.failedAttempts === 'number' && Number.isFinite(r.failedAttempts) ? r.failedAttempts : 0;
    const lockedUntil = typeof r.lockedUntil === 'number' && Number.isFinite(r.lockedUntil) ? r.lockedUntil : 0;
    // Keep active lockouts OR in-progress failure counts
    if ((lockedUntil > now) || (lockedUntil === 0 && failedAttempts > 0)) {
      map[id] = { failedAttempts, lockedUntil };
    }
  }
  return map;
}

function toNullProtoResetTokensMap(input: unknown): Record<string, ServerResetTokenRecord> {
  const map: Record<string, ServerResetTokenRecord> = Object.create(null);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return map;
  const now = Date.now();
  for (const [hash, rec] of Object.entries(input as Record<string, unknown>)) {
    if (!isSafeRecordKey(hash) || !rec || typeof rec !== 'object') continue;
    const r = rec as Partial<ServerResetTokenRecord>;
    if (
      typeof r.tokenHash === 'string' &&
      typeof r.userId === 'string' &&
      typeof r.expiresAt === 'number' &&
      Number.isFinite(r.expiresAt) &&
      r.expiresAt > now
    ) {
      map[hash] = { tokenHash: r.tokenHash, userId: r.userId, expiresAt: r.expiresAt };
    }
  }
  return map;
}

function loadServerState(): ServerStateStore {
  if (!fs.existsSync(SERVER_STATE_FILE)) {
    return {
      receiptSequencesByFY: Object.create(null),
      auditLogs: [],
      users: BASELINE_SERVER_USERS.map((u) => ({ ...u })),
      paymentOrders: Object.create(null),
      studentRoster: BASELINE_STUDENT_ROSTER.map((s) => ({ ...s })),
      revokedSessionIds: Object.create(null),
      loginLockouts: Object.create(null),
      activeResetTokens: Object.create(null),
    };
  }

  let raw = '';
  try {
    raw = fs.readFileSync(SERVER_STATE_FILE, 'utf-8');
  } catch (err) {
    throw new Error(`Fatal: Cannot read server state file "${SERVER_STATE_FILE}": ${(err as Error).message}`);
  }

  let parsed: Partial<ServerStateStore>;
  try {
    parsed = JSON.parse(raw) as Partial<ServerStateStore>;
  } catch (err) {
    const backupPath = `${SERVER_STATE_FILE}.corrupt.${Date.now()}.json`;
    try {
      fs.copyFileSync(SERVER_STATE_FILE, backupPath);
    } catch {}
    throw new Error(
      `Fatal: Corrupted server state JSON detected in "${SERVER_STATE_FILE}". Backed up to "${backupPath}". Refusing to reset receipt sequences: ${(err as Error).message}`
    );
  }

  return {
    receiptSequencesByFY: toNullProtoSeqMap(parsed.receiptSequencesByFY),
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs.slice(0, 1000) : [],
    users:
      Array.isArray(parsed.users) && parsed.users.length > 0
        ? parsed.users
        : BASELINE_SERVER_USERS.map((u) => ({ ...u })),
    paymentOrders: toNullProtoOrdersMap(parsed.paymentOrders),
    studentRoster:
      Array.isArray(parsed.studentRoster) && parsed.studentRoster.length > 0
        ? parsed.studentRoster
        : BASELINE_STUDENT_ROSTER.map((s) => ({ ...s })),
    revokedSessionIds: toNullProtoRevokedMap(parsed.revokedSessionIds),
    loginLockouts: toNullProtoLockoutsMap(parsed.loginLockouts),
    activeResetTokens: toNullProtoResetTokensMap(parsed.activeResetTokens),
  };
}

function pruneExpiredSecurityState(state: ServerStateStore): void {
  const now = Date.now();
  for (const [sid, exp] of Object.entries(state.revokedSessionIds)) {
    if (!Number.isFinite(exp) || exp <= now) {
      delete state.revokedSessionIds[sid];
    }
  }
  for (const [id, rec] of Object.entries(state.loginLockouts)) {
    if (rec.lockedUntil > 0 && rec.lockedUntil <= now) {
      delete state.loginLockouts[id];
    }
  }
  for (const [hash, rec] of Object.entries(state.activeResetTokens)) {
    if (!Number.isFinite(rec.expiresAt) || rec.expiresAt <= now) {
      delete state.activeResetTokens[hash];
    }
  }
}

function saveServerState(state: ServerStateStore): void {
  pruneExpiredSecurityState(state);
  const serializable = {
    receiptSequencesByFY: { ...state.receiptSequencesByFY },
    auditLogs: state.auditLogs.slice(0, 1000),
    users: state.users,
    paymentOrders: { ...state.paymentOrders },
    studentRoster: state.studentRoster,
    revokedSessionIds: { ...state.revokedSessionIds },
    loginLockouts: { ...state.loginLockouts },
    activeResetTokens: { ...state.activeResetTokens },
  };
  const tmpFile = `${SERVER_STATE_FILE}.tmp.${process.pid}.${crypto.randomBytes(4).toString('hex')}`;
  try {
    const fd = fs.openSync(tmpFile, 'w', 0o600);
    try {
      fs.writeSync(fd, JSON.stringify(serializable, null, 2), undefined, 'utf-8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpFile, SERVER_STATE_FILE);
  } catch (err) {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
    console.error('[PERSISTENCE ERROR] Failed to save server state atomically:', (err as Error).message);
    throw err;
  }
}

const serverState = loadServerState();

function appendServerAuditLog(entry: AuditLogEntry): void {
  serverState.auditLogs.unshift(entry);
  if (serverState.auditLogs.length > 1000) {
    serverState.auditLogs = serverState.auditLogs.slice(0, 1000);
  }
}

// Ephemeral in-memory rate-limit window tracker (security lockouts, revoked sessions, reset tokens are persisted in serverState)
const rateLimitBuckets = new Map<string, number[]>();

function checkRateLimit(bucketKey: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateLimitBuckets.get(bucketKey) || []).filter((ts) => now - ts < windowMs);
  if (timestamps.length >= maxRequests) {
    rateLimitBuckets.set(bucketKey, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitBuckets.set(bucketKey, timestamps);
  return true;
}

function sanitizeUserForClient(user: UserAccount): UserAccount {
  const { resetToken: _rt, tempPassword: _tp, ...rest } = user as UserAccount & {
    resetToken?: string;
    tempPassword?: string;
  };
  return {
    ...rest,
    password: '[REDACTED]',
    salt: undefined,
  };
}

interface ServerSessionPayload {
  sid: string;
  userId: string;
  role: UserRole;
  sessionVersion: number;
  iat: number;
  exp: number;
}

function signServerSessionCookie(user: UserAccount): string {
  const now = Date.now();
  const payload: ServerSessionPayload = {
    sid: crypto.randomBytes(16).toString('hex'),
    userId: user.id,
    role: user.role,
    sessionVersion: user.sessionVersion || 1,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', ERP_SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function verifyServerSessionToken(rawToken: string | undefined): { valid: boolean; user?: UserAccount; payload?: ServerSessionPayload; error?: string } {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, error: 'Authentication required.' };
  }
  const parts = rawToken.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed session token.' };
  }
  const [encoded, providedSig] = parts;
  const expectedSig = crypto.createHmac('sha256', ERP_SESSION_SECRET).update(encoded).digest('base64url');
  if (!constantTimeEqual(providedSig, expectedSig)) {
    return { valid: false, error: 'Invalid session signature.' };
  }

  let payload: ServerSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as ServerSessionPayload;
  } catch {
    return { valid: false, error: 'Corrupt session payload.' };
  }

  const now = Date.now();
  if (!payload.sid || !payload.userId || now > payload.exp) {
    return { valid: false, error: 'Session expired.' };
  }

  // Prune expired revoked sessions
  for (const [sid, exp] of Object.entries(serverState.revokedSessionIds)) {
    if (!Number.isFinite(exp) || now > exp) delete serverState.revokedSessionIds[sid];
  }
  if (serverState.revokedSessionIds[payload.sid] !== undefined) {
    return { valid: false, error: 'Session has been revoked.' };
  }

  const user = serverState.users.find((u) => u.id === payload.userId);
  if (!user) {
    return { valid: false, error: 'User not found.' };
  }
  if (user.isActive === false || user.status === 'suspended') {
    return { valid: false, error: 'User account is suspended or inactive.' };
  }
  if ((user.sessionVersion || 1) !== (payload.sessionVersion || 1)) {
    return { valid: false, error: 'Session invalidated after password or privilege update.' };
  }
  if (user.role !== payload.role) {
    return { valid: false, error: 'Role mismatch detected.' };
  }

  return { valid: true, user, payload };
}

function revokeServerSessionId(sid: string, exp: number): void {
  if (!sid || !isSafeRecordKey(sid)) return;
  serverState.revokedSessionIds[sid] = Number.isFinite(exp) ? exp : Date.now() + SESSION_TTL_MS;
}

function extractSessionToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  const bearer =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
  if (bearer) return bearer;
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
}

function setSessionCookie(res: Response, token: string): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isProductionMode) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}

interface AuthenticatedRequest extends Request {
  authUser?: UserAccount;
  authSession?: ServerSessionPayload;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);
  const check = verifyServerSessionToken(token);
  if (!check.valid || !check.user) {
    res.status(401).json({ error: check.error || 'Authentication required.' });
    return;
  }
  req.authUser = check.user;
  req.authSession = check.payload;
  next();
}

function requireRoles(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: `Forbidden: Role "${req.authUser.role}" is not permitted for this operation.` });
      return;
    }
    next();
  };
}

function issueServerSideResetToken(user: UserAccount): string {
  const token = issuePasswordResetToken(user.id, user.password, 5 * 60 * 1000, ERP_SESSION_SECRET);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  serverState.activeResetTokens[tokenHash] = {
    tokenHash,
    userId: user.id,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  saveServerState(serverState);
  return token;
}

function consumeServerSideResetToken(token: string, targetUser: UserAccount): boolean {
  if (!token || typeof token !== 'string') return false;
  const validSig = verifyPasswordResetToken(token, targetUser.id, targetUser.password, ERP_SESSION_SECRET);
  if (!validSig) return false;
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const record = isSafeRecordKey(tokenHash) ? serverState.activeResetTokens[tokenHash] : undefined;
  if (!record || record.userId !== targetUser.id || Date.now() > record.expiresAt) {
    return false;
  }
  delete serverState.activeResetTokens[tokenHash];
  saveServerState(serverState);
  return true;
}

async function startServer() {
  const app = express();

  app.disable('x-powered-by');

  // Strict payload size limits: 100kb default, 10mb exclusively for backup validation
  const defaultJsonParser = express.json({ limit: '100kb' });
  const backupJsonParser = express.json({ limit: '10mb' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/backup/validate') {
      backupJsonParser(req, res, next);
      return;
    }
    defaultJsonParser(req, res, next);
  });

  // Malformed JSON error handler -> JSON 400 instead of Express HTML error page
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const syntaxErr = err as { status?: number; type?: string };
    if (syntaxErr && (syntaxErr.status === 400 || syntaxErr.type === 'entity.parse.failed')) {
      res.status(400).json({ error: 'Malformed JSON request payload.' });
      return;
    }
    if (syntaxErr && syntaxErr.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request payload exceeds size limit.' });
      return;
    }
    next(err);
  });

  const frameAncestors = (
    process.env.ALLOWED_FRAME_ANCESTORS ||
    (isProductionMode
      ? "'self'"
      : "'self' https://aistudio.google.com https://*.googleusercontent.com")
  ).trim();

  // Real HTTP Security & Cache Control Headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; font-src 'self' data: https:; img-src 'self' data: blob: https:; connect-src 'self' https: ws: wss:; frame-src 'self' https://accounts.google.com; worker-src 'self' blob:; frame-ancestors ${frameAncestors};`
    );
    if (req.path.startsWith('/api/') || req.path === '/' || req.path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // ---------------------------------------------------------------------------
  // 1. AUTHORITATIVE AUTHENTICATION, SESSION & BCRYPT PASSWORD ENDPOINTS
  // ---------------------------------------------------------------------------
  app.get('/api/auth/session', (req: Request, res: Response) => {
    const check = verifyServerSessionToken(extractSessionToken(req));
    if (!check.valid || !check.user) {
      res.status(401).json({ authenticated: false, error: check.error });
      return;
    }
    // Renew server session cookie on active session verification so server & client rolling TTLs stay aligned
    setSessionCookie(res, signServerSessionCookie(check.user));
    res.json({ authenticated: true, user: sanitizeUserForClient(check.user) });
  });

  app.post('/api/auth/session/refresh', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const renewedCookie = signServerSessionCookie(req.authUser!);
    setSessionCookie(res, renewedCookie);
    res.json({ authenticated: true, user: sanitizeUserForClient(req.authUser!) });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const check = verifyServerSessionToken(extractSessionToken(req));
    if (check.valid && check.payload) {
      revokeServerSessionId(check.payload.sid, check.payload.exp);
      saveServerState(serverState);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.post('/api/auth/hash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { password, context } = req.body as {
        password?: string;
        context?: { email?: string; mobile?: string; rollNo?: string };
      };
      if (!password || typeof password !== 'string') {
        res.status(400).json({ error: 'Password is required.' });
        return;
      }
      // Unconditionally enforce password complexity policy regardless of whether context is provided
      const policy = validatePasswordComplexity(password, context);
      if (!policy.valid) {
        res.status(400).json({ error: policy.error });
        return;
      }
      const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
      const hash = await bcrypt.hash(password, salt);
      res.json({ hash });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message || 'Hashing failed.' });
    }
  });

  app.post('/api/auth/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const ipKey = `verify:${req.ip || 'unknown'}`;
    if (!checkRateLimit(ipKey, 10, 60_000)) {
      res.status(429).json({ valid: false, error: 'Rate limit exceeded. Try again later.' });
      return;
    }
    try {
      const { candidate, storedHash } = req.body as {
        candidate?: string;
        storedHash?: string;
      };
      if (
        !candidate ||
        !storedHash ||
        typeof candidate !== 'string' ||
        typeof storedHash !== 'string' ||
        Buffer.byteLength(candidate, 'utf-8') > 72 ||
        candidate === storedHash ||
        !isBcryptHash(storedHash)
      ) {
        res.json({ valid: false });
        return;
      }
      const valid = await bcrypt.compare(candidate, storedHash);
      res.json({ valid });
    } catch {
      res.json({ valid: false });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(`login:${clientIp}`, 20, 60_000)) {
      res.status(429).json({ authenticated: false, error: 'Too many login attempts. Please wait a minute.' });
      return;
    }

    try {
      const { identifier, email, candidatePassword, password } = req.body as {
        identifier?: string;
        email?: string;
        candidatePassword?: string;
        password?: string;
      };
      const rawPassword = typeof password === 'string' ? password : candidatePassword;
      const rawIdentifier = (identifier || email || '').trim().toLowerCase();

      if (!rawIdentifier || !rawPassword || typeof rawPassword !== 'string') {
        res.status(400).json({ authenticated: false, error: 'Identifier and password are required.' });
        return;
      }

      const cleanDigits = rawIdentifier.replace(/\D/g, '');
      const canonicalPhoneDigits = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : '';
      const user = serverState.users.find(
        (u) =>
          (u.email || '').trim().toLowerCase() === rawIdentifier ||
          (u.rollNo && u.rollNo.trim().toLowerCase() === rawIdentifier) ||
          (u.studentId && u.studentId.trim().toLowerCase() === rawIdentifier) ||
          (canonicalPhoneDigits.length === 10 &&
            String(u.mobile || '').replace(/\D/g, '').slice(-10) === canonicalPhoneDigits)
      );

      // Canonical lockout keys prevent bypassing 5-attempt lockout by switching email/mobile/+91/rollNo
      const lockoutKeys = Array.from(
        new Set(
          [
            isSafeRecordKey(rawIdentifier) ? rawIdentifier : '',
            canonicalPhoneDigits ? `tel:${canonicalPhoneDigits}` : '',
            user && isSafeRecordKey(user.id) ? `uid:${user.id}` : '',
          ].filter(Boolean)
        )
      );

      const nowMs = Date.now();
      for (const lk of lockoutKeys) {
        const lockRec = serverState.loginLockouts[lk];
        if (lockRec && lockRec.lockedUntil > 0 && nowMs < lockRec.lockedUntil) {
          res.status(429).json({
            authenticated: false,
            error: 'Account temporarily locked due to repeated failed login attempts.',
          });
          return;
        }
      }

      const recordLoginFailure = (actorId: string, actorName: string, actorRole: string, reason: string) => {
        let maxAttempts = 0;
        for (const lk of lockoutKeys) {
          const prev = serverState.loginLockouts[lk];
          const base =
            prev && (!prev.lockedUntil || nowMs >= prev.lockedUntil)
              ? prev
              : { failedAttempts: 0, lockedUntil: 0 };
          const next = {
            failedAttempts: base.failedAttempts + 1,
            lockedUntil: base.failedAttempts + 1 >= 5 ? nowMs + 15 * 60 * 1000 : 0,
          };
          serverState.loginLockouts[lk] = next;
          if (next.failedAttempts > maxAttempts) maxAttempts = next.failedAttempts;
        }
        appendServerAuditLog(
          buildAuditLogEntry({
            actorId,
            actorName,
            actorRole,
            module: 'auth',
            action: 'USER_LOGIN_FAILED',
            targetId: actorId === 'ANONYMOUS' ? rawIdentifier : actorId,
            newValue: { reason, failedAttempts: maxAttempts, ip: clientIp },
          })
        );
        saveServerState(serverState);
      };

      if (!user) {
        recordLoginFailure('ANONYMOUS', rawIdentifier, 'anonymous', 'unknown_account');
        res.status(401).json({ authenticated: false, error: 'Invalid credentials.' });
        return;
      }

      if (
        Buffer.byteLength(rawPassword, 'utf-8') > 72 ||
        rawPassword === user.password ||
        !isBcryptHash(user.password)
      ) {
        recordLoginFailure(user.id, user.name, user.role, 'invalid_password_format');
        res.status(401).json({ authenticated: false, error: 'Invalid credentials.' });
        return;
      }

      const match = await bcrypt.compare(rawPassword, user.password);
      if (!match) {
        recordLoginFailure(user.id, user.name, user.role, 'invalid_password');
        res.status(401).json({ authenticated: false, error: 'Invalid credentials.' });
        return;
      }

      if (user.authProvider === 'google' || (user.email || '').trim().toLowerCase() === 'kumaripallawi061@gmail.com') {
        res.status(403).json({
          authenticated: false,
          error: 'Password login is disabled for Google-authenticated administrator accounts.',
        });
        return;
      }

      if (user.isActive === false || user.status === 'suspended') {
        res.status(403).json({ authenticated: false, error: 'Account is deactivated or suspended.' });
        return;
      }

      for (const lk of lockoutKeys) {
        delete serverState.loginLockouts[lk];
      }

      const sessionCookie = signServerSessionCookie(user);
      setSessionCookie(res, sessionCookie);

      const audit = buildAuditLogEntry({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        module: 'auth',
        action: 'USER_LOGIN_SUCCESS',
        targetId: user.id,
        newValue: { mustChangePassword: Boolean(user.mustChangePassword) },
      });
      appendServerAuditLog(audit);
      saveServerState(serverState);

      const resetToken = user.mustChangePassword
        ? issueServerSideResetToken(user)
        : undefined;

      res.json({
        authenticated: true,
        user: sanitizeUserForClient(user),
        mustChangePassword: Boolean(user.mustChangePassword),
        resetToken,
        auditEntry: audit,
      });
    } catch (err) {
      res.status(500).json({ authenticated: false, error: (err as Error).message });
    }
  });

  app.get('/api/auth/google-admin/status', (_req: Request, res: Response) => {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    res.json({
      enabled: clientId.length > 0,
      clientId: clientId.length > 0 ? clientId : undefined,
    });
  });

  app.post('/api/auth/google-admin', async (req: Request, res: Response) => {
    const configuredGoogleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!configuredGoogleClientId) {
      res.status(503).json({
        authenticated: false,
        oauthConfigured: false,
        error:
          'Google OAuth administrator login is disabled because GOOGLE_CLIENT_ID is not configured on the server.',
      });
      return;
    }

    const body = (req.body || {}) as { idToken?: string; credential?: string };
    const idToken =
      typeof body.idToken === 'string'
        ? body.idToken.trim()
        : typeof body.credential === 'string'
        ? body.credential.trim()
        : '';

    if (!idToken) {
      res.status(400).json({
        authenticated: false,
        error: 'A signed Google OAuth ID token is required. Unverified email login is prohibited.',
      });
      return;
    }

    let verifiedEmail = '';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const tokenInfoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
        { signal: controller.signal }
      ).finally(() => clearTimeout(timeout));

      if (!tokenInfoRes.ok) {
        res.status(401).json({ authenticated: false, error: 'Google OAuth ID token signature rejected.' });
        return;
      }

      const payload = (await tokenInfoRes.json()) as {
        aud?: string;
        iss?: string;
        exp?: string | number;
        email?: string;
        email_verified?: string | boolean;
      };

      const isValidIssuer =
        payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com';
      const isEmailVerified = payload.email_verified === true || payload.email_verified === 'true';
      const expMs = Number(payload.exp) * 1000;

      if (
        payload.aud !== configuredGoogleClientId ||
        !isValidIssuer ||
        !isEmailVerified ||
        !Number.isFinite(expMs) ||
        expMs <= Date.now()
      ) {
        res.status(401).json({
          authenticated: false,
          error: 'Google OAuth token failed audience, issuer, expiry, or verification checks.',
        });
        return;
      }

      verifiedEmail = String(payload.email || '').trim().toLowerCase();
    } catch {
      res.status(502).json({
        authenticated: false,
        error: 'Unable to verify Google OAuth ID token with Google Identity services.',
      });
      return;
    }

    if (verifiedEmail !== 'kumaripallawi061@gmail.com') {
      res.status(403).json({
        authenticated: false,
        error: 'Only the designated root administrator account (kumaripallawi061@gmail.com) is authorized.',
      });
      return;
    }

    const admin = serverState.users.find(
      (u) => (u.email || '').trim().toLowerCase() === 'kumaripallawi061@gmail.com'
    );
    if (!admin || admin.isActive === false) {
      res.status(403).json({ authenticated: false, error: 'Root administrator account is inactive.' });
      return;
    }
    const cookie = signServerSessionCookie(admin);
    setSessionCookie(res, cookie);
    const audit = buildAuditLogEntry({
      actorId: admin.id,
      actorName: admin.name,
      actorRole: admin.role,
      module: 'auth',
      action: 'GOOGLE_ADMIN_LOGIN_SUCCESS',
      targetId: admin.id,
      summary: `Administrator authenticated via verified Google OAuth token (${admin.email})`,
    });
    appendServerAuditLog(audit);
    saveServerState(serverState);
    res.json({ authenticated: true, user: sanitizeUserForClient(admin), auditEntry: audit });
  });

  // Roster-restricted student self-registration endpoint
  app.post('/api/auth/register-student', async (req: Request, res: Response) => {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(`register-student:${clientIp}`, 5, 60_000)) {
      res.status(429).json({
        authenticated: false,
        error: 'Rate Limit Exceeded: Too many registration attempts. Please wait a minute before trying again.',
      });
      return;
    }

    try {
      const body = (req.body || {}) as {
        rollNo?: string;
        dob?: string;
        name?: string;
        email?: string;
        phone?: string;
        password?: string;
        course?: string;
        semester?: number;
      };

      const cleanRollNo = String(body.rollNo || '').trim().toUpperCase();
      const cleanDob = String(body.dob || '').trim();
      const cleanName = String(body.name || '').trim();
      const cleanEmail = String(body.email || '').trim().toLowerCase();
      const cleanPhone = String(body.phone || '').trim().replace(/[\s-]/g, '');
      const cleanPassword = String(body.password || '');

      if (!cleanRollNo) {
        res.status(400).json({ authenticated: false, error: 'Roll Number is mandatory for roster verification.' });
        return;
      }
      if (!cleanName || cleanName.length < 2) {
        res.status(400).json({ authenticated: false, error: 'Validation Error: Student name must be at least 2 characters long.' });
        return;
      }
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(cleanEmail)) {
        res.status(400).json({ authenticated: false, error: 'Validation Error: Please provide a valid email address.' });
        return;
      }
      if (cleanEmail === 'kumaripallawi061@gmail.com') {
        res.status(403).json({
          authenticated: false,
          error: 'Security Exception: Reserved administrator email cannot be used for student registration.',
        });
        return;
      }
      const phoneDigits = cleanPhone.replace(/\D/g, '');
      const normalizedMobile = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : '';
      if (!/^\+?[0-9]{10,15}$/.test(cleanPhone) || normalizedMobile.length < 10) {
        res.status(400).json({ authenticated: false, error: 'Validation Error: Phone number must be a valid 10-digit mobile number.' });
        return;
      }

      const dobDate = new Date(cleanDob);
      if (!cleanDob || Number.isNaN(dobDate.getTime()) || dobDate >= new Date()) {
        res.status(400).json({ authenticated: false, error: 'Validation Error: A valid Date of Birth is required.' });
        return;
      }
      const nowDate = new Date();
      let age = nowDate.getFullYear() - dobDate.getFullYear();
      const mDiff = nowDate.getMonth() - dobDate.getMonth();
      if (mDiff < 0 || (mDiff === 0 && nowDate.getDate() < dobDate.getDate())) {
        age--;
      }
      if (age < 14) {
        res.status(400).json({ authenticated: false, error: 'Age Restriction: Student must be at least 14 years old.' });
        return;
      }

      const policy = validatePasswordComplexity(cleanPassword, {
        email: cleanEmail,
        mobile: cleanPhone,
        rollNo: cleanRollNo,
      });
      if (!policy.valid) {
        res.status(400).json({ authenticated: false, error: policy.error });
        return;
      }

      // Strictly enforce pre-imported roster roll number + DOB verification
      const rosterEntry = serverState.studentRoster.find(
        (s) => (s.rollNo || '').trim().toUpperCase() === cleanRollNo
      );
      if (!rosterEntry) {
        res.status(403).json({
          authenticated: false,
          error: `Registration Restricted: Roll Number "${cleanRollNo}" is not present in the pre-imported institutional roster.`,
        });
        return;
      }
      if (!rosterEntry.dob || rosterEntry.dob !== cleanDob) {
        res.status(403).json({
          authenticated: false,
          error: `Verification Failed: Date of Birth does not match our pre-imported roster record for Roll Number "${cleanRollNo}".`,
        });
        return;
      }

      // Duplicate guards on serverState.users
      const existingByEmail = serverState.users.find(
        (u) => (u.email || '').trim().toLowerCase() === cleanEmail
      );
      if (existingByEmail) {
        res.status(409).json({
          authenticated: false,
          error: `Account Conflict: Email "${cleanEmail}" is already registered.`,
        });
        return;
      }
      const existingByMobile = serverState.users.find((u) => {
        const uDigits = String(u.mobile || '').replace(/\D/g, '');
        return uDigits.length >= 10 && uDigits.slice(-10) === normalizedMobile;
      });
      if (existingByMobile) {
        res.status(409).json({
          authenticated: false,
          error: `Mobile Collision: Phone number "${cleanPhone}" is already associated with an active account.`,
        });
        return;
      }
      const existingByRoll = serverState.users.find(
        (u) => (u.rollNo || '').trim().toUpperCase() === cleanRollNo
      );
      if (existingByRoll) {
        res.status(409).json({
          authenticated: false,
          error: `Account Conflict: Roll No "${cleanRollNo}" is already registered. Please sign in directly.`,
        });
        return;
      }

      const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
      const hashedPassword = await bcrypt.hash(cleanPassword, salt);
      const userId = `USR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

      const newUser: UserAccount = {
        id: userId,
        email: cleanEmail,
        mobile: cleanPhone,
        password: hashedPassword,
        name: cleanName,
        role: 'student',
        mustChangePassword: false,
        createdAt: new Date().toISOString(),
        studentId: rosterEntry.id,
        rollNo: rosterEntry.rollNo,
        status: 'active',
        isActive: true,
        sessionVersion: 1,
      };
      serverState.users.unshift(newUser);
      rosterEntry.name = cleanName;
      rosterEntry.email = cleanEmail;
      rosterEntry.phone = cleanPhone;

      const cookie = signServerSessionCookie(newUser);
      setSessionCookie(res, cookie);

      const audit = buildAuditLogEntry({
        actorId: newUser.id,
        actorName: newUser.name,
        actorRole: 'student',
        module: 'auth',
        action: 'STUDENT_SELF_REGISTERED',
        targetId: rosterEntry.id,
        newValue: { rollNo: rosterEntry.rollNo, email: cleanEmail },
        summary: `Roster-verified student registered portal account (${rosterEntry.rollNo})`,
      });
      appendServerAuditLog(audit);
      saveServerState(serverState);

      res.status(201).json({
        authenticated: true,
        user: sanitizeUserForClient(newUser),
        studentId: rosterEntry.id,
        auditEntry: audit,
      });
    } catch (err) {
      res.status(500).json({ authenticated: false, error: (err as Error).message });
    }
  });

  app.post(
    '/api/students/roster-sync',
    requireAuth,
    requireRoles(['superadmin', 'principal', 'accountant']),
    (req: AuthenticatedRequest, res: Response) => {
      const incoming = (req.body as { students?: Partial<ServerStudentRosterEntry>[] })?.students;
      if (!Array.isArray(incoming)) {
        res.status(400).json({ error: 'students array is required.' });
        return;
      }
      let synced = 0;
      for (const item of incoming) {
        const cleanRoll = String(item?.rollNo || '').trim().toUpperCase();
        const cleanId = String(item?.id || '').trim();
        if (!cleanRoll || !cleanId) continue;
        const idx = serverState.studentRoster.findIndex(
          (r) => r.id === cleanId || r.rollNo.trim().toUpperCase() === cleanRoll
        );
        const entry: ServerStudentRosterEntry = {
          id: cleanId,
          rollNo: cleanRoll,
          dob: item.dob ? String(item.dob).trim() : idx !== -1 ? serverState.studentRoster[idx].dob : undefined,
          name: String(item.name || '').trim() || cleanRoll,
          email: item.email ? String(item.email).trim().toLowerCase() : undefined,
          phone: item.phone ? String(item.phone).trim() : undefined,
          course: String(item.course || 'B.Tech Computer Science & Engineering').trim(),
          semester: Number(item.semester) || 1,
        };
        if (idx !== -1) {
          serverState.studentRoster[idx] = entry;
        } else {
          serverState.studentRoster.push(entry);
        }
        synced++;
      }
      saveServerState(serverState);
      res.json({ ok: true, synced });
    }
  );

  // Self-service OTP password reset is intentionally disabled (admin-issued reset tokens only)
  app.post('/api/auth/forgot-password/request', (_req: Request, res: Response) => {
    res.status(403).json({
      error:
        'Self-service OTP password reset is disabled. Contact the Super Admin or Principal to receive an admin-issued reset token.',
    });
  });

  app.post('/api/auth/forgot-password/verify', (_req: Request, res: Response) => {
    res.status(403).json({
      verified: false,
      error:
        'Self-service OTP password reset is disabled. Contact the Super Admin or Principal to receive an admin-issued reset token.',
    });
  });

  // Admin-issued single-use 5-minute password reset token endpoint
  app.post(
    '/api/auth/admin-reset-token',
    requireAuth,
    requireRoles(['superadmin', 'principal']),
    (req: AuthenticatedRequest, res: Response) => {
      const body = (req.body || {}) as { userId?: string; identifier?: string };
      const targetUserId = String(body.userId || '').trim();
      const rawIdentifier = String(body.identifier || '').trim().toLowerCase();
      if (!targetUserId && !rawIdentifier) {
        res.status(400).json({ error: 'Target userId or identifier is required.' });
        return;
      }

      const cleanDigits = rawIdentifier.replace(/\D/g, '');
      const targetUser = serverState.users.find((u) => {
        if (targetUserId && u.id === targetUserId) return true;
        if (!rawIdentifier) return false;
        return (
          (u.email || '').trim().toLowerCase() === rawIdentifier ||
          (u.rollNo && u.rollNo.trim().toLowerCase() === rawIdentifier) ||
          (cleanDigits.length >= 10 && String(u.mobile || '').replace(/\D/g, '') === cleanDigits)
        );
      });

      if (!targetUser) {
        res.status(404).json({ error: 'Target user account not found.' });
        return;
      }

      if (
        targetUser.authProvider === 'google' ||
        (targetUser.email || '').trim().toLowerCase() === 'kumaripallawi061@gmail.com'
      ) {
        res.status(403).json({
          error: 'Password reset tokens cannot be issued for Google-authenticated root administrator accounts.',
        });
        return;
      }

      if (targetUser.role === 'superadmin' && req.authUser!.role !== 'superadmin') {
        res.status(403).json({ error: 'Only Super Admin can issue a reset token for a Super Admin account.' });
        return;
      }

      const resetToken = issueServerSideResetToken(targetUser);
      const audit = buildAuditLogEntry({
        actorId: req.authUser!.id,
        actorName: req.authUser!.name,
        actorRole: req.authUser!.role,
        module: 'auth',
        action: 'ADMIN_RESET_TOKEN_ISSUED',
        targetId: targetUser.id,
        newValue: { targetEmail: targetUser.email, targetRole: targetUser.role, expiresInSeconds: 300 },
        summary: `Issued single-use 5-minute password reset token for ${targetUser.name} (${targetUser.email})`,
      });
      appendServerAuditLog(audit);
      saveServerState(serverState);

      res.json({
        resetToken,
        expiresInSeconds: 300,
        targetUser: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
        },
        auditEntry: audit,
      });
    }
  );

  app.post('/api/auth/change-password', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, currentPassword, newPassword, resetToken } = req.body as {
        userId?: string;
        currentPassword?: string;
        newPassword?: string;
        resetToken?: string;
      };

      if (!newPassword || typeof newPassword !== 'string') {
        res.status(400).json({ error: 'New password is required.' });
        return;
      }

      // Check Bearer OR HttpOnly cookie session consistently
      const sessionCheck = verifyServerSessionToken(extractSessionToken(req));
      const authUser = sessionCheck.valid ? sessionCheck.user : undefined;

      const targetId = userId || authUser?.id;
      if (!targetId) {
        res.status(401).json({ error: 'Authentication or valid reset token is required.' });
        return;
      }

      const targetIndex = serverState.users.findIndex((u) => u.id === targetId);
      if (targetIndex === -1) {
        res.status(404).json({ error: 'User account not found.' });
        return;
      }
      const targetUser = serverState.users[targetIndex];

      if (authUser) {
        // Horizontal privilege escalation guard
        if (authUser.role !== 'superadmin' && authUser.id !== targetUser.id) {
          res.status(403).json({ error: 'Access denied: You can only change your own password.' });
          return;
        }
        // Self-service password changes MUST provide and verify currentPassword (unless holding a verified one-time resetToken)
        if (authUser.id === targetUser.id) {
          const hasReset = resetToken ? consumeServerSideResetToken(resetToken, targetUser) : false;
          if (!hasReset) {
            if (!currentPassword || !isBcryptHash(targetUser.password)) {
              res.status(401).json({ error: 'Current password verification is required.' });
              return;
            }
            const currentMatch = await bcrypt.compare(currentPassword, targetUser.password);
            if (!currentMatch) {
              res.status(401).json({ error: 'Current password verification failed.' });
              return;
            }
          }
        }
      } else {
        // Unauthenticated caller MUST present a valid, server-issued, single-use resetToken
        if (!resetToken || !consumeServerSideResetToken(resetToken, targetUser)) {
          res.status(401).json({ error: 'Invalid, expired, or unissued password reset token.' });
          return;
        }
      }

      const complexity = validatePasswordComplexity(newPassword, {
        email: targetUser.email,
        mobile: targetUser.mobile,
        rollNo: targetUser.rollNo,
      });
      if (!complexity.valid) {
        res.status(400).json({ error: complexity.error });
        return;
      }

      const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
      const newHash = await bcrypt.hash(newPassword, salt);
      const nextSessionVersion = (targetUser.sessionVersion || 1) + 1;

      const updatedUser: UserAccount = {
        ...targetUser,
        password: newHash,
        mustChangePassword: false,
        sessionVersion: nextSessionVersion,
      };
      serverState.users[targetIndex] = updatedUser;

      // Only revoke caller's own session when rotating their own credentials (never lock out a Super Admin updating another user)
      if (sessionCheck.valid && sessionCheck.payload && authUser?.id === targetUser.id) {
        revokeServerSessionId(sessionCheck.payload.sid, sessionCheck.payload.exp);
      }

      const audit = buildAuditLogEntry({
        actorId: authUser?.id || targetUser.id,
        actorName: authUser?.name || targetUser.name,
        actorRole: authUser?.role || targetUser.role,
        module: 'auth',
        action: 'PASSWORD_RESET_COMPLETED',
        targetId: targetUser.id,
        oldValue: { mustChangePassword: targetUser.mustChangePassword },
        newValue: { mustChangePassword: false, entropyBits: complexity.entropyBits },
      });
      appendServerAuditLog(audit);
      saveServerState(serverState);

      if (authUser && authUser.id === targetUser.id) {
        setSessionCookie(res, signServerSessionCookie(updatedUser));
      }

      res.json({
        hash: newHash,
        mustChangePassword: false,
        sessionVersion: nextSessionVersion,
        auditEntry: audit,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Provision/sync newly onboarded staff or updated account metadata into serverState
  app.post(
    '/api/auth/users/sync',
    requireAuth,
    requireRoles(['superadmin', 'principal']),
    (req: AuthenticatedRequest, res: Response) => {
      const body = (req.body || {}) as { user?: Partial<UserAccount> };
      const incoming = body.user;
      if (!incoming || !incoming.id || !incoming.email || !incoming.role) {
        res.status(400).json({ error: 'Valid user id, email, and role are required.' });
        return;
      }
      const cleanEmail = String(incoming.email).trim().toLowerCase();
      const cleanRole = String(incoming.role).trim().toLowerCase() as UserRole;
      if (cleanEmail === 'kumaripallawi061@gmail.com') {
        res.status(403).json({ error: 'Reserved root Super Admin account cannot be modified via sync.' });
        return;
      }
      if (cleanRole === 'superadmin' && req.authUser!.role !== 'superadmin') {
        res.status(403).json({ error: 'Role escalation prohibited: Only Super Admin can provision Super Admin accounts.' });
        return;
      }
      if (cleanRole === 'accountant' && req.authUser!.role !== 'superadmin') {
        res.status(403).json({ error: 'Segregation of Duties: Only Super Admin can provision Accountant accounts.' });
        return;
      }

      const existingIdx = serverState.users.findIndex((u) => u.id === incoming.id);
      if (existingIdx >= 0) {
        const prev = serverState.users[existingIdx];
        serverState.users[existingIdx] = {
          ...prev,
          name: incoming.name ? String(incoming.name).trim() : prev.name,
          mobile: incoming.mobile !== undefined ? String(incoming.mobile).trim() : prev.mobile,
          isActive: incoming.isActive !== undefined ? Boolean(incoming.isActive) : prev.isActive,
          status: incoming.status || prev.status,
          facultyId: incoming.facultyId || prev.facultyId,
          designation: incoming.designation || prev.designation,
          department: incoming.department || prev.department,
        };
      } else {
        if (!isBcryptHash(incoming.password)) {
          res.status(400).json({ error: 'New user sync requires a valid bcrypt password hash.' });
          return;
        }
        const dup = serverState.users.find(
          (u) => (u.email || '').trim().toLowerCase() === cleanEmail
        );
        if (dup) {
          res.status(409).json({ error: `User with email "${cleanEmail}" already exists on server.` });
          return;
        }
        serverState.users.unshift({
          id: String(incoming.id).trim(),
          email: cleanEmail,
          mobile: String(incoming.mobile || '').trim(),
          password: String(incoming.password),
          name: String(incoming.name || 'Staff User').trim(),
          role: cleanRole,
          mustChangePassword: incoming.mustChangePassword !== false,
          onboardedBy: req.authUser!.id,
          createdAt: String(incoming.createdAt || new Date().toISOString()),
          designation: incoming.designation,
          department: incoming.department,
          facultyId: incoming.facultyId,
          isActive: incoming.isActive !== false,
          status: incoming.status || 'active',
          sessionVersion: 1,
        });
      }
      saveServerState(serverState);
      res.json({ ok: true });
    }
  );

  // ---------------------------------------------------------------------------
  // 2. CANONICAL RBAC ENFORCEMENT ENDPOINT
  // ---------------------------------------------------------------------------
  app.post('/api/rbac/check', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { moduleKey, modulePermissions } = req.body as {
      moduleKey?: string;
      modulePermissions?: ModulePermissionMap;
    };
    const allowed = canUserAccessModule(req.authUser, moduleKey || '', modulePermissions);
    res.json({ allowed });
  });

  // ---------------------------------------------------------------------------
  // 3. SEQUENTIAL FINANCIAL-YEAR RECEIPT ENGINE & GATEWAY WEBHOOKS
  // ---------------------------------------------------------------------------
  app.post(
    '/api/fees/receipts/next',
    requireAuth,
    requireRoles(['accountant']),
    (req: AuthenticatedRequest, res: Response) => {
      const { financialYear, minBaselineSeq } = req.body as {
        financialYear?: string;
        minBaselineSeq?: number;
      };
      if (financialYear !== undefined && !/^\d{4}-\d{2}$/.test(String(financialYear).trim())) {
        res.status(400).json({ error: 'Invalid financialYear format. Expected YYYY-YY (e.g. 2026-27).' });
        return;
      }
      const fy = normalizeFinancialYearCode(financialYear);
      const storedSeq = serverState.receiptSequencesByFY[fy] ?? 0;
      const baseline =
        typeof minBaselineSeq === 'number' && Number.isFinite(minBaselineSeq) && minBaselineSeq >= 0
          ? Math.floor(minBaselineSeq)
          : 0;
      const nextSeq = Math.max(storedSeq, baseline) + 1;
      serverState.receiptSequencesByFY[fy] = nextSeq;
      saveServerState(serverState);

      const receiptNo = formatSequentialReceiptNumber(fy, nextSeq);
      res.json({ financialYear: fy, sequence: nextSeq, receiptNo });
    }
  );

  app.post('/api/fees/payment-order', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { studentId, studentRollNo, amountInRupees, feeHeadTitle } = req.body as {
      studentId?: string;
      studentRollNo?: string;
      amountInRupees?: number;
      feeHeadTitle?: string;
    };
    const amountPaisa = toPaisa(amountInRupees ?? 0);
    if (!studentId || typeof studentId !== 'string' || amountPaisa <= 0) {
      res.status(400).json({ error: 'Valid studentId and positive amount are required.' });
      return;
    }
    if (
      req.authUser!.role === 'student' &&
      req.authUser!.studentId &&
      req.authUser!.studentId !== studentId
    ) {
      res.status(403).json({ error: 'Students may only initialize payment orders for their own ledger.' });
      return;
    }

    const orderId = `order_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const order: ServerPaymentOrder = {
      orderId,
      studentId: studentId.trim(),
      studentRollNo,
      amountPaisa,
      feeHeadTitle: (feeHeadTitle || 'Semester Tuition & Institutional Fee').trim(),
      status: 'Pending',
      createdBy: req.authUser!.id,
      createdAt: Date.now(),
    };
    serverState.paymentOrders[orderId] = order;
    saveServerState(serverState);

    // Never return webhook HMAC secrets or signatures to the client!
    res.json({
      orderId,
      amountPaisa,
      currency: 'INR',
      studentId: order.studentId,
      studentRollNo: order.studentRollNo,
      feeHeadTitle: order.feeHeadTitle,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_institutional_erp',
    });
  });

  app.post('/api/fees/webhook', (req: Request, res: Response) => {
    const headerSig = req.headers['x-razorpay-signature'];
    const {
      orderId,
      paymentId,
      signature: bodySignature,
      amountInRupees,
      amountPaisa: providedAmountPaisa,
      studentId,
      studentName,
      financialYear,
      minBaselineSeq,
    } = req.body as {
      orderId?: string;
      paymentId?: string;
      signature?: string;
      amountInRupees?: number;
      amountPaisa?: number;
      studentId?: string;
      studentName?: string;
      financialYear?: string;
      minBaselineSeq?: number;
    };

    const providedSig = typeof headerSig === 'string' ? headerSig : bodySignature;
    if (!orderId || !paymentId || !providedSig) {
      res.status(400).json({ verified: false, error: 'Missing gateway orderId, paymentId, or HMAC signature.' });
      return;
    }

    const order = serverState.paymentOrders[orderId];
    if (!order) {
      res.status(404).json({ verified: false, error: 'Unknown payment orderId.' });
      return;
    }
    if (order.status === 'Paid') {
      res.status(409).json({
        verified: false,
        error: 'Replay blocked: Payment order has already been settled.',
        receiptNo: order.receiptNo,
      });
      return;
    }

    // Bind webhook signature to orderId, paymentId, and server-stored amountPaisa
    const expectedSig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(`${orderId}|${paymentId}|${order.amountPaisa}`)
      .digest('hex');

    if (!constantTimeEqual(providedSig, expectedSig)) {
      res.status(401).json({ verified: false, error: 'Invalid payment gateway webhook HMAC signature.' });
      return;
    }

    const webhookAmountPaisa =
      typeof providedAmountPaisa === 'number'
        ? Math.round(providedAmountPaisa)
        : amountInRupees !== undefined
        ? toPaisa(amountInRupees)
        : order.amountPaisa;

    if (webhookAmountPaisa !== order.amountPaisa) {
      res.status(400).json({ verified: false, error: 'Payment amount mismatch against registered order.' });
      return;
    }
    if (studentId && studentId !== order.studentId) {
      res.status(400).json({ verified: false, error: 'Student ID mismatch against registered order.' });
      return;
    }

    if (financialYear !== undefined && !/^\d{4}-\d{2}$/.test(String(financialYear).trim())) {
      res.status(400).json({ verified: false, error: 'Invalid financialYear format.' });
      return;
    }

    const fy = normalizeFinancialYearCode(financialYear);
    const storedSeq = serverState.receiptSequencesByFY[fy] ?? 0;
    const baseline =
      typeof minBaselineSeq === 'number' && Number.isFinite(minBaselineSeq) && minBaselineSeq >= 0
        ? Math.floor(minBaselineSeq)
        : 0;
    const nextSeq = Math.max(storedSeq, baseline) + 1;
    serverState.receiptSequencesByFY[fy] = nextSeq;
    const receiptNo = formatSequentialReceiptNumber(fy, nextSeq);

    order.status = 'Paid';
    order.paidAt = Date.now();
    order.paymentId = paymentId;
    order.receiptNo = receiptNo;

    const audit = buildAuditLogEntry({
      actorId: order.studentId,
      actorName: studentName || 'Razorpay Webhook Verifier',
      actorRole: 'accountant',
      module: 'fees',
      action: 'GATEWAY_WEBHOOK_CONFIRMED',
      targetId: receiptNo,
      oldValue: { orderId, status: 'Pending' },
      newValue: { orderId, paymentId, receiptNo, amountPaisa: order.amountPaisa, status: 'Success' },
    });
    appendServerAuditLog(audit);
    saveServerState(serverState);

    res.json({
      verified: true,
      receiptNo,
      paymentId,
      orderId,
      bankUTR: `UTR${Date.now().toString().slice(-8)}`,
      auditEntry: audit,
    });
  });

  // ---------------------------------------------------------------------------
  // 4. POST-DECLARATION GRADE LOCK & APPROVAL WORKFLOW
  // ---------------------------------------------------------------------------
  app.post('/api/grades/check-lock', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { semester, course, declarations } = req.body as {
      semester: number;
      course: string;
      declarations: SemesterResultDeclaration[];
    };
    const result = checkPostDeclarationGradeLock(semester, course, declarations || []);
    res.json(result);
  });

  app.post(
    '/api/grades/unlock-request',
    requireAuth,
    requireRoles(['faculty', 'principal', 'superadmin']),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { declarationId, semester, course, subjectCode, reason } = req.body as {
          declarationId?: string;
          semester: number;
          course: string;
          subjectCode?: string;
          reason: string;
        };
        const unlockRequest = buildGradeUnlockRequest({
          declarationId,
          semester,
          course,
          subjectCode,
          requestedById: req.authUser!.id,
          requestedByName: req.authUser!.name,
          requestedByRole: req.authUser!.role,
          reason,
        });
        const audit = buildAuditLogEntry({
          actorId: req.authUser!.id,
          actorName: req.authUser!.name,
          actorRole: req.authUser!.role,
          module: 'grades',
          action: 'GRADE_UNLOCK_REQUESTED',
          targetId: unlockRequest.declarationId,
          newValue: unlockRequest,
          reason: unlockRequest.reason,
        });
        appendServerAuditLog(audit);
        saveServerState(serverState);
        res.json({ unlockRequest, auditEntry: audit });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // 5. SERVER-SIDE AUDIT LOG & ZOD BACKUP VALIDATION
  // ---------------------------------------------------------------------------
  app.get(
    '/api/audit',
    requireAuth,
    requireRoles(['superadmin', 'principal', 'accountant']),
    (_req: AuthenticatedRequest, res: Response) => {
      res.json({ logs: serverState.auditLogs });
    }
  );

  app.post('/api/audit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const body = (req.body || {}) as Partial<Omit<AuditLogEntry, 'id' | 'timestamp'>>;
    if (!body.action || typeof body.action !== 'string') {
      res.status(400).json({ error: 'Audit action is required.' });
      return;
    }
    const cleanAction = body.action.trim().slice(0, 80);
    const cleanModule = String(body.module || 'general').trim().toLowerCase().slice(0, 40);
    const studentAllowedActions = new Set([
      'SERVICE_REQUEST_SUBMITTED',
      'TICKET_SUBMITTED',
      'STUDENT_PROFILE_UPDATED',
      'PASSWORD_RESET_COMPLETED',
    ]);
    if (req.authUser!.role === 'student' && !studentAllowedActions.has(cleanAction)) {
      res.status(403).json({ error: 'Students are not authorized to record administrative or ledger audit events.' });
      return;
    }
    const entry = buildAuditLogEntry({
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: req.authUser!.role,
      module: cleanModule,
      entityType: typeof body.entityType === 'string' ? body.entityType.slice(0, 60) : undefined,
      entityId: typeof body.entityId === 'string' ? body.entityId.slice(0, 80) : undefined,
      action: cleanAction,
      targetId: typeof body.targetId === 'string' ? body.targetId.slice(0, 80) : undefined,
      oldValue: body.oldValue,
      newValue: body.newValue,
      reason: typeof body.reason === 'string' ? body.reason.slice(0, 300) : undefined,
      summary: typeof body.summary === 'string' ? body.summary.slice(0, 300) : undefined,
    });
    appendServerAuditLog(entry);
    saveServerState(serverState);
    res.json({ entry });
  });

  app.post(
    '/api/backup/validate',
    requireAuth,
    requireRoles(['superadmin']),
    (req: AuthenticatedRequest, res: Response) => {
      const result = validateErpBackupBundle(req.body);
      if (!result.valid) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    }
  );

  // Unknown API endpoints return structured JSON 404 instead of SPA HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // ---------------------------------------------------------------------------
  // 6. VITE MIDDLEWARE (DEV) OR STATIC ASSETS (PROD)
  // ---------------------------------------------------------------------------
  if (!isProductionMode) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`[RLSY ERP Full-Stack Server] Listening on http://${HOST}:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server Error] Port ${PORT} is already in use.`);
    } else {
      console.error(`[Server Error] ${err.message}`);
    }
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}

startServer();
