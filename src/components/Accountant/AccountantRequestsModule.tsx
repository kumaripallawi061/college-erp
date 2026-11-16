import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ServiceRequestItem, ServiceTariff, UserAccount } from '../../types/erp';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  Power,
  Search,
  Filter,
  DollarSign,
  Calendar,
  AlertCircle,
  UserCheck,
  Award,
  Archive,
  Trash2,
  Sparkles,
  X,
} from 'lucide-react';
import { Money } from '../Common/Rupee';
import {
  toPaisa,
  fromPaisa,
  paisaAdd,
  paisaSumSafe,
  generateSecureId,
  calculateServiceTariffTax,
  getISTDateString,
} from '../../utils/erpLogic';

interface AccountantRequestsModuleProps {
  serviceRequests: ServiceRequestItem[];
  serviceTariffs: ServiceTariff[];
  onUpdateRequestStatus: (
    id: string,
    status: ServiceRequestItem['status'],
    issuedBy?: string,
    remarks?: string
  ) => void;
  onSaveServiceTariff: (tariff: ServiceTariff) => void;
  onToggleServiceTariffStatus: (id: string) => void;
  onCompleteRequest?: (id: string, remarks?: string) => void;
  onPurgeExpiredRequests?: (days?: number) => { deletedCount: number; remaining: ServiceRequestItem[] };
  currentUser: UserAccount;
  maxServiceFeeLimit?: number;
}

