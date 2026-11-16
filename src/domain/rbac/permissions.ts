import type { ModuleKey, ModulePermissionMap, UserAccount, UserRole } from '../../types/erp';

export const VALID_MODULE_KEYS: ReadonlySet<string> = new Set<ModuleKey>([
  'overview',
  'attendance',
  'fees',
  'campaigns',
  'grades',
  'faculty_portal',
  'student_portal',
  'enrollment',
  'teacher_mapping',
  'college_profile',
  'user_management',
  'congratulations',
  'stream_mapping',
  'marksheet_designer',
  'certificate_designer',
  'student_promotion',
  'reconciliation_3way',
  'accountant_requests',
  'reports',
  'role_permissions',
  'admin_settings',
  'grade_settings',
]);

export type NavigationCategory = 'Academics' | 'Finance' | 'Administration';
export type ModuleCategory = NavigationCategory;

export interface ModuleCatalogEntry {
  key: ModuleKey;
  label: string;
  shortLabel: string;
  category: NavigationCategory;
  description: string;
}

export interface ModuleAccessDecision {
  allowed: boolean;
  reason?: string;
  statuteRef?: string;
}

export const DEFAULT_ROLE_MODULE_PERMISSIONS: ModulePermissionMap = {
  superadmin: [
    'overview',
    'teacher_mapping',
    'grade_settings',
    'congratulations',
    'enrollment',
    'stream_mapping',
    'marksheet_designer',
    'certificate_designer',
    'reconciliation_3way',
    'accountant_requests',
    'reports',
    'student_promotion',
    'role_permissions',
    'admin_settings',
  ],
  principal: [
    'overview',
    'teacher_mapping',
    'grade_settings',
    'congratulations',
    'enrollment',
    'stream_mapping',
    'marksheet_designer',
    'certificate_designer',
    'reports',
    'student_promotion',
  ],
  accountant: [
    'overview',
    'fees',
    'grade_settings',
    'enrollment',
    'stream_mapping',
    'reconciliation_3way',
    'accountant_requests',
    'reports',
  ],
  faculty: ['faculty_portal', 'attendance', 'grades', 'congratulations'],
  student: ['student_portal', 'overview', 'congratulations'],
};

export const MODULE_CATALOG: readonly ModuleCatalogEntry[] = [
  // Academics
  {
    key: 'overview',
    label: 'Institutional Overview',
    shortLabel: 'Overview',
    category: 'Academics',
    description: 'Executive metrics, notices, and campus activity summary',
  },
  {
    key: 'faculty_portal',
    label: 'Faculty Academic Desk',
    shortLabel: 'Faculty Desk',
    category: 'Academics',
    description: 'Course timetable, evaluations, and student mentoring',
  },
  {
    key: 'student_portal',
    label: 'Student Academic Portal',
    shortLabel: 'Student Portal',
    category: 'Academics',
    description: 'Attendance, fee clearance, CBCS marksheets, and profile',
  },
  {
    key: 'attendance',
    label: 'Daily Lecture Attendance',
    shortLabel: 'Attendance',
    category: 'Academics',
    description: 'Course-wise lecture register and 75% threshold tracking',
  },
  {
    key: 'grades',
    label: 'CBCS Grade Management',
    shortLabel: 'Grades',
    category: 'Academics',
    description: 'Subject marks entry, SGPA computation, and lock workflow',
  },
  {
    key: 'stream_mapping',
    label: 'Curriculum & Stream Mapping',
    shortLabel: 'Curriculum',
    category: 'Academics',
    description: 'Map CBCS subjects, credits, and prerequisites by semester',
  },
  {
    key: 'teacher_mapping',
    label: 'Faculty Workload Tagging',
    shortLabel: 'Teacher Tagging',
    category: 'Academics',
    description: 'Assign faculty members to course sections and lecture rooms',
  },
  {
    key: 'grade_settings',
    label: 'Result Declaration & Locks',
    shortLabel: 'Result Locks',
    category: 'Academics',
    description: 'Configure evaluation heads, result release dates, and post-declaration locks',
  },
  {
    key: 'student_promotion',
    label: 'Semester Batch Promotion',
    shortLabel: 'Promotions',
    category: 'Academics',
    description: 'Promote eligible student cohorts across semesters with rollback support',
  },
  {
    key: 'marksheet_designer',
    label: 'CBCS Marksheet Studio',
    shortLabel: 'Marksheets',
    category: 'Academics',
    description: 'Customize official transcript headers, grading scales, and seals',
  },
  {
    key: 'certificate_designer',
    label: 'Ceremonial Certificate Studio',
    shortLabel: 'Certificates',
    category: 'Academics',
    description: 'Configure clearance, appreciation, and provisional certificates',
  },
  {
    key: 'congratulations',
    label: 'Honors & Accolades',
    shortLabel: 'Honors',
    category: 'Academics',
    description: 'Publish institutional commendations and student achievements',
  },

  // Finance
  {
    key: 'fees',
    label: 'Fee Ledger & Counter',
    shortLabel: 'Fee Ledger',
    category: 'Finance',
    description: 'Collect semester fees, manage campaigns, and issue sequential FY receipts',
  },
  {
    key: 'reconciliation_3way',
    label: '3-Way Gateway Reconciliation',
    shortLabel: 'Reconciliation',
    category: 'Finance',
    description: 'Reconcile ERP fee receipts against payment gateway and bank UTR statements',
  },
  {
    key: 'accountant_requests',
    label: 'Collegiate Service Desk',
    shortLabel: 'Service Desk',
    category: 'Finance',
    description: 'Process student certificate, transcript, and clearance requests',
  },

  // Administration
  {
    key: 'enrollment',
    label: 'Enrollment Form Builder',
    shortLabel: 'Enrollment',
    category: 'Administration',
    description: 'Configure mandatory and statutory student profile parameters',
  },
  {
    key: 'reports',
    label: 'Institutional Census & Reports',
    shortLabel: 'Reports',
    category: 'Administration',
    description: 'Generate demographic, financial, and academic compliance workbooks',
  },
  {
    key: 'role_permissions',
    label: 'Role & Access Matrix (RBAC)',
    shortLabel: 'RBAC Matrix',
    category: 'Administration',
    description: 'Manage role permissions and custom institutional designations',
  },
  {
    key: 'admin_settings',
    label: 'System Security & Backups',
    shortLabel: 'System Settings',
    category: 'Administration',
    description: 'Gateway credentials, audit logs, and Zod-validated backup/restore',
  },
];

