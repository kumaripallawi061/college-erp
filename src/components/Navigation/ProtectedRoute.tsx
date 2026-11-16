import React from 'react';
import { ModuleKey, UserAccount, ModulePermissionMap } from '../../types/erp';
import { evaluateModuleAccess } from '../../domain/rbac/permissions';
import { ShieldAlert, ArrowLeft, Lock, Award } from 'lucide-react';

interface ProtectedRouteProps {
  moduleKey: ModuleKey;
  currentUser: UserAccount | null;
  modulePermissions: ModulePermissionMap;
  children: React.ReactNode;
  onAccessDenied?: () => void;
  title?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  moduleKey,
  currentUser,
  modulePermissions,
  children,
  onAccessDenied,
  title,
}) => {
  if (!currentUser) {
    return (
      <div className="min-h-[480px] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">
            Institutional Authentication Required
          </h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Please sign in with valid university credentials to access the requested academic administration module.
          </p>
          {onAccessDenied && (
            <button
              onClick={onAccessDenied}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition"
            >
              Go to Sign-In Portal
            </button>
          )}
        </div>
      </div>
    );
  }

  const accessDecision = evaluateModuleAccess(currentUser, moduleKey, modulePermissions);

  if (!accessDecision.allowed) {
    return (
      <AccessDebarredShield
        title={title || moduleKey}
        role={currentUser.role}
        reason={
          accessDecision.reason ||
          `Access to module "${moduleKey}" is not provisioned for the "${currentUser.role}" role.`
        }
        statuteRef={accessDecision.statuteRef}
        onReturn={onAccessDenied}
      />
    );
  }

  return <>{children}</>;
};

interface AccessDebarredShieldProps {
  title: string;
  role: string;
  reason: string;
  statuteRef?: string;
  onReturn?: () => void;
}

const AccessDebarredShield: React.FC<AccessDebarredShieldProps> = ({
  title,
  role,
  reason,
  statuteRef,
  onReturn,
}) => {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl border border-rose-200/90 shadow-2xl overflow-hidden" role="alert">
        {/* Institutional Alert Header */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 px-6 py-6 text-white flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <ShieldAlert className="w-8 h-8 text-rose-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-rose-500/30 text-rose-200 border border-rose-400/30">
                RBAC Route Guard Debarred
              </span>
              <span className="text-xs font-mono text-rose-300">Role: {role.toUpperCase()}</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
          </div>
        </div>

        {/* Legal & Governance Explanation */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-100 flex items-start gap-3.5">
            <Lock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 mb-1">
                Access Debarred by Institutional Security Policy
              </h4>
              <p className="text-sm text-rose-800 leading-relaxed font-medium">{reason}</p>
            </div>
          </div>

          {statuteRef && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <Award className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>
                <strong>Statutory Reference:</strong> {statuteRef}
              </span>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              RLSY College ERP • Tamper-Resistant Security Shield
            </span>
            {onReturn && (
              <button
                onClick={onReturn}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Authorized Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
