import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CongratulationMessage, Student, UserAccount, UserRole } from '../../types/erp';
import {
  Trophy,
  Award,
  Sparkles,
  Search,
  Plus,
  X,
  CheckCircle2,
  Calendar,
  UserCheck,
  Tag,
  Star,
  Flame,
  Medal,
  GraduationCap,
} from 'lucide-react';

interface CongratulationsModuleProps {
  messages: CongratulationMessage[];
  students: Student[];
  currentUser: UserAccount;
  currentRole: UserRole;
  onAddMessage: (msg: Omit<CongratulationMessage, 'id' | 'date'>) => void;
}

export const CongratulationsModule: React.FC<CongratulationsModuleProps> = ({
  messages,
  students,
  currentUser,
  currentRole,
  onAddMessage,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [targetRollNo, setTargetRollNo] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CongratulationMessage['category']>('Academic Excellence');
  const [badge, setBadge] = useState('Honor Roll Recipient');
  const [customMessage, setCustomMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);
  const submitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) window.clearTimeout(submitTimerRef.current);
    };
  }, []);

  const canAdd = currentRole === 'faculty' || currentRole === 'principal' || currentRole === 'superadmin';

  const activeStudents = useMemo(
    () => students.filter((s) => !['withdrawn', 'expelled', 'dropped'].includes((s.status || '').toLowerCase())),
    [students]
  );

  // Find student matching target roll number
  const matchedStudent = useMemo(() => {
    if (!targetRollNo.trim()) return null;
    return students.find(
      (s) => s.rollNo.toLowerCase() === targetRollNo.trim().toLowerCase()
    );
  }, [targetRollNo, students]);

  // Filter messages
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      const matchSearch =
        m.rollNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.awardedByName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = categoryFilter === 'all' || m.category === categoryFilter;

      return matchSearch && matchCategory;
    });
  }, [messages, searchTerm, categoryFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess(false);

    if (!canAdd) {
      setFormError('Unauthorized: Only Faculty, Principal, or Super Admin can post accolades.');
      return;
    }

    if (!targetRollNo.trim()) {
      setFormError('Please enter a valid student Roll Number.');
      return;
    }

    if (!title.trim() || !customMessage.trim()) {
      setFormError('Please enter both the congratulation title and message.');
      return;
    }

    const sName = matchedStudent ? matchedStudent.name : `Student (${targetRollNo.trim()})`;

    try {
      onAddMessage({
        rollNo: targetRollNo.trim(),
        studentName: sName,
        title: title.trim(),
        message: customMessage.trim(),
        category,
        badge: badge.trim() || 'Certificate of Commendation',
        awardedByRole: currentRole as 'faculty' | 'principal' | 'superadmin',
        awardedByName: currentUser.name,
        awardedByDesignation: currentUser.designation || (currentRole === 'principal' ? 'Principal' : 'Faculty Member'),
      });

      setFormSuccess(true);
      if (submitTimerRef.current) window.clearTimeout(submitTimerRef.current);
      submitTimerRef.current = window.setTimeout(() => {
        setFormSuccess(false);
        setIsAddModalOpen(false);
        setTargetRollNo('');
        setTitle('');
        setCustomMessage('');
        setBadge('Honor Roll Recipient');
      }, 1200);
    } catch (err: any) {
      setFormError(err?.message || 'Unable to publish commendation.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shrink-0">
              <Trophy className="w-8 h-8 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                  Congratulations & Honors Dashboard
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
                  {messages.length} Accolades
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-100 mt-1">
                Institutional recognitions, awards, and commendations issued by Principal & Faculty.
              </p>
            </div>
          </div>

          {canAdd && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-amber-300 font-bold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 border border-amber-400/30"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              Post Congratulation Message
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Roll No, Student Name, or Title..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Category:</span>
          {[
            'all',
            'Academic Excellence',
            'Sports Achievement',
            'Research & Innovation',
            'Cultural',
            'Leadership',
            'Placement & Career',
            'Special Honor',
          ].map(
            (cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  categoryFilter === cat
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'all' ? 'All Accolades' : cat}
              </button>
            )
          )}
        </div>
      </div>

      {/* Congratulations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMessages.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-slate-200">
            <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-sm">No Congratulation Messages Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search criteria or post a new commendation for any student roll number.
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              className="bg-white rounded-2xl border border-amber-200/80 shadow-sm p-5 hover:shadow-md transition relative flex flex-col justify-between overflow-hidden group"
            >
              {/* Decorative top ribbon */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500" />

              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    {msg.badge}
                  </span>
                  <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {msg.date}
                  </span>
                </div>

                <h3 className="font-black text-slate-900 text-base leading-snug group-hover:text-amber-700 transition">
                  {msg.title}
                </h3>

                <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-xs uppercase font-bold text-slate-400 block">Recipient</span>
                    <strong className="text-slate-900">{msg.studentName}</strong>
                  </div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                    {msg.rollNo}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-3 leading-relaxed italic bg-amber-50/40 p-3 rounded-xl border border-amber-100/60">
                  &ldquo;{msg.message}&rdquo;
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-slate-600 font-medium">{msg.awardedByName}</span>
                </div>
                <span className="px-2 py-0.5 rounded font-mono text-xs uppercase font-bold bg-slate-100 text-slate-700">
                  {msg.awardedByRole}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* POST CONGRATULATION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-sm tracking-wide">
                  Post Congratulation to Student Roll No
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Congratulation message successfully published to student roll no!
                </div>
              )}

              {/* Student Roll No Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Student Roll Number *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={targetRollNo}
                    onChange={(e) => setTargetRollNo(e.target.value)}
                    placeholder="e.g. 2025CS001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {matchedStudent && (
                    <span className="absolute right-3 top-2 text-xs text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      ✓ {matchedStudent.name}
                    </span>
                  )}
                </div>
                {matchedStudent && (
                  <p className="text-xs text-slate-500 mt-1">
                    Course: <strong className="text-slate-700">{matchedStudent.course}</strong> • Sem {matchedStudent.semester}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="text-xs text-slate-400">Quick select:</span>
                  {activeStudents.slice(0, 4).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setTargetRollNo(s.rollNo)}
                      className="text-xs px-2 py-0.5 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 font-mono"
                    >
                      {s.rollNo} ({s.name})
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Accolade Title / Achievement Headline *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., 1st Prize in Inter-College Robotics Challenge"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Category & Badge */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Academic Excellence">Academic Excellence</option>
                    <option value="Sports Achievement">Sports Achievement</option>
                    <option value="Research & Innovation">Research & Innovation</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Leadership">Leadership</option>
                    <option value="Placement & Career">Placement & Career</option>
                    <option value="Special Honor">Special Honor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Badge Tag</label>
                  <input
                    type="text"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="e.g., Dean's Honor Roll"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Congratulatory Message / Commendation *
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  placeholder="Enter personalized words of appreciation and encouragement for this student..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Sender Details Preview */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs text-amber-900">
                Signing Authority: <strong>{currentUser.name}</strong> ({currentUser.designation || currentRole})
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  Publish Commendation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
