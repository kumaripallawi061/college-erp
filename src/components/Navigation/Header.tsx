import React, { useState } from 'react';
import { UserAccount, CollegeProfile, ModulePermissionMap, ModuleKey } from '../../types/erp';
import { useIsMobile } from '../../hooks/useIsMobile';
import { canUserAccessModule, MODULE_CATALOG } from '../../domain/rbac/permissions';
import {
  GraduationCap,
  Users,
  CalendarCheck,
  CreditCard,
  Award,
  BookOpen,
  RotateCcw,
  ShieldCheck,
  Building2,
  Layers,
  UserPlus,
  LogOut,
  FileText,
  Compass,
  Trophy,
  FileSpreadsheet,
  Landmark,
  Inbox,
  Settings,
  Sliders,
  Menu,
  X,
  FileCheck,
  Activity,
  Search,
} from 'lucide-react';

interface HeaderProps {
  currentUser: UserAccount;
  collegeProfile: CollegeProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  modulePermissions: ModulePermissionMap;
  onOpenAuth: () => void;
  onOpenCollegeProfile: () => void;
  onOpenUserManagement: () => void;
  onOpenModulePermissions: () => void;
  onOpenSystemHealth?: () => void;
  onOpenGlobalSearch?: () => void;
  onResetData: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  collegeProfile,
  activeTab,
  setActiveTab,
  modulePermissions,
  onOpenAuth,
  onOpenCollegeProfile,
  onOpenUserManagement,
  onOpenModulePermissions,
  onOpenSystemHealth,
  onOpenGlobalSearch,
  onResetData,
  onSignOut,
}) => {
  const isMobile = useIsMobile(640);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSuperAdmin = currentUser.role === 'superadmin';
  const isPrincipal = currentUser.role === 'principal';
  const isFaculty = currentUser.role === 'faculty';
  const isStudent = currentUser.role === 'student';

  // Hide Reset Demo State outside dev demo mode
  const isDemoModeEnabled = Boolean(
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true'
  );

  // Canonical RBAC check shared with ProtectedRoute, Sidebar, and Server
  const hasAccess = (key: ModuleKey): boolean => {
    return canUserAccessModule(currentUser, key, modulePermissions);
  };

  const getRoleBadgeStyle = (role: string): string => {
    const map: Record<string, string> = {
      superadmin: 'bg-purple-900/80 text-purple-200 border-purple-600',
      principal: 'bg-blue-900/80 text-blue-200 border-blue-600',
      accountant: 'bg-emerald-900/80 text-emerald-200 border-emerald-600',
      faculty: 'bg-amber-900/80 text-amber-200 border-amber-600',
      student: 'bg-indigo-900/80 text-indigo-200 border-indigo-600',
      librarian: 'bg-cyan-900/80 text-cyan-200 border-cyan-600',
      dean_academics: 'bg-amber-900/80 text-amber-200 border-amber-600',
    };
    return map[role] || 'bg-teal-900/80 text-teal-200 border-teal-600';
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-xl sticky top-0 z-40">
      {/* Top Bar: Institutional Crest, Active Session Profile, Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80">
        {/* Crest & College Name */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-400 p-0.5 shadow-md flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg tracking-tight text-white uppercase">
                {collegeProfile.shortName || 'RLSY COLLEGE ERP'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans hidden sm:block truncate max-w-md">
              {collegeProfile.name}
            </p>
          </div>
        </div>

        {/* Right Controls: Desktop View */}
        {!isMobile && (
          <div className="flex items-center flex-wrap gap-2">
            {/* Global Roll Number Quick Search Button for Staff */}
            {!isStudent && onOpenGlobalSearch && (
              <button
                type="button"
                onClick={onOpenGlobalSearch}
                aria-label="Search students by Roll Number"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-2"
              >
                <Search className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xl:inline">Search Roll No</span>
                <kbd className="px-1.5 py-0.5 text-xs font-mono bg-slate-900 text-slate-400 rounded border border-slate-700">
                  ⌘K
                </kbd>
              </button>
            )}

            {/* Super Admin Master Tools */}
            {isSuperAdmin && (
              <div className="flex items-center gap-1.5 bg-purple-950/40 border border-purple-800/60 rounded-xl p-1">
                <button
                  type="button"
                  onClick={onOpenCollegeProfile}
                  className="px-2.5 py-1 text-xs font-bold text-purple-200 hover:text-white hover:bg-purple-800/50 rounded-lg transition flex items-center gap-1.5"
                  title="Edit College Profile (Reflects Everywhere)"
                >
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden md:inline">College Profile</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenModulePermissions}
                  className="px-2.5 py-1 text-xs font-bold text-purple-200 hover:text-white hover:bg-purple-800/50 rounded-lg transition flex items-center gap-1.5"
                  title="Map / Remove Modules for User Roles"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden md:inline">Module RBAC</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenUserManagement}
                  className="px-2.5 py-1 text-xs font-bold text-purple-200 hover:text-white hover:bg-purple-800/50 rounded-lg transition flex items-center gap-1.5"
                  title="Onboard Principal and Accountant"
                >
                  <UserPlus className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden md:inline">Onboard Staff</span>
                </button>
              </div>
            )}

            {/* Principal Shortcuts */}
            {isPrincipal && (
              <div className="flex items-center gap-1.5 bg-blue-950/40 border border-blue-800/60 rounded-xl p-1">
                <button
                  type="button"
                  onClick={onOpenUserManagement}
                  className="px-2.5 py-1 text-xs font-bold text-blue-200 hover:text-white hover:bg-blue-800/50 rounded-lg transition flex items-center gap-1.5"
                  title="Onboard Faculty Members"
                >
                  <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden md:inline">Onboard Faculty</span>
                </button>
              </div>
            )}

            {/* Active Logged-In User Identity Card */}
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 hover:border-slate-500 transition shadow-sm text-right"
              title="Click to view credentials or switch account profile"
            >
              <div>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="font-bold text-xs text-slate-100">{currentUser.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase border ${getRoleBadgeStyle(
                      currentUser.role
                    )}`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <span className="text-xs text-slate-400 block font-mono">
                  {currentUser.role === 'student' && currentUser.rollNo
                    ? `Roll No: ${currentUser.rollNo}`
                    : currentUser.email}
                </span>
              </div>
            </button>

            {/* System Health Diagnostics Prober */}
            {(isSuperAdmin || isPrincipal) && onOpenSystemHealth && (
              <button
                type="button"
                onClick={onOpenSystemHealth}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 text-xs font-bold rounded-xl transition"
                title="System Health & Integrity Diagnostics"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">Diagnostics</span>
              </button>
            )}

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-bold rounded-xl transition"
              title="Sign out and return to default Student Sign In page"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            {/* Reset Clean Demo State (Superadmin + Demo Mode Only) */}
            {isSuperAdmin && isDemoModeEnabled && (
              <button
                type="button"
                onClick={onResetData}
                aria-label="Reset ERP data to clean demo state"
                className="p-2 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded-xl transition"
                title="Reset ERP data to clean demo state (Requires typed RESET confirmation)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Right Controls: Mobile View Toggle & Role Badge */}
        {isMobile && (
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${getRoleBadgeStyle(
                currentUser.role
              )}`}
            >
              {currentUser.role}
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-amber-400" />
              ) : (
                <Menu className="w-5 h-5 text-slate-200" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Mobile Menu Drawer */}
      {isMobile && mobileMenuOpen && (
        <div className="w-full bg-slate-950/95 border-b border-slate-800 p-4 space-y-3 animate-in slide-in-from-top-2">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="font-bold text-sm text-white block">{currentUser.name}</span>
              <span className="text-xs text-slate-400 font-mono block">
                {currentUser.role === 'student' && currentUser.rollNo
                  ? `Roll No: ${currentUser.rollNo}`
                  : currentUser.email}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${getRoleBadgeStyle(
                currentUser.role
              )}`}
            >
              {currentUser.role}
            </span>
          </div>

          {/* Mobile Grouped Module Links for Staff */}
          {!isStudent && (
            <div className="space-y-2 pt-1 max-h-60 overflow-y-auto">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block font-mono">
                All Authorized Modules
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {MODULE_CATALOG.filter((m) => hasAccess(m.key)).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(m.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold text-left truncate border transition ${
                      activeTab === m.key
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {m.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSuperAdmin && (
            <div className="space-y-1.5 pt-1">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block font-mono">
                Administrative Tools
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenCollegeProfile();
                  }}
                  className="w-full px-3 py-2.5 min-h-[44px] text-xs font-bold text-purple-200 bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800/60 rounded-xl transition flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4 text-purple-400" />
                  <span>College Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenModulePermissions();
                  }}
                  className="w-full px-3 py-2.5 min-h-[44px] text-xs font-bold text-purple-200 bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800/60 rounded-xl transition flex items-center gap-2"
                >
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>Module RBAC Matrix</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenUserManagement();
                  }}
                  className="w-full px-3 py-2.5 min-h-[44px] text-xs font-bold text-purple-200 bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800/60 rounded-xl transition flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4 text-purple-400" />
                  <span>Onboard Staff</span>
                </button>
                {onOpenSystemHealth && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenSystemHealth();
                    }}
                    className="w-full px-3 py-2.5 min-h-[44px] text-xs font-bold text-emerald-200 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-xl transition flex items-center gap-2"
                  >
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>System Health Diagnostics</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {isPrincipal && (
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenUserManagement();
                }}
                className="w-full px-3 py-2.5 min-h-[44px] text-xs font-bold text-blue-200 bg-blue-950/50 hover:bg-blue-900/60 border border-blue-800/60 rounded-xl transition flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4 text-blue-400" />
                <span>Onboard Faculty Members</span>
              </button>
            </div>
          )}

          {isSuperAdmin && isDemoModeEnabled && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onResetData();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl border border-slate-700 transition"
              >
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>Reset Demo State</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onSignOut();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Horizontal Module Bar on Tablet Screens (lg uses grouped Sidebar) */}
      {!isStudent &&
        (() => {
          const allNavItems: Array<{
            key: ModuleKey;
            label: string;
            icon: React.ReactNode;
            activeClass: string;
            inactiveClass?: string;
          }> = [
            {
              key: 'overview',
              label: 'Overview',
              icon: <ShieldCheck className="w-4 h-4" />,
              activeClass: 'bg-indigo-600 text-white shadow-sm',
            },
            {
              key: 'teacher_mapping',
              label: 'Teacher Tagging',
              icon: <Compass className="w-4 h-4 text-purple-300" />,
              activeClass: 'bg-purple-600 text-white shadow-sm',
            },
            {
              key: 'grade_settings',
              label: 'Grade Setting',
              icon: <Sliders className="w-4 h-4 text-amber-300" />,
              activeClass: 'bg-amber-600 text-white shadow-sm',
            },
            {
              key: 'congratulations',
              label: 'Congratulations Dashboard',
              icon: <Trophy className="w-4 h-4 text-amber-400" />,
              activeClass: 'bg-amber-500 text-slate-950 font-bold shadow-sm',
              inactiveClass: 'text-amber-300 hover:text-white hover:bg-slate-800',
            },
            {
              key: 'faculty_portal',
              label: 'Faculty Portal',
              icon: <Users className="w-4 h-4 text-amber-300" />,
              activeClass: 'bg-amber-600 text-white shadow-sm',
            },
            {
              key: 'attendance',
              label: 'Student Attendance',
              icon: <CalendarCheck className="w-4 h-4" />,
              activeClass: 'bg-indigo-600 text-white shadow-sm',
            },
            {
              key: 'fees',
              label: 'Fee Module',
              icon: <CreditCard className="w-4 h-4" />,
              activeClass: 'bg-indigo-600 text-white shadow-sm',
            },
            {
              key: 'grades',
              label: 'Grade Management',
              icon: <Award className="w-4 h-4" />,
              activeClass: 'bg-indigo-600 text-white shadow-sm',
            },
            {
              key: 'enrollment',
              label: 'Enrollment Module',
              icon: <FileText className="w-4 h-4" />,
              activeClass: 'bg-emerald-600 text-white shadow-sm',
            },
            {
              key: 'stream_mapping',
              label: 'Course & Stream Mapping',
              icon: <Layers className="w-4 h-4 text-indigo-400" />,
              activeClass: 'bg-indigo-600 text-white shadow-sm',
            },
            {
              key: 'marksheet_designer',
              label: 'CBCS Marksheet Designer',
              icon: <FileCheck className="w-4 h-4 text-purple-300" />,
              activeClass: 'bg-purple-600 text-white shadow-sm',
            },
            {
              key: 'certificate_designer',
              label: 'Certificate Designer',
              icon: <Award className="w-4 h-4 text-amber-400" />,
              activeClass: 'bg-indigo-600 text-white shadow-sm',
            },
            {
              key: 'reconciliation_3way',
              label: '3-Way Reconcile',
              icon: <Landmark className="w-4 h-4 text-emerald-400" />,
              activeClass: 'bg-emerald-600 text-white shadow-sm',
            },
            {
              key: 'accountant_requests',
              label: 'Service Requests',
              icon: <Inbox className="w-4 h-4 text-indigo-300" />,
              activeClass: 'bg-indigo-600 text-white shadow-sm',
            },
            {
              key: 'reports',
              label: 'Reports & Census',
              icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />,
              activeClass: 'bg-indigo-600 text-white shadow-sm',
            },
            {
              key: 'student_promotion',
              label: 'Student Promotion',
              icon: <GraduationCap className="w-4 h-4 text-emerald-400" />,
              activeClass: 'bg-emerald-600 text-white shadow-sm',
            },
            {
              key: 'role_permissions',
              label: 'Role Permissions',
              icon: <Sliders className="w-4 h-4 text-purple-300" />,
              activeClass: 'bg-purple-600 text-white shadow-sm',
            },
            {
              key: 'admin_settings',
              label: 'Gateway & Settings',
              icon: <Settings className="w-4 h-4 text-amber-400" />,
              activeClass: 'bg-slate-800 text-amber-300 border border-amber-500/40 shadow-sm',
            },
            {
              key: 'student_portal',
              label: 'Student Portal',
              icon: <BookOpen className="w-4 h-4" />,
              activeClass: 'bg-indigo-600 text-white shadow-sm',
            },
          ];

          let orderedKeys: ModuleKey[] = [];
          if (isPrincipal) {
            const principalOrder: ModuleKey[] = [
              'overview',
              'teacher_mapping',
              'grade_settings',
              'congratulations',
            ];
            const remaining = allNavItems
              .map((item) => item.key)
              .filter((k) => !principalOrder.includes(k));
            orderedKeys = [...principalOrder, ...remaining];
          } else if (isFaculty) {
            const facultyOrder: ModuleKey[] = [
              'faculty_portal',
              'attendance',
              'grades',
              'congratulations',
            ];
            const remaining = allNavItems
              .map((item) => item.key)
              .filter((k) => !facultyOrder.includes(k));
            orderedKeys = [...facultyOrder, ...remaining];
          } else {
            orderedKeys = allNavItems.map((item) => item.key);
          }

          const visibleItems = orderedKeys
            .filter((k) => hasAccess(k))
            .map((k) => allNavItems.find((item) => item.key === k)!)
            .filter(Boolean);

          return (
            <div className="lg:hidden max-w-7xl mx-auto px-4 sm:px-6">
              <nav
                aria-label="Tablet Module Navigation"
                className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none"
              >
                {visibleItems.map((item) => {
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
                        isActive
                          ? item.activeClass
                          : item.inactiveClass ||
                            'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          );
        })()}
    </header>
  );
};
