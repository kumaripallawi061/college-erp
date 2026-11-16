import React, { useState, useMemo, useEffect } from 'react';
import { Student, ExamGradeRecord } from '../../types/erp';
import { calculateSGPA, calculateGradePoint, getISTDateString, classifyDegreeDivision } from '../../utils/erpLogic';
import { X, Printer, Award, ShieldCheck, Calendar, BookOpen, Layers, Lock, AlertTriangle } from 'lucide-react';

import { erpStorage } from '../../services/erpStorage';

interface PrintableMarksheetProps {
  student: Student | null;
  grades: ExamGradeRecord[];
  isOpen: boolean;
  onClose: () => void;
}

export interface MarksheetDocumentProps {
  student: Student;
  grades: ExamGradeRecord[];
  selectedSemester: number;
}

export const MarksheetDocument: React.FC<MarksheetDocumentProps> = ({
  student,
  grades,
  selectedSemester,
}) => {
  const [storageTick, setStorageTick] = useState(0);
  useEffect(() => {
    const unsubscribe = erpStorage.subscribe(() => setStorageTick((t) => t + 1));
    return () => unsubscribe();
  }, []);

  // Dynamically load Marksheet Configuration and Course & Stream Mapping from ERP Storage
  const config = useMemo(() => erpStorage.getMarksheetConfig(), [storageTick]);
  const allStreamSubjects = useMemo(() => erpStorage.getStreamCourseSubjects(), [storageTick]);

  // Semester Exam Session label
  const sessionLabel = useMemo(() => {
    switch (selectedSemester) {
      case 5:
        return 'Autumn Semester 2026 (Semester 5 - Current)';
      case 4:
        return 'Spring Semester 2026 (Semester 4 - Previous Year)';
      case 3:
        return 'Autumn Semester 2025 (Semester 3 - Previous Year)';
      case 2:
        return 'Spring Semester 2025 (Semester 2 - Previous Year)';
      case 1:
        return 'Autumn Semester 2024 (Semester 1 - Previous Year)';
      default:
        return `Semester ${selectedSemester} Examination Session`;
    }
  }, [selectedSemester]);

  // Displayed course grades for selected semester (strictly from published evaluations/grades, never fabricated)
  const displayedGrades = useMemo(() => {
    if (!student) return [];

    const allStudentEvals = erpStorage.getStudentExamEvaluations();
    const allExamTypes = erpStorage.getExamTypes();
    const allExamHeads = erpStorage.getExamEvaluationHeads();
    const marksheetExamIds = new Set(
      allExamTypes.filter((e) => e.showInStudentMarksheet).map((e) => e.id)
    );

    const buildRowFromEvaluation = (
      evalMatch: ReturnType<typeof erpStorage.getStudentExamEvaluations>[number],
      subjectCode: string,
      subjectName: string,
      credits: number
    ): ExamGradeRecord => {
      const headMap = evalMatch.headScores || evalMatch.headValues || {};
      const examMarksHeads = allExamHeads
        .filter((h) => h.examTypeId === evalMatch.examTypeId && h.format === 'marks')
        .sort((a, b) => a.sequence - b.sequence);

      let internalScore = 0;
      let maxInternalMarks = 0;
      let externalScore = 0;
      let maxExternalMarks = 0;

      if (examMarksHeads.length > 0) {
        examMarksHeads.forEach((h, idx) => {
          const label = `${h.id} ${h.name}`.toLowerCase();
          const isInternal =
            /internal|sessional|practical|lab|assignment|viva|quiz|attendance/.test(label) ||
            (!/theory|external|end.?sem|written|annual/.test(label) && idx > 0);
          const rawScore = Number(headMap[h.id] ?? 0);
          const safeScore = Number.isNaN(rawScore) ? 0 : rawScore;
          if (isInternal) {
            internalScore += safeScore;
            maxInternalMarks += h.maxMarks;
          } else {
            externalScore += safeScore;
            maxExternalMarks += h.maxMarks;
          }
        });
      } else {
        const totalMarksVal = evalMatch.totalMarksObtained ?? evalMatch.totalMarks ?? 0;
        const maxMarksVal = evalMatch.maxPossibleMarks ?? evalMatch.maxMarks ?? 100;
        const rawInternal = headMap['HEAD-ANNUAL-02'] ?? headMap['HEAD-INTERNAL-DEF'];
        internalScore = rawInternal !== undefined ? Number(rawInternal) || 0 : 0;
        externalScore = Math.max(0, totalMarksVal - internalScore);
        maxInternalMarks = rawInternal !== undefined ? 30 : 0;
        maxExternalMarks = Math.max(0, maxMarksVal - maxInternalMarks);
      }

      const totalMarks = evalMatch.totalMarksObtained ?? evalMatch.totalMarks ?? internalScore + externalScore;
      const maxMarks = evalMatch.maxPossibleMarks ?? evalMatch.maxMarks ?? (maxInternalMarks + maxExternalMarks || 100);
      const gradeInfo = calculateGradePoint(totalMarks, maxMarks, config.gradingScaleRules);

      return {
        id: evalMatch.id,
        studentId: student.id,
        studentRollNo: student.rollNo,
        studentName: student.name,
        course: student.course,
        semester: selectedSemester,
        subjectCode,
        subjectName: subjectName || evalMatch.subjectName,
        credits,
        internalMarks: Math.round((internalScore + Number.EPSILON) * 100) / 100,
        maxInternalMarks: maxInternalMarks || 30,
        externalMarks: Math.round((externalScore + Number.EPSILON) * 100) / 100,
        maxExternalMarks: maxExternalMarks || Math.max(0, maxMarks - (maxInternalMarks || 30)),
        totalMarks,
        maxMarks,
        letterGrade: gradeInfo.letter as ExamGradeRecord['letterGrade'],
        gradePoint: gradeInfo.gradePoint,
        status: 'Published' as const,
        examSession: sessionLabel,
        evaluationDate: config.publishDate || getISTDateString(),
      };
    };

    const mappedForSem = allStreamSubjects.filter(
      (s) => (s.streamCode === student.streamCode || !s.streamCode) && s.semester === selectedSemester
    );

    if (mappedForSem.length > 0) {
      const mappedRows = mappedForSem
        .map((sub) => {
          const evalMatch = allStudentEvals.find(
            (e) =>
              (e.studentId === student.id ||
                (e.studentRollNo && e.studentRollNo.trim().toLowerCase() === student.rollNo.trim().toLowerCase())) &&
              e.subjectCode.toUpperCase() === sub.subjectCode.toUpperCase() &&
              e.semester === selectedSemester &&
              marksheetExamIds.has(e.examTypeId) &&
              e.status === 'Approved_Published'
          );

          if (evalMatch) {
            return buildRowFromEvaluation(evalMatch, sub.subjectCode, sub.subjectName, sub.credits);
          }

          const match = grades.find(
            (g) =>
              g.studentId === student.id &&
              g.subjectCode.toUpperCase() === sub.subjectCode.toUpperCase() &&
              g.semester === selectedSemester &&
              g.status === 'Published'
          );

          if (match) {
            return {
              ...match,
              credits: sub.credits || match.credits,
              subjectName: sub.subjectName || match.subjectName,
            };
          }

          return null;
        })
        .filter((row): row is ExamGradeRecord => row !== null);

      const mappedCodes = new Set(mappedForSem.map((s) => s.subjectCode.toUpperCase()));
      const unmappedGrades = grades.filter(
        (g) =>
          g.studentId === student.id &&
          g.semester === selectedSemester &&
          g.status === 'Published' &&
          !mappedCodes.has(g.subjectCode.toUpperCase())
      );

      return [...mappedRows, ...unmappedGrades];
    }

    const publishedSemGrades = grades.filter(
      (g) => g.studentId === student.id && g.semester === selectedSemester && g.status === 'Published'
    );
    if (publishedSemGrades.length > 0) return publishedSemGrades;

    const approvedEvals = allStudentEvals.filter(
      (e) =>
        (e.studentId === student.id ||
          (e.studentRollNo && e.studentRollNo.trim().toLowerCase() === student.rollNo.trim().toLowerCase())) &&
        e.semester === selectedSemester &&
        marksheetExamIds.has(e.examTypeId) &&
        e.status === 'Approved_Published'
    );
    return approvedEvals.map((e) => buildRowFromEvaluation(e, e.subjectCode, e.subjectName, 4));
  }, [student, grades, selectedSemester, sessionLabel, allStreamSubjects, config.publishDate, config.gradingScaleRules, storageTick]);

  // Compute SGPA for displayed semester using institutional grading scale rules
  const sgpaResult = useMemo(() => {
    return calculateSGPA(
      displayedGrades.map((g) => ({
        courseCode: g.subjectCode,
        credits: g.credits,
        marksObtained: g.totalMarks,
        maxMarks: g.maxMarks,
      })),
      config.gradingScaleRules
    );
  }, [displayedGrades, config.gradingScaleRules]);

  const getDivision = (sgpa: number, allPassed: boolean) => {
    return classifyDegreeDivision(sgpa, 'cgpa', !allPassed, config.degreeDivisionRules);
  };

  // Check official result declaration date set by Principal / Accountant
  const resultDeclarations = useMemo(() => erpStorage.getResultDeclarations(), [storageTick]);
  const activeDeclaration = useMemo(() => {
    return (
      resultDeclarations.find(
        (d) => d.semester === selectedSemester && (d.course === student.course || d.course === 'All Courses')
      ) || resultDeclarations.find((d) => d.semester === selectedSemester)
    );
  }, [resultDeclarations, selectedSemester, student.course]);

  const todayStr = getISTDateString();

  // A semester result is declared & published if:
  // 1. If an active declaration exists, check explicit isPublished / status and declarationDate
  // 2. If no declaration exists, only earlier completed semesters (< student.semester) are considered declared
  // 3. If student has specific grade records for this semester, verify they are not all draft
  const isResultDeclared = useMemo(() => {
    if (activeDeclaration) {
      if (activeDeclaration.status === 'Embargoed') {
        return false;
      }
      if (activeDeclaration.isPublished === true || activeDeclaration.status === 'Published') {
        return true;
      }
      if (activeDeclaration.isPublished === false) {
        return false;
      }
      if (todayStr < activeDeclaration.declarationDate) {
        return false;
      }
    } else {
      // If no declaration record configured, only earlier completed semesters are considered declared
      if (selectedSemester >= student.semester) {
        return false;
      }
    }

    // Check if faculty has kept grades in Draft for this semester
    const semStudentGrades = grades.filter(
      (g) => g.studentId === student.id && g.semester === selectedSemester
    );
    if (semStudentGrades.length > 0) {
      const allDraft = semStudentGrades.every((g) => g.status === 'Draft');
      if (allDraft) return false;
    }

    return true;
  }, [activeDeclaration, todayStr, selectedSemester, student.semester, grades, student.id]);

  return (
    <div className="p-6 sm:p-10 space-y-6 text-slate-900 font-sans print:p-0 overflow-y-auto flex-1">
      {/* Institutional Header with Coat of Arms Styling */}
      <div className="text-center border-b-2 border-slate-900 pb-4">
        <h1 className="font-sans font-black text-xl sm:text-2xl uppercase tracking-tight text-slate-950">
          {config.institutionName || 'Ram Lakhan Singh Yadav College'}
        </h1>
        <p className="text-xs uppercase font-bold text-slate-700 tracking-wider mt-0.5">
          {config.autonomousTag || 'An Autonomous Constituent Institution • UGC Choice Based Credit System (CBCS)'}
        </p>
        <p className="text-xs text-slate-500">
          {config.address} • {config.naacGrade}
        </p>

        <div className="mt-3 inline-flex items-center gap-2 px-5 py-1.5 bg-slate-100 rounded-lg border border-slate-300 text-xs font-black uppercase tracking-wider text-slate-900 font-sans">
          <span>OFFICIAL STATEMENT OF GRADES • SEMESTER {selectedSemester}</span>
          {selectedSemester !== student.semester && (
            <span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-800 font-mono">
              ARCHIVAL RECORD
            </span>
          )}
        </div>
      </div>

      {/* Student Particulars Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
        <div>
          <span className="text-slate-500 block text-xs uppercase font-bold">Candidate Name</span>
          <strong className="text-slate-900 text-sm block">{student.name}</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-xs uppercase font-bold">University Roll No</span>
          <strong className="font-mono text-slate-900 text-sm block">{student.rollNo}</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-xs uppercase font-bold">Registration No</span>
          <span className="font-mono text-slate-800 text-xs block">{student.registerNo}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-xs uppercase font-bold">Date of Publication</span>
          <span className="font-bold text-indigo-900 text-xs block">{config.publishDate || sessionLabel}</span>
        </div>
      </div>

      {/* Academic Programme & Batch */}
      <div className="text-xs text-slate-700 flex flex-wrap justify-between items-center px-1 border-b border-slate-200 pb-2">
        <span>
          <strong>Degree Programme:</strong> {student.course}
        </span>
        <span>
          <strong>Academic Batch:</strong> {student.batchYear} • <strong>Stream:</strong> {student.streamCode}
        </span>
      </div>

      {/* RESULT NOT DECLARED CHECK: Display message when result is not published / declared */}
      {!isResultDeclared ? (
        <div className="py-12 px-6 sm:px-10 text-center space-y-6 bg-amber-50/60 rounded-3xl border-2 border-dashed border-amber-300 my-6 shadow-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto text-amber-800 shadow-sm border border-amber-300">
            <Lock className="w-8 h-8 text-amber-700" />
          </div>

          <div className="max-w-xl mx-auto space-y-2">
            <span className="px-3.5 py-1 bg-amber-100 text-amber-900 text-xs font-black uppercase tracking-wider rounded-full border border-amber-300 font-mono inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              Result Not Declared
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans tracking-tight">
              Result Not Declared
            </h2>
            <p className="text-sm font-semibold text-slate-700">
              Semester {selectedSemester} examination results have not been declared or published yet.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed max-w-lg mx-auto">
              In accordance with Autonomous Examination Directorate statutes, semester marksheet transcripts, credit points, and SGPA certifications are made available only after the official result is declared.
            </p>
          </div>

          {activeDeclaration ? (
            <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm max-w-md mx-auto space-y-3">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-wider block font-mono">
                Official Result Declaration Schedule
              </span>
              <div className="text-3xl font-black text-indigo-700 font-mono">
                {activeDeclaration.declarationDate}
              </div>
              <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 space-y-1">
                <div className="flex justify-between">
                  <span>Scheduled By:</span>
                  <strong className="text-slate-900 font-bold">{activeDeclaration.declaredByName}</strong>
                </div>
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>Authority:</span>
                  <strong className="capitalize text-slate-700">{activeDeclaration.declaredByRole}</strong>
                </div>
                {activeDeclaration.remarks && (
                  <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2 mt-2 border border-amber-200/60 font-sans text-left">
                    <strong>Note:</strong> {activeDeclaration.remarks}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 max-w-md mx-auto text-xs text-slate-600">
              <p>The examination cell has not yet announced a declaration schedule for Semester {selectedSemester}. Please select a previously declared semester from the dropdown to view archival marksheets.</p>
            </div>
          )}

          <div className="pt-2">
            <p className="text-xs text-slate-500 italic">
              Marksheet transcripts, credit summaries, and SGPA certifications will automatically become available once the result is officially declared.
            </p>
          </div>
        </div>
      ) : displayedGrades.length === 0 ? (
        <div className="py-10 px-6 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 space-y-2">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            No Published Grade Records Found for Semester {selectedSemester}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No approved examination evaluations or published subject marksheets are currently on record for this semester.
          </p>
        </div>
      ) : (
        <>
          {/* Course Grades Table */}
      <div className="border-2 border-slate-300 rounded-2xl overflow-hidden text-xs shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 text-slate-900 uppercase font-black text-xs border-b-2 border-slate-300">
            <tr>
              <th className="px-3.5 py-3">Paper Code</th>
              <th className="px-3.5 py-3">Subject / Paper Title</th>
              <th className="px-3.5 py-3 text-center">Credits</th>
              <th className="px-3.5 py-3 text-center">
                Int ({displayedGrades[0]?.maxInternalMarks ?? 30})
              </th>
              <th className="px-3.5 py-3 text-center">
                Ext ({displayedGrades[0]?.maxExternalMarks ?? 70})
              </th>
              <th className="px-3.5 py-3 text-center">
                Total ({displayedGrades[0]?.maxMarks ?? 100})
              </th>
              <th className="px-3.5 py-3 text-center">Letter Grade</th>
              <th className="px-3.5 py-3 text-center">Grade Point</th>
              <th className="px-3.5 py-3 text-right">Credit Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {displayedGrades.map((g) => {
              const creditPoints = g.credits * g.gradePoint;
              return (
                <tr key={g.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-3.5 py-3 font-mono font-bold text-slate-900">{g.subjectCode}</td>
                  <td className="px-3.5 py-3 font-medium text-slate-900">{g.subjectName}</td>
                  <td className="px-3.5 py-3 text-center font-bold text-slate-800">{g.credits}</td>
                  <td className="px-3.5 py-3 text-center font-mono">{g.internalMarks}</td>
                  <td className="px-3.5 py-3 text-center font-mono">{g.externalMarks}</td>
                  <td className="px-3.5 py-3 text-center font-mono font-black text-slate-950">
                    {g.totalMarks}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    <span
                      className={`font-black font-mono text-xs px-2 py-0.5 rounded ${
                        g.letterGrade === 'F'
                          ? 'bg-rose-100 text-rose-700 border border-rose-300'
                          : 'bg-slate-100 text-slate-900'
                      }`}
                    >
                      {g.letterGrade}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-center font-mono font-bold">{g.gradePoint}</td>
                  <td className="px-3.5 py-3 text-right font-mono font-black text-indigo-950">
                    {creditPoints}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* SGPA & Cumulative Performance Summary Card */}
      <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-300 text-xs shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center items-center">
          <div>
            <span className="text-xs uppercase font-bold text-slate-500 block">Total Course Credits</span>
            <span className="text-xl font-black text-slate-900">{sgpaResult.totalCredits}</span>
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-slate-500 block">Credits Earned</span>
            <span className="text-xl font-black text-emerald-600">{sgpaResult.earnedCredits}</span>
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-slate-500 block">Semester SGPA</span>
            <span className="text-3xl font-black text-indigo-700 font-mono">
              {sgpaResult.sgpa.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 block font-mono">Scale 10.00</span>
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-slate-500 block">Class Classification</span>
            <span
              className={`inline-block mt-1 font-bold text-xs px-3 py-1 rounded-full ${
                sgpaResult.allPassed
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              {getDivision(sgpaResult.sgpa, sgpaResult.allPassed)}
            </span>
          </div>
        </div>
      </div>

      {/* UGC CBCS Grading Scale Key */}
      <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
        <strong>UGC CBCS Scale Matrix: </strong>
        {config.scaleMatrixDescription || 'O (Outstanding, 10) • A+ (Excellent, 9) • A (Very Good, 8) • B+ (Good, 7) • B (Above Average, 6) • C (Average, 5) • P (Pass, 4) • F (Fail/Backlog, 0).'}
      </div>

      {/* Signatures & Exam Cell Seal */}
      <div className="pt-8 border-t-2 border-slate-900 flex justify-between items-end text-xs">
        <div>
          <p className="text-xs text-slate-500 font-mono">Date of Verification: {config.publishDate || '21st October 2026'}</p>
          <p className="text-xs text-slate-500 font-mono">{config.verifiedByText || 'System Generated Document • Autonomous Exam Cell'}</p>
        </div>
        <div className="text-center">
          <div className="w-24 h-24 border-2 border-dashed border-amber-500 rounded-full flex flex-col items-center justify-center mx-auto text-xs font-mono text-amber-900 font-bold bg-amber-50/30">
            <span className="text-center leading-tight whitespace-pre-line px-1">{config.examCellSealText || '★ RLSY COLLEGE ★\nEXAMINATION\nCELL SEAL'}</span>
          </div>
        </div>
        <div className="text-right space-y-1">
          <div className="w-36 h-0.5 bg-slate-900 ml-auto mb-1" />
          <p className="font-bold text-slate-950">{config.controllerName || 'Dr. K. N. Sinha'}</p>
          <p className="text-xs text-slate-600 font-medium">{config.controllerDesignation || 'Controller of Examinations'}</p>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export const PrintableMarksheet: React.FC<PrintableMarksheetProps> = ({
  student,
  grades,
  isOpen,
  onClose,
}) => {
  // Semester selector state defaulting to current student semester & synced on student change
  const [selectedSemester, setSelectedSemester] = useState<number>(student?.semester || 5);
  useEffect(() => {
    if (student?.semester) {
      setSelectedSemester(student.semester);
    }
  }, [student?.id, student?.semester]);

  // Available semesters: 1 up to current student semester (or max 8)
  const availableSemesters = useMemo(() => {
    const currentSem = student?.semester || 5;
    const list: number[] = [];
    for (let i = 1; i <= currentSem; i++) {
      list.push(i);
    }
    return list;
  }, [student?.semester]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      {/* Properly Wrapped Frame Container */}
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border-2 border-slate-300 overflow-hidden my-4 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Top Control Toolbar (Hidden when printing) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs tracking-wide uppercase block">
                Official CBCS Grade Transcript Frame
              </span>
              <span className="text-xs text-slate-400">
                Ram Lakhan Singh Yadav College • Exam Cell
              </span>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Semester Dropdown with all completed semesters */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <label htmlFor="marksheet-sem-select" className="text-xs font-semibold text-slate-300">
                Semester:
              </label>
              <select
                id="marksheet-sem-select"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(Number(e.target.value))}
                className="bg-slate-900 text-xs font-bold text-amber-300 border border-slate-700 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
              >
                {availableSemesters.map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem} {sem === student.semester ? '(Current)' : '(Previous Year)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm text-white"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Marksheet</span>
            </button>

            {/* Prominent Cross Button to Close Frame */}
            <button
              onClick={onClose}
              aria-label="Close Marksheet Frame"
              className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition flex items-center justify-center border border-slate-700 hover:border-rose-500"
              title="Close Marksheet Frame"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Marksheet Paper Body */}
        <MarksheetDocument
          student={student}
          grades={grades}
          selectedSemester={selectedSemester}
        />
      </div>
    </div>
  );
};

