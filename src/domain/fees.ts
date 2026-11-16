/**
 * Financial & Fee Domain Module
 * Handles exact integer paisa arithmetic (without IEEE-754 float drift),
 * sequential financial-year receipt numbering in IST, and fee validation.
 */

const FINANCIAL_YEAR_REGEX = /^\d{4}-\d{2}$/;

/**
 * Converts a rupee amount (number or formatted currency string like "₹ 1,25,000.50") into integer paisa
 * using exact decimal string shifting to prevent IEEE-754 rounding errors (e.g. 1.005 -> 101).
 */
export const toPaisa = (rupees: number | string): number => {
  if (typeof rupees === 'number') {
    if (!Number.isFinite(rupees)) return 0;
    // Use high-precision string representation to avoid 1.005 * 100 === 100.49999999999999
    return parseDecimalToPaisa(rupees.toString());
  }
  if (typeof rupees !== 'string') return 0;
  let cleaned = rupees.replace(/[₹$€£,\s]/g, '').trim();
  if (!cleaned) return 0;
  let negative = false;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    negative = true;
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.startsWith('-')) {
    negative = !negative;
    cleaned = cleaned.slice(1).trim();
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1).trim();
  }
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return 0;
    return parseDecimalToPaisa(parsed.toString()) * (negative ? -1 : 1);
  }
  const absPaisa = parseDecimalToPaisa(cleaned);
  return negative ? -absPaisa : absPaisa;
};

function parseDecimalToPaisa(str: string): number {
  const trimmed = str.trim();
  if (!trimmed) return 0;
  // Fallback for scientific notation
  if (/[eE]/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  const parts = unsigned.split('.');
  const intPart = parts[0] || '0';
  const fracPart = parts[1] || '';
  if (!/^\d+$/.test(intPart) || (fracPart && !/^\d+$/.test(fracPart))) {
    return 0;
  }
  const fracPadded = (fracPart + '000').slice(0, 3);
  const twoDigits = parseInt(fracPadded.slice(0, 2), 10);
  const roundDigit = parseInt(fracPadded.charAt(2), 10);
  let total = parseInt(intPart, 10) * 100 + twoDigits;
  if (roundDigit >= 5) {
    total += 1;
  }
  return negative ? -total : total;
}

export const fromPaisa = (paisa: number): number => {
  return Math.round(paisa) / 100;
};

export const paisaAdd = (aPaisa: number, bPaisa: number): number => {
  return Math.round((Number(aPaisa) || 0) + (Number(bPaisa) || 0));
};

export const paisaSub = (aPaisa: number, bPaisa: number, allowNegative = false): number => {
  const res = Math.round((Number(aPaisa) || 0) - (Number(bPaisa) || 0));
  return allowNegative ? res : Math.max(0, res);
};

/**
 * Computes the Indian Financial Year label (e.g. "2026-27") from an ISO date or current date
 * evaluated strictly in Asia/Kolkata (IST) timezone.
 */
export function getFinancialYearCode(dateInput?: string | Date): string {
  const rawDate = dateInput ? new Date(dateInput) : new Date();
  const validDate = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(validDate);
    const yearStr = parts.find((p) => p.type === 'year')?.value;
    const monthStr = parts.find((p) => p.type === 'month')?.value;
    if (yearStr && monthStr) {
      const year = Number(yearStr);
      const month = Number(monthStr);
      const startYear = month >= 4 ? year : year - 1;
      const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
      return `${startYear}-${endYearShort}`;
    }
  } catch {
    // Fallback below
  }

  // Deterministic +05:30 IST offset fallback
  const istMs = validDate.getTime() + 330 * 60 * 1000;
  const istDate = new Date(istMs);
  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
}

/**
 * Normalizes a Financial Year string strictly to "YYYY-YY" format, falling back to the current IST FY.
 */
export function normalizeFinancialYearCode(financialYear?: string): string {
  const raw = typeof financialYear === 'string' ? financialYear.trim() : '';
  if (FINANCIAL_YEAR_REGEX.test(raw)) {
    return raw;
  }
  const longRangeMatch = raw.match(/^(\d{4})-(\d{4})$/);
  if (longRangeMatch) {
    const start = Number(longRangeMatch[1]);
    const end = Number(longRangeMatch[2]);
    if (end === start + 1) {
      return `${start}-${String(end % 100).padStart(2, '0')}`;
    }
  }
  return getFinancialYearCode();
}

/**
 * Formats a sequential, unique receipt number per financial year.
 * Example: RLSY/2026-27/REC/000042
 */
export function formatSequentialReceiptNumber(financialYear: string, sequenceNumber: number): string {
  const fyClean = normalizeFinancialYearCode(financialYear);
  const seqInt = Math.max(1, Math.floor(Number(sequenceNumber) || 1));
  return `RLSY/${fyClean}/REC/${String(seqInt).padStart(6, '0')}`;
}

/**
 * Validates whether a receipt number adheres to the sequential FY format.
 */
export function isValidSequentialReceiptNumber(receiptNo: string): boolean {
  if (!receiptNo || typeof receiptNo !== 'string') return false;
  return /^RLSY\/\d{4}-\d{2}\/REC\/\d{6,}$/.test(receiptNo.trim());
}

/**
 * Aggregates service request revenue using integer paisa arithmetic to prevent IEEE-754 floating-point drift.
 * Excludes Pending, Rejected, Failed, Cancelled, and Refunded records.
 */
