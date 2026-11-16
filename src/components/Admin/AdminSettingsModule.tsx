import React, { useState, useEffect, useMemo } from 'react';
import {
  SystemSettingsConfig,
  PaymentGatewayConfig,
  SupportTicket,
  CourseSectionConfig,
  GradeEvaluationHead,
  SemesterResultDeclaration,
  ExamTypeConfig,
  Student,
  AuditLogEntry,
  DegreeDivisionRule,
} from '../../types/erp';
import { erpStorage } from '../../services/erpStorage';
import {
  generateSecureId,
  getISTDateString,
  getCurrentAcademicYear,
  DEFAULT_DEGREE_DIVISION_RULES,
  classifyDegreeDivision,
} from '../../utils/erpLogic';
import { ErpBackupSchema } from '../../domain/reports';
import { hasActiveDeclarationUnlockWindow } from '../../domain/grades';
import { apiClient } from '../../services/apiClient';
import {
  Settings,
  CreditCard,
  CalendarCheck,
  LifeBuoy,
  CheckCircle2,
  Save,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Layers,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Edit3,
  Sliders,
  Calendar,
  CalendarDays,
  Check,
  Award,
  FileText,
  ListOrdered,
  X,
  FileCheck,
} from 'lucide-react';

interface AdminSettingsModuleProps {
  settings: SystemSettingsConfig;
  onSaveSettings: (settings: SystemSettingsConfig) => void;
  courseSections?: CourseSectionConfig[];
  onSaveCourseSections?: (sections: CourseSectionConfig[]) => void;
  students?: Student[];
  onBatchUpdateStudents?: (students: Student[]) => void;
  availableCourses?: string[];
  gradeHeads?: GradeEvaluationHead[];
  onSaveGradeHeads?: (heads: GradeEvaluationHead[]) => void;
  resultDeclarations?: SemesterResultDeclaration[];
  onSaveResultDeclarations?: (declarations: SemesterResultDeclaration[]) => void;
  examTypes?: ExamTypeConfig[];
  onSaveExamTypes?: (types: ExamTypeConfig[]) => void;
}

