import React, { useState, useMemo, useEffect } from 'react';
import {
  Student,
  ExamGradeRecord,
  FeeTransaction,
  AttendanceRecord,
  EnrollmentField,
  CongratulationMessage,
  InstitutionalNotice,
  ServiceTariff,
  ServiceRequestItem,
  ExamTypeConfig,
  ExamEvaluationHead,
  StudentExamEvaluation,
} from '../../types/erp';
import {
  calculateSGPA,
  calculateCGPA,
  calculateAttendanceStats,
  toPaisa,
  fromPaisa,
  paisaAdd,
  paisaSub,
  getISTDateString,
  normalizeSafariDate,
} from '../../utils/erpLogic';
import { PrintableMarksheet, MarksheetDocument } from '../Common/PrintableMarksheet';
import { PrintableReceipt } from '../Common/PrintableReceipt';
import { StudentRequestsModule } from './StudentRequestsModule';
import { MobileStudentDashboard } from './MobileStudentDashboard';
import { useIsMobile } from '../../hooks/useIsMobile';
import { erpStorage } from '../../services/erpStorage';
import {
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Award,
  ShieldCheck,
  ShieldAlert,
  Download,
  AlertTriangle,
  Printer,
  Smartphone,
  X,
  FileCheck,
  Trophy,
  Sparkles,
  UserCheck,
  Lock,
  Save,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileText,
  HeartHandshake,
  Megaphone,
  Bell,
  Eye,
  Layers,
  Inbox,
  Archive,
  ChevronDown,
  ChevronUp,
  User,
  BookOpen,
  Phone,
} from 'lucide-react';
import { Money } from '../Common/Rupee';

