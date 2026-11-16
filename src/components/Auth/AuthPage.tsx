import React, { useState } from 'react';
import { UserAccount, UserRole, CollegeProfile, Student } from '../../types/erp';
import {
  GraduationCap,
  ShieldCheck,
  Lock,
  Mail,
  Phone,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Building2,
  Users,
  Coins,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Calendar,
  Briefcase,
  Award,
  Copy,
  Check,
  Key,
} from 'lucide-react';
import {
  checkAuthLockout,
  recordFailedAuthAttempt,
  clearAuthLockout,
  validatePasswordComplexity,
  issuePasswordResetToken,
} from '../../utils/erpLogic';
import { apiClient } from '../../services/apiClient';
import { erpStorage } from '../../services/erpStorage';

interface AuthPageProps {
  collegeProfile: CollegeProfile;
  allUsers: UserAccount[];
  students: Student[];
  availableCourses?: string[];
  onLogin: (user: UserAccount) => void;
  onRegisterStudent: (data: {
    rollNo: string;
    dob: string;
    name: string;
    email: string;
    phone: string;
    password: string;
    course: string;
    semester: number;
  }) => Promise<void> | void;
  onChangePassword: (
    userId: string,
    newPass: string,
    oldPass?: string,
    resetToken?: string
  ) => Promise<UserAccount | void> | UserAccount | void;
}

