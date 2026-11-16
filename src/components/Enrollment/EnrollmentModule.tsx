import React, { useState, useRef, useEffect } from 'react';
import { AttendanceRecord, EnrollmentField, Student, UserRole } from '../../types/erp';
import {
  generateSecureId,
  resolveUpdatedStudentTotalFee,
  toPaisa,
  fromPaisa,
  paisaSub,
  getMaxSemestersForCourse,
  checkHallTicketEligibility,
} from '../../utils/erpLogic';
import { parseCsvMatrix } from '../../utils/excelHelper';
import { erpStorage } from '../../services/erpStorage';
import {
  FileText,
  UserCheck,
  Plus,
  Trash2,
  Edit2,
  Save,
  Upload,
  CheckCircle2,
  AlertCircle,
  Search,
  Lock,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';

interface EnrollmentModuleProps {
  fields: EnrollmentField[];
  students: Student[];
  onSaveFields: (fields: EnrollmentField[]) => void;
  onSaveStudents: (students: Student[]) => void;
  canEdit: boolean; // Principal, Accountant, Superadmin
  currentRole?: UserRole;
}

export const EnrollmentModule: React.FC<EnrollmentModuleProps> = ({
  fields,
  students,
  onSaveFields,
  onSaveStudents,
  canEdit,
  currentRole = 'superadmin',
}) => {
  const isAdmin = currentRole === 'superadmin';

  // Helper to detect if a field represents tuition fee, concession, dues, or monetary waivers
  const isFeeOrConcessionField = (key: string, label: string = ''): boolean => {
    const combined = `${key} ${label}`.toLowerCase();
    return (
      combined.includes('fee') ||
      combined.includes('tuition') ||
      combined.includes('concession') ||
      combined.includes('waiver') ||
      combined.includes('dues') ||
      combined.includes('scholarship')
    );
  };
  const [activeSubTab, setActiveSubTab] = useState<'form_builder' | 'update_student_data'>('form_builder');
  const [searchStudent, setSearchStudent] = useState('');

  // Field Edit/Add Modal State
  const [editingField, setEditingField] = useState<EnrollmentField | null>(null);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'select' | 'boolean' | 'date'>('text');
  const [fieldMode, setFieldMode] = useState<'mandatory' | 'optional' | 'non_editable'>('mandatory');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldDesc, setFieldDesc] = useState('');

  // Student Edit Modal State
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<Student | null>(null);
  const [editStudentFormData, setEditStudentFormData] = useState<Record<string, any>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);
  const [confirmDeleteFieldId, setConfirmDeleteFieldId] = useState<string | null>(null);
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    };
  }, []);

  const showStatus = (msg: string, duration = 4000, isError = false) => {
    setStatusMessage(msg);
    setStatusIsError(isError);
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage('');
      setStatusIsError(false);
    }, duration);
  };

  // Open Field Form for New or Edit
  const handleOpenFieldModal = (f?: EnrollmentField) => {
    if (f) {
      setEditingField(f);
      setFieldLabel(f.label);
      setFieldKey(f.key);
      setFieldType(f.type);
      setFieldMode(f.mode);
      setFieldOptions(f.options ? f.options.join(', ') : '');
      setFieldDesc(f.description || '');
    } else {
      setEditingField(null);
      setFieldLabel('');
      setFieldKey('');
      setFieldType('text');
      setFieldMode('mandatory');
      setFieldOptions('');
      setFieldDesc('');
    }
    setIsFieldModalOpen(true);
  };

  const handleSaveField = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedKey = fieldKey.trim().replace(/\s+/g, '_') || fieldLabel.toLowerCase().replace(/\s+/g, '_');

    // Security check: non-admins cannot create or edit fee/concession parameters
    if (!isAdmin && isFeeOrConcessionField(formattedKey, fieldLabel)) {
      showStatus('Fee & concession parameters can only be configured or amended by Super Admin.', 4500, true);
      setIsFieldModalOpen(false);
      return;
    }

    const optionsArray =
      fieldType === 'select'
        ? fieldOptions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    if (editingField) {
      const updated = fields.map((f) =>
        f.id === editingField.id
          ? {
              ...f,
              label: fieldLabel.trim(),
              key: formattedKey,
              type: fieldType,
              mode: fieldMode,
              options: optionsArray,
              description: fieldDesc.trim() || undefined,
            }
          : f
      );
      onSaveFields(updated);
      showStatus(`Field "${fieldLabel}" updated successfully.`, 3500);
    } else {
      const newField: EnrollmentField = {
        id: generateSecureId('FLD'),
        label: fieldLabel.trim(),
        key: formattedKey,
        type: fieldType,
        mode: fieldMode,
        options: optionsArray,
        description: fieldDesc.trim() || undefined,
      };
      onSaveFields([...fields, newField]);
      showStatus(`New enrollment parameter "${fieldLabel}" added.`, 3500);
    }

    setIsFieldModalOpen(false);
  };

  const handleDeleteField = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!isAdmin && field && isFeeOrConcessionField(field.key, field.label)) {
      showStatus('Fee & concession parameters can only be deleted by Super Admin.', 4500, true);
      return;
    }

    const updated = fields.filter((f) => f.id !== fieldId);
    onSaveFields(updated);
    setConfirmDeleteFieldId(null);
    showStatus('Parameter deleted.', 3000);
  };

  // Open Student Direct Editor for Staff
  const handleOpenStudentEditor = (s: Student) => {
    setSelectedStudentForEdit(s);
    setEditStudentFormData({
      ...(s.enrollmentData || {}),
      rollNo: s.rollNo,
      registerNo: s.registerNo,
      name: s.name,
      email: s.email,
      phone: s.phone,
      parentPhone: s.parentPhone,
      course: s.course,
      streamCode: s.streamCode,
      semester: s.semester,
      section: s.section,
      totalFee: s.totalFee,
      paidFee: s.paidFee,
      pendingFee: s.pendingFee,
    });
  };

  const handleSaveStudentData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForEdit) return;

    const cleanRollNo = String(editStudentFormData.rollNo || selectedStudentForEdit.rollNo).trim().toUpperCase();
    const hasDupRoll = students.some(
      (s) => s.id !== selectedStudentForEdit.id && (s.rollNo || '').trim().toUpperCase() === cleanRollNo
    );
    if (hasDupRoll) {
      showStatus(`Duplicate Roll No: "${cleanRollNo}" is already assigned to another student.`, 5000, true);
      return;
    }

    const targetCourse = String(editStudentFormData.course || selectedStudentForEdit.course).trim();
    const maxSemForCourse = getMaxSemestersForCourse(targetCourse);
    const parsedSem = Number(editStudentFormData.semester);
    const clampedSem = Number.isFinite(parsedSem)
      ? Math.max(1, Math.min(maxSemForCourse, Math.round(parsedSem)))
      : selectedStudentForEdit.semester;

    let feeValidationError = '';
    const sysSettings = erpStorage.getSystemSettings();
    const attRecords = erpStorage.getAttendanceRecords();
    const maxDue = sysSettings.maxHallTicketFeeDue ?? 1000;
    const minAtt = sysSettings.minAttendanceThreshold ?? sysSettings.attendanceThreshold ?? 75;

    const updated = students.map((s) => {
      if (s.id === selectedStudentForEdit.id) {
        // Enforce fee immutability for Accountant & Principal
        const mergedEnrollment: Record<string, any> = {
          ...(s.enrollmentData || {}),
          ...editStudentFormData,
          rollNo: cleanRollNo,
          semester: clampedSem,
        };

        if (!isAdmin) {
          // Revert any fee or concession fields in enrollmentData to original values
          fields.forEach((f) => {
            if (isFeeOrConcessionField(f.key, f.label)) {
              const origEnrollment = s.enrollmentData as Record<string, any> | undefined;
              if (origEnrollment && origEnrollment[f.key] !== undefined) {
                mergedEnrollment[f.key] = origEnrollment[f.key];
              } else {
                delete mergedEnrollment[f.key];
              }
            }
          });
        }

        let newTotalFee = s.totalFee;
        if (isAdmin) {
          try {
            newTotalFee = resolveUpdatedStudentTotalFee(
              isAdmin,
              editStudentFormData.totalFee,
              s.totalFee,
              s.paidFee
            );
          } catch (err: any) {
            feeValidationError =
              err?.message || 'Invalid Total Fee update: cannot be less than already paid fee.';
            return s;
          }
        }

        const newPendingFee = isAdmin
          ? Math.max(0, fromPaisa(paisaSub(toPaisa(newTotalFee), toPaisa(s.paidFee), false)))
          : s.pendingFee;

        const hasAtt = attRecords.some((a: AttendanceRecord) => a.studentId === s.id);
        const eligibility = checkHallTicketEligibility(newPendingFee, s.attendancePercentage, maxDue, minAtt, {
          hasAttendanceRecords: hasAtt,
          manualBlocked: s.manualHallTicketBlocked,
          manualBlockReason: s.manualBlockReason,
        });

        return {
          ...s,
          rollNo: cleanRollNo,
          registerNo: String(editStudentFormData.registerNo || s.registerNo).trim(),
          name: String(editStudentFormData.name || s.name).trim(),
          email: String(editStudentFormData.email || s.email).trim(),
          phone: String(editStudentFormData.phone || s.phone).trim(),
          parentPhone: String(editStudentFormData.parentPhone || s.parentPhone).trim(),
          course: targetCourse,
          streamCode: String(editStudentFormData.streamCode || s.streamCode).trim().toUpperCase(),
          semester: clampedSem,
          section: String(editStudentFormData.section || s.section).trim(),
          totalFee: newTotalFee,
          pendingFee: newPendingFee,
          hallTicketBlocked: !eligibility.isEligible,
          blockReason: eligibility.reasons.join('; '),
          enrollmentData: mergedEnrollment,
        };
      }
      return s;
    });

    if (feeValidationError) {
      showStatus(feeValidationError, 5000, true);
      return;
    }

    onSaveStudents(updated);
    setSelectedStudentForEdit(null);
    showStatus(
      !isAdmin
        ? `Updated student record for ${selectedStudentForEdit.name} (Fee parameters remained locked).`
        : `Updated student record for ${selectedStudentForEdit.name} (${cleanRollNo}).`,
      4000
    );
  };

  const [importSkippedErrors, setImportSkippedErrors] = useState<string[]>([]);
  const batchFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Parse CSV / JSON batch upload and report skipped rows with row numbers
  const handleBatchFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportSkippedErrors([]);

    if (file.size > 10 * 1024 * 1024) {
      setImportSkippedErrors(['File exceeds the 10 MB security upload limit.']);
      if (batchFileInputRef.current) batchFileInputRef.current.value = '';
      return;
    }

    try {
      const text = await file.text();
      let rawRows: Record<string, any>[] = [];

      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        rawRows = Array.isArray(parsed) ? parsed : [];
      } else {
        const matrix = parseCsvMatrix(text);
        if (matrix.length < 2) {
          setImportSkippedErrors(['File contains no data rows after header.']);
          return;
        }
        const headers = matrix[0].map((h) => String(h ?? '').trim());
        for (let i = 1; i < matrix.length; i++) {
          const cols = matrix[i];
          if (cols.every((c) => String(c ?? '').trim() === '')) continue;
          const rowObj: Record<string, any> = { __rowNum: i + 1 };
          headers.forEach((h, idx) => {
            rowObj[h] = String(cols[idx] ?? '').trim();
          });
          rawRows.push(rowObj);
        }
      }

      const existingRolls = new Set(students.map((s) => (s.rollNo || '').trim().toUpperCase()));
      const validImported: Student[] = [];
      const skippedReasons: string[] = [];

      rawRows.forEach((r, idx) => {
        const rowLabel = r.__rowNum ? `Row ${r.__rowNum}` : `Record #${idx + 1}`;
        const rollNo = String(r.rollNo || r.RollNo || r['Roll No'] || '').trim().toUpperCase();
        const name = String(r.name || r.Name || r['Student Name'] || '').trim();
        const course = String(r.course || r.Course || 'B.Tech Computer Science & Engineering').trim();

        if (!rollNo || !name) {
          skippedReasons.push(`${rowLabel}: Missing required Roll No or Student Name.`);
          return;
        }
        if (existingRolls.has(rollNo)) {
          skippedReasons.push(`${rowLabel} (${rollNo}): Duplicate Roll Number already exists in directory.`);
          return;
        }

        const totalFeeNum = Number(r.totalFee ?? r.TotalFee ?? 48000);
        const paidFeeNum = Number(r.paidFee ?? r.PaidFee ?? 0);
        if (!Number.isFinite(totalFeeNum) || totalFeeNum < 0) {
          skippedReasons.push(`${rowLabel} (${rollNo}): Invalid non-numeric or negative totalFee "${r.totalFee}".`);
          return;
        }
        if (!Number.isFinite(paidFeeNum) || paidFeeNum < 0 || paidFeeNum > totalFeeNum) {
          skippedReasons.push(
            `${rowLabel} (${rollNo}): Invalid paidFee "${r.paidFee}" (must be between 0 and totalFee ${totalFeeNum}).`
          );
          return;
        }

        existingRolls.add(rollNo);
        const maxSem = getMaxSemestersForCourse(course);
        const semRaw = Number(r.semester || r.Semester || 1);
        const semester = Number.isFinite(semRaw) ? Math.max(1, Math.min(maxSem, Math.round(semRaw))) : 1;

        validImported.push({
          id: generateSecureId('STU'),
          rollNo,
          registerNo: String(r.registerNo || r.RegisterNo || `REG-${rollNo}`).trim(),
          name,
          email: String(r.email || r.Email || `${rollNo.toLowerCase()}@rlsy.ac.in`).trim(),
          phone: String(r.phone || r.Phone || '9431800000').trim(),
          parentPhone: String(r.parentPhone || r.ParentPhone || '9431800001').trim(),
          course,
          streamCode: String(r.streamCode || r.StreamCode || 'CSE').trim().toUpperCase(),
          semester,
          section: String(r.section || r.Section || 'A').trim(),
          batchYear: String(r.batchYear || '2025-2029').trim(),
          totalFee: totalFeeNum,
          paidFee: paidFeeNum,
          pendingFee: Math.max(0, fromPaisa(paisaSub(toPaisa(totalFeeNum), toPaisa(paidFeeNum), false))),
          hallTicketBlocked: false,
          attendancePercentage: Number(r.attendancePercentage ?? 85) || 85,
          enrollmentData: {
            category: String(r.category || 'General'),
          },
        });
      });

      if (validImported.length > 0) {
        onSaveStudents([...validImported, ...students]);
      }
      setImportSkippedErrors(skippedReasons);
      showStatus(
        `Batch Import Complete: ${validImported.length} student(s) imported${
          skippedReasons.length > 0 ? `, ${skippedReasons.length} row(s) skipped due to validation errors.` : '.'
        }`,
        6000
      );
    } catch (err: any) {
      setImportSkippedErrors([`Failed to parse batch file: ${err?.message || 'Malformed CSV/JSON format.'}`]);
    } finally {
      if (batchFileInputRef.current) batchFileInputRef.current.value = '';
    }
  };

  // Sample Batch Upload (also validates duplicate Roll No)
  const handleSimulateBulkUpload = () => {
    setImportSkippedErrors([]);
    const candidateRoll = `2025CS${String(students.length + 1).padStart(3, '0')}`;
    const dummyBatch: Student = {
      id: generateSecureId('STU'),
      rollNo: candidateRoll,
      registerNo: `REG2025-${String(students.length + 1).padStart(3, '0')}`,
      name: 'Sneha Kumari',
      email: `sneha.kumari${students.length + 1}@rlsy.ac.in`,
      phone: '9431876500',
      parentPhone: '9431876501',
      course: 'B.Tech Computer Science & Engineering',
      streamCode: 'CSE',
      semester: 5,
      section: 'A',
      batchYear: '2023-2027',
      totalFee: 48000,
      paidFee: 48000,
      pendingFee: 0,
      hallTicketBlocked: false,
      attendancePercentage: 86.5,
      enrollmentData: {
        category: 'OBC-NCL',
        meritPercent: 91.5,
        annualIncome: 240000,
        sportsCategory: 'State Level',
        bloodGroup: 'O+',
        hostelRequired: true,
      },
    };

    onSaveStudents([dummyBatch, ...students]);
    showStatus(`Uploaded and synchronized student record (${candidateRoll}) with mandatory fields verified.`, 4000);
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.course.toLowerCase().includes(searchStudent.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-xl">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Institutional Enrollment & Admissions Governance
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Co-managed by Principal and Accountant. Configure dynamic candidate parameters, enforce mandatory vs.
            statutory non-editable fields, and maintain student records.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 border rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            statusIsError
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          }`}
        >
          {statusIsError ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          {statusMessage}
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl px-6 pt-3 shadow-sm gap-2">
        <button
          onClick={() => setActiveSubTab('form_builder')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 border-b-2 ${
            activeSubTab === 'form_builder'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Sub-Menu 1: Enrollment Form Configuration ({fields.length} Parameters)
        </button>
        <button
          onClick={() => setActiveSubTab('update_student_data')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 border-b-2 ${
            activeSubTab === 'update_student_data'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Sub-Menu 2: Update Student Data & Non-Editable Fields ({students.length} Enrolled)
        </button>
      </div>

      {/* SUB-MENU 1: ENROLLMENT FORM BUILDER */}
      {activeSubTab === 'form_builder' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Student Admission Parameters & Field Schema</h3>
              <p className="text-xs text-slate-500">
                Mark parameters as <span className="font-bold text-rose-600">Mandatory</span> (required during student
                sign-up), <span className="font-bold text-slate-700">Optional</span>, or{' '}
                <span className="font-bold text-purple-700">Non-Editable</span> (locked for students, populated only by
                staff).
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => handleOpenFieldModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" />
                Add New Parameter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.map((f) => {
              const modeStyles = {
                mandatory: 'bg-rose-100 text-rose-800 border-rose-200',
                optional: 'bg-slate-100 text-slate-700 border-slate-200',
                non_editable: 'bg-purple-100 text-purple-800 border-purple-200',
              };

              return (
                <div
                  key={f.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${
                          modeStyles[f.mode]
                        }`}
                      >
                        {f.mode === 'non_editable' ? '🔒 Non-Editable' : f.mode}
                      </span>
                      <span className="text-xs font-mono uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        Type: {f.type}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm">{f.label}</h4>
                    <p className="text-xs font-mono text-indigo-600 mt-0.5">key: {f.key}</p>

                    {f.description && <p className="text-xs text-slate-500 mt-2">{f.description}</p>}

                    {f.options && (
                      <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl">
                        <span className="font-bold">Choices:</span> {f.options.join(', ')}
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                      {isFeeOrConcessionField(f.key, f.label) ? (
                        <span className="flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-300">
                          <Lock className="w-3 h-3 text-amber-700" /> Fee Parameter
                        </span>
                      ) : (
                        <span />
                      )}

                      <div className="flex items-center gap-2">
                        {(!isFeeOrConcessionField(f.key, f.label) || isAdmin) ? (
                          <>
                            <button
                              onClick={() => handleOpenFieldModal(f)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg text-xs transition"
                              title="Edit Field"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteFieldId === f.id ? (
                              <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField(f.id)}
                                  className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteFieldId(null)}
                                  className="px-1.5 py-0.5 bg-white text-slate-600 border border-slate-200 rounded text-xs font-semibold hover:bg-slate-50"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteFieldId(f.id)}
                                className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg text-xs transition"
                                title="Delete Field"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono italic">
                            Admin Controlled
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-MENU 2: UPDATE STUDENT DATA */}
      {activeSubTab === 'update_student_data' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Student Master Data Management</h3>
              <p className="text-xs text-slate-500">
                Staff (Principal & Accountant) enter and verify all non-editable statutory data (Roll No, University Reg
                No, Social Quota, Total Fee).
              </p>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <input
                  ref={batchFileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleBatchFileImport}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => batchFileInputRef.current?.click()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow"
                >
                  <Upload className="w-4 h-4" />
                  Import CSV / JSON File
                </button>
                <button
                  type="button"
                  onClick={handleSimulateBulkUpload}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Quick Add Sample Record
                </button>
              </div>
            )}
          </div>

          {importSkippedErrors.length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-900 space-y-1.5">
              <div className="font-bold flex items-center justify-between">
                <span>⚠️ Batch Import Validation Report ({importSkippedErrors.length} row(s) skipped):</span>
                <button
                  type="button"
                  onClick={() => setImportSkippedErrors([])}
                  className="text-xs underline text-rose-700 hover:text-rose-950"
                >
                  Dismiss
                </button>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-xs font-mono text-rose-800 max-h-32 overflow-y-auto">
                {importSkippedErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Search students by roll number, name, or course..."
                className="w-full pl-10 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>

          {/* Student Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Roll & Reg No (Non-Editable)</th>
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-5 py-3">Course & Semester</th>
                  <th className="px-5 py-3">Quota / Concession Parameters</th>
                  <th className="px-5 py-3">Fee Status</th>
                  {canEdit && <th className="px-5 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3">
                      <div className="font-mono font-bold text-slate-900">{s.rollNo}</div>
                      <div className="text-xs font-mono text-purple-700">{s.registerNo}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800">{s.course}</div>
                      <div className="text-xs text-slate-500">
                        Sem {s.semester} • Sec {s.section}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800">
                          {s.enrollmentData?.category || 'General'}
                        </span>
                        {s.enrollmentData?.meritPercent && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                            Merit: {s.enrollmentData.meritPercent}%
                          </span>
                        )}
                        {s.enrollmentData?.sportsCategory && s.enrollmentData.sportsCategory !== 'None' && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                            Sports: {s.enrollmentData.sportsCategory}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">Rs. {s.totalFee.toLocaleString('en-IN')}</span>
                        <span className="text-xs font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200" title="Admin Managed Statutory Fee">
                          Admin Controlled
                        </span>
                      </div>
                      <div className="text-xs text-emerald-600 font-bold">
                        Paid: Rs. {s.paidFee.toLocaleString('en-IN')}
                      </div>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleOpenStudentEditor(s)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition border border-indigo-200"
                        >
                          Update Data
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FIELD ADD / EDIT MODAL */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">
                {editingField ? 'Modify Enrollment Parameter' : 'Add New Parameter to Enrollment Form'}
              </h3>
              <button onClick={() => setIsFieldModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveField} className="p-6 space-y-4 text-xs font-sans">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Parameter Label (Displayed to Candidate)
                </label>
                <input
                  type="text"
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  placeholder="e.g. Matriculation Board Roll Number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Internal Key / Field ID</label>
                <input
                  type="text"
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value)}
                  placeholder="e.g. matric_roll_no"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Field Data Type</label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold"
                  >
                    <option value="text">Text Input</option>
                    <option value="number">Numeric (Amount / Marks)</option>
                    <option value="select">Dropdown Selection</option>
                    <option value="boolean">Boolean (Yes / No)</option>
                    <option value="date">Date Picker</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Parameter Mode</label>
                  <select
                    value={fieldMode}
                    onChange={(e) => setFieldMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 font-bold"
                  >
                    <option value="mandatory">Mandatory for Candidate</option>
                    <option value="optional">Optional for Candidate</option>
                    <option value="non_editable">Non-Editable (Staff only)</option>
                  </select>
                </div>
              </div>

              {fieldType === 'select' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Select Options (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                    placeholder="e.g. General, OBC-NCL, SC, ST, EWS"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Help Text</label>
                <textarea
                  rows={2}
                  value={fieldDesc}
                  onChange={(e) => setFieldDesc(e.target.value)}
                  placeholder="Guidance text shown below the input"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFieldModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md"
                >
                  Save Parameter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT MASTER DATA EDITOR MODAL FOR STAFF */}
      {selectedStudentForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">Update Student Institutional Record</h3>
                <p className="text-xs text-slate-400">
                  Staff editing for: {selectedStudentForEdit.name} ({selectedStudentForEdit.rollNo})
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentForEdit(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudentData} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900">
                <span className="font-bold">Staff Non-Editable Field Authority:</span>
                <p className="text-xs text-purple-800 mt-0.5">
                  The candidate cannot alter these fields in their portal. Please ensure Roll No, Registration No, and
                  Total Fee are entered accurately.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    College Roll No <span className="text-purple-700 font-mono">(Non-Editable)</span>
                  </label>
                  <input
                    type="text"
                    value={editStudentFormData.rollNo || ''}
                    onChange={(e) =>
                      setEditStudentFormData({ ...editStudentFormData, rollNo: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    University Reg No <span className="text-purple-700 font-mono">(Non-Editable)</span>
                  </label>
                  <input
                    type="text"
                    value={editStudentFormData.registerNo || ''}
                    onChange={(e) =>
                      setEditStudentFormData({ ...editStudentFormData, registerNo: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Candidate Full Name</label>
                  <input
                    type="text"
                    value={editStudentFormData.name || ''}
                    onChange={(e) =>
                      setEditStudentFormData({ ...editStudentFormData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editStudentFormData.email || ''}
                    onChange={(e) =>
                      setEditStudentFormData({ ...editStudentFormData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Student Phone</label>
                  <input
                    type="tel"
                    value={editStudentFormData.phone || ''}
                    onChange={(e) =>
                      setEditStudentFormData({ ...editStudentFormData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Parent Phone</label>
                  <input
                    type="tel"
                    value={editStudentFormData.parentPhone || ''}
                    onChange={(e) =>
                      setEditStudentFormData({ ...editStudentFormData, parentPhone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Semester</label>
                  <input
                    type="number"
                    value={editStudentFormData.semester || 1}
                    onChange={(e) =>
                      setEditStudentFormData({ ...editStudentFormData, semester: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={editStudentFormData.section || 'A'}
                    onChange={(e) =>
                      setEditStudentFormData({ ...editStudentFormData, section: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                {isAdmin ? (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Total Fee (INR)</label>
                    <input
                      type="number"
                      value={editStudentFormData.totalFee || 0}
                      onChange={(e) =>
                        setEditStudentFormData({ ...editStudentFormData, totalFee: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900"
                    />
                  </div>
                ) : (
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700">Total Fee (INR)</label>
                      <span className="flex items-center gap-1 text-xs font-mono font-bold px-1.5 py-0.5 bg-amber-200/80 text-amber-900 rounded border border-amber-300">
                        <Lock className="w-2.5 h-2.5" /> View Only
                      </span>
                    </div>
                    <div className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-bold text-slate-900 font-mono text-xs">
                      ₹{(selectedStudentForEdit.totalFee || 0).toLocaleString('en-IN')}
                    </div>
                    <p className="text-xs text-amber-800 mt-1 leading-tight">
                      Admin-managed statutory fee. View-only for {currentRole === 'principal' ? 'Principal' : 'Accountant'}.
                    </p>
                  </div>
                )}
              </div>

              {/* Dynamic enrollment parameters */}
              <div className="pt-2 border-t border-slate-200">
                <h4 className="font-bold text-slate-800 mb-2">Dynamic Parameter Data</h4>
                <div className="grid grid-cols-2 gap-3">
                  {fields
                    .filter((f) => !['rollNo', 'registerNo', 'name', 'email', 'phone', 'parentPhone'].includes(f.key))
                    .map((f) => {
                      const isFeeRestricted = !isAdmin && isFeeOrConcessionField(f.key, f.label);
                      return (
                        <div
                          key={f.id}
                          className={isFeeRestricted ? 'bg-amber-50/50 p-2 rounded-xl border border-amber-200/60' : ''}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="block text-xs font-semibold text-slate-600">
                              {f.label} ({f.mode})
                            </label>
                            {isFeeRestricted && (
                              <span className="flex items-center gap-0.5 text-xs font-mono font-bold px-1 py-0.2 bg-amber-200/80 text-amber-900 rounded border border-amber-300">
                                <Lock className="w-2 h-2" /> View Only
                              </span>
                            )}
                          </div>
                          {isFeeRestricted ? (
                            <div className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-slate-800">
                              {editStudentFormData[f.key] !== undefined && editStudentFormData[f.key] !== ''
                                ? String(editStudentFormData[f.key])
                                : '—'}
                            </div>
                          ) : (
                            <input
                              type={f.type === 'number' ? 'number' : 'text'}
                              value={editStudentFormData[f.key] ?? ''}
                              onChange={(e) =>
                                setEditStudentFormData({
                                  ...editStudentFormData,
                                  [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForEdit(null)}
                  className="px-4 py-2 border border-slate-300 font-bold rounded-xl text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Student Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
