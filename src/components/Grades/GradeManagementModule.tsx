import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Student,
  ExamGradeRecord,
  FacultyMapping,
  UserRole,
  UserAccount,
  GradeEvaluationHead,
  SemesterResultDeclaration,
  ExamTypeConfig,
  ExamEvaluationHead,
  StudentExamEvaluation,
  CompactAuditLog,
  ExamEvaluationStatus,
} from '../../types/erp';
import { calculateGradePoint, calculateSGPA, getCurrentAcademicYear, getISTDateString } from '../../utils/erpLogic';
import { checkPostDeclarationGradeLock } from '../../domain/grades';
import { apiClient } from '../../services/apiClient';
import { PrintableMarksheet } from '../Common/PrintableMarksheet';
import { erpStorage } from '../../services/erpStorage';
import {
  Award,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Printer,
  TrendingUp,
  Save,
  Users,
  Search,
  Star,
  Sliders,
  CalendarDays,
  Lock,
  Sparkles,
  X,
  Settings,
  Calendar,
  ShieldCheck,
  Send,
  RotateCcw,
  Clock,
  UserCheck,
  Check,
  Layers,
  FileCheck,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface GradeManagementModuleProps {
  students: Student[];
  grades: ExamGradeRecord[];
  facultyMappings?: FacultyMapping[];
  currentRole?: UserRole;
  currentUser?: UserAccount;
  gradeHeads?: GradeEvaluationHead[];
  resultDeclarations?: SemesterResultDeclaration[];
  onSaveGrade: (grade: Omit<ExamGradeRecord, 'id' | 'letterGrade' | 'gradePoint'> & { totalMarks?: number }) => void;
  onSaveResultDeclarations?: (declarations: SemesterResultDeclaration[]) => void;
  onSyncResultDeclarations?: (declarations: SemesterResultDeclaration[]) => void;
  initialSubjectCode?: string;
}

export const GradeManagementModule: React.FC<GradeManagementModuleProps> = ({
  students,
  grades,
  facultyMappings = [],
  currentRole,
  currentUser,
  gradeHeads = [],
  resultDeclarations = [],
  onSaveGrade,
  onSaveResultDeclarations,
  onSyncResultDeclarations,
  initialSubjectCode,
}) => {
  const [activeTab, setActiveTab] = useState<'entry' | 'transcripts' | 'analytics'>('entry');

  // --------------------------------------------------------------------------
  // 1. TEACHER RIGHTS: RESTRICT ONLY TO MAPPED CLASSES & SUBJECTS
  // --------------------------------------------------------------------------
  const myFacultyMappings = useMemo(() => {
    if (currentRole !== 'faculty' || !currentUser) {
      return facultyMappings;
    }
    const normUserEmail = (currentUser.email || '').trim().toLowerCase();
    const normUserName = (currentUser.name || '').trim().toLowerCase();
    return facultyMappings.filter((m) => {
      if (m.facultyId && (m.facultyId === currentUser.facultyId || m.facultyId === currentUser.id)) {
        return true;
      }
      const normMapEmail = (m.facultyEmail || '').trim().toLowerCase();
      if (normUserEmail && normMapEmail && normMapEmail === normUserEmail) {
        return true;
      }
      const normMapName = (m.facultyName || '').trim().toLowerCase();
      return Boolean(normUserName && normMapName && normMapName === normUserName);
    });
  }, [currentRole, currentUser, facultyMappings]);

  // Derived courses based on teacher mapping
  const availableCourses = useMemo(() => {
    if (currentRole === 'faculty') {
      if (myFacultyMappings.length > 0) {
        return Array.from(new Set(myFacultyMappings.map((m) => m.course).filter(Boolean)));
      }
      return [];
    }
    return [
      'B.Tech Computer Science & Engineering',
      'B.Tech Electronics & Communication',
      'BCA (Bachelor of Computer Applications)',
      'B.Sc. Information Technology',
      'B.Sc Physics Hons',
      'B.Com Hons Accounting',
    ];
  }, [currentRole, myFacultyMappings]);

  const [selectedCourse, setSelectedCourse] = useState<string>(() => availableCourses[0] || 'B.Tech Computer Science & Engineering');

  useEffect(() => {
    if (availableCourses.length > 0 && !availableCourses.includes(selectedCourse)) {
      setSelectedCourse(availableCourses[0]);
    }
  }, [availableCourses, selectedCourse]);

  // Derived semesters based on selected course and teacher mapping
  const availableSemesters = useMemo(() => {
    if (currentRole === 'faculty') {
      if (myFacultyMappings.length > 0) {
        const sems = myFacultyMappings
          .filter((m) => m.course === selectedCourse)
          .map((m) => m.semester);
        const unique = Array.from(new Set(sems)).sort((a, b) => a - b);
        return unique.length > 0 ? unique : [5];
      }
      return [5];
    }
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }, [currentRole, myFacultyMappings, selectedCourse]);

  const [selectedSemester, setSelectedSemester] = useState<number>(() => availableSemesters[0] || 5);

  useEffect(() => {
    if (availableSemesters.length > 0 && !availableSemesters.includes(selectedSemester)) {
      setSelectedSemester(availableSemesters[0]);
    }
  }, [availableSemesters, selectedSemester]);

  // Derived subjects based on selected course, semester, and teacher mapping
  const availableSubjects = useMemo(() => {
    if (currentRole === 'faculty') {
      const matched = myFacultyMappings.filter(
        (m) => m.course === selectedCourse && m.semester === selectedSemester
      );
      if (matched.length > 0) {
        return matched.map((m) => ({
          code: m.subjectCode,
          name: m.subjectName,
          credits: m.credits || 4,
        }));
      }
      // If user has mappings in this course overall
      const byCourse = myFacultyMappings.filter((m) => m.course === selectedCourse);
      if (byCourse.length > 0) {
        return byCourse.map((m) => ({
          code: m.subjectCode,
          name: m.subjectName,
          credits: m.credits || 4,
        }));
      }
      return [];
    }
    return [
      { code: 'CS501', name: 'Design & Analysis of Algorithms', credits: 4 },
      { code: 'CS502', name: 'Operating Systems & System Architecture', credits: 4 },
      { code: 'CS503', name: 'Database Management Systems', credits: 4 },
      { code: 'CS504', name: 'Theory of Computation & Automata', credits: 3 },
    ];
  }, [currentRole, myFacultyMappings, selectedCourse, selectedSemester]);

  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>(() => {
    if (initialSubjectCode && availableSubjects.some((s) => s.code === initialSubjectCode)) {
      return initialSubjectCode;
    }
    return availableSubjects[0]?.code || 'CS501';
  });

  useEffect(() => {
    if (initialSubjectCode && availableSubjects.some((s) => s.code === initialSubjectCode)) {
      setSelectedSubjectCode(initialSubjectCode);
    } else if (availableSubjects.length > 0 && !availableSubjects.some((s) => s.code === selectedSubjectCode)) {
      setSelectedSubjectCode(availableSubjects[0].code);
    }
  }, [initialSubjectCode, availableSubjects, selectedSubjectCode]);

  const currentSubject = availableSubjects.find((s) => s.code === selectedSubjectCode) || availableSubjects[0] || {
    code: 'CS501',
    name: 'Core Discipline Paper',
    credits: 4,
  };

  // --------------------------------------------------------------------------
  // 2. EXAM TYPES & PRINCIPAL-CONFIGURED EVALUATION HEADS
  // --------------------------------------------------------------------------
  const [examTypesList, setExamTypesList] = useState<ExamTypeConfig[]>(() =>
    erpStorage.getExamTypes().filter((e) => e.enabled)
  );

  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    const list = erpStorage.getExamTypes().filter((e) => e.enabled);
    return list[0]?.id || 'EXAM-HALF-YEARLY';
  });

  const selectedExam = useMemo(() => {
    return examTypesList.find((e) => e.id === selectedExamId) || examTypesList[0];
  }, [examTypesList, selectedExamId]);

  // Load heads configured by Principal specifically for this exam type
  const [allExamHeads, setAllExamHeads] = useState<ExamEvaluationHead[]>(() =>
    erpStorage.getExamEvaluationHeads()
  );
  const [evalSyncVersion, setEvalSyncVersion] = useState(0);

  useEffect(() => {
    const syncAcademicConfigs = () => {
      setExamTypesList(erpStorage.getExamTypes().filter((e) => e.enabled));
      setAllExamHeads(erpStorage.getExamEvaluationHeads());
      setEvalSyncVersion((v) => v + 1);
    };
    const unsubscribe = erpStorage.subscribe(syncAcademicConfigs);
    return () => unsubscribe();
  }, []);

  const currentExamHeads = useMemo(() => {
    const headsForExam = allExamHeads
      .filter((h) => h.examTypeId === selectedExamId)
      .sort((a, b) => (a.sequence - b.sequence) || (a.id || '').localeCompare(b.id || ''));

    if (headsForExam.length > 0) return headsForExam;

    // Fallback default heads if none configured yet
    return [
      {
        id: 'HEAD-THEORY-DEF',
        examTypeId: selectedExamId,
        name: 'Theory Paper',
        format: 'marks' as const,
        maxMarks: 70,
        passingMarks: 28,
        isRequired: true,
        sequence: 1,
      },
      {
        id: 'HEAD-INTERNAL-DEF',
        examTypeId: selectedExamId,
        name: 'Internal Assessment',
        format: 'marks' as const,
        maxMarks: 30,
        passingMarks: 12,
        isRequired: true,
        sequence: 2,
      },
      {
        id: 'HEAD-CONDUCT-DEF',
        examTypeId: selectedExamId,
        name: 'Academic Conduct',
        format: 'grades_only' as const,
        maxMarks: 0,
        passingMarks: 0,
        isRequired: false,
        sequence: 3,
        dropdownOptions: ['O (Outstanding)', 'A+ (Excellent)', 'A (Very Good)', 'B (Satisfactory)', 'C (Pass)'],
      },
    ];
  }, [allExamHeads, selectedExamId]);

  // Calculate total max marks for this exam type
  const computedTotalMaxMarks = useMemo(() => {
    const sum = currentExamHeads
      .filter((h) => h.format === 'marks')
      .reduce((acc, h) => acc + h.maxMarks, 0);
    return sum > 0 ? sum : 100;
  }, [currentExamHeads]);

  // --------------------------------------------------------------------------
  // 3. ENROLLED ACTIVE STUDENTS FOR SELECTED COURSE & SEMESTER
  // --------------------------------------------------------------------------
  const enrolledStudents = useMemo(() => {
    const inactiveStatuses = ['withdrawn', 'expelled', 'alumni', 'transferred', 'graduated', 'dropped'];
    return students.filter((s) => {
      const stStatus = String(s.academicStatus || s.enrollmentData?.academicStatus || 'active').toLowerCase();
      if (inactiveStatuses.includes(stStatus)) return false;
      return s.course === selectedCourse && s.semester === selectedSemester;
    });
  }, [students, selectedCourse, selectedSemester]);

  // --------------------------------------------------------------------------
  // 4. STUDENT EVALUATIONS STATE (Loaded from erpStorage & Live Synced, no phantom marks)
  // --------------------------------------------------------------------------
  const buildBlankEvaluation = (stu: Student): StudentExamEvaluation => {
    const defaultHeadScores: Record<string, any> = {};
    currentExamHeads.forEach((h) => {
      if (h.format === 'marks') {
        defaultHeadScores[h.id] = '';
      } else if (h.format === 'grades_only' || h.format === 'dropdown') {
        defaultHeadScores[h.id] = '';
      } else {
        defaultHeadScores[h.id] = '';
      }
    });

    return {
      id: `EVAL-${selectedExamId}-${stu.id}-${selectedSubjectCode}-${selectedSemester}`,
      studentId: stu.id,
      studentRollNo: stu.rollNo,
      studentName: stu.name,
      course: selectedCourse,
      semester: selectedSemester,
      examTypeId: selectedExamId,
      subjectCode: selectedSubjectCode,
      subjectName: currentSubject.name,
      headScores: defaultHeadScores,
      totalMarksObtained: 0,
      maxPossibleMarks: computedTotalMaxMarks,
      overallGrade: 'F',
      attendancePercentage: stu.attendancePercentage ?? 0,
      coScholasticRating: 'Proficient',
      teacherRemarks: '',
      status: 'Draft',
      auditLog: {
        lastModifiedByFacultyName: currentUser?.name || 'Prof. Department Faculty',
        lastModifiedByFacultyId: currentUser?.facultyId || currentUser?.id || 'FAC-001',
        lastModifiedAt: new Date().toISOString(),
      },
    };
  };

  const [evaluationsMap, setEvaluationsMap] = useState<Record<string, StudentExamEvaluation>>(() => {
    const existing = erpStorage.getStudentExamEvaluations();
    const map: Record<string, StudentExamEvaluation> = {};

    enrolledStudents.forEach((stu) => {
      const found = existing.find(
        (e) =>
          e.studentId === stu.id &&
          e.examTypeId === selectedExamId &&
          e.subjectCode === selectedSubjectCode &&
          e.semester === selectedSemester
      );

      map[stu.id] = found || buildBlankEvaluation(stu);
    });

    return map;
  });

  // Re-synchronize when course, semester, subject, exam, or external approvals change
  useEffect(() => {
    const existing = erpStorage.getStudentExamEvaluations();
    const map: Record<string, StudentExamEvaluation> = {};

    enrolledStudents.forEach((stu) => {
      const found = existing.find(
        (e) =>
          e.studentId === stu.id &&
          e.examTypeId === selectedExamId &&
          e.subjectCode === selectedSubjectCode &&
          e.semester === selectedSemester
      );

      map[stu.id] = found || buildBlankEvaluation(stu);
    });

    setEvaluationsMap(map);
  }, [
    selectedCourse,
    selectedSemester,
    selectedSubjectCode,
    selectedExamId,
    enrolledStudents,
    currentExamHeads,
    computedTotalMaxMarks,
    evalSyncVersion,
  ]);

  // Overall Sheet Evaluation Status
  const currentSheetStatus = useMemo<ExamEvaluationStatus>(() => {
    const evals = Object.values(evaluationsMap);
    if (evals.length === 0) return 'Draft';
    if (evals.every((e) => e.status === 'Approved_Published')) return 'Approved_Published';
    if (evals.some((e) => e.status === 'Submitted_For_Review')) return 'Submitted_For_Review';
    if (evals.some((e) => e.status === 'Revision_Requested')) return 'Revision_Requested';
    return 'Draft';
  }, [evaluationsMap]);

  // Check if semester result declaration is already published/locked for this cohort
  const postDeclarationLockStatus = useMemo(() => {
    return checkPostDeclarationGradeLock(selectedSemester, selectedCourse, resultDeclarations);
  }, [resultDeclarations, selectedSemester, selectedCourse]);

  const isCohortDeclarationLocked = postDeclarationLockStatus.isLocked;
  const [unlockRequestReason, setUnlockRequestReason] = useState('');

  const handleRequestPostDeclarationUnlock = () => {
    const cleanReason = unlockRequestReason.trim();
    if (cleanReason.length < 10) {
      showSaveToast(
        'Unlock justification must be at least 10 characters long before submitting to Principal & Super Admin.',
        5000
      );
      return;
    }
    const requesterId = (currentUser?.id || '').trim();
    if (!requesterId || !currentUser?.role) {
      showSaveToast('Authenticated user identity is required to request a grade unlock.', 5000);
      return;
    }

    try {
      const { updatedDeclarations, request } = erpStorage.submitGradeUnlockRequest({
        course: selectedCourse,
        semester: selectedSemester,
        subjectCode: selectedSubjectCode,
        reason: cleanReason,
        declarationId: postDeclarationLockStatus.activeDeclaration?.id,
      });
      if (onSyncResultDeclarations) {
        onSyncResultDeclarations(updatedDeclarations);
      } else if (['principal', 'superadmin'].includes(currentUser.role) && onSaveResultDeclarations) {
        onSaveResultDeclarations(updatedDeclarations);
      }
      void apiClient
        .recordServerAuditLog({
          actorId: requesterId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          action: 'GRADE_UNLOCK_REQUEST',
          entityType: 'SemesterResultDeclaration',
          entityId: request.declarationId || `${selectedCourse}-Sem${selectedSemester}`,
          summary: `Requested post-declaration unlock for ${selectedSubjectCode}: ${cleanReason}`,
          newValue: request,
        })
        .catch((err) => {
          console.warn('Failed to dispatch server audit log:', err);
        });
      setUnlockRequestReason('');
      showSaveToast(
        'Unlock request submitted to Principal & Super Admin for approval.',
        5000
      );
    } catch (err: unknown) {
      showSaveToast(
        err instanceof Error ? err.message : 'Unable to submit unlock request.',
        5000
      );
    }
  };

  // Is sheet currently locked for teacher edits?
  const isSheetLockedForTeacher =
    (currentRole !== 'superadmin' && isCohortDeclarationLocked) ||
    (currentRole === 'faculty' &&
      (currentSheetStatus === 'Submitted_For_Review' || currentSheetStatus === 'Approved_Published'));

  // Most recent compact audit log for the current sheet
  const latestAuditLog = useMemo<CompactAuditLog | null>(() => {
    const evals = Object.values(evaluationsMap);
    if (evals.length === 0) return null;
    let latest: CompactAuditLog | null = evals[0].auditLog ?? null;
    evals.forEach((e) => {
      if (e.auditLog && (!latest || new Date(e.auditLog.lastModifiedAt) > new Date(latest.lastModifiedAt))) {
        latest = e.auditLog;
      }
    });
    return latest;
  }, [evaluationsMap]);

  // Revision notes from Principal (if revision was requested)
  const activeRevisionNote = useMemo(() => {
    const evals = Object.values(evaluationsMap);
    const withNote = evals.find((e) => e.principalRemarks && e.status === 'Revision_Requested');
    return withNote?.principalRemarks || null;
  }, [evaluationsMap]);

  // --------------------------------------------------------------------------
  // 5. CELL VALUE CHANGE HANDLER
  // --------------------------------------------------------------------------
  const handleHeadScoreChange = (studentId: string, headId: string, rawVal: string) => {
    if (isSheetLockedForTeacher) return;

    setEvaluationsMap((prev) => {
      const current = prev[studentId];
      if (!current) return prev;

      const headDef = currentExamHeads.find((h) => h.id === headId);
      let nextVal: any = rawVal;

      if (headDef?.format === 'marks') {
        if (rawVal === '') {
          nextVal = '';
        } else {
          const num = Number(rawVal);
          nextVal = Number.isNaN(num) ? '' : Math.round((num + Number.EPSILON) * 100) / 100;
        }
      }

      const nextHeadScores = {
        ...current.headScores,
        [headId]: nextVal,
      };

      // Recalculate total marks obtained across all marks heads
      let total = 0;
      currentExamHeads.forEach((h) => {
        if (h.format === 'marks') {
          const score = nextHeadScores[h.id];
          if (score !== '' && score !== undefined) {
            total = Math.round(((total + (Number(score) || 0)) + Number.EPSILON) * 100) / 100;
          }
        }
      });

      const customRules = erpStorage.getMarksheetConfig()?.gradingScaleRules;
      const gradeInfo = calculateGradePoint(total, computedTotalMaxMarks, customRules);

      return {
        ...prev,
        [studentId]: {
          ...current,
          headScores: nextHeadScores,
          totalMarksObtained: total,
          overallGrade: gradeInfo.letter,
          status: current.status === 'Revision_Requested' ? 'Revision_Requested' : 'Draft',
        },
      };
    });
  };

  const handleExtraFieldChange = (
    studentId: string,
    field: 'attendancePercentage' | 'coScholasticRating' | 'teacherRemarks',
    val: any
  ) => {
    if (isSheetLockedForTeacher) return;

    setEvaluationsMap((prev) => {
      const current = prev[studentId];
      if (!current) return prev;

      return {
        ...prev,
        [studentId]: {
          ...current,
          [field]: val,
          status: current.status === 'Revision_Requested' ? 'Revision_Requested' : 'Draft',
        },
      };
    });
  };

  // Validation errors check (marks exceeding maxMarks or < 0)
  const validationErrors = useMemo(() => {
    const errors: Array<{
      studentRollNo: string;
      studentName: string;
      headName: string;
      value: number;
      maxCeiling: number;
    }> = [];

    Object.values(evaluationsMap).forEach((evalItem) => {
      const scores = evalItem.headScores || evalItem.headValues || {};
      currentExamHeads.forEach((head) => {
        if (head.format === 'marks') {
          const raw = scores[head.id];
          if (raw !== '' && raw !== undefined) {
            const valNum = Number(raw);
            if (valNum > head.maxMarks || valNum < 0 || isNaN(valNum)) {
              errors.push({
                studentRollNo: evalItem.studentRollNo,
                studentName: evalItem.studentName,
                headName: head.name,
                value: valNum,
                maxCeiling: head.maxMarks,
              });
            }
          }
        }
      });
    });

    return errors;
  }, [evaluationsMap, currentExamHeads]);

  const hasValidationErrors = validationErrors.length > 0;

  // --------------------------------------------------------------------------
  // 6. SAVE DRAFT vs SUBMIT FOR REVIEW & LOCK
  // --------------------------------------------------------------------------
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const saveToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSaveToast = (msg: string, durationMs: number = 5000) => {
    if (saveToastTimerRef.current) {
      clearTimeout(saveToastTimerRef.current);
      saveToastTimerRef.current = null;
    }
    setSaveToast(msg);
    saveToastTimerRef.current = setTimeout(() => {
      saveToastTimerRef.current = null;
      setSaveToast(null);
    }, durationMs);
  };

  useEffect(() => {
    return () => {
      if (saveToastTimerRef.current) {
        clearTimeout(saveToastTimerRef.current);
        saveToastTimerRef.current = null;
      }
    };
  }, []);

  const handleSaveEvaluations = (submitForReview: boolean) => {
    if (isSheetLockedForTeacher) {
      showSaveToast(
        '🔒 Sheet Locked: Semester results are published or awaiting Principal review. Modifications are prohibited.',
        5000
      );
      return;
    }

    if (currentRole === 'faculty') {
      const isAuthorizedForSubject = myFacultyMappings.some(
        (m) =>
          (m.course || '').trim().toLowerCase() === (selectedCourse || '').trim().toLowerCase() &&
          (m.subjectCode || '').trim().toUpperCase() === (selectedSubjectCode || '').trim().toUpperCase()
      );
      if (!isAuthorizedForSubject) {
        showSaveToast(
          `⛔ Unauthorized Grade Entry: You are not mapped to teach ${selectedSubjectCode} (${selectedCourse}).`,
          5000
        );
        return;
      }
    }

    if (hasValidationErrors) {
      showSaveToast(
        `⚠️ Cannot save: ${validationErrors.length} mark entry exceeds maximum ceiling cap. Please correct highlighted cells.`,
        5000
      );
      return;
    }

    const marksHeads = currentExamHeads.filter((h) => h.format === 'marks');

    if (submitForReview) {
      const missingRequired = Object.values(evaluationsMap).some((item) => {
        const scores = item.headScores || item.headValues || {};
        return marksHeads.some(
          (h) => h.isRequired && (scores[h.id] === '' || scores[h.id] === undefined || scores[h.id] === null)
        );
      });
      if (missingRequired) {
        showSaveToast(
          '⚠️ Cannot submit for review: Please enter marks for all required numeric evaluation heads before submitting.',
          5000
        );
        return;
      }
    }

    const facultyName = currentUser?.name || 'Prof. Department Faculty';
    const facultyId = currentUser?.facultyId || currentUser?.id || 'FAC-001';
    const timestamp = new Date().toISOString();
    const istDate = getISTDateString();

    const targetStatus: ExamEvaluationStatus = submitForReview ? 'Submitted_For_Review' : 'Draft';

    // Only persist rows that have at least one entered value or already exist in evaluations
    const touchedEvaluations: StudentExamEvaluation[] = Object.values(evaluationsMap)
      .filter((item) => {
        if (submitForReview) return true;
        const scores = item.headScores || item.headValues || {};
        return (
          Object.values(scores).some((v) => v !== '' && v !== undefined && v !== null) ||
          Boolean(item.teacherRemarks?.trim())
        );
      })
      .map((item) => ({
        ...item,
        status: targetStatus,
        auditLog: {
          lastModifiedByFacultyName: facultyName,
          lastModifiedByFacultyId: facultyId,
          lastModifiedAt: timestamp,
        },
      }));

    if (touchedEvaluations.length === 0) {
      showSaveToast('Enter marks for at least one student before saving a draft.', 4000);
      return;
    }

    // Save into ERP Storage
    touchedEvaluations.forEach((item) => {
      erpStorage.saveOrUpdateStudentExamEvaluation(item);
    });

    // Update local state map
    setEvaluationsMap((prev) => {
      const next = { ...prev };
      touchedEvaluations.forEach((item) => {
        next[item.studentId] = item;
      });
      return next;
    });

    // Also synchronize with legacy onSaveGrade by partitioning ALL numeric marks heads into Internal vs External
    const isInternalHead = (h: ExamEvaluationHead, idx: number) => {
      const label = `${h.id} ${h.name}`.toLowerCase();
      if (/internal|sessional|practical|lab|assignment|viva|quiz|attendance/.test(label)) return true;
      if (/theory|external|end.?sem|written|annual/.test(label)) return false;
      return idx > 0;
    };
    const maxInternalCap = marksHeads
      .filter((h, idx) => isInternalHead(h, idx))
      .reduce((acc, h) => acc + h.maxMarks, 0);
    const maxExternalCap = marksHeads
      .filter((h, idx) => !isInternalHead(h, idx))
      .reduce((acc, h) => acc + h.maxMarks, 0);
    const currentFY = getCurrentAcademicYear();

    touchedEvaluations.forEach((item) => {
      const scores = item.headScores || item.headValues || {};
      let internalScore = 0;
      let theoryScore = 0;
      marksHeads.forEach((h, idx) => {
        const val = Number(scores[h.id] || 0);
        if (Number.isNaN(val)) return;
        if (isInternalHead(h, idx)) {
          internalScore = Math.round((internalScore + val + Number.EPSILON) * 100) / 100;
        } else {
          theoryScore = Math.round((theoryScore + val + Number.EPSILON) * 100) / 100;
        }
      });
      const combinedTotal = Math.round((internalScore + theoryScore + Number.EPSILON) * 100) / 100;

      onSaveGrade({
        studentId: item.studentId,
        studentRollNo: item.studentRollNo,
        studentName: item.studentName,
        course: item.course,
        semester: item.semester,
        subjectCode: item.subjectCode,
        subjectName: item.subjectName,
        credits: currentSubject.credits,
        internalMarks: internalScore,
        maxInternalMarks: maxInternalCap > 0 ? maxInternalCap : 30,
        externalMarks: theoryScore,
        maxExternalMarks: maxExternalCap > 0 ? maxExternalCap : 70,
        totalMarks: combinedTotal,
        maxMarks: item.maxPossibleMarks ?? computedTotalMaxMarks,
        status: submitForReview ? 'Submitted' : 'Draft',
        facultyPublished: false,
        financialYear: currentFY,
        examSession: `Autumn ${currentFY.split('-')[0]}`,
        evaluationDate: istDate,
        evaluatedByFacultyId: facultyId,
      });
    });

    // Consume single-use approved post-declaration unlock window once grades are saved/submitted
    if (postDeclarationLockStatus.hasApprovedUnlockWindow) {
      const consumedDeclarations = erpStorage.consumeGradeUnlockWindow(
        selectedCourse,
        selectedSemester,
        postDeclarationLockStatus.activeDeclaration?.id
      );
      if (onSyncResultDeclarations) {
        onSyncResultDeclarations(consumedDeclarations);
      } else if (
        currentUser?.role &&
        ['principal', 'superadmin'].includes(currentUser.role) &&
        onSaveResultDeclarations
      ) {
        onSaveResultDeclarations(consumedDeclarations);
      }
    }

    if (submitForReview) {
      try {
        const prefersReduced =
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)')?.matches;
        if (!prefersReduced) {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        }
      } catch {}
      showSaveToast(
        `🔒 Successfully submitted marks for ${selectedExam?.name || 'Exam'} (${currentSubject.code}) for Principal review! Sheet is now locked. Marks will become visible to students once the Principal approves & publishes.`,
        6000
      );
    } else {
      showSaveToast(`Draft evaluations successfully saved for ${currentSubject.name}.`, 5000);
    }
  };

  // Marksheet Viewer Modal State
  const [selectedStudentForMarksheet, setSelectedStudentForMarksheet] = useState<Student | null>(null);
  const [isMarksheetModalOpen, setIsMarksheetModalOpen] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState('');

  // Class Analytics computation (scoped to selectedSemester and custom grading scale)
  const classAnalytics = useMemo(() => {
    const customRules = erpStorage.getMarksheetConfig()?.gradingScaleRules;
    const studentSGPAs = enrolledStudents.map((s) => {
      const sGrades = grades.filter((g) => g.studentId === s.id && g.semester === selectedSemester);
      const res = calculateSGPA(
        sGrades.map((g) => ({
          courseCode: g.subjectCode,
          credits: g.credits,
          marksObtained: g.totalMarks,
          maxMarks: g.maxMarks,
        })),
        customRules
      );
      return {
        student: s,
        sgpa: res.sgpa,
        allPassed: res.allPassed,
        earnedCredits: res.earnedCredits,
        totalCredits: res.totalCredits,
      };
    });

    studentSGPAs.sort((a, b) => b.sgpa - a.sgpa);
    const passingCount = studentSGPAs.filter((s) => s.allPassed && s.sgpa >= 4.0).length;
    const passPercentage = studentSGPAs.length > 0 ? Math.round((passingCount / studentSGPAs.length) * 100) : 0;
    const avgSGPA =
      studentSGPAs.length > 0
        ? (studentSGPAs.reduce((sum, s) => sum + s.sgpa, 0) / studentSGPAs.length).toFixed(2)
        : '0.00';

    return {
      studentSGPAs,
      passPercentage,
      avgSGPA,
      topper: studentSGPAs[0],
      runnerUp: studentSGPAs[1],
      backlogs: studentSGPAs.filter((s) => !s.allPassed),
    };
  }, [enrolledStudents, grades, selectedSemester]);

  // If current role is faculty and has no mappings at all
  if (currentRole === 'faculty' && myFacultyMappings.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">No Course or Subject Mappings Found</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Teacher rights restrict marks entry strictly to mapped classes and subjects. You have not been tagged to any courses or subjects yet. Please request the Principal to assign your academic classes in the Teacher Tagging module.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Navigation Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Academic Grading & Marks Entry Desk</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Teacher enters marks & evaluations only for assigned mapped classes. Principal defines heads; teacher submits for review; Principal approves & publishes.
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('entry')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === 'entry' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Marks Entry Grid
          </button>
          <button
            onClick={() => setActiveTab('transcripts')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === 'transcripts' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Official Transcripts
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === 'analytics' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Academic Performance
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* VIEW 1: SUBJECT MARKS ENTRY */}
      {activeTab === 'entry' && (
        <div className="space-y-6">
          {/* Controls Bar: Exam Type, Course, Semester & Assigned Subject */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Exam Type Selection (Admin Created) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-indigo-600" />
                  Exam Type (Admin Configured)
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full text-xs font-semibold border border-indigo-200 rounded-xl px-3 py-2 bg-indigo-50/40 text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {examTypesList.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} {exam.showInStudentMarksheet ? '★ Main Marksheet' : '• Other Exam'}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <span>Display target:</span>
                  <strong className="text-slate-700 font-medium">
                    {selectedExam?.showInStudentMarksheet ? 'Primary Marksheet' : 'Other Exams Menu (Scorecard)'}
                  </strong>
                </div>
              </div>

              {/* Course & Degree (Restricted to Mapped Classes for Teacher) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  Assigned Course
                </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {availableCourses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {currentRole === 'faculty' && (
                  <span className="text-xs text-emerald-600 font-semibold block mt-1">
                    ✓ Restricted to your mapped classes
                  </span>
                )}
              </div>

              {/* Semester (Restricted to Mapped Semesters) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Semester
                </label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(Number(e.target.value))}
                  className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {availableSemesters.map((sem) => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned Subject (Restricted to Mapped Subjects) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-600" />
                  Assigned Subject Paper
                </label>
                <select
                  value={selectedSubjectCode}
                  onChange={(e) => setSelectedSubjectCode(e.target.value)}
                  className="w-full text-xs font-semibold border border-purple-200 rounded-xl px-3 py-2 bg-purple-50/40 text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {availableSubjects.map((sub) => (
                    <option key={sub.code} value={sub.code}>
                      {sub.code}: {sub.name} ({sub.credits} Credits)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Principal Heads Summary Banner */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Evaluation Heads Set by Principal for {selectedExam?.name}:
                </span>
                {currentExamHeads.map((h) => (
                  <span
                    key={h.id}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    {h.name} {h.format === 'marks' ? `(Max ${h.maxMarks})` : `(${h.format})`}
                  </span>
                ))}
              </div>
              <div className="font-mono text-xs text-slate-600">
                Total Ceiling: <strong className="text-indigo-700">{computedTotalMaxMarks} Marks</strong>
              </div>
            </div>
          </div>

          {/* POST-DECLARATION GRADE LOCK & APPROVAL WORKFLOW BANNER */}
          {isCohortDeclarationLocked && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-xs shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-rose-950 text-sm">
                    Post-Declaration Statutory Grade Lock Active
                  </h4>
                  <p className="text-rose-800 text-xs mt-0.5 leading-relaxed">
                    {postDeclarationLockStatus.reason} Direct marks or marksheet edits require an explicit unlock approval from the Principal or Super Admin.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
                <input
                  type="text"
                  value={unlockRequestReason}
                  onChange={(e) => setUnlockRequestReason(e.target.value)}
                  placeholder="Enter reason for unlock request..."
                  className="px-3 py-2 rounded-xl border border-rose-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 min-w-[220px]"
                />
                <button
                  type="button"
                  onClick={handleRequestPostDeclarationUnlock}
                  className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs transition whitespace-nowrap"
                >
                  Request Unlock Approval
                </button>
              </div>
            </div>
          )}

          {/* STATUS WORKFLOW BANNER */}
          {currentSheetStatus === 'Submitted_For_Review' && (
            <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-blue-950 text-sm">
                    Evaluation Locked: Submitted for Principal Approval
                  </h4>
                  <p className="text-blue-800 text-xs mt-0.5">
                    This marksheet has been submitted by faculty for administrative review. Editing is locked. Marks will become visible to students in their portal only after the Principal approves and publishes.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs shrink-0 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> In Review by Principal
              </span>
            </div>
          )}

          {currentSheetStatus === 'Approved_Published' && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-emerald-950 text-sm">
                    Approved & Published by Principal
                  </h4>
                  <p className="text-emerald-800 text-xs mt-0.5">
                    Evaluations have been formally verified and published. Results are now visible to enrolled students in their {selectedExam?.showInStudentMarksheet ? 'official Marksheet' : 'Other Exams menu'}. Records are locked against further modification.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs shrink-0 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Published to Students
              </span>
            </div>
          )}

          {currentSheetStatus === 'Revision_Requested' && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-amber-950 text-sm">
                    Revision Requested by Principal
                  </h4>
                  <p className="text-amber-800 text-xs mt-0.5">
                    {activeRevisionNote
                      ? `Principal's Revision Note: "${activeRevisionNote}"`
                      : 'The Principal has returned this marksheet with a request for revision. Please review student scores and resubmit for approval.'}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-xl text-xs shrink-0">
                Unlocked for Editing
              </span>
            </div>
          )}

          {currentSheetStatus === 'Draft' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <strong>Draft Mode:</strong> Enter marks and co-scholastic evaluations. Click <strong>"Submit for Review & Lock"</strong> when complete to route to Principal for approval. Students cannot see marks until approved.
                </span>
              </div>
              <span className="px-2.5 py-1 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs shrink-0">
                Draft State
              </span>
            </div>
          )}

          {/* Compact Audit History Log Banner */}
          {latestAuditLog && (
            <div className="px-4 py-2 bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-600 font-mono">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  Last modified by faculty member: <strong className="text-slate-900">{latestAuditLog.lastModifiedByFacultyName}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{new Date(latestAuditLog.lastModifiedAt).toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Validation Error Banner */}
          {hasValidationErrors && (
            <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 bg-rose-100 rounded-xl shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <p className="font-extrabold text-rose-950 text-sm">
                    Marks Exceed Head Maximum Ceilings ({validationErrors.length} Cell Error{validationErrors.length > 1 ? 's' : ''})
                  </p>
                  <p className="text-rose-800 text-xs mt-0.5">
                    Roll {validationErrors[0].studentRollNo} entered {validationErrors[0].value} in {validationErrors[0].headName} (Max permissible: {validationErrors[0].maxCeiling}). Correct errors before saving or submitting.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1.5 bg-rose-600 text-white font-mono font-bold text-xs rounded-xl shrink-0">
                Action Blocked
              </span>
            </div>
          )}

          {/* Marks Entry Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
                  Class Evaluation Grid • {selectedExam?.name} • {currentSubject.code}: {currentSubject.name}
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Roll no & student names auto-fetched. Principal marks heads applied. Additional evaluation fields (attendance, co-scholastic, remarks) included.
                </p>
              </div>

              {/* Action Buttons: Save Draft vs Submit for Review & Lock */}
              <div className="flex items-center gap-2">
                {!isSheetLockedForTeacher ? (
                  <>
                    <button
                      type="button"
                      disabled={hasValidationErrors}
                      onClick={() => handleSaveEvaluations(false)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        hasValidationErrors
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                      title={hasValidationErrors ? 'Correct highlighted errors to save draft' : undefined}
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      disabled={hasValidationErrors}
                      onClick={() => handleSaveEvaluations(true)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5 ${
                        hasValidationErrors
                          ? 'bg-slate-400 text-slate-200 cursor-not-allowed opacity-60'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                      title={hasValidationErrors ? 'Correct highlighted errors to submit' : undefined}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submit for Review &amp; Lock
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Locked against edits</span>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-4 py-3 sticky left-0 bg-slate-100 z-10">Roll No</th>
                    <th className="px-4 py-3 sticky left-24 bg-slate-100 z-10">Student Name</th>
                    {/* Principal Evaluation Heads */}
                    {currentExamHeads.map((head) => (
                      <th key={head.id} className="px-4 py-3 text-center whitespace-nowrap">
                        <div>{head.name}</div>
                        <div className="text-xs font-mono text-slate-400 font-normal">
                          {head.format === 'marks'
                            ? `Max ${head.maxMarks} • Pass ${head.passingMarks}`
                            : head.format === 'grades_only' || head.format === 'dropdown'
                            ? 'Dropdown Grade'
                            : 'Remarks'}
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center whitespace-nowrap">
                      <div>Total Marks</div>
                      <div className="text-xs font-mono text-slate-400 font-normal">Max {computedTotalMaxMarks}</div>
                    </th>
                    <th className="px-4 py-3 text-center">Grade</th>
                    {/* Additional Evaluation Fields */}
                    <th className="px-4 py-3 text-center whitespace-nowrap">
                      <div>Attendance %</div>
                      <div className="text-xs font-mono text-slate-400 font-normal">Course Lectures</div>
                    </th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">
                      <div>Co-Scholastic</div>
                      <div className="text-xs font-mono text-slate-400 font-normal">Conduct Rating</div>
                    </th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Teacher Remarks</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {enrolledStudents.length === 0 ? (
                    <tr>
                      <td colSpan={currentExamHeads.length + 8} className="px-5 py-8 text-center text-slate-400 text-xs">
                        No students enrolled in {selectedCourse} Semester {selectedSemester}.
                      </td>
                    </tr>
                  ) : (
                    enrolledStudents.map((stu) => {
                      const evalRecord = evaluationsMap[stu.id] || {
                        headScores: {},
                        headValues: {},
                        totalMarksObtained: 0,
                        overallGrade: 'A',
                        attendancePercentage: 85,
                        coScholasticRating: 'Proficient',
                        teacherRemarks: '',
                        status: 'Draft' as const,
                      };

                      return (
                        <tr key={stu.id} className="hover:bg-slate-50/70 transition">
                          {/* Roll No */}
                          <td className="px-4 py-3 font-mono font-medium text-slate-900 sticky left-0 bg-white">
                            {stu.rollNo}
                          </td>
                          {/* Student Name */}
                          <td className="px-4 py-3 font-semibold text-slate-900 sticky left-24 bg-white whitespace-nowrap">
                            {stu.name}
                          </td>

                          {/* Dynamic Principal Heads */}
                          {currentExamHeads.map((head) => {
                            const scoresMap: Record<string, any> = evalRecord.headScores || (evalRecord as any).headValues || {};
                            const val = scoresMap[head.id];

                            if (head.format === 'marks') {
                              const numVal = val === '' || val === undefined ? 0 : Number(val);
                              const isExceeded = numVal > head.maxMarks || numVal < 0;

                              return (
                                <td key={head.id} className="px-4 py-3 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max={head.maxMarks}
                                    disabled={isSheetLockedForTeacher}
                                    value={val !== undefined ? val : ''}
                                    onChange={(e) => handleHeadScoreChange(stu.id, head.id, e.target.value)}
                                    className={`w-18 text-center font-mono font-bold text-xs rounded-lg py-1 px-1.5 transition ${
                                      isSheetLockedForTeacher
                                        ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                                        : isExceeded
                                        ? 'border-2 border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-400/50 focus:ring-rose-500'
                                        : 'border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500'
                                    }`}
                                  />
                                  {isExceeded && (
                                    <span className="block text-xs font-extrabold text-rose-600 mt-0.5 tracking-tight">
                                      Exceeds {head.maxMarks}
                                    </span>
                                  )}
                                </td>
                              );
                            }

                            if (head.format === 'grades_only' || head.format === 'dropdown') {
                              const opts =
                                head.dropdownOptions && head.dropdownOptions.length > 0
                                  ? head.dropdownOptions
                                  : [
                                      'O (Outstanding)',
                                      'A+ (Excellent)',
                                      'A (Very Good)',
                                      'B+ (Good)',
                                      'B (Satisfactory)',
                                      'P (Pass)',
                                      'F (Fail)',
                                    ];
                              return (
                                <td key={head.id} className="px-4 py-3 text-center">
                                  <select
                                    disabled={isSheetLockedForTeacher}
                                    value={val !== undefined ? String(val) : ''}
                                    onChange={(e) => handleHeadScoreChange(stu.id, head.id, e.target.value)}
                                    className="text-xs border border-slate-200 rounded-lg py-1 px-2 bg-slate-50 focus:bg-white font-medium text-slate-800 disabled:opacity-60"
                                  >
                                    <option value="">-- Select --</option>
                                    {opts.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              );
                            }

                            // Remarks head
                            return (
                              <td key={head.id} className="px-4 py-3 text-center">
                                <input
                                  type="text"
                                  disabled={isSheetLockedForTeacher}
                                  value={val !== undefined ? String(val) : ''}
                                  placeholder="Observation notes..."
                                  onChange={(e) => handleHeadScoreChange(stu.id, head.id, e.target.value)}
                                  className="w-32 text-xs border border-slate-200 rounded-lg py-1 px-2 bg-slate-50 focus:bg-white disabled:opacity-60"
                                />
                              </td>
                            );
                          })}

                          {/* Computed Total Marks */}
                          <td className="px-4 py-3 text-center font-bold text-slate-900 font-mono text-sm">
                            {evalRecord.totalMarksObtained ?? 0}
                          </td>

                          {/* Letter Grade */}
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold font-mono text-xs ${
                                evalRecord.overallGrade === 'O' || evalRecord.overallGrade === 'A+'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : evalRecord.overallGrade === 'A' || evalRecord.overallGrade === 'B+'
                                  ? 'bg-blue-100 text-blue-800'
                                  : evalRecord.overallGrade === 'B' || evalRecord.overallGrade === 'P'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {evalRecord.overallGrade || 'A'}
                            </span>
                          </td>

                          {/* Additional: Attendance % */}
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                disabled={isSheetLockedForTeacher}
                                value={evalRecord.attendancePercentage ?? 85}
                                onChange={(e) =>
                                  handleExtraFieldChange(stu.id, 'attendancePercentage', Number(e.target.value))
                                }
                                className="w-14 text-center font-mono text-xs border border-slate-200 rounded-lg py-1 px-1 bg-slate-50 disabled:opacity-60"
                              />
                              <span className="text-xs text-slate-400">%</span>
                            </div>
                          </td>

                          {/* Additional: Co-Scholastic Item */}
                          <td className="px-4 py-3 text-center">
                            <select
                              disabled={isSheetLockedForTeacher}
                              value={evalRecord.coScholasticRating || 'Proficient'}
                              onChange={(e) =>
                                handleExtraFieldChange(stu.id, 'coScholasticRating', e.target.value)
                              }
                              className="text-xs border border-slate-200 rounded-lg py-1 px-2 bg-slate-50 font-medium disabled:opacity-60"
                            >
                              <option value="Exemplary">Exemplary</option>
                              <option value="Proficient">Proficient</option>
                              <option value="Satisfactory">Satisfactory</option>
                              <option value="Needs Improvement">Needs Improvement</option>
                            </select>
                          </td>

                          {/* Additional: Teacher Remarks */}
                          <td className="px-4 py-3 text-center">
                            <input
                              type="text"
                              disabled={isSheetLockedForTeacher}
                              value={evalRecord.teacherRemarks || ''}
                              placeholder="Evaluator remarks..."
                              onChange={(e) =>
                                handleExtraFieldChange(stu.id, 'teacherRemarks', e.target.value)
                              }
                              className="w-36 text-xs border border-slate-200 rounded-lg py-1 px-2 bg-slate-50 focus:bg-white disabled:opacity-60"
                            />
                          </td>

                          {/* Row Status Badge */}
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                evalRecord.status === 'Approved_Published'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : evalRecord.status === 'Submitted_For_Review'
                                  ? 'bg-blue-100 text-blue-800'
                                  : evalRecord.status === 'Revision_Requested'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {evalRecord.status === 'Approved_Published'
                                ? 'Published'
                                : evalRecord.status === 'Submitted_For_Review'
                                ? 'In Review'
                                : evalRecord.status === 'Revision_Requested'
                                ? 'Revise'
                                : 'Draft'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: GRADE CARDS & TRANSCRIPTS */}
      {activeTab === 'transcripts' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search student by name or roll number..."
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Showing {enrolledStudents.length} students enrolled in {selectedCourse} Sem {selectedSemester}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrolledStudents
              .filter(
                (s) =>
                  s.name.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
                  s.rollNo.toLowerCase().includes(transcriptSearch.toLowerCase())
              )
              .map((stu) => {
                const stuGrades = grades.filter((g) => g.studentId === stu.id && g.semester === stu.semester);
                const customRules = erpStorage.getMarksheetConfig()?.gradingScaleRules;
                const sgpaRes = calculateSGPA(
                  stuGrades.map((g) => ({
                    courseCode: g.subjectCode,
                    credits: g.credits,
                    marksObtained: g.totalMarks,
                    maxMarks: g.maxMarks,
                  })),
                  customRules
                );

                return (
                  <div key={stu.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {stu.rollNo}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            sgpaRes.allPassed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {sgpaRes.allPassed ? 'Cleared' : 'Backlogs'}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm mb-1">{stu.name}</h4>
                      <p className="text-xs text-slate-500 mb-4">{stu.course} • Sem {stu.semester}</p>

                      <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">SGPA:</span>
                          <strong className="text-indigo-700 font-bold">{sgpaRes.sgpa.toFixed(2)} / 10.00</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Earned Credits:</span>
                          <span className="text-slate-800">
                            {sgpaRes.earnedCredits} / {sgpaRes.totalCredits}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedStudentForMarksheet(stu);
                        setIsMarksheetModalOpen(true);
                      }}
                      className="mt-4 w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      View Official Marksheet
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* VIEW 3: CLASS ACADEMIC ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Class Average SGPA</span>
              <p className="text-3xl font-extrabold text-indigo-700 mt-1">{classAnalytics.avgSGPA}</p>
              <p className="text-xs text-slate-500 mt-2">10-point Choice-Based Credit Scale</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall Pass Rate</span>
              <p className="text-3xl font-extrabold text-emerald-600 mt-1">{classAnalytics.passPercentage}%</p>
              <p className="text-xs text-slate-500 mt-2">
                {classAnalytics.studentSGPAs.length - classAnalytics.backlogs.length} / {classAnalytics.studentSGPAs.length} cleared all papers
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Backlogs</span>
              <p className="text-3xl font-extrabold text-rose-600 mt-1">{classAnalytics.backlogs.length}</p>
              <p className="text-xs text-slate-500 mt-2">Eligible for supplementary remedial exam</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Star className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-base">Semester Merit &amp; Toppers Honor Roll</h3>
            </div>

            <div className="space-y-3">
              {classAnalytics.studentSGPAs.slice(0, 5).map((entry, idx) => (
                <div
                  key={entry.student.id}
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    idx === 0
                      ? 'bg-amber-50/60 border-amber-200'
                      : idx === 1
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-white border-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        idx === 0
                          ? 'bg-amber-500 text-white'
                          : idx === 1
                          ? 'bg-slate-400 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 text-sm block">{entry.student.name}</span>
                      <span className="text-xs text-slate-500 font-mono">{entry.student.rollNo}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xl font-black text-indigo-700 font-mono">
                      SGPA {entry.sgpa.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-500 block">
                      Credits: {entry.earnedCredits} / {entry.totalCredits}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE MARKSHEET MODAL */}
      <PrintableMarksheet
        student={selectedStudentForMarksheet}
        grades={grades}
        isOpen={isMarksheetModalOpen}
        onClose={() => setIsMarksheetModalOpen(false)}
      />
    </div>
  );
};
