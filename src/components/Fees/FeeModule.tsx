import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Student,
  FeeTransaction,
  FeeHead,
  FeeCampaign,
  ConcessionRule,
  EnrollmentField,
  UserAccount,
  StreamCourseSubject,
  Reconciliation3WayRecord,
  InstitutionalNotice,
} from '../../types/erp';
import {
  toPaisa,
  fromPaisa,
  paisaAdd,
  paisaSub,
  canModifyFeeHead,
  isCampaignActive,
  calculateStudentConcession,
  generateSecureId,
  getISTDateString,
} from '../../utils/erpLogic';
import { PrintableReceipt } from '../Common/PrintableReceipt';
import { ReconciliationModule } from '../Accountant/ReconciliationModule';
import { NoticeBroadcastModal } from '../Common/NoticeBroadcastModal';
import { erpStorage } from '../../services/erpStorage';
import { apiClient } from '../../services/apiClient';
import {
  CreditCard,
  FileSpreadsheet,
  RefreshCw,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Search,
  Download,
  UploadCloud,
  Printer,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  QrCode,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Lock,
  Tag,
  Gift,
  Clock,
  History,
  Info,
  Layers,
  FileCode,
  Megaphone,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Money, RupeeIcon } from '../Common/Rupee';

interface FeeModuleProps {
  students: Student[];
  transactions: FeeTransaction[];
  feeHeads: FeeHead[];
  feeCampaigns: FeeCampaign[];
  concessionRules: ConcessionRule[];
  enrollmentFields: EnrollmentField[];
  currentUser: UserAccount;
  streamCourseSubjects?: StreamCourseSubject[];
  reconciliationRecords?: Reconciliation3WayRecord[];
  onSaveReconciliationRecords?: (records: Reconciliation3WayRecord[]) => void;
  onProcessPayment: (
    studentId: string,
    amount: number,
    method: 'UPI' | 'Card' | 'NetBanking' | 'Cash' | 'DD',
    feeHeadTitle: string,
    referenceNo?: string,
    campaignId?: string,
    feeHeadId?: string,
    serverReceiptNo?: string
  ) => { transaction: FeeTransaction; student: Student };
  onBatchUpdateStudents: (updatedStudents: Student[]) => void;
  onSaveFeeHeads: (heads: FeeHead[]) => void;
  onSaveFeeCampaigns: (campaigns: FeeCampaign[]) => void;
  onExtendCampaign: (campaignId: string, newEndDate: string, reason?: string) => void;
  onSaveConcessionRules: (rules: ConcessionRule[]) => void;
  onPostNotice?: (notice: Omit<InstitutionalNotice, 'id' | 'date'>) => void;
}

