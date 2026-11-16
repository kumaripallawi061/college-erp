import React, { useState, useMemo, useEffect } from 'react';
import {
  Student,
  ExamGradeRecord,
  FeeTransaction,
  AttendanceRecord,
  InstitutionalNotice,
  CongratulationMessage,
} from '../../types/erp';
import {
  calculateSGPA,
  getISTDateString,
  normalizeSafariDate,
  calculateAttendanceStats,
  toPaisa,
  fromPaisa,
} from '../../utils/erpLogic';
import {
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Award,
  AlertTriangle,
  Megaphone,
  Bell,
  Eye,
  LogOut,
  LayoutGrid,
  LifeBuoy,
  X,
  ExternalLink,
  Lock,
  Printer,
} from 'lucide-react';
import { erpStorage } from '../../services/erpStorage';

interface MobileStudentDashboardProps {
  student: Student;
  grades: ExamGradeRecord[];
  transactions: FeeTransaction[];
  attendanceRecords?: AttendanceRecord[];
  notices: InstitutionalNotice[];
  congratulationMessages: CongratulationMessage[];
  collegeName?: string;
  onPayDuesClick: (studentId: string) => void;
  onOpenNotice?: (notice: InstitutionalNotice) => void;
  onOpenMarksheet?: () => void;
  onOpenProfile?: () => void;
  onSwitchToDesktopPortal?: () => void;
  onOpenHonorsModal?: () => void;
  onSignOut?: () => void;
  onOpenSupport?: () => void;
}

const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

