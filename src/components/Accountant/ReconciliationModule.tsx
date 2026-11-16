import React, { useState, useEffect, useMemo, useRef } from 'react';
import { erpStorage } from '../../services/erpStorage';
import { Reconciliation3WayRecord, UserAccount, FeeTransaction } from '../../types/erp';
import {
  toPaisa,
  fromPaisa,
  paisaAdd,
  formatINR,
  parseExcelDateCell,
  parseAccountingAmount,
  isStrictAccountingNumber,
  generateSecureId,
  sanitizeSpreadsheetData,
  sanitizeFileName,
  stripControlChars,
  parseSafeDateTime,
  getISTDateString,
} from '../../utils/erpLogic';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Building,
  CreditCard,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCode,
  AlertOctagon,
  X,
  FileUp,
} from 'lucide-react';
import { exportJsonSheetsToExcelFile, parseWorkbookSheets } from '../../utils/excelHelper';

interface ReconciliationModuleProps {
  records: Reconciliation3WayRecord[];
  onSaveRecords: (records: Reconciliation3WayRecord[]) => void;
  currentUser: UserAccount;
  erpTransactions?: FeeTransaction[];
}

export interface ExcelBankRow {
  'Value Date'?: string | number | Date;
  'Date'?: string | number | Date;
  'Transaction Date'?: string | number | Date;
  'Val Date'?: string | number | Date;
  'Credit Amount'?: string | number;
  'Credit'?: string | number;
  'Deposit'?: string | number;
  'Cr Amount'?: string | number;
  'Amount'?: string | number;
  'Debit'?: string | number;
  'Debit Amount'?: string | number;
  'Dr Amount'?: string | number;
  'UTR Reference'?: string | number;
  'UTR'?: string | number;
  'Bank UTR'?: string | number;
  'Reference No'?: string | number;
  'Ref No'?: string | number;
  'Transaction ID'?: string | number;
  'Cheque/Ref No'?: string | number;
  'Dr/Cr'?: string;
  'Type'?: string;
  'Transaction Type'?: string;
  'Narration'?: string;
  'Description'?: string;
  'Particulars'?: string;
  'Remarks'?: string;
  [key: string]: any;
}

interface ParsedBankRow {
  date: string;
  utr: string;
  creditAmount: number;
  narration?: string;
  payerName?: string;
}

