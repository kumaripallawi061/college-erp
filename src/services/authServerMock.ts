/**
 * Session Token Validation Service
 *
 * Verifies persistent session tokens against server session state (/api/auth/session)
 * and authoritative user directory, enforces HMAC-SHA256 signatures and expiration,
 * handles UTF-8 Unicode names, prunes expired revocation records without dropping
 * active revocations, and rejects legacy unsigned backdoors or malformed offline tokens.
 */

import type { UserAccount, UserRole } from '../types/erp';
import { erpStorage } from './erpStorage';
import { computeSessionDigest } from '../utils/erpLogic';
import { constantTimeEqual } from '../domain/auth';

export const SESSION_TOKEN_STORAGE_KEY = 'rlsy_erp_session_token_v3';
export const REVOKED_TOKENS_STORAGE_KEY = 'rlsy_erp_revoked_tokens_v3';
export const REVOKED_USERS_STORAGE_KEY = 'rlsy_erp_revoked_users_v3';
export const TOKEN_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

interface RevokedTokenEntry {
  signature: string;
  expiresAt: number;
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

function encodeBase64Utf8(str: string): string {
  const bytes = utf8Encoder.encode(str);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64Utf8(b64: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf-8');
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return utf8Decoder.decode(bytes);
}

function getRevokedTokens(): RevokedTokenEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(REVOKED_TOKENS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((item) => item && typeof item.signature === 'string' && Number(item.expiresAt) > now);
  } catch {
    return [];
  }
}

function getRevokedUserEpochs(): Record<string, number> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(REVOKED_USERS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const cutoff = Date.now() - TOKEN_EXPIRY_MS;
    const pruned: Record<string, number> = Object.create(null);
    for (const [uid, ts] of Object.entries(parsed)) {
      const epoch = Number(ts);
      if (Number.isFinite(epoch) && epoch > cutoff) {
        pruned[uid] = epoch;
      }
    }
    return pruned;
  } catch {
    return {};
  }
}

export function revokeUserSessions(userId: string): void {
  try {
    if (typeof localStorage === 'undefined' || !userId) return;
    const epochs = getRevokedUserEpochs();
    epochs[userId] = Date.now();
    localStorage.setItem(REVOKED_USERS_STORAGE_KEY, JSON.stringify(epochs));
    const token = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const jsonStr = decodeBase64Utf8(parts[1]);
          const payload: SessionTokenPayload = JSON.parse(jsonStr);
          if (payload.userId === userId) {
            revokeServerSession();
          }
        }
      } catch {}
    }
  } catch {}
}

function addRevokedToken(signature: string, expiresAt: number): void {
  try {
    if (typeof localStorage === 'undefined' || !signature) return;
    const active = getRevokedTokens();
    if (!active.some((item) => item.signature === signature)) {
      active.unshift({ signature, expiresAt: expiresAt || Date.now() + TOKEN_EXPIRY_MS });
    }
    // Never drop unexpired revoked tokens; getRevokedTokens() already purges expired entries
    localStorage.setItem(REVOKED_TOKENS_STORAGE_KEY, JSON.stringify(active));
  } catch {}
}

export interface SessionTokenPayload {
  userId: string;
  role: UserRole;
  email: string;
  name: string;
  studentId?: string;
  facultyId?: string;
  rollNo?: string;
  sessionVersion?: number;
  issuedAt: number;
  expiresAt: number;
}

export interface SessionValidationResult {
  valid: boolean;
  user?: UserAccount;
  error?: string;
}

/**
 * Creates and signs a session token (supports full UTF-8 names including Devanagari).
 */
export function createSessionToken(user: UserAccount): string {
  const now = Date.now();
  const ver = user.sessionVersion ?? 1;
  const payload: SessionTokenPayload = {
    userId: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    studentId: user.studentId,
    facultyId: user.facultyId,
    rollNo: user.rollNo,
    sessionVersion: ver,
    issuedAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
  };

  const payloadJson = JSON.stringify(payload);
  const base64Payload = encodeBase64Utf8(payloadJson);
  const signature = computeSessionDigest(user.id, user.role, user.email, now, payload.expiresAt, undefined, ver);
  const token = `rlsy_token.${base64Payload}.${signature}`;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    }
  } catch {}

  return token;
}

/**
 * Refreshes the rolling session token lifetime on user activity so the token expiry
 * stays synchronized with the rolling session envelope in erpStorage.getCurrentUser().
 */
export function refreshSessionTokenOnActivity(user: UserAccount): string | null {
  try {
    if (!user || !user.id || typeof localStorage === 'undefined') return null;
    const existing = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (!existing) return null;
    return createSessionToken(user);
  } catch {
    return null;
  }
}

function checkUserAccountSuspension(authoritativeUser: UserAccount): string | null {
  if (authoritativeUser.isActive === false || authoritativeUser.status === 'suspended') {
    return 'Account has been deactivated or suspended by administration';
  }
  if (authoritativeUser.role === 'student') {
    const students = erpStorage.getStudents();
    const stu = students.find(
      (s) => s.id === authoritativeUser.studentId || s.email === authoritativeUser.email
    );
    const stuStatus = String(stu?.status || '').trim().toLowerCase();
    if (stu && ['suspended', 'expelled', 'withdrawn', 'transferred', 'tc_issued'].includes(stuStatus)) {
      return 'Student account has been suspended or withdrawn by administration';
    }
  }
  return null;
}

/**
 * Parses and validates session token on startup, page refresh, or navigation.
 * Never auto-mints tokens from legacy localStorage envelopes and never trusts malformed tokens offline.
 */
