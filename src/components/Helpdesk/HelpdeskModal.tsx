import React, { useState, useEffect, useRef } from 'react';
import { HelpdeskTicket, Student, UserAccount, UserRole } from '../../types/erp';
import { X, Send, LifeBuoy, CheckCircle2, Clock, MessageSquare, AlertCircle } from 'lucide-react';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';

interface HelpdeskModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: HelpdeskTicket[];
  currentRole: UserRole;
  currentUser?: UserAccount;
  currentStudent?: Student;
  onSubmitTicket: (ticket: Omit<HelpdeskTicket, 'id' | 'ticketNo' | 'createdAt' | 'status'>) => void;
  onResolveTicket: (ticketId: string, responseNote: string) => void;
}

export const HelpdeskModal: React.FC<HelpdeskModalProps> = ({
  isOpen,
  onClose,
  tickets,
  currentRole,
  currentUser,
  currentStudent,
  onSubmitTicket,
  onResolveTicket,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [category, setCategory] = useState<'Fee Dispute' | 'Attendance Rectification' | 'Grade Re-evaluation' | 'Hall Ticket Issue' | 'General'>('Fee Dispute');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Admin reply state
  const [replyTicketId, setReplyTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');
  const submitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) window.clearTimeout(submitTimerRef.current);
    };
  }, []);

  // Accessible Modal Focus Trap & Escape-to-close (Bugs 242, 250)
  const modalContainerRef = useModalFocusTrap<HTMLDivElement>({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!subject.trim() || !message.trim()) {
      setSubmitError('Please fill in both subject and detailed explanation.');
      return;
    }

    const reporterId = currentStudent?.id || currentUser?.studentId || currentUser?.facultyId || currentUser?.id;
    const reporterName = currentStudent?.name || currentUser?.name;
    const reporterIdentifier =
      currentStudent?.rollNo || currentUser?.rollNo || currentUser?.facultyId || (currentUser ? currentUser.role.toUpperCase() : '');

    if (!reporterId || !reporterName) {
      setSubmitError('Active user session required to submit a grievance.');
      return;
    }

    try {
      onSubmitTicket({
        studentId: reporterId,
        studentName: reporterName,
        studentRollNo: reporterIdentifier || reporterId,
        category,
        subject: subject.trim(),
        message: message.trim(),
        priority: category === 'Hall Ticket Issue' ? 'High' : 'Medium',
      });

      setIsSubmitted(true);
      if (submitTimerRef.current) window.clearTimeout(submitTimerRef.current);
      submitTimerRef.current = window.setTimeout(() => {
        setIsSubmitted(false);
        setSubject('');
        setMessage('');
        setActiveTab('list');
      }, 1500);
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to submit grievance ticket.');
    }
  };

  const handleSendReply = (ticketId: string) => {
    setReplyError('');
    if (!replyText.trim()) {
      setReplyError('Please enter a resolution note.');
      return;
    }
    try {
      onResolveTicket(ticketId, replyText.trim());
      setReplyTicketId(null);
      setReplyText('');
    } catch (err: any) {
      setReplyError(err?.message || 'Unable to resolve ticket.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        ref={modalContainerRef}
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-8"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <LifeBuoy className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">Institutional Grievance & Student Support</h3>
              <p className="text-xs text-slate-400">Direct escalation to DDO, Exam Cell & Academic Deans</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-slate-200 px-6 pt-3 bg-slate-50 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 border-b-2 transition ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Lodge Grievance / Query
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-2.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>All Tickets</span>
            <span className="w-4 h-4 bg-indigo-100 text-indigo-700 rounded-full text-xs flex items-center justify-center font-bold">
              {tickets.length}
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {activeTab === 'create' && (
            <div>
              {isSubmitted ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800">Grievance Registered</h4>
                  <p className="text-xs text-slate-500">
                    Your ticket has been officially logged in the college grievance cell.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
                  {submitError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Issue Category</label>
                    <select
                      value={category}
                      onChange={(e: any) => setCategory(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-medium"
                    >
                      <option value="Fee Dispute">Fee Dispute (Double debit, receipt mismatch)</option>
                      <option value="Attendance Rectification">Attendance Rectification (Medical condonation)</option>
                      <option value="Hall Ticket Issue">Hall Ticket Blocked / Debarred Query</option>
                      <option value="Grade Re-evaluation">Grade Re-evaluation / Scrutiny</option>
                      <option value="General">General Administrative Query</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Subject / Summary</label>
                    <input
                      type="text"
                      placeholder="Brief headline of grievance"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Detailed Explanation</label>
                    <textarea
                      rows={4}
                      placeholder="Provide specific details (transaction ID, class dates, medical documents)..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    Submit Grievance to Helpdesk
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === 'list' && (
            <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              {tickets.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">No tickets found.</p>
              ) : (
                tickets.map((t) => {
                  const isResolved = (t.status || '').toLowerCase() === 'resolved';
                  return (
                    <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-700">{t.ticketNo}</span>
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700">
                            {t.category}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            isResolved
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm">{t.subject}</h4>
                      <p className="text-slate-600 leading-relaxed">{t.message}</p>

                      <div className="text-xs text-slate-400 flex justify-between items-center pt-1 border-t border-slate-100">
                        <span>
                          From: {t.studentName} ({t.studentRollNo})
                        </span>
                        <span>{t.createdAt}</span>
                      </div>

                      {t.responseNote && (
                        <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 space-y-1">
                          <div className="flex items-center justify-between font-bold text-xs">
                            <span>Official Resolution:</span>
                            <span className="text-xs font-mono text-emerald-700">{t.resolvedAt}</span>
                          </div>
                          <p className="text-xs leading-relaxed">{t.responseNote}</p>
                          <p className="text-xs text-emerald-700 italic">Signed by: {t.respondedBy}</p>
                        </div>
                      )}

                      {/* Admin Reply Action */}
                      {(currentRole === 'superadmin' || currentRole === 'principal') && !isResolved && (
                        <div className="pt-2">
                          {replyTicketId === t.id ? (
                            <div className="space-y-2 mt-2">
                              {replyError && (
                                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
                                  {replyError}
                                </div>
                              )}
                              <textarea
                                rows={2}
                                placeholder="Type administrative resolution note..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyTicketId(null);
                                    setReplyError('');
                                  }}
                                  className="px-2.5 py-1 bg-slate-200 rounded text-slate-700"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendReply(t.id)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold"
                                >
                                  Resolve & Close Ticket
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyTicketId(t.id);
                                setReplyError('');
                              }}
                              className="text-xs text-indigo-600 font-bold hover:underline"
                            >
                              + Add Official Resolution Note
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
