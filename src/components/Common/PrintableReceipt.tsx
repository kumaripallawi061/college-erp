import React, { useEffect } from 'react';
import { FeeTransaction, Student } from '../../types/erp';
import { X, Printer, CheckCircle, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Money } from './Rupee';

function convertIntegerToIndianWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = (n: number): string => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
  };
  const threeDigits = (n: number): string => {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    return `${h ? `${ones[h]} Hundred` : ''}${h && rem ? ' ' : ''}${rem ? twoDigits(rem) : ''}`.trim();
  };

  let n = Math.floor(Math.abs(num));
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(`${convertIntegerToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(' ').trim();
}

export function formatRupeesInWords(amount: unknown): string {
  const val = Number(amount);
  if (!Number.isFinite(val) || val < 0) return 'Rupees Zero Only';
  const totalPaisa = Math.round(val * 100);
  const rupees = Math.floor(totalPaisa / 100);
  const paise = totalPaisa % 100;
  const rupeeWords = convertIntegerToIndianWords(rupees);
  if (paise > 0) {
    return `Rupees ${rupeeWords} and ${convertIntegerToIndianWords(paise)} Paise Only`;
  }
  return `Rupees ${rupeeWords} Only`;
}

interface PrintableReceiptProps {
  transaction: FeeTransaction | null;
  student?: Student;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  transaction,
  student,
  isOpen,
  onClose,
}) => {
  // Keyboard Escape listener to close receipt
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
    >
      {/* Modal Dialog Card - Wrapped with max viewport height and flex column layout */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col zoom-in-95 animate-in">
        {/* Sticky Header with Action & Close Buttons (Hidden on Print) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex justify-between items-center print:hidden shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-xs tracking-wide uppercase truncate">
              Official Institutional Fee Receipt
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition text-white shadow-xs"
              title="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close Receipt Modal"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 hover:border-rose-500 shadow-xs"
              title="Close Receipt (Esc)"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </div>

        {/* Scrollable & Text-Wrapped Printable Receipt Body */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-800 font-sans print:p-0 overflow-y-auto flex-1 break-words">
          {/* Institutional Crest & Title */}
          <div className="text-center border-b-2 border-slate-900 pb-4">
            <div className="inline-block p-1.5 rounded-full bg-slate-900 text-amber-400 mb-2">
              <span className="font-sans font-black text-lg px-2">RLSY</span>
            </div>
            <h1 className="font-sans font-bold text-xl sm:text-2xl text-slate-950 uppercase tracking-tight break-words">
              Ram Lakhan Singh Yadav College
            </h1>
            <p className="text-xs text-slate-600 uppercase font-semibold tracking-wider">
              Affiliated to State University • NAAC Accredited • UGC Recognized
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Campus Road, Institutional Area • DDO &amp; Accounts Division
            </p>
          </div>

          {/* Receipt Meta Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block text-xs uppercase font-bold">Receipt Number</span>
              <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm break-all">
                {transaction.receiptNo}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs uppercase font-bold">Transaction Date</span>
              <span className="font-medium text-slate-800 break-words">{transaction.timestamp}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs uppercase font-bold">Payment Method</span>
              <span className="font-bold text-indigo-700 font-mono">{transaction.paymentMethod}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs uppercase font-bold">Bank Reference No</span>
              <span className="font-mono text-slate-700 text-xs break-all block">
                {transaction.referenceNo}
              </span>
            </div>
          </div>

          {/* Student Profile Particulars */}
          <div className="border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <div className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-1.5 flex items-center justify-between">
              <span>Student Particulars</span>
              {transaction.status === 'Success' ? (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-bold">
                  Payment Verified
                </span>
              ) : transaction.status === 'Pending' ? (
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs font-bold">
                  Settlement Pending
                </span>
              ) : (
                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-xs font-bold">
                  Payment Failed
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 pt-1">
              <div>
                <span className="text-slate-500">Student Name: </span>
                <strong className="text-slate-900 break-words">{transaction.studentName}</strong>
              </div>
              <div>
                <span className="text-slate-500">College Roll No: </span>
                <strong className="font-mono text-slate-900">{transaction.studentRollNo}</strong>
              </div>
              <div>
                <span className="text-slate-500">Course / Programme: </span>
                <span className="text-slate-800 break-words">{transaction.course}</span>
              </div>
              <div>
                <span className="text-slate-500">Current Semester: </span>
                <span className="font-medium text-slate-800">Semester {transaction.semester}</span>
              </div>
            </div>
          </div>

          {/* Itemized Fee Head Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-xs">
                <tr>
                  <th className="px-4 py-2.5">S.No</th>
                  <th className="px-4 py-2.5">Particulars / Fee Head</th>
                  <th className="px-4 py-2.5 text-right">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 font-mono">1</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-900 block break-words">
                      {transaction.feeHeadTitle}
                    </span>
                    <span className="text-xs text-slate-500">
                      Academic Session 2026-27 • Institutional Ledger Credit
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    <Money amount={transaction.amount} decimals={true} />
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right uppercase text-slate-700">
                    Total Amount Paid:
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700 text-sm">
                    <Money amount={transaction.amount} decimals={true} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount in words & dynamic status badge */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 uppercase font-bold block">Amount in Words</span>
              <span className="text-slate-900 font-semibold block">
                {formatRupeesInWords(transaction.amount)}
              </span>
              <span className="text-slate-600 font-medium italic block">
                {transaction.status === 'Success'
                  ? 'Payment received and credited to institutional treasury.'
                  : transaction.status === 'Pending'
                  ? 'Transaction initiated; awaiting gateway/bank settlement confirmation.'
                  : 'Transaction failed; no amount was settled to the institutional treasury.'}
              </span>
            </div>
            {transaction.status === 'Success' ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                SUCCESSFULLY SETTLED
              </div>
            ) : transaction.status === 'Pending' ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-xs shrink-0">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                PAYMENT PENDING
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-full font-bold text-xs shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                PAYMENT FAILED
              </div>
            )}
          </div>

          {/* Signatures & Seal */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs">
            <div className="text-center">
              <div className="w-20 h-20 border-2 border-dashed border-indigo-300 rounded-lg flex items-center justify-center mx-auto text-xs text-indigo-700 font-mono p-1">
                [COLLEGE SEAL &amp; DIGITAL STAMP]
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">Verified System Hash</p>
            </div>

            <div className="text-right space-y-1">
              <div className="w-36 h-0.5 bg-slate-400 ml-auto mb-1" />
              <p className="font-bold text-slate-900">Accounts Officer / Cashier</p>
              <p className="text-xs text-slate-500">Finance &amp; Accounts Section</p>
              <p className="text-xs text-slate-400 font-mono">RLSY Autonomous College</p>
            </div>
          </div>
        </div>

        {/* Sticky Modal Footer with Prominent Close and Print Buttons (Hidden on Print) */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-600 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs">Official Digital Receipt • Accounts Ledger</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs"
            >
              <X className="w-4 h-4" />
              <span>Close Receipt</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
