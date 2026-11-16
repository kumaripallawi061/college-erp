import React, { useState } from 'react';
import { UserAccount, UserRole, Faculty, CustomRoleDefinition } from '../../types/erp';
import { erpStorage } from '../../services/erpStorage';
import { apiClient } from '../../services/apiClient';
import { generateTempPassword } from '../../utils/erpLogic';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  BookOpen,
  Plus,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  allUsers: UserAccount[];
  customRoles?: CustomRoleDefinition[];
  onOnboardUser: (
    user: Omit<UserAccount, 'id' | 'createdAt'>,
    facultyDetails?: { designation: string; department: string }
  ) => void;
  onToggleUserGatewayReconciliation?: (userId: string) => void;
  onToggleServiceRequestProcessor?: (userId: string) => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  customRoles: propCustomRoles,
  onOnboardUser,
  onToggleUserGatewayReconciliation,
  onToggleServiceRequestProcessor,
}) => {
  const isSuperAdmin = currentUser.role === 'superadmin';
  const isPrincipal = currentUser.role === 'principal';

  const effectiveCustomRoles = propCustomRoles || erpStorage.getCustomRoles();

  const [activeTab, setActiveTab] = useState<'roster' | 'onboard'>('roster');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [targetRole, setTargetRole] = useState<UserRole>(
    isSuperAdmin ? 'principal' : 'faculty'
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [issuedResetInfo, setIssuedResetInfo] = useState<{
    userName: string;
    email: string;
    token: string;
    expiresInSeconds: number;
  } | null>(null);
  const [resetIssueError, setResetIssueError] = useState('');
  const [issuingForUserId, setIssuingForUserId] = useState<string | null>(null);
  const [copiedResetToken, setCopiedResetToken] = useState(false);

  if (!isOpen) return null;

  const handleIssueResetToken = async (target: UserAccount) => {
    setResetIssueError('');
    setIssuedResetInfo(null);
    setIssuingForUserId(target.id);
    try {
      const fullUser = erpStorage.getUsers().find((u) => u.id === target.id) || target;
      const result = await apiClient.issueAdminResetToken(fullUser);
      setIssuedResetInfo({
        userName: result.targetUser.name,
        email: result.targetUser.email,
        token: result.resetToken,
        expiresInSeconds: result.expiresInSeconds,
      });
    } catch (err: any) {
      setResetIssueError(err?.message || 'Unable to generate password reset token.');
    } finally {
      setIssuingForUserId(null);
    }
  };

  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Superadmin Role Escalation Guard: Prevent lower-tier authorized user from provisioning superadmin
    if (targetRole === 'superadmin' && !isSuperAdmin) {
      setErrorMsg('Role Escalation Prohibited: Only an active Super Admin can provision another Super Admin account.');
      return;
    }

    // Check duplicate email or mobile
    const existing = allUsers.find(
      (u) =>
        u.email.toLowerCase() === email.trim().toLowerCase() ||
        u.mobile === mobile.trim()
    );

    if (existing) {
      setErrorMsg(`User with email "${email}" or mobile "${mobile}" already exists.`);
      return;
    }

    try {
      const issuedTempPassword = generateTempPassword();
      onOnboardUser(
        {
          name: name.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
          password: issuedTempPassword, // Unique cryptographic temporary password per staff member
          role: targetRole,
          mustChangePassword: true, // Mandatory change on first login
          onboardedBy: currentUser.id,
          designation: designation.trim() || undefined,
          department: targetRole === 'faculty' ? department : undefined,
        },
        targetRole === 'faculty'
          ? {
              designation: designation.trim() || 'Assistant Professor',
              department,
            }
          : undefined
      );

      setSuccessMsg(
        `Successfully onboarded ${name} as ${targetRole.toUpperCase()}! Login Email: ${email.trim()} | Unique Cryptographic Temp Password: ${issuedTempPassword} (Mandatory password reset enforced on first login).`
      );

      // Reset form fields
      setName('');
      setEmail('');
      setMobile('');
      setDesignation('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to onboard user due to a security violation.');
    }
  };

  const filteredUsers = allUsers.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      String(u.mobile || '').includes(searchQuery)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-8 py-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl">
              <Users className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <span className="text-xs font-mono tracking-wider uppercase text-indigo-300">
                Staff Governance & User Provisioning
              </span>
              <h2 className="text-xl font-black tracking-tight">
                {isSuperAdmin ? 'Institutional Executive Onboarding' : 'Faculty Staff Onboarding'}
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            {isSuperAdmin
              ? 'Super Admin onboards Principal and Accountant. Newly onboarded staff login first-time with their Email and Mobile Number, and are forced to change their password.'
              : 'Principal onboards Faculty members. Their Email and Mobile No are recorded, and first login requires mandatory password reset.'}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setActiveTab('roster')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 border-b-2 ${
              activeTab === 'roster'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Active Staff Directory ({allUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('onboard')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 border-b-2 ${
              activeTab === 'onboard'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Onboard New Staff Member
          </button>
        </div>

        {/* TAB 1: ROSTER VIEW */}
        {activeTab === 'roster' && (
          <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search staff by name, email, role, or mobile..."
                  className="w-full pl-10 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={() => setActiveTab('onboard')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                + Onboard Staff
              </button>
            </div>

            {resetIssueError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{resetIssueError}</span>
                </div>
                <button type="button" onClick={() => setResetIssueError('')} className="text-rose-500 hover:text-rose-700 font-bold">✕</button>
              </div>
            )}

            {issuedResetInfo && (
              <div className="p-4 bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl text-xs space-y-2 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-amber-900">
                      Single-Use Reset Token Issued for {issuedResetInfo.userName} ({issuedResetInfo.email})
                    </p>
                    <p className="text-amber-800 mt-0.5">
                      Share this token securely out-of-band with the user. It expires in {Math.floor(issuedResetInfo.expiresInSeconds / 60)} minutes and can only be used once.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIssuedResetInfo(null)}
                    className="text-amber-700 hover:text-amber-950 font-bold"
                    aria-label="Dismiss issued token"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg font-mono text-xs text-slate-900 break-all select-all">
                    {issuedResetInfo.token}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(issuedResetInfo.token);
                      }
                      setCopiedResetToken(true);
                      setTimeout(() => setCopiedResetToken(false), 2000);
                    }}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition flex items-center gap-1 shrink-0"
                  >
                    {copiedResetToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedResetToken ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Staff Name & Title</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Email ID</th>
                    <th className="px-4 py-3">Registered Mobile</th>
                    <th className="px-4 py-3">Security Status</th>
                    <th className="px-4 py-3">Gateway Reconcile Tag</th>
                    <th className="px-4 py-3">Service Requests Processor</th>
                    {(isSuperAdmin || isPrincipal) && <th className="px-4 py-3">Password Recovery</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredUsers.map((u) => {
                    const roleBadgeColor: Record<string, string> = {
                      superadmin: 'bg-purple-100 text-purple-800 border-purple-200',
                      principal: 'bg-blue-100 text-blue-800 border-blue-200',
                      accountant: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                      faculty: 'bg-amber-100 text-amber-800 border-amber-200',
                      student: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                      librarian: 'bg-cyan-100 text-cyan-800 border-cyan-200',
                      dean_academics: 'bg-amber-100 text-amber-800 border-amber-200',
                    };
                    const customRoleObj = effectiveCustomRoles.find((cr) => cr.code === u.role);

                    const isTagged = Boolean(
                      u.hasGatewayReconciliationAccess || u.taggedModules?.includes('reconciliation_3way')
                    );

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{u.name}</p>
                          <p className="text-xs text-slate-500">{u.designation || 'Staff Member'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${
                              roleBadgeColor[u.role] || 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            {customRoleObj ? customRoleObj.name : u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">{u.email}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{u.mobile}</td>
                        <td className="px-4 py-3">
                          {u.mustChangePassword ? (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit">
                              <KeyRound className="w-3 h-3 text-amber-600" />
                              Pending 1st Login Pwd Reset
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Active & Verified
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.role === 'superadmin' ? (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
                              Admin (Full Access)
                            </span>
                          ) : isSuperAdmin ? (
                            <button
                              type="button"
                              onClick={() => onToggleUserGatewayReconciliation && onToggleUserGatewayReconciliation(u.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
                                isTagged
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300'
                              }`}
                              title={
                                isTagged
                                  ? 'Click to revoke Gateway Reconciliation menu access from this user'
                                  : 'Click to tag Gateway Reconciliation menu access to this user'
                              }
                            >
                              {isTagged ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Tagged (Has Access)</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 text-slate-500" />
                                  <span>Tag Reconcile Menu</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {isTagged ? 'Tagged by Admin' : 'No Access'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const isProcessor = Boolean(
                              u.canProcessServiceRequests ?? (u.role === 'accountant')
                            );
                            if (u.role === 'student') {
                              return <span className="text-xs text-slate-400">Student User</span>;
                            }
                            if (isSuperAdmin) {
                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onToggleServiceRequestProcessor &&
                                    onToggleServiceRequestProcessor(u.id)
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
                                    isProcessor
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100'
                                      : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300'
                                  }`}
                                  title={
                                    isProcessor
                                      ? 'Click to unmap this staff member from processing student service requests'
                                      : 'Click to map this staff member to process student service requests'
                                  }
                                >
                                  {isProcessor ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Mapped (Processes Requests)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3 h-3 text-slate-500" />
                                      <span>Map Processor</span>
                                    </>
                                  )}
                                </button>
                              );
                            }
                            return (
                              <span className="text-xs text-slate-500 font-medium">
                                {isProcessor ? 'Mapped Processor' : 'Not Mapped'}
                              </span>
                            );
                          })()}
                        </td>
                        {(isSuperAdmin || isPrincipal) && (
                          <td className="px-4 py-3">
                            {u.authProvider === 'google' ||
                            (u.email || '').trim().toLowerCase() === 'kumaripallawi061@gmail.com' ? (
                              <span className="text-xs text-slate-400">Google Auth</span>
                            ) : u.role === 'superadmin' && !isSuperAdmin ? (
                              <span className="text-xs text-slate-400">Restricted</span>
                            ) : (
                              <button
                                type="button"
                                disabled={issuingForUserId === u.id}
                                onClick={() => handleIssueResetToken(u)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>{issuingForUserId === u.id ? 'Issuing...' : 'Issue Reset Token'}</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ONBOARD NEW STAFF FORM */}
        {activeTab === 'onboard' && (
          <form onSubmit={handleOnboardSubmit} className="p-8 space-y-5 max-h-[65vh] overflow-y-auto">
            {successMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl flex items-start gap-2.5 text-xs font-semibold animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Onboarding Record Established</p>
                  <p className="text-xs text-emerald-700 mt-0.5">{successMsg}</p>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-rose-50 border border-rose-300 text-rose-800 rounded-2xl flex items-center gap-2 text-xs font-bold">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Role to Onboard</label>
                <select
                  value={targetRole}
                  onChange={(e) => {
                    const newRole = e.target.value as UserRole;
                    setTargetRole(newRole);
                    const matchedCR = effectiveCustomRoles.find((cr) => cr.code === newRole);
                    if (matchedCR && !designation) {
                      setDesignation(matchedCR.name);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {isSuperAdmin && (
                    <>
                      <optgroup label="Standard Administrative Roles">
                        <option value="principal">🏛️ Principal & Executive Head</option>
                        <option value="accountant">💰 Senior Accountant</option>
                        <option value="faculty">👨‍🏫 Faculty Member</option>
                      </optgroup>
                      {effectiveCustomRoles.length > 0 && (
                        <optgroup label="Introduced Custom Role Types">
                          {effectiveCustomRoles.map((cr) => (
                            <option key={cr.code} value={cr.code}>
                              ✨ {cr.name} ({cr.code})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  )}
                  {isPrincipal && (
                    <>
                      <option value="faculty">👨‍🏫 Faculty Member</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Legal Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Ramesh Chander"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official Email ID <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. ramesh.chander@rlsy.ac.in"
                    className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number (First-time Password) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="e.g. 9431987654"
                    className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Academic / Staff Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder={
                    targetRole === 'faculty'
                      ? 'e.g. Assistant Professor'
                      : targetRole === 'accountant'
                      ? 'Senior Accounts Officer'
                      : 'Principal & Executive DDO'
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {targetRole === 'faculty' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                    <option value="Electronics & Communication">Electronics & Communication</option>
                    <option value="Mathematics & Computing">Mathematics & Computing</option>
                    <option value="Physics & Applied Science">Physics & Applied Science</option>
                    <option value="Commerce & Financial Management">Commerce & Financial Management</option>
                  </select>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">First-Time Login Protocol:</p>
              <p>
                1. The onboarded staff member will enter their registered Email (
                <span className="font-mono text-slate-800">{email || 'example@rlsy.ac.in'}</span>) and Mobile No (
                <span className="font-mono text-slate-800">{mobile || '9431XXXXXX'}</span>) as their initial password.
              </p>
              <p>
                2. On authentication, the ERP gates access and forces a mandatory password change before they can enter the
                system.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('roster')}
                className="px-5 py-2.5 border border-slate-300 font-semibold text-slate-700 rounded-xl text-xs hover:bg-slate-50 transition"
              >
                Back to Roster
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md text-xs transition flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                Commit Onboarding
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
