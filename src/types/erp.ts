export type BuiltInRole = 'superadmin' | 'principal' | 'accountant' | 'faculty' | 'student';
export type UserRole = BuiltInRole | string;

export interface CustomRoleDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  badgeColor: 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose' | 'indigo' | 'blue' | 'slate' | string;
  allowedModules: ModuleKey[];
  createdAt: string;
  createdBy: string;
  isSystem?: boolean;
}

export interface CollegeProfile {
  name: string;
  shortName: string;
  address: string;
  affiliation: string;
  establishmentDate: string;
  commencementDate: string;
  naacGrade: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  chancellorName?: string;
  tagline?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  mobile: string;
  password: string;
  name: string;
  role: UserRole;
  salt?: string;
  mustChangePassword: boolean;
  onboardedBy?: string;
  createdAt: string;
  designation?: string;
  department?: string;
  rollNo?: string;
  studentId?: string;
  facultyId?: string;
  taggedModules?: ModuleKey[];
  hasGatewayReconciliationAccess?: boolean;
  canProcessServiceRequests?: boolean;
  sessionVersion?: number;
  isActive?: boolean;
  status?: 'active' | 'suspended';
  authProvider?: 'google' | 'password';
  googleSubjectId?: string;
  resetToken?: string;
  tempPassword?: string;
}

export type ModuleKey =
  | 'overview'
  | 'attendance'
  | 'fees'
  | 'campaigns'
  | 'grades'
  | 'faculty_portal'
  | 'student_portal'
  | 'enrollment'
  | 'teacher_mapping'
  | 'college_profile'
  | 'user_management'
  | 'congratulations'
  | 'stream_mapping'
  | 'marksheet_designer'
  | 'certificate_designer'
  | 'student_promotion'
  | 'reconciliation_3way'
  | 'accountant_requests'
  | 'reports'
  | 'role_permissions'
  | 'admin_settings'
  | 'grade_settings';

export interface CongratulationMessage {
  id: string;
  rollNo: string;
  studentName: string;
  title: string;
  message: string;
  category:
    | 'Academic Excellence'
    | 'Sports Achievement'
    | 'Research & Innovation'
    | 'Cultural'
    | 'Leadership'
    | 'Placement & Career'
    | 'Special Honor';
  badge: string;
  awardedByRole: 'faculty' | 'principal' | 'superadmin';
  awardedByName: string;
  awardedByDesignation?: string;
  date: string;
}

export type ModulePermissionMap = Record<UserRole, ModuleKey[]>;

export interface EnrollmentField {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'date';
  options?: string[]; // for select type
  mode: 'mandatory' | 'optional' | 'non_editable';
  description?: string;
  defaultValue?: string | number | boolean;
  isCore?: boolean;
}

export interface ConcessionRule {
  id: string;
  title: string;
  parameterKey: string;
  conditionType: 'greater_than' | 'less_than' | 'equals';
  conditionValue: string | number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  description: string;
  active: boolean;
}

export interface CourseFeeBreakdown {
  course: string;
  streamCode: string;
  headAmounts: Record<string, number>; // feeHeadId -> amount
  concessionRuleIds?: string[];
  totalCourseFee: number;
}

export interface FeeCampaign {
  id: string;
  title: string;
  streamCode: string;
  course: string;
  courses?: string[];
  courseBreakdowns?: CourseFeeBreakdown[];
  feeHeadAmounts?: Record<string, number>;
  semesterOrAnnualFY: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  lateFeeStartDate?: string; // YYYY-MM-DD
  lateFeeAmount: number;
  feeHeadIds: string[];
  totalCampaignFee: number;
  status: 'Active' | 'Upcoming' | 'Completed' | 'Extended';
  createdAt: string;
  createdBy: string;
  extensionHistory: Array<{
    previousEndDate: string;
    newEndDate: string;
    extendedAt: string;
    extendedBy: string;
    reason?: string;
  }>;
}

export interface StreamCourseSubject {
  id: string;
  streamCode: string;
  streamName: string;
  course: string;
  semester: number;
  subjectCode: string;
  subjectName: string;
  credits: number;
  category?: 'Core' | 'Elective' | 'Lab' | 'Project' | 'Seminar' | 'Extracurricular';
  prerequisiteCode?: string;
  isNonCgpa?: boolean;
}

export interface GradingScaleRule {
  letter: string;
  minPercentage: number;
  gradePoint: number;
  description: string;
  isPassing: boolean;
}

