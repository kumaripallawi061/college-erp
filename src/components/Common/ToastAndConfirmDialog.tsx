import React, { useState, useEffect, useRef } from 'react';
import { useErpStore } from '../../store/useErpStore';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ShieldAlert,
} from 'lucide-react';

export const ToastAndConfirmDialog: React.FC = () => {
  const toasts = useErpStore((s) => s.toasts);
  const dismissToast = useErpStore((s) => s.dismissToast);
  const confirmDialog = useErpStore((s) => s.confirmDialog);
  const closeConfirmDialog = useErpStore((s) => s.closeConfirmDialog);

  const [typedConfirmation, setTypedConfirmation] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (confirmDialog) {
      setTypedConfirmation('');
      setTimeout(() => {
        if (confirmDialog.requireTypedText && inputRef.current) {
          inputRef.current.focus();
        } else if (confirmBtnRef.current) {
          confirmBtnRef.current.focus();
        }
      }, 50);
    }
  }, [confirmDialog]);

  useEffect(() => {
    if (!confirmDialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeConfirmDialog();
      } else if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog, closeConfirmDialog]);

  const isConfirmEnabled = confirmDialog?.requireTypedText
    ? typedConfirmation.trim() === confirmDialog.requireTypedText
    : true;

  const handleConfirm = async () => {
    if (!confirmDialog || !isConfirmEnabled) return;
    const callback = confirmDialog.onConfirm;
    closeConfirmDialog();
    await callback();
  };

  return (
    <>
      {/* Accessible Toast Stack */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 right-5 z-[90] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const iconMap = {
            success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
            error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
            warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
            info: <Info className="w-5 h-5 text-indigo-400 shrink-0" />,
          };
          const borderMap = {
            success: 'border-emerald-500/40 bg-slate-900/95 text-slate-100',
            error: 'border-rose-500/40 bg-slate-900/95 text-slate-100',
            warning: 'border-amber-500/40 bg-slate-900/95 text-slate-100',
            info: 'border-indigo-500/40 bg-slate-900/95 text-slate-100',
          };
          const subText = t.description || t.message;
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 ${borderMap[t.variant]}`}
            >
              {iconMap[t.variant]}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-snug">{t.title}</p>
                {subText && (
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{subText}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Focus-Trapped Confirmation Dialog */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-[95] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="erp-confirm-dialog-title"
          aria-describedby="erp-confirm-dialog-desc"
        >
          <div
            ref={dialogRef}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95"
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                    : confirmDialog.variant === 'warning'
                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                    : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                }`}
              >
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3
                  id="erp-confirm-dialog-title"
                  className="text-base font-black text-slate-900"
                >
                  {confirmDialog.title}
                </h3>
                <p
                  id="erp-confirm-dialog-desc"
                  className="text-sm text-slate-600 mt-1 leading-relaxed"
                >
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            {confirmDialog.requireTypedText && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label
                  htmlFor="erp-typed-confirm-input"
                  className="block text-xs font-bold text-slate-700"
                >
                  Type{' '}
                  <code className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono font-bold">
                    {confirmDialog.requireTypedText}
                  </code>{' '}
                  below to confirm this action:
                </label>
                <input
                  id="erp-typed-confirm-input"
                  ref={inputRef}
                  type="text"
                  value={typedConfirmation}
                  onChange={(e) => setTypedConfirmation(e.target.value)}
                  placeholder={confirmDialog.requireTypedText}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeConfirmDialog}
                className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
              >
                {confirmDialog.cancelText || 'Cancel (Esc)'}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                disabled={!isConfirmEnabled}
                onClick={handleConfirm}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : confirmDialog.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmDialog.confirmLabel || confirmDialog.confirmText || 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
