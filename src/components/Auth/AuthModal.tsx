import React, { useState } from 'react';
import { UserAccount, UserRole, EnrollmentField } from '../../types/erp';
import {
  checkAuthLockout,
  clearAuthLockout,
  issuePasswordResetToken,
  recordFailedAuthAttempt,
  validatePasswordComplexity,
} from '../../utils/erpLogic';
import { apiClient } from '../../services/apiClient';
import { erpStorage } from '../../services/erpStorage';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import {
  GraduationCap,
  Lock,
  Mail,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  allUsers: UserAccount[];
  enrollmentFields: EnrollmentField[];
  onLogin: (user: UserAccount) => void;
  onRegisterStudent: (studentData: {
    name: string;
    email: string;
    phone: string;
    password: string;
    enrollmentData: Record<string, any>;
  }) => void;
  onChangePassword: (
    userId: string,
    newPass: string,
    oldPass?: string,
    resetToken?: string
  ) => Promise<UserAccount | void> | UserAccount | void;
  collegeName: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  enrollmentFields,
  onLogin,
  onRegisterStudent,
  onChangePassword,
  collegeName,
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'student_signup'>('signin');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isDemoLoginEnabled = Boolean(
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true'
  );

  // First-time mandatory password change state
  const [pendingPasswordChangeUser, setPendingPasswordChangeUser] = useState<UserAccount | null>(null);
  const [pendingOldPassword, setPendingOldPassword] = useState<string>('');
  const [pendingResetToken, setPendingResetToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  // Forgot Password / Admin-Issued Reset Token State (Self-service OTP disabled)
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<'token' | 'new_password' | 'success'>('token');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotTargetUser, setForgotTargetUser] = useState<UserAccount | null>(null);
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');
  const [showForgotNewPass, _setShowForgotNewPass] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');

  // Admin-Issued Reset Token Recovery: Step 1 - Verify Identifier + Token Input
  const handleVerifyAdminResetToken = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    const input = forgotEmail.trim().toLowerCase();
    const token = forgotResetToken.trim();
    if (!input || !token) {
      setForgotError('Please enter your registered identifier and the single-use reset token issued by your administrator.');
      return;
    }

    const cleanDigits = input.replace(/\D/g, '');
    const target = allUsers.find(
      (u) =>
        (u.email || '').toLowerCase() === input ||
        (cleanDigits.length >= 10 && String(u.mobile || '').replace(/\D/g, '') === cleanDigits) ||
        (u.rollNo && u.rollNo.toLowerCase() === input)
    );

    if (!target || target.authProvider === 'google' || (target.email || '').toLowerCase() === 'kumaripallawi061@gmail.com') {
      setForgotError('Invalid account identifier or reset token. Contact the Super Admin or Principal for assistance.');
      return;
    }

    setForgotTargetUser(target);
    setForgotStep('new_password');
    setForgotError('');
  };

  // Admin-Issued Reset Token Recovery: Step 2 - Set New Password
  const handleResetPasswordWithAdminToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (!forgotTargetUser || !forgotResetToken.trim()) {
      setForgotError('Reset session expired. Please re-enter your admin-issued reset token.');
      return;
    }
    if (forgotNewPass.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      setForgotError('New password and confirmation do not match.');
      return;
    }

    const complexity = validatePasswordComplexity(forgotNewPass, {
      email: forgotTargetUser.email,
      mobile: forgotTargetUser.mobile,
      rollNo: forgotTargetUser.rollNo,
    });
    if (!complexity.valid) {
      setForgotError(complexity.error || 'Password does not meet institutional security requirements.');
      return;
    }

    try {
      await Promise.resolve(
        onChangePassword(
          forgotTargetUser.id,
          forgotNewPass,
          undefined,
          forgotResetToken.trim()
        )
      );
      setForgotResetToken('');
      setForgotNewPass('');
      setForgotConfirmPass('');
      setForgotStep('success');
      setForgotSuccessMsg('Your password has been successfully reset! You can now sign in using your new credentials.');
    } catch (err: any) {
      setForgotError(err?.message || 'Invalid or expired reset token. Please request a fresh token from your administrator.');
    }
  };

  // Student Sign-Up Form State
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentPass, setStudentPass] = useState('');
  const [studentEnrollmentData, setStudentEnrollmentData] = useState<Record<string, any>>({
    course: 'B.Tech Computer Science & Engineering',
    semester: 5,
    meritPercent: 88,
    annualIncome: 350000,
    sportsCategory: 'None',
    bloodGroup: 'B+',
    hostelRequired: false,
  });
  const [signUpErrors, setSignUpErrors] = useState<Record<string, string>>({});

  // Accessible Modal Focus Trap with Escape-to-close (Bugs 92, 147, 237)
  const modalContainerRef = useModalFocusTrap<HTMLDivElement>({
    isOpen,
    onClose,
    preventEscape: Boolean(pendingPasswordChangeUser),
  });

  if (!isOpen) return null;

  // Handle Standard Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedInput = emailOrPhone.trim().toLowerCase();
    if (!trimmedInput || !password) {
      setErrorMessage('Please enter your registered identifier and password.');
      return;
    }

    const lockout = checkAuthLockout(trimmedInput);
    if (lockout.isLocked) {
      setErrorMessage(
        `Account temporarily locked. Please wait ${Math.floor(lockout.remainingSeconds / 60)}m ${String(lockout.remainingSeconds % 60).padStart(2, '0')}s before retrying.`
      );
      return;
    }

    const cleanDigits = trimmedInput.replace(/\D/g, '');
    const user = allUsers.find(
      (u) =>
        (u.email || '').toLowerCase() === trimmedInput ||
        (cleanDigits.length >= 10 && String(u.mobile || '').replace(/\D/g, '') === cleanDigits)
    );

    if (!user) {
      const res = recordFailedAuthAttempt(trimmedInput);
      setErrorMessage(
        res.isLocked
          ? 'Security Alert: Account locked for 15 minutes due to 5 consecutive failed login attempts.'
          : `Invalid credentials. (${res.remainingAttempts} attempt(s) remaining)`
      );
      return;
    }

    // Password verification via authoritative server endpoint (with offline bcrypt fallback)
    const authResult = await apiClient.loginWithServer(password, user);

    if (!authResult.authenticated) {
      const res = recordFailedAuthAttempt(trimmedInput);
      setErrorMessage(
        res.isLocked
          ? 'Security Alert: Account locked for 15 minutes due to 5 consecutive failed login attempts.'
          : `Invalid credentials. (${res.remainingAttempts} attempt(s) remaining)`
      );
      return;
    }

    clearAuthLockout(trimmedInput);

    // Check mandatory password change
    if (user.mustChangePassword || authResult.mustChangePassword) {
      if (!authResult.resetToken) {
        setErrorMessage('Unable to initialize mandatory password reset session. Please retry.');
        return;
      }
      setPendingOldPassword(password);
      setPendingResetToken(authResult.resetToken);
      setPendingPasswordChangeUser(authResult.user || user);
      return;
    }

    onLogin(authResult.user || user);
    onClose();
  };

  // Quick Persona switcher for convenience (Dev mode only)
  const handleQuickLogin = (user: UserAccount) => {
    setErrorMessage('');
    if (user.mustChangePassword) {
      const stored = erpStorage.getUsers().find((u) => u.id === user.id);
      if (stored?.password) {
        setPendingResetToken(issuePasswordResetToken(stored.id, stored.password, 5 * 60 * 1000));
      }
      setPendingPasswordChangeUser(user);
      return;
    }
    onLogin(user);
    onClose();
  };

  // Handle Mandatory Password Change
  const handleConfirmPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    if (pendingPasswordChangeUser) {
      const policy = validatePasswordComplexity(newPassword, {
        email: pendingPasswordChangeUser.email,
        mobile: pendingPasswordChangeUser.mobile,
        rollNo: pendingPasswordChangeUser.rollNo,
      });
      if (!policy.valid) {
        setPasswordError(policy.error || 'Password does not meet institutional security requirements.');
        return;
      }
    }

    if (pendingPasswordChangeUser) {
      try {
        const returnedUser = await Promise.resolve(
          onChangePassword(
            pendingPasswordChangeUser.id,
            newPassword,
            pendingOldPassword,
            pendingResetToken
          )
        );
        const updatedUser: UserAccount = returnedUser || {
          ...pendingPasswordChangeUser,
          mustChangePassword: false,
        };
        onLogin(updatedUser);
        setPendingPasswordChangeUser(null);
        setPendingOldPassword('');
        setPendingResetToken('');
        onClose();
      } catch (err: any) {
        setPasswordError(err?.message || 'Failed to update password.');
      }
    }
  };

  // Handle Student Self Sign-Up
  const handleStudentSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpErrors({});

    const errors: Record<string, string> = {};
    if (!studentName.trim()) errors.name = 'Candidate full name is required.';
    if (!studentEmail.trim()) errors.email = 'Email ID is required.';
    if (!studentPhone.trim()) errors.phone = 'Mobile number is required.';
    if (studentPass.length < 8) {
      errors.pass = 'Password must be at least 8 characters.';
    } else {
      const policy = validatePasswordComplexity(studentPass, {
        email: studentEmail.trim().toLowerCase(),
        mobile: studentPhone.trim(),
        rollNo: String(studentEnrollmentData.rollNo || ''),
      });
      if (!policy.valid) {
        errors.pass = policy.error || 'Password does not meet institutional security requirements.';
      }
    }

    const rollNoVal = String(studentEnrollmentData.rollNo || '').trim().toUpperCase();
    const dobVal = String(studentEnrollmentData.dob || '').trim();
    if (rollNoVal) {
      const rosterMatch = erpStorage.getStudents().find(
        (s) => (s.rollNo || '').trim().toUpperCase() === rollNoVal
      );
      if (!rosterMatch || !rosterMatch.dob || rosterMatch.dob.trim() !== dobVal) {
        errors.rollNo = 'Roll Number and Date of Birth must match our pre-imported institutional roster.';
      }
    }

    // Check mandatory fields defined by Enrollment Schema
    enrollmentFields.forEach((field) => {
      if (field.mode === 'mandatory') {
        const val = studentEnrollmentData[field.key];
        if (
          val === undefined ||
          val === null ||
          (typeof val === 'string' && val.trim() === '')
        ) {
          // If the field is one of the top inputs, it's already checked
          if (!['name', 'email', 'phone'].includes(field.key)) {
            errors[field.key] = `${field.label} is mandatory for admission onboarding.`;
          }
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setSignUpErrors(errors);
      return;
    }

    onRegisterStudent({
      name: studentName.trim(),
      email: studentEmail.trim(),
      phone: studentPhone.trim(),
      password: studentPass,
      enrollmentData: studentEnrollmentData,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        ref={modalContainerRef}
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95"
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-8 py-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition"
            aria-label="Close"
          >
            ✕
          </button>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl">
              <GraduationCap className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <span className="text-xs font-mono tracking-wider uppercase text-indigo-300">
                Institutional Access & Identity Gate
              </span>
              <h2 className="text-xl font-black tracking-tight">{collegeName}</h2>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            Unified single sign-on for students, faculty members, accountant, principal, and super admin.
          </p>
        </div>

        {/* MANDATORY PASSWORD CHANGE OVERLAY */}
        {pendingPasswordChangeUser ? (
          <div className="p-8 space-y-6 bg-amber-50/50">
            <div className="flex items-start space-x-3 p-4 bg-amber-100/80 border border-amber-300 rounded-2xl text-amber-900">
              <KeyRound className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Mandatory First-Time Password Reset</h4>
                <p className="text-xs mt-1 text-amber-800">
                  Welcome, <span className="font-bold">{pendingPasswordChangeUser.name}</span> (
                  {pendingPasswordChangeUser.role.toUpperCase()}). You have been onboarded with your registered
                  mobile number. Per college IT governance policy, you must create a new private password before
                  accessing your portal.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmPasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Secure Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 8 characters"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {passwordError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md text-sm transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save Password & Proceed to ERP
                </button>
                <button
                  type="button"
                  onClick={() => setPendingPasswordChangeUser(null)}
                  className="px-5 py-3 border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 rounded-xl text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            {/* Tabs for Sign In vs Student Self Registration */}
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  setActiveTab('signin');
                  setErrorMessage('');
                }}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 border-b-2 ${
                  activeTab === 'signin'
                    ? 'border-indigo-600 text-indigo-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Lock className="w-4 h-4" />
                Sign In to ERP
              </button>
              <button
                onClick={() => {
                  setActiveTab('student_signup');
                  setErrorMessage('');
                }}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 border-b-2 ${
                  activeTab === 'student_signup'
                    ? 'border-indigo-600 text-indigo-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                Student Registration / Sign Up
              </button>
            </div>

            {/* TAB 1: SIGN IN OR FORGOT PASSWORD */}
            {activeTab === 'signin' && (
              <div className="p-8 space-y-6">
                {isForgotMode ? (
                  /* FORGOT PASSWORD SUB-VIEW (ADMIN-ISSUED RESET TOKEN ONLY) */
                  <div className="space-y-4">
                    <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Recover Account Password</h3>
                        <p className="text-xs text-slate-500">Enter the single-use reset token issued by Super Admin or Principal.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotMode(false);
                          setForgotError('');
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                      >
                        ← Back to Sign In
                      </button>
                    </div>

                    {forgotError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{forgotError}</span>
                      </div>
                    )}

                    {forgotStep === 'token' && (
                      <form onSubmit={handleVerifyAdminResetToken} className="space-y-4">
                        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs">
                          Self-service OTP reset is disabled. Request a 5-minute single-use reset token from your institutional administrator.
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Registered Email ID / Roll No / Mobile Number
                          </label>
                          <input
                            type="text"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="e.g. faculty@rlsy.ac.in"
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Admin-Issued Reset Token
                          </label>
                          <input
                            type="text"
                            value={forgotResetToken}
                            onChange={(e) => setForgotResetToken(e.target.value)}
                            placeholder="Paste single-use reset token"
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Continue to Set New Password</span>
                        </button>
                      </form>
                    )}

                    {forgotStep === 'new_password' && (
                      <form onSubmit={handleResetPasswordWithAdminToken} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            New Permanent Password
                          </label>
                          <input
                            type={showForgotNewPass ? 'text' : 'password'}
                            value={forgotNewPass}
                            onChange={(e) => setForgotNewPass(e.target.value)}
                            placeholder="Min 8 chars (Upper, Lower, Number, Special)"
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            value={forgotConfirmPass}
                            onChange={(e) => setForgotConfirmPass(e.target.value)}
                            placeholder="Re-enter password"
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition"
                        >
                          Save New Password
                        </button>
                      </form>
                    )}

                    {forgotStep === 'success' && (
                      <div className="text-center py-4 space-y-3">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                        <h4 className="font-bold text-slate-900 text-sm">Password Reset Successfully!</h4>
                        <p className="text-xs text-slate-600">{forgotSuccessMsg}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotMode(false);
                            setForgotStep('token');
                          }}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
                        >
                          Return to Sign In
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* STANDARD SIGN IN FORM */
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email ID or Registered Mobile Number
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={emailOrPhone}
                          onChange={(e) => setEmailOrPhone(e.target.value)}
                          placeholder="e.g. kumaripallawi061@gmail.com"
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50/50"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-slate-700">Password</label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotEmail(emailOrPhone.trim());
                            setForgotStep('token');
                            setForgotError('');
                            setForgotSuccessMsg('');
                            setForgotResetToken('');
                            setForgotNewPass('');
                            setForgotConfirmPass('');
                            setIsForgotMode(true);
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50/50"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {errorMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md text-sm transition flex items-center justify-center gap-2"
                    >
                      Authenticate & Enter Portal
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}

                {/* Instant Quick Login Selector (Dev Flag Only) */}
                {isDemoLoginEnabled && (
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Quick Demo Role Switcher (Dev Mode)
                      </span>
                      <span className="text-xs text-slate-400">One-click test authentication</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {allUsers.slice(0, 10).map((u) => {
                        const isCurrent = currentUser?.id === u.id;
                        const roleBadgeStyles: Record<UserRole, string> = {
                          superadmin: 'bg-purple-100 text-purple-800 border-purple-200',
                          principal: 'bg-blue-100 text-blue-800 border-blue-200',
                          accountant: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                          faculty: 'bg-amber-100 text-amber-800 border-amber-200',
                          student: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                        };

                        return (
                          <button
                            key={u.id}
                            onClick={() => handleQuickLogin(u)}
                            className={`p-2.5 rounded-xl border text-left flex items-start justify-between transition ${
                              isCurrent
                                ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-200'
                                : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <div className="truncate mr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-900 truncate">{u.name}</span>
                                {u.mustChangePassword && (
                                  <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-500 text-white">
                                    Pwd Reset
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 block truncate">{u.email}</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold uppercase border shrink-0 ${
                                roleBadgeStyles[u.role]
                              }`}
                            >
                              {u.role}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STUDENT REGISTRATION */}
            {activeTab === 'student_signup' && (
              <form onSubmit={handleStudentSignUp} className="p-8 space-y-5 max-h-[60vh] overflow-y-auto">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-900 flex items-start gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Institutional Candidate Onboarding</p>
                    <p className="text-xs text-indigo-700">
                      Fields marked as <span className="text-rose-600 font-bold">* Mandatory</span> are strictly
                      enforced by the College Enrollment Schema. Non-editable statutory fields (such as Roll No) are
                      managed officially by the Principal / Accounts office.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Candidate Full Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="e.g. Vikramaditya Singh"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                    {signUpErrors.name && <p className="text-xs text-rose-600 mt-1">{signUpErrors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="email"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="e.g. vikram@gmail.com"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                    {signUpErrors.email && <p className="text-xs text-rose-600 mt-1">{signUpErrors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      WhatsApp / Mobile No <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="tel"
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                      placeholder="e.g. 9876501234"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                    {signUpErrors.phone && <p className="text-xs text-rose-600 mt-1">{signUpErrors.phone}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Set Portal Password <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="password"
                      value={studentPass}
                      onChange={(e) => setStudentPass(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                    {signUpErrors.pass && <p className="text-xs text-rose-600 mt-1">{signUpErrors.pass}</p>}
                  </div>
                </div>

                {/* DYNAMIC ENROLLMENT FORM PARAMETERS */}
                <div className="pt-3 border-t border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                    Institutional Parameters (Dynamic Enrollment Schema)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {enrollmentFields
                      .filter((f) => !['name', 'email', 'phone'].includes(f.key))
                      .map((f) => {
                        const isNonEditable = f.mode === 'non_editable';
                        const isMandatory = f.mode === 'mandatory';
                        const currentVal = studentEnrollmentData[f.key] ?? f.defaultValue ?? '';

                        return (
                          <div key={f.id} className={isNonEditable ? 'opacity-80' : ''}>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-medium text-slate-700">
                                {f.label}
                                {isMandatory && <span className="text-rose-600 ml-0.5">*</span>}
                              </label>
                              {isNonEditable && (
                                <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-slate-200 text-slate-600">
                                  Official Only
                                </span>
                              )}
                            </div>

                            {f.type === 'select' && f.options ? (
                              <select
                                disabled={isNonEditable}
                                value={currentVal}
                                onChange={(e) =>
                                  setStudentEnrollmentData({
                                    ...studentEnrollmentData,
                                    [f.key]: e.target.value,
                                  })
                                }
                                className={`w-full px-3 py-2 border rounded-xl text-xs ${
                                  isNonEditable
                                    ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {f.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : f.type === 'boolean' ? (
                              <div className="flex items-center gap-3 py-2">
                                <label className="flex items-center gap-1.5 text-xs">
                                  <input
                                    type="checkbox"
                                    disabled={isNonEditable}
                                    checked={!!currentVal}
                                    onChange={(e) =>
                                      setStudentEnrollmentData({
                                        ...studentEnrollmentData,
                                        [f.key]: e.target.checked,
                                      })
                                    }
                                    className="rounded border-slate-300 text-indigo-600"
                                  />
                                  <span>Yes / Active</span>
                                </label>
                              </div>
                            ) : (
                              <input
                                type={f.type === 'number' ? 'number' : 'text'}
                                disabled={isNonEditable}
                                value={isNonEditable ? '(Assigned post verification by College)' : currentVal}
                                onChange={(e) =>
                                  setStudentEnrollmentData({
                                    ...studentEnrollmentData,
                                    [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                                  })
                                }
                                className={`w-full px-3 py-2 border rounded-xl text-xs ${
                                  isNonEditable
                                    ? 'bg-slate-100 text-slate-500 italic cursor-not-allowed border-slate-200'
                                    : 'border-slate-300 bg-white'
                                }`}
                              />
                            )}

                            {signUpErrors[f.key] && (
                              <p className="text-xs text-rose-600 mt-0.5">{signUpErrors[f.key]}</p>
                            )}
                            {f.description && (
                              <p className="text-xs text-slate-400 mt-0.5">{f.description}</p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md text-sm transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Complete Registration & Open Student Portal
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