export interface DegreeDivisionRule {
  id: string;
  divisionName: string;
  minPercentage: number;
  minCgpa: number;
  description: string;
  isPassing: boolean;
}

export interface MarksheetConfig {
  institutionName: string;
  autonomousTag: string;
  address: string;
  naacGrade: string;
  controllerName: string;
  controllerDesignation: string;
  publishDate: string;
  scaleMatrixDescription: string;
  examCellSealText: string;
  verifiedByText: string;
  gradingScaleRules?: GradingScaleRule[];
  degreeDivisionRules?: DegreeDivisionRule[];
  isDuplicateWatermark?: boolean;
  version?: number;
  versionTimestamp?: string;
}

export interface StudentPromotionRecord {
  id: string;
  streamCode: string;
  course: string;
  subject?: string;
  fromSemester: number;
  toSemester: number;
  promotedRollNos: string[];
  promotedCount: number;
  promotedBy: string;
  promotedAt: string;
  ineligibleStudents?: Array<{ rollNo: string; name?: string; reason: string }>;
  previousSnapshots?: Array<{
    studentId: string;
    rollNo: string;
    semester: number;
    status?: string;
    academicStatus?: string;
    totalFee: number;
    paidFee: number;
    pendingFee: number;
    hallTicketBlocked?: boolean;
    blockReason?: string;
    enrollmentData?: StudentEnrollmentAttributes;
  }>;
  promotedAtIso?: string;
  overrideApplied?: boolean;
  overrideReason?: string;
  overrideById?: string;
  overrideByRole?: string;
  overrideByName?: string;
  revertedAt?: string;
}

export interface FacultyMapping {
  id: string;
  facultyId: string;
  facultyName: string;
  facultyEmail: string;
  course: string;
  streamCode: string;
  semester: number;
  section: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  roomNo: string;
  timeSlot: string;
  academicYear: string;
  assignedDate: string;
  active: boolean;
  previousFacultyName?: string;
}

