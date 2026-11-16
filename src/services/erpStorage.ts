import {
  Student,
  Faculty,
  AttendanceRecord,
  FeeTransaction,
  FeeHead,
  ExamGradeRecord,
  TimetableSlot,
  HelpdeskTicket,
  InstitutionalNotice,
  CollegeProfile,
  UserAccount,
  ModulePermissionMap,
  FacultyMapping,
  FeeCampaign,
  ConcessionRule,
  EnrollmentField,
  CongratulationMessage,
  MarksheetConfig,
  StreamCourseSubject,
  StudentPromotionRecord,
  ServiceTariff,
  ServiceRequestItem,
  Reconciliation3WayRecord,
  CertificateDesignConfig,
  ReportParameterDef,
  ReportTypeDefinition,
  SystemSettingsConfig,
  CourseSectionConfig,
  GradeEvaluationHead,
  SemesterResultDeclaration,
  FacultySubjectGradeConfig,
  CustomRoleDefinition,
  ExamTypeConfig,
  ExamEvaluationHead,
  StudentExamEvaluation,
  CompactAuditLog,
  ExamEvaluationStatus,
  AuditLogEntry,
  GradeUnlockRequest,
  DegreeDivisionRule,
} from '../types/erp';
import {
  INITIAL_STUDENTS,
  INITIAL_FACULTY,
  INITIAL_FEE_HEADS,
  INITIAL_TRANSACTIONS,
  INITIAL_EXAM_GRADES,
  INITIAL_TIMETABLE,
  INITIAL_ATTENDANCE_RECORDS,
  INITIAL_NOTICES,
  INITIAL_HELPDESK_TICKETS,
  INITIAL_COLLEGE_PROFILE,
  INITIAL_USERS,
  INITIAL_MODULE_PERMISSIONS,
  INITIAL_CUSTOM_ROLES,
  INITIAL_ENROLLMENT_FIELDS,
  INITIAL_CONCESSION_RULES,
  INITIAL_FEE_CAMPAIGNS,
  INITIAL_FACULTY_MAPPINGS,
  INITIAL_CONGRATULATIONS,
  INITIAL_MARKSHEET_CONFIG,
  INITIAL_STREAM_COURSE_SUBJECTS,
  INITIAL_SERVICE_TARIFFS,
  INITIAL_SERVICE_REQUESTS,
  INITIAL_RECONCILIATION_3WAY,
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_REPORT_DEFINITIONS,
  INITIAL_REPORT_PARAMETERS,
  INITIAL_CERTIFICATE_CONFIG,
  INITIAL_COURSE_SECTIONS,
  INITIAL_GRADE_HEADS,
  INITIAL_RESULT_DECLARATIONS,
  INITIAL_EXAM_TYPES,
  INITIAL_EXAM_EVALUATION_HEADS,
  INITIAL_STUDENT_EXAM_EVALUATIONS,
} from '../data/mockData';
import {
  toPaisa,
  fromPaisa,
  paisaAdd,
  paisaSub,
  calculateGradePoint,
  calculateAttendanceStats,
  calculateStudentConcession,
  checkHallTicketEligibility,
  canModifyFeeHead,
  SESSION_TIMEOUT_MS,
  hashPassword,
  createSignedSessionEnvelope,
  verifySessionEnvelope,
  computeSessionDigest,
  generateSecureId,
  generateSecureSalt,
  getFinancialYearCode,
  formatSequentialReceiptNumber,
  checkPostDeclarationGradeLock,
  buildAuditLogEntry,
  getMaxSemestersForCourse,
  DEFAULT_DEGREE_DIVISION_RULES,
  isGradeBacklog,
} from '../utils/erpLogic';
import {
  isBcryptHash,
  hashPasswordBcryptSync,
  getCryptographicRandomHex,
} from '../domain/auth';
import { normalizeFinancialYearCode } from '../domain/fees';
import {
  getCurrentIstIsoDate,
  buildGradeUnlockRequest,
  hasActiveDeclarationUnlockWindow,
} from '../domain/grades';

const STORAGE_KEYS = {
  STUDENTS: 'rlsy_erp_students_v3',
  FACULTY: 'rlsy_erp_faculty_v3',
  FEE_HEADS: 'rlsy_erp_fee_heads_v3',
  TRANSACTIONS: 'rlsy_erp_transactions_v3',
  GRADES: 'rlsy_erp_grades_v3',
  TIMETABLE: 'rlsy_erp_timetable_v3',
  ATTENDANCE: 'rlsy_erp_attendance_v3',
  NOTICES: 'rlsy_erp_notices_v3',
  TICKETS: 'rlsy_erp_tickets_v3',
  COLLEGE_PROFILE: 'rlsy_erp_college_profile_v3',
  USERS: 'rlsy_erp_users_v3',
  CURRENT_USER: 'rlsy_erp_current_user_v3',
  MODULE_PERMISSIONS: 'rlsy_erp_permissions_v3',
  ENROLLMENT_FIELDS: 'rlsy_erp_enrollment_fields_v3',
  CONCESSION_RULES: 'rlsy_erp_concessions_v3',
  FEE_CAMPAIGNS: 'rlsy_erp_campaigns_v3',
  FACULTY_MAPPINGS: 'rlsy_erp_mappings_v3',
  CONGRATULATIONS: 'rlsy_erp_congratulations_v3',
  MARKSHEET_CONFIG: 'rlsy_erp_marksheet_config_v3',
  STREAM_COURSE_SUBJECTS: 'rlsy_erp_stream_course_subjects_v3',
  PROMOTION_AUDIT: 'rlsy_erp_promotion_audit_v3',
  SERVICE_TARIFFS: 'rlsy_erp_service_tariffs_v3',
  SERVICE_REQUESTS: 'rlsy_erp_service_requests_v3',
  RECONCILIATION_3WAY: 'rlsy_erp_reconciliation_3way_v3',
  SYSTEM_SETTINGS: 'rlsy_erp_system_settings_v3',
  REPORT_DEFINITIONS: 'rlsy_erp_report_definitions_v3',
  REPORT_PARAMETERS: 'rlsy_erp_report_parameters_v3',
  CERTIFICATE_CONFIG: 'rlsy_erp_certificate_config_v3',
  COURSE_SECTIONS: 'rlsy_erp_course_sections_v3',
  GRADE_EVALUATION_HEADS: 'rlsy_erp_grade_heads_v3',
  FACULTY_GRADE_CONFIGS: 'rlsy_erp_faculty_grade_configs_v3',
  RESULT_DECLARATIONS: 'rlsy_erp_result_declarations_v3',
  RECEIPT_SEQUENCE: 'rlsy_erp_receipt_sequence_v3',
  CUSTOM_ROLES: 'rlsy_erp_custom_roles_v3',
  EXAM_TYPES: 'rlsy_erp_exam_types_v3',
  EXAM_EVALUATION_HEADS: 'rlsy_erp_exam_heads_v3',
  STUDENT_EXAM_EVALUATIONS: 'rlsy_erp_student_evaluations_v3',
  AUDIT_LOGS: 'rlsy_erp_audit_logs_v3',
  CERTIFICATE_VERSIONS: 'rlsy_erp_certificate_versions_v3',
  MARKSHEET_VERSIONS: 'rlsy_erp_marksheet_versions_v3',
  DEGREE_DIVISION_RULES: 'rlsy_erp_degree_division_rules_v3',
};

// In-Memory & SessionStorage Hot Cache for Read-Heavy Static Metadata
const memoryCacheStore = new Map<string, any>();
const fallbackStorageMap = new Map<string, string>();

function invalidateCacheKey(key: string): void {
  memoryCacheStore.delete(key);
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(`cache_${key}`);
    }
  } catch {}
}

function cloneFallback<T>(val: T): T {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return val;
  }
}

// Safe JSON load helper with strict type & array fallback guards (Bugs 138, 247, 253)
function getStoredItem<T>(key: string, defaultValue: T): T {
  try {
    const item = typeof localStorage === 'undefined' ? fallbackStorageMap.get(key) : localStorage.getItem(key);
    if (!item) return cloneFallback(defaultValue);
    const parsed = JSON.parse(item);
    if (parsed === null || parsed === undefined) return cloneFallback(defaultValue);
    if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
      return cloneFallback(defaultValue);
    }
    if (
      typeof defaultValue === 'object' &&
      defaultValue !== null &&
      !Array.isArray(defaultValue) &&
      (typeof parsed !== 'object' || Array.isArray(parsed))
    ) {
      return cloneFallback(defaultValue);
    }
    return parsed as T;
  } catch {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {}
    return cloneFallback(defaultValue);
  }
}

function getCachedStoredItem<T>(key: string, defaultValue: T): T {
  if (memoryCacheStore.has(key)) {
    const cached = memoryCacheStore.get(key);
    if (cached !== null && cached !== undefined) {
      if (!Array.isArray(defaultValue) || Array.isArray(cached)) {
        return cached as T;
      }
    }
  }
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const sessionItem = sessionStorage.getItem(`cache_${key}`);
      if (sessionItem) {
        const parsed = JSON.parse(sessionItem);
        const isValidType =
          parsed !== null &&
          parsed !== undefined &&
          (!Array.isArray(defaultValue) || Array.isArray(parsed));
        if (isValidType) {
          memoryCacheStore.set(key, parsed);
          return parsed as T;
        }
      }
    }
  } catch {}

  const value = getStoredItem<T>(key, defaultValue);
  memoryCacheStore.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(`cache_${key}`, JSON.stringify(value));
    }
  } catch {}
  return value;
}

// Reactive listeners for in-tab and cross-tab storage synchronization
const storageListeners = new Set<() => void>();

function notifyStorageListeners(): void {
  storageListeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key.startsWith('rlsy_erp_')) {
      memoryCacheStore.clear();
      try {
        if (window.sessionStorage) {
          sessionStorage.clear();
        }
      } catch {}
      notifyStorageListeners();
    }
  });
}

function pruneOldTransientCaches(): void {
  try {
    const auditRaw = localStorage.getItem(STORAGE_KEYS.PROMOTION_AUDIT);
    if (auditRaw) {
      const records = JSON.parse(auditRaw);
      if (Array.isArray(records) && records.length > 50) {
        localStorage.setItem(STORAGE_KEYS.PROMOTION_AUDIT, JSON.stringify(records.slice(0, 50)));
      }
    }
  } catch {}
  try {
    const reconRaw = localStorage.getItem(STORAGE_KEYS.RECONCILIATION_3WAY);
    if (reconRaw) {
      const records = JSON.parse(reconRaw);
      if (Array.isArray(records) && records.length > 100) {
        localStorage.setItem(STORAGE_KEYS.RECONCILIATION_3WAY, JSON.stringify(records.slice(0, 100)));
      }
    }
  } catch {}
}

// Node/SSR storage sequence and storage handling

const STORAGE_SEQ_KEY = 'rlsy_erp_storage_seq';

function incrementStorageSequence(key: string): number {
  if (typeof localStorage === 'undefined') {
    const raw = fallbackStorageMap.get(`${STORAGE_SEQ_KEY}_${key}`);
    const nextSeq = (Number(raw) || 0) + 1;
    fallbackStorageMap.set(`${STORAGE_SEQ_KEY}_${key}`, String(nextSeq));
    return nextSeq;
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_SEQ_KEY}_${key}`);
    const nextSeq = (Number(raw) || 0) + 1;
    localStorage.setItem(`${STORAGE_SEQ_KEY}_${key}`, String(nextSeq));
    return nextSeq;
  } catch {
    return Date.now();
  }
}

export function getStorageSequence(key: string): number {
  if (typeof localStorage === 'undefined') {
    const raw = fallbackStorageMap.get(`${STORAGE_SEQ_KEY}_${key}`);
    return Number(raw) || 0;
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_SEQ_KEY}_${key}`);
    return Number(raw) || 0;
  } catch {
    return 0;
  }
}

function setStoredItem<T>(key: string, value: T): void {
  invalidateCacheKey(key);
  if (typeof localStorage === 'undefined') {
    incrementStorageSequence(key);
    fallbackStorageMap.set(key, JSON.stringify(value));
    notifyStorageListeners();
    return;
  }
  try {
    incrementStorageSequence(key);
    localStorage.setItem(key, JSON.stringify(value));
    notifyStorageListeners();
  } catch (err: any) {
    console.error(`Failed to save to localStorage [${key}]`, err);
    if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
      console.warn('LocalStorage quota reached. Auto-pruning historical transient audit logs (Bugs 251, 252).');
      pruneOldTransientCaches();
      try {
        incrementStorageSequence(key);
        localStorage.setItem(key, JSON.stringify(value));
        notifyStorageListeners();
      } catch (retryErr) {
        console.error('LocalStorage write failed after pruning transient logs.', retryErr);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('rlsy_erp_storage_quota_warning', {
              detail: { key, message: 'Browser storage quota reached. Older audit logs rotated.' },
            })
          );
        }
        throw retryErr;
      }
    } else {
      throw err;
    }
  }
}

// --------------------------------------------------------------------------
// Multi-Tab Atomic Storage Mutex Locking (Owner-Token Verified)
// --------------------------------------------------------------------------
function acquireStorageLock(lockKey: string, ownerToken: string, timeoutMs: number = 3000): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return true;
  const key = `rlsy_erp_lock_${lockKey}`;
  const now = Date.now();
  try {
    const existing = localStorage.getItem(key);
    if (existing) {
      try {
        const parsed = JSON.parse(existing) as { owner?: string; expiresAt?: number };
        if (parsed && typeof parsed.expiresAt === 'number' && now < parsed.expiresAt && parsed.owner !== ownerToken) {
          return false;
        }
      } catch {
        const lockExpiry = Number(existing);
        if (!isNaN(lockExpiry) && now < lockExpiry) {
          return false;
        }
      }
    }
    const payload = JSON.stringify({ owner: ownerToken, expiresAt: now + timeoutMs });
    localStorage.setItem(key, payload);
    const verifyRaw = localStorage.getItem(key);
    if (!verifyRaw) return false;
    const verifyParsed = JSON.parse(verifyRaw) as { owner?: string };
    return verifyParsed?.owner === ownerToken;
  } catch {
    return false;
  }
}

function releaseStorageLock(lockKey: string, ownerToken?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const key = `rlsy_erp_lock_${lockKey}`;
  try {
    if (ownerToken) {
      const existing = localStorage.getItem(key);
      if (existing) {
        try {
          const parsed = JSON.parse(existing) as { owner?: string };
          if (parsed?.owner && parsed.owner !== ownerToken) {
            return;
          }
        } catch {
          // Legacy numeric lock
        }
      }
    }
    localStorage.removeItem(key);
  } catch {}
}

export function withStorageLock<T>(lockKey: string, fn: () => T): T {
  const maxWait = 2500;
  const start = Date.now();
  const ownerToken = getCryptographicRandomHex(8);
  while (!acquireStorageLock(lockKey, ownerToken)) {
    if (Date.now() - start > maxWait) {
      console.warn(`Storage lock for [${lockKey}] timed out, forcibly reclaiming.`);
      releaseStorageLock(lockKey);
      acquireStorageLock(lockKey, ownerToken);
      break;
    }
  }
  try {
    return fn();
  } finally {
    releaseStorageLock(lockKey, ownerToken);
  }
}

// --------------------------------------------------------------------------
// Storage Mutation Access Control Guard
// --------------------------------------------------------------------------
export function assertAuthorizedRole(
  invokerRole: string | undefined,
  allowedRoles: string[],
  actionName: string
): void {
  const sessionUser = erpStorage.getCurrentUser();
  if (!sessionUser || !sessionUser.role) {
    throw new Error(
      `Security violation: Authenticated session is required to execute "${actionName}".`
    );
  }
  const sessionRole = sessionUser.role;
  if (invokerRole && invokerRole !== sessionRole) {
    throw new Error(
      `Security violation: Caller role "${invokerRole}" does not match authenticated session role "${sessionRole}" for "${actionName}".`
    );
  }
  if (!allowedRoles.includes(sessionRole)) {
    throw new Error(
      `Security violation: Role "${sessionRole}" is not authorized to execute "${actionName}". Statutory permitted roles: [${allowedRoles.join(', ')}].`
    );
  }
}

export interface PromotionOverrideOptions {
  overrideEligibility?: boolean;
  overrideReason?: string;
}

/**
 * Derives next-semester fee increment strictly from active fee campaigns and active configured fee heads
 * for the given course, stream, and target semester (never hardcoded stream defaults).
 */
export function resolvePromotionFeeIncrement(
  course: string,
  streamCode: string,
  targetSemester: number,
  feeCampaigns: FeeCampaign[],
  feeHeads: FeeHead[]
): number {
  const normCourse = (course || '').trim().toLowerCase();
  const normStream = (streamCode || '').trim().toUpperCase();
  const activeHeadMap = new Map<string, FeeHead>();
  for (const h of feeHeads || []) {
    if (h && h.id) activeHeadMap.set(h.id, h);
  }

  const campaignMatchesCourse = (camp: FeeCampaign): boolean => {
    const campCourse = (camp.course || '').trim().toLowerCase();
    const campCourses = (camp.courses || []).map((c) => c.trim().toLowerCase());
    const campStream = (camp.streamCode || '').trim().toUpperCase();
    const hasBreakdownMatch = (camp.courseBreakdowns || []).some(
      (b) =>
        (b.course || '').trim().toLowerCase() === normCourse ||
        (b.streamCode || '').trim().toUpperCase() === normStream
    );
    return (
      hasBreakdownMatch ||
      campCourse === normCourse ||
      campCourses.includes(normCourse) ||
      (Boolean(normStream) && campStream === normStream)
    );
  };

  const campaignMatchesSemester = (camp: FeeCampaign): boolean => {
    const label = (camp.semesterOrAnnualFY || '').toLowerCase();
    const semMatch = label.match(/sem(?:ester)?\s*(\d+)/i);
    if (semMatch) {
      return Number(semMatch[1]) === Number(targetSemester);
    }
    return true;
  };

  const eligibleCampaigns = (feeCampaigns || []).filter(
    (c) =>
      c &&
      ['Active', 'Upcoming', 'Extended'].includes(c.status) &&
      campaignMatchesCourse(c)
  );

  const sortedCampaigns = [
    ...eligibleCampaigns.filter(campaignMatchesSemester),
    ...eligibleCampaigns.filter((c) => !campaignMatchesSemester(c)),
  ];

  for (const camp of sortedCampaigns) {
    const breakdown = (camp.courseBreakdowns || []).find(
      (b) => (b.course || '').trim().toLowerCase() === normCourse
    ) || (camp.courseBreakdowns || []).find(
      (b) => (b.streamCode || '').trim().toUpperCase() === normStream
    );

    if (breakdown) {
      const headEntries = Object.entries(breakdown.headAmounts || {}).filter(
        ([headId, amt]) => Number(amt) > 0 && (activeHeadMap.size === 0 || activeHeadMap.has(headId))
      );
      if (headEntries.length > 0) {
        const totalPaisa = headEntries.reduce((sum, [, amt]) => paisaAdd(sum, toPaisa(Number(amt) || 0)), 0);
        if (totalPaisa > 0) return fromPaisa(totalPaisa);
      }
      if (Number(breakdown.totalCourseFee) > 0) {
        return Number(breakdown.totalCourseFee);
      }
    }

    if (camp.feeHeadAmounts && Object.keys(camp.feeHeadAmounts).length > 0) {
      const entries = Object.entries(camp.feeHeadAmounts).filter(
        ([headId, amt]) => Number(amt) > 0 && (activeHeadMap.size === 0 || activeHeadMap.has(headId))
      );
      const totalPaisa = entries.reduce((sum, [, amt]) => paisaAdd(sum, toPaisa(Number(amt) || 0)), 0);
      if (totalPaisa > 0) return fromPaisa(totalPaisa);
    }

    if (Array.isArray(camp.feeHeadIds) && camp.feeHeadIds.length > 0) {
      let headSumPaisa = 0;
      for (const hid of camp.feeHeadIds) {
        const hObj = activeHeadMap.get(hid);
        if (hObj && typeof hObj.amount === 'number' && hObj.amount > 0) {
          headSumPaisa = paisaAdd(headSumPaisa, toPaisa(hObj.amount));
        }
      }
      if (headSumPaisa > 0) return fromPaisa(headSumPaisa);
    }

    if (Number(camp.totalCampaignFee) > 0 && campaignMatchesSemester(camp)) {
      return Number(camp.totalCampaignFee);
    }
  }

  // Fallback to configured active fee heads matching course/semester (with positive amounts)
  const matchingHeads = (feeHeads || []).filter((h) => {
    if (!h || typeof h.amount !== 'number' || h.amount <= 0) return false;
    const hAny = h as FeeHead & { course?: string; semester?: number; active?: boolean };
    if (hAny.active === false) return false;
    if (hAny.course && hAny.course.trim().toLowerCase() !== normCourse && hAny.course.trim().toLowerCase() !== 'all courses') {
      return false;
    }
    if (hAny.semester !== undefined && Number(hAny.semester) !== Number(targetSemester)) {
      return false;
    }
    return true;
  });

  if (matchingHeads.length > 0) {
    const totalPaisa = matchingHeads.reduce((sum, h) => paisaAdd(sum, toPaisa(h.amount || 0)), 0);
    if (totalPaisa > 0) return fromPaisa(totalPaisa);
  }

  throw new Error(
    `Fee Configuration Required: Cannot compute next-semester fee increment for "${course}" Semester ${targetSemester}. Configure active fee heads with amounts or an active course fee campaign structure first.`
  );
}