export const MobileStudentDashboard: React.FC<MobileStudentDashboardProps> = ({
  student,
  grades,
  transactions,
  attendanceRecords = [],
  notices,
  congratulationMessages,
  collegeName = 'RLSY College',
  onPayDuesClick,
  onOpenNotice,
  onOpenMarksheet,
  onOpenProfile,
  onSwitchToDesktopPortal,
  onOpenHonorsModal,
  onSignOut,
  onOpenSupport,
}) => {
  const [tab, setTab] = useState<'home' | 'notices' | 'fees' | 'profile'>('home');
  const [menu, setMenu] = useState(false);
  const [noticeTab, setNoticeTab] = useState<'active' | 'archived'>('active');
  const [storageTick, setStorageTick] = useState(0);

  useEffect(() => {
    const unsubscribe = erpStorage.subscribe(() => setStorageTick((t) => t + 1));
    return () => unsubscribe();
  }, []);

  // Compute Live SGPA & Credits from Published Semester Grades
  const sgpaData = useMemo(() => {
    const sem = student.semester || 1;
    const semGrades = grades.filter(
      (g) => g.studentId === student.id && g.semester === sem && g.status === 'Published'
    );
    const customScaleRules = erpStorage.getMarksheetConfig()?.gradingScaleRules;

    const entries = semGrades.map((g) => ({
      courseCode: g.subjectCode,
      credits: g.credits,
      marksObtained: g.totalMarks,
      maxMarks: g.maxMarks,
    }));

    const result = calculateSGPA(entries, customScaleRules);
    const sgpaVal: number = result.sgpa > 0 ? result.sgpa : 0;
    const finalTotalCredits = result.totalCredits > 0 ? result.totalCredits : 0;
    const finalEarnedCredits = result.earnedCredits > 0 ? result.earnedCredits : 0;

    return {
      value: sgpaVal,
      earned: finalEarnedCredits,
      total: finalTotalCredits,
    };
  }, [grades, student.id, student.semester, storageTick]);

  // Result Declaration Check (Principal / Accountant)
  const resultDeclarations = useMemo(() => erpStorage.getResultDeclarations(), [storageTick]);
  const activeDeclaration = useMemo(() => {
    const sem = student.semester || 1;
    return (
      resultDeclarations.find(
        (d) => d.semester === sem && (d.course === student.course || d.course === 'All Courses')
      ) || resultDeclarations.find((d) => d.semester === sem)
    );
  }, [resultDeclarations, student.semester, student.course]);

  const todayStr = getISTDateString();
  const isResultDeclared = useMemo(() => {
    if (activeDeclaration) {
      if (activeDeclaration.status === 'Embargoed') return false;
      if (activeDeclaration.isPublished === true || activeDeclaration.status === 'Published') return true;
      if (activeDeclaration.isPublished === false) return false;
      if (todayStr < activeDeclaration.declarationDate) return false;
    } else {
      return false;
    }

    const sem = student.semester || 1;
    const semStudentGrades = grades.filter(
      (g) => g.studentId === student.id && g.semester === sem
    );
    if (semStudentGrades.length > 0 && semStudentGrades.every((g) => g.status === 'Draft')) {
      return false;
    }
    return true;
  }, [activeDeclaration, todayStr, grades, student.id, student.semester]);

  // Live Fees Breakdown linked with transactions recorded in Fee Module (integer paisa arithmetic)
  const fees = useMemo(() => {
    const verifiedPaidPaisa = (transactions || [])
      .filter((t) => t.studentId === student.id && t.status === 'Success')
      .reduce((acc, t) => acc + toPaisa(t.amount), 0);
    const paidPaisa = verifiedPaidPaisa > 0 ? verifiedPaidPaisa : toPaisa(student.paidFee);
    const billedPaisa = toPaisa(student.totalFee);
    // student.totalFee is already stored net of concession; do not subtract concessionAmount a second time
    const duePaisa = Math.max(0, billedPaisa - paidPaisa);
    return {
      due: fromPaisa(duePaisa),
      billed: fromPaisa(billedPaisa),
      paid: fromPaisa(paidPaisa),
    };
  }, [transactions, student.id, student.paidFee, student.totalFee]);

  // Live Attendance linked with attendance marked by course faculty
  const attendance = useMemo(() => {
    const studentRecords = attendanceRecords.filter(
      (a) =>
        a.studentId === student.id ||
        (a.studentRollNo && a.studentRollNo.trim().toLowerCase() === student.rollNo.trim().toLowerCase())
    );
    const stats = calculateAttendanceStats(studentRecords);
    const val = stats.total > 0
      ? stats.percentage
      : Number((student.attendancePercentage ?? 0).toFixed(1));

    return {
      value: val,
      min: 75,
      isOnTrack: stats.status === 'unverified' ? true : !stats.isDefaulter,
      status: stats.status,
      markedDays: stats.total,
      presentDays: stats.effectivePresent,
    };
  }, [attendanceRecords, student.id, student.rollNo, student.attendancePercentage]);

  // Live Student Honors & Congratulations
  const honors = useMemo(() => {
    const studentMsgs = congratulationMessages.filter(
      (m) => m.rollNo?.trim().toLowerCase() === student.rollNo?.trim().toLowerCase()
    );
    const count = studentMsgs.length;
    const latestMsg = studentMsgs[0];

    return {
      count,
      latest:
        latestMsg?.title ||
        latestMsg?.message ||
        'No accolades recorded yet for current academic session',
      from:
        latestMsg?.awardedByName
          ? `${latestMsg.awardedByName}${latestMsg.awardedByDesignation ? ` (${latestMsg.awardedByDesignation})` : ''}`
          : 'Academic Council',
    };
  }, [congratulationMessages, student.rollNo]);

  // Live Filtered Notices for Student's Course
  const { activeNoticesList, archivedNoticesList } = useMemo(() => {
    const now = new Date().getTime();
    const studentCourse = (student.course || '').toLowerCase();
    const studentSem = student.semester || 1;

    const relevant = notices.filter((n) => {
      if (n.targetAudience === 'staff') return false;

      if (n.targetCourses && n.targetCourses.length > 0 && !n.targetCourses.includes('All')) {
        const matches = n.targetCourses.some((c) =>
          studentCourse.includes(c.toLowerCase()) || c.toLowerCase().includes(studentCourse)
        );
        if (!matches) return false;
      }

      if (n.targetSemesters && n.targetSemesters.length > 0 && !n.targetSemesters.includes(0)) {
        if (!n.targetSemesters.includes(studentSem)) return false;
      }
      return true;
    });

    const active: InstitutionalNotice[] = [];
    const archived: InstitutionalNotice[] = [];

    relevant.forEach((n) => {
      const parsedIssueDate = normalizeSafariDate(n.date);
      const issueTime = parsedIssueDate ? parsedIssueDate.getTime() : NaN;
      const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
      const isPastMonth = !isNaN(issueTime) && now - issueTime > oneMonthMs;
      const parsedEndDate = n.endDate ? normalizeSafariDate(n.endDate) : null;
      const isPastEndDate = parsedEndDate ? parsedEndDate.getTime() < now : false;

      if (isPastMonth || isPastEndDate || n.archived) {
        archived.push(n);
      } else {
        active.push(n);
      }
    });

    return { activeNoticesList: active, archivedNoticesList: archived };
  }, [notices, student.course, student.semester]);

  const go = (id: 'home' | 'notices' | 'fees' | 'profile') => {
    setTab(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="sd">
      <style>{css}</style>

      {/* Top Mobile Bar */}
      <header className="bar">
        <div className="brand">
          <span className="logo">🎓</span>
          <strong>{collegeName}</strong>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchToDesktopPortal && (
            <button
              onClick={onSwitchToDesktopPortal}
              className="text-xs font-bold px-2 py-1 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 rounded-lg flex items-center gap-1 transition"
              title="Open Comprehensive Desktop Academic Portal"
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Full Portal</span>
            </button>
          )}

          <button
            className="avatar"
            onClick={() => setMenu(!menu)}
            aria-label="Profile menu"
          >
            {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
          </button>
        </div>

        {menu && (
          <div className="menu" role="menu">
            <div className="who">
              <b>{student.name}</b>
              <span>Roll {student.rollNo}</span>
              <span className="text-xs text-indigo-600 mt-0.5">
                {student.course} • Sem {student.semester}
              </span>
            </div>
            {onOpenProfile && (
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  onOpenProfile();
                }}
                className="font-bold text-slate-800 flex items-center justify-between"
              >
                <span>Student Profile Section</span>
                <span className="text-xs">👤</span>
              </button>
            )}
            {onSwitchToDesktopPortal && (
              <button
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  onSwitchToDesktopPortal();
                }}
                className="font-bold text-indigo-600 flex items-center justify-between"
              >
                <span>Full Academic Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            {onSignOut && (
              <button
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMenu(false);
                  onSignOut();
                }}
              >
                Sign out
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Mobile Dashboard Canvas */}
      <main>
        {/* Outstanding Semester Fee Due Alert */}
        {fees.due > 0 && (
          <section className="alert" id="home">
            <h2>Outstanding Semester Fee Due</h2>
            <p>
              Current outstanding semester dues: {inr(fees.due)}. Please settle your dues via Fee Clearance Slip or at the college accounts counter.
            </p>
            <button
              className="btn primary"
              onClick={() => onPayDuesClick(student.id)}
            >
              Pay {inr(fees.due)}
            </button>
          </section>
        )}

        {/* Attendance & SGPA Metric Tiles */}
        <div className="tiles">
          <div className={`tile ${attendance.isOnTrack ? 'ok' : 'bad-tile'}`}>
            <span className="label">Attendance</span>
            <b>{attendance.value}%</b>
            <div className="track">
              <i
                style={{
                  width: `${Math.min(100, attendance.value)}%`,
                  background: attendance.isOnTrack ? 'var(--good)' : 'var(--bad)',
                }}
              />
            </div>
            <small>
              Min {attendance.min}% · {attendance.isOnTrack ? 'on track' : 'attendance shortage'}
            </small>
          </div>

          <div className="tile">
            <span className="label">Academic Performance (Sem {student.semester})</span>
            {isResultDeclared ? (
              <>
                <b>{sgpaData.value.toFixed(2)}</b>
                <small>
                  Credits {sgpaData.earned}/{sgpaData.total} earned
                </small>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mt-1">
                  <b className="text-slate-400 font-mono text-2xl font-black">--</b>
                  <span className="text-xs text-slate-400 font-bold">SGPA</span>
                </div>
                <small className="text-slate-500 font-medium">
                  Pending Declaration
                </small>
              </>
            )}
            <button
              onClick={onOpenMarksheet || onSwitchToDesktopPortal}
              className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1.5 border-t border-slate-200 w-full min-h-[44px]"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>View Marksheet →</span>
            </button>
          </div>
        </div>

        {/* Fees Due & Paid Card */}
        <section className="card" id="fees">
          <div className="row">
            <span className="label">Fees due</span>
            <b className="bad">{inr(fees.due)}</b>
          </div>
          <div className="row sub">
            <span>Billed</span>
            <span>{inr(fees.billed)}</span>
          </div>
          <div className="row sub">
            <span>Paid</span>
            <span className="good">{inr(fees.paid)}</span>
          </div>
          {fees.due > 0 && (
            <button
              onClick={() => onPayDuesClick(student.id)}
              className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Pay Outstanding Dues Online
            </button>
          )}
        </section>

        {/* Honors & Congratulations Section */}
        <section className="honors">
          <div>
            <b>🎉 {honors.count} congratulation messages</b>
            <p>Latest: {honors.latest}, from {honors.from}</p>
          </div>
          <button
            className="btn dark"
            onClick={onOpenHonorsModal || onSwitchToDesktopPortal}
          >
            View honors &amp; awards
          </button>
        </section>

        {/* Notices & Circulars Card */}
        <section className="card" id="notices">
          <h2>Notices &amp; circulars</h2>
          <p className="muted">
            Active for 1 month · {student.course} Sem {student.semester}
          </p>

          <div className="seg">
            <button
              className={noticeTab === 'active' ? 'on' : ''}
              onClick={() => setNoticeTab('active')}
            >
              Active ({activeNoticesList.length})
            </button>
            <button
              className={noticeTab === 'archived' ? 'on' : ''}
              onClick={() => setNoticeTab('archived')}
            >
              Archived ({archivedNoticesList.length})
            </button>
          </div>

          {noticeTab === 'active' ? (
            activeNoticesList.length === 0 ? (
              <p className="muted empty">No active circulars at this moment.</p>
            ) : (
              <ul className="notices">
                {activeNoticesList.map((n) => (
                  <li key={n.id}>
                    <div className="tags">
                      <span className={`tag ${n.category ? n.category.toLowerCase() : 'general'}`}>
                        {n.category || 'General'}
                      </span>
                      {n.isPinned && <span className="tag pin">📌 Pinned</span>}
                    </div>
                    <p className="title">{n.title}</p>
                    <div className="row">
                      <time>{n.date}</time>
                      {onOpenNotice && (
                        <button
                          type="button"
                          className="link"
                          onClick={() => onOpenNotice(n)}
                        >
                          View notice
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : archivedNoticesList.length === 0 ? (
            <p className="muted empty">No archived notices yet.</p>
          ) : (
            <ul className="notices">
              {archivedNoticesList.map((n) => (
                <li key={n.id}>
                  <div className="tags">
                    <span className="tag general">{n.category}</span>
                  </div>
                  <p className="title">{n.title}</p>
                  <div className="row">
                    <time>{n.date}</time>
                    {onOpenNotice && (
                      <button
                        type="button"
                        className="link"
                        onClick={() => onOpenNotice(n)}
                      >
                        View notice
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Persistent Bottom Mobile Navigation Tabs */}
      <nav className="tabs">
        <button
          className={tab === 'home' ? 'on' : ''}
          onClick={() => go('home')}
        >
          <span>🏠</span>
          Home
        </button>

        <button
          className={tab === 'notices' ? 'on' : ''}
          onClick={() => go('notices')}
        >
          <span>📢</span>
          Notices
        </button>

        <button
          className={tab === 'fees' ? 'on' : ''}
          onClick={() => go('fees')}
        >
          <span>💳</span>
          Fees
        </button>

        <button
          className={tab === 'profile' ? 'on' : ''}
          onClick={() => {
            setTab('profile');
            if (onOpenProfile) {
              onOpenProfile();
            } else {
              setMenu(true);
            }
          }}
        >
          <span>👤</span>
          Profile
        </button>
      </nav>
    </div>
  );
};

const css = `
.sd{--ink:#0f172a;--mut:#64748b;--line:#e2e8f0;--bg:#f1f5f9;--brand:#4338ca;--bad:#dc2626;--good:#059669;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg);
  min-height:100vh;max-width:100%;overflow-x:hidden;padding-bottom:72px;box-sizing:border-box}
.sd *,.sd *::before,.sd *::after{box-sizing:border-box}
.sd button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}
.bar{position:sticky;top:0;z-index:20;height:52px;display:flex;align-items:center;justify-content:space-between;
  padding:0 14px;background:var(--ink);color:#fff}
.brand{display:flex;align-items:center;gap:8px;font-size:16px}
.logo{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#1e293b}
.avatar{width:32px;height:32px;border-radius:50%;background:var(--brand);color:#fff;font-weight:700}
.menu{position:absolute;right:12px;top:56px;width:220px;background:#fff;color:var(--ink);border-radius:12px;
  box-shadow:0 8px 28px rgba(15,23,42,.25);padding:6px;display:flex;flex-direction:column;z-index:50}
.menu button{text-align:left;padding:10px;border-radius:8px;font-size:13px}
.menu button:hover{background:var(--bg)}
.menu .danger{color:var(--bad)}
.who{display:flex;flex-direction:column;padding:10px;border-bottom:1px solid var(--line);margin-bottom:4px}
.who span{font-size:12px;color:var(--mut)}
main{padding:12px;display:flex;flex-direction:column;gap:12px;max-width:640px;margin:0 auto}
.alert{background:#fef2f2;border:1px solid #fecaca;border-radius:14px;padding:14px}
.alert h2{margin:0 0 4px;font-size:16px;color:#991b1b;font-weight:700}
.alert p{margin:0 0 12px;font-size:14px;color:#7f1d1d;line-height:1.4}
.btn{padding:12px 16px;border-radius:10px;font-weight:600;font-size:14px;width:100%}
.btn.primary{background:var(--bad);color:#fff}
.btn.dark{background:#7c2d12;color:#fff}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tile,.card{background:#fff;border-radius:14px;padding:14px;border:1px solid var(--line)}
.tile b{display:block;font-size:26px;line-height:1.2;margin:4px 0 6px}
.tile.ok b{color:var(--good)}
.tile.bad-tile b{color:var(--bad)}
.tile:not(.ok):not(.bad-tile) b{color:var(--brand)}
.tile small,.muted{color:var(--mut);font-size:12px}
.label{font-size:13px;color:var(--mut);font-weight:600}
.track{height:6px;background:var(--line);border-radius:3px;overflow:hidden;margin-bottom:6px}
.track i{display:block;height:100%;background:var(--good)}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px}
.row.sub{font-size:14px;color:var(--mut);margin-top:6px}
.bad{color:var(--bad);font-size:22px;font-weight:700}.good{color:var(--good);font-weight:600}
.honors{background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff;border-radius:14px;padding:14px;
  display:flex;flex-direction:column;gap:10px}
.honors p{margin:4px 0 0;font-size:13px;line-height:1.4;opacity:.95}
.card h2{margin:0 0 2px;font-size:17px;font-weight:700}
.seg{display:flex;gap:4px;background:var(--bg);padding:4px;border-radius:10px;margin:12px 0}
.seg button{flex:1;padding:8px;border-radius:8px;font-size:14px;color:var(--mut)}
.seg .on{background:#fff;color:var(--brand);font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.notices{list-style:none;margin:0;padding:0}
.notices li{padding:12px 0;border-top:1px solid var(--line)}
.notices li:first-child{border-top:0}
.tags{display:flex;gap:6px;flex-wrap:wrap}
.tag{font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;border:1px solid}
.tag.attendance{background:#fef2f2;color:#991b1b;border-color:#fecaca}
.tag.fees{background:#ecfdf5;color:#065f46;border-color:#a7f3d0}
.tag.examination{background:#fefce8;color:#854d0e;border-color:#fde68a}
.tag.general{background:#eef2ff;color:#3730a3;border-color:#c7d2fe}
.tag.pin{background:#fffbeb;color:#92400e;border-color:#fde68a}
.title{margin:8px 0;font-size:15px;font-weight:600;line-height:1.35;overflow-wrap:anywhere}
.notices time{font-size:12px;color:var(--mut)}
.link{color:var(--brand);font-weight:600;font-size:14px;padding:6px 0}
.empty{text-align:center;padding:16px 0}
.tabs{position:fixed;left:0;right:0;bottom:0;z-index:20;display:grid;grid-template-columns:repeat(4,1fr);
  background:#fff;border-top:1px solid var(--line);padding:6px 0 calc(6px + env(safe-area-inset-bottom,0px))}
.tabs button{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:var(--mut);padding:4px}
.tabs button span{font-size:18px}
.tabs .on{color:var(--brand);font-weight:700}
`;
