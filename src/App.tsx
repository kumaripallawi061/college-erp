/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import {
  UserRole,
  Student,
  Faculty,
  FeeTransaction,
  ExamGradeRecord,
  AttendanceRecord,
  InstitutionalNotice,
  HelpdeskTicket,
  FeeHead,
  TimetableSlot,
  CollegeProfile,
  UserAccount,
  AuditLogEntry,
  ModulePermissionMap,
  EnrollmentField,
  ConcessionRule,
  FeeCampaign,
  FacultyMapping,
  ModuleKey,
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
  CustomRoleDefinition,
} from './types/erp';
import { erpStorage } from './services/erpStorage';
import {
  hashPassword,
  verifyPassword,
  generateSecureSalt,
  generateTempPassword,
  generateHighEntropyTempPassword,
  generateSecureId,
  clearGlobalIndexedDBAndSessionStorage,
  verifyPasswordResetToken,
  revokePasswordResetToken,
  isPasswordResetTokenRevoked,
  normalizeModuleKey,
  assertSafeCertificateImages,
  isSelfApprovalConflict,
  normalizeIndianMobileNumber,
  deepSanitizeEnrollmentData,
  toPaisa,
  fromPaisa,
  paisaAdd,
  paisaSumSafe,
  getISTDateString,
  validatePasswordComplexity,
} from './utils/erpLogic';
import { assertValidFeeCampaign } from './domain/fees';
import {
  createSessionToken,
  validateServerSessionToken,
  refreshSessionTokenOnActivity,
  revokeServerSession,
  revokeUserSessions,
} from './services/authServerMock';
import {
  VALID_MODULE_KEYS,
  MODULE_CATALOG,
  canUserAccessModule,
  getDefaultLandingModule,
} from './domain/rbac/permissions';
import { checkPostDeclarationGradeLock } from './domain/grades';
import { Header } from './components/Navigation/Header';
import { Sidebar } from './components/Navigation/Sidebar';
import { ProtectedRoute } from './components/Navigation/ProtectedRoute';
import { AuthPage } from './components/Auth/AuthPage';
import { OverviewDashboard } from './components/Dashboard/OverviewDashboard';
import { ModuleLoadingSkeleton } from './components/Common/ModuleLoadingSkeleton';
import { ToastAndConfirmDialog } from './components/Common/ToastAndConfirmDialog';
import { SystemHealthModal } from './components/Admin/SystemHealthModal';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { useErpStore } from './store/useErpStore';
import { apiClient } from './services/apiClient';

// Resilient lazy import wrapper to recover from transient chunk load or deployment hash mismatches (Bugs 503, 527)
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  const CHUNK_RELOAD_KEY = 'rlsy_erp_chunk_reload_v1';
  return lazy(async () => {
    try {
      const mod = await factory();
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        }
      } catch {}
      return mod;
    } catch (firstErr) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      try {
        const mod = await factory();
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(CHUNK_RELOAD_KEY);
          }
        } catch {}
        return mod;
      } catch (secondErr) {
        try {
          if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
            if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
              sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
              window.location.reload();
              return new Promise<{ default: T }>(() => {});
            }
          }
        } catch {}
        throw secondErr ?? firstErr;
      }
    }
  });
}

// Code-Split Dynamic Imports for Secondary & Heavy Role Modules
const AttendanceModule = lazyWithRetry(() =>
  import('./components/Attendance/AttendanceModule').then((m) => ({ default: m.AttendanceModule }))
);
const FeeModule = lazyWithRetry(() =>
  import('./components/Fees/FeeModule').then((m) => ({ default: m.FeeModule }))
);
const GradeManagementModule = lazyWithRetry(() =>
  import('./components/Grades/GradeManagementModule').then((m) => ({ default: m.GradeManagementModule }))
);
const GradeSettingsModule = lazyWithRetry(() =>
  import('./components/Academics/GradeSettingsModule').then((m) => ({ default: m.GradeSettingsModule }))
);
const FacultyPortalModule = lazyWithRetry(() =>
  import('./components/Faculty/FacultyPortalModule').then((m) => ({ default: m.FacultyPortalModule }))
);
const StudentPortalView = lazyWithRetry(() =>
  import('./components/Student/StudentPortalView').then((m) => ({ default: m.StudentPortalView }))
);
const CongratulationsModule = lazyWithRetry(() =>
  import('./components/Congratulations/CongratulationsModule').then((m) => ({ default: m.CongratulationsModule }))
);
const EnrollmentModule = lazyWithRetry(() =>
  import('./components/Enrollment/EnrollmentModule').then((m) => ({ default: m.EnrollmentModule }))
);
const TeacherMappingView = lazyWithRetry(() =>
  import('./components/Admin/TeacherMappingView').then((m) => ({ default: m.TeacherMappingView }))
);
const StreamCourseMappingModule = lazyWithRetry(() =>
  import('./components/Accountant/StreamCourseMappingModule').then((m) => ({ default: m.StreamCourseMappingModule }))
);
const MarksheetDesignerModule = lazyWithRetry(() =>
  import('./components/Accountant/MarksheetDesignerModule').then((m) => ({ default: m.MarksheetDesignerModule }))
);
const CertificateDesignerModule = lazyWithRetry(() =>
  import('./components/Accountant/CertificateDesignerModule').then((m) => ({ default: m.CertificateDesignerModule }))
);
const StudentPromotionModule = lazyWithRetry(() =>
  import('./components/Accountant/StudentPromotionModule').then((m) => ({ default: m.StudentPromotionModule }))
);
const ReconciliationModule = lazyWithRetry(() =>
  import('./components/Accountant/ReconciliationModule').then((m) => ({ default: m.ReconciliationModule }))
);
const AccountantRequestsModule = lazyWithRetry(() =>
  import('./components/Accountant/AccountantRequestsModule').then((m) => ({ default: m.AccountantRequestsModule }))
);
const InstitutionalReportsModule = lazyWithRetry(() =>
  import('./components/Reports/InstitutionalReportsModule').then((m) => ({ default: m.InstitutionalReportsModule }))
);
const RolePermissionMatrixModule = lazyWithRetry(() =>
  import('./components/Admin/RolePermissionMatrixModule').then((m) => ({ default: m.RolePermissionMatrixModule }))
);
const AdminSettingsModule = lazyWithRetry(() =>
  import('./components/Admin/AdminSettingsModule').then((m) => ({ default: m.AdminSettingsModule }))
);

const HelpdeskModal = lazyWithRetry(() =>
  import('./components/Helpdesk/HelpdeskModal').then((m) => ({ default: m.HelpdeskModal }))
);
const CollegeProfileModal = lazyWithRetry(() =>
  import('./components/Admin/CollegeProfileModal').then((m) => ({ default: m.CollegeProfileModal }))
);
const UserManagementModal = lazyWithRetry(() =>
  import('./components/Admin/UserManagementModal').then((m) => ({ default: m.UserManagementModal }))
);
const ModulePermissionsModal = lazyWithRetry(() =>
  import('./components/Admin/ModulePermissionsModal').then((m) => ({ default: m.ModulePermissionsModal }))
);
import { GraduationCap, ShieldCheck, Phone, Mail, Building2, AlertTriangle, RotateCcw, Lock } from 'lucide-react';

// Deterministic student identity resolver: prioritizes primary studentId -> USR- derived ID -> unique rollNo -> disambiguated email (Bug 133)
function resolveStudentForUser(
  user: UserAccount | null,
  studentList: Student[],
  fallbackActiveId?: string
): Student | undefined {
  if (!user || user.role !== 'student' || !Array.isArray(studentList)) return undefined;

  if (user.studentId) {
    const byId = studentList.find((s) => s.id === user.studentId);
    if (byId) return byId;
  }

  if (user.id && user.id.startsWith('USR-')) {
    const derivedId = user.id.slice(4);
    const byDerived = studentList.find((s) => s.id === derivedId);
    if (byDerived) return byDerived;
  }

  if (user.rollNo) {
    const targetRoll = user.rollNo.trim().toUpperCase();
    if (targetRoll) {
      const byRoll = studentList.find(
        (s) => s.rollNo && s.rollNo.trim().toUpperCase() === targetRoll
      );
      if (byRoll) return byRoll;
    }
  }

  if (user.email) {
    const targetEmail = user.email.trim().toLowerCase();
    if (targetEmail) {
      const emailMatches = studentList.filter(
        (s) => s.email && s.email.trim().toLowerCase() === targetEmail
      );
      if (emailMatches.length === 1) return emailMatches[0];
      if (emailMatches.length > 1) {
        if (fallbackActiveId) {
          const byActive = emailMatches.find((s) => s.id === fallbackActiveId);
          if (byActive) return byActive;
        }
        const targetName = (user.name || '').trim().toLowerCase();
        if (targetName) {
          const byName = emailMatches.find(
            (s) => (s.name || '').trim().toLowerCase() === targetName
          );
          if (byName) return byName;
        }
        return emailMatches[0];
      }
    }
  }

  return undefined;
}

