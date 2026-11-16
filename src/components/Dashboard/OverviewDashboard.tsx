import React, { useState } from 'react';
import {
  Student,
  Faculty,
  FeeTransaction,
  AttendanceRecord,
  InstitutionalNotice,
  UserAccount,
  ModulePermissionMap,
} from '../../types/erp';
import {
  toPaisa,
  fromPaisa,
  paisaSumSafe,
  canUserAccessModule,
} from '../../utils/erpLogic';
import {
  Users,
  GraduationCap,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  Award,
  ArrowUpRight,
  TrendingUp,
  FileSpreadsheet,
  Megaphone,
  Clock,
  ShieldAlert,
  Plus,
} from 'lucide-react';
import { Money, RupeeIcon } from '../Common/Rupee';
import { NoticeBroadcastModal } from '../Common/NoticeBroadcastModal';

interface OverviewDashboardProps {
  students: Student[];
  faculty: Faculty[];
  transactions: FeeTransaction[];
  attendanceRecords: AttendanceRecord[];
  notices: InstitutionalNotice[];
  currentUser?: UserAccount;
  modulePermissions?: ModulePermissionMap;
  availableCourses?: string[];
  onNavigateTab: (tab: string) => void;
  onOpenPaymentModal: (studentId?: string) => void;
  onPostNotice?: (notice: Omit<InstitutionalNotice, 'id' | 'date'>) => void;
}

