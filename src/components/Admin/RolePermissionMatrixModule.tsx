import React, { useState, useMemo } from 'react';
import { UserRole, ModuleKey, UserAccount, CustomRoleDefinition } from '../../types/erp';
import {
  ShieldAlert,
  CheckCircle2,
  Save,
  RotateCcw,
  Lock,
  Unlock,
  Sliders,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Users,
  Search,
  Plus,
  Trash2,
  Sparkles,
  X,
  UserPlus,
  Layers,
  BookOpen,
  Check,
} from 'lucide-react';
import { INITIAL_MODULE_PERMISSIONS } from '../../data/mockData';
import { erpStorage } from '../../services/erpStorage';
import { useErpStore } from '../../store/useErpStore';
import { getISTDateString } from '../../utils/erpLogic';

interface RolePermissionMatrixModuleProps {
  currentPermissions: Record<UserRole, ModuleKey[]>;
  onSavePermissions: (permissions: Record<UserRole, ModuleKey[]>) => void;
  allUsers?: UserAccount[];
  onToggleUserGatewayReconciliation?: (userId: string) => void;
  customRoles?: CustomRoleDefinition[];
  onCreateCustomRole?: (role: Omit<CustomRoleDefinition, 'id' | 'createdAt'>) => void;
  onDeleteCustomRole?: (code: string) => void;
  onOpenUserManagement?: () => void;
}

interface ModuleMeta {
  key: ModuleKey;
  label: string;
  category: 'Core Administration' | 'Financial & Fees' | 'Academics & Examination' | 'Portals & Services';
  restrictedRoles?: { role: UserRole; reason: string }[];
}

const MODULE_CATALOG: ModuleMeta[] = [
  // Core Administration
  { key: 'overview', label: 'Executive Dashboard & Overview', category: 'Core Administration' },
  { key: 'role_permissions', label: 'Role & Menu Access Matrix', category: 'Core Administration' },
  { key: 'admin_settings', label: 'Gateway & Institutional Settings', category: 'Core Administration' },
  { key: 'reports', label: 'Parameter-wise Reports & Census', category: 'Core Administration' },
  { key: 'user_management', label: 'Staff & Student User Directory', category: 'Core Administration' },
  { key: 'enrollment', label: 'Mandatory Enrollment Parameters', category: 'Core Administration' },
  { key: 'college_profile', label: 'College Master Profile', category: 'Core Administration' },

  // Financial & Fees
  {
    key: 'fees',
    label: 'Fee Module (Fee Ledger & Campaigns)',
    category: 'Financial & Fees',
  },
  {
    key: 'reconciliation_3way',
    label: 'Gateway Reconciliation Engine (Admin Tagged Menu)',
    category: 'Financial & Fees',
    restrictedRoles: [
      { role: 'principal', reason: 'Admin exclusive: taggable to specific staff below' },
      { role: 'accountant', reason: 'Admin exclusive: taggable to specific staff below' },
      { role: 'faculty', reason: 'Admin exclusive: taggable to specific staff below' },
      { role: 'student', reason: 'Admin exclusive: taggable to specific staff below' },
    ],
  },
  { key: 'accountant_requests', label: 'Student Requests & Service Tariff Catalog', category: 'Financial & Fees' },

  // Academics & Examination
  { key: 'stream_mapping', label: 'Course, Semester & Subject Mapping', category: 'Academics & Examination' },
  { key: 'student_promotion', label: 'Batch Student Promotion Engine', category: 'Academics & Examination' },
  { key: 'certificate_designer', label: 'Certificate & Marksheet Theme Designer', category: 'Academics & Examination' },
  {
    key: 'attendance',
    label: 'Student Attendance Tracker',
    category: 'Academics & Examination',
    restrictedRoles: [
      { role: 'principal', reason: 'ERP Policy: Student Attendance menu not available for Principal' },
      { role: 'accountant', reason: 'ERP Policy: Student Attendance menu not available for Accountant' },
      { role: 'superadmin', reason: 'ERP Policy: Student Attendance menu not available for Admin' },
    ],
  },
  {
    key: 'grades',
    label: 'Subject Marks Entry (Grading Cell)',
    category: 'Academics & Examination',
    restrictedRoles: [
      { role: 'accountant', reason: 'ERP Policy: Grade Management tab not accessible to Accountant' },
      { role: 'principal', reason: 'ERP Policy: Subject Marks Entry not accessible to Principal' },
      { role: 'superadmin', reason: 'ERP Policy: Subject Marks Entry not accessible to Admin' },
      { role: 'student', reason: 'ERP Policy: Subject Marks Entry not accessible to Student' },
    ],
  },
  {
    key: 'grade_settings',
    label: 'Grade Setting (Evaluation Heads & Result Publish Dates)',
    category: 'Academics & Examination',
    restrictedRoles: [
      { role: 'faculty', reason: 'Administrative governance: Grade Setting is restricted to Accountant, Principal, and Admin' },
      { role: 'student', reason: 'Administrative governance: Grade Setting is restricted to Accountant, Principal, and Admin' },
    ],
  },
  { key: 'teacher_mapping', label: 'Faculty Subject Allocation', category: 'Academics & Examination' },

  // Portals & Services
  { key: 'faculty_portal', label: 'Faculty Teaching Portal', category: 'Portals & Services' },
  { key: 'student_portal', label: 'Student Self-Service Portal', category: 'Portals & Services' },
  { key: 'congratulations', label: 'Congratulations & Honors Desk', category: 'Portals & Services' },
];

