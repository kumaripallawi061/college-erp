import React, { useMemo, useState, useEffect } from 'react';
import {
  UserAccount,
  ModulePermissionMap,
  ModuleKey,
  Student,
} from '../../types/erp';
import {
  MODULE_CATALOG,
  ModuleCategory,
  canUserAccessModule,
} from '../../domain/rbac/permissions';
import {
  ShieldCheck,
  Compass,
  Sliders,
  Trophy,
  Users,
  CalendarCheck,
  CreditCard,
  Award,
  FileText,
  Layers,
  FileCheck,
  Landmark,
  Inbox,
  FileSpreadsheet,
  GraduationCap,
  Settings,
  BookOpen,
  Search,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Mail,
} from 'lucide-react';
import { Money } from '../Common/Rupee';
import { StatusBadge } from '../Common/StatusBadge';

interface SidebarProps {
  currentUser: UserAccount;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  modulePermissions: ModulePermissionMap;
  students?: Student[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  globalSearchOpen?: boolean;
  onCloseGlobalSearch?: () => void;
  onOpenGlobalSearch?: () => void;
}

const MODULE_ICONS: Record<ModuleKey, React.ReactNode> = {
  overview: <ShieldCheck className="w-4 h-4 shrink-0" />,
  teacher_mapping: <Compass className="w-4 h-4 shrink-0" />,
  grade_settings: <Sliders className="w-4 h-4 shrink-0" />,
  congratulations: <Trophy className="w-4 h-4 shrink-0" />,
  faculty_portal: <Users className="w-4 h-4 shrink-0" />,
  attendance: <CalendarCheck className="w-4 h-4 shrink-0" />,
  fees: <CreditCard className="w-4 h-4 shrink-0" />,
  campaigns: <CreditCard className="w-4 h-4 shrink-0" />,
  grades: <Award className="w-4 h-4 shrink-0" />,
  enrollment: <FileText className="w-4 h-4 shrink-0" />,
  stream_mapping: <Layers className="w-4 h-4 shrink-0" />,
  marksheet_designer: <FileCheck className="w-4 h-4 shrink-0" />,
  certificate_designer: <Award className="w-4 h-4 shrink-0" />,
  reconciliation_3way: <Landmark className="w-4 h-4 shrink-0" />,
  accountant_requests: <Inbox className="w-4 h-4 shrink-0" />,
  reports: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
  student_promotion: <GraduationCap className="w-4 h-4 shrink-0" />,
  role_permissions: <Sliders className="w-4 h-4 shrink-0" />,
  admin_settings: <Settings className="w-4 h-4 shrink-0" />,
  student_portal: <BookOpen className="w-4 h-4 shrink-0" />,
  college_profile: <ShieldCheck className="w-4 h-4 shrink-0" />,
  user_management: <Users className="w-4 h-4 shrink-0" />,
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  modulePermissions,
  students = [],
  collapsed = false,
  onToggleCollapse,
  globalSearchOpen = false,
  onCloseGlobalSearch,
  onOpenGlobalSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const isStudent = currentUser.role === 'student';

  // Keyboard shortcut Ctrl+K / Cmd+K for global roll number search
  useEffect(() => {
    if (isStudent) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (globalSearchOpen) {
          onCloseGlobalSearch?.();
        } else {
          onOpenGlobalSearch?.();
        }
      } else if (e.key === 'Escape' && globalSearchOpen) {
        onCloseGlobalSearch?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStudent, globalSearchOpen, onOpenGlobalSearch, onCloseGlobalSearch]);

  const authorizedModules = useMemo(() => {
    return MODULE_CATALOG.filter((m) =>
      canUserAccessModule(currentUser, m.key, modulePermissions)
    );
  }, [currentUser, modulePermissions]);

  const groupedModules = useMemo(() => {
    const groups: Record<ModuleCategory, Array<(typeof MODULE_CATALOG)[number]>> = {
      Academics: [],
      Finance: [],
      Administration: [],
    };
    for (const mod of authorizedModules) {
      groups[mod.category].push(mod);
    }
    return groups;
  }, [authorizedModules]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 8);
    return students
      .filter(
        (s) =>
          s.rollNo.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.registerNo && s.registerNo.toLowerCase().includes(q)) ||
          (s.course && s.course.toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [students, searchQuery]);

  if (isStudent) return null;

  const mobileBottomItems = authorizedModules.slice(0, 5);

  return (
    <>
      {/* Desktop Grouped Sidebar (Academics, Finance, Administration) */}
      <aside
        aria-label="Grouped ERP Module Navigation"
        className={`hidden lg:flex flex-col shrink-0 bg-slate-900 text-slate-200 border-r border-slate-800 transition-all duration-200 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Top Search & Collapse Trigger */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
          {!collapsed && (
            <button
              type="button"
              onClick={onOpenGlobalSearch}
              className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 transition"
              aria-label="Global student search by roll number"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Find Roll No...</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-xs font-mono bg-slate-900 text-slate-400 rounded border border-slate-700">
                ⌘K
              </kbd>
            </button>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={onOpenGlobalSearch}
              aria-label="Global student search by roll number"
              title="Search Student by Roll Number (Ctrl+K)"
              className="p-2 mx-auto rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              {collapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Grouped Navigation Sections */}
        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
          {(['Academics', 'Finance', 'Administration'] as ModuleCategory[]).map(
            (category) => {
              const items = groupedModules[category];
              if (!items || items.length === 0) return null;

              return (
                <div key={category} className="space-y-1">
                  {!collapsed && (
                    <div className="px-2.5 pb-1 text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                      {category}
                    </div>
                  )}
                  {items.map((item) => {
                    const isActive = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveTab(item.key)}
                        title={collapsed ? `${item.label} (${category})` : undefined}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                        } ${collapsed ? 'justify-center' : 'justify-between'}`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          {MODULE_ICONS[item.key]}
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </span>
                        {!collapsed && isActive && (
                          <ChevronRight className="w-3.5 h-3.5 text-indigo-200 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            }
          )}
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar for Staff Roles */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl"
      >
        {mobileBottomItems.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center min-h-[44px] px-2.5 py-1 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? 'text-amber-400 bg-slate-800/90 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {MODULE_ICONS[item.key]}
              <span className="mt-0.5 truncate max-w-[72px]">{item.shortLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenGlobalSearch}
          aria-label="Search student by roll number"
          className="flex flex-col items-center justify-center min-h-[44px] px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-400 hover:text-amber-300 transition"
        >
          <Search className="w-4 h-4" />
          <span className="mt-0.5">Search</span>
        </button>
      </nav>

      {/* Global Student Roll-Number Lookup Modal */}
      {globalSearchOpen && (
        <div
          className="fixed inset-0 z-[85] bg-slate-950/75 backdrop-blur-sm flex items-start justify-center p-4 pt-14 sm:pt-20"
          role="dialog"
          aria-modal="true"
          aria-label="Global Student Search by Roll Number"
        >
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center gap-3">
              <Search className="w-5 h-5 text-amber-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedStudent(null);
                }}
                placeholder="Search student by Roll Number (e.g. 2025CS001), Name, or Course..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={onCloseGlobalSearch}
                aria-label="Close global student search"
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-100">
              {selectedStudent ? (
                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-mono font-bold text-indigo-600 uppercase">
                        Roll No: {selectedStudent.rollNo}
                      </span>
                      <h3 className="text-lg font-black text-slate-900">
                        {selectedStudent.name}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {selectedStudent.course} • Semester {selectedStudent.semester}
                      </p>
                    </div>
                    <StatusBadge
                      status={
                        (selectedStudent.feeDue ?? selectedStudent.pendingFee) <= 0
                          ? 'paid'
                          : 'due'
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block">Attendance</span>
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {selectedStudent.attendancePercentage}%
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block">Section</span>
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {selectedStudent.section || 'A'}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block">Fee Paid</span>
                      <span className="font-mono font-bold text-sm text-emerald-700">
                        <Money amount={selectedStudent.paidFee} />
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block">Pending Due</span>
                      <span className="font-mono font-bold text-sm text-rose-700">
                        <Money
                          amount={
                            selectedStudent.feeDue ?? selectedStudent.pendingFee
                          }
                        />
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {selectedStudent.phone}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {selectedStudent.email}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      ← Back to search results
                    </button>
                    <button
                      type="button"
                      onClick={onCloseGlobalSearch}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No students matched "{searchQuery}". Try searching by Roll Number (e.g. 2025CS001).
                </div>
              ) : (
                searchResults.map((stu) => {
                  const due = stu.feeDue ?? stu.pendingFee;
                  return (
                    <button
                      key={stu.id}
                      type="button"
                      onClick={() => setSelectedStudent(stu)}
                      className="w-full px-5 py-3.5 text-left hover:bg-slate-50 transition flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {stu.rollNo}
                          </span>
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {stu.name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {stu.course} • Sem {stu.semester} • Attendance: {stu.attendancePercentage}%
                        </p>
                      </div>
                      <StatusBadge status={due <= 0 ? 'paid' : 'due'} />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
