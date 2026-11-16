import React, { useState, useMemo, useEffect, useRef } from 'react';
import { exportJsonSheetsToExcelFile } from '../../utils/excelHelper';
import { getISTDateString } from '../../utils/erpLogic';
import {
  Student,
  ReportTypeDefinition,
  ReportParameterDef,
  UserRole,
} from '../../types/erp';
import {
  FileSpreadsheet,
  Filter,
  Download,
  Settings,
  Layers,
  CheckCircle2,
  Users,
  Search,
  RefreshCw,
  Plus,
  Shield,
  Sliders,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { Money } from '../Common/Rupee';

interface InstitutionalReportsModuleProps {
  currentRole: UserRole;
  students: Student[];
  availableCourses: string[];
  reportDefinitions: ReportTypeDefinition[];
  reportParameters: ReportParameterDef[];
  onSaveReportDefinitions?: (defs: ReportTypeDefinition[]) => void;
  onSaveReportParameters?: (params: ReportParameterDef[]) => void;
}

export const InstitutionalReportsModule: React.FC<InstitutionalReportsModuleProps> = ({
  currentRole,
  students,
  availableCourses,
  reportDefinitions,
  reportParameters,
  onSaveReportParameters,
}) => {
  // Tabs: 'generate' for Principal/Accountant/Admin, 'admin_config' for Admin
  const [activeTab, setActiveTab] = useState<'generate' | 'admin_config'>('generate');

  // Selected report type
  const [selectedReportId, setSelectedReportId] = useState<string>(
    reportDefinitions[0]?.id || 'rep-1'
  );

  // Active filter values (parameter key -> array of selected values or string)
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({
    gender: 'All',
    caste: 'All',
    course: 'All',
    semester: 'All',
    status: 'All',
    fee_status: 'All',
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Editable parameters for Admin (kept synchronized with parent props)
  const [adminParams, setAdminParams] = useState<ReportParameterDef[]>(reportParameters);
  const [saveNotice, setSaveNotice] = useState(false);
  const [saveError, setSaveError] = useState('');
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setAdminParams(reportParameters);
  }, [reportParameters]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // Active parameter definitions (only those enabled by admin)
  const activeParams = useMemo(() => {
    return reportParameters.filter((p) => p.enabled);
  }, [reportParameters]);

  const currentReportDef = useMemo(() => {
    return reportDefinitions.find((r) => r.id === selectedReportId) || reportDefinitions[0];
  }, [reportDefinitions, selectedReportId]);

  // Filter students based on selected parameters & search term
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          s.name.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          (s.registerNo && s.registerNo.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // Gender filter
      if (selectedFilters['gender'] && selectedFilters['gender'] !== 'All') {
        const sGender = String(s.gender || s.enrollmentData?.gender || '').toLowerCase();
        if (sGender !== selectedFilters['gender'].toLowerCase()) return false;
      }

      // Caste / Category filter
      if (selectedFilters['caste'] && selectedFilters['caste'] !== 'All') {
        const sCaste = String(s.casteCategory || s.enrollmentData?.category || '').toUpperCase();
        if (sCaste !== selectedFilters['caste'].toUpperCase()) return false;
      }

      // Course filter
      if (selectedFilters['course'] && selectedFilters['course'] !== 'All') {
        if (!s.course.toLowerCase().includes(selectedFilters['course'].toLowerCase())) return false;
      }

      // Semester filter
      if (selectedFilters['semester'] && selectedFilters['semester'] !== 'All') {
        if (String(s.semester) !== String(selectedFilters['semester'])) return false;
      }

      // Status filter
      const sStatus = s.status || (s.hallTicketBlocked ? 'suspended' : 'active');
      if (selectedFilters['status'] && selectedFilters['status'] !== 'All') {
        if (sStatus.toLowerCase() !== selectedFilters['status'].toLowerCase()) return false;
      }

      // Fee Status filter
      const sFeeDue = s.feeDue !== undefined ? s.feeDue : s.pendingFee;
      if (selectedFilters['fee_status'] && selectedFilters['fee_status'] !== 'All') {
        const isPaid = sFeeDue <= 0;
        if (selectedFilters['fee_status'] === 'Paid' && !isPaid) return false;
        if (selectedFilters['fee_status'] === 'Defaulter' && isPaid) return false;
      }

      return true;
    });
  }, [students, selectedFilters, searchTerm]);

  // Stable Pagination State (gracefully clamped without resetting on background prop updates)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedStudents = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, safePage, pageSize]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = filteredStudents.length;
    const totalDue = filteredStudents.reduce(
      (acc, s) => acc + (s.feeDue !== undefined ? s.feeDue : s.pendingFee),
      0
    );
    const defaulters = filteredStudents.filter(
      (s) => (s.feeDue !== undefined ? s.feeDue : s.pendingFee) > 0
    ).length;
    const avgAttendance =
      total > 0
        ? filteredStudents.reduce((acc, s) => acc + (s.attendancePercentage ?? 0), 0) / total
        : 0;
    return { total, totalDue, defaulters, avgAttendance };
  }, [filteredStudents]);

  // Export to Excel handler
  const handleExportExcel = () => {
    const dataRows = filteredStudents.map((s, idx) => ({
      'S.No': idx + 1,
      'Roll Number': s.rollNo,
      'Full Name': s.name,
      'Course': s.course,
      'Semester': s.semester,
      'Gender': s.gender || s.enrollmentData?.gender || 'N/A',
      'Caste / Category': s.casteCategory || s.enrollmentData?.category || 'General',
      'Status': (s.status || (s.hallTicketBlocked ? 'SUSPENDED' : 'ACTIVE')).toUpperCase(),
      'Attendance (%)': `${(s.attendancePercentage ?? 0).toFixed(1)}%`,
      'Fee Due (INR)': s.feeDue !== undefined ? s.feeDue : s.pendingFee,
      'Hall Ticket Status': s.hallTicketBlocked ? 'BLOCKED' : 'CLEARED',
      'Contact Number': s.phone || 'N/A',
    }));

    const reportName = currentReportDef?.name || currentReportDef?.title || 'Report';
    const fileName = `RLSY_${reportName.replace(/\s+/g, '_')}_${getISTDateString()}.xlsx`;
    void exportJsonSheetsToExcelFile(
      [{ sheetName: 'Institutional_Report', rows: dataRows }],
      fileName
    );
  };

  const resetFilters = () => {
    setSelectedFilters({
      gender: 'All',
      caste: 'All',
      course: 'All',
      semester: 'All',
      status: 'All',
      fee_status: 'All',
    });
    setSearchTerm('');
  };

  // Toggle admin parameter enabled status
  const handleToggleParam = (key: string) => {
    if (currentRole !== 'superadmin') return;
    setSaveError('');
    const updated = adminParams.map((p) =>
      (p.key || p.id) === key ? { ...p, enabled: !p.enabled } : p
    );
    try {
      onSaveReportParameters?.(updated);
      setAdminParams(updated);
      setSaveNotice(true);
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setSaveNotice(false), 2500);
    } catch (err: any) {
      setSaveError(err?.message || 'Unable to save report parameter configuration.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-300 text-xs font-mono font-bold tracking-wider uppercase mb-1">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Statutory Institutional Intelligence</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Institutional Reports & Demographic Census
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-2xl leading-relaxed">
              Generate single and combined parameter reports across Gender, Caste Categories, Streams, Semesters, Attendance, and Ledger Dues with instant Excel export.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {currentRole === 'superadmin' && (
              <button
                onClick={() => setActiveTab(activeTab === 'generate' ? 'admin_config' : 'generate')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                  activeTab === 'admin_config'
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-white/10 text-white hover:bg-white/20 border-white/20'
                }`}
              >
                <Sliders className="w-4 h-4" />
                {activeTab === 'admin_config' ? 'Back to Reports' : 'Admin Parameter Config'}
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>

      {saveError && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          {saveError}
        </div>
      )}

      {saveNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Report parameter configuration saved successfully.
        </div>
      )}

      {/* VIEW 1: ADMIN CONFIGURATION */}
      {activeTab === 'admin_config' && currentRole === 'superadmin' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Admin Report Parameter Governance
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select which demographic and academic parameters will appear as options for selection by the Accountant and Principal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminParams.map((param) => {
              const pKey = param.key || param.id;
              return (
                <div
                  key={pKey}
                  className={`p-4 rounded-xl border-2 transition ${
                    param.enabled
                      ? 'border-indigo-500/40 bg-indigo-50/20'
                      : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{param.label}</span>
                    <input
                      type="checkbox"
                      checked={param.enabled}
                      onChange={() => handleToggleParam(pKey)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Key: <code className="font-mono text-slate-700">{pKey}</code>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {param.options.map((opt) => (
                      <span
                        key={opt}
                        className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-mono"
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VIEW 2: REPORT GENERATOR */
        <div className="space-y-6">
          {/* Report Type Selector Strip */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Select Institutional Report Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {reportDefinitions.map((def) => {
                const dName = def.name || def.title;
                return (
                  <button
                    key={def.id}
                    onClick={() => setSelectedReportId(def.id)}
                    className={`p-3.5 rounded-xl text-left border-2 transition ${
                      selectedReportId === def.id
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold uppercase text-indigo-600">
                        {def.category}
                      </span>
                      {selectedReportId === def.id && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">
                      {dName}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {def.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Combined Parameter Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Combined Parameter Filter Engine
                </h3>
              </div>
              <button
                onClick={resetFilters}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Reset All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Dynamic Parameter: Course */}
              {activeParams.some((p) => p.key === 'course') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course / Stream
                  </label>
                  <select
                    value={selectedFilters['course']}
                    onChange={(e) =>
                      setSelectedFilters({ ...selectedFilters, course: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="All">All Courses & Streams</option>
                    {availableCourses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Parameter: Semester */}
              {activeParams.some((p) => p.key === 'semester') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Semester
                  </label>
                  <select
                    value={selectedFilters['semester']}
                    onChange={(e) =>
                      setSelectedFilters({ ...selectedFilters, semester: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="All">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={String(s)}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Parameter: Gender */}
              {activeParams.some((p) => p.key === 'gender') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={selectedFilters['gender']}
                    onChange={(e) =>
                      setSelectedFilters({ ...selectedFilters, gender: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="All">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              {/* Dynamic Parameter: Caste / Social Category */}
              {activeParams.some((p) => p.key === 'caste') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Caste / Category
                  </label>
                  <select
                    value={selectedFilters['caste']}
                    onChange={(e) =>
                      setSelectedFilters({ ...selectedFilters, caste: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="All">All Categories</option>
                    <option value="General">General (UR)</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="EWS">EWS</option>
                  </select>
                </div>
              )}

              {/* Dynamic Parameter: Academic Status */}
              {activeParams.some((p) => p.key === 'status') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Enrollment Status
                  </label>
                  <select
                    value={selectedFilters['status']}
                    onChange={(e) =>
                      setSelectedFilters({ ...selectedFilters, status: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="All">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="alumni">Alumni</option>
                  </select>
                </div>
              )}

              {/* Dynamic Parameter: Fee Clearance */}
              {activeParams.some((p) => p.key === 'fee_status') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fee Clearance Status
                  </label>
                  <select
                    value={selectedFilters['fee_status']}
                    onChange={(e) =>
                      setSelectedFilters({ ...selectedFilters, fee_status: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="All">All Fee Statuses</option>
                    <option value="Paid">Nil Dues / Fully Paid</option>
                    <option value="Defaulter">Fee Defaulter (Outstanding)</option>
                  </select>
                </div>
              )}

              {/* Search input */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Search by Student Name or Roll Number
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Type name, roll number, registration no..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-xs uppercase font-bold text-slate-500">Matching Records</span>
              <p className="text-2xl font-black text-slate-900 font-mono mt-1">{stats.total}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-xs uppercase font-bold text-slate-500">Total Dues in Scope</span>
              <p className="text-2xl font-black text-indigo-700 font-mono mt-1">
                <Money amount={stats.totalDue} />
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-xs uppercase font-bold text-slate-500">Defaulter Students</span>
              <p className="text-2xl font-black text-rose-600 font-mono mt-1">{stats.defaulters}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-xs uppercase font-bold text-slate-500">Avg Attendance</span>
              <p className="text-2xl font-black text-emerald-600 font-mono mt-1">
                {stats.avgAttendance.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Result Data Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {currentReportDef?.name || currentReportDef?.title || 'Report'} — Tabular Result
                </h4>
                <p className="text-xs text-slate-500">
                  Showing {filteredStudents.length} rows conforming to applied single / combined criteria.
                </p>
              </div>
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Sem</th>
                    <th className="px-4 py-3">Gender</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Attendance</th>
                    <th className="px-4 py-3 text-right">Fee Dues</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        No students match the chosen combined parameters.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((s) => {
                      const due = s.feeDue !== undefined ? s.feeDue : s.pendingFee;
                      const sStat = s.status || (s.hallTicketBlocked ? 'suspended' : 'active');
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 font-mono font-bold text-slate-800">
                            {s.rollNo}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {s.name}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{s.course}</td>
                          <td className="px-4 py-3 font-mono">Sem {s.semester}</td>
                          <td className="px-4 py-3 text-slate-600 capitalize">
                            {s.gender || s.enrollmentData?.gender || 'N/A'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">
                            {s.casteCategory || s.enrollmentData?.category || 'General'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            <span
                              className={
                                s.attendancePercentage < 75 ? 'text-rose-600' : 'text-emerald-600'
                              }
                            >
                              {s.attendancePercentage.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            {due > 0 ? (
                              <span className="text-rose-600">
                                <Money amount={due} />
                              </span>
                            ) : (
                              <span className="text-emerald-600">Nil</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                sStat === 'active'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {sStat}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Bar */}
            {filteredStudents.length > pageSize && (
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <span className="font-medium">
                  Showing <strong className="text-slate-900">{(safePage - 1) * pageSize + 1}</strong> to{' '}
                  <strong className="text-slate-900">{Math.min(safePage * pageSize, filteredStudents.length)}</strong> of{' '}
                  <strong className="text-slate-900">{filteredStudents.length}</strong> records
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
                  >
                    Previous
                  </button>
                  <span className="font-mono font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