const INACTIVE_STUDENT_STATUSES = new Set([
  'Withdrawn',
  'Expelled',
  'Alumni',
  'Transferred',
  'Graduated',
  'Dropped',
]);

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  students,
  faculty,
  transactions,
  attendanceRecords,
  notices,
  currentUser,
  modulePermissions,
  availableCourses,
  onNavigateTab,
  onOpenPaymentModal,
  onPostNotice,
}) => {
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);

  const activeStudents = students.filter(
    (s) => !INACTIVE_STUDENT_STATUSES.has(s.status || 'Active')
  );
  const totalStudents = activeStudents.length;
  const totalCollectedPaisa = paisaSumSafe(activeStudents.map((s) => toPaisa(s.paidFee ?? 0)));
  const totalPendingPaisa = paisaSumSafe(activeStudents.map((s) => toPaisa(s.pendingFee ?? 0)));
  const totalCollected = fromPaisa(totalCollectedPaisa);
  const totalPending = fromPaisa(totalPendingPaisa);
  const totalExpectedPaisa = totalCollectedPaisa + totalPendingPaisa;
  const collectionPercentage =
    totalExpectedPaisa > 0 ? Math.round((totalCollectedPaisa / totalExpectedPaisa) * 100) : 0;

  const departmentCount =
    new Set(activeStudents.map((s) => s.course).filter(Boolean)).size ||
    availableCourses?.length ||
    0;

  const safeAtt = (s: Student) => {
    const val = Number(s.attendancePercentage ?? 0);
    return Number.isFinite(val) ? val : 0;
  };

  const defaulters = activeStudents.filter((s) => safeAtt(s) < 75);
  const blockedHallTickets = activeStudents.filter((s) => s.hallTicketBlocked);
  const eligibleHallTickets = activeStudents.filter((s) => !s.hallTicketBlocked);

  const avgAttendance =
    activeStudents.length > 0
      ? (activeStudents.reduce((sum, s) => sum + safeAtt(s), 0) / activeStudents.length).toFixed(1)
      : '0';

  const canAttendance = currentUser ? canUserAccessModule(currentUser, 'attendance', modulePermissions) : false;
  const canFees = currentUser ? canUserAccessModule(currentUser, 'fees', modulePermissions) : false;
  const canGrades = currentUser ? canUserAccessModule(currentUser, 'grades', modulePermissions) : false;
  const canFacultyPortal = currentUser ? canUserAccessModule(currentUser, 'faculty_portal', modulePermissions) : false;
  const canStudentPortal = currentUser ? canUserAccessModule(currentUser, 'student_portal', modulePermissions) : false;
  const canBroadcastNotice = Boolean(
    onPostNotice &&
      currentUser &&
      ['superadmin', 'principal', 'faculty'].includes(currentUser.role)
  );

  return (
    <div className="space-y-6">
      {/* Banner / Welcome */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Academic Session 2026-27 • Autumn Semester
              </span>
              <span className="text-xs text-slate-400 font-mono">Live ERP V2.4</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Institutional Governance Dashboard
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
              Monitoring real-time student attendance, automated fee reconciliation with integer Paisa arithmetic,
              UGC Choice-Based Credit System (CBCS) grading, and faculty classroom schedules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canBroadcastNotice && (
              <button
                type="button"
                onClick={() => setIsNoticeModalOpen(true)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
                title="Broadcast official notices to students, staff, or everyone"
              >
                <Megaphone className="w-4 h-4 text-slate-950" />
                Broadcast Notice
              </button>
            )}
            {canAttendance && (
              <button
                onClick={() => onNavigateTab('attendance')}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow transition flex items-center gap-2"
              >
                <CalendarCheck className="w-4 h-4" />
                Take Attendance
              </button>
            )}
            {canFees && (
              <button
                onClick={() => onOpenPaymentModal()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow transition flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Collect Fee
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Enrolled Students</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{totalStudents}</span>
            <span className="text-xs text-slate-500">
              across {departmentCount} {departmentCount === 1 ? 'department' : 'departments'}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Faculty strength: <strong>{faculty.length}</strong></span>
            <span className="text-indigo-600 font-medium">Active Cohort</span>
          </div>
        </div>

        {/* Total Fee Collected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fee Realized</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-600">
              <Money amount={totalCollected} iconClassName="w-6 h-6 mr-1" />
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Collection progress:</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {collectionPercentage}% of target
            </span>
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding Dues</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-rose-600">
              <Money amount={totalPending} iconClassName="w-6 h-6 mr-1" />
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Pending accounts:</span>
            <span className="font-semibold text-rose-600">
              {activeStudents.filter((s) => (s.pendingFee ?? 0) > 0).length} students
            </span>
          </div>
        </div>

        {/* Average Attendance & Defaulters */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avg Attendance</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{avgAttendance}%</span>
            <span className="text-xs text-slate-500">institutional avg</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Defaulters (&lt;75%):</span>
            <span className={`font-semibold px-2 py-0.5 rounded-full ${
              defaulters.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {defaulters.length} students
            </span>
          </div>
        </div>
      </div>

      {/* Hall Ticket & Academic Compliance Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Examination Hall Ticket Eligibility Status</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Students must have both: <strong>Outstanding Dues ≤ <RupeeIcon className="w-3 h-3 inline" />1,000</strong> AND <strong>Attendance ≥ 75.0%</strong> to download official admit card.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <div className="text-center">
                <span className="text-xs text-slate-500 block">Eligible</span>
                <span className="font-bold text-emerald-600 text-lg">{eligibleHallTickets.length}</span>
              </div>
              <div className="h-6 w-px bg-slate-300" />
              <div className="text-center">
                <span className="text-xs text-slate-500 block">Blocked</span>
                <span className="font-bold text-rose-600 text-lg">{blockedHallTickets.length}</span>
              </div>
            </div>

            {canStudentPortal && (
              <button
                onClick={() => onNavigateTab('student_portal')}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap"
              >
                Verify Hall Tickets
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Section: Quick Actions & Live Ledger + Institutional Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Transactions & Defaulters */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions Shortcuts */}
          {(canAttendance || canFees || canGrades || canFacultyPortal) && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm mb-3">Quick Operational Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {canAttendance && (
                  <button
                    onClick={() => onNavigateTab('attendance')}
                    className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl text-left transition group"
                  >
                    <CalendarCheck className="w-5 h-5 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-800 block">Roll Call</span>
                    <span className="text-xs text-slate-500">Mark lecture presence</span>
                  </button>
                )}

                {canFees && (
                  <button
                    onClick={() => onOpenPaymentModal()}
                    className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl text-left transition group"
                  >
                    <CreditCard className="w-5 h-5 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-800 block">Pay Student Fee</span>
                    <span className="text-xs text-slate-500">Generate receipt #</span>
                  </button>
                )}

                {canGrades && (
                  <button
                    onClick={() => onNavigateTab('grades')}
                    className="p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-xl text-left transition group"
                  >
                    <Award className="w-5 h-5 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-800 block">Enter Grades</span>
                    <span className="text-xs text-slate-500">CBCS 10-point scale</span>
                  </button>
                )}

                {canFacultyPortal && (
                  <button
                    onClick={() => onNavigateTab('faculty_portal')}
                    className="p-3 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 rounded-xl text-left transition group"
                  >
                    <Users className="w-5 h-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-800 block">Faculty Desk</span>
                    <span className="text-xs text-slate-500">Schedule & progress</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Recent Fee Transactions */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Recent Fee Collection Ledger</h3>
                <p className="text-xs text-slate-500">Settled through bank gateway & counter cash</p>
              </div>
              {canFees && (
                <button
                  onClick={() => onNavigateTab('fees')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  View Full Ledger
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Receipt #</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Fee Head</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {transactions.slice(0, 4).map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 font-mono font-medium text-slate-700">{tx.receiptNo}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900 block">{tx.studentName}</span>
                        <span className="text-xs text-slate-500 font-mono">{tx.studentRollNo}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate">{tx.feeHeadTitle}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded font-mono text-xs bg-slate-100 text-slate-700 border border-slate-200">
                          {tx.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600">
                        <Money amount={tx.amount} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">{tx.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col: Institutional Circulars & Notices */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-sm">Official Institutional Notices</h3>
              </div>
              {canBroadcastNotice && (
                <button
                  type="button"
                  onClick={() => setIsNoticeModalOpen(true)}
                  className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Issue Notice</span>
                </button>
              )}
            </div>

            <div className="space-y-3.5">
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                        notice.category === 'Attendance'
                          ? 'bg-rose-100 text-rose-700'
                          : notice.category === 'Fees'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {notice.category}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {notice.date}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 leading-snug">{notice.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                    {notice.content}
                  </p>
                  <div className="mt-2 text-xs text-slate-400 font-medium">
                    Issued by: {notice.authorName} ({notice.authorRole})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* NOTICE BROADCAST MODAL (PRINCIPAL / ADMIN) */}
      {canBroadcastNotice && onPostNotice && (
        <NoticeBroadcastModal
          isOpen={isNoticeModalOpen}
          onClose={() => setIsNoticeModalOpen(false)}
          authorName={currentUser?.name || 'Dr. S. N. Sharma'}
          authorRole={currentUser?.designation || (currentUser?.role === 'principal' ? 'Principal & Executive DDO' : 'Super Admin')}
          availableCourses={availableCourses}
          defaultCategory="Academic"
          onPostNotice={onPostNotice}
        />
      )}
    </div>
  );
};
