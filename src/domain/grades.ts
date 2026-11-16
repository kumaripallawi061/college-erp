import type { GradeUnlockRequest, SemesterResultDeclaration } from '../types/erp';
import { getCryptographicRandomHex } from './auth.ts';

export interface GradeLockCheckResult {
  locked: boolean;
  isLocked: boolean;
  reason?: string;
  activeDeclaration?: SemesterResultDeclaration;
  hasApprovedUnlockWindow: boolean;
}

/**
 * Returns the current calendar date (YYYY-MM-DD) in Asia/Kolkata (IST) timezone.
 */
export function getCurrentIstIsoDate(dateInput: Date = new Date()): string {
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dateInput);
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch {
    // Fallback below
  }
  const istMs = dateInput.getTime() + 330 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

function isTimestampOrDateActive(rawValue: string | undefined, currentIsoDate: string): boolean {
  const clean = (rawValue || '').trim();
  if (!clean) return false;
  // Whenever a full datetime/timestamp string is supplied (e.g. "2026-11-14T10:00:00Z"), compare millisecond epochs strictly
  if (clean.length > 10 || clean.includes('T') || clean.includes(':')) {
    const expMs = Date.parse(clean);
    return Number.isFinite(expMs) && Date.now() <= expMs;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean >= currentIsoDate;
  }
  return false;
}

export function isUnlockRequestActive(
  req: GradeUnlockRequest,
  currentIsoDate: string = getCurrentIstIsoDate()
): boolean {
  if (!req || req.status !== 'Approved') return false;

  // Dual Custody Guard: approver ID and approver role are BOTH mandatory and cannot match requester
  const reviewerId = (req.reviewedById || '').trim();
  const requesterId = (req.requestedById || '').trim();
  if (!reviewerId || (requesterId && reviewerId === requesterId)) {
    return false;
  }

  const approverRole = (req.reviewedByRole || '').trim().toLowerCase();
  if (!approverRole || !['principal', 'superadmin'].includes(approverRole)) {
    return false;
  }

  // Single-use consumption or explicit administrative re-lock revocation check
  if (req.isConsumed || req.consumedAt || req.revokedAt) {
    return false;
  }

  // Expiry check: an approved unlock request must be time-bounded
  const explicitExpiry = (req.expiresAt || (req as GradeUnlockRequest & { unlockedUntil?: string }).unlockedUntil || '').trim();
  if (explicitExpiry) {
    return isTimestampOrDateActive(explicitExpiry, currentIsoDate);
  }

  // Fallback bounded window: 24 hours / same IST day from reviewedAt or requestedAt
  const grantRef = (req.reviewedAt || req.requestedAt || '').trim();
  if (!grantRef) return false;
  if (grantRef.length > 10 || grantRef.includes('T') || grantRef.includes(':')) {
    const grantMs = Date.parse(grantRef);
    return Number.isFinite(grantMs) && Date.now() <= grantMs + 24 * 60 * 60 * 1000;
  }
  const grantDate = grantRef.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(grantDate)) return false;
  return grantDate >= currentIsoDate;
}

/**
 * Canonical helper shared by both UI governance views and domain guards to determine
 * whether a specific declaration currently has an active, unrevoked, unexpired unlock window.
 */
export function hasActiveDeclarationUnlockWindow(
  dec: SemesterResultDeclaration | undefined | null,
  currentIsoDate: string = getCurrentIstIsoDate()
): boolean {
  if (!dec) return false;
  const hasValidReq = Boolean(dec.unlockRequests?.some((req) => isUnlockRequestActive(req, currentIsoDate)));
  const isWindowActive = isTimestampOrDateActive(dec.unlockedUntil, currentIsoDate);
  return hasValidReq || isWindowActive;
}

/**
 * Evaluates whether grades and marksheet parameters for a given course & semester
 * are locked due to official result declaration.
 * Evaluates ALL matching declarations (exact course prioritized over "All Courses",
 * published/locked prioritized over unpublished) so older drafts never mask a published lock.
 */
