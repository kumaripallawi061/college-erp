import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, StudentPromotionRecord, UserAccount, StreamCourseSubject } from '../../types/erp';
import {
  sanitizeSpreadsheetData,
  getCourseDurationYears,
  getMaxSemestersForCourse,
  isGradeBacklog,
  getISTDateString,
} from '../../utils/erpLogic';
import { erpStorage } from '../../services/erpStorage';
import { exportJsonSheetsToExcelFile, parseWorkbookSheets } from '../../utils/excelHelper';
import {
  GraduationCap,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Users,
  Search,
  History,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface StudentPromotionModuleProps {
  students: Student[];
  streamCourseSubjects: StreamCourseSubject[];
  promotionAuditRecords: StudentPromotionRecord[];
  onPromoteStudents: (
    streamCode: string,
    course: string,
    fromSemester: number,
    toSemester: number,
    rollNos: string[],
    promotedBy: string,
    subject?: string,
    overrideOptions?: { overrideEligibility?: boolean; overrideReason?: string }
  ) => { updatedStudents: Student[]; record: StudentPromotionRecord };
  onRevertPromotionRecord?: (
    recordId: string
  ) => { updatedStudents: Student[]; audits: StudentPromotionRecord[] };
  currentUser: UserAccount;
}

export const StudentPromotionModule: React.FC<StudentPromotionModuleProps> = ({
  students,
  streamCourseSubjects,
  promotionAuditRecords,
  onPromoteStudents,
  onRevertPromotionRecord,
  currentUser,
}) => {
  const [selectedStream, setSelectedStream] = useState<string>('CSE');
  const [selectedSubject, setSelectedSubject] = useState<string>('All Stream Subjects');
  const [selectedCourse, setSelectedCourse] = useState<string>('B.Tech Computer Science & Engineering');
  const [fromSemester, setFromSemester] = useState<number>(5);
  const [toSemester, setToSemester] = useState<number>(6);

  // Input mode: 'excel' or 'paste'
  const [inputMode, setInputMode] = useState<'excel' | 'paste'>('excel');
  const [pasteText, setPasteText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [parsedRollNos, setParsedRollNos] = useState<string[]>([]);

  // Principal Eligibility Override
  const [overrideEligibility, setOverrideEligibility] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Execution state
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [ineligibleList, setIneligibleList] = useState<Array<{ rollNo: string; name?: string; reason: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const studentsRef = useRef(students);
  const [storageTick, setStorageTick] = useState(0);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    return erpStorage.subscribe(() => setStorageTick((t) => t + 1));
  }, []);

  // Dynamically calculate course duration years and maximum semester limit (courseDurationYears * 2)
  const courseDurationYears = useMemo(() => getCourseDurationYears(selectedCourse), [selectedCourse]);
  const maxSemestersForCourse = useMemo(() => courseDurationYears * 2, [courseDurationYears]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try {
        if (typeof confetti === 'function' && typeof (confetti as any).reset === 'function') {
          (confetti as any).reset();
        }
      } catch {}
    };
  }, []);

  // Clear stale ineligible audit list and keep toSemester strictly sequential
  useEffect(() => {
    setIneligibleList([]);
    setStatusMessage('');
    setErrorMessage('');
    const clampedFrom = Math.min(fromSemester, maxSemestersForCourse);
    if (clampedFrom !== fromSemester) {
      setFromSemester(clampedFrom);
    }
    setToSemester(clampedFrom + 1);
  }, [selectedStream, selectedCourse, fromSemester, maxSemestersForCourse]);

  // Unique stream codes
  const streamOptions = useMemo(() => {
    const map = new Map<string, string>();
    map.set('CSE', 'Computer Science & Engineering');
    map.set('ECE', 'Electronics & Communication');
    map.set('PHY', 'Department of Physics');
    map.set('BCOM', 'Commerce & Accountancy');

    students.forEach((s) => {
      if (s.streamCode) map.set(s.streamCode, s.streamCode);
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [students]);

  // Unique courses
  const courseOptions = useMemo(() => {
    const set = new Set<string>();
    set.add('B.Tech Computer Science & Engineering');
    set.add('B.Tech Electronics & Communication');
    set.add('B.Sc Physics Hons');
    students.forEach((s) => {
      if (s.course) set.add(s.course);
    });
    return Array.from(set);
  }, [students]);

  // Available subjects for selected stream
  const streamSubjects = useMemo(() => {
    const list = streamCourseSubjects.filter((s) => s.streamCode === selectedStream);
    return list;
  }, [streamCourseSubjects, selectedStream]);

  // Handle Excel upload with UTF-8 safe ArrayBuffer, multi-sheet inspection, and dynamic roll number column detection (Bugs 98, 115, 116)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUploadedFileName('');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 10 MB security limit. Please upload a smaller spreadsheet.');
      setUploadedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const sanitizedName = file.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');
    setUploadedFileName(sanitizedName);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      if (!isMountedRef.current) return;
      try {
        const arrayBuf = evt.target?.result;
        if (!arrayBuf) throw new Error('Empty file buffer');
        const wb = await parseWorkbookSheets(arrayBuf as ArrayBuffer, file.name);

        const rollHeaderKeys = new Set([
          'rollno',
          'rollnumber',
          'enrollmentno',
          'regno',
          'registrationno',
          'candidateroll',
          'roll',
          'studentroll',
          'studentid',
          'universityroll',
          'collegeroll',
        ]);
        const ignoredTokens = new Set([
          ...Array.from(rollHeaderKeys),
          'undefined',
          'null',
          'nan',
          'na',
          'n/a',
          'srno',
          'sno',
          'slno',
          'studentname',
          'name',
          'semester',
          'currentsemester',
          'stream',
          'streamcode',
          'course',
          'objectobject',
        ]);

        // Safely extract scalar text from Excel cell values, including rich-text objects and date objects (Bug 125)
        const extractCellText = (cell: unknown): string => {
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') {
            const str = String(cell).replace(/["']/g, '').trim();
            return str.toLowerCase().includes('object') && str.includes('[') ? '' : str;
          }
          if (cell instanceof Date) {
            return isNaN(cell.getTime()) ? '' : getISTDateString(cell);
          }
          if (typeof cell === 'object') {
            const obj = cell as Record<string, any>;
            if (Array.isArray(obj.richText)) {
              const res = obj.richText
                .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
                .join('')
                .replace(/["']/g, '')
                .trim();
              return res.toLowerCase().includes('[object object]') ? '' : res;
            }
            if (typeof obj.w === 'string' || typeof obj.w === 'number') {
              const res = String(obj.w).replace(/["']/g, '').trim();
              return res.toLowerCase().includes('[object object]') ? '' : res;
            }
            if (typeof obj.v === 'string' || typeof obj.v === 'number') {
              const res = String(obj.v).replace(/["']/g, '').trim();
              return res.toLowerCase().includes('[object object]') ? '' : res;
            }
            if (typeof obj.text === 'string' || typeof obj.text === 'number') {
              const res = String(obj.text).replace(/["']/g, '').trim();
              return res.toLowerCase().includes('[object object]') ? '' : res;
            }
            if (obj.formula && (typeof obj.result === 'string' || typeof obj.result === 'number')) {
              const res = String(obj.result).replace(/["']/g, '').trim();
              return res.toLowerCase().includes('[object object]') ? '' : res;
            }
            return '';
          }
          return '';
        };

        const activeStudentsList = studentsRef.current && studentsRef.current.length > 0 ? studentsRef.current : students;
        const knownRollSet = new Set(
          activeStudentsList.map((s) => (s.rollNo || '').trim().toUpperCase()).filter(Boolean)
        );

        let extractedRolls: string[] = [];
        let matchedSheetName = wb.sheetNames[0] || '';

        for (const sheetName of wb.sheetNames) {
          const rows = wb.sheetsByRows[sheetName] || [];
          if (!rows || rows.length === 0) continue;

          // 1. Detect if any header row explicitly names a Roll Number column
          let detectedColIdx = -1;
          let headerRowIdx = -1;
          for (let rIdx = 0; rIdx < Math.min(rows.length, 10); rIdx++) {
            const row = rows[rIdx];
            if (!Array.isArray(row)) continue;
            for (let cIdx = 0; cIdx < row.length; cIdx++) {
              const cellNorm = extractCellText(row[cIdx])
                .toLowerCase()
                .replace(/[\s_.-]/g, '');
              if (rollHeaderKeys.has(cellNorm)) {
                detectedColIdx = cIdx;
                headerRowIdx = rIdx;
                break;
              }
            }
            if (detectedColIdx !== -1) break;
          }

          // 2. If no explicit header was found, score columns by known student roll numbers or alphanumeric roll pattern
          if (detectedColIdx === -1) {
            let bestCol = 0;
            let bestScore = -1;
            const maxCols = rows.reduce((max, r) => (Array.isArray(r) ? Math.max(max, r.length) : max), 0);
            for (let cIdx = 0; cIdx < maxCols; cIdx++) {
              let score = 0;
              for (let rIdx = 0; rIdx < rows.length; rIdx++) {
                const rawVal = extractCellText(rows[rIdx]?.[cIdx]);
                if (!rawVal) continue;
                const upper = rawVal.toUpperCase();
                if (knownRollSet.has(upper)) {
                  score += 5;
                } else if (/^[A-Z0-9/-]{4,20}$/i.test(rawVal) && /\d/.test(rawVal)) {
                  score += 1;
                }
              }
              if (score > bestScore) {
                bestScore = score;
                bestCol = cIdx;
              }
            }
            if (bestScore > 0) {
              detectedColIdx = bestCol;
            }
          }

          if (detectedColIdx !== -1) {
            const candidateRolls: string[] = [];
            // Start at row 0 when no header row was detected so raw CSV/Excel lists never skip row 0 (Bug 124)
            const startRowIdx = headerRowIdx === -1 ? 0 : headerRowIdx + 1;
            for (let rIdx = startRowIdx; rIdx < rows.length; rIdx++) {
              const row = rows[rIdx];
              if (!Array.isArray(row)) continue;
              const cellStr = extractCellText(row[detectedColIdx]);
              if (!cellStr || cellStr === '[object Object]') continue;
              const normKey = cellStr.toLowerCase().replace(/[\s_.-]/g, '');
              const cleanAlpha = cellStr.toLowerCase().replace(/[^a-z0-9]/g, '');
              const hasDigits = /\d/.test(cellStr);
              // Tokens with digits (e.g. SNO-1029, ROLL_42) are student identifiers, not generic column headers (Bug 77)
              const isHeaderLike =
                !hasDigits &&
                (ignoredTokens.has(normKey) ||
                  ignoredTokens.has(cleanAlpha) ||
                  /^(student|candidate|univ|college|exam)?roll(no|num|number|id)?$/.test(cleanAlpha) ||
                  cleanAlpha.includes('rollno') ||
                  cleanAlpha.includes('rollnumber') ||
                  cleanAlpha.includes('studentroll') ||
                  (cleanAlpha.includes('roll') &&
                    (cleanAlpha.includes('no') ||
                      cleanAlpha.includes('num') ||
                      cleanAlpha.includes('student') ||
                      cleanAlpha.includes('cand'))));
              if (!isHeaderLike) {
                candidateRolls.push(cellStr);
              }
            }
            if (candidateRolls.length > 0) {
              extractedRolls = candidateRolls;
              matchedSheetName = sheetName;
              break;
            }
          }
        }

        const unique = Array.from(new Set(extractedRolls.map((r) => String(r || '').trim()).filter(Boolean)));
        setParsedRollNos(unique);
        if (unique.length > 0) {
          setStatusMessage(
            `Successfully parsed ${unique.length} roll number(s) from ${file.name} (Sheet: "${matchedSheetName}").`
          );
          setErrorMessage('');
        } else {
          setStatusMessage('');
          setErrorMessage(`No valid student roll numbers found across worksheets in ${file.name}.`);
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        setErrorMessage('Failed to parse Excel file. Please verify the file is a valid spreadsheet.');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.onerror = () => {
      if (!isMountedRef.current) return;
      setIsProcessing(false);
      setErrorMessage('Failed to read file due to an I/O error or permission issue.');
    };

    reader.onabort = () => {
      if (!isMountedRef.current) return;
      setIsProcessing(false);
      setErrorMessage('File reading was aborted.');
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle Text Paste
  const handleParseText = () => {
    if (!pasteText.trim()) return;
    const items = pasteText
      .replace(/\r/g, '')
      .split(/[\n,;\t]+/)
      .map((s) => s.replace(/["']/g, '').trim())
      .filter((s) => s.length > 0);
    const unique = Array.from(new Set(items));
    setParsedRollNos(unique);
    setStatusMessage(`Parsed ${unique.length} roll number(s) from text input.`);
  };

  // Safe Clipboard Read Helper (Bug 531)
  const handleReadFromClipboard = async (): Promise<void> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setPasteText(text);
          setStatusMessage('Clipboard text pasted into input area.');
          setErrorMessage('');
        }
      }
    } catch {
      setErrorMessage('Clipboard read permission denied by browser. Please press Ctrl+V / Cmd+V in the text box.');
    }
  };

  // Download Sample Template
  const handleDownloadSampleTemplate = () => {
    // Generate template with sample student roll numbers for this stream/course
    const eligibleStudents = students.filter(
      (s) => s.streamCode === selectedStream && s.semester === fromSemester
    );

    const sampleRows =
      eligibleStudents.length > 0
        ? eligibleStudents.map((s) => ({
            'Roll Number': s.rollNo,
            'Student Name': s.name,
            'Current Semester': s.semester,
            'Stream Code': s.streamCode,
          }))
        : [
            { 'Roll Number': '2025CS001', 'Student Name': 'Aarav Kumar', 'Current Semester': fromSemester, 'Stream Code': selectedStream },
            { 'Roll Number': '2025CS002', 'Student Name': 'Priya Sharma', 'Current Semester': fromSemester, 'Stream Code': selectedStream },
            { 'Roll Number': '2025CS003', 'Student Name': 'Rahul Verma', 'Current Semester': fromSemester, 'Stream Code': selectedStream },
          ];

    void exportJsonSheetsToExcelFile(
      [{ sheetName: 'PromotionRolls', rows: sanitizeSpreadsheetData(sampleRows) }],
      `Promotion_Template_${selectedStream}_Sem${fromSemester}_to_Sem${toSemester}.xlsx`
    );
  };

  // Matched students vs Unmatched roll numbers (Bug 266: Prevent re-promotion of already advanced students)
  const matchAnalysis = useMemo(() => {
    const matched: Student[] = [];
    const unmatched: string[] = [];
    const alreadyPromoted: Student[] = [];

    parsedRollNos.forEach((roll) => {
      const targetRoll = (roll || '').trim().toUpperCase();
      if (!targetRoll) return;
      const stu = students.find((s) => {
        const sRoll = (s.rollNo || '').trim().toUpperCase();
        return sRoll !== '' && sRoll === targetRoll;
      });
      if (stu) {
        const isGraduated =
          stu.status === 'graduated' || stu.status === 'alumni' || stu.academicStatus === 'Graduated';
        if (isGraduated) {
          alreadyPromoted.push(stu);
        } else if (stu.semester >= toSemester && toSemester <= maxSemestersForCourse) {
          alreadyPromoted.push(stu);
        } else {
          matched.push(stu);
        }
      } else {
        unmatched.push(roll);
      }
    });

    return { matched, unmatched, alreadyPromoted };
  }, [students, parsedRollNos, toSemester, maxSemestersForCourse]);

  // Check student grades/standing from storage to flag backlogs upfront in preview (Bugs 47, 152)
  const studentBacklogMap = useMemo(() => {
    const map = new Map<string, string[]>();
    try {
      const allGrades = erpStorage.getGrades();
      allGrades.forEach((g) => {
        const letter = String(g.letterGrade || '').trim().toUpperCase();
        if (isGradeBacklog(letter) || (g.totalMarks !== undefined && g.totalMarks < 33)) {
          const key = (g.studentRollNo || '').trim().toUpperCase();
          if (key) {
            const list = map.get(key) || [];
            list.push(`${g.subjectCode || 'Paper'} (Sem ${g.semester})`);
            map.set(key, list);
          }
        }
      });
    } catch {}
    return map;
  }, [students, storageTick]);

  // Execute Promotion (yields to browser paint cycle before running synchronous batch update - Bug 101, Bug 230: Debounce double-clicks)
  const handleExecutePromotion = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage('');
    setIneligibleList([]);

    if (parsedRollNos.length === 0) {
      setErrorMessage('Please upload or paste student roll numbers first.');
      setIsProcessing(false);
      return;
    }

    if (matchAnalysis.matched.length === 0) {
      if (matchAnalysis.alreadyPromoted.length > 0) {
        setErrorMessage(
          `All ${matchAnalysis.alreadyPromoted.length} matched student(s) are already enrolled in Semester ${toSemester} or above, or have completed graduation. Re-promotion prevented.`
        );
      } else {
        setErrorMessage('No enrolled students matched the uploaded roll numbers in the database.');
      }
      setIsProcessing(false);
      return;
    }

    // Validate that candidate students match the selected stream (Bug 49)
    const streamMismatched = matchAnalysis.matched.filter(
      (s) => s.streamCode && s.streamCode.toUpperCase() !== selectedStream.toUpperCase()
    );
    if (streamMismatched.length > 0) {
      setErrorMessage(
        `Stream Mismatch: ${streamMismatched.length} student(s) (e.g. ${streamMismatched[0].rollNo} - ${streamMismatched[0].streamCode}) belong to a different stream than selected (${selectedStream}). Only students in stream ${selectedStream} can be promoted in this batch.`
      );
      setIsProcessing(false);
      return;
    }

    // Hard limit enforcement: Students at or beyond program duration (courseDurationYears * 2)
    // cannot advance to higher semesters and must transition directly to 'graduated' status
    if (fromSemester >= maxSemestersForCourse && toSemester <= maxSemestersForCourse) {
      setErrorMessage(
        `Program Duration Cap: Students in final Semester ${fromSemester} of a ${courseDurationYears}-year program (${maxSemestersForCourse} semesters max) have completed coursework and must transition to 'graduated' status instead of advancing to additional semesters.`
      );
      setIsProcessing(false);
      return;
    }

    if (toSemester > maxSemestersForCourse + 1) {
      setErrorMessage(
        `Hard Limit Enforced: Cannot advance students past program duration (${maxSemestersForCourse} semesters for ${selectedCourse}). Eligible students must transition directly to 'graduated' status.`
      );
      setIsProcessing(false);
      return;
    }

    if (toSemester !== fromSemester + 1) {
      setErrorMessage(
        `Invalid promotion trajectory: Target semester (${toSemester}) must be strictly sequential (${fromSemester + 1}). Skipping or reversing semesters is prohibited.`
      );
      setIsProcessing(false);
      return;
    }

    if (overrideEligibility) {
      if (currentUser.role !== 'principal') {
        setErrorMessage('Security Violation: Only an authenticated Principal can authorize an eligibility override.');
        setIsProcessing(false);
        return;
      }
      if (overrideReason.trim().length < 10) {
        setErrorMessage('Override justification must be at least 10 characters long when Principal eligibility override is active.');
        setIsProcessing(false);
        return;
      }
    }

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      })
    );
    if (!isMountedRef.current) return;
    try {
      const matchedRolls = matchAnalysis.matched.map((s) => s.rollNo);
      const res = onPromoteStudents(
        selectedStream,
        selectedCourse,
        fromSemester,
        toSemester,
        matchedRolls,
        `${currentUser.name} (${currentUser.role})`,
        selectedSubject,
        overrideEligibility
          ? { overrideEligibility: true, overrideReason: overrideReason.trim() }
          : undefined
      );

      const promotedCount = res.record.promotedCount;
      const ineligibles = res.record.ineligibleStudents || [];
      setIneligibleList(ineligibles);

      if (promotedCount > 0) {
        try {
          const prefersReduced =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (isMountedRef.current && !prefersReduced && typeof confetti === 'function') {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { x: 0.5, y: 0.4 },
              zIndex: 99999,
            });
          }
        } catch {}
      }

      const isGraduationTransition = toSemester > maxSemestersForCourse || fromSemester >= maxSemestersForCourse;
      const targetLabel = isGraduationTransition ? 'Graduated Status' : `Semester ${toSemester}`;
      if (ineligibles.length > 0) {
        setStatusMessage(
          `Promotion Processed: ${promotedCount} eligible student(s) advanced from Semester ${fromSemester} to ${targetLabel}. ${ineligibles.length} student(s) were retained due to backlog / eligibility criteria.`
        );
      } else {
        setStatusMessage(
          `Promotion Success: All ${promotedCount} student(s) successfully ${isGraduationTransition ? 'transitioned to Graduated status' : `advanced from Semester ${fromSemester} to Semester ${toSemester}`}.`
        );
      }

      setParsedRollNos([]);
      setPasteText('');
      setUploadedFileName('');
      setOverrideEligibility(false);
      setOverrideReason('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to complete batch promotion.';
      setErrorMessage(`Promotion could not be completed: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderCandidateOutcomeBadge = (backlogs: string[] | undefined, currentSem: number, targetSem: number): React.ReactNode => {
    const isGraduating = targetSem > maxSemestersForCourse || currentSem >= maxSemestersForCourse;
    if (isGraduating && backlogs && backlogs.length > 0) {
      return (
        <span className="font-bold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-300">
          Graduation Blocked (Backlogs)
        </span>
      );
    }
    if (backlogs && backlogs.length > 2) {
      return (
        <span className="font-bold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-300">
          Retained (Sem {currentSem})
        </span>
      );
    }
    if (backlogs && backlogs.length > 0) {
      return (
        <span className="font-bold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-300">
          Conditional (Sem {targetSem})
        </span>
      );
    }
    return (
      <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
        {isGraduating ? 'Graduated' : `Sem ${targetSem}`}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
                <GraduationCap className="w-6 h-6" />
              </span>
              <span className="text-xs uppercase font-mono tracking-widest text-emerald-300 font-bold">
                Academic Advancement Engine
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Student Semester & Year Promotion
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Select stream and target semester, upload student roll numbers in Excel or paste directly. Statutory eligibility
              (course, stream, from-semester, and zero CBCS backlogs) is strictly verified before advancement.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSampleTemplate}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shrink-0"
            >
              <Download className="w-4 h-4" />
              Download Excel Template
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {ineligibleList.length > 0 && (
        <div className="p-5 bg-amber-50 border border-amber-300 rounded-3xl text-xs text-amber-950 shadow-sm animate-in fade-in space-y-3">
          <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Retained Students Audit ({ineligibleList.length} Student{ineligibleList.length > 1 ? 's' : ''} Not Promoted)</span>
          </div>
          <p className="text-xs text-amber-800">
            As per statutory CBCS academic promotion regulations, students with course/stream/semester mismatches or semester backlog examinations (Grade F) cannot be advanced to the next semester.
          </p>
          <div className="divide-y divide-amber-200/60 bg-white/70 rounded-2xl border border-amber-200 overflow-hidden">
            {ineligibleList.map((item, idx) => (
              <div key={idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <div>
                  <span className="font-mono font-bold text-slate-900 mr-2">{item.rollNo}</span>
                  {item.name && <span className="font-semibold text-slate-700 mr-2">{item.name}</span>}
                </div>
                <span className="text-xs font-medium text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200 w-fit">
                  {item.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Promotion Scope & Target Selection */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">
            1
          </span>
          Select Academic Stream, Course & Promotion Range
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Academic Stream *</label>
            <select
              value={selectedStream}
              onChange={(e) => {
                setSelectedStream(e.target.value);
                setSelectedSubject('All Stream Subjects');
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {streamOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Subject / Paper *</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="All Stream Subjects">All Stream Subjects / Batch</option>
              {streamSubjects.map((sub) => (
                <option key={sub.id} value={`${sub.subjectCode} - ${sub.subjectName}`}>
                  {sub.subjectCode}: {sub.subjectName} (Sem {sub.semester})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Degree Programme *</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {courseOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Current Semester (Source) *
              <span className="ml-1 text-xs font-normal text-slate-500">
                ({courseDurationYears}-Year Degree • Max Sem {maxSemestersForCourse})
              </span>
            </label>
            <select
              value={fromSemester}
              onChange={(e) => {
                const f = Number(e.target.value);
                setFromSemester(f);
                setToSemester(f >= maxSemestersForCourse ? maxSemestersForCourse + 1 : f + 1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {Array.from({ length: maxSemestersForCourse }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  Semester {s} {s === maxSemestersForCourse ? `(Final Semester - ${courseDurationYears}-Yr Degree Cap)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Semester (Sequential Promotion) *</label>
            <select
              value={toSemester}
              onChange={(e) => setToSemester(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-emerald-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {fromSemester >= maxSemestersForCourse ? (
                <option value={maxSemestersForCourse + 1}>
                  Graduated / Alumni (Degree Completed)
                </option>
              ) : (
                <option value={fromSemester + 1}>
                  {fromSemester + 1 > maxSemestersForCourse
                    ? 'Graduated / Alumni (Degree Completed)'
                    : `Semester ${fromSemester + 1} (Next Sequential Semester)`}
                </option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Step 2: Upload Excel File or Paste Roll Numbers */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">
              2
            </span>
            Provide Student Roll Numbers
          </h3>

          {/* Toggle between Excel Upload and Text Paste */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setInputMode('excel')}
              className={`px-3 py-1 rounded-lg transition ${
                inputMode === 'excel' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" />
              Upload Excel Sheet
            </button>
            <button
              onClick={() => setInputMode('paste')}
              className={`px-3 py-1 rounded-lg transition ${
                inputMode === 'paste' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              Paste Roll Numbers
            </button>
          </div>
        </div>

        {inputMode === 'excel' ? (
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 sm:p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition">
            <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <p className="font-bold text-slate-900 text-sm">Upload Excel Spreadsheet (.xlsx, .xls, .csv)</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              First column must contain the candidate Roll Numbers. Additional columns like Name, Batch are optional.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="promotion-file-upload"
            />
            <div className="mt-4 flex items-center justify-center gap-3">
              <label
                htmlFor="promotion-file-upload"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow"
              >
                <Upload className="w-4 h-4" />
                Select File
              </label>
              {uploadedFileName && (
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  📄 {uploadedFileName} ({parsedRollNos.length} rolls)
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              rows={4}
              placeholder="Paste roll numbers separated by newline or comma... (e.g. 2025CS001, 2025CS002, 2025CS003)"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleParseText}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
              >
                Parse Roll Numbers
              </button>
              <button
                type="button"
                onClick={handleReadFromClipboard}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border border-slate-300"
              >
                Paste from Clipboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Match Verification & Execution */}
      {parsedRollNos.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">
                  3
                </span>
                Verification & Promotion Execution
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {matchAnalysis.matched.length} roll number(s) matched in database • {matchAnalysis.unmatched.length} unmatched
              </p>
            </div>

            <button
              disabled={isProcessing || matchAnalysis.matched.length === 0}
              onClick={handleExecutePromotion}
              title={
                matchAnalysis.matched.length === 0
                  ? 'Upload a valid roster or paste student roll numbers above to evaluate promotion cohort'
                  : undefined
              }
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:hover:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-md shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'Promoting...'
                  : (toSemester > maxSemestersForCourse || fromSemester >= maxSemestersForCourse)
                  ? `Graduate ${matchAnalysis.matched.length} Student(s) (Degree Completed)`
                  : `Promote ${matchAnalysis.matched.length} Student(s) to Semester ${toSemester}`}
              </span>
            </button>
          </div>

          {/* Principal-Only Eligibility Override Controls */}
          {currentUser.role === 'principal' && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer font-bold text-amber-950">
                <input
                  type="checkbox"
                  checked={overrideEligibility}
                  onChange={(e) => setOverrideEligibility(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>
                  Principal Override: Allow promotion for students with attendance shortfall, unpaid dues, or undeclared results (backlogs, missing grades, and inactive statuses remain strictly blocked).
                </span>
              </label>
              {overrideEligibility && (
                <div>
                  <label className="block font-bold text-amber-900 mb-1">
                    Written Principal Override Reason (Minimum 10 characters, recorded in audit log) *
                  </label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Approved by Academic Council pending scholarship disbursement"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Unmatched Notice */}
          {matchAnalysis.unmatched.length > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {matchAnalysis.unmatched.length} roll number(s) were not found in ERP: {matchAnalysis.unmatched.join(', ')}
              </span>
            </div>
          )}

          {/* Matched Students Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5">Roll Number</th>
                  <th className="px-4 py-2.5">Student Name</th>
                  <th className="px-4 py-2.5">Course</th>
                  <th className="px-4 py-2.5 text-center">Current Semester</th>
                  <th className="px-4 py-2.5 text-center">New Status / Semester</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {matchAnalysis.matched.map((stu) => {
                  const normRoll = (stu.rollNo || '').trim().toUpperCase();
                  const backlogs = studentBacklogMap.get(normRoll);
                  const isGraduating = toSemester > maxSemestersForCourse || stu.semester >= maxSemestersForCourse;
                  return (
                    <tr key={stu.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{stu.rollNo}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {stu.name}
                        {backlogs && backlogs.length > 0 && (
                          <span className="block text-xs text-amber-700 font-normal">
                            {isGraduating
                              ? `⛔ Final-semester graduation blocked (${backlogs.length} backlog paper(s)): [${backlogs.join(', ')}]`
                              : backlogs.length <= 2
                              ? `⚠️ Supplementary paper pending: ${backlogs.join(', ')} (Conditional Promotion Allowed)`
                              : `⛔ Backlog ceiling exceeded (${backlogs.length} papers): [${backlogs.join(', ')}] (Retained)`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 truncate max-w-xs">{stu.course}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-slate-500">Sem {stu.semester}</td>
                      <td className="px-4 py-2.5 text-center">
                        {renderCandidateOutcomeBadge(backlogs, stu.semester, toSemester)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Promotion Audit Log */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-sm text-slate-900">Institutional Promotion Audit Trail</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {promotionAuditRecords.length} Historical Promotion Batches
          </span>
        </div>

        {promotionAuditRecords.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-xl">
            No promotion batches executed yet.
          </p>
        ) : (
          <div className="space-y-3">
            {promotionAuditRecords.map((aud) => (
              <div
                key={aud.id}
                className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs">
                      {aud.streamCode}
                    </span>
                    <strong className="text-slate-900">
                      Promoted Sem {aud.fromSemester} &rarr;{' '}
                      {aud.toSemester > getMaxSemestersForCourse(aud.course)
                        ? 'Graduated (Degree Completed)'
                        : `Sem ${aud.toSemester}`}
                    </strong>
                    <span className="text-slate-400 font-mono text-xs">• {aud.promotedAt}</span>
                  </div>
                  <p className="text-slate-600 font-sans">
                    Course: {aud.course} • Promoted By: <span className="font-semibold">{aud.promotedBy}</span>
                  </p>
                </div>

                <div className="text-right shrink-0 flex items-center gap-2">
                  {aud.revertedAt ? (
                    <span className="px-2.5 py-1 bg-amber-50 font-mono font-bold text-amber-800 rounded-xl border border-amber-200 text-xs">
                      Reverted ({aud.revertedAt})
                    </span>
                  ) : (
                    (currentUser.role === 'superadmin' || currentUser.role === 'principal') && (
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            if (onRevertPromotionRecord) {
                              onRevertPromotionRecord(aud.id);
                            } else {
                              erpStorage.revertPromotionRecord(aud.id, currentUser.role);
                            }
                            setStatusMessage(`Reverted promotion batch ${aud.id} (${aud.promotedCount} student(s) restored to Sem ${aud.fromSemester}).`);
                            setErrorMessage('');
                          } catch (err: unknown) {
                            setErrorMessage(err instanceof Error ? err.message : 'Unable to revert promotion batch.');
                          }
                        }}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 text-xs transition"
                        title="Rollback this promotion batch and restore previous student semesters"
                      >
                        Rollback Batch
                      </button>
                    )
                  )}
                  <span className="px-3 py-1 bg-white font-mono font-bold text-emerald-700 rounded-xl border border-slate-200 shadow-sm">
                    {aud.promotedCount} Students Promoted
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
