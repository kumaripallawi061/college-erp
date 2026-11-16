import React, { useState, useEffect, useRef } from 'react';
import { InstitutionalNotice } from '../../types/erp';
import { getISTDateString } from '../../utils/erpLogic';
import {
  Megaphone,
  X,
  Users,
  GraduationCap,
  Briefcase,
  CheckCircle2,
  Calendar,
  Send,
  Pin,
  Clock,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface NoticeBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorName: string;
  authorRole: string;
  availableCourses?: string[];
  onPostNotice: (notice: Omit<InstitutionalNotice, 'id' | 'date'>) => void;
  defaultCategory?: 'Academic' | 'Examination' | 'Fees' | 'Attendance' | 'General';
}

export const NoticeBroadcastModal: React.FC<NoticeBroadcastModalProps> = ({
  isOpen,
  onClose,
  authorName,
  authorRole,
  availableCourses = [
    'B.Tech Computer Science & Engineering',
    'BCA (Bachelor of Computer Applications)',
    'B.Sc. Information Technology',
    'Bachelor of Business Administration (BBA)',
    'B.Com (Honours)',
  ],
  onPostNotice,
  defaultCategory = 'General',
}) => {
  const [targetAudience, setTargetAudience] = useState<'all' | 'students' | 'staff'>('all');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'Academic' | 'Examination' | 'Fees' | 'Attendance' | 'General'>(
    defaultCategory
  );
  const [isPinned, setIsPinned] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(availableCourses);
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8]);
  const [endDate, setEndDate] = useState<string>(() =>
    getISTDateString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  );
  const [successMsg, setSuccessMsg] = useState(false);
  const [formError, setFormError] = useState('');
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCategory(defaultCategory);
      setSelectedCourses(availableCourses);
      setSelectedSemesters([1, 2, 3, 4, 5, 6, 7, 8]);
      setEndDate(getISTDateString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
      setFormError('');
      setSuccessMsg(false);
    }
  }, [isOpen, availableCourses, defaultCategory]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!title.trim() || !content.trim()) {
      setFormError('Please provide both a notice headline and content.');
      return;
    }

    if (targetAudience !== 'staff') {
      if (selectedCourses.length === 0) {
        setFormError('Please select at least one target course.');
        return;
      }
      if (selectedSemesters.length === 0) {
        setFormError('Please select at least one target semester.');
        return;
      }
    }

    const todayIst = getISTDateString();
    if (endDate && endDate < todayIst) {
      setFormError(`Expiry date (${endDate}) cannot be earlier than today (${todayIst}).`);
      return;
    }

    try {
      onPostNotice({
        title: title.trim(),
        category,
        content: content.trim(),
        authorName,
        authorRole,
        isPinned,
        targetAudience,
        targetCourses: targetAudience === 'staff' ? [] : selectedCourses,
        targetSemesters: targetAudience === 'staff' ? [] : selectedSemesters,
        endDate: endDate || undefined,
      });

      setSuccessMsg(true);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => {
        setSuccessMsg(false);
        onClose();
        setTitle('');
        setContent('');
      }, 1500);
    } catch (err: any) {
      setFormError(err?.message || 'Unable to publish circular.');
    }
  };

  const toggleCourse = (course: string) => {
    if (selectedCourses.includes(course)) {
      setSelectedCourses(selectedCourses.filter((c) => c !== course));
    } else {
      setSelectedCourses([...selectedCourses, course]);
    }
  };

  const toggleSemester = (sem: number) => {
    if (selectedSemesters.includes(sem)) {
      setSelectedSemesters(selectedSemesters.filter((s) => s !== sem));
    } else {
      setSelectedSemesters([...selectedSemesters, sem]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/30 rounded-xl border border-indigo-400/30">
              <Megaphone className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Broadcast Institutional Notice</h3>
              <p className="text-xs text-slate-300">
                Issued by <strong className="text-amber-300">{authorName}</strong> ({authorRole})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl flex items-center gap-2 font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Official notice has been broadcasted successfully to {targetAudience === 'all' ? 'everyone' : targetAudience}!</span>
            </div>
          )}

          {/* Target Audience Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              1. Target Recipient Audience <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetAudience('all')}
                className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 border text-xs cursor-pointer ${
                  targetAudience === 'all'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Everyone (All)</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetAudience('students')}
                className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 border text-xs cursor-pointer ${
                  targetAudience === 'students'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Students Only</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetAudience('staff')}
                className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 border text-xs cursor-pointer ${
                  targetAudience === 'staff'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Staff & Faculty</span>
              </button>
            </div>
          </div>

          {/* Conditional Course / Semester Multi-Select (when students or all is selected) */}
          {targetAudience !== 'staff' && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Target Academic Courses</label>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCourses(
                        selectedCourses.length === availableCourses.length ? [] : [...availableCourses]
                      )
                    }
                    className="text-xs text-indigo-600 font-bold hover:underline"
                  >
                    {selectedCourses.length === availableCourses.length ? 'Deselect All' : 'Select All Courses'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableCourses.map((c) => {
                    const isSelected = selectedCourses.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCourse(c)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                          isSelected
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {c.split(' ')[0]} {c.includes('(') ? `(${c.split('(')[1]}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Target Semesters</label>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSemesters(
                        selectedSemesters.length === 8 ? [] : [1, 2, 3, 4, 5, 6, 7, 8]
                      )
                    }
                    className="text-xs text-indigo-600 font-bold hover:underline"
                  >
                    {selectedSemesters.length === 8 ? 'Deselect All' : 'Select All Semesters'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
                    const isSelected = selectedSemesters.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSemester(s)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Category & Pin Option */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Notice Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="General">General Institutional Circular</option>
                <option value="Fees">Fees, Payments & Concessions</option>
                <option value="Academic">Academic Schedule & Lectures</option>
                <option value="Examination">Examination & Marksheets</option>
                <option value="Attendance">Attendance & Hall Tickets</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expiry / Archive Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notice Subject / Headline <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Schedule of Term-End Clearance, Examination Fee Payment & Staff Meetings"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notice Content & Directives <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter official directives, schedules, requirements, or meeting agendas..."
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
              required
            />
          </div>

          {/* Pin toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="pinNotice"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="pinNotice" className="text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer">
              <Pin className="w-3.5 h-3.5 text-amber-500" />
              Pin this circular to top of Institutional Noticeboard
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700 hover:bg-slate-50 text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Publish Circular
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
