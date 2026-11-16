import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MarksheetConfig, StreamCourseSubject, UserAccount, GradingScaleRule, DegreeDivisionRule } from '../../types/erp';
import { calculateGradePoint, DEFAULT_UGC_GRADING_SCALE, DEFAULT_DEGREE_DIVISION_RULES, classifyDegreeDivision } from '../../utils/erpLogic';
import {
  Award,
  Save,
  CheckCircle2,
  Eye,
  Printer,
  Sliders,
  RotateCcw,
  Plus,
  Trash2,
} from 'lucide-react';

/**
 * Custom high-precision rounding utility using Number.EPSILON to replace floating-point
 * .toFixed(2) precision loss (e.g. IEEE-754 issues with values like 1.005 rounding to 1.00).
 * Strictly formats numbers to exactly 2 decimal places with zero-padding.
 */
export const roundWithEpsilon = (value: number, decimals: number = 2): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return '0.00';
  }
  const factor = Math.pow(10, decimals);
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  const parts = rounded.toString().split('.');
  const integerPart = parts[0] || '0';
  const decimalPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
  return `${integerPart}.${decimalPart}`;
};

interface MarksheetDesignerModuleProps {
  marksheetConfig: MarksheetConfig;
  onSaveMarksheetConfig: (config: MarksheetConfig) => void;
  streamCourseSubjects: StreamCourseSubject[];
  currentUser: UserAccount;
}

