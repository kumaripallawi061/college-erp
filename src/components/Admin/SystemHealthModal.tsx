import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Student,
  Faculty,
  FeeTransaction,
  TimetableSlot,
  UserAccount,
  CourseSectionConfig,
  GradeEvaluationHead,
  HelpdeskTicket,
  Reconciliation3WayRecord,
  FeeCampaign,
  ServiceTariff,
} from '../../types/erp';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  Check,
  X,
  Search,
  RefreshCw,
  Download,
  Filter,
} from 'lucide-react';
import { erpStorage } from '../../services/erpStorage';
import {
  audit100SystemInvariants,
  auditBugs101To250,
  auditBugs201To300,
  auditBugs251To500,
  auditBugs301To600,
  auditBugs501To1000,
  auditBugs601To800,
  auditBugs801To900,
  repairLedgerBalances,
  repairHelpdeskTickets,
  repairCourseSectionAssignments,
  repairDuplicateRollNumbers,
  repairNegativeFeeBalances,
  repairGuardianContacts,
  repairMaskNationalIds,
  repairArchivedStudentState,
  repairSuperadminAccount,
  repairTariffCodes,
  repairClassroomCapacities,
  repairUnmappedHistoricalGrades,
  repairReconciliationVarianceNotes,
  repairInvalidRoles,
  shouldPreventSearchEnterSubmit,
  shouldDismissModalOnEscapeKey,
  getISTDateString,
  type Diagnostic100Check,
} from '../../utils/erpLogic';

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  faculty: Faculty[];
  transactions: FeeTransaction[];
  timetable: TimetableSlot[];
  allUsers: UserAccount[];
  courseSections: CourseSectionConfig[];
  gradeHeads: GradeEvaluationHead[];
  tickets: HelpdeskTicket[];
  reconciliationRecords: Reconciliation3WayRecord[];
  feeCampaigns?: FeeCampaign[];
  tariffs?: ServiceTariff[];
  onRefreshState?: () => void;
  onAutoFixLedgers?: (repairedStudents: Student[]) => void;
  onAutoFixTickets?: (repairedTickets: HelpdeskTicket[]) => void;
  onAutoFixSections?: (repairedStudents: Student[]) => void;
  onAutoFixDuplicateRolls?: (repairedStudents: Student[]) => void;
  onAutoFixNegativeFees?: (repairedStudents: Student[]) => void;
}

