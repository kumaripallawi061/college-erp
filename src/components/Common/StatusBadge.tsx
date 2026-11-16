import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  Ban,
} from 'lucide-react';

export type ErpStatusVariant =
  | 'paid'
  | 'due'
  | 'present'
  | 'absent'
  | 'late'
  | 'verified'
  | 'pending'
  | 'blocked';

interface StatusBadgeProps {
  status: ErpStatusVariant;
  label?: string;
  className?: string;
}

/**
 * Accessible status badge that pairs semantic color with an explicit icon and text label
 * so color-blind users and screen readers never rely on color alone.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = '',
}) => {
  const config: Record<
    ErpStatusVariant,
    { text: string; icon: React.ReactNode; style: string }
  > = {
    paid: {
      text: label || 'Paid / Cleared',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      style: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    due: {
      text: label || 'Fee Due',
      icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      style: 'bg-amber-50 text-amber-900 border-amber-200',
    },
    present: {
      text: label || 'Present',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      style: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    absent: {
      text: label || 'Absent',
      icon: <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      style: 'bg-rose-50 text-rose-800 border-rose-200',
    },
    late: {
      text: label || 'Late',
      icon: <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      style: 'bg-amber-50 text-amber-900 border-amber-200',
    },
    verified: {
      text: label || 'Verified',
      icon: <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      style: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    },
    pending: {
      text: label || 'Pending',
      icon: <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      style: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    blocked: {
      text: label || 'Blocked',
      icon: <Ban className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      style: 'bg-rose-50 text-rose-800 border-rose-200',
    },
  };

  const item = config[status] || config.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${item.style} ${className}`}
    >
      {item.icon}
      <span>{item.text}</span>
    </span>
  );
};