export interface StudentEnrollmentAttributes {
  dob?: string;
  phone?: string;
  course?: string;
  semester?: number;
  category?: string;
  meritPercent?: number;
  annualIncome?: number;
  sportsCategory?: string;
  bloodGroup?: string;
  hostelRequired?: boolean;
  busRequired?: boolean;
  previousSchool?: string;
  guardianOccupation?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface Student {
  id: string;
  rollNo: string;
  registerNo: string;
  name: string;
  email: string;
  phone: string;
  parentPhone: string;
  course: string;
  streamCode: string;
  semester: number;
  section: string;
  batchYear: string;
  avatarUrl?: string;
  totalFee: number;
  paidFee: number;
  pendingFee: number;
  concessionApplied?: string;
  concessionAmount?: number;
  hallTicketBlocked: boolean;
  manualHallTicketBlocked?: boolean;
  manualBlockReason?: string;
  isStatutoryAttendanceLock?: boolean;
  attendanceStatus?: 'normal' | 'defaulter' | 'unverified';
  blockReason?: string;
  attendancePercentage: number;
  busUser?: boolean;
  hostelResident?: boolean;
  dob?: string;
  gender?: string;
  casteCategory?: string;
  status?: 'active' | 'suspended' | 'alumni' | string;
  academicStatus?: string;
  feeDue?: number;
  enrollmentData: StudentEnrollmentAttributes; // strongly-typed enrollment fields schema
}

export interface AssignedSubject {
  subjectCode: string;
  subjectName: string;
  course: string;
  semester: number;
  credits: number;
  room: string;
  timeSlot: string;
  totalClassesScheduled: number;
  syllabusCompletion: number; // 0 to 100%
}

export interface Faculty {
  id: string;
  facultyId: string;
  name: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  assignedSubjects: AssignedSubject[];
  leavesRemaining: number;
}

export interface CourseSectionConfig {
  id: string;
  course: string;
  semester: number;
  sectionName: string; // e.g. "Section A", "Section B"
  isActive: boolean; // Sections are deactivated by default
  maxCapacity?: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentRollNo: string;
  studentName: string;
  course: string;
  semester: number;
  section?: string;
  subjectCode: string;
  subjectName: string;
  date: string; // YYYY-MM-DD
  periodSlot?: string; // e.g., 'Period 1 (09:00 - 10:00)' - Tracks one record per class session
  status: 'present' | 'absent' | 'late' | 'excused';
  markedByFacultyId: string;
  facultyName?: string;
  remarks?: string;
}

export interface FeeHead {
  id: string;
  title: string;
  category: 'Tuition' | 'Examination' | 'Laboratory' | 'Library' | 'Development' | 'Hostel' | 'Transport';
  amount?: number;
  code?: string;
  description?: string;
  dueDate?: string;
  isLockedInCampaign?: boolean;
}

export interface FeeTransaction {
  id: string;
  receiptNo: string;
  studentId: string;
  studentRollNo: string;
  studentName: string;
  course: string;
  semester: number;
  amount: number;
  feeHeadId?: string;
  feeHeadTitle: string;
  paymentMethod: 'UPI' | 'Card' | 'NetBanking' | 'Cash' | 'DD';
  status: 'Success' | 'Pending' | 'Failed';
  referenceNo: string;
  timestamp: string;
  isoTimestamp?: string;
  campaignId?: string;
  remarks?: string;
}

export interface ExamGradeRecord {
  id: string;
  studentId: string;
  studentRollNo: string;
  studentName: string;
  course: string;
  semester: number;
  subjectCode: string;
  subjectName: string;
  credits: number;
  internalMarks: number; // max 30 or faculty configured
  maxInternalMarks: number;
  externalMarks: number; // max 70 or faculty configured
  maxExternalMarks: number;
  totalMarks: number;
  maxMarks: number;
  letterGrade: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'P' | 'F' | string;
  gradePoint: number;
  status: 'Draft' | 'Submitted' | 'Published';
  facultyPublished?: boolean; // Teacher published their tagged course result
  facultyPublishedAt?: string;
  publishedByFacultyId?: string;
  financialYear?: string; // e.g. '2026-2027'
  headValues?: Record<string, string | number>; // headId -> value (numeric or dropdown option)
  examSession: string; // e.g., 'Autumn 2026'
  evaluationDate: string;
  evaluatedByFacultyId?: string;
  graceApplied?: number;
  revisionHistory?: Array<{
    previousMarks: number;
    newMarks: number;
    modifiedBy: string;
    modifiedAt: string;
    reason?: string;
  }>;
}

export interface GradeEvaluationHead {
  id: string; // unique identifier
  name: string; // display title
  type: 'number' | 'dropdown';
  dropdownOptions?: string[]; // options if type is dropdown
  defaultValue?: string | number; // admin defined default
  maxMarks?: number; // administrative configured ceiling
  minPassingMarks?: number;
  sequence: number; // display order in evaluation grid
  isSystemHead?: boolean;
}

export type HeadEvaluationFormat = 'marks' | 'grades_only' | 'remarks' | 'dropdown';

export interface ExamTypeConfig {
  id: string;
  name: string; // e.g. "Annual Final Examination", "Unit Test 1", "Half-Yearly Examination", "Practical Assessment", "Olympiad"
  code: string; // e.g. "ANNUAL", "UT1", "HY", "PRAC", "OLYMP"
  description: string;
  academicYear: string; // e.g. "2026-2027"
  showInStudentMarksheet: boolean; // toggle: if true, appears in main Marksheet menu; if false, goes to "Other Exams"
  enabled: boolean; // admin can enable/disable
  category?: string; // e.g. "Main Examination" | "Periodic Evaluation" | "Auxiliary Assessment"
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExamEvaluationHead {
  id: string;
  examTypeId: string; // linked to specific ExamTypeConfig
  name: string; // e.g. "Theory", "Practical", "Oral", "Internal Assessment", "Grades only", "Remarks"
  format: HeadEvaluationFormat;
  maxMarks: number; // e.g. 70, 20, 10
  passingMarks: number; // e.g. 28, 8, 4
  dropdownOptions?: string[]; // options for dropdown / grades
  sequence: number; // display order
  isRequired: boolean;
  description?: string;
}

export interface CompactAuditLog {
  lastModifiedByFacultyName: string;
  lastModifiedByFacultyId?: string;
  lastModifiedAt: string; // ISO date-time or formatted string
}

export type ExamEvaluationStatus = 'Draft' | 'Submitted_For_Review' | 'Approved_Published' | 'Revision_Requested';

export interface StudentExamEvaluation {
  id: string;
  examTypeId: string;
  studentId: string;
  studentRollNo: string;
  studentName: string;
  course: string;
  semester: number;
  section?: string;
  subjectCode: string;
  subjectName: string;
  credits?: number;
  facultyId?: string;
  facultyName?: string;
  headValues?: Record<string, number | string>; // headId -> score or string value
  headScores?: Record<string, number | string>; // alias for head scores mapping
  totalMarks?: number;
  totalMarksObtained?: number;
  maxMarks?: number;
  maxPossibleMarks?: number;
  letterGrade?: string;
  overallGrade?: string;
  gradePoint?: number;
  attendancePercent?: number; // teacher entered attendance %
  attendancePercentage?: number;
  coScholasticItems?: Record<string, string>; // e.g. { "Discipline": "A+", "Work Habits": "A" }
  coScholasticRating?: 'Exemplary' | 'Proficient' | 'Satisfactory' | 'Needs Improvement' | string;
  remarks?: string;
  teacherRemarks?: string;
  principalRemarks?: string;
  status: ExamEvaluationStatus;
  submittedAt?: string;
  approvedAt?: string;
  approvedByPrincipalName?: string;
  revisionNotes?: string;
  lastAudit?: CompactAuditLog;
  auditLog?: CompactAuditLog;
  graceApplied?: number;
  revisionHistory?: Array<{
    previousMarks: number;
    newMarks: number;
    modifiedBy: string;
    modifiedAt: string;
    reason?: string;
  }>;
}

export interface FacultySubjectGradeConfig {
  subjectCode: string;
  course: string;
  semester: number;
  facultyId: string;
  maxMarksPerHead: Record<string, number>; // headId -> maxMarks
  totalMaxMarks: number;
}

export interface GradeUnlockRequest {
  id: string;
  declarationId?: string;
  semester: number;
  course: string;
  subjectCode?: string;
  requestedById?: string;
  requestedByName?: string;
  requestedBy?: string;
  requestedByRole?: string;
  reason: string;
  requestedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Revoked';
  reviewedByName?: string;
  reviewedById?: string;
  reviewedByRole?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  expiresAt?: string;
  isConsumed?: boolean;
  consumedAt?: string;
  revokedById?: string;
  revokedByName?: string;
  revokedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  module?: 'fees' | 'grades' | 'promotion' | 'rbac' | 'auth' | 'backup' | 'marksheet' | string;
  action: string;
  targetId?: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

export interface SemesterResultDeclaration {
  id: string;
  financialYear: string; // e.g. '2026-2027', '2025-2026'
  semester: number; // 1 to 8
  course: string; // e.g. 'All Courses' or course name
  declarationDate: string; // YYYY-MM-DD
  declaredByRole: 'principal' | 'accountant' | 'superadmin';
  declaredByName: string;
  declaredAt: string;
  remarks?: string;
  isPublished?: boolean;
  publishedAt?: string;
  publishedBy?: string;
  unpublishedAt?: string;
  unpublishedBy?: string;
  updatedAt?: string;
  updatedByName?: string;
  updatedByRole?: string;
  lockOverrideReason?: string;
  lockOverriddenById?: string;
  status?: 'Scheduled' | 'Published' | 'Embargoed';
  isLocked?: boolean;
  unlockedUntil?: string;
  unlockApprovedBy?: string;
  unlockRequests?: GradeUnlockRequest[];
}

export interface TimetableSlot {
  id: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  startTime?: string;
  endTime?: string;
  course: string;
  semester: number;
  section: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string;
  facultyName: string;
  roomNo: string;
}

export interface HelpdeskTicket {
  id: string;
  ticketNo: string;
  studentId: string;
  studentName: string;
  studentRollNo: string;
  category: 'Fee Dispute' | 'Attendance Rectification' | 'Grade Re-evaluation' | 'Hall Ticket Issue' | 'General';
  subject: string;
  message: string;
  status: 'Open' | 'In_Review' | 'Resolved';
  priority: 'High' | 'Medium' | 'Low';
  createdAt: string;
  responseNote?: string;
  respondedBy?: string;
  resolvedAt?: string;
  raisedByName?: string;
}

export interface InstitutionalNotice {
  id: string;
  title: string;
  category: 'Academic' | 'Examination' | 'Fees' | 'Attendance' | 'General';
  content: string;
  authorName: string;
  authorRole: string;
  date: string;
  isPinned?: boolean;
  targetAudience?: 'all' | 'students' | 'staff';
  targetCourse?: string;
  targetCourses?: string[];
  targetSemesters?: number[];
  endDate?: string;
  archived?: boolean;
}

export interface ServiceTariff {
  id: string;
  serviceCode: string;
  title: string;
  description: string;
  amount: number;
  gstPercentage?: number;
  deliveryDays: number;
  status: 'active' | 'suspended';
  applicableCourses?: string[];
}

export interface ServiceRequestItem {
  id: string;
  requestNo: string;
  studentId: string;
  studentRollNo: string;
  studentEmail?: string;
  studentName: string;
  studentCourse: string;
  studentSemester: number;
  serviceId: string;
  serviceTitle: string;
  baseAmount?: number;
  gstAmount?: number;
  amountPaid: number;
  paymentStatus: 'Paid' | 'Pending' | 'Failed' | 'Gratis';
  transactionRef: string;
  requestDate: string; // YYYY-MM-DD
  status: 'Submitted' | 'In_Review' | 'Approved' | 'Issued' | 'Rejected';
  remarks?: string;
  issuedDate?: string;
  issuedBy?: string;
  certificateNumber?: string;
  completedDate?: string;
  completedBy?: string;
  archived?: boolean;
}

export interface Reconciliation3WayRecord {
  id: string;
  transactionDate: string;
  rollNo: string;
  studentName: string;
  course: string;
  erpAmount: number;
  gatewayRef: string;
  gatewayAmount: number;
  gatewayStatus: 'Success' | 'Settled' | 'Pending' | 'Failed';
  gatewayFee: number;
  bankUTR: string;
  bankCreditAmount: number;
  bankValueDate: string;
  reconciliationStatus: 'Matched' | 'Gateway_Pending' | 'Bank_Variance' | 'Unreconciled';
  varianceAmount: number;
  notes?: string;
}

export type CertificateTemplateType = 'clearance' | 'marksheet' | 'appreciation';
export type CeremonialBorderStyle = 'victorian_gold' | 'guilloche_academic' | 'ornate_classic' | 'minimal_modern';
export type StateSealStyle = 'state_emblem' | 'gold_embossed' | 'royal_insignia' | 'minimal_crest';

export interface CertificateDesignConfig {
  templateType: CertificateTemplateType;
  institutionName: string;
  institutionSubtitle: string;
  affiliationText: string;
  accreditationText: string;
  address: string;
  logoUrl: string;
  borderStyle: CeremonialBorderStyle;
  sealStyle: StateSealStyle;
  goldFoilTypography: boolean;
  statutoryWatermarkText: string;
  showWatermark: boolean;
  controllerName: string;
  controllerDesignation: string;
  principalName: string;
  principalDesignation: string;
  signatureUrl?: string;
  principalSignatureUrl?: string;
  sealImageUrl?: string;
  publishDate: string;
  showPublishDate: boolean;
  scaleMatrixDescription: string;
  version?: number;
  versionTimestamp?: string;
}

export interface ReportParameterDef {
  id: string;
  key: string;
  label: string;
  type?: 'gender' | 'caste' | 'course' | 'status' | 'semester' | 'fee_status' | string;
  enabled: boolean;
  options: string[];
}

export interface ReportTypeDefinition {
  id: string;
  name?: string;
  title: string;
  description: string;
  category: 'Enrollment' | 'Financial' | 'Academic' | 'Demographic' | string;
  availableParameters?: string[];
  parameters?: string[];
  createdAt: string;
}

export interface PaymentGatewayConfig {
  provider: 'Razorpay' | 'HDFC SmartGateway' | 'PayU' | 'BillDesk' | 'SBI ePay' | string;
  environment: 'sandbox' | 'production';
  merchantId: string;
  apiKey: string;
  webhookUrl: string;
  currency?: string;
  mode?: 'sandbox' | 'live';
  autoReconcile?: boolean;
}

export interface SupportTicket {
  id: string;
  raisedByUserId?: string;
  studentId?: string;
  studentRollNo?: string;
  raisedByName: string;
  raisedByRole: string;
  category: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  adminNotes?: string;
  resolvedAt?: string;
}

export interface SystemSettingsConfig {
  attendanceThreshold: number;
  minAttendanceThreshold: number; // default 75
  attendanceDefaulterAction?: 'block_hall_ticket' | 'warning_only' | 'guardian_sms';
  paymentGateway: PaymentGatewayConfig;
  supportTickets?: SupportTicket[];
  courseSections?: CourseSectionConfig[];
  gradeEvaluationHeads?: GradeEvaluationHead[];
  resultDeclarations?: SemesterResultDeclaration[];
  maxServiceTariffFee?: number; // Configurable upper limit ceiling for service clearance fees
  maxHallTicketFeeDue?: number; // Configurable hall-ticket pending dues ceiling (default Rs. 1000)
}
