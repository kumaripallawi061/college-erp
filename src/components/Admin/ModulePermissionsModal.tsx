import React, { useState, useEffect } from 'react';
import { ModuleKey, ModulePermissionMap, UserRole } from '../../types/erp';
import { erpStorage } from '../../services/erpStorage';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  X,
  Layers,
  Save,
  Info,
  Calendar,
  Lock,
  AlertTriangle,
} from 'lucide-react';

interface ModulePermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissions: ModulePermissionMap;
  onSavePermissions: (updated: ModulePermissionMap) => void;
}

const STATUTORY_ROLE_BLOCKS: Partial<Record<ModuleKey, UserRole[]>> = {
  attendance: ['principal', 'accountant', 'superadmin', 'student'],
  fees: ['principal', 'superadmin', 'faculty', 'student'],
  campaigns: ['principal', 'superadmin', 'faculty', 'student'],
  grades: ['principal', 'accountant', 'superadmin', 'student'],
  grade_settings: ['faculty', 'student'],
  reconciliation_3way: ['principal', 'accountant', 'faculty', 'student'],
};

const ALL_MODULES: Array<{ key: ModuleKey; label: string; desc: string }> = [
  {
    key: 'overview',
    label: 'Overview & Statistics',
    desc: 'Executive institutional metrics, circulars, and quick shortcuts',
  },
  {
    key: 'attendance',
    label: 'Student Attendance',
    desc: 'Session roll call, 75% defaulter roster, and audit trail',
  },
  {
    key: 'fees',
    label: 'Fee Payments & Ledger',
    desc: 'Student collection ledger, batch Excel uploads, reconciliation',
  },
  {
    key: 'campaigns',
    label: 'Fee Campaigns & Drives',
    desc: 'Campaign creation, head allocation, and non-destructive date extensions',
  },
  {
    key: 'grades',
    label: 'Grade Management',
    desc: 'Marks entry, CBCS grading, class analytics, and semester transcripts',
  },
  {
    key: 'grade_settings',
    label: 'Grade Setting',
    desc: 'Configure evaluation heads max marks, sequence order, and result publication schedules',
  },
  {
    key: 'faculty_portal',
    label: 'Faculty Portal',
    desc: 'Assigned courses schedule, syllabus tracker, leave applications',
  },
  {
    key: 'student_portal',
    label: 'Student Portal & Hall Tickets',
    desc: 'Personalized dashboard, fee dues, attendance health, and examination hall ticket',
  },
  {
    key: 'enrollment',
    label: 'Enrollment Module',
    desc: 'Dynamic enrollment form parameters & student data master editor',
  },
  {
    key: 'teacher_mapping',
    label: 'Teacher Class Tagging',
    desc: 'Mapping stream/class/subject to faculty with historical continuity',
  },
  {
    key: 'stream_mapping',
    label: 'Course & Stream Mapping',
    desc: 'Statutory stream codes, semester curriculum, and academic course catalog',
  },
  {
    key: 'reports',
    label: 'Reports & Census',
    desc: 'Institutional analytics, gender/caste/course census, and fee audit rosters',
  },
  {
    key: 'user_management',
    label: 'Staff User Provisioning',
    desc: 'Onboarding principal, accountant, faculty, and custom roles with mobile number logins',
  },
];

const BASE_TARGET_ROLES: Array<{ role: UserRole; label: string }> = [
  { role: 'principal', label: '🏛️ Principal' },
  { role: 'accountant', label: '💰 Accountant' },
  { role: 'faculty', label: '👨‍🏫 Faculty Member' },
  { role: 'student', label: '🎓 Student' },
];