interface StudentPortalViewProps {
  student?: Student | null;
  grades: ExamGradeRecord[];
  transactions: FeeTransaction[];
  attendanceRecords?: AttendanceRecord[];
  enrollmentFields: EnrollmentField[];
  congratulationMessages: CongratulationMessage[];
  notices: InstitutionalNotice[];
  serviceTariffs?: ServiceTariff[];
  myRequests?: ServiceRequestItem[];
  onCreateServiceRequest?: (data: any) => void;
  onPayDuesClick: (studentId: string) => void;
  onUpdateEnrollmentData: (studentId: string, updatedData: Record<string, any>) => void;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  student: propStudent,
  grades,
  transactions,
  attendanceRecords = [],
  enrollmentFields,
  congratulationMessages,
  notices = [],
  serviceTariffs = [],
  myRequests = [],
  onCreateServiceRequest,
  onPayDuesClick,
  onUpdateEnrollmentData,
}) => {
  const student = useMemo<Student>(() => {
    if (propStudent && propStudent.id) return propStudent;
    return {
      id: 'STU-UNASSIGNED',
      rollNo: 'UNASSIGNED',
      registerNo: 'PENDING',
      name: 'Unassigned Student',
      email: '',
      phone: '',
      parentPhone: '',
      course: 'General Degree Course',
      streamCode: 'GEN',
      semester: 1,
      section: 'A',
      batchYear: '2026-2030',
      totalFee: 0,
      paidFee: 0,
      pendingFee: 0,
      hallTicketBlocked: false,
      attendancePercentage: 0,
    } as Student;
  }, [propStudent]);

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'profile' | 'requests' | 'congratulations' | 'other_exams'>('overview');
  const [storageTick, setStorageTick] = useState(0);

  useEffect(() => {
    const unsubscribe = erpStorage.subscribe(() => setStorageTick((t) => t + 1));
    return () => unsubscribe();
  }, []);

  // -------------------------------------------------------------
  // OTHER EXAMS & ASSESSMENTS (Unit Tests, Practicals, Olympiads)
  // Exams configured with showInStudentMarksheet === false & status === 'Approved_Published'
  // -------------------------------------------------------------
  const examTypesList = useMemo<ExamTypeConfig[]>(() => erpStorage.getExamTypes(), [storageTick]);
  const examHeadsList = useMemo<ExamEvaluationHead[]>(() => erpStorage.getExamEvaluationHeads(), [storageTick]);
  const allEvaluations = useMemo<StudentExamEvaluation[]>(() => erpStorage.getStudentExamEvaluations(), [storageTick]);
  const [otherExamsFilterType, setOtherExamsFilterType] = useState<string>('All');
  const [selectedScorecardForPrint, setSelectedScorecardForPrint] = useState<StudentExamEvaluation | null>(null);

  const studentOtherExams = useMemo(() => {
    const otherExamTypeMap = new Map(
      examTypesList.filter((e) => !e.showInStudentMarksheet).map((e) => [e.id, e])
    );

    return allEvaluations.filter(
      (e) =>
        (e.studentId === student.id || (e.studentRollNo && e.studentRollNo.trim().toLowerCase() === student.rollNo.trim().toLowerCase())) &&
        otherExamTypeMap.has(e.examTypeId) &&
        e.status === 'Approved_Published'
    );
  }, [examTypesList, allEvaluations, student.id, student.rollNo]);
  // Responsive mobile detection using custom hook with 640px breakpoint
  const isMobile = useIsMobile(640);
  const [manualOverride, setManualOverride] = useState<'mobile' | 'desktop' | null>(null);

  // When viewport breakpoint changes (e.g. orientation change or resize across 640px),
  // reset manual override to respect the screen size
  useEffect(() => {
    setManualOverride(null);
  }, [isMobile]);

  const effectiveViewMode = manualOverride ?? (isMobile ? 'mobile' : 'desktop');
  const [isMarksheetOpen, setIsMarksheetOpen] = useState(false);
  const [selectedMarksheetSemester, setSelectedMarksheetSemester] = useState<number>(student.semester || 1);
  const [selectedReceipt, setSelectedReceipt] = useState<FeeTransaction | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<InstitutionalNotice | null>(null);

  // Reset open overlays when switching active student persona
  useEffect(() => {
    setSelectedNotice(null);
    setSelectedReceipt(null);
    setSelectedScorecardForPrint(null);
    setIsMarksheetOpen(false);
  }, [student.id]);

  // Available completed semesters for marksheet viewer (1 through current student semester)
  const availableMarksheetSemesters = useMemo(() => {
    const currentSem = student.semester || 1;
    const list: number[] = [];
    for (let i = 1; i <= currentSem; i++) {
      list.push(i);
    }
    return list;
  }, [student.semester]);

  // Sync selected marksheet semester if student's semester changes
  useEffect(() => {
    if (student.semester) {
      setSelectedMarksheetSemester(student.semester);
    }
  }, [student.semester]);

  // Keyboard shortcut: Escape exits marksheet, receipt, scorecard, or circular reader
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMarksheetOpen) setIsMarksheetOpen(false);
        if (selectedReceipt) setSelectedReceipt(null);
        if (selectedNotice) setSelectedNotice(null);
        if (selectedScorecardForPrint) setSelectedScorecardForPrint(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMarksheetOpen, selectedReceipt, selectedNotice, selectedScorecardForPrint]);

  // Profile Enrollment Form state
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    return {
      ...(student.enrollmentData || {}),
      phone: student.phone || '',
      parentPhone: student.parentPhone || '',
      dob: student.dob || '',
      course: student.course || '',
      semester: student.semester || 1,
    };
  });

  // Synchronize formData when active student persona changes (Bug 179)
  useEffect(() => {
    setFormData({
      ...(student.enrollmentData || {}),
      phone: student.phone || '',
      parentPhone: student.parentPhone || '',
      dob: student.dob || '',
      course: student.course || '',
      semester: student.semester || 1,
    });
  }, [student.id, student.phone, student.parentPhone, student.dob, student.course, student.semester, student.enrollmentData]);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const saveSuccessTimerRef = React.useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (saveSuccessTimerRef.current) window.clearTimeout(saveSuccessTimerRef.current);
    };
  }, []);

  // Mobile Profile Accordion & Tab State
  const [mobileProfileTab, setMobileProfileTab] = useState<'all' | 'personal' | 'academic' | 'contact' | 'institutional'>('all');
  const [openProfileSections, setOpenProfileSections] = useState<Record<string, boolean>>({
    personal: true,
    academic: false,
    contact: false,
    institutional: false,
  });

  const toggleProfileSection = (sectionKey: string) => {
    setOpenProfileSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Official Result Declaration Check (Principal / Accountant)
  const resultDeclarations = useMemo(() => erpStorage.getResultDeclarations(), [storageTick]);
  const todayStr = getISTDateString();

  const isSemesterDeclared = (semNum: number): boolean => {
    const decl =
      resultDeclarations.find(
        (d) => d.semester === semNum && (d.course === student.course || d.course === 'All Courses')
      ) || resultDeclarations.find((d) => d.semester === semNum);

    if (decl) {
      if (decl.status === 'Embargoed') return false;
      if (decl.isPublished === true || decl.status === 'Published') return true;
      if (decl.isPublished === false) return false;
      if (todayStr < decl.declarationDate) return false;
    } else if (semNum >= (student.semester || 1)) {
      return false;
    }
    return true;
  };

  const activeDeclaration = useMemo(() => {
    const sem = student.semester || 1;
    return (
      resultDeclarations.find(
        (d) => d.semester === sem && (d.course === student.course || d.course === 'All Courses')
      ) || resultDeclarations.find((d) => d.semester === sem)
    );
  }, [resultDeclarations, student.semester, student.course]);

  // Student grades & SGPA (strictly Published & declared semesters)
  const customScaleRules = useMemo(() => erpStorage.getMarksheetConfig()?.gradingScaleRules, [grades, storageTick]);
  const studentGrades = grades.filter(
    (g) => g.studentId === student.id && g.status === 'Published' && isSemesterDeclared(g.semester || 1)
  );
  const currentSemesterGrades = studentGrades.filter((g) => g.semester === (student.semester || 1));
  const activeGradesForSGPA = currentSemesterGrades;

  const sgpaResult = calculateSGPA(
    activeGradesForSGPA.map((g) => ({
      courseCode: g.subjectCode,
      credits: g.credits,
      marksObtained: g.totalMarks,
      maxMarks: g.maxMarks,
    })),
    customScaleRules
  );

  const cgpaResult = useMemo(() => {
    const semMap: Record<number, typeof studentGrades> = {};
    studentGrades.forEach((g) => {
      const s = g.semester || 1;
      if (!semMap[s]) semMap[s] = [];
      semMap[s].push(g);
    });
    const semStats = Object.values(semMap).map((list) => {
      const res = calculateSGPA(
        list.map((g) => ({
          courseCode: g.subjectCode,
          credits: g.credits,
          marksObtained: g.totalMarks,
          maxMarks: g.maxMarks,
        })),
        customScaleRules
      );
      return {
        sgpa: res.sgpa,
        totalCredits: res.totalCredits,
        totalCreditPoints: res.totalCreditPoints,
      };
    });
    return calculateCGPA(semStats);
  }, [studentGrades, customScaleRules]);

  const isResultDeclared = useMemo(() => {
    const sem = student.semester || 1;
    if (!isSemesterDeclared(sem)) return false;
    const rawSemGrades = grades.filter((g) => g.studentId === student.id && g.semester === sem);
    if (rawSemGrades.length > 0 && rawSemGrades.every((g) => g.status === 'Draft')) {
      return false;
    }
    return true;
  }, [resultDeclarations, todayStr, grades, student.id, student.semester, student.course]);

  // Student transactions
  const studentTransactions = transactions.filter((t) => t.studentId === student.id);

  // Congratulations for this student's roll number
  const studentCongratulations = useMemo(() => {
    return congratulationMessages.filter(
      (c) => c.rollNo.trim().toLowerCase() === student.rollNo.trim().toLowerCase()
    );
  }, [congratulationMessages, student.rollNo]);

  // Notice filtering & 1-month auto-archive:
  // "Selected course student will have access to such notification for 1 month from date of issue. After that such notice will be archived."
  const [noticeFilterTab, setNoticeFilterTab] = useState<'active' | 'archived'>('active');
  const { activeNotices, archivedNotices } = useMemo(() => {
    const now = new Date().getTime();
    const studentCourse = (student.course || '').toLowerCase();
    const studentSem = student.semester || 1;

    const relevant = notices.filter((n) => {
      // Exclude staff-only notices from student portal
      if (n.targetAudience === 'staff') return false;

      if (n.targetCourses && n.targetCourses.length > 0 && !n.targetCourses.includes('All')) {
        const matchesCourse = n.targetCourses.some((c) =>
          studentCourse.includes(c.toLowerCase()) || c.toLowerCase().includes(studentCourse)
        );
        if (!matchesCourse) return false;
      }
      if (n.targetSemesters && n.targetSemesters.length > 0 && !n.targetSemesters.includes(0)) {
        if (!n.targetSemesters.includes(studentSem)) return false;
      }
      return true;
    });

    const active: InstitutionalNotice[] = [];
    const archived: InstitutionalNotice[] = [];

    relevant.forEach((n) => {
      const issueTime = normalizeSafariDate(n.date).getTime();
      const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
      const isPastOneMonth = !isNaN(issueTime) && now - issueTime > oneMonthMs;
      const isPastEndDate = n.endDate ? normalizeSafariDate(n.endDate).getTime() < now : false;
      const isExplicitArchived = n.archived === true;

      if (isPastOneMonth || isPastEndDate || isExplicitArchived) {
        archived.push(n);
      } else {
        active.push(n);
      }
    });

    return { activeNotices: active, archivedNotices: archived };
  }, [notices, student.course, student.semester]);

  // Attendance calculation linked with attendance marked by course faculty:
  // "Attendance data should be linked with attendance marked by course faculty. Total present marked against all the attandance marked days for the user by faculty."
  const studentAttendanceRecords = useMemo(() => {
    const allStudentRecs = attendanceRecords.filter(
      (a: AttendanceRecord) =>
        a.studentId === student.id ||
        (a.studentRollNo && a.studentRollNo.trim().toLowerCase() === student.rollNo.trim().toLowerCase())
    );
    const activeSemRecs = allStudentRecs.filter(
      (a) => a.semester === undefined || a.semester === (student.semester || 1)
    );
    return activeSemRecs.length > 0 ? activeSemRecs : allStudentRecs;
  }, [attendanceRecords, student.id, student.rollNo, student.semester]);

  const attendanceStats = useMemo(
    () => calculateAttendanceStats(studentAttendanceRecords),
    [studentAttendanceRecords]
  );

  const totalMarkedDays = studentAttendanceRecords.length;
  const totalPresentDays = studentAttendanceRecords.filter((a: AttendanceRecord) => a.status === 'present').length;
  const totalAbsentDays = studentAttendanceRecords.filter((a: AttendanceRecord) => a.status === 'absent').length;

  const dynamicAttendancePercentage = totalMarkedDays > 0
    ? attendanceStats.percentage
    : (student.attendancePercentage ?? 0);

  const isDefaulter = totalMarkedDays > 0 ? attendanceStats.isDefaulter : false;
  const classesNeeded = totalMarkedDays > 0 ? attendanceStats.classesNeededFor75 : 0;

  // Live Fee dues linked with transactions recorded in Fee Module by staff user
  const verifiedPaidFee = useMemo(() => {
    const sumPaisa = studentTransactions
      .filter((t) => t.status === 'Success')
      .reduce((acc, t) => paisaAdd(acc, toPaisa(t.amount)), 0);
    return sumPaisa > 0 ? fromPaisa(sumPaisa) : student.paidFee;
  }, [studentTransactions, student.paidFee]);

  const effectiveTotalFee = student.totalFee;
  const effectivePendingFee = fromPaisa(paisaSub(toPaisa(effectiveTotalFee), toPaisa(verifiedPaidFee), false));

  // Check for missing mandatory enrollment fields
  const missingMandatoryFields = useMemo(() => {
    const missing: EnrollmentField[] = [];
    enrollmentFields.forEach((field) => {
      if (field.mode === 'mandatory') {
        let val = formData[field.key];
        if (val === undefined || val === null || val === '') {
          // Check top-level student property if exists
          if (field.key === 'phone') val = student.phone;
          else if (field.key === 'parentPhone') val = student.parentPhone;
          else if (field.key === 'name') val = student.name;
          else if (field.key === 'email') val = student.email;
          else if (field.key === 'dob') val = student.dob;
          else if (field.key === 'course') val = student.course;
          else if (field.key === 'semester') val = student.semester;
        }
        if (val === undefined || val === null || val === '') {
          missing.push(field);
        }
      }
    });
    return missing;
  }, [enrollmentFields, formData, student]);

  // Save profile updates (strip statutory locked keys & validate editable mandatory fields)
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaveError(null);
    const statutoryLockedKeys = new Set([
      'name',
      'rollNo',
      'registerNo',
      'course',
      'semester',
      'streamCode',
      'section',
      'batchYear',
      'totalFee',
      'paidFee',
      'pendingFee',
      'concessionAmount',
      'category',
      'hallTicketBlocked',
      'attendancePercentage',
      'status',
    ]);

    const missingEditableMandatory = enrollmentFields.filter((field) => {
      if (field.mode !== 'mandatory' || field.isCore || statutoryLockedKeys.has(field.key)) {
        return false;
      }
      const val = formData[field.key] ?? (student as any)[field.key] ?? student.enrollmentData?.[field.key];
      return val === undefined || val === null || String(val).trim() === '';
    });

    if (missingEditableMandatory.length > 0) {
      setProfileSaveError(
        `Please fill required mandatory fields: ${missingEditableMandatory.map((f) => f.label).join(', ')}`
      );
      return;
    }

    const sanitizedData: Record<string, any> = {};
    Object.entries(formData).forEach(([k, v]) => {
      if (!statutoryLockedKeys.has(k)) {
        sanitizedData[k] = v;
      }
    });

    onUpdateEnrollmentData(student.id, sanitizedData);
    setSaveSuccess(true);
    if (saveSuccessTimerRef.current) window.clearTimeout(saveSuccessTimerRef.current);
    saveSuccessTimerRef.current = window.setTimeout(() => setSaveSuccess(false), 2500);
  };

  // If in mobile-first mode, render the dedicated mobile dashboard
  if (effectiveViewMode === 'mobile') {
    return (
      <div className="relative">
        <MobileStudentDashboard
          student={student}
          grades={grades}
          transactions={transactions}
          attendanceRecords={attendanceRecords}
          notices={notices}
          congratulationMessages={congratulationMessages}
          onPayDuesClick={onPayDuesClick}
          onOpenNotice={(n) => setSelectedNotice(n)}
          onOpenMarksheet={() => setIsMarksheetOpen(true)}
          onOpenProfile={() => {
            setManualOverride('desktop');
            setActiveSubTab('profile');
          }}
          onSwitchToDesktopPortal={() => setManualOverride('desktop')}
          onOpenHonorsModal={() => {
            setManualOverride('desktop');
            setActiveSubTab('congratulations');
          }}
        />

        {/* Notice Detail Reader Modal if selected in Mobile View */}
        {selectedNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
              <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center space-x-2.5">
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    Official Institutional Circular
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedNotice(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="border-b border-slate-200 pb-3 text-center">
                  <span className="text-xs uppercase font-bold tracking-widest text-slate-400 block font-mono">
                    Ram Lakhan Singh Yadav College • Office of Academic Affairs
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-slate-950 mt-1">
                    {selectedNotice.title}
                  </h2>
                  <div className="flex items-center justify-center gap-3 mt-1.5 text-xs text-slate-500 font-mono">
                    <span>Date: {selectedNotice.date}</span>
                    <span>•</span>
                    <span>Category: {selectedNotice.category}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                  {selectedNotice.content}
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-xs uppercase font-bold text-slate-400 block">Published Authority</span>
                    <strong className="text-slate-900">{selectedNotice.authorName}</strong>
                    <span className="text-slate-500 block">{selectedNotice.authorRole}</span>
                  </div>
                  <button
                    onClick={() => setSelectedNotice(null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Student Profile Card (Strictly personal, NO student switcher) */}
      {/* Student Profile Card (Strictly personal, NO student switcher) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <img
              src={
                student.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
              }
              alt={student.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-amber-400 shadow-md shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold">{student.name}</h2>
                <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Roll: {student.rollNo}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-indigo-200 mt-0.5">
                {student.course} • Semester {student.semester} (Section {student.section})
              </p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Reg No: {student.registerNo} • Batch: {student.batchYear}
                {student.dob && ` • DOB: ${student.dob}`}
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            <div className="px-4 py-2 bg-slate-800/80 rounded-xl border border-indigo-800/60 text-right">
              <span className="text-xs uppercase font-bold text-slate-400 block font-mono">Academic Status</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled &amp; Active
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Student Navigation Menu Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <span>Student Portal Menu</span>
              <span className="text-slate-600 font-sans hidden sm:inline">•</span>
              <span className="text-slate-500 font-sans text-xs normal-case hidden sm:inline">
                Scroll horizontally to explore all academic services
              </span>
            </span>
            <span className="text-xs text-indigo-300 font-mono hidden md:inline">
              ← Scrollable Bar →
            </span>
          </div>

          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-indigo-800/60 scrollbar-track-slate-900/60 pb-1.5 -mb-1">
            <div className="flex items-center bg-slate-950/60 p-1.5 rounded-2xl border border-indigo-700/50 min-w-max gap-1.5">
              <button
                onClick={() => setActiveSubTab('overview')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeSubTab === 'overview'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Dashboard &amp; Pillars</span>
              </button>

              <button
                onClick={() => setActiveSubTab('profile')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap relative ${
                  activeSubTab === 'profile'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Profile &amp; Details</span>
                {missingMandatoryFields.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
                )}
              </button>

              <button
                onClick={() => setActiveSubTab('requests')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeSubTab === 'requests'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Collegiate Services</span>
                {myRequests.filter((r) => r.status === 'Submitted' || r.status === 'In_Review' || r.status === 'Approved').length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                )}
              </button>

              <button
                onClick={() => setActiveSubTab('congratulations')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeSubTab === 'congratulations'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-amber-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Honors &amp; Congratulations</span>
                {studentCongratulations.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-mono bg-amber-400 text-slate-950 font-black">
                    {studentCongratulations.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveSubTab('other_exams')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeSubTab === 'other_exams'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-purple-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Other Exams ({studentOtherExams.length})</span>
                {studentOtherExams.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse ml-0.5" />
                )}
              </button>

              {/* Direct Marksheet Shortcut Button */}
              <button
                onClick={() => setIsMarksheetOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap text-indigo-200 hover:text-white hover:bg-slate-800/70 border border-indigo-800/40"
                title="View and print official academic marksheet"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-400" />
                <span>Official Marksheet</span>
              </button>

              {/* Direct Fee Receipts Quick Scroll Button */}
              <button
                onClick={() => {
                  setActiveSubTab('overview');
                  setTimeout(() => {
                    const el = document.getElementById('fee-receipts-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap text-emerald-300 hover:text-white hover:bg-slate-800/70 border border-emerald-900/40"
                title="View fee payment receipts and ledger"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Fee Receipts ({studentTransactions.length})</span>
              </button>

              {/* Direct Circulars Quick Scroll Button */}
              <button
                onClick={() => {
                  setActiveSubTab('overview');
                  setTimeout(() => {
                    const el = document.getElementById('notices-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap text-amber-200 hover:text-white hover:bg-slate-800/70 border border-amber-900/40"
                title="Jump to circulars and notices"
              >
                <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                <span>Circulars ({activeNotices.length})</span>
              </button>

              {/* Toggle to switch to Mobile-First Student Dashboard */}
              <button
                onClick={() => setManualOverride('mobile')}
                className="px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 text-indigo-300 hover:text-white bg-indigo-950/80 border border-indigo-700/60 hover:bg-indigo-900 shadow-sm shrink-0 whitespace-nowrap ml-1"
                title="Switch to Mobile-First Student Dashboard"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span>Mobile View</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MISSING ENROLLMENT DETAILS ALERT MESSAGE */}
      {missingMandatoryFields.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-sm animate-in fade-in">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs sm:text-sm">
                Action Required: Incomplete Student Enrollment Profile
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                The following mandatory details are missing:{' '}
                <strong>{missingMandatoryFields.map((f: EnrollmentField) => f.label).join(', ')}</strong>.
                Please fill in these details in your Profile section to ensure smooth academic clearance.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveSubTab('profile')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-sm transition"
          >
            Complete Details Now →
          </button>
        </div>
      )}

      {/* VIEW A: OVERVIEW DASHBOARD */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 Core Pillars Grid: Attendance, Fees, Hall Ticket, Grades */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* 1. Attendance Health - Linked with Faculty Marked Attendance */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Faculty Attendance Health
                  </span>
                  <CalendarCheck
                    className={`w-5 h-5 ${isDefaulter ? 'text-rose-500' : 'text-emerald-500'}`}
                  />
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-black font-mono ${
                      isDefaulter ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {dynamicAttendancePercentage.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400">/ 75.0% min</span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-2 my-3 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${
                      isDefaulter ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, dynamicAttendancePercentage)}%` }}
                  />
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between font-mono text-xs">
                    <span>Present Marked:</span>
                    <strong className="text-emerald-700">{totalPresentDays} Days</strong>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span>Total Faculty Recorded:</span>
                    <strong className="text-slate-800">{totalMarkedDays > 0 ? `${totalMarkedDays} Days` : '0 Days (Not Marked)'}</strong>
                  </div>
                  <p className="text-xs text-slate-500 pt-1 leading-snug">
                    {isDefaulter ? (
                      <span className="text-rose-700 font-medium">
                        Shortfall alert! Attend next {classesNeeded} lectures to clear exam criteria.
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium">
                        ✓ Good standing. Satisfies statutory 75% university attendance threshold.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Fee Dues & Ledger - Linked with Accounts Counter Staff */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Semester Fee Dues
                  </span>
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                </div>

                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-black ${
                      effectivePendingFee === 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    <Money amount={effectivePendingFee} iconClassName="w-6 h-6 mr-1" />
                  </span>
                </div>

                <div className="mt-3 text-xs space-y-1 text-slate-500 font-mono">
                  <div className="flex justify-between">
                    <span>Total Billed Fee:</span>
                    <span className="font-semibold text-slate-800">
                      <Money amount={effectiveTotalFee} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verified Paid:</span>
                    <span className="font-semibold text-emerald-600">
                      <Money amount={verifiedPaidFee} />
                    </span>
                  </div>
                  <div className="pt-1 text-xs text-slate-400 font-sans">
                    ✓ Reconciled with Fee Module Ledger
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                {effectivePendingFee > 0 ? (
                  <div className="space-y-1">
                    <button
                      onClick={() => onPayDuesClick(student.id)}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>View Fee Clearance Slip</span>
                    </button>
                    <p className="text-xs text-slate-500 text-center font-medium">
                      Pay outstanding at Accounts Counter
                    </p>
                  </div>
                ) : (
                  <span className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                    ✓ 100% Fees Reconciled & Cleared
                  </span>
                )}
              </div>
            </div>

            {/* 3. Collegiate Service Applications (Discontinued Hall Ticket replaced) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Collegiate Services
                  </span>
                  <Inbox className="w-5 h-5 text-indigo-600" />
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black font-mono text-slate-900">
                    {myRequests.length}
                  </span>
                  <span className="text-xs text-slate-400">Total Requests</span>
                </div>

                <div className="mt-3 text-xs space-y-1.5 text-slate-600">
                  <div className="flex justify-between font-mono text-xs">
                    <span>Processing:</span>
                    <strong className="text-amber-600">
                      {myRequests.filter((r) => !r.archived && r.status !== 'Rejected' && r.status !== 'Issued').length}
                    </strong>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span>Completed & Issued:</span>
                    <strong className="text-emerald-700">
                      {myRequests.filter((r) => r.archived || r.status === 'Issued' || r.status === 'Approved').length}
                    </strong>
                  </div>
                  <p className="text-xs text-slate-500 leading-snug pt-1">
                    Apply for Bonafide, Character Certificate & Academic transcripts. Collect physically from college office.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setActiveSubTab('requests')}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Inbox className="w-3.5 h-3.5" />
                  <span>View Service Applications →</span>
                </button>
              </div>
            </div>

            {/* 4. Grade Card / Academic Performance */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Academic Performance
                  </span>
                  <Award className="w-5 h-5 text-amber-500" />
                </div>

                {isResultDeclared ? (
                  <>
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black font-mono text-indigo-700">
                          {sgpaResult.sgpa.toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-400 font-bold">SGPA</span>
                      </div>
                      {cgpaResult > 0 && (
                        <div className="flex items-baseline gap-1.5 bg-indigo-50/80 px-2 py-0.5 rounded-lg border border-indigo-200">
                          <span className="text-sm font-black font-mono text-indigo-900">
                            {cgpaResult.toFixed(2)}
                          </span>
                          <span className="text-xs uppercase font-bold text-indigo-600">CGPA</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 text-xs space-y-1 text-slate-500">
                      <div className="flex justify-between">
                        <span>Earned Credits:</span>
                        <span className="font-semibold text-slate-800">
                          {sgpaResult.earnedCredits} / {sgpaResult.totalCredits}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Papers Cleared:</span>
                        <span className="font-semibold text-emerald-600">
                          {studentGrades.filter((g) => g.letterGrade !== 'F').length} of {studentGrades.length}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Desktop View: Full administrative declaration schedule */}
                    <div className="hidden sm:block space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                        <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                        <span className="text-xs font-bold font-mono">Result Not Declared</span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1 pt-1 font-mono text-xs">
                        <div className="flex justify-between">
                          <span>Release Date:</span>
                          <strong className="text-indigo-950 font-bold">{activeDeclaration?.declarationDate}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Authority:</span>
                          <strong className="text-slate-800 capitalize">{activeDeclaration?.declaredByRole}</strong>
                        </div>
                        <p className="text-xs text-slate-500 pt-1 leading-snug font-sans">
                          Semester {student.semester} results are awaiting official declaration. Marksheet remains available for historical and declared semesters.
                        </p>
                      </div>
                    </div>

                    {/* Mobile View: Hide bulky alert box, display clean SGPA placeholder */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black font-mono text-slate-400">
                            --
                          </span>
                          <span className="text-xs text-slate-400 font-bold">SGPA</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          Pending Declaration
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-snug">
                        Semester {student.semester} evaluation in progress. Access historical and declared term marks below.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setIsMarksheetOpen(true)}
                  className="w-full py-2.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-xs min-h-[44px] sm:min-h-0 active:scale-[0.98]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  View Marksheet
                </button>
              </div>
            </div>
          </div>

          {/* Highlights: Congratulations Banner + Verified Transactions */}
          {studentCongratulations.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <Trophy className="w-6 h-6 text-amber-100" />
                </div>
                <div>
                  <h4 className="font-black text-sm">
                    🎉 You have received {studentCongratulations.length} Institutional Congratulation Message(s)!
                  </h4>
                  <p className="text-xs text-amber-100 mt-0.5">
                    Latest: &ldquo;{studentCongratulations[0].title}&rdquo; from {studentCongratulations[0].awardedByName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveSubTab('congratulations')}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-amber-300 font-bold rounded-xl text-xs transition"
              >
                View Honors →
              </button>
            </div>
          )}

          {/* OFFICIAL INSTITUTIONAL NOTIFICATIONS & CIRCULARS */}
          <div id="notices-section" className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 scroll-mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Official Institutional Notifications & Circulars
                  </h3>
                  <p className="text-xs text-slate-500">
                    Notices active for 1 month from date of issue for {student.course} Sem {student.semester}.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                <button
                  onClick={() => setNoticeFilterTab('active')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    noticeFilterTab === 'active'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Active ({activeNotices.length})
                </button>
                <button
                  onClick={() => setNoticeFilterTab('archived')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                    noticeFilterTab === 'archived'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Archive className="w-3 h-3" />
                  Archived ({archivedNotices.length})
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/50">
              {(noticeFilterTab === 'active' ? activeNotices : archivedNotices).length === 0 ? (
                <div className="py-8 text-center bg-white">
                  <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">
                    {noticeFilterTab === 'active'
                      ? 'No active notifications published for your course/semester at this time.'
                      : 'No archived notifications on record.'}
                  </p>
                </div>
              ) : (
                (noticeFilterTab === 'active' ? activeNotices : archivedNotices).map((n: InstitutionalNotice) => (
                  <div
                    key={n.id}
                    onClick={() => setSelectedNotice(n)}
                    className="px-4 py-3 bg-white hover:bg-indigo-50/60 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
                    title="Click to view full circular"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold uppercase font-mono border shrink-0 ${
                          n.category === 'Examination'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : n.category === 'Fees'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : n.category === 'Attendance'
                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                            : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                        }`}
                      >
                        {n.category}
                      </span>

                      {n.isPinned && (
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                          📌 Pinned
                        </span>
                      )}

                      <h4 className="font-semibold text-slate-900 text-xs sm:text-sm truncate group-hover:text-indigo-700 transition">
                        {n.title}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0 text-xs text-slate-500 justify-between sm:justify-end">
                      <span className="font-mono text-slate-400">{n.date}</span>
                      <span className="hidden md:inline text-slate-400">•</span>
                      <span className="hidden md:inline truncate max-w-[140px] text-slate-600">
                        {n.authorName}
                      </span>
                      <span className="text-indigo-600 font-bold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5 text-xs">
                        View Notice →
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Fee Receipts & Clearances History */}
          <div id="fee-receipts-section" className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 scroll-mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Fee Receipts &amp; Transaction Ledger
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {studentTransactions.length} Verified Receipts
              </span>
            </div>

            <div className="space-y-3">
              {studentTransactions.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No fee transactions recorded yet for this student.
                </p>
              ) : (
                studentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-indigo-50/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {tx.receiptNo}
                        </span>
                        <span className="text-xs uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                          ✓ Verified Payment
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm break-words">
                        {tx.feeHeadTitle}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono break-all">
                        {tx.timestamp} • Mode: <strong className="text-slate-700">{tx.paymentMethod}</strong> • Ref: {tx.referenceNo}
                      </p>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                      <span className="font-bold text-emerald-600 text-base font-mono block">
                        <Money amount={tx.amount} />
                      </span>
                      <button
                        onClick={() => setSelectedReceipt(tx)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0"
                        title="Open and print official fee receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Receipt</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: STUDENT PROFILE & ENROLLMENT FORM */}
      {activeSubTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 text-lg">
                  Student Profile & Enrollment Form Details
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Fill in your statutory and mandatory admission parameters configured by the Academic Administration.
              </p>
            </div>

            {missingMandatoryFields.length === 0 ? (
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Enrollment Profile Complete
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                {missingMandatoryFields.length} Mandatory Field(s) Incomplete
              </span>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {profileSaveError && (
              <div className="p-4 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 font-bold text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{profileSaveError}</span>
              </div>
            )}
            {saveSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Profile and enrollment form details saved successfully!
              </div>
            )}

            {/* DESKTOP VIEW: 2-COLUMN GRID (Hidden on mobile) */}
            <div className="hidden sm:block space-y-6">
              {/* Static Identity Details */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block">Student Name</span>
                  <strong className="text-slate-900 text-sm">{student.name}</strong>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block">Roll Number</span>
                  <strong className="font-mono text-slate-900 text-sm">{student.rollNo}</strong>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block">Registration No</span>
                  <span className="font-mono text-slate-700">{student.registerNo}</span>
                </div>
              </div>

              {/* Dynamic Enrollment Form Fields (2 columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {enrollmentFields.map((field) => {
                  const statutoryLockedKeys = [
                    'name',
                    'rollNo',
                    'registerNo',
                    'course',
                    'semester',
                    'streamCode',
                    'section',
                    'batchYear',
                    'totalFee',
                    'paidFee',
                    'pendingFee',
                    'concessionAmount',
                    'category',
                  ];
                  const isNonEditable =
                    field.mode === 'non_editable' ||
                    Boolean(field.isCore) ||
                    statutoryLockedKeys.includes(field.key);
                  const isMandatory = field.mode === 'mandatory' && !isNonEditable;
                  const currentValue =
                    formData[field.key] ??
                    (student as any)[field.key] ??
                    (student.enrollmentData ? student.enrollmentData[field.key] : '');

                  const isMissing = isMandatory && (currentValue === '' || currentValue === undefined || currentValue === null);

                  return (
                    <div
                      key={field.id}
                      className={`p-4 rounded-xl border transition ${
                        isMissing
                          ? 'border-amber-300 bg-amber-50/30 ring-1 ring-amber-300'
                          : isNonEditable
                          ? 'border-slate-200 bg-slate-50/50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          {field.label}
                          {isMandatory && <span className="text-rose-500">*</span>}
                        </label>
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            isNonEditable
                              ? 'bg-slate-200 text-slate-600 flex items-center gap-1'
                              : isMandatory
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isNonEditable && <Lock className="w-2.5 h-2.5" />}
                          {isNonEditable ? 'non editable' : field.mode.replace('_', ' ')}
                        </span>
                      </div>

                      {field.description && (
                        <p className="text-xs text-slate-400 mb-2">{field.description}</p>
                      )}

                      {isNonEditable ? (
                        <div className="py-2 px-3 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-between">
                          <span>{String(currentValue || 'N/A')}</span>
                          <span className="text-xs text-slate-400 italic">Locked by Admin</span>
                        </div>
                      ) : field.type === 'select' ? (
                        <select
                          value={currentValue}
                          onChange={(e) =>
                            setFormData({ ...formData, [field.key]: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value="">-- Select {field.label} --</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'boolean' ? (
                        <div className="flex items-center space-x-3 pt-1">
                          <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                            <input
                              type="radio"
                              name={field.key}
                              checked={currentValue === true || currentValue === 'true'}
                              onChange={() => setFormData({ ...formData, [field.key]: true })}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                            <input
                              type="radio"
                              name={field.key}
                              checked={currentValue === false || currentValue === 'false'}
                              onChange={() => setFormData({ ...formData, [field.key]: false })}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      ) : field.type === 'date' ? (
                        <input
                          type="date"
                          value={currentValue}
                          onChange={(e) =>
                            setFormData({ ...formData, [field.key]: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                        </input>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={currentValue}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [field.key]:
                                field.type === 'number' ? Number(e.target.value) : e.target.value,
                            })
                          }
                          placeholder={`Enter ${field.label}...`}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                        />
                      )}

                      {isMissing && (
                        <span className="text-xs text-amber-700 font-bold block mt-1">
                          ⚠️ Mandatory parameter missing
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save & Update Enrollment Profile
                </button>
              </div>
            </div>

            {/* MOBILE VIEW: TABBED ACCORDION WITH SECTIONS (Visible on mobile) */}
            <div className="sm:hidden space-y-4">
              {/* Category Quick Filter Tab Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { key: 'all', label: 'All', icon: <FileText className="w-3.5 h-3.5" /> },
                  { key: 'personal', label: 'Personal', icon: <User className="w-3.5 h-3.5" /> },
                  { key: 'academic', label: 'Academic', icon: <BookOpen className="w-3.5 h-3.5" /> },
                  { key: 'contact', label: 'Contact', icon: <Phone className="w-3.5 h-3.5" /> },
                  { key: 'institutional', label: 'Other', icon: <Layers className="w-3.5 h-3.5" /> },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setMobileProfileTab(t.key as any);
                      if (t.key !== 'all') {
                        setOpenProfileSections({
                          personal: t.key === 'personal',
                          academic: t.key === 'academic',
                          contact: t.key === 'contact',
                          institutional: t.key === 'institutional',
                        });
                      }
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 min-h-[44px] transition ${
                      mobileProfileTab === t.key
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Render Helper for Mobile Form Fields */}
              {(() => {
                const statutoryLockedKeys = [
                  'name',
                  'rollNo',
                  'registerNo',
                  'course',
                  'semester',
                  'streamCode',
                  'section',
                  'batchYear',
                  'totalFee',
                  'paidFee',
                  'pendingFee',
                  'concessionAmount',
                  'category',
                ];

                const categorize = (key: string): 'personal' | 'academic' | 'contact' | 'institutional' => {
                  const personal = ['name', 'fatherName', 'motherName', 'dob', 'gender', 'bloodGroup', 'category', 'aadhaarNo', 'nationality'];
                  const academic = ['rollNo', 'registerNo', 'course', 'semester', 'streamCode', 'section', 'batchYear', 'previousCollege', 'admissionType', 'totalFee', 'paidFee', 'pendingFee', 'concessionAmount'];
                  const contact = ['phone', 'mobile', 'email', 'guardianMobile', 'parentPhone', 'address', 'emergencyContact', 'pinCode', 'city', 'state'];
                  if (personal.includes(key)) return 'personal';
                  if (academic.includes(key)) return 'academic';
                  if (contact.includes(key)) return 'contact';
                  return 'institutional';
                };

                const renderMobileField = (field: any) => {
                  const isNonEditable =
                    field.mode === 'non_editable' ||
                    Boolean(field.isCore) ||
                    statutoryLockedKeys.includes(field.key);
                  const isMandatory = field.mode === 'mandatory' && !isNonEditable;
                  const currentValue =
                    formData[field.key] ??
                    (student as any)[field.key] ??
                    (student.enrollmentData ? student.enrollmentData[field.key] : '');
                  const isMissing = isMandatory && (currentValue === '' || currentValue === undefined || currentValue === null);

                  return (
                    <div
                      key={field.id}
                      className={`p-3.5 rounded-xl border bg-white ${
                        isMissing
                          ? 'border-amber-300 ring-1 ring-amber-300'
                          : isNonEditable
                          ? 'border-slate-200 bg-slate-50/70'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          {field.label}
                          {isMandatory && <span className="text-rose-500">*</span>}
                        </label>
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            isNonEditable
                              ? 'bg-slate-200 text-slate-600 flex items-center gap-1'
                              : isMandatory
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isNonEditable && <Lock className="w-2.5 h-2.5" />}
                          {isNonEditable ? 'locked' : field.mode.replace('_', ' ')}
                        </span>
                      </div>

                      {field.description && (
                        <p className="text-xs text-slate-400 mb-2">{field.description}</p>
                      )}

                      {isNonEditable ? (
                        <div className="py-2.5 px-3 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-between min-h-[44px]">
                          <span>{String(currentValue || 'N/A')}</span>
                          <span className="text-xs text-slate-400 italic">Locked</span>
                        </div>
                      ) : field.type === 'select' ? (
                        <select
                          value={currentValue}
                          onChange={(e) =>
                            setFormData({ ...formData, [field.key]: e.target.value })
                          }
                          className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[44px]"
                        >
                          <option value="">-- Select {field.label} --</option>
                          {field.options?.map((opt: string) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'boolean' ? (
                        <div className="flex items-center space-x-4 pt-1 min-h-[44px]">
                          <label className="flex items-center space-x-2 text-xs font-semibold cursor-pointer min-h-[44px]">
                            <input
                              type="radio"
                              name={`m_${field.key}`}
                              checked={currentValue === true || currentValue === 'true'}
                              onChange={() => setFormData({ ...formData, [field.key]: true })}
                              className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center space-x-2 text-xs font-semibold cursor-pointer min-h-[44px]">
                            <input
                              type="radio"
                              name={`m_${field.key}`}
                              checked={currentValue === false || currentValue === 'false'}
                              onChange={() => setFormData({ ...formData, [field.key]: false })}
                              className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      ) : field.type === 'date' ? (
                        <input
                          type="date"
                          value={currentValue}
                          onChange={(e) =>
                            setFormData({ ...formData, [field.key]: e.target.value })
                          }
                          className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[44px]"
                        />
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={currentValue}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [field.key]:
                                field.type === 'number' ? Number(e.target.value) : e.target.value,
                            })
                          }
                          placeholder={`Enter ${field.label}...`}
                          className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium min-h-[44px]"
                        />
                      )}

                      {isMissing && (
                        <span className="text-xs text-amber-700 font-bold block mt-1">
                          ⚠️ Incomplete mandatory field
                        </span>
                      )}
                    </div>
                  );
                };

                const personalFields = enrollmentFields.filter((f) => categorize(f.key) === 'personal');
                const academicFields = enrollmentFields.filter((f) => categorize(f.key) === 'academic');
                const contactFields = enrollmentFields.filter((f) => categorize(f.key) === 'contact');
                const institutionalFields = enrollmentFields.filter((f) => categorize(f.key) === 'institutional');

                return (
                  <div className="space-y-3">
                    {/* Section 1: Personal Details */}
                    {(mobileProfileTab === 'all' || mobileProfileTab === 'personal') && (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() => toggleProfileSection('personal')}
                          className="w-full p-4 flex items-center justify-between text-left font-bold text-xs bg-slate-100 hover:bg-slate-200/80 transition min-h-[48px]"
                        >
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-indigo-600" />
                            <span className="text-slate-900 font-bold">Personal & Identity Details</span>
                            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                              {personalFields.length + 1}
                            </span>
                          </div>
                          {openProfileSections.personal ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </button>
                        {openProfileSections.personal && (
                          <div className="p-3 space-y-3 bg-white border-t border-slate-200">
                            {/* Summary Badge */}
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                              <span className="text-xs uppercase font-bold text-slate-400 block">Registered Student</span>
                              <strong className="text-slate-900 text-sm block">{student.name}</strong>
                              <span className="text-xs text-slate-500">Gender: {(student as any).gender || formData.gender || 'Not specified'} • Blood: {(student as any).bloodGroup || formData.bloodGroup || 'N/A'}</span>
                            </div>
                            {personalFields.map(renderMobileField)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 2: Academic & Enrollment */}
                    {(mobileProfileTab === 'all' || mobileProfileTab === 'academic') && (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() => toggleProfileSection('academic')}
                          className="w-full p-4 flex items-center justify-between text-left font-bold text-xs bg-slate-100 hover:bg-slate-200/80 transition min-h-[48px]"
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-600" />
                            <span className="text-slate-900 font-bold">Academic & Enrollment Records</span>
                            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                              {academicFields.length + 1}
                            </span>
                          </div>
                          {openProfileSections.academic ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </button>
                        {openProfileSections.academic && (
                          <div className="p-3 space-y-3 bg-white border-t border-slate-200">
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs uppercase font-bold text-slate-400">Roll No</span>
                                <strong className="font-mono text-slate-900">{student.rollNo}</strong>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs uppercase font-bold text-slate-400">Registration</span>
                                <strong className="font-mono text-slate-900">{student.registerNo}</strong>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs uppercase font-bold text-slate-400">Class & Sem</span>
                                <span className="font-semibold text-slate-800">{student.course} • Sem {student.semester}</span>
                              </div>
                            </div>
                            {academicFields.map(renderMobileField)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 3: Contact & Emergency */}
                    {(mobileProfileTab === 'all' || mobileProfileTab === 'contact') && (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() => toggleProfileSection('contact')}
                          className="w-full p-4 flex items-center justify-between text-left font-bold text-xs bg-slate-100 hover:bg-slate-200/80 transition min-h-[48px]"
                        >
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-indigo-600" />
                            <span className="text-slate-900 font-bold">Contact & Emergency Details</span>
                            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                              {contactFields.length}
                            </span>
                          </div>
                          {openProfileSections.contact ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </button>
                        {openProfileSections.contact && (
                          <div className="p-3 space-y-3 bg-white border-t border-slate-200">
                            {contactFields.map(renderMobileField)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 4: Institutional & Other */}
                    {institutionalFields.length > 0 && (mobileProfileTab === 'all' || mobileProfileTab === 'institutional') && (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() => toggleProfileSection('institutional')}
                          className="w-full p-4 flex items-center justify-between text-left font-bold text-xs bg-slate-100 hover:bg-slate-200/80 transition min-h-[48px]"
                        >
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-indigo-600" />
                            <span className="text-slate-900 font-bold">Other Institutional Parameters</span>
                            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                              {institutionalFields.length}
                            </span>
                          </div>
                          {openProfileSections.institutional ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </button>
                        {openProfileSections.institutional && (
                          <div className="p-3 space-y-3 bg-white border-t border-slate-200">
                            {institutionalFields.map(renderMobileField)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Floating / Sticky Save Bar for Mobile */}
              <div className="sticky bottom-4 z-20 pt-2 pb-1 bg-white/95 backdrop-blur-md border-t border-slate-200 rounded-2xl shadow-lg p-3">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 min-h-[48px] active:scale-[0.99]"
                >
                  <Save className="w-4 h-4" />
                  Save & Update Profile
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* VIEW D: SERVICE REQUESTS & CERTIFICATES */}
      {activeSubTab === 'requests' && (
        <StudentRequestsModule
          student={student}
          serviceTariffs={serviceTariffs}
          myRequests={myRequests}
          onCreateRequest={(req: any) => onCreateServiceRequest?.(req)}
        />
      )}

      {/* VIEW C: CONGRATULATIONS DASHBOARD FOR THIS ROLL NO */}
      {activeSubTab === 'congratulations' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                <Trophy className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">
                  Congratulations & Honors Dashboard
                </h3>
                <p className="text-xs text-slate-500">
                  Accolades, commendations, and achievements awarded to Roll No:{' '}
                  <strong className="font-mono text-slate-800">{student.rollNo}</strong> ({student.name}).
                </p>
              </div>
            </div>

            <span className="px-3 py-1 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-xs font-bold font-mono">
              {studentCongratulations.length} Commendations
            </span>
          </div>

          {studentCongratulations.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-8">
              <Trophy className="w-14 h-14 text-slate-300 mx-auto mb-3" />
              <h4 className="font-bold text-slate-800 text-base">
                No Congratulation Messages Posted Yet
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                Faculty and Principal post commendations for outstanding academic milestones,
                hackathon victories, sports achievements, and campus leadership. Keep excelling!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {studentCongratulations.map((cong: CongratulationMessage) => (
                <div
                  key={cong.id}
                  className="bg-gradient-to-br from-amber-50 via-white to-amber-50/40 rounded-2xl border-2 border-amber-200/80 p-6 shadow-sm relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 w-28 h-28 bg-amber-200/20 rounded-full blur-2xl pointer-events-none" />

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm">
                        <Sparkles className="w-3.5 h-3.5" />
                        {cong.badge}
                      </span>
                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {cong.date}
                      </span>
                    </div>

                    <h4 className="font-black text-slate-900 text-base leading-snug">
                      {cong.title}
                    </h4>

                    <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide block mt-1">
                      Category: {cong.category}
                    </span>

                    <p className="text-xs text-slate-700 mt-4 leading-relaxed italic bg-white/80 p-4 rounded-xl border border-amber-100 shadow-sm">
                      &ldquo;{cong.message}&rdquo;
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-amber-100 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <UserCheck className="w-4 h-4 text-indigo-600" />
                      <div>
                        <strong className="text-slate-900 block">{cong.awardedByName}</strong>
                        <span className="text-xs text-slate-400">
                          {cong.awardedByDesignation || cong.awardedByRole.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase font-mono bg-amber-100 text-amber-900 border border-amber-200">
                      {cong.awardedByRole}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW E: OTHER EXAMS & ASSESSMENTS SCORECARD */}
      {activeSubTab === 'other_exams' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Other Exams &amp; Assessment Scorecards</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Periodic unit tests, practical assessments, and Olympiad evaluations approved and released by the Principal.
              </p>
            </div>

            {/* Filter by Exam Type */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filter Type:</span>
              <select
                value={otherExamsFilterType}
                onChange={(e) => setOtherExamsFilterType(e.target.value)}
                className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="All">All Other Exams ({studentOtherExams.length})</option>
                {Array.from(new Set(studentOtherExams.map((e) => e.examTypeId))).map((typeId) => {
                  const examType = examTypesList.find((t) => t.id === typeId);
                  return (
                    <option key={typeId} value={typeId}>
                      {examType?.name || typeId}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Scorecards Grid */}
          {studentOtherExams.filter((e) => otherExamsFilterType === 'All' || e.examTypeId === otherExamsFilterType).length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-sm text-center space-y-3">
              <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mx-auto">
                <FileCheck className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">No Auxiliary Exam Scorecards Published Yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Examinations configured for the auxiliary &ldquo;Other Exams&rdquo; menu (such as Unit Tests, Practical Examinations, or Competitive Olympiads) will appear here once the faculty submissions are reviewed, approved, and released by the Principal.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {studentOtherExams
                .filter((e) => otherExamsFilterType === 'All' || e.examTypeId === otherExamsFilterType)
                .map((evalItem) => {
                  const examType = examTypesList.find((t) => t.id === evalItem.examTypeId);
                  const headsForThisExam = examHeadsList
                    .filter((h) => h.examTypeId === evalItem.examTypeId)
                    .sort((a, b) => a.sequence - b.sequence);

                  const maxCeiling = evalItem.maxPossibleMarks ?? evalItem.maxMarks ?? 100;
                  const obtained = evalItem.totalMarksObtained ?? evalItem.totalMarks ?? 0;
                  const percent = maxCeiling > 0 ? Math.round((obtained / maxCeiling) * 100) : 0;
                  const overallGrade = evalItem.overallGrade || evalItem.letterGrade || 'A';
                  const headScoresMap: Record<string, any> = evalItem.headScores || evalItem.headValues || {};
                  const attendanceVal = evalItem.attendancePercentage ?? evalItem.attendancePercent ?? 90;
                  const coScholasticVal =
                    evalItem.coScholasticRating ||
                    (evalItem.coScholasticItems
                      ? Object.entries(evalItem.coScholasticItems)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ')
                      : 'Proficient');
                  const remarksVal = evalItem.teacherRemarks || evalItem.remarks || '';

                  return (
                    <div
                      key={evalItem.id}
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between hover:border-purple-200 transition"
                    >
                      {/* Top Header */}
                      <div className="p-5 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-purple-400/20 text-purple-300 border border-purple-400/30">
                              {examType?.category || 'Periodic Evaluation'}
                            </span>
                            <span className="text-xs text-purple-200 font-mono">
                              Sem {evalItem.semester} • {evalItem.subjectCode}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-white mt-1">
                            {examType?.name || 'Auxiliary Assessment'}
                          </h4>
                          <p className="text-xs text-purple-200 mt-0.5">{evalItem.subjectName}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-2xl font-black font-mono text-amber-400">
                            {obtained}
                            <span className="text-xs text-purple-300 font-normal"> / {maxCeiling}</span>
                          </span>
                          <span className="block text-xs font-semibold text-purple-200 font-mono">
                            {percent}% • Grade {overallGrade}
                          </span>
                        </div>
                      </div>

                      {/* Score Breakdown by Principal Heads */}
                      <div className="p-5 space-y-4 flex-1">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono block mb-2">
                            Principal-Defined Evaluation Heads
                          </span>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-100 text-xs uppercase font-bold text-slate-500">
                                  <th className="pb-1.5 font-medium">Head Name</th>
                                  <th className="pb-1.5 font-medium text-center">Format</th>
                                  <th className="pb-1.5 font-medium text-center">Passing</th>
                                  <th className="pb-1.5 font-medium text-right">Score / Value</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {headsForThisExam.length > 0 ? (
                                  headsForThisExam.map((head) => {
                                    const val = headScoresMap[head.id];
                                    const isNumeric = head.format === 'marks';
                                    const isPassed = !isNumeric || Number(val) >= head.passingMarks;

                                    return (
                                      <tr key={head.id} className="py-2">
                                        <td className="py-2 font-medium text-slate-800">{head.name}</td>
                                        <td className="py-2 text-center text-slate-500 capitalize">{head.format}</td>
                                        <td className="py-2 text-center font-mono text-slate-500">
                                          {isNumeric ? `${head.passingMarks} / ${head.maxMarks}` : '—'}
                                        </td>
                                        <td className="py-2 text-right">
                                          {isNumeric ? (
                                            <span
                                              className={`font-mono font-bold ${
                                                isPassed ? 'text-indigo-700' : 'text-rose-600'
                                              }`}
                                            >
                                              {val !== undefined ? val : '—'} / {head.maxMarks}
                                            </span>
                                          ) : (
                                            <span className="font-semibold text-slate-700">{String(val || '—')}</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                ) : (
                                  Object.entries(headScoresMap).map(([k, v]) => (
                                    <tr key={k} className="py-2">
                                      <td className="py-2 font-medium text-slate-800">{k}</td>
                                      <td className="py-2 text-center text-slate-500">Marks</td>
                                      <td className="py-2 text-center font-mono text-slate-500">—</td>
                                      <td className="py-2 text-right font-mono font-bold text-indigo-700">
                                        {String(v)}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Additional Evaluation Badges: Attendance, Co-Scholastic, Remarks */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-xs uppercase font-bold text-slate-400 block">Attendance</span>
                            <strong className="text-slate-800 font-mono">
                              {attendanceVal}%
                            </strong>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-xs uppercase font-bold text-slate-400 block">Co-Scholastic</span>
                            <strong className="text-purple-700 font-semibold">
                              {coScholasticVal}
                            </strong>
                          </div>
                        </div>

                        {remarksVal && (
                          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-xs">
                            <span className="text-xs font-bold uppercase text-purple-900 block font-mono">
                              Faculty Evaluator Observations:
                            </span>
                            <p className="text-purple-950 mt-0.5 italic">&ldquo;{remarksVal}&rdquo;</p>
                          </div>
                        )}
                      </div>

                      {/* Footer: Principal Approval Verification & Print */}
                      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Approved &amp; Released by Principal</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedScorecardForPrint(evalItem)}
                          className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 shadow-sm flex items-center gap-1 transition"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          <span>Print Scorecard</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* OFFICIAL MARKSHEET VIEWER: FIXED-POSITION OVERLAY WITH CLEAN HEADER & CONTROLS */}
      {isMarksheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Official Autonomous Marksheet Viewer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMarksheetOpen(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
        >
          {/* Wrapped Responsive Marksheet Frame */}
          <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl max-w-4xl w-full border-0 sm:border-2 border-slate-300 overflow-hidden my-0 sm:my-4 h-full sm:h-auto sm:max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Clean Header Toolbar (Hidden when printing) */}
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2.5 print:hidden border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs tracking-wide uppercase block">
                    CBCS Grade Marksheet
                  </span>
                  <span className="text-xs text-slate-400 hidden xs:inline">
                    Autonomous Examination Cell
                  </span>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                {/* Semester-Selection Dropdown with all completed semesters */}
                <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700">
                  <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <label htmlFor="student-marksheet-semester" className="text-xs font-semibold text-slate-300 hidden sm:inline">
                    Sem:
                  </label>
                  <select
                    id="student-marksheet-semester"
                    value={selectedMarksheetSemester}
                    onChange={(e) => setSelectedMarksheetSemester(Number(e.target.value))}
                    className="bg-slate-900 text-xs font-bold text-amber-300 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer min-h-[36px]"
                  >
                    {availableMarksheetSemesters.map((sem: number) => (
                      <option key={sem} value={sem}>
                        Sem {sem} {sem === student.semester ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Print Marksheet Action */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm text-white min-h-[40px]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print / Save PDF</span>
                  <span className="sm:hidden">Print</span>
                </button>

                {/* Prominent 'X' Close Button to Exit View */}
                <button
                  type="button"
                  onClick={() => setIsMarksheetOpen(false)}
                  aria-label="Close Marksheet Viewer"
                  title="Close Marksheet Viewer (Exit)"
                  className="p-2 min-h-[40px] min-w-[40px] bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition flex items-center justify-center border border-slate-700 hover:border-rose-500 group shadow-sm"
                >
                  <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-150" />
                </button>
              </div>
            </div>

            {/* Scrollable Printable Marksheet Paper Content */}
            <MarksheetDocument
              student={student}
              grades={grades}
              selectedSemester={selectedMarksheetSemester}
            />
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <PrintableReceipt
        transaction={selectedReceipt}
        student={student}
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />

      {/* Auxiliary Exam Printable Scorecard Modal */}
      {selectedScorecardForPrint && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Printable Auxiliary Exam Scorecard"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedScorecardForPrint(null);
          }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95">
            <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs uppercase tracking-wider">Auxiliary Exam Scorecard</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedScorecardForPrint(null)}
                  className="p-1.5 bg-slate-800 hover:bg-rose-600 rounded-lg text-slate-300 hover:text-white transition"
                  aria-label="Close Scorecard"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-3 text-center">
                <h3 className="text-base font-black text-slate-900">
                  {examTypesList.find((t) => t.id === selectedScorecardForPrint.examTypeId)?.name || 'Auxiliary Assessment'}
                </h3>
                <p className="text-slate-500 mt-0.5 font-mono">
                  {student.name} • Roll: {student.rollNo} • {student.course} (Sem {selectedScorecardForPrint.semester})
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 uppercase font-bold block">Subject</span>
                  <strong className="text-slate-900 text-sm">
                    {selectedScorecardForPrint.subjectCode} — {selectedScorecardForPrint.subjectName}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 uppercase font-bold block">Total Score</span>
                  <strong className="text-indigo-700 font-mono text-base">
                    {selectedScorecardForPrint.totalMarksObtained ?? selectedScorecardForPrint.totalMarks ?? 0} /{' '}
                    {selectedScorecardForPrint.maxPossibleMarks ?? selectedScorecardForPrint.maxMarks ?? 100}
                  </strong>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-bold">
                    <tr>
                      <th className="px-3 py-2">Evaluation Head</th>
                      <th className="px-3 py-2 text-right">Score / Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(selectedScorecardForPrint.headScores || selectedScorecardForPrint.headValues || {}).map(([headId, val]) => {
                      const headDef = examHeadsList.find((h) => h.id === headId);
                      return (
                        <tr key={headId}>
                          <td className="px-3 py-2 font-medium text-slate-800">{headDef?.name || headId}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                            {String(val)}
                            {headDef?.format === 'marks' ? ` / ${headDef.maxMarks}` : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {(selectedScorecardForPrint.teacherRemarks || selectedScorecardForPrint.remarks) && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl italic text-slate-700">
                  &ldquo;{selectedScorecardForPrint.teacherRemarks || selectedScorecardForPrint.remarks}&rdquo;
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL NOTICE READER MODAL */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <Megaphone className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  Official Institutional Circular
                </h3>
              </div>
              <button
                onClick={() => setSelectedNotice(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-5">
              <div className="border-b border-slate-200 pb-4 text-center">
                <span className="text-xs uppercase font-bold tracking-widest text-slate-400 block font-mono">
                  Ram Lakhan Singh Yadav College • Office of Academic Affairs
                </span>
                <h2 className="text-lg sm:text-xl font-black text-slate-950 mt-1">
                  {selectedNotice.title}
                </h2>
                <div className="flex items-center justify-center gap-3 mt-2 text-xs text-slate-500 font-mono">
                  <span>Date: {selectedNotice.date}</span>
                  <span>•</span>
                  <span>Category: {selectedNotice.category}</span>
                </div>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                {selectedNotice.content}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 block">Published Authority</span>
                  <strong className="text-slate-900">{selectedNotice.authorName}</strong>
                  <span className="text-slate-500 block">{selectedNotice.authorRole}</span>
                </div>
                <div className="text-right">
                  <button
                    onClick={() => setSelectedNotice(null)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
                  >
                    Close Notification
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