export const AdminSettingsModule: React.FC<AdminSettingsModuleProps> = ({
  settings,
  onSaveSettings,
  courseSections = [],
  onSaveCourseSections,
  students = [],
  onBatchUpdateStudents,
  availableCourses = [
    'B.Tech Computer Science & Engineering',
    'B.Tech Electronics & Communication',
    'BCA (Bachelor of Computer Applications)',
    'B.Sc. Information Technology',
    'B.Sc Physics Hons',
    'B.Com Hons Accounting',
  ],
  gradeHeads = [],
  onSaveGradeHeads,
  resultDeclarations = [],
  onSaveResultDeclarations,
  examTypes: initialExamTypes,
  onSaveExamTypes,
}) => {
  const [activeTab, setActiveTab] = useState<'exam_types' | 'grade_heads' | 'results_calendar' | 'degree_divisions' | 'sections' | 'gateway' | 'attendance' | 'tickets' | 'audit_backup'>('exam_types');
  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayConfig>(settings.paymentGateway);
  const [attendanceThreshold, setAttendanceThreshold] = useState<number>(settings.attendanceThreshold);
  const [attendanceInputRaw, setAttendanceInputRaw] = useState<string>(String(settings.attendanceThreshold));
  const [maxServiceFee, setMaxServiceFee] = useState<number>(settings.maxServiceTariffFee || 100000);
  const [maxServiceFeeRaw, setMaxServiceFeeRaw] = useState<string>(String(settings.maxServiceTariffFee || 100000));
  const [tickets, setTickets] = useState<SupportTicket[]>(settings.supportTickets || []);
  const [showSecret, setShowSecret] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [pendingDateMove, setPendingDateMove] = useState<{
    decId: string;
    newDate: string;
    course: string;
    semester: number;
  } | null>(null);
  const [lockOverrideReason, setLockOverrideReason] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => erpStorage.getAuditLogs());
  const [backupError, setBackupError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'audit_backup') {
      setAuditLogs(erpStorage.getAuditLogs());
      void apiClient.fetchServerAuditLogs().then((serverLogs) => {
        if (serverLogs && serverLogs.length > 0) {
          const localLogs = erpStorage.getAuditLogs();
          const mergedMap = new Map<string, AuditLogEntry>();
          [...serverLogs, ...localLogs].forEach((l) => mergedMap.set(l.id, l));
          setAuditLogs(Array.from(mergedMap.values()));
        }
      });
    }
  }, [activeTab]);

  // Exam Types State (Admin Right: Create, Edit, Disable/Enable, Toggle Student Marksheet)
  const [examTypesList, setExamTypesList] = useState<ExamTypeConfig[]>(() => {
    if (initialExamTypes && initialExamTypes.length > 0) return initialExamTypes;
    return erpStorage.getExamTypes();
  });
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamTypeConfig | null>(null);
  const [examFormName, setExamFormName] = useState('');
  const [examFormCode, setExamFormCode] = useState('');
  const [examFormDesc, setExamFormDesc] = useState('');
  const [examFormAY, setExamFormAY] = useState(() => getCurrentAcademicYear());
  const [examFormShowMarksheet, setExamFormShowMarksheet] = useState(true);
  const [examFormEnabled, setExamFormEnabled] = useState(true);
  const [confirmMarksheetToggleExamId, setConfirmMarksheetToggleExamId] = useState<string | null>(null);
  const [confirmDisableExamId, setConfirmDisableExamId] = useState<string | null>(null);

  const saveExamTypesState = (updated: ExamTypeConfig[], notice?: string) => {
    setExamTypesList(updated);
    if (onSaveExamTypes) {
      onSaveExamTypes(updated);
    } else {
      erpStorage.saveExamTypes(updated);
    }
    if (notice) {
      setSaveNotice(notice);
      setTimeout(() => setSaveNotice(null), 3500);
    }
  };

  const handleOpenAddExamModal = () => {
    setEditingExam(null);
    setExamFormName('');
    setExamFormCode('');
    setExamFormDesc('');
    setExamFormAY(getCurrentAcademicYear());
    setExamFormShowMarksheet(true);
    setExamFormEnabled(true);
    setIsExamModalOpen(true);
  };

  const handleOpenEditExamModal = (exam: ExamTypeConfig) => {
    setEditingExam(exam);
    setExamFormName(exam.name);
    setExamFormCode(exam.code);
    setExamFormDesc(exam.description);
    setExamFormAY(exam.academicYear || getCurrentAcademicYear());
    setExamFormShowMarksheet(exam.showInStudentMarksheet);
    setExamFormEnabled(exam.enabled);
    setIsExamModalOpen(true);
  };

  const showError = (msg: string) => {
    setSaveNotice(null);
    setErrorNotice(msg);
  };

  const handleSaveExamForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examFormName.trim()) return;

    const candidateCode =
      examFormCode.trim().toUpperCase() ||
      (editingExam ? editingExam.code : `EXAM_${Date.now().toString().slice(-4)}`);

    const isDuplicateExamCode = examTypesList.some(
      (t) =>
        t.id !== editingExam?.id &&
        (t.code.trim().toUpperCase() === candidateCode ||
          t.name.trim().toLowerCase() === examFormName.trim().toLowerCase())
    );
    if (isDuplicateExamCode) {
      showError(`Duplicate Exam Type: An exam with code "${candidateCode}" or name "${examFormName.trim()}" already exists.`);
      return;
    }

    if (editingExam) {
      const updated = examTypesList.map((t) =>
        t.id === editingExam.id
          ? {
              ...t,
              name: examFormName.trim(),
              code: candidateCode,
              description: examFormDesc.trim(),
              academicYear: examFormAY,
              showInStudentMarksheet: examFormShowMarksheet,
              enabled: examFormEnabled,
              updatedAt: getISTDateString(),
            }
          : t
      );
      saveExamTypesState(updated, `Updated exam type "${examFormName.trim()}".`);
    } else {
      const newExam: ExamTypeConfig = {
        id: generateSecureId('EXAM'),
        name: examFormName.trim(),
        code: candidateCode,
        description: examFormDesc.trim() || 'Institutional evaluation & assessment',
        academicYear: examFormAY,
        showInStudentMarksheet: examFormShowMarksheet,
        enabled: examFormEnabled,
        createdAt: getISTDateString(),
      };
      saveExamTypesState([...examTypesList, newExam], `Created new exam type "${newExam.name}".`);
    }
    setIsExamModalOpen(false);
  };

  const hasPublishedResultCohorts = useMemo(() => {
    const todayIST = getISTDateString();
    return resultDeclarations.some(
      (d) => d.isPublished || d.status === 'Published' || (d.declarationDate && d.declarationDate <= todayIST)
    );
  }, [resultDeclarations]);

  const handleToggleExamShowMarksheet = (examId: string, currentVal: boolean, confirmed: boolean = false) => {
    if (hasPublishedResultCohorts && !confirmed) {
      setConfirmMarksheetToggleExamId(examId);
      return;
    }
    setConfirmMarksheetToggleExamId(null);
    const updated = examTypesList.map((t) =>
      t.id === examId ? { ...t, showInStudentMarksheet: !currentVal } : t
    );
    const target = updated.find((t) => t.id === examId);
    saveExamTypesState(
      updated,
      `Exam "${target?.name}" will now display in: ${
        !currentVal ? 'Student Main Marksheet' : 'Student "Other Exams" Scorecard'
      }.`
    );
  };

  const handleToggleExamStatus = (examId: string, currentVal: boolean, confirmed: boolean = false) => {
    if (currentVal && !confirmed) {
      const hasLinkedEvaluations =
        erpStorage.getStudentExamEvaluations({ examTypeId: examId }).length > 0 ||
        erpStorage.getExamEvaluationHeads(examId).length > 0;
      if (hasLinkedEvaluations) {
        setConfirmDisableExamId(examId);
        return;
      }
    }
    setConfirmDisableExamId(null);
    const updated = examTypesList.map((t) =>
      t.id === examId ? { ...t, enabled: !currentVal } : t
    );
    const target = updated.find((t) => t.id === examId);
    saveExamTypesState(
      updated,
      `Exam "${target?.name}" is now ${!currentVal ? 'Active & Available' : 'Disabled'}.`
    );
  };

  const handleDeleteExam = (examId: string) => {
    const target = examTypesList.find((t) => t.id === examId);
    if (target?.isDefault) {
      showError('Protected System Exam Type: Built-in exam types cannot be removed.');
      return;
    }
    const updated = examTypesList.filter((t) => t.id !== examId);
    saveExamTypesState(updated, `Removed exam type "${target?.name}".`);
  };

  // Grade Evaluation Heads State
  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadType, setNewHeadType] = useState<'number' | 'dropdown'>('number');
  const [newHeadOptions, setNewHeadOptions] = useState('Outstanding, Good, Satisfactory, Needs Improvement');
  const [newHeadDefault, setNewHeadDefault] = useState<string>('20');
  const [editingHead, setEditingHead] = useState<GradeEvaluationHead | null>(null);

  // Result Declaration Calendar State
  const [newDecFY, setNewDecFY] = useState(() => getCurrentAcademicYear());
  const [newDecSem, setNewDecSem] = useState<number>(5);
  const [newDecCourse, setNewDecCourse] = useState('All Courses');
  const [newDecDate, setNewDecDate] = useState(() =>
    getISTDateString(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000))
  );
  const [newDecRole, setNewDecRole] = useState<'principal' | 'accountant'>('principal');
  const [newDecAuthorityName, setNewDecAuthorityName] = useState('Dr. S. N. Sharma (Principal)');

  // Section Management State
  const defaultCourse = availableCourses[0] || 'B.Tech Computer Science & Engineering';
  const [sectionFilterCourse, setSectionFilterCourse] = useState<string>(defaultCourse);
  const [sectionFilterSemester, setSectionFilterSemester] = useState<number>(1);
  const [newSectionName, setNewSectionName] = useState('Section A');
  const [newSectionCapacity, setNewSectionCapacity] = useState<number>(60);
  const [newSectionCourse, setNewSectionCourse] = useState<string>(defaultCourse);
  const [newSectionSemester, setNewSectionSemester] = useState<number>(1);
  const [newSectionIsActive, setNewSectionIsActive] = useState<boolean>(true);
  // Selected ticket for viewing / responding
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  // ------------------------------------------------------------------
  // UGC AUTONOMOUS DEGREE DIVISION CLASSIFICATION STATE & HANDLERS
  // ------------------------------------------------------------------
  const [divisionRules, setDivisionRules] = useState<DegreeDivisionRule[]>(() =>
    erpStorage.getDegreeDivisionRules()
  );
  const [testScoreMode, setTestScoreMode] = useState<'percentage' | 'cgpa'>('percentage');
  const [testScoreInput, setTestScoreInput] = useState<string>('78');

  useEffect(() => {
    const unsub = erpStorage.subscribe(() => {
      setDivisionRules(erpStorage.getDegreeDivisionRules());
    });
    return () => unsub();
  }, []);

  const handleDivisionRuleChange = (
    index: number,
    field: 'divisionName' | 'minPercentage' | 'minCgpa' | 'description' | 'isPassing',
    value: any
  ) => {
    setDivisionRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return { ...r };
        let sanitizedValue = value;
        if (field === 'minPercentage') {
          const parsedPct = Number(value);
          sanitizedValue = Number.isNaN(parsedPct) ? 0 : Math.max(0, Math.min(100, parsedPct));
        } else if (field === 'minCgpa') {
          const parsedCgpa = Number(value);
          sanitizedValue = Number.isNaN(parsedCgpa) ? 0 : Math.max(0, Math.min(10, parsedCgpa));
        } else if (field === 'isPassing') {
          sanitizedValue = Boolean(value);
        } else {
          sanitizedValue = String(value);
        }
        return { ...r, [field]: sanitizedValue };
      })
    );
  };

  const handleAddDivisionTier = () => {
    const newTier: DegreeDivisionRule = {
      id: generateSecureId('DIV-TIER'),
      divisionName: 'Autonomous Honours Tier',
      minPercentage: 80,
      minCgpa: 8.0,
      description: 'Autonomous College Distinction Tier',
      isPassing: true,
    };
    setDivisionRules((prev) => [newTier, ...prev].sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage)));
    setSaveNotice('Added new classification tier. Click "Save Regulations" to persist.');
    setTimeout(() => setSaveNotice(null), 3500);
  };

  const handleDeleteDivisionTier = (ruleId: string) => {
    if (divisionRules.length <= 2) {
      showError('Cannot delete: At least 2 tiers (pass and fail) are required for UGC statutory compliance.');
      return;
    }
    const updated = divisionRules.filter((r) => r.id !== ruleId);
    setDivisionRules(updated);
    setSaveNotice('Classification tier removed. Click "Save Regulations" to persist.');
    setTimeout(() => setSaveNotice(null), 3500);
  };

  const handleResetStandardDivisionRules = () => {
    const defaults = DEFAULT_DEGREE_DIVISION_RULES.map((r) => ({ ...r }));
    setDivisionRules(defaults);
    setSaveNotice('Reset to statutory UGC model division rules. Click "Save Regulations" to commit.');
    setTimeout(() => setSaveNotice(null), 3500);
  };

  const handleSaveDivisionRules = (e: React.FormEvent) => {
    e.preventDefault();
    const sorted = [...divisionRules].sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage));
    erpStorage.saveDegreeDivisionRules(sorted);
    setDivisionRules(sorted);
    erpStorage.appendAuditLog({
      actorId: 'SUPERADMIN',
      actorName: 'Pallawi Kumari (Master Administrator)',
      actorRole: 'superadmin',
      action: 'UPDATE_DEGREE_DIVISION_RULES',
      module: 'grades',
      summary: `Updated ${sorted.length} UGC autonomous degree division classification tiers.`,
      reason: 'Administrative autonomous degree division regulations update',
    });
    setSaveNotice('UGC Autonomous Degree Division Classification saved and synchronized across transcripts.');
    setTimeout(() => setSaveNotice(null), 4000);
  };

  useEffect(() => {
    setGatewayConfig(settings.paymentGateway);
    setAttendanceThreshold(settings.attendanceThreshold);
    setAttendanceInputRaw(String(settings.attendanceThreshold));
    setMaxServiceFee(settings.maxServiceTariffFee || 100000);
    setMaxServiceFeeRaw(String(settings.maxServiceTariffFee || 100000));
    setTickets(settings.supportTickets || []);
  }, [settings]);

  useEffect(() => {
    if (initialExamTypes && initialExamTypes.length > 0) {
      setExamTypesList(initialExamTypes);
    }
  }, [initialExamTypes]);

  useEffect(() => {
    const unsubscribe = erpStorage.subscribe(() => {
      if (!initialExamTypes || initialExamTypes.length === 0) {
        setExamTypesList(erpStorage.getExamTypes());
      }
    });
    return () => unsubscribe();
  }, [initialExamTypes]);

  useEffect(() => {
    if (settings.supportTickets) {
      setTickets(settings.supportTickets);
    }
  }, [settings.supportTickets]);

  const handleSaveGateway = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    const trimmedWebhook = (gatewayConfig.webhookUrl || '').trim();
    if (trimmedWebhook) {
      try {
        const parsedUrl = new URL(trimmedWebhook);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          showError('Webhook Notification Endpoint URL must start with http:// or https://.');
          return;
        }
      } catch {
        showError('Invalid Webhook Notification Endpoint URL. Please enter a valid http(s):// URL.');
        return;
      }
    }

    const updated: SystemSettingsConfig = {
      ...settings,
      paymentGateway: {
        ...gatewayConfig,
        webhookUrl: trimmedWebhook,
      },
    };
    onSaveSettings(updated);
    setSaveNotice('Payment gateway configuration saved successfully.');
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleSaveAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    const trimmed = String(attendanceInputRaw ?? '').trim();
    if (trimmed === '') {
      showError('Statutory attendance threshold cannot be empty. Please enter a value between 50% and 100%.');
      return;
    }
    const thresholdNum = Number(trimmed);
    if (!Number.isFinite(thresholdNum) || thresholdNum < 50 || thresholdNum > 100) {
      showError('Statutory attendance threshold must be a valid number between 50% and 100%.');
      return;
    }

    const feeNum = Number(maxServiceFeeRaw.trim());
    if (!Number.isFinite(feeNum) || feeNum < 500 || feeNum > 1000000) {
      showError('Maximum service clearance fee ceiling must be a valid number between ₹500 and ₹10,00,000.');
      return;
    }

    const validMaxFee = Math.round(feeNum);
    setAttendanceThreshold(thresholdNum);
    setAttendanceInputRaw(String(thresholdNum));
    setMaxServiceFee(validMaxFee);
    setMaxServiceFeeRaw(String(validMaxFee));

    const updated: SystemSettingsConfig = {
      ...settings,
      attendanceThreshold: thresholdNum,
      maxServiceTariffFee: validMaxFee,
    };
    onSaveSettings(updated);
    setSaveNotice(`Statutory governance settings updated (Attendance: ${thresholdNum}%, Service Fee Ceiling: ₹${validMaxFee.toLocaleString('en-IN')}).`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleUpdateTicketStatus = (ticketId: string, newStatus: 'open' | 'in_progress' | 'resolved') => {
    setErrorNotice(null);
    const targetTicket = tickets.find((t) => t.id === ticketId);
    const activeAdmin = erpStorage.getCurrentUser();
    if (
      newStatus === 'resolved' &&
      targetTicket &&
      activeAdmin &&
      (targetTicket.studentId === activeAdmin.id ||
        Boolean(activeAdmin.studentId && targetTicket.studentId === activeAdmin.studentId) ||
        Boolean(
          activeAdmin.rollNo &&
            targetTicket.studentRollNo &&
            targetTicket.studentRollNo.trim().toUpperCase() === activeAdmin.rollNo.trim().toUpperCase()
        ))
    ) {
      showError(
        'Segregation of Duties Blocked: Staff members cannot self-resolve support or grievance tickets raised under their own account.'
      );
      return;
    }

    const nowIST = getISTDateString();
    const updatedTickets = tickets.map((t) =>
      t.id === ticketId
        ? {
            ...t,
            status: newStatus,
            adminNotes: resolutionNote || t.adminNotes,
            resolvedAt: newStatus === 'resolved' ? (t.resolvedAt || nowIST) : t.resolvedAt,
          }
        : t
    );
    setTickets(updatedTickets);
    const updatedSettings: SystemSettingsConfig = {
      ...settings,
      supportTickets: updatedTickets,
    };
    onSaveSettings(updatedSettings);
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({
        ...selectedTicket,
        status: newStatus,
        adminNotes: resolutionNote || selectedTicket.adminNotes,
        resolvedAt: newStatus === 'resolved' ? (selectedTicket.resolvedAt || nowIST) : selectedTicket.resolvedAt,
      });
    }
    setResolutionNote('');
    setSaveNotice(`Support Ticket #${ticketId} status updated to ${newStatus}.`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const normalizeSectionLetter = (secName?: string): string => {
    return (secName || '')
      .replace(/^section\s+/i, '')
      .trim()
      .toUpperCase();
  };

  const reassignEnrolledStudentsToSectionA = (targetSec?: CourseSectionConfig): number => {
    if (!targetSec) return 0;
    const targetLetter = normalizeSectionLetter(targetSec.sectionName);
    if (!targetLetter || targetLetter === 'A') return 0;

    const currentStudents = students.length > 0 ? students : erpStorage.getStudents();
    const targetCourseNorm = (targetSec.course || '').trim().toLowerCase();
    let reassignedCount = 0;

    const updatedStudents = currentStudents.map((stu) => {
      const stuCourseNorm = (stu.course || '').trim().toLowerCase();
      const stuSecLetter = normalizeSectionLetter(stu.section);
      if (
        stuCourseNorm === targetCourseNorm &&
        Number(stu.semester) === Number(targetSec.semester) &&
        stuSecLetter === targetLetter
      ) {
        reassignedCount++;
        return {
          ...stu,
          section: 'A',
          enrollmentData: {
            ...(stu.enrollmentData || {}),
            section: 'A',
          },
        };
      }
      return stu;
    });

    if (reassignedCount > 0) {
      if (onBatchUpdateStudents) {
        onBatchUpdateStudents(updatedStudents);
      } else {
        erpStorage.saveStudents(updatedStudents);
      }
    }
    return reassignedCount;
  };

  const handleToggleSectionActive = (sectionId: string, currentStatus: boolean) => {
    const latestSections = erpStorage.getCourseSections();
    const sourceSections = latestSections && latestSections.length > 0 ? latestSections : courseSections;
    const currentItem = sourceSections.find((s) => s.id === sectionId);
    const effectiveCurrentStatus = currentItem ? currentItem.isActive : currentStatus;
    const nextActive = !effectiveCurrentStatus;
    const updated = sourceSections.map((s) =>
      s.id === sectionId ? { ...s, isActive: nextActive } : s
    );
    if (onSaveCourseSections) {
      onSaveCourseSections(updated);
    } else {
      erpStorage.saveCourseSections(updated);
    }
    const toggled = updated.find((s) => s.id === sectionId);
    const reassignedCount = !nextActive ? reassignEnrolledStudentsToSectionA(toggled) : 0;
    const reassignMsg =
      reassignedCount > 0
        ? ` ${reassignedCount} enrolled student(s) automatically reassigned to Section A.`
        : '';
    setSaveNotice(
      `${toggled?.sectionName} (${toggled?.course} Sem ${toggled?.semester}) is now ${
        toggled?.isActive ? 'ACTIVATED for the app' : 'DEACTIVATED (Bypassed if all inactive)'
      }.${reassignMsg}`
    );
    setTimeout(() => setSaveNotice(null), 4000);
  };

  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    const activeAdmin = erpStorage.getCurrentUser();
    if (!activeAdmin || !['superadmin', 'principal'].includes(activeAdmin.role)) {
      showError('Security Exception: Only Super Admin or Principal can manage academic sections.');
      return;
    }

    const cleanedName = newSectionName.trim();
    if (!cleanedName || !/[A-Za-z0-9]/.test(cleanedName)) {
      showError('Invalid Section Name: Please enter a valid alphanumeric section identifier (e.g., Section A).');
      return;
    }

    const capNum = Number(newSectionCapacity);
    if (!Number.isFinite(capNum) || capNum < 1 || capNum > 200) {
      showError('Invalid Section Capacity: Classroom capacity must be between 1 and 200 students.');
      return;
    }

    const latestSections = erpStorage.getCourseSections();
    const sourceSections = latestSections && latestSections.length > 0 ? latestSections : courseSections;

    const normLetter = normalizeSectionLetter(cleanedName);
    const isDuplicateSection = sourceSections.some(
      (s) =>
        s.course.trim().toLowerCase() === newSectionCourse.trim().toLowerCase() &&
        Number(s.semester) === Number(newSectionSemester) &&
        normalizeSectionLetter(s.sectionName) === normLetter
    );
    if (isDuplicateSection) {
      showError(`Section "${cleanedName}" already exists for ${newSectionCourse} (Semester ${newSectionSemester}).`);
      return;
    }

    const created: CourseSectionConfig = {
      id: generateSecureId('SEC'),
      course: newSectionCourse,
      semester: Number(newSectionSemester),
      sectionName: cleanedName,
      isActive: newSectionIsActive,
      maxCapacity: Math.round(capNum),
    };

    const updated = [...sourceSections, created];
    if (onSaveCourseSections) {
      onSaveCourseSections(updated);
    } else {
      erpStorage.saveCourseSections(updated);
    }

    setSaveNotice(
      `Created ${created.sectionName} for ${created.course} Sem ${created.semester} (${created.isActive ? 'Activated' : 'Deactivated'}).`
    );
    setNewSectionName('');
    setTimeout(() => setSaveNotice(null), 3500);
  };

  const handleDeleteSection = (sectionId: string) => {
    setErrorNotice(null);
    const activeAdmin = erpStorage.getCurrentUser();
    if (!activeAdmin || !['superadmin', 'principal'].includes(activeAdmin.role)) {
      showError('Security Exception: Only Super Admin or Principal can remove academic sections.');
      return;
    }

    const latestSections = erpStorage.getCourseSections();
    const sourceSections = latestSections && latestSections.length > 0 ? latestSections : courseSections;
    const targetSec = sourceSections.find((s) => s.id === sectionId);
    const updated = sourceSections.filter((s) => s.id !== sectionId);
    if (onSaveCourseSections) {
      onSaveCourseSections(updated);
    } else {
      erpStorage.saveCourseSections(updated);
    }
    const reassignedCount = reassignEnrolledStudentsToSectionA(targetSec);
    const reassignMsg =
      reassignedCount > 0
        ? ` ${reassignedCount} enrolled student(s) automatically reassigned to Section A.`
        : '';
    setSaveNotice(`Section removed from course curriculum configuration.${reassignMsg}`);
    setTimeout(() => setSaveNotice(null), 3500);
  };

  // ------------------------------------------------------------------
  // GRADE EVALUATION HEADS HANDLERS (Admin Authority)
  // ------------------------------------------------------------------
  const handleAddHead = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    const activeAdmin = erpStorage.getCurrentUser();
    if (!activeAdmin || !['superadmin', 'principal', 'accountant'].includes(activeAdmin.role)) {
      showError('Security Exception: Unauthorized role for modifying grade evaluation heads.');
      return;
    }
    if (!newHeadName.trim()) return;

    const parsedOptions = newHeadType === 'dropdown'
      ? newHeadOptions.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;

    const newHead: GradeEvaluationHead = {
      id: generateSecureId('HEAD'),
      name: newHeadName.trim(),
      type: newHeadType,
      dropdownOptions: parsedOptions,
      defaultValue: newHeadType === 'number' ? Number(newHeadDefault) || 0 : (parsedOptions?.[0] || 'Good'),
      sequence: gradeHeads.length + 1,
      isSystemHead: false,
    };

    const updated = [...gradeHeads, newHead];
    if (onSaveGradeHeads) {
      onSaveGradeHeads(updated);
    } else {
      erpStorage.saveGradeEvaluationHeads(updated);
    }
    setNewHeadName('');
    setSaveNotice(`Added evaluation head "${newHead.name}" to grade evaluation grid.`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleUpdateHead = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    const activeAdmin = erpStorage.getCurrentUser();
    if (!activeAdmin || !['superadmin', 'principal', 'accountant'].includes(activeAdmin.role)) {
      showError('Security Exception: Unauthorized role for updating grade evaluation heads.');
      return;
    }
    if (!editingHead || !editingHead.name.trim()) return;

    const updated = gradeHeads.map((h) => (h.id === editingHead.id ? editingHead : h));
    if (onSaveGradeHeads) {
      onSaveGradeHeads(updated);
    } else {
      erpStorage.saveGradeEvaluationHeads(updated);
    }
    setEditingHead(null);
    setSaveNotice(`Updated evaluation head "${editingHead.name}".`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleDeleteHead = (headId: string) => {
    setErrorNotice(null);
    const activeAdmin = erpStorage.getCurrentUser();
    if (!activeAdmin || !['superadmin', 'principal', 'accountant'].includes(activeAdmin.role)) {
      showError('Security Exception: Unauthorized role for deleting grade evaluation heads.');
      return;
    }
    const targetHead = gradeHeads.find((h) => h.id === headId);
    if (targetHead?.isSystemHead) {
      showError('Statutory system evaluation heads cannot be deleted.');
      return;
    }

    const existingGrades = erpStorage.getGrades();
    const existingEvals = erpStorage.getStudentExamEvaluations();
    const isHeadInUse =
      existingGrades.some((g) => g.headValues && g.headValues[headId] !== undefined) ||
      existingEvals.some(
        (e) =>
          (e.headValues && e.headValues[headId] !== undefined) ||
          (e.headScores && e.headScores[headId] !== undefined)
      );

    if (isHeadInUse) {
      showError(`Deletion Blocked: "${targetHead?.name || 'Evaluation Head'}" is actively referenced in recorded student grades.`);
      return;
    }

    const updated = gradeHeads
      .filter((h) => h.id !== headId)
      .map((h, idx) => ({ ...h, sequence: idx + 1 }));
    if (onSaveGradeHeads) {
      onSaveGradeHeads(updated);
    } else {
      erpStorage.saveGradeEvaluationHeads(updated);
    }
    setSaveNotice('Evaluation head removed from grade management grid.');
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleMoveHead = (index: number, direction: 'up' | 'down') => {
    setErrorNotice(null);
    const activeAdmin = erpStorage.getCurrentUser();
    if (!activeAdmin || !['superadmin', 'principal', 'accountant'].includes(activeAdmin.role)) {
      showError('Security Exception: Unauthorized role for re-sequencing grade evaluation heads.');
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= gradeHeads.length) return;

    const copy = [...gradeHeads];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const resequenced = copy.map((h, idx) => ({ ...h, sequence: idx + 1 }));
    if (onSaveGradeHeads) {
      onSaveGradeHeads(resequenced);
    } else {
      erpStorage.saveGradeEvaluationHeads(resequenced);
    }
    setSaveNotice(`Moved "${temp.name}" to sequence #${targetIndex + 1}.`);
    setTimeout(() => setSaveNotice(null), 2500);
  };

  // ------------------------------------------------------------------
  // RESULT DECLARATION CALENDAR HANDLERS (Principal & Superadmin)
  // ------------------------------------------------------------------
  const handleUpdateDeclarationDate = (decId: string, newDate: string, overrideReason?: string) => {
    setErrorNotice(null);
    const activeAdmin = erpStorage.getCurrentUser();
    if (!activeAdmin || !['principal', 'superadmin'].includes(activeAdmin.role)) {
      setErrorNotice('Security Exception: Only an authenticated Principal or Super Admin may modify result declaration dates.');
      return;
    }
    const todayIST = getISTDateString();
    const target = resultDeclarations.find((d) => d.id === decId);
    const wasLockedOrPublished = Boolean(
      target &&
        (target.isLocked ||
          target.isPublished ||
          target.status === 'Published' ||
          (target.declarationDate && target.declarationDate <= todayIST))
    );
    const movingToFuture = Boolean(newDate && newDate > todayIST);
    if (wasLockedOrPublished && movingToFuture && (!overrideReason || overrideReason.trim().length < 10)) {
      setPendingDateMove({
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
        activeAdmin.role as 'principal' | 'superadmin',
        activeAdmin.name,
        undefined,
        overrideReason
      );
      onSaveResultDeclarations?.(updated);
      setAuditLogs(erpStorage.getAuditLogs());
      setSaveNotice(`Official result declaration date updated to ${newDate}.`);
      setTimeout(() => setSaveNotice(null), 3000);
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : 'Failed to update result declaration date.');
    }
  };

  const handleConfirmDateMoveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingDateMove) return;
    const cleanReason = lockOverrideReason.trim();
    if (cleanReason.length < 10) {
      setErrorNotice('Override reason must be at least 10 characters long to move a locked/published declaration into the future.');
      return;
    }
    const move = pendingDateMove;
    setPendingDateMove(null);
    setLockOverrideReason('');
    handleUpdateDeclarationDate(move.decId, move.newDate, cleanReason);
  };

  const handleAddDeclaration = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    const activeAdmin = erpStorage.getCurrentUser();
    if (!activeAdmin || !['principal', 'superadmin'].includes(activeAdmin.role)) {
      setErrorNotice('Security Exception: Only an authenticated Principal or Super Admin may schedule result declarations.');
      return;
    }
    const todayIST = getISTDateString();
    const isPublishedNow = Boolean(newDecDate && newDecDate <= todayIST);

    try {
      const updated = erpStorage.addResultDeclaration(
        {
          financialYear: newDecFY,
          semester: Number(newDecSem),
          course: newDecCourse,
          declarationDate: newDecDate,
          declaredByRole: activeAdmin.role as 'principal' | 'superadmin',
          declaredByName: activeAdmin.name,
          isPublished: isPublishedNow,
          status: isPublishedNow ? 'Published' : 'Scheduled',
          publishedAt: isPublishedNow ? todayIST : undefined,
          publishedBy: isPublishedNow ? activeAdmin.name : undefined,
          remarks: 'Official result declaration scheduled by authority',
        },
        activeAdmin.role
      );
      onSaveResultDeclarations?.(updated);
      setAuditLogs(erpStorage.getAuditLogs());
      setSaveNotice(
        `Result declaration scheduled for Sem ${Number(newDecSem)} (FY ${newDecFY}) on ${newDecDate}.`
      );
      setTimeout(() => setSaveNotice(null), 3000);
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : 'Unable to schedule result declaration.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-300 text-xs font-mono font-bold tracking-wider uppercase mb-1">
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>Institutional System Administration</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Grade Heads, Results, Sections & Gateway
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-2xl leading-relaxed">
              Manage overview settings of Grade Management evaluation heads (sequence, defaults, dropdowns), result declaration schedules FY-wise, semester section deactivation, and payment gateway.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-indigo-700/50">
            <button
              onClick={() => setActiveTab('exam_types')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'exam_types'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              Exam Types & Marksheet Controls
            </button>
            <button
              onClick={() => setActiveTab('grade_heads')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'grade_heads'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-amber-300" />
              Grade Heads Overview
            </button>
            <button
              onClick={() => setActiveTab('results_calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'results_calendar'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-emerald-300" />
              Result Release Dates
            </button>
            <button
              onClick={() => setActiveTab('degree_divisions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'degree_divisions'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-indigo-300" />
              UGC Degree Division Rules
            </button>
            <button
              onClick={() => setActiveTab('sections')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'sections'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-300" />
              Semesters & Sections
            </button>
            <button
              onClick={() => setActiveTab('gateway')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'gateway'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Payment Gateway
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'attendance'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              Attendance
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'tickets'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LifeBuoy className="w-3.5 h-3.5 text-amber-300" />
              Support Tickets ({tickets.filter((t) => t.status !== 'resolved').length})
            </button>
            <button
              onClick={() => setActiveTab('audit_backup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'audit_backup'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              Audit Log &amp; Backup
            </button>
          </div>
        </div>
      </div>

      {saveNotice && (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {errorNotice && (
        <div className="bg-rose-50 border-2 border-rose-300 text-rose-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button type="button" onClick={() => setErrorNotice(null)} className="text-rose-700 hover:text-rose-950 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {pendingDateMove && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleConfirmDateMoveOverride} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              Authorization Required to Relax Post-Declaration Lock
            </h4>
            <p className="text-slate-600">
              Moving <strong>{pendingDateMove.course} Sem {pendingDateMove.semester}</strong> to future date{' '}
              <span className="font-mono font-bold">{pendingDateMove.newDate}</span> will unpublish and unlock locked marksheets. Provide a written justification (min 10 characters):
            </p>
            <textarea
              rows={3}
              required
              minLength={10}
              value={lockOverrideReason}
              onChange={(e) => setLockOverrideReason(e.target.value)}
              placeholder="Reason for post-declaration embargo extension / re-opening..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingDateMove(null);
                  setLockOverrideReason('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Authorize & Update Date
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 0: EXAM TYPES & STUDENT MARKSHEET CONTROLS (Admin Right) */}
      {activeTab === 'exam_types' && (
        <div className="space-y-6">
          {/* Admin Authority Banner */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-purple-600" />
                  <h3 className="font-bold text-slate-900 text-lg">Exam Types &amp; Marksheet Visibility Controls</h3>
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    Admin Exclusive Right
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Admin governs examination categories (e.g., Unit Test, Half-Yearly, Annual, Practical, Olympiad). Toggle whether marksheet appears in the student's primary Marksheet menu or routes into the separate "Other Exams" section.
                </p>
              </div>

              <button
                onClick={handleOpenAddExamModal}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Create Exam Type</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-bold uppercase text-slate-400 block font-mono">Total Configured</span>
                <span className="text-xl font-black text-slate-900">{examTypesList.length}</span>
              </div>
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-xs font-bold uppercase text-emerald-600 block font-mono">Main Marksheet</span>
                <span className="text-xl font-black text-emerald-800">
                  {examTypesList.filter((t) => t.showInStudentMarksheet).length}
                </span>
                <span className="text-xs text-emerald-600 block">Visible on standard marksheet</span>
              </div>
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-xs font-bold uppercase text-amber-700 block font-mono">Other Exams Section</span>
                <span className="text-xl font-black text-amber-900">
                  {examTypesList.filter((t) => !t.showInStudentMarksheet).length}
                </span>
                <span className="text-xs text-amber-700 block">Unit tests, Practicals &amp; Olympiads</span>
              </div>
              <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-200">
                <span className="text-xs font-bold uppercase text-indigo-600 block font-mono">Operational Status</span>
                <span className="text-xl font-black text-indigo-900">
                  {examTypesList.filter((t) => t.enabled).length} Active
                </span>
              </div>
            </div>
          </div>

          {/* Table of Exam Types */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Configured Examination Types</h4>
                <span className="text-xs text-slate-500">
                  Principal configures evaluation heads for each exam type; Teachers enter marks for their tagged classes.
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-mono text-xs border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Exam Code</th>
                    <th className="py-3 px-4">Exam Title &amp; Scope</th>
                    <th className="py-3 px-4">Academic Year</th>
                    <th className="py-3 px-4">Student Module Placement</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {examTypesList.map((exam) => (
                    <tr key={exam.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-700">
                        {exam.code}
                        {exam.isDefault && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs bg-slate-200 text-slate-700">
                            System
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{exam.name}</div>
                        <div className="text-xs text-slate-500 max-w-sm truncate">{exam.description}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {exam.academicYear || '2026-2027'}
                      </td>
                      <td className="py-3.5 px-4">
                        {confirmMarksheetToggleExamId === exam.id ? (
                          <div className="p-2 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5 max-w-xs">
                            <p className="text-xs font-bold text-amber-900 leading-tight">
                              Published result cohorts exist. Re-routing changes live student marksheet placement. Proceed?
                            </p>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleExamShowMarksheet(exam.id, exam.showInStudentMarksheet, true)
                                }
                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition"
                              >
                                Confirm Toggle
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmMarksheetToggleExamId(null)}
                                className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleExamShowMarksheet(exam.id, exam.showInStudentMarksheet)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                exam.showInStudentMarksheet
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                              }`}
                              title="Click to toggle display between Main Marksheet vs Other Exams sub-tab"
                            >
                              {exam.showInStudentMarksheet ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Main Marksheet</span>
                                </>
                              ) : (
                                <>
                                  <FileCheck className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Other Exams</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {confirmDisableExamId === exam.id ? (
                          <div className="p-2 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5 max-w-[210px]">
                            <p className="text-xs font-bold text-amber-900 leading-tight">
                              Active heads/evaluations exist. Disable exam anyway?
                            </p>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleExamStatus(exam.id, exam.enabled, true)}
                                className="px-2 py-0.5 bg-amber-600 text-white rounded text-xs font-bold hover:bg-amber-700"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDisableExamId(null)}
                                className="px-2 py-0.5 bg-white text-slate-600 border border-slate-300 rounded text-xs font-bold hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleToggleExamStatus(exam.id, exam.enabled)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                              exam.enabled
                                ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {exam.enabled ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-blue-600" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4 text-slate-400" />
                                <span>Disabled</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditExamModal(exam)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Edit Exam Configuration"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {!exam.isDefault && (
                            <button
                              onClick={() => handleDeleteExam(exam.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Exam Type"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal for Add / Edit Exam Type */}
          {isExamModalOpen && (
            <div role="dialog" aria-modal="true" aria-label="Examination Type Configuration" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Award className="w-5 h-5 text-amber-300" />
                    <h3 className="font-bold text-sm">
                      {editingExam ? 'Edit Examination Type' : 'Create New Examination Type'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsExamModalOpen(false)}
                    className="p-1 hover:bg-purple-800 rounded-lg text-purple-200 hover:text-white transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveExamForm} className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Exam Type Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={examFormName}
                      onChange={(e) => setExamFormName(e.target.value)}
                      placeholder="e.g. Unit Test 3, Annual Examination, State Olympiad"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Exam Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={examFormCode}
                        onChange={(e) => setExamFormCode(e.target.value)}
                        placeholder="e.g. UT3, ANNUAL, OLYMP"
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Academic Year
                      </label>
                      <input
                        type="text"
                        value={examFormAY}
                        onChange={(e) => setExamFormAY(e.target.value)}
                        placeholder="2026-2027"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Description &amp; Purpose
                    </label>
                    <textarea
                      value={examFormDesc}
                      onChange={(e) => setExamFormDesc(e.target.value)}
                      rows={2}
                      placeholder="e.g. Continuous formative internal evaluation for Semester syllabus"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  {/* Toggle: Show marksheet in Student module */}
                  <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs font-bold text-purple-950">
                        Show marksheet in Student module
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(examFormShowMarksheet)}
                        onChange={(e) => setExamFormShowMarksheet(Boolean(e.target.checked))}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                    </label>
                    <p className="text-xs text-purple-800 leading-relaxed">
                      {examFormShowMarksheet
                        ? '✓ Enabled: Results for this exam will appear directly in the student’s primary Marksheet menu.'
                        : '★ Disabled: Results will be isolated into the dedicated "Other Exams" sub-tab in the student portal.'}
                    </p>
                  </div>

                  {/* Toggle: Enabled Status */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Exam Active Status</span>
                      <span className="text-xs text-slate-500 block">Allows faculty members to enter evaluation data</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(examFormEnabled)}
                        onChange={(e) => setExamFormEnabled(Boolean(e.target.checked))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                    </label>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsExamModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingExam ? 'Save Changes' : 'Create Exam Type'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 0A: GRADE MANAGEMENT OVERVIEW SETTINGS & EVALUATION HEADS (Admin Authority) */}
      {activeTab === 'grade_heads' && (
        <div className="space-y-6">
          {/* Admin Constitution & Overview Banner */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Sliders className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-slate-900 text-lg">Grade Management Overview & Evaluation Heads</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Admin governs the evaluation schema, head sequences, default values, and custom dropdown options. Faculty inputs marks and sets maximum ceilings within this grid.
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold font-mono">
                Admin Exclusive Authority
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block uppercase font-bold text-xs">Total Evaluation Heads</span>
                <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">{gradeHeads.length}</span>
                <p className="text-xs text-slate-500 mt-1">Configured in student evaluation grid</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block uppercase font-bold text-xs">Numeric Scoring Heads</span>
                <span className="text-2xl font-black text-indigo-600 font-mono mt-0.5 block">
                  {gradeHeads.filter((h) => h.type === 'number').length}
                </span>
                <p className="text-xs text-slate-500 mt-1">Faculty sets max marks (e.g. 30, 70)</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block uppercase font-bold text-xs">Qualitative Dropdown Heads</span>
                <span className="text-2xl font-black text-amber-600 font-mono mt-0.5 block">
                  {gradeHeads.filter((h) => h.type === 'dropdown').length}
                </span>
                <p className="text-xs text-slate-500 mt-1">Admin curated option lists for teachers</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Evaluation Heads Table & Re-sequencing */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-indigo-600" />
                    Evaluation Grid Head Hierarchy & Sequence
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Columns appear in the Faculty Marks Entry sheet strictly in this numerical sequence order.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500 font-semibold">{gradeHeads.length} Heads</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/75 text-slate-600 uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-center">Seq #</th>
                      <th className="px-4 py-3">Evaluation Head Title</th>
                      <th className="px-4 py-3">Head Type</th>
                      <th className="px-4 py-3">Default Value</th>
                      <th className="px-4 py-3">Dropdown Choices (If Dropdown)</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {gradeHeads.map((head, idx) => (
                      <tr key={head.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 text-center">
                          <span className="w-6 h-6 rounded-full bg-slate-200 font-mono font-bold text-slate-700 inline-flex items-center justify-center text-xs">
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{head.name}</div>
                          <span className="text-xs text-slate-400 font-mono">ID: {head.id}</span>
                        </td>
                        <td className="px-4 py-3">
                          {head.type === 'number' ? (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Numeric Marks
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Dropdown Selection
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                          {head.defaultValue !== undefined ? String(head.defaultValue) : '—'}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          {head.type === 'dropdown' && head.dropdownOptions && head.dropdownOptions.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {head.dropdownOptions.map((opt, optIdx) => (
                                <span
                                  key={optIdx}
                                  className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium border border-slate-200"
                                >
                                  {opt}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Faculty marks input (0 - Max)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Sequence up */}
                            <button
                              onClick={() => handleMoveHead(idx, 'up')}
                              disabled={idx === 0}
                              title="Move Head Up in Sequence"
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            {/* Sequence down */}
                            <button
                              onClick={() => handleMoveHead(idx, 'down')}
                              disabled={idx === gradeHeads.length - 1}
                              title="Move Head Down in Sequence"
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            {/* Edit */}
                            <button
                              onClick={() => setEditingHead(head)}
                              title="Modify Head Settings"
                              className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {/* Delete (if not critical) */}
                            <button
                              onClick={() => handleDeleteHead(head.id)}
                              title="Delete Head"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Col: Add New Evaluation Head */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Add New Evaluation Head
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Introduce a new numeric scoring head or qualitative dropdown for teachers.
                </p>
              </div>

              <form onSubmit={handleAddHead} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Evaluation Head Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mid-Term Examination, Viva Voce"
                    value={newHeadName}
                    onChange={(e) => setNewHeadName(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Head Type *</label>
                  <select
                    value={newHeadType}
                    onChange={(e) => {
                      const t = e.target.value as 'number' | 'dropdown';
                      setNewHeadType(t);
                      if (t === 'dropdown') {
                        setNewHeadDefault('Good');
                      } else {
                        setNewHeadDefault('20');
                      }
                    }}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  >
                    <option value="number">Numeric Marks Input (Faculty sets max marks)</option>
                    <option value="dropdown">Dropdown Selection (Selected by Faculty)</option>
                  </select>
                </div>

                {newHeadType === 'dropdown' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Dropdown Options (Comma separated) *
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Distinction, First Class, Second Class, Pass"
                      value={newHeadOptions}
                      onChange={(e) => setNewHeadOptions(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      These values will appear as a selectable dropdown list for teachers when grading.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Default Pre-filled Value</label>
                  <input
                    type="text"
                    placeholder={newHeadType === 'number' ? 'e.g. 25' : 'e.g. Good'}
                    value={newHeadDefault}
                    onChange={(e) => setNewHeadDefault(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Initial value pre-populated in the evaluation sheet before faculty marks entry.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add Head to Grid
                </button>
              </form>
            </div>
          </div>

          {/* Edit Head Modal */}
          {editingHead && (
            <div role="dialog" aria-modal="true" aria-label="Modify Evaluation Head" className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h4 className="font-bold text-slate-900 text-sm">Modify Evaluation Head</h4>
                  <button
                    onClick={() => setEditingHead(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateHead} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Head Name</label>
                    <input
                      type="text"
                      required
                      value={editingHead.name}
                      onChange={(e) => setEditingHead({ ...editingHead, name: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Type</label>
                    <select
                      value={editingHead.type}
                      onChange={(e) =>
                        setEditingHead({
                          ...editingHead,
                          type: e.target.value as 'number' | 'dropdown',
                          dropdownOptions:
                            e.target.value === 'dropdown'
                              ? editingHead.dropdownOptions || ['Excellent', 'Good', 'Average', 'Needs Improvement']
                              : undefined,
                        })
                      }
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      <option value="number">Numeric Marks Input</option>
                      <option value="dropdown">Dropdown Selection</option>
                    </select>
                  </div>

                  {editingHead.type === 'dropdown' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Dropdown Options (comma separated)
                      </label>
                      <textarea
                        rows={2}
                        value={(editingHead.dropdownOptions || []).join(', ')}
                        onChange={(e) =>
                          setEditingHead({
                            ...editingHead,
                            dropdownOptions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Default Value</label>
                    <input
                      type="text"
                      value={editingHead.defaultValue !== undefined ? String(editingHead.defaultValue) : ''}
                      onChange={(e) =>
                        setEditingHead({
                          ...editingHead,
                          defaultValue:
                            editingHead.type === 'number' ? Number(e.target.value) || 0 : e.target.value,
                        })
                      }
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingHead(null)}
                      className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 0B: RESULT RELEASE DATES CALENDAR (Principal & Accountant Authority) */}
      {activeTab === 'results_calendar' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <CalendarDays className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-lg">
                    Official Semester Result Declaration Calendar (FY-Wise)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Principal or Accountant decides the official result date for each semester. Published results remain under statutory embargo until the official declaration date arrives.
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold font-mono">
                Principal & Accountant Authority
              </span>
            </div>

            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Official Result Display Rule:</strong>
                Teacher marks entry and evaluation will be recorded upon submission, but marksheets and grade transcripts are exclusively withheld from student portals until the official declaration date set here. On or after this declaration date, the marksheet unlocks automatically.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Schedule Grid */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    Official Result Release Schedule
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click the date picker on any semester to adjust the publication embargo date.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500 font-semibold">{resultDeclarations.length} Cycles</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/75 text-slate-600 uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Academic FY</th>
                      <th className="px-4 py-3">Semester</th>
                      <th className="px-4 py-3">Applicable Course</th>
                      <th className="px-4 py-3">Result Declaration Date</th>
                      <th className="px-4 py-3">Declared Authority</th>
                      <th className="px-4 py-3 text-center">Student Visibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {resultDeclarations.map((dec) => {
                      const todayStr = getISTDateString();
                      const isReleased =
                        dec.status !== 'Embargoed' &&
                        (dec.isPublished === true ||
                          dec.status === 'Published' ||
                          (dec.isPublished !== false && todayStr >= dec.declarationDate));

                      return (
                        <tr key={dec.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">{dec.financialYear}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              Semester {dec.semester}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">{dec.course}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="date"
                                value={dec.declarationDate}
                                onChange={(e) => handleUpdateDeclarationDate(dec.id, e.target.value)}
                                className="border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                              {!isReleased && (
                                <button
                                  onClick={() => handleUpdateDeclarationDate(dec.id, todayStr)}
                                  className="px-2 py-1 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded whitespace-nowrap"
                                  title="Release results today for students"
                                >
                                  Release Today
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{dec.declaredByName}</div>
                            <span className="text-xs uppercase font-bold text-slate-400 font-mono">
                              Role: {dec.declaredByRole}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isReleased ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                UNLOCKED & VISIBLE
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center gap-1">
                                <Lock className="w-3 h-3 text-amber-600" />
                                EMBARGO (LOCKED)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Col: Schedule Result Declaration */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-600" />
                  Schedule Result Declaration
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set the official result publication date for an examination cycle.
                </p>
              </div>

              <form onSubmit={handleAddDeclaration} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Financial / Academic Year *</label>
                  <select
                    value={newDecFY}
                    onChange={(e) => setNewDecFY(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-slate-50"
                  >
                    <option value="2026-2027">FY 2026-2027 (Current)</option>
                    <option value="2025-2026">FY 2025-2026</option>
                    <option value="2024-2025">FY 2024-2025</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Semester *</label>
                  <select
                    value={newDecSem}
                    onChange={(e) => setNewDecSem(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-slate-50"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Course Cohort</label>
                  <select
                    value={newDecCourse}
                    onChange={(e) => setNewDecCourse(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-slate-50"
                  >
                    <option value="All Courses">All Courses (Institution-wide)</option>
                    {availableCourses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Official Result Date *</label>
                  <input
                    type="date"
                    required
                    value={newDecDate}
                    onChange={(e) => setNewDecDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-slate-50"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Date when official marksheets become accessible to enrolled students.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Declaring Authority *</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50">
                      <input
                        type="radio"
                        name="authRole"
                        checked={newDecRole === 'principal'}
                        onChange={() => {
                          setNewDecRole('principal');
                          setNewDecAuthorityName('Dr. S. N. Sharma (Principal)');
                        }}
                      />
                      <span className="font-semibold text-xs">Principal</span>
                    </label>
                    <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50">
                      <input
                        type="radio"
                        name="authRole"
                        checked={newDecRole === 'accountant'}
                        onChange={() => {
                          setNewDecRole('accountant');
                          setNewDecAuthorityName('Mr. R. C. Verma (Chief Finance Officer)');
                        }}
                      />
                      <span className="font-semibold text-xs">Accountant</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={newDecAuthorityName}
                    onChange={(e) => setNewDecAuthorityName(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold bg-slate-50"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                >
                  <CalendarDays className="w-4 h-4" />
                  Save Declaration Schedule
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: UGC AUTONOMOUS DEGREE DIVISION CLASSIFICATION */}
      {activeTab === 'degree_divisions' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Header & Autonomous Statutory Callout */}
          <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Award className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">
                    UGC Autonomous Degree Division Classification Regulations
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Statutory classification criteria for consolidated grade sheets, degree transcripts, and convocation award registers.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={handleResetStandardDivisionRules}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                title="Reset to UGC model guidelines"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={handleAddDivisionTier}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                Add Tier
              </button>
              <button
                type="button"
                onClick={handleSaveDivisionRules}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                Save Regulations
              </button>
            </div>
          </div>

          {/* Statutory Autonomous Notification Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Autonomous Statutory Authority (UGC Autonomous Guidelines Section 3.4)</span>
            </div>
            <p>
              Autonomous colleges hold full administrative custody to formulate and amend graduation division standings,
              distinction thresholds, and honours criteria. Changes saved here take immediate effect across all future
              transcript generations, student degree cards, and marksheet validation checks.
            </p>
          </div>

          {/* Live Simulator & Tester */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Degree Division Standing Simulator</span>
              </div>
              <p className="text-xs text-slate-500">
                Test how a hypothetical graduate percentage or CGPA maps under the configured regulations.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTestScoreMode('percentage')}
                  className={`px-3 py-1 rounded-lg transition ${
                    testScoreMode === 'percentage'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Percentage (%)
                </button>
                <button
                  type="button"
                  onClick={() => setTestScoreMode('cgpa')}
                  className={`px-3 py-1 rounded-lg transition ${
                    testScoreMode === 'cgpa'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  CGPA (10-Pt)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={testScoreMode === 'percentage' ? 100 : 10}
                  value={testScoreInput}
                  onChange={(e) => setTestScoreInput(e.target.value)}
                  className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono tabular-nums text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  placeholder={testScoreMode === 'percentage' ? 'e.g. 78' : 'e.g. 8.2'}
                />
                <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-bold flex items-center gap-2">
                  <span className="text-slate-400 font-normal">Standing:</span>
                  <span className="text-indigo-700">
                    {classifyDegreeDivision(Number(testScoreInput) || 0, testScoreMode, false, divisionRules)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Classification Tiers Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="py-3 px-4">Classification Division Name</th>
                    <th className="py-3 px-4 w-32">Min % Cutoff</th>
                    <th className="py-3 px-4 w-32">Min CGPA (/10)</th>
                    <th className="py-3 px-4">Statutory Transcript Remark</th>
                    <th className="py-3 px-4 w-28">Standing</th>
                    <th className="py-3 px-4 w-20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {divisionRules.map((rule, idx) => (
                    <tr key={rule.id || `div-${idx}`} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={rule.divisionName}
                          onChange={(e) => handleDivisionRuleChange(idx, 'divisionName', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g. First Class with Distinction"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={rule.minPercentage}
                            onChange={(e) => handleDivisionRuleChange(idx, 'minPercentage', e.target.value)}
                            className="w-20 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold tabular-nums text-slate-800 focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-slate-400 font-mono">%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={rule.minCgpa}
                            onChange={(e) => handleDivisionRuleChange(idx, 'minCgpa', e.target.value)}
                            className="w-20 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold tabular-nums text-slate-800 focus:ring-2 focus:ring-indigo-500"
                          />
                          <span className="text-slate-400 font-mono">/10</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={rule.description}
                          onChange={(e) => handleDivisionRuleChange(idx, 'description', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500"
                          placeholder="Statutory transcript remark"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleDivisionRuleChange(idx, 'isPassing', !rule.isPassing)}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                            rule.isPassing
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {rule.isPassing ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Pass Tier</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Fail Tier</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteDivisionTier(rule.id)}
                          disabled={divisionRules.length <= 2}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete classification tier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom summary and save strip */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <div className="font-mono">
                Active Tiers: <span className="font-bold text-slate-800 tabular-nums">{divisionRules.length}</span> · Passing Tiers:{' '}
                <span className="font-bold text-emerald-700 tabular-nums">
                  {divisionRules.filter((r) => r.isPassing).length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDivisionRules}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Regulations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: PAYMENT GATEWAY CONFIGURATION */}
      {activeTab === 'gateway' && (
        <form
          onSubmit={handleSaveGateway}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6"
        >
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                Payment Gateway & Settlement Configuration
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage merchant credentials, webhooks, and routing between Sandbox and Live production.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                  gatewayConfig.environment === 'production'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                ● {gatewayConfig.environment.toUpperCase()} MODE
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Payment Gateway Provider
              </label>
              <select
                value={gatewayConfig.provider}
                onChange={(e) =>
                  setGatewayConfig({ ...gatewayConfig, provider: e.target.value as any })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="Razorpay">Razorpay (Campus Suite)</option>
                <option value="HDFC SmartGateway">HDFC SmartGateway</option>
                <option value="PayU">PayU Payments</option>
                <option value="BillDesk">BillDesk ERP Gateway</option>
                <option value="SBI ePay">SBI ePay Education Portal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Environment / Mode
              </label>
              <select
                value={gatewayConfig.environment}
                onChange={(e) =>
                  setGatewayConfig({ ...gatewayConfig, environment: e.target.value as any })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="sandbox">Sandbox (Testing / Mock)</option>
                <option value="production">Production (Real Bank Settlements)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Merchant Key ID / Terminal ID
              </label>
              <input
                type="text"
                value={gatewayConfig.merchantId}
                onChange={(e) =>
                  setGatewayConfig({ ...gatewayConfig, merchantId: e.target.value })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. rzp_live_9a87d6e..."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Merchant API Secret / Salt
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={gatewayConfig.apiKey}
                  onChange={(e) =>
                    setGatewayConfig({ ...gatewayConfig, apiKey: e.target.value })
                  }
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Enter secret key..."
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Webhook Notification Endpoint URL
              </label>
              <input
                type="text"
                value={gatewayConfig.webhookUrl}
                onChange={(e) =>
                  setGatewayConfig({ ...gatewayConfig, webhookUrl: e.target.value })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="https://rlsy.edu.in/api/v1/payment-callback"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">3-Way Gateway Reconciliation Compatibility</h4>
              <p className="text-xs text-slate-500">
                Connected to Accountant 3-Way Reconciliation Engine for automated ledger matching and TallyPrime XML export.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg font-mono">
              ACTIVE & VERIFIED
            </span>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Gateway Settings
            </button>
          </div>
        </form>
      )}

      {/* VIEW 2: ATTENDANCE THRESHOLD */}
      {activeTab === 'attendance' && (
        <form
          onSubmit={handleSaveAttendance}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6"
        >
          <div className="border-b border-slate-200 pb-4">
            <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-indigo-600" />
              Statutory Attendance Requirement Threshold
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Set the university statutory percentage required for examination eligibility and hall ticket issuance.
            </p>
          </div>

          <div className="max-w-xl space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Minimum Attendance Percentage Threshold (%)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="50"
                  max="100"
                  step="0.5"
                  value={attendanceInputRaw}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setAttendanceInputRaw(raw);
                    if (raw.trim() !== '' && !isNaN(Number(raw))) {
                      setAttendanceThreshold(Number(raw));
                    }
                  }}
                  className="w-32 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
                <span className="text-xs text-slate-500 font-semibold">% Required</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Standard university guideline is 75.0%. Students with attendance strictly below this threshold will be flagged as defaulters.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Accounts Service Tariff Maximum Fee Ceiling (₹ INR)
              </label>
              <div className="flex items-center space-x-3">
                <span className="text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  min="500"
                  max="1000000"
                  step="500"
                  value={maxServiceFeeRaw}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setMaxServiceFeeRaw(raw);
                    if (raw.trim() !== '' && !isNaN(Number(raw))) {
                      setMaxServiceFee(Number(raw));
                    }
                  }}
                  className="w-44 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
                <span className="text-xs text-slate-500 font-semibold">Max Tariff Allowed for Accountant Desk</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Statutory cap enforced on clearance, duplicate marksheet, migration, and certificate issuance charges. Prevents numerical overflow and excessive student fees.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl text-amber-900 text-xs space-y-1.5">
              <div className="flex items-center space-x-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Statutory Governance Consequences of this Threshold:</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                1. Students below {attendanceThreshold}% are displayed with Shortfall Alert and calculated number of mandatory lectures required to clear exam debarment.
                <br />
                2. Hall ticket generation can be held by the Examination Cell if clearance is blocked.
                <br />
                3. Student attendance menu remains strictly hidden from Principal, Accountant, and Admin as per university statute.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Update Attendance Threshold
            </button>
          </div>
        </form>
      )}

      {/* VIEW 3: SUPPORT TICKETS RAISED */}
      {activeTab === 'tickets' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-indigo-600" />
                Institutional Support Tickets & Inquiries
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and resolve grievances, payment settlement inquiries, and technical issues raised by students and staff.
              </p>
            </div>
            <div className="flex items-center space-x-2 font-mono text-xs">
              <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold">
                {tickets.filter((t) => t.status === 'open').length} Open
              </span>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold">
                {tickets.filter((t) => t.status === 'in_progress').length} In Progress
              </span>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold">
                {tickets.filter((t) => t.status === 'resolved').length} Resolved
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tickets list */}
            <div className="lg:col-span-2 divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {tickets.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No support tickets on record.
                </div>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTicket(t);
                      setResolutionNote(t.adminNotes || '');
                    }}
                    className={`p-4 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      selectedTicket?.id === t.id
                        ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-700">
                          #{t.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold uppercase font-mono ${
                            t.status === 'open'
                              ? 'bg-rose-100 text-rose-800'
                              : t.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {t.status}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          {t.category}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                        {t.subject}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {t.description}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Raised by: <strong className="text-slate-700">{t.raisedByName}</strong> ({t.raisedByRole}) • {t.createdAt}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                          t.priority === 'urgent'
                            ? 'bg-red-500 text-white'
                            : t.priority === 'high'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Ticket Detail / Action Pane */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
              {selectedTicket ? (
                <div className="space-y-4">
                  <div>
                    <span className="font-mono text-xs font-bold text-indigo-700">
                      Ticket #{selectedTicket.id}
                    </span>
                    <h4 className="font-black text-slate-900 text-base mt-1">
                      {selectedTicket.subject}
                    </h4>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Raised by {selectedTicket.raisedByName} on {selectedTicket.createdAt}
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900 mb-1">Issue Description:</p>
                    {selectedTicket.description}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Admin Redressal / Internal Resolution Note
                    </label>
                    <textarea
                      rows={3}
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="Add resolution details or response..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold uppercase text-slate-500 block">
                      Change Status:
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'open')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                          selectedTicket.status === 'open'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                        }`}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'in_progress')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                          selectedTicket.status === 'in_progress'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                        }`}
                      >
                        In Progress
                      </button>
                      <button
                        onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'resolved')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                          selectedTicket.status === 'resolved'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        Resolved
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <LifeBuoy className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Select a ticket from the left panel to review details and take redressal actions.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: SEMESTERS & SECTIONS MANAGEMENT (Admin Controlled; Deactivated by Default) */}
      {activeTab === 'sections' && (
        <div className="space-y-6">
          {/* Statutory Guidance Banner on Section Deactivation & Bypass */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <span>Semester & Section Control Matrix</span>
                  <span className="text-xs font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200 font-bold">
                    Admin Exclusive
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Sections are <strong>deactivated by default</strong> upon definition. If all sections for a course and semester remain deactivated, the application <strong>automatically bypasses the section requirement</strong> across Student Enrollment and Faculty Attendance (allowing whole-cohort attendance). Activate individual sections below whenever division into classes is required.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end md:self-auto text-xs font-mono">
              <div className="bg-white border border-indigo-200 rounded-xl px-3 py-2 text-center">
                <span className="text-xs text-slate-400 block uppercase">Total Defined</span>
                <strong className="text-indigo-900 text-base">{courseSections.length}</strong>
              </div>
              <div className="bg-white border border-emerald-200 rounded-xl px-3 py-2 text-center">
                <span className="text-xs text-emerald-600 block uppercase">Active in App</span>
                <strong className="text-emerald-700 text-base">
                  {courseSections.filter((s) => s.isActive).length}
                </strong>
              </div>
              <div className="bg-white border border-amber-200 rounded-xl px-3 py-2 text-center">
                <span className="text-xs text-amber-600 block uppercase">Deactivated</span>
                <strong className="text-amber-700 text-base">
                  {courseSections.filter((s) => !s.isActive).length}
                </strong>
              </div>
            </div>
          </div>

          {/* 2-Column Grid: Left Define New Section, Right Manage Existing Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 1 Col: Define New Semester Section */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Define New Section</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Will be created as deactivated by default.
                  </p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
              </div>

              <form onSubmit={handleAddSection} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Course</label>
                  <select
                    value={newSectionCourse}
                    onChange={(e) => setNewSectionCourse(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {availableCourses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Semester</label>
                    <select
                      value={newSectionSemester}
                      onChange={(e) => setNewSectionSemester(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Max Capacity</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={newSectionCapacity}
                      onChange={(e) => setNewSectionCapacity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Section Name / Code</label>
                  <input
                    type="text"
                    placeholder="e.g. Section A, Section B, Batch Alpha"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Initial Section Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                        newSectionIsActive
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="newSectionStatus"
                        checked={newSectionIsActive === true}
                        onChange={() => setNewSectionIsActive(true)}
                        className="accent-emerald-600"
                      />
                      <span>Active Now</span>
                    </label>
                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                        !newSectionIsActive
                          ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="newSectionStatus"
                        checked={newSectionIsActive === false}
                        onChange={() => setNewSectionIsActive(false)}
                        className="accent-amber-600"
                      />
                      <span>Inactive</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Define Section ({newSectionIsActive ? 'Active' : 'Inactive'})
                </button>
              </form>
            </div>

            {/* Right 2 Cols: Browse and Activate / Deactivate Sections */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Course Section Registry & Activation</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Toggle activation status to make sections selectable in Student Attendance & Enrollment.
                  </p>
                </div>

                {/* Filter Controls */}
                <div className="flex items-center gap-2">
                  <select
                    value={sectionFilterCourse}
                    onChange={(e) => setSectionFilterCourse(e.target.value)}
                    className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 focus:bg-white max-w-[200px] truncate"
                  >
                    {availableCourses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sectionFilterSemester}
                    onChange={(e) => setSectionFilterSemester(Number(e.target.value))}
                    className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 focus:bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Sem {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sections List for Course and Semester */}
              {(() => {
                const filtered = courseSections.filter(
                  (s) => s.course === sectionFilterCourse && s.semester === sectionFilterSemester
                );
                const allInactive = filtered.length > 0 && filtered.every((s) => !s.isActive);

                return (
                  <div className="space-y-3">
                    {filtered.length > 0 && (
                      <div
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                          allInactive
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        }`}
                      >
                        <span className="font-medium">
                          {allInactive ? (
                            <span>
                              ⚡ <strong>Bypass Active:</strong> All sections for {sectionFilterCourse} (Sem {sectionFilterSemester}) are currently deactivated. Section requirement is bypassed across attendance & enrollment.
                            </span>
                          ) : (
                            <span>
                              ✅ <strong>Active Multi-Section Mode:</strong>{' '}
                              {filtered.filter((s) => s.isActive).length} section(s) activated. Only active sections are presented to students and faculty.
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {filtered.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                        <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                        <h5 className="font-bold text-slate-700 text-xs">
                          No Sections Defined for Sem {sectionFilterSemester}
                        </h5>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Since no sections are defined, this cohort operates in undivided whole-class mode by default. You can define sections using the form on the left.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {filtered.map((sec) => (
                          <div
                            key={sec.id}
                            className={`p-4 rounded-xl border transition-all space-y-3 ${
                              sec.isActive
                                ? 'bg-emerald-50/40 border-emerald-300 shadow-sm'
                                : 'bg-slate-50/80 border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-slate-900 text-sm">{sec.sectionName}</h5>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                                      sec.isActive
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {sec.isActive ? 'Active in App' : 'Deactivated'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                  Capacity: {sec.maxCapacity || 60} Seats
                                  {(() => {
                                    const secLetter = normalizeSectionLetter(sec.sectionName);
                                    const enrolledInSec = students.filter(
                                      (st) =>
                                        st.course === sec.course &&
                                        Number(st.semester) === Number(sec.semester) &&
                                        normalizeSectionLetter(st.section || 'A') === secLetter
                                    ).length;
                                    const maxCap = sec.maxCapacity || 60;
                                    return (
                                      <span
                                        className={`ml-2 px-1.5 py-0.5 rounded text-xs font-bold ${
                                          enrolledInSec > maxCap
                                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                            : 'bg-slate-100 text-slate-700'
                                        }`}
                                      >
                                        Enrolled: {enrolledInSec}/{maxCap}
                                        {enrolledInSec > maxCap ? ' (Over Capacity)' : ''}
                                      </span>
                                    );
                                  })()}
                                </p>
                              </div>

                              <button
                                onClick={() => handleDeleteSection(sec.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                title="Delete section"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Activation Action Button */}
                            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                              <span className="text-xs text-slate-500">
                                {sec.isActive ? 'Available to teachers' : 'Hidden from forms'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleSectionActive(sec.id, sec.isActive)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                                  sec.isActive
                                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                              >
                                {sec.isActive ? (
                                  <>
                                    <ToggleRight className="w-4 h-4 text-rose-600" />
                                    <span>Deactivate</span>
                                  </>
                                ) : (
                                  <>
                                    <ToggleLeft className="w-4 h-4 text-emerald-200" />
                                    <span>Activate Section</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 7: SERVER AUDIT TRAIL, GRADE UNLOCK APPROVALS & ZOD BACKUP/RESTORE */}
      {activeTab === 'audit_backup' && (
        <div className="space-y-6">
          {/* 1. Post-Declaration Grade Unlock Approval Queue */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-600" />
                  Post-Declaration Grade &amp; Marksheet Lock Governance
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Once semester results are declared, marksheets are locked. Approve faculty unlock requests below to grant a temporary 24-hour edit window.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Declared Semester Result Locks and Unlock Approval Queue</caption>
                <thead className="bg-slate-100 text-slate-700 uppercase font-mono text-xs border-b border-slate-200">
                  <tr>
                    <th scope="col" className="py-3 px-4">Course &amp; Semester</th>
                    <th scope="col" className="py-3 px-4">Declaration Status</th>
                    <th scope="col" className="py-3 px-4">Lock State</th>
                    <th scope="col" className="py-3 px-4">Pending Unlock Requests</th>
                    <th scope="col" className="py-3 px-4 text-right">Governance Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultDeclarations.map((dec) => {
                    const isUnlockedNow = hasActiveDeclarationUnlockWindow(dec);
                    const pendingReqs = (dec.unlockRequests || []).filter((r) => r.status === 'Pending');
                    return (
                      <tr key={dec.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {dec.course} • Sem {dec.semester} ({dec.financialYear})
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                            {dec.status || (dec.isPublished ? 'Published' : 'Scheduled')} ({dec.declarationDate})
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {isUnlockedNow ? (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-bold">
                              Unlocked until {new Date(dec.unlockedUntil!).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                              Locked Post-Declaration
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {pendingReqs.length > 0 ? (
                            <span className="font-bold text-amber-800">
                              {pendingReqs.length} Pending Request(s): {pendingReqs[0].reason}
                            </span>
                          ) : (
                            <span className="text-slate-500">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {!isUnlockedNow ? (
                            <button
                              type="button"
                              disabled={pendingReqs.length === 0}
                              onClick={() => {
                                setErrorNotice(null);
                                const activeAdmin = erpStorage.getCurrentUser();
                                if (!activeAdmin || !['principal', 'superadmin'].includes(activeAdmin.role)) {
                                  setErrorNotice('Security Exception: Only an authenticated Principal or Super Admin can approve grade unlock requests.');
                                  return;
                                }
                                try {
                                  const res = erpStorage.approveGradeUnlock24h(dec.id, activeAdmin.role);
                                  onSaveResultDeclarations?.(res.updatedDeclarations);
                                  setAuditLogs(erpStorage.getAuditLogs());
                                  setSaveNotice(
                                    `Approved ${res.approvedCount} pending 24-hour grade edit unlock request(s) for ${dec.course} Sem ${dec.semester}.`
                                  );
                                } catch (err: unknown) {
                                  setErrorNotice(
                                    err instanceof Error ? err.message : 'Unable to approve unlock request.'
                                  );
                                }
                              }}
                              title={
                                pendingReqs.length === 0
                                  ? 'No pending faculty unlock requests to approve'
                                  : 'Approve pending unlock requests for 24 hours'
                              }
                              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-xs transition"
                            >
                              Approve 24h Unlock
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorNotice(null);
                                const activeAdmin = erpStorage.getCurrentUser();
                                if (!activeAdmin || !['principal', 'superadmin'].includes(activeAdmin.role)) {
                                  setErrorNotice('Security Exception: Only an authenticated Principal or Super Admin can re-lock grade sheets.');
                                  return;
                                }
                                try {
                                  const updated = erpStorage.relockResultDeclaration(dec.id, activeAdmin.role);
                                  onSaveResultDeclarations?.(updated);
                                  setAuditLogs(erpStorage.getAuditLogs());
                                  setSaveNotice(`Re-locked grades and revoked active unlock requests for ${dec.course} Sem ${dec.semester}.`);
                                } catch (err: unknown) {
                                  setErrorNotice(
                                    err instanceof Error ? err.message : 'Unable to re-lock result declaration.'
                                  );
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition"
                            >
                              Re-Lock Now
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Zod-Validated Full ERP Backup & Restore */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Zod-Validated Full ERP Data Backup &amp; Schema Restore
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Export all institutional ledgers, students, grades, and attendance to a signed JSON snapshot, or restore from a backup verified against strict Zod schemas.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const sanitizedUsers = erpStorage
                      .getUsers()
                      .map(({ password: _pw, salt: _s, resetToken: _rt, tempPassword: _tp, ...safeUser }) => safeUser);
                    const attendanceRecords = erpStorage.getAttendanceRecords();
                    const payload = {
                      version: '2.0.0',
                      exportedAt: new Date().toISOString(),
                      collegeName: erpStorage.getCollegeProfile().name,
                      data: {
                        students: erpStorage.getStudents(),
                        users: sanitizedUsers,
                        transactions: erpStorage.getTransactions(),
                        grades: erpStorage.getGrades(),
                        attendance: attendanceRecords,
                        attendanceRecords,
                        feeHeads: erpStorage.getFeeHeads(),
                        feeCampaigns: erpStorage.getFeeCampaigns(),
                        concessionRules: erpStorage.getConcessionRules(),
                        resultDeclarations: erpStorage.getResultDeclarations(),
                        notices: erpStorage.getNotices(),
                        auditLogs: erpStorage.getAuditLogs(),
                      },
                    };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `RLSY_ERP_Backup_${getISTDateString()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1500);
                    setSaveNotice('Exported Zod-compatible full ERP JSON backup (credentials excluded).');
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Export Full Backup (.json)
                </button>

                <label className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer">
                  <span>Import &amp; Validate Backup</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBackupError(null);
                      try {
                        const text = await file.text();
                        const rawJson = JSON.parse(text);
                        const serverValidation = await apiClient.validateBackupOnServer(rawJson);
                        if (!serverValidation.valid) {
                          setBackupError(
                            `Zod Schema Validation Failed: ${(serverValidation.issues || []).join('; ')}`
                          );
                          return;
                        }
                        const parsed = ErpBackupSchema.parse(rawJson);
                        const restoredStudents = parsed.data.students as unknown as Student[];
                        erpStorage.saveStudents(restoredStudents);
                        onBatchUpdateStudents?.(restoredStudents);

                        const rawData = parsed.data as Record<string, any>;
                        if (Array.isArray(rawData.transactions) && rawData.transactions.length > 0) {
                          erpStorage.saveTransactions(rawData.transactions);
                        }
                        if (Array.isArray(rawData.grades) && rawData.grades.length > 0) {
                          erpStorage.saveGrades(rawData.grades);
                        }
                        const restoredAttendance = Array.isArray(rawData.attendanceRecords)
                          ? rawData.attendanceRecords
                          : Array.isArray(rawData.attendance)
                          ? rawData.attendance
                          : null;
                        if (restoredAttendance && restoredAttendance.length > 0) {
                          erpStorage.saveAttendanceRecords(restoredAttendance);
                        }
                        if (Array.isArray(rawData.feeHeads) && rawData.feeHeads.length > 0) {
                          erpStorage.saveFeeHeads(rawData.feeHeads);
                        }
                        if (Array.isArray(rawData.resultDeclarations) && rawData.resultDeclarations.length > 0) {
                          erpStorage.saveResultDeclarations(rawData.resultDeclarations);
                          onSaveResultDeclarations?.(rawData.resultDeclarations);
                        }
                        if (Array.isArray(rawData.notices) && rawData.notices.length > 0) {
                          erpStorage.saveNotices(rawData.notices);
                        }

                        const activeAdmin = erpStorage.getCurrentUser();
                        erpStorage.appendAuditLog({
                          actorId: activeAdmin?.id || 'ADMIN',
                          actorName: activeAdmin?.name || 'Super Admin',
                          actorRole: activeAdmin?.role || 'superadmin',
                          action: 'BACKUP_IMPORT',
                          entityType: 'ERP_Snapshot',
                          entityId: parsed.exportedAt,
                          summary: `Imported & Zod-validated ERP backup (${parsed.data.students.length} students, ${parsed.data.transactions.length} transactions, ${parsed.data.grades.length} grades).`,
                        });
                        setAuditLogs(erpStorage.getAuditLogs());
                        setSaveNotice(
                          `Backup verified via Zod schema and restored (${parsed.data.students.length} students, ${parsed.data.transactions.length} transactions).`
                        );
                      } catch (err: unknown) {
                        setBackupError(
                          err instanceof Error
                            ? err.message
                            : 'Invalid JSON backup file.'
                        );
                      } finally {
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {backupError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {backupError}
              </div>
            )}
          </div>

          {/* 3. Server-Side & Local Immutable Audit Log Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Server-Side Immutable Audit Trail (Fees, Grades, Promotions &amp; Security)
                </h3>
                <p className="text-xs text-slate-500">
                  Records who performed each sensitive mutation, when, and the old/new values.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-mono font-bold">
                {auditLogs.length} Entries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Institutional Server Audit Log</caption>
                <thead className="bg-slate-100 text-slate-700 uppercase font-mono text-xs border-b border-slate-200">
                  <tr>
                    <th scope="col" className="py-3 px-4">Timestamp</th>
                    <th scope="col" className="py-3 px-4">Actor (Role)</th>
                    <th scope="col" className="py-3 px-4">Action</th>
                    <th scope="col" className="py-3 px-4">Entity</th>
                    <th scope="col" className="py-3 px-4">Audit Summary &amp; Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                        No audit mutations recorded yet in this session. Fee payments, grade edits, and promotions will appear here automatically.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.slice(0, 50).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {log.actorName}{' '}
                          <span className="font-mono text-xs text-indigo-700 uppercase">
                            ({log.actorRole})
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-purple-700">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {log.entityType} #{log.entityId}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <div>{log.summary}</div>
                          {(log.oldValue !== undefined || log.newValue !== undefined) && (
                            <div className="mt-1 font-mono text-xs text-slate-500 truncate max-w-md">
                              {log.oldValue !== undefined && `Old: ${JSON.stringify(log.oldValue)} → `}
                              {log.newValue !== undefined && `New: ${JSON.stringify(log.newValue)}`}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettingsModule;