const PRIVILEGED_ADMIN_MODULES: ReadonlySet<ModuleKey> = new Set<ModuleKey>([
  'role_permissions',
  'admin_settings',
  'user_management',
]);

/**
 * Evaluates RBAC access with detailed statutory explanation for route guards.
 */
export function evaluateModuleAccess(
  user: Pick<UserAccount, 'role' | 'taggedModules' | 'hasGatewayReconciliationAccess' | 'canProcessServiceRequests'> | null | undefined,
  moduleKey: string,
  modulePermissions: ModulePermissionMap = DEFAULT_ROLE_MODULE_PERMISSIONS
): ModuleAccessDecision {
  const cleanedKey = String(moduleKey ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (!user || !VALID_MODULE_KEYS.has(cleanedKey)) {
    return { allowed: false, reason: 'Authentication required or unknown module key.' };
  }

  const key = cleanedKey as ModuleKey;
  const role: UserRole = user.role;
  const isSuperAdmin = role === 'superadmin';
  const isPrincipal = role === 'principal';
  const isAccountant = role === 'accountant';
  const isFaculty = role === 'faculty';
  const isStudent = role === 'student';

  if (isStudent) {
    const ok = ['student_portal', 'overview', 'congratulations'].includes(key);
    return ok
      ? { allowed: true }
      : {
          allowed: false,
          reason:
            'Student Security Boundary: Student accounts are restricted to your personalized academic dashboard, fee payments, and grievance tickets.',
          statuteRef: 'RLSY ERP Student Terms §3.1 (Access Privilege Separation)',
        };
  }
  if (key === 'student_portal') {
    return {
      allowed: false,
      reason: 'Student Portal view is dedicated to enrolled student accounts.',
    };
  }

  if (isSuperAdmin && key === 'faculty_portal') {
    return {
      allowed: false,
      reason: 'Super Admin view does not include the Faculty Portal.',
    };
  }

  if (key === 'attendance' && (isPrincipal || isAccountant || isSuperAdmin)) {
    return {
      allowed: false,
      reason:
        'Faculty Jurisdiction Standard: Direct daily roll-call attendance logging is legally restricted to appointed subject teachers and course professors.',
      statuteRef: 'University Academic Regulation §14-B (Faculty Classroom Prerogative)',
    };
  }

  if (key === 'fees' || key === 'campaigns') {
    if (isSuperAdmin || isPrincipal) {
      return {
        allowed: false,
        reason:
          'Statutory Segregation of Duties: Under state university financial audit standards, Executive Administration (Super Admin & Principal) is prohibited from direct fee transaction posting.',
        statuteRef: 'UGC Financial Governance Guideline §8.4 (Audit Independence)',
      };
    }
    if (isAccountant) return { allowed: true };
  }

  if (key === 'grades') {
    if (isSuperAdmin || isPrincipal || isAccountant) {
      return {
        allowed: false,
        reason:
          'Academic Jurisdiction Standard: Direct student marks entry and grade evaluations are strictly reserved for appointed course faculty.',
        statuteRef: 'RLSY Academic Examination Regulation §6.1 (Marks Entry Faculty Prerogative)',
      };
    }
    const allowed = isFaculty || Boolean(modulePermissions[role]?.includes('grades'));
    return allowed
      ? { allowed: true }
      : { allowed: false, reason: 'Grade Management is not enabled for your role.' };
  }

  if (key === 'grade_settings' && (isFaculty || isStudent)) {
    return {
      allowed: false,
      reason:
        'Administrative Governance Prerogative: Evaluation head ceilings, passing criteria, and statutory result publication schedules are reserved for College Administration.',
      statuteRef: 'RLSY Examination Board Regulation §8.3 (Institutional Grade Setting)',
    };
  }

  if (key === 'reconciliation_3way') {
    if (isSuperAdmin || isAccountant) return { allowed: true };
    if (
      Boolean(
        user.hasGatewayReconciliationAccess ||
          user.taggedModules?.includes('reconciliation_3way') ||
          modulePermissions[role]?.includes('reconciliation_3way')
      )
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason:
        'Financial Security Seal: The 3-Way Bank/PG/ERP reconciliation module is restricted to authorized financial auditors and Accounts Division officers.',
      statuteRef: 'RLSY Financial Audit Protocol §5.2',
    };
  }

  if (key === 'accountant_requests') {
    if (
      isAccountant ||
      isSuperAdmin ||
      Boolean(
        user.canProcessServiceRequests ||
          user.taggedModules?.includes('accountant_requests') ||
          modulePermissions[role]?.includes('accountant_requests')
      )
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason:
        'Service Desk Clearance: Processing student certificate and duplicate transcript requests requires an appointed Accounts Desk or Registrar clearance.',
      statuteRef: 'Statutory Certificate Issuance Protocol §2.1',
    };
  }

  // Prevent user-level taggedModules from escalating to privileged admin modules
  if (!PRIVILEGED_ADMIN_MODULES.has(key) && user.taggedModules?.includes(key)) {
    return { allowed: true };
  }

  const roleAllowed = modulePermissions[role] || [];
  if (isSuperAdmin || roleAllowed.includes(key)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Institutional Permission Matrix: Access to module "${key}" has been revoked or not provisioned for the "${role}" role.`,
    statuteRef: 'RLSY Institutional Access Control Policy §1.1',
  };
}

/**
 * Sanitizes and normalizes a raw module/tab key string (trimming whitespace and normalizing case)
 * so malformed or trailing-space keys from custom role payloads never break conditional route rendering.
 */
export function normalizeModuleKey(
  rawKey: string | null | undefined,
  fallback: ModuleKey = 'overview'
): ModuleKey | 'restricted_access' {
  const cleaned = String(rawKey ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (cleaned === 'restricted_access') {
    return 'restricted_access';
  }
  if (VALID_MODULE_KEYS.has(cleaned)) {
    return cleaned as ModuleKey;
  }
  return fallback;
}

/**
 * Canonical boolean RBAC check shared by Header, Sidebar, ProtectedRoute, and Express API middleware.
 */
export function canUserAccessModule(
  user: Pick<UserAccount, 'role' | 'taggedModules' | 'hasGatewayReconciliationAccess' | 'canProcessServiceRequests'> | null | undefined,
  moduleKey: string,
  modulePermissions: ModulePermissionMap = DEFAULT_ROLE_MODULE_PERMISSIONS
): boolean {
  const normalized = String(moduleKey ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return evaluateModuleAccess(user, normalized, modulePermissions).allowed;
}

/**
 * Returns the default landing module key for a given user account.
 */
export function getDefaultLandingModule(
  user: Pick<UserAccount, 'role' | 'taggedModules' | 'hasGatewayReconciliationAccess' | 'canProcessServiceRequests'> | null | undefined,
  modulePermissions: ModulePermissionMap = DEFAULT_ROLE_MODULE_PERMISSIONS
): ModuleKey {
  if (!user) return 'overview';
  if (user.role === 'student') return 'student_portal';
  if (user.role === 'accountant') return 'fees';
  if (user.role === 'faculty') return 'faculty_portal';

  const firstPermitted = MODULE_CATALOG.find((item) =>
    canUserAccessModule(user, item.key, modulePermissions)
  );
  return firstPermitted ? firstPermitted.key : 'overview';
}
