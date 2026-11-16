import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FacultyMapping, Faculty, StreamCourseSubject, TimetableSlot } from '../../types/erp';
import { erpStorage } from '../../services/erpStorage';
import { generateSecureId, checkTimetableClashes, getISTDateString } from '../../utils/erpLogic';
import {
  Users,
  BookOpen,
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Search,
  ArrowRight,
  Eye,
  Sparkles,
  X,
  ChevronRight,
  Layers,
  CalendarDays,
  GraduationCap,
} from 'lucide-react';

export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

const WEEKDAYS: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface DaySubjectItem {
  id: string;
  course: string;
  semester: number;
  subjectName: string;
}

interface TeacherMappingViewProps {
  mappings: FacultyMapping[];
  facultyList: Faculty[];
  onSaveMappings: (updated: FacultyMapping[]) => void;
  canEdit: boolean; // Principal & Superadmin
  streamCourseSubjects?: StreamCourseSubject[];
  timetable?: TimetableSlot[];
  onSaveTimetable?: (updated: TimetableSlot[]) => void;
  onSaveFaculty?: (updated: Faculty[]) => void;
}

export const TeacherMappingView: React.FC<TeacherMappingViewProps> = ({
  mappings,
  facultyList,
  onSaveMappings,
  canEdit,
  streamCourseSubjects = [],
  timetable = [],
  onSaveTimetable,
  onSaveFaculty,
}) => {
  // Modal / Studio State
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const bannerTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const showBanner = (msg: string, duration = 5000) => {
    setSuccessBanner(msg);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setSuccessBanner(''), duration);
  };

  // Re-assignment modal state (historical transfer)
  const [reassignMappingId, setReassignMappingId] = useState<string | null>(null);
  const [newFacultyId, setNewFacultyId] = useState<string>('');
  const [reassignError, setReassignError] = useState<string>('');

  // -------------------------------------------------------------
  // STUDIO WORKFLOW STATES
  // -------------------------------------------------------------
  // 1. Chosen faculty member
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>(facultyList[0]?.id || '');
  // Option: Schedule Mode ('merge' = update/merge existing, 'replace' = overwrite existing schedule)
  const [scheduleMode, setScheduleMode] = useState<'merge' | 'replace'>('merge');

  // 2. Selected Active Tab Day in Builder
  const [activeDay, setActiveDay] = useState<Weekday>('Monday');

  // Day-wise allocations: map of Day -> DaySubjectItem[]
  const [dayAllocations, setDayAllocations] = useState<Record<Weekday, DaySubjectItem[]>>({
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
  });

  // Preview tab toggle inside studio
  const [studioActiveStep, setStudioActiveStep] = useState<'build' | 'preview'>('build');
  const [studioError, setStudioError] = useState<string>('');

  // Get current selected faculty object
  const currentSelectedFaculty = useMemo(() => {
    return facultyList.find((f) => f.id === selectedFacultyId) || facultyList[0];
  }, [facultyList, selectedFacultyId]);

  // Available unique course names from streamCourseSubjects (with robust fallbacks)
  const availableCourses = useMemo(() => {
    const fromStreams = streamCourseSubjects.map((s) => s.course).filter(Boolean);
    const unique = Array.from(new Set(fromStreams));
    if (unique.length > 0) return unique;
    return [
      'B.Tech Computer Science & Engineering',
      'BCA (Bachelor of Computer Applications)',
      'B.Sc. Information Technology',
      'Bachelor of Business Administration (BBA)',
      'B.Com (Honours)',
    ];
  }, [streamCourseSubjects]);

  // Open the studio and initialize existing allocations for the selected faculty
  const handleOpenStudio = () => {
    if (!canEdit) return;
    const facId = facultyList[0]?.id || '';
    setSelectedFacultyId(facId);
    initAllocationsForFaculty(facId);
    setStudioActiveStep('build');
    setStudioError('');
    setIsStudioOpen(true);
  };

  // Populate day-wise allocations from existing timetable or mappings for faculty
  const initAllocationsForFaculty = (facId: string) => {
    const fac = facultyList.find((f) => f.id === facId);
    const facSlots = timetable.filter(
      (slot) =>
        slot.facultyId === facId ||
        (fac && slot.facultyName && slot.facultyName.trim().toLowerCase() === fac.name.trim().toLowerCase())
    );

    const initial: Record<Weekday, DaySubjectItem[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
    };

    if (facSlots.length > 0) {
      facSlots.forEach((slot) => {
        if (WEEKDAYS.includes(slot.dayOfWeek as Weekday)) {
          initial[slot.dayOfWeek as Weekday].push({
            id: `ITEM-${slot.id || generateSecureId('SLOT')}`,
            course: slot.course,
            semester: slot.semester || 1,
            subjectName: slot.subjectName,
          });
        }
      });
    } else {
      // If no timetable slots, populate default from assignedSubjects onto Monday & Tuesday
      const facMappings = mappings.filter((m) => m.facultyId === facId && m.active);
      if (facMappings.length > 0) {
        facMappings.forEach((m, idx) => {
          const targetDay: Weekday = idx % 2 === 0 ? 'Monday' : 'Tuesday';
          initial[targetDay].push({
            id: `ITEM-${m.id}`,
            course: m.course,
            semester: m.semester,
            subjectName: m.subjectName,
          });
        });
      } else {
        // Provide 1 blank starter entry on Monday
        initial.Monday.push({
          id: generateSecureId('ITEM'),
          course: availableCourses[0],
          semester: 1,
          subjectName: getAvailableSubjectsForCourse(availableCourses[0], 1)[0] || 'Foundations of Computing',
        });
      }
    }

    setDayAllocations(initial);
  };

  // Helper to fetch subjects for a given course & semester
  function getAvailableSubjectsForCourse(courseName: string, sem: number): string[] {
    const filtered = streamCourseSubjects.filter(
      (s) => s.course.toLowerCase() === courseName.toLowerCase() && s.semester === sem
    );
    if (filtered.length > 0) {
      return filtered.map((s) => s.subjectName);
    }
    // General subject pool if not yet configured in stream mapping
    if (courseName.includes('Computer') || courseName.includes('BCA') || courseName.includes('IT')) {
      const subsBySem: Record<number, string[]> = {
        1: ['Computer Programming in C', 'Digital Logic Fundamentals', 'Discrete Mathematics'],
        2: ['Data Structures & Algorithms', 'Computer Architecture', 'Object Oriented Programming C++'],
        3: ['Database Management Systems', 'Operating Systems', 'Web Technology Fundamentals'],
        4: ['Computer Networks', 'Software Engineering & Agile', 'Java Enterprise Applications'],
        5: ['Cloud Computing & Distributed Systems', 'Information Security & Cryptography', 'AI & Machine Learning'],
        6: ['Full Stack Web Architecture', 'Big Data Analytics', 'Mobile App Development'],
        7: ['Internet of Things (IoT)', 'Natural Language Processing', 'Cyber Forensics'],
        8: ['Major Capstone Project', 'Industrial Internship & Seminar'],
      };
      return subsBySem[sem] || ['Core Technical Subject', 'Elective Seminar'];
    }
    return [`${courseName} Core Paper Sem ${sem}`, `Applied Research Methodology`, `Domain Elective ${sem}`];
  }

  // Handle Faculty change in Step 1
  const handleFacultySelectionChange = (newFacId: string) => {
    setSelectedFacultyId(newFacId);
    initAllocationsForFaculty(newFacId);
  };

  // Add subject to a day
  const handleAddSubjectToDay = (day: Weekday) => {
    const defaultCourse = availableCourses[0];
    const defaultSem = 1;
    const defaultSubjects = getAvailableSubjectsForCourse(defaultCourse, defaultSem);

    const newItem: DaySubjectItem = {
      id: generateSecureId('ITEM'),
      course: defaultCourse,
      semester: defaultSem,
      subjectName: defaultSubjects[0] || 'Core Subject',
    };

    setDayAllocations((prev) => ({
      ...prev,
      [day]: [...prev[day], newItem],
    }));
  };

  // Remove subject from a day
  const handleRemoveSubjectFromDay = (day: Weekday, itemId: string) => {
    setDayAllocations((prev) => ({
      ...prev,
      [day]: prev[day].filter((item) => item.id !== itemId),
    }));
  };

  // Update subject item field
  const handleUpdateSubjectItem = (
    day: Weekday,
    itemId: string,
    field: keyof DaySubjectItem,
    value: string | number
  ) => {
    setDayAllocations((prev) => {
      const updatedList = prev[day].map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value };
          // If course or semester changed, recalculate default subjectName
          if (field === 'course' || field === 'semester') {
            const courseVal = field === 'course' ? (value as string) : item.course;
            const semVal = field === 'semester' ? (value as number) : item.semester;
            const subs = getAvailableSubjectsForCourse(courseVal, semVal);
            if (subs.length > 0 && !subs.includes(updated.subjectName)) {
              updated.subjectName = subs[0];
            }
          }
          return updated;
        }
        return item;
      });
      return { ...prev, [day]: updatedList };
    });
  };

  // Compute total subjects queued across all days
  const totalAllocatedSubjects = useMemo(() => {
    return Object.values(dayAllocations).reduce((sum, list) => sum + list.length, 0);
  }, [dayAllocations]);

  // Compute distinct subjects (for Faculty.assignedSubjects and FacultyMapping)
  const distinctAllocations = useMemo(() => {
    const map = new Map<string, { course: string; semester: number; subjectName: string; days: Weekday[] }>();
    WEEKDAYS.forEach((day) => {
      dayAllocations[day].forEach((item) => {
        const key = `${item.course}___${item.semester}___${item.subjectName}`;
        if (!map.has(key)) {
          map.set(key, {
            course: item.course,
            semester: item.semester,
            subjectName: item.subjectName,
            days: [day],
          });
        } else {
          const existing = map.get(key)!;
          if (!existing.days.includes(day)) {
            existing.days.push(day);
          }
        }
      });
    });
    return Array.from(map.values());
  }, [dayAllocations]);

  // -------------------------------------------------------------
  // SAVE & COMMIT HANDLER
  // -------------------------------------------------------------
  const handleSaveAllocations = () => {
    if (!canEdit || !currentSelectedFaculty) return;
    setStudioError('');

    if (totalAllocatedSubjects === 0) {
      setStudioError('Please add at least one course and subject allocation before saving.');
      return;
    }

    const fac = currentSelectedFaculty;
    const today = getISTDateString();

    // 1. Prepare New Timetable Slots & Check for Duplicate Day/Slot Conflicts (Bugs 646, 663)
    const newTimetableSlots: TimetableSlot[] = [];
    for (const day of WEEKDAYS) {
      const seenDayCourseSub = new Set<string>();
      for (let idx = 0; idx < dayAllocations[day].length; idx++) {
        const item = dayAllocations[day][idx];
        const dupKey = `${item.course.toLowerCase()}::${item.semester}::${item.subjectName.toLowerCase()}`;
        if (seenDayCourseSub.has(dupKey)) {
          setStudioError(
            `Schedule Overlap Blocked: "${item.subjectName}" (${item.course} Sem ${item.semester}) is assigned multiple times on ${day} for ${fac.name}.`
          );
          return;
        }
        seenDayCourseSub.add(dupKey);

        // Derive subjectCode matching course, semester, and subjectName
        const matched =
          streamCourseSubjects.find(
            (s) =>
              s.course.toLowerCase() === item.course.toLowerCase() &&
              s.semester === item.semester &&
              s.subjectName.toLowerCase() === item.subjectName.toLowerCase()
          ) ||
          streamCourseSubjects.find(
            (s) =>
              s.course.toLowerCase() === item.course.toLowerCase() &&
              s.subjectName.toLowerCase() === item.subjectName.toLowerCase()
          );
        const subjectCode = matched?.subjectCode || `${item.course.split(' ')[0]}-${item.semester}0${idx + 1}`;
        const roomNo = `Lecture Hall ${item.semester}-${idx + 1}`;
        newTimetableSlots.push({
          id: generateSecureId(`SLOT-${fac.id}-${day}`),
          dayOfWeek: day,
          course: item.course,
          semester: item.semester,
          section: 'A',
          subjectCode,
          subjectName: item.subjectName,
          facultyId: fac.id,
          facultyName: fac.name,
          roomNo,
        });
      }
    }

    // 2. Merge vs Replace Timetable Logic
    const baseTimetable = erpStorage.getTimetable() || timetable;
    let finalTimetable: TimetableSlot[] = [];
    if (scheduleMode === 'replace') {
      // Remove all previous timetable slots for this faculty
      finalTimetable = baseTimetable.filter((slot) => slot.facultyId !== fac.id);
      finalTimetable.push(...newTimetableSlots);
    } else {
      // Merge mode: retain other slots, replace duplicate day/subject slots for this faculty
      const retainedSlots = baseTimetable.filter((slot) => {
        if (slot.facultyId !== fac.id) return true;
        // Check if there is an overlapping new slot on the same day for same subject
        const duplicate = newTimetableSlots.some(
          (ns) =>
            ns.dayOfWeek === slot.dayOfWeek &&
            ns.course.toLowerCase() === slot.course.toLowerCase() &&
            ns.semester === slot.semester &&
            ns.subjectName.toLowerCase() === slot.subjectName.toLowerCase()
        );
        return !duplicate;
      });
      finalTimetable = [...retainedSlots, ...newTimetableSlots];
    }

    // Validate for room collisions and faculty double-booking conflicts
    const clashReport = checkTimetableClashes(finalTimetable);
    if (clashReport.hasClash) {
      const topClash = clashReport.clashes[0];
      setStudioError(topClash.message);
      return;
    }

    if (onSaveTimetable) {
      onSaveTimetable(finalTimetable);
    }

    // 3. Prepare Faculty Mappings
    const newFacultyMappings: FacultyMapping[] = distinctAllocations.map((alloc, idx) => {
      const matched =
        streamCourseSubjects.find(
          (s) =>
            s.course.toLowerCase() === alloc.course.toLowerCase() &&
            s.semester === alloc.semester &&
            s.subjectName.toLowerCase() === alloc.subjectName.toLowerCase()
        ) ||
        streamCourseSubjects.find(
          (s) =>
            s.course.toLowerCase() === alloc.course.toLowerCase() &&
            s.subjectName.toLowerCase() === alloc.subjectName.toLowerCase()
        );
      const subjectCode = matched?.subjectCode || `${alloc.course.split(' ')[0]}-${alloc.semester}0${idx + 1}`;
      const streamCode = matched?.streamCode || alloc.course.split(' ')[0].toUpperCase();

      return {
        id: generateSecureId(`MAP-${fac.id}`),
        facultyId: fac.id,
        facultyName: fac.name,
        facultyEmail: fac.email,
        course: alloc.course,
        streamCode,
        semester: alloc.semester,
        section: 'A',
        subjectCode,
        subjectName: alloc.subjectName,
        credits: matched?.credits || 4,
        roomNo: `Lecture Hall ${alloc.semester}`,
        timeSlot: `${alloc.days.join(', ')}`,
        academicYear: '2026-27',
        assignedDate: today,
        active: true,
      };
    });

    // Merge or replace in FacultyMapping list
    const baseMappings = erpStorage.getFacultyMappings() || mappings;
    let finalMappings: FacultyMapping[] = [];
    if (scheduleMode === 'replace') {
      finalMappings = baseMappings.filter((m) => m.facultyId !== fac.id);
      finalMappings = [...newFacultyMappings, ...finalMappings];
    } else {
      const retainedMappings = baseMappings.filter((m) => {
        if (m.facultyId !== fac.id) return true;
        const isDuplicate = newFacultyMappings.some(
          (nm) =>
            nm.course.toLowerCase() === m.course.toLowerCase() &&
            nm.semester === m.semester &&
            nm.subjectName.toLowerCase() === m.subjectName.toLowerCase()
        );
        return !isDuplicate;
      });
      finalMappings = [...newFacultyMappings, ...retainedMappings];
    }
    onSaveMappings(finalMappings);

    // 4. Update Faculty Assigned Subjects Workload
    if (onSaveFaculty) {
      const updatedAssigned = distinctAllocations.map((alloc, idx) => {
        const matched =
          streamCourseSubjects.find(
            (s) =>
              s.course.toLowerCase() === alloc.course.toLowerCase() &&
              s.semester === alloc.semester &&
              s.subjectName.toLowerCase() === alloc.subjectName.toLowerCase()
          ) ||
          streamCourseSubjects.find(
            (s) =>
              s.course.toLowerCase() === alloc.course.toLowerCase() &&
              s.subjectName.toLowerCase() === alloc.subjectName.toLowerCase()
          );
        const subjectCode = matched?.subjectCode || `${alloc.course.split(' ')[0]}-${alloc.semester}0${idx + 1}`;
        return {
          subjectCode,
          subjectName: alloc.subjectName,
          course: alloc.course,
          semester: alloc.semester,
          credits: matched?.credits || 4,
          room: `Hall ${alloc.semester}`,
          timeSlot: `${alloc.days.join(', ')}`,
          totalClassesScheduled: alloc.days.length * 14,
          syllabusCompletion: 0,
        };
      });

      const updatedFacultyList = facultyList.map((f) => {
        if (f.id === fac.id) {
          const existingNonDuplicate = (f.assignedSubjects || []).filter(
            (existing) =>
              !updatedAssigned.some(
                (ua) =>
                  ua.course.toLowerCase() === existing.course.toLowerCase() &&
                  ua.semester === existing.semester &&
                  ua.subjectName.toLowerCase() === existing.subjectName.toLowerCase()
              )
          );
          return {
            ...f,
            assignedSubjects:
              scheduleMode === 'replace' ? updatedAssigned : [...updatedAssigned, ...existingNonDuplicate],
          };
        }
        return f;
      });
      onSaveFaculty(updatedFacultyList);
    }

    setIsStudioOpen(false);
    const modeLabel = scheduleMode === 'replace' ? 'replaced existing schedule' : 'merged with existing schedule';
    showBanner(
      `Successfully ${modeLabel} for ${fac.name}: ${totalAllocatedSubjects} day-wise lecture(s) across ${distinctAllocations.length} distinct subject(s).`,
      6000
    );
  };

  // Re-assign faculty handler
  const handleReassign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !reassignMappingId || !newFacultyId) return;
    setReassignError('');

    const targetMapping = mappings.find((m) => m.id === reassignMappingId);
    const targetFac = facultyList.find((f) => f.id === newFacultyId);
    if (!targetMapping || !targetFac) return;

    if (targetMapping.facultyId === targetFac.id) {
      setReassignError(`"${targetMapping.subjectName}" is already assigned to ${targetFac.name}. Please choose a different faculty member.`);
      return;
    }

    const updated = mappings.map((m) => {
      if (m.id === reassignMappingId) {
        return {
          ...m,
          previousFacultyName: m.facultyName,
          facultyId: targetFac.id,
          facultyName: targetFac.name,
          facultyEmail: targetFac.email,
          assignedDate: getISTDateString(),
        };
      }
      return m;
    });

    onSaveMappings(updated);
    setReassignMappingId(null);
    showBanner(
      `Faculty re-assigned to ${targetFac.name}. Historical student attendance logs and grades are preserved intact.`,
      5000
    );
  };

  // Filter mappings table
  const filteredMappings = mappings.filter(
    (m) =>
      m.facultyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.subjectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.course.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-1.5">
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Class & Stream Teacher Tagging (Principal Authority)
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Assign degree courses, semesters, and subjects day-wise to faculty members. Tagged faculty receive automated
            access to roll-call registers and marks entry for their scheduled classes.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenStudio}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs transition shadow-sm hover:shadow flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <CalendarDays className="w-4 h-4" />
            Map Teacher to Class
          </button>
        )}
      </div>

      {/* Continuity Rule Banner */}
      <div className="p-4 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Statutory Academic Continuity Rule:</span>
          <p className="text-blue-700 mt-0.5 leading-relaxed">
            Historical student data (past roll call attendance records, continuous assessments, and published CBCS grade
            points) <span className="font-bold">must not be changed or blanked</span> upon faculty re-tagging. Past
            records remain anchored in the institutional ledger.
          </p>
        </div>
      </div>

      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search mappings by teacher name, course, subject name, or stream..."
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
          {filteredMappings.length} Active Mappings
        </span>
      </div>

      {/* Master Mappings Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
            Institutional Faculty Subject Rosters
          </h3>
          <span className="text-xs text-slate-500 font-mono">Real-Time Roll Call Authorization</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Assigned Faculty Member</th>
                <th className="px-5 py-3">Course & Semester</th>
                <th className="px-5 py-3">Subject Name</th>
                <th className="px-5 py-3">Scheduled Days / Timings</th>
                <th className="px-5 py-3">Continuity Status</th>
                {canEdit && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-xs">
                    No faculty mappings found matching your search.
                  </td>
                </tr>
              ) : (
                filteredMappings.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3">
                      <div className="font-bold text-slate-900">{m.facultyName}</div>
                      <div className="text-xs text-slate-500 font-mono">{m.facultyEmail}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800">{m.course}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Semester {m.semester} • Sec {m.section}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-bold text-slate-900">{m.subjectName}</div>
                      <div className="text-xs text-indigo-600 font-mono font-semibold">
                        {m.subjectCode} • {m.credits || 4} Credits
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        {m.timeSlot || 'Monday, Wednesday, Friday'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{m.roomNo || 'Main Academic Block'}</div>
                    </td>
                    <td className="px-5 py-3">
                      {m.previousFacultyName ? (
                        <div>
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Transferred
                          </span>
                          <p className="text-xs text-slate-500 mt-0.5">Prev: {m.previousFacultyName}</p>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Active Roster
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => {
                            setReassignMappingId(m.id);
                            setNewFacultyId(facultyList[0]?.id || '');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-bold rounded-lg text-xs transition border border-slate-200 flex items-center gap-1.5 ml-auto"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Re-assign
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================= */}
      {/* REDESIGNED MAP TEACHER TO CLASS MODAL / STUDIO               */}
      {/* ============================================================= */}
      {isStudioOpen && (
        <div role="dialog" aria-modal="true" aria-label="Map Teacher to Class Studio" className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/30 rounded-xl border border-indigo-400/30">
                  <GraduationCap className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    Map Teacher to Class & Day-Wise Timetable Studio
                  </h3>
                  <p className="text-xs text-slate-300">
                    Step-by-step allocation: choose faculty, assign day-wise subjects, preview schedule, and save.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStudioOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Studio Navigation Bar */}
            <div className="px-6 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between text-xs font-semibold shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStudioActiveStep('build')}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                    studioActiveStep === 'build'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  1. Schedule Builder
                </button>
                <button
                  type="button"
                  onClick={() => setStudioActiveStep('preview')}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                    studioActiveStep === 'preview'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  2. Live Schedule Preview
                  <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                    {totalAllocatedSubjects}
                  </span>
                </button>
              </div>

              <div className="text-xs text-slate-500 hidden sm:block">
                Total Queued: <strong className="text-slate-900">{totalAllocatedSubjects} lecture(s)</strong> across{' '}
                <strong className="text-slate-900">{distinctAllocations.length} distinct subject(s)</strong>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {studioError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700">
                  {studioError}
                </div>
              )}
              {/* STEP 1: CHOOSE FACULTY MEMBER (1ST OPTION) */}
              <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/90 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 font-mono">
                      Step 1 of 3
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">Choose Faculty Member</h4>
                  </div>

                  {/* Schedule Conflict / Overwrite Toggle (User Comment) */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setScheduleMode('merge')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        scheduleMode === 'merge'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Keep non-overlapping timetable slots and update duplicate slots"
                    >
                      Merge & Update Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode('replace')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        scheduleMode === 'replace'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Clear previous schedule for this teacher and apply only this newly configured schedule"
                    >
                      Replace Entire Schedule
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Teacher Profile</label>
                    <select
                      value={selectedFacultyId}
                      onChange={(e) => handleFacultySelectionChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl bg-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                    >
                      {facultyList.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} — {f.designation} (Dept. of {f.department})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Faculty Mini Card */}
                  {currentSelectedFaculty && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                      <img
                        src={currentSelectedFaculty.avatarUrl}
                        alt={currentSelectedFaculty.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-2xs"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate">
                          {currentSelectedFaculty.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {currentSelectedFaculty.facultyId} • {currentSelectedFaculty.department}
                        </div>
                        <div className="text-xs text-indigo-600 font-semibold mt-0.5">
                          {scheduleMode === 'replace'
                            ? 'Overwriting previous roster'
                            : 'Merging with active roster'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* VIEW A: BUILDER STEP */}
              {studioActiveStep === 'build' && (
                <div className="space-y-4">
                  {/* STEP 2: DAY-WISE COURSE & SUBJECT ALLOCATIONS */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 font-mono">
                          Step 2 of 3
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Day-Wise Course & Subject Allocations
                        </h4>
                      </div>
                      <span className="text-xs text-slate-500">
                        Multiple subjects can be added per day
                      </span>
                    </div>

                    {/* Day Tabs */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                      {WEEKDAYS.map((day) => {
                        const count = dayAllocations[day].length;
                        const isSelected = activeDay === day;
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setActiveDay(day)}
                            className={`py-2 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                              isSelected
                                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            <span>{day.slice(0, 3)}</span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                                count > 0
                                  ? isSelected
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-slate-200 text-slate-700 font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              {count} {count === 1 ? 'sub' : 'subs'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Day Subject Entry List */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        <h5 className="font-bold text-slate-900 text-xs sm:text-sm">
                          Subjects Scheduled for {activeDay}
                        </h5>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                          {dayAllocations[activeDay].length} Subject(s)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddSubjectToDay(activeDay)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition border border-indigo-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Subject to {activeDay}
                      </button>
                    </div>

                    {dayAllocations[activeDay].length === 0 ? (
                      <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                        <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-600">
                          No subjects scheduled for {activeDay} yet.
                        </p>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          Click below to add the first course, semester, and subject for this faculty on {activeDay}.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleAddSubjectToDay(activeDay)}
                          className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add First Subject for {activeDay}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dayAllocations[activeDay].map((item, index) => {
                          const subjectOptions = getAvailableSubjectsForCourse(item.course, item.semester);
                          return (
                            <div
                              key={item.id}
                              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                                    {index + 1}
                                  </span>
                                  Lecture Slot {index + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSubjectFromDay(activeDay, item.id)}
                                  className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition"
                                  title="Remove this subject"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                                {/* Course Selection */}
                                <div className="md:col-span-5">
                                  <label className="block font-semibold text-slate-700 mb-1">
                                    Course / Degree Programme
                                  </label>
                                  <select
                                    value={item.course}
                                    onChange={(e) =>
                                      handleUpdateSubjectItem(activeDay, item.id, 'course', e.target.value)
                                    }
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    {availableCourses.map((c) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Semester Selection */}
                                <div className="md:col-span-2">
                                  <label className="block font-semibold text-slate-700 mb-1">Semester</label>
                                  <select
                                    value={item.semester}
                                    onChange={(e) =>
                                      handleUpdateSubjectItem(
                                        activeDay,
                                        item.id,
                                        'semester',
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                                      <option key={s} value={s}>
                                        Sem {s}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Subject Name Selection */}
                                <div className="md:col-span-5">
                                  <label className="block font-semibold text-slate-700 mb-1">
                                    Subject Name
                                  </label>
                                  {subjectOptions.length > 0 ? (
                                    <select
                                      value={item.subjectName}
                                      onChange={(e) =>
                                        handleUpdateSubjectItem(activeDay, item.id, 'subjectName', e.target.value)
                                      }
                                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                      {subjectOptions.map((sub) => (
                                        <option key={sub} value={sub}>
                                          {sub}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={item.subjectName}
                                      onChange={(e) =>
                                        handleUpdateSubjectItem(activeDay, item.id, 'subjectName', e.target.value)
                                      }
                                      placeholder="Enter subject name..."
                                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-900"
                                      required
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW B: LIVE PREVIEW MATRIX */}
              {studioActiveStep === 'preview' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 font-mono">
                        Step 3 of 3
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Live Timetable Schedule Preview for {currentSelectedFaculty?.name}
                      </h4>
                    </div>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-xl text-xs border border-indigo-200">
                      Mode: {scheduleMode === 'replace' ? 'Full Overwrite' : 'Incremental Merge'}
                    </span>
                  </div>

                  {/* Matrix of days */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {WEEKDAYS.map((day) => {
                      const dayItems = dayAllocations[day];
                      return (
                        <div
                          key={day}
                          className={`rounded-2xl border p-4 transition ${
                            dayItems.length > 0
                              ? 'bg-white border-indigo-200 shadow-2xs'
                              : 'bg-slate-50/50 border-slate-200/60 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                            <span className="font-black text-slate-900 text-xs">{day}</span>
                            <span className="text-xs font-mono font-bold text-slate-500">
                              {dayItems.length} Lecture(s)
                            </span>
                          </div>

                          {dayItems.length === 0 ? (
                            <div className="text-xs text-slate-400 italic py-2 text-center">
                              No classes scheduled
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {dayItems.map((sub, i) => (
                                <div
                                  key={sub.id}
                                  className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100/80 text-xs space-y-1"
                                >
                                  <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                                    <span className="truncate">{sub.subjectName}</span>
                                    <span className="text-xs font-mono text-indigo-600 px-1.5 py-0.2 bg-white rounded border border-indigo-200 shrink-0">
                                      Slot {i + 1}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 flex items-center justify-between">
                                    <span className="truncate">{sub.course}</span>
                                    <span className="font-semibold text-slate-700">Sem {sub.semester}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Breakdown Table */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <h5 className="font-bold text-slate-800 text-xs mb-2">Distinct Subject Workload Summary</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-xs text-slate-500 uppercase font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2">Course</th>
                            <th className="py-2">Semester</th>
                            <th className="py-2">Subject Name</th>
                            <th className="py-2">Scheduled Days</th>
                            <th className="py-2 text-right">Weekly Frequency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {distinctAllocations.map((alloc) => (
                            <tr key={`${alloc.course}-${alloc.semester}-${alloc.subjectName}`}>
                              <td className="py-2 font-medium text-slate-800">{alloc.course}</td>
                              <td className="py-2 font-mono">Sem {alloc.semester}</td>
                              <td className="py-2 font-bold text-slate-900">{alloc.subjectName}</td>
                              <td className="py-2 text-indigo-700 font-semibold">{alloc.days.join(', ')}</td>
                              <td className="py-2 text-right font-mono font-bold text-slate-800">
                                {alloc.days.length}x / week
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer / Action Bar */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500">
                <span className="font-bold text-slate-700">Action:</span> Saving will synchronize{' '}
                <strong className="text-slate-900">Faculty Roster</strong>,{' '}
                <strong className="text-slate-900">Weekly Timetable</strong>, and{' '}
                <strong className="text-slate-900">Roll Call Permissions</strong>.
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsStudioOpen(false)}
                  className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700 hover:bg-slate-100 text-xs transition"
                >
                  Cancel
                </button>

                {studioActiveStep === 'build' ? (
                  <button
                    type="button"
                    onClick={() => setStudioActiveStep('preview')}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Review Preview ({totalAllocatedSubjects})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStudioActiveStep('build')}
                    className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700 hover:bg-slate-100 text-xs transition"
                  >
                    Back to Builder
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveAllocations}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-md hover:shadow flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save & Commit Allocations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* RE-ASSIGN FACULTY MODAL (PRESERVATION GUARANTEE)               */}
      {/* ============================================================= */}
      {reassignMappingId && (
        <div role="dialog" aria-modal="true" aria-label="Transfer Subject to New Faculty" className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-indigo-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">Transfer Subject to New Faculty</h3>
              <button
                onClick={() => setReassignMappingId(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReassign} className="p-6 space-y-4 text-xs">
              {reassignError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold">
                  {reassignError}
                </div>
              )}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
                <p className="font-bold">Continuous Data Preservation Guarantee:</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Re-assigning will transfer ongoing roll call duties to the newly selected teacher. All previously
                  recorded attendance sessions and exam grades will remain fully intact without alteration.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select New Teacher</label>
                <select
                  value={newFacultyId}
                  onChange={(e) => {
                    setNewFacultyId(e.target.value);
                    setReassignError('');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold"
                  required
                >
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassignMappingId(null)}
                  className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md"
                >
                  Confirm Re-assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