export const erpStorage = {
  // College Profile (Bug 201: Guarantee non-null merged profile even if storage is empty or partial)
  getCollegeProfile(): CollegeProfile {
    const stored = getCachedStoredItem<CollegeProfile>(STORAGE_KEYS.COLLEGE_PROFILE, INITIAL_COLLEGE_PROFILE);
    if (!stored || typeof stored !== 'object' || !stored.name) {
      return { ...INITIAL_COLLEGE_PROFILE, ...(stored || {}) };
    }
    return { ...INITIAL_COLLEGE_PROFILE, ...stored };
  },

  saveCollegeProfile(profile: CollegeProfile): void {
    const existing = this.getCollegeProfile();
    const existingCourses = (existing as any)?.coursesOffered;
    const newCourses = (profile as any)?.coursesOffered;
    if (Array.isArray(existingCourses) && Array.isArray(newCourses)) {
      if (existingCourses.length === newCourses.length) {
        const students = this.getStudents();
        let studentsModified = false;
        existingCourses.forEach((oldCourse: string, idx: number) => {
          const newCourse = newCourses[idx];
          if (oldCourse && newCourse && oldCourse.trim() !== newCourse.trim()) {
            students.forEach((s) => {
              if (s.course && s.course.trim().toLowerCase() === oldCourse.trim().toLowerCase()) {
                s.course = newCourse.trim();
                if (s.enrollmentData) {
                  s.enrollmentData.course = newCourse.trim();
                }
                studentsModified = true;
              }
            });
          }
        });
        if (studentsModified) {
          this.saveStudents(students);
        }
      }
    }
    setStoredItem(STORAGE_KEYS.COLLEGE_PROFILE, profile || INITIAL_COLLEGE_PROFILE);
  },

  // Users & Authentication
  getUsers(): UserAccount[] {
    return getStoredItem<UserAccount[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
  },

  saveUsers(users: UserAccount[]): void {
    setStoredItem(STORAGE_KEYS.USERS, users);
  },

  getAuditLogs(): AuditLogEntry[] {
    return getStoredItem<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  },

  appendAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const logs = this.getAuditLogs();
    const full = buildAuditLogEntry(entry);
    const updated = [full, ...logs].slice(0, 1000);
    setStoredItem(STORAGE_KEYS.AUDIT_LOGS, updated);
    return full;
  },

  getAuditOutbox(): Array<Omit<AuditLogEntry, 'id' | 'timestamp'> & { idempotencyKey?: string }> {
    return getStoredItem<Array<Omit<AuditLogEntry, 'id' | 'timestamp'> & { idempotencyKey?: string }>>(
      'rlsy_erp_audit_outbox_v1',
      []
    );
  },

  appendAuditOutbox(entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { idempotencyKey?: string }): string {
    return withStorageLock('audit_outbox', () => {
      const outbox = this.getAuditOutbox();
      const key =
        entry.idempotencyKey ||
        `OUT-${Date.now()}-${getCryptographicRandomHex(6)}`;
      if (!outbox.some((item) => item.idempotencyKey === key)) {
        outbox.push({ ...entry, idempotencyKey: key });
        setStoredItem('rlsy_erp_audit_outbox_v1', outbox);
      }
      return key;
    });
  },

  removeAuditOutboxEntries(keys: string[]): void {
    if (!keys || keys.length === 0) return;
    withStorageLock('audit_outbox', () => {
      const keySet = new Set(keys);
      const outbox = this.getAuditOutbox();
      const remaining = outbox.filter((item) => !item.idempotencyKey || !keySet.has(item.idempotencyKey));
      setStoredItem('rlsy_erp_audit_outbox_v1', remaining);
    });
  },

  clearAuditOutbox(): void {
    withStorageLock('audit_outbox', () => {
      setStoredItem('rlsy_erp_audit_outbox_v1', []);
    });
  },

  getCurrentUser(): UserAccount | null {
    const raw = getStoredItem<any>(STORAGE_KEYS.CURRENT_USER, null);
    if (!raw) return null;

    // Check signed session envelope integrity
    if (raw && typeof raw === 'object' && raw.user && typeof raw.expiresAt === 'number') {
      const now = Date.now();
      if (now - 30000 > raw.expiresAt) {
        // Session expired: purge stored token
        try {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        } catch {}
        return null;
      }

      // 1. Dual-layer Protection: Cryptographic HMAC signature check required unconditionally (with 30s clock skew tolerance)
      const isValid = Boolean(raw.signature) && verifySessionEnvelope(raw, 30000);
      if (!isValid) {
        console.warn('Missing or tampered session signature detected. Session revoked for security.');
        try {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        } catch {}
        return null;
      }

      // 2. Authoritative check: cross-reference against stored users database
      const authoritativeUsers = this.getUsers();
      const authoritativeUser = authoritativeUsers.find((u) => u.id === raw.user.id);
      if (!authoritativeUser || authoritativeUser.isActive === false || authoritativeUser.status === 'suspended') {
        try {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        } catch {}
        return null;
      }

      // 3. Session version check: invalidate sessions created prior to a password change (Bug 633)
      const authVer = authoritativeUser.sessionVersion ?? 1;
      const envelopeVer = raw.user.sessionVersion ?? 1;
      if (authVer !== envelopeVer) {
        try {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        } catch {}
        return null;
      }

      // Guard against client-side role privilege escalation
      if (authoritativeUser.role !== raw.user.role) {
        try {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        } catch {}
        return null;
      }

      // Never return password hashes, salts, or reset tokens into active React/session state
      const { password: _pw, salt: _s, resetToken: _rt, tempPassword: _tp, ...sanitizedAuthUser } = authoritativeUser;

      // Rolling activity renewal (throttled so read-only calls don't spam storage events)
      if (raw.expiresAt - now < SESSION_TIMEOUT_MS - 60000) {
        const renewedEnvelope = createSignedSessionEnvelope(sanitizedAuthUser);
        try {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(renewedEnvelope));
        } catch {}
      }
      return sanitizedAuthUser as UserAccount;
    }

    // Reject unsealed legacy user objects lacking a signed session envelope
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch {}
    return null;
  },

  setCurrentUser(user: UserAccount | null): void {
    if (user) {
      // Store signed cryptographic session envelope
      const envelope = createSignedSessionEnvelope(user);
      setStoredItem(STORAGE_KEYS.CURRENT_USER, envelope);
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      } catch {}
    }
  },

  updateUserPassword(userId: string, newPassword: string, salt?: string): UserAccount {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error('User not found');
    const nextSessionVersion = (users[index].sessionVersion || 1) + 1;
    const updated: UserAccount = {
      ...users[index],
      password: newPassword,
      salt: salt || users[index].salt,
      sessionVersion: nextSessionVersion,
      mustChangePassword: false,
    };
    users[index] = updated;
    this.saveUsers(users);

    // If current session is this user, update session envelope with new sessionVersion
    const cur = this.getCurrentUser();
    if (cur && cur.id === userId) {
      this.setCurrentUser(updated);
    }
    return updated;
  },

  onboardUser(user: Omit<UserAccount, 'id' | 'createdAt'>, pregeneratedId?: string): UserAccount {
    const users = this.getUsers();
    const cleanEmail = (user.email || '').trim().toLowerCase();
    const cleanMobile = (user.mobile || '').trim().replace(/[\s-]/g, '');

    // Duplicate account validation guard
    const existing = users.find(
      (u) =>
        Boolean(cleanEmail && (u.email || '').trim().toLowerCase() === cleanEmail) ||
        Boolean(cleanMobile && (u.mobile || '').trim().replace(/[\s-]/g, '') === cleanMobile)
    );
    if (existing) {
      throw new Error(`A user account with email "${user.email}" or mobile "${user.mobile}" already exists.`);
    }

    const id = pregeneratedId || generateSecureId('USR');
    const salt = user.salt || generateSecureSalt();

    // Ensure password is hashed with bcrypt (12 rounds) and never stored in plaintext or DJB2
    let passwordHash = user.password;
    if (!isBcryptHash(passwordHash)) {
      const rawCandidate = String(passwordHash || user.mobile || '').trim();
      passwordHash = hashPasswordBcryptSync(rawCandidate);
    }

    const newUser: UserAccount = {
      ...user,
      id,
      password: passwordHash,
      salt,
      createdAt: new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      mustChangePassword: true, // Mandatory first login password change
    };
    users.unshift(newUser);
    this.saveUsers(users);
    return newUser;
  },

  // Module Permissions
  getModulePermissions(persist: boolean = false): ModulePermissionMap {
    const perms = getStoredItem<ModulePermissionMap>(STORAGE_KEYS.MODULE_PERMISSIONS, INITIAL_MODULE_PERMISSIONS);
    let modified = false;
    // Statutory rule: Superadmin and Principal must not have access to fee ledger
    if (perms.superadmin && perms.superadmin.includes('fees')) {
      perms.superadmin = perms.superadmin.filter((m) => m !== 'fees');
      modified = true;
    }
    if (perms.principal && perms.principal.includes('fees')) {
      perms.principal = perms.principal.filter((m) => m !== 'fees');
      modified = true;
    }
    // Statutory rule: Attendance menu is not available for principal, accountant, superadmin
    (['superadmin', 'principal', 'accountant'] as const).forEach((role) => {
      if (perms[role] && perms[role].includes('attendance')) {
        perms[role] = perms[role].filter((m) => m !== 'attendance');
        modified = true;
      }
    });
    // Statutory rule: Grade management menu is strictly not available for admin, principal, and accountant (marks entry is faculty prerogative)
    (['superadmin', 'principal', 'accountant'] as const).forEach((role) => {
      if (perms[role] && perms[role].includes('grades')) {
        perms[role] = perms[role].filter((m) => m !== 'grades');
        modified = true;
      }
    });
    // Principal Academic Governance: ensure stream_mapping is in principal permissions
    if (perms.principal && !perms.principal.includes('stream_mapping')) {
      perms.principal.push('stream_mapping');
      modified = true;
    }
    // Statutory rule: Grade Setting menu is accessible by accountant, principal, and superadmin
    (['superadmin', 'principal', 'accountant'] as const).forEach((role) => {
      if (perms[role] && !perms[role].includes('grade_settings')) {
        perms[role].push('grade_settings');
        modified = true;
      }
    });
    // Grade Setting menu is barred for faculty and student
    (['faculty', 'student'] as const).forEach((role) => {
      if (perms[role] && perms[role].includes('grade_settings')) {
        perms[role] = perms[role].filter((m) => m !== 'grade_settings');
        modified = true;
      }
    });

    // Remove Faculty Portal and Student Portal from admin module (superadmin)
    if (perms.superadmin) {
      if (perms.superadmin.includes('faculty_portal')) {
        perms.superadmin = perms.superadmin.filter((m) => m !== 'faculty_portal');
        modified = true;
      }
      if (perms.superadmin.includes('student_portal')) {
        perms.superadmin = perms.superadmin.filter((m) => m !== 'student_portal');
        modified = true;
      }
      if (!perms.superadmin.includes('marksheet_designer')) {
        perms.superadmin.push('marksheet_designer');
        modified = true;
      }
    }
    if (perms.accountant && !perms.accountant.includes('marksheet_designer')) {
      perms.accountant.push('marksheet_designer');
      modified = true;
    }

    // Ensure all defined custom roles have entries in module permissions
    const customRoles = this.getCustomRoles();
    customRoles.forEach((cr) => {
      if (!perms[cr.code]) {
        perms[cr.code] = cr.allowedModules || ['overview'];
        modified = true;
      }
    });

    if (persist && modified) {
      setStoredItem(STORAGE_KEYS.MODULE_PERMISSIONS, perms);
    }
    return perms;
  },

  saveModulePermissions(perms: ModulePermissionMap, invokerRole?: string): void {
    assertAuthorizedRole(invokerRole, ['superadmin'], 'Save Module Permissions Matrix');
    // Superadmin should never have faculty_portal or student_portal, and must never lock itself out of core admin modules (Bug 645)
    if (perms.superadmin) {
      perms.superadmin = perms.superadmin.filter((m) => m !== 'faculty_portal' && m !== 'student_portal');
      const mandatorySuperAdminModules: Array<ModulePermissionMap['superadmin'][number]> = [
        'overview',
        'role_permissions',
        'user_management',
        'admin_settings',
      ];
      for (const reqMod of mandatorySuperAdminModules) {
        if (!perms.superadmin.includes(reqMod)) {
          perms.superadmin.push(reqMod);
        }
      }
    }
    // Maintain statutory bans on grades and attendance for administrative roles
    (['superadmin', 'principal', 'accountant'] as const).forEach((role) => {
      if (perms[role] && perms[role].includes('grades')) {
        perms[role] = perms[role].filter((m) => m !== 'grades');
      }
      if (perms[role] && perms[role].includes('attendance')) {
        perms[role] = perms[role].filter((m) => m !== 'attendance');
      }
    });

    // Synchronize custom role allowedModules with the updated permission map
    const customRoles = this.getCustomRoles();
    let customRolesModified = false;
    const updatedCustomRoles = customRoles.map((cr) => {
      if (perms[cr.code]) {
        customRolesModified = true;
        return { ...cr, allowedModules: perms[cr.code] };
      }
      return cr;
    });
    if (customRolesModified) {
      this.saveCustomRoles(updatedCustomRoles);
    }

    setStoredItem(STORAGE_KEYS.MODULE_PERMISSIONS, perms);
  },

  // Custom Roles & Permissions Management
  getCustomRoles(): CustomRoleDefinition[] {
    return getStoredItem<CustomRoleDefinition[]>(STORAGE_KEYS.CUSTOM_ROLES, INITIAL_CUSTOM_ROLES);
  },

  saveCustomRoles(roles: CustomRoleDefinition[]): void {
    setStoredItem(STORAGE_KEYS.CUSTOM_ROLES, roles);
  },

  addCustomRole(
    roleData: Omit<CustomRoleDefinition, 'id' | 'createdAt'>,
    invokerRole?: string
  ): CustomRoleDefinition {
    assertAuthorizedRole(invokerRole, ['superadmin'], 'Introduce New Role Type');
    const existing = this.getCustomRoles();
    const cleanCode = roleData.code.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!cleanCode) {
      throw new Error('Role identifier code cannot be empty.');
    }
    if (['superadmin', 'admin', 'root', 'system', 'principal', 'accountant', 'faculty', 'student'].includes(cleanCode)) {
      throw new Error(`Role code "${cleanCode}" is reserved for built-in system roles.`);
    }
    if (existing.some((r) => r.code.toLowerCase() === cleanCode)) {
      throw new Error(`A role type with code "${cleanCode}" already exists.`);
    }

    const newRole: CustomRoleDefinition = {
      id: `ROLE-${cleanCode.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      code: cleanCode,
      name: roleData.name.trim(),
      description: roleData.description.trim(),
      badgeColor: roleData.badgeColor || 'cyan',
      allowedModules: roleData.allowedModules && roleData.allowedModules.length > 0 ? roleData.allowedModules : ['overview'],
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: roleData.createdBy || 'Super Admin',
      isSystem: false,
    };

    const updatedRoles = [...existing, newRole];
    this.saveCustomRoles(updatedRoles);

    // Map the new role into the module permissions matrix
    const perms = this.getModulePermissions();
    perms[cleanCode] = newRole.allowedModules;
    this.saveModulePermissions(perms, this.getCurrentUser()?.role);

    return newRole;
  },

  deleteCustomRole(roleCode: string, invokerRole?: string): void {
    assertAuthorizedRole(invokerRole, ['superadmin'], 'Delete Custom Role');
    const cleanCode = (roleCode || '').trim().toLowerCase();
    const assignedUsers = this.getUsers().filter(
      (u) => (u.role || '').trim().toLowerCase() === cleanCode
    );
    if (assignedUsers.length > 0) {
      throw new Error(
        `Cannot delete custom role "${roleCode}": ${assignedUsers.length} staff user(s) (${assignedUsers
          .map((u) => u.name)
          .join(', ')}) are currently assigned to this role. Reassign their accounts before deleting the role.`
      );
    }
    const existing = this.getCustomRoles();
    const updated = existing.filter((r) => (r.code || '').trim().toLowerCase() !== cleanCode);
    this.saveCustomRoles(updated);

    const perms = this.getModulePermissions();
    const targetKey = Object.keys(perms).find((k) => k.trim().toLowerCase() === cleanCode) || roleCode;
    delete perms[targetKey];
    this.saveModulePermissions(perms, this.getCurrentUser()?.role);
  },

  // Enrollment Fields
  getEnrollmentFields(): EnrollmentField[] {
    return getCachedStoredItem<EnrollmentField[]>(STORAGE_KEYS.ENROLLMENT_FIELDS, INITIAL_ENROLLMENT_FIELDS);
  },

  saveEnrollmentFields(fields: EnrollmentField[]): void {
    setStoredItem(STORAGE_KEYS.ENROLLMENT_FIELDS, fields);
  },

  // Concession Rules
  getConcessionRules(): ConcessionRule[] {
    return getCachedStoredItem<ConcessionRule[]>(STORAGE_KEYS.CONCESSION_RULES, INITIAL_CONCESSION_RULES);
  },

  saveConcessionRules(rules: ConcessionRule[], invokerRole?: string): Student[] {
    assertAuthorizedRole(invokerRole, ['accountant', 'superadmin'], 'Save Concession Rules');
    const actor = this.getCurrentUser();
    setStoredItem(STORAGE_KEYS.CONCESSION_RULES, rules);
    const updated = this.recalculateAllStudentConcessions(rules);
    if (actor) {
      this.appendAuditLog({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        module: 'fees',
        action: 'CONCESSION_RULES_UPDATED',
        entityType: 'ConcessionRule',
        entityId: `COUNT-${rules.length}`,
        summary: `Updated institutional concession rules (${rules.length} active/defined)`,
      });
    }
    return updated;
  },

  applyStudentConcession(
    studentId: string,
    rule: ConcessionRule,
    invokerRole?: string
  ): {
    updatedStudent: Student;
    updatedStudents: Student[];
    concessionRemovedDueToPayment: boolean;
    message: string;
  } {
    assertAuthorizedRole(invokerRole, ['accountant', 'superadmin'], 'Apply Student Concession');
    const actor = this.getCurrentUser()!;
    const students = this.getStudents();
    const stuIndex = students.findIndex((s) => s.id === studentId);
    if (stuIndex === -1) {
      throw new Error(`Student ${studentId} not found.`);
    }
    const stu = students[stuIndex];
    const grossBasePaisa = paisaAdd(toPaisa(stu.totalFee), toPaisa(stu.concessionAmount || 0));
    const grossBaseFee = fromPaisa(grossBasePaisa);
    const concessionResult = calculateStudentConcession(stu.enrollmentData || {}, [rule], grossBaseFee);

    if (concessionResult.concessionAmount <= 0) {
      throw new Error(`Student "${stu.name}" does not meet the eligibility criteria for "${rule.title}".`);
    }

    const paidPaisa = toPaisa(stu.paidFee);
    const candidateTotalPaisa = toPaisa(concessionResult.finalFee);
    let updatedStudent: Student;
    let concessionRemovedDueToPayment = false;
    let message = '';

    const settings = this.getSystemSettings();
    const maxFeeDue = settings?.maxHallTicketFeeDue ?? 1000;
    const minAtt = settings?.minAttendanceThreshold ?? settings?.attendanceThreshold ?? 75;
    const allAttRecords = this.getAttendanceRecords();
    const stuHasAtt = allAttRecords.some((rec) => rec.studentId === stu.id) || (stu.attendanceStatus !== 'unverified' && (stu.attendancePercentage || 0) > 0);

    if (candidateTotalPaisa < paidPaisa) {
      // Confirmed policy: remove concession for that student/payment when discounted total falls below already-paid fee
      concessionRemovedDueToPayment = true;
      const restoredPending = fromPaisa(paisaSub(grossBasePaisa, paidPaisa, false));
      const eligibility = checkHallTicketEligibility(restoredPending, stu.attendancePercentage, maxFeeDue, minAtt, {
        hasAttendanceRecords: stuHasAtt,
        manualBlocked: stu.manualHallTicketBlocked,
        manualBlockReason: stu.manualBlockReason,
      });
      updatedStudent = {
        ...stu,
        totalFee: grossBaseFee,
        pendingFee: restoredPending,
        concessionApplied: undefined,
        concessionAmount: 0,
        hallTicketBlocked: !eligibility.isEligible,
        blockReason: eligibility.reasons.join('; '),
      };
      message = `Concession "${rule.title}" removed for ${stu.name}: student has already paid Rs. ${stu.paidFee.toLocaleString('en-IN')}, which exceeds the discounted total of Rs. ${concessionResult.finalFee.toLocaleString('en-IN')}.`;
      this.appendAuditLog({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        module: 'fees',
        action: 'CONCESSION_REMOVED_OVERPAYMENT_GUARD',
        entityType: 'Student',
        entityId: stu.id,
        summary: message,
        oldValue: {
          totalFee: stu.totalFee,
          paidFee: stu.paidFee,
          pendingFee: stu.pendingFee,
          concessionApplied: stu.concessionApplied,
          concessionAmount: stu.concessionAmount || 0,
        },
        newValue: {
          totalFee: updatedStudent.totalFee,
          paidFee: updatedStudent.paidFee,
          pendingFee: updatedStudent.pendingFee,
          concessionApplied: undefined,
          concessionAmount: 0,
        },
      });
    } else {
      const newPending = fromPaisa(paisaSub(candidateTotalPaisa, paidPaisa, false));
      const eligibility = checkHallTicketEligibility(newPending, stu.attendancePercentage, maxFeeDue, minAtt, {
        hasAttendanceRecords: stuHasAtt,
        manualBlocked: stu.manualHallTicketBlocked,
        manualBlockReason: stu.manualBlockReason,
      });
      updatedStudent = {
        ...stu,
        totalFee: concessionResult.finalFee,
        pendingFee: newPending,
        concessionApplied: rule.title,
        concessionAmount: concessionResult.concessionAmount,
        hallTicketBlocked: !eligibility.isEligible,
        blockReason: eligibility.reasons.join('; '),
      };
      message = `Applied "${rule.title}" to ${stu.name}. Concession of Rs. ${concessionResult.concessionAmount.toLocaleString('en-IN')} credited.`;
      this.appendAuditLog({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        module: 'fees',
        action: 'CONCESSION_APPLIED',
        entityType: 'Student',
        entityId: stu.id,
        summary: message,
        oldValue: {
          totalFee: stu.totalFee,
          pendingFee: stu.pendingFee,
          concessionApplied: stu.concessionApplied,
          concessionAmount: stu.concessionAmount || 0,
        },
        newValue: {
          totalFee: updatedStudent.totalFee,
          pendingFee: updatedStudent.pendingFee,
          concessionApplied: rule.title,
          concessionAmount: concessionResult.concessionAmount,
        },
      });
    }

    const updatedStudents = students.map((s, idx) => (idx === stuIndex ? updatedStudent : s));
    this.saveStudents(updatedStudents);
    return {
      updatedStudent,
      updatedStudents,
      concessionRemovedDueToPayment,
      message,
    };
  },

  // Real-time student concession and hall ticket re-evaluation across all active students
  recalculateAllStudentConcessions(rules?: ConcessionRule[]): Student[] {
    const activeRules = rules || this.getConcessionRules();
    const students = this.getStudents();
    const actor = this.getCurrentUser();
    const settings = this.getSystemSettings();
    const maxFeeDue = settings?.maxHallTicketFeeDue ?? 1000;
    const minAtt = settings?.minAttendanceThreshold ?? settings?.attendanceThreshold ?? 75;
    const allAttRecords = this.getAttendanceRecords();

    const updatedStudents = students.map((stu) => {
      const baseFeePaisa = paisaAdd(toPaisa(stu.totalFee), toPaisa(stu.concessionAmount || 0));
      const baseFee = fromPaisa(baseFeePaisa);
      const concession = calculateStudentConcession(stu.enrollmentData, activeRules, baseFee);

      const appliedTitle = concession.appliedRule ? concession.appliedRule.title : undefined;
      const discountAmt = concession.concessionAmount || 0;

      const candidateTotalPaisa = paisaSub(baseFeePaisa, toPaisa(discountAmt), false);
      const paidPaisa = toPaisa(stu.paidFee);
      const stuHasAtt = allAttRecords.some((rec) => rec.studentId === stu.id) || (stu.attendanceStatus !== 'unverified' && (stu.attendancePercentage || 0) > 0);

      // Remove concession if applying it reduces totalFee below already-paid fee (no silent clamping)
      if (discountAmt > 0 && candidateTotalPaisa < paidPaisa) {
        const restoredPending = fromPaisa(paisaSub(baseFeePaisa, paidPaisa, false));
        const eligibility = checkHallTicketEligibility(restoredPending, stu.attendancePercentage, maxFeeDue, minAtt, {
          hasAttendanceRecords: stuHasAtt,
          manualBlocked: stu.manualHallTicketBlocked,
          manualBlockReason: stu.manualBlockReason,
        });
        if (actor && (stu.concessionAmount || 0) > 0) {
          this.appendAuditLog({
            actorId: actor.id,
            actorName: actor.name,
            actorRole: actor.role,
            module: 'fees',
            action: 'CONCESSION_REMOVED_OVERPAYMENT_GUARD',
            entityType: 'Student',
            entityId: stu.id,
            summary: `Removed concession for ${stu.rollNo} because paidFee (Rs. ${stu.paidFee}) exceeds discounted total (Rs. ${fromPaisa(candidateTotalPaisa)})`,
          });
        }
        return {
          ...stu,
          totalFee: baseFee,
          pendingFee: restoredPending,
          concessionApplied: undefined,
          concessionAmount: 0,
          hallTicketBlocked: !eligibility.isEligible,
          blockReason: eligibility.reasons.join('; '),
        };
      }

      const newTotal = fromPaisa(candidateTotalPaisa);
      const newPending = fromPaisa(paisaSub(candidateTotalPaisa, paidPaisa, false));
      const eligibility = checkHallTicketEligibility(newPending, stu.attendancePercentage, maxFeeDue, minAtt, {
        hasAttendanceRecords: stuHasAtt,
        manualBlocked: stu.manualHallTicketBlocked,
        manualBlockReason: stu.manualBlockReason,
      });

      return {
        ...stu,
        totalFee: newTotal,
        pendingFee: newPending,
        concessionApplied: appliedTitle,
        concessionAmount: discountAmt,
        hallTicketBlocked: !eligibility.isEligible,
        blockReason: eligibility.reasons.join('; '),
      };
    });

    this.saveStudents(updatedStudents);
    return updatedStudents;
  },

  // Fee Campaigns
  getFeeCampaigns(): FeeCampaign[] {
    return getStoredItem<FeeCampaign[]>(STORAGE_KEYS.FEE_CAMPAIGNS, INITIAL_FEE_CAMPAIGNS);
  },

  saveFeeCampaigns(campaigns: FeeCampaign[], invokerRole?: string): void {
    assertAuthorizedRole(invokerRole, ['accountant', 'superadmin'], 'Save Fee Campaigns');
    const existing = this.getFeeCampaigns();
    const currentIds = new Set(campaigns.map((c) => c.id));
    const txns = this.getTransactions();
    for (const oldCamp of existing) {
      if (!currentIds.has(oldCamp.id)) {
        const hasLinkedTxn = txns.some((t) => t.campaignId === oldCamp.id);
        if (hasLinkedTxn) {
          throw new Error(
            `Referential integrity violation: Cannot delete fee campaign "${oldCamp.title}" because historical fee receipts reference it.`
          );
        }
      }
    }
    setStoredItem(STORAGE_KEYS.FEE_CAMPAIGNS, campaigns);
  },

  createFeeCampaign(campaign: Omit<FeeCampaign, 'id' | 'createdAt' | 'extensionHistory'>): FeeCampaign {
    const campaigns = this.getFeeCampaigns();
    const newCamp: FeeCampaign = {
      ...campaign,
      id: `CAMP-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      extensionHistory: [],
    };
    const updated = [newCamp, ...campaigns];
    this.saveFeeCampaigns(updated);
    return newCamp;
  },

  extendFeeCampaign(
    campaignId: string,
    newEndDate: string,
    extendedBy: string,
    reason?: string
  ): FeeCampaign {
    const campaigns = this.getFeeCampaigns();
    const index = campaigns.findIndex((c) => c.id === campaignId);
    if (index === -1) throw new Error('Fee Campaign not found');

    const camp = campaigns[index];
    const extensionEntry = {
      previousEndDate: camp.endDate,
      newEndDate,
      extendedAt: new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      extendedBy,
      reason: reason || 'Statutory date extension approved by administration',
    };

    const updated: FeeCampaign = {
      ...camp,
      endDate: newEndDate,
      status: 'Extended',
      extensionHistory: [extensionEntry, ...(camp.extensionHistory || [])],
    };

    campaigns[index] = updated;
    this.saveFeeCampaigns(campaigns);
    return updated;
  },

  // Faculty Mappings
  getFacultyMappings(): FacultyMapping[] {
    return getStoredItem<FacultyMapping[]>(STORAGE_KEYS.FACULTY_MAPPINGS, INITIAL_FACULTY_MAPPINGS);
  },

  saveFacultyMappings(mappings: FacultyMapping[], invokerRole?: string): void {
    assertAuthorizedRole(invokerRole, ['principal', 'superadmin'], 'Save Faculty Workload Mappings');
    setStoredItem(STORAGE_KEYS.FACULTY_MAPPINGS, mappings);
  },

  // Students
  getStudents(): Student[] {
    return getStoredItem<Student[]>(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
  },

  saveStudents(students: Student[]): void {
    const existing = this.getStudents();
    const currentIds = new Set(students.map((s) => s.id));
    const txns = this.getTransactions();
    const grades = this.getGrades();
    const deletedStudentIds = new Set<string>();
    const inactiveStudentIds = new Set<string>();

    for (const stu of students) {
      const st = String(stu.status || 'active').toLowerCase();
      if (st === 'expelled' || st === 'withdrawn' || st === 'transferred' || st === 'tc_issued') {
        inactiveStudentIds.add(stu.id);
      }
    }

    for (const oldStu of existing) {
      if (!currentIds.has(oldStu.id)) {
        // Block deletion if active payment transactions exist in ledger
        const hasTxn = txns.some((t) => t.studentId === oldStu.id || t.studentRollNo === oldStu.rollNo);
        if (hasTxn) {
          throw new Error(
            `Referential integrity violation: Cannot delete student "${oldStu.name} (${oldStu.rollNo})" because associated payment ledger transactions exist.`
          );
        }
        // Block deletion if academic grade records exist
        const hasGrade = grades.some((g) => g.studentId === oldStu.id || g.studentRollNo === oldStu.rollNo);
        if (hasGrade) {
          throw new Error(
            `Referential integrity violation: Cannot delete student "${oldStu.name} (${oldStu.rollNo})" because academic examination grade records exist.`
          );
        }
        deletedStudentIds.add(oldStu.id);
      }
    }

    // Deactivate login credentials when a student is expelled, withdrawn, or transferred (Bugs 666, 676)
    if (inactiveStudentIds.size > 0 || deletedStudentIds.size > 0) {
      const users = this.getUsers();
      let usersUpdated = false;
      const nextUsers = users.map((u) => {
        if (u.role === 'student' && u.studentId && (inactiveStudentIds.has(u.studentId) || deletedStudentIds.has(u.studentId))) {
          if (u.isActive !== false) {
            usersUpdated = true;
            return { ...u, isActive: false };
          }
        }
        return u;
      });
      if (usersUpdated) {
        this.saveUsers(nextUsers);
      }
    }

    // Cascade cleanup of orphaned attendance records when a student is removed (Bug 424)
    if (deletedStudentIds.size > 0) {
      const attRecords = this.getAttendanceRecords();
      const filteredAtt = attRecords.filter((r) => !deletedStudentIds.has(r.studentId));
      if (filteredAtt.length !== attRecords.length) {
        setStoredItem(STORAGE_KEYS.ATTENDANCE, filteredAtt);
      }
    }

    setStoredItem(STORAGE_KEYS.STUDENTS, students);
  },

  // Faculty
  getFaculty(): Faculty[] {
    return getStoredItem<Faculty[]>(STORAGE_KEYS.FACULTY, INITIAL_FACULTY);
  },

  saveFaculty(faculty: Faculty[]): void {
    const existingFaculty = this.getFaculty();
    const oldDeptMap = new Map<string, string>();
    existingFaculty.forEach((f) => {
      if (f.id && f.department) oldDeptMap.set(f.id, f.department);
      if (f.facultyId && f.department) oldDeptMap.set(f.facultyId, f.department);
    });

    const deptChangedFacultyIds = new Set<string>();
    faculty.forEach((f) => {
      const oldDept = oldDeptMap.get(f.id) || (f.facultyId ? oldDeptMap.get(f.facultyId) : undefined);
      if (oldDept && f.department && oldDept !== f.department) {
        if (f.id) deptChangedFacultyIds.add(f.id);
        if (f.facultyId) deptChangedFacultyIds.add(f.facultyId);
      }
    });

    if (deptChangedFacultyIds.size > 0) {
      const timetable = this.getTimetable();
      let timetableChanged = false;
      const cleanedTimetable: TimetableSlot[] = timetable.map((slot) => {
        if (slot.facultyId && deptChangedFacultyIds.has(slot.facultyId)) {
          const fac = faculty.find((f) => f.id === slot.facultyId || f.facultyId === slot.facultyId);
          const slotDept = (slot as TimetableSlot & { department?: string }).department;
          if (fac && slotDept && fac.department && slotDept !== fac.department) {
            timetableChanged = true;
            return { ...slot, facultyId: '', facultyName: '' };
          }
        }
        return slot;
      });
      if (timetableChanged) {
        this.saveTimetable(cleanedTimetable);
      }
    }

    setStoredItem(STORAGE_KEYS.FACULTY, faculty);
  },

  // Fee Heads
  getFeeHeads(): FeeHead[] {
    return getCachedStoredItem<FeeHead[]>(STORAGE_KEYS.FEE_HEADS, INITIAL_FEE_HEADS);
  },

  saveFeeHeads(feeHeads: FeeHead[], invokerRole?: string): void {
    assertAuthorizedRole(invokerRole, ['accountant', 'superadmin'], 'Save Fee Heads');
    const existing = this.getFeeHeads();
    const campaigns = this.getFeeCampaigns();
    const txns = this.getTransactions();
    const currentIds = new Set(feeHeads.map((h) => h.id));
    const newHeadById = new Map<string, FeeHead>(feeHeads.map((h) => [h.id, h]));
    let txnsModified = false;

    for (const oldHead of existing) {
      if (!currentIds.has(oldHead.id)) {
        // 1. Active campaign lock validation
        const lock = canModifyFeeHead(oldHead.id, campaigns);
        if (!lock.canModify) {
          throw new Error(`Cannot delete locked fee head "${oldHead.title}": ${lock.reason}`);
        }
        // 2. Historical transaction deletion protection by stable feeHeadId or legacy title
        const hasHistory = txns.some(
          (t) =>
            t.feeHeadId === oldHead.id ||
            (t.feeHeadTitle || '').trim().toLowerCase() === (oldHead.title || '').trim().toLowerCase()
        );
        if (hasHistory) {
          throw new Error(
            `Cannot delete fee head "${oldHead.title}" because historical student payment ledger records reference it.`
          );
        }
      } else {
        // 3. Preserve stable feeHeadId linkage & synchronize renamed titles across historical transactions
        const renamedHead = newHeadById.get(oldHead.id);
        if (renamedHead && renamedHead.title.trim() !== oldHead.title.trim()) {
          for (let i = 0; i < txns.length; i++) {
            const matchesById = txns[i].feeHeadId === oldHead.id;
            const matchesLegacyTitle =
              !txns[i].feeHeadId &&
              (txns[i].feeHeadTitle || '').trim().toLowerCase() === (oldHead.title || '').trim().toLowerCase();
            if (matchesById || matchesLegacyTitle) {
              txns[i] = {
                ...txns[i],
                feeHeadId: oldHead.id,
                feeHeadTitle: renamedHead.title.trim(),
              };
              txnsModified = true;
            }
          }
        }
      }
    }
    if (txnsModified) {
      setStoredItem(STORAGE_KEYS.TRANSACTIONS, txns);
    }
    setStoredItem(STORAGE_KEYS.FEE_HEADS, feeHeads);
  },

  // Transactions
  getTransactions(): FeeTransaction[] {
    return getStoredItem<FeeTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  },

  saveTransactions(transactions: FeeTransaction[]): void {
    setStoredItem(STORAGE_KEYS.TRANSACTIONS, transactions);
  },

  // Grades
  getGrades(): ExamGradeRecord[] {
    return getStoredItem<ExamGradeRecord[]>(STORAGE_KEYS.GRADES, INITIAL_EXAM_GRADES);
  },

  saveGrades(grades: ExamGradeRecord[]): void {
    setStoredItem(STORAGE_KEYS.GRADES, grades);
  },

  // Timetable
  getTimetable(): TimetableSlot[] {
    return getStoredItem<TimetableSlot[]>(STORAGE_KEYS.TIMETABLE, INITIAL_TIMETABLE);
  },

  saveTimetable(slots: TimetableSlot[]): void {
    setStoredItem(STORAGE_KEYS.TIMETABLE, slots);
  },

  // Attendance
  getAttendanceRecords(): AttendanceRecord[] {
    return getStoredItem<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE, INITIAL_ATTENDANCE_RECORDS);
  },

  saveAttendanceRecords(records: AttendanceRecord[]): void {
    setStoredItem(STORAGE_KEYS.ATTENDANCE, records);
    this.recalculateStudentAttendancePercentages(records);
  },

  // Notices
  getNotices(): InstitutionalNotice[] {
    return getStoredItem<InstitutionalNotice[]>(STORAGE_KEYS.NOTICES, INITIAL_NOTICES);
  },

  saveNotices(notices: InstitutionalNotice[]): void {
    setStoredItem(STORAGE_KEYS.NOTICES, notices);
  },

  // Tickets
  getTickets(): HelpdeskTicket[] {
    return getStoredItem<HelpdeskTicket[]>(STORAGE_KEYS.TICKETS, INITIAL_HELPDESK_TICKETS);
  },

  // Save attendance batch and update cumulative student attendance percentage (One record per class session/period)
  saveAttendanceBatch(
    newRecords: Omit<AttendanceRecord, 'id'>[],
    subjectCode: string
  ): { records: AttendanceRecord[]; students: Student[] } {
    return withStorageLock('attendance_batch', () => {
      const existingRecords = this.getAttendanceRecords();

      // Map existing records to check for session collision (same student, subject, date, and periodSlot)
      const existingMap = new Map<string, AttendanceRecord>();
      existingRecords.forEach((r) => {
        const sub = (r.subjectCode || 'GEN').trim().toUpperCase();
        const slot = (r.periodSlot || 'P1').trim().toUpperCase();
        const key = `${r.studentId}_${sub}_${r.date}_${slot}`;
        existingMap.set(key, r);
      });

      const newCreated: AttendanceRecord[] = [];
      const nowIso = new Date().toISOString();
      newRecords.forEach((r) => {
        const sub = (r.subjectCode || subjectCode || 'GEN').trim().toUpperCase();
        const slot = (r.periodSlot || 'P1').trim().toUpperCase();
        const key = `${r.studentId}_${sub}_${r.date}_${slot}`;
        if (existingMap.has(key)) {
          // Update existing session record in-place with audit metadata (Bug 435)
          const old = existingMap.get(key)!;
          const auditRemark =
            old.status !== r.status
              ? `[Rectified ${old.status}->${r.status} at ${nowIso.slice(0, 16).replace('T', ' ')}] ${r.remarks || ''}`.trim()
              : r.remarks || old.remarks;
          existingMap.set(key, {
            ...old,
            ...r,
            id: old.id,
            remarks: auditRemark,
          });
        } else {
          const created: AttendanceRecord = {
            ...r,
            id: generateSecureId('ATT'),
          };
          existingMap.set(key, created);
          newCreated.push(created);
        }
      });

      const allRecords = Array.from(existingMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setStoredItem(STORAGE_KEYS.ATTENDANCE, allRecords);

      // Recalculate each affected student's attendance stats dynamically
      const updatedStudents = this.recalculateStudentAttendancePercentages(allRecords);

      // Automated Absenteeism Warning Notification: scan for defaulters and issue statutory warnings
      this.scanAndIssueDefaulterWarnings(subjectCode);

      return { records: allRecords, students: updatedStudents };
    });
  },

  // Standalone student attendance % recalculation that feeds directly to Student Dashboard
  recalculateStudentAttendancePercentages(records?: AttendanceRecord[]): Student[] {
    const allRecords = records || this.getAttendanceRecords();
    const students = this.getStudents();
    const settings = this.getSystemSettings();
    const attendanceThreshold = settings?.minAttendanceThreshold ?? settings?.attendanceThreshold ?? 75;
    const maxFeeDue = settings?.maxHallTicketFeeDue ?? 1000;

    const updatedStudents = students.map((stu) => {
      // Scope attendance calculation to the student's current active semester when semester is tagged (Bug 397)
      const allStuRecords = allRecords.filter((rec) => rec.studentId === stu.id);
      const semScopedRecords = allStuRecords.filter(
        (rec) => !rec.semester || Number(rec.semester) === Number(stu.semester)
      );
      const studentRecords = semScopedRecords.length > 0 ? semScopedRecords : allStuRecords;

      if (studentRecords.length === 0) {
        // Confirmed policy: zero-record students remain unverified and are NOT blocked due to zero attendance
        const eligibility = checkHallTicketEligibility(
          stu.pendingFee,
          0,
          maxFeeDue,
          attendanceThreshold,
          {
            hasAttendanceRecords: false,
            manualBlocked: stu.manualHallTicketBlocked,
            manualBlockReason: stu.manualBlockReason,
          }
        );
        return {
          ...stu,
          attendancePercentage: 0,
          attendanceStatus: 'unverified' as const,
          hallTicketBlocked: !eligibility.isEligible,
          blockReason: eligibility.reasons.join('; '),
        };
      }

      const stats = calculateAttendanceStats(studentRecords, attendanceThreshold);
      const attendancePercentage = stats.percentage;
      const eligibility = checkHallTicketEligibility(
        stu.pendingFee,
        attendancePercentage,
        maxFeeDue,
        attendanceThreshold,
        {
          hasAttendanceRecords: stats.total > 0,
          manualBlocked: stu.manualHallTicketBlocked,
          manualBlockReason: stu.manualBlockReason,
        }
      );

      return {
        ...stu,
        attendancePercentage,
        attendanceStatus: stats.status,
        hallTicketBlocked: !eligibility.isEligible,
        blockReason: eligibility.reasons.join('; '),
      };
    });

    this.saveStudents(updatedStudents);
    return updatedStudents;
  },

  // Automated Absenteeism Warning Notices Engine (Configured Attendance Threshold Defaulter Scan)
  scanAndIssueDefaulterWarnings(subjectCode?: string): {
    issuedCount: number;
    defaulterCount: number;
    notices: InstitutionalNotice[];
  } {
    return withStorageLock('defaulter_notices', () => {
      const students = this.getStudents();
      const allRecords = this.getAttendanceRecords();
      const existingNotices = this.getNotices();
      const settings = this.getSystemSettings();
      const attendanceThreshold = settings?.minAttendanceThreshold ?? settings?.attendanceThreshold ?? 75;
      const today = getCurrentIstIsoDate();
      const newNotices: InstitutionalNotice[] = [];
      let defaulterCount = 0;
      const inactiveStatuses = new Set([
        'withdrawn',
        'expelled',
        'transferred',
        'tc_issued',
        'suspended',
        'graduated',
        'alumni',
      ]);

      for (const stu of students) {
        const stuStatus = String(stu.status || 'active').trim().toLowerCase();
        if (inactiveStatuses.has(stuStatus)) continue;

        const studentRecords = allRecords.filter((rec) => {
          if (rec.studentId !== stu.id) return false;
          if (subjectCode && rec.subjectCode && rec.subjectCode.toUpperCase() !== subjectCode.toUpperCase()) return false;
          return true;
        });

        const stats = calculateAttendanceStats(studentRecords, attendanceThreshold);

        if (stats.status !== 'unverified' && stats.isDefaulter) {
          defaulterCount++;
          const subjectSuffix = subjectCode ? ` [${subjectCode.trim().toUpperCase()}]` : '';
          const noticeTitle = `Statutory Absenteeism Notice: Attendance Defaulter [Roll: ${stu.rollNo}]${subjectSuffix}`;
          const nowMs = Date.now();
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          const alreadyIssued = existingNotices.some(
            (n) =>
              n.title === noticeTitle &&
              (n.date === today || Math.abs(nowMs - new Date(n.date).getTime()) < sevenDaysMs)
          );

          if (!alreadyIssued) {
            const warningNotice: InstitutionalNotice = {
              id: `NOT-DEF-${stu.rollNo}-${subjectCode ? subjectCode.trim().toUpperCase() : 'ALL'}-${Date.now()}`,
              title: noticeTitle,
              category: 'Attendance',
              content: `Official Statutory Warning: Student ${stu.name} (Roll: ${stu.rollNo}, Course: ${stu.course || 'All'}, Sem: ${stu.semester || 1}${subjectCode ? `, Subject: ${subjectCode}` : ''}) has an attendance percentage of ${stats.percentage.toFixed(1)}% (${stats.effectivePresent}/${stats.total} sessions), which is below the mandatory ${attendanceThreshold}% UGC minimum. Examination clearance and hall ticket download are blocked. Student must attend ${stats.classesNeededFor75} consecutive class sessions or submit approved medical condonation certificates.`,
              authorName: 'Office of the Principal & Academic Dean',
              authorRole: 'principal',
              date: today,
              isPinned: true,
              targetAudience: 'students',
              targetCourses: stu.course ? [stu.course] : undefined,
              targetSemesters: stu.semester ? [stu.semester] : undefined,
            };
            newNotices.push(warningNotice);
          }
        }
      }

      if (newNotices.length > 0) {
        const combined = [...newNotices, ...existingNotices];
        setStoredItem(STORAGE_KEYS.NOTICES, combined);
        return { issuedCount: newNotices.length, defaulterCount, notices: combined };
      }

      return { issuedCount: 0, defaulterCount, notices: existingNotices };
    });
  },

  // Atomic Sequential Financial-Year Receipt Counter (e.g., RLSY/2026-27/REC/000001)
  getNextReceiptNumber(customFinancialYear?: string): string {
    return withStorageLock('receipt_sequence', () => {
      const fy = normalizeFinancialYearCode(customFinancialYear);
      const seqMapKey = `${STORAGE_KEYS.RECEIPT_SEQUENCE}_${fy}`;
      let currentSeq = getStoredItem<number>(seqMapKey, 0);

      if (!currentSeq || currentSeq === 0) {
        const existingTxns = this.getTransactions();
        const fyPrefix = `RLSY/${fy}/REC/`;
        let maxExistingSeq = 0;
        for (const t of existingTxns) {
          if (t.receiptNo && t.receiptNo.startsWith(fyPrefix)) {
            const parts = t.receiptNo.split('/');
            const numPart = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(numPart) && numPart > maxExistingSeq) {
              maxExistingSeq = numPart;
            }
          }
        }
        currentSeq = maxExistingSeq;
      }

      const nextSeq = currentSeq + 1;
      setStoredItem(seqMapKey, nextSeq);
      return formatSequentialReceiptNumber(fy, nextSeq);
    });
  },

  // Execute payment with integer Paisa arithmetic & concurrency lock
  processFeePayment(
    studentId: string,
    amountInRupees: number,
    paymentMethod: 'UPI' | 'Card' | 'NetBanking' | 'Cash' | 'DD',
    feeHeadTitle: string,
    referenceNo?: string,
    campaignId?: string,
    feeHeadId?: string,
    serverReceiptNo?: string
  ): { transaction: FeeTransaction; student: Student } {
    return withStorageLock('fee_payment', () => {
      const students = this.getStudents();
      const transactions = this.getTransactions();
      const settings = this.getSystemSettings();
      const minAttendance = settings?.minAttendanceThreshold ?? settings?.attendanceThreshold ?? 75;
      const maxFeeDue = settings?.maxHallTicketFeeDue ?? 1000;

      if (!amountInRupees || amountInRupees <= 0 || isNaN(amountInRupees)) {
        throw new Error('Payment amount must be greater than zero.');
      }

      const studentIndex = students.findIndex((s) => s.id === studentId);
      if (studentIndex === -1) {
        throw new Error(`Student ${studentId} not found`);
      }

      const stu = students[studentIndex];
      const incomingPaisa = toPaisa(amountInRupees);
      if (incomingPaisa <= 0) {
        throw new Error('Payment amount must be greater than zero.');
      }

      const currentPaidPaisa = toPaisa(stu.paidFee);
      const totalPaisa = toPaisa(stu.totalFee);
      const pendingPaisa = paisaSub(totalPaisa, currentPaidPaisa, false);

      // Strict payment ceiling: Prevent payments exceeding outstanding dues
      if (incomingPaisa > pendingPaisa) {
        throw new Error(
          `Payment amount (₹${amountInRupees}) exceeds current outstanding fee balance of ₹${fromPaisa(pendingPaisa)}. Overpayment is strictly restricted.`
        );
      }

      const newPaidPaisa = paisaAdd(currentPaidPaisa, incomingPaisa);
      const newPendingPaisa = paisaSub(totalPaisa, newPaidPaisa, false);

      const updatedPaid = fromPaisa(newPaidPaisa);
      const updatedPending = Math.max(0, fromPaisa(newPendingPaisa));

      const attRecs = this.getAttendanceRecords().filter((rec) => rec.studentId === stu.id);
      const stuAttStats = calculateAttendanceStats(attRecs, minAttendance);
      const hasAtt =
        (stuAttStats.status !== 'unverified' && stuAttStats.total > 0) ||
        (stu.attendanceStatus !== 'unverified' && (stu.attendancePercentage || 0) > 0);
      const eligibility = checkHallTicketEligibility(updatedPending, stu.attendancePercentage, maxFeeDue, minAttendance, {
        hasAttendanceRecords: hasAtt,
        manualBlocked: stu.manualHallTicketBlocked,
        manualBlockReason: stu.manualBlockReason,
      });

      const updatedStudent: Student = {
        ...stu,
        paidFee: updatedPaid,
        pendingFee: updatedPending,
        hallTicketBlocked: !eligibility.isEligible,
        blockReason: eligibility.reasons.join('; '),
      };

      const receiptNo =
        serverReceiptNo && serverReceiptNo.trim() ? serverReceiptNo.trim() : this.getNextReceiptNumber();
      const txId = generateSecureId('TXN');

      const effectiveRef = referenceNo || `${paymentMethod}-${Date.now().toString().slice(-6)}`;
      const duplicateTxn = transactions.find((t) => t.referenceNo && t.referenceNo === effectiveRef);
      if (duplicateTxn) {
        throw new Error(`Duplicate transaction detected: Reference number ${effectiveRef} has already been settled.`);
      }

      const allHeads = this.getFeeHeads();
      const matchedHead =
        (feeHeadId ? allHeads.find((h) => h.id === feeHeadId) : undefined) ||
        allHeads.find((h) => h.title.trim().toLowerCase() === (feeHeadTitle || '').trim().toLowerCase());

      const now = new Date();
      const newTransaction: FeeTransaction = {
        id: txId,
        receiptNo,
        studentId: stu.id,
        studentRollNo: stu.rollNo,
        studentName: stu.name,
        course: stu.course,
        semester: stu.semester,
        amount: amountInRupees,
        feeHeadId: matchedHead?.id || feeHeadId,
        feeHeadTitle: matchedHead?.title || feeHeadTitle,
        paymentMethod,
        status: 'Success',
        referenceNo: effectiveRef,
        isoTimestamp: now.toISOString(),
        timestamp: now.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        campaignId,
        remarks: 'Automated settlement & institutional clearing',
      };

      students[studentIndex] = updatedStudent;
      this.saveStudents(students);

      const updatedTxns = [newTransaction, ...transactions];
      setStoredItem(STORAGE_KEYS.TRANSACTIONS, updatedTxns);

      const actor = this.getCurrentUser();
      this.appendAuditLog({
        actorId: actor?.id || stu.id,
        actorName: actor?.name || stu.name,
        actorRole: actor?.role || 'accountant',
        module: 'fees',
        action: 'FEE_PAYMENT_SETTLED',
        targetId: newTransaction.receiptNo,
        oldValue: { paidFee: stu.paidFee, pendingFee: stu.pendingFee },
        newValue: { paidFee: updatedPaid, pendingFee: updatedPending, amount: amountInRupees, receiptNo },
      });

      return { transaction: newTransaction, student: updatedStudent };
    });
  },

  // Save marks entry with strict score bounds validation & post-declaration lock check
  saveExamGrade(
    record: Omit<ExamGradeRecord, 'id' | 'letterGrade' | 'gradePoint'> & { totalMarks?: number; bypassDeclarationLock?: boolean }
  ): ExamGradeRecord {
    const declarations = this.getResultDeclarations();
    if (!record.bypassDeclarationLock) {
      const lockCheck = checkPostDeclarationGradeLock(record.semester, record.course || 'All Courses', declarations);
      if (lockCheck.locked) {
        throw new Error(lockCheck.reason || 'Semester results are declared and locked. Request Principal approval to unlock.');
      }
    }
    const grades = this.getGrades();

    const maxInternal = record.maxInternalMarks !== undefined ? record.maxInternalMarks : 30;
    const maxExternal = record.maxExternalMarks !== undefined ? record.maxExternalMarks : 70;
    const maxMarks = record.maxMarks !== undefined ? record.maxMarks : (maxInternal + maxExternal);

    if (!Number.isFinite(maxInternal) || !Number.isFinite(maxExternal) || !Number.isFinite(maxMarks) || maxMarks <= 0) {
      throw new Error('Marks configuration violation: Maximum marks ceilings must be finite positive numbers.');
    }

    // Strict finite & bounds assertion: reject NaN, Infinity, negative, or values exceeding ceilings
    if (record.internalMarks !== undefined && (!Number.isFinite(record.internalMarks) || record.internalMarks > maxInternal || record.internalMarks < 0)) {
      throw new Error(
        `Marks cap violation: Internal marks (${record.internalMarks}) must be a valid number between 0 and ${maxInternal} for student ${record.studentRollNo || record.studentId}.`
      );
    }
    if (record.externalMarks !== undefined && (!Number.isFinite(record.externalMarks) || record.externalMarks > maxExternal || record.externalMarks < 0)) {
      throw new Error(
        `Marks cap violation: External marks (${record.externalMarks}) must be a valid number between 0 and ${maxExternal} for student ${record.studentRollNo || record.studentId}.`
      );
    }

    const safeInternal = record.internalMarks !== undefined ? record.internalMarks : 0;
    const safeExternal = record.externalMarks !== undefined ? record.externalMarks : 0;
    const calculatedTotal = safeInternal + safeExternal;
    if (
      record.internalMarks !== undefined &&
      record.externalMarks !== undefined &&
      record.totalMarks !== undefined &&
      Math.abs(record.totalMarks - calculatedTotal) > 1e-6
    ) {
      throw new Error(
        `Marks total mismatch: Provided total marks (${record.totalMarks}) does not match internal + external marks (${calculatedTotal}).`
      );
    }
    const totalMarks = record.totalMarks !== undefined ? record.totalMarks : calculatedTotal;

    if (!Number.isFinite(totalMarks) || totalMarks > maxMarks || totalMarks < 0) {
      throw new Error(
        `Marks cap violation: Total marks (${totalMarks}) must be a valid number between 0 and ${maxMarks} for student ${record.studentRollNo || record.studentId}.`
      );
    }

    const { letter, gradePoint } = calculateGradePoint(totalMarks, maxMarks);

    const existingIndex = grades.findIndex(
      (g) =>
        g.studentId === record.studentId &&
        g.subjectCode === record.subjectCode &&
        g.semester === record.semester
    );

    const existingGrade = existingIndex !== -1 ? grades[existingIndex] : undefined;
    const prevRevisions = existingGrade?.revisionHistory || record.revisionHistory || [];
    const nextRevisionHistory =
      existingGrade && existingGrade.totalMarks !== totalMarks
        ? [
            ...prevRevisions,
            {
              previousMarks: existingGrade.totalMarks,
              newMarks: totalMarks,
              modifiedBy: record.evaluatedByFacultyId || 'Faculty',
              modifiedAt: new Date().toISOString(),
              reason: 'Score revision / re-evaluation update',
            },
          ]
        : prevRevisions;

    const fullRecord: ExamGradeRecord = {
      ...record,
      internalMarks: safeInternal,
      externalMarks: safeExternal,
      id: existingGrade ? existingGrade.id : generateSecureId('GRD'),
      totalMarks,
      letterGrade: letter,
      gradePoint,
      revisionHistory: nextRevisionHistory,
    };

    if (existingIndex !== -1) {
      grades[existingIndex] = fullRecord;
    } else {
      grades.unshift(fullRecord);
    }

    setStoredItem(STORAGE_KEYS.GRADES, grades);
    return fullRecord;
  },

  // Save new helpdesk ticket
  submitTicket(ticket: Omit<HelpdeskTicket, 'id' | 'ticketNo' | 'createdAt' | 'status'>): HelpdeskTicket {
    const tickets = this.getTickets();
    const college = this.getCollegeProfile();
    const currentYear = Number(getCurrentIstIsoDate().slice(0, 4)) || new Date().getFullYear();
    let maxTicketSeq = 0;
    for (const t of tickets) {
      const m = String(t.ticketNo || '').match(/(\d+)$/);
      if (m) {
        const val = parseInt(m[1], 10);
        if (Number.isFinite(val) && val > maxTicketSeq) maxTicketSeq = val;
      }
    }
    const seq = String(Math.max(tickets.length, maxTicketSeq) + 1).padStart(5, '0');
    const ticketNo = `${college.shortName || 'RLSY'}-GRV-${currentYear}-${seq}`;
    const newTicket: HelpdeskTicket = {
      ...ticket,
      id: generateSecureId('TKT'),
      ticketNo,
      status: 'Open',
      createdAt: new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const updated = [newTicket, ...tickets];
    setStoredItem(STORAGE_KEYS.TICKETS, updated);
    return newTicket;
  },

  // Resolve helpdesk ticket
  resolveTicket(ticketId: string, responseNote: string, officerName: string): void {
    const tickets = this.getTickets();
    const note = responseNote && responseNote.trim()
      ? responseNote.trim()
      : 'Grievance officially examined and resolved in accordance with institutional policy.';
    const updated = tickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: 'Resolved' as const,
          responseNote: note,
          respondedBy: officerName,
          resolvedAt: new Date().toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
      }
      return t;
    });
    setStoredItem(STORAGE_KEYS.TICKETS, updated);
  },

  saveTickets(tickets: HelpdeskTicket[]): void {
    setStoredItem(STORAGE_KEYS.TICKETS, tickets);
  },

  // Add Notice
  addNotice(notice: Omit<InstitutionalNotice, 'id' | 'date'>): InstitutionalNotice {
    const notices = this.getNotices();
    const newNotice: InstitutionalNotice = {
      ...notice,
      id: generateSecureId('NOT'),
      date: getCurrentIstIsoDate(),
    };
    const updated = [newNotice, ...notices];
    setStoredItem(STORAGE_KEYS.NOTICES, updated);
    return newNotice;
  },

  // Congratulation Messages & Honors Dashboard
  getCongratulationMessages(): CongratulationMessage[] {
    return getStoredItem<CongratulationMessage[]>(
      STORAGE_KEYS.CONGRATULATIONS,
      INITIAL_CONGRATULATIONS
    );
  },

  saveCongratulationMessages(messages: CongratulationMessage[]): void {
    setStoredItem(STORAGE_KEYS.CONGRATULATIONS, messages);
  },

  addCongratulationMessage(
    msg: Omit<CongratulationMessage, 'id' | 'date'>
  ): CongratulationMessage {
    const list = this.getCongratulationMessages();
    const newMsg: CongratulationMessage = {
      ...msg,
      id: generateSecureId('CONG'),
      date: getCurrentIstIsoDate(),
    };
    const updated = [newMsg, ...list];
    this.saveCongratulationMessages(updated);
    return newMsg;
  },

  // Marksheet Configuration with immutable template versioning
  getMarksheetConfig(): MarksheetConfig {
    return getCachedStoredItem<MarksheetConfig>(
      STORAGE_KEYS.MARKSHEET_CONFIG,
      INITIAL_MARKSHEET_CONFIG
    );
  },

  getMarksheetConfigHistory(): MarksheetConfig[] {
    return getCachedStoredItem<MarksheetConfig[]>(
      STORAGE_KEYS.MARKSHEET_VERSIONS,
      []
    );
  },

  saveMarksheetConfig(config: MarksheetConfig): void {
    const prev = this.getMarksheetConfig();
    const prevVersion = prev.version || 1;
    const { version: _v1, versionTimestamp: _t1, ...cleanPrev } = prev;
    const { version: _v2, versionTimestamp: _t2, ...cleanNext } = config;
    const isChanged = JSON.stringify(cleanPrev) !== JSON.stringify(cleanNext);
    const newVersion = isChanged ? prevVersion + 1 : prevVersion;
    const versionTimestamp = isChanged ? new Date().toISOString() : (prev.versionTimestamp || new Date().toISOString());
    const versionedConfig: MarksheetConfig = {
      ...config,
      version: newVersion,
      versionTimestamp,
    };
    setStoredItem(STORAGE_KEYS.MARKSHEET_CONFIG, versionedConfig);
    if (isChanged) {
      const history = this.getMarksheetConfigHistory();
      history.push(versionedConfig);
      setStoredItem(STORAGE_KEYS.MARKSHEET_VERSIONS, history);
    }
  },

  // Degree Division Rules for UGC Autonomous Degree Transcripts & Certification
  getDegreeDivisionRules(): DegreeDivisionRule[] {
    const config = this.getMarksheetConfig();
    if (config.degreeDivisionRules && config.degreeDivisionRules.length > 0) {
      return config.degreeDivisionRules;
    }
    return getCachedStoredItem<DegreeDivisionRule[]>(
      STORAGE_KEYS.DEGREE_DIVISION_RULES,
      DEFAULT_DEGREE_DIVISION_RULES
    );
  },

  saveDegreeDivisionRules(rules: DegreeDivisionRule[]): void {
    setStoredItem(STORAGE_KEYS.DEGREE_DIVISION_RULES, rules);
    const config = this.getMarksheetConfig();
    this.saveMarksheetConfig({
      ...config,
      degreeDivisionRules: rules,
    });
  },

  // Stream Course Subjects
  getStreamCourseSubjects(): StreamCourseSubject[] {
    return getCachedStoredItem<StreamCourseSubject[]>(
      STORAGE_KEYS.STREAM_COURSE_SUBJECTS,
      INITIAL_STREAM_COURSE_SUBJECTS
    );
  },

  saveStreamCourseSubjects(subjects: StreamCourseSubject[]): void {
    const existing = this.getStreamCourseSubjects();
    const currentCodes = new Set(subjects.map((s) => s.subjectCode.trim().toUpperCase()));
    const grades = this.getGrades();
    const evals = this.getStudentExamEvaluations();
    const attendance = this.getAttendanceRecords();
    const students = this.getStudents();
    let gradesUpdated = false;
    let evalsUpdated = false;
    let attendanceUpdated = false;
    const nonActiveCohortStatuses = new Set([
      'graduated',
      'alumni',
      'withdrawn',
      'expelled',
      'transferred',
      'tc_issued',
      'suspended',
    ]);

    // Check active cohort before subject deletion (Bug 30)
    for (const oldSub of existing) {
      if (!currentCodes.has(oldSub.subjectCode.trim().toUpperCase())) {
        const hasActiveCohort = students.some(
          (stu) =>
            !nonActiveCohortStatuses.has(String(stu.status || 'active').trim().toLowerCase()) &&
            stu.course === oldSub.course &&
            stu.semester === oldSub.semester
        );
        if (hasActiveCohort) {
          throw new Error(
            `Cannot delete subject "${oldSub.subjectName}" (${oldSub.subjectCode}): Active cohort enrolled in ${oldSub.course} Semester ${oldSub.semester}.`
          );
        }
      }
    }

    // Cascade subject renames to grades, evals, and attendance (Bug 23)
    const updatedSubMap = new Map<string, StreamCourseSubject>();
    subjects.forEach((s) => {
      updatedSubMap.set(s.subjectCode.trim().toUpperCase(), s);
      if (s.id) updatedSubMap.set(s.id, s);
    });

    for (const oldSub of existing) {
      const updatedSub = updatedSubMap.get(oldSub.subjectCode.trim().toUpperCase()) || (oldSub.id ? updatedSubMap.get(oldSub.id) : undefined);
      if (updatedSub && (updatedSub.subjectName !== oldSub.subjectName || updatedSub.subjectCode !== oldSub.subjectCode)) {
        for (let i = 0; i < grades.length; i++) {
          if (grades[i].subjectCode.toUpperCase() === oldSub.subjectCode.toUpperCase()) {
            grades[i] = {
              ...grades[i],
              subjectCode: updatedSub.subjectCode,
              subjectName: updatedSub.subjectName,
              credits: updatedSub.credits || grades[i].credits,
            };
            gradesUpdated = true;
          }
        }
        for (let i = 0; i < evals.length; i++) {
          if (evals[i].subjectCode.toUpperCase() === oldSub.subjectCode.toUpperCase()) {
            evals[i] = {
              ...evals[i],
              subjectCode: updatedSub.subjectCode,
              subjectName: updatedSub.subjectName,
              credits: updatedSub.credits || evals[i].credits,
            };
            evalsUpdated = true;
          }
        }
        for (let i = 0; i < attendance.length; i++) {
          if (attendance[i].subjectCode.toUpperCase() === oldSub.subjectCode.toUpperCase()) {
            attendance[i] = {
              ...attendance[i],
              subjectCode: updatedSub.subjectCode,
              subjectName: updatedSub.subjectName,
            };
            attendanceUpdated = true;
          }
        }
      }
    }

    for (const oldSub of existing) {
      if (!currentCodes.has(oldSub.subjectCode.trim().toUpperCase())) {
        // Snapshot subjectCode, subjectName, and credits onto historical ExamGradeRecords
        for (let i = 0; i < grades.length; i++) {
          if (
            grades[i].subjectCode.toUpperCase() === oldSub.subjectCode.toUpperCase() ||
            grades[i].subjectName === oldSub.subjectName
          ) {
            grades[i] = {
              ...grades[i],
              subjectCode: grades[i].subjectCode || oldSub.subjectCode,
              subjectName: grades[i].subjectName || oldSub.subjectName,
              credits: grades[i].credits || oldSub.credits || 4,
              course: grades[i].course || oldSub.course,
            };
            gradesUpdated = true;
          }
        }

        // Snapshot subjectCode, subjectName, and credits onto historical StudentExamEvaluations
        for (let i = 0; i < evals.length; i++) {
          if (
            evals[i].subjectCode.toUpperCase() === oldSub.subjectCode.toUpperCase() ||
            evals[i].subjectName === oldSub.subjectName
          ) {
            evals[i] = {
              ...evals[i],
              subjectCode: evals[i].subjectCode || oldSub.subjectCode,
              subjectName: evals[i].subjectName || oldSub.subjectName,
              credits: evals[i].credits || oldSub.credits || 4,
              course: evals[i].course || oldSub.course,
            };
            evalsUpdated = true;
          }
        }

        // Snapshot subjectName onto historical AttendanceRecords
        for (let i = 0; i < attendance.length; i++) {
          if (
            attendance[i].subjectCode.toUpperCase() === oldSub.subjectCode.toUpperCase() ||
            attendance[i].subjectName === oldSub.subjectName
          ) {
            attendance[i] = {
              ...attendance[i],
              subjectCode: attendance[i].subjectCode || oldSub.subjectCode,
              subjectName: attendance[i].subjectName || oldSub.subjectName,
            };
            attendanceUpdated = true;
          }
        }
      }
    }

    if (gradesUpdated) {
      setStoredItem(STORAGE_KEYS.GRADES, grades);
    }
    if (evalsUpdated) {
      setStoredItem(STORAGE_KEYS.STUDENT_EXAM_EVALUATIONS, evals);
    }
    if (attendanceUpdated) {
      setStoredItem(STORAGE_KEYS.ATTENDANCE, attendance);
    }
    setStoredItem(STORAGE_KEYS.STREAM_COURSE_SUBJECTS, subjects);
  },

  // Student Promotion & Audit
  getPromotionAuditRecords(): StudentPromotionRecord[] {
    return getStoredItem<StudentPromotionRecord[]>(
      STORAGE_KEYS.PROMOTION_AUDIT,
      []
    );
  },

  promoteStudents(
    streamCode: string,
    course: string,
    fromSemester: number,
    toSemester: number,
    rollNos: string[],
    promotedBy: string,
    subject?: string,
    invokerRole?: string,
    overrideOptions?: PromotionOverrideOptions
  ): { updatedStudents: Student[]; record: StudentPromotionRecord } {
    assertAuthorizedRole(invokerRole, ['principal', 'superadmin'], 'Promote Students Cohort');
    const sessionUser = this.getCurrentUser()!;

    // Strict sequential trajectory validation: cannot skip semesters or move backwards
    const courseMaxSemForBatch = getMaxSemestersForCourse(course);
    if (
      !Number.isInteger(Number(fromSemester)) ||
      !Number.isInteger(Number(toSemester)) ||
      Number(fromSemester) < 1 ||
      Number(toSemester) !== Number(fromSemester) + 1 ||
      Number(fromSemester) > courseMaxSemForBatch
    ) {
      throw new Error(
        `Invalid promotion trajectory: Target semester (${toSemester}) must be strictly sequential (${Number(fromSemester) + 1}) and source semester (${fromSemester}) cannot exceed ${courseMaxSemForBatch}.`
      );
    }

    // Principal-only override validation
    const wantOverride = Boolean(overrideOptions?.overrideEligibility);
    const cleanOverrideReason = (overrideOptions?.overrideReason || '').trim();
    if (wantOverride) {
      if (sessionUser.role !== 'principal') {
        throw new Error(
          'Security violation: Only an authenticated Principal can authorize an eligibility override during promotion.'
        );
      }
      if (cleanOverrideReason.length < 10) {
        throw new Error(
          'Override justification must be at least 10 characters long when Principal eligibility override is enabled.'
        );
      }
    }

    return withStorageLock('student_promotion', () => {
      const students = this.getStudents();
      const allGrades = this.getGrades();
      const declarations = this.getResultDeclarations();
      const feeCampaigns = this.getFeeCampaigns();
      const feeHeads = this.getFeeHeads();
      const settings = this.getSystemSettings();
      const minAtt = settings?.minAttendanceThreshold ?? 75;
      const todayIST = getCurrentIstIsoDate();

      const cleanRollNos = rollNos.map((r) => r.trim().toUpperCase());
      const matchedPromotedRolls: string[] = [];
      const ineligibleStudents: Array<{ rollNo: string; name?: string; reason: string }> = [];
      let overrideUsedInBatch = false;

      const normCourse = course.trim().toLowerCase();
      const normStream = streamCode.trim().toUpperCase();
      const nonPromotableStatuses = new Set([
        'suspended',
        'expelled',
        'withdrawn',
        'transferred',
        'tc_issued',
        'graduated',
        'alumni',
      ]);

      // Pre-capture intact snapshots before mutating any student record
      const preSnapshotMap = new Map<string, NonNullable<StudentPromotionRecord['previousSnapshots']>[number]>();

      const updatedStudents = students.map((stu) => {
        const stuRoll = stu.rollNo.trim().toUpperCase();
        if (!cleanRollNos.includes(stuRoll)) {
          return stu;
        }

        // 0. Active Student Status Check (suspended/withdrawn/graduated cannot be promoted)
        const stuStatus = String(stu.status || 'active').trim().toLowerCase();
        if (nonPromotableStatuses.has(stuStatus)) {
          ineligibleStudents.push({
            rollNo: stu.rollNo,
            name: stu.name,
            reason: `Status blocked: Student account status is "${stu.status}". Only active students can be promoted.`,
          });
          return stu;
        }

        // 1. Verify Course Match
        const stuCourse = (stu.course || '').trim().toLowerCase();
        if (stuCourse !== normCourse) {
          ineligibleStudents.push({
            rollNo: stu.rollNo,
            name: stu.name,
            reason: `Course mismatch: Student belongs to "${stu.course}", not "${course}".`,
          });
          return stu;
        }

        // 2. Verify Stream Match
        const stuStream = (stu.streamCode || '').trim().toUpperCase();
        if (stuStream !== normStream) {
          ineligibleStudents.push({
            rollNo: stu.rollNo,
            name: stu.name,
            reason: `Stream mismatch: Student stream is "${stu.streamCode}", not "${streamCode}".`,
          });
          return stu;
        }

        // 3. Verify From-Semester Match
        if (Number(stu.semester) !== Number(fromSemester)) {
          ineligibleStudents.push({
            rollNo: stu.rollNo,
            name: stu.name,
            reason: `Semester mismatch: Student is currently enrolled in Semester ${stu.semester}, not Semester ${fromSemester}.`,
          });
          return stu;
        }

        // 4. Verify Semester Grade Records Exist & Evaluate Backlogs
        const semGrades = allGrades.filter(
          (g) =>
            (g.studentId === stu.id ||
              (g.studentRollNo && g.studentRollNo.trim().toUpperCase() === stuRoll)) &&
            Number(g.semester) === Number(fromSemester)
        );
        if (semGrades.length === 0) {
          ineligibleStudents.push({
            rollNo: stu.rollNo,
            name: stu.name,
            reason: `Missing Grade Records: No Semester ${fromSemester} examination records found for this student.`,
          });
          return stu;
        }

        const failedCourses = semGrades.filter(
          (g) => isGradeBacklog(g.letterGrade) || (g.gradePoint !== undefined && g.gradePoint === 0)
        );

        const courseMaxSem = getMaxSemestersForCourse(stu.course || course);
        const isGraduating = Number(toSemester) > courseMaxSem || Number(fromSemester) >= courseMaxSem;

        // Final-semester graduation strictly requires ZERO backlogs (cannot graduate with backlogs)
        if (isGraduating && failedCourses.length > 0) {
          const failedSubjectNames = failedCourses.map((f) => f.subjectCode || f.subjectName).join(', ');
          ineligibleStudents.push({
            rollNo: stu.rollNo,
            name: stu.name,
            reason: `Graduation Blocked: Student has ${failedCourses.length} pending backlog paper(s) [${failedSubjectNames}] in Final Sem ${fromSemester}. Zero backlogs are required for graduation.`,
          });
          return stu;
        }

        let isConditionalPromotion = false;
        let conditionalReason = '';
        if (failedCourses.length > 0) {
          const failedSubjectNames = failedCourses
            .map((f) => f.subjectCode || f.subjectName)
            .join(', ');
          if (failedCourses.length > 2) {
            ineligibleStudents.push({
              rollNo: stu.rollNo,
              name: stu.name,
              reason: `Academic backlog ceiling exceeded (${failedCourses.length} papers: [${failedSubjectNames}] in Sem ${fromSemester}). Maximum 2 supplementary papers permitted.`,
            });
            return stu;
          }
          isConditionalPromotion = true;
          conditionalReason = `Conditional Promotion: Supplementary papers pending in [${failedSubjectNames}] (Semester ${fromSemester}).`;
        }

        // 5. Overridable Institutional Eligibility Checks (Result Declaration, Attendance, Zero Dues)
        const overridableReasons: string[] = [];

        const hasDeclaredResult = declarations.some((d) => {
          if (Number(d.semester) !== Number(fromSemester)) return false;
          const dc = (d.course || '').trim().toLowerCase();
          const courseMatch = dc === stuCourse || dc === 'all courses';
          if (!courseMatch) return false;
          return d.isPublished === true || d.status === 'Published' || Boolean(d.declarationDate && d.declarationDate <= todayIST);
        });
        if (!hasDeclaredResult) {
          overridableReasons.push(`Semester ${fromSemester} results are not yet officially declared`);
        }

        const currentAtt = Number(stu.attendancePercentage || 0);
        if (currentAtt < minAtt) {
          overridableReasons.push(`Attendance ${currentAtt}% is below statutory ${minAtt}% minimum`);
        }

        if (toPaisa(stu.pendingFee || 0) > 0) {
          overridableReasons.push(`Outstanding dues of Rs. ${Number(stu.pendingFee || 0).toLocaleString('en-IN')} remain unpaid`);
        }

        if (overridableReasons.length > 0 && !wantOverride) {
          ineligibleStudents.push({
            rollNo: stu.rollNo,
            name: stu.name,
            reason: `${overridableReasons.join('; ')}. (Principal override with written reason required to proceed.)`,
          });
          return stu;
        }

        if (overridableReasons.length > 0 && wantOverride) {
          overrideUsedInBatch = true;
        }

        // 6. Compute Next-Semester Fee Increment Strictly from Configured Fee Heads / Active Campaigns
        const semFeeIncrement = isGraduating
          ? 0
          : resolvePromotionFeeIncrement(
              stu.course || course,
              stu.streamCode || streamCode,
              Number(toSemester),
              feeCampaigns,
              feeHeads
            );

        // Save complete lossless snapshot prior to mutating student
        preSnapshotMap.set(stuRoll, {
          studentId: stu.id,
          rollNo: stu.rollNo,
          semester: stu.semester,
          status: stu.status,
          academicStatus: stu.academicStatus,
          totalFee: stu.totalFee,
          paidFee: stu.paidFee,
          pendingFee: stu.pendingFee,
          hallTicketBlocked: stu.hallTicketBlocked,
          blockReason: stu.blockReason,
          enrollmentData: stu.enrollmentData ? JSON.parse(JSON.stringify(stu.enrollmentData)) : {},
        });

        matchedPromotedRolls.push(stu.rollNo);

        // stu.totalFee is already net of any applied concession; do NOT subtract concessionAmount a second time
        const nextTotalFee = fromPaisa(paisaAdd(toPaisa(stu.totalFee), toPaisa(semFeeIncrement)));
        const nextPaidFee = Number(stu.paidFee) || 0;
        const nextPendingFee = fromPaisa(paisaSub(toPaisa(nextTotalFee), toPaisa(nextPaidFee), false));
        const maxFeeDue = settings?.maxHallTicketFeeDue ?? 1000;
        const hasAtt = currentAtt > 0 || stu.attendanceStatus !== 'unverified';
        const eligibility = checkHallTicketEligibility(nextPendingFee, currentAtt, maxFeeDue, minAtt, {
          hasAttendanceRecords: hasAtt,
          manualBlocked: stu.manualHallTicketBlocked,
          manualBlockReason: stu.manualBlockReason,
        });

        return {
          ...stu,
          semester: isGraduating ? courseMaxSem : Math.min(courseMaxSem, Number(toSemester)),
          status: isGraduating ? 'graduated' : stu.status || 'active',
          academicStatus: isGraduating ? 'Graduated' : stu.academicStatus,
          totalFee: nextTotalFee,
          pendingFee: nextPendingFee,
          hallTicketBlocked: isGraduating ? false : !eligibility.isEligible,
          blockReason: isGraduating ? '' : eligibility.reasons.join('; '),
          enrollmentData: {
            ...(stu.enrollmentData || {}),
            academicStatus: isGraduating
              ? 'Graduated'
              : isConditionalPromotion
              ? 'Conditional (Pending Supplementary Re-evaluation)'
              : 'Clear Regular Advancement',
            ...(overridableReasons.length > 0 && wantOverride
              ? {
                  principalOverrideReason: cleanOverrideReason,
                  principalOverrideBy: sessionUser.name,
                }
              : {}),
            ...(isGraduating
              ? {
                  graduatedAt: todayIST,
                  finalProgramSemester: String(courseMaxSem),
                }
              : {
                  lastPromotedFromSemester: String(fromSemester),
                  lastPromotedToSemester: String(toSemester),
                  semesterFeeAssessed: String(semFeeIncrement),
                  conditionalBacklogNote: conditionalReason || undefined,
                }),
          },
        };
      });

      this.saveStudents(updatedStudents);

      // Synchronize linked student UserAccount records upon promotion (Bug 135)
      if (matchedPromotedRolls.length > 0) {
        const promotedRollSet = new Set(matchedPromotedRolls.map((r) => r.trim().toUpperCase()));
        const stuByRoll = new Map<string, Student>();
        const stuById = new Map<string, Student>();
        for (const s of updatedStudents) {
          if (s.id) stuById.set(s.id, s);
          const normR = (s.rollNo || '').trim().toUpperCase();
          if (normR) stuByRoll.set(normR, s);
        }

        const currentUsers = this.getUsers();
        let usersModified = false;
        const syncedUsers = currentUsers.map((u) => {
          if (u.role !== 'student') return u;
          const uRoll = (u.rollNo || '').trim().toUpperCase();
          const matchedStu =
            (u.studentId ? stuById.get(u.studentId) : undefined) ||
            (u.id.startsWith('USR-') ? stuById.get(u.id.slice(4)) : undefined) ||
            (uRoll ? stuByRoll.get(uRoll) : undefined);
          if (matchedStu && promotedRollSet.has((matchedStu.rollNo || '').trim().toUpperCase())) {
            const nextStudentId = matchedStu.id;
            const nextRollNo = matchedStu.rollNo;
            const nextName = matchedStu.name || u.name;
            const nextEmail = matchedStu.email || u.email;
            if (
              u.studentId !== nextStudentId ||
              u.rollNo !== nextRollNo ||
              u.name !== nextName ||
              u.email !== nextEmail
            ) {
              usersModified = true;
              return {
                ...u,
                studentId: nextStudentId,
                rollNo: nextRollNo,
                name: nextName,
                email: nextEmail,
              };
            }
          }
          return u;
        });

        if (usersModified) {
          this.saveUsers(syncedUsers);
          const activeUser = this.getCurrentUser();
          if (activeUser && activeUser.role === 'student') {
            const refreshedActive = syncedUsers.find((u) => u.id === activeUser.id);
            if (refreshedActive) {
              this.setCurrentUser(refreshedActive);
            }
          }
        }
      }

      const previousSnapshots = Array.from(preSnapshotMap.values());

      const record: StudentPromotionRecord = {
        id: generateSecureId('PROM'),
        streamCode,
        course,
        subject,
        fromSemester,
        toSemester,
        promotedRollNos: matchedPromotedRolls,
        promotedCount: matchedPromotedRolls.length,
        promotedBy,
        promotedAt: new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        promotedAtIso: new Date().toISOString(),
        ineligibleStudents,
        previousSnapshots,
        ...(overrideUsedInBatch
          ? {
              overrideApplied: true,
              overrideReason: cleanOverrideReason,
              overrideById: sessionUser.id,
              overrideByRole: sessionUser.role,
              overrideByName: sessionUser.name,
            }
          : {}),
      };

      const audits = this.getPromotionAuditRecords();
      setStoredItem(STORAGE_KEYS.PROMOTION_AUDIT, [record, ...audits]);

      if (overrideUsedInBatch) {
        this.appendAuditLog({
          actorId: sessionUser.id,
          actorName: sessionUser.name,
          actorRole: sessionUser.role,
          module: 'promotion',
          action: 'PROMOTION_ELIGIBILITY_OVERRIDE',
          entityType: 'StudentPromotionRecord',
          entityId: record.id,
          reason: cleanOverrideReason,
          summary: `Principal authorized eligibility override for promotion batch ${record.id} (${course} Sem ${fromSemester}->${toSemester}): ${cleanOverrideReason}`,
        });
      }

      return { updatedStudents, record };
    });
  },

  // Revert a batch promotion audit record in strict LIFO order and restore full pre-promotion snapshots
  revertPromotionRecord(
    recordId: string,
    invokerRole?: string
  ): { updatedStudents: Student[]; audits: StudentPromotionRecord[] } {
    assertAuthorizedRole(invokerRole, ['principal', 'superadmin'], 'Revert Student Promotion Batch');
    const sessionUser = this.getCurrentUser()!;
    return withStorageLock('student_promotion', () => {
      const audits = this.getPromotionAuditRecords();
      const targetIdx = audits.findIndex((a) => a.id === recordId);
      if (targetIdx === -1) {
        throw new Error('Promotion audit record not found.');
      }
      const target = audits[targetIdx];
      if (target.revertedAt) {
        throw new Error('This promotion batch has already been reverted.');
      }

      const rollSet = new Set((target.promotedRollNos || []).map((r) => r.trim().toUpperCase()));

      // LIFO Integrity Guard: Prevent reverting an older batch if a newer un-reverted batch touched any of the same students
      const newerConflictingBatch = audits.slice(0, targetIdx).find((newer) => {
        if (newer.revertedAt) return false;
        return (newer.promotedRollNos || []).some((r) => rollSet.has(r.trim().toUpperCase()));
      });
      if (newerConflictingBatch) {
        throw new Error(
          `Out-of-order rollback blocked: Newer promotion batch "${newerConflictingBatch.id}" (Sem ${newerConflictingBatch.fromSemester} -> ${newerConflictingBatch.toSemester}) includes student(s) from this batch. Revert newer batches first.`
        );
      }

      const students = this.getStudents();
      const snapMap = new Map<string, NonNullable<StudentPromotionRecord['previousSnapshots']>[number]>();
      for (const snap of target.previousSnapshots || []) {
        snapMap.set(snap.rollNo.trim().toUpperCase(), snap);
      }

      const updatedStudents = students.map((stu) => {
        const normRoll = stu.rollNo.trim().toUpperCase();
        if (!rollSet.has(normRoll)) return stu;
        const snap = snapMap.get(normRoll);
        if (snap) {
          return {
            ...stu,
            semester: snap.semester,
            status: snap.status || 'active',
            academicStatus: snap.academicStatus,
            totalFee: snap.totalFee,
            paidFee: snap.paidFee !== undefined ? snap.paidFee : stu.paidFee,
            pendingFee: snap.pendingFee,
            hallTicketBlocked:
              snap.hallTicketBlocked !== undefined ? snap.hallTicketBlocked : stu.hallTicketBlocked,
            blockReason: snap.blockReason !== undefined ? snap.blockReason : stu.blockReason,
            enrollmentData: snap.enrollmentData
              ? JSON.parse(JSON.stringify(snap.enrollmentData))
              : stu.enrollmentData,
          };
        }
        return {
          ...stu,
          semester: target.fromSemester,
          status: 'active',
          academicStatus: undefined,
        };
      });

      this.saveStudents(updatedStudents);
      const updatedAudits = audits.map((a, idx) =>
        idx === targetIdx
          ? {
              ...a,
              revertedAt: new Date().toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            }
          : a
      );
      setStoredItem(STORAGE_KEYS.PROMOTION_AUDIT, updatedAudits);

      this.appendAuditLog({
        actorId: sessionUser.id,
        actorName: sessionUser.name,
        actorRole: sessionUser.role,
        module: 'promotion',
        action: 'STUDENT_PROMOTION_REVERTED',
        entityType: 'StudentPromotionRecord',
        entityId: target.id,
        summary: `Reverted promotion batch ${target.id} (${target.promotedCount} student(s) restored to Sem ${target.fromSemester})`,
      });

      return { updatedStudents, audits: updatedAudits };
    });
  },

  // Service Tariffs (Certificate & Services Catalog)
  getServiceTariffs(): ServiceTariff[] {
    return getStoredItem<ServiceTariff[]>(STORAGE_KEYS.SERVICE_TARIFFS, INITIAL_SERVICE_TARIFFS);
  },

  saveServiceTariffs(tariffs: ServiceTariff[]): void {
    setStoredItem(STORAGE_KEYS.SERVICE_TARIFFS, tariffs);
  },

  saveServiceTariff(tariff: ServiceTariff): void {
    const list = this.getServiceTariffs();
    const idx = list.findIndex((t) => t.id === tariff.id);
    if (idx >= 0) {
      list[idx] = tariff;
    } else {
      list.push(tariff);
    }
    this.saveServiceTariffs(list);
  },

  toggleServiceTariffStatus(id: string): void {
    const list = this.getServiceTariffs();
    const item = list.find((t) => t.id === id);
    if (item) {
      item.status = item.status === 'active' ? 'suspended' : 'active';
      this.saveServiceTariffs(list);
    }
  },

  // Student Service Requests
  getServiceRequests(): ServiceRequestItem[] {
    return getStoredItem<ServiceRequestItem[]>(STORAGE_KEYS.SERVICE_REQUESTS, INITIAL_SERVICE_REQUESTS);
  },

  saveServiceRequests(requests: ServiceRequestItem[]): void {
    setStoredItem(STORAGE_KEYS.SERVICE_REQUESTS, requests);
  },

  createServiceRequest(
    data: Omit<ServiceRequestItem, 'id' | 'requestNo' | 'requestDate' | 'status'>
  ): ServiceRequestItem {
    const requests = this.getServiceRequests();
    let maxReqNum = 1049;
    for (const r of requests) {
      const m = String(r.requestNo || '').match(/(\d+)$/);
      if (m) {
        const val = parseInt(m[1], 10);
        if (Number.isFinite(val) && val > maxReqNum) maxReqNum = val;
      }
    }
    const nextNum = Math.max(1050 + requests.length, maxReqNum + 1);
    const today = getCurrentIstIsoDate();
    const newReq: ServiceRequestItem = {
      ...data,
      id: generateSecureId('REQ'),
      requestNo: `RLSY-SRV-${nextNum}`,
      requestDate: today,
      status: 'Submitted',
    };
    const updated = [newReq, ...requests];
    this.saveServiceRequests(updated);
    return newReq;
  },

  updateServiceRequestStatus(
    id: string,
    status: ServiceRequestItem['status'],
    issuedBy?: string,
    remarks?: string
  ): void {
    const requests = this.getServiceRequests();
    const updated = requests.map((req) => {
      if (req.id === id) {
        const today = getCurrentIstIsoDate();
        return {
          ...req,
          status,
          issuedBy: issuedBy || req.issuedBy,
          issuedDate: status === 'Issued' ? today : req.issuedDate,
          certificateNumber:
            status === 'Issued' && !req.certificateNumber
              ? `RLSY/CERT/${today.slice(0, 4)}/${String(req.requestNo || '0001').replace(/[^0-9A-Z]/gi, '').slice(-4).padStart(4, '0')}`
              : req.certificateNumber,
          remarks: remarks !== undefined ? remarks : req.remarks,
        };
      }
      return req;
    });
    this.saveServiceRequests(updated);
  },

  // Mark Service Request as Completed and Move to Archive
  completeServiceRequest(
    id: string,
    completedBy: string,
    remarks?: string
  ): void {
    const requests = this.getServiceRequests();
    const today = getCurrentIstIsoDate();
    const updated = requests.map((req) => {
      if (req.id === id) {
        const serialSuffix = String(req.requestNo || '0001').replace(/[^0-9A-Z]/gi, '').slice(-4).padStart(4, '0');
        return {
          ...req,
          status: 'Issued' as const,
          completedDate: today,
          completedBy,
          issuedBy: completedBy,
          issuedDate: today,
          certificateNumber: req.certificateNumber || `RLSY/CERT/${today.slice(0, 4)}/${serialSuffix}`,
          remarks: remarks !== undefined ? remarks : req.remarks,
          archived: true,
        };
      }
      return req;
    });
    this.saveServiceRequests(updated);
  },

  // 3-Month Retention Audit Soft-Archival (Moves expired archived requests to cold audit archive - Bugs 215, 218)
  purgeExpiredServiceRequests(daysThreshold: number = 90): { deletedCount: number; remaining: ServiceRequestItem[] } {
    const requests = this.getServiceRequests();
    const now = new Date().getTime();
    const thresholdMs = Math.max(1, daysThreshold) * 24 * 60 * 60 * 1000;
    const isArchivedFlag = (val: unknown): boolean =>
      val === true || String(val ?? '').trim().toLowerCase() === 'true' || val === 1 || val === '1';

    const remaining: ServiceRequestItem[] = [];
    const coldArchivedBatch: ServiceRequestItem[] = [];

    for (const req of requests) {
      if (!isArchivedFlag(req.archived)) {
        remaining.push(req);
        continue;
      }
      const refDateStr = req.completedDate || req.issuedDate || req.requestDate;
      const refTime = new Date(refDateStr).getTime();
      if (isNaN(refTime) || now - refTime < thresholdMs) {
        remaining.push(req);
      } else {
        coldArchivedBatch.push({ ...req, archived: true });
      }
    }

    const deletedCount = coldArchivedBatch.length;
    if (deletedCount > 0) {
      // Preserve in cold storage audit vault instead of irreversible destruction (Bug 218)
      const existingCold = getStoredItem<ServiceRequestItem[]>('rlsy_erp_service_requests_cold_archive_v3', []);
      setStoredItem('rlsy_erp_service_requests_cold_archive_v3', [...coldArchivedBatch, ...existingCold].slice(0, 500));
      this.saveServiceRequests(remaining);
    }
    return { deletedCount, remaining };
  },

  // Admin toggling of staff user mapped to process student service requests
  toggleServiceRequestProcessor(userId: string): UserAccount[] {
    const users = this.getUsers();
    const updated = users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          canProcessServiceRequests: !u.canProcessServiceRequests,
        };
      }
      return u;
    });
    this.saveUsers(updated);
    const currentUser = this.getCurrentUser();
    if (currentUser?.id === userId) {
      const updatedSelf = updated.find((u) => u.id === userId);
      if (updatedSelf) {
        this.setCurrentUser(updatedSelf);
      }
    }
    return updated;
  },

  // 3-Way Reconciliation
  get3WayReconciliation(): Reconciliation3WayRecord[] {
    return getStoredItem<Reconciliation3WayRecord[]>(
      STORAGE_KEYS.RECONCILIATION_3WAY,
      INITIAL_RECONCILIATION_3WAY
    );
  },

  get3WayReconciliationRecords(): Reconciliation3WayRecord[] {
    return this.get3WayReconciliation();
  },

  save3WayReconciliation(records: Reconciliation3WayRecord[]): void {
    setStoredItem(STORAGE_KEYS.RECONCILIATION_3WAY, records);
  },

  save3WayReconciliationRecords(records: Reconciliation3WayRecord[]): void {
    this.save3WayReconciliation(records);
  },

  // System Settings (Admin Settings & Attendance Threshold)
  getSystemSettings(): SystemSettingsConfig {
    return getCachedStoredItem<SystemSettingsConfig>(STORAGE_KEYS.SYSTEM_SETTINGS, INITIAL_SYSTEM_SETTINGS);
  },

  saveSystemSettings(settings: SystemSettingsConfig): void {
    setStoredItem(STORAGE_KEYS.SYSTEM_SETTINGS, settings);
  },

  // Report Definitions & Parameters
  getReportDefinitions(): ReportTypeDefinition[] {
    return getCachedStoredItem<ReportTypeDefinition[]>(
      STORAGE_KEYS.REPORT_DEFINITIONS,
      INITIAL_REPORT_DEFINITIONS
    );
  },

  saveReportDefinitions(defs: ReportTypeDefinition[]): void {
    setStoredItem(STORAGE_KEYS.REPORT_DEFINITIONS, defs);
  },

  getReportParameters(): ReportParameterDef[] {
    return getCachedStoredItem<ReportParameterDef[]>(
      STORAGE_KEYS.REPORT_PARAMETERS,
      INITIAL_REPORT_PARAMETERS
    );
  },

  saveReportParameters(params: ReportParameterDef[]): void {
    setStoredItem(STORAGE_KEYS.REPORT_PARAMETERS, params);
  },

  // Certificate Designer Configuration with immutable template versioning
  getCertificateConfig(): CertificateDesignConfig {
    return getCachedStoredItem<CertificateDesignConfig>(
      STORAGE_KEYS.CERTIFICATE_CONFIG,
      INITIAL_CERTIFICATE_CONFIG
    );
  },

  getCertificateConfigHistory(): CertificateDesignConfig[] {
    return getCachedStoredItem<CertificateDesignConfig[]>(
      STORAGE_KEYS.CERTIFICATE_VERSIONS,
      []
    );
  },

  saveCertificateConfig(cfg: CertificateDesignConfig): void {
    const prev = this.getCertificateConfig();
    const prevVersion = prev.version || 1;
    const { version: _v1, versionTimestamp: _t1, ...cleanPrev } = prev;
    const { version: _v2, versionTimestamp: _t2, ...cleanNext } = cfg;
    const isChanged = JSON.stringify(cleanPrev) !== JSON.stringify(cleanNext);
    const newVersion = isChanged ? prevVersion + 1 : prevVersion;
    const versionTimestamp = isChanged ? new Date().toISOString() : (prev.versionTimestamp || new Date().toISOString());
    const versionedConfig: CertificateDesignConfig = {
      ...cfg,
      version: newVersion,
      versionTimestamp,
    };
    setStoredItem(STORAGE_KEYS.CERTIFICATE_CONFIG, versionedConfig);
    if (isChanged) {
      const history = this.getCertificateConfigHistory();
      history.push(versionedConfig);
      setStoredItem(STORAGE_KEYS.CERTIFICATE_VERSIONS, history);
    }
  },

  // Course Section Management (Deactivated by default; Admin controlled)
  getCourseSections(): CourseSectionConfig[] {
    return getCachedStoredItem<CourseSectionConfig[]>(
      STORAGE_KEYS.COURSE_SECTIONS,
      INITIAL_COURSE_SECTIONS
    );
  },

  saveCourseSections(sections: CourseSectionConfig[]): void {
    setStoredItem(STORAGE_KEYS.COURSE_SECTIONS, sections);
  },

  toggleSectionStatus(sectionId: string, isActive: boolean): CourseSectionConfig[] {
    const sections = this.getCourseSections();
    const updated = sections.map((sec) =>
      sec.id === sectionId ? { ...sec, isActive } : sec
    );
    this.saveCourseSections(updated);
    return updated;
  },

  addCourseSection(newSec: Omit<CourseSectionConfig, 'id'>): CourseSectionConfig[] {
    const sections = this.getCourseSections();
    const created: CourseSectionConfig = {
      ...newSec,
      id: generateSecureId('SEC'),
    };
    const updated = [...sections, created];
    this.saveCourseSections(updated);
    return updated;
  },

  // Grade Evaluation Heads (Admin managed: add, modify, delete, sequence, default value, dropdown values)
  getGradeEvaluationHeads(): GradeEvaluationHead[] {
    const list = getCachedStoredItem<GradeEvaluationHead[]>(
      STORAGE_KEYS.GRADE_EVALUATION_HEADS,
      INITIAL_GRADE_HEADS
    );
    return [...list].sort((a, b) => a.sequence - b.sequence || String(a.id).localeCompare(String(b.id)));
  },

  saveGradeEvaluationHeads(heads: GradeEvaluationHead[]): void {
    setStoredItem(STORAGE_KEYS.GRADE_EVALUATION_HEADS, heads);
  },

  addGradeEvaluationHead(head: Omit<GradeEvaluationHead, 'id'>): GradeEvaluationHead[] {
    const existing = this.getGradeEvaluationHeads();
    const newHead: GradeEvaluationHead = {
      ...head,
      id: generateSecureId('HEAD'),
      sequence: head.sequence || existing.length + 1,
    };
    const updated = [...existing, newHead].sort((a, b) => a.sequence - b.sequence || String(a.id).localeCompare(String(b.id)));
    this.saveGradeEvaluationHeads(updated);
    return updated;
  },

  updateGradeEvaluationHead(updatedHead: GradeEvaluationHead): GradeEvaluationHead[] {
    const existing = this.getGradeEvaluationHeads();
    const updated = existing.map((h) => (h.id === updatedHead.id ? updatedHead : h));
    this.saveGradeEvaluationHeads(updated);
    return updated;
  },

  deleteGradeEvaluationHead(headId: string): GradeEvaluationHead[] {
    const existing = this.getGradeEvaluationHeads();
    const updated = existing
      .filter((h) => h.id !== headId)
      .map((h, idx) => ({ ...h, sequence: idx + 1 }));
    this.saveGradeEvaluationHeads(updated);
    return updated;
  },

  reorderGradeEvaluationHeads(heads: GradeEvaluationHead[]): GradeEvaluationHead[] {
    const updated = heads.map((h, idx) => ({ ...h, sequence: idx + 1 }));
    this.saveGradeEvaluationHeads(updated);
    return updated;
  },

  // Faculty Subject Grade Configuration (Max marks per head, total max marks)
  getFacultyGradeConfigs(): Record<string, FacultySubjectGradeConfig> {
    return getStoredItem<Record<string, FacultySubjectGradeConfig>>(
      STORAGE_KEYS.FACULTY_GRADE_CONFIGS,
      {}
    );
  },

  saveFacultyGradeConfig(config: FacultySubjectGradeConfig): void {
    const all = this.getFacultyGradeConfigs();
    const key = `${config.course}___${config.semester}___${config.subjectCode}`;
    all[key] = config;
    setStoredItem(STORAGE_KEYS.FACULTY_GRADE_CONFIGS, all);
  },

  // Semester Result Declaration Schedule (Principal & Accountant managed)
  getResultDeclarations(): SemesterResultDeclaration[] {
    return getStoredItem<SemesterResultDeclaration[]>(
      STORAGE_KEYS.RESULT_DECLARATIONS,
      INITIAL_RESULT_DECLARATIONS
    );
  },

  saveResultDeclarations(declarations: SemesterResultDeclaration[], invokerRole?: string): void {
    const actor = this.getCurrentUser();
    if (actor) {
      assertAuthorizedRole(invokerRole || actor.role, ['principal', 'superadmin'], 'Save Result Declarations');
    }
    setStoredItem(STORAGE_KEYS.RESULT_DECLARATIONS, declarations);
  },

  updateResultDeclarationDate(
    id: string,
    declarationDate: string,
    declaredByRole?: 'principal' | 'accountant' | 'superadmin',
    declaredByName?: string,
    remarks?: string,
    lockOverrideReason?: string
  ): SemesterResultDeclaration[] {
    assertAuthorizedRole(declaredByRole, ['principal', 'superadmin'], 'Update Result Declaration Date');
    const actor = this.getCurrentUser()!;
    const declarations = this.getResultDeclarations();
    const todayIST = getCurrentIstIsoDate();
    const cleanOverride = (lockOverrideReason || '').trim();
    let beforeSnapshot: SemesterResultDeclaration | undefined;
    let afterSnapshot: SemesterResultDeclaration | undefined;

    const updated = declarations.map((dec) => {
      if (dec.id !== id) return dec;
      beforeSnapshot = dec;
      const wasLockedOrPublished = Boolean(
        dec.isLocked || dec.isPublished || dec.status === 'Published' || (dec.declarationDate && dec.declarationDate <= todayIST)
      );
      const movingToFuture = Boolean(declarationDate && declarationDate > todayIST);
      if (wasLockedOrPublished && movingToFuture && cleanOverride.length < 10) {
        throw new Error(
          'Post-declaration lock cannot be relaxed by moving the declaration date to the future without a written Principal/Super Admin approval reason (at least 10 characters).'
        );
      }
      const nextPublished = movingToFuture ? (wasLockedOrPublished && cleanOverride.length < 10 ? dec.isPublished : false) : true;
      afterSnapshot = {
        ...dec,
        declarationDate,
        // Preserve original declarer identity and initial timestamp; track updates separately
        declaredByRole: dec.declaredByRole,
        declaredByName: dec.declaredByName,
        declaredAt: dec.declaredAt || todayIST,
        updatedAt: todayIST,
        updatedByName: declaredByName || actor.name,
        updatedByRole: actor.role,
        isPublished: nextPublished,
        status: nextPublished ? ('Published' as const) : ('Scheduled' as const),
        isLocked: movingToFuture && cleanOverride.length >= 10 ? false : dec.isLocked,
        ...(cleanOverride ? { lockOverrideReason: cleanOverride, lockOverriddenById: actor.id } : {}),
        remarks: remarks || dec.remarks,
      };
      return afterSnapshot;
    });
    this.saveResultDeclarations(updated, actor.role);
    if (beforeSnapshot && afterSnapshot) {
      this.appendAuditLog({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        module: 'grades',
        action: 'RESULT_DECLARATION_DATE_UPDATED',
        entityType: 'SemesterResultDeclaration',
        entityId: id,
        reason: cleanOverride || remarks,
        summary: `Updated result declaration date for ${beforeSnapshot.course} Sem ${beforeSnapshot.semester} from ${beforeSnapshot.declarationDate} to ${declarationDate}`,
        oldValue: { declarationDate: beforeSnapshot.declarationDate, isLocked: beforeSnapshot.isLocked, isPublished: beforeSnapshot.isPublished },
        newValue: { declarationDate: afterSnapshot.declarationDate, isLocked: afterSnapshot.isLocked, isPublished: afterSnapshot.isPublished },
      });
    }
    return updated;
  },

  toggleResultPublication(
    id: string,
    isPublished: boolean,
    publishedBy?: string,
    invokerRole?: string,
    lockOverrideReason?: string
  ): SemesterResultDeclaration[] {
    assertAuthorizedRole(invokerRole, ['principal', 'superadmin'], 'Toggle Result Publication');
    const actor = this.getCurrentUser()!;
    const declarations = this.getResultDeclarations();
    const today = getCurrentIstIsoDate();
    const cleanOverride = (lockOverrideReason || '').trim();
    let beforeSnapshot: SemesterResultDeclaration | undefined;
    let afterSnapshot: SemesterResultDeclaration | undefined;

    const updated = declarations.map((dec) => {
      if (dec.id !== id) return dec;
      beforeSnapshot = dec;
      const wasLocked = Boolean(dec.isLocked || dec.isPublished || dec.status === 'Published');
      if (!isPublished && wasLocked && cleanOverride.length < 10) {
        throw new Error(
          'Unpublishing a locked/published result declaration requires a written Principal/Super Admin approval reason (at least 10 characters).'
        );
      }
      afterSnapshot = {
        ...dec,
        isPublished,
        status: isPublished ? ('Published' as const) : ('Scheduled' as const),
        isLocked: isPublished ? true : false,
        publishedAt: isPublished ? today : dec.publishedAt,
        publishedBy: isPublished ? publishedBy || actor.name : dec.publishedBy,
        unpublishedAt: !isPublished ? today : dec.unpublishedAt,
        unpublishedBy: !isPublished ? publishedBy || actor.name : dec.unpublishedBy,
        updatedAt: today,
        updatedByName: actor.name,
        updatedByRole: actor.role,
        ...(cleanOverride ? { lockOverrideReason: cleanOverride, lockOverriddenById: actor.id } : {}),
      };
      return afterSnapshot;
    });
    this.saveResultDeclarations(updated, actor.role);
    if (beforeSnapshot && afterSnapshot) {
      this.appendAuditLog({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        module: 'grades',
        action: 'RESULT_PUBLICATION_TOGGLED',
        entityType: 'SemesterResultDeclaration',
        entityId: id,
        reason: cleanOverride || undefined,
        summary: `${isPublished ? 'Published' : 'Unpublished'} result declaration for ${beforeSnapshot.course} Sem ${beforeSnapshot.semester}`,
        oldValue: { isPublished: beforeSnapshot.isPublished, isLocked: beforeSnapshot.isLocked },
        newValue: { isPublished: afterSnapshot.isPublished, isLocked: afterSnapshot.isLocked },
      });
    }
    return updated;
  },

  addResultDeclaration(
    dec: Omit<SemesterResultDeclaration, 'id' | 'declaredAt'>,
    invokerRole?: string
  ): SemesterResultDeclaration[] {
    assertAuthorizedRole(invokerRole, ['principal', 'superadmin'], 'Add Result Declaration');
    const actor = this.getCurrentUser()!;
    const declarations = this.getResultDeclarations();
    const normCourse = (dec.course || '').trim().toLowerCase();
    const normFY = (dec.financialYear || '').trim().toLowerCase();
    const duplicate = declarations.find(
      (existing) =>
        Number(existing.semester) === Number(dec.semester) &&
        (existing.course || '').trim().toLowerCase() === normCourse &&
        (!normFY || (existing.financialYear || '').trim().toLowerCase() === normFY)
    );
    if (duplicate) {
      throw new Error(
        `Duplicate declaration rejected: A result declaration already exists for "${dec.course}" Semester ${dec.semester}${dec.financialYear ? ` (${dec.financialYear})` : ''}.`
      );
    }

    const todayIST = getCurrentIstIsoDate();
    const created: SemesterResultDeclaration = {
      ...dec,
      id: generateSecureId('RES-DEC'),
      declaredByRole: actor.role as 'principal' | 'superadmin',
      declaredByName: dec.declaredByName || actor.name,
      declaredAt: todayIST,
      isPublished: dec.isPublished ?? false,
      status: dec.status ?? (dec.isPublished ? 'Published' : 'Scheduled'),
    };
    const updated = [...declarations, created];
    this.saveResultDeclarations(updated, actor.role);
    this.appendAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      module: 'grades',
      action: 'RESULT_DECLARATION_ADDED',
      entityType: 'SemesterResultDeclaration',
      entityId: created.id,
      summary: `Scheduled result declaration for ${created.course} Sem ${created.semester} (${created.financialYear}) on ${created.declarationDate}`,
      newValue: {
        semester: created.semester,
        course: created.course,
        financialYear: created.financialYear,
        declarationDate: created.declarationDate,
        status: created.status,
      },
    });
    return updated;
  },

  deleteResultDeclaration(id: string, invokerRole?: string, reason?: string): SemesterResultDeclaration[] {
    assertAuthorizedRole(invokerRole, ['principal', 'superadmin'], 'Delete Result Declaration');
    const actor = this.getCurrentUser()!;
    const declarations = this.getResultDeclarations();
    const target = declarations.find((d) => d.id === id);
    if (!target) {
      throw new Error('Result declaration not found.');
    }
    const cleanReason = (reason || '').trim();
    if ((target.isPublished || target.isLocked) && cleanReason.length < 10) {
      throw new Error(
        'Deleting a published/locked result declaration requires a written Principal/Super Admin approval reason (at least 10 characters).'
      );
    }
    const updated = declarations.filter((d) => d.id !== id);
    this.saveResultDeclarations(updated, actor.role);
    this.appendAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      module: 'grades',
      action: 'RESULT_DECLARATION_DELETED',
      entityType: 'SemesterResultDeclaration',
      entityId: id,
      reason: cleanReason || undefined,
      summary: `Removed result declaration for ${target.course} Sem ${target.semester} (${target.financialYear})`,
      oldValue: {
        semester: target.semester,
        course: target.course,
        declarationDate: target.declarationDate,
        status: target.status,
      },
    });
    return updated;
  },

  submitGradeUnlockRequest(params: {
    course: string;
    semester: number;
    subjectCode?: string;
    reason: string;
    declarationId?: string;
  }): { updatedDeclarations: SemesterResultDeclaration[]; request: GradeUnlockRequest; targetDeclarationId: string } {
    const actor = this.getCurrentUser();
    if (!actor || !actor.id) {
      throw new Error('Authentication required: Sign in before requesting a post-declaration grade unlock.');
    }
    const declarations = this.getResultDeclarations();
    const normCourse = (params.course || '').trim().toLowerCase();
    const todayIST = getCurrentIstIsoDate();

    const targetDec = (() => {
      if (params.declarationId) {
        return declarations.find((d) => d.id === params.declarationId);
      }
      const candidates = declarations.filter((d) => {
        if (Number(d.semester) !== Number(params.semester)) return false;
        const dc = (d.course || '').trim().toLowerCase();
        return dc === normCourse || dc === 'all courses';
      });
      if (candidates.length === 0) return undefined;
      return [...candidates].sort((a, b) => {
        const aExact = (a.course || '').trim().toLowerCase() === normCourse ? 1 : 0;
        const bExact = (b.course || '').trim().toLowerCase() === normCourse ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        const aLocked =
          a.isLocked === true ||
          a.isPublished === true ||
          a.status === 'Published' ||
          Boolean(a.declarationDate && a.declarationDate <= todayIST)
            ? 1
            : 0;
        const bLocked =
          b.isLocked === true ||
          b.isPublished === true ||
          b.status === 'Published' ||
          Boolean(b.declarationDate && b.declarationDate <= todayIST)
            ? 1
            : 0;
        if (aLocked !== bLocked) return bLocked - aLocked;
        return String(b.declarationDate || '').localeCompare(String(a.declarationDate || ''));
      })[0];
    })();

    if (!targetDec) {
      throw new Error(
        `No result declaration found for "${params.course}" Semester ${params.semester} to attach an unlock request.`
      );
    }

    const normSubject = (params.subjectCode || '').trim().toUpperCase();
    const existingPending = (targetDec.unlockRequests || []).find(
      (r) =>
        r.status === 'Pending' &&
        r.requestedById === actor.id &&
        ((!normSubject && !r.subjectCode) ||
          (r.subjectCode || '').trim().toUpperCase() === normSubject)
    );
    if (existingPending) {
      throw new Error(
        `Duplicate unlock request blocked: A pending unlock request (${existingPending.id}) from your account already exists for this declaration.`
      );
    }

    const req = buildGradeUnlockRequest({
      declarationId: targetDec.id,
      course: params.course,
      semester: params.semester,
      subjectCode: params.subjectCode,
      requestedById: actor.id,
      requestedByName: actor.name,
      requestedByRole: actor.role,
      reason: params.reason,
    });

    const updatedDeclarations = declarations.map((dec) =>
      dec.id === targetDec.id
        ? {
            ...dec,
            isLocked: true,
            unlockRequests: [req, ...(dec.unlockRequests || [])],
          }
        : dec
    );
    setStoredItem(STORAGE_KEYS.RESULT_DECLARATIONS, updatedDeclarations);
    this.appendAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      module: 'grades',
      action: 'GRADE_UNLOCK_REQUEST',
      entityType: 'SemesterResultDeclaration',
      entityId: targetDec.id,
      reason: req.reason,
      summary: `Requested post-declaration unlock for ${params.subjectCode || 'All Subjects'} (${params.course} Sem ${params.semester})`,
      newValue: req,
    });
    return { updatedDeclarations, request: req, targetDeclarationId: targetDec.id };
  },

  approveGradeUnlock24h(
    declarationId: string,
    invokerRole?: string
  ): { updatedDeclarations: SemesterResultDeclaration[]; unlockedUntil: string; approvedCount: number } {
    assertAuthorizedRole(invokerRole, ['principal', 'superadmin'], 'Approve Grade Unlock Request');
    const actor = this.getCurrentUser()!;
    const declarations = this.getResultDeclarations();
    const target = declarations.find((d) => d.id === declarationId);
    if (!target) {
      throw new Error('Result declaration not found.');
    }
    const pendingReqs = (target.unlockRequests || []).filter((r) => r.status === 'Pending');
    if (pendingReqs.length === 0) {
      throw new Error('No pending unlock requests exist for this declaration.');
    }
    if (pendingReqs.some((r) => r.requestedById === actor.id)) {
      throw new Error(
        'Dual-custody security violation: You cannot approve your own grade unlock request.'
      );
    }

    const nowIso = new Date().toISOString();
    const unlockedUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const updatedDeclarations = declarations.map((d) => {
      if (d.id !== declarationId) return d;
      return {
        ...d,
        isLocked: false,
        unlockedUntil,
        unlockApprovedBy: actor.name,
        unlockRequests: (d.unlockRequests || []).map((r) =>
          r.status === 'Pending'
            ? {
                ...r,
                status: 'Approved' as const,
                reviewedBy: actor.name,
                reviewedById: actor.id,
                reviewedByRole: actor.role,
                reviewedAt: nowIso,
                expiresAt: unlockedUntil,
              }
            : r
        ),
      };
    });

    this.saveResultDeclarations(updatedDeclarations, actor.role);
    this.appendAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      module: 'grades',
      action: 'GRADE_UNLOCK_APPROVAL',
      entityType: 'SemesterResultDeclaration',
      entityId: declarationId,
      summary: `Approved ${pendingReqs.length} pending 24h post-declaration grade unlock request(s) for ${target.course} Sem ${target.semester}`,
      oldValue: { isLocked: true, pendingCount: pendingReqs.length },
      newValue: { isLocked: false, unlockedUntil, approvedCount: pendingReqs.length },
    });
    return { updatedDeclarations, unlockedUntil, approvedCount: pendingReqs.length };
  },

  relockResultDeclaration(declarationId: string, invokerRole?: string): SemesterResultDeclaration[] {
    assertAuthorizedRole(invokerRole, ['principal', 'superadmin'], 'Re-Lock Result Declaration');
    const actor = this.getCurrentUser()!;
    const declarations = this.getResultDeclarations();
    const target = declarations.find((d) => d.id === declarationId);
    if (!target) {
      throw new Error('Result declaration not found.');
    }
    const nowIso = new Date().toISOString();
    const updatedDeclarations = declarations.map((d) => {
      if (d.id !== declarationId) return d;
      return {
        ...d,
        isLocked: true,
        unlockedUntil: undefined,
        unlockRequests: (d.unlockRequests || []).map((r) =>
          r.status === 'Approved' && !r.consumedAt && !r.revokedAt
            ? {
                ...r,
                status: 'Revoked' as const,
                isConsumed: true,
                consumedAt: nowIso,
                revokedAt: nowIso,
                revokedById: actor.id,
                revokedByName: actor.name,
              }
            : r
        ),
      };
    });

    this.saveResultDeclarations(updatedDeclarations, actor.role);
    this.appendAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      module: 'grades',
      action: 'GRADE_RELOCK',
      entityType: 'SemesterResultDeclaration',
      entityId: declarationId,
      summary: `Immediately re-locked grades and revoked active unlock windows for ${target.course} Sem ${target.semester}`,
      oldValue: { isLocked: target.isLocked, unlockedUntil: target.unlockedUntil },
      newValue: { isLocked: true, unlockedUntil: undefined },
    });
    return updatedDeclarations;
  },

  consumeGradeUnlockWindow(course: string, semester: number, declarationId?: string): SemesterResultDeclaration[] {
    const actor = this.getCurrentUser();
    if (!actor) {
      throw new Error('Authentication required to consume grade unlock window.');
    }
    const declarations = this.getResultDeclarations();
    const normCourse = (course || '').trim().toLowerCase();
    const nowIso = new Date().toISOString();
    let changed = false;

    const updatedDeclarations = declarations.map((dec) => {
      const matchesTarget = declarationId
        ? dec.id === declarationId
        : Number(dec.semester) === Number(semester) &&
          (dec.course === 'All Courses' || (dec.course || '').trim().toLowerCase() === normCourse);
      if (!matchesTarget || !hasActiveDeclarationUnlockWindow(dec, nowIso)) {
        return dec;
      }
      changed = true;
      return {
        ...dec,
        isLocked: true,
        unlockedUntil: undefined,
        unlockRequests: (dec.unlockRequests || []).map((r) =>
          r.status === 'Approved' && !r.consumedAt
            ? { ...r, isConsumed: true, consumedAt: nowIso }
            : r
        ),
      };
    });

    if (changed) {
      setStoredItem(STORAGE_KEYS.RESULT_DECLARATIONS, updatedDeclarations);
    }
    return updatedDeclarations;
  },

  // --------------------------------------------------------------------------
  // EXAM TYPES (Admin Right: Create, Edit, Disable/Enable, Toggle Student Marksheet)
  // --------------------------------------------------------------------------
  getExamTypes(): ExamTypeConfig[] {
    return getCachedStoredItem<ExamTypeConfig[]>(
      STORAGE_KEYS.EXAM_TYPES,
      INITIAL_EXAM_TYPES
    );
  },

  saveExamTypes(types: ExamTypeConfig[]): void {
    setStoredItem(STORAGE_KEYS.EXAM_TYPES, types);
  },

  addExamType(typeData: Omit<ExamTypeConfig, 'id'>): ExamTypeConfig[] {
    const list = this.getExamTypes();
    const newExam: ExamTypeConfig = {
      ...typeData,
      id: generateSecureId('EXAM'),
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updated = [...list, newExam];
    this.saveExamTypes(updated);
    return updated;
  },

  updateExamType(updatedType: ExamTypeConfig): ExamTypeConfig[] {
    const list = this.getExamTypes();
    const updated = list.map((t) =>
      t.id === updatedType.id
        ? { ...updatedType, updatedAt: new Date().toISOString().split('T')[0] }
        : t
    );
    this.saveExamTypes(updated);
    return updated;
  },

  toggleExamTypeStatus(id: string, enabled: boolean): ExamTypeConfig[] {
    const list = this.getExamTypes();
    const updated = list.map((t) => (t.id === id ? { ...t, enabled } : t));
    this.saveExamTypes(updated);
    return updated;
  },

  toggleExamTypeMarksheetVisibility(id: string, showInStudentMarksheet: boolean): ExamTypeConfig[] {
    const list = this.getExamTypes();
    const updated = list.map((t) =>
      t.id === id ? { ...t, showInStudentMarksheet } : t
    );
    this.saveExamTypes(updated);
    return updated;
  },

  // --------------------------------------------------------------------------
  // MARKS HEADS PER EXAM (Principal Decides: Heads, Max Marks, Passing Marks, Format)
  // --------------------------------------------------------------------------
  getExamEvaluationHeads(examTypeId?: string): ExamEvaluationHead[] {
    const all = getCachedStoredItem<ExamEvaluationHead[]>(
      STORAGE_KEYS.EXAM_EVALUATION_HEADS,
      INITIAL_EXAM_EVALUATION_HEADS
    );
    const sorted = [...all].sort((a, b) => a.sequence - b.sequence || String(a.id).localeCompare(String(b.id)));
    if (examTypeId) {
      return sorted.filter((h) => h.examTypeId === examTypeId);
    }
    return sorted;
  },

  saveExamEvaluationHeads(heads: ExamEvaluationHead[]): void {
    setStoredItem(STORAGE_KEYS.EXAM_EVALUATION_HEADS, heads);
  },

  addExamEvaluationHead(headData: Omit<ExamEvaluationHead, 'id'>): ExamEvaluationHead[] {
    const all = this.getExamEvaluationHeads();
    const existingForExam = all.filter((h) => h.examTypeId === headData.examTypeId);
    const newHead: ExamEvaluationHead = {
      ...headData,
      id: generateSecureId('HEAD'),
      sequence: headData.sequence || existingForExam.length + 1,
    };
    const updated = [...all, newHead];
    this.saveExamEvaluationHeads(updated);
    return updated;
  },

  updateExamEvaluationHead(updatedHead: ExamEvaluationHead): ExamEvaluationHead[] {
    const all = this.getExamEvaluationHeads();
    const updated = all.map((h) => (h.id === updatedHead.id ? updatedHead : h));
    this.saveExamEvaluationHeads(updated);
    return updated;
  },

  deleteExamEvaluationHead(headId: string): ExamEvaluationHead[] {
    const all = this.getExamEvaluationHeads();
    const updated = all.filter((h) => h.id !== headId);
    this.saveExamEvaluationHeads(updated);
    return updated;
  },

  // --------------------------------------------------------------------------
  // STUDENT EXAM EVALUATIONS & AUDIT LOGS
  // --------------------------------------------------------------------------
  getStudentExamEvaluations(filter?: {
    studentId?: string;
    examTypeId?: string;
    subjectCode?: string;
    facultyId?: string;
  }): StudentExamEvaluation[] {
    const all = getStoredItem<StudentExamEvaluation[]>(
      STORAGE_KEYS.STUDENT_EXAM_EVALUATIONS,
      INITIAL_STUDENT_EXAM_EVALUATIONS
    );

    const normalized = all.map((item) => {
      const scores = item.headScores || item.headValues || {};
      return {
        ...item,
        headScores: scores,
        headValues: scores,
        totalMarks: item.totalMarks ?? item.totalMarksObtained ?? 0,
        totalMarksObtained: item.totalMarksObtained ?? item.totalMarks ?? 0,
        maxMarks: item.maxMarks ?? item.maxPossibleMarks ?? 100,
        maxPossibleMarks: item.maxPossibleMarks ?? item.maxMarks ?? 100,
        letterGrade: item.letterGrade || item.overallGrade || 'A',
        overallGrade: item.overallGrade || item.letterGrade || 'A',
        attendancePercentage: item.attendancePercentage ?? item.attendancePercent ?? 90,
        attendancePercent: item.attendancePercent ?? item.attendancePercentage ?? 90,
        coScholasticRating: item.coScholasticRating || (item.coScholasticItems ? Object.values(item.coScholasticItems).join(', ') : 'Proficient'),
        teacherRemarks: item.teacherRemarks || item.remarks || '',
        remarks: item.remarks || item.teacherRemarks || '',
        auditLog: item.auditLog || item.lastAudit || {
          lastModifiedByFacultyName: item.facultyName || 'Faculty',
          lastModifiedByFacultyId: item.facultyId || 'FAC-001',
          lastModifiedAt: item.submittedAt || new Date().toISOString(),
        },
        lastAudit: item.lastAudit || item.auditLog || {
          lastModifiedByFacultyName: item.facultyName || 'Faculty',
          lastModifiedByFacultyId: item.facultyId || 'FAC-001',
          lastModifiedAt: item.submittedAt || new Date().toISOString(),
        },
      };
    });

    if (!filter) return normalized;
    return normalized.filter((item) => {
      if (filter.studentId && item.studentId !== filter.studentId) return false;
      if (filter.examTypeId && item.examTypeId !== filter.examTypeId) return false;
      if (filter.subjectCode && item.subjectCode !== filter.subjectCode) return false;
      if (filter.facultyId && item.facultyId !== filter.facultyId) return false;
      return true;
    });
  },

  saveStudentExamEvaluations(evals: StudentExamEvaluation[]): void {
    setStoredItem(STORAGE_KEYS.STUDENT_EXAM_EVALUATIONS, evals);
  },

  saveOrUpdateStudentExamEvaluation(evalItem: StudentExamEvaluation): StudentExamEvaluation[] {
    const actor = this.getCurrentUser();
    if (actor && !['faculty', 'principal', 'superadmin', 'dean_academics'].includes(actor.role)) {
      throw new Error(`Security violation: Role "${actor.role}" is not permitted to modify exam evaluations.`);
    }
    const declarations = this.getResultDeclarations();
    const lockCheck = checkPostDeclarationGradeLock(
      evalItem.semester,
      evalItem.course || 'All Courses',
      declarations
    );
    if ((lockCheck.locked || lockCheck.isLocked) && !lockCheck.hasApprovedUnlockWindow) {
      throw new Error(
        lockCheck.reason ||
          `Grade Modification Locked: Sem ${evalItem.semester} results are declared and locked.`
      );
    }

    const all = this.getStudentExamEvaluations();
    const existingIdx = all.findIndex(
      (e) =>
        e.id === evalItem.id ||
        (e.studentId === evalItem.studentId &&
          e.examTypeId === evalItem.examTypeId &&
          e.subjectCode === evalItem.subjectCode)
    );
    let updated: StudentExamEvaluation[];
    if (existingIdx >= 0) {
      const prev = all[existingIdx];
      const prevTotal = Number(prev.totalMarks ?? prev.totalMarksObtained ?? 0);
      const nextTotal = Number(evalItem.totalMarks ?? evalItem.totalMarksObtained ?? 0);
      const prevRevs = prev.revisionHistory || evalItem.revisionHistory || [];
      const nextRevs =
        prevTotal !== nextTotal
          ? [
              ...prevRevs,
              {
                previousMarks: prevTotal,
                newMarks: nextTotal,
                modifiedBy: evalItem.lastAudit?.lastModifiedByFacultyName || evalItem.facultyName || 'Faculty',
                modifiedAt: new Date().toISOString(),
                reason: evalItem.revisionNotes || 'Evaluation score update',
              },
            ]
          : prevRevs;
      updated = [...all];
      updated[existingIdx] = {
        ...prev,
        ...evalItem,
        revisionHistory: nextRevs,
      };
    } else {
      updated = [...all, evalItem];
    }
    this.saveStudentExamEvaluations(updated);
    return updated;
  },

  bulkSubmitExamEvaluations(
    ids: string[],
    facultyName: string,
    facultyId: string
  ): StudentExamEvaluation[] {
    const actor = this.getCurrentUser();
    if (actor && !['faculty', 'superadmin', 'principal'].includes(actor.role)) {
      throw new Error(`Security violation: Role "${actor.role}" is not permitted to submit evaluations for review.`);
    }
    const all = this.getStudentExamEvaluations();
    const nowStr = new Date().toLocaleString();
    const updated = all.map((e) => {
      if (ids.includes(e.id)) {
        return {
          ...e,
          status: 'Submitted_For_Review' as const,
          submittedAt: nowStr,
          lastAudit: {
            lastModifiedByFacultyName: facultyName,
            lastModifiedByFacultyId: facultyId,
            lastModifiedAt: nowStr,
          },
        };
      }
      return e;
    });
    this.saveStudentExamEvaluations(updated);
    return updated;
  },

  bulkApproveExamEvaluations(
    ids: string[],
    principalName: string
  ): StudentExamEvaluation[] {
    const actor = this.getCurrentUser();
    if (actor && !['principal', 'superadmin', 'dean_academics'].includes(actor.role)) {
      throw new Error(`Security violation: Role "${actor.role}" is not authorized to approve & publish exam evaluations.`);
    }
    const all = this.getStudentExamEvaluations();
    const nowStr = new Date().toLocaleString();
    const updated = all.map((e) => {
      if (ids.includes(e.id)) {
        if (
          actor &&
          ((actor.facultyId && e.facultyId === actor.facultyId) ||
            (actor.id && e.lastAudit?.lastModifiedByFacultyId === actor.id))
        ) {
          throw new Error(
            `Segregation of Duties Violation: Examiner (${actor.name}) cannot self-approve evaluations they submitted (${e.subjectCode}).`
          );
        }
        return {
          ...e,
          status: 'Approved_Published' as const,
          approvedAt: nowStr,
          approvedByPrincipalName: principalName,
        };
      }
      return e;
    });
    this.saveStudentExamEvaluations(updated);
    return updated;
  },

  bulkRequestRevisionExamEvaluations(
    ids: string[],
    notes: string
  ): StudentExamEvaluation[] {
    const actor = this.getCurrentUser();
    if (actor && !['principal', 'superadmin', 'dean_academics'].includes(actor.role)) {
      throw new Error(`Security violation: Role "${actor.role}" is not authorized to request evaluation revisions.`);
    }
    const all = this.getStudentExamEvaluations();
    const updated = all.map((e) => {
      if (ids.includes(e.id)) {
        return {
          ...e,
          status: 'Revision_Requested' as const,
          revisionNotes: notes,
        };
      }
      return e;
    });
    this.saveStudentExamEvaluations(updated);
    return updated;
  },

  // Subscribe to storage updates (in-tab & cross-tab)
  subscribe(listener: () => void): () => void {
    storageListeners.add(listener);
    return () => {
      storageListeners.delete(listener);
    };
  },

  // Reset to default seed
  async resetDefaults(): Promise<void> {
    memoryCacheStore.clear();
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.clear();
      }
    } catch {}
    try {
      if (typeof localStorage !== 'undefined') {
        Object.values(STORAGE_KEYS).forEach((k) => {
          // Preserve sequence high-water marks to prevent sequence regression or stale multi-tab hydration (Bug 21)
          if (k.startsWith('rlsy_erp_storage_seq_')) return;
          try {
            localStorage.removeItem(k);
          } catch {}
        });
      }
    } catch {}
    notifyStorageListeners();
    await new Promise((r) => setTimeout(r, 50));
  },

  getStorageSequence(key: string): number {
    return getStorageSequence(key);
  },
};
