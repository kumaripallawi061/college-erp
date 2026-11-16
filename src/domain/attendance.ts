import type { AttendanceRecord } from '../types/erp';

export interface AttendanceSummaryStats {
  present: number;
  absent: number;
  late: number;
  excused: number;
  effectivePresent: number;
  total: number;
  percentage: number;
  isDefaulter: boolean;
  status: 'normal' | 'defaulter' | 'unverified';
  classesNeededFor75: number;
  condonationLimitExceeded: boolean;
}

/**
 * Canonical attendance summary calculator.
 * - Normalizes statuses case-insensitively.
 * - Deducts capped excused sessions (10% statutory ceiling) from evaluated denominator.
 * - Leaves zero-record students ('unverified') unblocked (isDefaulter: false).
 * - Evaluates threshold against exact unrounded ratio BEFORE rounding to 1 decimal place.
 */
export function computeDomainAttendanceStats(
  records: AttendanceRecord[],
  thresholdPercent: number = 75
): AttendanceSummaryStats {
  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;

  for (const r of records || []) {
    if (!r) continue;
    const statusNorm = String(r.status || '').trim().toLowerCase();
    const rawPeriods = (r as AttendanceRecord & { periods?: number }).periods;
    const weight =
      typeof rawPeriods === 'number' && Number.isFinite(rawPeriods) && rawPeriods > 0
        ? Math.min(10, Math.round(rawPeriods))
        : 1;
    if (statusNorm === 'present') present += weight;
    else if (statusNorm === 'absent') absent += weight;
    else if (statusNorm === 'late') late += weight;
    else if (statusNorm === 'excused') excused += weight;
  }

  const total = present + absent + late + excused;
  if (total === 0) {
    return {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      effectivePresent: 0,
      total: 0,
      percentage: 0,
      isDefaulter: false,
      status: 'unverified',
      classesNeededFor75: 0,
      condonationLimitExceeded: false,
    };
  }

  const maxCondonable = Math.max(1, Math.ceil(total * 0.1));
  const condonationLimitExceeded = excused > maxCondonable;
  const effectiveExcused = Math.min(excused, maxCondonable);
  const netEvaluated = Math.max(0, total - effectiveExcused);
  const effectivePresent = present + late * 0.5;

  if (netEvaluated === 0) {
    return {
      present,
      absent,
      late,
      excused,
      effectivePresent,
      total,
      percentage: 0,
      isDefaulter: false,
      status: 'unverified',
      classesNeededFor75: 0,
      condonationLimitExceeded,
    };
  }

  const exactPercentage = Math.min(100, Math.max(0, (effectivePresent / netEvaluated) * 100));
  const percentage = Math.min(
    100,
    Math.max(0, Math.round((exactPercentage + Number.EPSILON) * 10) / 10)
  );
  const effectiveThreshold = Number.isFinite(thresholdPercent) && thresholdPercent > 0 ? thresholdPercent : 75;
  const isDefaulter = exactPercentage + 1e-9 < effectiveThreshold;

  const targetRatio = Math.min(0.99, Math.max(0.1, effectiveThreshold / 100));
  let classesNeededFor75 = 0;
  if (isDefaulter) {
    classesNeededFor75 = Math.max(
      1,
      Math.ceil((targetRatio * netEvaluated - effectivePresent) / (1 - targetRatio))
    );
  }

  return {
    present,
    absent,
    late,
    excused,
    effectivePresent,
    total,
    percentage,
    isDefaulter,
    status: isDefaulter ? 'defaulter' : 'normal',
    classesNeededFor75,
    condonationLimitExceeded,
  };
}
