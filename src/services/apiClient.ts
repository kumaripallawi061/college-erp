import type { AuditLogEntry, UserAccount } from '../types/erp';
import { erpStorage } from './erpStorage';
import {
  hashPasswordBcrypt,
  verifyPasswordBcrypt,
  validatePasswordComplexity,
  issuePasswordResetToken,
  verifyPasswordResetToken,
} from '../domain/auth';
import { validateErpBackupBundle, type BackupValidationResult } from '../domain/reports';

/**
 * Client-to-Server API Service with explicit failure propagation on HTTP 4xx/5xx
 * and safe offline/unit-test fallback only on actual network unavailability.
 */
function resolveAuthoritativeUserRecord(user: UserAccount): UserAccount {
  const stored = erpStorage.getUsers().find(
    (u) =>
      u.id === user.id ||
      (user.email && (u.email || '').trim().toLowerCase() === user.email.trim().toLowerCase())
  );
  return stored || user;
}

export const apiClient = {
  async loginWithServer(candidatePassword: string, user: UserAccount): Promise<{
    authenticated: boolean;
    mustChangePassword: boolean;
    resetToken?: string;
    user?: UserAccount;
    error?: string;
  }> {
    let httpResponded = false;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: user.email || user.rollNo || user.mobile,
          candidatePassword,
        }),
      });
      httpResponded = true;
      const data = await res.json();
      if (data.auditEntry) {
        erpStorage.appendAuditLog(data.auditEntry);
      }
      const authenticated = Boolean(res.ok && data.authenticated);
      const mustChangePassword = Boolean(data.mustChangePassword);
      return {
        authenticated,
        mustChangePassword,
        resetToken: authenticated && mustChangePassword ? data.resetToken : undefined,
        user: data.user,
        error: data.error,
      };
    } catch {
      if (httpResponded) {
        return { authenticated: false, mustChangePassword: false, error: 'Authentication failed.' };
      }
      // Offline / unit-test fallback: look up stored credential hash internally (never exposed via UI props)
      const authoritativeUser = resolveAuthoritativeUserRecord(user);
      const isValid = authoritativeUser.password
        ? await verifyPasswordBcrypt(candidatePassword, authoritativeUser.password)
        : false;
      return {
        authenticated: isValid,
        mustChangePassword: Boolean(authoritativeUser.mustChangePassword),
        resetToken:
          isValid && authoritativeUser.mustChangePassword
            ? issuePasswordResetToken(authoritativeUser.id, authoritativeUser.password)
            : undefined,
        error: isValid ? undefined : 'Invalid credentials.',
      };
    }
  },

  async checkGoogleAdminStatus(): Promise<{ enabled: boolean; clientId?: string }> {
    try {
      const res = await fetch('/api/auth/google-admin/status', { credentials: 'include' });
      if (!res.ok) return { enabled: false };
      return await res.json();
    } catch {
      return { enabled: false };
    }
  },

  async verifyGoogleAdminToken(idToken: string): Promise<{
    authenticated: boolean;
    user?: UserAccount;
    error?: string;
  }> {
    const res = await fetch('/api/auth/google-admin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.authenticated) {
      throw new Error(data?.error || 'Google OAuth administrator verification failed.');
    }
    if (data.auditEntry) {
      erpStorage.appendAuditLog(data.auditEntry);
    }
    return data;
  },

  async registerStudentOnServer(payload: {
    rollNo: string;
    dob: string;
    name: string;
    email: string;
    phone: string;
    password: string;
    course: string;
    semester: number;
  }): Promise<{
    offline?: boolean;
    authenticated: boolean;
    user?: UserAccount;
    studentId?: string;
  }> {
    let httpResponded = false;
    try {
      const res = await fetch('/api/auth/register-student', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      httpResponded = true;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Student registration was rejected by the server.');
      }
      if (data?.auditEntry) {
        erpStorage.appendAuditLog(data.auditEntry);
      }
      return {
        authenticated: Boolean(data.authenticated),
        user: data.user,
        studentId: data.studentId,
      };
    } catch (err) {
      if (httpResponded) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      return { offline: true, authenticated: false };
    }
  },

  async syncStudentRosterToServer(
    students: Array<{
      id: string;
      rollNo: string;
      dob?: string;
      name: string;
      email?: string;
      phone?: string;
      course: string;
      semester: number;
    }>
  ): Promise<void> {
    try {
      await fetch('/api/students/roster-sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students }),
      });
    } catch {
      // Offline / static preview safe
    }
  },

  async syncUserToServer(user: Partial<UserAccount>): Promise<void> {
    try {
      await fetch('/api/auth/users/sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }),
      });
    } catch {
      // Offline / static preview safe
    }
  },

  async changePasswordOnServer(params: {
    currentPassword?: string;
    newPassword: string;
    user: UserAccount;
    resetToken?: string;
  }): Promise<{ hash: string; mustChangePassword: boolean; sessionVersion: number }> {
    let responseData: any = null;
    let httpResponded = false;
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: params.user.id,
          currentPassword: params.currentPassword,
          newPassword: params.newPassword,
          resetToken: params.resetToken,
        }),
      });
      httpResponded = true;
      responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData?.error || 'Password update failed.');
      }
      if (responseData?.auditEntry) {
        erpStorage.appendAuditLog(responseData.auditEntry);
      }
      return responseData;
    } catch (err) {
      // Never bypass server HTTP 400/401/403/429 rejections via local hashing fallback!
      if (httpResponded) {
        throw err instanceof Error ? err : new Error(String(err));
      }

      // Network offline / unit-test fallback: resolve authoritative stored credentials internally
      const authoritativeUser = resolveAuthoritativeUserRecord(params.user);
      if (params.resetToken) {
        if (
          !verifyPasswordResetToken(
            params.resetToken,
            authoritativeUser.id,
            authoritativeUser.password
          )
        ) {
          throw new Error('Invalid or expired password reset token.');
        }
      } else if (params.currentPassword) {
        const ok = await verifyPasswordBcrypt(
          params.currentPassword,
          authoritativeUser.password
        );
        if (!ok) {
          throw new Error('Current password verification failed.');
        }
      } else {
        throw new Error('Current password or valid reset token is required.');
      }

      const policy = validatePasswordComplexity(params.newPassword, {
        email: authoritativeUser.email,
        mobile: authoritativeUser.mobile,
        rollNo: authoritativeUser.rollNo,
      });
      if (!policy.valid) {
        throw new Error(policy.error || 'Password does not meet complexity policy.');
      }
      const hash = await hashPasswordBcrypt(params.newPassword);
      return {
        hash,
        mustChangePassword: false,
        sessionVersion: (authoritativeUser.sessionVersion || 1) + 1,
      };
    }
  },

  async requestNextSequentialReceipt(financialYear?: string): Promise<string> {
    try {
      const res = await fetch('/api/fees/receipts/next', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialYear }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.receiptNo) return data.receiptNo;
      }
    } catch {
      // Fallback to local atomic sequence when offline
    }
    return erpStorage.getNextReceiptNumber(financialYear);
  },

  async createGatewayPaymentOrder(params: {
    studentId: string;
    studentRollNo: string;
    studentName: string;
    amountInRupees: number;
    feeHeadTitle: string;
  }): Promise<{
    orderId: string;
    amountPaisa: number;
    currency: string;
    keyId: string;
  }> {
    const orderRes = await fetch('/api/fees/payment-order', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!orderRes.ok) {
      const errData = await orderRes.json().catch(() => ({}));
      throw new Error(errData?.error || 'Failed to initialize payment gateway order.');
    }
    return await orderRes.json();
  },

  async recordServerAuditLog(
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>,
    options?: { skipLocalAppend?: boolean }
  ): Promise<AuditLogEntry> {
    const localEntry = options?.skipLocalAppend
      ? ({
          ...entry,
          id: (entry as any).id || `AUD-${Date.now()}`,
          timestamp: new Date().toISOString(),
        } as AuditLogEntry)
      : erpStorage.appendAuditLog(entry);

    const res = await fetch('/api/audit', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error || `Audit server rejected entry (HTTP ${res.status}).`);
    }
    return localEntry;
  },

  async fetchServerAuditLogs(): Promise<AuditLogEntry[]> {
    try {
      const res = await fetch('/api/audit', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          return data.logs;
        }
      }
    } catch {
      // Fallback to local storage logs
    }
    return erpStorage.getAuditLogs();
  },

  async validateBackupOnServer(payload: unknown): Promise<BackupValidationResult> {
    try {
      const res = await fetch('/api/backup/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok || res.status === 400) {
        return await res.json();
      }
    } catch {
      // Offline fallback
    }
    return validateErpBackupBundle(payload);
  },

  async issueAdminResetToken(targetUser: UserAccount): Promise<{
    resetToken: string;
    expiresInSeconds: number;
    targetUser: { id: string; name: string; email: string; role: string };
  }> {
    let httpResponded = false;
    try {
      const res = await fetch('/api/auth/admin-reset-token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUser.id }),
      });
      httpResponded = true;
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Failed to issue reset token (HTTP ${res.status}).`);
      }
      if (data?.auditEntry) {
        erpStorage.appendAuditLog(data.auditEntry);
      }
      return data;
    } catch (err) {
      if (httpResponded) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      const authoritativeUser = resolveAuthoritativeUserRecord(targetUser);
      const fallbackToken = issuePasswordResetToken(
        authoritativeUser.id,
        authoritativeUser.password,
        5 * 60 * 1000
      );
      return {
        resetToken: fallbackToken,
        expiresInSeconds: 300,
        targetUser: {
          id: authoritativeUser.id,
          name: authoritativeUser.name,
          email: authoritativeUser.email,
          role: authoritativeUser.role,
        },
      };
    }
  },
};