export function checkPostDeclarationGradeLock(
  semesterOrCourse: number | string,
  courseOrSemester: string | number,
  declarations: SemesterResultDeclaration[],
  currentIsoDate: string = getCurrentIstIsoDate()
): GradeLockCheckResult {
  const semester =
    typeof semesterOrCourse === 'number'
      ? semesterOrCourse
      : Number(courseOrSemester);
  const rawCourse =
    typeof semesterOrCourse === 'string'
      ? semesterOrCourse
      : String(courseOrSemester);
  const cleanCourse = (rawCourse || '').trim().toLowerCase();

  // Reject blank course wildcards (cannot match arbitrary declarations when course is empty)
  if (!cleanCourse || !Number.isFinite(semester)) {
    return { locked: false, isLocked: false, hasApprovedUnlockWindow: false };
  }

  const allMatches = (declarations || []).filter((d) => {
    if (Number(d.semester) !== Number(semester)) return false;
    const decCourse = (d.course || '').trim().toLowerCase();
    return decCourse === cleanCourse || decCourse === 'all courses';
  });

  if (allMatches.length === 0) {
    return { locked: false, isLocked: false, hasApprovedUnlockWindow: false };
  }

  // Evaluate whether a declaration is officially published/locked
  const isDeclLockedOrPublished = (d: SemesterResultDeclaration): boolean => {
    const isDeclaredByDate = Boolean(d.declarationDate && d.declarationDate <= currentIsoDate);
    return (
      d.status === 'Published' ||
      d.isPublished === true ||
      d.isLocked === true ||
      isDeclaredByDate
    );
  };

  // Prioritize locked/published declarations first, then exact course matches over "All Courses"
  const sortedMatches = [...allMatches].sort((a, b) => {
    const aLocked = isDeclLockedOrPublished(a) ? 1 : 0;
    const bLocked = isDeclLockedOrPublished(b) ? 1 : 0;
    if (aLocked !== bLocked) return bLocked - aLocked;
    const aExact = (a.course || '').trim().toLowerCase() === cleanCourse ? 1 : 0;
    const bExact = (b.course || '').trim().toLowerCase() === cleanCourse ? 1 : 0;
    return bExact - aExact;
  });

  const matching = sortedMatches[0];
  if (!isDeclLockedOrPublished(matching)) {
    return {
      locked: false,
      isLocked: false,
      activeDeclaration: matching,
      hasApprovedUnlockWindow: false,
    };
  }

  // Every matching locked declaration must have a valid active unlock window to allow editing
  const lockedDeclarations = sortedMatches.filter(isDeclLockedOrPublished);
  const allLockedHaveValidUnlock = lockedDeclarations.every((dec) =>
    hasActiveDeclarationUnlockWindow(dec, currentIsoDate)
  );

  if (allLockedHaveValidUnlock) {
    return {
      locked: false,
      isLocked: false,
      activeDeclaration: matching,
      hasApprovedUnlockWindow: true,
    };
  }

  return {
    locked: true,
    isLocked: true,
    activeDeclaration: matching,
    hasApprovedUnlockWindow: false,
    reason: `Semester ${semester} (${matching.course}) results were declared on ${matching.declarationDate} by ${matching.declaredByName}. An approved unlock request from the Principal or Superadmin is required before editing grades or marksheets.`,
  };
}

/**
 * Creates a structured unlock request for post-declaration grade/marksheet modification.
 * Strictly requires a reason of at least 10 characters and a valid requester ID.
 */
export function buildGradeUnlockRequest(params: {
  declarationId?: string;
  semester: number;
  course: string;
  subjectCode?: string;
  requestedById?: string;
  requestedByName?: string;
  requestedBy?: string;
  requestedByRole?: string;
  reason: string;
}): GradeUnlockRequest {
  const cleanReason = (params.reason || '').trim();
  if (cleanReason.length < 10) {
    throw new Error('Unlock justification must be at least 10 characters long.');
  }
  const requesterId = (params.requestedById || '').trim();
  if (!requesterId) {
    throw new Error('Authenticated requester ID (requestedById) is required to submit a grade unlock request.');
  }
  const actorName = (params.requestedByName || params.requestedBy || '').trim();
  if (!actorName) {
    throw new Error('Requester name is required to submit a grade unlock request.');
  }
  const courseName = (params.course || '').trim();
  if (!courseName) {
    throw new Error('Course is required to submit a grade unlock request.');
  }
  return {
    id: `UNLK-${Date.now()}-${getCryptographicRandomHex(4).toUpperCase()}`,
    declarationId: params.declarationId || `DEC-SEM-${params.semester}`,
    semester: params.semester,
    course: courseName,
    subjectCode: params.subjectCode,
    requestedById: requesterId,
    requestedByName: actorName,
    requestedBy: actorName,
    requestedByRole: (params.requestedByRole || 'faculty').trim().toLowerCase(),
    reason: cleanReason,
    requestedAt: new Date().toISOString(),
    status: 'Pending',
  };
}
