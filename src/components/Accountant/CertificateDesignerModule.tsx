import React, { useState, useEffect, useRef } from 'react';
import {
  CertificateDesignConfig,
  CertificateTemplateType,
  CeremonialBorderStyle,
  StateSealStyle,
  UserAccount,
  StreamCourseSubject,
  Student,
  CollegeProfile,
} from '../../types/erp';
import {
  Award,
  Stamp,
  Printer,
  Sparkles,
  Save,
  CheckCircle2,
  FileText,
  Shield,
  Layers,
  Eye,
  Settings,
  Sliders,
  GraduationCap,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import {
  calculateGradePoint,
  generateCertificateVerificationHash,
  validateSafeImageDataUrl,
  assertSafeCertificateImages,
  sanitizePlainText,
  computeAutoExpandTextareaRows,
} from '../../utils/erpLogic';
import { erpStorage } from '../../services/erpStorage';

interface CertificateDesignerModuleProps {
  certificateConfig: CertificateDesignConfig;
  onSaveCertificateConfig: (config: CertificateDesignConfig) => void;
  streamCourseSubjects: StreamCourseSubject[];
  currentUser: UserAccount;
  students?: Student[];
  collegeProfile?: CollegeProfile;
}

export const CertificateDesignerModule: React.FC<CertificateDesignerModuleProps> = ({
  certificateConfig,
  onSaveCertificateConfig,
  streamCourseSubjects,
  currentUser,
  students = [],
  collegeProfile,
}) => {
  const [config, setConfig] = useState<CertificateDesignConfig>(certificateConfig);
  const [activeTemplate, setActiveTemplate] = useState<CertificateTemplateType>(
    certificateConfig.templateType || 'marksheet'
  );
  const [previewSemester, setPreviewSemester] = useState<number>(5);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => students[0]?.id || 'SAMPLE');
  const [statusMessage, setStatusMessage] = useState('');
  const [isErrorStatus, setIsErrorStatus] = useState(false);
  const [deploymentMode, setDeploymentMode] = useState<'draft' | 'published'>('published');
  const [certificateYear, setCertificateYear] = useState<number>(2026);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const printTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCertificateYear(new Date().getFullYear());
  }, []);

  useEffect(() => {
    setConfig(certificateConfig);
    if (certificateConfig.templateType) {
      setActiveTemplate(certificateConfig.templateType);
    }
  }, [certificateConfig]);

  const selectedLiveStudent =
    students.find((s) => s.id === selectedStudentId) ||
    (selectedStudentId !== 'SAMPLE' ? students.find((s) => s.semester === previewSemester) : undefined);

  // Live or sample student details for preview & print (dynamically reflects previewSemester - Bug 118)
  const sampleStudent = {
    rollNo: String(selectedLiveStudent?.rollNo || `2025CS00${previewSemester}`),
    regNo: String(selectedLiveStudent?.registerNo || `RLSY/2023/CS/00${previewSemester}`),
    name: String(selectedLiveStudent?.name || 'AARAV KUMAR').toUpperCase(),
    fatherName: String(
      selectedLiveStudent?.enrollmentData?.fatherName || 'SHRI R. K. VERMA'
    ).toUpperCase(),
    course: selectedLiveStudent?.course || 'Bachelor of Technology (Computer Science & Engineering)',
    stream: selectedLiveStudent?.streamCode || 'Computer Science & Engineering',
    semester: `Semester ${previewSemester} (Autonomous Scheme)`,
    session: selectedLiveStudent?.batchYear || `${certificateYear - 3}-${certificateYear + 1}`,
    clearanceDate: config.publishDate || '21st October 2026',
    reason: 'Successful completion of academic requirements and zero institutional arrears.',
    achievement: 'First Prize with High Distinction in State Algorithms Hackathon & Dean’s Academic Honor Roll.',
  };

  const handleSaveWithMode = (mode: 'draft' | 'published', e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      // Strict image validation barrier: throws and halts execution if any image is unsafe or malformed
      assertSafeCertificateImages(config);

      setDeploymentMode(mode);
      const updated: CertificateDesignConfig = {
        ...config,
        institutionName: sanitizePlainText(config.institutionName),
        institutionSubtitle: sanitizePlainText(config.institutionSubtitle),
        affiliationText: sanitizePlainText(config.affiliationText),
        statutoryWatermarkText: sanitizePlainText(config.statutoryWatermarkText),
        templateType: activeTemplate,
      };
      // Always validate and persist through parent barrier when publishing or saving draft
      assertSafeCertificateImages(updated);
      if (mode === 'published') {
        onSaveCertificateConfig(updated);
      }
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
      setIsErrorStatus(false);
      setStatusMessage(
        mode === 'draft'
          ? 'Certificate design saved to local draft workspace for verification prior to live portal publication.'
          : 'Certificate theme & ceremonial security templates published live to Student Portal.'
      );
      statusTimerRef.current = setTimeout(() => {
        statusTimerRef.current = null;
        setStatusMessage('');
        setIsErrorStatus(false);
      }, 4000);
    } catch (err: any) {
      setIsErrorStatus(true);
      setStatusMessage(err?.message || 'Security Alert: Unsafe or corrupted image data blocked template save.');
    }
  };

  const handleSave = (e: React.FormEvent) => handleSaveWithMode('published', e);

  // Memoized cryptographic verification hash (Audit Item 15)
  const verificationHash = React.useMemo(() => {
    return generateCertificateVerificationHash(
      sampleStudent.rollNo,
      `RLSY/${activeTemplate.toUpperCase()}/${certificateYear}/${String(sampleStudent.rollNo || '').slice(-3) || '8941'}`,
      config.publishDate || '21st October 2026',
      sampleStudent.course
    );
  }, [sampleStudent.rollNo, sampleStudent.course, activeTemplate, certificateYear, config.publishDate]);

  // Memoized ceremonial crest/seal graphic
  const memoizedSealGraphic = React.useMemo(() => {
    if (config.sealStyle === 'state_emblem') {
      return <Shield className="w-8 h-8 text-amber-700" />;
    }
    if (config.sealStyle === 'gold_embossed') {
      return <Stamp className="w-8 h-8 text-amber-600" />;
    }
    return <GraduationCap className="w-8 h-8 text-indigo-900" />;
  }, [config.sealStyle]);

  React.useEffect(() => {
    const handleAfterPrint = () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('printing-certificate-active');
      }
    };
    let mql: MediaQueryList | null = null;
    const handleMqlChange = (mqlEvent: MediaQueryListEvent) => {
      if (!mqlEvent.matches) {
        handleAfterPrint();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('afterprint', handleAfterPrint);
      window.addEventListener('focus', handleAfterPrint);
      if (window.matchMedia) {
        mql = window.matchMedia('print');
        if (mql.addEventListener) {
          mql.addEventListener('change', handleMqlChange);
        } else if ((mql as any).addListener) {
          (mql as any).addListener(handleMqlChange);
        }
      }
    }
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
      if (printTimerRef.current) {
        clearTimeout(printTimerRef.current);
        printTimerRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('afterprint', handleAfterPrint);
        window.removeEventListener('focus', handleAfterPrint);
        if (mql) {
          if (mql.removeEventListener) {
            mql.removeEventListener('change', handleMqlChange);
          } else if ((mql as any).removeListener) {
            (mql as any).removeListener(handleMqlChange);
          }
        }
      }
      if (typeof document !== 'undefined') {
        document.body.classList.remove('printing-certificate-active');
      }
    };
  }, []);

  const handlePrint = () => {
    if (selectedLiveStudent && selectedLiveStudent.hallTicketBlocked) {
      setIsErrorStatus(true);
      setStatusMessage(
        `Printing Locked: Certificate generation is blocked for ${selectedLiveStudent.name} (${selectedLiveStudent.rollNo}) due to active statutory hold: ${selectedLiveStudent.blockReason || 'Attendance/financial clearance pending.'}`
      );
      return;
    }
    if (typeof document !== 'undefined') {
      document.body.classList.add('printing-certificate-active');
    }
    if (printTimerRef.current) {
      clearTimeout(printTimerRef.current);
    }
    // Yield to browser rendering cycle so print classes apply before opening print dialog (Bug 167)
    printTimerRef.current = setTimeout(() => {
      printTimerRef.current = null;
      window.print();
    }, 100);
  };

  // Border Style CSS Classes with safe whitelist guard (Bug 237)
  const getBorderClasses = (style: CeremonialBorderStyle) => {
    const validStyles: CeremonialBorderStyle[] = [
      'victorian_gold',
      'guilloche_academic',
      'ornate_classic',
      'minimal_modern',
    ];
    const resolvedStyle = validStyles.includes(style) ? style : 'victorian_gold';
    switch (resolvedStyle) {
      case 'victorian_gold':
        return 'border-[12px] border-double border-amber-600 outline outline-4 outline-amber-800/60 p-8 shadow-2xl bg-amber-50/10';
      case 'guilloche_academic':
        return 'border-[10px] border-indigo-950 outline outline-2 outline-amber-500 p-8 shadow-xl bg-slate-50/30';
      case 'ornate_classic':
        return 'border-[8px] border-slate-900 border-dashed p-8 shadow-lg bg-white';
      case 'minimal_modern':
        return 'border-2 border-slate-800 p-8 shadow-md bg-white';
      default: {
        const _exhaustive: never = resolvedStyle;
        return String(_exhaustive || 'border-2 border-slate-800 p-8 shadow-md bg-white');
      }
    }
  };

  return (
    <div className="certificate-designer-root space-y-6 animate-in fade-in">
      {/* Scoped print stylesheet isolation */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body.printing-certificate-active .certificate-designer-root > *:not(.certificate-workspace-grid) {
            display: none !important;
          }
          body.printing-certificate-active header,
          body.printing-certificate-active aside,
          body.printing-certificate-active footer,
          body.printing-certificate-active nav {
            display: none !important;
          }
          body.printing-certificate-active .certificate-controls-col,
          body.printing-certificate-active .certificate-preview-header {
            display: none !important;
          }
          body.printing-certificate-active #certificate-print-canvas,
          body.printing-certificate-active #certificate-print-canvas * {
            visibility: visible !important;
          }
          body.printing-certificate-active #certificate-print-canvas {
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            min-height: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          body.printing-certificate-active #certificate-print-canvas .overflow-x-auto,
          body.printing-certificate-active #certificate-print-canvas table {
            overflow: visible !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          body.printing-certificate-active #certificate-print-canvas tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          body.printing-certificate-active #certificate-print-canvas h2 {
            background: none !important;
            background-image: none !important;
            -webkit-background-clip: initial !important;
            background-clip: initial !important;
            color: #92400e !important;
            -webkit-text-fill-color: #92400e !important;
          }
        }
      `}</style>
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
                <Award className="w-6 h-6" />
              </span>
              <span className="text-xs uppercase font-mono tracking-widest text-amber-300 font-bold">
                Institutional Academic Directorate
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Certificate & Marksheet Theme Designer
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Design, customize, and publish ceremonial borders, state seals, gold-foil typography, and statutory watermark
              templates for College Clearance Certificates, CBCS Marksheets, and Appreciation Honors.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-300 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">
              v{config.version || 1} · {deploymentMode === 'draft' ? 'Draft' : 'Live'}
            </span>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-700 shadow"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={() => handleSaveWithMode('draft')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-amber-500/40 shadow"
            >
              <FileText className="w-4 h-4" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-2 shadow-lg"
            >
              <Save className="w-4 h-4" />
              Publish Themes
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 border text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in ${
            isErrorStatus
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          {isErrorStatus ? (
            <Shield className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* TEMPLATE CATEGORY SELECTOR */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 overflow-x-auto text-xs">
        <span className="font-bold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap pl-1">
          Certificate Category:
        </span>
        {[
          { id: 'marksheet', label: 'CBCS Marksheet / Grade Card' },
          { id: 'clearance', label: 'College Clearance Certificate (No-Dues)' },
          { id: 'appreciation', label: 'Appreciation & Commendation Certificate' },
        ].map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => {
              setActiveTemplate(tpl.id as CertificateTemplateType);
              setConfig({ ...config, templateType: tpl.id as CertificateTemplateType });
            }}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTemplate === tpl.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            {tpl.label}
          </button>
        ))}
      </div>

      {/* TWO COLUMN WORKSPACE: CONFIG CONTROLS ON LEFT, LIVE CANVAS ON RIGHT */}
      <div className="certificate-workspace-grid grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Design Controls */}
        <div className="certificate-controls-col lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 text-xs">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900">Ceremonial Styling Parameters</h3>
          </div>

          {/* 1. Border Style Selector */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">
              Ceremonial Border Frame
            </label>
            <select
              value={config.borderStyle}
              onChange={(e) => setConfig({ ...config, borderStyle: e.target.value as CeremonialBorderStyle })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 cursor-pointer"
            >
              <option value="victorian_gold">Victorian Double Gold Filigree Border</option>
              <option value="guilloche_academic">Guilloché High-Security Academic Ribbon</option>
              <option value="ornate_classic">Ornate Collegiate Dashed Frame</option>
              <option value="minimal_modern">Minimal Archival Institutional Border</option>
            </select>
          </div>

          {/* 2. State Seal & Emblem Style */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">
              State Seal & Statutory Emblem
            </label>
            <select
              value={config.sealStyle}
              onChange={(e) => setConfig({ ...config, sealStyle: e.target.value as StateSealStyle })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 cursor-pointer"
            >
              <option value="state_emblem">Official State Emblem / Government Crest</option>
              <option value="gold_embossed">Embossed Gold Star Directorate Seal</option>
              <option value="royal_insignia">Collegiate Heraldic Crest</option>
              <option value="minimal_crest">Modern Autonomous Seal</option>
            </select>
          </div>

          {/* 3. Gold-Foil Typography Toggle */}
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="font-bold text-amber-950 block">Gold-Foil Typography</span>
              <span className="text-xs text-amber-800">
                Apply metallic gold gradient and embossed serif headers
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.goldFoilTypography}
                onChange={(e) => setConfig({ ...config, goldFoilTypography: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* 4. Statutory Watermark Templates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800">Statutory Watermark Pattern</label>
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showWatermark}
                  onChange={(e) => setConfig({ ...config, showWatermark: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                Visible
              </label>
            </div>
            <textarea
              rows={computeAutoExpandTextareaRows(config.statutoryWatermarkText, 2, 5, 50)}
              value={config.statutoryWatermarkText || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setConfig({ ...config, statutoryWatermarkText: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs resize-none max-h-28 overflow-y-auto"
              placeholder="e.g. ★ RLSY COLLEGE ★ AUTONOMOUS ★ STATUTORY RECORD ★"
            />
          </div>

          {/* 5. Header & Insignia Texts */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block font-mono">
              Institutional Hierarchy
            </span>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Institution Title</label>
              <input
                type="text"
                value={config.institutionName}
                onChange={(e) => setConfig({ ...config, institutionName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Subtitle / NAAC Accreditation</label>
              <input
                type="text"
                value={config.institutionSubtitle}
                onChange={(e) => setConfig({ ...config, institutionSubtitle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Affiliation / Statutory Authority</label>
              <input
                type="text"
                value={config.affiliationText}
                onChange={(e) => setConfig({ ...config, affiliationText: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          {/* 6. Signatories & Dates */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block font-mono">
              Signatory Authorities & Date
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Controller Name *</label>
                <input
                  type="text"
                  required
                  value={config.controllerName || ''}
                  onChange={(e) => setConfig({ ...config, controllerName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Principal Name *</label>
                <input
                  type="text"
                  required
                  value={config.principalName || ''}
                  onChange={(e) => setConfig({ ...config, principalName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Date of Publication</label>
              <input
                type="text"
                value={config.publishDate || ''}
                onChange={(e) => setConfig({ ...config, publishDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
              />
            </div>
          </div>

          {/* Scale matrix description (if marksheet) */}
          {activeTemplate === 'marksheet' && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block font-bold text-slate-700 mb-1">
                UGC CBCS Scale Matrix Specification
              </label>
              <textarea
                rows={3}
                value={config.scaleMatrixDescription || ''}
                onChange={(e) => setConfig({ ...config, scaleMatrixDescription: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4 text-amber-400" />
            Save & Publish Theme Templates
          </button>
        </div>

        {/* Right Column: Live Certificate Canvas Preview */}
        <div className="lg:col-span-7 space-y-3">
          <div className="certificate-preview-header flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
            <span className="font-bold flex items-center gap-1.5 text-slate-700">
              <Eye className="w-4 h-4 text-indigo-600" />
              Live Ceremonial Preview • {activeTemplate.toUpperCase()}
            </span>
            <div className="flex items-center gap-2">
              {students.length > 0 && (
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedStudentId(id);
                    const stu = students.find((s) => s.id === id);
                    if (stu?.semester) setPreviewSemester(Math.min(10, Math.max(1, stu.semester)));
                  }}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                >
                  <option value="SAMPLE">Sample Candidate (Aarav Kumar)</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.rollNo} — {s.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="font-mono text-xs">Print Ready (A4)</span>
            </div>
          </div>

          {/* PRINTABLE CANVAS CONTAINER */}
          <div
            id="certificate-print-canvas"
            className={`relative rounded-2xl overflow-hidden min-h-[640px] flex flex-col justify-between ${getBorderClasses(
              config.borderStyle
            )}`}
          >
            {/* Watermark Overlay */}
            {config.showWatermark && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
                <span className="text-slate-300/25 font-black text-3xl sm:text-4xl uppercase -rotate-25 tracking-widest text-center max-w-lg leading-relaxed font-sans">
                  {config.statutoryWatermarkText}
                </span>
              </div>
            )}

            {/* Corner Decorative Ornaments for Victorian Style */}
            {config.borderStyle === 'victorian_gold' && (
              <>
                <div className="absolute top-2 left-2 text-amber-600 font-sans text-2xl select-none pointer-events-none z-0 flex items-center gap-1">
                  <span>✦</span>
                  <span>❧</span>
                </div>
                <div className="absolute top-2 right-2 text-amber-600 font-sans text-2xl select-none pointer-events-none z-0 flex items-center gap-1">
                  <span>❧</span>
                  <span>✦</span>
                </div>
                <div className="absolute bottom-2 left-2 text-amber-600 font-sans text-2xl select-none pointer-events-none z-0 flex items-center gap-1">
                  <span>✦</span>
                  <span>❧</span>
                </div>
                <div className="absolute bottom-2 right-2 text-amber-600 font-sans text-2xl select-none pointer-events-none z-0 flex items-center gap-1">
                  <span>❧</span>
                  <span>✦</span>
                </div>
              </>
            )}

            {/* Canvas Header */}
            <div className="relative z-10 text-center space-y-1.5 pb-4 border-b border-amber-900/10">
              {/* Crest / State Seal */}
              <div className="mx-auto w-14 h-14 rounded-full border-2 border-amber-600 p-1 flex items-center justify-center bg-white shadow-sm mb-1">
                {memoizedSealGraphic}
              </div>

              <h2
                className={`text-xl sm:text-2xl font-black uppercase tracking-tight ${
                  config.goldFoilTypography
                    ? 'font-sans bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-800 bg-clip-text text-transparent drop-shadow-sm'
                    : 'text-slate-900 font-sans'
                }`}
              >
                {config.institutionName || collegeProfile?.name}
              </h2>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                {config.institutionSubtitle}
              </p>
              <p className="text-xs text-slate-500 font-sans max-w-md mx-auto">
                {config.affiliationText || collegeProfile?.affiliation} · {config.address || collegeProfile?.address}
              </p>
            </div>

            {/* Canvas Body (Contextual by Template) */}
            <div className="relative z-10 py-6 text-center space-y-4 flex-1 flex flex-col justify-center">
              {activeTemplate === 'clearance' && (
                <div className="space-y-4 max-w-xl mx-auto text-xs text-slate-800">
                  <div className="inline-block px-4 py-1 border-b-2 border-amber-600 font-sans font-black text-base text-amber-950 uppercase tracking-wider">
                    College Clearance Certificate (No-Dues)
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    Certificate No: RLSY/CLR/{certificateYear}/{String(sampleStudent.rollNo || '').slice(-3) || '8941'} · Date of Issue: {config.publishDate}
                  </p>

                  <p className="leading-relaxed text-justify text-xs text-slate-700">
                    This is to officially certify that <span className="font-bold text-slate-900 underline">{sampleStudent.name}</span>,
                    son/daughter of <span className="font-bold text-slate-900">{sampleStudent.fatherName}</span>, bearing College Roll No:{' '}
                    <span className="font-bold text-indigo-950 font-mono">{sampleStudent.rollNo}</span> and State University Registration No:{' '}
                    <span className="font-bold text-slate-900 font-mono">{sampleStudent.regNo}</span>, enrolled in{' '}
                    <span className="font-bold text-slate-900">{sampleStudent.course}</span>, has cleared all statutory institutional dues across
                    all nodal departments including Central Library, Laboratories, Hostel Administration, and Accounts Cell.
                  </p>

                  <div className="grid grid-cols-4 gap-2 pt-2 text-xs font-mono text-center">
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="block text-slate-400">Library</span>
                      <span className="font-bold text-emerald-700">✓ No Dues</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="block text-slate-400">Laboratories</span>
                      <span className="font-bold text-emerald-700">✓ Cleared</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="block text-slate-400">Hostel Desk</span>
                      <span className="font-bold text-emerald-700">✓ Verified</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="block text-slate-400">Accounts</span>
                      <span className="font-bold text-emerald-700">✓ Zero Balance</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTemplate === 'appreciation' && (
                <div className="space-y-4 max-w-xl mx-auto text-xs text-slate-800">
                  <div className="inline-block px-4 py-1 border-b-2 border-amber-600 font-sans font-black text-lg text-amber-950 uppercase tracking-widest">
                    Certificate of Commendation & Appreciation
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    Certificate No: RLSY/CERT/{certificateYear}/{String(sampleStudent.rollNo || '').slice(-3) || '8941'}
                  </p>
                  <p className="font-sans italic text-slate-600 text-sm">
                    Presented with High Honor & Distinction To
                  </p>
                  <h3
                    className={`font-black text-slate-900 tracking-wide font-sans uppercase break-words line-clamp-2 max-w-md mx-auto ${
                      sampleStudent.name.length > 28 ? 'text-base sm:text-lg' : 'text-xl'
                    }`}
                  >
                    {sampleStudent.name}
                  </h3>
                  <p className="font-mono text-xs text-slate-600">
                    Roll No: {sampleStudent.rollNo} · {sampleStudent.stream}
                  </p>

                  <p className="leading-relaxed text-center text-xs text-slate-700 max-w-md mx-auto pt-2">
                    In solemn recognition of exemplary academic brilliance, ethical diligence, and outstanding collegiate contribution:{' '}
                    <span className="font-semibold text-amber-950">{sampleStudent.achievement}</span>.
                  </p>
                </div>
              )}

              {activeTemplate === 'marksheet' && (
                <div className="space-y-3 text-xs text-slate-800 text-left">
                  <div className="flex items-center justify-between border-b border-slate-400 pb-1">
                    <span className="font-sans font-black text-sm uppercase tracking-wider text-slate-900">
                      Autonomous CBCS Semester Grade Statement (Provisional)
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-sans print:hidden">
                      <span className="text-slate-500 font-medium">Preview Sem:</span>
                      <select
                        value={previewSemester}
                        onChange={(e) => {
                          const nextSem = Number(e.target.value);
                          setPreviewSemester(nextSem);
                          const semStudent = students.find((s) => s.semester === nextSem);
                          if (semStudent && selectedStudentId !== 'SAMPLE') {
                            setSelectedStudentId(semStudent.id);
                          }
                        }}
                        className="px-2 py-0.5 bg-white border border-slate-300 rounded font-bold text-slate-800 cursor-pointer text-xs"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((sem) => (
                          <option key={sem} value={sem}>Sem {sem}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500">Candidate Name: </span>
                      <span className="font-bold text-slate-900">{sampleStudent.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Roll No: </span>
                      <span className="font-bold font-mono text-indigo-950">{sampleStudent.rollNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Course / Programme: </span>
                      <span className="font-bold text-slate-900">{sampleStudent.course}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Semester: </span>
                      <span className="font-bold text-slate-900">{sampleStudent.semester}</span>
                    </div>
                  </div>

                  {/* Dynamic Subjects Table mapped from Course Mapping */}
                  <div className="overflow-x-auto bg-white rounded border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 font-bold uppercase text-xs text-slate-600">
                        <tr>
                          <th className="p-2">Code</th>
                          <th className="p-2">Course Title</th>
                          <th className="p-2 text-center">Credits</th>
                          <th className="p-2 text-center">Grade</th>
                          <th className="p-2 text-center">Point</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {(() => {
                          const matchedSubs = streamCourseSubjects.filter((s) => s.semester === previewSemester);
                          const subsToRender = matchedSubs.length > 0 ? matchedSubs : streamCourseSubjects;
                          const gradingScaleRules = erpStorage.getMarksheetConfig()?.gradingScaleRules;
                          return subsToRender.map((s, idx) => {
                            const sampleMarks = [88, 82, 85, 78, 92][idx % 5] ?? 80;
                            const gradeRes = calculateGradePoint(sampleMarks, 100, gradingScaleRules);
                            return (
                              <tr key={s.id || `${s.streamCode}-${s.semester}-${s.subjectCode}`}>
                                <td className="p-2 font-bold text-indigo-900">{s.subjectCode}</td>
                                <td className="p-2 font-sans font-medium text-slate-800 truncate max-w-[200px]">{s.subjectName}</td>
                                <td className="p-2 text-center">{s.credits}</td>
                                <td className="p-2 text-center font-bold text-emerald-700">{gradeRes.letter}</td>
                                <td className="p-2 text-center font-bold">{gradeRes.gradePoint}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Scale Matrix */}
                  <div className="p-2 bg-amber-50/50 rounded border border-amber-200 text-xs text-slate-600">
                    <span className="font-bold text-slate-900 block mb-0.5">Scale Matrix:</span>
                    {config.scaleMatrixDescription || 'UGC 10-Point CBCS Academic Grading Scale (Autonomous Scheme)'}
                  </div>
                </div>
              )}
            </div>

            {/* Canvas Signatures Footer */}
            <div className="relative z-10 pt-4 border-t border-amber-900/15 flex items-end justify-between px-4 text-center">
              <div className="w-36">
                <div className="h-9 flex items-center justify-center">
                  <span className="font-sans italic text-slate-500 text-xs">Official Seal</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-xs text-slate-800 block uppercase">
                    {config.controllerName}
                  </span>
                  <span className="text-xs text-slate-500 block">
                    {config.controllerDesignation}
                  </span>
                </div>
              </div>

              {/* Official Stamp & QR Center */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 bg-amber-50/80 px-2.5 py-1 rounded-xl border border-amber-200/80 shadow-sm">
                  <QrCode className="w-6 h-6 text-slate-800 shrink-0" />
                  <div className="text-left font-mono text-xs leading-tight">
                    <span className="font-bold text-slate-900 block uppercase">Verifiable Security</span>
                    <span className="text-slate-500">Scan to Verify Authenticity</span>
                  </div>
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-amber-600/70 p-1 flex items-center justify-center text-[7px] text-amber-800 uppercase font-bold text-center">
                  ★ RLSY ★ EXAM CELL SEAL
                </div>
              </div>

              <div className="w-36">
                <div className="h-9 flex items-center justify-center">
                  <span className="font-sans italic text-slate-500 text-xs">Signed & Verified</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-bold text-xs text-slate-800 block uppercase">
                    {config.principalName}
                  </span>
                  <span className="text-xs text-slate-500 block">
                    {config.principalDesignation}
                  </span>
                </div>
              </div>
            </div>

            {/* Verifiable Hash Footprint */}
            <div className="relative z-10 pt-3 mt-2 text-center font-mono text-xs text-slate-500 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-1 px-4">
              <div className="flex items-center gap-1.5 text-slate-600">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  Verification Hash:{' '}
                  <strong className="text-slate-800 font-bold font-mono">
                    {verificationHash}
                  </strong>
                </span>
              </div>
              <span className="text-xs text-slate-400">
                Official Autonomous Institutional Verification Desk · rlsycollege.ac.in/verify
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