export const MarksheetDesignerModule: React.FC<MarksheetDesignerModuleProps> = ({
  marksheetConfig,
  onSaveMarksheetConfig,
  streamCourseSubjects,
  currentUser,
}) => {
  // Form State
  const [institutionName, setInstitutionName] = useState(marksheetConfig.institutionName);
  const [autonomousTag, setAutonomousTag] = useState(marksheetConfig.autonomousTag);
  const [address, setAddress] = useState(marksheetConfig.address);
  const [naacGrade, setNaacGrade] = useState(marksheetConfig.naacGrade);
  const [controllerName, setControllerName] = useState(marksheetConfig.controllerName);
  const [controllerDesignation, setControllerDesignation] = useState(marksheetConfig.controllerDesignation);
  const [publishDate, setPublishDate] = useState(marksheetConfig.publishDate);
  const [scaleMatrixDescription, setScaleMatrixDescription] = useState(marksheetConfig.scaleMatrixDescription);
  const [examCellSealText, setExamCellSealText] = useState(marksheetConfig.examCellSealText);
  const [verifiedByText, setVerifiedByText] = useState(marksheetConfig.verifiedByText);
  const [isDuplicateWatermark, setIsDuplicateWatermark] = useState<boolean>(
    Boolean(marksheetConfig.isDuplicateWatermark)
  );

  // UGC CBCS Grading Scale Configuration
  const [gradingRules, setGradingRules] = useState<GradingScaleRule[]>(() => {
    if (marksheetConfig.gradingScaleRules && marksheetConfig.gradingScaleRules.length > 0) {
      return marksheetConfig.gradingScaleRules.map((r) => ({ ...r }));
    }
    return DEFAULT_UGC_GRADING_SCALE.map((r) => ({ ...r }));
  });

  // UGC Autonomous Degree Division Classification Rules
  const [divisionRules, setDivisionRules] = useState<DegreeDivisionRule[]>(() => {
    if (marksheetConfig.degreeDivisionRules && marksheetConfig.degreeDivisionRules.length > 0) {
      return marksheetConfig.degreeDivisionRules.map((r) => ({ ...r }));
    }
    return DEFAULT_DEGREE_DIVISION_RULES.map((r) => ({ ...r }));
  });

  // Synchronize state if external marksheetConfig updates
  useEffect(() => {
    setInstitutionName(marksheetConfig.institutionName);
    setAutonomousTag(marksheetConfig.autonomousTag);
    setAddress(marksheetConfig.address);
    setNaacGrade(marksheetConfig.naacGrade);
    setControllerName(marksheetConfig.controllerName);
    setControllerDesignation(marksheetConfig.controllerDesignation);
    setPublishDate(marksheetConfig.publishDate);
    setScaleMatrixDescription(marksheetConfig.scaleMatrixDescription);
    setExamCellSealText(marksheetConfig.examCellSealText);
    setVerifiedByText(marksheetConfig.verifiedByText);
    setIsDuplicateWatermark(Boolean(marksheetConfig.isDuplicateWatermark));
    if (marksheetConfig.gradingScaleRules && marksheetConfig.gradingScaleRules.length > 0) {
      setGradingRules(marksheetConfig.gradingScaleRules.map((r) => ({ ...r })));
    }
    if (marksheetConfig.degreeDivisionRules && marksheetConfig.degreeDivisionRules.length > 0) {
      setDivisionRules(marksheetConfig.degreeDivisionRules.map((r) => ({ ...r })));
    }
  }, [marksheetConfig]);

  const handleRuleChange = (
    index: number,
    field: 'minPercentage' | 'gradePoint' | 'letter' | 'description',
    value: any
  ) => {
    setGradingRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return { ...r };
        let sanitizedValue: any = value;
        if (field === 'minPercentage') {
          const parsedPct = Number(value);
          sanitizedValue = Number.isNaN(parsedPct) ? 0 : Math.max(0, Math.min(100, parsedPct));
        } else if (field === 'gradePoint') {
          const parsedGP = Number(value);
          sanitizedValue = Number.isNaN(parsedGP) ? 0 : Math.max(0, Math.min(10, parsedGP));
        }
        const nextLetter = field === 'letter' ? String(sanitizedValue) : r.letter;
        const nextGP = field === 'gradePoint' ? Number(sanitizedValue) : r.gradePoint;
        return {
          ...r,
          [field]: sanitizedValue,
          isPassing: nextLetter !== 'F' && nextGP >= 4,
        };
      })
    );
  };

  const handleResetStandardRules = () => {
    setGradingRules(DEFAULT_UGC_GRADING_SCALE.map((r) => ({ ...r })));
  };

  const handleDivisionRuleChange = (
    index: number,
    field: 'divisionName' | 'minPercentage' | 'minCgpa' | 'description' | 'isPassing',
    value: any
  ) => {
    setDivisionRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return { ...r };
        let sanitizedValue: any = value;
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
        return {
          ...r,
          [field]: sanitizedValue,
        };
      })
    );
  };

  const handleResetStandardDivisionRules = () => {
    setDivisionRules(DEFAULT_DEGREE_DIVISION_RULES.map((r) => ({ ...r })));
  };

  const handleAddDivisionRule = () => {
    setDivisionRules((prev) => [
      ...prev,
      {
        id: `DIV-CUSTOM-${Date.now()}`,
        divisionName: 'Custom Tier',
        minPercentage: 55,
        minCgpa: 5.5,
        description: 'Autonomous Custom Classification Tier',
        isPassing: true,
      },
    ]);
  };

  const handleDeleteDivisionRule = (index: number) => {
    if (divisionRules.length <= 1) return;
    setDivisionRules((prev) => prev.filter((_, i) => i !== index));
  };

  // Preview Stream & Semester selector (normalized to prevent duplicate React keys on whitespace/casing - Bug 132)
  const availableStreams = useMemo(
    () =>
      Array.from(
        new Set(
          streamCourseSubjects
            .map((s) => (s.streamCode || '').trim().toUpperCase())
            .filter(Boolean)
        )
      ),
    [streamCourseSubjects]
  );
  const defaultStream = availableStreams.length > 0 ? availableStreams[0] : '';
  const [previewStream, setPreviewStream] = useState(defaultStream);
  const [previewSemester, setPreviewSemester] = useState(5);

  useEffect(() => {
    if (availableStreams.length > 0 && !availableStreams.includes(previewStream)) {
      setPreviewStream(availableStreams[0]);
    } else if (availableStreams.length === 0 && previewStream !== '') {
      setPreviewStream('');
    }
  }, [availableStreams, previewStream]);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  // Mapped subjects for preview
  const previewSubjects = useMemo(() => {
    return previewStream
      ? streamCourseSubjects.filter(
          (s) =>
            (s.streamCode || '').trim().toUpperCase() === previewStream.trim().toUpperCase() &&
            s.semester === previewSemester
        )
      : [];
  }, [previewStream, previewSemester, streamCourseSubjects]);

  const previewMetrics = useMemo(() => {
    let totalCredits = 0;
    let totalCP = 0;

    previewSubjects.forEach((sub, idx) => {
      const sampleMarks = [88, 82, 85, 78, 92][idx % 5] ?? 80;
      const res = calculateGradePoint(sampleMarks, 100, gradingRules);
      const rawCredits = Number(sub.credits);
      const safeCredits = Number.isFinite(rawCredits) && rawCredits > 0 ? rawCredits : 0;
      const safePoint = Number(res?.gradePoint) || 0;
      const cp = Math.round(((safeCredits * safePoint) + Number.EPSILON) * 100) / 100;
      totalCredits += safeCredits;
      totalCP += cp;
    });

    // Strict zero total credits check: Prevents division by zero or NaN/Infinity SGPA; shows N/A for audit/non-credit semesters (Bug 5)
    if (!totalCredits || totalCredits <= 0 || !Number.isFinite(totalCredits)) {
      return { totalCredits: 0, totalCP: 0, sgpa: 'N/A' };
    }

    const rawRatio = totalCP / totalCredits;
    if (!Number.isFinite(rawRatio) || Number.isNaN(rawRatio) || rawRatio <= 0) {
      return { totalCredits, totalCP, sgpa: '0.00' };
    }

    // High-precision SGPA rounding using custom roundWithEpsilon utility replacing .toFixed(2)
    const sgpa = roundWithEpsilon(rawRatio, 2);
    return { totalCredits, totalCP, sgpa };
  }, [previewSubjects, gradingRules]);

  const validateGradingRules = (rules: GradingScaleRule[]): string | null => {
    if (!rules || rules.length === 0) {
      return 'At least one grading scale rule is required.';
    }
    const seenCutoffs = new Set<number>();
    let hasZeroFloor = false;

    for (const r of rules) {
      const minPct = Number(r.minPercentage);
      const gp = Number(r.gradePoint);
      if (!r.letter || !r.letter.trim()) {
        return 'Every grading rule must specify a letter grade (e.g. O, A+, F).';
      }
      if (Number.isNaN(minPct) || minPct < 0 || minPct > 100) {
        return `Invalid cutoff percentage (${r.minPercentage}%) for grade "${r.letter}". Must be between 0% and 100%.`;
      }
      if (Number.isNaN(gp) || gp < 0 || gp > 10) {
        return `Invalid grade point (${r.gradePoint}) for grade "${r.letter}". Must be between 0 and 10.`;
      }
      if (seenCutoffs.has(minPct)) {
        return `Overlapping cutoff detected: Multiple grade bands start at ${minPct}%. Each grade band must have a unique minimum percentage.`;
      }
      seenCutoffs.add(minPct);
      if (minPct === 0) {
        hasZeroFloor = true;
      }
    }

    if (!hasZeroFloor) {
      return 'Unmapped mark gap detected: The lowest grade band (e.g. Fail / F) must start at 0% so all marks from 0 to 100 are covered.';
    }

    const sortedByPctDesc = [...rules].sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage));
    for (let i = 1; i < sortedByPctDesc.length; i++) {
      if (Number(sortedByPctDesc[i].gradePoint) > Number(sortedByPctDesc[i - 1].gradePoint)) {
        return `Inconsistent grading scale: Grade "${sortedByPctDesc[i].letter}" (${sortedByPctDesc[i].minPercentage}%) has a higher grade point (${sortedByPctDesc[i].gradePoint}) than "${sortedByPctDesc[i - 1].letter}" (${sortedByPctDesc[i - 1].minPercentage}%).`;
      }
    }

    return null;
  };

  const validateDivisionRules = (rules: DegreeDivisionRule[]): string | null => {
    if (!rules || rules.length === 0) {
      return 'At least one degree division classification rule is required.';
    }
    const seenNames = new Set<string>();
    let hasZeroFloor = false;

    for (const r of rules) {
      const minPct = Number(r.minPercentage);
      const minCgpa = Number(r.minCgpa);
      const trimmedName = r.divisionName?.trim();
      if (!trimmedName) {
        return 'Every division rule must have a valid division title (e.g. First Class, Distinction).';
      }
      if (seenNames.has(trimmedName.toLowerCase())) {
        return `Duplicate division title detected: "${trimmedName}". Each division tier must have a unique title.`;
      }
      seenNames.add(trimmedName.toLowerCase());

      if (Number.isNaN(minPct) || minPct < 0 || minPct > 100) {
        return `Invalid cutoff percentage (${r.minPercentage}%) for division "${trimmedName}". Must be between 0% and 100%.`;
      }
      if (Number.isNaN(minCgpa) || minCgpa < 0 || minCgpa > 10) {
        return `Invalid minimum CGPA (${r.minCgpa}) for division "${trimmedName}". Must be between 0.0 and 10.0.`;
      }
      if (minPct === 0 && minCgpa === 0) {
        hasZeroFloor = true;
      }
    }

    if (!hasZeroFloor) {
      return 'Unmapped score gap detected: The lowest degree division (e.g. Fail / Backlog) must start at 0% / 0.00 CGPA so all graduating profiles are covered.';
    }

    return null;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const ruleError = validateGradingRules(gradingRules);
    if (ruleError) {
      setValidationError(ruleError);
      setSavedSuccess(false);
      return;
    }

    const divisionError = validateDivisionRules(divisionRules);
    if (divisionError) {
      setValidationError(divisionError);
      setSavedSuccess(false);
      return;
    }
    setValidationError(null);

    const updated: MarksheetConfig = {
      institutionName: institutionName.trim(),
      autonomousTag: autonomousTag.trim(),
      address: address.trim(),
      naacGrade: naacGrade.trim(),
      controllerName: controllerName.trim(),
      controllerDesignation: controllerDesignation.trim(),
      publishDate: publishDate.trim(),
      scaleMatrixDescription: scaleMatrixDescription.trim(),
      examCellSealText: examCellSealText.trim(),
      verifiedByText: verifiedByText.trim(),
      isDuplicateWatermark,
      gradingScaleRules: [...gradingRules].sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage)),
      degreeDivisionRules: [...divisionRules].sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage)),
    };

    onSaveMarksheetConfig(updated);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setSavedSuccess(true);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      setSavedSuccess(false);
    }, 4000);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2 bg-purple-500/20 rounded-xl text-purple-400 border border-purple-500/30">
                <Award className="w-6 h-6" />
              </span>
              <span className="text-xs uppercase font-mono tracking-widest text-purple-300 font-bold">
                Accountant Exam Governance Suite
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Official Marksheet & Transcript Designer
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Design the official CBCS marksheet template, configure Controller of Examination details, institutional
              headers, statutory scale matrix, and publication dates. Course codes, subjects, and credits are fetched
              directly from the Course & Stream Mapping engine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-indigo-300 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">
              v{marksheetConfig.version || 1}
            </span>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            >
              <Printer className="w-4 h-4" />
              Test Print A4
            </button>
          </div>
        </div>
      </div>

      {validationError && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold rounded-2xl flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
          <span>⚠️ {validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-rose-700 hover:text-rose-950 underline text-xs shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Marksheet template and component parameters successfully saved across the ERP!</span>
        </div>
      )}

      {/* Two Column Workspace: Controls on Left, Live Marksheet Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Configuration Controls (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Sliders className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-sm text-slate-900">Marksheet Component Parameters</h3>
          </div>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* Header / Institutional Branding */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span className="font-bold text-slate-900 text-xs block uppercase tracking-wider text-xs">
                1. Institutional Header Details
              </span>

              <div>
                <label htmlFor="ms-institution-name" className="block font-bold text-slate-700 mb-1">
                  College / Institution Name *
                </label>
                <input
                  id="ms-institution-name"
                  type="text"
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label htmlFor="ms-autonomous-tag" className="block font-bold text-slate-700 mb-1">
                  Autonomous Status & System Subtitle *
                </label>
                <input
                  id="ms-autonomous-tag"
                  type="text"
                  required
                  value={autonomousTag}
                  onChange={(e) => setAutonomousTag(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="ms-naac-grade" className="block font-bold text-slate-700 mb-1">
                    NAAC Grade *
                  </label>
                  <input
                    id="ms-naac-grade"
                    type="text"
                    required
                    value={naacGrade}
                    onChange={(e) => setNaacGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="ms-publish-date" className="block font-bold text-slate-700 mb-1">
                    Publication Date *
                  </label>
                  <input
                    id="ms-publish-date"
                    type="text"
                    required
                    value={publishDate}
                    onChange={(e) => setPublishDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ms-campus-address" className="block font-bold text-slate-700 mb-1">
                  Campus Address Line
                </label>
                <input
                  id="ms-campus-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Controller of Examinations & Seal */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span className="font-bold text-slate-900 text-xs block uppercase tracking-wider text-xs">
                2. Examination Authority & Certification
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="ms-controller-name" className="block font-bold text-slate-700 mb-1">
                    Controller Name *
                  </label>
                  <input
                    id="ms-controller-name"
                    type="text"
                    required
                    value={controllerName}
                    onChange={(e) => setControllerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="ms-controller-designation" className="block font-bold text-slate-700 mb-1">
                    Designation Title *
                  </label>
                  <input
                    id="ms-controller-designation"
                    type="text"
                    required
                    value={controllerDesignation}
                    onChange={(e) => setControllerDesignation(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ms-exam-seal-text" className="block font-bold text-slate-700 mb-1">
                  Exam Cell Seal Text
                </label>
                <input
                  id="ms-exam-seal-text"
                  type="text"
                  value={examCellSealText}
                  onChange={(e) => setExamCellSealText(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label htmlFor="ms-verified-by-text" className="block font-bold text-slate-700 mb-1">
                  Verification / Document Subtext
                </label>
                <input
                  id="ms-verified-by-text"
                  type="text"
                  value={verifiedByText}
                  onChange={(e) => setVerifiedByText(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>

              <label className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
                <div>
                  <span className="font-bold text-amber-950 block text-xs">
                    Re-Print &ldquo;DUPLICATE&rdquo; Watermark Stamp
                  </span>
                  <span className="text-xs text-amber-800">
                    Stamp re-issued transcripts with statutory DUPLICATE watermark (Bug 679)
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isDuplicateWatermark}
                  onChange={(e) => setIsDuplicateWatermark(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
              </label>
            </div>

            {/* Scale Matrix Description */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label
                htmlFor="ms-scale-matrix-desc"
                className="font-bold text-slate-900 text-xs block uppercase tracking-wider text-xs"
              >
                3. UGC CBCS Scale Matrix Key
              </label>
              <textarea
                id="ms-scale-matrix-desc"
                rows={3}
                value={scaleMatrixDescription}
                onChange={(e) => setScaleMatrixDescription(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-sans leading-relaxed focus:outline-none focus:border-purple-500 text-xs"
              />
            </div>

            {/* 4. UGC CBCS Letter Grading & Grade Point (GP) Configuration */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs block uppercase tracking-wider text-xs">
                  4. UGC CBCS Letter Grading & GP Configuration
                </span>
                <button
                  type="button"
                  onClick={handleResetStandardRules}
                  className="text-xs text-purple-700 hover:text-purple-900 flex items-center gap-1 font-semibold"
                  title="Reset to official UGC standards"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to UGC
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Admin right to configure letter grading with marks % cutoffs and grade points (GP) for transcripts.
              </p>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="px-2 py-1.5">Grade</th>
                      <th className="px-2 py-1.5">Min % Marks</th>
                      <th className="px-2 py-1.5">Grade Point (GP)</th>
                      <th className="px-2 py-1.5">Descriptor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gradingRules.map((rule, idx) => (
                      <tr key={rule.letter} className="hover:bg-slate-50">
                        <td className="px-2 py-1 font-mono font-bold text-slate-900">
                          {rule.letter}
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            disabled={rule.letter === 'F'}
                            value={rule.minPercentage}
                            onChange={(e) => handleRuleChange(idx, 'minPercentage', e.target.value)}
                            className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-center font-mono text-slate-900 focus:outline-none focus:border-purple-500 disabled:bg-slate-100"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.5"
                            value={rule.gradePoint}
                            onChange={(e) => handleRuleChange(idx, 'gradePoint', e.target.value)}
                            className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-center font-mono font-bold text-purple-700 focus:outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="px-2 py-1 text-slate-600 truncate max-w-[120px]">
                          {rule.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. UGC Autonomous Degree Division Classification */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-xs block uppercase tracking-wider">
                    5. UGC Autonomous Degree Division Classification
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Admin control to dynamically adjust degree division cutoffs, minimum CGPA, and statutory tiers.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddDivisionRule}
                    className="text-xs text-indigo-700 hover:text-indigo-900 flex items-center gap-1 font-semibold"
                    title="Add a custom division tier"
                  >
                    <Plus className="w-3 h-3" />
                    Add Tier
                  </button>
                  <button
                    type="button"
                    onClick={handleResetStandardDivisionRules}
                    className="text-xs text-purple-700 hover:text-purple-900 flex items-center gap-1 font-semibold"
                    title="Reset to UGC statutory division cutoffs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="px-2 py-1.5">Division Title</th>
                      <th className="px-2 py-1.5 text-center">Min %</th>
                      <th className="px-2 py-1.5 text-center">Min CGPA</th>
                      <th className="px-2 py-1.5">Descriptor</th>
                      <th className="px-2 py-1.5 text-center">Passing</th>
                      <th className="px-2 py-1.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {divisionRules.map((rule, idx) => (
                      <tr key={rule.id || idx} className="hover:bg-slate-50">
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={rule.divisionName}
                            onChange={(e) => handleDivisionRuleChange(idx, 'divisionName', e.target.value)}
                            className="w-full min-w-[110px] px-1.5 py-0.5 border border-slate-300 rounded font-semibold text-slate-900 focus:outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={rule.minPercentage}
                            onChange={(e) => handleDivisionRuleChange(idx, 'minPercentage', e.target.value)}
                            className="w-14 px-1 py-0.5 border border-slate-300 rounded text-center font-mono text-slate-900 focus:outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={rule.minCgpa}
                            onChange={(e) => handleDivisionRuleChange(idx, 'minCgpa', e.target.value)}
                            className="w-14 px-1 py-0.5 border border-slate-300 rounded text-center font-mono font-bold text-purple-700 focus:outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={rule.description}
                            onChange={(e) => handleDivisionRuleChange(idx, 'description', e.target.value)}
                            className="w-full min-w-[130px] px-1.5 py-0.5 border border-slate-300 rounded text-slate-700 focus:outline-none focus:border-purple-500 text-[11px]"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={rule.isPassing}
                            onChange={(e) => handleDivisionRuleChange(idx, 'isPassing', e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteDivisionRule(idx)}
                            disabled={divisionRules.length <= 1}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 p-0.5"
                            title="Remove division tier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md"
            >
              <Save className="w-4 h-4" />
              Save Marksheet Configuration
            </button>
          </form>
        </div>

        {/* Right Column: Live Marksheet Preview Canvas (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-xs uppercase tracking-wider">Live Marksheet Canvas Preview</span>
            </div>

            {/* Preview Stream / Semester selectors */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                <label htmlFor="ms-preview-stream" className="text-slate-400 text-xs">Stream:</label>
                <select
                  id="ms-preview-stream"
                  value={previewStream}
                  disabled={availableStreams.length === 0}
                  onChange={(e) => setPreviewStream(e.target.value)}
                  className="bg-transparent font-bold text-amber-300 focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  {availableStreams.length === 0 ? (
                    <option value="" className="bg-slate-900 text-slate-400">
                      No Streams Mapped
                    </option>
                  ) : (
                    availableStreams.map((st) => (
                      <option key={st} value={st} className="bg-slate-900 text-white">
                        {st}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                <label htmlFor="ms-preview-semester" className="text-slate-400 text-xs">Sem:</label>
                <select
                  id="ms-preview-semester"
                  value={previewSemester}
                  onChange={(e) => setPreviewSemester(Number(e.target.value))}
                  className="bg-transparent font-bold text-amber-300 focus:outline-none cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                    <option key={s} value={s} className="bg-slate-900 text-white">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Marksheet Paper Container with Print Isolation (Bug 3) */}
          <style>{`
            @media print {
              header, aside, footer, nav, .marksheet-controls-panel {
                display: none !important;
              }
              body * {
                visibility: hidden;
              }
              #marksheet-canvas, #marksheet-canvas * {
                visibility: visible !important;
              }
              #marksheet-canvas {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `}</style>
          <div
            id="marksheet-canvas"
            className="relative bg-white p-6 sm:p-8 rounded-3xl border-2 border-slate-300 shadow-xl space-y-5 text-slate-900 font-sans overflow-hidden"
          >
            {isDuplicateWatermark && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                <span className="text-rose-500/15 font-black text-5xl sm:text-6xl uppercase -rotate-25 tracking-widest border-4 border-rose-500/20 px-6 py-2 rounded-2xl font-sans">
                  DUPLICATE MARKSHEET
                </span>
              </div>
            )}
            {/* Header with configured details */}
            <div className="text-center border-b-2 border-slate-900 pb-3">
              <h2 className="font-sans font-black text-xl uppercase tracking-tight text-slate-950">
                {institutionName}
              </h2>
              <p className="text-xs uppercase font-bold text-slate-700 tracking-wider mt-0.5">
                {autonomousTag}
              </p>
              <p className="text-xs text-slate-500">
                {address} • {naacGrade}
              </p>

              <div className="mt-2.5 inline-flex items-center gap-2 px-4 py-1 bg-slate-100 rounded-lg border border-slate-300 text-xs font-black uppercase tracking-wider text-slate-900 font-sans">
                <span>OFFICIAL STATEMENT OF GRADES • SEMESTER {previewSemester}</span>
              </div>
            </div>

            {/* Sample Student Particulars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-xs uppercase font-bold">Candidate Name</span>
                <strong className="text-slate-900">Aarav Kumar (Sample)</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-xs uppercase font-bold">Roll Number</span>
                <strong className="font-mono text-slate-900">2025CS001</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-xs uppercase font-bold">Registration No</span>
                <span className="font-mono text-slate-800">RLSY/2023/CS/001</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs uppercase font-bold">Date of Publication</span>
                <span className="font-bold text-indigo-900">{publishDate}</span>
              </div>
            </div>

            {/* Mapped Subjects Notice */}
            <div className="flex items-center justify-between text-xs text-slate-600 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-200">
              <span className="font-semibold text-indigo-950">
                Coursework Dynamically Sourced from Stream & Course Mapping ({previewStream} Sem {previewSemester})
              </span>
              <span className="font-bold font-mono text-indigo-700">
                {previewSubjects.length} Mapped Subjects • {previewMetrics.totalCredits} Credits
              </span>
            </div>

            {/* Course Table */}
            <div className="border border-slate-300 rounded-xl overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="bg-slate-100 text-slate-900 uppercase font-black text-xs border-b border-slate-300">
                  <tr>
                    <th className="px-3 py-2">Paper Code</th>
                    <th className="px-3 py-2">Subject / Paper Title</th>
                    <th className="px-3 py-2 text-center">Credits</th>
                    <th className="px-3 py-2 text-center">Marks (100)</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                    <th className="px-3 py-2 text-right">Credit Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  {availableStreams.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 bg-amber-50/40">
                        <strong className="block text-slate-800 font-bold mb-1">
                          Curriculum Stream Catalog Empty
                        </strong>
                        No academic streams or subjects have been configured yet. Please open the{' '}
                        <span className="font-semibold text-indigo-700">Course &amp; Stream Mapping</span> module to
                        introduce streams and map semester papers before previewing marksheets.
                      </td>
                    </tr>
                  ) : previewSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                        No subjects mapped for {previewStream} Semester {previewSemester}. Please map subjects in Course &amp;
                        Stream Mapping.
                      </td>
                    </tr>
                  ) : (
                    previewSubjects.map((sub, idx) => {
                      const sampleMarks = [88, 82, 85, 78, 92][idx % 5] ?? 80;
                      const res = calculateGradePoint(sampleMarks, 100, gradingRules);
                      const sampleGrade = res?.letter || 'P';
                      const samplePoint = Number(res?.gradePoint) || 0;
                      const safeCredits = Number(sub.credits) || 0;
                      const cp = Math.round(((safeCredits * samplePoint) + Number.EPSILON) * 100) / 100;

                      return (
                        <tr
                          key={sub.id || `${sub.streamCode}-${sub.semester}-${sub.subjectCode}`}
                          className="hover:bg-slate-50 transition"
                        >
                          <td className="px-3 py-2 font-mono font-bold text-slate-900">{sub.subjectCode}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">{sub.subjectName}</td>
                          <td className="px-3 py-2 text-center font-bold text-slate-800">{safeCredits}</td>
                          <td className="px-3 py-2 text-center font-mono font-bold">{sampleMarks}</td>
                          <td className="px-3 py-2 text-center font-bold font-mono text-indigo-700">{sampleGrade}</td>
                          <td className="px-3 py-2 text-right font-mono font-black text-slate-950">{roundWithEpsilon(cp, 2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {previewSubjects.length > 0 && (
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-right uppercase tracking-wider text-xs">
                        Semester Totals & SGPA:
                      </td>
                      <td className="px-3 py-2 text-center font-mono">{previewMetrics.totalCredits}</td>
                      <td className="px-3 py-2 text-center font-mono">—</td>
                      <td className="px-3 py-2 text-center font-mono text-purple-700">SGPA</td>
                      <td className="px-3 py-2 text-right font-mono text-purple-900 font-black text-xs">
                        {previewMetrics.sgpa === 'N/A' ? 'N/A (Non-Credit Semester)' : `${previewMetrics.sgpa} / 10.00`}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Degree Division Classification Badge / Transcript Result */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-purple-50/80 p-2.5 rounded-xl border border-purple-200 text-purple-950">
              <div className="flex items-center gap-1.5 font-bold">
                <Award className="w-3.5 h-3.5 text-purple-700" />
                <span>UGC Autonomous Degree Division Standing:</span>
              </div>
              <div className="font-mono font-bold text-xs bg-white px-2.5 py-1 rounded-lg border border-purple-300 text-purple-900 shadow-xs">
                {previewMetrics.sgpa === 'N/A'
                  ? 'Audit / Non-Grading'
                  : classifyDegreeDivision(Number(previewMetrics.sgpa) || 0, 'cgpa', false, divisionRules)}
              </div>
            </div>

            {/* UGC Scale Matrix Box */}
            <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 leading-relaxed font-sans">
              <strong className="text-slate-800">Statutory Scale Matrix: </strong>
              {scaleMatrixDescription}
            </div>

            {/* Signature & Exam Cell Seal */}
            <div className="pt-6 border-t-2 border-slate-900 flex justify-between items-end text-xs">
              <div>
                <p className="text-xs text-slate-500 font-mono">Date of Publish: {publishDate}</p>
                <p className="text-xs text-slate-500 font-mono">{verifiedByText}</p>
              </div>

              <div className="text-center">
                <div className="w-20 h-20 border-2 border-dashed border-amber-500 rounded-full flex flex-col items-center justify-center mx-auto text-[7px] font-mono text-amber-900 font-bold bg-amber-50/40">
                  <span className="text-center leading-tight whitespace-pre-line px-1">{examCellSealText}</span>
                </div>
              </div>

              <div className="text-right space-y-0.5">
                <div className="w-32 h-0.5 bg-slate-900 ml-auto mb-1" />
                <p className="font-bold text-slate-950">{controllerName}</p>
                <p className="text-xs text-slate-600 font-medium">{controllerDesignation}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
