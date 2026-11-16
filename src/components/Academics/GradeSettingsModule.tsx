import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UserRole,
  UserAccount,
  GradeEvaluationHead,
  SemesterResultDeclaration,
  ExamTypeConfig,
  ExamEvaluationHead,
  HeadEvaluationFormat,
  StudentExamEvaluation,
  CompactAuditLog,
  ExamEvaluationStatus,
} from '../../types/erp';
import { erpStorage } from '../../services/erpStorage';
import { getISTDateString, getCurrentAcademicYear, generateSecureId } from '../../utils/erpLogic';
import {
  Sliders,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit3,
  Lock,
  Unlock,
  Check,
  Save,
  Clock,
  Sparkles,
  BookOpen,
  Layers,
  Calendar,
  X,
  ShieldCheck,
  Award,
  FileCheck,
  RotateCcw,
  UserCheck,
  MessageSquare,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface GradeSettingsModuleProps {
  currentRole?: UserRole;
  currentUser?: UserAccount;
  gradeHeads?: GradeEvaluationHead[];
  onSaveGradeHeads?: (heads: GradeEvaluationHead[]) => void;
  resultDeclarations?: SemesterResultDeclaration[];
  onSaveResultDeclarations?: (declarations: SemesterResultDeclaration[]) => void;
  availableCourses?: string[];
  onRefreshAcademicState?: () => void;
}

export const GradeSettingsModule: React.FC<GradeSettingsModuleProps> = ({
  currentRole = 'principal',
  currentUser,
  gradeHeads: initialGradeHeads,
  onSaveGradeHeads,
  resultDeclarations: initialDeclarations,
  onSaveResultDeclarations,
  availableCourses = [
    'All Courses',
    'B.Tech Computer Science & Engineering',
    'B.Tech Electronics & Communication',
    'BCA (Bachelor of Computer Applications)',
    'B.Sc. Information Technology',
    'B.Sc Physics Hons',
    'B.Com Hons Accounting',
  ],
  onRefreshAcademicState,
}) => {
  const [activeTab, setActiveTab] = useState<'heads' | 'approvals' | 'publications'>('heads');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const saveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedOfficerName = (currentUser?.name || '').trim() || 'Authorized Officer';

  const showNotification = (msg: string, isError: boolean = false) => {
    if (saveToastTimerRef.current) {
      clearTimeout(saveToastTimerRef.current);
      saveToastTimerRef.current = null;
    }
    if (isError) {
      setErrorToast(msg);
      setSaveToast(null);
    } else {
      setErrorToast(null);
      setSaveToast(msg);
    }
    saveToastTimerRef.current = setTimeout(() => {
      saveToastTimerRef.current = null;
      setSaveToast(null);
      setErrorToast(null);
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (saveToastTimerRef.current) {
        clearTimeout(saveToastTimerRef.current);
        saveToastTimerRef.current = null;
      }
    };
  }, []);

  // --------------------------------------------------------------------------
  // EXAM TYPES & EXAM EVALUATION HEADS (Principal Decides Heads Per Exam)
  // --------------------------------------------------------------------------
  const [examTypesList, setExamTypesList] = useState<ExamTypeConfig[]>(() =>
    erpStorage.getExamTypes()
  );
  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    const list = erpStorage.getExamTypes();
    const active = list.find((e) => e.enabled);
    return active ? active.id : list[0]?.id || 'EXAM-ANNUAL';
  });

  const [allExamHeads, setAllExamHeads] = useState<ExamEvaluationHead[]>(() =>
    erpStorage.getExamEvaluationHeads()
  );

  // Heads strictly filtered for selected Exam Type with deterministic secondary sort
  const currentExamHeads = useMemo(() => {
    return allExamHeads
      .filter((h) => h.examTypeId === selectedExamId)
      .sort((a, b) => (a.sequence - b.sequence) || (a.id || '').localeCompare(b.id || ''));
  }, [allExamHeads, selectedExamId]);

  const selectedExam = useMemo(() => {
    return examTypesList.find((e) => e.id === selectedExamId) || examTypesList[0];
  }, [examTypesList, selectedExamId]);

  // Modal State for Exam Heads
  const [isAddExamHeadModalOpen, setIsAddExamHeadModalOpen] = useState(false);
  const [editingExamHead, setEditingExamHead] = useState<ExamEvaluationHead | null>(null);
  const [examHeadName, setExamHeadName] = useState('');
  const [examHeadFormat, setExamHeadFormat] = useState<HeadEvaluationFormat>('marks');
  const [examHeadMaxMarks, setExamHeadMaxMarks] = useState<number>(70);
  const [examHeadPassingMarks, setExamHeadPassingMarks] = useState<number>(28);
  const [examHeadOptions, setExamHeadOptions] = useState(
    'O (Outstanding), A+ (Excellent), A (Very Good), B+ (Good), B (Satisfactory), P (Pass), F (Fail)'
  );
  const [examHeadRequired, setExamHeadRequired] = useState(true);
  const [examHeadDesc, setExamHeadDesc] = useState('');

  // --------------------------------------------------------------------------
  // APPROVAL & LOCK DESK (Teacher Submits -> Principal Approves & Publishes)
  // --------------------------------------------------------------------------
  const [evaluationsList, setEvaluationsList] = useState<StudentExamEvaluation[]>(() =>
    erpStorage.getStudentExamEvaluations()
  );
  const [approvalFilterExam, setApprovalFilterExam] = useState<string>('All');
  const [approvalFilterStatus, setApprovalFilterStatus] = useState<string>('All');
  const [selectedEvalIds, setSelectedEvalIds] = useState<string[]>([]);
  const [revisionNoteModalItem, setRevisionNoteModalItem] = useState<StudentExamEvaluation | null>(null);
  const [revisionNoteText, setRevisionNoteText] = useState('');

  const filteredApprovalEvaluations = useMemo(() => {
    return evaluationsList.filter((item) => {
      if (approvalFilterExam !== 'All' && item.examTypeId !== approvalFilterExam) return false;
      if (approvalFilterStatus !== 'All' && item.status !== approvalFilterStatus) return false;
      return true;
    });
  }, [evaluationsList, approvalFilterExam, approvalFilterStatus]);

  const selectableApprovalIds = useMemo(() => {
    return filteredApprovalEvaluations
      .filter((item) => item.status === 'Submitted_For_Review')
      .map((item) => item.id);
  }, [filteredApprovalEvaluations]);

  useEffect(() => {
    setSelectedEvalIds((prev) => prev.filter((id) => selectableApprovalIds.includes(id)));
  }, [selectableApprovalIds]);

  // Synchronize with erpStorage updates across tabs/components
  useEffect(() => {
    const syncFromStorage = () => {
      const latestExamTypes = erpStorage.getExamTypes();
      setExamTypesList(latestExamTypes);
      setAllExamHeads(erpStorage.getExamEvaluationHeads());
      setEvaluationsList(erpStorage.getStudentExamEvaluations());
      setDeclarations(erpStorage.getResultDeclarations());
    };
    const unsubscribe = erpStorage.subscribe(syncFromStorage);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (initialDeclarations && initialDeclarations.length > 0) {
      setDeclarations(initialDeclarations);
    }
  }, [initialDeclarations]);

  const saveExamHeadsState = (updated: ExamEvaluationHead[], msg?: string) => {
    setAllExamHeads(updated);
    erpStorage.saveExamEvaluationHeads(updated);
    if (onSaveGradeHeads) {
      const mappedGradeHeads: GradeEvaluationHead[] = updated
        .filter((h) => h.examTypeId === selectedExamId)
        .sort((a, b) => (a.sequence - b.sequence) || (a.id || '').localeCompare(b.id || ''))
        .map((h) => ({
          id: h.id,
          name: h.name,
          type: h.format === 'marks' ? 'number' : 'dropdown',
          dropdownOptions: h.dropdownOptions,
          maxMarks: h.format === 'marks' ? h.maxMarks : undefined,
          minPassingMarks: h.format === 'marks' ? h.passingMarks : undefined,
          sequence: h.sequence,
        }));
      onSaveGradeHeads(mappedGradeHeads);
    }
    if (onRefreshAcademicState) onRefreshAcademicState();
    if (msg) showNotification(msg);
  };

  const handleOpenAddHeadModal = () => {
    if (!['principal', 'superadmin', 'accountant'].includes(currentRole)) {
      showNotification('Access denied: Only Principal, Super Admin, or Accountant may add evaluation heads.', true);
      return;
    }
    setEditingExamHead(null);
    setExamHeadName('');
    setExamHeadFormat('marks');
    setExamHeadMaxMarks(70);
    setExamHeadPassingMarks(28);
    setExamHeadOptions(
      'O (Outstanding), A+ (Excellent), A (Very Good), B+ (Good), B (Satisfactory), P (Pass), F (Fail)'
    );
    setExamHeadRequired(true);
    setExamHeadDesc('');
    setIsAddExamHeadModalOpen(true);
  };

  const handleOpenEditHeadModal = (head: ExamEvaluationHead) => {
    if (!['principal', 'superadmin', 'accountant'].includes(currentRole)) {
      showNotification('Access denied: Only Principal, Super Admin, or Accountant may edit evaluation heads.', true);
      return;
    }
    setEditingExamHead(head);
    setExamHeadName(head.name);
    setExamHeadFormat(head.format);
    setExamHeadMaxMarks(head.maxMarks);
    setExamHeadPassingMarks(head.passingMarks);
    setExamHeadOptions(head.dropdownOptions?.join(', ') || '');
    setExamHeadRequired(head.isRequired);
    setExamHeadDesc(head.description || '');
    setIsAddExamHeadModalOpen(true);
  };

  const handleSaveExamHeadForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!['principal', 'superadmin', 'accountant'].includes(currentRole)) {
      showNotification('Access denied: Only Principal, Super Admin, or Accountant may modify evaluation heads.', true);
      return;
    }
    if (!examHeadName.trim()) {
      showNotification('Evaluation head name is required.', true);
      return;
    }

    const parsedMax = Number(examHeadMaxMarks);
    if (examHeadFormat === 'marks' && (Number.isNaN(parsedMax) || parsedMax < 0)) {
      showNotification('Max Marks ceiling must be a valid non-negative number (0 marks permitted for non-credit / qualitative audit heads).', true);
      return;
    }

    const safeMax = examHeadFormat === 'marks' ? Math.max(0, Number(examHeadMaxMarks) || 0) : 0;
    const safePass =
      examHeadFormat === 'marks'
        ? Math.min(safeMax, Math.max(0, Number(examHeadPassingMarks) || 0))
        : 0;

    const cleanOptions = (examHeadOptions || '')
      .split(',')
      .map((o) => o.trim().replace(/\s+/g, ' '))
      .filter(Boolean);

    if (
      (examHeadFormat === 'dropdown' || examHeadFormat === 'grades_only') &&
      cleanOptions.length === 0
    ) {
      showNotification('Dropdown options cannot be empty. Please enter at least one valid option (e.g. "Pass, Fail").', true);
      return;
    }

    const parsedOptions =
      examHeadFormat === 'dropdown' || examHeadFormat === 'grades_only'
        ? cleanOptions
        : undefined;

    if (editingExamHead) {
      const updated = allExamHeads.map((h) =>
        h.id === editingExamHead.id
          ? {
              ...h,
              name: examHeadName.trim(),
              format: examHeadFormat,
              maxMarks: safeMax,
              passingMarks: safePass,
              dropdownOptions: parsedOptions,
              isRequired: examHeadRequired,
              description: examHeadDesc.trim(),
            }
          : h
      );
      saveExamHeadsState(updated, `Updated marks head "${examHeadName.trim()}".`);
    } else {
      const newHead: ExamEvaluationHead = {
        id: generateSecureId('HEAD'),
        examTypeId: selectedExamId,
        name: examHeadName.trim(),
        format: examHeadFormat,
        maxMarks: safeMax,
        passingMarks: safePass,
        dropdownOptions: parsedOptions,
        sequence: currentExamHeads.length + 1,
        isRequired: examHeadRequired,
        description: examHeadDesc.trim(),
      };
      saveExamHeadsState([...allExamHeads, newHead], `Added marks head "${newHead.name}" to ${selectedExam?.name}.`);
    }
    setIsAddExamHeadModalOpen(false);
  };

  const handleDeleteExamHead = (headId: string) => {
    if (!['principal', 'superadmin', 'accountant'].includes(currentRole)) {
      showNotification('Access denied: Only Principal, Super Admin, or Accountant may delete evaluation heads.', true);
      return;
    }
    const target = allExamHeads.find((h) => h.id === headId);
    const remainingForExam = currentExamHeads
      .filter((h) => h.id !== headId)
      .map((h, idx) => ({ ...h, sequence: idx + 1 }));
    const remainingMap = new Map<string, ExamEvaluationHead>(remainingForExam.map((h) => [h.id, h]));
    const updated = allExamHeads
      .filter((h) => h.id !== headId)
      .map((h) => {
        if (h.examTypeId === selectedExamId && remainingMap.has(h.id)) {
          return remainingMap.get(h.id)!;
        }
        return h;
      });
    saveExamHeadsState(updated, `Removed marks head "${target?.name}".`);
  };

  const handleMoveExamHead = (index: number, direction: 'up' | 'down') => {
    if (!['principal', 'superadmin', 'accountant'].includes(currentRole)) {
      showNotification('Access denied: Only Principal, Super Admin, or Accountant may reorder evaluation heads.', true);
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentExamHeads.length) return;

    // Deep-clone array elements to prevent state contamination on shallow copies
    const list = currentExamHeads.map((h) => ({ ...h }));
    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);

    // Scope sequence updates strictly to selectedExamId via O(1) Map lookup (Bug 131)
    const seqMap = new Map<string, number>(list.map((h, idx) => [h.id, idx + 1]));
    const updated = allExamHeads.map((h) => {
      if (h.examTypeId === selectedExamId && seqMap.has(h.id)) {
        return { ...h, sequence: seqMap.get(h.id)! };
      }
      return h;
    });
    saveExamHeadsState(updated, `Reordered head sequence.`);
  };

  // Approval Handlers
  const handleApproveEvaluation = (id: string) => {
    if (!['principal', 'superadmin'].includes(currentRole)) {
      showNotification('Access denied: Only Principal or Super Admin may approve and publish student marks.', true);
      return;
    }
    try {
      const updated = erpStorage.bulkApproveExamEvaluations([id], resolvedOfficerName);
      setEvaluationsList(updated);
      if (onRefreshAcademicState) onRefreshAcademicState();
      try {
        if (typeof window !== 'undefined' && typeof confetti === 'function') {
          const prefersReduced =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)')?.matches;
          if (!prefersReduced) {
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
          }
        }
      } catch {}
      showNotification('Student marks approved and published to student portal!');
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Unable to approve evaluation.', true);
    }
  };

  const handleBatchApprove = () => {
    if (!['principal', 'superadmin'].includes(currentRole)) {
      showNotification('Access denied: Only Principal or Super Admin may batch-approve student marks.', true);
      return;
    }
    if (selectedEvalIds.length === 0) return;
    try {
      const updated = erpStorage.bulkApproveExamEvaluations(selectedEvalIds, resolvedOfficerName);
      setEvaluationsList(updated);
      setSelectedEvalIds([]);
      if (onRefreshAcademicState) onRefreshAcademicState();
      try {
        if (typeof window !== 'undefined' && typeof confetti === 'function') {
          const prefersReduced =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)')?.matches;
          if (!prefersReduced) {
            confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
          }
        }
      } catch {}
      showNotification(`Approved and published ${selectedEvalIds.length} evaluation records!`);
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Unable to batch-approve evaluations.', true);
    }
  };

  const handleOpenRevisionModal = (item: StudentExamEvaluation) => {
    if (!['principal', 'superadmin'].includes(currentRole)) {
      showNotification('Access denied: Only Principal or Super Admin may request grade revisions.', true);
      return;
    }
    setRevisionNoteModalItem(item);
    setRevisionNoteText('');
  };

  const handleConfirmRevision = () => {
    if (!['principal', 'superadmin'].includes(currentRole)) {
      showNotification('Access denied: Only Principal or Super Admin may request grade revisions.', true);
      return;
    }
    if (!revisionNoteModalItem) return;
    const cleanReason = revisionNoteText.trim();
    if (!cleanReason) {
      showNotification('Revision explanation is mandatory. Please enter detailed re-verification notes for faculty.', true);
      return;
    }
    try {
      const updated = erpStorage.bulkRequestRevisionExamEvaluations(
        [revisionNoteModalItem.id],
        cleanReason
      );
      setEvaluationsList(updated);
      if (onRefreshAcademicState) onRefreshAcademicState();
      setRevisionNoteModalItem(null);
      setRevisionNoteText('');
      showNotification(`Revision requested from faculty member for ${revisionNoteModalItem.studentName}.`);
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Unable to request revision.', true);
    }
  };

  // --------------------------------------------------------------------------
  // TAB 2: RESULT PUBLICATION DATES & RELEASE STATUS STATE
  // --------------------------------------------------------------------------
  const [declarations, setDeclarations] = useState<SemesterResultDeclaration[]>(() => {
    if (initialDeclarations && initialDeclarations.length > 0) {
      return initialDeclarations;
    }
    return erpStorage.getResultDeclarations();
  });

  const [filterFY, setFilterFY] = useState<string>('All');
  const [filterCourse, setFilterCourse] = useState<string>('All');
  const [filterSem, setFilterSem] = useState<string>('All');

  // Add declaration form state
  const [isAddCycleModalOpen, setIsAddCycleModalOpen] = useState(false);
  const [newDecFY, setNewDecFY] = useState(() => getCurrentAcademicYear());
  const [newDecSem, setNewDecSem] = useState<number>(5);
  const [newDecCourse, setNewDecCourse] = useState('All Courses');
  const [newDecDate, setNewDecDate] = useState(() =>
    getISTDateString(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
  );
  const [newDecRemarks, setNewDecRemarks] = useState('');
  const [newDecImmediatePublish, setNewDecImmediatePublish] = useState(false);
  const [pendingLockOverride, setPendingLockOverride] = useState<{
    action: 'unpublish' | 'future_date' | 'delete';
    decId: string;
    newDate?: string;
    course: string;
    semester: number;
  } | null>(null);
  const [lockOverrideReason, setLockOverrideReason] = useState('');

  const syncDeclarationsState = (updated: SemesterResultDeclaration[], msg?: string) => {
    setDeclarations(updated);
    onSaveResultDeclarations?.(updated);
    onRefreshAcademicState?.();
    if (msg) showNotification(msg);
  };

  const handleTogglePublication = (decId: string, currentStatus?: boolean, overrideReason?: string) => {
    if (!['principal', 'superadmin'].includes(currentRole)) {
      showNotification('Only Principal or Super Admin may publish or withhold result declarations.', true);
      return;
    }
    const nextStatus = !currentStatus;
    const target = declarations.find((d) => d.id === decId);
    const wasLocked = Boolean(target && (target.isLocked || target.isPublished || target.status === 'Published'));
    if (!nextStatus && wasLocked && (!overrideReason || overrideReason.trim().length < 10)) {
      setPendingLockOverride({
        action: 'unpublish',
        decId,
        course: target?.course || 'All Courses',
        semester: target?.semester || 1,
      });
      setLockOverrideReason('');
      return;
    }

    try {
      const updated = erpStorage.toggleResultPublication(
        decId,
        nextStatus,
        resolvedOfficerName,
        currentRole,
        overrideReason
      );
      if (nextStatus) {
        try {
          const prefersReduced =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)')?.matches;
          if (!prefersReduced) {
            confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
          }
        } catch {}
        syncDeclarationsState(
          updated,
          `Result declared and marksheet access unlocked for students!`
        );
      } else {
        syncDeclarationsState(
          updated,
          `Result publication status reverted to Scheduled (Marksheets withheld).`
        );
      }
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Unable to update publication status.', true);
    }
  };

  const handleUpdateDeclarationDate = (decId: string, newDate: string, overrideReason?: string) => {
    if (!['principal', 'superadmin'].includes(currentRole)) {
      showNotification('Only Principal or Super Admin may update result declaration dates.', true);
      return;
    }
    const todayLocal = getISTDateString();
    const target = declarations.find((d) => d.id === decId);
    const wasLocked = Boolean(
      target &&
        (target.isLocked ||
          target.isPublished ||
          target.status === 'Published' ||
          (target.declarationDate && target.declarationDate <= todayLocal))
    );
    const movingToFuture = Boolean(newDate && newDate > todayLocal);
    if (wasLocked && movingToFuture && (!overrideReason || overrideReason.trim().length < 10)) {
      setPendingLockOverride({
        action: 'future_date',
        decId,
        newDate,
        course: target?.course || 'All Courses',
        semester: target?.semester || 1,
      });
      setLockOverrideReason('');
      return;
    }

    try {
      const updated = erpStorage.updateResultDeclarationDate(
        decId,
        newDate,
        currentRole as 'principal' | 'superadmin',
        resolvedOfficerName,
        undefined,
        overrideReason
      );
      syncDeclarationsState(updated, `Result publication target date updated to ${newDate}.`);
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Unable to update result declaration date.', true);
    }
  };

  const handleCreateDeclaration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!['principal', 'superadmin'].includes(currentRole)) {
      showNotification('Only Principal or Super Admin may schedule result declarations.', true);
      return;
    }
    const today = getISTDateString();

    // Future-dated declarations remain Scheduled even if immediate publish is requested
    const isFuture = Boolean(newDecDate && newDecDate > today);
    const effectivePublished = newDecImmediatePublish && !isFuture;

    const parsedDecSem = Number(newDecSem);
    const safeDecSem =
      !Number.isNaN(parsedDecSem) && Number.isInteger(parsedDecSem) && parsedDecSem >= 1 && parsedDecSem <= 10
        ? parsedDecSem
        : 1;

    try {
      const updated = erpStorage.addResultDeclaration(
        {
          financialYear: newDecFY,
          semester: safeDecSem,
          course: newDecCourse,
          declarationDate: newDecDate,
          declaredByRole: (['principal', 'superadmin'].includes(currentRole) ? currentRole : 'principal') as 'principal' | 'superadmin',
          declaredByName: `${resolvedOfficerName} (${currentRole})`,
          remarks: newDecRemarks || 'Official statutory examination result cycle',
          isPublished: effectivePublished,
          status: effectivePublished ? 'Published' : 'Scheduled',
          publishedAt: effectivePublished ? today : undefined,
          publishedBy: effectivePublished ? `${resolvedOfficerName} (${currentRole})` : undefined,
        },
        currentRole
      );
      syncDeclarationsState(
        updated,
        `Created result declaration schedule for Semester ${safeDecSem} (${newDecCourse}).`
      );
      setIsAddCycleModalOpen(false);
      setNewDecRemarks('');
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Unable to create result declaration schedule.', true);
    }
  };

  const handleDeleteDeclaration = (decId: string, overrideReason?: string) => {
    if (!['principal', 'superadmin'].includes(currentRole)) {
      showNotification('Only Principal or Super Admin may remove result declarations.', true);
      return;
    }
    const target = declarations.find((d) => d.id === decId);
    if (target && (target.isPublished || target.isLocked) && (!overrideReason || overrideReason.trim().length < 10)) {
      setPendingLockOverride({
        action: 'delete',
        decId,
        course: target.course,
        semester: target.semester,
      });
      setLockOverrideReason('');
      return;
    }

    try {
      const updated = erpStorage.deleteResultDeclaration(decId, currentRole, overrideReason);
      syncDeclarationsState(updated, 'Removed result declaration schedule.');
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Unable to remove result declaration.', true);
    }
  };

  const handleConfirmLockOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingLockOverride) return;
    const reason = lockOverrideReason.trim();
    if (reason.length < 10) {
      showNotification('Approval justification must be at least 10 characters long.', true);
      return;
    }
    const pending = pendingLockOverride;
    setPendingLockOverride(null);
    setLockOverrideReason('');
    if (pending.action === 'unpublish') {
      handleTogglePublication(pending.decId, true, reason);
    } else if (pending.action === 'future_date' && pending.newDate) {
      handleUpdateDeclarationDate(pending.decId, pending.newDate, reason);
    } else if (pending.action === 'delete') {
      handleDeleteDeclaration(pending.decId, reason);
    }
  };

  const filteredDeclarations = useMemo(() => {
    return declarations.filter((d) => {
      if (filterFY !== 'All' && d.financialYear !== filterFY) return false;
      if (filterCourse !== 'All' && d.course !== filterCourse) return false;
      if (filterSem !== 'All' && String(d.semester) !== filterSem) return false;
      return true;
    });
  }, [declarations, filterFY, filterCourse, filterSem]);

  const uniqueFYs = useMemo(() => {
    const validYears = declarations
      .map((d) => (d.financialYear ? String(d.financialYear).trim() : ''))
      .filter((fy) => fy.length > 0);
    const set = new Set(validYears);
    return ['All', ...Array.from(set)];
  }, [declarations]);

  const todayStr = getISTDateString();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Academic Grade Setting & Examination Governance
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Statutory configuration for evaluation heads, max marks caps, and semester-wise result publication release dates.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center flex-wrap bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('heads')}
            className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'heads'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            Marks Heads per Exam Type
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 relative ${
              activeTab === 'approvals'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Approval &amp; Lock Desk
            {evaluationsList.filter((e) => e.status === 'Submitted_For_Review').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('publications')}
            className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'publications'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Result Schedules &amp; Scale
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {saveToast && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveToast}</span>
          </div>
          <button onClick={() => setSaveToast(null)} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: EVALUATION HEADS PER EXAM TYPE (Principal Decides) */}
      {activeTab === 'heads' && (
        <div className="space-y-6">
          {/* Exam Type Selector Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Select Examination Scheme
              </span>
              <div className="flex items-center gap-3">
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {examTypesList.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} ({exam.code}) — {exam.showInStudentMarksheet ? 'Main Marksheet' : 'Other Exams'}
                    </option>
                  ))}
                </select>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    selectedExam?.showInStudentMarksheet
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {selectedExam?.showInStudentMarksheet
                    ? '✓ Shows in Student Marksheet'
                    : '★ Routes to "Other Exams" Scorecard'}
                </span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                {selectedExam?.description || 'Configured by College Examination Board'}
              </p>
            </div>

            <button
              onClick={handleOpenAddHeadModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Evaluation Head
            </button>
          </div>

          {/* Key Metric Cards for Selected Exam */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                Configured Heads
              </span>
              <p className="text-3xl font-black text-slate-900 mt-1">{currentExamHeads.length}</p>
              <p className="text-xs text-slate-500 mt-1">For {selectedExam?.name}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                Cumulative Numeric Max Marks
              </span>
              <p className="text-3xl font-black text-indigo-700 font-mono mt-1">
                {currentExamHeads
                  .filter((h) => h.format === 'marks')
                  .reduce((sum, h) => sum + (h.maxMarks || 0), 0)} pts
              </p>
              <p className="text-xs text-slate-500 mt-1">Sum of theoretical and practical heads</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                Passing Marks Threshold
              </span>
              <p className="text-3xl font-black text-emerald-700 font-mono mt-1">
                {currentExamHeads
                  .filter((h) => h.format === 'marks')
                  .reduce((sum, h) => sum + (h.passingMarks || 0), 0)} pts
              </p>
              <p className="text-xs text-slate-500 mt-1">Minimum qualifying cumulative score</p>
            </div>
          </div>

          {/* Evaluation Heads Table for Selected Exam */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Marks Heads Defined by Principal ({selectedExam?.name})
                </h3>
                <p className="text-xs text-slate-500">
                  Teachers enter marks, grades, and remarks strictly using the heads configured below for their assigned classes.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 text-slate-600 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-center w-16">Seq</th>
                    <th className="px-4 py-3">Head Title</th>
                    <th className="px-4 py-3">Evaluation Format</th>
                    <th className="px-4 py-3">Max Marks</th>
                    <th className="px-4 py-3">Passing Marks</th>
                    <th className="px-4 py-3">Requirement</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {currentExamHeads.map((head, index) => {
                    const isMarks = head.format === 'marks';

                    return (
                      <tr key={head.id} className="hover:bg-slate-50/80 transition">
                        {/* Sequence */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-mono font-bold text-slate-700 w-5 text-center">
                              #{head.sequence}
                            </span>
                            <div className="flex flex-col">
                              <button
                                disabled={index === 0}
                                onClick={() => handleMoveExamHead(index, 'up')}
                                className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                disabled={index === currentExamHeads.length - 1}
                                onClick={() => handleMoveExamHead(index, 'down')}
                                className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{head.name}</div>
                          {head.description && (
                            <div className="text-xs text-slate-400 max-w-xs truncate">{head.description}</div>
                          )}
                        </td>

                        {/* Format */}
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold uppercase font-mono ${
                              head.format === 'marks'
                                ? 'bg-indigo-100 text-indigo-800'
                                : head.format === 'grades_only'
                                ? 'bg-amber-100 text-amber-800'
                                : head.format === 'remarks'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {head.format === 'marks'
                              ? 'Numeric (Marks)'
                              : head.format === 'grades_only'
                              ? 'Grades Only (O-F)'
                              : head.format === 'remarks'
                              ? 'Faculty Remarks'
                              : 'Custom Dropdown'}
                          </span>
                        </td>

                        {/* Max Marks */}
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {isMarks ? `${head.maxMarks} pts` : <span className="text-slate-400 font-normal">Qualitative</span>}
                        </td>

                        {/* Passing Marks */}
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {isMarks ? `${head.passingMarks} pts` : <span className="text-slate-400 font-normal">N/A</span>}
                        </td>

                        {/* Requirement */}
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold ${
                              head.isRequired ? 'text-rose-600' : 'text-slate-400'
                            }`}
                          >
                            {head.isRequired ? 'Mandatory' : 'Optional'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditHeadModal(head)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Edit Evaluation Head"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteExamHead(head.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Evaluation Head"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {currentExamHeads.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No marks heads configured yet for {selectedExam?.name}. Click &ldquo;Add Evaluation Head&rdquo; above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add / Edit Exam Head Modal */}
          {isAddExamHeadModalOpen && (
            <div role="dialog" aria-modal="true" aria-label="Add or Edit Exam Head Dialog" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-sm">
                      {editingExamHead ? 'Edit Marks Head' : `Add Marks Head to ${selectedExam?.name}`}
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsAddExamHeadModalOpen(false)}
                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveExamHeadForm} className="p-6 space-y-4">
                  {/* Preset Quick Selectors */}
                  {!editingExamHead && (
                    <div>
                      <span className="text-xs uppercase font-bold text-slate-400 block mb-1 font-mono">
                        Quick Standard Presets
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { name: 'Theory Written', format: 'marks', max: 70, pass: 28 },
                          { name: 'Practical & Lab', format: 'marks', max: 20, pass: 8 },
                          { name: 'Oral / Viva Voce', format: 'marks', max: 10, pass: 4 },
                          { name: 'Internal Assessment', format: 'marks', max: 20, pass: 8 },
                          { name: 'Co-Scholastic Conduct', format: 'grades_only', max: 0, pass: 0 },
                          { name: 'Faculty Remarks', format: 'remarks', max: 0, pass: 0 },
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setExamHeadName(preset.name);
                              setExamHeadFormat(preset.format as HeadEvaluationFormat);
                              setExamHeadMaxMarks(preset.max);
                              setExamHeadPassingMarks(preset.pass);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-xs font-medium transition"
                          >
                            + {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Head Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={examHeadName}
                      onChange={(e) => setExamHeadName(e.target.value)}
                      placeholder="e.g. Theory, Practical, Oral, Internal Assessment, Remarks"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Evaluation Format
                      </label>
                      <select
                        value={examHeadFormat}
                        onChange={(e) => setExamHeadFormat(e.target.value as HeadEvaluationFormat)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="marks">Numeric Marks</option>
                        <option value="grades_only">Grades Only (O, A+, A, etc.)</option>
                        <option value="remarks">Faculty Remarks / Text</option>
                        <option value="dropdown">Custom Selectable Dropdown</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Mandatory Field
                      </label>
                      <div className="pt-2">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={examHeadRequired}
                            onChange={(e) => setExamHeadRequired(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <span className="ml-2 text-xs text-slate-700">Must be entered by teacher</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {examHeadFormat === 'marks' && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Max Marks Ceiling <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          step="0.5"
                          value={examHeadMaxMarks}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (raw === '') {
                              setExamHeadMaxMarks(0);
                              return;
                            }
                            const val = Number(raw);
                            if (!Number.isNaN(val) && val > 0) {
                              setExamHeadMaxMarks(val);
                              if (examHeadPassingMarks > val) {
                                setExamHeadPassingMarks(Math.round(val * 0.4));
                              }
                            }
                          }}
                          required
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Passing Marks Minimum
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={examHeadMaxMarks}
                          step="0.5"
                          value={examHeadPassingMarks}
                          onChange={(e) =>
                            setExamHeadPassingMarks(
                              Math.min(examHeadMaxMarks, Math.max(0, Number(e.target.value) || 0))
                            )
                          }
                          required
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {(examHeadFormat === 'dropdown' || examHeadFormat === 'grades_only') && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Selectable Grade Options (Comma Separated)
                      </label>
                      <input
                        type="text"
                        value={examHeadOptions}
                        onChange={(e) => setExamHeadOptions(e.target.value)}
                        placeholder="e.g. O, A+, A, B+, B, C, P, F"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Guideline / Description
                    </label>
                    <textarea
                      value={examHeadDesc}
                      maxLength={500}
                      onChange={(e) => setExamHeadDesc(e.target.value.slice(0, 500))}
                      rows={2}
                      placeholder="e.g. Theoretical written examination paper under university syllabus"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddExamHeadModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingExamHead ? 'Save Changes' : 'Add Evaluation Head'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPROVAL & LOCK DESK (Principal Review of Faculty Entries) */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-slate-900 text-lg">
                    Marks Verification, Approval &amp; Lock Desk
                  </h3>
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    Principal Institutional Authorization
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Teachers enter marks for their mapped classes and submit for review. Marks remain locked and withheld from students until approved and published here by the Principal. Statutory university grace marks (up to 5 marks to reach passing threshold) and full mark revision trails are logged automatically.
                </p>
              </div>

              {selectedEvalIds.length > 0 && (
                <button
                  onClick={handleBatchApprove}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve Selected ({selectedEvalIds.length}) &amp; Publish</span>
                </button>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-bold uppercase text-slate-400 block font-mono">Total Evaluations</span>
                <span className="text-xl font-black text-slate-900">{evaluationsList.length}</span>
              </div>
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-xs font-bold uppercase text-amber-700 block font-mono">Awaiting Approval</span>
                <span className="text-xl font-black text-amber-900">
                  {evaluationsList.filter((e) => e.status === 'Submitted_For_Review').length}
                </span>
                <span className="text-xs text-amber-700 block">Locked from student view</span>
              </div>
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-xs font-bold uppercase text-emerald-600 block font-mono">Approved &amp; Published</span>
                <span className="text-xl font-black text-emerald-800">
                  {evaluationsList.filter((e) => e.status === 'Approved_Published').length}
                </span>
                <span className="text-xs text-emerald-600 block">Live in student portal</span>
              </div>
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-xs font-bold uppercase text-rose-700 block font-mono">Revision Requested</span>
                <span className="text-xl font-black text-rose-900">
                  {evaluationsList.filter((e) => e.status === 'Revision_Requested').length}
                </span>
                <span className="text-xs text-rose-700 block">Sent back to teacher</span>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Filter Submissions:</span>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-600 font-medium">Exam:</label>
              <select
                value={approvalFilterExam}
                onChange={(e) => {
                  setApprovalFilterExam(e.target.value);
                  setSelectedEvalIds([]);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="All">All Exam Types</option>
                {examTypesList.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-600 font-medium">Approval Status:</label>
              <select
                value={approvalFilterStatus}
                onChange={(e) => {
                  setApprovalFilterStatus(e.target.value);
                  setSelectedEvalIds([]);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Submitted_For_Review">Awaiting Review (Submitted)</option>
                <option value="Approved_Published">Approved &amp; Published</option>
                <option value="Draft">Faculty Draft</option>
                <option value="Revision_Requested">Revision Requested</option>
              </select>
            </div>
          </div>

          {/* Evaluations Verification Grid */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-mono text-xs border-b border-slate-200">
                  <tr>
                  <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        disabled={selectableApprovalIds.length === 0}
                        checked={
                          selectableApprovalIds.length > 0 &&
                          selectableApprovalIds.every((id) => selectedEvalIds.includes(id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEvalIds(selectableApprovalIds);
                          } else {
                            setSelectedEvalIds([]);
                          }
                        }}
                        className="w-3.5 h-3.5 text-indigo-600 rounded"
                      />
                    </th>
                    <th className="py-3 px-4">Student &amp; Roll No</th>
                    <th className="py-3 px-4">Subject &amp; Class</th>
                    <th className="py-3 px-4">Exam Type</th>
                    <th className="py-3 px-4">Total Score / Grade</th>
                    <th className="py-3 px-4">Review Status</th>
                    <th className="py-3 px-4">Compact Audit History</th>
                    <th className="py-3 px-4 text-right">Approval Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredApprovalEvaluations.map((item) => {
                      const examMeta = examTypesList.find((e) => e.id === item.examTypeId);
                      const isSelected = selectedEvalIds.includes(item.id);
                      const displayTotalMarks = item.totalMarksObtained ?? item.totalMarks ?? 0;
                      const displayMaxMarks = item.maxPossibleMarks ?? item.maxMarks ?? 100;
                      const displayGrade = item.overallGrade || item.letterGrade;
                      const displayAttendance = item.attendancePercentage ?? item.attendancePercent;
                      const displayFacultyName =
                        item.auditLog?.lastModifiedByFacultyName ||
                        item.lastAudit?.lastModifiedByFacultyName ||
                        item.facultyName ||
                        'Department Faculty';
                      const displayModifiedAt =
                        item.auditLog?.lastModifiedAt ||
                        item.lastAudit?.lastModifiedAt ||
                        item.submittedAt ||
                        'Initial Entry';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 text-center">
                            {item.status === 'Submitted_For_Review' && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedEvalIds([...selectedEvalIds, item.id]);
                                  } else {
                                    setSelectedEvalIds(selectedEvalIds.filter((id) => id !== item.id));
                                  }
                                }}
                                className="w-3.5 h-3.5 text-indigo-600 rounded"
                              />
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{item.studentName}</div>
                            <div className="text-xs font-mono text-indigo-600">{item.studentRollNo}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800">{item.subjectName}</div>
                            <div className="text-xs text-slate-500 font-mono">
                              {item.subjectCode} • Sem {item.semester} {item.section ? `(Sec ${item.section})` : ''}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-slate-800 block">
                              {examMeta?.name || item.examTypeId}
                            </span>
                            <span className="text-xs text-slate-400 block font-mono">
                              {examMeta?.showInStudentMarksheet ? 'Standard Marksheet' : 'Other Exams'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-baseline gap-1.5 font-mono">
                              <span className="font-bold text-slate-900 text-sm">{displayTotalMarks}</span>
                              <span className="text-slate-400 text-xs">/ {displayMaxMarks}</span>
                              {displayGrade && (
                                <span className="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-black">
                                  {displayGrade}
                                </span>
                              )}
                            </div>
                            {displayAttendance !== undefined && (
                              <span className="text-xs text-slate-400 block font-mono">
                                Att: {displayAttendance}%
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase font-mono ${
                                item.status === 'Approved_Published'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.status === 'Submitted_For_Review'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.status === 'Revision_Requested'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.status === 'Approved_Published'
                                ? '✓ Published to Student'
                                : item.status === 'Submitted_For_Review'
                                ? '⏳ Pending Approval'
                                : item.status === 'Revision_Requested'
                                ? '↺ Revision Asked'
                                : 'Draft'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {/* Compact Log: Faculty name, timestamp, and immutable revision history */}
                            <div className="text-xs text-slate-600 font-sans">
                              <span className="font-semibold text-slate-800 block">
                                {displayFacultyName}
                              </span>
                              <span className="text-xs text-slate-400 block font-mono">
                                {displayModifiedAt}
                              </span>
                              {item.revisionHistory && item.revisionHistory.length > 0 && (
                                <span
                                  className="mt-0.5 inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-xs font-bold"
                                  title={item.revisionHistory
                                    .map((r) => `${r.previousMarks}→${r.newMarks} by ${r.modifiedBy} (${r.modifiedAt})`)
                                    .join(' | ')}
                                >
                                  {item.revisionHistory.length} Revision(s) Logged
                                </span>
                              )}
                              {Boolean(item.graceApplied && item.graceApplied > 0) && (
                                <span className="mt-0.5 ml-1 inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-xs font-bold">
                                  +{item.graceApplied} Grace
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.status === 'Submitted_For_Review' && (
                                <>
                                  <button
                                    onClick={() => handleApproveEvaluation(item.id)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenRevisionModal(item)}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                    title="Request Revision"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Revise</span>
                                  </button>
                                </>
                              )}
                              {item.status === 'Approved_Published' && (
                                <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Live
                                </span>
                              )}
                              {item.status === 'Draft' && (
                                <span className="text-xs text-slate-400 italic">With Teacher</span>
                              )}
                              {item.status === 'Revision_Requested' && (
                                <span className="text-xs text-rose-600 italic">Awaiting Teacher</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal for Requesting Revision */}
          {revisionNoteModalItem && (
            <div role="dialog" aria-modal="true" aria-label="Request Revision from Faculty" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-rose-900 text-white flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="w-4 h-4 text-rose-300" />
                    <h3 className="font-bold text-sm">Request Revision from Faculty</h3>
                  </div>
                  <button
                    onClick={() => setRevisionNoteModalItem(null)}
                    className="p-1 hover:bg-rose-800 rounded-lg text-rose-200 hover:text-white transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-xs text-slate-600">
                    Send back marks for <strong>{revisionNoteModalItem.studentName}</strong> (
                    {revisionNoteModalItem.subjectName}) to{' '}
                    <strong>{revisionNoteModalItem.facultyName}</strong> for re-verification.
                  </p>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Revision Instructions / Notes
                    </label>
                    <textarea
                      value={revisionNoteText}
                      onChange={(e) => setRevisionNoteText(e.target.value)}
                      rows={3}
                      placeholder="e.g. Please re-check external marks tabulation or practical exam attendance percentage."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setRevisionNoteModalItem(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmRevision}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Send Back for Revision</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RESULT PUBLICATION DATES & RELEASE STATUS */}
      {activeTab === 'publications' && (
        <div className="space-y-6">
          {/* Top Info Banner */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-lg">
                    Official Semester Result Declaration & Release Controls
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Principal or Accountant will decide the date of results of each semester of FY wise. Published results are strictly withheld and embargoed until the official date or until explicitly unlocked below.
                </p>
              </div>

              <button
                onClick={() => setIsAddCycleModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Schedule Result Release
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Filters:</span>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-600 font-medium">Session FY:</label>
              <select
                value={filterFY}
                onChange={(e) => setFilterFY(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              >
                {uniqueFYs.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-600 font-medium">Course:</label>
              <select
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-xs"
              >
                <option value="All">All Courses</option>
                {availableCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-600 font-medium">Semester:</label>
              <select
                value={filterSem}
                onChange={(e) => setFilterSem(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              >
                <option value="All">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                  <option key={s} value={String(s)}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            <span className="ml-auto text-xs font-mono text-slate-400">
              Showing {filteredDeclarations.length} of {declarations.length} Cycles
            </span>
          </div>

          {/* Result Declarations Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 text-slate-600 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Academic FY</th>
                    <th className="px-4 py-3">Semester</th>
                    <th className="px-4 py-3">Target Course</th>
                    <th className="px-4 py-3">Target Publication Date</th>
                    <th className="px-4 py-3">Decided / Scheduled By</th>
                    <th className="px-4 py-3">Student Visibility Status</th>
                    <th className="px-4 py-3 text-center">Direct Release Toggle</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredDeclarations.map((dec) => {
                    const isPassedDate = todayStr >= dec.declarationDate;
                    const isOfficiallyPublished = dec.isPublished ?? isPassedDate;

                    return (
                      <tr key={dec.id} className="hover:bg-slate-50/80 transition">
                        {/* FY */}
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{dec.financialYear}</td>

                        {/* Semester */}
                        <td className="px-4 py-3 font-semibold text-slate-800">Semester {dec.semester}</td>

                        {/* Course */}
                        <td className="px-4 py-3 text-slate-700">{dec.course}</td>

                        {/* Publication Date Picker */}
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            value={dec.declarationDate}
                            onChange={(e) => handleUpdateDeclarationDate(dec.id, e.target.value)}
                            className="px-2 py-1 text-xs font-mono font-bold text-indigo-700 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>

                        {/* Decided By */}
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 block">{dec.declaredByName}</span>
                          <span className="text-xs text-slate-400 uppercase font-mono">{dec.declaredByRole}</span>
                        </td>

                        {/* Student Visibility */}
                        <td className="px-4 py-3">
                          {isOfficiallyPublished ? (
                            <span className="font-bold text-emerald-700 font-mono text-xs flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              UNLOCKED & VISIBLE
                            </span>
                          ) : (
                            <span className="font-bold text-amber-700 font-mono text-xs flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              WITHHELD (DUE {dec.declarationDate})
                            </span>
                          )}
                        </td>

                        {/* Direct Publish Toggle Button */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleTogglePublication(dec.id, isOfficiallyPublished)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition inline-flex items-center gap-1.5 shadow-sm ${
                              isOfficiallyPublished
                                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                          >
                            {isOfficiallyPublished ? (
                              <>
                                <Lock className="w-3.5 h-3.5 text-amber-700" />
                                Withhold Marksheet
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5 text-white" />
                                Publish Now
                              </>
                            )}
                          </button>
                        </td>

                        {/* Delete action */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteDeclaration(dec.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                            title="Remove Schedule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SCHEDULE RESULT RELEASE */}
      {isAddCycleModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Schedule Result Publication Cycle" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Schedule Result Publication Cycle</h3>
              </div>
              <button
                onClick={() => setIsAddCycleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDeclaration} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Financial Year (FY)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026-2027"
                    value={newDecFY}
                    onChange={(e) => setNewDecFY(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Semester</label>
                  <select
                    value={newDecSem}
                    onChange={(e) => setNewDecSem(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Applicable Course / Stream</label>
                <select
                  value={newDecCourse}
                  onChange={(e) => setNewDecCourse(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="All Courses">All Courses (Institution-wide)</option>
                  {availableCourses
                    .filter((c) => c !== 'All Courses')
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Official Result Declaration Date *
                </label>
                <input
                  type="date"
                  required
                  value={newDecDate}
                  onChange={(e) => setNewDecDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold text-indigo-700 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Administrative Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Cleared by Academic Examination Board & Syndicate"
                  value={newDecRemarks}
                  onChange={(e) => setNewDecRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="immediatePublish"
                  checked={newDecImmediatePublish}
                  onChange={(e) => setNewDecImmediatePublish(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="immediatePublish" className="text-xs font-bold text-slate-700">
                  Publish marksheet immediately to student portal (Bypass embargo)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCycleModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow"
                >
                  Schedule Release
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOCK OVERRIDE REASON */}
      {pendingLockOverride && (
        <div role="dialog" aria-modal="true" aria-label="Post-Declaration Lock Override Confirmation" className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handleConfirmLockOverride} className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                Authorization Reason Required
              </h3>
              <button
                type="button"
                onClick={() => {
                  setPendingLockOverride(null);
                  setLockOverrideReason('');
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              This action alters a locked/published declaration for{' '}
              <strong>{pendingLockOverride.course} Sem {pendingLockOverride.semester}</strong>. Enter a written Principal/Super Admin approval reason (at least 10 characters):
            </p>
            <textarea
              rows={3}
              required
              minLength={10}
              value={lockOverrideReason}
              onChange={(e) => setLockOverrideReason(e.target.value)}
              placeholder="Provide statutory justification for relaxing lock..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingLockOverride(null);
                  setLockOverrideReason('');
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow"
              >
                Confirm & Log Audit
              </button>
            </div>
          </form>
        </div>
      )}

      {errorToast && (
        <div className="fixed bottom-6 right-6 z-[80] max-w-md bg-rose-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-rose-700 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}
    </div>
  );
};

export default GradeSettingsModule;