export const ModulePermissionsModal: React.FC<ModulePermissionsModalProps> = ({
  isOpen,
  onClose,
  permissions,
  onSavePermissions,
}) => {
  const [localPerms, setLocalPerms] = useState<ModulePermissionMap>({ ...permissions });
  const [selectedRole, setSelectedRole] = useState<UserRole>('faculty');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [restrictionError, setRestrictionError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalPerms({ ...permissions });
      setRestrictionError(null);
      setSaveSuccess(false);
    }
  }, [permissions, isOpen]);

  const customRoles = React.useMemo(() => erpStorage.getCustomRoles(), [isOpen]);
  const allTargetRoles = React.useMemo(() => {
    const customs = customRoles.map((cr) => ({
      role: cr.code,
      label: `✨ ${cr.name}`,
    }));
    return [...BASE_TARGET_ROLES, ...customs];
  }, [customRoles]);

  if (!isOpen) return null;

  const isStatutorilyRestricted = (role: UserRole, moduleKey: ModuleKey) => {
    const blockedRoles = STATUTORY_ROLE_BLOCKS[moduleKey];
    return Boolean(blockedRoles && blockedRoles.includes(role));
  };

  const handleToggleModule = (moduleKey: ModuleKey) => {
    setRestrictionError(null);
    if (isStatutorilyRestricted(selectedRole, moduleKey)) {
      setRestrictionError(
        `Statutory Governance Policy prevents assigning or toggling "${moduleKey}" for the "${selectedRole}" role.`
      );
      return;
    }

    const currentList = localPerms[selectedRole] || [];
    const exists = currentList.includes(moduleKey);

    const updatedList = exists
      ? currentList.filter((k: ModuleKey) => k !== moduleKey)
      : [...currentList, moduleKey];

    setLocalPerms({
      ...localPerms,
      [selectedRole]: updatedList,
    });
  };

  const handleSave = () => {
    onSavePermissions(localPerms);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-950 text-white px-8 py-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 bg-purple-500/20 border border-purple-400/30 rounded-xl">
              <Layers className="w-6 h-6 text-purple-300" />
            </div>
            <div>
              <span className="text-xs font-mono tracking-wider uppercase text-purple-300">
                Super Admin Master Privileges
              </span>
              <h2 className="text-xl font-black tracking-tight">Role-Based Module Mapping & Revocation</h2>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            Map or remove specific ERP modules for any user type. On removal, the user type loses menu access from that
            moment. Captured institutional data remains completely safe and is instantly restored upon re-mapping.
          </p>
        </div>

        {/* Role Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-4 gap-2 overflow-x-auto">
          {allTargetRoles.map(({ role, label }) => (
            <button
              key={role}
              onClick={() => {
                setSelectedRole(role);
                setRestrictionError(null);
              }}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition border-t border-x ${
                selectedRole === role
                  ? 'bg-white border-slate-200 text-purple-700 shadow-sm'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Modules List */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Module access permissions updated and committed.
            </div>
          )}

          {restrictionError && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{restrictionError}</span>
            </div>
          )}

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Zero Data Erasure Policy:</p>
              <p className="text-xs text-amber-800">
                Disabling a module from a user role merely conceals the interface menu. All previously recorded data
                (attendance logs, fee collections, marks entries) remains permanently preserved in the college database
                and will be available immediately when re-enabled.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_MODULES.map((mod) => {
              const restricted = isStatutorilyRestricted(selectedRole, mod.key);
              const hasAccess = !restricted && (localPerms[selectedRole] || []).includes(mod.key);

              return (
                <div
                  key={mod.key}
                  onClick={() => handleToggleModule(mod.key)}
                  className={`p-4 rounded-2xl border transition flex items-start justify-between gap-3 ${
                    restricted
                      ? 'border-slate-200 bg-slate-100/70 opacity-70 cursor-not-allowed'
                      : hasAccess
                      ? 'border-purple-300 bg-purple-50/50 shadow-sm cursor-pointer'
                      : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-xs text-slate-900">{mod.label}</span>
                      {restricted ? (
                        <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-rose-100 text-rose-700 inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Statutory Lock
                        </span>
                      ) : hasAccess ? (
                        <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-slate-100 text-slate-500">
                          Restricted
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-snug">{mod.desc}</p>
                  </div>

                  <div className="mt-1 shrink-0">
                    {restricted ? (
                      <div
                        className="w-6 h-6 rounded-full border border-rose-200 bg-rose-50 text-rose-500 flex items-center justify-center text-xs"
                        aria-label="Statutorily locked"
                      >
                        <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      </div>
                    ) : hasAccess ? (
                      <div
                        className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shadow"
                        aria-label="Permission granted"
                      >
                        <CheckCircle2 className="w-4 h-4 text-white shrink-0" aria-hidden="true" />
                      </div>
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full border border-slate-300 bg-slate-100 text-slate-400 flex items-center justify-center text-xs"
                        aria-label="Permission restricted"
                      >
                        <XCircle className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-300 font-semibold text-slate-700 rounded-xl text-xs hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md text-xs transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Commit Module Permissions
          </button>
        </div>
      </div>
    </div>
  );
};
