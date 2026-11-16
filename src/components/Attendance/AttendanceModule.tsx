import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Student, Faculty, AttendanceRecord, FacultyMapping, UserAccount, UserRole, TimetableSlot, CourseSectionConfig } from '../../types/erp';
import { erpStorage } from '../../services/erpStorage';
import { sanitizeSpreadsheetCell, getISTDateString } from '../../utils/erpLogic';
import {
  CalendarCheck,
  Check,
  X,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Download,
  Filter,
  CheckCheck,
  RotateCcw,
  UserCheck,
  FileSpreadsheet,
  Send,
  Calendar,
  Search,
  Sparkles,
  Layers,
  ArrowDown,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AttendanceModuleProps {
  students: Student[];
  faculty: Faculty[];
  attendanceRecords: AttendanceRecord[];
  facultyMappings?: FacultyMapping[];
  timetable?: TimetableSlot[];
  courseSections?: CourseSectionConfig[];
  currentRole?: UserRole;
  currentUser?: UserAccount;
  onSaveAttendance: (
    records: Omit<AttendanceRecord, 'id'>[],
    subjectCode: string
  ) => void;
  onIssueWarningNotice?: (studentName: string, rollNo: string, percentage: number) => void;
  initialSubjectCode?: string;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  students,
  faculty,
  attendanceRecords,
  facultyMappings = [],
  timetable = [],
  courseSections = [],
  currentRole,
  currentUser,
  onSaveAttendance,
  onIssueWarningNotice,
  initialSubjectCode,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'mark' | 'defaulters' | 'history'>('mark');

  // Today's date (IST) and allowable backdating bounds (Current month and last month only)
  const todayStr = useMemo(() => getISTDateString(), []);
  const minAllowedDate = useMemo(() => {
    const [yStr, mStr] = todayStr.split('-');
    let year = Number(yStr);
    let month = Number(mStr) - 1; // 1-12 previous month
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    return `${year}-${String(month).padStart(2, '0')}-01`;
  }, [todayStr]);

  // Filters for taking attendance
  const [selectedCourse, setSelectedCourse] = useState('B.Tech Computer Science & Engineering');
  const [selectedSemester, setSelectedSemester] = useState(5);
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState(initialSubjectCode || 'CS501');

  useEffect(() => {
    if (initialSubjectCode) {
      setSelectedSubjectCode(initialSubjectCode);
    }
  }, [initialSubjectCode]);
  const [sessionDate, setSessionDate] = useState(todayStr);

  // Selected faculty marker
  const [markingFacultyId, setMarkingFacultyId] = useState('FAC-001');

  // Map of studentId -> status (Empty by default: all students default to "present"!)
  const [sessionStatus, setSessionStatus] = useState<Record<string, 'present' | 'absent' | 'late' | 'excused'>>({});
  const [studentRemarks, setStudentRemarks] = useState<Record<string, string>>({});
  const [backdateRectificationNote, setBackdateRectificationNote] = useState<string>('');
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyStudentId, setHistoryStudentId] = useState<string>(students[0]?.id || 'STU-101');
  const [defaulterAuditFeedback, setDefaulterAuditFeedback] = useState<string | null>(null);

  // Roll Number Jump state & refs
  const [rollJumpQuery, setRollJumpQuery] = useState('');
  const [jumpHighlightRollNo, setJumpHighlightRollNo] = useState<string | null>(null);
  const studentRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const jumpTimerRef = useRef<number | null>(null);
  const submitTimerRef = useRef<number | null>(null);
  const auditTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (jumpTimerRef.current) window.clearTimeout(jumpTimerRef.current);
      if (submitTimerRef.current) window.clearTimeout(submitTimerRef.current);
      if (auditTimerRef.current) window.clearTimeout(auditTimerRef.current);
    };
  }, []);

  // Active sections for the selected course and semester (Admin controlled; deactivated by default)
  const activeSectionsForCohort = useMemo(() => {
    if (!courseSections || courseSections.length === 0) return [];
    return courseSections.filter(
      (s) => s.course === selectedCourse && s.semester === selectedSemester && s.isActive
    );
  }, [courseSections, selectedCourse, selectedSemester]);

  // Section bypass rule: If all sections are deactivated by Admin, bypass section requirement
  const isSectionBypassed = activeSectionsForCohort.length === 0;

  // Filter faculty mappings strictly assigned to current faculty member (never leak unmapped institution courses)
  const myFacultyMappings = useMemo(() => {
    if (currentRole === 'faculty' && currentUser) {
      const userEmail = (currentUser.email || '').trim().toLowerCase();
      const userName = (currentUser.name || '').trim().toLowerCase();
      return facultyMappings.filter(
        (m) =>
          (m.facultyId && (m.facultyId === currentUser.facultyId || m.facultyId === currentUser.id)) ||
          (userEmail && (m.facultyEmail || '').trim().toLowerCase() === userEmail) ||
          (userName && (m.facultyName || '').trim().toLowerCase() === userName)
      );
    }
    return facultyMappings;
  }, [currentRole, currentUser, facultyMappings]);

  // Courses available: only courses tagged to faculty!
  const availableCourses = useMemo(() => {
    if (currentRole === 'faculty') {
      return Array.from(new Set(myFacultyMappings.map((m) => m.course).filter(Boolean)));
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

  // Semesters available: only semesters tagged to faculty for this course!
  const availableSemesters = useMemo(() => {
    if (currentRole === 'faculty') {
      const sems = myFacultyMappings
        .filter((m) => m.course === selectedCourse)
        .map((m) => m.semester);
      return Array.from(new Set(sems)).sort((a, b) => a - b);
    }
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }, [currentRole, myFacultyMappings, selectedCourse]);

  // Sections available: only active sections from Admin configuration
  const availableSections = useMemo(() => {
    if (isSectionBypassed) return [];
    const activeNames = activeSectionsForCohort.map((s) => s.sectionName.replace(/^Section\s+/i, ''));
    if (activeNames.length > 0) return Array.from(new Set(activeNames)).sort();
    return ['A', 'B'];
  }, [isSectionBypassed, activeSectionsForCohort]);

  // Subjects available: strictly tagged to faculty for course & semester
  const availableSubjects = useMemo(() => {
    if (currentRole === 'faculty') {
      return myFacultyMappings
        .filter((m) => m.course === selectedCourse && m.semester === selectedSemester)
        .map((m) => ({
          code: m.subjectCode,
          name: m.subjectName,
          faculty: m.facultyName,
        }));
    }
    return [
      { code: 'CS501', name: 'Design & Analysis of Algorithms', faculty: 'Prof. Rajesh Verma' },
      { code: 'CS502', name: 'Operating Systems & Architecture', faculty: 'Dr. Ananya Sen' },
      { code: 'CS503', name: 'Database Management Systems Lab', faculty: 'Prof. Rajesh Verma' },
      { code: 'CS504', name: 'Theory of Computation & Automata', faculty: 'Dr. Meenakshi Roy' },
    ];
  }, [currentRole, myFacultyMappings, selectedCourse, selectedSemester]);

  // Tagged weekdays for selected course and faculty from Teacher Tagging
  const taggedWeekdays = useMemo<string[]>(() => {
    const matchingTimetableSlots = timetable.filter(
      (t) => t.course === selectedCourse && t.subjectCode === selectedSubjectCode
    );
    if (matchingTimetableSlots.length > 0) {
      return Array.from(new Set(matchingTimetableSlots.map((s) => s.dayOfWeek)));
    }
    const courseSlots = timetable.filter((t) => t.course === selectedCourse);
    if (courseSlots.length > 0) {
      return Array.from(new Set(courseSlots.map((s) => s.dayOfWeek)));
    }
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  }, [timetable, selectedCourse, selectedSubjectCode]);

  // Validate if selected sessionDate falls on a tagged weekday
  const sessionDateWeekday = useMemo(() => {
    if (!sessionDate) return '';
    const d = new Date(sessionDate + 'T00:00:00');
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return weekdays[d.getDay()] || '';
  }, [sessionDate]);

  const isDateOnTaggedWeekday = useMemo(() => {
    if (!sessionDateWeekday) return true;
    return taggedWeekdays.includes(sessionDateWeekday);
  }, [sessionDateWeekday, taggedWeekdays]);

  const isDateWithinBackdatingLimit = useMemo(() => {
    return sessionDate >= minAllowedDate && sessionDate <= todayStr;
  }, [sessionDate, minAllowedDate, todayStr]);

  // Auto-sync dropdowns to valid tagged selections
  useEffect(() => {
    if (availableCourses.length > 0 && !availableCourses.includes(selectedCourse)) {
      setSelectedCourse(availableCourses[0]);
    }
  }, [availableCourses, selectedCourse]);

  useEffect(() => {
    if (availableSemesters.length > 0 && !availableSemesters.includes(selectedSemester)) {
      setSelectedSemester(availableSemesters[0]);
    }
  }, [availableSemesters, selectedSemester]);

  useEffect(() => {
    if (!isSectionBypassed && availableSections.length > 0 && !availableSections.includes(selectedSection)) {
      setSelectedSection(availableSections[0]);
    }
  }, [availableSections, selectedSection, isSectionBypassed]);

  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.some((s) => s.code === selectedSubjectCode)) {
      setSelectedSubjectCode(availableSubjects[0].code);
    }
  }, [availableSubjects, selectedSubjectCode]);

  const currentSubject = availableSubjects.find((s) => s.code === selectedSubjectCode) || availableSubjects[0] || {
    code: 'CS501',
    name: 'General Attendance',
    faculty: 'Faculty Member',
  };

  const isMoreThanSevenDaysOld = useMemo(() => {
    if (!sessionDate) return false;
    const selTime = new Date(sessionDate + 'T00:00:00').getTime();
    const todayTime = new Date(todayStr + 'T00:00:00').getTime();
    if (Number.isNaN(selTime) || Number.isNaN(todayTime)) return false;
    return todayTime - selTime > 7 * 24 * 60 * 60 * 1000;
  }, [sessionDate, todayStr]);

  // Filter active students matching course and semester (and section if active), excluding withdrawn/expelled/alumni (Bug 648)
  const enrolledStudents = useMemo(() => {
    return students.filter((s) => {
      const inactiveStatuses = ['withdrawn', 'expelled', 'alumni', 'transferred', 'graduated', 'dropped'];
      const stStatus = String(s.academicStatus || s.enrollmentData?.academicStatus || 'active').toLowerCase();
      if (inactiveStatuses.includes(stStatus)) return false;
      const matchCourseSem = s.course === selectedCourse && s.semester === selectedSemester;
      if (!matchCourseSem) return false;
      if (isSectionBypassed) return true;
      return s.section ? s.section.toUpperCase() === selectedSection.toUpperCase() : true;
    });
  }, [students, selectedCourse, selectedSemester, isSectionBypassed, selectedSection]);

  // Handle jump by roll number
  const handleJumpToRollNo = (query: string) => {
    setRollJumpQuery(query);
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return;
    const matched = enrolledStudents.find(
      (s) => s.rollNo.toLowerCase().includes(trimmed) || s.name.toLowerCase().includes(trimmed)
    );
    if (matched) {
      const el = studentRowRefs.current[matched.rollNo];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setJumpHighlightRollNo(matched.rollNo);
        if (jumpTimerRef.current) window.clearTimeout(jumpTimerRef.current);
        jumpTimerRef.current = window.setTimeout(() => setJumpHighlightRollNo(null), 2500);
      }
    }
  };

  // Quick batch actions
  const handleMarkAll = (status: 'present' | 'absent') => {
    const updated: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
    enrolledStudents.forEach((s) => {
      updated[s.id] = status;
    });
    setSessionStatus(updated);
  };

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setSessionStatus((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  // Submit attendance batch (Tracks one record per class session/period)
  const handleSubmitSession = () => {
    setErrorMessage(null);
    if (currentRole === 'faculty') {
      const isMapped = myFacultyMappings.some(
        (m) =>
          m.course === selectedCourse &&
          m.semester === selectedSemester &&
          (m.subjectCode || '').toUpperCase() === (selectedSubjectCode || '').toUpperCase()
      );
      if (!isMapped) {
        setErrorMessage(
          `Access Denied: You are not mapped to teach ${selectedSubjectCode} for ${selectedCourse} Sem ${selectedSemester}.`
        );
        return;
      }
    } else if (currentRole && !['faculty'].includes(currentRole)) {
      setErrorMessage('Statutory Restriction: Attendance roll call can only be submitted by mapped Faculty.');
      return;
    }
    if (enrolledStudents.length === 0) {
      setErrorMessage('No active students found in the selected cohort. Cannot submit an empty attendance session.');
      return;
    }
    if (!isDateOnTaggedWeekday) {
      setErrorMessage(`Cannot submit attendance: ${sessionDate} (${sessionDateWeekday}) is not a tagged class day. Tagged days: ${taggedWeekdays.join(', ')}`);
      return;
    }
    if (!isDateWithinBackdatingLimit) {
      setErrorMessage(`Backdating is restricted to current and previous calendar month (${minAllowedDate} to ${todayStr}).`);
      return;
    }

    if (isMoreThanSevenDaysOld && !backdateRectificationNote.trim()) {
      setErrorMessage(
        'Statutory Backdate Audit Rule: Sessions older than 7 days require an official Principal/HoD Rectification Approval Reference Note before saving.'
      );
      return;
    }

    const recordsToSave: Omit<AttendanceRecord, 'id'>[] = enrolledStudents.map((stu) => {
      const status = sessionStatus[stu.id] || 'present';
      const combinedRemark = [
        studentRemarks[stu.id]?.trim(),
        isMoreThanSevenDaysOld ? `[Backdated Rectification: ${backdateRectificationNote.trim()}]` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return {
        studentId: stu.id,
        studentRollNo: stu.rollNo,
        studentName: stu.name,
        course: stu.course,
        semester: stu.semester,
        section: isSectionBypassed ? undefined : selectedSection,
        subjectCode: selectedSubjectCode,
        subjectName: currentSubject.name,
        date: sessionDate,
        status,
        markedByFacultyId: currentUser?.facultyId || currentUser?.id || 'FAC-001',
        facultyName: currentUser?.name || currentSubject.faculty,
        remarks: combinedRemark || undefined,
      };
    });

    onSaveAttendance(recordsToSave, selectedSubjectCode);

    try {
      const prefersReduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced && typeof confetti === 'function') {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
        });
      }
    } catch {}

    setSubmittedMessage(
      `Attendance for ${currentSubject.name} (${sessionDate}) recorded! Student attendance % updated across dashboards.`
    );
    if (submitTimerRef.current) window.clearTimeout(submitTimerRef.current);
    submitTimerRef.current = window.setTimeout(() => setSubmittedMessage(null), 5000);
  };

  // Defaulters list (<75%), excluding withdrawn/expelled/alumni
  const defaultersList = useMemo(() => {
    const inactiveStatuses = ['withdrawn', 'expelled', 'alumni', 'transferred', 'graduated', 'dropped'];
    return students
      .filter((s) => {
        const stStatus = String(s.academicStatus || s.enrollmentData?.academicStatus || 'active').toLowerCase();
        return !inactiveStatuses.includes(stStatus) && s.attendancePercentage < 75.0;
      })
      .sort((a, b) => a.attendancePercentage - b.attendancePercentage);
  }, [students]);

  // Session summary counts (All students default to "present"!)
  const sessionStats = useMemo(() => {
    let p = 0;
    let a = 0;
    let l = 0;
    let e = 0;
    enrolledStudents.forEach((s) => {
      const st = sessionStatus[s.id] || 'present';
      if (st === 'present') p++;
      else if (st === 'absent') a++;
      else if (st === 'late') l++;
      else if (st === 'excused') e++;
    });
    const total = enrolledStudents.length;
    const rate = total > 0 ? Math.round(((p + l * 0.5 + e) / total) * 100) : 0;
    return { p, a, l, e, total, rate };
  }, [enrolledStudents, sessionStatus]);

  // Export defaulters as CSV
  const handleExportDefaultersCSV = () => {
    const headers = 'Roll No,Student Name,Course,Semester,Attendance %,Status,Required Classes for 75%\n';
    const rows = defaultersList
      .map(
        (s) =>
          `"${sanitizeSpreadsheetCell(s.rollNo)}","${sanitizeSpreadsheetCell(s.name)}","${sanitizeSpreadsheetCell(s.course)}",${s.semester},${s.attendancePercentage}%,"Debarred from Exam",${Math.max(
            0,
            Math.ceil((0.75 * 40 - (s.attendancePercentage / 100) * 40) / 0.25)
          )}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RLSY_Attendance_Defaulters_${sessionDate}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Module Title & Subtab Navigation */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Student Attendance System</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lecture-wise roll call register, real-time university 75% rule compliance, and condonation monitoring.
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('mark')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'mark'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Take Roll Call
          </button>
          <button
            onClick={() => setActiveSubTab('defaulters')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeSubTab === 'defaulters'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Defaulter Roster</span>
            <span className="w-4 h-4 bg-rose-100 text-rose-700 rounded-full text-xs flex items-center justify-center font-bold">
              {defaultersList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'history'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Attendance Logs
          </button>
        </div>
      </div>

      {submittedMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm flex items-center gap-2">
          <CheckCheck className="w-5 h-5 text-emerald-600" />
          <span>{submittedMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* VIEW 1: TAKE ROLL CALL */}
      {activeSubTab === 'mark' && (
        <div className="space-y-6 pb-6">
          {/* Class & Subject Selector Bar - Strictly Scoped to Faculty Tagging */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            {currentRole === 'faculty' && (
              <div className="flex items-center justify-between text-xs bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-amber-900">
                <span className="font-semibold">
                  📌 Authorized Class Access: Logged in as <strong>{currentUser?.name}</strong>. Course and semester restricted to your assigned timetable mappings.
                </span>
                <span className="text-xs font-mono uppercase bg-amber-200 px-2 py-0.5 rounded font-bold">
                  Tagged Faculty Session
                </span>
              </div>
            )}

            {/* Weekday Tagging & Backdating Status Alert */}
            {!isDateOnTaggedWeekday && (
              <div className="flex items-center gap-2 text-xs bg-rose-50 border border-rose-300 px-3.5 py-2 rounded-xl text-rose-900 font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Untagged Weekday:</strong> {sessionDate} is a <strong>{sessionDateWeekday}</strong>. Under Teacher Tagging, this course is only assigned on: <strong>{taggedWeekdays.join(', ')}</strong>. Please select a valid class weekday.
                </span>
              </div>
            )}

            {!isDateWithinBackdatingLimit && (
              <div className="flex items-center gap-2 text-xs bg-rose-50 border border-rose-300 px-3.5 py-2 rounded-xl text-rose-900 font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Statutory Backdating Cap:</strong> Attendance marking is only permitted for the current and last calendar month ({minAllowedDate} to {todayStr}).
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Course & Branch</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {availableCourses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Semester & Section</label>
                <div className="flex gap-2">
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(Number(e.target.value))}
                    className={`${isSectionBypassed ? 'w-full' : 'w-1/2'} text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 focus:bg-white cursor-pointer`}
                  >
                    {availableSemesters.map((sem) => (
                      <option key={sem} value={sem}>
                        Sem {sem}
                      </option>
                    ))}
                  </select>

                  {!isSectionBypassed ? (
                    <select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="w-1/2 text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 focus:bg-white cursor-pointer"
                      title="Active section managed by Admin"
                    >
                      {availableSections.map((sec) => (
                        <option key={sec} value={sec}>
                          Sec {sec}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      className="w-1/2 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center px-1 text-center"
                      title="All sections are deactivated by Admin for this cohort; section requirement is bypassed."
                    >
                      Whole Class
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subject & Paper</label>
                <select
                  value={selectedSubjectCode}
                  onChange={(e) => setSelectedSubjectCode(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {availableSubjects.map((sub) => (
                    <option key={sub.code} value={sub.code}>
                      {sub.code}: {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">Session Date</label>
                  <span className="text-xs font-mono text-indigo-600 font-semibold">{sessionDateWeekday}</span>
                </div>
                <input
                  type="date"
                  value={sessionDate}
                  min={minAllowedDate}
                  max={todayStr}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className={`w-full text-xs font-medium border rounded-xl px-3 py-2 ${
                    !isDateOnTaggedWeekday || !isDateWithinBackdatingLimit
                      ? 'border-rose-400 bg-rose-50 text-rose-900'
                      : 'border-slate-200 bg-slate-50 focus:bg-white'
                  }`}
                />
                <span className="text-xs text-slate-400 block mt-0.5">
                  Allowed: {minAllowedDate} to {todayStr}
                </span>
              </div>
            </div>

            {isMoreThanSevenDaysOld && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
                <div className="text-amber-900 font-semibold shrink-0">
                  ⚠️ Backdated Rectification (&gt;7 Days):
                </div>
                <input
                  type="text"
                  value={backdateRectificationNote}
                  onChange={(e) => setBackdateRectificationNote(e.target.value)}
                  placeholder="Enter Principal/HoD Rectification Approval Ref & Reason (Required)..."
                  className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          {/* Session Overview Strip, Jump to Roll No & Bulk Mark Buttons */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
              <span className="font-semibold text-amber-300">
                {currentSubject.code} • {currentSubject.name}
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-300">
                Total: <strong className="text-white">{sessionStats.total}</strong>
              </span>
              <span className="text-emerald-400">
                Present: <strong>{sessionStats.p}</strong>
              </span>
              <span className="text-rose-400">
                Absent: <strong>{sessionStats.a}</strong>
              </span>
              <span className="text-amber-400">
                Late: <strong>{sessionStats.l}</strong>
              </span>
              <span className="bg-indigo-950 px-2.5 py-1 rounded-lg border border-indigo-800 text-indigo-300 font-bold">
                Rate: {sessionStats.rate}%
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              {/* Jump by Roll No Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Jump to Roll No..."
                  value={rollJumpQuery}
                  onChange={(e) => handleJumpToRollNo(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400 w-44 font-mono"
                />
              </div>

              <button
                onClick={() => handleMarkAll('present')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-sm whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                Mark All Present
              </button>
              <button
                onClick={() => handleMarkAll('absent')}
                className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-sm whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                Mark All Absent
              </button>
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Student Roll Call Register ({enrolledStudents.length} Students)
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Default: All Present
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {isSectionBypassed ? 'Whole Class Mode (Section Bypassed)' : `Section ${selectedSection}`}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Cumulative Attendance</th>
                    <th className="px-4 py-3">Eligibility Status</th>
                    <th className="px-4 py-3 text-center">Session Attendance Status</th>
                    <th className="px-4 py-3">Remarks / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {enrolledStudents.map((student) => {
                    const currentStatus = sessionStatus[student.id] || 'present';
                    const isBelow75 = student.attendancePercentage < 75.0;
                    const isJumpHighlighted = jumpHighlightRollNo === student.rollNo;

                    return (
                      <tr
                        key={student.id}
                        ref={(el) => {
                          studentRowRefs.current[student.rollNo] = el;
                        }}
                        className={`transition-colors duration-300 ${
                          isJumpHighlighted
                            ? 'bg-amber-100/80 ring-2 ring-amber-400 font-semibold'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-medium text-slate-900">{student.rollNo}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2.5">
                            <img
                              src={student.avatarUrl}
                              alt={student.name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200"
                            />
                            <div>
                              <span className="font-semibold text-slate-900 block">{student.name}</span>
                              <span className="text-xs text-slate-400">{student.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full ${
                                  student.attendancePercentage >= 75
                                    ? 'bg-emerald-500'
                                    : student.attendancePercentage >= 65
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${student.attendancePercentage}%` }}
                              />
                            </div>
                            <span
                              className={`font-bold font-mono text-xs ${
                                student.attendancePercentage >= 75
                                  ? 'text-emerald-700'
                                  : student.attendancePercentage >= 65
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              {student.attendancePercentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isBelow75 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Debarred (&lt;75%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Eligible (Clear)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1 bg-slate-100 p-1 rounded-xl w-fit mx-auto border border-slate-200">
                            <button
                              onClick={() => handleStatusChange(student.id, 'present')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                currentStatus === 'present'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-200'
                              }`}
                              title="Present"
                            >
                              P
                            </button>
                            <button
                              onClick={() => handleStatusChange(student.id, 'absent')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                currentStatus === 'absent'
                                  ? 'bg-rose-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-200'
                              }`}
                              title="Absent"
                            >
                              A
                            </button>
                            <button
                              onClick={() => handleStatusChange(student.id, 'late')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                currentStatus === 'late'
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-200'
                              }`}
                              title="Late (0.5 Class)"
                            >
                              L
                            </button>
                            <button
                              onClick={() => handleStatusChange(student.id, 'excused')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                currentStatus === 'excused'
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-200'
                              }`}
                              title="Excused Leave"
                            >
                              E
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            placeholder="Optional note..."
                            value={studentRemarks[student.id] || ''}
                            onChange={(e) =>
                              setStudentRemarks((prev) => ({
                                ...prev,
                                [student.id]: e.target.value,
                              }))
                            }
                            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-slate-50 focus:bg-white"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Bar with Regulatory Notice */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                {!isDateOnTaggedWeekday ? (
                  <span className="text-rose-600 font-semibold">
                    ⚠️ Cannot commit: Date is not a tagged class weekday ({taggedWeekdays.join(', ')}).
                  </span>
                ) : !isDateWithinBackdatingLimit ? (
                  <span className="text-rose-600 font-semibold">
                    ⚠️ Cannot commit: Date must be within current and last calendar month ({minAllowedDate} to {todayStr}).
                  </span>
                ) : (
                  <span>
                    Session marked immediately synchronizes attendance percentage across student dashboards and statutory condonation logs.
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* End-of-Tab Save Session Action Button */}
          <div className="flex items-center justify-end pt-2">
            <button
              onClick={handleSubmitSession}
              disabled={!isDateOnTaggedWeekday || !isDateWithinBackdatingLimit}
              className={`px-6 py-2.5 font-bold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 ${
                !isDateOnTaggedWeekday || !isDateWithinBackdatingLimit
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-md hover:shadow-indigo-500/20 active:scale-[0.98]'
              }`}
              title={
                !isDateOnTaggedWeekday
                  ? 'Cannot commit: Untagged weekday'
                  : !isDateWithinBackdatingLimit
                  ? 'Cannot commit: Outside backdating limit'
                  : `Commit attendance records for ${sessionDate}`
              }
            >
              <CheckCheck className="w-4 h-4" />
              <span>Save Session</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: DEFAULTER ROSTER */}
      {activeSubTab === 'defaulters' && (
        <div className="space-y-6">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-rose-950 text-base">University Debarred List (Attendance &lt; 75%)</h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  These students do not meet the mandatory attendance criteria under University Statute 14-B and will have their examination hall tickets blocked unless condoned.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  const res = erpStorage.scanAndIssueDefaulterWarnings(selectedSubjectCode);
                  setDefaulterAuditFeedback(
                    `Statutory Defaulter Scan Complete: Identified ${res.defaulterCount} students below 75% threshold. Generated ${res.issuedCount} formal warning notices in institutional ledger.`
                  );
                  if (auditTimerRef.current) window.clearTimeout(auditTimerRef.current);
                  auditTimerRef.current = window.setTimeout(() => setDefaulterAuditFeedback(null), 6000);
                }}
                className="px-3.5 py-2 bg-rose-900 hover:bg-rose-950 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 whitespace-nowrap border border-rose-700/50"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
                Run Defaulter Audit & Issue Notices
              </button>
              <button
                onClick={handleExportDefaultersCSV}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-xl shadow transition flex items-center gap-2 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Export Defaulters CSV
              </button>
            </div>
          </div>

          {defaulterAuditFeedback && (
            <div className="p-3.5 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-900 font-semibold flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{defaulterAuditFeedback}</span>
              </div>
              <button
                onClick={() => setDefaulterAuditFeedback(null)}
                className="text-rose-700 hover:text-rose-950 font-bold px-2 py-0.5"
              >
                ✕
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Course & Branch</th>
                    <th className="px-4 py-3">Current Attendance</th>
                    <th className="px-4 py-3">Shortfall Deficit</th>
                    <th className="px-4 py-3">Classes Needed for 75%</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {defaultersList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">
                        No students currently under 75% attendance threshold.
                      </td>
                    </tr>
                  ) : (
                    defaultersList.map((stu) => {
                      const deficit = (75.0 - stu.attendancePercentage).toFixed(1);
                      // Formula: (currentPresent + x) / (total + x) >= 0.75
                      // Approximation assuming 40 conducted classes:
                      const classesNeeded = Math.max(1, Math.ceil((0.75 * 40 - (stu.attendancePercentage / 100) * 40) / 0.25));

                      return (
                        <tr key={stu.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">{stu.rollNo}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900 block">{stu.name}</span>
                            <span className="text-xs text-slate-400">Parent: {stu.parentPhone}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {stu.course} (Sem {stu.semester})
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              {stu.attendancePercentage.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-rose-600 font-medium">-{deficit}% deficit</td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            Must attend next <strong className="text-indigo-600 font-bold">{classesNeeded}</strong> classes
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                if (onIssueWarningNotice) {
                                  onIssueWarningNotice(stu.name, stu.rollNo, stu.attendancePercentage);
                                }
                                setDefaulterAuditFeedback(
                                  `Formal attendance warning issued to ${stu.name} (${stu.rollNo}) and logged for guardian alert (${stu.parentPhone}).`
                                );
                                if (auditTimerRef.current) window.clearTimeout(auditTimerRef.current);
                                auditTimerRef.current = window.setTimeout(() => setDefaulterAuditFeedback(null), 5000);
                              }}
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg transition"
                            >
                              Issue Warning Notice
                            </button>
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

      {/* VIEW 3: ATTENDANCE HISTORY LOGS */}
      {activeSubTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Student-Specific Attendance Ledger</h3>
              <p className="text-xs text-slate-500">Day-by-day punch card and roll call archive.</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Select Student:</label>
              <select
                value={historyStudentId}
                onChange={(e) => setHistoryStudentId(e.target.value)}
                className="text-xs font-medium border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 focus:bg-white"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.rollNo} - {s.name} ({s.attendancePercentage.toFixed(1)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Period / Slot</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Course / Sem</th>
                    <th className="px-4 py-3">Faculty In-Charge</th>
                    <th className="px-4 py-3">Status Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {attendanceRecords
                    .filter((r) => r.studentId === historyStudentId)
                    .map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono text-slate-700">{rec.date}</td>
                        <td className="px-4 py-3 font-mono text-xs text-indigo-700 font-semibold">
                          {rec.periodSlot || 'Period 1'}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {rec.subjectCode}: {rec.subjectName}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {rec.course} • Sem {rec.semester} {rec.section ? `(Sec ${rec.section})` : ''}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{rec.facultyName || 'Faculty Member'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-xs uppercase ${
                              rec.status === 'present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec.status === 'late'
                                ? 'bg-amber-100 text-amber-800'
                                : rec.status === 'excused'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