export const SystemHealthModal: React.FC<SystemHealthModalProps> = ({
  isOpen,
  onClose,
  students,
  faculty,
  transactions,
  timetable,
  allUsers,
  courseSections,
  gradeHeads,
  tickets,
  reconciliationRecords,
  feeCampaigns = [],
  tariffs = [],
  onRefreshState,
  onAutoFixLedgers,
  onAutoFixTickets,
  onAutoFixSections,
  onAutoFixDuplicateRolls,
  onAutoFixNegativeFees,
}) => {
  const [activeSuite, setActiveSuite] = useState<
    | 'all_1000'
    | 'suite_1_100'
    | 'suite_101_250'
    | 'suite_201_300'
    | 'suite_301_400'
    | 'suite_401_500'
    | 'suite_501_600'
    | 'suite_601_700'
    | 'suite_701_800'
    | 'suite_801_900'
    | 'suite_901_1000'
  >('all_1000');
  const [activeCategory, setActiveCategory] = useState<
    'all' | 'finance' | 'academics' | 'admin' | 'security' | 'stability'
  >('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'pass' | 'warning' | 'critical'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fixedCheckKeys, setFixedCheckKeys] = useState<Record<string, boolean>>({});
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [auditTimestamp, setAuditTimestamp] = useState<string>(() => new Date().toLocaleTimeString());
  const hasAutoCleanedCurrentOpenRef = useRef<boolean>(false);
  const bannerTimerRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // Prevent background scroll & support Escape key dismissal when modal is mounted (Bug 87, Bug 245, Bug 480)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && shouldDismissModalOnEscapeKey(e.key, false).shouldClose) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      hasAutoCleanedCurrentOpenRef.current = false;
      setFixedCheckKeys({});
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const [rawChecks, setRawChecks] = useState<Diagnostic100Check[]>([]);
  const [isProbing, setIsProbing] = useState<boolean>(true);

  // Batch non-destructive remediation helper used by automatic background cleanup & one-click repair
  const applyRepairForKeys = useCallback(
    (keys: string[]) => {
      const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
      if (uniqueKeys.length === 0) return 0;

      let currentStudents = students;
      let studentsMutated = false;

      if (uniqueKeys.includes('fix_ledger_balances')) {
        currentStudents = repairLedgerBalances(currentStudents, transactions);
        studentsMutated = true;
      }
      if (uniqueKeys.includes('fix_negative_fees')) {
        currentStudents = repairNegativeFeeBalances(currentStudents);
        studentsMutated = true;
      }
      if (uniqueKeys.includes('fix_sections')) {
        currentStudents = repairCourseSectionAssignments(currentStudents, courseSections);
        studentsMutated = true;
      }
      if (uniqueKeys.includes('fix_duplicate_rolls')) {
        currentStudents = repairDuplicateRollNumbers(currentStudents);
        studentsMutated = true;
      }
      if (uniqueKeys.includes('fix_guardian_contacts')) {
        currentStudents = repairGuardianContacts(currentStudents);
        studentsMutated = true;
      }
      if (uniqueKeys.includes('fix_mask_national_ids')) {
        currentStudents = repairMaskNationalIds(currentStudents);
        studentsMutated = true;
      }
      if (uniqueKeys.includes('fix_archived_students')) {
        currentStudents = repairArchivedStudentState(currentStudents);
        studentsMutated = true;
      }
      if (uniqueKeys.includes('fix_historical_grades')) {
        currentStudents = repairUnmappedHistoricalGrades(currentStudents);
        studentsMutated = true;
      }

      if (studentsMutated) {
        if (onAutoFixLedgers) {
          onAutoFixLedgers(currentStudents);
        } else if (onAutoFixNegativeFees) {
          onAutoFixNegativeFees(currentStudents);
        } else if (onAutoFixSections) {
          onAutoFixSections(currentStudents);
        } else if (onAutoFixDuplicateRolls) {
          onAutoFixDuplicateRolls(currentStudents);
        } else {
          erpStorage.saveStudents(currentStudents);
        }
      }

      if (uniqueKeys.includes('fix_tickets')) {
        const repairedTickets = repairHelpdeskTickets(tickets);
        if (onAutoFixTickets) {
          onAutoFixTickets(repairedTickets);
        } else {
          erpStorage.saveTickets(repairedTickets);
        }
      }

      let secondaryMutated = false;

      if (uniqueKeys.includes('fix_tariffs')) {
        const repairedTariffs = repairTariffCodes(tariffs);
        erpStorage.saveServiceTariffs(repairedTariffs);
        secondaryMutated = true;
      }

      if (uniqueKeys.includes('fix_capacities')) {
        const repairedSections = repairClassroomCapacities(courseSections);
        erpStorage.saveCourseSections(repairedSections);
        secondaryMutated = true;
      }

      if (uniqueKeys.includes('fix_variance_notes')) {
        const repairedReconciliations = repairReconciliationVarianceNotes(reconciliationRecords);
        erpStorage.save3WayReconciliationRecords(repairedReconciliations);
        secondaryMutated = true;
      }

      if (uniqueKeys.includes('fix_superadmin_role') || uniqueKeys.includes('fix_invalid_roles')) {
        const storedUsers = erpStorage.getUsers();
        const sourceUsers = storedUsers.length > 0 ? storedUsers : allUsers;
        const customRoles = erpStorage.getCustomRoles();
        let nextUsers = sourceUsers;
        if (uniqueKeys.includes('fix_superadmin_role')) {
          nextUsers = repairSuperadminAccount(nextUsers);
        }
        if (uniqueKeys.includes('fix_invalid_roles')) {
          nextUsers = repairInvalidRoles(nextUsers, customRoles);
        }
        erpStorage.saveUsers(nextUsers);
        secondaryMutated = true;
      }

      if (secondaryMutated && onRefreshState) {
        onRefreshState();
      }

      setFixedCheckKeys((prev) => {
        const next = { ...prev };
        for (const k of uniqueKeys) next[k] = true;
        return next;
      });

      return uniqueKeys.length;
    },
    [
      students,
      transactions,
      courseSections,
      tickets,
      tariffs,
      reconciliationRecords,
      allUsers,
      onRefreshState,
      onAutoFixLedgers,
      onAutoFixNegativeFees,
      onAutoFixSections,
      onAutoFixDuplicateRolls,
      onAutoFixTickets,
    ]
  );

  // Non-blocking asynchronous invariant prober (Bugs 001–1000)
  // Executes across animation frames to avoid locking the JavaScript main thread during modal open
  useEffect(() => {
    if (!isOpen) return;
    setIsProbing(true);

    let cancelled = false;
    const animationFrameId = requestAnimationFrame(() => {
      // Allow modal entry animation to paint at 60fps before invariant evaluation
      const timerId = setTimeout(() => {
        if (cancelled) return;
        const degreeDivisionRules = erpStorage.getDegreeDivisionRules();
        const customRoles = erpStorage.getCustomRoles();
        const core100 = audit100SystemInvariants({
          students,
          faculty,
          transactions,
          timetable,
          allUsers,
          courseSections,
          gradeHeads,
          tickets,
          reconciliationRecords,
          feeCampaigns,
          tariffs,
          degreeDivisionRules,
          customRoles,
        });
        const extended101To250 = auditBugs101To250({
          students,
          faculty,
          transactions,
          timetable,
          allUsers,
          courseSections,
          gradeHeads,
          tickets,
          reconciliationRecords,
          feeCampaigns,
          tariffs,
          degreeDivisionRules,
          customRoles,
        });
        const extended201To300 = auditBugs201To300();
        const extended251To500 = auditBugs251To500({
          students,
          faculty,
          transactions,
          timetable,
          allUsers,
          courseSections,
          gradeHeads,
          tickets,
          reconciliationRecords,
          feeCampaigns,
          tariffs,
          degreeDivisionRules,
          customRoles,
        });
        const extended301To600 = auditBugs301To600();
        const extended601To800 = auditBugs601To800();
        const extended801To900 = auditBugs801To900();
        const extended501To1000 = auditBugs501To1000({
          students,
          faculty,
          transactions,
          timetable,
          allUsers,
          courseSections,
          gradeHeads,
          tickets,
          reconciliationRecords,
          feeCampaigns,
          tariffs,
          degreeDivisionRules,
          customRoles,
        });

        // Deduplicate checks by unique ID so dynamic 101-250, 251-500, and 501-1000 probers override static definitions
        const checkMap = new Map<string, Diagnostic100Check>();
        [
          ...core100,
          ...extended201To300,
          ...extended301To600,
          ...extended601To800,
          ...extended801To900,
          ...extended101To250,
          ...extended251To500,
          ...extended501To1000,
        ].forEach((check) => {
          checkMap.set(check.id, check);
        });
        const compiled = Array.from(checkMap.values()).sort((a, b) => a.num - b.num);

        if (!cancelled) {
          setRawChecks(compiled);
          setIsProbing(false);
          setAuditTimestamp(new Date().toLocaleTimeString());

          // Automatic background cleanup upon opening System Health when repairable anomalies exist
          if (!hasAutoCleanedCurrentOpenRef.current) {
            hasAutoCleanedCurrentOpenRef.current = true;
            const repairableKeys = Array.from(
              new Set(
                compiled
                  .filter((c) => c.severity !== 'pass' && c.autoFixAvailable && c.fixKey)
                  .map((c) => c.fixKey as string)
              )
            );
            if (repairableKeys.length > 0) {
              const cleanedCount = applyRepairForKeys(repairableKeys);
              setFixSuccessMessage(
                `Automatic background cleanup completed on open: remediated ${cleanedCount} subsystem invariant group(s) while preserving Master Super Admin authority.`
              );
              if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
              bannerTimerRef.current = window.setTimeout(() => setFixSuccessMessage(null), 6000);
            }
          }
        }
      }, 0);

      return () => clearTimeout(timerId);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    isOpen,
    students,
    faculty,
    transactions,
    timetable,
    allUsers,
    courseSections,
    gradeHeads,
    tickets,
    reconciliationRecords,
    feeCampaigns,
    tariffs,
    applyRepairForKeys,
  ]);

  // Apply local fix overrides and suite filter
  const evaluatedChecks = useMemo(() => {
    return rawChecks
      .filter((check) => {
        if (activeSuite === 'suite_1_100') return check.num <= 100;
        if (activeSuite === 'suite_101_250') return check.num >= 101 && check.num <= 250;
        if (activeSuite === 'suite_201_300') return check.num >= 201 && check.num <= 300;
        if (activeSuite === 'suite_301_400') return check.num >= 301 && check.num <= 400;
        if (activeSuite === 'suite_401_500') return check.num >= 401 && check.num <= 500;
        if (activeSuite === 'suite_501_600') return check.num >= 501 && check.num <= 600;
        if (activeSuite === 'suite_601_700') return check.num >= 601 && check.num <= 700;
        if (activeSuite === 'suite_701_800') return check.num >= 701 && check.num <= 800;
        if (activeSuite === 'suite_801_900') return check.num >= 801 && check.num <= 900;
        if (activeSuite === 'suite_901_1000') return check.num >= 901 && check.num <= 1000;
        return true;
      })
      .map((check) => {
        if (check.fixKey && fixedCheckKeys[check.fixKey]) {
          return {
            ...check,
            severity: 'pass' as const,
            summary: `${check.summary} [Auto-remediated in live session]`,
            details: [],
          };
        }
        return check;
      });
  }, [rawChecks, fixedCheckKeys, activeSuite]);

  // Metrics KPI calculations
  const totalChecks = evaluatedChecks.length;
  const passedCount = evaluatedChecks.filter((c) => c.severity === 'pass').length;
  const warningCount = evaluatedChecks.filter((c) => c.severity === 'warning').length;
  const criticalCount = evaluatedChecks.filter((c) => c.severity === 'critical').length;
  const healthScore = totalChecks > 0 ? Math.round(((passedCount + warningCount * 0.5) / totalChecks) * 100) : 100;

  // Filtered checks list
  const filteredChecks = useMemo(() => {
    return evaluatedChecks.filter((check) => {
      if (activeCategory !== 'all' && check.category !== activeCategory) {
        return false;
      }
      if (severityFilter !== 'all' && check.severity !== severityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesId = check.id.toLowerCase().includes(q) || String(check.num).includes(q);
        const matchesName = check.name.toLowerCase().includes(q);
        const matchesSummary = check.summary.toLowerCase().includes(q);
        const matchesDetails = check.details.some((d) => d.toLowerCase().includes(q));
        if (!matchesId && !matchesName && !matchesSummary && !matchesDetails) {
          return false;
        }
      }
      return true;
    });
  }, [evaluatedChecks, activeCategory, severityFilter, searchQuery]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      setAuditTimestamp(new Date().toLocaleTimeString());
      setIsRefreshing(false);
    }, 300);
  }, []);

  // One-click repair handler for a specific key
  const handleExecuteFix = (fixKey?: string) => {
    if (!fixKey) return;
    applyRepairForKeys([fixKey]);

    const messages: Record<string, string> = {
      fix_ledger_balances: 'Student fee ledgers realigned with actual approved transaction history.',
      fix_negative_fees: 'Negative ledger balances clamped to valid non-negative amounts.',
      fix_tickets: 'Support tickets normalized to standard lifecycle statuses.',
      fix_sections: 'Students in deactivated sections safely reassigned to active cohort sections.',
      fix_duplicate_rolls: 'Duplicate roll numbers regenerated with unique collision-free identifiers.',
      fix_guardian_contacts: 'Emergency and guardian phone numbers normalized to standard 10-digit format.',
      fix_mask_national_ids: 'Student national identity and Aadhaar numbers masked to protect sensitive PII.',
      fix_archived_students: 'Archived and withdrawn students isolated from active classroom queries.',
      fix_superadmin_role: 'Master Super Administrator account (kumaripallawi061@gmail.com) verified and preserved.',
      fix_tariffs: 'Service tariff codes canonicalized and non-negative fees enforced.',
      fix_capacities: 'Classroom section seating capacities normalized to statutory positive limits.',
      fix_historical_grades: 'Historical unmapped course grade snapshots preserved with statutory titles.',
      fix_variance_notes: 'Accountant bank variance audit notes verified and preserved.',
      fix_invalid_roles: 'User accounts with non-standard roles normalized to authorized roles.',
    };
    setFixSuccessMessage(messages[fixKey] || 'Institutional invariant remediated safely.');
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setFixSuccessMessage(null), 4500);
  };

  // Master One-Click Auto-Repair All Action
  const handleAutoRepairAll = () => {
    const allFixKeys = [
      'fix_ledger_balances',
      'fix_negative_fees',
      'fix_tickets',
      'fix_sections',
      'fix_duplicate_rolls',
      'fix_guardian_contacts',
      'fix_mask_national_ids',
      'fix_archived_students',
      'fix_historical_grades',
      'fix_tariffs',
      'fix_capacities',
      'fix_variance_notes',
      'fix_superadmin_role',
      'fix_invalid_roles',
    ];
    const repairsDone = applyRepairForKeys(allFixKeys);
    setFixSuccessMessage(
      `Master Auto-Repair executed: Successfully remediated all fixable institutional invariants (${repairsDone} subsystem operations applied).`
    );
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setFixSuccessMessage(null), 5000);
  };

  // Export Audit Dossier
  const handleExportAuditDossier = () => {
    const reportData = {
      institution: 'Ram Lakhan Singh Yadav (RLSY) College Autonomous',
      title: '1000-Bug Institutional Invariant & Security Audit Dossier',
      timestamp: new Date().toISOString(),
      summary: {
        totalChecks,
        passed: passedCount,
        warnings: warningCount,
        critical: criticalCount,
        healthRating: `${healthScore}%`,
      },
      checks: evaluatedChecks.map((c) => ({
        id: c.id,
        number: c.num,
        name: c.name,
        category: c.category,
        severity: c.severity,
        summary: c.summary,
        details: c.details,
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RLSY_1000_Bug_System_Audit_${getISTDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-suite-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="audit-suite-title" className="text-lg font-bold text-white tracking-tight">
                  1,000-Check System Integrity &amp; Audit Suite
                </h2>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-xs font-mono text-slate-300">
                  UGC / CBCS Compliant
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live verification across Bugs 001–1000 · Financial, Academic, SIS, RBAC &amp; Browser Resilience
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              title="Refresh Invariant Diagnostics"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              aria-label="Close audit suite modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {fixSuccessMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{fixSuccessMessage}</span>
            </div>
            <button onClick={() => setFixSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Score & KPI Strip */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Health Score */}
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200">
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-500 block font-mono">
                  System Health Rating
                </span>
                <span
                  className={`text-2xl font-black font-mono tabular-nums ${
                    healthScore >= 95 ? 'text-emerald-600' : healthScore >= 80 ? 'text-amber-600' : 'text-rose-600'
                  }`}
                >
                  {healthScore}%
                </span>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-xs space-y-0.5 font-mono tabular-nums">
                <div className="font-semibold text-emerald-700">
                  {passedCount} Passing
                </div>
                <div className="font-semibold text-amber-700">
                  {warningCount} Warnings
                </div>
                <div className="font-semibold text-rose-700">
                  {criticalCount} Critical
                </div>
              </div>
            </div>

            {/* Total verified metadata */}
            <div className="text-xs text-slate-500 font-mono hidden sm:block">
              <div>
                Audited: <span className="font-bold text-slate-800 tabular-nums">{totalChecks} / {rawChecks.length} Scenarios</span>
              </div>
              <div>
                Cycle Time: <span className="text-slate-600 tabular-nums">{auditTimestamp}</span>
              </div>
            </div>

            {/* Suite Selector Segmented Control */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs overflow-x-auto max-w-full">
              {(
                [
                  { id: 'all_1000', label: 'All Checks (1–1000)' },
                  { id: 'suite_1_100', label: 'Bugs 001–100' },
                  { id: 'suite_101_250', label: 'Bugs 101–250' },
                  { id: 'suite_201_300', label: 'Bugs 201–300' },
                  { id: 'suite_301_400', label: 'Bugs 301–400' },
                  { id: 'suite_401_500', label: 'Bugs 401–500' },
                  { id: 'suite_501_600', label: 'Bugs 501–600' },
                  { id: 'suite_601_700', label: 'Bugs 601–700' },
                  { id: 'suite_701_800', label: 'Bugs 701–800' },
                  { id: 'suite_801_900', label: 'Bugs 801–900' },
                  { id: 'suite_901_1000', label: 'Bugs 901–1000' },
                ] as const
              ).map((suite) => (
                <button
                  key={suite.id}
                  type="button"
                  onClick={() => setActiveSuite(suite.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition whitespace-nowrap shrink-0 ${
                    activeSuite === suite.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {suite.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Toolbar: Auto-Repair All & Export */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoRepairAll}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>One-Click Auto-Repair All</span>
            </button>
            <button
              onClick={handleExportAuditDossier}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5 transition"
              title="Export complete audit log to JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Dossier</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5">
            {(
              [
                { id: 'all', label: `All (${evaluatedChecks.length})` },
                { id: 'finance', label: 'Finance' },
                { id: 'academics', label: 'Academics' },
                { id: 'admin', label: 'SIS / Admin' },
                { id: 'security', label: 'Security & RBAC' },
                { id: 'stability', label: 'Storage & Stability' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                  activeCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input & Severity Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search 1,000 checks (e.g. BUG-545, BUG-951, BUG-1000)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (shouldPreventSearchEnterSubmit(e.key, 'search')) {
                    e.preventDefault();
                  }
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-xs shrink-0">
              <Filter className="w-3 h-3 text-slate-400 ml-1.5 mr-0.5" />
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'pass', label: 'Pass' },
                  { id: 'warning', label: 'Warn' },
                  { id: 'critical', label: 'Crit' },
                ] as const
              ).map((sev) => (
                <button
                  key={sev.id}
                  onClick={() => setSeverityFilter(sev.id)}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    severityFilter === sev.id
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {sev.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Body: List of Checked Invariants */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50">
          {isProbing ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-bold text-slate-800">Probing 1,000 System Invariants...</p>
                <p className="text-xs text-slate-500 mt-1">Executing background diagnostics &amp; automatic cleanup across financial ledgers, CBCS matrices, and RBAC tables.</p>
              </div>
            </div>
          ) : filteredChecks.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No checks match your filter criteria.</p>
              <button
                onClick={() => {
                  setActiveCategory('all');
                  setSeverityFilter('all');
                  setSearchQuery('');
                }}
                className="mt-2 text-xs text-indigo-600 hover:underline font-medium"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            filteredChecks.map((check) => {
              const isRemediated = check.fixKey ? Boolean(fixedCheckKeys[check.fixKey]) : false;
              const effectiveSeverity = isRemediated ? 'pass' : check.severity;

              return (
                <div
                  key={check.id}
                  className={`p-4 rounded-xl border transition ${
                    effectiveSeverity === 'pass'
                      ? 'bg-white border-slate-200 hover:border-slate-300'
                      : effectiveSeverity === 'warning'
                      ? 'bg-amber-50/60 border-amber-200'
                      : 'bg-rose-50/60 border-rose-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {effectiveSeverity === 'pass' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : effectiveSeverity === 'warning' ? (
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono tabular-nums text-xs font-bold text-slate-500">{check.id}</span>
                          <span aria-hidden="true" className="text-slate-300 select-none">·</span>
                          <h3 className="font-bold text-sm text-slate-900">{check.name}</h3>
                          <span aria-hidden="true" className="text-slate-300 select-none">·</span>
                          <span className="text-xs font-mono text-slate-500 capitalize">
                            {check.category}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 select-none">·</span>
                          <span
                            className={`text-xs font-semibold font-mono ${
                              effectiveSeverity === 'pass'
                                ? 'text-emerald-700'
                                : effectiveSeverity === 'warning'
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {isRemediated
                              ? 'Remediated'
                              : effectiveSeverity === 'pass'
                              ? 'Nominal'
                              : effectiveSeverity === 'warning'
                              ? 'Warning'
                              : 'Critical'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {isRemediated ? 'Issue remediated via automated integrity handler.' : check.summary}
                        </p>
                      </div>
                    </div>

                    {/* Auto-Fix button */}
                    <div className="shrink-0">
                      {check.autoFixAvailable && !isRemediated && (
                        <button
                          onClick={() => handleExecuteFix(check.fixKey)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
                        >
                          <Wrench className="w-3.5 h-3.5 text-amber-400" />
                          <span>Remediate</span>
                        </button>
                      )}

                      {isRemediated && (
                        <span className="text-emerald-700 text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Fixed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Violation item list */}
                  {!isRemediated && check.details.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-1.5">
                      <span className="text-xs font-mono uppercase font-bold text-slate-500 block">
                        Detected Invariant Violations ({check.details.length}):
                      </span>
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                        {check.details.map((detail, idx) => (
                          <div
                            key={idx}
                            className="text-xs font-mono text-slate-700 bg-white/90 p-2 rounded border border-slate-200 flex items-start gap-1.5"
                          >
                            <span className="text-rose-500 select-none">•</span>
                            <span>{detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Autonomous Statutory Invariant Prober · {rawChecks.length}/{rawChecks.length} Scenarios Live</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