export default function App() {
  // Authentication & Identity State - Defaults to null for Student Sign In landing page
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => erpStorage.getCurrentUser());
  const [allUsers, setAllUsers] = useState<UserAccount[]>(() => erpStorage.getUsers());
  const [collegeProfile, setCollegeProfile] = useState<CollegeProfile>(() => erpStorage.getCollegeProfile());
  const [modulePermissions, setModulePermissions] = useState<ModulePermissionMap>(() =>
    erpStorage.getModulePermissions()
  );

  // Active Personas & Tabs (Dynamically resolved from session/storage without hardcoded STU-101 / FAC-001 or unauthenticated fallback - Bugs 86, 127, 133)
  const [activeStudentId, setActiveStudentId] = useState<string>(() => {
    const u = erpStorage.getCurrentUser();
    if (!u) return '';
    const stus = erpStorage.getStudents();
    if (u.role === 'student') {
      const matched = resolveStudentForUser(u, stus);
      return matched?.id || u.studentId || '';
    }
    return (Array.isArray(stus) && stus[0]?.id) ? stus[0].id : '';
  });
  const [activeFacultyId, setActiveFacultyId] = useState<string>(() => {
    const u = erpStorage.getCurrentUser();
    if (!u) return '';
    const facs = erpStorage.getFaculty();
    if (u.role === 'faculty' && u.facultyId) return u.facultyId;
    return (Array.isArray(facs) && facs[0]?.id) ? facs[0].id : '';
  });
  const [rawActiveTab, setRawActiveTab] = useState<string>('overview');
  const activeTab = useMemo(() => normalizeModuleKey(rawActiveTab), [rawActiveTab]);
  const setActiveTab = useCallback((nextTab: string) => {
    setRawActiveTab(normalizeModuleKey(nextTab));
  }, []);
  const [currentYear, setCurrentYear] = useState<number>(2026);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Modals Visibility
  const [isCollegeProfileModalOpen, setIsCollegeProfileModalOpen] = useState<boolean>(false);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState<boolean>(false);
  const [isModulePermissionsModalOpen, setIsModulePermissionsModalOpen] = useState<boolean>(false);
  const [isHelpdeskOpen, setIsHelpdeskOpen] = useState<boolean>(false);
  const [isSystemHealthModalOpen, setIsSystemHealthModalOpen] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [isSessionVerifying, setIsSessionVerifying] = useState<boolean>(() =>
    Boolean(erpStorage.getCurrentUser())
  );
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  // Online/offline network state listener (Bug 535)
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Resilient audit logger with persistent offline outbox (Audit Bug 3.2)
  const recordResilientAuditLog = async (payload: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      erpStorage.appendAuditOutbox(payload);
      return;
    }
    try {
      await apiClient.recordServerAuditLog(payload, { skipLocalAppend: true });
    } catch (err) {
      console.warn('Server audit dispatch failed, buffering to persistent outbox:', err);
      erpStorage.appendAuditOutbox(payload);
    }
  };

  // Replay queued audit entries upon network reconnection without losing unsent items
  useEffect(() => {
    let isFlushing = false;
    const flushOutbox = async () => {
      if (isFlushing) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const pending = erpStorage.getAuditOutbox();
      if (pending.length === 0) return;

      isFlushing = true;
      const sentKeys: string[] = [];
      let sentUnkeyedCount = 0;
      try {
        for (const item of pending) {
          try {
            await apiClient.recordServerAuditLog(item, { skipLocalAppend: true });
            if (item.idempotencyKey) {
              sentKeys.push(item.idempotencyKey);
            } else {
              sentUnkeyedCount++;
            }
          } catch (err) {
            console.warn('Failed to replay outbox item, keeping remaining items queued:', err);
            break;
          }
        }
      } finally {
        if (sentKeys.length > 0) {
          erpStorage.removeAuditOutboxEntries(sentKeys);
        }
        if (sentUnkeyedCount > 0 && sentKeys.length + sentUnkeyedCount === pending.length) {
          erpStorage.clearAuditOutbox();
        }
        isFlushing = false;
      }
    };

    window.addEventListener('online', flushOutbox);
    void flushOutbox();
    return () => {
      window.removeEventListener('online', flushOutbox);
    };
  }, []);

  // Non-disruptive browser storage quota warning listener (Bugs 248, 251, 252)
  const quotaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handleQuotaWarning = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      const msg =
        customEvent.detail?.message ||
        'Browser local storage threshold reached. Transient historical records were pruned automatically to safeguard state.';
      setQuotaWarning(msg);
      if (quotaTimerRef.current) {
        clearTimeout(quotaTimerRef.current);
      }
      quotaTimerRef.current = setTimeout(() => {
        setQuotaWarning(null);
        quotaTimerRef.current = null;
      }, 7000);
    };

    window.addEventListener('rlsy_erp_storage_quota_warning', handleQuotaWarning);
    return () => {
      window.removeEventListener('rlsy_erp_storage_quota_warning', handleQuotaWarning);
      if (quotaTimerRef.current) {
        clearTimeout(quotaTimerRef.current);
        quotaTimerRef.current = null;
      }
    };
  }, []);

  // Lock background body scroll when any modal dialog is open (Bug 65)
  const originalBodyOverflowRef = useRef<string | null>(null);
  useEffect(() => {
    const anyModalOpen =
      isCollegeProfileModalOpen ||
      isUserManagementModalOpen ||
      isModulePermissionsModalOpen ||
      isHelpdeskOpen ||
      isSystemHealthModalOpen ||
      showResetConfirmModal;

    if (typeof document === 'undefined') return;

    if (anyModalOpen) {
      if (originalBodyOverflowRef.current === null) {
        originalBodyOverflowRef.current = document.body.style.overflow || '';
      }
      document.body.style.overflow = 'hidden';
    } else {
      if (originalBodyOverflowRef.current !== null) {
        document.body.style.overflow = originalBodyOverflowRef.current;
        originalBodyOverflowRef.current = null;
      }
    }

    return () => {
      if (typeof document !== 'undefined' && originalBodyOverflowRef.current !== null) {
        document.body.style.overflow = originalBodyOverflowRef.current;
        originalBodyOverflowRef.current = null;
      }
    };
  }, [
    isCollegeProfileModalOpen,
    isUserManagementModalOpen,
    isModulePermissionsModalOpen,
    isHelpdeskOpen,
    isSystemHealthModalOpen,
    showResetConfirmModal,
  ]);

  // Core ERP Data Stores from Storage
  const [students, setStudents] = useState<Student[]>(() => erpStorage.getStudents());
  const [faculty, setFaculty] = useState<Faculty[]>(() => erpStorage.getFaculty());
  const [transactions, setTransactions] = useState<FeeTransaction[]>(() => erpStorage.getTransactions());
  const [grades, setGrades] = useState<ExamGradeRecord[]>(() => erpStorage.getGrades());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() =>
    erpStorage.getAttendanceRecords()
  );
  const [notices, setNotices] = useState<InstitutionalNotice[]>(() => erpStorage.getNotices());
  const [tickets, setTickets] = useState<HelpdeskTicket[]>(() => erpStorage.getTickets());
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>(() => erpStorage.getFeeHeads());
  const [feeCampaigns, setFeeCampaigns] = useState<FeeCampaign[]>(() => erpStorage.getFeeCampaigns());
  const [concessionRules, setConcessionRules] = useState<ConcessionRule[]>(() =>
    erpStorage.getConcessionRules()
  );
  const [enrollmentFields, setEnrollmentFields] = useState<EnrollmentField[]>(() =>
    erpStorage.getEnrollmentFields()
  );
  const [facultyMappings, setFacultyMappings] = useState<FacultyMapping[]>(() =>
    erpStorage.getFacultyMappings()
  );
  const [congratulations, setCongratulations] = useState<CongratulationMessage[]>(() =>
    erpStorage.getCongratulationMessages()
  );
  const [timetable, setTimetable] = useState<TimetableSlot[]>(() =>
    erpStorage.getTimetable()
  );
  const [streamCourseSubjects, setStreamCourseSubjects] = useState<StreamCourseSubject[]>(() =>
    erpStorage.getStreamCourseSubjects()
  );
  const [marksheetConfig, setMarksheetConfig] = useState<MarksheetConfig>(() =>
    erpStorage.getMarksheetConfig()
  );
  const [promotionAuditRecords, setPromotionAuditRecords] = useState<StudentPromotionRecord[]>(() =>
    erpStorage.getPromotionAuditRecords()
  );
  const [serviceTariffs, setServiceTariffs] = useState<ServiceTariff[]>(() =>
    erpStorage.getServiceTariffs()
  );
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestItem[]>(() =>
    erpStorage.getServiceRequests()
  );
  const [reconciliationRecords, setReconciliationRecords] = useState<Reconciliation3WayRecord[]>(() =>
    erpStorage.get3WayReconciliationRecords()
  );
  const [systemSettings, setSystemSettings] = useState<SystemSettingsConfig>(() =>
    erpStorage.getSystemSettings()
  );
  const [reportDefinitions, setReportDefinitions] = useState<ReportTypeDefinition[]>(() =>
    erpStorage.getReportDefinitions()
  );
  const [reportParameters, setReportParameters] = useState<ReportParameterDef[]>(() =>
    erpStorage.getReportParameters()
  );
  const [certificateConfig, setCertificateConfig] = useState<CertificateDesignConfig>(() =>
    erpStorage.getCertificateConfig()
  );
  const [courseSections, setCourseSections] = useState<CourseSectionConfig[]>(() =>
    erpStorage.getCourseSections()
  );
  const [gradeHeads, setGradeHeads] = useState<GradeEvaluationHead[]>(() =>
    erpStorage.getGradeEvaluationHeads()
  );
  const [resultDeclarations, setResultDeclarations] = useState<SemesterResultDeclaration[]>(() =>
    erpStorage.getResultDeclarations()
  );
  const [customRoles, setCustomRoles] = useState<CustomRoleDefinition[]>(() =>
    erpStorage.getCustomRoles()
  );
  const [activeSubjectFilter, setActiveSubjectFilter] = useState<string | null>(null);

  // Available unique course names (order-insensitive memoization to prevent unnecessary child re-renders - Bug 203)
  const prevAvailableCoursesRef = useRef<string[]>([]);
  const availableCourses = useMemo(() => {
    const fromMapping = streamCourseSubjects.map((s) => (s.course || '').trim()).filter(Boolean);
    const fromStudents = students.map((s) => (s.course || '').trim()).filter(Boolean);
    const nextList = Array.from(new Set([...fromMapping, ...fromStudents])).sort((a, b) =>
      a.localeCompare(b)
    );
    const prevList = prevAvailableCoursesRef.current;
    if (
      prevList.length === nextList.length &&
      prevList.every((val, idx) => val === nextList[idx])
    ) {
      return prevList;
    }
    prevAvailableCoursesRef.current = nextList;
    return nextList;
  }, [streamCourseSubjects, students]);

  // Automatically adjust active tab if current user's role has no access or is statutorily banned (Bugs 225, 338)
  useEffect(() => {
    if (!currentUser) return;
    if (activeTab === 'restricted_access') return;

    if (!canUserAccessModule(currentUser, activeTab, modulePermissions)) {
      const candidate = getDefaultLandingModule(currentUser, modulePermissions);
      if (canUserAccessModule(currentUser, candidate, modulePermissions)) {
        setActiveTab(candidate);
      } else {
        const firstAllowed = MODULE_CATALOG.find((item) =>
          canUserAccessModule(currentUser, item.key, modulePermissions)
        );
        setActiveTab(firstAllowed ? firstAllowed.key : 'restricted_access');
      }
    }
  }, [currentUser, modulePermissions, activeTab, setActiveTab]);

  // Tab Transition Sync: Reload transactions for overview/fees and clear subject filter on leaving attendance/grades (Bugs 45, 75)
  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'fees') {
      setTransactions(erpStorage.getTransactions());
    }
    if (activeTab !== 'attendance' && activeTab !== 'grades' && activeTab !== 'faculty_portal') {
      setActiveSubjectFilter(null);
    }
  }, [activeTab]);

  // Synchronize student/faculty persona IDs and clear cross-persona residue (Bugs 204, 207)
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'student') {
      setActiveFacultyId('');
      const matched = resolveStudentForUser(currentUser, students, activeStudentId);
      if (matched && matched.id !== activeStudentId) {
        setActiveStudentId(matched.id);
      } else if (!matched && currentUser.studentId && currentUser.studentId !== activeStudentId) {
        setActiveStudentId(currentUser.studentId);
      }
    } else if (currentUser.role === 'faculty') {
      setActiveStudentId('');
      if (currentUser.facultyId && currentUser.facultyId !== activeFacultyId) {
        setActiveFacultyId(currentUser.facultyId);
      }
    }
  }, [currentUser, students, activeStudentId, activeFacultyId]);

  // Currently active student - dynamically matched with primary key priority and guarded against unauthenticated fallback (Bugs 127, 133)
  const currentStudent = useMemo(() => {
    if (!currentUser) {
      return undefined;
    }
    if (currentUser.role === 'student') {
      const matched = resolveStudentForUser(currentUser, students, activeStudentId);
      if (matched) return matched;
      // Do not fall through to students[0] if a logged-in student is unmatched
      return {
        id: currentUser.studentId || `STU-${currentUser.id}`,
        rollNo: currentUser.rollNo || 'UNASSIGNED',
        registerNo: 'PENDING',
        name: currentUser.name || 'Enrolled Student',
        email: currentUser.email || '',
        phone: currentUser.mobile || '',
        parentPhone: '',
        course: 'B.Tech Computer Science & Engineering',
        streamCode: 'CSE',
        semester: 1,
        section: 'A',
        batchYear: '2026-2030',
        totalFee: 0,
        paidFee: 0,
        pendingFee: 0,
        hallTicketBlocked: false,
        attendancePercentage: 0,
      } as Student;
    }
    if (activeStudentId) {
      const explicitMatch = students.find((s) => s.id === activeStudentId);
      if (explicitMatch) return explicitMatch;
    }
    return students[0] || ({
      id: 'STU-DEFAULT',
      rollNo: 'UNASSIGNED',
      registerNo: 'PENDING',
      name: 'Enrolled Student',
      email: '',
      phone: '',
      parentPhone: '',
      course: 'B.Tech Computer Science & Engineering',
      streamCode: 'CSE',
      semester: 1,
      section: 'A',
      batchYear: '2026-2030',
      totalFee: 0,
      paidFee: 0,
      pendingFee: 0,
      hallTicketBlocked: false,
      attendancePercentage: 0,
    } as Student);
  }, [currentUser, students, activeStudentId]);

  // Refresh all state from erpStorage with strict array/object fallbacks (Bug 138)
  const refreshState = () => {
    setCurrentUser(erpStorage.getCurrentUser());
    const nextUsers = erpStorage.getUsers();
    setAllUsers(Array.isArray(nextUsers) ? nextUsers : []);
    setCollegeProfile(erpStorage.getCollegeProfile());
    setModulePermissions(erpStorage.getModulePermissions() || {});
    const nextStudents = erpStorage.getStudents();
    setStudents(Array.isArray(nextStudents) ? nextStudents : []);
    const nextFaculty = erpStorage.getFaculty();
    setFaculty(Array.isArray(nextFaculty) ? nextFaculty : []);
    const nextTxns = erpStorage.getTransactions();
    setTransactions(Array.isArray(nextTxns) ? nextTxns : []);
    const nextGrades = erpStorage.getGrades();
    setGrades(Array.isArray(nextGrades) ? nextGrades : []);
    const nextAttendance = erpStorage.getAttendanceRecords();
    setAttendanceRecords(Array.isArray(nextAttendance) ? nextAttendance : []);
    const nextNotices = erpStorage.getNotices();
    setNotices(Array.isArray(nextNotices) ? nextNotices : []);
    const nextTickets = erpStorage.getTickets();
    setTickets(Array.isArray(nextTickets) ? nextTickets : []);
    const nextFeeHeads = erpStorage.getFeeHeads();
    setFeeHeads(Array.isArray(nextFeeHeads) ? nextFeeHeads : []);
    const nextCampaigns = erpStorage.getFeeCampaigns();
    setFeeCampaigns(Array.isArray(nextCampaigns) ? nextCampaigns : []);
    const nextConcessions = erpStorage.getConcessionRules();
    setConcessionRules(Array.isArray(nextConcessions) ? nextConcessions : []);
    const nextEnrollmentFields = erpStorage.getEnrollmentFields();
    setEnrollmentFields(Array.isArray(nextEnrollmentFields) ? nextEnrollmentFields : []);
    const nextMappings = erpStorage.getFacultyMappings();
    setFacultyMappings(Array.isArray(nextMappings) ? nextMappings : []);
    const nextCongrats = erpStorage.getCongratulationMessages();
    setCongratulations(Array.isArray(nextCongrats) ? nextCongrats : []);
    const nextTimetable = erpStorage.getTimetable();
    setTimetable(Array.isArray(nextTimetable) ? nextTimetable : []);
    const nextStreamSubjects = erpStorage.getStreamCourseSubjects();
    setStreamCourseSubjects(Array.isArray(nextStreamSubjects) ? nextStreamSubjects : []);
    setMarksheetConfig(erpStorage.getMarksheetConfig());
    const nextPromotions = erpStorage.getPromotionAuditRecords();
    setPromotionAuditRecords(Array.isArray(nextPromotions) ? nextPromotions : []);
    const nextTariffs = erpStorage.getServiceTariffs();
    setServiceTariffs(Array.isArray(nextTariffs) ? nextTariffs : []);
    const nextRequests = erpStorage.getServiceRequests();
    setServiceRequests(Array.isArray(nextRequests) ? nextRequests : []);
    const nextReconcile = erpStorage.get3WayReconciliationRecords();
    setReconciliationRecords(Array.isArray(nextReconcile) ? nextReconcile : []);
    setSystemSettings(erpStorage.getSystemSettings());
    const nextReportDefs = erpStorage.getReportDefinitions();
    setReportDefinitions(Array.isArray(nextReportDefs) ? nextReportDefs : []);
    const nextReportParams = erpStorage.getReportParameters();
    setReportParameters(Array.isArray(nextReportParams) ? nextReportParams : []);
    setCertificateConfig(erpStorage.getCertificateConfig());
    const nextSections = erpStorage.getCourseSections();
    setCourseSections(Array.isArray(nextSections) ? nextSections : []);
    const nextCustomRoles = erpStorage.getCustomRoles();
    setCustomRoles(Array.isArray(nextCustomRoles) ? nextCustomRoles : []);
    const nextGradeHeads = erpStorage.getGradeEvaluationHeads();
    setGradeHeads(Array.isArray(nextGradeHeads) ? nextGradeHeads : []);
    const nextDeclarations = erpStorage.getResultDeclarations();
    setResultDeclarations(Array.isArray(nextDeclarations) ? nextDeclarations : []);
  };

  const refreshStateRef = useRef(refreshState);
  refreshStateRef.current = refreshState;

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Auth: Sign Out handler (revokes session token, resets cached active personas, returns to sign in, wipes sessionStorage and IndexedDB to ensure absolute data wiping and prevent memory leaks - Bug 452)
  const handleSignOut = useCallback(async () => {
    revokeServerSession();
    erpStorage.setCurrentUser(null);
    setCurrentUser(null);
    setActiveStudentId('');
    setActiveFacultyId('');
    setActiveTab('overview');
    // Global IndexedDB and sessionStorage clearing mechanism to ensure absolute data wiping and prevent memory leaks (Bug 452)
    await clearGlobalIndexedDBAndSessionStorage().catch(() => {});
  }, []);

  const handleSignOutRef = useRef(handleSignOut);
  handleSignOutRef.current = handleSignOut;
  useEffect(() => {
    handleSignOutRef.current = handleSignOut;
  }, [handleSignOut]);

  // Authoritative Session Verification & Rolling Activity Renewal on Startup, Interval & Offline Mode
  useEffect(() => {
    let isMounted = true;
    const verifyInitialSession = async () => {
      try {
        const res = await validateServerSessionToken();
        if (!isMounted) return;
        if (!res.valid) {
          if (currentUserRef.current) {
            setSessionNotice(
              res.error || 'Your session expired or could not be verified. Please sign in again.'
            );
            await handleSignOutRef.current();
          }
        } else if (res.user) {
          if (
            !currentUserRef.current ||
            currentUserRef.current.role !== res.user.role ||
            currentUserRef.current.id !== res.user.id ||
            currentUserRef.current.sessionVersion !== res.user.sessionVersion
          ) {
            setCurrentUser(res.user);
            erpStorage.setCurrentUser(res.user);
          }
        }
      } catch {
        // Offline / unit-test protection
      } finally {
        if (isMounted) {
          setIsSessionVerifying(false);
        }
      }
    };
    void verifyInitialSession();

    // Periodic session verification (always enforces HMAC, revocation & expiry even offline)
    const sessionInterval = setInterval(async () => {
      try {
        const res = await validateServerSessionToken();
        if (!isMounted) return;
        if (!res.valid && currentUserRef.current) {
          setSessionNotice(
            res.error || 'Your session expired or was revoked. Please sign in again.'
          );
          await handleSignOutRef.current();
        }
      } catch {
        // Ignore unexpected verification exceptions
      }
    }, 15 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(sessionInterval);
    };
  }, []);

  // Rolling activity session renewal: synchronizes HttpOnly session cookie + HMAC token + session envelope
  useEffect(() => {
    if (!currentUser) return;
    let lastActivityRefreshAt = 0;

    const triggerRollingRefresh = () => {
      const activeUser = currentUserRef.current;
      if (!activeUser) return;
      const now = Date.now();
      if (now - lastActivityRefreshAt < 60 * 1000) return;
      lastActivityRefreshAt = now;

      erpStorage.getCurrentUser();
      refreshSessionTokenOnActivity(activeUser);
      if (typeof navigator === 'undefined' || navigator.onLine) {
        fetch('/api/auth/session/refresh', {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {});
      }
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        triggerRollingRefresh();
      }
    };

    window.addEventListener('pointerdown', triggerRollingRefresh, { passive: true });
    window.addEventListener('keydown', triggerRollingRefresh);
    window.addEventListener('focus', handleVisibilityOrFocus);
    const keepAliveTimer = setInterval(triggerRollingRefresh, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('pointerdown', triggerRollingRefresh);
      window.removeEventListener('keydown', triggerRollingRefresh);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(keepAliveTimer);
    };
  }, [currentUser?.id]);

  // Multi-tab synchronization: selective key-based state reload & cross-tab session guard
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingKeys = new Set<string>();
    const lastProcessedSeqMap = new Map<string, number>();

    const handleCrossTabSessionTransition = () => {
      const prevUser = currentUserRef.current;
      const hasToken =
        typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('rlsy_erp_session_token_v3'));
      const latestUser = hasToken ? erpStorage.getCurrentUser() : null;

      if (prevUser && (!latestUser || latestUser.id !== prevUser.id)) {
        // Sign out ONLY this stale tab locally without revoking the newer tab's server session
        setCurrentUser(null);
        setActiveStudentId('');
        setActiveFacultyId('');
        setActiveTab('overview');
        setSessionNotice(
          latestUser
            ? 'You were signed out in this tab because another user signed in from another browser tab.'
            : 'You were signed out from another browser tab.'
        );
        return;
      }

      if (latestUser && (!prevUser || latestUser.id === prevUser.id)) {
        setCurrentUser(latestUser);
      }
    };

    const syncKeySlice = (key: string) => {
      const currentSeq = erpStorage.getStorageSequence ? erpStorage.getStorageSequence(key) : 0;
      const lastSeq = lastProcessedSeqMap.get(key) || 0;
      if (currentSeq > 0 && currentSeq < lastSeq) {
        return;
      }
      if (lastProcessedSeqMap.size > 200) {
        const keysToDelete = Array.from(lastProcessedSeqMap.keys()).slice(0, 100);
        for (const k of keysToDelete) {
          lastProcessedSeqMap.delete(k);
        }
      }
      lastProcessedSeqMap.set(key, Math.max(currentSeq, lastSeq + 1));

      switch (key) {
        case 'rlsy_erp_current_user_v3':
        case 'rlsy_erp_session_token_v3':
          handleCrossTabSessionTransition();
          break;
        case 'rlsy_erp_users_v3':
          setAllUsers(erpStorage.getUsers());
          break;
        case 'rlsy_erp_college_profile_v3':
          setCollegeProfile(erpStorage.getCollegeProfile());
          break;
        case 'rlsy_erp_permissions_v3':
          setModulePermissions(erpStorage.getModulePermissions());
          break;
        case 'rlsy_erp_custom_roles_v3':
          setCustomRoles(erpStorage.getCustomRoles());
          setModulePermissions(erpStorage.getModulePermissions());
          break;
        case 'rlsy_erp_students_v3':
          setStudents(erpStorage.getStudents());
          break;
        case 'rlsy_erp_faculty_v3':
          setFaculty(erpStorage.getFaculty());
          break;
        case 'rlsy_erp_transactions_v3':
          setTransactions(erpStorage.getTransactions());
          break;
        case 'rlsy_erp_grades_v3':
          setGrades(erpStorage.getGrades());
          break;
        case 'rlsy_erp_attendance_v3':
          setAttendanceRecords(erpStorage.getAttendanceRecords());
          break;
        case 'rlsy_erp_notices_v3':
          setNotices(erpStorage.getNotices());
          break;
        case 'rlsy_erp_tickets_v3':
          setTickets(erpStorage.getTickets());
          break;
        case 'rlsy_erp_fee_heads_v3':
          setFeeHeads(erpStorage.getFeeHeads());
          break;
        case 'rlsy_erp_campaigns_v3':
          setFeeCampaigns(erpStorage.getFeeCampaigns());
          break;
        case 'rlsy_erp_concessions_v3':
          setConcessionRules(erpStorage.getConcessionRules());
          break;
        case 'rlsy_erp_enrollment_fields_v3':
          setEnrollmentFields(erpStorage.getEnrollmentFields());
          break;
        case 'rlsy_erp_mappings_v3':
          setFacultyMappings(erpStorage.getFacultyMappings());
          break;
        case 'rlsy_erp_congratulations_v3':
          setCongratulations(erpStorage.getCongratulationMessages());
          break;
        case 'rlsy_erp_timetable_v3':
          setTimetable(erpStorage.getTimetable());
          break;
        case 'rlsy_erp_stream_course_subjects_v3':
          setStreamCourseSubjects(erpStorage.getStreamCourseSubjects());
          break;
        case 'rlsy_erp_marksheet_config_v3':
          setMarksheetConfig(erpStorage.getMarksheetConfig());
          break;
        case 'rlsy_erp_promotion_audit_v3':
          setPromotionAuditRecords(erpStorage.getPromotionAuditRecords());
          break;
        case 'rlsy_erp_service_tariffs_v3':
          setServiceTariffs(erpStorage.getServiceTariffs());
          break;
        case 'rlsy_erp_service_requests_v3':
          setServiceRequests(erpStorage.getServiceRequests());
          break;
        case 'rlsy_erp_reconciliation_3way_v3':
          setReconciliationRecords(erpStorage.get3WayReconciliationRecords());
          break;
        case 'rlsy_erp_system_settings_v3':
          setSystemSettings(erpStorage.getSystemSettings());
          break;
        case 'rlsy_erp_report_definitions_v3':
          setReportDefinitions(erpStorage.getReportDefinitions());
          break;
        case 'rlsy_erp_report_parameters_v3':
          setReportParameters(erpStorage.getReportParameters());
          break;
        case 'rlsy_erp_certificate_config_v3':
          setCertificateConfig(erpStorage.getCertificateConfig());
          break;
        case 'rlsy_erp_course_sections_v3':
          setCourseSections(erpStorage.getCourseSections());
          break;
        case 'rlsy_erp_grade_heads_v3':
          setGradeHeads(erpStorage.getGradeEvaluationHeads());
          break;
        case 'rlsy_erp_result_declarations_v3':
          setResultDeclarations(erpStorage.getResultDeclarations());
          break;
        default:
          break;
      }
    };

    let isMounted = true;
    const handleStorageChange = (e: StorageEvent) => {
      if (!isMounted) return;
      if (e.key === null) {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        pendingKeys.clear();
        lastProcessedSeqMap.clear();
        refreshStateRef.current();
        return;
      }

      if (e.key === 'rlsy_erp_current_user_v3' || e.key === 'rlsy_erp_session_token_v3') {
        // React immediately on cross-tab session/login switches so stale tabs do not linger
        handleCrossTabSessionTransition();
        return;
      }

      if (e.key.startsWith('rlsy_erp_') && !e.key.startsWith('rlsy_erp_lock_') && !e.key.startsWith('rlsy_erp_storage_seq')) {
        pendingKeys.add(e.key);
      } else {
        return;
      }

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        if (!isMounted) return;
        const SYNC_KEY_PRIORITY: Record<string, number> = {
          'rlsy_erp_users_v3': 10,
          'rlsy_erp_permissions_v3': 20,
          'rlsy_erp_module_permissions_v3': 20,
          'rlsy_erp_custom_roles_v3': 30,
          'rlsy_erp_current_user_v3': 35,
          'rlsy_erp_college_profile_v3': 40,
          'rlsy_erp_faculty_v3': 50,
          'rlsy_erp_students_v3': 60,
          'rlsy_erp_fee_heads_v3': 70,
          'rlsy_erp_campaigns_v3': 80,
          'rlsy_erp_transactions_v3': 90,
          'rlsy_erp_grades_v3': 100,
          'rlsy_erp_attendance_v3': 110,
        };
        const keysToSync = Array.from(pendingKeys).sort((a, b) => {
          const prioA = SYNC_KEY_PRIORITY[a] ?? 999;
          const prioB = SYNC_KEY_PRIORITY[b] ?? 999;
          return prioA - prioB;
        });
        pendingKeys.clear();
        keysToSync.forEach(syncKeySlice);
      }, 150);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };
  }, []);

  // Auth: Login handler
  const handleLogin = async (user: UserAccount) => {
    let effectiveUser = user;

    // Recognize default Superadmin strictly for authorized institutional root email (Bugs 1 & 2)
    const isTargetSuperadmin = (user.email || '').trim().toLowerCase() === 'kumaripallawi061@gmail.com';
    if (isTargetSuperadmin && user.authProvider === 'google') {
      effectiveUser = {
        ...user,
        role: 'superadmin',
        authProvider: 'google',
        mustChangePassword: false,
      };
      const auditPayload: Omit<AuditLogEntry, 'id' | 'timestamp'> = {
        action: 'GOOGLE_ADMIN_LOGIN_SUCCESS',
        module: 'auth',
        actorId: effectiveUser.id || 'USR-SUPERADMIN',
        actorName: effectiveUser.name || 'Pallawi Kumari',
        actorRole: 'superadmin',
        summary: `Administrator authenticated successfully via Google Mail (${effectiveUser.email})`,
      };
      erpStorage.appendAuditLog(auditPayload);
      void recordResilientAuditLog(auditPayload);
    } else if (user.authProvider === 'google' && !isTargetSuperadmin && effectiveUser.role === 'superadmin') {
      revokeServerSession();
      throw new Error(
        `Security Exception: Google login for "${user.email || 'unknown'}" is not authorized for the Super Admin account.`
      );
    }

    setSessionNotice(null);
    createSessionToken(effectiveUser);
    erpStorage.setCurrentUser(effectiveUser);
    setCurrentUser(effectiveUser);
    if (effectiveUser.role === 'student') {
      setActiveTab('student_portal');
      const matched = resolveStudentForUser(effectiveUser, students);
      if (matched) {
        setActiveStudentId(matched.id);
      } else if (effectiveUser.studentId) {
        setActiveStudentId(effectiveUser.studentId);
      }
    } else if (effectiveUser.role === 'faculty') {
      setActiveTab('faculty_portal');
      if (effectiveUser.facultyId) setActiveFacultyId(effectiveUser.facultyId);
    } else if (effectiveUser.role === 'accountant') {
      setActiveTab('fees');
    } else if (effectiveUser.role === 'superadmin' || effectiveUser.role === 'principal') {
      setActiveTab('overview');
    } else {
      setActiveTab(getDefaultLandingModule(effectiveUser, modulePermissions));
    }
  };

  // Immediate eviction if activeTab is revoked or no longer permitted (Bug 158)
  useEffect(() => {
    if (!currentUser) return;
    if (activeTab === 'restricted_access') return;
    if (!canUserAccessModule(currentUser, activeTab, modulePermissions)) {
      const firstAllowed = MODULE_CATALOG.find((item) =>
        canUserAccessModule(currentUser, item.key, modulePermissions)
      );
      setActiveTab(firstAllowed ? firstAllowed.key : 'restricted_access');
    }
  }, [currentUser, modulePermissions, activeTab, setActiveTab]);

  // Sanitize user accounts passed down to modals and view components with deep sanitization (Bugs 23, 159)
  const sanitizedUsers = useMemo(() => {
    return allUsers.map((u) => {
      // Deep clone to prevent mutating or exposing nested credential keys
      const copy: any = JSON.parse(JSON.stringify(u));
      delete copy.password;
      delete copy.salt;
      delete copy.tempPassword;
      delete copy.resetToken;
      if (copy.enrollmentData && typeof copy.enrollmentData === 'object') {
        delete copy.enrollmentData.password;
        delete copy.enrollmentData.salt;
      }
      return Object.freeze(copy as UserAccount);
    });
  }, [allUsers]);

  const lastRegistrationTimesRef = useRef<number[]>([]);

  // Auth: Student Registration / Sign-Up with Roll No, DOB, Name, Email, Phone, Course, Semester & Password
  const handleRegisterStudent = async (data: {
    rollNo: string;
    dob: string;
    name: string;
    email: string;
    phone: string;
    password: string;
    course: string;
    semester: number;
  }) => {
    // Rate limit self-registrations (max 5 per minute across refreshes - Bug 14)
    const nowTs = Date.now();
    let storedRegTimes: number[] = [];
    try {
      const raw = sessionStorage.getItem('rlsy_reg_rate_limit');
      if (raw) storedRegTimes = JSON.parse(raw);
    } catch {}
    storedRegTimes = storedRegTimes.filter((t) => typeof t === 'number' && nowTs - t < 60000);
    if (storedRegTimes.length >= 5) {
      throw new Error('Rate Limit Exceeded: Too many registration attempts. Please wait a minute before trying again.');
    }
    storedRegTimes.push(nowTs);
    try {
      sessionStorage.setItem('rlsy_reg_rate_limit', JSON.stringify(storedRegTimes));
    } catch {}
    lastRegistrationTimesRef.current.push(nowTs);

    const cleanName = (data.name || '').trim();
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Validation Error: Student name must be at least 2 characters long.');
    }
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Validation Error: Please provide a valid email address (e.g. name@domain.edu).');
    }
    const cleanPhone = (data.phone || '').trim().replace(/[\s-]/g, '');
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (!phoneRegex.test(cleanPhone)) {
      throw new Error('Validation Error: Phone number must contain between 10 and 15 digits.');
    }
    const normalizedMobile = normalizeIndianMobileNumber(cleanPhone);
    if (!normalizedMobile || normalizedMobile.length < 10) {
      throw new Error('Validation Error: Phone number must be a valid 10-digit mobile number.');
    }
    const cleanRollNo = (data.rollNo || '').trim().toUpperCase();
    if (!cleanRollNo) {
      throw new Error('Validation Error: University Roll Number is mandatory for roster verification.');
    }
    const rawPassword = data.password || '';
    const cleanPass = rawPassword.trim();
    if (!cleanPass || rawPassword.length < 8) {
      throw new Error('Security Policy: Password must be at least 8 characters long and cannot consist solely of whitespace.');
    }
    const pwdPolicy = validatePasswordComplexity(rawPassword, {
      email: cleanEmail,
      mobile: cleanPhone,
      rollNo: cleanRollNo,
    });
    if (!pwdPolicy.valid) {
      throw new Error(pwdPolicy.error || 'Security Policy: Password does not meet institutional complexity requirements.');
    }
    const dobDate = new Date(data.dob);
    if (!data.dob || isNaN(dobDate.getTime())) {
      throw new Error('Validation Error: A valid Date of Birth is required.');
    }
    const now = new Date();
    if (dobDate >= now) {
      throw new Error('Validation Error: Date of Birth cannot be in the future.');
    }
    // Exact calendar age calculation accounting for leap years & leap-day births (Feb 29)
    let adjustedCalculatedAge = now.getFullYear() - dobDate.getFullYear();
    const monthDifferenceOffset = now.getMonth() - dobDate.getMonth();
    if (monthDifferenceOffset < 0 || (monthDifferenceOffset === 0 && now.getDate() < dobDate.getDate())) {
      adjustedCalculatedAge--;
    }
    if (adjustedCalculatedAge < 14) {
      throw new Error('Age Restriction: Student must be at least 14 years old for collegiate enrollment.');
    }

    // Read fresh snapshots to avoid stale closure overwrites under concurrent edits
    const storedUsers = erpStorage.getUsers();
    const storedStudents = erpStorage.getStudents();

    // Enforce pre-imported institutional roster + DOB verification
    const rosterStudentIndex = storedStudents.findIndex(
      (s) => (s.rollNo || '').trim().toUpperCase() === cleanRollNo
    );
    if (rosterStudentIndex === -1) {
      throw new Error(
        `Enrollment Guard: Roll Number "${cleanRollNo}" is not in the pre-imported institutional student roster. Contact Administration or Admissions first.`
      );
    }
    const rosterStudent = storedStudents[rosterStudentIndex];
    if (!rosterStudent.dob || rosterStudent.dob.trim() !== data.dob.trim()) {
      throw new Error(
        'Verification Failed: Roll Number and Date of Birth do not match our pre-imported student roster.'
      );
    }

    // Explicit Root Administrator Email Protection:
    if (cleanEmail === 'kumaripallawi061@gmail.com') {
      throw new Error(
        'Security Exception: The email "kumaripallawi061@gmail.com" is reserved exclusively for the Master Administrator. Registration with this email is strictly prohibited.'
      );
    }

    const existingUserWithEmail = storedUsers.find(
      (u) => (u.email || '').trim().toLowerCase() === cleanEmail
    );
    if (existingUserWithEmail) {
      if (existingUserWithEmail.role !== 'student') {
        throw new Error(
          `Security Exception: Registration conflict. The email "${data.email}" is already claimed by an active ${existingUserWithEmail.role.toUpperCase()} account (${existingUserWithEmail.name}). Student registration with this email is strictly prohibited.`
        );
      } else {
        throw new Error(
          `Account Conflict: The email "${data.email}" is already claimed by an existing student account. Registration cannot proceed. Please sign in directly or use the Forgot Password link to access your portal.`
        );
      }
    }

    const existingUserWithMobile = storedUsers.find(
      (u) => Boolean(u.mobile && normalizeIndianMobileNumber(u.mobile) === normalizedMobile)
    );
    if (existingUserWithMobile) {
      throw new Error(
        `Mobile Collision: The phone number "${data.phone}" is already associated with an active account (${existingUserWithMobile.name}). Duplicate accounts under the same mobile are prohibited.`
      );
    }

    const existingUserWithRollNo = storedUsers.find(
      (u) => Boolean(u.rollNo && (u.rollNo || '').trim().toUpperCase() === cleanRollNo)
    );
    if (existingUserWithRollNo) {
      throw new Error(
        `Account Conflict: A user account is already registered with Roll No "${data.rollNo}". Registration rejected. Please sign in directly.`
      );
    }

    const existingStudentWithEmail = storedStudents.find(
      (s) => (s.email || '').trim().toLowerCase() === cleanEmail
    );
    if (existingStudentWithEmail && existingStudentWithEmail.id !== rosterStudent.id) {
      throw new Error(
        `Email Collision Guard: The email address "${data.email}" is already registered to another enrolled student (${existingStudentWithEmail.name}, Roll No: ${existingStudentWithEmail.rollNo || 'N/A'}). Each student record must have a unique institutional email.`
      );
    }

    const existingStudentWithMobile = storedStudents.find(
      (s) => Boolean(s.phone && normalizeIndianMobileNumber(s.phone) === normalizedMobile)
    );
    if (existingStudentWithMobile && existingStudentWithMobile.id !== rosterStudent.id) {
      throw new Error(
        `Mobile Collision Guard: The phone number "${data.phone}" is already registered to enrolled student (${existingStudentWithMobile.name}, Roll No: ${existingStudentWithMobile.rollNo || 'N/A'}).`
      );
    }

    // Verify existing student email does not belong to another user account
    if (rosterStudent.email && rosterStudent.email.trim().toLowerCase() !== cleanEmail) {
      const otherUserWithExistingEmail = storedUsers.find(
        (u) =>
          (u.email || '').trim().toLowerCase() === rosterStudent.email.trim().toLowerCase() &&
          u.studentId !== rosterStudent.id &&
          u.id !== rosterStudent.id
      );
      if (otherUserWithExistingEmail) {
        throw new Error(
          `Security Exception: Roster record for Roll No "${cleanRollNo}" is tied to email "${rosterStudent.email}" which belongs to an active account.`
        );
      }
    }

    const selectedCourse = data.course || rosterStudent.course || 'B.Tech Computer Science & Engineering';
    const selectedSemester = Number(data.semester) || rosterStudent.semester || 1;

    // Submit registration to Express server first when backend is reachable (re-throws 4xx/403/409 without mutating local store)
    const serverReg = await apiClient.registerStudentOnServer({
      rollNo: cleanRollNo,
      dob: data.dob,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      password: data.password,
      course: selectedCourse,
      semester: selectedSemester,
    });

    const studentId = serverReg.studentId || rosterStudent.id;
    const updatedRosterStudent: Student = {
      ...rosterStudent,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      dob: data.dob,
      course: selectedCourse,
      semester: selectedSemester,
      enrollmentData: {
        ...(rosterStudent.enrollmentData || {}),
        dob: data.dob,
        phone: cleanPhone,
        course: selectedCourse,
        semester: selectedSemester,
      },
    };
    const updatedStudents = storedStudents.map((s, idx) =>
      idx === rosterStudentIndex ? updatedRosterStudent : s
    );

    const existingUserIds = new Set(storedUsers.map((u) => u.id));
    let studentUserId = serverReg.user?.id || generateSecureId('USR');
    if (!serverReg.user?.id) {
      let usrCollisionAttempts = 0;
      while (existingUserIds.has(studentUserId) && usrCollisionAttempts < 50) {
        usrCollisionAttempts++;
        studentUserId = generateSecureId('USR');
      }
    }

    const studentSalt = generateSecureSalt();
    const hashedPassword = await hashPassword(data.password, studentSalt);

    const storedUserAccount: UserAccount = {
      id: studentUserId,
      email: cleanEmail,
      mobile: data.phone.trim(),
      password: hashedPassword,
      salt: studentSalt,
      name: cleanName,
      role: 'student',
      mustChangePassword: false,
      sessionVersion: serverReg.user?.sessionVersion ?? 1,
      createdAt:
        serverReg.user?.createdAt ||
        new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      studentId,
      rollNo: updatedRosterStudent.rollNo,
      isActive: true,
    };
    const updatedUsers = [
      storedUserAccount,
      ...storedUsers.filter((u) => u.id !== storedUserAccount.id),
    ];

    const sessionUser: UserAccount = {
      ...storedUserAccount,
      password: '',
      salt: undefined,
    };

    createSessionToken(sessionUser);
    erpStorage.saveStudents(updatedStudents);
    erpStorage.saveUsers(updatedUsers);
    erpStorage.setCurrentUser(sessionUser);

    setStudents(updatedStudents);
    setAllUsers(updatedUsers);
    setCurrentUser(sessionUser);
    setActiveStudentId(studentId);
    setActiveTab('student_portal');
  };

  // Auth: Change Password with Bcrypt Hashing, Re-Authentication, and Short-Lived Reset Token Verification
  const handleChangePassword = async (
    userId: string,
    newPass: string,
    oldPass?: string,
    resetToken?: string
  ) => {
    const targetUser =
      erpStorage.getUsers().find((u) => u.id === userId) || allUsers.find((u) => u.id === userId);
    if (!targetUser) {
      throw new Error('Target user account not found.');
    }

    // Horizontal Privilege Escalation & Session Validation Guard
    if (currentUser) {
      if (currentUser.role !== 'superadmin' && currentUser.id !== userId) {
        console.error('Horizontal privilege escalation blocked: Cannot modify another user account.');
        throw new Error('Access denied: You can only change your own password.');
      }
      // Old Password Verification Guard:
      // Non-superadmins must supply and verify their current password.
      // Superadmins updating their own password must also supply and verify current password (Bug 9).
      if (currentUser.id === userId) {
        if (!oldPass || oldPass.trim().length === 0) {
          throw new Error('Authentication required: Current password must be verified before updating credentials.');
        }
        const isCurrentValid = await verifyPassword(
          oldPass,
          targetUser.password,
          targetUser.salt || ''
        );
        if (!isCurrentValid) {
          throw new Error('Authentication failed: Current password entered is incorrect.');
        }
      }
    } else {
      // Unauthenticated caller: forced first-login reset or OTP-verified forgot password reset
      if (!resetToken || isPasswordResetTokenRevoked(resetToken)) {
        throw new Error('Access denied: Reset token is invalid, expired, or has already been revoked.');
      }
      const isTokenValid = verifyPasswordResetToken(resetToken, targetUser.id, targetUser.password);
      if (!isTokenValid) {
        throw new Error(
          'Access denied: Valid short-lived password reset verification token is required.'
        );
      }
      if (oldPass && oldPass.trim().length > 0) {
        const isInitialValid = await verifyPassword(
          oldPass,
          targetUser.password,
          targetUser.salt || ''
        );
        if (!isInitialValid) {
          throw new Error('Authentication failed: Current password verification failed.');
        }
      }
    }

    const rawPass = newPass || '';
    if (!rawPass.trim() || rawPass.trim().length < 8) {
      throw new Error('Password security policy violation: Password must be at least 8 characters long.');
    }

    // Propagate password change to authoritative server first (propagates HTTP 4xx rejections without mutating local store or burning reset token)
    const serverResult = await apiClient.changePasswordOnServer({
      user: targetUser,
      currentPassword: oldPass,
      newPassword: rawPass,
      resetToken,
    });

    if (!currentUser && resetToken) {
      revokePasswordResetToken(resetToken);
    }

    const newSalt = generateSecureSalt();
    const updatedUser = erpStorage.updateUserPassword(userId, serverResult.hash, newSalt);
    if (!updatedUser || !updatedUser.id) {
      throw new Error('Password update failed: User record could not be updated in persistent store.');
    }
    // Invalidate any existing active server sessions for this user (Bug 13)
    revokeUserSessions(userId);
    refreshState();
    if (currentUser && currentUser.id === userId) {
      createSessionToken(updatedUser);
      erpStorage.setCurrentUser(updatedUser);
      setCurrentUser(updatedUser);
    }
    return updatedUser;
  };

  // Super Admin / Principal: Save College Profile
  const handleSaveCollegeProfile = (profile: CollegeProfile) => {
    if (!currentUser || !['superadmin', 'principal'].includes(currentUser.role)) {
      throw new Error('Access denied: Only Super Admin or Principal can update college profile settings.');
    }
    erpStorage.saveCollegeProfile(profile);
    setCollegeProfile(profile);
  };

  // Onboard Staff User (Principal/Super Admin) with Monotonic Faculty ID Allocation (Bugs 163, 171)
  const handleOnboardUser = async (
    userData: Omit<UserAccount, 'id' | 'createdAt'>,
    facultyDetails?: { designation: string; department: string }
  ) => {
    // Explicit authentication & role authorization guard (Bug 126)
    if (!currentUser || !['superadmin', 'principal'].includes(currentUser.role)) {
      console.error('Unauthorized user onboarding blocked: Active Super Admin or Principal session required.');
      throw new Error('Access denied: Authentication as Super Admin or Principal is required to onboard staff users.');
    }
    // Force canonical lowercasing on role code to prevent orphaned roles (Bug 6)
    const cleanRole = (userData.role || '').trim().toLowerCase() as UserRole;
    // Role escalation guard: only superadmin can provision superadmin (Bug 7)
    if (cleanRole === 'superadmin' && currentUser.role !== 'superadmin') {
      console.error('Role escalation prevented: Only Super Admin can provision Super Admin accounts.');
      throw new Error('Role escalation prohibited: Only Super Admin can provision Super Admin accounts.');
    }
    // Dual custody check: Principal cannot provision Accountant accounts without Super Admin approval (Bug 19)
    if (cleanRole === 'accountant' && currentUser.role !== 'superadmin') {
      throw new Error('Segregation of Duties: Only the Super Administrator can provision Accountant personnel with ledger access.');
    }

    const cleanEmail = (userData.email || '').trim().toLowerCase();
    if (cleanEmail === 'kumaripallawi061@gmail.com') {
      throw new Error('Security Exception: The email "kumaripallawi061@gmail.com" is reserved exclusively for the Master Administrator.');
    }
    const cleanMobile = (userData.mobile || '').trim().replace(/[\s-]/g, '');
    const latestUsers = erpStorage.getUsers();
    const latestFaculty = erpStorage.getFaculty();

    // Duplicate account verification: Prevent duplicate user entries
    const existingUser = latestUsers.find(
      (u) =>
        Boolean(cleanEmail && (u.email || '').trim().toLowerCase() === cleanEmail) ||
        Boolean(cleanMobile && (u.mobile || '').trim().replace(/[\s-]/g, '') === cleanMobile)
    );
    if (existingUser) {
      throw new Error(
        `Account Conflict: A user account with email "${userData.email}" or mobile "${userData.mobile}" already exists.`
      );
    }

    // Check duplicate in faculty list to prevent Ghost Faculty Records
    if (cleanRole === 'faculty') {
      const existingFaculty = latestFaculty.find(
        (f) =>
          Boolean(cleanEmail && (f.email || '').trim().toLowerCase() === cleanEmail) ||
          Boolean(cleanMobile && (f.phone || '').trim().replace(/[\s-]/g, '') === cleanMobile)
      );
      if (existingFaculty) {
        throw new Error(
          `Ghost Faculty Record Prevention: A faculty record with email "${userData.email}" (${existingFaculty.name}, ID: ${existingFaculty.facultyId || existingFaculty.id}) already exists.`
        );
      }
    }

    const tempId = generateSecureId('USR');
    const initialPlain =
      userData.password && userData.password.trim().length > 0
        ? userData.password.trim()
        : generateHighEntropyTempPassword();
    const staffSalt = generateSecureSalt();
    const hashedPassword = await hashPassword(initialPlain, staffSalt);

    const newUser = erpStorage.onboardUser(
      {
        ...userData,
        role: cleanRole,
        password: hashedPassword,
        salt: staffSalt,
        mustChangePassword: true,
      },
      tempId
    );

    // If faculty, also add to faculty list with monotonic ID calculation across both faculty and allUsers stores (Bug 14)
    if (cleanRole === 'faculty') {
      let maxFacNum = 0;
      for (const f of latestFaculty) {
        const idStr = f.facultyId || f.id || '';
        const match = idStr.match(/^FAC-(?:20\d\d-)?(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxFacNum) maxFacNum = num;
        }
      }
      for (const u of latestUsers) {
        const idStr = u.facultyId || u.id || '';
        const match = idStr.match(/^FAC-(?:20\d\d-)?(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxFacNum) maxFacNum = num;
        }
      }
      if (maxFacNum === 0) maxFacNum = Math.max(100, latestFaculty.length);
      const nextFacNum = maxFacNum + 1;
      const currentYearVal = new Date().getFullYear();
      const newFacultyId = `FAC-${currentYearVal}-${String(nextFacNum).padStart(4, '0')}`;
      const newFac: Faculty = {
        id: newFacultyId,
        facultyId: newFacultyId,
        name: userData.name,
        email: userData.email,
        phone: userData.mobile,
        designation: facultyDetails?.designation || userData.designation || 'Assistant Professor',
        department: facultyDetails?.department || userData.department || 'Computer Science & Engineering',
        assignedSubjects: [],
        leavesRemaining: 12,
      };
      const updatedFacList = [...latestFaculty, newFac];
      erpStorage.saveFaculty(updatedFacList);
      setFaculty(updatedFacList);

      // Link facultyId to the user account
      newUser.facultyId = newFacultyId;
      const all = erpStorage.getUsers().map((u) => (u.id === newUser.id ? newUser : u));
      erpStorage.saveUsers(all);
    }

    void apiClient.syncUserToServer(newUser);
    setAllUsers(erpStorage.getUsers());
  };

  // Super Admin: Toggle User Gateway Reconciliation menu access tag (Bug 10)
  const handleToggleUserGatewayReconciliation = (userId: string) => {
    if (!currentUser || currentUser.role !== 'superadmin') {
      throw new Error('Access denied: Super Admin authorization required to modify gateway reconciliation access.');
    }
    const freshUsers = erpStorage.getUsers();
    const updatedUsers = freshUsers.map((u) => {
      if (u.id === userId) {
        const currentStatus = Boolean(
          u.hasGatewayReconciliationAccess || u.taggedModules?.includes('reconciliation_3way')
        );
        const newStatus = !currentStatus;
        const currentTagged = u.taggedModules || [];
        const newTagged = newStatus
          ? Array.from(new Set([...currentTagged, 'reconciliation_3way' as ModuleKey]))
          : currentTagged.filter((m) => m !== 'reconciliation_3way');
        return {
          ...u,
          hasGatewayReconciliationAccess: newStatus,
          taggedModules: newTagged,
        };
      }
      return u;
    });

    erpStorage.saveUsers(updatedUsers);
    setAllUsers(updatedUsers);

    // If currently logged-in user was modified, update active session user state as well
    if (currentUser?.id === userId) {
      const updatedSelf = updatedUsers.find((u) => u.id === userId);
      if (updatedSelf) {
        erpStorage.setCurrentUser(updatedSelf);
        setCurrentUser(updatedSelf);
      }
    }
  };

  // Super Admin: Save Module Permissions (Guarantee superadmin retains core recovery access - Bug 285)
  const handleSaveModulePermissions = (perms: ModulePermissionMap) => {
    const safePerms: ModulePermissionMap = {
      ...perms,
      superadmin: Array.from(
        new Set([...(perms.superadmin || []), 'overview', 'role_permissions', 'admin_settings'] as ModuleKey[])
      ),
    };
    erpStorage.saveModulePermissions(safePerms, currentUser?.role);
    setModulePermissions(safePerms);
    setCustomRoles(erpStorage.getCustomRoles());
  };

  // Super Admin: Introduce New Role Type & Map Subsystems
  const handleCreateCustomRole = (
    roleData: Omit<CustomRoleDefinition, 'id' | 'createdAt'>
  ) => {
    const cleanCode = (roleData.code || '').trim().toLowerCase();
    if (!cleanCode || !/^[a-z0-9_-]{2,30}$/.test(cleanCode)) {
      throw new Error(
        'Validation Error: Role code must be between 2 and 30 characters long and contain only lowercase alphanumeric characters, underscores, or hyphens.'
      );
    }
    const dangerousKeys = ['__proto__', 'constructor', 'prototype', 'script', 'eval', 'null', 'undefined'];
    if (dangerousKeys.includes(cleanCode) || cleanCode.includes('<') || cleanCode.includes('>')) {
      throw new Error(`Security Exception: Role code "${cleanCode}" contains illegal or reserved security tokens.`);
    }
    const reserved = ['superadmin', 'principal', 'accountant', 'faculty', 'student', 'admin'];
    if (reserved.includes(cleanCode)) {
      throw new Error(`Reserved role code "${roleData.code}" cannot be used for custom roles.`);
    }
    const safeRoleData = {
      ...roleData,
      code: cleanCode,
      name: (roleData.name || (roleData as any).title || '').trim(),
    };
    const created = erpStorage.addCustomRole(safeRoleData, currentUser?.role);
    setCustomRoles(erpStorage.getCustomRoles());
    setModulePermissions(erpStorage.getModulePermissions());
    return created;
  };

  // Super Admin: Delete Custom Role
  const handleDeleteCustomRole = (roleCode: string) => {
    const cleanRoleCode = (roleCode || '').trim().toLowerCase();
    const latestUsers = erpStorage.getUsers();
    const assignedUsers = latestUsers.filter(
      (u) => (u.role || '').trim().toLowerCase() === cleanRoleCode
    );
    if (assignedUsers.length > 0) {
      throw new Error(
        `Cannot delete custom role "${roleCode}": ${assignedUsers.length} user account(s) are currently assigned to this role. Reassign those users before deleting the role.`
      );
    }
    erpStorage.deleteCustomRole(cleanRoleCode, currentUser?.role);
    setCustomRoles(erpStorage.getCustomRoles());
    setModulePermissions(erpStorage.getModulePermissions());
  };

  // Save Faculty Mappings (Principal)
  const handleSaveFacultyMappings = (newMappings: FacultyMapping[]) => {
    if (!currentUser || !['superadmin', 'principal'].includes(currentUser.role)) {
      throw new Error('Access denied: Principal or Super Admin authorization required to update faculty mappings.');
    }
    erpStorage.saveFacultyMappings(newMappings, currentUser.role);
    setFacultyMappings(newMappings);
  };

  // Save Timetable Slots (Principal / Teacher Mapping Studio)
  const handleSaveTimetable = (newSlots: TimetableSlot[]) => {
    if (!currentUser || !['superadmin', 'principal'].includes(currentUser.role)) {
      throw new Error('Access denied: Principal or Super Admin authorization required to update the timetable.');
    }
    erpStorage.saveTimetable(newSlots);
    setTimetable(newSlots);
  };

  // Save Faculty Workload and Assigned Subjects (with cascade cleanup of orphaned mappings/timetable - Bug 425)
  const handleSaveFaculty = (updatedFaculty: Faculty[]) => {
    if (!currentUser || !['superadmin', 'principal'].includes(currentUser.role)) {
      throw new Error('Access denied: Principal or Super Admin authorization required to update faculty records.');
    }
    const validIds = new Set(updatedFaculty.flatMap((f) => [f.id, f.facultyId].filter(Boolean)));
    erpStorage.saveFaculty(updatedFaculty);
    setFaculty(updatedFaculty);

    const latestMappings = erpStorage.getFacultyMappings();
    const cleanedMappings = latestMappings.filter((m) => validIds.has(m.facultyId));
    if (cleanedMappings.length !== latestMappings.length) {
      erpStorage.saveFacultyMappings(cleanedMappings, currentUser.role);
      setFacultyMappings(cleanedMappings);
    }
    const latestTimetable = erpStorage.getTimetable();
    const cleanedTimetable = latestTimetable.filter((t) => validIds.has(t.facultyId));
    if (cleanedTimetable.length !== latestTimetable.length) {
      erpStorage.saveTimetable(cleanedTimetable);
      setTimetable(cleanedTimetable);
    }
  };

  // Save Enrollment Fields schema
  const handleSaveEnrollmentFields = (newFields: EnrollmentField[]) => {
    if (!currentUser || !['superadmin', 'principal', 'accountant'].includes(currentUser.role)) {
      throw new Error('Access denied: Administrative authorization required to modify enrollment schema.');
    }
    erpStorage.saveEnrollmentFields(newFields);
    setEnrollmentFields(newFields);
  };

  // Batch Update Students (Enrollment Module & Section Reassignment)
  const handleBatchUpdateStudents = (updated: Student[]) => {
    erpStorage.saveStudents(updated);
    setStudents(updated);
    void apiClient.syncStudentRosterToServer(
      updated.map((s) => ({
        id: s.id,
        rollNo: s.rollNo,
        dob: s.dob,
        name: s.name,
        email: s.email,
        phone: s.phone,
        course: s.course,
        semester: s.semester,
      }))
    );

    // Synchronize allUsers when student identities (name, rollNo, email, phone) are updated in batch
    const studentById = new Map<string, Student>();
    const studentByRoll = new Map<string, Student>();
    for (const s of updated) {
      if (s.id) studentById.set(s.id, s);
      const r = (s.rollNo || '').trim().toUpperCase();
      if (r) studentByRoll.set(r, s);
    }

    const latestUsers = erpStorage.getUsers();
    let usersChanged = false;
    const updatedUsers = latestUsers.map((u) => {
      if (u.role !== 'student') return u;
      const uRoll = (u.rollNo || '').trim().toUpperCase();
      const matchedStudent =
        (u.studentId ? studentById.get(u.studentId) : undefined) ||
        studentById.get(u.id) ||
        (u.id.startsWith('USR-') ? studentById.get(u.id.replace(/^USR[-_]?/i, '')) : undefined) ||
        (uRoll ? studentByRoll.get(uRoll) : undefined) ||
        resolveStudentForUser(u, updated);

      if (matchedStudent) {
        const nextName = matchedStudent.name !== undefined ? matchedStudent.name : u.name;
        const nextMobile = matchedStudent.phone !== undefined ? matchedStudent.phone : u.mobile;
        const nextEmail = matchedStudent.email !== undefined ? matchedStudent.email : u.email;
        const nextRollNo = matchedStudent.rollNo !== undefined ? matchedStudent.rollNo : u.rollNo;
        if (
          u.name !== nextName ||
          u.mobile !== nextMobile ||
          u.email !== nextEmail ||
          u.rollNo !== nextRollNo
        ) {
          usersChanged = true;
          return {
            ...u,
            name: nextName,
            mobile: nextMobile,
            email: nextEmail,
            rollNo: nextRollNo,
          };
        }
      }
      return u;
    });

    if (usersChanged) {
      erpStorage.saveUsers(updatedUsers);
      setAllUsers(updatedUsers);

      if (currentUser && currentUser.role === 'student') {
        const activeUserUpdated = updatedUsers.find((u) => u.id === currentUser.id);
        if (activeUserUpdated) {
          erpStorage.setCurrentUser(activeUserUpdated);
          setCurrentUser(activeUserUpdated);
        }
      }
    }
  };

  // Update Individual Student Enrollment Profile Data
  const handleUpdateStudentEnrollmentData = (
    studentId: string,
    updatedData: Record<string, any>
  ) => {
    const isStudentRole = currentUser?.role === 'student';
    if (isStudentRole && currentStudent && currentStudent.id !== studentId) {
      throw new Error('Access denied: Students can only update their own profile.');
    }

    // Critical system-controlled financial ledger and statutory attendance metrics that are ALWAYS locked regardless of role (Bug 38)
    const criticalSystemLockedFields = [
      'totalFee',
      'paidFee',
      'pendingFee',
      'concessionAmount',
      'concessionCategory',
      'hallTicketEligible',
      'hallTicketBlocked',
      'attendancePercentage',
    ];

    // Additional fields restricted for student self-service updates
    const studentRestrictedFields = isStudentRole
      ? [
          'name',
          'rollNo',
          'registerNo',
          'course',
          'semester',
          'section',
          'batchYear',
          'streamCode',
          'category',
          ...enrollmentFields
            .filter((f) => f.mode === 'non_editable' || f.isCore)
            .map((f) => f.key),
        ]
      : [];

    const lockedFieldKeys = new Set<string>([
      ...criticalSystemLockedFields,
      ...studentRestrictedFields,
    ]);

    const sanitizedIncoming = deepSanitizeEnrollmentData(updatedData || {});
    const sanitizedData: Record<string, any> = {};
    for (const [k, v] of Object.entries(sanitizedIncoming)) {
      if (!lockedFieldKeys.has(k)) {
        sanitizedData[k] = v;
      }
    }

    const latestStudents = erpStorage.getStudents();
    let updatedStudentObj: Student | null = null;
    const updatedStudents = latestStudents.map((s) => {
      if (s.id === studentId) {
        let resolvedSem = s.semester;
        if (!isStudentRole && sanitizedData.semester !== undefined && sanitizedData.semester !== null) {
          const rawSemStr = String(sanitizedData.semester).trim();
          if (rawSemStr !== '') {
            const parsedSem = Number(rawSemStr);
            if (Number.isNaN(parsedSem) || !Number.isInteger(parsedSem) || parsedSem < 1 || parsedSem > 9) {
              throw new Error(`Validation Error: Invalid semester "${sanitizedData.semester}". Semester must be a valid integer between 1 and 9.`);
            }
            resolvedSem = parsedSem;
          }
        }
        const cleanEnrollment: Record<string, any> = { ...(s.enrollmentData || {}) };
        for (const [k, v] of Object.entries(sanitizedData)) {
          if (v !== undefined) {
            cleanEnrollment[k] = v;
          }
        }
        const updated: Student = {
          ...s,
          name: !isStudentRole && sanitizedData.name ? String(sanitizedData.name).trim() : s.name,
          rollNo: !isStudentRole && sanitizedData.rollNo ? String(sanitizedData.rollNo).trim() : s.rollNo,
          registerNo: !isStudentRole && sanitizedData.registerNo !== undefined ? String(sanitizedData.registerNo).trim() : s.registerNo,
          course: !isStudentRole && sanitizedData.course ? String(sanitizedData.course).trim() : s.course,
          semester: resolvedSem,
          section: !isStudentRole && sanitizedData.section !== undefined ? String(sanitizedData.section).trim() : s.section,
          batchYear: !isStudentRole && sanitizedData.batchYear !== undefined ? String(sanitizedData.batchYear).trim() : s.batchYear,
          email: sanitizedData.email !== undefined ? String(sanitizedData.email).trim() : s.email,
          phone: sanitizedData.phone !== undefined ? String(sanitizedData.phone).trim() : s.phone,
          parentPhone: sanitizedData.parentPhone !== undefined ? String(sanitizedData.parentPhone).trim() : s.parentPhone,
          dob: sanitizedData.dob !== undefined ? String(sanitizedData.dob).trim() : s.dob,
          enrollmentData: cleanEnrollment,
        };
        updatedStudentObj = updated;
        return updated;
      }
      return s;
    });

    erpStorage.saveStudents(updatedStudents);
    setStudents(updatedStudents);

    // Always synchronize user account authentication data to prevent stale credentials
    if (updatedStudentObj) {
      const studentObj: Student = updatedStudentObj;
      if (!isStudentRole) {
        void apiClient.syncStudentRosterToServer([
          {
            id: studentObj.id,
            rollNo: studentObj.rollNo,
            dob: studentObj.dob,
            name: studentObj.name,
            email: studentObj.email,
            phone: studentObj.phone,
            course: studentObj.course,
            semester: studentObj.semester,
          },
        ]);
      }
      const targetRoll = (studentObj.rollNo || '').trim().toUpperCase();
      const targetEmail = (studentObj.email || '').trim().toLowerCase();

      const latestUsers = erpStorage.getUsers();
      const updatedUsers = latestUsers.map((u) => {
        const uRoll = (u.rollNo || '').trim().toUpperCase();
        const uEmail = (u.email || '').trim().toLowerCase();
        if (
          (u.studentId && u.studentId === studentObj.id) ||
          (u.id === `USR-${studentObj.id}`) ||
          (targetRoll && uRoll === targetRoll) ||
          (targetEmail && uEmail === targetEmail && u.role === 'student')
        ) {
          return {
            ...u,
            name: studentObj.name,
            mobile: studentObj.phone,
            email: studentObj.email !== undefined ? studentObj.email : u.email,
            rollNo: studentObj.rollNo,
          };
        }
        return u;
      });
      erpStorage.saveUsers(updatedUsers);
      setAllUsers(updatedUsers);

      // If active session belongs to this student, synchronize active session user state
      if (
        currentUser &&
        (currentUser.studentId === studentObj.id ||
          currentUser.id === `USR-${studentObj.id}` ||
          (targetRoll && (currentUser.rollNo || '').trim().toUpperCase() === targetRoll))
      ) {
        const activeUserUpdated = updatedUsers.find((u) => u.id === currentUser.id);
        if (activeUserUpdated) {
          erpStorage.setCurrentUser(activeUserUpdated);
          setCurrentUser(activeUserUpdated);
        }
      }
    }
  };

  // Super Admin: Toggle Service Request Processor mapping (Bug 15)
  const handleToggleServiceRequestProcessor = (userId: string) => {
    if (!currentUser || !['superadmin', 'principal', 'admin'].includes(currentUser.role)) {
      throw new Error('Access denied: Administrative authorization required to designate service request processors.');
    }
    const targetUser = erpStorage.getUsers().find((u) => u.id === userId);
    if (!targetUser) {
      throw new Error('User not found.');
    }
    const allowedRoles = ['accountant', 'superadmin', 'principal', 'admin'];
    if (!allowedRoles.includes(targetUser.role.toLowerCase())) {
      throw new Error(`Invalid Assignment: Users with role "${targetUser.role}" cannot be designated as service request processors.`);
    }
    const updated = erpStorage.toggleServiceRequestProcessor(userId);
    setAllUsers(updated);
    if (currentUser?.id === userId) {
      const self = updated.find((u) => u.id === userId);
      if (self) {
        erpStorage.setCurrentUser(self);
        setCurrentUser(self);
      }
    }
  };

  // Staff: Mark service request completed (moves to Archive) with ID-bound self-approval separation-of-duties guard
  const handleCompleteServiceRequest = (requestId: string, remarks?: string) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'accountant_requests', modulePermissions)) {
      throw new Error('Access denied: Authorization required to complete service requests.');
    }
    const targetReq = erpStorage.getServiceRequests().find((r) => r.id === requestId);
    if (targetReq && isSelfApprovalConflict(currentUser, targetReq)) {
      throw new Error('Separation of Duties Violation: Staff cannot approve or complete their own service requests.');
    }
    const staffName = currentUser.name || 'Authorized Staff';
    erpStorage.completeServiceRequest(requestId, staffName, remarks);
    setServiceRequests(erpStorage.getServiceRequests());
  };

  // Staff: 3-Month Retention Audit Purge
  const handlePurgeExpiredServiceRequests = (days: number = 90) => {
    const res = erpStorage.purgeExpiredServiceRequests(days);
    setServiceRequests(erpStorage.getServiceRequests());
    return res;
  };

  // Post Congratulation Message (Faculty, Principal, or Super Admin)
  const handleAddCongratulation = (
    msg: Omit<CongratulationMessage, 'id' | 'date'>
  ) => {
    if (!currentUser || !['superadmin', 'principal', 'faculty'].includes(currentUser.role)) {
      throw new Error('Access denied: Only Faculty, Principal, or Super Admin can publish student accolades.');
    }
    erpStorage.addCongratulationMessage(msg);
    setCongratulations(erpStorage.getCongratulationMessages());
  };

  // Fee Payment Handler with exact balance matching & overpayment block (Bugs 26, 41)
  const handleProcessPayment = (
    studentId: string,
    amount: number,
    method: 'UPI' | 'Card' | 'NetBanking' | 'Cash' | 'DD',
    feeHeadTitle: string,
    referenceNo?: string,
    campaignId?: string,
    feeHeadId?: string,
    serverReceiptNo?: string
  ) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'fees', modulePermissions)) {
      throw new Error('Access denied: Fee processing authorization required.');
    }
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
      throw new Error('Payment amount must be a valid positive number.');
    }
    const paymentPaisa = toPaisa(amount);
    if (paymentPaisa <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }
    const prevStu = erpStorage.getStudents().find((s) => s.id === studentId);
    if (!prevStu) {
      throw new Error(`Student record not found for payment processing.`);
    }
    const currentPendingPaisa = toPaisa(prevStu.pendingFee || 0);
    // Block payment overages and require exact balance matching:
    if (paymentPaisa > currentPendingPaisa) {
      throw new Error(
        `Overpayment Blocked: Payment amount (₹${fromPaisa(paymentPaisa).toFixed(2)}) exceeds current outstanding pending dues (₹${fromPaisa(currentPendingPaisa).toFixed(2)}). Exact balance matching is strictly enforced.`
      );
    }
    const cleanAmount = fromPaisa(paymentPaisa);
    const result = erpStorage.processFeePayment(
      studentId,
      cleanAmount,
      method,
      feeHeadTitle,
      referenceNo,
      campaignId,
      feeHeadId,
      serverReceiptNo
    );
    const auditPayload = {
      actorId: currentUser?.id || 'SYS',
      actorName: currentUser?.name || 'Portal User',
      actorRole: currentUser?.role || 'accountant',
      action: 'FEE_PAYMENT_POSTED',
      entityType: 'FeeTransaction',
      entityId: result.transaction.receiptNo,
      summary: `Processed fee payment of INR ${cleanAmount} via ${method} for ${result.student.name} (${result.student.rollNo})`,
      oldValue: prevStu ? { paidFee: prevStu.paidFee, pendingFee: prevStu.pendingFee } : undefined,
      newValue: { paidFee: result.student.paidFee, pendingFee: result.student.pendingFee, receiptNo: result.transaction.receiptNo },
    };
    erpStorage.appendAuditLog(auditPayload);
    void recordResilientAuditLog(auditPayload);
    refreshState();
    return result;
  };

  // Fee Campaigns & Fee Heads
  const handleSaveFeeHeads = (newHeads: FeeHead[]) => {
    const MAX_FEE_HEAD_INR = 500000;
    if (newHeads.some((h) => typeof h.amount === 'number' && (h.amount < 0 || h.amount > MAX_FEE_HEAD_INR))) {
      throw new Error(`Validation Error: Fee head amounts cannot be negative and cannot exceed ₹${MAX_FEE_HEAD_INR.toLocaleString('en-IN')}.`);
    }
    // Enforce unique titles on fee heads with Unicode NFKC normalization (Bugs 42, 51)
    const titleSet = new Set<string>();
    for (const h of newHeads) {
      const rawTitle = (h.title || (h as any).name || '').normalize('NFKC').trim().toLowerCase();
      if (titleSet.has(rawTitle)) {
        throw new Error(`Validation Error: Duplicate fee head title "${h.title || (h as any).name}". Fee head titles must be unique.`);
      }
      titleSet.add(rawTitle);
    }

    // Block deletion if fee head is allocated in active uncompleted campaigns (Bug 43)
    const currentHeads = erpStorage.getFeeHeads();
    const currentCampaigns = erpStorage.getFeeCampaigns();
    const nextHeadIds = new Set(newHeads.map((h) => h.id));
    const activeCampaigns = currentCampaigns.filter((c) => c.status !== 'Completed');
    for (const oldHead of currentHeads) {
      if (!nextHeadIds.has(oldHead.id)) {
        const inUseCampaign = activeCampaigns.find(
          (c) =>
            (c.feeHeadAmounts && (c.feeHeadAmounts[oldHead.id] !== undefined || c.feeHeadAmounts[oldHead.title] !== undefined)) ||
            (c.feeHeadIds && c.feeHeadIds.includes(oldHead.id)) ||
            ((c as any).heads && (c as any).heads.includes(oldHead.id))
        );
        if (inUseCampaign) {
          throw new Error(
            `Cannot delete fee head "${oldHead.title || (oldHead as any).name}": Head is currently allocated to active campaign "${inUseCampaign.title}".`
          );
        }
      }
    }

    const oldHeads = currentHeads;
    erpStorage.saveFeeHeads(newHeads, currentUser?.role);
    const auditPayload = {
      actorId: currentUser?.id || 'SYS',
      actorName: currentUser?.name || 'Accountant',
      actorRole: currentUser?.role || 'accountant',
      action: 'FEE_HEADS_UPDATED',
      entityType: 'FeeHead',
      entityId: `COUNT-${newHeads.length}`,
      summary: `Updated institutional fee head catalog (${newHeads.length} heads)`,
      oldValue: oldHeads.length,
      newValue: newHeads.length,
    };
    erpStorage.appendAuditLog(auditPayload);
    void recordResilientAuditLog(auditPayload);
    setFeeHeads(newHeads);
    setTransactions(erpStorage.getTransactions());
  };

  const handleSaveFeeCampaigns = (campaigns: FeeCampaign[]) => {
    for (const c of campaigns) {
      assertValidFeeCampaign(c);
    }

    // Bug 719: Prevent deleting fee campaigns with existing processed transactions
    const currentCampaigns = erpStorage.getFeeCampaigns();
    const removedCampaignIds = currentCampaigns
      .filter((c) => !campaigns.some((next) => next.id === c.id))
      .map((c) => c.id);
    if (removedCampaignIds.length > 0) {
      const allTxns = erpStorage.getTransactions();
      const hasTransactions = allTxns.some(
        (t) => t.campaignId && removedCampaignIds.includes(t.campaignId)
      );
      if (hasTransactions) {
        throw new Error(
          'Security Exception: Cannot delete fee campaigns that have existing processed student transactions.'
        );
      }
    }

    erpStorage.saveFeeCampaigns(campaigns, currentUser?.role);
    setFeeCampaigns(campaigns);
  };

  const handleCreateCampaign = (camp: Omit<FeeCampaign, 'id' | 'createdAt' | 'extensionHistory'>) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'fees', modulePermissions)) {
      throw new Error('Access denied: Authorization required to create fee campaigns.');
    }
    assertValidFeeCampaign(camp);
    erpStorage.createFeeCampaign(camp);
    setFeeCampaigns(erpStorage.getFeeCampaigns());
  };

  const handleExtendCampaignEndDate = (campaignId: string, newEndDate: string, reason?: string) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'fees', modulePermissions)) {
      throw new Error('Access denied: Authorization required to extend fee campaigns.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(newEndDate || '').trim())) {
      throw new Error('Validation Error: Extended campaign end date must be in YYYY-MM-DD format.');
    }
    const latestCampaigns = erpStorage.getFeeCampaigns();
    const target = latestCampaigns.find((c) => c.id === campaignId);
    if (!target) {
      throw new Error('Fee campaign not found.');
    }
    if (target.status === 'Completed') {
      throw new Error(`Cannot extend fee campaign "${target.title}": Campaign is marked as ${target.status}.`);
    }
    // Validate strictly against IST calendar date, startDate, and createdAt (IST)
    const todayStr = getISTDateString();
    if (newEndDate < todayStr) {
      throw new Error('Validation Error: Extended campaign end date cannot be in the past.');
    }
    if (target.startDate && newEndDate < target.startDate) {
      throw new Error('Validation Error: Extended campaign end date cannot precede campaign start date.');
    }
    const createdStr = target.createdAt ? getISTDateString(new Date(target.createdAt)) : todayStr;
    if (newEndDate < createdStr) {
      throw new Error('Validation Error: Extended campaign end date cannot precede campaign creation date.');
    }
    erpStorage.extendFeeCampaign(
      campaignId,
      newEndDate,
      currentUser.name,
      reason
    );
    setFeeCampaigns(erpStorage.getFeeCampaigns());
  };

  const handleSaveConcessionRules = (rules: ConcessionRule[]) => {
    erpStorage.saveConcessionRules(rules, currentUser?.role);
    setConcessionRules(rules);
  };

  const handleSaveStreamCourseSubjects = (updated: StreamCourseSubject[]) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'stream_mapping', modulePermissions)) {
      throw new Error('Access denied: Authorization required to modify curriculum stream mappings.');
    }
    erpStorage.saveStreamCourseSubjects(updated);
    setStreamCourseSubjects(updated);
    setGrades(erpStorage.getGrades());
    setAttendanceRecords(erpStorage.getAttendanceRecords());
  };

  const handleSaveMarksheetConfig = (config: MarksheetConfig) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'marksheet_designer', modulePermissions)) {
      throw new Error('Access denied: Authorization required to modify marksheet design configuration.');
    }
    assertSafeCertificateImages(config);
    erpStorage.saveMarksheetConfig(config);
    setMarksheetConfig(config);
  };

  const handleSaveServiceTariffs = (tariffs: ServiceTariff[]) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'accountant_requests', modulePermissions)) {
      throw new Error('Access denied: Authorization required to modify service tariff schedules.');
    }
    erpStorage.saveServiceTariffs(tariffs);
    setServiceTariffs(tariffs);
  };

  const handleSaveServiceRequests = (requests: ServiceRequestItem[]) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'accountant_requests', modulePermissions)) {
      throw new Error('Access denied: Authorization required to modify student service requests.');
    }
    erpStorage.saveServiceRequests(requests);
    setServiceRequests(requests);
  };

  const handleCreateServiceRequest = (req: Omit<ServiceRequestItem, 'id' | 'createdAt' | 'status'>) => {
    const created = erpStorage.createServiceRequest(req);
    refreshState();
    return created;
  };

  const handleSaveReconciliationRecords = (records: Reconciliation3WayRecord[]) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'reconciliation_3way', modulePermissions)) {
      throw new Error('Access denied: 3-Way Gateway Reconciliation authorization is required.');
    }
    erpStorage.save3WayReconciliationRecords(records);
    setReconciliationRecords(records);
  };

  const handleSaveSystemSettings = (newSettings: SystemSettingsConfig) => {
    if (!currentUser || !['superadmin', 'principal'].includes(currentUser.role)) {
      throw new Error('Access denied: Super Admin or Principal authorization is required to update system settings.');
    }
    erpStorage.saveSystemSettings(newSettings);
    setSystemSettings(newSettings);
  };

  const handleSaveReportDefinitions = (defs: ReportTypeDefinition[]) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'reports', modulePermissions)) {
      throw new Error('Access denied: Reports module authorization is required to update report definitions.');
    }
    erpStorage.saveReportDefinitions(defs);
    setReportDefinitions(defs);
  };

  const handleSaveReportParameters = (params: ReportParameterDef[]) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'reports', modulePermissions)) {
      throw new Error('Access denied: Reports module authorization is required to update report parameters.');
    }
    erpStorage.saveReportParameters(params);
    setReportParameters(params);
  };

  const handleSaveCertificateConfig = (cfg: CertificateDesignConfig) => {
    if (!currentUser || !canUserAccessModule(currentUser, 'certificate_designer', modulePermissions)) {
      throw new Error('Access denied: Authorization required to modify certificate templates.');
    }
    assertSafeCertificateImages(cfg);
    erpStorage.saveCertificateConfig(cfg);
    setCertificateConfig(cfg);
  };

  const handlePromoteStudents = (
    streamCode: string,
    course: string,
    fromSemester: number,
    toSemester: number,
    rollNos: string[],
    promotedBy: string,
    subject?: string,
    overrideOptions?: { overrideEligibility?: boolean; overrideReason?: string }
  ) => {
    const res = erpStorage.promoteStudents(
      streamCode,
      course,
      fromSemester,
      toSemester,
      rollNos,
      promotedBy,
      subject,
      currentUser?.role,
      overrideOptions
    );
    const promoAudit = {
      actorId: currentUser?.id || 'ADMIN',
      actorName: promotedBy || currentUser?.name || 'Authority',
      actorRole: currentUser?.role || 'principal',
      action: 'STUDENT_COHORT_PROMOTION',
      entityType: 'StudentPromotionRecord',
      entityId: res.record.id,
      summary: `Promoted ${res.record.promotedCount} student(s) in ${course} (${streamCode}) from Sem ${fromSemester} to Sem ${toSemester}`,
      oldValue: { fromSemester },
      newValue: { toSemester, promotedCount: res.record.promotedCount },
    };
    erpStorage.appendAuditLog(promoAudit);
    void recordResilientAuditLog(promoAudit);
    setStudents(res.updatedStudents);
    setPromotionAuditRecords(erpStorage.getPromotionAuditRecords());
    const latestUsers = erpStorage.getUsers();
    setAllUsers(latestUsers);
    if (currentUser && currentUser.role === 'student') {
      const updatedSelf = latestUsers.find((u) => u.id === currentUser.id);
      if (updatedSelf) {
        setCurrentUser(updatedSelf);
      }
    }
    return res;
  };

  const handleRevertPromotionRecord = (recordId: string) => {
    const res = erpStorage.revertPromotionRecord(recordId, currentUser?.role);
    setStudents(res.updatedStudents);
    setPromotionAuditRecords(res.audits);
    return res;
  };

  // Attendance Save Handler (Per-session tracking & student attendance % recalculation sync)
  const handleSaveAttendance = (
    newRecords: Omit<AttendanceRecord, 'id'>[],
    subjectCode: string
  ) => {
    const res = erpStorage.saveAttendanceBatch(newRecords, subjectCode);
    setAttendanceRecords(res.records);
    setStudents(res.students);
  };

  // Admin Section Management Handler
  const handleSaveCourseSections = (updated: CourseSectionConfig[]) => {
    erpStorage.saveCourseSections(updated);
    setCourseSections(updated);
  };

  // Grade Save Handler (with Post-Declaration Lock Enforcement - Bug 56)
  const handleSaveGrade = (
    grade: Omit<ExamGradeRecord, 'id' | 'letterGrade' | 'gradePoint'> & { totalMarks?: number }
  ) => {
    const latestStudents = erpStorage.getStudents();
    const latestDeclarations = erpStorage.getResultDeclarations();
    const latestGrades = erpStorage.getGrades();
    const studentObj = latestStudents.find((s) => s.id === grade.studentId);
    const lockCheck = checkPostDeclarationGradeLock(
      grade.semester,
      grade.course || studentObj?.course || 'All Courses',
      latestDeclarations
    );
    if ((lockCheck.locked || lockCheck.isLocked) && !lockCheck.hasApprovedUnlockWindow) {
      throw new Error(
        `Grade Modification Locked: Examination results for Sem ${grade.semester} (${grade.course || studentObj?.course || 'All Courses'}) are officially declared and locked. Edits are prohibited without an authorized unlock request.`
      );
    }

    const prevGrade = latestGrades.find(
      (g) => g.studentId === grade.studentId && g.subjectCode === grade.subjectCode && g.semester === grade.semester
    );
    const saved = erpStorage.saveExamGrade(grade);
    const gradeAudit = {
      actorId: currentUser?.id || 'FAC',
      actorName: currentUser?.name || 'Faculty',
      actorRole: currentUser?.role || 'faculty',
      action: 'GRADE_RECORD_SAVED',
      entityType: 'ExamGradeRecord',
      entityId: `${grade.studentId}-${grade.subjectCode}`,
      summary: `Saved marks for ${grade.subjectCode} (Sem ${grade.semester}): Letter Grade ${saved.letterGrade}`,
      oldValue: prevGrade ? { internalMarks: prevGrade.internalMarks, externalMarks: prevGrade.externalMarks } : undefined,
      newValue: { internalMarks: saved.internalMarks, externalMarks: saved.externalMarks, letterGrade: saved.letterGrade },
    };
    erpStorage.appendAuditLog(gradeAudit);
    void recordResilientAuditLog(gradeAudit);
    setGrades(erpStorage.getGrades());
  };

  // Grade Heads Schema Handler (Admin / Principal / Accountant)
  const handleSaveGradeHeads = (heads: GradeEvaluationHead[]) => {
    if (!currentUser || !['superadmin', 'principal', 'accountant'].includes(currentUser.role)) {
      throw new Error('Access denied: Administrative authorization required to modify evaluation heads.');
    }
    erpStorage.saveGradeEvaluationHeads(heads);
    setGradeHeads(heads);
  };

  // Result Declaration Calendar Handler (Principal / Superadmin)
  const handleSaveResultDeclarations = (declarations: SemesterResultDeclaration[]) => {
    erpStorage.saveResultDeclarations(declarations, currentUser?.role);
    setResultDeclarations(declarations);
  };

  // Notice Post Handler (with Instant Notification Badge Dispatch - Bug 71)
  const handlePostNotice = (notice: Omit<InstitutionalNotice, 'id' | 'date'>) => {
    const created = erpStorage.addNotice(notice);
    setNotices(erpStorage.getNotices());
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:notice-posted', { detail: created }));
      }
    } catch {}
  };

  // Helpdesk Ticket Handlers
  const handleSubmitTicket = (
    ticket: Omit<HelpdeskTicket, 'id' | 'ticketNo' | 'createdAt' | 'status'>
  ) => {
    erpStorage.submitTicket(ticket);
    setTickets(erpStorage.getTickets());
  };

  const handleResolveTicket = (ticketId: string, note: string) => {
    if (!currentUser) return;
    if (!['superadmin', 'principal'].includes(currentUser.role)) {
      return;
    }
    const targetTicket = erpStorage.getTickets().find((t) => t.id === ticketId);
    if (targetTicket && isSelfApprovalConflict(currentUser, targetTicket)) {
      throw new Error('Separation of Duties: Staff cannot resolve tickets raised under their own identity.');
    }
    erpStorage.resolveTicket(ticketId, note, currentUser.name);
    setTickets(erpStorage.getTickets());
  };

  // Open Online Payment Modal from Student Portal (Guarded against unauthorized persona switching & ambiguous email lookup - Bug 133)
  const handleOpenPaymentModal = (studentId?: string) => {
    if (currentUser?.role === 'student') {
      const matched = resolveStudentForUser(currentUser, students, activeStudentId);
      setActiveStudentId(matched ? matched.id : currentUser.studentId || activeStudentId);
    } else if (studentId) {
      setActiveStudentId(studentId);
    }
    setActiveTab('fees');
  };

  const openConfirmDialog = useErpStore((s) => s.openConfirmDialog);

  // Reset demo storage with typed RESET confirmation dialog (Superadmin Only)
  const handleResetData = () => {
    if (currentUser?.role !== 'superadmin') return;
    openConfirmDialog({
      title: 'Reset All ERP Database Records?',
      message:
        'This destructive action will wipe all local fee ledgers, attendance registers, marksheets, and custom roles back to the initial seed state.',
      requireTypedText: 'RESET',
      confirmLabel: 'Wipe & Reset ERP',
      variant: 'danger',
      onConfirm: handleConfirmReset,
    });
  };

  const handleConfirmReset = async (): Promise<void> => {
    if (currentUser?.role !== 'superadmin') return;
    setShowResetConfirmModal(false);
    try {
      // 1. Fully resolve IndexedDB and sessionStorage clearing before proceeding
      await clearGlobalIndexedDBAndSessionStorage().catch(() => {});
      // 2. Revoke active server token
      revokeServerSession();
      // 3. Reset storage records to seed state
      await erpStorage.resetDefaults();
      // 4. Update in-memory component states to clean fallbacks
      refreshState();
      setActiveTab('overview');
      setActiveStudentId('');
      setActiveFacultyId('');
      // 5. Trigger browser reload only after all storage and state tasks resolve cleanly
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to complete clean ERP reset:', err);
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  const sidebarCollapsed = useErpStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useErpStore((s) => s.toggleSidebarCollapsed);
  const globalSearchOpen = useErpStore((s) => s.globalSearchOpen);
  const setGlobalSearchOpen = useErpStore((s) => s.setGlobalSearchOpen);

  // Synchronize document title and smooth scroll to top on tab transition (Bugs 14, 487, 557)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const defaultTitle = collegeProfile?.name || 'Ram Lakhan Singh Yadav College ERP';
    if (typeof document !== 'undefined') {
      const formattedTab = activeTab
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      document.title = `${formattedTab} | ${defaultTitle}`;
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.title = defaultTitle;
      }
    };
  }, [activeTab, collegeProfile?.name]);

  // =========================================================================
  // INITIAL SESSION VERIFICATION GATE (Prevents cached user flash before check)
  // =========================================================================
  if (isSessionVerifying) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-200">
        <div className="text-center space-y-3">
          <ShieldCheck className="w-10 h-10 text-amber-400 mx-auto animate-pulse" />
          <p className="text-sm font-semibold tracking-wide">Verifying institutional session...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // DEFAULT PAGE: STUDENT SIGN IN (When not authenticated)
  // =========================================================================
  if (!currentUser) {
    return (
      <>
        {sessionNotice && (
          <div
            role="status"
            aria-live="polite"
            className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs flex items-center justify-between gap-4"
          >
            <span className="font-medium">{sessionNotice}</span>
            <button
              type="button"
              onClick={() => setSessionNotice(null)}
              className="font-bold underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
        <AuthPage
          collegeProfile={collegeProfile}
          allUsers={sanitizedUsers}
          students={students}
          availableCourses={availableCourses}
          onLogin={handleLogin}
          onRegisterStudent={handleRegisterStudent}
          onChangePassword={handleChangePassword}
        />
        <ToastAndConfirmDialog />
      </>
    );
  }

  // =========================================================================
  // AUTHENTICATED PORTAL VIEW
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-900 pb-16 lg:pb-0">
      {/* HEADER NAVIGATION (Filtered by RBAC; no switcher for students) */}
      <Header
        currentUser={currentUser}
        collegeProfile={collegeProfile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        modulePermissions={modulePermissions}
        onOpenAuth={() => {
          if (currentUser?.role === 'superadmin') {
            setIsUserManagementModalOpen(true);
          } else if (currentUser?.role === 'principal') {
            setIsCollegeProfileModalOpen(true);
          }
        }}
        onOpenCollegeProfile={() => setIsCollegeProfileModalOpen(true)}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
        onOpenModulePermissions={() => setIsModulePermissionsModalOpen(true)}
        onOpenSystemHealth={() => setIsSystemHealthModalOpen(true)}
        onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
        onResetData={handleResetData}
        onSignOut={handleSignOut}
      />


      {/* GROUPED DESKTOP SIDEBAR + MAIN CONTENT SHELL */}
      <div className="flex-1 flex w-full">
        <Sidebar
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          modulePermissions={modulePermissions}
          students={students}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapsed}
          globalSearchOpen={globalSearchOpen}
          onCloseGlobalSearch={() => setGlobalSearchOpen(false)}
          onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
        />

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full min-w-0">
        {sessionNotice && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between text-xs shadow-sm"
          >
            <span className="font-medium">{sessionNotice}</span>
            <button
              type="button"
              onClick={() => setSessionNotice(null)}
              className="font-bold underline ml-4 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
        {/* OFFLINE NETWORK CONNECTION NOTICE (Bug 535) */}
        {isOffline && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 p-3.5 rounded-2xl bg-slate-900 text-amber-300 border border-amber-500/40 flex items-center justify-between text-xs shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Offline Mode Active: Network connection is currently unavailable. Local ERP operations remain functional and will synchronize when connectivity is restored.
              </span>
            </div>
          </div>
        )}

        {/* NON-DISRUPTIVE BROWSER STORAGE QUOTA NOTICE */}
        {quotaWarning && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex items-center justify-between text-xs animate-in fade-in shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="font-bold uppercase tracking-wider text-xs bg-amber-500/20 px-2 py-0.5 rounded text-amber-800">
                Storage Managed
              </span>
              <span>{quotaWarning}</span>
            </div>
            <button
              onClick={() => setQuotaWarning(null)}
              className="text-amber-800 hover:text-amber-950 font-bold ml-4 underline text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* VIEW 0: RESTRICTED ACCESS NOTICE (0-permission role fallback) */}
        {activeTab === 'restricted_access' && (
          <div className="py-12 px-4 max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2">Institutional Access Restricted</h2>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                No active operational modules are provisioned for your role (<strong>{currentUser?.role}</strong>). Please contact the College Super Administrator to assign functional module permissions to your account.
              </p>
              <button
                onClick={handleSignOut}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* VIEW 1: OVERVIEW DASHBOARD */}
        {activeTab === 'overview' && (
          <OverviewDashboard
            students={students}
            faculty={faculty}
            transactions={transactions}
            attendanceRecords={attendanceRecords}
            notices={notices}
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            availableCourses={availableCourses}
            onNavigateTab={(tab: string) => setActiveTab(tab)}
            onOpenPaymentModal={handleOpenPaymentModal}
            onPostNotice={handlePostNotice}
          />
        )}

        {/* LAZY LOADED SECONDARY & ADMINISTRATIVE MODULES PROTECTED BY ERROR BOUNDARY (Views 2-18) */}
        <ErrorBoundary key={activeTab}>
          <Suspense fallback={<ModuleLoadingSkeleton />}>
          {/* VIEW 2: STUDENT ATTENDANCE (Filtered by faculty tagging) */}
          {activeTab === 'attendance' && (
          <ProtectedRoute
            moduleKey="attendance"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Faculty Roll-Call Attendance Register"
          >
            <AttendanceModule
              students={students}
              faculty={faculty}
              attendanceRecords={attendanceRecords}
              facultyMappings={facultyMappings}
              timetable={timetable}
              courseSections={courseSections}
              currentRole={currentUser.role}
              currentUser={currentUser}
              onSaveAttendance={handleSaveAttendance}
              initialSubjectCode={activeSubjectFilter || undefined}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 3: FEE PAYMENTS & LEDGER & CAMPAIGNS & CONCESSIONS */}
        {activeTab === 'fees' && (
          <ProtectedRoute
            moduleKey="fees"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Accounts Fee Payments & Ledger"
          >
            <FeeModule
              students={students}
              transactions={transactions}
              feeHeads={feeHeads}
              feeCampaigns={feeCampaigns}
              concessionRules={concessionRules}
              enrollmentFields={enrollmentFields}
              currentUser={currentUser}
              streamCourseSubjects={streamCourseSubjects}
              reconciliationRecords={reconciliationRecords}
              onSaveReconciliationRecords={handleSaveReconciliationRecords}
              onProcessPayment={handleProcessPayment}
              onBatchUpdateStudents={handleBatchUpdateStudents}
              onSaveFeeHeads={handleSaveFeeHeads}
              onSaveFeeCampaigns={handleSaveFeeCampaigns}
              onExtendCampaign={handleExtendCampaignEndDate}
              onSaveConcessionRules={handleSaveConcessionRules}
              onPostNotice={handlePostNotice}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 4: GRADE MANAGEMENT (Filtered by faculty tagging) */}
        {activeTab === 'grades' && (
          <ProtectedRoute
            moduleKey="grades"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Examination Grade Management"
          >
            <GradeManagementModule
              students={students}
              grades={grades}
              facultyMappings={facultyMappings}
              currentRole={currentUser.role}
              currentUser={currentUser}
              gradeHeads={gradeHeads}
              resultDeclarations={resultDeclarations}
              onSaveGrade={handleSaveGrade}
              onSaveResultDeclarations={handleSaveResultDeclarations}
              onSyncResultDeclarations={setResultDeclarations}
              initialSubjectCode={activeSubjectFilter || undefined}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 5: FACULTY PORTAL */}
        {activeTab === 'faculty_portal' && (
          <ProtectedRoute
            moduleKey="faculty_portal"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Faculty Academic Portal"
          >
            <FacultyPortalModule
              facultyList={faculty}
              activeFacultyId={activeFacultyId}
              timetable={timetable}
              facultyMappings={facultyMappings}
              currentUser={currentUser}
              onNavigateToAttendance={(subjectCode) => {
                setActiveSubjectFilter(subjectCode);
                setActiveTab('attendance');
              }}
              onNavigateToGrades={(subjectCode) => {
                setActiveSubjectFilter(subjectCode);
                setActiveTab('grades');
              }}
              onPostNotice={handlePostNotice}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 6: STUDENT PORTAL */}
        {activeTab === 'student_portal' && (
          <ProtectedRoute
            moduleKey="student_portal"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Student Academic Portal"
          >
            <StudentPortalView
              student={currentStudent}
              grades={grades}
              transactions={transactions}
              attendanceRecords={attendanceRecords}
              enrollmentFields={enrollmentFields}
              congratulationMessages={congratulations}
              notices={notices}
              serviceTariffs={serviceTariffs}
              myRequests={serviceRequests.filter((r) => currentStudent && r.studentId === currentStudent.id)}
              onCreateServiceRequest={handleCreateServiceRequest}
              onPayDuesClick={handleOpenPaymentModal}
              onUpdateEnrollmentData={handleUpdateStudentEnrollmentData}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 7: CONGRATULATIONS & HONORS DASHBOARD */}
        {activeTab === 'congratulations' && (
          <ProtectedRoute
            moduleKey="congratulations"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Honors & Academic Accolades"
          >
            <CongratulationsModule
              messages={congratulations}
              students={students}
              currentUser={currentUser}
              currentRole={currentUser.role}
              onAddMessage={handleAddCongratulation}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 8: ENROLLMENT MODULE (Principal & Accountant) */}
        {activeTab === 'enrollment' && (
          <ProtectedRoute
            moduleKey="enrollment"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Student Enrollment & Dynamic Form Studio"
          >
            <EnrollmentModule
              fields={enrollmentFields}
              students={students}
              onSaveFields={handleSaveEnrollmentFields}
              onSaveStudents={handleBatchUpdateStudents}
              canEdit={['superadmin', 'principal', 'accountant'].includes(currentUser.role)}
              currentRole={currentUser.role}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 9: TEACHER MAPPING / CLASS TAGGING (Principal) */}
        {activeTab === 'teacher_mapping' && (
          <ProtectedRoute
            moduleKey="teacher_mapping"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Teacher Workload & Day-Wise Mapping"
          >
            <TeacherMappingView
              mappings={facultyMappings}
              facultyList={faculty}
              onSaveMappings={handleSaveFacultyMappings}
              canEdit={['superadmin', 'principal'].includes(currentUser.role)}
              streamCourseSubjects={streamCourseSubjects}
              timetable={timetable}
              onSaveTimetable={handleSaveTimetable}
              onSaveFaculty={handleSaveFaculty}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 10: COURSE & STREAM MAPPING (Accountant & Superadmin & Principal) */}
        {activeTab === 'stream_mapping' && (
          <ProtectedRoute
            moduleKey="stream_mapping"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Curriculum & Course Stream Mapping"
          >
            <StreamCourseMappingModule
              streamCourseSubjects={streamCourseSubjects}
              onSaveStreamCourseSubjects={handleSaveStreamCourseSubjects}
              currentUser={currentUser}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 11A: CBCS MARKSHEET THEME & GRADING RULES DESIGNER */}
        {activeTab === 'marksheet_designer' && (
          <ProtectedRoute
            moduleKey="marksheet_designer"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="CBCS Marksheet Theme & Grading Rules Designer"
          >
            <MarksheetDesignerModule
              marksheetConfig={marksheetConfig}
              onSaveMarksheetConfig={handleSaveMarksheetConfig}
              streamCourseSubjects={streamCourseSubjects}
              currentUser={currentUser}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 11B: CEREMONIAL & STATUTORY CERTIFICATE DESIGNER */}
        {activeTab === 'certificate_designer' && (
          <ProtectedRoute
            moduleKey="certificate_designer"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Ceremonial & Statutory Certificate Theme Designer"
          >
            <CertificateDesignerModule
              certificateConfig={certificateConfig}
              streamCourseSubjects={streamCourseSubjects}
              onSaveCertificateConfig={handleSaveCertificateConfig}
              currentUser={currentUser}
              students={students}
              collegeProfile={collegeProfile}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 12: STUDENT PROMOTION (Principal & Superadmin) */}
        {activeTab === 'student_promotion' && (
          <ProtectedRoute
            moduleKey="student_promotion"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Student Cohort Promotion Engine"
          >
            <StudentPromotionModule
              students={students}
              streamCourseSubjects={streamCourseSubjects}
              promotionAuditRecords={promotionAuditRecords}
              onPromoteStudents={handlePromoteStudents}
              onRevertPromotionRecord={handleRevertPromotionRecord}
              currentUser={currentUser}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 13: 3-WAY FINANCIAL RECONCILIATION ENGINE (Accountant) */}
        {activeTab === 'reconciliation_3way' && (
          <ProtectedRoute
            moduleKey="reconciliation_3way"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="3-Way Financial Reconciliation Engine"
          >
            <ReconciliationModule
              records={reconciliationRecords}
              onSaveRecords={handleSaveReconciliationRecords}
              currentUser={currentUser}
              erpTransactions={transactions}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 14: ACCOUNTANT STUDENT REQUESTS DESK & TARIFF CATALOG */}
        {activeTab === 'accountant_requests' && (
          <ProtectedRoute
            moduleKey="accountant_requests"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Student Service Requests Desk"
          >
            <AccountantRequestsModule
              serviceTariffs={serviceTariffs}
              serviceRequests={serviceRequests}
              onUpdateRequestStatus={(id, status, issuedBy, remarks) => {
                if (!currentUser || !canUserAccessModule(currentUser, 'accountant_requests', modulePermissions)) {
                  throw new Error('Access denied: Authorization required to update service requests.');
                }
                const targetReq = erpStorage.getServiceRequests().find((r) => r.id === id);
                if (targetReq && isSelfApprovalConflict(currentUser, targetReq)) {
                  throw new Error('Separation of Duties Violation: Staff cannot modify or approve their own service requests.');
                }
                erpStorage.updateServiceRequestStatus(id, status, issuedBy, remarks);
                setServiceRequests(erpStorage.getServiceRequests());
              }}
              onSaveServiceTariff={(tariff) => {
                if (!currentUser || !canUserAccessModule(currentUser, 'accountant_requests', modulePermissions)) {
                  throw new Error('Access denied: Authorization required to modify service tariff schedules.');
                }
                const freshTariffs = erpStorage.getServiceTariffs();
                const updated = freshTariffs.some((t) => t.id === tariff.id)
                  ? freshTariffs.map((t) => (t.id === tariff.id ? tariff : t))
                  : [tariff, ...freshTariffs];
                erpStorage.saveServiceTariffs(updated);
                setServiceTariffs(updated);
              }}
              onToggleServiceTariffStatus={(id) => {
                if (!currentUser || !canUserAccessModule(currentUser, 'accountant_requests', modulePermissions)) {
                  throw new Error('Access denied: Authorization required to toggle service tariff status.');
                }
                const freshTariffs = erpStorage.getServiceTariffs();
                const updated = freshTariffs.map((t) => {
                  if (t.id === id) {
                    const nextStatus: ServiceTariff['status'] = t.status === 'active' ? 'suspended' : 'active';
                    return { ...t, status: nextStatus };
                  }
                  return t;
                });
                erpStorage.saveServiceTariffs(updated);
                setServiceTariffs(updated);
              }}
              maxServiceFeeLimit={systemSettings.maxServiceTariffFee || 100000}
              onCompleteRequest={handleCompleteServiceRequest}
              onPurgeExpiredRequests={handlePurgeExpiredServiceRequests}
              currentUser={currentUser}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 15: INSTITUTIONAL PARAMETERIZED REPORTS & CENSUS */}
        {activeTab === 'reports' && (
          <ProtectedRoute
            moduleKey="reports"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Institutional Parameterized Reports & Census"
          >
            <InstitutionalReportsModule
              currentRole={currentUser.role}
              students={students}
              availableCourses={availableCourses}
              reportDefinitions={reportDefinitions}
              reportParameters={reportParameters}
              onSaveReportDefinitions={handleSaveReportDefinitions}
              onSaveReportParameters={handleSaveReportParameters}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 16: ROLE & MENU PERMISSION MATRIX (ADMIN) */}
        {activeTab === 'role_permissions' && (
          <ProtectedRoute
            moduleKey="role_permissions"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Role & Menu Permission Matrix"
          >
            <RolePermissionMatrixModule
              currentPermissions={modulePermissions}
              onSavePermissions={handleSaveModulePermissions}
              allUsers={sanitizedUsers}
              onToggleUserGatewayReconciliation={handleToggleUserGatewayReconciliation}
              customRoles={customRoles}
              onCreateCustomRole={handleCreateCustomRole}
              onDeleteCustomRole={handleDeleteCustomRole}
              onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 17: GATEWAY & INSTITUTIONAL SETTINGS (ADMIN) */}
        {activeTab === 'admin_settings' && (
          <ProtectedRoute
            moduleKey="admin_settings"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Gateway & Institutional Settings"
          >
            <AdminSettingsModule
              settings={systemSettings}
              onSaveSettings={handleSaveSystemSettings}
              courseSections={courseSections}
              onSaveCourseSections={handleSaveCourseSections}
              students={students}
              onBatchUpdateStudents={handleBatchUpdateStudents}
              availableCourses={availableCourses}
              gradeHeads={gradeHeads}
              onSaveGradeHeads={handleSaveGradeHeads}
              resultDeclarations={resultDeclarations}
              onSaveResultDeclarations={handleSaveResultDeclarations}
            />
          </ProtectedRoute>
        )}

        {/* VIEW 18: GRADE SETTING (ACCOUNTANT, PRINCIPAL, ADMIN) */}
        {activeTab === 'grade_settings' && (
          <ProtectedRoute
            moduleKey="grade_settings"
            currentUser={currentUser}
            modulePermissions={modulePermissions}
            onAccessDenied={() => setActiveTab('overview')}
            title="Academic Grade Setting & Examination Governance"
          >
            <GradeSettingsModule
              currentRole={currentUser.role}
              currentUser={currentUser}
              gradeHeads={gradeHeads}
              onSaveGradeHeads={handleSaveGradeHeads}
              resultDeclarations={resultDeclarations}
              onSaveResultDeclarations={handleSaveResultDeclarations}
              availableCourses={availableCourses}
              onRefreshAcademicState={refreshState}
            />
          </ProtectedRoute>
        )}
        </Suspense>
        </ErrorBoundary>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center space-x-2 text-white font-bold mb-2">
              <GraduationCap className="w-5 h-5 text-indigo-400" />
              <span>{collegeProfile.name}</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              {collegeProfile.address}
            </p>
            <p className="text-slate-500 text-xs mt-2">
              {collegeProfile.affiliation}
            </p>
          </div>

          <div>
            <span className="font-bold text-white uppercase tracking-wider text-xs block mb-2">
              Statutory Accreditation & Governance
            </span>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                NAAC Accredited {collegeProfile.naacGrade}
              </li>
              <li className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                Established: {collegeProfile.establishmentDate} • Commencement: {collegeProfile.commencementDate}
              </li>
              <li className="flex items-center gap-1.5 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Autonomous Institutional Governance • State Affiliated</span>
              </li>
            </ul>
          </div>

          <div>
            <span className="font-bold text-white uppercase tracking-wider text-xs block mb-2">
              Administrative Desk & Support
            </span>
            <p className="text-xs flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {collegeProfile.contactEmail}
            </p>
            <p className="text-xs flex items-center gap-1.5 mb-2">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {collegeProfile.contactPhone}
            </p>
            <p className="text-xs text-slate-500">
              © {currentYear} {collegeProfile.shortName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* LAZY LOADED ADMINISTRATIVE & SUPPORT MODALS */}
      <Suspense fallback={null}>
        {/* SUPER ADMIN: COLLEGE PROFILE MODAL */}
        {isCollegeProfileModalOpen && (
          <CollegeProfileModal
            isOpen={isCollegeProfileModalOpen}
            onClose={() => setIsCollegeProfileModalOpen(false)}
            profile={collegeProfile}
            onSaveProfile={handleSaveCollegeProfile}
          />
        )}

        {/* STAFF ONBOARDING (Super Admin & Principal) */}
        {isUserManagementModalOpen && (
          <UserManagementModal
            isOpen={isUserManagementModalOpen}
            onClose={() => setIsUserManagementModalOpen(false)}
            currentUser={currentUser}
            allUsers={sanitizedUsers}
            customRoles={customRoles}
            onOnboardUser={handleOnboardUser}
            onToggleUserGatewayReconciliation={handleToggleUserGatewayReconciliation}
            onToggleServiceRequestProcessor={handleToggleServiceRequestProcessor}
          />
        )}

        {/* SUPER ADMIN: MODULE PERMISSIONS MODAL */}
        {isModulePermissionsModalOpen && (
          <ModulePermissionsModal
            isOpen={isModulePermissionsModalOpen}
            onClose={() => setIsModulePermissionsModalOpen(false)}
            permissions={modulePermissions}
            onSavePermissions={handleSaveModulePermissions}
          />
        )}

        {/* HELPDESK & GRIEVANCE REDRESSAL MODAL */}
        {isHelpdeskOpen && (
          <HelpdeskModal
            isOpen={isHelpdeskOpen}
            onClose={() => setIsHelpdeskOpen(false)}
            tickets={tickets}
            currentRole={currentUser.role}
            currentUser={currentUser}
            currentStudent={currentStudent}
            onSubmitTicket={handleSubmitTicket}
            onResolveTicket={handleResolveTicket}
          />
        )}
      </Suspense>

      {/* SYSTEM HEALTH & INTEGRITY DIAGNOSTICS PROBER (Super Admin & Principal) */}
      {isSystemHealthModalOpen && (
        <SystemHealthModal
          isOpen={isSystemHealthModalOpen}
          onClose={() => setIsSystemHealthModalOpen(false)}
          students={students}
          faculty={faculty}
          transactions={transactions}
          timetable={timetable}
          allUsers={sanitizedUsers}
          courseSections={courseSections}
          gradeHeads={gradeHeads}
          tickets={tickets}
          reconciliationRecords={reconciliationRecords}
          feeCampaigns={feeCampaigns}
          tariffs={serviceTariffs}
          onRefreshState={refreshState}
          onAutoFixLedgers={(repaired) => {
            erpStorage.saveStudents(repaired);
            setStudents(repaired);
          }}
          onAutoFixTickets={(repaired) => {
            erpStorage.saveTickets(repaired);
            setTickets(repaired);
          }}
          onAutoFixSections={(repaired) => {
            erpStorage.saveStudents(repaired);
            setStudents(repaired);
          }}
          onAutoFixDuplicateRolls={(repaired) => {
            erpStorage.saveStudents(repaired);
            setStudents(repaired);
          }}
          onAutoFixNegativeFees={(repaired) => {
            erpStorage.saveStudents(repaired);
            setStudents(repaired);
          }}
        />
      )}

      {/* CONFIRMATION MODAL: RESET DEMO DATABASE */}
      {showResetConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-demo-db-title"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 id="reset-demo-db-title" className="text-lg font-bold text-white mb-2">Reset ERP Demo Database?</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              This will restore all records, fee ledgers, attendance registers, and marksheets back to the default institutional seed. Any newly added local records will be erased.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg transition"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCESSIBLE TOAST STACK & FOCUS-TRAPPED CONFIRMATION DIALOG */}
      <ToastAndConfirmDialog />
    </div>
  );
}
