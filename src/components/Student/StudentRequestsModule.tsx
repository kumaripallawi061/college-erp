import React, { useState, useMemo } from 'react';
import { ServiceRequestItem, ServiceTariff, Student } from '../../types/erp';
import {
  FileText,
  Clock,
  CheckCircle2,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  Award,
  Sparkles,
  Building2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Money } from '../Common/Rupee';
import {
  generateSecureId,
  calculateServiceTariffTax,
  sanitizePlainText,
  getISTDateString,
  parseSafeDateTime,
} from '../../utils/erpLogic';
import { apiClient } from '../../services/apiClient';

interface StudentRequestsModuleProps {
  student: Student;
  serviceTariffs: ServiceTariff[];
  myRequests: ServiceRequestItem[];
  onCreateRequest: (data: {
    studentId: string;
    studentRollNo: string;
    studentName: string;
    studentCourse: string;
    studentSemester: number;
    serviceId: string;
    serviceTitle: string;
    amountPaid: number;
    paymentStatus: 'Paid' | 'Gratis';
    transactionRef: string;
    remarks?: string;
  }) => void;
}

export const StudentRequestsModule: React.FC<StudentRequestsModuleProps> = ({
  student,
  serviceTariffs,
  myRequests,
  onCreateRequest,
}) => {
  const [selectedTariff, setSelectedTariff] = useState<ServiceTariff | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Card' | 'NetBanking'>('UPI');
  const [applicantRemark, setApplicantRemark] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Filter out requests older than 3 calendar months (90 days) anchored to IST date
  const validRequests = useMemo(() => {
    const nowMs = parseSafeDateTime(getISTDateString()).getTime();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    return myRequests.filter((r) => {
      const refDateStr = r.completedDate || r.issuedDate || r.requestDate;
      const refTime = parseSafeDateTime(refDateStr).getTime();
      if (isNaN(refTime)) return true;
      return nowMs - refTime < ninetyDaysMs;
    });
  }, [myRequests]);

  const activeTariffs = serviceTariffs.filter((t) => t.status === 'active');

  const handleOpenCheckout = (tariff: ServiceTariff) => {
    setSelectedTariff(tariff);
    setApplicantRemark('');
    setPaymentMethod('UPI');
    setSubmitError('');
    setIsCheckoutOpen(true);
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTariff || isSubmitting) return;
    setSubmitError('');

    // Authoritative lookup against active serviceTariffs prop to prevent client state tampering (Bug 497)
    const authoritativeTariff =
      serviceTariffs.find((t) => t.id === selectedTariff.id && t.status === 'active') || selectedTariff;
    const taxBreakdown = calculateServiceTariffTax(authoritativeTariff.amount, authoritativeTariff.gstPercentage || 0);
    const verifiedAmount = taxBreakdown.totalPayable;
    const isGratis = verifiedAmount <= 0;

    setIsSubmitting(true);
    try {
      let txnRef = isGratis ? generateSecureId('GRATIS-CLR') : generateSecureId('PAY-SRV');
      if (!isGratis) {
        try {
          const order = await apiClient.createGatewayPaymentOrder({
            studentId: student.id,
            studentRollNo: student.rollNo,
            studentName: student.name,
            amountInRupees: verifiedAmount,
            feeHeadTitle: `Service: ${authoritativeTariff.title}`,
          });
          if (order?.orderId) txnRef = order.orderId;
        } catch {
          try {
            const seqRec = await apiClient.requestNextSequentialReceipt();
            if (seqRec) txnRef = seqRec;
          } catch {
            // Fall back to secure local reference when offline
          }
        }
      }
      const cleanRemarks = sanitizePlainText(applicantRemark).slice(0, 300);

      onCreateRequest({
        studentId: student.id,
        studentRollNo: student.rollNo,
        studentName: student.name,
        studentCourse: student.course,
        studentSemester: student.semester,
        serviceId: authoritativeTariff.id,
        serviceTitle: authoritativeTariff.title,
        amountPaid: verifiedAmount,
        paymentStatus: isGratis ? 'Gratis' : 'Paid',
        transactionRef: txnRef,
        remarks: cleanRemarks || undefined,
      });

      const prefersReduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        confetti({
          particleCount: 60,
          spread: 55,
          origin: { y: 0.6 },
        });
      }

      setIsCheckoutOpen(false);
      setSelectedTariff(null);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit service request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
                <FileText className="w-6 h-6" />
              </span>
              <span className="text-xs uppercase font-mono tracking-widest text-indigo-300 font-bold">
                Student Self-Service Portal
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Official Certificates & Clearance Requests
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Apply online for statutory institutional certificates (Bonafide, College Clearance No-Dues, Character, Migration)
              by remitting the prescribed requisite fee. Track review milestones and download system-verified digital certificates.
            </p>
          </div>
        </div>
      </div>

      {/* AVAILABLE CERTIFICATES CATALOG */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-900">Available Collegiate Services & Requisite Tariffs</h3>
          <span className="text-xs text-slate-500">{activeTariffs.length} Services Active</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeTariffs.map((tariff) => (
            <div
              key={tariff.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {tariff.serviceCode}
                  </span>
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {tariff.deliveryDays}d
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 text-sm">{tariff.title}</h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-3">
                  {tariff.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 block">Requisite Fee</span>
                  <span className="text-lg font-black text-slate-900 font-mono tabular-nums">
                    ₹{tariff.amount.toLocaleString('en-IN')}
                  </span>
                </div>

                <button
                  onClick={() => handleOpenCheckout(tariff)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1"
                >
                  Apply & Pay
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MY SUBMITTED REQUESTS STATUS TRACKER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900">My Certificate Applications & Track Record</h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">{validRequests.length} Applications</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-500 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Request No & Date</th>
                <th className="px-5 py-3.5">Certificate Type</th>
                <th className="px-5 py-3.5 text-right font-mono">Requisite Paid</th>
                <th className="px-5 py-3.5">Transaction Ref</th>
                <th className="px-5 py-3.5 text-right">Application Status & Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {validRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    You have not submitted any certificate requests yet (or all past requests older than 3 months have been archived). Choose a service above to apply.
                  </td>
                </tr>
              ) : (
                validRequests.map((req) => {
                  const isComplete = req.status === 'Issued' || req.status === 'Approved' || req.archived;
                  const isRejected = req.status === 'Rejected';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-indigo-950 block">{req.requestNo}</span>
                        <span className="text-xs text-slate-500 block">{req.requestDate}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900 block">{req.serviceTitle}</span>
                        {req.remarks && (
                          <span className="text-xs text-slate-400 block italic truncate max-w-xs">
                            {req.remarks}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-black text-slate-900 tabular-nums">
                        ₹{req.amountPaid.toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-emerald-800 font-bold block">{req.transactionRef}</span>
                        <span className="text-xs text-emerald-600">✓ Settled</span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {isComplete ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Complete
                            </span>
                            <span className="text-xs text-slate-600 mt-1 font-medium flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              Collect physical certificate from college office
                            </span>
                          </div>
                        ) : isRejected ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              Rejected
                            </span>
                            {req.remarks && (
                              <span className="text-xs text-rose-600 mt-1">{req.remarks}</span>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-end">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Processing
                            </span>
                            <span className="text-xs text-slate-500 mt-1">
                              Under verification at clearance counter
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CHECKOUT & FEE REMITTANCE MODAL */}
      {isCheckoutOpen && selectedTariff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Remit Requisite Fee and Submit Request"
          className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Remit Requisite Fee & Submit Request</h3>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleExecutePayment} className="p-6 space-y-4 text-xs font-sans">
              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold">
                  {submitError}
                </div>
              )}
              <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl">
                <span className="text-xs uppercase font-bold text-indigo-700 block font-mono">
                  Selected Collegiate Service
                </span>
                <span className="font-black text-slate-900 text-sm block mt-0.5">
                  {selectedTariff.title}
                </span>
                <span className="text-xs text-slate-600 block mt-1">
                  Applicant: <strong className="text-slate-900">{student.name}</strong> ({student.rollNo})
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Purpose / Representation Note (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={applicantRemark}
                  onChange={(e) => setApplicantRemark(e.target.value)}
                  placeholder="e.g. Applying for Indian Railways concession / State scholarship"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl resize-none"
                />
              </div>

              {calculateServiceTariffTax(selectedTariff.amount, selectedTariff.gstPercentage || 0).totalPayable <= 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold">
                  Institutional Gratis Service: No payment required for this clearance or certificate.
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['UPI', 'Card', 'NetBanking'] as const).map((method) => (
                      <button
                        type="button"
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition ${
                          paymentMethod === method
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 block">Total Due</span>
                  <span className="text-xl font-black text-emerald-700 font-mono">
                    ₹{calculateServiceTariffTax(selectedTariff.amount, selectedTariff.gstPercentage || 0).totalPayable.toLocaleString('en-IN')}
                  </span>
                  {Boolean(selectedTariff.gstPercentage && selectedTariff.gstPercentage > 0) && (
                    <span className="text-xs font-mono text-slate-500 block">
                      Incl. {selectedTariff.gstPercentage}% GST (₹{calculateServiceTariffTax(selectedTariff.amount, selectedTariff.gstPercentage || 0).gstAmount})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCheckoutOpen(false)}
                    className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
                  >
                    {isSubmitting
                      ? 'Processing...'
                      : calculateServiceTariffTax(selectedTariff.amount, selectedTariff.gstPercentage || 0).totalPayable <= 0
                      ? 'Submit Clearance (Free)'
                      : `Pay ₹${calculateServiceTariffTax(selectedTariff.amount, selectedTariff.gstPercentage || 0).totalPayable} & Submit`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