export const FeeModule: React.FC<FeeModuleProps> = ({
  students,
  transactions,
  feeHeads,
  feeCampaigns,
  concessionRules,
  enrollmentFields,
  currentUser,
  streamCourseSubjects,
  reconciliationRecords,
  onSaveReconciliationRecords,
  onProcessPayment,
  onBatchUpdateStudents,
  onSaveFeeHeads,
  onSaveFeeCampaigns,
  onExtendCampaign,
  onSaveConcessionRules,
  onPostNotice,
}) => {
  const [activeTab, setActiveTab] = useState<
    'ledger' | 'campaigns' | 'fee_heads' | 'concessions' | 'batch_upload' | 'reconciliation'
  >('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDues, setFilterDues] = useState<'all' | 'pending' | 'cleared'>('all');
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);

  // Course Categorization in Student Fee Ledger - fetched dynamically from Course Mapping
  const [selectedLedgerCourse, setSelectedLedgerCourse] = useState<string>('ALL');

  const distinctCourses = useMemo(() => {
    const fromMapped = streamCourseSubjects
      ? streamCourseSubjects.map((s) => s.course).filter(Boolean)
      : [];
    const fromStudents = students.map((s) => s.course).filter(Boolean);
    const combined = Array.from(new Set([...fromMapped, ...fromStudents]));
    return combined.length > 0
      ? combined.sort()
      : ['B.Tech Computer Science & Engineering', 'B.Tech Electronics & Communication', 'B.Sc Physics Hons'];
  }, [streamCourseSubjects, students]);

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStudentId, setPaymentStudentId] = useState<string>(students[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState<number>(5000);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Card' | 'NetBanking' | 'Cash' | 'DD'>('UPI');
  const [selectedFeeHeadTitle, setSelectedFeeHeadTitle] = useState(
    () => feeHeads[0]?.title || 'Semester Tuition Fee'
  );
  const [selectedFeeHeadId, setSelectedFeeHeadId] = useState<string>(
    () => feeHeads[0]?.id || ''
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Receipt Modal state
  const [receiptTxn, setReceiptTxn] = useState<FeeTransaction | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Status message with ref-managed timer
  const [statusBanner, setStatusBanner] = useState('');
  const [statusBannerIsError, setStatusBannerIsError] = useState(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const showStatusBanner = (msg: string, durationMs: number = 4000, isError: boolean = false) => {
    if (!isMountedRef.current) return;
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    setStatusBanner(msg);
    setStatusBannerIsError(isError);
    statusTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setStatusBanner('');
        setStatusBannerIsError(false);
      }
      statusTimerRef.current = null;
    }, durationMs);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (students.length > 0 && (!paymentStudentId || !students.some((s) => s.id === paymentStudentId))) {
      setPaymentStudentId(students[0].id);
    }
  }, [students, paymentStudentId]);

  // Campaign sub-tabs: active vs past
  const [campaignSubTab, setCampaignSubTab] = useState<'active' | 'past'>('active');

  const activeCampaigns = useMemo(() => {
    const today = getISTDateString();
    return feeCampaigns.filter(
      (c) => c.status !== 'Completed' && (c.endDate >= today || c.status === 'Active' || c.status === 'Extended')
    );
  }, [feeCampaigns]);

  const pastCampaigns = useMemo(() => {
    const today = getISTDateString();
    return feeCampaigns.filter(
      (c) => c.status === 'Completed' || (c.endDate < today && c.status !== 'Active' && c.status !== 'Extended')
    );
  }, [feeCampaigns]);

  // Admin access control for Batch Upload
  const canAccessBatchUpload = currentUser.role === 'superadmin' || currentUser.role === 'principal';
  const canManageFeePolicies = ['superadmin', 'principal', 'accountant'].includes(currentUser.role);

  // Campaign Create Modal State & Step ('edit' | 'preview')
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [campaignModalStep, setCampaignModalStep] = useState<'edit' | 'preview'>('edit');
  const [campTitle, setCampTitle] = useState('');
  const [campFY, setCampFY] = useState('Semester 5 (FY 2026-27)');
  const [campStart, setCampStart] = useState(() => getISTDateString());
  const [campEnd, setCampEnd] = useState('');
  const [campLateFeeStartDate, setCampLateFeeStartDate] = useState('');
  const [campLateFee, setCampLateFee] = useState<number>(0); // Default is Zero
  const [campDateError, setCampDateError] = useState('');
  const [campSelectedHeads, setCampSelectedHeads] = useState<string[]>([]);

  // Multi-course structures for campaign create with multiple concessions
  const [campCoursesList, setCampCoursesList] = useState<Array<{
    course: string;
    streamCode: string;
    headAmounts: Record<string, number>;
    concessionRuleIds: string[];
  }>>([
    {
      course: 'B.Tech Computer Science & Engineering',
      streamCode: 'CSE',
      headAmounts: { 'FH-01': 32000, 'FH-02': 4500, 'FH-03': 5500, 'FH-04': 2500, 'FH-05': 3500 },
      concessionRuleIds: ['CONC-01'],
    },
  ]);

  // Campaign Extend Modal State
  const [extendingCampaign, setExtendingCampaign] = useState<FeeCampaign | null>(null);
  const [newEndDateInput, setNewEndDateInput] = useState('');
  const [extendReasonInput, setExtendReasonInput] = useState('');

  // Fee Head Add/Edit Modal (Created WITHOUT static amount!)
  const [isHeadModalOpen, setIsHeadModalOpen] = useState(false);
  const [editingHead, setEditingHead] = useState<FeeHead | null>(null);
  const [headTitle, setHeadTitle] = useState('');
  const [headCategory, setHeadCategory] = useState<FeeHead['category']>('Tuition');
  const [headDueDate, setHeadDueDate] = useState('2026-11-30');
  const [headDesc, setHeadDesc] = useState('');

  // Concession Rule Modal State
  const [isConcessionModalOpen, setIsConcessionModalOpen] = useState(false);
  const [concTitle, setConcTitle] = useState('');
  const [concParamKey, setConcParamKey] = useState('meritPercent');
  const [concCondition, setConcCondition] = useState<'greater_than' | 'less_than' | 'equals'>('greater_than');
  const [concValue, setConcValue] = useState<string>('85');
  const [concDiscountType, setConcDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [concDiscountVal, setConcDiscountVal] = useState<number>(25);
  const [concDescription, setConcDescription] = useState('');
  const [concError, setConcError] = useState('');

  // Batch upload state
  const [batchParsedRows, setBatchParsedRows] = useState<any[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered Students in Ledger
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchQuery =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.course.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchQuery) return false;

      if (selectedLedgerCourse !== 'ALL' && s.course !== selectedLedgerCourse) {
        return false;
      }

      if (filterDues === 'pending') return s.pendingFee > 0;
      if (filterDues === 'cleared') return s.pendingFee === 0;
      return true;
    });
  }, [students, searchQuery, filterDues, selectedLedgerCourse]);

  // Financial summary numbers using integer Paisa logic
  const { totalCollected, totalPending, totalTarget } = useMemo(() => {
    let collectedPaisa = 0;
    let pendingPaisa = 0;
    students.forEach((s) => {
      collectedPaisa = paisaAdd(collectedPaisa, toPaisa(s.paidFee));
      pendingPaisa = paisaAdd(pendingPaisa, toPaisa(s.pendingFee));
    });
    return {
      totalCollected: fromPaisa(collectedPaisa),
      totalPending: fromPaisa(pendingPaisa),
      totalTarget: fromPaisa(paisaAdd(collectedPaisa, pendingPaisa)),
    };
  }, [students]);

  // Handle open payment modal for specific student
  const handleOpenPayment = (studentId: string) => {
    const stu = students.find((s) => s.id === studentId);
    const hasPending = stu && stu.pendingFee > 0;
    setPaymentStudentId(studentId);
    setPaymentAmount(hasPending ? Math.min(stu.pendingFee, 25000) : 0);
    setPaymentError(
      stu && !hasPending
        ? 'This student has ₹0 pending fee dues. Only submit if recording an authorized advance or miscellaneous fee.'
        : ''
    );
    setIsPaymentModalOpen(true);
  };

  // Submit single fee payment (with immediate submission locking to prevent duplicate double-click transactions - Bugs 72, 162)
  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingPayment) return;
    setPaymentError('');
    if (!paymentStudentId || paymentAmount <= 0) return;

    setIsSubmittingPayment(true);
    try {
      const matchedHead =
        (selectedFeeHeadId ? feeHeads.find((h) => h.id === selectedFeeHeadId) : undefined) ||
        feeHeads.find((h) => h.title.trim().toLowerCase() === selectedFeeHeadTitle.trim().toLowerCase());

      let serverReceiptNo: string | undefined;
      try {
        serverReceiptNo = await apiClient.requestNextSequentialReceipt();
      } catch {
        serverReceiptNo = undefined;
      }

      let gatewayOrderRef: string | undefined;
      if (['UPI', 'Card', 'NetBanking'].includes(paymentMethod)) {
        const payStu = students.find((s) => s.id === paymentStudentId);
        if (payStu) {
          try {
            const order = await apiClient.createGatewayPaymentOrder({
              studentId: payStu.id,
              studentRollNo: payStu.rollNo,
              studentName: payStu.name,
              amountInRupees: paymentAmount,
              feeHeadTitle: matchedHead?.title || selectedFeeHeadTitle,
            });
            gatewayOrderRef = order.orderId;
          } catch {
            // Fall back to local reference generation when offline or unauthenticated on backend
          }
        }
      }

      const result = onProcessPayment(
        paymentStudentId,
        paymentAmount,
        paymentMethod,
        selectedFeeHeadTitle,
        gatewayOrderRef,
        selectedCampaignId || undefined,
        matchedHead?.id || selectedFeeHeadId || undefined,
        serverReceiptNo
      );

      const prefersReduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      }

      setIsPaymentModalOpen(false);
      setPaymentError('');
      setReceiptTxn(result.transaction);
      setIsReceiptOpen(true);
    } catch (err: any) {
      setPaymentError(err.message || 'Payment processing failed');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Create Fee Campaign with multi-course fee structures and validated late fee date
  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    setCampDateError('');

    if (!canManageFeePolicies) {
      setCampDateError('Access denied: Only Super Admin, Principal, or Accountant can launch fee campaigns.');
      return;
    }

    if (!campTitle.trim() || !campStart || !campEnd) {
      setCampDateError('Campaign Title, Start Date, and End Date are mandatory.');
      return;
    }

    if (campEnd < campStart) {
      setCampDateError(`Campaign End Date (${campEnd}) cannot be earlier than Start Date (${campStart}).`);
      return;
    }

    // Late Fee start date validation:
    // "Late Fee start date should be captured and it should be after campaign start date and before the end date. Default Late Fee will be Zero."
    if (campLateFeeStartDate) {
      if (campLateFeeStartDate <= campStart || campLateFeeStartDate >= campEnd) {
        setCampDateError(
          `Late Fee Start Date (${campLateFeeStartDate}) must be strictly after Campaign Start Date (${campStart}) and before End Date (${campEnd}).`
        );
        return;
      }
    }

    if (campCoursesList.length === 0) {
      setCampDateError('Please configure at least one course fee structure.');
      return;
    }

    const seenCourses = new Set<string>();
    for (const c of campCoursesList) {
      const normalizedCourse = (c.course || '').trim().toLowerCase();
      if (!normalizedCourse) {
        setCampDateError('Every course fee structure must select a valid degree course.');
        return;
      }
      if (seenCourses.has(normalizedCourse)) {
        setCampDateError(`Duplicate course structure detected for "${c.course}". Each course can appear only once per campaign.`);
        return;
      }
      seenCourses.add(normalizedCourse);
    }

    // Compute total campaign fee across configured courses using integer Paisa arithmetic
    let totalFeePaisa = 0;
    const courseBreakdowns = campCoursesList.map((c) => {
      const cTotalPaisa = Object.values(c.headAmounts).reduce(
        (sumP, amt) => paisaAdd(sumP, toPaisa(Math.max(0, Number(amt) || 0))),
        0
      );
      totalFeePaisa = paisaAdd(totalFeePaisa, cTotalPaisa);
      return {
        course: c.course,
        streamCode: c.streamCode,
        headAmounts: c.headAmounts,
        concessionRuleIds: c.concessionRuleIds || [],
        totalCourseFee: fromPaisa(cTotalPaisa),
      };
    });
    const totalFee = fromPaisa(totalFeePaisa);
    if (totalFee <= 0) {
      setCampDateError('Campaign total fee must be greater than ₹0. Please enter head amounts for the configured courses.');
      return;
    }

    const newCamp: FeeCampaign = {
      id: generateSecureId('CAMP'),
      title: campTitle.trim(),
      streamCode: campCoursesList[0]?.streamCode || 'ALL',
      course: campCoursesList.map((c) => c.course).join(', '),
      courses: campCoursesList.map((c) => c.course),
      courseBreakdowns,
      feeHeadAmounts: campCoursesList[0]?.headAmounts || {},
      semesterOrAnnualFY: campFY.trim(),
      startDate: campStart,
      endDate: campEnd,
      lateFeeStartDate: campLateFeeStartDate || undefined,
      lateFeeAmount: Math.max(0, Number(campLateFee) || 0),
      feeHeadIds: campSelectedHeads.length > 0 ? campSelectedHeads : feeHeads.map((h) => h.id),
      totalCampaignFee: totalFee,
      status: 'Active',
      createdAt: getISTDateString(),
      createdBy: `${currentUser.name} (${currentUser.role})`,
      extensionHistory: [],
    };

    try {
      onSaveFeeCampaigns([newCamp, ...feeCampaigns]);
      setIsCampaignModalOpen(false);
      showStatusBanner(`Fee campaign "${newCamp.title}" created with ${campCoursesList.length} course fee structure(s).`, 4000);
    } catch (err: unknown) {
      setCampDateError(err instanceof Error ? err.message : 'Unable to save fee campaign.');
    }
  };

  // Extend Campaign End Date
  const handleConfirmExtension = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingCampaign || !newEndDateInput) return;

    if (!canManageFeePolicies) {
      showStatusBanner('Access denied: Only authorized accounts or administrative staff can extend campaigns.', 4500, true);
      return;
    }

    if (newEndDateInput <= extendingCampaign.startDate || newEndDateInput < extendingCampaign.endDate) {
      showStatusBanner(
        `Invalid Extension Date: New end date (${newEndDateInput}) must be on or after the current end date (${extendingCampaign.endDate}) and strictly after start date (${extendingCampaign.startDate}).`,
        5000,
        true
      );
      return;
    }

    try {
      onExtendCampaign(
        extendingCampaign.id,
        newEndDateInput,
        extendReasonInput || 'Statutory date extension approved by administration'
      );

      setExtendingCampaign(null);
      showStatusBanner(
        `Campaign "${extendingCampaign.title}" end date extended to ${newEndDateInput}. Payment records are preserved intact and never overwritten.`,
        5000
      );
    } catch (err: unknown) {
      showStatusBanner(err instanceof Error ? err.message : 'Failed to extend campaign deadline.', 5000, true);
    }
  };

  // Fee Head Create or Update (Created WITHOUT amount!)
  const handleSaveFeeHead = (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManageFeePolicies) {
      showStatusBanner('Access denied: Only Super Admin, Principal, or Accountant can manage fee heads.', 4500, true);
      setIsHeadModalOpen(false);
      return;
    }

    if (!headTitle.trim()) {
      showStatusBanner('Fee head title is required.', 4000, true);
      return;
    }

    try {
      if (editingHead) {
        // Check lock in active campaign
        const lockCheck = canModifyFeeHead(editingHead.id, feeCampaigns);
        if (!lockCheck.canModify) {
          showStatusBanner(lockCheck.reason || 'Cannot modify fee head locked in an active campaign.', 4000, true);
          return;
        }

        const updated = feeHeads.map((h) =>
          h.id === editingHead.id
            ? {
                ...h,
                title: headTitle.trim(),
                category: headCategory,
                dueDate: headDueDate,
                description: headDesc.trim() || undefined,
              }
            : h
        );
        onSaveFeeHeads(updated);
        showStatusBanner(`Fee head "${headTitle.trim()}" updated.`, 4000);
      } else {
        const newHead: FeeHead = {
          id: generateSecureId('FH'),
          title: headTitle.trim(),
          category: headCategory,
          dueDate: headDueDate,
          description: headDesc.trim() || undefined,
        };
        onSaveFeeHeads([...feeHeads, newHead]);
        showStatusBanner(`New fee head "${newHead.title}" created without fixed amount.`, 4000);
      }
      setIsHeadModalOpen(false);
    } catch (err: unknown) {
      showStatusBanner(err instanceof Error ? err.message : 'Failed to save fee head.', 4500, true);
    }
  };

  // Delete Fee Head
  const handleDeleteFeeHead = (headId: string) => {
    if (!canManageFeePolicies) {
      showStatusBanner('Access denied: Only authorized accounts or administrative staff can delete fee heads.', 4500, true);
      return;
    }
    const lockCheck = canModifyFeeHead(headId, feeCampaigns);
    if (!lockCheck.canModify) {
      showStatusBanner(`Cannot delete fee head: ${lockCheck.reason}`, 4000, true);
      return;
    }

    const headToDelete = feeHeads.find((h) => h.id === headId);
    const isReferencedInTx = transactions.some(
      (t) =>
        t.feeHeadId === headId ||
        (headToDelete &&
          (t.feeHeadTitle || '').trim().toLowerCase() === headToDelete.title.trim().toLowerCase())
    );
    if (isReferencedInTx) {
      showStatusBanner('Cannot delete this fee head because historical student payment ledger records reference it.', 4000, true);
      return;
    }

    try {
      const updated = feeHeads.filter((h) => h.id !== headId);
      onSaveFeeHeads(updated);
      showStatusBanner('Fee head deleted successfully.', 3000);
    } catch (err: unknown) {
      showStatusBanner(err instanceof Error ? err.message : 'Failed to delete fee head.', 4500, true);
    }
  };

  // Concession Rule Add
  const handleCreateConcessionRule = (e: React.FormEvent) => {
    e.preventDefault();
    setConcError('');

    if (!canManageFeePolicies) {
      setConcError('Access denied: Only Super Admin, Principal, or Accountant can define concession policies.');
      return;
    }

    if (!concTitle.trim()) {
      setConcError('Concession policy title is required.');
      return;
    }

    const selectedFieldDef = enrollmentFields.find((f) => f.key === concParamKey);
    const isNumericParam =
      selectedFieldDef?.type === 'number' ||
      ['meritPercent', 'annualIncome', 'attendancePercentage'].includes(concParamKey);
    const parsedCondVal = isNumericParam ? Number(concValue) : concValue.trim();

    if (isNumericParam && (concValue.trim() === '' || !Number.isFinite(parsedCondVal as number))) {
      setConcError(`Parameter "${concParamKey}" requires a valid numeric threshold.`);
      return;
    }
    if (!isNumericParam && !String(parsedCondVal).trim()) {
      setConcError('Threshold / Match Value is required.');
      return;
    }

    const rawVal = Number(concDiscountVal);
    if (!Number.isFinite(rawVal) || rawVal <= 0) {
      setConcError('Discount value must be greater than zero.');
      return;
    }
    const clampedDiscountVal = concDiscountType === 'percentage' ? Math.min(100, rawVal) : rawVal;

    const newRule: ConcessionRule = {
      id: generateSecureId('CONC'),
      title: concTitle.trim(),
      parameterKey: concParamKey,
      conditionType: concCondition,
      conditionValue: parsedCondVal,
      discountType: concDiscountType,
      discountValue: clampedDiscountVal,
      description: concDescription.trim() || `${clampedDiscountVal}${concDiscountType === 'percentage' ? '%' : ' INR'} waiver based on ${concParamKey}`,
      active: true,
    };

    try {
      onSaveConcessionRules([newRule, ...concessionRules]);
      setIsConcessionModalOpen(false);
      setConcError('');
      showStatusBanner(`Concession rule "${newRule.title}" established.`, 4000);
    } catch (err: unknown) {
      setConcError(err instanceof Error ? err.message : 'Unable to save concession rule.');
    }
  };

  // Apply Concession directly to student (with RBAC, audit logging, and overpayment guard)
  const handleApplyConcessionToStudent = (studentId: string, rule: ConcessionRule) => {
    try {
      const res = erpStorage.applyStudentConcession(studentId, rule, currentUser.role);
      onBatchUpdateStudents(res.updatedStudents);
      showStatusBanner(res.message, 5000);
    } catch (err: unknown) {
      showStatusBanner(
        err instanceof Error ? err.message : `Unable to apply "${rule.title}".`,
        4000,
        true
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Financial Statistics Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Fee Collected</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              <Money amount={totalCollected} />
            </div>
            <span className="text-xs text-slate-400">
              {Math.round((totalCollected / (totalTarget || 1)) * 100)}% of target realized
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <RupeeIcon className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outstanding Dues</span>
            <div className="text-2xl font-black text-rose-600 mt-1">
              <Money amount={totalPending} />
            </div>
            <span className="text-xs text-rose-600 font-semibold">
              {students.filter((s) => s.pendingFee > 0).length} students pending clearance
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Fee Campaigns</span>
            <div className="text-2xl font-black text-indigo-600 mt-1">
              {feeCampaigns.filter((c) => isCampaignActive(c)).length} Active
            </div>
            <span className="text-xs text-slate-400">{feeCampaigns.length} total drives scheduled</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Concessions Defined</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{concessionRules.length} Rules</div>
            <span className="text-xs text-slate-400">Merit, EWS & Sports quotas</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Gift className="w-6 h-6" />
          </div>
        </div>
      </div>

      {statusBanner && (
        <div
          className={`p-4 border rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            statusBannerIsError
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          }`}
        >
          {statusBannerIsError ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          {statusBanner}
        </div>
      )}

      {/* Module Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl px-6 pt-3 shadow-sm overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === 'ledger'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Course-Categorized Fee Ledger
        </button>

        <button
          onClick={() => setActiveTab('campaigns')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === 'campaigns'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Fee Campaigns ({activeCampaigns.length} Active / {pastCampaigns.length} Past)
        </button>

        <button
          onClick={() => setActiveTab('fee_heads')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === 'fee_heads'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          Fee Heads (Categorical) ({feeHeads.length})
        </button>

        <button
          onClick={() => setActiveTab('concessions')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === 'concessions'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Gift className="w-4 h-4" />
          Concession Policies ({concessionRules.length})
        </button>

        {canAccessBatchUpload && (
          <button
            onClick={() => setActiveTab('batch_upload')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 border-b-2 shrink-0 ${
              activeTab === 'batch_upload'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Batch Upload (Admin Only)
          </button>
        )}

        {(currentUser.role === 'superadmin' ||
          currentUser.hasGatewayReconciliationAccess ||
          currentUser.taggedModules?.includes('reconciliation_3way')) && (
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 border-b-2 shrink-0 ${
              activeTab === 'reconciliation'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-4 h-4" />
            Gateway Reconciliation
          </button>
        )}

        {onPostNotice && (
          <button
            type="button"
            onClick={() => setIsNoticeModalOpen(true)}
            className="my-auto ml-auto mb-2 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition border border-indigo-200 flex items-center gap-1.5 shrink-0 shadow-2xs whitespace-nowrap cursor-pointer"
            title="Broadcast fee deadlines, concessions, or financial circulars to students and staff"
          >
            <Megaphone className="w-3.5 h-3.5 text-indigo-600" />
            <span>Broadcast Notice</span>
          </button>
        )}
      </div>

      {/* VIEW 1: STUDENT LEDGER CATEGORIZED AS PER COURSE */}
      {activeTab === 'ledger' && (
        <div className="space-y-5">
          {/* Top Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name, roll number, or course..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(['all', 'pending', 'cleared'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterDues(filter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition border ${
                    filterDues === filter
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Course Categorization Dropdown Menu */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Course Category Ledger
                  </h3>
                  <p className="text-xs text-slate-500 font-medium sm:hidden">
                    Showing accounts for{' '}
                    <span className="font-semibold text-slate-700">
                      {selectedLedgerCourse === 'ALL' ? 'All Courses' : selectedLedgerCourse}
                    </span>
                  </p>
                </div>
              </div>
              <div className="hidden sm:block text-xs text-slate-500 font-medium">
                Showing ledger accounts for{' '}
                <strong className="text-slate-800">
                  {selectedLedgerCourse === 'ALL' ? 'all enrolled courses' : selectedLedgerCourse}
                </strong>
              </div>
            </div>

            {/* Wrapped Full-Width Course Dropdown placed directly below Course Category Ledger */}
            <div className="w-full">
              <label htmlFor="course-category-dropdown" className="sr-only">
                Select Course Category
              </label>
              <div className="relative">
                <select
                  id="course-category-dropdown"
                  value={selectedLedgerCourse}
                  onChange={(e) => setSelectedLedgerCourse(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-300 rounded-xl font-bold text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-2xs transition"
                >
                  <option value="ALL">All Course Categories ({students.length} Total Students)</option>
                  {distinctCourses.map((c) => {
                    const cCount = students.filter((s) => s.course === c).length;
                    return (
                      <option key={c} value={c}>
                        {c} ({cCount} Enrolled)
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Categorized Ledger Sections per Course */}
          <div className="space-y-6">
            {(selectedLedgerCourse === 'ALL' ? distinctCourses : [selectedLedgerCourse]).map((courseName) => {
              const courseStudents = filteredStudents.filter((s) => s.course === courseName);
              const courseTotalFee = fromPaisa(
                courseStudents.reduce((sum, s) => paisaAdd(sum, toPaisa(s.totalFee)), 0)
              );
              const coursePaid = fromPaisa(
                courseStudents.reduce((sum, s) => paisaAdd(sum, toPaisa(s.paidFee)), 0)
              );
              const coursePending = fromPaisa(
                courseStudents.reduce((sum, s) => paisaAdd(sum, toPaisa(s.pendingFee)), 0)
              );

              if (courseStudents.length === 0 && searchQuery !== '') return null;

              return (
                <div key={courseName} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Course Category Header Banner */}
                  <div className="bg-slate-900 text-white px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-mono uppercase bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 font-bold">
                          Course Category
                        </span>
                        <h3 className="font-bold text-sm sm:text-base text-white">{courseName}</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {courseStudents.length} Students Enrolled in this programme
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="text-right">
                        <span className="text-slate-400 text-xs uppercase block">Total Billed</span>
                        <span className="font-bold text-white">
                          <Money amount={courseTotalFee} />
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-xs uppercase block">Realized</span>
                        <span className="font-bold text-emerald-400">
                          <Money amount={coursePaid} />
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-xs uppercase block">Outstanding</span>
                        <span className={`font-bold ${coursePending > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          <Money amount={coursePending} />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Course Student Ledger Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3">Roll & Student Name</th>
                          <th className="px-5 py-3">Semester & Section</th>
                          <th className="px-5 py-3">Total Fee Structure</th>
                          <th className="px-5 py-3">Amount Paid</th>
                          <th className="px-5 py-3">Balance Due</th>
                          <th className="px-5 py-3">Exam Hall Ticket</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {courseStudents.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                              No students found matching your search criteria in this course.
                            </td>
                          </tr>
                        ) : (
                          courseStudents.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50/80 transition">
                              <td className="px-5 py-3">
                                <div className="font-mono font-bold text-slate-900">{s.rollNo}</div>
                                <div className="font-semibold text-slate-800">{s.name}</div>
                                {s.concessionApplied && (
                                  <span className="text-xs text-amber-700 font-bold block mt-0.5">
                                    🏷️ {s.concessionApplied} (-Rs. {s.concessionAmount?.toLocaleString('en-IN')})
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3">
                                <span className="font-bold text-slate-800">Semester {s.semester}</span>
                                <span className="text-slate-500 ml-1">Section {s.section}</span>
                                <div className="text-xs text-slate-400 font-mono mt-0.5">Batch {s.batchYear}</div>
                              </td>
                              <td className="px-5 py-3 font-bold text-slate-900">
                                <Money amount={s.totalFee} />
                              </td>
                              <td className="px-5 py-3 font-bold text-emerald-600">
                                <Money amount={s.paidFee} />
                              </td>
                              <td className="px-5 py-3">
                                <span
                                  className={`font-black text-sm ${
                                    s.pendingFee > 0 ? 'text-rose-600' : 'text-emerald-600'
                                  }`}
                                >
                                  <Money amount={s.pendingFee} />
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                {s.hallTicketBlocked ? (
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    🚫 Blocked (Dues)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    ✓ Cleared
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <button
                                  onClick={() => handleOpenPayment(s.id)}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
                                >
                                  Collect Fee
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: FEE CAMPAIGNS (ACTIVE & PAST SUB-PARTS) */}
      {activeTab === 'campaigns' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Institutional Fee Campaigns & Collection Drives</h3>
              <p className="text-xs text-slate-500">
                Segmented into Active Campaigns and Past Historical Drives with per-course fee structures.
              </p>
            </div>
            <button
              onClick={() => {
                setCampSelectedHeads(feeHeads.map((h) => h.id));
                setCampCoursesList([
                  {
                    course: 'B.Tech Computer Science & Engineering',
                    streamCode: 'CSE',
                    headAmounts: { 'FH-01': 32000, 'FH-02': 4500, 'FH-03': 5500, 'FH-04': 2500, 'FH-05': 3500 },
                    concessionRuleIds: ['CONC-01'],
                  },
                ]);
                setCampLateFee(0);
                setCampLateFeeStartDate('');
                setCampDateError('');
                setIsCampaignModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow shrink-0"
            >
              <Plus className="w-4 h-4" />
              Launch New Fee Campaign
            </button>
          </div>

          {/* Sub-Part Switcher: Active Campaigns vs Past Campaigns */}
          <div className="flex p-1 bg-white border border-slate-200 rounded-2xl w-fit gap-1 text-xs font-semibold shadow-sm">
            <button
              onClick={() => setCampaignSubTab('active')}
              className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
                campaignSubTab === 'active'
                  ? 'bg-indigo-600 text-white shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Active Campaigns</span>
              <span
                className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                  campaignSubTab === 'active' ? 'bg-indigo-800 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {activeCampaigns.length}
              </span>
            </button>
            <button
              onClick={() => setCampaignSubTab('past')}
              className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
                campaignSubTab === 'past'
                  ? 'bg-indigo-600 text-white shadow font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Past Campaigns</span>
              <span
                className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                  campaignSubTab === 'past' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {pastCampaigns.length}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(campaignSubTab === 'active' ? activeCampaigns : pastCampaigns).length === 0 ? (
              <div className="col-span-full bg-white p-10 text-center rounded-2xl border border-slate-200 text-slate-400">
                <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="font-bold text-slate-700 text-sm">
                  No {campaignSubTab === 'active' ? 'Active' : 'Past'} Fee Campaigns Found
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {campaignSubTab === 'active'
                    ? 'Launch a new fee drive using the button above.'
                    : 'Historical and concluded campaigns will be listed here.'}
                </p>
              </div>
            ) : (
              (campaignSubTab === 'active' ? activeCampaigns : pastCampaigns).map((camp) => {
                const active = isCampaignActive(camp);
                const statusBadgeStyles = {
                  Active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                  Upcoming: 'bg-blue-100 text-blue-800 border-blue-200',
                  Completed: 'bg-slate-100 text-slate-700 border-slate-200',
                  Extended: 'bg-amber-100 text-amber-800 border-amber-200',
                };

                return (
                  <div
                    key={camp.id}
                    className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                            statusBadgeStyles[camp.status] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {active ? '● Active Drive' : camp.status}
                        </span>
                        <span className="text-xs font-mono text-slate-400">ID: {camp.id}</span>
                      </div>

                      <h4 className="font-black text-slate-900 text-base">{camp.title}</h4>
                      <p className="text-xs text-indigo-700 font-semibold mt-0.5">
                        {camp.course} ({camp.streamCode}) • {camp.semesterOrAnnualFY}
                      </p>

                      <div className="grid grid-cols-2 gap-2 mt-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-slate-500 block text-xs uppercase font-semibold">Start Date</span>
                          <span className="font-bold text-slate-800 font-mono">{camp.startDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-xs uppercase font-semibold">End Date</span>
                          <span className="font-bold text-slate-800 font-mono">{camp.endDate}</span>
                        </div>
                        {camp.lateFeeStartDate && (
                          <div>
                            <span className="text-slate-500 block text-xs uppercase font-semibold">Late Fee After</span>
                            <span className="font-bold text-rose-700 font-mono">{camp.lateFeeStartDate}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500 block text-xs uppercase font-semibold">Late Fee Penalty</span>
                          <span className="font-bold text-rose-600">
                            <Money amount={camp.lateFeeAmount || 0} />
                          </span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-200 flex justify-between items-center">
                          <span className="text-slate-500 text-xs uppercase font-semibold">Total Campaign Fee:</span>
                          <span className="font-bold text-emerald-600 text-sm">
                            <Money amount={camp.totalCampaignFee} />
                          </span>
                        </div>
                      </div>

                      {/* Extension History Notice */}
                      {camp.extensionHistory && camp.extensionHistory.length > 0 && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                          <div className="flex items-center gap-1 font-bold text-amber-800 mb-1">
                            <History className="w-3.5 h-3.5" />
                            Extension Audit Trail ({camp.extensionHistory.length})
                          </div>
                          {camp.extensionHistory.map((ext, idx) => (
                            <div key={idx} className="border-t border-amber-200/60 pt-1 mt-1 text-xs">
                              <span>
                                Extended from <span className="font-mono">{ext.previousEndDate}</span> to{' '}
                                <span className="font-mono font-bold">{ext.newEndDate}</span> by {ext.extendedBy}
                              </span>
                              {ext.reason && <p className="text-amber-700 italic">"{ext.reason}"</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                      <span className="text-xs text-slate-400">Created by: {camp.createdBy}</span>
                      <button
                        onClick={() => {
                          setExtendingCampaign(camp);
                          setNewEndDateInput(camp.endDate);
                          setExtendReasonInput('');
                        }}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs transition border border-amber-200 flex items-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Extend End Date
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: FEE HEADS MANAGEMENT (CREATED WITHOUT AMOUNT) */}
      {activeTab === 'fee_heads' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Institutional Statutory Fee Heads (Categorical Definitions)</h3>
              <p className="text-xs text-slate-500">
                Fee heads represent institutional categories (Tuition, Lab, Exam, etc.) without static amounts.{' '}
                <span className="font-semibold text-indigo-700">
                  Specific currency amounts are assigned dynamically per course within Fee Campaigns.
                </span>
              </p>
            </div>
            <button
              onClick={() => {
                setEditingHead(null);
                setHeadTitle('');
                setHeadCategory('Tuition');
                setHeadDueDate('2026-11-30');
                setHeadDesc('');
                setIsHeadModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add New Fee Head
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feeHeads.map((head) => {
              const lockStatus = canModifyFeeHead(head.id, feeCampaigns);
              const isLocked = !lockStatus.canModify;

              return (
                <div
                  key={head.id}
                  className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between ${
                    isLocked ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-slate-100 text-slate-700">
                        {head.category}
                      </span>
                      {isLocked ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-700" />
                          Locked in Active Campaign
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                          Modifiable
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm mt-1">{head.title}</h4>
                    <div className="mt-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                      <span className="text-xs uppercase font-bold text-slate-400 block font-mono">Head Policy:</span>
                      <span className="font-semibold text-indigo-700">Amount defined per course in Fee Campaigns</span>
                      {head.dueDate && (
                        <p className="text-xs text-slate-500 font-mono mt-1">Default Due Date: {head.dueDate}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button
                      disabled={isLocked}
                      onClick={() => {
                        setEditingHead(head);
                        setHeadTitle(head.title);
                        setHeadCategory(head.category);
                        setHeadDueDate(head.dueDate || '');
                        setHeadDesc(head.description || '');
                        setIsHeadModalOpen(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        isLocked
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                      }`}
                      title={isLocked ? lockStatus.reason : 'Edit Fee Head'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      disabled={isLocked}
                      onClick={() => handleDeleteFeeHead(head.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        isLocked
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                      }`}
                      title={isLocked ? lockStatus.reason : 'Delete Fee Head'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 4: CONCESSIONS MENU (POLICY DEFINITIONS ONLY) */}
      {activeTab === 'concessions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Institutional Concessions & Welfare Policies</h3>
              <p className="text-xs text-slate-500">
                Define concessions based on captured enrollment parameters (Merit %, Annual Income, Sports Quota, Staff Ward).
                Concessions are defined as policy rules here and applied automatically through approved fee campaigns and admission verification.
              </p>
            </div>
            <button
              onClick={() => setIsConcessionModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow shrink-0"
            >
              <Plus className="w-4 h-4" />
              Define New Concession Rule
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {concessionRules.map((rule) => {
              // Count how many students currently qualify using gross base fee
              const qualifyingStudents = students.filter((s) => {
                const grossBase = fromPaisa(paisaAdd(toPaisa(s.totalFee), toPaisa(s.concessionAmount || 0)));
                const res = calculateStudentConcession(s.enrollmentData || {}, [rule], grossBase);
                return res.concessionAmount > 0;
              });

              return (
                <div
                  key={rule.id}
                  className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Param: {rule.parameterKey}
                      </span>
                      <span className="text-xs font-bold text-emerald-600">
                        {rule.discountType === 'percentage'
                          ? `${rule.discountValue}% Waiver`
                          : `Rs. ${rule.discountValue.toLocaleString('en-IN')} Credit`}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm">{rule.title}</h4>
                    <p className="text-xs text-slate-500 mt-1">{rule.description}</p>

                    <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1">
                      <span className="font-semibold text-slate-900 block text-xs">
                        Rule Formula: {rule.parameterKey} {rule.conditionType.replace('_', ' ')} "{rule.conditionValue}"
                      </span>
                      <span className="text-indigo-600 font-bold block text-xs">
                        {qualifyingStudents.length} students currently qualify under this institutional policy rule
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 5: BATCH UPLOAD */}
      {activeTab === 'batch_upload' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center space-x-3 mb-2">
            <UploadCloud className="w-6 h-6 text-indigo-600" />
            <div>
              <h3 className="font-bold text-base text-slate-900">Batch Fee Upload Engine (CSV / XLSX)</h3>
              <p className="text-xs text-slate-500">
                Bulk upload student fees collected via external bank challans, state scholarship portals, or DD drafts.
              </p>
            </div>
          </div>

          <div className="p-8 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 text-center space-y-3">
            <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto" />
            <div>
              <p className="text-sm font-bold text-slate-700">Drop your fee settlement sheet or browse</p>
              <p className="text-xs text-slate-400">Supported columns: RollNo, StudentName, FeePaid, ReceiptRef</p>
            </div>
            <button
              onClick={() => {
                // Simulate processing sample batch
                const sampleRows = students.slice(0, 3).map((s) => ({
                  id: s.id,
                  rollNo: s.rollNo,
                  name: s.name,
                  feePaid: Math.min(s.pendingFee || 10000, 10000),
                  currentPending: s.pendingFee,
                  status: 'Matched',
                }));
                setBatchParsedRows(sampleRows);
                showStatusBanner(`Uploaded and matched 3 fee records successfully.`, 4000);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow"
            >
              Simulate Uploading Verified Bank Sheet
            </button>
          </div>

          {batchParsedRows.length > 0 && (
            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold">
                  <tr>
                    <th className="px-4 py-2.5">Roll No</th>
                    <th className="px-4 py-2.5">Student Name</th>
                    <th className="px-4 py-2.5">Credit Amount</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchParsedRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono">{r.rollNo}</td>
                      <td className="px-4 py-2 font-bold">{r.name}</td>
                      <td className="px-4 py-2 font-bold text-emerald-600">
                        <Money amount={r.feePaid} />
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                          ✓ Verified
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 6: 3-WAY FINANCIAL RECONCILIATION ENGINE */}
      {activeTab === 'reconciliation' && (
        <ReconciliationModule
          records={reconciliationRecords || []}
          onSaveRecords={onSaveReconciliationRecords || (() => {})}
          currentUser={currentUser}
          erpTransactions={transactions}
        />
      )}

      {/* COLLECT FEE PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Collect / Pay Student Fee</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleExecutePayment} className="p-6 space-y-4 text-xs font-sans">
              {paymentError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Student</label>
                <select
                  value={paymentStudentId}
                  onChange={(e) => setPaymentStudentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.rollNo} - {s.name} (Due: Rs. {s.pendingFee.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Fee Head Allocation</label>
                <select
                  value={selectedFeeHeadTitle}
                  onChange={(e) => {
                    const nextTitle = e.target.value;
                    setSelectedFeeHeadTitle(nextTitle);
                    const matched = feeHeads.find((h) => h.title === nextTitle);
                    setSelectedFeeHeadId(matched?.id || '');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50"
                >
                  {feeHeads.map((h) => (
                    <option key={h.id} value={h.title}>
                      {h.title} {h.amount !== undefined ? `(Rs. ${h.amount.toLocaleString('en-IN')})` : ''}
                    </option>
                  ))}
                  <option value="Part Payment / Ad-hoc Fee Settlement">Part Payment / Ad-hoc Fee Settlement</option>
                </select>
              </div>

              {feeCampaigns.filter((c) => isCampaignActive(c)).length > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Associate with Active Fee Campaign</label>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50"
                  >
                    <option value="">-- Standalone College Fee Payment --</option>
                    {feeCampaigns
                      .filter((c) => isCampaignActive(c))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.semesterOrAnnualFY})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount to Pay (INR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['UPI', 'Card', 'NetBanking', 'Cash', 'DD'] as const).map((method) => (
                    <button
                      type="button"
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-2.5 rounded-xl border text-center font-bold text-xs transition ${
                        paymentMethod === method
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  Confirm & Issue Official Receipt
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CAMPAIGN MODAL (MULTI-COURSE FEE STRUCTURES + LATE FEE VALIDATION) */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Launch New Institutional Fee Campaign</h3>
              </div>
              <button onClick={() => setIsCampaignModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="p-6 space-y-4 text-xs font-sans overflow-y-auto flex-1">
              {campDateError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{campDateError}</span>
                </div>
              )}

              {/* Campaign Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Campaign Title / Drive Name *</label>
                  <input
                    type="text"
                    value={campTitle}
                    onChange={(e) => setCampTitle(e.target.value)}
                    placeholder="e.g. Autumn 2026 Regular Semester Fee Drive"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Semester or Annual Financial Year *</label>
                  <input
                    type="text"
                    value={campFY}
                    onChange={(e) => setCampFY(e.target.value)}
                    placeholder="e.g. Semester 5 (FY 2026-27)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={campStart}
                    onChange={(e) => setCampStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={campEnd}
                    onChange={(e) => setCampEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                    required
                  />
                </div>
              </div>

              {/* Late Fee Configuration (Default 0, strictly between start and end date) */}
              <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2.5">
                <span className="font-bold text-amber-900 block text-xs uppercase tracking-wide">
                  Late Fee Rules (Default Penalty: ₹0)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Late Fee Start Date (After start date & before end date)
                    </label>
                    <input
                      type="date"
                      value={campLateFeeStartDate}
                      onChange={(e) => {
                        setCampLateFeeStartDate(e.target.value);
                        setCampDateError('');
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs"
                    />
                    <span className="text-xs text-slate-500 mt-0.5 block">
                      Must be strictly after {campStart || 'Start Date'} and before {campEnd || 'End Date'}.
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Late Fee Penalty (INR) - Default: ₹0</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={campLateFee}
                        onChange={(e) => setCampLateFee(Math.max(0, Number(e.target.value)))}
                        className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-bold font-mono text-xs"
                      />
                    </div>
                    <span className="text-xs text-slate-500 mt-0.5 block">
                      Default penalty is ₹0. Incurred if paid after Late Fee Start Date.
                    </span>
                  </div>
                </div>
              </div>

              {/* Courses with its Fee Structure & Concessions */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Courses & Head Amounts Allocation
                    </label>
                    <p className="text-xs text-slate-500">
                      Add various courses to this campaign and capture the specific fee amount against each selected fee head.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const unusedCourse = distinctCourses.find((c) => !campCoursesList.some((cl) => cl.course === c));
                      if (!unusedCourse) {
                        setCampDateError('All available degree courses already have a configured structure in this campaign.');
                        return;
                      }
                      const initialAmounts: Record<string, number> = {};
                      feeHeads.forEach((h) => {
                        initialAmounts[h.id] = h.category === 'Tuition' ? 25000 : 3000;
                      });
                      setCampCoursesList([
                        ...campCoursesList,
                        {
                          course: unusedCourse,
                          streamCode: unusedCourse.includes('Electronics') ? 'ECE' : unusedCourse.includes('Physics') ? 'PHY' : 'CSE',
                          headAmounts: initialAmounts,
                          concessionRuleIds: [],
                        },
                      ]);
                      setCampDateError('');
                    }}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition border border-indigo-200 flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Add Course Structure
                  </button>
                </div>

                {/* List of configured courses in this campaign */}
                <div className="space-y-3">
                  {campCoursesList.map((cItem, cIdx) => {
                    const courseTotal = Object.values(cItem.headAmounts).reduce((sum, amt) => sum + (Number(amt) || 0), 0);
                    return (
                      <div key={cIdx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {cIdx + 1}
                            </span>
                            <select
                              value={cItem.course}
                              onChange={(e) => {
                                const selected = e.target.value;
                                const updated = [...campCoursesList];
                                updated[cIdx].course = selected;
                                updated[cIdx].streamCode = selected.includes('Electronics') ? 'ECE' : selected.includes('Physics') ? 'PHY' : 'CSE';
                                setCampCoursesList(updated);
                              }}
                              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 w-full sm:w-auto"
                            >
                              {distinctCourses.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-3 justify-between sm:justify-end">
                            <div className="text-right">
                              <span className="text-xs uppercase font-bold text-slate-400 block">Course Fee Total:</span>
                              <span className="font-bold text-emerald-700 font-mono text-xs">
                                ₹{courseTotal.toLocaleString('en-IN')}
                              </span>
                            </div>
                            {campCoursesList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCampCoursesList(campCoursesList.filter((_, idx) => idx !== cIdx));
                                }}
                                className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                                title="Remove course structure"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Fee Head Amounts input for this course */}
                        <div>
                          <span className="text-xs font-bold uppercase text-slate-500 block mb-1.5">
                            Amount Against Each Selected Fee Head:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {feeHeads.map((h) => {
                              const amt = cItem.headAmounts[h.id] ?? 0;
                              return (
                                <div key={h.id} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 gap-2">
                                  <div className="truncate flex-1">
                                    <span className="font-semibold text-slate-800 text-xs block truncate">{h.title}</span>
                                    <span className="text-xs text-slate-400 uppercase font-mono">{h.category}</span>
                                  </div>
                                  <div className="relative w-28 shrink-0">
                                    <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold text-xs">₹</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="100"
                                      value={amt}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const updated = [...campCoursesList];
                                        updated[cIdx].headAmounts = {
                                          ...updated[cIdx].headAmounts,
                                          [h.id]: isNaN(val) ? 0 : val,
                                        };
                                        setCampCoursesList(updated);
                                      }}
                                      className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-lg text-right focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Multiple Concession Policies for this Course */}
                        <div className="pt-1">
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                            Applicable Concessions for this Course (Multiple Selection Allowed):
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {concessionRules.map((cr) => {
                              const isChecked = (cItem.concessionRuleIds || []).includes(cr.id);
                              return (
                                <label
                                  key={cr.id}
                                  className={`flex items-start gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                                    isChecked
                                      ? 'bg-amber-50/80 border-amber-300 text-amber-950 font-bold'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const updated = [...campCoursesList];
                                      const currentIds = updated[cIdx].concessionRuleIds || [];
                                      if (e.target.checked) {
                                        updated[cIdx].concessionRuleIds = [...currentIds, cr.id];
                                      } else {
                                        updated[cIdx].concessionRuleIds = currentIds.filter((id) => id !== cr.id);
                                      }
                                      setCampCoursesList(updated);
                                    }}
                                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                                  />
                                  <div className="truncate flex-1">
                                    <span className="block truncate">{cr.title}</span>
                                    <span className="text-xs text-amber-700 font-mono">
                                      {cr.discountType === 'percentage' ? `${cr.discountValue}% waiver` : `₹${cr.discountValue} credit`}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2: PREVIEW SCREEN OF COURSE WISE & CONCESSION BASIS NET FEE */}
              {campaignModalStep === 'preview' && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-700" />
                    <div>
                      <h4 className="font-bold text-sm text-indigo-950">
                        Launch Preview: Course-wise & Concession-basis Net Fee Statement
                      </h4>
                      <p className="text-xs text-indigo-700">
                        Review the gross fee, active concessions, and resulting net payable amount for each course before publishing this campaign.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto bg-white rounded-xl border border-indigo-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-indigo-950 text-white font-bold text-xs uppercase">
                        <tr>
                          <th className="px-3.5 py-2.5">Course & Stream</th>
                          <th className="px-3.5 py-2.5 text-right font-mono">Gross Base Fee</th>
                          <th className="px-3.5 py-2.5">Attached Concessions</th>
                          <th className="px-3.5 py-2.5 text-right font-mono">Estimated Concession</th>
                          <th className="px-3.5 py-2.5 text-right font-mono font-bold">Net Fee Payable</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {campCoursesList.map((cItem, idx) => {
                          const baseFee = Object.values(cItem.headAmounts).reduce((sum, amt) => sum + (Number(amt) || 0), 0);
                          const activeRules = concessionRules.filter((cr) => (cItem.concessionRuleIds || []).includes(cr.id));
                          
                          // Calculate combined concession discount using high-precision Paisa arithmetic
                          const basePaisa = toPaisa(baseFee);
                          let totalDiscountPaisa = 0;
                          activeRules.forEach((rule) => {
                            if (rule.discountType === 'percentage') {
                              totalDiscountPaisa += Math.round((basePaisa * rule.discountValue) / 100);
                            } else {
                              totalDiscountPaisa += toPaisa(rule.discountValue);
                            }
                          });
                          totalDiscountPaisa = Math.min(basePaisa, totalDiscountPaisa);
                          const totalDiscount = fromPaisa(totalDiscountPaisa);
                          const netPayable = fromPaisa(paisaSub(basePaisa, totalDiscountPaisa));

                          return (
                            <tr key={idx} className="hover:bg-indigo-50/40">
                              <td className="px-3.5 py-2.5">
                                <span className="font-bold text-slate-900 block">{cItem.course}</span>
                                <span className="text-xs font-mono text-slate-400 font-semibold">{cItem.streamCode}</span>
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-800">
                                ₹{baseFee.toLocaleString('en-IN')}
                              </td>
                              <td className="px-3.5 py-2.5">
                                {activeRules.length === 0 ? (
                                  <span className="text-slate-400 italic text-xs">No concessions attached</span>
                                ) : (
                                  <div className="space-y-0.5">
                                    {activeRules.map((r) => (
                                      <span key={r.id} className="block text-xs font-medium text-amber-800">
                                        • {r.title} ({r.discountType === 'percentage' ? `${r.discountValue}%` : `₹${r.discountValue}`})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-amber-700">
                                -₹{totalDiscount.toLocaleString('en-IN')}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-black text-emerald-700 text-sm">
                                ₹{netPayable.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between text-xs text-indigo-900 bg-white p-2.5 rounded-xl border border-indigo-200">
                    <div>
                      <span className="font-bold">Late Fee Policy: </span>
                      {campLateFeeStartDate ? (
                        <span>Applicable from {campLateFeeStartDate} (Fine: ₹{campLateFee})</span>
                      ) : (
                        <span>Default ₹0 late fee</span>
                      )}
                    </div>
                    <div className="font-bold">
                      Session: <span className="font-mono">{campFY}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* FOOTER ACTIONS */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsCampaignModalOpen(false);
                    setCampaignModalStep('edit');
                  }}
                  className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700 hover:bg-slate-50 text-xs"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  {campaignModalStep === 'preview' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setCampaignModalStep('edit')}
                        className="px-4 py-2 border border-indigo-300 text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 text-xs transition"
                      >
                        ← Modify Fee Structure
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg transition text-xs flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Save & Launch Fee Campaign
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!campTitle.trim() || !campStart || !campEnd) {
                          setCampDateError('Campaign Title, Start Date, and End Date are mandatory.');
                          return;
                        }
                        if (campLateFeeStartDate && (campLateFeeStartDate <= campStart || campLateFeeStartDate >= campEnd)) {
                          setCampDateError(
                            `Late Fee Start Date (${campLateFeeStartDate}) must be strictly after Campaign Start Date (${campStart}) and before End Date (${campEnd}).`
                          );
                          return;
                        }
                        setCampDateError('');
                        setCampaignModalStep('preview');
                      }}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition text-xs flex items-center gap-1.5"
                    >
                      <span>Preview Net Fee Statement</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXTEND CAMPAIGN MODAL */}
      {extendingCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-amber-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Extend Campaign End Date</h3>
              <button onClick={() => setExtendingCampaign(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmExtension} className="p-6 space-y-4 text-xs font-sans">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                <p className="font-bold">Non-Destructive Extension Guarantee:</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Extending the deadline will update the campaign cut-off without overwriting, modifying, or deleting
                  any existing payment records or receipts of this campaign.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Campaign</label>
                <input
                  type="text"
                  disabled
                  value={extendingCampaign.title}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Previous End Date</label>
                <input
                  type="text"
                  disabled
                  value={extendingCampaign.endDate}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">New Extended End Date</label>
                <input
                  type="date"
                  value={newEndDateInput}
                  onChange={(e) => setNewEndDateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Extension</label>
                <textarea
                  rows={2}
                  value={extendReasonInput}
                  onChange={(e) => setExtendReasonInput(e.target.value)}
                  placeholder="e.g. Festival holiday extension granted by executive order"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExtendingCampaign(null)}
                  className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md"
                >
                  Confirm Date Extension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FEE HEAD ADD/EDIT MODAL (CREATED WITHOUT STATIC AMOUNT) */}
      {isHeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">{editingHead ? 'Edit Fee Head' : 'Add New Fee Head (Categorical)'}</h3>
              <button onClick={() => setIsHeadModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFeeHead} className="p-6 space-y-4 text-xs font-sans">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-xs leading-relaxed">
                <strong>Institutional Policy:</strong> Fee heads are created categorically without static amounts.
                Specific rupee amounts are captured per-course when creating a Fee Campaign.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Fee Head Title *</label>
                <input
                  type="text"
                  value={headTitle}
                  onChange={(e) => setHeadTitle(e.target.value)}
                  placeholder="e.g. Semester Tuition Fee or Laboratory Practical Fee"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={headCategory}
                    onChange={(e) => setHeadCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold"
                  >
                    <option value="Tuition">Tuition</option>
                    <option value="Examination">Examination</option>
                    <option value="Laboratory">Laboratory</option>
                    <option value="Library">Library</option>
                    <option value="Development">Development</option>
                    <option value="Hostel">Hostel</option>
                    <option value="Transport">Transport</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Due Date</label>
                  <input
                    type="date"
                    value={headDueDate}
                    onChange={(e) => setHeadDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Purpose</label>
                <textarea
                  rows={2}
                  value={headDesc}
                  onChange={(e) => setHeadDesc(e.target.value)}
                  placeholder="e.g. Academic tuition fee covering faculty lectures and library usage"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsHeadModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md"
                >
                  Save Fee Head
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONCESSION MODAL */}
      {isConcessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Define Parameter-Based Concession</h3>
              <button onClick={() => setIsConcessionModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateConcessionRule} className="p-6 space-y-4 text-xs font-sans">
              {concError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{concError}</span>
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Concession Policy Title</label>
                <input
                  type="text"
                  value={concTitle}
                  onChange={(e) => setConcTitle(e.target.value)}
                  placeholder="e.g. Merit Board Scholarship (Marks ≥ 85%)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Enrollment Parameter</label>
                <select
                  value={concParamKey}
                  onChange={(e) => setConcParamKey(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold"
                >
                  {enrollmentFields.map((f) => (
                    <option key={f.id} value={f.key}>
                      {f.label} ({f.key})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Condition</label>
                  <select
                    value={concCondition}
                    onChange={(e) => setConcCondition(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50"
                  >
                    <option value="greater_than">Greater than or Equal (≥)</option>
                    <option value="less_than">Less than or Equal (≤)</option>
                    <option value="equals">Equals Exact Value (=)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Threshold / Match Value</label>
                  <input
                    type="text"
                    value={concValue}
                    onChange={(e) => setConcValue(e.target.value)}
                    placeholder="e.g. 85 or Staff Ward"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Discount Mode</label>
                  <select
                    value={concDiscountType}
                    onChange={(e) => setConcDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (INR)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Discount Value</label>
                  <input
                    type="number"
                    value={concDiscountVal}
                    onChange={(e) => setConcDiscountVal(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConcessionModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md"
                >
                  Save Concession
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE RECEIPT MODAL */}
      <PrintableReceipt
        transaction={receiptTxn}
        student={students.find((s) => s.id === receiptTxn?.studentId)}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
      />

      {/* NOTICE BROADCAST MODAL (ACCOUNTANT) */}
      {onPostNotice && (
        <NoticeBroadcastModal
          isOpen={isNoticeModalOpen}
          onClose={() => setIsNoticeModalOpen(false)}
          authorName={currentUser.name}
          authorRole={currentUser.designation || 'Senior Accounts Officer'}
          availableCourses={distinctCourses}
          defaultCategory="Fees"
          onPostNotice={onPostNotice}
        />
      )}
    </div>
  );
};