export const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const AuthPage: React.FC<AuthPageProps> = ({
  collegeProfile,
  allUsers,
  students,
  availableCourses = [],
  onLogin,
  onRegisterStudent,
  onChangePassword,
}) => {
  // Mode: 'student' (default page), 'staff', or 'forgot_password'
  const [authMode, setAuthMode] = useState<'student' | 'staff' | 'forgot_password'>('student');
  const [previousAuthMode, setPreviousAuthMode] = useState<'student' | 'staff'>('staff');
  const [studentTab, setStudentTab] = useState<'signin' | 'signup'>('signin');
  const isDemoLoginEnabled = Boolean(
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true'
  );

  // Forgot Password / Admin-Issued Reset Token State (Self-service OTP disabled by security policy)
  const [forgotStep, setForgotStep] = useState<'token' | 'new_password' | 'success'>('token');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotTargetUser, setForgotTargetUser] = useState<UserAccount | null>(null);
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');
  const [showForgotNewPass, setShowForgotNewPass] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');

  // Available course list
  const defaultCourses = [
    'B.Tech Computer Science & Engineering',
    'B.Tech Electronics & Communication',
    'BCA (Bachelor of Computer Applications)',
    'B.Sc. Information Technology',
    'B.Sc Physics Hons',
    'B.Com Hons (Accounting & Finance)',
    'B.A. Political Science Hons',
  ];
  const coursesList = availableCourses.length > 0 ? availableCourses : defaultCourses;

  // Student Sign-In fields
  const [studentLoginId, setStudentLoginId] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showStudentPass, setShowStudentPass] = useState(false);
  const [studentError, setStudentError] = useState('');

  // Student Sign-Up fields (Roll No, Date of Birth, Email, Password, Name, Phone, Course, Semester)
  const [signUpRollNo, setSignUpRollNo] = useState('');
  const [signUpDob, setSignUpDob] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpCourse, setSignUpCourse] = useState(coursesList[0]);
  const [signUpSemester, setSignUpSemester] = useState<number>(1);
  const [signUpPass, setSignUpPass] = useState('');
  const [signUpConfirmPass, setSignUpConfirmPass] = useState('');
  const [signUpError, setSignUpError] = useState('');

  // Staff Sign-In fields
  const [staffEmailOrMobile, setStaffEmailOrMobile] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPass, setShowStaffPass] = useState(false);
  const [staffError, setStaffError] = useState('');

  // Google Admin Sign-In state (OAuth ID token only)
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState('');
  const [isGoogleAuthenticating, setIsGoogleAuthenticating] = useState(false);
  const [googleOAuthStatus, setGoogleOAuthStatus] = useState<{
    checked: boolean;
    enabled: boolean;
    clientId?: string;
  }>({ checked: false, enabled: false });
  const googleButtonRef = React.useRef<HTMLDivElement | null>(null);
  const onLoginRef = React.useRef(onLogin);
  onLoginRef.current = onLogin;

  // Brute-force account lockout state & live countdown timer
  const [lockoutRemainingSeconds, setLockoutRemainingSeconds] = useState<number>(0);
  const [lockedTargetIdentifier, setLockedTargetIdentifier] = useState<string>('');


  React.useEffect(() => {
    if (lockoutRemainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemainingSeconds]);

  // Load Google OAuth availability & initialize Google Identity Services when modal opens
  React.useEffect(() => {
    if (!isGoogleModalOpen) return;
    let cancelled = false;
    setGoogleAuthError('');
    setGoogleOAuthStatus({ checked: false, enabled: false });

    const initGoogleButton = async () => {
      const status = await apiClient.checkGoogleAdminStatus();
      if (cancelled) return;
      setGoogleOAuthStatus({
        checked: true,
        enabled: Boolean(status.enabled && status.clientId),
        clientId: status.clientId,
      });
      if (!status.enabled || !status.clientId) {
        return;
      }

      const mountGisButton = () => {
        if (cancelled) return;
        const g = (window as any).google;
        if (!g?.accounts?.id || !googleButtonRef.current) return;
        g.accounts.id.initialize({
          client_id: status.clientId,
          callback: async (response: { credential?: string }) => {
            if (!response?.credential) {
              setGoogleAuthError('Google Sign-In did not return a verified ID token.');
              return;
            }
            setIsGoogleAuthenticating(true);
            setGoogleAuthError('');
            try {
              const result = await apiClient.verifyGoogleAdminToken(response.credential);
              if (result.authenticated && result.user) {
                setIsGoogleModalOpen(false);
                onLoginRef.current(result.user);
              } else {
                setGoogleAuthError(result.error || 'Google administrator verification failed.');
              }
            } catch (err: any) {
              setGoogleAuthError(err?.message || 'Google administrator verification failed.');
            } finally {
              setIsGoogleAuthenticating(false);
            }
          },
        });
        googleButtonRef.current.innerHTML = '';
        g.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'signin_with',
        });
      };

      if ((window as any).google?.accounts?.id) {
        mountGisButton();
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://accounts.google.com/gsi/client"]'
      );
      if (existingScript) {
        existingScript.addEventListener('load', mountGisButton, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = mountGisButton;
      script.onerror = () => {
        if (!cancelled) {
          setGoogleAuthError('Unable to load Google Identity Services library.');
        }
      };
      document.head.appendChild(script);
    };

    void initGoogleButton();
    return () => {
      cancelled = true;
    };
  }, [isGoogleModalOpen]);

  // Mandatory first-time password change modal state
  const [pendingPasswordChangeUser, setPendingPasswordChangeUser] = useState<UserAccount | null>(null);
  const [pendingOldPassword, setPendingOldPassword] = useState<string>('');
  const [pendingResetToken, setPendingResetToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');

  // Keep Roll Number input strictly user-entered without exposing roster PII/DOB
  const handleRollNoChange = (val: string) => {
    setSignUpRollNo(val);
  };

  // Student Sign In Submission
  const handleStudentSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError('');

    const input = studentLoginId.trim().toLowerCase();
    if (!input || !studentPassword) {
      setStudentError('Please enter your Roll Number / Email ID and Password.');
      return;
    }

    // Check account lockout status
    const lockout = checkAuthLockout(input);
    if (lockout.isLocked) {
      setLockoutRemainingSeconds(lockout.remainingSeconds);
      setLockedTargetIdentifier(input);
      setStudentError(
        `Account locked due to 5 consecutive failed login attempts. Please wait ${Math.floor(
          lockout.remainingSeconds / 60
        )}m ${String(lockout.remainingSeconds % 60).padStart(2, '0')}s before retrying.`
      );
      return;
    }

    // Match student account by email, rollNo, or studentId (null-safe)
    const user = allUsers.find(
      (u) =>
        u.role === 'student' &&
        ((u.email || '').toLowerCase() === input ||
          (u.rollNo && u.rollNo.toLowerCase() === input) ||
          (u.studentId && u.studentId.toLowerCase() === input))
    );

    if (!user) {
      const res = recordFailedAuthAttempt(input);
      if (res.isLocked) {
        setLockoutRemainingSeconds(res.remainingSeconds);
        setLockedTargetIdentifier(input);
        setStudentError('Security Alert: Account locked for 15 minutes due to 5 consecutive failed login attempts.');
      } else {
        setStudentError(
          `Invalid credentials (${res.remainingAttempts} attempt(s) remaining before a 15-minute account lockout).`
        );
      }
      return;
    }

    const authResult = await apiClient.loginWithServer(studentPassword, user);

    if (!authResult.authenticated) {
      const res = recordFailedAuthAttempt(input);
      if (res.isLocked) {
        setLockoutRemainingSeconds(res.remainingSeconds);
        setLockedTargetIdentifier(input);
        setStudentError('Security Alert: Account locked for 15 minutes due to 5 consecutive failed login attempts.');
      } else {
        setStudentError(
          `Invalid credentials (${res.remainingAttempts} attempt(s) remaining before a 15-minute account lockout).`
        );
      }
      return;
    }

    // Success: clear lockout counters
    clearAuthLockout(input);

    if (user.mustChangePassword || authResult.mustChangePassword) {
      if (!authResult.resetToken) {
        setStudentError('Unable to initialize mandatory password reset session. Please retry or contact administration.');
        return;
      }
      setPendingOldPassword(studentPassword);
      setPendingResetToken(authResult.resetToken);
      setPendingPasswordChangeUser(authResult.user || user);
      return;
    }

    onLogin(authResult.user || user);
  };

  // Student Sign Up Submission
  const handleStudentSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError('');

    if (!signUpRollNo.trim()) {
      setSignUpError('Roll Number is mandatory.');
      return;
    }
    if (!signUpDob) {
      setSignUpError('Date of Birth is mandatory.');
      return;
    }
    if (!signUpName.trim()) {
      setSignUpError('Full Name is mandatory.');
      return;
    }
    if (!signUpEmail.trim() || !signUpEmail.includes('@')) {
      setSignUpError('A valid Email ID is mandatory for future relogin.');
      return;
    }
    if (!signUpPhone.trim()) {
      setSignUpError('A valid WhatsApp / Mobile Number is mandatory.');
      return;
    }
    if (!signUpPass || signUpPass.length < 8) {
      setSignUpError('Password must be at least 8 characters for secure relogin.');
      return;
    }
    const signUpPolicy = validatePasswordComplexity(signUpPass, {
      email: signUpEmail.trim().toLowerCase(),
      mobile: signUpPhone.trim(),
      rollNo: signUpRollNo.trim().toUpperCase(),
    });
    if (!signUpPolicy.valid) {
      setSignUpError(signUpPolicy.error || 'Password does not meet institutional security complexity requirements.');
      return;
    }
    if (signUpPass !== signUpConfirmPass) {
      setSignUpError('Password and confirmation do not match.');
      return;
    }

    try {
      await onRegisterStudent({
        rollNo: signUpRollNo.trim().toUpperCase(),
        dob: signUpDob,
        name: signUpName.trim(),
        email: signUpEmail.trim().toLowerCase(),
        phone: signUpPhone.trim(),
        password: signUpPass,
        course: signUpCourse,
        semester: Number(signUpSemester),
      });
    } catch (err: any) {
      setSignUpError(err.message || 'Registration rejected due to an account conflict.');
    }
  };

  // Staff Sign In Submission (Departmental Personnel Only)
  const handleStaffSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError('');

    const input = staffEmailOrMobile.trim().toLowerCase();
    const cleanPhone = input.replace(/\D/g, '');

    if (!input || !staffPassword) {
      setStaffError('Please enter your official registered Email ID or Mobile No and Password.');
      return;
    }

    // Google-secured Super Administrator protection: Block password login
    if (input === 'kumaripallawi061@gmail.com') {
      setStaffError(
        'The Administrator account (kumaripallawi061@gmail.com) is secured exclusively through Google Mail. Password login has been removed for this account. Please use the "Sign in through Gmail" link at the bottom of the screen.'
      );
      return;
    }

    // Check account lockout status
    const lockout = checkAuthLockout(input);
    if (lockout.isLocked) {
      setLockoutRemainingSeconds(lockout.remainingSeconds);
      setLockedTargetIdentifier(input);
      setStaffError(
        `Staff account locked due to 5 consecutive failed login attempts. Please wait ${Math.floor(
          lockout.remainingSeconds / 60
        )}m ${String(lockout.remainingSeconds % 60).padStart(2, '0')}s before retrying.`
      );
      return;
    }

    const user = allUsers.find(
      (u) =>
        u.role !== 'student' &&
        ((u.email || '').toLowerCase() === input ||
          (cleanPhone.length >= 10 && String(u.mobile || '').replace(/\D/g, '') === cleanPhone))
    );

    if (user && (user.authProvider === 'google' || (user.email || '').toLowerCase() === 'kumaripallawi061@gmail.com')) {
      setStaffError(
        'This administrator account is secured exclusively through Google Mail. Password login has been decommissioned. Please use the "Sign in with Google" button above.'
      );
      return;
    }

    if (!user) {
      const res = recordFailedAuthAttempt(input);
      if (res.isLocked) {
        setLockoutRemainingSeconds(res.remainingSeconds);
        setLockedTargetIdentifier(input);
        setStaffError('Security Alert: Staff account locked for 15 minutes due to 5 consecutive failed login attempts.');
      } else {
        setStaffError(
          `Invalid credentials (${res.remainingAttempts} attempt(s) remaining before a 15-minute lockout).`
        );
      }
      return;
    }

    // Password validation via server bcrypt verification
    const authResult = await apiClient.loginWithServer(staffPassword, user);

    if (!authResult.authenticated) {
      const res = recordFailedAuthAttempt(input);
      if (res.isLocked) {
        setLockoutRemainingSeconds(res.remainingSeconds);
        setLockedTargetIdentifier(input);
        setStaffError('Security Alert: Staff account locked for 15 minutes due to 5 consecutive failed login attempts.');
      } else {
        setStaffError(
          `Invalid credentials (${res.remainingAttempts} attempt(s) remaining before a 15-minute account lockout).`
        );
      }
      return;
    }

    // Success: clear lockout counters
    clearAuthLockout(input);

    if (user.mustChangePassword || authResult.mustChangePassword) {
      if (!authResult.resetToken) {
        setStaffError('Unable to initialize mandatory password reset session. Please retry or contact your administrator.');
        return;
      }
      setPendingOldPassword(staffPassword);
      setPendingResetToken(authResult.resetToken);
      setPendingPasswordChangeUser(authResult.user || user);
      return;
    }

    onLogin(authResult.user || user);
  };

  // Handle Mandatory Password Change Confirmation
  const handleConfirmPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError('');

    if (newPassword.length < 8) {
      setPasswordChangeError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordChangeError('New password and confirmation do not match.');
      return;
    }

    if (pendingPasswordChangeUser) {
      const policy = validatePasswordComplexity(newPassword, {
        email: pendingPasswordChangeUser.email,
        mobile: pendingPasswordChangeUser.mobile,
        rollNo: pendingPasswordChangeUser.rollNo,
      });
      if (!policy.valid) {
        setPasswordChangeError(policy.error || 'Password does not meet institutional security complexity requirements.');
        return;
      }
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
        setPendingPasswordChangeUser(null);
        setPendingOldPassword('');
        setPendingResetToken('');
        onLogin(updatedUser);
      } catch (err: any) {
        setPasswordChangeError(err?.message || 'Failed to update password. Please try again.');
      }
    }
  };

  // Quick Demo Login helper
  const handleQuickLogin = (user: UserAccount) => {
    if (user.mustChangePassword) {
      const stored = erpStorage.getUsers().find((u) => u.id === user.id);
      if (stored?.password) {
        setPendingResetToken(issuePasswordResetToken(stored.id, stored.password, 5 * 60 * 1000));
      }
      setPendingPasswordChangeUser(user);
      return;
    }
    onLogin(user);
  };


  // Admin-Issued Reset Token Recovery: Step 1 - Enter Registered Account + Single-Use Admin Reset Token
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8">
      {/* College Identity Header */}
      <div className="max-w-4xl mx-auto w-full text-center space-y-2 pt-4">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-sans font-black tracking-tight text-white">
          {collegeProfile.name}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto font-sans">
          {collegeProfile.affiliation}
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="max-w-xl mx-auto w-full my-6">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle top amber glow */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-indigo-500 to-amber-500" />


          {/* ============================================================== */}
          {/* DEFAULT VIEW: STUDENT AUTHENTICATION (SIGN IN & SIGN UP)       */}
          {/* ============================================================== */}
          {authMode === 'student' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-bold text-white tracking-wide">
                      Student Academic Portal
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Access your grades, fees, hall ticket, and congratulation honors.
                  </p>
                </div>

                {/* Tabs: Sign In / Sign Up */}
                <div className="flex p-1 bg-slate-800 rounded-xl border border-slate-700 text-xs font-semibold">
                  <button
                    onClick={() => {
                      setStudentTab('signin');
                      setStudentError('');
                    }}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      studentTab === 'signin'
                        ? 'bg-amber-400 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setStudentTab('signup');
                      setSignUpError('');
                    }}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      studentTab === 'signup'
                        ? 'bg-amber-400 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    New Sign Up
                  </button>
                </div>
              </div>

              {/* TAB 1: STUDENT SIGN IN */}
              {studentTab === 'signin' && (
                <form onSubmit={handleStudentSignIn} className="space-y-4">
                  {studentError && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span className="font-sans font-semibold leading-relaxed">{studentError}</span>
                    </div>
                  )}

                  {lockoutRemainingSeconds > 0 && (
                    <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <strong className="text-rose-300 block font-bold">Account Security Lockout Active</strong>
                        <p className="mt-0.5 text-xs text-rose-200/90 leading-relaxed">
                          Too many failed attempts. Temporary lockout active for{' '}
                          <span className="font-mono font-bold text-white bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">
                            {Math.floor(lockoutRemainingSeconds / 60)}m {String(lockoutRemainingSeconds % 60).padStart(2, '0')}s
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      University Roll Number / Registered Email ID
                    </label>
                    <div className="relative">
                      <GraduationCap className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={studentLoginId}
                        onChange={(e) => setStudentLoginId(e.target.value)}
                        placeholder="e.g. 2025CS001 or aarav.kumar@rlsy.ac.in"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviousAuthMode('student');
                          setForgotEmail(studentLoginId.trim());
                          setForgotStep('token');
                          setForgotError('');
                          setForgotSuccessMsg('');
                          setForgotResetToken('');
                          setForgotNewPass('');
                          setForgotConfirmPass('');
                          setAuthMode('forgot_password');
                        }}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type={showStudentPass ? 'text' : 'password'}
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStudentPass(!showStudentPass)}
                        aria-label={showStudentPass ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200"
                      >
                        {showStudentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={lockoutRemainingSeconds > 0}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
                  >
                    <span>{lockoutRemainingSeconds > 0 ? 'Locked (Wait for Timer)' : 'Sign In to Student Portal'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* 1-Click Demo Student Accounts (Dev Flag Only) */}
                  {isDemoLoginEnabled && (
                    <div className="pt-2">
                      <span className="text-xs font-semibold text-slate-400 block mb-1.5">
                        Instant 1-Click Demo Login (Dev Mode):
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {allUsers
                          .filter((u) => u.role === 'student')
                          .slice(0, 2)
                          .map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => handleQuickLogin(u)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition"
                            >
                              <span className="font-bold text-xs text-amber-300 block truncate">
                                {u.name}
                              </span>
                              <span className="font-mono text-xs text-slate-400">
                                Roll: {u.rollNo}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* TAB 2: STUDENT SIGN UP (Roll No & Date of Birth & Email & Password) */}
              {studentTab === 'signup' && (
                <form onSubmit={handleStudentSignUp} className="space-y-3.5">
                  <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-xs text-indigo-200">
                    Enter your college <strong>Roll Number</strong> and <strong>Date of Birth</strong> to register.
                    Ensure you provide an accurate <strong>Email ID</strong> and <strong>Password</strong> for subsequent relogin.
                  </div>

                  {signUpError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{signUpError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Roll No */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        University Roll Number *
                      </label>
                      <input
                        type="text"
                        value={signUpRollNo}
                        onChange={(e) => handleRollNoChange(e.target.value)}
                        placeholder="e.g. 2025CS001"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400 font-mono"
                      />
                    </div>

                    {/* Date of Birth */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Date of Birth (DOB) *
                      </label>
                      <input
                        type="date"
                        value={signUpDob}
                        onChange={(e) => setSignUpDob(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Full Candidate Name *
                    </label>
                    <input
                      type="text"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      placeholder="e.g. Aarav Kumar"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400 font-medium"
                    />
                  </div>

                  {/* Degree Course and Semester Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Degree Programme / Course *
                      </label>
                      <select
                        value={signUpCourse}
                        onChange={(e) => setSignUpCourse(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-400 font-medium"
                      >
                        {coursesList.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Current Semester *
                      </label>
                      <select
                        value={signUpSemester}
                        onChange={(e) => setSignUpSemester(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-400 font-medium font-mono"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                          <option key={sem} value={sem}>
                            Semester {sem}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Email for relogin */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Email ID (For Relogin) *
                      </label>
                      <input
                        type="email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        placeholder="student@rlsy.ac.in"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400 font-medium"
                      />
                    </div>

                    {/* Mobile Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        WhatsApp / Mobile No *
                      </label>
                      <input
                        type="tel"
                        value={signUpPhone}
                        onChange={(e) => setSignUpPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Password for relogin */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Create Password (For Relogin) *
                      </label>
                      <input
                        type="password"
                        value={signUpPass}
                        onChange={(e) => setSignUpPass(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        value={signUpConfirmPass}
                        onChange={(e) => setSignUpConfirmPass(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Register Student & Sign In</span>
                  </button>
                </form>
              )}

              {/* LINK ON LOWER SIDE: STAFF SIGN IN */}
              <div className="pt-4 border-t border-slate-800 text-center">
                <p className="text-xs text-slate-400 mb-2">
                  Academic or Administrative Personnel?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('staff');
                    setStaffError('');
                  }}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl text-xs font-bold border border-indigo-700/50 shadow-sm transition flex items-center justify-center gap-2"
                >
                  <Briefcase className="w-4 h-4 text-indigo-400" />
                  <span>Staff Login</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STAFF AUTHENTICATION VIEW                                      */}
          {/* ============================================================== */}
          {authMode === 'staff' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    Staff & Administration Sign In
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Institutional access for authorized departmental personnel and staff.
                </p>
              </div>

              <form onSubmit={handleStaffSignIn} className="space-y-4">
                {staffError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{staffError}</span>
                  </div>
                )}

                {lockoutRemainingSeconds > 0 && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <strong className="text-rose-300 block font-bold">Staff Security Lockout Active</strong>
                      <p className="mt-0.5 text-xs text-rose-200/90 leading-relaxed">
                        Too many failed attempts. Security lockout active for{' '}
                        <span className="font-mono font-bold text-white bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">
                          {Math.floor(lockoutRemainingSeconds / 60)}m {String(lockoutRemainingSeconds % 60).padStart(2, '0')}s
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Departmental Staff Email ID / Mobile Number
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={staffEmailOrMobile}
                      onChange={(e) => setStaffEmailOrMobile(e.target.value)}
                      placeholder="e.g. principal@rlsy.ac.in or 9431100001"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviousAuthMode('staff');
                        setForgotEmail(staffEmailOrMobile.trim());
                        setForgotStep('token');
                        setForgotError('');
                        setForgotSuccessMsg('');
                        setForgotResetToken('');
                        setForgotNewPass('');
                        setForgotConfirmPass('');
                        setAuthMode('forgot_password');
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type={showStaffPass ? 'text' : 'password'}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="Enter staff password"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPass(!showStaffPass)}
                      aria-label={showStaffPass ? 'Hide staff password' : 'Show staff password'}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200"
                    >
                      {showStaffPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={lockoutRemainingSeconds > 0}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
                >
                  <span>{lockoutRemainingSeconds > 0 ? 'Locked (Wait for Timer)' : 'Sign In as Staff'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Quick Staff Demo Switcher (Dev Flag Only) */}
                {isDemoLoginEnabled && (
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-slate-400 block mb-1.5">
                      1-Click Staff Demo Accounts (Dev Mode):
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {allUsers
                        .filter((u) => u.role !== 'student')
                        .slice(0, 4)
                        .map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleQuickLogin(u)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-indigo-300 truncate">
                                {u.name}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 block uppercase font-mono mt-0.5">
                              {u.role}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </form>

              {/* LINK ON LOWER SIDE: BACK TO STUDENT SIGN IN & MASTER ADMIN GMAIL SIGN IN */}
              <div className="pt-4 border-t border-slate-800 text-center space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('student');
                    setStudentError('');
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold transition flex items-center justify-center gap-1.5 mx-auto"
                >
                  <span>← Back to Student Sign In (Default Page)</span>
                </button>

                <div className="pt-2 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleAuthError('');
                      setIsGoogleModalOpen(true);
                    }}
                    className="text-xs text-slate-400 hover:text-white transition flex items-center justify-center gap-2 mx-auto py-1 px-3 rounded-lg hover:bg-slate-800/60"
                  >
                    <GoogleIcon className="w-3.5 h-3.5" />
                    <span>Master Administrator? Sign in through Gmail</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* FORGOT PASSWORD VIEW (ADMIN-ISSUED RESET TOKEN ONLY)           */}
          {/* ============================================================== */}
          {authMode === 'forgot_password' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    Recover Account Password
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Self-service OTP reset is disabled. Use a single-use 5-minute reset token issued by the Super Admin or Principal.
                </p>
              </div>

              {forgotError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              {/* STEP 1: ENTER IDENTIFIER + ADMIN-ISSUED RESET TOKEN */}
              {forgotStep === 'token' && (
                <form onSubmit={handleVerifyAdminResetToken} className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
                    Request a single-use password reset token from the <strong>Super Admin</strong> or <strong>Principal</strong> (User Management Directory), then enter it below.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Registered Email ID / Roll No / Mobile Number
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="e.g. faculty@rlsy.ac.in or 2025CS001"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Admin-Issued Reset Token
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={forgotResetToken}
                        onChange={(e) => setForgotResetToken(e.target.value)}
                        placeholder="Paste single-use reset token from administrator"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-mono text-amber-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Continue to Set New Password</span>
                  </button>
                </form>
              )}

              {/* STEP 2: CREATE NEW PASSWORD */}
              {forgotStep === 'new_password' && (
                <form onSubmit={handleResetPasswordWithAdminToken} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      New Permanent Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type={showForgotNewPass ? 'text' : 'password'}
                        value={forgotNewPass}
                        onChange={(e) => setForgotNewPass(e.target.value)}
                        placeholder="At least 8 chars with upper, lower, digit, special"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPass(!showForgotNewPass)}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200"
                      >
                        {showForgotNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        value={forgotConfirmPass}
                        onChange={(e) => setForgotConfirmPass(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save New Password</span>
                  </button>
                </form>
              )}

              {/* STEP 3: SUCCESS */}
              {forgotStep === 'success' && (
                <div className="space-y-4 text-center py-4">
                  <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Password Updated!</h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto leading-relaxed">
                      {forgotSuccessMsg}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (forgotTargetUser?.role === 'student') {
                        setAuthMode('student');
                        setStudentLoginId(forgotTargetUser.email);
                      } else {
                        setAuthMode('staff');
                        if (forgotTargetUser) {
                          setStaffEmailOrMobile(forgotTargetUser.email);
                        }
                      }
                      setForgotStep('token');
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-sm shadow-lg transition"
                  >
                    Return to Sign In
                  </button>
                </div>
              )}

              {/* LINK ON LOWER SIDE: BACK TO LOGIN */}
              {forgotStep !== 'success' && (
                <div className="pt-4 border-t border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(previousAuthMode);
                      setForgotError('');
                    }}
                    className="text-xs text-slate-400 hover:text-white font-bold transition flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <span>← Cancel & Return to {previousAuthMode === 'staff' ? 'Staff Login' : 'Student Sign In'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MANDATORY FIRST-TIME PASSWORD CHANGE DIALOG */}
      {pendingPasswordChangeUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-amber-400">
              <KeyRound className="w-6 h-6" />
              <h3 className="font-black text-white text-base">
                Mandatory First-Time Password Reset
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Welcome, <strong>{pendingPasswordChangeUser.name}</strong> ({pendingPasswordChangeUser.role.toUpperCase()})!
              As an onboarded staff member logging in with your temporary mobile number credentials, you are required to change your password before proceeding.
            </p>

            {passwordChangeError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {passwordChangeError}
              </div>
            )}

            <form onSubmit={handleConfirmPasswordChange} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  New Secure Password *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingPasswordChangeUser(null)}
                  className="px-4 py-2 border border-slate-700 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs shadow-md transition"
                >
                  Set New Password & Proceed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GOOGLE OAUTH SIGN IN MODAL (VERIFIED ID TOKEN ONLY) */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <GoogleIcon className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-white">Master Administrator Sign In</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsGoogleModalOpen(false);
                  setGoogleAuthError('');
                }}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!googleOAuthStatus.checked ? (
                <p className="text-xs text-slate-300 leading-relaxed">
                  Checking Google OAuth configuration on the server...
                </p>
              ) : !googleOAuthStatus.enabled ? (
                <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 leading-relaxed">
                  <strong className="block font-bold text-amber-300">
                    Google OAuth Not Configured
                  </strong>
                  <p>
                    Master Administrator Google Sign-In is disabled because{' '}
                    <code className="font-mono text-white">GOOGLE_CLIENT_ID</code> is not
                    configured on the server. Passwordless email-only login has been disabled for
                    security.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Sign in with your verified institutional Google account to obtain a signed
                    Google OAuth ID token for root administrative access.
                  </p>
                  <div
                    ref={googleButtonRef}
                    className="flex justify-center py-2 min-h-[48px]"
                  />
                  {isGoogleAuthenticating && (
                    <p className="text-xs text-center text-indigo-300 font-medium">
                      Verifying Google OAuth ID token...
                    </p>
                  )}
                </>
              )}

              {googleAuthError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{googleAuthError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsGoogleModalOpen(false);
                    setGoogleAuthError('');
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Institutional Footer */}
      <div className="max-w-4xl mx-auto w-full text-center text-xs text-slate-500 py-3 space-y-1">
        <p>© {new Date().getFullYear()} {collegeProfile.name}. All institutional rights reserved.</p>
        <p className="text-xs text-slate-600">
          Campus Address: Kokar Institutional Area, Ranchi, Jharkhand • NAAC Grade {collegeProfile.naacGrade}
        </p>
      </div>
    </div>
  );
};