const BUILT_IN_ROLES: { key: UserRole; label: string; badgeColor: string; isBuiltIn: boolean }[] = [
  { key: 'superadmin', label: 'Admin (Superadmin)', badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300', isBuiltIn: true },
  { key: 'principal', label: 'Principal', badgeColor: 'bg-blue-100 text-blue-900 border-blue-300', isBuiltIn: true },
  { key: 'accountant', label: 'Accountant', badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300', isBuiltIn: true },
  { key: 'faculty', label: 'Faculty', badgeColor: 'bg-amber-100 text-amber-900 border-amber-300', isBuiltIn: true },
  { key: 'student', label: 'Student', badgeColor: 'bg-purple-100 text-purple-900 border-purple-300', isBuiltIn: true },
];

const COLOR_OPTIONS = [
  { value: 'cyan', label: 'Cyan Accent', bg: 'bg-cyan-100 text-cyan-900 border-cyan-300', dot: 'bg-cyan-500' },
  { value: 'emerald', label: 'Emerald Accent', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300', dot: 'bg-emerald-500' },
  { value: 'amber', label: 'Amber Accent', bg: 'bg-amber-100 text-amber-900 border-amber-300', dot: 'bg-amber-500' },
  { value: 'purple', label: 'Purple Accent', bg: 'bg-purple-100 text-purple-900 border-purple-300', dot: 'bg-purple-500' },
  { value: 'rose', label: 'Rose Accent', bg: 'bg-rose-100 text-rose-900 border-rose-300', dot: 'bg-rose-500' },
  { value: 'indigo', label: 'Indigo Accent', bg: 'bg-indigo-100 text-indigo-900 border-indigo-300', dot: 'bg-indigo-500' },
  { value: 'slate', label: 'Slate Accent', bg: 'bg-slate-200 text-slate-800 border-slate-300', dot: 'bg-slate-500' },
];

export const RolePermissionMatrixModule: React.FC<RolePermissionMatrixModuleProps> = ({
  currentPermissions,
  onSavePermissions,
  allUsers = [],
  onToggleUserGatewayReconciliation,
  customRoles: propCustomRoles,
  onCreateCustomRole,
  onDeleteCustomRole,
  onOpenUserManagement,
}) => {
  const [matrix, setMatrix] = useState<Record<UserRole, ModuleKey[]>>(currentPermissions);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [roleScopeFilter, setRoleScopeFilter] = useState<'all' | 'builtin' | 'custom'>('all');
  const pushToast = useErpStore((s) => s.pushToast);
  const openConfirmDialog = useErpStore((s) => s.openConfirmDialog);

  // Load custom roles from props or fallback to storage
  const [localCustomRoles, setLocalCustomRoles] = useState<CustomRoleDefinition[]>(() => {
    return propCustomRoles || erpStorage.getCustomRoles();
  });

  // Keep local state in sync when propCustomRoles changes
  React.useEffect(() => {
    if (propCustomRoles) {
      setLocalCustomRoles(propCustomRoles);
    }
  }, [propCustomRoles]);

  // Keep matrix state in sync when currentPermissions change
  React.useEffect(() => {
    setMatrix(currentPermissions);
  }, [currentPermissions]);

  // -------------------------------------------------------------
  // INTRODUCE NEW ROLE TYPE MODAL STATE
  // -------------------------------------------------------------
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('cyan');
  const [newRoleModules, setNewRoleModules] = useState<ModuleKey[]>(['overview', 'reports', 'congratulations']);
  const [formError, setFormError] = useState('');

  // Auto-generate code from name
  const handleNameChange = (val: string) => {
    setNewRoleName(val);
    const slug = val
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    setNewRoleCode(slug);
  };

  const handleToggleNewRoleModule = (modKey: ModuleKey) => {
    if (newRoleModules.includes(modKey)) {
      setNewRoleModules(newRoleModules.filter((m) => m !== modKey));
    } else {
      setNewRoleModules([...newRoleModules, modKey]);
    }
  };

  const applyPreset = (preset: 'all' | 'none' | 'academic' | 'administrative' | 'services') => {
    if (preset === 'all') {
      setNewRoleModules(MODULE_CATALOG.map((m) => m.key));
    } else if (preset === 'none') {
      setNewRoleModules([]);
    } else if (preset === 'academic') {
      setNewRoleModules([
        'overview',
        'stream_mapping',
        'grade_settings',
        'student_promotion',
        'certificate_designer',
        'reports',
        'congratulations',
      ]);
    } else if (preset === 'administrative') {
      setNewRoleModules([
        'overview',
        'user_management',
        'enrollment',
        'college_profile',
        'reports',
        'accountant_requests',
        'congratulations',
      ]);
    } else if (preset === 'services') {
      setNewRoleModules(['overview', 'accountant_requests', 'reports', 'congratulations']);
    }
  };

  const handleCreateRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = newRoleName.trim();
    const cleanCode = newRoleCode.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    if (!cleanName) {
      setFormError('Please enter a descriptive role name.');
      return;
    }
    if (!cleanCode) {
      setFormError('Please provide a unique role identifier code.');
      return;
    }
    if (['superadmin', 'principal', 'accountant', 'faculty', 'student'].includes(cleanCode)) {
      setFormError(`Role code "${cleanCode}" is reserved for built-in system roles.`);
      return;
    }
    if (localCustomRoles.some((r) => r.code.toLowerCase() === cleanCode)) {
      setFormError(`A role type with code "${cleanCode}" already exists.`);
      return;
    }

    try {
      const rolePayload: Omit<CustomRoleDefinition, 'id' | 'createdAt'> = {
        code: cleanCode,
        name: cleanName,
        description: newRoleDesc.trim() || `Custom administrative role with ${newRoleModules.length} mapped subsystems.`,
        badgeColor: newRoleColor,
        allowedModules: newRoleModules.length > 0 ? newRoleModules : ['overview'],
        createdBy: 'Shri Rajeshwar Nath (Super Admin)',
      };

      let createdRole: CustomRoleDefinition;
      if (onCreateCustomRole) {
        onCreateCustomRole(rolePayload);
        createdRole = {
          ...rolePayload,
          id: `ROLE-${cleanCode.toUpperCase()}-${Date.now().toString().slice(-4)}`,
          createdAt: getISTDateString(),
        };
      } else {
        createdRole = erpStorage.addCustomRole(rolePayload, erpStorage.getCurrentUser()?.role);
      }

      const updatedList = [...localCustomRoles, createdRole];
      setLocalCustomRoles(updatedList);

      // Update matrix in memory
      const updatedMatrix = {
        ...matrix,
        [cleanCode]: newRoleModules,
      };
      setMatrix(updatedMatrix);
      onSavePermissions(updatedMatrix);

      // Reset form
      setNewRoleName('');
      setNewRoleCode('');
      setNewRoleDesc('');
      setNewRoleModules(['overview', 'reports', 'congratulations']);
      setIsCreateRoleModalOpen(false);

      setSaveToast(`🎉 Successfully introduced new role type "${cleanName}" with ${newRoleModules.length} mapped menus!`);
      setTimeout(() => setSaveToast(null), 5000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to introduce new role.');
    }
  };

  const handleDeleteRole = (code: string, roleName: string) => {
    const assignedUsers = allUsers.filter((u) => u.role === code);
    if (assignedUsers.length > 0) {
      setFormError(
        `Cannot delete custom role "${roleName}" (${code}): ${assignedUsers.length} user(s) (${assignedUsers
          .map((u) => u.name)
          .join(', ')}) are currently assigned to this role. Reassign them first.`
      );
      setSaveToast(
        `Blocked deletion of "${roleName}": ${assignedUsers.length} active user(s) are assigned to this role.`
      );
      setTimeout(() => setSaveToast(null), 5000);
      return;
    }

    try {
      if (onDeleteCustomRole) {
        onDeleteCustomRole(code);
      } else {
        erpStorage.deleteCustomRole(code, erpStorage.getCurrentUser()?.role);
      }

      const updated = localCustomRoles.filter((r) => r.code !== code);
      setLocalCustomRoles(updated);

      const updatedMatrix = { ...matrix };
      delete updatedMatrix[code];
      setMatrix(updatedMatrix);
      onSavePermissions(updatedMatrix);

      setSaveToast(`Custom role "${roleName}" has been removed.`);
      setTimeout(() => setSaveToast(null), 4000);
    } catch (err: any) {
      setSaveToast(err?.message || `Failed to delete custom role "${roleName}".`);
      setTimeout(() => setSaveToast(null), 5000);
    }
  };

  // -------------------------------------------------------------
  // COMBINED ROLES FOR TABLE
  // -------------------------------------------------------------
  const allDisplayRoles = useMemo(() => {
    const customRoleItems = localCustomRoles.map((cr) => {
      const colorMatch = COLOR_OPTIONS.find((c) => c.value === cr.badgeColor) || COLOR_OPTIONS[0];
      return {
        key: cr.code,
        label: cr.name,
        badgeColor: colorMatch.bg,
        isBuiltIn: false,
        customDef: cr,
      };
    });

    if (roleScopeFilter === 'builtin') return BUILT_IN_ROLES;
    if (roleScopeFilter === 'custom') return customRoleItems;
    return [...BUILT_IN_ROLES, ...customRoleItems];
  }, [localCustomRoles, roleScopeFilter]);

  const categories = ['All', 'Core Administration', 'Financial & Fees', 'Academics & Examination', 'Portals & Services'];

  const filteredModules = selectedCategory === 'All'
    ? MODULE_CATALOG
    : MODULE_CATALOG.filter((m) => m.category === selectedCategory);

  const togglePermission = (role: UserRole, modKey: ModuleKey) => {
    // Check if role is strictly disallowed by statutory rules
    const modDef = MODULE_CATALOG.find((m) => m.key === modKey);
    const restriction = modDef?.restrictedRoles?.find((r) => r.role === role);
    if (restriction) {
      pushToast({
        title: 'Access Restriction',
        message: restriction.reason,
        variant: 'warning',
      });
      return;
    }

    const currentList = matrix[role] || [];
    const isEnabled = currentList.includes(modKey);
    const updated = isEnabled
      ? currentList.filter((k) => k !== modKey)
      : [...currentList, modKey];

    const nextMatrix = {
      ...matrix,
      [role]: updated,
    };
    setMatrix(nextMatrix);

    // Also update custom role allowedModules if it's a custom role
    const customMatch = localCustomRoles.find((cr) => cr.code === role);
    if (customMatch) {
      const updatedCRs = localCustomRoles.map((cr) =>
        cr.code === role ? { ...cr, allowedModules: updated } : cr
      );
      setLocalCustomRoles(updatedCRs);
      erpStorage.saveCustomRoles(updatedCRs);
    }
  };

  const handleSave = () => {
    onSavePermissions(matrix);
    setSaveSuccess(true);
    setSaveToast('Role and menu permission matrix saved and published across the ERP runtime successfully.');
    setTimeout(() => {
      setSaveSuccess(false);
      setSaveToast(null);
    }, 4000);
  };

  const handleResetDefaults = () => {
    openConfirmDialog({
      title: 'Reset Role Permissions',
      message: 'Reset all staff and student role permissions to statutory defaults?',
      confirmLabel: 'Reset to Defaults',
      variant: 'warning',
      onConfirm: () => {
        setMatrix(INITIAL_MODULE_PERMISSIONS);
        onSavePermissions(INITIAL_MODULE_PERMISSIONS);
        setSaveSuccess(true);
        setSaveToast('Permissions matrix reset to statutory defaults.');
        setTimeout(() => {
          setSaveSuccess(false);
          setSaveToast(null);
        }, 3000);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-300 text-xs font-mono font-bold tracking-wider uppercase mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Role-Based Access Control (RBAC) Governance</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Staff & Student Role Permission Matrix
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-2xl leading-relaxed">
              Define which staff and student roles have active access to specific menus and ERP subsystems. Introduce new custom role types and map tailor-made menu privileges with full administrative authority.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => setIsCreateRoleModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Introduce New Role Type</span>
            </button>
            <button
              onClick={handleResetDefaults}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Defaults</span>
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Matrix</span>
            </button>
          </div>
        </div>
      </div>

      {saveToast && (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* CUSTOM ROLES DIRECTORY OVERVIEW CARD */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-sm">
                Custom Role Types Introduced by Admin ({localCustomRoles.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Admin has statutory rights to introduce role types and map menu permissions. Users onboarded with these roles inherit their assigned menus immediately.
            </p>
          </div>
          <button
            onClick={() => setIsCreateRoleModalOpen(true)}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition flex items-center gap-1.5 self-start sm:self-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Another Role</span>
          </button>
        </div>

        {localCustomRoles.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-500 font-medium">No custom role types introduced yet.</p>
            <button
              onClick={() => setIsCreateRoleModalOpen(true)}
              className="mt-2 text-xs text-indigo-600 font-bold hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Introduce your first custom role (e.g. Librarian, Warden, Dean)</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {localCustomRoles.map((role) => {
              const assignedUsers = allUsers.filter((u) => u.role === role.code);
              const mappedModules = matrix[role.code] || role.allowedModules || [];
              const colorInfo = COLOR_OPTIONS.find((c) => c.value === role.badgeColor) || COLOR_OPTIONS[0];

              return (
                <div
                  key={role.id || role.code}
                  className="bg-slate-50 hover:bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${colorInfo.bg}`}>
                          {role.name}
                        </span>
                        <span className="block font-mono text-xs text-slate-400 mt-1">
                          code: {role.code}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteRole(role.code, role.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        title="Delete this custom role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 leading-snug">
                      {role.description}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                      <span>
                        Mapped Subsystems:{' '}
                        <strong className="text-indigo-700 font-bold font-mono">
                          {mappedModules.length} Menus
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Active Users:{' '}
                        <strong className="text-slate-800 font-bold font-mono">
                          {assignedUsers.length} Staff
                        </strong>
                      </span>
                    </div>

                    {/* Quick Module Tags */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {mappedModules.slice(0, 4).map((mod) => (
                        <span key={mod} className="px-1.5 py-0.2 text-xs font-mono bg-white text-slate-700 border border-slate-200 rounded">
                          {mod}
                        </span>
                      ))}
                      {mappedModules.length > 4 && (
                        <span className="px-1.5 py-0.2 text-xs font-mono bg-indigo-50 text-indigo-700 rounded font-semibold">
                          +{mappedModules.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <button
                      onClick={() => {
                        if (onOpenUserManagement) {
                          onOpenUserManagement();
                        } else {
                          pushToast({
                            title: `Onboard ${role.name}`,
                            message: `To onboard a user as "${role.name}", open "Onboard Staff" from the top navigation bar and choose this role from the dropdown.`,
                            variant: 'info',
                          });
                        }
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Onboard Staff User</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Statutory Restriction Callout */}
      <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex items-start space-x-3 text-amber-900 text-xs">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">Statutory Institutional Access Restrictions Enforced:</strong>
          <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800">
            <li><strong>Student Attendance menu</strong> is strictly unavailable for Principal, Accountant, and Admin.</li>
            <li><strong>Course Categorized Fee Ledger</strong> is strictly unavailable for Principal and Admin.</li>
            <li><strong>Subject Marks Entry</strong> is strictly unavailable for Principal, Admin, and Accountant (exclusive faculty evaluation prerogative).</li>
            <li><strong>Custom Role Types</strong> introduced by Admin can be mapped to any allowed menus based on institutional delegation policy.</li>
          </ul>
        </div>
      </div>

      {/* Filter controls strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category filter */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Role Scope filter */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-center">
          <button
            onClick={() => setRoleScopeFilter('all')}
            className={`px-2.5 py-1 rounded-lg transition ${
              roleScopeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Roles ({allDisplayRoles.length})
          </button>
          <button
            onClick={() => setRoleScopeFilter('builtin')}
            className={`px-2.5 py-1 rounded-lg transition ${
              roleScopeFilter === 'builtin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Standard Roles (5)
          </button>
          <button
            onClick={() => setRoleScopeFilter('custom')}
            className={`px-2.5 py-1 rounded-lg transition ${
              roleScopeFilter === 'custom' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Custom Roles ({localCustomRoles.length})
          </button>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white uppercase text-xs tracking-wider">
              <tr>
                <th className="px-5 py-4 min-w-[240px]">ERP Module & Menu Title</th>
                <th className="px-4 py-4 min-w-[140px]">Category</th>
                {allDisplayRoles.map((r) => (
                  <th key={r.key} className="px-4 py-4 text-center min-w-[130px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="block font-bold">{r.label}</span>
                      {!r.isBuiltIn && (
                        <span className="text-xs font-mono px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black rounded uppercase">
                          Custom Role
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredModules.map((mod) => (
                <tr key={mod.key} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-3.5 font-semibold text-slate-900">
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span>{mod.label}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400 block ml-3.5">
                      id: {mod.key}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {mod.category}
                    </span>
                  </td>

                  {allDisplayRoles.map((r) => {
                    const isGranted = (matrix[r.key] || []).includes(mod.key);
                    const restriction = r.isBuiltIn ? mod.restrictedRoles?.find((res) => res.role === r.key) : undefined;

                    return (
                      <td key={r.key} className="px-4 py-3.5 text-center">
                        {restriction ? (
                          <div
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded cursor-not-allowed"
                            title={restriction.reason}
                          >
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>Banned</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => togglePermission(r.key, mod.key)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 mx-auto ${
                              isGranted
                                ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                            title={`Click to ${isGranted ? 'hide' : 'activate'} "${mod.label}" for ${r.label}`}
                          >
                            {isGranted ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Hidden</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GATEWAY RECONCILIATION USER-LEVEL TAGGING DESK */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-600 font-bold block">
                Security Delegation Control
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Gateway Reconciliation Menu — User-Level Tagging Desk
              </h3>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="Filter staff by name or email..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50"
            />
          </div>
        </div>

        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            <span className="font-bold">Statutory Institutional Policy:</span> Gateway Reconciliation (3-Way Ledger vs MIS vs Bank Statement) is restricted to <span className="font-bold">Admin</span> by default. Admin has the right to tag this menu to individual users below. Once tagged, that user will have instant access to the Gateway Reconciliation menu in their navigation bar.
          </p>
        </div>

        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Staff Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Official Email</th>
                <th className="px-4 py-3 text-right">Gateway Reconciliation Access Tag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {allUsers
                .filter((u) => u.role !== 'student')
                .filter(
                  (u) =>
                    u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    u.role.toLowerCase().includes(userSearchQuery.toLowerCase())
                )
                .map((u) => {
                  const isTagged = Boolean(
                    u.hasGatewayReconciliationAccess || u.taggedModules?.includes('reconciliation_3way')
                  );
                  const isSuper = u.role === 'superadmin';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-xs text-slate-500">{u.designation || 'Staff Member'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold uppercase border bg-slate-100 text-slate-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{u.email}</td>
                      <td className="px-4 py-3 text-right">
                        {isSuper ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
                            Super Admin (Default Access)
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onToggleUserGatewayReconciliation && onToggleUserGatewayReconciliation(u.id)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
                              isTagged
                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300'
                            }`}
                          >
                            {isTagged ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Tagged (Access Granted)</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3 text-slate-500" />
                                <span>Tag User for Access</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: INTRODUCE NEW ROLE TYPE & MAP MENU ACCESS                           */}
      {/* ========================================================================= */}
      {isCreateRoleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-5 relative">
              <button
                onClick={() => setIsCreateRoleModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center space-x-3 mb-1.5">
                <div className="p-2 bg-amber-500/20 border border-amber-400/30 rounded-xl">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <span className="text-xs font-mono tracking-wider uppercase text-amber-300">
                    Admin Privilege Control
                  </span>
                  <h3 className="text-lg font-black tracking-tight">
                    Introduce New Role Type & Map Menu Access
                  </h3>
                </div>
              </div>
              <p className="text-xs text-slate-300">
                Define a new institutional role type (e.g. Librarian, Dean, Hostel Warden, Auditor) and map the exact menus and ERP subsystems this user will have access to.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateRoleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role Title / Display Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Chief Librarian & Archival Head"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role Identifier Code <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={newRoleCode}
                    onChange={(e) => setNewRoleCode(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. chief_librarian"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                  <span className="text-xs text-slate-400 font-mono mt-0.5 block">
                    Used for RBAC identification & login mapping
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Role Description & Institutional Scope
                </label>
                <textarea
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="e.g. Responsible for library repository cataloging, book issuance, student clearance and census reports."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Theme Badge Color Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Badge Color Palette Accent
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewRoleColor(c.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                        newRoleColor === c.value
                          ? `${c.bg} ring-2 ring-indigo-500`
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Mapping Checklist with Presets */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      Map Menus This Role Will Have Access To ({newRoleModules.length} Selected)
                    </label>
                    <p className="text-xs text-slate-500">
                      Check each menu that should appear in the navigation bar for users with this role.
                    </p>
                  </div>

                  {/* Fast Presets */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => applyPreset('academic')}
                      className="px-2 py-1 text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-100"
                    >
                      Academic
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('administrative')}
                      className="px-2 py-1 text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('all')}
                      className="px-2 py-1 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('none')}
                      className="px-2 py-1 text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-3 max-h-56 overflow-y-auto">
                  {categories.filter((c) => c !== 'All').map((cat) => {
                    const catModules = MODULE_CATALOG.filter((m) => m.category === cat);
                    return (
                      <div key={cat} className="space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono block">
                          {cat}
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {catModules.map((mod) => {
                            const isChecked = newRoleModules.includes(mod.key);
                            return (
                              <label
                                key={mod.key}
                                className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                                  isChecked
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleNewRoleModule(mod.key)}
                                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                  />
                                  <span className="truncate">{mod.label}</span>
                                </div>
                                {isChecked ? (
                                  <div
                                    className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shadow shrink-0"
                                    aria-hidden="true"
                                  >
                                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                                  </div>
                                ) : (
                                  <div
                                    className="w-6 h-6 rounded-full border border-slate-300 bg-slate-100 text-slate-400 flex items-center justify-center text-xs shrink-0"
                                    aria-hidden="true"
                                  >
                                    <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  </div>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateRoleModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Introduce Role & Publish Permissions</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