export const ReconciliationModule: React.FC<ReconciliationModuleProps> = ({
  records,
  onSaveRecords,
  currentUser,
  erpTransactions = [],
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<Reconciliation3WayRecord | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<Reconciliation3WayRecord['reconciliationStatus']>('Matched');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tallyExportCleanupRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; url: string | null }>({
    timer: null,
    url: null,
  });

  const showNotification = (msg: string, durationMs: number = 4000) => {
    if (!isMountedRef.current) return;
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = null;
    }
    setNotification(msg);
    notificationTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setNotification('');
      }
      notificationTimerRef.current = null;
    }, durationMs);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = null;
      }
      if (tallyExportCleanupRef.current.timer) {
        clearTimeout(tallyExportCleanupRef.current.timer);
        tallyExportCleanupRef.current.timer = null;
      }
      if (tallyExportCleanupRef.current.url) {
        URL.revokeObjectURL(tallyExportCleanupRef.current.url);
        tallyExportCleanupRef.current.url = null;
      }
    };
  }, []);

  // Prevent browser tab navigation when dragging files over the window (Bug 533)
  useEffect(() => {
    const preventWindowDrop = (ev: DragEvent) => {
      ev.preventDefault();
    };
    window.addEventListener('dragover', preventWindowDrop);
    window.addEventListener('drop', preventWindowDrop);
    return () => {
      window.removeEventListener('dragover', preventWindowDrop);
      window.removeEventListener('drop', preventWindowDrop);
    };
  }, []);

  // Aggregated totals using integer paise arithmetic
  const totalErp = useMemo(
    () => fromPaisa(records.reduce((sum, r) => paisaAdd(sum, toPaisa(Number(r.erpAmount) || 0)), 0)),
    [records]
  );
  const totalGateway = useMemo(
    () => fromPaisa(records.reduce((sum, r) => paisaAdd(sum, toPaisa(Number(r.gatewayAmount) || 0)), 0)),
    [records]
  );
  const totalBank = useMemo(
    () => fromPaisa(records.reduce((sum, r) => paisaAdd(sum, toPaisa(Number(r.bankCreditAmount) || 0)), 0)),
    [records]
  );

  // Discrepancy KPI counters
  const matchedCount = useMemo(
    () => records.filter((r) => r.reconciliationStatus === 'Matched').length,
    [records]
  );
  const bankVarianceCount = useMemo(
    () => records.filter((r) => r.reconciliationStatus === 'Bank_Variance').length,
    [records]
  );
  const pendingGatewayCount = useMemo(
    () => records.filter((r) => r.reconciliationStatus === 'Gateway_Pending').length,
    [records]
  );
  const unreconciledCount = useMemo(
    () => records.filter((r) => r.reconciliationStatus === 'Unreconciled').length,
    [records]
  );
  const totalDiscrepancies = bankVarianceCount + pendingGatewayCount + unreconciledCount;

  // Filtered list sorted chronologically by parsed ISO date (Bug 607)
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        const matchStatus =
          statusFilter === 'ALL' || r.reconciliationStatus === statusFilter;
        const q = searchQuery.toLowerCase().trim();
        const matchSearch =
          q === '' ||
          String(r.studentName || '').toLowerCase().includes(q) ||
          String(r.rollNo || '').toLowerCase().includes(q) ||
          String(r.gatewayRef || '').toLowerCase().includes(q) ||
          String(r.bankUTR || '').toLowerCase().includes(q) ||
          String(r.course || '').toLowerCase().includes(q) ||
          (r.notes && String(r.notes).toLowerCase().includes(q));
        return matchStatus && matchSearch;
      })
      .sort(
        (a, b) =>
          parseSafeDateTime(b.transactionDate).getTime() -
          parseSafeDateTime(a.transactionDate).getTime()
      );
  }, [records, statusFilter, searchQuery]);

  /**
   * Core Automated Comparison Algorithm
   * Compares bank statement records against ERP ledger transactions
   * Flags:
   * 1. Matched (Bank Credit == ERP Ledger)
   * 2. Bank_Variance (Amount discrepancy / MDR commission deduction)
   * 3. Gateway_Pending (Missing Bank Credit: ERP transaction exists, not found in bank statement)
   * 4. Unreconciled (Unrecorded Deposit: Realized bank credit not found in ERP ledger)
   */
  const executeReconciliationEngine = (bankRows: ParsedBankRow[]) => {
    setIsProcessing(true);

    setTimeout(() => {
      if (!isMountedRef.current) return;
      // Set to track which ERP ledger transactions have been matched
      const matchedErpRefs = new Set<string>();
      const getErpTxKey = (tx: FeeTransaction) => tx.id || tx.referenceNo;
      const newReconciledRecords: Reconciliation3WayRecord[] = [];
      const sentinelValues = new Set(['', 'n/a', 'missing_in_bank', 'unrecorded']);
      const matchesTokenWithBoundary = (narrationText: string, candidateToken: string): boolean => {
        const cleanToken = (candidateToken || '').trim();
        if (cleanToken.length < 4 || sentinelValues.has(cleanToken.toLowerCase())) {
          return false;
        }
        const escaped = cleanToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Delimiter-agnostic boundary assertion handles slashes (/), hyphens (-), and @ UPI delimiters cleanly (Bug 7)
        const pattern = `(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`;
        return new RegExp(pattern, 'i').test(narrationText);
      };

      // Build O(1) fast lookup index maps for ERP transactions (supporting multiple txs with identical ref/receipt)
      const erpByRef = new Map<string, FeeTransaction[]>();
      const erpByReceipt = new Map<string, FeeTransaction[]>();
      erpTransactions.forEach((tx) => {
        const ref = (tx.referenceNo || '').trim().toLowerCase();
        if (ref && ref.length >= 4) {
          const list = erpByRef.get(ref) || [];
          list.push(tx);
          erpByRef.set(ref, list);
        }
        const rec = (tx.receiptNo || '').trim().toLowerCase();
        if (rec && rec.length >= 4) {
          const list = erpByReceipt.get(rec) || [];
          list.push(tx);
          erpByReceipt.set(rec, list);
        }
      });

      // Build O(1) fast lookup index maps for previous records
      const prevByUtr = new Map<string, Reconciliation3WayRecord>();
      const prevByGateway = new Map<string, Reconciliation3WayRecord>();
      records.forEach((r) => {
        if (r.reconciliationStatus === 'Unreconciled' || r.erpAmount <= 0) return;
        const u = (r.bankUTR || '').trim().toLowerCase();
        if (u && !sentinelValues.has(u)) prevByUtr.set(u, r);
        const g = (r.gatewayRef || '').trim().toLowerCase();
        if (g && !sentinelValues.has(g)) prevByGateway.set(g, r);
      });

      // 1. Process each row from the uploaded bank statement
      bankRows.forEach((bRow, idx) => {
        const cleanUtr = (bRow.utr || '').trim();
        const cleanUtrLower = cleanUtr.toLowerCase();
        const isValidUtr = cleanUtr.length >= 4 && !sentinelValues.has(cleanUtrLower);

        // O(1) lookup first, falling back to narration boundary token scan
        let matchedTx: FeeTransaction | undefined;
        const pickBestUnmatchedTx = (candidates: FeeTransaction[] | undefined): FeeTransaction | undefined => {
          if (!candidates || candidates.length === 0) return undefined;
          const avail = candidates.filter((tx) => {
            const k = getErpTxKey(tx);
            return !k || !matchedErpRefs.has(k);
          });
          if (avail.length === 0) return undefined;
          const targetPaise = Math.round(bRow.creditAmount * 100);
          return avail.find((tx) => Math.round(tx.amount * 100) === targetPaise) || avail[0];
        };

        if (isValidUtr) {
          matchedTx = pickBestUnmatchedTx(erpByRef.get(cleanUtrLower));
          if (!matchedTx) {
            matchedTx = pickBestUnmatchedTx(erpByReceipt.get(cleanUtrLower));
          }
        }

        if (!matchedTx && bRow.narration) {
          const nar = bRow.narration || '';
          const bankCreditPaise = Math.round(bRow.creditAmount * 100);
          const bankDateMs = parseSafeDateTime(bRow.date).getTime();
          matchedTx = erpTransactions.find((tx) => {
            const txKey = getErpTxKey(tx);
            if (txKey && matchedErpRefs.has(txKey)) return false;
            const ref = (tx.referenceNo || '').trim().toLowerCase();
            if (matchesTokenWithBoundary(nar, ref)) return true;

            const roll = (tx.studentRollNo || '').trim().toLowerCase();
            if (!matchesTokenWithBoundary(nar, roll)) return false;

            // Require exact amount match OR date within 7 days for roll-number narration fallback
            const txPaise = Math.round(tx.amount * 100);
            if (txPaise === bankCreditPaise) return true;
            const txDateMs = parseSafeDateTime(tx.isoTimestamp || tx.timestamp).getTime();
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            return !Number.isNaN(txDateMs) && !Number.isNaN(bankDateMs) && Math.abs(txDateMs - bankDateMs) <= sevenDaysMs;
          });
        }

        const matchedPrev = isValidUtr
          ? (prevByUtr.get(cleanUtrLower) || prevByGateway.get(cleanUtrLower))
          : undefined;

        if (matchedTx || matchedPrev) {
          // Record matched!
          const erpAmount = matchedTx ? matchedTx.amount : (matchedPrev?.erpAmount || 0);
          const studentName = matchedTx ? matchedTx.studentName : (matchedPrev?.studentName || 'Student');
          const rollNo = matchedTx ? matchedTx.studentRollNo : (matchedPrev?.rollNo || 'N/A');
          const course = matchedTx ? matchedTx.course : (matchedPrev?.course || 'General');
          const gatewayRef = matchedTx ? matchedTx.referenceNo : (matchedPrev?.gatewayRef || cleanUtr);
          const txnDate = matchedTx
            ? matchedTx.isoTimestamp
              ? getISTDateString(parseSafeDateTime(matchedTx.isoTimestamp))
              : getISTDateString(parseSafeDateTime(matchedTx.timestamp))
            : bRow.date;

          if (matchedTx) {
            const txKey = getErpTxKey(matchedTx);
            if (txKey) matchedErpRefs.add(txKey);
          }

          const diffPaise = Math.round(erpAmount * 100) - Math.round(bRow.creditAmount * 100);
          const diff = diffPaise / 100;
          const absDiff = Math.abs(diff);

          const uniqueSuffix = generateSecureId('SUF').slice(-8);

          // Non-destructive preservation of manual accountant notes (Bug 243)
          const existingAuditNotes =
            matchedPrev?.notes &&
            !matchedPrev.notes.startsWith('Audit Verified:') &&
            !matchedPrev.notes.startsWith('MDR') &&
            !matchedPrev.notes.startsWith('Student Underpayment') &&
            !matchedPrev.notes.startsWith('Excess bank credit') &&
            !matchedPrev.notes.startsWith('Discrepancy:')
              ? matchedPrev.notes
              : undefined;

          if (Math.abs(diffPaise) === 0) {
            // Exact integer-paise match
            newReconciledRecords.push({
              id: matchedPrev?.id || `${generateSecureId('REC-3W')}-${idx}-${uniqueSuffix}`,
              transactionDate: txnDate,
              rollNo,
              studentName,
              course,
              erpAmount,
              gatewayRef,
              gatewayAmount: erpAmount,
              gatewayStatus: 'Settled',
              gatewayFee: 0,
              bankUTR: cleanUtr,
              bankCreditAmount: bRow.creditAmount,
              bankValueDate: bRow.date,
              reconciliationStatus: 'Matched',
              varianceAmount: 0,
              notes: existingAuditNotes || 'Audit Verified: Bank Statement credit matches ERP Ledger record.',
            });
          } else if (diffPaise > 0) {
            // Bank deposit is less than ERP ledger: Tiered classification
            // Check if within 3% MDR commission threshold or student underpayment (Bug 205)
            const variancePercent = erpAmount > 0 ? (diff / erpAmount) * 100 : 100;
            const isMDRThreshold = variancePercent <= 3.0;

            newReconciledRecords.push({
              id: matchedPrev?.id || `${generateSecureId('REC-3W')}-${idx}-${uniqueSuffix}`,
              transactionDate: txnDate,
              rollNo,
              studentName,
              course,
              erpAmount,
              gatewayRef,
              gatewayAmount: erpAmount,
              gatewayStatus: 'Settled',
              gatewayFee: isMDRThreshold ? diff : 0,
              bankUTR: cleanUtr,
              bankCreditAmount: bRow.creditAmount,
              bankValueDate: bRow.date,
              reconciliationStatus: 'Bank_Variance',
              varianceAmount: diff,
              notes:
                existingAuditNotes ||
                (isMDRThreshold
                  ? `MDR Fee / Gateway deduction of ₹${diff.toLocaleString('en-IN')} (${variancePercent.toFixed(2)}% ≤ 3% MDR threshold) identified against ERP Ledger.`
                  : `Student Underpayment / Partial realization variance of ₹${diff.toLocaleString('en-IN')} (${variancePercent.toFixed(2)}% > 3% threshold) flagged against ERP fee ledger.`),
            });
          } else {
            // Bank realization is more than ERP: Excess credit
            newReconciledRecords.push({
              id: matchedPrev?.id || `${generateSecureId('REC-3W')}-${idx}-${uniqueSuffix}`,
              transactionDate: txnDate,
              rollNo,
              studentName,
              course,
              erpAmount,
              gatewayRef,
              gatewayAmount: erpAmount,
              gatewayStatus: 'Settled',
              gatewayFee: 0,
              bankUTR: cleanUtr,
              bankCreditAmount: bRow.creditAmount,
              bankValueDate: bRow.date,
              reconciliationStatus: 'Bank_Variance',
              varianceAmount: absDiff,
              notes: existingAuditNotes || `Excess bank credit variance of ₹${absDiff.toLocaleString('en-IN')} flagged against ERP record.`,
            });
          }
        } else {
          const unrecSuffix = generateSecureId('SUF').slice(-8);
          // Unrecorded Bank Deposit: Realized in Bank Statement, but not found in ERP Ledger
          newReconciledRecords.push({
            id: `${generateSecureId('REC-UNREC')}-${idx}-${unrecSuffix}`,
            transactionDate: bRow.date,
            rollNo: 'UNRECORDED',
            studentName: bRow.payerName || bRow.narration || 'Unallocated Direct Deposit',
            course: 'Unallocated Bank Credit',
            erpAmount: 0,
            gatewayRef: 'N/A',
            gatewayAmount: 0,
            gatewayStatus: 'Failed',
            gatewayFee: 0,
            bankUTR: cleanUtr,
            bankCreditAmount: bRow.creditAmount,
            bankValueDate: bRow.date,
            reconciliationStatus: 'Unreconciled',
            varianceAmount: bRow.creditAmount,
            notes: `Discrepancy: Credit of ₹${bRow.creditAmount.toLocaleString('en-IN')} realized in Bank Statement, but unrecorded in ERP Student Fee Ledger. UTR: ${cleanUtr}`,
          });
        }
      });

      // 2. Check for Missing Bank Credits:
      // ERP transactions recorded as successful that do NOT appear in the uploaded Bank Statement
      const bankUtrSet = new Set(
        bankRows.map((b) => (b.utr || '').trim().toLowerCase()).filter((u) => u.length >= 4)
      );

      erpTransactions.forEach((tx, idx) => {
        const txKey = getErpTxKey(tx);
        const txRef = (tx.referenceNo || '').trim().toLowerCase();
        if (tx.status === 'Success' && (!txKey || !matchedErpRefs.has(txKey))) {
          // O(1) check if present in bank statement
          const existsInBank = txRef ? bankUtrSet.has(txRef) : false;
          if (!existsInBank) {
            const missingSuffix = generateSecureId('SUF').slice(-8);
            newReconciledRecords.push({
              id: `${generateSecureId('REC-MISSING')}-${idx}-${missingSuffix}`,
              transactionDate: tx.isoTimestamp
                ? getISTDateString(parseSafeDateTime(tx.isoTimestamp))
                : getISTDateString(parseSafeDateTime(tx.timestamp)),
              rollNo: tx.studentRollNo,
              studentName: tx.studentName,
              course: tx.course,
              erpAmount: tx.amount,
              gatewayRef: tx.referenceNo,
              gatewayAmount: tx.amount,
              gatewayStatus: 'Success',
              gatewayFee: 0,
              bankUTR: 'MISSING_IN_BANK',
              bankCreditAmount: 0,
              bankValueDate: '',
              reconciliationStatus: 'Gateway_Pending',
              varianceAmount: tx.amount,
              notes: `Discrepancy: Fee transaction of ₹${tx.amount.toLocaleString('en-IN')} recorded in ERP ledger, but credit is missing from uploaded Bank Statement.`,
            });
          }
        }
      });

      // Preserve prior records from earlier reconciliation runs that were not superseded by this batch
      const newIds = new Set(newReconciledRecords.map((r) => r.id));
      const newUtrs = new Set(
        newReconciledRecords
          .map((r) => (r.bankUTR || '').trim().toLowerCase())
          .filter((u) => u && !sentinelValues.has(u))
      );
      const newGateways = new Set(
        newReconciledRecords
          .map((r) => (r.gatewayRef || '').trim().toLowerCase())
          .filter((g) => g && !sentinelValues.has(g))
      );
      const preservedRecords = records.filter((prev) => {
        if (newIds.has(prev.id)) return false;
        const prevUtr = (prev.bankUTR || '').trim().toLowerCase();
        const prevGateway = (prev.gatewayRef || '').trim().toLowerCase();
        if (prevUtr && !sentinelValues.has(prevUtr) && newUtrs.has(prevUtr)) return false;
        if (prevGateway && !sentinelValues.has(prevGateway) && newGateways.has(prevGateway)) return false;
        return true;
      });
      const mergedRecords = [...newReconciledRecords, ...preservedRecords];

      onSaveRecords(mergedRecords);
      setIsProcessing(false);
      setIsUploadModalOpen(false);

      const matched = newReconciledRecords.filter((r) => r.reconciliationStatus === 'Matched').length;
      const variances = newReconciledRecords.filter((r) => r.reconciliationStatus === 'Bank_Variance').length;
      const missing = newReconciledRecords.filter((r) => r.reconciliationStatus === 'Gateway_Pending').length;
      const unrec = newReconciledRecords.filter((r) => r.reconciliationStatus === 'Unreconciled').length;

      showNotification(
        `Automated Reconciliation Complete: ${matched} Matched, ${variances} Amount Variances, ${missing} Missing Bank Credits, ${unrec} Unrecorded Deposits flagged.`,
        6000
      );
    }, 450);
  };

  /**
   * Handle real file upload (.xlsx, .xls, .csv) with blank-row filtering and strict numeric credit validation
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const safeFileName = sanitizeFileName(file.name || 'statement');
    const maxFileSizeBytes = 10 * 1024 * 1024; // 10 MB ceiling (Bugs 219, 520)
    if (file.size > maxFileSizeBytes) {
      const msg = `File "${safeFileName}" exceeds the 10 MB security upload limit.`;
      setUploadError(msg);
      showNotification(msg, 4000);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploadError('');
    const reader = new FileReader();
    reader.onerror = () => {
      if (!isMountedRef.current) return;
      setUploadError('Failed to read file: The file could not be accessed or was locked by another process.');
    };
    reader.onabort = () => {
      if (!isMountedRef.current) return;
      setUploadError('File reading was aborted.');
    };
    reader.onload = async (evt) => {
      if (!isMountedRef.current) return;
      try {
        const buffer = evt.target?.result;
        if (!buffer) throw new Error('Empty file buffer');
        const wb = await parseWorkbookSheets(buffer as ArrayBuffer, file.name);

        // Auto-detect the first worksheet with valid transaction headers (Bug 63, Bug 576)
        let rawData: ExcelBankRow[] = [];
        for (const sheetName of wb.sheetNames) {
          const candidateData = (wb.sheetsByObjects[sheetName] || []) as ExcelBankRow[];
          if (candidateData.length > 0 && candidateData[0] && typeof candidateData[0] === 'object') {
            const keysLower = Object.keys(candidateData[0]).map((k) => k.trim().toLowerCase());
            const hasDateCol = keysLower.some((k) =>
              ['value date', 'date', 'transaction date', 'val date'].includes(k)
            );
            const hasAmountOrUtrCol = keysLower.some((k) =>
              [
                'credit amount',
                'credit',
                'deposit',
                'cr amount',
                'amount',
                'debit',
                'debit amount',
                'dr amount',
                'utr reference',
                'utr',
                'bank utr',
                'reference no',
                'ref no',
              ].includes(k)
            );
            if (hasDateCol && hasAmountOrUtrCol) {
              rawData = candidateData;
              break;
            }
          }
        }

        if (rawData.length === 0 && wb.sheetNames.length > 0) {
          rawData = (wb.sheetsByObjects[wb.sheetNames[0]] || []) as ExcelBankRow[];
        }

        // Filter out completely blank rows before applying any fallback dates (Bug 38)
        const nonBlankRows = (rawData || []).filter((row) => {
          if (!row || typeof row !== 'object') return false;
          return Object.values(row).some((val) => String(val ?? '').trim() !== '');
        });

        if (nonBlankRows.length === 0) {
          setUploadError('Uploaded Bank Statement file contains no valid data rows.');
          showNotification('Uploaded Bank Statement file appears to be empty.', 4000);
          return;
        }

        const rowErrors: string[] = [];
        const parsedRows: ParsedBankRow[] = [];
        let debitSkippedCount = 0;

        nonBlankRows.forEach((row, idx) => {
          const excelRowNum = idx + 2;
          const rawDate =
            row['Value Date'] ||
            row['Date'] ||
            row['Transaction Date'] ||
            row['Val Date'];

          if (!rawDate || String(rawDate).trim() === '') {
            rowErrors.push(`Row ${excelRowNum}: Missing transaction/value date`);
            return;
          }

          const amountRaw =
            row['Credit Amount'] ??
            row['Credit'] ??
            row['Deposit'] ??
            row['Cr Amount'] ??
            row['Amount'] ??
            '';
          const debitFallback =
            row['Debit'] ??
            row['Debit Amount'] ??
            row['Dr Amount'] ??
            '';

          const hasCreditStr = String(amountRaw ?? '').trim() !== '';
          const hasDebitStr = String(debitFallback ?? '').trim() !== '';

          if (!hasCreditStr && !hasDebitStr) {
            rowErrors.push(`Row ${excelRowNum}: Missing credit/debit amount`);
            return;
          }

          if (hasCreditStr && !isStrictAccountingNumber(amountRaw)) {
            rowErrors.push(`Row ${excelRowNum}: Corrupted credit amount "${String(amountRaw).trim()}"`);
            return;
          }

          if (hasDebitStr && !isStrictAccountingNumber(debitFallback)) {
            rowErrors.push(`Row ${excelRowNum}: Corrupted debit amount "${String(debitFallback).trim()}"`);
            return;
          }

          const date = parseExcelDateCell(rawDate);
          const rawUtr =
            row['UTR Reference'] ??
            row['UTR'] ??
            row['Bank UTR'] ??
            row['Reference No'] ??
            row['Ref No'] ??
            row['Transaction ID'] ??
            row['Cheque/Ref No'] ??
            `BANK-TXN-${idx + 1}`;
          const utr = String(rawUtr ?? '').trim();

          const drCrCol = row['Dr/Cr'] || row['Type'] || row['Transaction Type'] || '';
          const { creditAmount, isDebitOrNegative } = parseAccountingAmount(
            hasCreditStr ? amountRaw : 0,
            drCrCol,
            hasDebitStr ? debitFallback : undefined
          );

          const narration =
            row['Narration'] ??
            row['Description'] ??
            row['Particulars'] ??
            row['Remarks'] ??
            '';
          const narrationStr = String(narration ?? '').trim();
          // Regex with bounded whitespace and multi-separator matching (Bugs 5, 75)
          const segments = narrationStr
            .split(/\s*[\/\-|\\]\s*/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && !/^[-_]+$/.test(s));
          const payerName =
            segments.length >= 2
              ? segments[1]
              : segments.length === 1 && segments[0].length > 3
              ? segments[0]
              : undefined;

          if (creditAmount > 0) {
            parsedRows.push({
              date: String(date).slice(0, 10),
              utr,
              creditAmount,
              narration: narrationStr,
              payerName,
            });
          } else if (isDebitOrNegative) {
            debitSkippedCount++;
          }
        });

        // Reject upload if any corrupted rows were found (Bug 37)
        if (rowErrors.length > 0) {
          const previewErrors = rowErrors.slice(0, 4).join('; ');
          const extraCount = rowErrors.length > 4 ? ` (+${rowErrors.length - 4} more)` : '';
          const summaryMsg = `Upload Rejected — ${rowErrors.length} corrupted row(s) detected: ${previewErrors}${extraCount}.`;
          setUploadError(summaryMsg);
          setNotification(summaryMsg);
          return;
        }

        if (parsedRows.length === 0) {
          setUploadError(
            debitSkippedCount > 0
              ? `No positive credit transactions were found (${debitSkippedCount} debit/withdrawal row(s) skipped). Fee reconciliation requires bank credit deposits.`
              : 'No positive credit transactions were found in the uploaded statement.'
          );
          return;
        }

        executeReconciliationEngine(parsedRows);
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        const detail = err instanceof Error ? err.message : 'Invalid file structure';
        setUploadError(`Failed to parse bank statement file (${detail}). Please ensure it is a valid CSV or Excel spreadsheet.`);
        showNotification('Failed to parse bank statement file. Please ensure it is a valid CSV or Excel spreadsheet.', 4000);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /**
   * Download a sample Bank Statement CSV template for testing
   */
  const handleDownloadSampleTemplate = () => {
    const sampleRows = [
      {
        'Value Date': '2026-10-18',
        'UTR Reference': 'pay_RPY_Oct18_001',
        'Credit Amount': 32000,
        'Narration': 'UPI/Aarav Kumar/Tuition Fee Clearance',
      },
      {
        'Value Date': '2026-10-19',
        'UTR Reference': 'pay_RPY_Oct19_002',
        'Credit Amount': 48000,
        'Narration': 'UPI/Priya Sharma/Full Autumn Fee',
      },
      {
        'Value Date': '2026-10-21',
        'UTR Reference': 'pay_RPY_Oct20_003',
        'Credit Amount': 17640,
        'Narration': 'Razorpay Net Payout Less MDR Commission Rs 360',
      },
      {
        'Value Date': '2026-10-21',
        'UTR Reference': 'pay_RPY_Oct21_005',
        'Credit Amount': 48000,
        'Narration': 'NetBanking/Vikramaditya Singh/Tuition Fee',
      },
      {
        'Value Date': '2026-10-22',
        'UTR Reference': 'UTR-SBIN-20261022-8821',
        'Credit Amount': 15000,
        'Narration': 'DIRECT NEFT DEPOSIT - UNREGISTERED ALOK K VERMA',
      },
    ];

    void exportJsonSheetsToExcelFile(
      [{ sheetName: 'Bank_Statement_Sample', rows: sanitizeSpreadsheetData(sampleRows) }],
      `RLSY_Bank_Statement_Template_${getISTDateString()}.xlsx`
    );
  };

  /**
   * Simulate sample bank statement ingestion
   */
  const handleSimulateSampleStatement = () => {
    const sampleRows: ParsedBankRow[] = [
      {
        date: '2026-10-18',
        utr: 'pay_RPY_Oct18_001',
        creditAmount: 32000,
        narration: 'UPI/Aarav Kumar/Tuition Fee Clearance',
      },
      {
        date: '2026-10-19',
        utr: 'pay_RPY_Oct19_002',
        creditAmount: 48000,
        narration: 'UPI/Priya Sharma/Full Autumn Fee',
      },
      {
        date: '2026-10-21',
        utr: 'pay_RPY_Oct20_003',
        creditAmount: 17640,
        narration: 'Razorpay Net Payout Less MDR Commission Rs 360',
      },
      {
        date: '2026-10-21',
        utr: 'pay_RPY_Oct21_005',
        creditAmount: 48000,
        narration: 'NetBanking/Vikramaditya Singh/Tuition Fee',
      },
      {
        date: '2026-10-22',
        utr: 'UTR-SBIN-20261022-8821',
        creditAmount: 15000,
        narration: 'DIRECT NEFT DEPOSIT - UNREGISTERED ALOK K VERMA',
      },
    ];

    executeReconciliationEngine(sampleRows);
  };

  // Safe XML Entity Escaping helper with Unicode Normalization & Control Character Stripping (Bugs 301, 392)
  const escapeXml = (str: any): string => {
    return stripControlChars(str || '')
      .normalize('NFKD')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const formatTallyDate = (dateStr: string): string => {
    const cleanDateInputString = String(dateStr || '').trim();
    // Explicit YYYY-MM-DD or YYYY/MM/DD match (no timezone shift)
    const isoMatch = cleanDateInputString.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}${isoMatch[2].padStart(2, '0')}${isoMatch[3].padStart(2, '0')}`;
    }
    // Explicit DD-MM-YYYY or DD/MM/YYYY match
    const dmyMatch = cleanDateInputString.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      return `${dmyMatch[3]}${dmyMatch[2].padStart(2, '0')}${dmyMatch[1].padStart(2, '0')}`;
    }
    // Safe layout parsing fallback strategy to extract segments without timezone shifting
    const fallbackDate = new Date(cleanDateInputString);
    if (!isNaN(fallbackDate.getTime())) {
      const year = fallbackDate.getFullYear();
      const month = String(fallbackDate.getMonth() + 1).padStart(2, '0');
      const day = String(fallbackDate.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    }
    return getISTDateString().replace(/-/g, '');
  };

  // Export TallyPrime XML
  const handleExportTallyXML = () => {
    // Immediately cancel pending cleanup timer and revoke existing Blob URL to prevent memory leaks during rapid re-clicks
    if (tallyExportCleanupRef.current.timer) {
      clearTimeout(tallyExportCleanupRef.current.timer);
      tallyExportCleanupRef.current.timer = null;
    }
    if (tallyExportCleanupRef.current.url) {
      URL.revokeObjectURL(tallyExportCleanupRef.current.url);
      tallyExportCleanupRef.current.url = null;
    }

    const exportable = records.filter(
      (r) => r.reconciliationStatus === 'Matched' || (r.reconciliationStatus === 'Bank_Variance' && r.gatewayFee > 0)
    );
    if (exportable.length === 0) {
      showNotification('No matched or MDR-settled reconciliation records found to export to TallyPrime.', 4000);
      return;
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<ENVELOPE>\n`;
    xml += `  <HEADER>\n`;
    xml += `    <TALLYREQUEST>Import Data</TALLYREQUEST>\n`;
    xml += `  </HEADER>\n`;
    xml += `  <BODY>\n`;
    xml += `    <IMPORTDATA>\n`;
    xml += `      <REQUESTDESC>\n`;
    xml += `        <REPORTNAME>Vouchers</REPORTNAME>\n`;
    xml += `        <STATICVARIABLES>\n`;
    xml += `          <SVCURRENTCOMPANY>RAM LAKHAN SINGH YADAV COLLEGE</SVCURRENTCOMPANY>\n`;
    xml += `        </STATICVARIABLES>\n`;
    xml += `      </REQUESTDESC>\n`;
    xml += `      <REQUESTDATA>\n`;

    exportable.forEach((item) => {
      const tallyDate = escapeXml(formatTallyDate(item.transactionDate));
      const safeRef = escapeXml(item.gatewayRef);
      const safeName = escapeXml(item.studentName);
      const safeRoll = escapeXml(item.rollNo);
      const safeCourse = escapeXml(item.course);
      const safeUtr = escapeXml(item.bankUTR);

      // Integer paise conversion to prevent floating-point rounding drift and NaN/undefined crashes (Bugs 92, 112, 113)
      const rawBankCredit = Number(item.bankCreditAmount);
      const bankCreditPaise = Number.isFinite(rawBankCredit) && rawBankCredit > 0 ? Math.round(rawBankCredit * 100) : 0;
      const rawMdrFee = Number(item.gatewayFee);
      const mdrFeePaise = Number.isFinite(rawMdrFee) && rawMdrFee > 0 ? Math.round(rawMdrFee * 100) : 0;
      const totalCreditPaise = bankCreditPaise + mdrFeePaise;

      const formattedBankCredit = (bankCreditPaise / 100).toFixed(2);
      const formattedMdrFee = (mdrFeePaise / 100).toFixed(2);
      const formattedBalancingErpAmt = (totalCreditPaise / 100).toFixed(2);

      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
      xml += `          <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">\n`;
      xml += `            <DATE>${tallyDate}</DATE>\n`;
      xml += `            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>\n`;
      xml += `            <REFERENCE>${safeRef}</REFERENCE>\n`;
      xml += `            <NARRATION>RLSY ERP Student Fee Collection: ${safeName} (${safeRoll}) | Course: ${safeCourse} | Gateway Ref: ${safeRef} | Bank UTR: ${safeUtr}</NARRATION>\n`;
      xml += `            <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>\n`;
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>State Bank of India - Current A/c 3098112</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>-${formattedBankCredit}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      if (mdrFeePaise > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>Payment Gateway MDR &amp; Bank Commission Charges</LEDGERNAME>\n`;
        xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
        xml += `              <AMOUNT>-${formattedMdrFee}</AMOUNT>\n`;
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      }
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>Student Academic Fee Receivable</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${formattedBalancingErpAmt}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      xml += `          </VOUCHER>\n`;
      xml += `        </TALLYMESSAGE>\n`;
    });

    xml += `      </REQUESTDATA>\n`;
    xml += `    </IMPORTDATA>\n`;
    xml += `  </BODY>\n`;
    xml += `</ENVELOPE>\n`;

    if (tallyExportCleanupRef.current.timer) {
      clearTimeout(tallyExportCleanupRef.current.timer);
      tallyExportCleanupRef.current.timer = null;
    }
    if (tallyExportCleanupRef.current.url) {
      URL.revokeObjectURL(tallyExportCleanupRef.current.url);
      tallyExportCleanupRef.current.url = null;
    }

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    tallyExportCleanupRef.current.url = url;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TallyPrime_3Way_Reconciliation_${getISTDateString()}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    tallyExportCleanupRef.current.timer = setTimeout(() => {
      if (tallyExportCleanupRef.current.url) {
        URL.revokeObjectURL(tallyExportCleanupRef.current.url);
        tallyExportCleanupRef.current.url = null;
      }
      tallyExportCleanupRef.current.timer = null;
    }, 1000);

    showNotification(`Exported ${exportable.length} reconciled vouchers to TallyPrime XML.`, 4000);
  };

  // Export Reconciliation Table to Excel
  const handleExportExcel = () => {
    const exportData = sanitizeSpreadsheetData(
      filteredRecords.map((r) => {
        const cleanValDate =
          !r.bankValueDate || r.bankValueDate === 'Not Credited' ? '' : r.bankValueDate;
        return {
          'Date': r.transactionDate,
          'Roll No': r.rollNo,
          'Student Name': r.studentName,
          'Course': r.course,
          'ERP Amount (INR)': r.erpAmount,
          'Gateway Ref': r.gatewayRef,
          'Gateway Amount (INR)': r.gatewayAmount,
          'Gateway Status': r.gatewayStatus,
          'Gateway MDR Fee': r.gatewayFee,
          'Bank UTR': r.bankUTR,
          'Bank Credit (INR)': r.bankCreditAmount,
          'Bank Value Date': cleanValDate,
          'Reconciliation Status': r.reconciliationStatus,
          'Variance (INR)': r.varianceAmount,
          'Audit Notes': r.notes || '',
        };
      })
    );

    void exportJsonSheetsToExcelFile(
      [{ sheetName: '3Way_Reconciliation', rows: exportData }],
      `RLSY_3Way_Reconciliation_${getISTDateString()}.xlsx`
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
                <Building className="w-6 h-6" />
              </span>
              <span className="text-xs uppercase font-mono tracking-widest text-indigo-300 font-bold">
                Automated Treasury Audit &amp; Settlement
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Bank Statement &amp; ERP Reconciliation Engine
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Automatically compares uploaded Bank Statement data against ERP Fee Ledger records.
              Identifies exact matches and automatically flags amount variances (MDR commissions),
              missing bank credits, and unrecorded bank deposits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              <Upload className="w-4 h-4" />
              Upload Bank Statement
            </button>
            <button
              onClick={handleSimulateSampleStatement}
              disabled={isProcessing}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md hover:shadow-lg"
              title="Compare Sample Bank Statement against ERP Ledger"
            >
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              Auto-Match &amp; Flag
            </button>
            <button
              onClick={handleExportTallyXML}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-2 shadow-md hover:shadow-lg"
              title="Generate TallyPrime XML Voucher Import File"
            >
              <FileCode className="w-4 h-4" />
              Export Tally XML
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md"
            >
              <Download className="w-4 h-4" />
              Excel Export
            </button>
          </div>
        </div>
      </div>

      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* 3-WAY RECONCILIATION SUMMARY STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Source 1: ERP Ledger */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold text-slate-400 font-mono">
              Source 1 • Internal
            </span>
            <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <span className="text-xs font-bold text-slate-700 block">ERP Ledger Total</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block font-mono tabular-nums">
            {formatINR(totalErp)}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {records.filter((r) => r.erpAmount > 0).length} Billed Transactions
          </span>
        </div>

        {/* Source 2: Bank Statement Realized */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold text-slate-400 font-mono">
              Source 2 • Realized
            </span>
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Building className="w-4 h-4" />
            </span>
          </div>
          <span className="text-xs font-bold text-slate-700 block">Bank Account Realized</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block font-mono tabular-nums">
            {formatINR(totalBank)}
          </span>
          <span className="text-xs text-emerald-600 mt-1 block font-semibold">
            Cleared SBI Account Credits
          </span>
        </div>

        {/* Source 3: Fully Reconciled */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold text-slate-400 font-mono">
              Audit Status
            </span>
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <span className="text-xs font-bold text-slate-700 block">Matched Records</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block font-mono tabular-nums">
            {matchedCount} <span className="text-xs font-normal text-slate-500">/ {records.length}</span>
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {records.length > 0 ? Math.round((matchedCount / records.length) * 100) : 100}% Reconciled
          </span>
        </div>

        {/* Source 4: Discrepancies Flagged */}
        <div className={`bg-white p-5 rounded-2xl border shadow-sm relative overflow-hidden ${
          totalDiscrepancies > 0 ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold text-rose-500 font-mono">
              Attention Required
            </span>
            <span className="p-1.5 bg-rose-50 text-rose-700 rounded-lg">
              <AlertOctagon className="w-4 h-4" />
            </span>
          </div>
          <span className="text-xs font-bold text-slate-700 block">Flagged Discrepancies</span>
          <span className="text-2xl font-black text-rose-600 mt-1 block font-mono tabular-nums">
            {totalDiscrepancies}
          </span>
          <span className="text-xs text-rose-600 mt-1 block font-semibold">
            {bankVarianceCount} Variances · {pendingGatewayCount} Missing · {unreconciledCount} Unrecorded
          </span>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter Status:
          </span>
          {[
            { id: 'ALL', label: `All (${records.length})` },
            { id: 'Matched', label: `Matched (${matchedCount})` },
            { id: 'Bank_Variance', label: `Amount Variances (${bankVarianceCount})` },
            { id: 'Gateway_Pending', label: `Missing Bank Credits (${pendingGatewayCount})` },
            { id: 'Unreconciled', label: `Unrecorded Deposits (${unreconciledCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student, roll no, ref, UTR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* RECONCILIATION AUDIT TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Date &amp; Student / Payer</th>
                <th className="px-4 py-3.5 text-right font-mono">1. ERP Ledger</th>
                <th className="px-4 py-3.5">2. Gateway Ref</th>
                <th className="px-4 py-3.5">3. Bank Statement UTR</th>
                <th className="px-4 py-3.5 text-right font-mono">Realized Credit</th>
                <th className="px-4 py-3.5 text-center">Audit Status</th>
                <th className="px-4 py-3.5">Discrepancy Analysis &amp; Findings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No reconciliation entries found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr
                    key={r.id}
                    className={`transition hover:bg-slate-50/80 ${
                      r.reconciliationStatus === 'Unreconciled'
                        ? 'bg-rose-50/30'
                        : r.reconciliationStatus === 'Gateway_Pending'
                        ? 'bg-amber-50/20'
                        : r.reconciliationStatus === 'Bank_Variance'
                        ? 'bg-orange-50/20'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-900 block truncate max-w-[280px]" title={r.studentName}>
                        {r.studentName}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className={`font-mono font-bold ${
                          r.rollNo === 'UNRECORDED' ? 'text-rose-600' : 'text-indigo-700'
                        }`}>
                          {r.rollNo}
                        </span>
                        <span>·</span>
                        <span>{r.transactionDate}</span>
                        {r.course && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[120px]">{r.course}</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Source 1: ERP Amount */}
                    <td className="px-4 py-3.5 text-right font-mono font-black text-slate-900 tabular-nums">
                      {r.erpAmount > 0 ? `₹${r.erpAmount.toLocaleString('en-IN')}` : '—'}
                    </td>

                    {/* Source 2: Gateway Ref */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs text-purple-900 font-bold block truncate max-w-[140px]">
                        {r.gatewayRef}
                      </span>
                      <span className="text-xs text-slate-400 block">
                        Status: {r.gatewayStatus}
                      </span>
                    </td>

                    {/* Source 3: Bank UTR */}
                    <td className="px-4 py-3.5">
                      <span className={`font-mono text-xs font-bold block truncate max-w-[150px] ${
                        r.bankUTR === 'MISSING_IN_BANK' ? 'text-rose-600 italic' : 'text-emerald-900'
                      }`}>
                        {r.bankUTR}
                      </span>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        Val Date:{' '}
                        {!r.bankValueDate || r.bankValueDate === 'Not Credited' ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-xs uppercase">
                            Not Credited
                          </span>
                        ) : (
                          r.bankValueDate
                        )}
                      </span>
                    </td>

                    {/* Source 3: Bank Realized Amount */}
                    <td className="px-4 py-3.5 text-right font-mono font-black tabular-nums">
                      {r.bankCreditAmount > 0 ? (
                        <span className="text-emerald-800">
                          ₹{r.bankCreditAmount.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold">₹0</span>
                      )}
                    </td>

                    {/* Status marker */}
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {r.reconciliationStatus === 'Matched' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs inline-flex items-center gap-1 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Matched
                        </span>
                      ) : r.reconciliationStatus === 'Bank_Variance' ? (
                        <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 font-bold text-xs inline-flex items-center gap-1 border border-orange-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                          Variance ₹{r.varianceAmount.toLocaleString('en-IN')}
                        </span>
                      ) : r.reconciliationStatus === 'Gateway_Pending' ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-xs inline-flex items-center gap-1 border border-amber-300">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Missing Bank Credit
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-xs inline-flex items-center gap-1 border border-rose-300">
                          <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                          Unrecorded Deposit
                        </span>
                      )}
                    </td>

                    {/* Notes / Discrepancy details */}
                    <td className="px-4 py-3.5 text-xs text-slate-600 max-w-sm">
                      <div className="flex flex-col gap-1.5">
                        <span className={
                          r.reconciliationStatus !== 'Matched'
                            ? 'font-medium text-slate-800'
                            : 'text-slate-600'
                        }>
                          {r.notes || 'Reconciled'}
                        </span>
                        {r.reconciliationStatus !== 'Matched' && (
                          <button
                            type="button"
                            onClick={() => {
                              setOverrideTarget(r);
                              setOverrideStatus('Matched');
                              setOverrideReason('');
                              setOverrideError('');
                            }}
                            className="self-start text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md transition"
                          >
                            Audit Override Status
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MANUAL AUDIT STATUS OVERRIDE MODAL */}
      {overrideTarget && (
        <div role="dialog" aria-modal="true" aria-label="Statutory Reconciliation Override" className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">Statutory Reconciliation Override</h3>
              </div>
              <button
                type="button"
                onClick={() => setOverrideTarget(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="font-bold text-slate-900">{overrideTarget.studentName} ({overrideTarget.rollNo})</div>
                <div className="font-mono text-xs text-slate-600">
                  ERP: ₹{overrideTarget.erpAmount.toLocaleString('en-IN')} | Bank: ₹{overrideTarget.bankCreditAmount.toLocaleString('en-IN')}
                </div>
              </div>

              {overrideError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{overrideError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Reconciliation Status *</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as Reconciliation3WayRecord['reconciliationStatus'])}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                >
                  <option value="Matched">Matched (Audit Verified)</option>
                  <option value="Bank_Variance">Bank Variance (MDR / Charge Noted)</option>
                  <option value="Gateway_Pending">Gateway Pending (Awaiting Settlement)</option>
                  <option value="Unreconciled">Unreconciled (Suspense Entry)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mandatory Audit Justification Reason (min 10 chars) *
                </label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => {
                    setOverrideReason(e.target.value);
                    if (overrideError) setOverrideError('');
                  }}
                  placeholder="Provide official voucher number, bank advice reference, or MDR settlement note..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideTarget(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cleanReason = overrideReason.trim();
                    if (cleanReason.length < 10) {
                      setOverrideError('Statutory Audit Policy: Please enter a detailed justification reason of at least 10 characters.');
                      return;
                    }
                    const stamp = new Date().toLocaleString('en-IN');
                    const prevStatus = overrideTarget.reconciliationStatus;
                    const updated = records.map((rec) =>
                      rec.id === overrideTarget.id
                        ? {
                            ...rec,
                            reconciliationStatus: overrideStatus,
                            varianceAmount: overrideStatus === 'Matched' ? 0 : rec.varianceAmount,
                            bankCreditAmount: overrideStatus === 'Matched' ? rec.erpAmount : rec.bankCreditAmount,
                            notes: `[Manual Audit Override from "${prevStatus}" to "${overrideStatus}" by ${currentUser.name} (${currentUser.role}) on ${stamp}]: ${cleanReason}`,
                          }
                        : rec
                    );
                    onSaveRecords(updated);
                    // Write immutable audit log entry (Bug 48)
                    try {
                      erpStorage.appendAuditLog({
                        actorId: currentUser.id || 'ACC-SYS',
                        actorName: currentUser.name || 'Accountant',
                        actorRole: currentUser.role || 'accountant',
                        action: 'RECONCILIATION_STATUS_OVERRIDE',
                        entityType: 'ReconciliationRecord',
                        entityId: overrideTarget.id,
                        summary: `Manual override of reconciliation status from "${prevStatus}" to "${overrideStatus}" for UTR ${overrideTarget.bankUTR || 'N/A'} (${overrideTarget.studentName || 'Student'}). Reason: ${cleanReason}`,
                        oldValue: { status: prevStatus, variance: overrideTarget.varianceAmount },
                        newValue: { status: overrideStatus, reason: cleanReason },
                      });
                    } catch {}
                    setOverrideTarget(null);
                    showNotification(`Audit override recorded for ${overrideTarget.rollNo} (${overrideTarget.studentName}).`, 5000);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow"
                >
                  Confirm Audit Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD BANK STATEMENT MODAL */}
      {isUploadModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Upload Bank Statement" className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Upload Bank Statement for Automated Reconciliation</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Upload your collegiate bank statement file (<strong>.csv</strong>, <strong>.xlsx</strong>, or <strong>.xls</strong>).
                The engine will automatically match entries against ERP Ledger transactions by UTR/reference number,
                verify credit amounts, and flag all variances, missing credits, and unrecorded deposits.
              </p>

              {uploadError && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-2xl text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50 hover:bg-emerald-50/30 group"
              >
                <FileUp className="w-10 h-10 text-slate-400 group-hover:text-emerald-600 mx-auto mb-2 transition" />
                <span className="font-bold text-slate-800 block text-sm">
                  Click to select Bank Statement file
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  Supports CSV, XLSX, XLS with columns: Value Date, UTR Reference, Credit Amount, Narration
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = '';
                  }}
                  onChange={handleFileUpload}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                />
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 flex items-center justify-between">
                <div>
                  <span className="font-bold block">Need standard statement format?</span>
                  <span className="text-xs text-indigo-700">
                    Download sample CSV pre-filled with test scenarios.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  Template
                </button>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleSimulateSampleStatement}
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Or simulate sample statement
                </button>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