// Normalize any requestDate format (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, YYYYMMDD) into YYYY-MM; returns '' if invalid/unparseable
export const extractAccountantRequestYearMonth = (rawDate?: string): string => {
  const trimmed = String(rawDate || '').trim();
  if (!trimmed) return '';
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})/);
  if (isoMatch) {
    const m = Number(isoMatch[2]);
    if (m >= 1 && m <= 12) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}`;
    }
    return '';
  }
  const undelimited = trimmed.match(/^(\d{4})(\d{2})/);
  if (undelimited) {
    const m = Number(undelimited[2]);
    if (m >= 1 && m <= 12) {
      return `${undelimited[1]}-${undelimited[2]}`;
    }
    return '';
  }
  const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const p1 = Number(dmy[1]);
    const p2 = Number(dmy[2]);
    const year = dmy[3];
    if (p2 >= 1 && p2 <= 12 && p1 >= 1 && p1 <= 31) {
      return `${year}-${String(p2).padStart(2, '0')}`;
    }
    if (p1 >= 1 && p1 <= 12 && p2 >= 1 && p2 <= 31) {
      return `${year}-${String(p1).padStart(2, '0')}`;
    }
    return '';
  }
  if (/^\d{4}$/.test(trimmed)) {
    return '';
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }
  return '';
};

export const AccountantRequestsModule: React.FC<AccountantRequestsModuleProps> = ({
  serviceRequests,
  serviceTariffs,
  onUpdateRequestStatus,
  onSaveServiceTariff,
  onToggleServiceTariffStatus,
  onCompleteRequest,
  onPurgeExpiredRequests,
  currentUser,
  maxServiceFeeLimit = 100000,
}) => {
  const [activePart, setActivePart] = useState<'requests' | 'archive' | 'services'>('requests');
  const [auditFeedback, setAuditFeedback] = useState<string | null>(null);
  const auditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const auditFeedbackIdRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  const effectiveFeeCeiling = maxServiceFeeLimit && maxServiceFeeLimit > 0 ? maxServiceFeeLimit : 100000;

  const sanitizeText = (txt?: string): string => {
    return String(txt || '').replace(/[<>]/g, '').trim();
  };

  const triggerAuditFeedback = (msg: string, durationMs: number = 5000) => {
    if (!isMountedRef.current) return;
    if (auditTimerRef.current) {
      clearTimeout(auditTimerRef.current);
      auditTimerRef.current = null;
    }
    const currentId = ++auditFeedbackIdRef.current;
    setAuditFeedback(msg);
    auditTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      if (auditFeedbackIdRef.current === currentId) {
        auditTimerRef.current = null;
        setAuditFeedback(null);
      }
    }, durationMs);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (auditTimerRef.current) {
        clearTimeout(auditTimerRef.current);
        auditTimerRef.current = null;
      }
    };
  }, []);

  // Clear pending audit feedback timer when switching tabs to prevent orphaned dismissal (Audit Bug 2.2)
  useEffect(() => {
    if (auditTimerRef.current) {
      clearTimeout(auditTimerRef.current);
      auditTimerRef.current = null;
    }
    setAuditFeedback(null);
  }, [activePart]);

  const extractYearMonth = extractAccountantRequestYearMonth;
  const { currentMonthStr, lastMonthStr, currentMonthLabel, lastMonthLabel } = useMemo(() => {
    const todayIst = getISTDateString();
    const [yrStr, moStr] = todayIst.split('-');
    const yearNum = Number(yrStr) || new Date().getFullYear();
    const monthNum = Number(moStr) || new Date().getMonth() + 1;
    const curStr = `${yearNum}-${String(monthNum).padStart(2, '0')}`;
    const lastDate = new Date(yearNum, monthNum - 2, 1);
    const lastStr = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
    const curDate = new Date(yearNum, monthNum - 1, 1);
    const curLabel = curDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    const lastLabel = lastDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    return {
      currentMonthStr: curStr,
      lastMonthStr: lastStr,
      currentMonthLabel: curLabel,
      lastMonthLabel: lastLabel,
    };
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<'ALL_RECENT' | 'CURRENT' | 'LAST'>('ALL_RECENT');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Tariff Modal State (Introduce or Modify service)
  const [isTariffModalOpen, setIsTariffModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<ServiceTariff | null>(null);
  const [tariffCode, setTariffCode] = useState('');
  const [tariffTitle, setTariffTitle] = useState('');
  const [tariffDescription, setTariffDescription] = useState('');
  const [tariffAmount, setTariffAmount] = useState<number | string>(150);
  const [tariffGst, setTariffGst] = useState<string>('0');
  const [tariffDays, setTariffDays] = useState<string>('2');
  const [tariffStatus, setTariffStatus] = useState<'active' | 'suspended'>('active');
  const [tariffModalError, setTariffModalError] = useState('');

  // Status prompt modal for rejection/remarks
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');

  // Coercion-safe helper for archived flag (Bug 137)
  const isRequestArchived = (val: unknown): boolean =>
    val === true || String(val ?? '').trim().toLowerCase() === 'true' || val === 1 || val === '1';

  // Separate active unarchived requests from archived requests
  const activeRequests = useMemo(() => {
    return serviceRequests.filter((r) => !isRequestArchived(r.archived));
  }, [serviceRequests]);

  const archivedRequests = useMemo(() => {
    return serviceRequests.filter((r) => isRequestArchived(r.archived));
  }, [serviceRequests]);

  // Filter active requests strictly to Current Month and Last Month only
  const recentRequests = useMemo(() => {
    return activeRequests.filter((r) => {
      const month = extractYearMonth(r.requestDate);
      return month === currentMonthStr || month === lastMonthStr;
    });
  }, [activeRequests, currentMonthStr, lastMonthStr]);

  const filteredRequests = useMemo(() => {
    return recentRequests.filter((r) => {
      const month = extractYearMonth(r.requestDate);
      const matchMonth =
        selectedMonth === 'ALL_RECENT' ||
        (selectedMonth === 'CURRENT' && month === currentMonthStr) ||
        (selectedMonth === 'LAST' && month === lastMonthStr);

      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;

      const q = String(searchQuery ?? '').toLowerCase();
      const matchSearch =
        searchQuery === '' ||
        String(r.studentName ?? '').toLowerCase().includes(q) ||
        String(r.studentRollNo ?? '').toLowerCase().includes(q) ||
        String(r.requestNo ?? '').toLowerCase().includes(q) ||
        String(r.serviceTitle ?? '').toLowerCase().includes(q);

      return matchMonth && matchStatus && matchSearch;
    });
  }, [recentRequests, selectedMonth, currentMonthStr, lastMonthStr, statusFilter, searchQuery]);

  // Stable Pagination State (immediately synchronized to eliminate momentary out-of-bounds empty table states)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));

  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  // Synchronize currentPage when filtered dataset shrinks or records are purged
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, filteredRequests.length, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, selectedMonth]);

  const paginatedRequests = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, safePage, pageSize]);

  // Filter for archived requests
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archivePage, setArchivePage] = useState(1);
  const filteredArchived = useMemo(() => {
    return archivedRequests.filter((r) => {
      if (!archiveSearch.trim()) return true;
      const q = String(archiveSearch ?? '').trim().toLowerCase();
      return (
        String(r.studentName ?? '').toLowerCase().includes(q) ||
        String(r.studentRollNo ?? '').toLowerCase().includes(q) ||
        String(r.requestNo ?? '').toLowerCase().includes(q) ||
        String(r.serviceTitle ?? '').toLowerCase().includes(q) ||
        String(r.certificateNumber ?? '').toLowerCase().includes(q)
      );
    });
  }, [archivedRequests, archiveSearch]);

  const totalArchivePages = Math.max(1, Math.ceil(filteredArchived.length / pageSize));
  const safeArchivePage = Math.min(Math.max(1, archivePage), totalArchivePages);

  useEffect(() => {
    if (archivePage > totalArchivePages) {
      setArchivePage(totalArchivePages);
    }
  }, [totalArchivePages, filteredArchived.length, archivePage]);

  useEffect(() => {
    setArchivePage(1);
  }, [archiveSearch]);

  const paginatedArchived = useMemo(() => {
    const start = (safeArchivePage - 1) * pageSize;
    return filteredArchived.slice(start, start + pageSize);
  }, [filteredArchived, safeArchivePage, pageSize]);

  // Run End-of-Month Audit Purge (uses ref-managed timer to prevent overlapping timeouts - Bug 102)
  const handleRunAuditCleanup = () => {
    if (onPurgeExpiredRequests) {
      const res = onPurgeExpiredRequests(90);
      triggerAuditFeedback(
        res.deletedCount > 0
          ? `End-of-Month Audit Complete: Successfully purged ${res.deletedCount} archived record(s) older than 3 calendar months (90 days).`
          : 'End-of-Month Audit Complete: All archived records are within the 3-month statutory retention window. Zero expired records.',
        5000
      );
    }
  };

  // Aggregate metrics using safe 64-bit BigInt paisa arithmetic (strictly completed/approved and paid requests - Bugs 37, 38)
  const totalServiceFeeCollected = useMemo(() => {
    const eligiblePaisa = recentRequests
      .filter((r) => {
        const pStat = String(r.paymentStatus || '').toLowerCase();
        const stat = String(r.status || '').toLowerCase();
        const isSettled =
          stat === 'completed' ||
          stat === 'issued' ||
          stat === 'approved' ||
          pStat === 'paid' ||
          pStat === 'success' ||
          pStat === 'completed';
        const isInvalid = stat === 'rejected' || pStat === 'failed';
        return isSettled && !isInvalid;
      })
      .map((r) => toPaisa(Number(r.amountPaid) || 0));
    return fromPaisa(paisaSumSafe(eligiblePaisa));
  }, [recentRequests]);

  const currentMonthCount = useMemo(() => {
    return recentRequests.filter((r) => extractYearMonth(r.requestDate) === currentMonthStr).length;
  }, [recentRequests, currentMonthStr]);

  const lastMonthCount = useMemo(() => {
    return recentRequests.filter((r) => extractYearMonth(r.requestDate) === lastMonthStr).length;
  }, [recentRequests, lastMonthStr]);

  const handleOpenAddTariff = () => {
    setEditingTariff(null);
    setTariffCode('');
    setTariffTitle('');
    setTariffDescription('');
    setTariffAmount('200');
    setTariffGst('0');
    setTariffDays('3');
    setTariffStatus('active');
    setTariffModalError('');
    setIsTariffModalOpen(true);
  };

  const handleOpenEditTariff = (tariff: ServiceTariff) => {
    setEditingTariff(tariff);
    setTariffCode(tariff.serviceCode || '');
    setTariffTitle(tariff.title || '');
    setTariffDescription(tariff.description || '');
    setTariffAmount(String(tariff.amount ?? 0));
    setTariffGst(String(tariff.gstPercentage ?? 0));
    const initialDays = tariff.deliveryDays !== undefined && !Number.isNaN(Number(tariff.deliveryDays))
      ? Math.max(0, Number(tariff.deliveryDays))
      : 0;
    setTariffDays(String(initialDays));
    setTariffStatus(tariff.status || 'active');
    setTariffModalError('');
    setIsTariffModalOpen(true);
  };

  const handleSaveTariffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTariffModalError('');
    if (!tariffTitle.trim() || !tariffCode.trim()) {
      const msg = 'Service Code and Title are required.';
      setTariffModalError(msg);
      triggerAuditFeedback(msg, 4000);
      return;
    }

    if (tariffDescription && tariffDescription.trim().length > 500) {
      const msg = 'Service description cannot exceed 500 characters.';
      setTariffModalError(msg);
      triggerAuditFeedback(msg, 4000);
      return;
    }

    const cleanCode = (tariffCode || '').trim().toUpperCase();
    const isDuplicate = serviceTariffs.some(
      (t) => (t.serviceCode || '').trim().toUpperCase() === cleanCode && t.id !== editingTariff?.id
    );
    if (isDuplicate) {
      const msg = `Service code "${cleanCode}" is already in use by another catalog service. Please use a unique code.`;
      setTariffModalError(msg);
      triggerAuditFeedback(msg, 4000);
      return;
    }

    const parsedDays = parseInt(String(tariffDays || '0'), 10);
    const safeDeliveryDays =
      !Number.isNaN(parsedDays) && parsedDays >= 0
        ? Math.min(90, Math.max(0, parsedDays))
        : 0;

    // Strip currency symbols (₹, $), tabs, non-breaking spaces and commas before validation (Bugs 34, 36)
    const rawAmtStr = String(tariffAmount ?? '').replace(/[\u20B9\u00A0$,\t₹\s]/g, '').replace(',', '.').trim();
    if (rawAmtStr === '') {
      const msg = 'Service fee amount is required. Enter 0 for gratis/free clearance.';
      setTariffModalError(msg);
      triggerAuditFeedback(msg, 4000);
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(rawAmtStr)) {
      const msg = 'Service fee amount must be a valid positive currency format with at most 2 decimal places (e.g. 150 or 150.50).';
      setTariffModalError(msg);
      triggerAuditFeedback(msg, 4000);
      return;
    }

    const parsedAmount = Number(rawAmtStr);
    if (Number.isNaN(parsedAmount) || !Number.isFinite(parsedAmount) || parsedAmount < 0 || parsedAmount > effectiveFeeCeiling) {
      const msg = `Service fee amount must be a valid number between ₹0 and ₹${effectiveFeeCeiling.toLocaleString('en-IN')} (Admin statutory ceiling).`;
      setTariffModalError(msg);
      triggerAuditFeedback(msg, 4000);
      return;
    }
    // Sub-unit integer conversion eliminates decimal floating-point drift (Bugs 17, 67, 177)
    const amountPaisa = toPaisa(parsedAmount);
    const ceilingPaisa = toPaisa(effectiveFeeCeiling);
    const clampedPaisa = Math.max(0, Math.min(amountPaisa, ceilingPaisa));
    const safeAmount = fromPaisa(clampedPaisa);

    const parsedGst = Math.min(28, Math.max(0, Number(tariffGst) || 0));

    const updated: ServiceTariff = {
      id: editingTariff ? editingTariff.id : generateSecureId('SRV'),
      serviceCode: cleanCode,
      title: tariffTitle.trim(),
      description: tariffDescription.trim(),
      amount: safeAmount,
      gstPercentage: parsedGst,
      deliveryDays: safeDeliveryDays,
      status: tariffStatus,
    };

    try {
      onSaveServiceTariff(updated);
      setIsTariffModalOpen(false);
      setTariffModalError('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to save service tariff. Verify staff permissions.';
      setTariffModalError(msg);
      triggerAuditFeedback(msg, 5000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
                <FileText className="w-6 h-6" />
              </span>
              <span className="text-xs uppercase font-mono tracking-widest text-emerald-300 font-bold">
                Accountant Service & Clearance Desk
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Student Service Requests & Tariff Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Two-part desk: Audit month-wise student certificate requests (current & last month) with fee payment
              verification, and introduce, modify, or suspend statutory collegiate services and requisite fees.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => {
                setActivePart('requests');
                setSearchQuery('');
                setArchiveSearch('');
                setStatusFilter('ALL');
                setSelectedMonth('ALL_RECENT');
                setCurrentPage(1);
                setArchivePage(1);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activePart === 'requests'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              Active Requests ({activeRequests.length})
            </button>
            <button
              onClick={() => {
                setActivePart('archive');
                setSearchQuery('');
                setArchiveSearch('');
                setStatusFilter('ALL');
                setSelectedMonth('ALL_RECENT');
                setCurrentPage(1);
                setArchivePage(1);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activePart === 'archive'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Archive className="w-4 h-4" />
              Archive & Audit ({archivedRequests.length})
            </button>
            <button
              onClick={() => {
                setActivePart('services');
                setSearchQuery('');
                setArchiveSearch('');
                setStatusFilter('ALL');
                setSelectedMonth('ALL_RECENT');
                setCurrentPage(1);
                setArchivePage(1);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activePart === 'services'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Award className="w-4 h-4" />
              Service Tariffs
            </button>
          </div>
        </div>
      </div>

      {/* PART 1: MONTH-WISE REQUESTS (CURRENT & LAST MONTH ONLY) */}
      {activePart === 'requests' && (
        <div className="space-y-6">
          {/* Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-bold text-slate-400 block font-mono">
                Current Month Requests
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {currentMonthCount}
              </span>
              <span className="text-xs text-slate-500 mt-0.5 block">{currentMonthLabel}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-bold text-slate-400 block font-mono">
                Last Month Requests
              </span>
              <span className="text-2xl font-black text-slate-700 mt-1 block">
                {lastMonthCount}
              </span>
              <span className="text-xs text-slate-500 mt-0.5 block">{lastMonthLabel}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-bold text-slate-400 block font-mono">
                Total Revenue Cleared
              </span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block font-mono tabular-nums">
                ₹{totalServiceFeeCollected.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-slate-500 mt-0.5 block">Online Requisite Receipts</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs uppercase font-bold text-slate-400 block font-mono">
                Active Catalog Services
              </span>
              <span className="text-2xl font-black text-indigo-600 mt-1 block">
                {serviceTariffs.filter((t) => t.status === 'active').length}
              </span>
              <span className="text-xs text-slate-500 mt-0.5 block">Open for student orders</span>
            </div>
          </div>

          {/* Month & Status Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-bold text-slate-500 flex items-center gap-1 mr-1">
                <Calendar className="w-3.5 h-3.5" /> Month:
              </span>
              {([
                { id: 'ALL_RECENT' as const, label: `Current + Last Month (${recentRequests.length})` },
                { id: 'CURRENT' as const, label: `Current (${currentMonthLabel}): ${currentMonthCount}` },
                { id: 'LAST' as const, label: `Last (${lastMonthLabel}): ${lastMonthCount}` },
              ] as const).map((m: { readonly id: 'ALL_RECENT' | 'CURRENT' | 'LAST'; readonly label: string }) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMonth(m.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    selectedMonth === m.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}

              <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block"></div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
              >
                <option value="ALL">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="In_Review">In Review</option>
                <option value="Approved">Approved</option>
                <option value="Issued">Issued</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student, roll, request #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">Request No & Date</th>
                    <th className="px-4 py-3.5">Candidate Details</th>
                    <th className="px-4 py-3.5">Service Requested</th>
                    <th className="px-4 py-3.5 text-right font-mono">Requisite Fee</th>
                    <th className="px-4 py-3.5">Payment Ref</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Accountant Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                        No service requests found for the selected month filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3.5">
                          <span className="font-mono font-bold text-indigo-950 block">{r.requestNo}</span>
                          <span className="text-xs text-slate-500 block">{r.requestDate}</span>
                          {r.certificateNumber && (
                            <span className="text-xs font-mono text-emerald-700 font-bold block mt-0.5">
                              Doc: {r.certificateNumber}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-slate-900 block">{r.studentName}</span>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono font-bold text-slate-700">{r.studentRollNo}</span>
                            <span>·</span>
                            <span>Sem {r.studentSemester}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 max-w-[200px] sm:max-w-xs">
                          <span className="font-semibold text-slate-900 block truncate" title={r.serviceTitle || 'Archived Institutional Service'}>
                            {r.serviceTitle || 'Archived Institutional Service'}
                          </span>
                          {r.remarks && (
                            <span className="text-xs text-slate-400 italic block mt-0.5 truncate max-w-xs" title={sanitizeText(r.remarks)}>
                              {sanitizeText(r.remarks)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-black text-slate-900 tabular-nums">
                          ₹{(Number(r.amountPaid) || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs text-emerald-800 font-bold block">
                            {r.transactionRef}
                          </span>
                          <span className="text-xs text-emerald-600 block">
                            {Number(r.amountPaid) === 0 ? '✓ Gratis Clearance' : '✓ Cleared'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {r.status === 'Issued' ? (
                            <span className="text-emerald-700 font-bold text-xs inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Issued
                            </span>
                          ) : r.status === 'Approved' ? (
                            <span className="text-indigo-700 font-bold text-xs inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                              Approved
                            </span>
                          ) : r.status === 'In_Review' ? (
                            <span className="text-amber-700 font-bold text-xs inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                              In Review
                            </span>
                          ) : r.status === 'Rejected' ? (
                            <span className="text-rose-700 font-bold text-xs inline-flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5 text-rose-500" />
                              Rejected
                            </span>
                          ) : (
                            <span className="text-slate-700 font-bold text-xs">Submitted</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                          {r.status !== 'Rejected' && r.status !== 'Issued' && (
                            <button
                              onClick={() => {
                                const isSelfRequest =
                                  r.studentId === currentUser.id ||
                                  Boolean(currentUser.studentId && r.studentId === currentUser.studentId) ||
                                  Boolean(currentUser.facultyId && r.studentId === currentUser.facultyId) ||
                                  Boolean(
                                    currentUser.rollNo &&
                                      r.studentRollNo &&
                                      r.studentRollNo.trim().toUpperCase() === currentUser.rollNo.trim().toUpperCase()
                                  ) ||
                                  Boolean(
                                    currentUser.email &&
                                      r.studentEmail &&
                                      r.studentEmail.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
                                  );
                                if (isSelfRequest) {
                                  triggerAuditFeedback(
                                    'Conflict of Interest Blocked: Staff members cannot self-approve or issue certificates for their own personal requests.',
                                    4500
                                  );
                                  return;
                                }
                                try {
                                  if (onCompleteRequest) {
                                    onCompleteRequest(r.id);
                                  } else {
                                    onUpdateRequestStatus(r.id, 'Issued', currentUser.name);
                                  }
                                } catch (err: any) {
                                  triggerAuditFeedback(
                                    err?.message || 'Failed to complete request. Please verify staff permissions.',
                                    5000
                                  );
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm inline-flex items-center gap-1.5"
                              title="Mark this request completed and move to archive"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Mark Completed
                            </button>
                          )}
                          {r.status !== 'Rejected' && r.status !== 'Issued' && (
                            <button
                              onClick={() => {
                                setRejectingId(r.id);
                                setRejectRemark('');
                              }}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl text-xs transition"
                            >
                              Reject
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Bar */}
            {filteredRequests.length > pageSize && (
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <span className="font-medium">
                  Showing <strong className="text-slate-900">{(safePage - 1) * pageSize + 1}</strong> to{' '}
                  <strong className="text-slate-900">{Math.min(safePage * pageSize, filteredRequests.length)}</strong> of{' '}
                  <strong className="text-slate-900">{filteredRequests.length}</strong>{' '}
                  {filteredRequests.length === 1 ? 'request' : 'requests'}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
                  >
                    Previous
                  </button>
                  <span className="font-mono font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PART 2: ARCHIVED REQUESTS & 3-MONTH AUDIT RETENTION */}
      {activePart === 'archive' && (
        <div className="space-y-6">
          {/* Audit Retention Banner */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                  <Archive className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Collegiate Statutory Archive & 3-Month Retention Policy
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                All requests marked completed automatically move to this statutory archive. In accordance with university records policy, completed requests older than 3 calendar months (90 days) are purged during regular monthly audit.
              </p>
              {auditFeedback && (
                <div className="mt-2 text-xs font-semibold text-purple-700 bg-purple-50 p-2.5 rounded-xl border border-purple-200 animate-in fade-in">
                  ✓ {auditFeedback}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleRunAuditCleanup}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-2"
                title="Execute 3-Month Retention Audit Purge"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                Run End-of-Month Audit & Cleanup
              </button>
            </div>
          </div>

          {/* Archived Table with Search */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  placeholder="Search archive by student, roll no, service, or cert number..."
                  className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Total Archived Records:{' '}
                <strong className="text-slate-800 font-mono">{filteredArchived.length}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Request No & Date</th>
                    <th className="px-5 py-3.5">Student Information</th>
                    <th className="px-5 py-3.5">Service Requested</th>
                    <th className="px-5 py-3.5 text-right">Fee Remitted</th>
                    <th className="px-5 py-3.5">Certificate Number</th>
                    <th className="px-5 py-3.5">Completion Details</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredArchived.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                        <Archive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        No archived service requests found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedArchived.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-5 py-3.5">
                          <span className="font-mono font-bold text-slate-900 block">{req.requestNo}</span>
                          <span className="text-xs text-slate-500 block">{req.requestDate}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-slate-900 block">{req.studentName}</span>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono font-bold text-slate-700">{req.studentRollNo}</span>
                            <span>·</span>
                            <span>Sem {req.studentSemester}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-800 max-w-[200px] sm:max-w-xs">
                          <span className="block truncate" title={req.serviceTitle || 'Archived Institutional Service'}>
                            {req.serviceTitle || 'Archived Institutional Service'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                          ₹{(Number(req.amountPaid) || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-purple-700 font-bold">
                          {req.certificateNumber ||
                            'RLSY/CERT/2026/' +
                              (String(req.requestNo || '')
                                .replace(/[^0-9A-Z]/gi, '')
                                .slice(-4)
                                .padStart(4, '0') || '0001')}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-slate-800 font-medium block">
                            Completed by: {req.completedBy || req.issuedBy || 'Accounts Counter'}
                          </span>
                          <span className="text-xs text-slate-500 block">
                            Date: {req.completedDate || req.issuedDate || req.requestDate}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Completed & Archived
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Archive Pagination Controls Bar */}
            {filteredArchived.length > pageSize && (
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <span className="font-medium">
                  Showing <strong className="text-slate-900">{(safeArchivePage - 1) * pageSize + 1}</strong> to{' '}
                  <strong className="text-slate-900">{Math.min(safeArchivePage * pageSize, filteredArchived.length)}</strong> of{' '}
                  <strong className="text-slate-900">{filteredArchived.length}</strong> archived records
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    disabled={safeArchivePage <= 1}
                    onClick={() => setArchivePage(Math.max(1, safeArchivePage - 1))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
                  >
                    Previous
                  </button>
                  <span className="font-mono font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800">
                    {safeArchivePage} / {totalArchivePages}
                  </span>
                  <button
                    disabled={safeArchivePage >= totalArchivePages}
                    onClick={() => setArchivePage(Math.min(totalArchivePages, safeArchivePage + 1))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PART 3: SERVICE TARIFFS MANAGEMENT */}
      {activePart === 'services' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Statutory Certificate Services & Tariff Master
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Accountants can introduce new student services, modify turnaround delivery days, update requisite fee amounts,
                or suspend/activate available services.
              </p>
            </div>
            <button
              onClick={handleOpenAddTariff}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow shrink-0"
            >
              <Plus className="w-4 h-4" />
              Introduce New Service
            </button>
          </div>

          {/* Tariffs Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {serviceTariffs.map((tariff) => (
              <div
                key={tariff.id}
                className={`p-5 rounded-2xl border transition shadow-sm ${
                  tariff.status === 'active'
                    ? 'bg-white border-slate-200'
                    : 'bg-slate-50/80 border-slate-200 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                        {tariff.serviceCode}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">{tariff.title}</h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {tariff.description}
                    </p>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase font-mono shrink-0 ${
                      tariff.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {tariff.status}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-xs uppercase font-bold text-slate-400 block">
                      Requisite Fee
                    </span>
                    <span className="text-lg font-black text-slate-900 font-mono tabular-nums">
                      ₹{tariff.amount.toLocaleString('en-IN')}
                    </span>
                    {Boolean(tariff.gstPercentage && tariff.gstPercentage > 0) && (
                      <span className="text-xs font-mono text-indigo-600 block">
                        +{tariff.gstPercentage}% GST (Total ₹{calculateServiceTariffTax(tariff.amount, tariff.gstPercentage).totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-xs uppercase font-bold text-slate-400 block">
                      Turnaround Time
                    </span>
                    <span className="font-bold text-slate-700">
                      {tariff.deliveryDays} Working Days
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditTariff(tariff)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Modify
                    </button>
                    <button
                      onClick={() => {
                        try {
                          onToggleServiceTariffStatus(tariff.id);
                        } catch (err: unknown) {
                          triggerAuditFeedback(
                            err instanceof Error ? err.message : 'Unable to toggle tariff status.',
                            4500
                          );
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        tariff.status === 'active'
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                      }`}
                      title={tariff.status === 'active' ? 'Suspend Service' : 'Activate Service'}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {tariff.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INTRODUCE / MODIFY TARIFF MODAL */}
      {isTariffModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Service Tariff Dialog" className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">
                {editingTariff ? 'Modify Service Tariff' : 'Introduce New Student Service'}
              </h3>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setIsTariffModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 min-w-[32px] min-h-[32px] flex items-center justify-center font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTariffSubmit} className="p-6 space-y-4 text-xs font-sans">
              {tariffModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{tariffModalError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BONAFIDE"
                    value={tariffCode}
                    onChange={(e) => setTariffCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Turnaround Days (0 for instant) *</label>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    required
                    value={tariffDays}
                    onChange={(e) => setTariffDays(e.target.value)}
                    onBlur={() => {
                      const trimmed = tariffDays.trim();
                      if (trimmed === '') return;
                      const n = parseInt(trimmed, 10);
                      if (!Number.isNaN(n) && n >= 0) {
                        setTariffDays(String(Math.min(90, Math.max(0, n))));
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Service Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bonafide Certificate"
                  value={tariffTitle}
                  onChange={(e) => setTariffTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Requisite Amount (INR) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 font-bold text-slate-400">₹</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="e.g. 150.50"
                      value={tariffAmount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[\u20B9\u00A0$,\t₹\s]/g, '').replace(',', '.');
                        // Allow empty string or valid decimal progress (e.g. "150", "150.", "150.50") without erasing mid-keystroke
                        if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
                          setTariffAmount(raw);
                        }
                      }}
                      onBlur={() => {
                        const trimmed = String(tariffAmount ?? '').trim();
                        if (trimmed === '' || trimmed === '.') return;
                        const parsed = parseFloat(trimmed);
                        if (!Number.isNaN(parsed) && parsed >= 0) {
                          const clamped = Math.min(effectiveFeeCeiling, Math.round(parsed * 100) / 100);
                          setTariffAmount(String(clamped));
                        }
                      }}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catalog Status *</label>
                  <select
                    value={tariffStatus}
                    onChange={(e) => setTariffStatus(e.target.value as 'active' | 'suspended')}
                    className={`w-full px-3 py-2 border rounded-xl font-bold ${
                      tariffStatus === 'active'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    <option value="active">Active (Open for Orders)</option>
                    <option value="suspended">Suspended (Temporarily Paused)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Statutory GST Rate (%)</label>
                <select
                  value={tariffGst}
                  onChange={(e) => setTariffGst(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                >
                  <option value="0">0% (Exempt Educational Core Service)</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST (Non-Educational / Commercial Clearance)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Service Description</label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={tariffDescription}
                  onChange={(e) => setTariffDescription(e.target.value.slice(0, 1000))}
                  placeholder="Official institutional purpose and guidelines for applicant..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTariffModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition"
                >
                  {editingTariff ? 'Save Changes' : 'Publish Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingId && (
        <div role="dialog" aria-modal="true" aria-label="Reject Service Request Dialog" className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>Reject Service Request</span>
            </div>
            <p className="text-slate-600">
              Provide a clear administrative reason for rejecting this request (e.g. pending departmental dues, incomplete clearance form).
            </p>
            <textarea
              rows={3}
              maxLength={300}
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value.slice(0, 300))}
              placeholder="Reason for rejection (max 300 characters)..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl resize-none"
            />
            <div className="text-xs text-right text-slate-400 font-mono">
              {rejectRemark.length}/300
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-xl font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleanRemark = (rejectRemark || '').trim();
                  onUpdateRequestStatus(
                    rejectingId,
                    'Rejected',
                    currentUser.name,
                    cleanRemark.length > 0 ? cleanRemark : 'Rejected by Accounts Office'
                  );
                  setRejectingId(null);
                  setRejectRemark('');
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