export async function validateServerSessionToken(
  tokenCandidate?: string | null
): Promise<SessionValidationResult> {
  // Check server-issued HttpOnly session cookie first when running in browser
  if (!tokenCandidate && typeof fetch === 'function' && typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data?.authenticated && data?.user) {
          const suspensionErr = checkUserAccountSuspension(data.user);
          if (suspensionErr) {
            revokeServerSession();
            return { valid: false, error: suspensionErr };
          }
          refreshSessionTokenOnActivity(data.user);
          return { valid: true, user: data.user };
        }
      } else if (res.status === 401 || res.status === 403) {
        // Explicit server rejection (revoked/expired/logged-out) must fail closed unless a fresh valid local token is present
        const hasLocalToken =
          typeof localStorage !== 'undefined' && Boolean(localStorage.getItem(SESSION_TOKEN_STORAGE_KEY));
        if (!hasLocalToken) {
          revokeServerSession();
          return { valid: false, error: 'Server session expired or revoked.' };
        }
      }
    } catch {
      // Network/offline environment — continue to cryptographic token check below
    }
  }

  let token: string | null = null;
  try {
    token =
      tokenCandidate ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) : null);
  } catch {
    token = tokenCandidate || null;
  }

  if (!token) {
    return { valid: false, error: 'No active session token' };
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'rlsy_token') {
      revokeServerSession();
      return { valid: false, error: 'Malformed session token structure' };
    }

    const base64Payload = parts[1];
    const clientSignature = parts[2];

    const revokedList = getRevokedTokens();
    if (revokedList.some((r) => constantTimeEqual(r.signature, clientSignature))) {
      revokeServerSession();
      return { valid: false, error: 'Session token has been explicitly revoked' };
    }

    const jsonStr = decodeBase64Utf8(base64Payload);
    const payload: SessionTokenPayload = JSON.parse(jsonStr);

    if (!payload || !payload.userId || !payload.role || !Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt)) {
      revokeServerSession();
      return { valid: false, error: 'Invalid session payload' };
    }

    const now = Date.now();
    if (payload.issuedAt > now + 30000 || now - 30000 > payload.expiresAt) {
      revokeServerSession();
      return { valid: false, error: 'Session token has expired' };
    }

    const userRevokedEpoch = getRevokedUserEpochs()[payload.userId];
    if (userRevokedEpoch && payload.issuedAt <= userRevokedEpoch) {
      revokeServerSession();
      return {
        valid: false,
        error: 'User session has been invalidated due to credential update or account status change',
      };
    }

    const users = erpStorage.getUsers();
    const authoritativeUser = users.find((u) => u.id === payload.userId);
    if (!authoritativeUser) {
      revokeServerSession();
      return { valid: false, error: 'User does not exist in authoritative directory' };
    }

    if (authoritativeUser.role !== payload.role) {
      console.error(
        `[SECURITY ALERT] Privilege escalation attempt detected! Token claimed role "${payload.role}", but authoritative database record is "${authoritativeUser.role}". Session immediately revoked.`
      );
      revokeServerSession();
      return { valid: false, error: 'Tampering detected: role privilege mismatch' };
    }

    const authVer = authoritativeUser.sessionVersion ?? 1;
    const payloadVer = payload.sessionVersion ?? 1;
    if (authVer !== payloadVer) {
      revokeServerSession();
      return { valid: false, error: 'Session invalidated by newer session version' };
    }

    const expectedSignature = computeSessionDigest(
      authoritativeUser.id,
      authoritativeUser.role,
      authoritativeUser.email,
      payload.issuedAt,
      payload.expiresAt,
      undefined,
      payload.sessionVersion !== undefined ? payload.sessionVersion : undefined
    );
    const legacySignature = computeSessionDigest(
      authoritativeUser.id,
      authoritativeUser.role,
      authoritativeUser.email,
      payload.issuedAt,
      payload.expiresAt
    );
    if (!constantTimeEqual(clientSignature, expectedSignature) && (payload.sessionVersion !== undefined || !constantTimeEqual(clientSignature, legacySignature))) {
      console.error('[SECURITY ALERT] Invalid session token HMAC signature. Session revoked.');
      revokeServerSession();
      return { valid: false, error: 'Tampering detected: invalid token signature' };
    }

    const suspensionErr = checkUserAccountSuspension(authoritativeUser);
    if (suspensionErr) {
      revokeServerSession();
      return { valid: false, error: suspensionErr };
    }

    const { password: _pw, salt: _s, resetToken: _rt, tempPassword: _tp, ...sanitizedUser } = authoritativeUser;
    return { valid: true, user: sanitizedUser as UserAccount };
  } catch (err: any) {
    // Always fail closed on parse/decode/tampering errors even when offline
    revokeServerSession();
    return { valid: false, error: `Session verification failed: ${err?.message || 'Unknown error'}` };
  }
}

/**
 * Revokes session, records token in persistent revocation denylist, and clears server cookie + local storage.
 */
export function revokeServerSession(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const existingToken = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
      if (existingToken) {
        const parts = existingToken.split('.');
        if (parts.length === 3 && parts[2]) {
          let exp = Date.now() + TOKEN_EXPIRY_MS;
          try {
            const payload = JSON.parse(decodeBase64Utf8(parts[1])) as Partial<SessionTokenPayload>;
            if (typeof payload.expiresAt === 'number' && Number.isFinite(payload.expiresAt)) {
              exp = payload.expiresAt;
            }
          } catch {}
          addRevokedToken(parts[2], exp);
        }
      }
      localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      localStorage.removeItem('rlsy_erp_current_user_v3');
    }
    if (typeof fetch === 'function' && typeof window !== 'undefined') {
      void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    }
  } catch {}
}