export function calculateServiceRequestsTotalRevenue(
  requests: ReadonlyArray<{ status?: string; paymentStatus?: string; amountPaid?: number | string }>
): number {
  const excludedStatuses = new Set(['rejected', 'cancelled', 'canceled', 'pending', 'failed', 'refunded']);
  const validPaidPaymentStatuses = new Set(['paid', 'success', 'settled', 'completed']);

  const totalPaisa = requests.reduce((sum, r) => {
    const reqStatus = String(r.status || '').trim().toLowerCase();
    const payStatus = String(r.paymentStatus || '').trim().toLowerCase();
    if (excludedStatuses.has(reqStatus) || excludedStatuses.has(payStatus)) {
      return sum;
    }
    if (payStatus && !validPaidPaymentStatuses.has(payStatus)) {
      return sum;
    }
    const amt = Number(r.amountPaid);
    if (Number.isNaN(amt) || !Number.isFinite(amt) || amt <= 0) {
      return sum;
    }
    return paisaAdd(sum, toPaisa(amt));
  }, 0);
  return fromPaisa(totalPaisa);
}

/**
 * Safely resolves a student's updated totalFee during profile edits, preserving existing ledger state
 * whenever totalFee is undefined, null, blank, invalid, or lower than already-paid fees.
 */
export function resolveUpdatedStudentTotalFee(
  isAdmin: boolean,
  candidateTotalFee: unknown,
  existingTotalFee: number,
  existingPaidFee: number = 0
): number {
  if (!isAdmin) {
    return existingTotalFee;
  }
  if (
    candidateTotalFee === undefined ||
    candidateTotalFee === null ||
    (typeof candidateTotalFee === 'string' && candidateTotalFee.trim() === '')
  ) {
    return existingTotalFee;
  }
  const parsed = Number(candidateTotalFee);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    return existingTotalFee;
  }
  const safePaid = Number.isFinite(existingPaidFee) && existingPaidFee > 0 ? existingPaidFee : 0;
  if (toPaisa(parsed) < toPaisa(safePaid)) {
    return existingTotalFee;
  }
  return parsed;
}

/**
 * Shared validator for fee campaign creation and batch persistence.
 * Enforces positive fees, bounded late fees, non-negative head amounts, and exact 64-bit integer paisa
 * reconciliation across both global feeHeadAmounts and per-course breakdowns.
 */
export function assertValidFeeCampaign(campaign: {
  title?: string;
  totalCampaignFee?: number;
  lateFeeAmount?: number;
  feeHeadAmounts?: Record<string, number>;
  courseBreakdowns?: Array<{
    course?: string;
    totalCourseFee?: number;
    headAmounts?: Record<string, number>;
  }>;
}): void {
  if (
    campaign.totalCampaignFee === undefined ||
    campaign.totalCampaignFee === null ||
    typeof campaign.totalCampaignFee !== 'number' ||
    !Number.isFinite(campaign.totalCampaignFee) ||
    campaign.totalCampaignFee <= 0 ||
    (campaign.lateFeeAmount !== undefined &&
      (typeof campaign.lateFeeAmount !== 'number' ||
        !Number.isFinite(campaign.lateFeeAmount) ||
        campaign.lateFeeAmount < 0 ||
        toPaisa(campaign.lateFeeAmount) > toPaisa(campaign.totalCampaignFee))) ||
    (campaign.feeHeadAmounts &&
      Object.values(campaign.feeHeadAmounts).some(
        (amt) => typeof amt !== 'number' || !Number.isFinite(amt) || amt < 0
      )) ||
    (campaign.courseBreakdowns &&
      campaign.courseBreakdowns.some(
        (b) =>
          typeof b.totalCourseFee !== 'number' ||
          !Number.isFinite(b.totalCourseFee) ||
          b.totalCourseFee <= 0 ||
          Object.values(b.headAmounts || {}).some(
            (amt) => typeof amt !== 'number' || !Number.isFinite(amt) || amt < 0
          )
      ))
  ) {
    throw new Error(
      'Validation Error: Fee campaign total must be a valid positive amount, late fee cannot exceed total fee, and head amounts cannot be negative.'
    );
  }

  const label = campaign.title ? ` for "${campaign.title}"` : '';

  if (campaign.feeHeadAmounts && Object.keys(campaign.feeHeadAmounts).length > 0) {
    const headsSumPaisa = Object.values(campaign.feeHeadAmounts).reduce(
      (sum, amt) => paisaAdd(sum, toPaisa(amt || 0)),
      0
    );
    const totalCampaignFeePaisa = toPaisa(campaign.totalCampaignFee);
    if (headsSumPaisa > 0 && headsSumPaisa !== totalCampaignFeePaisa) {
      throw new Error(
        `Validation Error: Sum of fee heads (INR ${fromPaisa(headsSumPaisa).toFixed(2)}) does not exactly match total campaign fee (INR ${fromPaisa(totalCampaignFeePaisa).toFixed(2)})${label}.`
      );
    }
  }

  if (Array.isArray(campaign.courseBreakdowns)) {
    for (const breakdown of campaign.courseBreakdowns) {
      const headEntries = Object.values(breakdown.headAmounts || {});
      if (headEntries.length > 0) {
        const bdHeadsSumPaisa = headEntries.reduce(
          (sum, amt) => paisaAdd(sum, toPaisa(amt || 0)),
          0
        );
        const totalCoursePaisa = toPaisa(breakdown.totalCourseFee || 0);
        if (bdHeadsSumPaisa > 0 && bdHeadsSumPaisa !== totalCoursePaisa) {
          const courseLabel = breakdown.course ? ` (${breakdown.course})` : '';
          throw new Error(
            `Validation Error: Course breakdown fee heads (INR ${fromPaisa(bdHeadsSumPaisa).toFixed(2)}) do not match course total (INR ${fromPaisa(totalCoursePaisa).toFixed(2)})${courseLabel}${label}.`
          );
        }
      }
    }
  }
}

