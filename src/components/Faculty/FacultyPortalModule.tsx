import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Faculty, TimetableSlot, InstitutionalNotice, FacultyMapping, UserAccount } from '../../types/erp';
import { getISTDateString } from '../../utils/erpLogic';
import { erpStorage } from '../../services/erpStorage';
import {
  Users,
  CalendarCheck,
  Clock,
  MapPin,
  Send,
  CheckCircle2,
  Calendar,
  Award,
  Layers,
  FileText,
  Sparkles,
  ChevronRight,
  BookmarkCheck,
  AlertCircle,
} from 'lucide-react';

type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
const WEEKDAYS: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface FacultyPortalModuleProps {
  facultyList: Faculty[];
  activeFacultyId?: string;
  setActiveFacultyId?: (id: string) => void;
  timetable: TimetableSlot[];
  facultyMappings?: FacultyMapping[];
  currentUser?: UserAccount;
  onNavigateToAttendance: (subjectCode: string) => void;
  onNavigateToGrades: (subjectCode: string) => void;
  onPostNotice: (notice: Omit<InstitutionalNotice, 'id' | 'date'>) => void;
}

export const FacultyPortalModule: React.FC<FacultyPortalModuleProps> = ({
  facultyList,
  activeFacultyId,
  timetable,
  facultyMappings = [],
  currentUser,
  onNavigateToAttendance,
  onNavigateToGrades,
  onPostNotice,
}) => {
  const currentFaculty = useMemo(() => {
    if (currentUser?.facultyId) {
      const match = facultyList.find((f) => f.facultyId === currentUser.facultyId || f.id === currentUser.facultyId);
      if (match) return match;
    }
    if (currentUser?.email) {
      const userEmail = currentUser.email.toLowerCase();
      const match = facultyList.find((f) => (f.email || '').toLowerCase() === userEmail);
      if (match) return match;
    }
    if (activeFacultyId) {
      const match = facultyList.find((f) => f.id === activeFacultyId || f.facultyId === activeFacultyId);
      if (match) return match;
    }
    return facultyList[0];
  }, [facultyList, activeFacultyId, currentUser]);

  // Current calendar day of the week anchored to IST calendar date
  const todayWeekday = useMemo<Weekday>(() => {
    const istToday = getISTDateString();
    const dayIndex = new Date(`${istToday}T00:00:00Z`).getUTCDay(); // 0 is Sunday, 1 is Monday...
    const map: Record<number, Weekday> = {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
    };
    return map[dayIndex] || 'Monday';
  }, []);

  const [selectedDay, setSelectedDay] = useState<Weekday>(todayWeekday);

  // Announcement form state
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeCategory, setNoticeCategory] = useState<'Academic' | 'Examination' | 'General'>('Academic');
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['All']);
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [noticeEndDate, setNoticeEndDate] = useState<string>(() =>
    getISTDateString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  );
  const [noticeSuccess, setNoticeSuccess] = useState(false);
  const [noticeError, setNoticeError] = useState('');
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // Faculty Leave Request State (Bugs 647, 678)
  const [leaveDate, setLeaveDate] = useState<string>(() => getISTDateString());
  const [leaveDays, setLeaveDays] = useState<number>(1);
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [leaveFeedback, setLeaveFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Available courses dynamically derived from curriculum, mappings, and timetable
  const availableCourses = useMemo(() => {
    const set = new Set<string>(['BCA', 'B.Sc. IT', 'B.Com', 'MCA', 'B.A.']);
    erpStorage.getStreamCourseSubjects().forEach((s) => {
      if (s.course) set.add(s.course);
    });
    facultyMappings.forEach((m) => {
      if (m.course) set.add(m.course);
    });
    timetable.forEach((t) => {
      if (t.course) set.add(t.course);
    });
    return ['All', ...Array.from(set)];
  }, [facultyMappings, timetable]);

  // Faculty assignments captured by Principal in Teacher Tagging
  const myTaggedMappings = useMemo(() => {
    if (!currentFaculty) return [];
    const facEmail = (currentFaculty.email || '').trim().toLowerCase();
    const facNameLower = (currentFaculty.name || '').trim().toLowerCase();
    const nameTokens = facNameLower.split(/\s+/).filter((t) => t.length >= 4 && !['prof.', 'prof', 'dr.', 'smt.', 'shri'].includes(t));
    const surnameToken = nameTokens.length > 0 ? nameTokens[nameTokens.length - 1] : '';

    return facultyMappings.filter((m) => {
      if (m.facultyId === currentFaculty.id || (currentFaculty.facultyId && m.facultyId === currentFaculty.facultyId)) {
        return true;
      }
      if (facEmail && (m.facultyEmail || '').trim().toLowerCase() === facEmail) {
        return true;
      }
      const mName = (m.facultyName || '').trim().toLowerCase();
      if (facNameLower && mName === facNameLower) return true;
      if (!m.facultyId && surnameToken && mName.includes(surnameToken)) return true;
      return false;
    });
  }, [facultyMappings, currentFaculty]);

  // Classes for the selected day, synchronized strictly with Teacher Tagging and Timetable
  const facultyClasses = useMemo(() => {
    if (!currentFaculty) return [];
    const facEmail = (currentFaculty.email || '').trim().toLowerCase();
    const emailUser = facEmail.includes('@') ? facEmail.split('@')[0] : '';
    const facNameLower = (currentFaculty.name || '').trim().toLowerCase();
    const nameTokens = facNameLower.split(/\s+/).filter((t) => t.length >= 4 && !['prof.', 'prof', 'dr.', 'smt.', 'shri'].includes(t));
    const surnameToken = nameTokens.length > 0 ? nameTokens[nameTokens.length - 1] : '';

    const matchedSlots = timetable.filter((slot) => {
      const sName = (slot.facultyName || '').trim().toLowerCase();
      const matchesFaculty =
        slot.facultyId === currentFaculty.id ||
        (currentFaculty.facultyId && slot.facultyId === currentFaculty.facultyId) ||
        (facNameLower && sName === facNameLower) ||
        (!slot.facultyId && surnameToken && sName.includes(surnameToken)) ||
        (!slot.facultyId && emailUser.length >= 4 && sName.includes(emailUser));

      return matchesFaculty && slot.dayOfWeek === selectedDay;
    });

    if (matchedSlots.length > 0) return matchedSlots;

    if (myTaggedMappings.length > 0 && selectedDay !== 'Saturday') {
      return myTaggedMappings.map((m) => ({
        id: `MAPPED-SLOT-${m.id}-${selectedDay}`,
        dayOfWeek: selectedDay,
        course: m.course,
        semester: m.semester,
        section: m.section || 'A',
        subjectCode: m.subjectCode,
        subjectName: m.subjectName,
        facultyId: currentFaculty.id,
        facultyName: currentFaculty.name,
        roomNo: m.roomNo || 'Room 302',
      }));
    }

    return [];
  }, [timetable, currentFaculty, selectedDay, myTaggedMappings]);

  if (!currentFaculty) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
        <Users className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="text-sm font-bold text-slate-800">No Faculty Profile Linked</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          No faculty roster record matched your account. Please ask the Super Admin or Principal to onboard your faculty profile.
        </p>
      </div>
    );
  }

  const handlePublishNotice = (e: React.FormEvent) => {
    e.preventDefault();
    setNoticeError('');
    setNoticeSuccess(false);

    if (!noticeTitle.trim() || !noticeContent.trim()) {
      setNoticeError('Please enter both notice subject and message content.');
      return;
    }
    if (selectedCourses.length === 0) {
      setNoticeError('Please select at least one target course (or "All").');
      return;
    }
    if (selectedSemesters.length === 0) {
      setNoticeError('Please select at least one target semester.');
      return;
    }
    const todayIst = getISTDateString();
    if (noticeEndDate && noticeEndDate < todayIst) {
      setNoticeError(`Notification end date (${noticeEndDate}) cannot be earlier than today (${todayIst}).`);
      return;
    }

    try {
      onPostNotice({
        title: noticeTitle.trim(),
        category: noticeCategory,
        content: noticeContent.trim(),
        authorName: currentFaculty.name,
        authorRole: currentFaculty.designation,
        isPinned: false,
        targetCourses: selectedCourses,
        targetSemesters: selectedSemesters,
        endDate: noticeEndDate || undefined,
      });

      setNoticeTitle('');
      setNoticeContent('');
      setNoticeSuccess(true);
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setNoticeSuccess(false), 3000);
    } catch (err: any) {
      setNoticeError(err?.message || 'Unable to publish notice.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Faculty Profile Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <img
              src={currentFaculty.avatarUrl}
              alt={currentFaculty.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400/80 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold">{currentFaculty.name}</h2>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {currentFaculty.facultyId}
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5 font-medium">
                {currentFaculty.designation} • Dept. of {currentFaculty.department}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {currentFaculty.email} • {currentFaculty.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 block text-xs uppercase font-semibold">Assigned Courses</span>
              <strong className="text-amber-400 text-base">
                {myTaggedMappings.length > 0 ? myTaggedMappings.length : currentFaculty.assignedSubjects.length} Courses
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Teaching Schedule (Linked with Teacher Tagging) + Broadcast Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Schedule & Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Teaching Schedule Card - Linked with Principal Teacher Tagging */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <CalendarCheck className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-base">Teaching Class Schedule</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synchronized in real-time with courses assigned by the Principal through Teacher Tagging.
                </p>
              </div>

              {/* Day Selector Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
                {WEEKDAYS.map((day) => {
                  const isToday = day === todayWeekday;
                  const isSelected = day === selectedDay;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap text-xs font-bold ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      {day.slice(0, 3)} {isToday ? '★' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timetable slots */}
            <div className="space-y-3">
              {facultyClasses.length === 0 ? (
                <div className="p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                  <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="font-bold text-slate-800 text-sm">No Class Scheduled on {selectedDay}</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No lecture period is mapped for {currentFaculty.name} on this day under Teacher Tagging allocations. Select another weekday above to view other days.
                  </p>
                </div>
              ) : (
                facultyClasses.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-indigo-50/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                          {slot.subjectCode}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {slot.roomNo}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">{slot.subjectName}</h4>
                      <p className="text-xs text-slate-500">
                        {slot.course} • Sem {slot.semester} {slot.section ? `(Section ${slot.section})` : '(Open Cohort)'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onNavigateToAttendance(slot.subjectCode)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <CalendarCheck className="w-3.5 h-3.5" />
                        Take Roll Call
                      </button>
                      <button
                        onClick={() => onNavigateToGrades(slot.subjectCode)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        Grades
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Broadcast Notice & Leave Request */}
        <div className="space-y-6">
          {/* Post Class Notice */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-3">
              <Send className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-sm">Broadcast Notice to Students</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Publish assignment deadlines, quiz alerts, or lab reschedule notices directly to student dashboards.
            </p>

            {noticeError && (
              <div className="mb-3 p-2.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{noticeError}</span>
              </div>
            )}

            {noticeSuccess && (
              <div className="mb-3 p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Notice posted to college bulletin!</span>
              </div>
            )}

            <form onSubmit={handlePublishNotice} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notice Category</label>
                <select
                  value={noticeCategory}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setNoticeCategory(e.target.value as 'Academic' | 'Examination' | 'General')
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50"
                >
                  <option value="Academic">Academic / Lecture</option>
                  <option value="Examination">Quiz / Mid-Term</option>
                  <option value="General">General Notice</option>
                </select>
              </div>

              {/* Target Courses Multi-Select */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Courses (Multi-Select)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {availableCourses.map((crs) => {
                    const isChecked = selectedCourses.includes(crs);
                    return (
                      <button
                        type="button"
                        key={crs}
                        onClick={() => {
                          if (crs === 'All') {
                            setSelectedCourses(['All']);
                          } else {
                            const withoutAll = selectedCourses.filter((c) => c !== 'All');
                            if (isChecked) {
                              const rem = withoutAll.filter((c) => c !== crs);
                              setSelectedCourses(rem);
                            } else {
                              setSelectedCourses([...withoutAll, crs]);
                            }
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          isChecked
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {crs}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Semesters Multi-Select */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Semesters (Multi-Select)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {[1, 2, 3, 4, 5, 6].map((sem) => {
                    const isChecked = selectedSemesters.includes(sem);
                    return (
                      <button
                        type="button"
                        key={sem}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedSemesters(selectedSemesters.filter((s) => s !== sem));
                          } else {
                            setSelectedSemesters([...selectedSemesters, sem]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          isChecked
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Sem {sem}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* End Date */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notification End Date
                </label>
                <input
                  type="date"
                  value={noticeEndDate}
                  onChange={(e) => setNoticeEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 font-mono text-xs"
                />
                <span className="text-xs text-slate-400 block mt-0.5">
                  Selected course students will have access for 1 month from date of issue, after which it will be archived.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject / Header</label>
                <input
                  type="text"
                  placeholder="e.g. Lab 3 Viva Schedule and Assignment 2 Submission"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message Content</label>
                <textarea
                  rows={3}
                  placeholder="Write message for students..."
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:bg-white"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Broadcast Notice
              </button>
            </form>
          </div>

          {/* Statutory Leave Request & Invigilation Check Card (Bugs 647, 678) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Faculty Leave Application
              </h3>
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-bold text-xs border border-indigo-200">
                Balance: {currentFaculty.leavesRemaining ?? 12} Days
              </span>
            </div>

            {leaveFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs font-semibold ${
                  leaveFeedback.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {leaveFeedback.text}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Read current leave metrics from dynamic state without stale closure capture (Bug 3)
                const activeFacultyRecord = facultyList.find((f) => f.id === currentFaculty?.id || f.facultyId === currentFaculty?.facultyId) || currentFaculty;
                const remaining = activeFacultyRecord?.leavesRemaining ?? 12;
                if (leaveDays <= 0 || leaveDays > remaining) {
                  setLeaveFeedback({
                    type: 'err',
                    text: `Leave Blocked: Requested ${leaveDays} day(s) exceeds your remaining statutory balance of ${remaining} day(s).`,
                  });
                  return;
                }
                const dayIdx = new Date(leaveDate + 'T00:00:00').getDay();
                if (dayIdx === 0) {
                  setLeaveFeedback({
                    type: 'err',
                    text: 'Leave Blocked: Selected start date falls on a Sunday institutional holiday.',
                  });
                  return;
                }
                setLeaveFeedback({
                  type: 'ok',
                  text: `Leave request for ${leaveDays} day(s) starting ${leaveDate} submitted to Principal after invigilation roster check.`,
                });
                setLeaveReason('');
              }}
              className="space-y-2.5"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 font-mono text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Days</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={leaveDays}
                    onChange={(e) => setLeaveDays(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 font-mono font-bold text-xs"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason & Substitute Arrangement</label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. University Senate Duty (Substitute: Prof. Sen)"
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition"
              >
                Submit Leave Application
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
