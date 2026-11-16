import React, { useState, useMemo, useId, useRef, useEffect } from 'react';
import { StreamCourseSubject, UserAccount } from '../../types/erp';
import { generateSecureId, hasCircularPrerequisite } from '../../utils/erpLogic';
import {
  Layers,
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Award,
  Sparkles,
  X,
} from 'lucide-react';

interface StreamCourseMappingModuleProps {
  streamCourseSubjects: StreamCourseSubject[];
  onSaveStreamCourseSubjects: (updated: StreamCourseSubject[]) => void;
  currentUser: UserAccount;
}

export const StreamCourseMappingModule: React.FC<StreamCourseMappingModuleProps> = ({
  streamCourseSubjects,
  onSaveStreamCourseSubjects,
  currentUser,
}) => {
  const [selectedStream, setSelectedStream] = useState<string>('ALL');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const courseDatalistId = useId();

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StreamCourseSubject | null>(null);
  const [confirmUnmapId, setConfirmUnmapId] = useState<string | null>(null);

  // Form Fields
  const [streamCode, setStreamCode] = useState('CSE');
  const [streamName, setStreamName] = useState('Computer Science & Engineering');
  const [course, setCourse] = useState('B.Tech Computer Science & Engineering');
  const [semester, setSemester] = useState<number>(5);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [credits, setCredits] = useState<string>('4');
  const [category, setCategory] = useState<'Core' | 'Elective' | 'Lab' | 'Project' | 'Seminar' | 'Extracurricular'>('Core');
  const [prerequisiteCode, setPrerequisiteCode] = useState<string>('');
  const [isNonCgpa, setIsNonCgpa] = useState<boolean>(false);

  // Status & modal validation messages
  const [statusMessage, setStatusMessage] = useState('');
  const [formError, setFormError] = useState('');
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    };
  }, []);

  const showStatusNotice = (msg: string, duration = 4000) => {
    setStatusMessage(msg);
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatusMessage(''), duration);
  };

  // Extracted unique streams from subjects or defaults
  const availableStreams = useMemo(() => {
    const map = new Map<string, string>();
    map.set('CSE', 'Computer Science & Engineering');
    map.set('ECE', 'Electronics & Communication Engineering');
    map.set('ME', 'Mechanical Engineering');
    map.set('PHY', 'Department of Physics');
    map.set('BCOM', 'Department of Commerce & Accounts');

    streamCourseSubjects.forEach((s) => {
      if (!map.has(s.streamCode)) {
        map.set(s.streamCode, s.streamName || s.streamCode);
      }
    });

    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [streamCourseSubjects]);

  // Unique course names for interactive datalist (trimmed and normalized to prevent duplicate keys)
  const uniqueCourses = useMemo(() => {
    const list = streamCourseSubjects
      .map((s) => (s.course || '').trim())
      .filter(Boolean);
    const defaults = [
      'B.Tech Computer Science & Engineering',
      'B.Tech Electronics & Communication',
      'BCA (Bachelor of Computer Applications)',
      'B.Sc. Information Technology',
      'B.Sc Physics Hons',
      'B.Com Hons (Accounting & Finance)',
      'B.A. Political Science Hons',
    ];
    return Array.from(new Set([...list, ...defaults]));
  }, [streamCourseSubjects]);

  // Filtered Subject List
  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return streamCourseSubjects.filter((item) => {
      const matchStream = selectedStream === 'ALL' || item.streamCode === selectedStream;
      const matchSem = selectedSemester === 'ALL' || item.semester === Number(selectedSemester);
      const matchSearch =
        q === '' ||
        (item.subjectCode || '').toLowerCase().includes(q) ||
        (item.subjectName || '').toLowerCase().includes(q) ||
        (item.streamName || '').toLowerCase().includes(q);
      return matchStream && matchSem && matchSearch;
    });
  }, [streamCourseSubjects, selectedStream, selectedSemester, searchQuery]);

  const resetFormState = () => {
    setEditingItem(null);
    setFormError('');
    setConfirmUnmapId(null);
    const defaultStream = selectedStream !== 'ALL' ? selectedStream : 'CSE';
    setStreamCode(defaultStream);
    const matchedStream = availableStreams.find((s) => s.code === defaultStream);
    setStreamName(matchedStream?.name || 'Computer Science & Engineering');
    setCourse('B.Tech Computer Science & Engineering');
    setSemester(selectedSemester !== 'ALL' ? Number(selectedSemester) : 5);
    setSubjectCode('');
    setSubjectName('');
    setCredits('4');
    setCategory('Core');
    setPrerequisiteCode('');
    setIsNonCgpa(false);
  };

  const handleOpenAddModal = () => {
    resetFormState();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetFormState();
  };

  const handleOpenEditModal = (item: StreamCourseSubject) => {
    setEditingItem(item);
    setFormError('');
    setConfirmUnmapId(null);
    setStreamCode(item.streamCode);
    setStreamName(item.streamName);
    setCourse(item.course);
    setSemester(item.semester);
    setSubjectCode(item.subjectCode);
    setSubjectName(item.subjectName);
    setCredits(String(item.credits ?? 3));
    setCategory(item.category || 'Core');
    setPrerequisiteCode(item.prerequisiteCode || '');
    setIsNonCgpa(Boolean(item.isNonCgpa));
    setIsModalOpen(true);
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!subjectCode.trim() || !subjectName.trim()) {
      const msg = 'Subject code and title are required.';
      setFormError(msg);
      showStatusNotice(msg);
      return;
    }

    const cleanCode = subjectCode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,20}$/i.test(cleanCode)) {
      const msg = 'Invalid Subject Code: Only alphanumeric characters, hyphens, and underscores are allowed (e.g. CS-501, BCA_201).';
      setFormError(msg);
      showStatusNotice(msg);
      return;
    }

    const parsedSem = Math.round(Number(semester));
    if (isNaN(parsedSem) || parsedSem < 1 || parsedSem > 10) {
      const msg = 'Invalid semester curriculum: Semester must be between 1 and 10.';
      setFormError(msg);
      showStatusNotice(msg);
      return;
    }

    const cleanCourse = course.trim().toLowerCase().replace(/\s+/g, ' ');
    const cleanStream = streamCode.trim().toUpperCase();
    const hasDuplicateSubjectCode = streamCourseSubjects.some(
      (s) =>
        s.id !== editingItem?.id &&
        (s.subjectCode || '').trim().toUpperCase() === cleanCode &&
        (s.course || '').trim().toLowerCase().replace(/\s+/g, ' ') === cleanCourse &&
        (s.streamCode || '').trim().toUpperCase() === cleanStream &&
        Number(s.semester) === parsedSem
    );
    if (hasDuplicateSubjectCode) {
      const msg = `Duplicate Subject Code: "${cleanCode}" is already mapped to ${course.trim()} (${streamCode.trim().toUpperCase()} Semester ${parsedSem}).`;
      setFormError(msg);
      showStatusNotice(msg);
      return;
    }

    // Strict validation error requiring explicit credit input (preventing empty string fallback to 3 - Bug 1)
    const rawCreditsStr = credits !== undefined && credits !== null ? String(credits).trim() : '';
    if (rawCreditsStr === '') {
      const msg = 'Credits field cannot be empty. Please enter a valid CBCS credit value between 0 (audit) and 10.';
      setFormError(msg);
      showStatusNotice(msg);
      return;
    }
    const parsedCredits = Number(rawCreditsStr);
    if (Number.isNaN(parsedCredits) || parsedCredits < 0 || parsedCredits > 10) {
      const msg = 'Invalid CBCS credit weightage: Enter a numeric value between 0 (audit course) and 10.';
      setFormError(msg);
      showStatusNotice(msg);
      return;
    }
    const resolvedCredits = Math.round(parsedCredits * 10) / 10;

    const cleanPrereq = prerequisiteCode.trim().toUpperCase() || undefined;
    if (cleanPrereq) {
      if (cleanPrereq === cleanCode) {
        const msg = 'Invalid Prerequisite: A subject cannot list itself as its own prerequisite.';
        setFormError(msg);
        showStatusNotice(msg);
        return;
      }

      // Circular prerequisite cycle detection against candidate curriculum list (excluding original item when editing)
      const candidateList = editingItem
        ? streamCourseSubjects.map((s) =>
            s.id === editingItem.id
              ? {
                  ...s,
                  streamCode: cleanStream,
                  streamName: streamName.trim(),
                  course: course.trim(),
                  semester: parsedSem,
                  subjectCode: cleanCode,
                  subjectName: subjectName.trim(),
                  prerequisiteCode: cleanPrereq,
                }
              : s
          )
        : streamCourseSubjects;
      const hasCycle = hasCircularPrerequisite(course.trim(), cleanCode, cleanPrereq, candidateList);
      if (hasCycle) {
        const msg = `Circular Prerequisite Violation: Setting "${cleanPrereq}" as prerequisite for "${cleanCode}" creates a circular prerequisite dependency loop.`;
        setFormError(msg);
        showStatusNotice(msg);
        return;
      }
    }

    // Non-CGPA and Extracurricular category credit rules (Audit Item 20)
    if (category === 'Extracurricular' && (!isNonCgpa || resolvedCredits > 0)) {
      const msg = 'Statutory CBCS Rule: Extracurricular and Audit subjects must be designated as Non-CGPA with 0 credits.';
      setFormError(msg);
      showStatusNotice(msg);
      return;
    }

    if (editingItem) {
      const updated = streamCourseSubjects.map((s) =>
        s.id === editingItem.id
          ? {
              ...s,
              streamCode: streamCode.trim().toUpperCase(),
              streamName: streamName.trim(),
              course: course.trim(),
              semester: parsedSem,
              subjectCode: subjectCode.trim().toUpperCase(),
              subjectName: subjectName.trim(),
              credits: isNonCgpa ? 0 : resolvedCredits,
              category,
              prerequisiteCode: cleanPrereq,
              isNonCgpa,
            }
          : s
      );
      onSaveStreamCourseSubjects(updated);
      showStatusNotice(`Subject ${subjectCode.trim().toUpperCase()} updated successfully.`);
    } else {
      const newItem: StreamCourseSubject = {
        id: generateSecureId('SCS'),
        streamCode: streamCode.trim().toUpperCase(),
        streamName: streamName.trim(),
        course: course.trim(),
        semester: parsedSem,
        subjectCode: subjectCode.trim().toUpperCase(),
        subjectName: subjectName.trim(),
        credits: isNonCgpa ? 0 : resolvedCredits,
        category,
        prerequisiteCode: cleanPrereq,
        isNonCgpa,
      };
      onSaveStreamCourseSubjects([...streamCourseSubjects, newItem]);
      showStatusNotice(`Subject ${newItem.subjectCode} mapped to ${newItem.streamCode} Semester ${newItem.semester}.`);
    }

    handleCloseModal();
  };

  const handleDeleteSubject = (id: string, code: string) => {
    const updated = streamCourseSubjects.filter((s) => s.id !== id);
    onSaveStreamCourseSubjects(updated);
    setConfirmUnmapId(null);
    showStatusNotice(
      `Subject ${code} unmapped from active curriculum. Historical snapshots on student transcripts are preserved.`
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
                <Layers className="w-6 h-6" />
              </span>
              <span className="text-xs uppercase font-mono tracking-widest text-indigo-300 font-bold">
                Accountant Academic Master
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Course & Stream Subject Mapping
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Introduce streams, map academic degree courses and subjects, and configure statutory credit weightages.
              Official marksheets dynamically inherit these course codes, titles, and credits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md hover:shadow-lg shrink-0"
            >
              <Plus className="w-4 h-4" />
              Map New Subject / Stream
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* KPI Metric Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs uppercase font-bold text-slate-400 block font-mono">Academic Streams</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{availableStreams.length}</span>
          <span className="text-xs text-slate-500 mt-0.5 block">Configured Departments</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs uppercase font-bold text-slate-400 block font-mono">Mapped Subjects</span>
          <span className="text-2xl font-black text-indigo-600 mt-1 block">{streamCourseSubjects.length}</span>
          <span className="text-xs text-slate-500 mt-0.5 block">Across all semesters</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs uppercase font-bold text-slate-400 block font-mono">Active Filter Results</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">{filteredSubjects.length}</span>
          <span className="text-xs text-slate-500 mt-0.5 block">Matching criteria</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs uppercase font-bold text-slate-400 block font-mono">Total Filtered Credits</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">
            {Math.round(filteredSubjects.reduce((sum, s) => sum + (Number(s.credits) || 0), 0) * 10) / 10}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">CBCS Credit Hours</span>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Stream Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="font-semibold text-slate-600 text-xs">Stream:</span>
            <select
              aria-label="Filter subjects by stream"
              value={selectedStream}
              onChange={(e) => {
                setSelectedStream(e.target.value);
                setSearchQuery('');
              }}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Streams</option>
              {availableStreams.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="font-semibold text-slate-600 text-xs">Semester:</span>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search code, title, stream..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Mapped Subjects Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Course / Degree</th>
                <th className="px-5 py-3.5">Semester</th>
                <th className="px-5 py-3.5">Subject Code & Title</th>
                <th className="px-5 py-3.5">Stream / Dept</th>
                <th className="px-5 py-3.5 text-center">Category</th>
                <th className="px-5 py-3.5 text-center">CBCS Credits</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No subjects found matching your filter criteria. Click &ldquo;Map New Subject / Stream&rdquo; to add.
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 font-bold text-slate-900 max-w-[200px] truncate" title={sub.course}>
                      {sub.course}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/80">
                        Semester {sub.semester}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-[240px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-indigo-950">{sub.subjectCode}</span>
                        {sub.prerequisiteCode && (
                          <span className="text-xs font-mono bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                            Prereq: {sub.prerequisiteCode}
                          </span>
                        )}
                        {sub.isNonCgpa && (
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-300">
                            Non-CGPA
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-slate-800 block truncate" title={sub.subjectName}>{sub.subjectName}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 max-w-[180px]">
                      <span className="font-mono text-xs font-semibold">{sub.streamCode}</span>
                      <span className="text-xs text-slate-400 block truncate" title={sub.streamName}>{sub.streamName}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold uppercase font-mono ${
                          sub.category === 'Lab'
                            ? 'bg-amber-100 text-amber-800'
                            : sub.category === 'Elective'
                            ? 'bg-purple-100 text-purple-800'
                            : sub.category === 'Project'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sub.category === 'Seminar'
                            ? 'bg-cyan-100 text-cyan-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {sub.category || 'Core'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-black text-slate-900 font-mono text-sm">
                      {sub.credits}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEditModal(sub)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5 inline mr-1" />
                        Edit
                      </button>
                      {confirmUnmapId === sub.id ? (
                        <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                          <span className="text-xs font-bold text-rose-800">Unmap?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubject(sub.id, sub.subjectCode)}
                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmUnmapId(null)}
                            className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 transition"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmUnmapId(sub.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                          Unmap
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Map / Modify Course Subject */}
      {isModalOpen && (
        <div role="dialog" aria-modal="true" aria-label="Course Subject Mapping Dialog" className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-in zoom-in-95 my-6">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm">
                  {editingItem ? 'Modify Mapped Subject' : 'Introduce & Map New Course Subject'}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                title="Close modal"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition font-bold p-1.5 rounded-lg hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold">
                  {formError}
                </div>
              )}
              {/* 1. COURSE FIRST */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  1. Degree Course *
                </label>
                <input
                  type="text"
                  required
                  list={courseDatalistId}
                  placeholder="e.g. B.Tech Computer Science & Engineering, BCA, B.Sc. IT"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                />
                <datalist id={courseDatalistId}>
                  {uniqueCourses.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* 2. SEMESTER SECOND */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    2. Semester / Year (1 - 10) *
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stream Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSE, ECE, ME"
                    value={streamCode}
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase();
                      setStreamCode(code);
                      const matched = availableStreams.find((s) => s.code === code);
                      if (matched) {
                        setStreamName(matched.name);
                      } else if (availableStreams.some((s) => s.name === streamName)) {
                        setStreamName('');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* 3. SUBJECT THIRD */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Stream / Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science & Engineering"
                  value={streamName}
                  onChange={(e) => setStreamName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subject Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS501"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Credits (0 for Audit, 0–10) *</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    placeholder="3"
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject / Paper Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design & Analysis of Algorithms"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subject Category</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const nextCat = e.target.value as typeof category;
                      setCategory(nextCat);
                      if (nextCat === 'Extracurricular') {
                        setIsNonCgpa(true);
                        setCredits('0');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Core">Core Theory Paper</option>
                    <option value="Lab">Laboratory / Practical</option>
                    <option value="Elective">Departmental Elective</option>
                    <option value="Project">Project / Dissertation</option>
                    <option value="Seminar">Seminar / Viva Voce</option>
                    <option value="Extracurricular">Extracurricular / NSS / NCC (Audit)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prerequisite Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. CS101"
                    value={prerequisiteCode}
                    onChange={(e) => setPrerequisiteCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="nonCgpaCheckbox"
                  checked={isNonCgpa}
                  disabled={category === 'Extracurricular'}
                  onChange={(e) => {
                    if (category === 'Extracurricular') {
                      setIsNonCgpa(true);
                      setCredits('0');
                      return;
                    }
                    setIsNonCgpa(e.target.checked);
                    if (e.target.checked) {
                      setCredits('0');
                    } else if (credits === '0') {
                      setCredits('4');
                    }
                  }}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                <label htmlFor="nonCgpaCheckbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Satisfactory / Audit Course (Non-CGPA bearing — excluded from SGPA/CGPA denominator)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl font-bold text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow"
                >
                  {editingItem ? 'Save Changes' : 'Map Subject to Stream'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
