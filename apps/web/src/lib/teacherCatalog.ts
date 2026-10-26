import { buildAddProgramScreenForm } from "./addProgramForm";
import { buildAddSessionScreenForm } from "./addSessionForm";
import { SCHEDULING_SCREENS } from "@/lib/teacherSchedulingScreens";

export type TeacherArchetype =
  | "dashboard"
  | "profileBio"
  | "profileTopics"
  | "availability"
  | "compensation"
  | "schedule"
  | "settings"
  | "security"
  | "accomplishments"
  | "courseList"
  | "courseDetail"
  | "courseMgmt"
  | "activeCourses"
  | "modulesBoard"
  | "announcements"
  | "versionEditor"
  | "evaluations"
  | "repository"
  | "pendingSchedules"
  | "courseHistory"
  | "hccMyCourses"
  | "hccEvaluations"
  | "hccCourseHistory"
  | "hccGradesSubmission"
  | "hccPendingGrades"
  | "hccAttendance"
  | "hccStudents"
  | "hccFlags"
  | "hccEmpty"
  | "hccRepository"
  | "hccPendingSchedules"
  | "hccTranscriptPending"
  | "hccBadges"
  | "hccCourseResources"
  | "programSettings"
  | "table"
  | "form"
  | "cards"
  | "splitPane"
  | "lectures"
  | "lectureReview"
  | "labSession"
  | "approval"
  | "modal"
  | "aiStudio"
  | "studioGeneration"
  | "outcomeMapping"
  | "questionGenerator"
  | "rubricGenerator"
  | "messages"
  | "notifications"
  | "timetable"
  | "fileManager"
  | "helpSupport"
  | "attendanceSession"
  | "attendanceReview"
  | "assessmentBuilder"
  | "gradingSchemes"
  | "programTypes"
  | "manageTerms"
  | "coursesSessions"
  | "courseAdmin"
  | "pendingGrades"
  | "workshops"
  | "workshopDetail"
  | "workshopEnrolments"
  | "workshopAttendance"
  | "studentsDirectory"
  | "studentDetail"
  | "hub"
  | "facultiesPrograms"
  | "programSettings"
  | "grades"
  | "scheduler"
  | "calendar"
  | "syllabusDiff"
  | "authGate"
  | "alertList"
  | "gradebook"
  | "statusFilter"
  | "assessmentHub"
  | "masterScheduling"
  | "academicCalendars"
  | "courseTextbooks"
  | "contentRepository"
  | "courseConfigurations"
  | "courseTypes"
  | "reviewTerm"
  | "scheduleManage";

export type CourseLmsMoreId =
  | "competencies"
  | "competency-breakdown"
  | "filters"
  | "logs"
  | "live-logs"
  | "activity-report"
  | "course-participation"
  | "reports"
  | "settings"
  | "groups"
  | "question-bank"
  | "reuse";

export type CourseLmsQuestion = {
  id: string;
  type: string;
  typeCode: string;
  text: string;
  name: string;
  status: string;
  version: string;
  createdByFirst: string;
  createdByLast: string;
  date: string;
  comments: number;
  needsChecking: string;
  facilityIndex: string;
  discriminativeEfficiency: string;
  usage: number;
  mark?: string;
  feedback?: string;
  answers?: string[];
  correct?: number;
  trueFalse?: string;
  shortAnswer?: string;
  pairs?: Array<{ q: string; a: string }>;
};

export type CourseLmsGroup = {
  id: string;
  name: string;
  members: Array<{ id: string; name: string }>;
};

/** Auto-graded quiz with its answer key; only ever present in staff payloads. */
export type LmsQuizData = {
  code: string;
  minutes: number;
  questions: Array<{ id: string; text: string; options: string[]; answer: number; rationale?: string; lessonId?: string | null }>;
};

export type LmsAssignmentSettings = {
  instructions?: string;
  availableFrom?: string;
  dueAt?: string;
  cutoffAt?: string;
  gradeBy?: string;
  maxScore?: number;
  weightPercent?: number;
  fileSubmissions?: boolean;
  onlineText?: boolean;
  maxFiles?: number;
  maxFileBytes?: number;
  acceptedTypes?: string;
};

export type CourseLmsState = {
  session: string;
  location: string;
  ended?: boolean;
  endedMessage?: string;
  finalMarksLabel?: string;
  finalMarksHref?: string;
  moreMenu: Array<{ id: CourseLmsMoreId; label: string }>;
  topics: Array<{
    id: string;
    title: string;
    summary?: string;
    accessRestrictions?: string;
    activities: Array<{
      id?: string;
      type: string;
      name: string;
      note?: string;
      body?: string;
      fileName?: string;
      fileId?: string;
      fileSize?: number;
      modified?: string;
      hidden?: boolean;
      joinUrl?: string | null;
      storyboard?: import("@/lib/aiDraftSamples").AiDraftStoryboard;
      description?: string;
      url?: string;
      settings?: Record<string, string>;
      assignmentId?: string;
      assignment?: LmsAssignmentSettings;
      quiz?: LmsQuizData;
    }>;
  }>;
  activityTypes?: Array<{ code: string; label: string; kind: string }>;
  gradeColumns: string[];
  gradeWeights?: string[];
  gradeEmpty?: string;
  /** Live gradebook for the section (enrolled students × assignments); replaces the template columns when present. */
  gradeBoard?: {
    assignments: Array<{ id: string; title: string; weightPercent: number; maxScore: number; submitted: number }>;
    rows: Array<{
      studentId: string;
      name: string;
      studentNumber: string;
      cells: Array<{ assignmentId: string; mark: string; status: string }>;
      total: string;
    }>;
    gradebookHref: string;
    submissionsHref: string;
  };
  attendanceDates?: string[];
  evaluationRows?: Array<{ component: string; weight: string }>;
  logParticipants?: string[];
  reporting?: {
    generatedAt: string;
    logs: Array<{
      id: string;
      at: string;
      participant: string;
      action: string;
      activity: string;
      source: string;
      detail?: string;
    }>;
    activities: Array<{
      id: string;
      name: string;
      type: string;
      completions: number;
      submissions: number;
      attempts: number;
      responses: number;
      lastActivityAt?: string;
    }>;
    participation: Array<{
      studentId: string;
      name: string;
      studentNumber: string;
      status: string;
      completed: number;
      submissions: number;
      quizAttempts: number;
      choiceResponses: number;
      lastActivityAt?: string;
    }>;
    competencies: Array<{
      id: string;
      name: string;
      resource: string;
      linkedActivities: number;
      participants: number;
      completed: number;
      progressPercent: number;
    }>;
  };
  questionBank: {
    category: string;
    categoryHelp: string;
    categories: Array<{ label: string; value: string }>;
    showQuestionText: boolean;
    showSubcategories: boolean;
    showOld: boolean;
    pageSize: number;
    totalPages: number;
    questions: CourseLmsQuestion[];
  };
  groups: CourseLmsGroup[];
  availableUsers: Array<{ id: string; name: string }>;
  competencies: Array<{ id: string; name: string; resource?: string }>;
  competencyEmpty: string;
  badges: Array<{ id: string; name: string; version?: string; language?: string }>;
  badgeForm: {
    issuerName: string;
    issuerContact: string;
    languages: Array<{ label: string; value: string }>;
    imageTypes: string[];
  };
};

export type TeacherBadgeTone =
  | "active"
  | "review"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "success"
  | "draft";

export type TeacherScreenConfig = {
  path: string;
  figmaId: string;
  title: string;
  subtitle: string;
  breadcrumbs: string[];
  activeHref: string;
  archetype: TeacherArchetype;
  shell?: "campus" | "studio";
  primaryAction?: string;
  primaryActionHref?: string;
  secondaryAction?: string;
  secondaryActionHref?: string;
  searchPlaceholder?: string;
  filters?: string[];
  countLabel?: string;
  emptyMessage?: string;
  columns?: string[];
  columnTemplate?: string;
  rows?: Array<{
    cells: string[];
    primary?: string;
    secondary?: string;
    badge?: string;
    badgeTone?: TeacherBadgeTone;
    href?: string;
    action?: string;
  }>;
  kpis?: Array<{
    label: string;
    value: string;
    hint: string;
    tone?: "up" | "danger" | "muted" | "highlight";
  }>;
  dashboard?: {
    greeting: string;
    name: string;
    meta: string;
    statusBadge: string;
    quickActions: Array<{ label: string; href: string; variant?: "primary" | "secondary" | "ai" }>;
    timetable: Array<{
      time: string;
      code: string;
      title: string;
      room: string;
      status: string;
      statusTone?: TeacherBadgeTone;
      action?: string;
      href?: string;
    }>;
    gradeSubmissions?: Array<{
      code: string;
      sectionCode: string;
      title: string;
      status: string;
      statusTone?: TeacherBadgeTone;
      missing: string;
      href?: string;
    }>;
    announcements: Array<{ title: string; body: string; when: string }>;
    alerts: Array<{ title: string; body: string; tone: "critical" | "warning" | "info" }>;
    officeHours: Array<{ day: string; window: string; mode: string; remaining?: string }>;
    endedCourses?: Array<{ label: string; href: string; sectionId?: string }>;
  };
  profileHeader?: {
    name: string;
    email: string;
    status?: string;
    topics?: string[];
    topicLinks?: Array<{ label: string; href: string }>;
    avatarUrl?: string;
  };
  profileBio?: {
    name: string;
    role: string;
    department: string;
    initials: string;
    staffId: string;
    tabs: Array<{ label: string; href: string; active?: boolean }>;
    personal: Array<{ label: string; value: string }>;
    academic: Array<{ label: string; value: string }>;
    expertise: string[];
    bio: string;
    connect?: { phone: string; email: string };
    education?: { background: string; experience: string; organizations: string };
  };
  profileTopics?: {
    tabs: Array<{ label: string; href: string; active?: boolean }>;
    teaching: string[];
    currentCourses?: string[];
    previousCourses?: string[];
    academicChair?: string[];
    topicLinks?: {
      current?: Array<{ label: string; href: string }>;
      previous?: Array<{ label: string; href: string }>;
      chair?: Array<{ label: string; href: string }>;
    };
    academicLead?: string;
    research: string[];
    certifications: Array<{ name: string; issuer: string; year: string }>;
    teachingSchedule?: Array<{
      course: string;
      code: string;
      title: string;
      delivery: string;
      location: string;
      schedule: string;
      href?: string;
    }>;
  };
  availability?: {
    tabs: Array<{ label: string; href: string; active?: boolean }>;
    slots: Array<{
      id?: string;
      day: string;
      start: string;
      end: string;
      mode: string;
      location: string;
      date?: string;
      repeats?: string;
      endDate?: string;
      note?: string;
      title?: string;
    }>;
    note?: string;
    officeHours?: string;
    generalInfo?: string;
    teachingByDay?: Array<{
      day: string;
      entries: Array<{ course: string; section: string; time: string }>;
    }>;
    scheduleByDate?: Array<{
      date: string;
      course: string;
      section: string;
      time: string;
      href?: string;
    }>;
    calendar?: {
      year: number;
      month: number;
      monthLabel?: string;
      markedDates: string[];
      availabilityDates?: string[];
      scheduleDates?: string[];
    };
  };
  compensation?: {
    tabs: Array<{ label: string; href: string; active?: boolean }>;
    summary: Array<{ label: string; value: string }>;
    payPeriods: Array<{ period: string; amount: string; status: string; tone?: TeacherBadgeTone }>;
    contracts: Array<{ title: string; detail: string; status: string }>;
  };
  schedule?: {
    tabs: Array<{ label: string; href: string; active?: boolean }>;
    weeks: Array<{
      label: string;
      entries: Array<{ day: string; time: string; course: string; room: string }>;
    }>;
    teachingByDay?: Array<{
      day: string;
      entries: Array<{ course: string; section: string; time: string }>;
    }>;
    weekLabel?: string;
    weekStart?: string;
    weekEnd?: string;
    weekDays?: Array<{
      label: string;
      date: string;
      dateLabel?: string;
      entries: Array<{
        kind: string;
        title: string;
        time: string;
        course?: string;
        section?: string;
        location?: string;
        mode?: string;
        note?: string;
        repeats?: string;
        joinUrl?: string;
        sessionTitle?: string;
      }>;
    }>;
    emptyMessage?: string;
  };
  settings?: {
    groups: Array<{
      title: string;
      fields: Array<{ label: string; value: string; hint?: string }>;
    }>;
  };
  security?: {
    mfaEnabled: boolean;
    sessions: Array<{ device: string; location: string; lastActive: string; current?: boolean }>;
    recentActivity: Array<{ event: string; when: string }>;
  };
  accomplishments?: {
    tabs?: Array<{ label: string; href: string; active?: boolean }>;
    stats: Array<{ label: string; value: string }>;
    items: Array<{
      title: string;
      detail: string;
      year: string;
      tone?: TeacherBadgeTone;
      category?: "faculty" | "student";
    }>;
    createBase?: {
      title: string;
      submitLabel: string;
      href?: string;
      groups: Array<{
        title: string;
        fields: Array<{
          label: string;
          value: string;
          type?: string;
          language?: string;
          options?: Array<{ label: string; value: string }>;
        }>;
      }>;
    };
    definitions?: Array<{
      id: string;
      name: string;
      description: string;
      badgeType: string;
      approvalMode: string;
      status: string;
    }>;
  };
  hccMyCourses?: {
    termFilter?: string;
    statusFilter?: string;
    termOptions?: string[];
    statusOptions?: string[];
    courses: Array<{
      id: string;
      code: string;
      section: string;
      title: string;
      role?: string;
      delivery: string;
      students: string;
      status: string;
      statusTone?: TeacherBadgeTone;
      location: string;
      schedule: string;
      href: string;
      term?: string;
      attendanceLabel?: string;
      attendanceTone?: "ok" | "warn" | "muted";
      attendanceHref?: string;
    }>;
  };
  hccEvaluations?: {
    rows: Array<{
      id?: string;
      course: string;
      title: string;
      offering: string;
      evaluation: string;
      dates: string;
      schedule: string;
      href?: string;
    }>;
  };
  hccCourseHistory?: {
    rows: Array<{
      id?: string;
      course: string;
      title: string;
      offering: string;
      room: string;
      dates: string;
      schedule: string;
      instructor?: string;
      term?: string;
      href?: string;
    }>;
    empty?: string;
  };
  hccGradesSubmission?: {
    courseFilter?: string;
    statusFilter?: string;
    courseOptions?: string[];
    statusOptions?: string[];
    rows: Array<{
      id: string;
      course: string;
      title: string;
      offering: string;
      status: string;
      gradingType: string;
      dates: string;
      href: string;
    }>;
  };
  hccPendingGrades?: {
    campusFilter?: string;
    courseFilter?: string;
    facultyFilter?: string;
    campusOptions?: string[];
    courseOptions?: string[];
    facultyOptions?: string[];
    rows: Array<{
      course: string;
      title: string;
      offering: string;
      instructor: string;
      dates: string;
      submittedBy: string;
      submittedAt: string;
      href: string;
    }>;
  };
  hccAttendance?: {
    dateFilter?: string;
    studentFilter?: string;
    courseFilter?: string;
    sectionId?: string;
    centerLabel?: string;
    prevLabel?: string;
    nextLabel?: string;
    primaryAction?: string;
    secondaryAction?: string;
    groups: Array<{
      sectionId?: string;
      course: string;
      title: string;
      offering: string;
      meta: string;
      students: Array<{
        id: string;
        name: string;
        studentNumber: string;
        status: string;
        note: string;
      }>;
    }>;
  };
  hccStudents?: {
    filters: Record<string, string>;
    filterOptions?: Record<string, string[]>;
    filterMenus?: Record<
      string,
      {
        all: string;
        leading?: string[];
        flat?: string[];
        groups?: Array<{
          label: string;
          options: string[];
          sections?: Array<{ heading: string; options: string[] }>;
        }>;
      }
    >;
    perPageOptions?: string[];
    letter?: string;
    sidebar: Array<{ label: string; count: number; href: string; active?: boolean }>;
    management: Array<{ label: string; href: string; count?: number }>;
    results: number;
    perPage: number;
    page: number;
    totalPages?: number;
    rows: Array<{
      id: string;
      name: string;
      studentNumber: string;
      status: string;
      advisors: string;
      program: string;
      programTerm: string;
      admissionTerm: string;
      date: string;
      campus?: string;
      pathway?: string;
      schedule?: string;
      nationality?: string;
      agent?: string;
    }>;
    empty?: string | null;
  };
  hccFlags?: {
    campus?: string;
    status?: string;
    resolved?: string;
    template?: string;
    results: number;
    flagTypes?: string[];
    rows: Array<{
      id: string;
      student: string;
      description: string;
      status: string;
      resolved?: string;
      appliesHold: string;
      date: string;
      canEdit?: boolean;
      href?: string;
    }>;
  };
  hccEmpty?: { empty: string };
  hccRepository?: {
    placeholder?: string;
    rows?: Array<{ name: string; lms: string }>;
    empty?: string;
  };
  hccPendingSchedules?: {
    changeType?: string;
    changeTypeOptions?: string[];
    show?: boolean;
    rows?: Array<{
      id?: string;
      course: string;
      offering?: string;
      title?: string;
      type: string;
      schedule?: string;
      location?: string;
      requested?: string;
      proposer?: string;
      status?: string;
      tone?: TeacherBadgeTone;
      href?: string;
    }>;
    empty?: string;
  };
  hccTranscriptPending?: { banner: string };
  hccBadges?: {
    userFilter?: string;
    badgeFilter?: string;
    statusFilter?: string;
    badgeOptions?: string[];
    statusOptions?: string[];
    rows?: Array<{ id: string; student: string; badge: string; status: string }>;
    definitions?: Array<{
      id: string;
      name: string;
      description: string;
      badgeType: string;
      approvalMode: string;
      status: string;
    }>;
    empty?: string;
  };
  hccCourseResources?: {
    empty?: string;
    categoryCount?: number;
    resourceCount?: number;
    rows?: Array<{ id: string; kind: "category" | "resource"; name: string; meta: string }>;
  };
  programSettings?: {
    programId?: string;
    programName?: string;
    tabs?: string[];
    modal?: string;
    footerDate?: string;
    groups?: Array<{
      title: string;
      fields: Array<{
        label: string;
        value: string;
        type?: string;
        options?: Array<{ label: string; value: string }>;
        unitValue?: string;
        unitOptions?: Array<{ label: string; value: string }>;
        language?: string;
        hint?: string;
        visibleWhen?: string;
        visibleValue?: string;
        prefix?: string;
      }>;
    }>;
    pathway?: {
      identity?: string;
      status?: string;
      selected?: string;
      pathways?: string[];
      columnMode?: "hours" | "credits";
      courses?: Array<{
        id: string;
        code: string;
        name: string;
        hours?: string;
        credits?: string;
        schedule?: string;
        prerequisites?: string;
      }>;
      electives?: Array<{ id: string; course: string; prerequisites: string }>;
      electiveEmpty?: string;
      availableCourses?: Array<{ id: string; label: string }>;
      edit?: {
        type: string;
        name: string;
        abbreviation: string;
        defaultOutline: boolean;
        status: string;
        effectiveDating: boolean;
        tierSettings: string;
        courseSettings: string;
      };
    };
    fees?: Array<{ id: string; type: string; domestic: string; international: string }>;
    feesEmpty?: string;
    deadlines?: Array<{ id: string; condition: string; type: string; penalty: string }>;
    deadlinesEmpty?: string;
    commissions?: Array<{ id: string; calculation: string; condition: string; rates: string }>;
    commissionsEmpty?: string;
    audits?: Array<{
      id: string;
      date: string;
      current?: boolean;
      changedBy: string;
      changes: string;
      canRestore: boolean;
    }>;
    modalData?: {
      addTerm?: { title: string; fields: Array<{ label: string; value: string; type?: string; options?: Array<{ label: string; value: string }>; language?: string }>; submit: string };
      addLedger?: { title: string; fields: Array<{ label: string; value: string; type?: string; options?: Array<{ label: string; value: string }>; prefix?: string }>; submit: string; ledgerId?: string };
      addDeadline?: { title: string; fields: Array<{ label: string; value: string; type?: string; options?: Array<{ label: string; value: string }>; }>; submit: string };
      addCommission?: { title: string; fields: Array<{ label: string; value: string; type?: string; options?: Array<{ label: string; value: string }>; hint?: string }>; submit: string };
      createPathway?: { title: string; fields: Array<{ label: string; value: string; type?: string; options?: Array<{ label: string; value: string }>; }>; submit: string };
      createTier?: { title: string; fields: Array<{ label: string; value: string; type?: string; options?: Array<{ label: string; value: string }>; language?: string; hint?: string }>; submit: string };
      createElectiveGroup?: { title: string; fields: Array<{ label: string; value: string; type?: string; language?: string }>; submit: string };
      auditReview?: { when: string; by: string; field: string; former: string; updated: string } | null;
      assignedRecords?: { studentRecords: number; scheduleRecords: number };
    };
  };
  courseList?: {
    filters: string[];
    searchPlaceholder?: string;
    kpis?: Array<{ label: string; value: string; hint?: string }>;
    week?: Array<{ day: string; time: string; course: string; room: string; href?: string }>;
    courses: Array<{
      id?: string;
      code: string;
      title: string;
      section?: string;
      term: string;
      schedule: string;
      room: string;
      location?: string;
      enrolled: string;
      capacity: string;
      status: string;
      statusTone?: TeacherBadgeTone;
      href: string;
      attendanceHref?: string;
    }>;
  };
  courseDetail?: {
    sectionId?: string;
    code: string;
    title: string;
    meta: string;
    status: string;
    tabs: string[];
    activeTab?: string;
    overview: Array<{ label: string; value: string }>;
    modules: Array<{ title: string; items: number; status: string }>;
    team: Array<{ name: string; role: string; initials: string }>;
    roster?: Array<{
      studentId?: string;
      name: string;
      studentNumber: string;
      program: string;
      standing: string;
      email: string;
    }>;
    attendance?: {
      meetings: Array<{
        label: string;
        present: number;
        absent: number;
        late: number;
        excused: number;
        total: number;
      }>;
      rows: Array<{
        studentId: string;
        name: string;
        studentNumber: string;
        status: string;
        meetingLabel: string;
        recordedAt: string;
      }>;
      markHref?: string;
      emptyMessage?: string;
    };
    assessments?: Array<{ title: string; due: string; maxScore: string; weight: string }>;
    lectures?: Array<{ title: string; when: string; location: string; joinUrl?: string }>;
    labs?: Array<{ title: string; when: string; location: string }>;
    resources?: Array<{ name: string; type: string; meta: string; href?: string }>;
    lms?: CourseLmsState;
  };
  courseMgmt?: {
    tools: Array<{ title: string; detail: string; href: string; badge?: string }>;
  };
  activeCourses?: {
    filters: {
      campus: { label: string; value: string; options: Array<{ label: string; value: string }> };
      course: { label: string; value: string; options: Array<{ label: string; value: string }> };
      term: { label: string; value: string; options: Array<{ label: string; value: string }> };
      student: { label: string; value: string; placeholder: string };
      faculty: { label: string; value: string; options: Array<{ label: string; value: string }> };
    };
    showLabel?: string;
    resultsLabel: string;
    perPageOptions: Array<{ label: string; value: string }>;
    perPage: string;
    pageOptions: Array<{ label: string; value: string }>;
    page: string;
    columns: string[];
    rows: Array<{
      id?: string;
      course: string;
      code?: string;
      section?: string;
      title?: string;
      location: string;
      room?: string;
      instructors: string;
      dates: string;
      enrolment: string;
      viewHref: string;
      attendanceHref: string;
    }>;
  };
  modulesBoard?: {
    course: string;
    items: Array<{
      title: string;
      course: string;
      items: number;
      status: string;
      due?: string;
      href?: string;
    }>;
  };
  announcements?: {
    course: string;
    sectionId?: string | null;
    sections?: Array<{ id: string; label: string; enrolled?: number }>;
    posts: Array<{ title: string; body: string; when: string; audience: string; sectionId?: string | null; pinned?: boolean }>;
  };
  versionEditor?: {
    course: string;
    version: string;
    notice: string;
    outline: Array<{ id: string; label: string; children?: string[] }>;
    editor: { title: string; body: string; wordCount: string };
    versions: Array<{ label: string; when: string; author: string; current?: boolean }>;
  };
  evaluations?: {
    summary: Array<{ label: string; value: string; hint: string }>;
    comments: Array<{ rating: string; text: string; term: string }>;
  };
  repository?: {
    folders: Array<{ name: string; files: number; updated: string }>;
    files: Array<{ name: string; type: string; size: string; updated: string }>;
  };
  pendingSchedules?: {
    requests: Array<{
      course: string;
      requested: string;
      proposer: string;
      status: string;
      tone?: TeacherBadgeTone;
    }>;
  };
  courseHistory?: {
    terms: Array<{
      term: string;
      courses: Array<{ code: string; title: string; enrollment: string; avgEval: string }>;
    }>;
  };
  form?: {
    groups: Array<{
      title: string;
      visibleWhen?: string;
      fields: Array<{
        label: string;
        value: string;
        type?: "text" | "select" | "textarea" | "number" | "checkbox" | "checkboxes" | "date" | "time" | "file" | "weekdays" | "pair";
        options?: Array<{ label: string; value: string; filterKey?: string; group?: string }>;
        unitValue?: string;
        unitOptions?: Array<{ label: string; value: string }>;
        dependsOn?: string;
        visibleWhen?: string;
        prefix?: string;
        hint?: string;
        sublabel?: string;
        language?: string;
        optional?: boolean;
        visibleValue?: string;
        readOnly?: boolean;
      }>;
    }>;
    submitLabel?: string;
    stepLabel?: string;
    warning?: string;
    linkedCourses?: {
      title?: string;
      addLabel?: string;
      emptyLabel?: string;
      courseOptions?: Array<{ label: string; value: string }>;
      rows?: Array<{ id: string; label: string }>;
    };
    customEventDates?: {
      title?: string;
      addLabel?: string;
      events?: Array<{ id: string; name: string; date: string }>;
    };
    enrolmentConditions?: {
      title?: string;
      addLabel?: string;
      emptyMessage?: string;
      disabledNote?: string;
      columns?: string[];
      rows?: Array<{
        id: string;
        enrolmentDates: string;
        programs: string;
        completion: string;
        standing: string;
      }>;
    };
    deadlines?: {
      title?: string;
      addLabel?: string;
      emptyMessage?: string;
      columns?: string[];
      rows?: Array<{ id: string; condition: string; type: string; penalty: string }>;
    };
    weeklyTimings?: {
      title?: string;
      days?: Array<{
        day: string;
        startHour: string;
        startMinute: string;
        finishHour: string;
        finishMinute: string;
      }>;
    };
    examSchedule?: {
      title?: string;
      addLabel?: string;
      exams?: Array<{ id: string; date: string; startTime: string; finishTime: string; location: string }>;
    };
    gradingPreview?: {
      title?: string;
      schemeLabel?: string;
      columns?: string[];
      rows?: Array<{ letter: string; credit: string; condition: string }>;
    };
    tuitionNote?: string;
    designations?: {
      columns: string[];
      addLabel?: string;
      rows?: Array<{ label: string; condition: string; requirement: string }>;
      modal?: {
        title: string;
        submitLabel?: string;
        groups: Array<{
          title: string;
          fields: Array<{
            label: string;
            value: string;
            type?: "text" | "select" | "textarea" | "number" | "checkbox" | "checkboxes" | "date" | "time" | "file" | "weekdays" | "pair";
            options?: Array<{ label: string; value: string; filterKey?: string; group?: string }>;
            unitValue?: string;
            unitOptions?: Array<{ label: string; value: string }>;
            hint?: string;
            sublabel?: string;
            language?: string;
          }>;
        }>;
      };
    };
    /** MySIS grading-scheme grade ladder (Letter / Percent / Grade Point / Credit / Condition). */
    gradeEntries?: {
      addLabel?: string;
      creditOptions?: Array<{ label: string; value: string }>;
      conditionOptions?: Array<{ label: string; value: string }>;
      draft?: {
        letter: string;
        percent: string;
        percentUp: string;
        gradePoint: string;
        credit: string;
        condition: string;
      };
      entries?: Array<{
        letter: string;
        percent: string;
        percentUp: string;
        gradePoint: string;
        credit: string;
        condition: string;
      }>;
    };
  };
  programChangeHistory?: {
    rows: Array<{
      id: string;
      title: string;
      programme: string;
      type: string;
      rationale: string;
      effectiveTerm: string;
      status: string;
      decisionNote: string;
      submittedAt: string;
      updatedAt: string;
      history: Array<{
        at: string;
        action: string;
        status: string;
        actor: string;
        note: string;
      }>;
    }>;
  };
  cards?: {
    items: Array<{
      title: string;
      subtitle: string;
      meta: string;
      badge?: string;
      badgeTone?: TeacherBadgeTone;
      href?: string;
    }>;
  };
  splitPane?: {
    leftTitle: string;
    leftItems: Array<{ label: string; meta: string; active?: boolean }>;
    rightTitle: string;
    rightFields: Array<{ label: string; value: string }>;
    resources?: Array<{ name: string; type: string; size: string }>;
  };
  lectures?: {
    course: string;
    sessions: Array<{
      title: string;
      when: string;
      duration: string;
      status: string;
      tone?: TeacherBadgeTone;
      href?: string;
    }>;
  };
  lectureReview?: {
    title: string;
    sectionId?: string | null;
    meta: string;
    transcript: string;
    highlights: string[];
    aiNotes: string;
  };
  labSession?: {
    course: string;
    labs: Array<{
      title: string;
      when: string;
      room: string;
      capacity: string;
      status: string;
      tone?: TeacherBadgeTone;
      href?: string;
    }>;
  };
  approval?: {
    course: string;
    steps: Array<{ label: string; state: "done" | "current" | "todo" }>;
    summary: Array<{ label: string; value: string }>;
    reviewers: Array<{ name: string; role: string; status: string }>;
    comments: Array<{ author: string; body: string; when: string; role?: string }>;
  };
  syllabusDiff?: {
    badge: string;
    currentTitle: string;
    proposedTitle: string;
    current: Array<{ label: string; value: string }>;
    proposed: Array<{ label: string; value?: string; added?: string; removed?: string }>;
    comments: Array<{ author: string; role: string; when: string; body: string }>;
    emptyMessage?: string;
  };
  workshops?: {
    tabs: string[];
    activeTab: string;
    credits: string;
    cards: Array<{
      tag: string;
      org: string;
      seats: string;
      title: string;
      description: string;
      when: string;
      where: string;
      href?: string;
    }>;
    registrations: Array<{ title: string; when: string }>;
  };
  workshopDetail?: {
    title: string;
    status: string;
    when: string;
    where: string;
    seats: string;
    description: string;
    agenda: string[];
    materials: Array<{ label: string; meta: string }>;
  };
  workshopEnrolments?: {
    studentPlaceholder: string;
    studentValue: string;
    workshopValue: string;
    workshopOptions: Array<{ label: string; value: string }>;
    statusValue: string;
    statusOptions: Array<{ label: string; value: string }>;
    letter: string;
    searchLabel: string;
    emptyMessage: string;
    rows: Array<{
      id: string;
      studentName: string;
      studentNumber: string;
      workshop: string;
      workshopId?: string;
      status: string;
      statusTone?: TeacherBadgeTone;
      enrolledOn: string;
      note?: string;
    }>;
  };
  workshopAttendance?: {
    date: string;
    studentPlaceholder: string;
    studentValue: string;
    workshopValue: string;
    workshopOptions: Array<{ label: string; value: string }>;
    loadLabel: string;
    heading: string;
    previousLabel: string;
    previousDate: string;
    nextLabel: string;
    nextDate: string;
    emptyMessage: string;
    totalLabel: string;
    saveLabel: string;
    weekDates: Array<{ value: string; label: string; active?: boolean }>;
    students: Array<{
      id: string;
      studentId: string;
      workshopId: string;
      workshopTitle?: string;
      name: string;
      studentNumber: string;
      status: "Present" | "Absent";
      note: string;
      avatar?: string;
    }>;
  };
  studentsDirectory?: {
    rosterFilter: string;
    riskFilter: string;
    note: string;
    students: Array<{
      id: string;
      name: string;
      program: string;
      attendance: string;
      gpa: string;
      missing: string;
      risk: string;
      riskTone: TeacherBadgeTone;
    }>;
    drawer: { name: string; meta: string; alert: string; body: string; action: string };
  };
  studentDetail?: {
    name: string;
    meta: string;
    tabs: string[];
    fields: Array<{ label: string; value: string }>;
    alerts: Array<{ title: string; body: string; tone: TeacherBadgeTone }>;
    courses: Array<{ code: string; title: string; grade: string; status: string }>;
    assessments?: Array<{ title: string; course: string; score: string; status: string; due?: string }>;
    requirements?: Array<{ code: string; title: string; credits: string; kind: string; status: string }>;
    flags?: Array<{ title: string; body: string; when: string; tone: TeacherBadgeTone }>;
    leave?: Array<{ title: string; body: string; status: string; when?: string }>;
    alertTypes?: string[];
    priorities?: string[];
  };
  hub?: {
    cards: Array<{ title: string; body: string; href: string; meta?: string }>;
  };
  programDirectory?: {
    title?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    programs?: Array<{
      id: string;
      name: string;
      code: string;
      type: string;
    }>;
  };
  facultiesPrograms?: {
    createFacultyHref?: string;
    createProgramHref?: string;
    faculties?: Array<{
      id: string;
      name: string;
      abbreviation: string;
      active: boolean;
      programs: Array<{
        id: string;
        name: string;
        abbreviation: string;
        active: boolean;
        href?: string;
      }>;
    }>;
  };
  courseConfigurations?: {
    searchPlaceholder?: string;
    courses?: Array<{
      id: string;
      name: string;
      abbreviation: string;
      enrollmentPermission: string;
      syllabusPrivacy: string;
      repositorySettings: string;
      textbookOptOut: string;
      active: boolean;
      href?: string;
    }>;
  };
  gradesQueue?: Array<{
    code: string;
    title: string;
    instructor: string;
    submitted: string;
    enrolled: string;
    distribution: string;
    bars: [number, number, number, number?];
    status: string;
  }>;
  scheduler?: {
    days: string[];
    slots: Array<{
      day: number;
      start: string;
      end: string;
      label: string;
      room: string;
      tone?: "primary" | "muted";
    }>;
  };
  calendarBoard?: {
    months: string[];
    events: Array<{ date: string; label: string; tone?: TeacherBadgeTone }>;
  };
  authGate?: {
    heading: string;
    description: string;
    fieldLabel: string;
    fieldValue: string;
    cta: string;
    ctaHref?: string;
    secondaryCta?: string;
    secondaryHref?: string;
    help: string;
    extraFields?: Array<{ label: string; value: string }>;
  };
  alertList?: {
    badge: string;
    items: Array<{
      id?: string;
      name: string;
      course: string;
      tag: string;
      tagTone: "danger" | "warning" | "info";
      body: string;
      avatar?: string;
      href?: string;
    }>;
  };
  gradebook?: {
    course: string;
    publishLabel: string;
    columns: string[];
    rows: Array<{
      name: string;
      id: string;
      assessments: string[];
      total: string;
      letter: string;
      status: string;
    }>;
    legend?: string[];
    history?: Array<{
      student: string;
      assignment: string;
      score: string;
      status: string;
      when?: string;
    }>;
  };
  statusFilter?: {
    filters: Array<{ label: string; count: string | number; active?: boolean }>;
    columns: string[];
    rows: Array<{
      cells: string[];
      badge?: string;
      badgeTone?: TeacherBadgeTone;
      href?: string;
    }>;
  };
  assessmentHub?: {
    kpis: Array<{ label: string; value: string; hint?: string }>;
    groups: Array<{
      courseCode: string;
      sectionCode: string;
      courseTitle: string;
      count: number;
      items: Array<{
        id: string;
        title: string;
        weight: string;
        due: string;
        status: string;
        statusTone?: TeacherBadgeTone;
        href?: string;
      }>;
    }>;
  };
  modal?: {
    title: string;
    description: string;
    fields: Array<{
      label: string;
      value: string;
      type?: "text" | "select" | "time" | "textarea";
      options?: string[];
      required?: boolean;
    }>;
    confirmLabel: string;
    cancelLabel: string;
    backdropHref?: string;
  };
  aiStudio?: {
    eyebrow: string;
    courseTitle: string;
    version: string;
    drafts: Array<{ version: string; status: string; tone?: TeacherBadgeTone; detail?: string }>;
    tabs: string[];
    activeTab?: string;
    sources: Array<{ name: string; status: string; size?: string }>;
  };
  studioGeneration?: {
    wizardTitle: string;
    badge?: string;
    steps: Array<{ label: string; state: "done" | "current" | "todo" }>;
    progressLabel: string;
    progressPct: number;
    sources: string[];
    cards: Array<{
      kind: string;
      drafted?: string;
      title: string;
      body: string;
      citations: string[];
    }>;
  };
  outcomeMapping?: {
    clos: Array<{ id: string; label: string; coverage: number }>;
    bloomRows: Array<{
      level: string;
      verb?: string;
      tags?: string[];
      cells?: Array<{ tags: string[] }>;
    }>;
  };
  questionGenerator?: {
    topic: string;
    difficulty: string;
    type: string;
    count: string;
    questions: Array<{
      id: string;
      prompt: string;
      options: Array<{ key: string; text: string; correct?: boolean }>;
    }>;
  };
  rubricGenerator?: {
    criteria: Array<{
      name: string;
      weight: string;
      excellent: string;
      proficient: string;
      developing: string;
      beginning: string;
    }>;
  };
  messages?: {
    threads: Array<{
      id: string;
      name: string;
      role: string;
      preview: string;
      unread?: number;
      time: string;
      studentId?: string;
      chat?: Array<
        | { kind: "message"; from: "them" | "me"; text: string; time: string }
        | { kind: "attachment"; name: string; size: string; time: string }
        | { kind: "system"; text: string }
      >;
      context?: {
        program: string;
        grade: string;
        gradePct: string;
        attendance: string;
        attendanceTone: string;
        missing: string;
        sharedFiles: Array<{ name: string; size: string }>;
      };
    }>;
    activeThreadId?: string;
    chat: Array<
      | { kind: "message"; from: "them" | "me"; text: string; time: string }
      | { kind: "attachment"; name: string; size: string; time: string }
      | { kind: "system"; text: string }
    >;
    context: {
      program: string;
      grade: string;
      gradePct: string;
      attendance: string;
      attendanceTone: string;
      missing: string;
      sharedFiles: Array<{ name: string; size: string }>;
    };
  };
  notifications?: {
    filters: Array<{ label: string; count?: number }>;
    termLabel?: string;
    total?: number;
    items: Array<{
      id?: string;
      title: string;
      body: string;
      when: string;
      category: string;
      unread?: boolean;
      tone?: TeacherBadgeTone;
      cta?: string;
      href?: string;
      icon?: string;
    }>;
    pagination: string;
  };
  timetable?: {
    rangeLabel: string;
    termLabel: string;
    views: string[];
    activeView?: string;
    filters: string[];
    days: Array<{
      label: string;
      date: string;
      events: Array<{ id?: string; title: string; time: string; tone: "blue" | "green" | "purple" | "orange" }>;
    }>;
  };
  fileManager?: {
    courseTitle: string;
    breadcrumbs: string[];
    tree: Array<{ name: string; children?: string[]; active?: boolean }>;
    files: Array<{
      name: string;
      type: string;
      size: string;
      updated: string;
      visibility: "Published" | "Hidden";
      selected?: boolean;
      folder?: string;
    }>;
  };
  helpSupport?: {
    topics: Array<{ title: string; detail: string; icon?: string }>;
    tickets: Array<{ id: string; subject: string; status: string; tone?: TeacherBadgeTone; updated?: string }>;
    references: Array<{ name: string; meta: string }>;
    aiReply?: { query: string; answer: string } | null;
    hours?: string;
    contacts?: Array<{ label: string; value: string }>;
  };
  attendanceSession?: {
    alert: string;
    classNode: string;
    dateLabel: string;
    rosterTitle: string;
    draftStatus: string;
    sectionId?: string;
    students: Array<{
      name: string;
      id: string;
      studentId?: string;
      status: "Present" | "Absent" | "Late" | "Excused";
      note: string;
      pct: string;
      atRisk?: boolean;
      avatar?: string;
    }>;
    stats: Array<{ label: string; count: number; pct: string }>;
  };
  attendanceReview?: {
    filters: Array<{ label: string; count: number; active?: boolean }>;
    requests: Array<{
      name: string;
      id: string;
      course: string;
      date: string;
      current: string;
      requested: string;
      reason: string;
      attachment: string;
    }>;
    compliance: {
      student: string;
      fromPct: string;
      toPct: string;
      badge: string;
    };
    logNote: string;
  };
  assessmentBuilder?: {
    crumb: string[];
    heading: string;
    description: string;
    sectionId?: string | null;
    sections?: Array<{ id: string; label: string }>;
    title: string;
    type: string;
    weight: string;
    openDate?: string;
    dueDate?: string;
    durationMinutes?: number;
    questions?: Array<{ id?: string; prompt?: string; options?: string[]; correct?: number }>;
    types?: string[];
    rubricHeaders: string[];
    rubricRows: Array<{ criterion: string; excellent: string; good: string; poor: string }>;
    uploadHint: string;
    uploadFormats: string;
    preview: {
      badge: string;
      title: string;
      weight: string;
      openDate: string;
      dueDate: string;
    };
  };
  gradingSchemes?: {
    /** Manage list (MySIS). When present, list UI is shown instead of the scale editor. */
    searchPlaceholder?: string;
    schemes?: Array<{
      id: string;
      name: string;
      active: boolean;
    }>;
    /** Legacy letter-scale editor (optional). */
    schemeLabel?: string;
    rows?: Array<{
      letter: string;
      min: string;
      max: string;
      gpa: string;
      description: string;
      status: "PASS" | "FAIL";
      letterTone: "a" | "b" | "c" | "d" | "f";
    }>;
    distribution?: Array<{ label: string; meta: string; pct: number; tone: "a" | "b" | "c" | "d" | "f" }>;
    presets?: Array<{ label: string; value: string; tone: "warning" | "success" }>;
  };
  programTypes?: {
    searchPlaceholder?: string;
    types?: Array<{
      id: string;
      name: string;
      abbreviation: string;
      active: boolean;
    }>;
  };
  courseTypes?: {
    searchPlaceholder?: string;
    types?: Array<{
      id: string;
      name: string;
      abbreviation: string;
      active: boolean;
    }>;
  };
  manageTerms?: {
    campusFilterLabel?: string;
    campusOptions?: Array<{ label: string; value: string }>;
    terms?: Array<{
      id: string;
      name: string;
      code: string;
      dates: string;
      campuses: string[];
    }>;
  };
  reviewTerm?: {
    id: string;
    name: string;
    code: string;
    startsOn: string;
    endsOn: string;
    campuses: string[];
  };
  scheduleManage?: {
    scheduleId: string;
    programTitle: string;
    dateRange: string;
    activeTab?: string;
    viewMode?: "standard" | "calendar";
    addSessionHref?: string;
    totals: { courses: number; sessions: number; conflicts: number; enrolled: number };
    sessions?: Array<{
      id: string;
      course: string;
      title?: string;
      instructors: string;
      room: string;
      dates: string;
      schedule: string;
    }>;
    calendar?: {
      monthLabel: string;
      monthOptions?: string[];
      nextMonthHint?: string;
      startOffset?: number;
      daysInMonth?: number;
      events?: Array<{
        id: string;
        sessionId?: string;
        day: number;
        code: string;
        title: string;
        time: string;
        tone?: string;
      }>;
    };
    fees?: {
      ledgers?: Array<{ id: string; type: string; domestic: string; international: string }>;
      ledgerTypeOptions?: string[];
    };
    settings?: {
      groups: Array<{
        title: string;
        fields: Array<{
          label: string;
          value: string;
          type?: string;
          options?: Array<{ label: string; value: string }>;
          unitValue?: string;
          unitOptions?: Array<{ label: string; value: string }>;
          hint?: string;
          optional?: boolean;
        }>;
      }>;
    };
  };
  coursesSessions?: {
    searchPlaceholder?: string;
    filterCoursePlaceholder?: string;
    courses?: Array<{
      id: string;
      name: string;
      number: string;
      creditValue: string;
      notStarted: number;
      inProgress: number;
      completed: number;
    }>;
  };
  courseAdmin?: {
    courseId: string;
    courseLabel: string;
    tabs: string[];
    activeTab: string;
    statusFilter?: string;
    statusOptions?: Array<{ label: string; value: string }>;
    createSessionHref?: string;
    sessions?: Array<{
      id: string;
      course: string;
      courseId?: string;
      location: string;
      instructors: string;
      schedule: string;
      enrolled: number;
      reserved: number;
      waitList: number;
      status: string;
    }>;
    linkedCourses?: {
      emptyMessage?: string;
      rows?: Array<{ id: string; course: string; type: string }>;
      courseOptions?: Array<{ label: string; value: string }>;
      conditionOptions?: Array<{ label: string; value: string }>;
    };
    textbooks?: {
      emptyMessage?: string;
      rows?: Array<{ id: string; name: string; isbn: string; price: string }>;
      textbookOptions?: Array<{ label: string; value: string }>;
    };
    transferCourses?: {
      emptyMessage?: string;
      rows?: Array<{ id: string; institution: string; course: string }>;
      institutionOptions?: Array<{ label: string; value: string }>;
    };
  };
  masterScheduling?: {
    programFilterLabel?: string;
    programFilterValue?: string;
    programOptions?: Array<{ label: string; value: string; group?: string }>;
    rows?: Array<{
      id: string;
      dateRange: string;
      session: string;
      duration: string;
      program: string;
      canDelete?: boolean;
    }>;
  };
  academicCalendars?: {
    emptyMessage?: string;
    rows?: Array<{
      id: string;
      name: string;
      dates: string;
      status: string;
    }>;
  };
  courseTextbooks?: {
    textbooks?: Array<{
      id: string;
      name: string;
      detail?: string;
      format: string;
      isbn: string;
      domestic: string;
      international: string;
      courses?: Array<{ id: string; label: string }>;
    }>;
  };
  contentRepository?: {
    courseFilterPlaceholder?: string;
    searchLabel?: string;
    repositoryFilter?: string;
    repositoryOptions?: Array<{ label: string; value: string }>;
    resultsLabel?: string;
    perPage?: string;
    perPageOptions?: Array<{ label: string; value: string }>;
    page?: string;
    canManageMaster?: boolean;
    _assignmentScopeResolved?: boolean;
    courses?: Array<{
      id: string;
      number: string;
      name: string;
      lms: string;
      status: "Active" | "Inactive";
      courseTypes: string;
      push: number;
      pull: number;
      history?: number;
      workspaceHref?: string;
    }>;
  };
  pendingGrades?: {
    alert: string;
    queueTitle: string;
    actionBadge: string;
    rows: Array<{
      code: string;
      title: string;
      teacher: string;
      students: string;
      missing: string;
      missingTone: "ok" | "warn";
      status: "SUBMITTED" | "UNDER REVIEW" | "REJECTED";
      active?: boolean;
    }>;
    audit: {
      title: string;
      locked: string;
      average: string;
      notes: string;
      rejectPlaceholder: string;
    };
    fileQueue?: Array<{
      id: string;
      student: string;
      studentNumber: string;
      assignment: string;
      course: string;
      status: string;
      submittedAt: string;
      files: Array<{ id: string; name: string; version: string; size: string; mimeType: string }>;
    }>;
  };
};

const PROFILE_TABS = [
  { label: "Biography", href: "/instructor/f/t02-profile-biography" },
  { label: "Topics", href: "/instructor/f/t03-profile-topics" },
  { label: "Availability", href: "/instructor/f/t04-profile-availability" },
  { label: "Compensation", href: "/instructor/f/t05-profile-compensation" },
  { label: "Schedule", href: "/instructor/f/t06-profile-schedule" },
  { label: "Accomplishments", href: "/instructor/f/t34-accomplishments" },
] as const;

function profileTabs(activeHref: string) {
  return PROFILE_TABS.map((t) => ({ ...t, active: t.href === activeHref }));
}

function makeTable(
  partial: Omit<TeacherScreenConfig, "archetype"> & {
    columns: string[];
    rows: NonNullable<TeacherScreenConfig["rows"]>;
    archetype?: TeacherArchetype;
  },
): TeacherScreenConfig {
  const { archetype = "table", ...rest } = partial;
  return {
    archetype,
    searchPlaceholder: `Search ${partial.title.toLowerCase()}…`,
    filters: partial.filters || ["Term: Fall 2026", "Status", "Department"],
    countLabel: partial.countLabel || `${partial.rows.length} records`,
    columnTemplate:
      partial.columnTemplate ||
      "minmax(140px,1.2fr) minmax(120px,1fr) minmax(100px,0.8fr) minmax(100px,0.8fr) minmax(90px,0.6fr) minmax(80px,0.5fr)",
    ...rest,
  };
}

export const TEACHER_SCREENS: Record<string, TeacherScreenConfig> = {
  "/instructor/interviews": {
    path: "/instructor/interviews",
    figmaId: "live:admissions-interviews",
    title: "Admissions Interviews",
    subtitle: "Interviews assigned to you by Admissions",
    breadcrumbs: ["Home", "Admissions Interviews"],
    activeHref: "/instructor/interviews",
    archetype: "table",
    columns: ["When", "Applicant", "Program", "Mode / Location", "Status"],
    rows: [],
  },
  "/instructor": {
    path: "/instructor",
    figmaId: "3:3698",
    title: "Home",
    subtitle: "",
    breadcrumbs: ["Home", "Dashboard"],
    activeHref: "/instructor",
    archetype: "dashboard",
    kpis: [
      { label: "Active Courses", value: "4", hint: "This Term", tone: "up" },
      { label: "Today's Classes", value: "3", hint: "Lectures", tone: "highlight" },
      { label: "Pending Grading", value: "12", hint: "Submissions", tone: "danger" },
      { label: "Pending Attendance", value: "2", hint: "Classes", tone: "muted" },
    ],
    dashboard: {
      greeting: "Good Morning,",
      name: "Dr. Sarah Mitchell",
      meta: "Associate Professor • Fall 2026 Term • Business Administration Department",
      statusBadge: "Department reviews pending",
      quickActions: [
        { label: "Mark Attendance", href: "/instructor/attendance", variant: "primary" },
        { label: "Enter Grades", href: "/instructor/gradebook", variant: "secondary" },
        { label: "Add Availability", href: "/instructor/f/t25-add-availability-modal", variant: "secondary" },
        { label: "Open AI Course Studio", href: "/instructor/f/in-12-ai-course-studio", variant: "ai" },
      ],
      timetable: [
        {
          time: "09:00 – 10:30",
          code: "ACC201",
          title: "Financial Accounting I",
          room: "Hall A-102",
          status: "In 45 min",
          statusTone: "info",
          action: "LAUNCH",
          href: "/instructor/f/t08-my-courses-detail",
        },
        {
          time: "11:00 – 12:30",
          code: "FIN301",
          title: "Corporate Finance",
          room: "Hall B-204",
          status: "Upcoming",
          statusTone: "muted",
          action: "LAUNCH",
          href: "/instructor/f/t08-my-courses-detail",
        },
        {
          time: "14:00 – 15:30",
          code: "ACC201",
          title: "Financial Accounting I — Lab",
          room: "Lab C-01",
          status: "Upcoming",
          statusTone: "muted",
          action: "LAUNCH",
          href: "/instructor/f/in-10-lab-sessions",
        },
      ],
      announcements: [
        {
          title: "Midterm Exam Schedule Released",
          body: "ACC201 midterm is scheduled for Oct 15 in Hall A-102. Review sessions available.",
          when: "2 hours ago",
        },
        {
          title: "Library Hours Extended",
          body: "Main library will remain open until 11 PM during midterm week.",
          when: "Yesterday",
        },
        {
          title: "Faculty Senate Meeting",
          body: "Monthly faculty senate meeting on Thursday at 3 PM in Conference Room B.",
          when: "2 days ago",
        },
      ],
      alerts: [
        {
          title: "Grade Submission Deadline",
          body: "FIN301 midterm grades due in 3 days. 8 submissions still pending review.",
          tone: "critical",
        },
        {
          title: "Attendance Incomplete",
          body: "2 class sessions from last week need attendance records completed.",
          tone: "warning",
        },
        {
          title: "New Student Enrolled",
          body: "Marcus Vance has been added to ACC201 Section A. Roster updated.",
          tone: "info",
        },
      ],
      officeHours: [
        { day: "Today", window: "16:00 – 17:30", mode: "In-Person · Office 312", remaining: "In 5 hours" },
        { day: "Tomorrow", window: "10:00 – 11:00", mode: "Virtual · Zoom", remaining: "Tomorrow" },
        { day: "Thursday", window: "14:00 – 15:30", mode: "In-Person · Office 312" },
      ],
    },
  },

  "/instructor/sections": {
    path: "/instructor/sections",
    figmaId: "3:4608",
    title: "MY COURSES",
    subtitle: "",
    breadcrumbs: ["Home", "My Courses"],
    activeHref: "/instructor/sections",
    archetype: "hccMyCourses",
    hccMyCourses: {
      termFilter: "All Terms",
      statusFilter: "Active & Upcoming Courses",
      termOptions: ["All Terms"],
      statusOptions: ["Active & Upcoming Courses", "All Courses", "Ended Courses"],
      courses: [],
    },
  },

  "/instructor/f/t02-profile-biography": {
    path: "/instructor/f/t02-profile-biography",
    figmaId: "3:3890",
    title: "Manage My Profile",
    subtitle: "Keep your faculty biography and contact details current.",
    breadcrumbs: ["Home", "My Profile", "Biography"],
    activeHref: "/instructor/f/t02-profile-biography",
    archetype: "profileBio",
    primaryAction: "Save Changes",
    secondaryAction: "Cancel",
    profileBio: {
      name: "Dr. Sarah Mitchell",
      role: "Lead Instructor",
      department: "Accounting & Finance",
      initials: "SM",
      staffId: "EMP-2847",
      tabs: profileTabs("/instructor/f/t02-profile-biography"),
      personal: [
        { label: "Full Name", value: "Dr. Sarah Elizabeth Mitchell" },
        { label: "Preferred Name", value: "Dr. Sarah Mitchell" },
        { label: "Email", value: "s.mitchell@heritage.edu" },
        { label: "Phone", value: "+1 (416) 555-0198" },
        { label: "Office", value: "Building A · Room 312" },
        { label: "Pronouns", value: "She / Her" },
      ],
      academic: [
        { label: "Highest Degree", value: "Ph.D. Accounting — University of Toronto" },
        { label: "Years Teaching", value: "12 years" },
        { label: "Department", value: "Accounting & Finance" },
        { label: "Faculty Rank", value: "Lead Instructor" },
        { label: "Hire Date", value: "August 15, 2014" },
        { label: "Staff ID", value: "EMP-2847" },
      ],
      expertise: ["Financial Reporting", "IFRS", "Managerial Accounting", "Audit Analytics", "ESG Reporting"],
      bio: "Dr. Sarah Mitchell is a Lead Instructor in Accounting & Finance at CampusOne. Her teaching focuses on financial reporting standards, corporate finance foundations, and applied analytics for undergraduate learners. She previously practiced as a CPA auditor and publishes on ESG disclosure quality.",
    },
  },

  "/instructor/f/t03-profile-topics": {
    path: "/instructor/f/t03-profile-topics",
    figmaId: "3:4011",
    title: "Topics & Expertise",
    subtitle: "Subject areas used for course matching and student discovery.",
    breadcrumbs: ["Home", "My Profile", "Topics"],
    activeHref: "/instructor/f/t02-profile-biography",
    archetype: "profileTopics",
    primaryAction: "Save Topics",
    profileTopics: {
      tabs: profileTabs("/instructor/f/t03-profile-topics"),
      teaching: [
        "Financial Accounting",
        "Managerial Accounting",
        "Corporate Finance",
        "Audit & Assurance",
        "Taxation Fundamentals",
      ],
      research: ["ESG Reporting Quality", "IFRS Adoption Impacts", "Learning Analytics in Accounting"],
      certifications: [
        { name: "CPA, Ontario", issuer: "CPA Ontario", year: "2012" },
        { name: "CFA Level II", issuer: "CFA Institute", year: "2016" },
        { name: "Certified Online Instructor", issuer: "Quality Matters", year: "2021" },
      ],
    },
  },

  "/instructor/f/t04-profile-availability": {
    path: "/instructor/f/t04-profile-availability",
    figmaId: "3:4135",
    title: "Availability",
    subtitle: "Office hours and booking windows students can request.",
    breadcrumbs: ["Home", "My Profile", "Availability"],
    activeHref: "/instructor/f/t02-profile-biography",
    archetype: "availability",
    primaryAction: "Add Slot",
    primaryActionHref: "/instructor/f/t25-add-availability-modal",
    availability: {
      tabs: profileTabs("/instructor/f/t04-profile-availability"),
      slots: [
        { day: "Monday", start: "16:00", end: "17:30", mode: "In-Person", location: "Office 312" },
        { day: "Tuesday", start: "10:00", end: "11:00", mode: "Virtual", location: "Zoom Faculty Room" },
        { day: "Thursday", start: "14:00", end: "15:30", mode: "In-Person", location: "Office 312" },
        { day: "Friday", start: "09:00", end: "10:00", mode: "By Appointment", location: "Office 312" },
      ],
      note: "Students may book up to 2 weeks in advance. Buffer of 10 minutes between appointments.",
    },
  },

  "/instructor/f/t05-profile-compensation": {
    path: "/instructor/f/t05-profile-compensation",
    figmaId: "3:4278",
    title: "Compensation",
    subtitle: "Contract load, pay periods, and stipend visibility.",
    breadcrumbs: ["Home", "My Profile", "Compensation"],
    activeHref: "/instructor/f/t02-profile-biography",
    archetype: "compensation",
    compensation: {
      tabs: profileTabs("/instructor/f/t05-profile-compensation"),
      summary: [
        { label: "Base Appointment", value: "Full-time Faculty" },
        { label: "Teaching Load", value: "4 courses · Fall 2026" },
        { label: "Contact Hours", value: "12 hrs / week" },
        { label: "YTD Earnings", value: "$68,420" },
      ],
      payPeriods: [
        { period: "Sep 1 – Sep 15, 2026", amount: "$3,850.00", status: "Paid", tone: "success" },
        { period: "Sep 16 – Sep 30, 2026", amount: "$3,850.00", status: "Paid", tone: "success" },
        { period: "Oct 1 – Oct 15, 2026", amount: "$3,850.00", status: "Scheduled", tone: "info" },
      ],
      contracts: [
        { title: "AY 2026–27 Faculty Contract", detail: "Accounting & Finance · Lead Instructor", status: "Active" },
        { title: "AI Course Studio Stipend", detail: "Pilot program · Fall 2026", status: "Pending HR" },
      ],
    },
  },

  "/instructor/f/t06-profile-schedule": {
    path: "/instructor/f/t06-profile-schedule",
    figmaId: "3:4396",
    title: "Teaching Schedule",
    subtitle: "Weekly teaching commitments across your sections.",
    breadcrumbs: ["Home", "My Profile", "Schedule"],
    activeHref: "/instructor/f/t02-profile-biography",
    archetype: "schedule",
    schedule: {
      tabs: profileTabs("/instructor/f/t06-profile-schedule"),
      weeks: [
        {
          label: "Week of Oct 6, 2026",
          entries: [
            { day: "Mon", time: "09:00–10:30", course: "ACC201 · Lecture", room: "A-102" },
            { day: "Mon", time: "16:00–17:30", course: "Office Hours", room: "312" },
            { day: "Tue", time: "11:00–12:30", course: "FIN301 · Lecture", room: "B-204" },
            { day: "Wed", time: "09:00–10:30", course: "ACC201 · Lecture", room: "A-102" },
            { day: "Wed", time: "14:00–17:00", course: "MKT210 · Workshop", room: "C-110" },
            { day: "Thu", time: "11:00–12:30", course: "FIN301 · Lecture", room: "B-204" },
            { day: "Fri", time: "09:00–12:00", course: "BUS405 · Seminar", room: "Sem 5" },
          ],
        },
      ],
    },
  },

  "/instructor/f/t08-my-courses-detail": {
    path: "/instructor/f/t08-my-courses-detail",
    figmaId: "3:4781",
    title: "ACSW 200: SOCIAL SERVICE WORK FUNDAMENTALS",
    subtitle: "ACSWAPR26-01: Apr. 27, 2026 - May. 1, 2026",
    breadcrumbs: ["Home", "Active Courses", "ACSW 200"],
    activeHref: "/instructor/sections",
    archetype: "courseDetail",
    courseDetail: {
      code: "ACSW 200",
      title: "SOCIAL SERVICE WORK FUNDAMENTALS",
      meta: "ACSWAPR26-01: Apr. 27, 2026 - May. 1, 2026 · #110 CampusOne - Surrey",
      status: "Ended",
      tabs: ["Course", "Class List", "Attendance", "Grades", "Badges", "More"],
      activeTab: "Course",
      overview: [
        { label: "Credits", value: "3.0" },
        { label: "Delivery", value: "In-person + Lab" },
        { label: "Term Dates", value: "Sep 2 – Dec 12, 2026" },
        { label: "Passing Grade", value: "60%" },
        { label: "Coordinator", value: "Dr. Sarah Mitchell" },
        { label: "Last Updated", value: "Oct 4, 2026" },
      ],
      modules: [
        { title: "Module 1 — Accounting Cycle", items: 6, status: "Complete" },
        { title: "Module 2 — Adjusting Entries", items: 5, status: "In Progress" },
        { title: "Module 3 — Financial Statements", items: 7, status: "Draft" },
        { title: "Module 4 — Cash & Receivables", items: 4, status: "Not Started" },
      ],
      team: [
        { name: "Dr. Sarah Mitchell", role: "Lead Instructor", initials: "SM" },
        { name: "James Okonkwo", role: "Teaching Assistant", initials: "JO" },
        { name: "Priya Shah", role: "Lab Facilitator", initials: "PS" },
      ],
    },
  },

  "/instructor/f/t14-course-management": {
    path: "/instructor/f/t14-course-management",
    figmaId: "3:5722",
    title: "Course Management",
    subtitle: "Administrative tools for course setup and maintenance.",
    breadcrumbs: ["Home", "Course Management"],
    activeHref: "/instructor/f/t14-course-management",
    archetype: "courseMgmt",
    courseMgmt: {
      tools: [
        {
          title: "Courses & Sessions",
          detail: "Browse course shells and section sessions.",
          href: "/instructor/f/t54-courses-sessions",
        },
        {
          title: "Active Courses",
          detail: "Filter live offerings by campus, term, and faculty.",
          href: "/instructor/f/t56-active-courses",
          badge: "4 live",
        },
        {
          title: "Add Course",
          detail: "Create a new course instance with tuition and schedule defaults.",
          href: "/instructor/f/t55-add-course-form",
        },
        {
          title: "Course Repository",
          detail: "Browse master course definitions and archives.",
          href: "/instructor/f/t37-course-repository",
        },
        {
          title: "Course Backups",
          detail: "Restore archived course content packages.",
          href: "/instructor/f/t65-course-backups",
          badge: "0",
        },
        {
          title: "Course Textbooks",
          detail: "Assign required and recommended course materials.",
          href: "/instructor/f/t57-course-textbooks",
        },
        {
          title: "Course Configurations",
          detail: "Brand defaults for repository, privacy, and enrolment.",
          href: "/instructor/f/t66-course-configurations",
        },
        {
          title: "Course Categories",
          detail: "Organize courses by academic category.",
          href: "/instructor/f/t58-course-categories",
        },
        {
          title: "Course Groups",
          detail: "Group related courses for curriculum blocks.",
          href: "/instructor/f/t59-course-groups-types",
        },
        {
          title: "Course Types",
          detail: "Lecture, online, and delivery type definitions.",
          href: "/instructor/f/t67-course-types",
        },
        {
          title: "Course Resources",
          detail: "Upload and tag shared instructional resources.",
          href: "/instructor/f/t60-course-resources-management",
        },
        {
          title: "Badges & Accomplishments",
          detail: "Define badges students can earn in courses.",
          href: "/instructor/f/t34-accomplishments",
        },
        {
          title: "Grading Schemes",
          detail: "Manage letter scales, percentages, and grade points.",
          href: "/instructor/f/t61-grading-schemes",
        },
      ],
    },
  },

  "/instructor/f/t15-settings": {
    path: "/instructor/f/t15-settings",
    figmaId: "3:5875",
    title: "Change Your Time Zone",
    subtitle: "",
    breadcrumbs: ["Home", "My Profile / Settings", "Change Time Zone"],
    activeHref: "/instructor/f/t15-settings",
    archetype: "settings",
    settings: {
      groups: [
        {
          title: "Change your time zone",
          fields: [
            { label: "Current Time", value: "" },
            { label: "New Time Zone", value: "UTC-08:00 Pacific Time (US & Canada)" },
          ],
        },
      ],
    },
  },

  "/instructor/f/t23-course-announcements": {
    path: "/instructor/f/t23-course-announcements",
    figmaId: "4:7509",
    title: "Course Announcements",
    subtitle: "Publish updates to enrolled students in ACC201.",
    breadcrumbs: ["Home", "My Courses", "ACC201", "Announcements"],
    activeHref: "/instructor/sections",
    archetype: "announcements",
    primaryAction: "New Announcement",
    announcements: {
      course: "ACC201 · Financial Accounting I",
      posts: [
        {
          title: "Midterm Review Session",
          body: "Optional review Thursday 16:00–17:00 in Hall A-102. Bring Module 1–2 notes.",
          when: "Oct 5, 2026 · 09:12",
          audience: "All enrolled",
          pinned: true,
        },
        {
          title: "Lab C-01 Access Cards",
          body: "Students without building access should visit Security Desk before Friday lab.",
          when: "Oct 3, 2026 · 14:40",
          audience: "Section A",
        },
        {
          title: "Assignment 2 Extension",
          body: "Deadline moved to Oct 12 23:59 for students affected by transit disruption.",
          when: "Oct 1, 2026 · 18:05",
          audience: "All enrolled",
        },
      ],
    },
  },

  "/instructor/f/t25-add-availability-modal": {
    path: "/instructor/f/t25-add-availability-modal",
    figmaId: "4:7837",
    title: "Add Availability Slot",
    subtitle: "Publish an office-hours window students can book.",
    breadcrumbs: ["Home", "My Profile", "Availability", "Add Slot"],
    activeHref: "/instructor/f/t02-profile-biography",
    archetype: "form",
    primaryAction: "Save Availability Slot",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t04-profile-availability",
    form: {
      submitLabel: "Save Availability Slot",
      groups: [
        {
          title: "Slot Details",
          fields: [
            { label: "Availability Name", value: "", type: "text" },
            {
              label: "Availability Type",
              value: "Office Hours",
              type: "select",
              options: [
                { label: "Office Hours", value: "Office Hours" },
                { label: "In-Person", value: "In-Person" },
                { label: "Virtual", value: "Virtual" },
                { label: "By Appointment", value: "By Appointment" },
              ],
            },
            { label: "Location", value: "", type: "text", optional: true },
            {
              label: "Date",
              value: "",
              type: "date",
              hint: "Pick the calendar date for this office-hours window.",
            },
            { label: "Start Time", value: "09:30", type: "time" },
            { label: "End Time", value: "11:30", type: "time" },
            {
              label: "Repeat Weekly on",
              value: "",
              type: "weekdays",
              optional: true,
              hint: "Optional. Repeat this window on selected weekdays.",
            },
          ],
        },
      ],
    },
  },

  "/instructor/f/t26-course-version-editor": {
    path: "/instructor/f/t26-course-version-editor",
    figmaId: "4:7961",
    title: "Course Version Editor",
    subtitle: "Edit BUS405 outline draft before curriculum approval.",
    breadcrumbs: ["Home", "Course Management", "Version Editor"],
    activeHref: "/instructor/f/t14-course-management",
    archetype: "versionEditor",
    primaryAction: "Submit for Approval",
    primaryActionHref: "/instructor/f/in-17-course-approval",
    secondaryAction: "Save Draft",
    versionEditor: {
      course: "BUS405 · Strategic Management",
      version: "v0.4 Draft",
      notice: "This draft is editable. Publishing requires curriculum committee approval.",
      outline: [
        {
          id: "1",
          label: "1. Course Overview",
          children: ["1.1 Description", "1.2 Learning Outcomes", "1.3 Prerequisites"],
        },
        {
          id: "2",
          label: "2. Weekly Modules",
          children: ["2.1 Strategy Foundations", "2.2 External Analysis", "2.3 Competitive Advantage"],
        },
        {
          id: "3",
          label: "3. Assessments",
          children: ["3.1 Case Memo", "3.2 Midterm", "3.3 Capstone Presentation"],
        },
        { id: "4", label: "4. Resources", children: ["4.1 Readings", "4.2 Templates"] },
      ],
      editor: {
        title: "1.2 Learning Outcomes",
        body: "By the end of this course, students will be able to: (1) evaluate industry structure using established strategy frameworks; (2) formulate and defend a competitive strategy for a mid-market firm; (3) communicate strategic recommendations to executive stakeholders with evidence-backed rationale.",
        wordCount: "64 words",
      },
      versions: [
        { label: "v0.4 Draft", when: "Oct 5, 2026", author: "Dr. Sarah Mitchell", current: true },
        { label: "v0.3 Draft", when: "Sep 28, 2026", author: "Dr. Sarah Mitchell" },
        { label: "v0.2 Draft", when: "Sep 12, 2026", author: "Curriculum Office" },
      ],
    },
  },

  "/instructor/f/t34-accomplishments": {
    path: "/instructor/f/t34-accomplishments",
    figmaId: "4:10861",
    title: "My Accomplishments & Badges",
    subtitle: "",
    breadcrumbs: ["Home", "My Profile", "Accomplishments"],
    activeHref: "/instructor/f/t02-profile-biography",
    archetype: "accomplishments",
    accomplishments: {
      tabs: profileTabs("/instructor/f/t34-accomplishments"),
      stats: [],
      items: [],
    },
  },

  "/instructor/f/t35-security-settings": {
    path: "/instructor/f/t35-security-settings",
    figmaId: "4:11045",
    title: "Security Settings",
    subtitle: "Multi-factor authentication, sessions, and account activity.",
    breadcrumbs: ["Home", "My Profile", "Security"],
    activeHref: "/instructor/f/t35-security-settings",
    archetype: "security",
    primaryAction: "Update Password",
    security: {
      mfaEnabled: true,
      sessions: [
        {
          device: "MacBook Pro · Chrome",
          location: "Toronto, ON",
          lastActive: "Active now",
          current: true,
        },
        { device: "iPhone 15 · Safari", location: "Toronto, ON", lastActive: "2 hours ago" },
        { device: "Campus Lab PC · Edge", location: "CampusOne Main", lastActive: "Yesterday" },
      ],
      recentActivity: [
        { event: "Successful sign-in", when: "Today · 08:12" },
        { event: "MFA challenge approved", when: "Today · 08:12" },
        { event: "Password changed", when: "Sep 18, 2026" },
        { event: "Recovery codes regenerated", when: "Aug 02, 2026" },
      ],
    },
  },

  "/instructor/f/t36-course-evaluations": {
    path: "/instructor/f/t36-course-evaluations",
    figmaId: "4:11188",
    title: "Course Evaluations",
    subtitle: "Student feedback summaries for your recent sections.",
    breadcrumbs: ["Home", "My Courses", "Evaluations"],
    activeHref: "/instructor/sections",
    archetype: "evaluations",
    evaluations: {
      summary: [
        { label: "Overall Rating", value: "4.6", hint: "Out of 5.0" },
        { label: "Response Rate", value: "78%", hint: "ACC201 Fall 2025" },
        { label: "Clarity", value: "4.7", hint: "Instruction quality" },
        { label: "Supportiveness", value: "4.8", hint: "Office hours & feedback" },
      ],
      comments: [
        {
          rating: "5.0",
          text: "Clear explanations and practical examples made IFRS topics approachable.",
          term: "Fall 2025 · ACC201",
        },
        {
          rating: "4.0",
          text: "Would like more worked solutions posted before exams.",
          term: "Fall 2025 · ACC201",
        },
        {
          rating: "5.0",
          text: "Office hours were the most helpful part of the course.",
          term: "Winter 2025 · FIN301",
        },
      ],
    },
  },

  "/instructor/f/t37-course-repository": {
    path: "/instructor/f/t37-course-repository",
    figmaId: "4:11353",
    title: "Course Content Repository",
    subtitle: "Course content repository",
    breadcrumbs: ["Home", "Content Repository"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "contentRepository",
    primaryAction: "Create Content Course",
    primaryActionHref: "/instructor/f/t80-create-content-course",
    contentRepository: {
      courseFilterPlaceholder: "Enter Course Name / Number Here",
      searchLabel: "Search Repository",
      repositoryFilter: "Master Repository",
      repositoryOptions: [
        { label: "Master Repository", value: "Master Repository" },
        { label: "Campus Repository", value: "Campus Repository" },
        { label: "Shared Repository", value: "Shared Repository" },
      ],
      resultsLabel: "Results: 0",
      perPage: "50",
      perPageOptions: [
        { label: "25", value: "25" },
        { label: "50", value: "50" },
        { label: "100", value: "100" },
      ],
      page: "1",
      courses: [],
    },
  },

  "/instructor/f/t38-pending-course-schedules": {
    path: "/instructor/f/t38-pending-course-schedules",
    figmaId: "4:11508",
    title: "Pending Course Schedules",
    subtitle: "Proposed meeting patterns awaiting faculty confirmation.",
    breadcrumbs: ["Home", "Course Management", "Pending Schedules"],
    activeHref: "/instructor/f/t14-course-management",
    archetype: "pendingSchedules",
    primaryAction: "Review Queue",
    pendingSchedules: {
      requests: [
        {
          course: "ACC201-A · Mon/Wed 09:00–10:30 · A-102",
          requested: "Oct 4, 2026",
          proposer: "Registrar Scheduling",
          status: "Needs Confirmation",
          tone: "warning",
        },
        {
          course: "FIN301-B · Tue/Thu 13:00–14:30 · B-204",
          requested: "Oct 3, 2026",
          proposer: "Dept. Chair",
          status: "Conflict Detected",
          tone: "danger",
        },
        {
          course: "BUS405 · Fri 09:00–12:00 · Seminar 5",
          requested: "Oct 2, 2026",
          proposer: "Curriculum Office",
          status: "Ready to Approve",
          tone: "info",
        },
      ],
    },
  },

  "/instructor/f/t39-course-history": {
    path: "/instructor/f/t39-course-history",
    figmaId: "4:11657",
    title: "Course History",
    subtitle: "Prior teaching assignments and evaluation averages.",
    breadcrumbs: ["Home", "My Courses", "History"],
    activeHref: "/instructor/sections",
    archetype: "courseHistory",
    courseHistory: {
      terms: [
        {
          term: "Winter 2026",
          courses: [
            { code: "ACC201", title: "Financial Accounting I", enrollment: "44", avgEval: "4.5" },
            { code: "FIN301", title: "Corporate Finance", enrollment: "36", avgEval: "4.7" },
          ],
        },
        {
          term: "Fall 2025",
          courses: [
            { code: "ACC201", title: "Financial Accounting I", enrollment: "41", avgEval: "4.6" },
            { code: "MKT210", title: "Principles of Marketing", enrollment: "33", avgEval: "4.4" },
            { code: "ACC310", title: "Intermediate Accounting", enrollment: "29", avgEval: "4.3" },
          ],
        },
      ],
    },
  },

  "/instructor/f/t54-courses-sessions": {
    path: "/instructor/f/t54-courses-sessions",
    figmaId: "4:14505",
    title: "Manage Courses & Sessions",
    subtitle: "Courses and their scheduled sessions",
    breadcrumbs: ["Home", "Courses & Sessions"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "coursesSessions",
    primaryAction: "Create Course",
    primaryActionHref: "/instructor/f/t55-add-course-form",
    secondaryAction: "Bulk Actions",
    coursesSessions: {
      searchPlaceholder: "Search Courses",
      filterCoursePlaceholder: "Enter Course Name / Number Here",
      courses: [],
    },
  },

  "/instructor/f/t77-course-admin": {
    path: "/instructor/f/t77-course-admin",
    figmaId: "4:14506",
    title: "Course Sessions & Offerings",
    subtitle: "Sessions and offerings for this course",
    breadcrumbs: ["Home", "Courses & Sessions", "Course Sessions"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "courseAdmin",
    primaryAction: "Create Session / Offering",
    primaryActionHref: "/instructor/f/t78-add-session-offering",
    courseAdmin: {
      courseId: "course-dap-practicum",
      courseLabel: "0: DAP PRACTICUM",
      tabs: [
        "Course Settings",
        "Course Sessions & Offerings",
        "Cross-Listing / Linked Courses",
        "Course Textbooks & e-Texts",
        "Transfer Courses & Equivalence",
      ],
      activeTab: "Course Sessions & Offerings",
      statusFilter: "",
      statusOptions: [
        { label: "Not Started", value: "Not Started" },
        { label: "In Progress", value: "In Progress" },
        { label: "Completed", value: "Completed" },
        { label: "All Statuses", value: "" },
      ],
      createSessionHref: "/instructor/f/t78-add-session-offering",
      sessions: [],
      linkedCourses: {
        emptyMessage: "No linked courses were found.",
        rows: [],
        courseOptions: [],
        conditionOptions: [
          { label: "Optional Enrolment", value: "Optional Enrolment" },
          { label: "Required Enrolment", value: "Required Enrolment" },
        ],
      },
      textbooks: {
        emptyMessage: "No textbooks were found.",
        rows: [],
        textbookOptions: [{ label: "-- Select Textbook --", value: "" }],
      },
      transferCourses: {
        emptyMessage: "No transfer courses were found.",
        rows: [],
        institutionOptions: [{ label: "-- Select Institution --", value: "" }],
      },
    },
  },

  "/instructor/f/t78-add-session-offering": {
    path: "/instructor/f/t78-add-session-offering",
    figmaId: "4:14507",
    title: "Add Session / Offering: 0",
    subtitle: "Add a session or offering",
    breadcrumbs: ["Home", "Courses & Sessions", "Course Sessions", "Add Session"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "form",
    primaryAction: "Save Session",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t77-course-admin",
    form: buildAddSessionScreenForm("0"),
  },

  "/instructor/f/t55-add-course-form": {
    path: "/instructor/f/t55-add-course-form",
    figmaId: "4:14670",
    title: "Add New Course Instance",
    subtitle: "Course workspace overview",
    breadcrumbs: ["Home", "Course Management", "Add Course"],
    activeHref: "/instructor/f/t14-course-management",
    archetype: "form",
    primaryAction: "Save Course",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t54-courses-sessions",
    form: {
      submitLabel: "Save Course",
      groups: [
        {
          title: "Course Details",
          fields: [
            {
              label: "Course Category",
              value: "",
              type: "select",
              options: [
                { label: "Select Category", value: "" },
                { label: "DAP: Accounting", value: "DAP: Accounting" },
                { label: "Computer Science", value: "Computer Science" },
                { label: "Nursing", value: "Nursing" },
                { label: "Business Administration", value: "Business Administration" },
                { label: "General Education", value: "General Education" },
              ],
            },
            {
              label: "Course Group",
              value: "No Grouping",
              type: "select",
              options: [
                { label: "No Grouping", value: "No Grouping" },
                { label: "Accounting Principles", value: "Accounting Principles" },
                { label: "Core", value: "Core" },
                { label: "Elective", value: "Elective" },
                { label: "Capstone", value: "Capstone" },
              ],
            },
            { label: "Course Name", value: "", type: "text" },
            { label: "Course Number", value: "", type: "text" },
            { label: "Course Credit Value", value: "", type: "number" },
            {
              label: "Course In-take Type",
              value: "Standard",
              type: "select",
              options: [
                { label: "Standard", value: "Standard" },
                { label: "Continuous", value: "Continuous" },
                { label: "Cohort", value: "Cohort" },
                { label: "Open Entry", value: "Open Entry" },
              ],
            },
            {
              label: "Course Enrollment Permission",
              value: "No permission required",
              type: "select",
              options: [
                { label: "No permission required", value: "No permission required" },
                { label: "Instructor approval", value: "Instructor approval" },
                { label: "Department approval", value: "Department approval" },
                { label: "Prerequisite gate", value: "Prerequisite gate" },
              ],
            },
          ],
        },
        {
          title: "Course Outline / Description",
          fields: [
            { label: "Course Description", value: "", type: "textarea" },
            { label: "Course Syllabus", value: "", type: "file" },
            {
              label: "Course Syllabus Privacy",
              value: "Private",
              type: "select",
              options: [
                { label: "Private", value: "Private" },
                { label: "Enrolled students", value: "Enrolled students" },
                { label: "Institution", value: "Institution" },
                { label: "Public", value: "Public" },
              ],
            },
          ],
        },
        {
          title: "Course Chair & Lead Accesses",
          fields: [
            {
              label: "Override course category permissions",
              value: "false",
              type: "checkbox",
              hint: "Override course category permissions for chair and lead access",
            },
          ],
        },
        {
          title: "Course Tuition",
          fields: [
            {
              label: "Course tuition included in the program cost",
              value: "false",
              type: "checkbox",
            },
            {
              label: "Course Cost Calculation",
              value: "Total Amount",
              type: "select",
              options: [
                { label: "Total Amount", value: "Total Amount" },
                { label: "Per Credit", value: "Per Credit" },
                { label: "Per Hour", value: "Per Hour" },
                { label: "Program Package", value: "Program Package" },
              ],
            },
            { label: "Domestic", value: "0.00", type: "number", hint: "$0.00" },
            { label: "International", value: "0.00", type: "number", hint: "$0.00" },
          ],
        },
        {
          title: "Default Course Schedule",
          fields: [
            { label: "Total Course Hours", value: "", type: "number" },
            { label: "Hours per Day", value: "", type: "number" },
            {
              label: "Weekly Schedule",
              value: "Monday,Tuesday,Wednesday,Thursday,Friday",
              type: "weekdays",
            },
            {
              label: "Time of Day",
              value: "Morning",
              type: "select",
              options: [
                { label: "Morning", value: "Morning" },
                { label: "Afternoon", value: "Afternoon" },
                { label: "Evening", value: "Evening" },
                { label: "Flexible", value: "Flexible" },
              ],
            },
            { label: "Customize weekly schedule", value: "false", type: "checkbox" },
          ],
        },
        {
          title: "Grading",
          fields: [
            {
              label: "Grading Scheme",
              value: "",
              type: "select",
              options: [
                { label: "Select Grading Scheme", value: "" },
                { label: "DIB and DAP", value: "DIB and DAP" },
                { label: "HCC Grading", value: "HCC Grading" },
                { label: "Health Care Assistant", value: "Health Care Assistant" },
                { label: "Pass / Fail", value: "Pass / Fail" },
                { label: "Standard GPA Ladder", value: "Standard GPA Ladder" },
                { label: "Competency Based", value: "Competency Based" },
                { label: "Letter Only", value: "Letter Only" },
              ],
            },
          ],
        },
        {
          title: "Course Content Settings",
          fields: [
            {
              label: "Repository Settings",
              value: "Use brand settings",
              type: "select",
              options: [
                { label: "Use brand settings", value: "Use brand settings" },
                { label: "Course-specific", value: "Course-specific" },
                { label: "Section-specific", value: "Section-specific" },
                { label: "Disabled", value: "Disabled" },
              ],
            },
          ],
        },
        {
          title: "Miscellaneous Conditions",
          fields: [
            {
              label: "Transcript",
              value: "Visible on Transcript",
              type: "select",
              options: [
                { label: "Visible on Transcript", value: "Visible on Transcript" },
                { label: "Hidden", value: "Hidden" },
                { label: "Internal only", value: "Internal only" },
              ],
            },
            {
              label: "Count Credits",
              value: "Normal",
              type: "select",
              options: [
                { label: "Normal", value: "Normal" },
                { label: "Do not count", value: "Do not count" },
                { label: "Half credit", value: "Half credit" },
              ],
            },
            {
              label: "Prior Experience",
              value: "Eligible",
              type: "select",
              options: [
                { label: "Eligible", value: "Eligible" },
                { label: "Not eligible", value: "Not eligible" },
                { label: "Requires review", value: "Requires review" },
              ],
            },
            {
              label: "Registration Limits",
              value: "Normal",
              type: "select",
              options: [
                { label: "Normal", value: "Normal" },
                { label: "Restricted", value: "Restricted" },
                { label: "Waitlist only", value: "Waitlist only" },
              ],
            },
            {
              label: "Repeat Enrollment Condition",
              value: "Use program settings",
              type: "select",
              options: [
                { label: "Use program settings", value: "Use program settings" },
                { label: "Allow repeats", value: "Allow repeats" },
                { label: "One attempt only", value: "One attempt only" },
                { label: "Requires approval", value: "Requires approval" },
              ],
            },
            {
              label: "Commissions",
              value: "Normal",
              type: "select",
              options: [
                { label: "Normal", value: "Normal" },
                { label: "Excluded", value: "Excluded" },
                { label: "Special rate", value: "Special rate" },
              ],
            },
            {
              label: "Promotion Calculation",
              value: "Normal",
              type: "select",
              options: [
                { label: "Normal", value: "Normal" },
                { label: "Excluded", value: "Excluded" },
                { label: "Weighted", value: "Weighted" },
              ],
            },
            {
              label: "Full-time Calculation",
              value: "Normal",
              type: "select",
              options: [
                { label: "Normal", value: "Normal" },
                { label: "Excluded", value: "Excluded" },
                { label: "Half-time only", value: "Half-time only" },
              ],
            },
            {
              label: "Textbook Opt-Out",
              value: "System Default",
              type: "select",
              options: [
                { label: "System Default", value: "System Default" },
                { label: "Allow opt-out", value: "Allow opt-out" },
                { label: "Required materials", value: "Required materials" },
              ],
            },
          ],
        },
      ],
    },
  },

  "/instructor/f/t56-active-courses": {
    path: "/instructor/f/t56-active-courses",
    figmaId: "4:14878",
    title: "ACTIVE COURSES",
    subtitle: "",
    breadcrumbs: ["Home", "Active Courses"],
    activeHref: "/instructor/f/t14-course-management",
    archetype: "activeCourses",
    activeCourses: {
      filters: {
        campus: {
          label: "Filter Campus",
          value: "ALL CAMPUSES",
          options: [
            { label: "ALL CAMPUSES", value: "ALL CAMPUSES" },
            { label: "#110 CampusOne - Surrey", value: "#110 Heritage College- Surrey" },
            { label: "CampusOne - Main", value: "Heritage College - Main" },
          ],
        },
        course: {
          label: "Filter Course",
          value: "All Courses",
          options: [
            { label: "All Courses", value: "All Courses" },
            { label: "0: DAP Practicum", value: "0: DAP Practicum" },
            { label: "0: Work Experience", value: "0: Work Experience" },
            { label: "000: Practicum", value: "000: Practicum" },
            { label: "ACSW 100: Addictions Fundamentals", value: "ACSW 100: Addictions Fundamentals" },
            { label: "ACSW 200: Social Service Work Fundamentals", value: "ACSW 200: Social Service Work Fundamentals" },
            { label: "ACSW 300: Self-Care Techniques", value: "ACSW 300: Self-Care Techniques" },
            { label: "ACSW 400: Resources and Networking", value: "ACSW 400: Resources and Networking" },
            { label: "ACSW 500: Family Studies", value: "ACSW 500: Family Studies" },
            { label: "ACSW 600: Relapse Prevention", value: "ACSW 600: Relapse Prevention" },
            { label: "ACSW 700: Child and Youth Populations", value: "ACSW 700: Child and Youth Populations" },
            { label: "ADMN 104: Introduction to Keyboarding", value: "ADMN 104: Introduction to Keyboarding" },
            { label: "ADMN 104: Keyboarding", value: "ADMN 104: Keyboarding" },
            { label: "ADMN 110: Office Administration", value: "ADMN 110: Office Administration" },
            { label: "ADMN 114: Customer Service", value: "ADMN 114: Customer Service" },
            { label: "BCOM 105: Business Communications", value: "BCOM 105: Business Communications" },
            { label: "BETH 190: Business Ethics", value: "BETH 190: Business Ethics" },
            { label: "BLAW 101: Business Law", value: "BLAW 101: Business Law" },
            { label: "BMGT 101: Introduction to Human Resources", value: "BMGT 101: Introduction to Human Resources" },
            { label: "BMGT 106: Introduction to Business Management", value: "BMGT 106: Introduction to Business Management" },
            { label: "BMGT 112: Introduction to Organizational Behaviour", value: "BMGT 112: Introduction to Organizational Behaviour" },
            { label: "BMGT 114: Introduction to Labour Relations", value: "BMGT 114: Introduction to Labour Relations" },
            { label: "BMGT 115: Training and Development", value: "BMGT 115: Training and Development" },
            { label: "BMGT 116: Recruitment and Selection", value: "BMGT 116: Recruitment and Selection" },
            { label: "BMGT 117: Occupational Health and Safety", value: "BMGT 117: Occupational Health and Safety" },
            { label: "BMGT 118: Compensation and Benefits", value: "BMGT 118: Compensation and Benefits" },
            { label: "BTT 101: Bank Teller Training", value: "BTT 101: Bank Teller Training" },
            { label: "CAPA - DAP 106: Modern Office Technology", value: "CAPA - DAP 106: Modern Office Technology" },
            { label: "CAPS 190: Capstone Project", value: "CAPS 190: Capstone Project" },
            { label: "CARE 500: Special Certificates", value: "CARE 500: Special Certificates" },
            { label: "COMC 150: Professional Report Writing", value: "COMC 150: Professional Report Writing" },
            { label: "COMP 101: Introduction to Computers", value: "COMP 101: Introduction to Computers" },
          ],
        },
        term: {
          label: "Filter Term",
          value: "ALL TERMS",
          options: [
            { label: "ALL TERMS", value: "ALL TERMS" },
            { label: "3rd Term-2026 — 2026-09-01 - 2026-12-31", value: "3rd Term-2026" },
            { label: "2nd Term-2026 — 2026-05-01 - 2026-08-31", value: "2nd Term-2026" },
            { label: "1st Term-2026 — 2026-01-01 - 2026-04-30", value: "1st Term-2026" },
            { label: "3rd Term-2025 — 2025-09-01 - 2025-12-31", value: "3rd Term-2025" },
            { label: "2nd Term-2025 — 2025-05-01 - 2025-08-31", value: "2nd Term-2025" },
            { label: "1st Term-2025 — 2025-01-01 - 2025-04-30", value: "1st Term-2025" },
            { label: "Bank Teller Program - September 13 to September 21", value: "Bank Teller Program Sep" },
            { label: "PBMLT-HCA Cohort", value: "PBMLT-HCA Cohort" },
          ],
        },
        student: {
          label: "Filter Student",
          value: "",
          placeholder: "Student # or last name",
        },
        faculty: {
          label: "Faculty",
          value: "ALL FACULTY / INSTRUCTORS",
          options: [
            { label: "ALL FACULTY / INSTRUCTORS", value: "ALL FACULTY / INSTRUCTORS" },
            { label: "Elena Vance", value: "Elena Vance" },
            { label: "Sarah Mitchell", value: "Sarah Mitchell" },
          ],
        },
      },
      showLabel: "Show Courses",
      resultsLabel: "Results: 1,408",
      perPageOptions: [
        { label: "50", value: "50" },
        { label: "100", value: "100" },
        { label: "250", value: "250" },
        { label: "500", value: "500" },
      ],
      perPage: "250",
      pageOptions: [
        { label: "1", value: "1" },
        { label: "2", value: "2" },
        { label: "3", value: "3" },
      ],
      page: "1",
      columns: ["Course", "Location", "Instructor(s)", "Dates", "Enrolment"],
      rows: [
        {
          id: "course-acsw-200",
          course: "ACSW 200 (ACSWAPR26-01) Social Service Work Fundamentals",
          code: "ACSW 200",
          section: "ACSWAPR26-01",
          title: "Social Service Work Fundamentals",
          location: "#110 CampusOne - Surrey",
          room: "Room Not Set",
          instructors: "Not Set",
          dates: "Apr. 27, 2026 - May. 1, 2026",
          enrolment: "0%",
          viewHref: "/instructor/f/t56-active-courses?view=course-acsw-200",
          attendanceHref: "/instructor/attendance",
        },
        {
          id: "course-dap-01",
          course: "0 (01) DAP Practicum",
          code: "0",
          section: "01",
          title: "DAP Practicum",
          location: "#110 CampusOne - Surrey",
          room: "Room Not Set",
          instructors: "Not Set",
          dates: "Continuous",
          enrolment: "0%",
          viewHref: "/instructor/f/t56-active-courses?view=course-dap-01",
          attendanceHref: "/instructor/attendance",
        },
        {
          id: "course-dap-dap01",
          course: "0 (DAP-01) DAP Practicum",
          code: "0",
          section: "DAP-01",
          title: "DAP Practicum",
          location: "#110 CampusOne - Surrey",
          room: "Room Not Set",
          instructors: "Not Set",
          dates: "Continuous",
          enrolment: "0%",
          viewHref: "/instructor/f/t56-active-courses?view=course-dap-dap01",
          attendanceHref: "/instructor/attendance",
        },
        {
          id: "course-work-exp",
          course: "0 (01) Work Experience",
          code: "0",
          section: "01",
          title: "Work Experience",
          location: "#110 CampusOne - Surrey",
          room: "Room Not Set",
          instructors: "Not Set",
          dates: "Jan. 10, 2022 (Mon.) – Feb. 4, 2022 (Fri.)",
          enrolment: "2%",
          viewHref: "/instructor/f/t56-active-courses?view=course-work-exp",
          attendanceHref: "/instructor/attendance",
        },
      ],
    },
  },

  "/instructor/f/t57-course-textbooks": {
    path: "/instructor/f/t57-course-textbooks",
    figmaId: "4:15104",
    title: "Course Textbooks",
    subtitle: "Course textbooks",
    breadcrumbs: ["Home", "Course Textbooks"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "courseTextbooks",
    primaryAction: "Add Textbook",
    primaryActionHref: "/instructor/f/t79-add-textbook",
    courseTextbooks: {
      textbooks: [],
    },
  },

  "/instructor/f/t79-add-textbook": {
    path: "/instructor/f/t79-add-textbook",
    figmaId: "4:15105",
    title: "Add Textbook",
    subtitle: "Add a textbook",
    breadcrumbs: ["Home", "Course Textbooks", "Add Textbook"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "form",
    primaryAction: "Save Textbook",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t57-course-textbooks",
    form: {
      submitLabel: "Save Textbook",
      groups: [
        {
          title: "Textbook Details",
          fields: [
            { label: "Textbook Name", value: "", type: "text" },
            { label: "ISBN", value: "", type: "text" },
            {
              label: "Format",
              value: "Not Set",
              type: "select",
              options: [
                { label: "Not Set", value: "Not Set" },
                { label: "Print", value: "Print" },
                { label: "e-Book", value: "e-Book" },
                { label: "Print / e-Book", value: "Print / e-Book" },
                { label: "Loose-leaf", value: "Loose-leaf" },
              ],
            },
          ],
        },
        {
          title: "Textbook Fees",
          fields: [
            { label: "Domestic", value: "0.00", type: "text", prefix: "$" },
            { label: "International", value: "0.00", type: "text", prefix: "$" },
          ],
        },
      ],
      linkedCourses: {
        title: "Textbook Courses",
        addLabel: "ADD",
        emptyLabel: "No courses linked yet. Use ADD to associate this textbook.",
        courseOptions: [
          { label: "-- Select Course --", value: "" },
          { label: "0: DAP Practicum", value: "repo-0-dap-practicum" },
          { label: "ACSW 100: Addictions Fundamentals", value: "repo-acsw-100-addictions-fundamentals" },
          { label: "ACSW 200: Social Service Work Fundamentals", value: "repo-acsw-200-social-service-work-fundamentals" },
          { label: "ADMN 104: Introduction to Keyboarding", value: "repo-admn-104-introduction-to-keyboarding" },
        ],
        rows: [],
      },
    },
  },

  "/instructor/f/t80-create-content-course": {
    path: "/instructor/f/t80-create-content-course",
    figmaId: "4:11354",
    title: "Create Content Course",
    subtitle: "Create a content course",
    breadcrumbs: ["Home", "Content Repository", "Create Content Course"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "form",
    primaryAction: "Create Content Course",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t37-course-repository",
    form: {
      submitLabel: "Create Content Course",
      warning:
        "Duplicate courses that are set to active will be deactivated automatically. Customized campus course assignment will be automatically modified if duplicated.",
      groups: [
        {
          title: "Course Content Repository Settings",
          fields: [
            {
              label: "Course",
              value: "",
              type: "select",
              options: [
                { label: "-- Select Course --", value: "" },
                { label: "0: DAP Practicum", value: "repo-0-dap-practicum" },
                { label: "0: MOA Work Experience", value: "repo-0-moa-work-experience" },
                { label: "0: Work Experience", value: "repo-0-work-experience" },
                { label: "000: Practicum", value: "repo-000-practicum" },
                { label: "101: ECOM", value: "repo-101-ecom" },
                { label: "101sdfdsrg: ecom", value: "repo-101sdfdsrg-ecom" },
                { label: "121: ABCD", value: "repo-121-abcd" },
                { label: "ACSW 100: Addictions Fundamentals", value: "repo-acsw-100-addictions-fundamentals" },
                { label: "ACSW 200: Social Service Work Fundamentals", value: "repo-acsw-200-social-service-work-fundamentals" },
                { label: "ACSW 300: Self-Care Techniques", value: "repo-acsw-300-self-care-techniques" },
                { label: "ACSW 400: Resources and Networking", value: "repo-acsw-400-resources-and-networking" },
                { label: "ACSW 500: Family Studies", value: "repo-acsw-500-family-studies" },
                { label: "ACSW 600: Relapse Prevention", value: "repo-acsw-600-relapse-prevention" },
                { label: "ACSW 700: Child and Youth Populations", value: "repo-acsw-700-child-and-youth-populations" },
                { label: "ADMN 104: Introduction to Keyboarding", value: "repo-admn-104-introduction-to-keyboarding" },
              ],
            },
            { label: "Note / Name", value: "", type: "text", visibleWhen: "Course" },
            {
              label: "Course Types",
              value: "All Course Types",
              type: "select",
              visibleWhen: "Course",
              options: [
                { label: "All Course Types", value: "All Course Types" },
                { label: "All Types", value: "All Types" },
                { label: "Lecture", value: "Lecture" },
                { label: "Online", value: "Online" },
              ],
            },
            {
              label: "Default",
              value: "Yes",
              type: "select",
              visibleWhen: "Course",
              options: [
                { label: "Yes", value: "Yes" },
                { label: "No", value: "No" },
              ],
            },
            {
              label: "Course Format",
              value: "Topics",
              type: "select",
              visibleWhen: "Course",
              options: [
                { label: "Topics", value: "Topics" },
                { label: "Weeks", value: "Weeks" },
              ],
            },
            {
              label: "Sections / Weeks",
              value: "10",
              type: "select",
              visibleWhen: "Course",
              options: Array.from({ length: 20 }, (_, i) => ({
                label: String(i + 1),
                value: String(i + 1),
              })),
            },
          ],
        },
      ],
    },
  },

  "/instructor/f/t58-course-categories": makeTable({
    path: "/instructor/f/t58-course-categories",
    figmaId: "4:15486",
    title: "Course Categories",
    subtitle: "Course categories",
    breadcrumbs: ["Home", "Course Management", "Categories"],
    activeHref: "/instructor/f/t14-course-management",
    primaryAction: "Quick-Create Category",
    countLabel: "8 root categories",
    columns: ["Category Name", "Code", "Description", "Courses", "Parent", "Status"],
    rows: [
      {
        cells: ["Accounting", "DAP", "Core accounting principals and tax regulations", "14", "None (Root)", "ACTIVE"],
        badge: "ACTIVE",
        badgeTone: "active",
      },
      {
        cells: ["Business", "DIB", "Enterprise governance and administration studies", "22", "None (Root)", "ACTIVE"],
        badge: "ACTIVE",
        badgeTone: "active",
      },
      {
        cells: ["Computing", "COMP", "Advanced programming, AI architecture & engineering", "31", "None (Root)", "ACTIVE"],
        badge: "ACTIVE",
        badgeTone: "active",
      },
      {
        cells: ["Marketing", "MARK", "Public relations, brand management and digital ops", "—", "None (Root)", "ACTIVE"],
        badge: "ACTIVE",
        badgeTone: "active",
      },
      {
        cells: ["Economics", "ECON", "Macro-analysis, global banking and market theory", "15", "None (Root)", "INACTIVE"],
        badge: "INACTIVE",
        badgeTone: "muted",
      },
    ],
  }),

  "/instructor/f/t59-course-groups-types": makeTable({
    path: "/instructor/f/t59-course-groups-types",
    figmaId: "4:15699",
    title: "Course Groups",
    subtitle: "Course groups and types",
    breadcrumbs: ["Home", "Course Management", "Course Groups"],
    activeHref: "/instructor/f/t14-course-management",
    primaryAction: "Add Course Group",
    primaryActionHref: "/instructor/f/t68-add-course-group",
    countLabel: "Course grouping catalog",
    columns: ["Course Group Name", "Abbreviation", "Courses", "Status"],
    rows: [
      {
        cells: ["No Grouping", "—", "—", "ACTIVE"],
        badge: "ACTIVE",
        badgeTone: "active",
      },
      {
        cells: ["Accounting Principles", "ACC-P", "12", "ACTIVE"],
        badge: "ACTIVE",
        badgeTone: "active",
      },
      {
        cells: ["Core", "CORE", "18", "ACTIVE"],
        badge: "ACTIVE",
        badgeTone: "active",
      },
      {
        cells: ["Elective", "ELEC", "9", "ACTIVE"],
        badge: "ACTIVE",
        badgeTone: "active",
      },
      {
        cells: ["Capstone", "CAPS", "3", "ACTIVE"],
        badge: "ACTIVE",
        badgeTone: "active",
      },
    ],
  }),

  "/instructor/f/t60-course-resources-management": {
    path: "/instructor/f/t60-course-resources-management",
    figmaId: "4:15877",
    title: "Manage Course Resources",
    subtitle: "Course files",
    breadcrumbs: ["Home", "Course Management", "Resources"],
    activeHref: "/instructor/f/t14-course-management",
    archetype: "splitPane",
    primaryAction: "Upload Resource",
    splitPane: {
      leftTitle: "Current Resource Categories",
      leftItems: [
        { label: "Ledgers", meta: "Syllabus modules", active: true },
        { label: "Core Framework", meta: "Overview docs" },
        { label: "Formulas", meta: "Calculation guides" },
        { label: "Quick Guides", meta: "Reference cards" },
        { label: "Simulations", meta: "Interactive links" },
      ],
      rightTitle: "ACC201 Resources",
      rightFields: [
        { label: "Category Name", value: "Core Curriculum Ledgers" },
        { label: "Visibility", value: "Enrolled students" },
        { label: "Owner", value: "Dr. Sarah Mitchell" },
      ],
      resources: [
        { name: "Accounting Ledger Template (Syllabus Module 1)", type: "Microsoft Excel", size: "2.4 MB" },
        { name: "Corporate Financial Framework 2026 Overview", type: "PDF Document", size: "12.8 MB" },
        { name: "Adjusted Trial Balance Calculations & Rules", type: "Microsoft Word", size: "912 KB" },
        { name: "GAAP Standard Adjustments Reference Card", type: "PDF Document", size: "4.1 MB" },
        { name: "Interactive Ledger Balancing Simulator v1.0", type: "Exec Link", size: "14 KB" },
      ],
    },
  },

  "/instructor/f/in-08-lectures": {
    path: "/instructor/f/in-08-lectures",
    figmaId: "17:7058",
    title: "Lectures",
    subtitle: "Lecture sessions and launch controls for ACC201.",
    breadcrumbs: ["Home", "My Courses", "ACC201", "Lectures"],
    activeHref: "/instructor/sections",
    archetype: "lectures",
    primaryAction: "Schedule Lecture",
    lectures: {
      course: "ACC201 · Financial Accounting I",
      sessions: [
        {
          title: "Lecture 05 — Adjusting Entries",
          when: "Mon Oct 6 · 09:00–10:30",
          duration: "90 min",
          status: "Ready to Launch",
          tone: "info",
          href: "/instructor/f/in-09-lecture-review",
        },
        {
          title: "Lecture 04 — Trial Balance",
          when: "Wed Oct 1 · 09:00–10:30",
          duration: "90 min",
          status: "Completed",
          tone: "success",
          href: "/instructor/f/in-09-lecture-review",
        },
        {
          title: "Lecture 03 — Journal Entries",
          when: "Mon Sep 29 · 09:00–10:30",
          duration: "90 min",
          status: "Completed",
          tone: "success",
          href: "/instructor/f/in-09-lecture-review",
        },
        {
          title: "Lecture 06 — Financial Statements Intro",
          when: "Wed Oct 8 · 09:00–10:30",
          duration: "90 min",
          status: "Scheduled",
          tone: "muted",
        },
      ],
    },
  },

  "/instructor/f/in-09-lecture-review": {
    path: "/instructor/f/in-09-lecture-review",
    figmaId: "17:7147",
    title: "Lecture Review",
    subtitle: "Recording, transcript, and AI highlights for Lecture 04.",
    breadcrumbs: ["Home", "My Courses", "ACC201", "Lectures", "Review"],
    activeHref: "/instructor/sections",
    archetype: "lectureReview",
    primaryAction: "Share with Class",
    lectureReview: {
      title: "Lecture 04 — Trial Balance",
      meta: "ACC201 · Wed Oct 1 · 09:00–10:30 · Hall A-102 · 39 attendees",
      transcript:
        "Today we reconciled the unadjusted trial balance and walked through common transposition errors. Students practiced locating imbalance sources using the accounting equation checkpoints. We closed with a short formative quiz on debit/credit orientation.",
      highlights: [
        "39 of 42 students attended (93%)",
        "Average quiz score: 81%",
        "Most missed concept: contra-asset presentation",
        "AI suggested follow-up worksheet on suspense accounts",
      ],
      aiNotes:
        "Recommend a 10-minute recap at the start of Lecture 05 covering contra accounts before introducing adjusting entries.",
    },
  },

  "/instructor/f/in-10-lab-sessions": {
    path: "/instructor/f/in-10-lab-sessions",
    figmaId: "17:7217",
    title: "Lab Sessions",
    subtitle: "Hands-on lab schedule and room readiness for ACC201.",
    breadcrumbs: ["Home", "My Courses", "ACC201", "Labs"],
    activeHref: "/instructor/sections",
    archetype: "labSession",
    primaryAction: "Open Lab Roster",
    labSession: {
      course: "ACC201 · Financial Accounting I",
      labs: [
        {
          title: "Lab 03 — Spreadsheet Journals",
          when: "Wed Oct 8 · 14:00–15:30",
          room: "Lab C-01",
          capacity: "22/24",
          status: "Ready",
          tone: "info",
        },
        {
          title: "Lab 02 — Trial Balance Workshop",
          when: "Wed Oct 1 · 14:00–15:30",
          room: "Lab C-01",
          capacity: "24/24",
          status: "Completed",
          tone: "success",
        },
        {
          title: "Lab 01 — Chart of Accounts Setup",
          when: "Wed Sep 24 · 14:00–15:30",
          room: "Lab C-01",
          capacity: "23/24",
          status: "Completed",
          tone: "success",
        },
        {
          title: "Lab 04 — Adjusting Entry Sims",
          when: "Wed Oct 15 · 14:00–15:30",
          room: "Lab C-01",
          capacity: "0/24",
          status: "Scheduled",
          tone: "muted",
        },
      ],
    },
  },

  "/instructor/f/in-17-course-approval": {
    path: "/instructor/f/in-17-course-approval",
    figmaId: "17:7922",
    title: "Course Approval Review",
    subtitle: "Requests you have submitted for approval",
    breadcrumbs: ["Studio", "Approval"],
    activeHref: "/instructor/f/in-17-course-approval",
    shell: "studio",
    archetype: "syllabusDiff",
    syllabusDiff: {
      badge: "",
      currentTitle: "Latest request",
      proposedTitle: "All requests",
      current: [],
      proposed: [],
      comments: [],
    },
  },

  "/instructor/f/in-12-ai-course-studio": {
    path: "/instructor/f/in-12-ai-course-studio",
    figmaId: "17:7388",
    title: "CS 301 AI Assistant & Studio v2.4",
    subtitle: "Synthesize lecture materials, syllabi and knowledge graph to power the virtual tutor.",
    breadcrumbs: ["Studio", "CS 301"],
    activeHref: "/instructor/f/in-12-ai-course-studio",
    shell: "studio",
    archetype: "aiStudio",
    primaryAction: "+ Start a new version",
    primaryActionHref: "/instructor/f/in-13-studio-generation",
    aiStudio: {
      eyebrow: "CAMPUSONE AI STUDIO",
      courseTitle: "CS 301 AI Assistant & Studio v2.4",
      version: "v2.4",
      drafts: [
        { version: "v2.4 Draft", status: "Drafting", tone: "draft", detail: "Syllabus and Module 1 update in progress" },
        { version: "v2.3 Published", status: "Live", tone: "active", detail: "Currently active for student tutoring session" },
      ],
      tabs: ["Sources", "Outcomes", "Modules", "Assessments", "Rubrics", "Review"],
      activeTab: "Sources",
      sources: [
        { name: "Syllabus_2026_Advanced_Data_Structures.pdf", status: "Ingested" },
        { name: "CS301_Complete_Lecture_Slides_Week_1_6.ppt", status: "Ingested" },
        { name: "HeapSort_Reference_Implementation.java", status: "Ingested" },
      ],
    },
  },

  "/instructor/f/in-13-studio-generation": {
    path: "/instructor/f/in-13-studio-generation",
    figmaId: "17:7479",
    title: "AI Course Studio",
    subtitle: "Generate structured, rigorous academic content from trusted sources",
    breadcrumbs: ["Studio", "Generation"],
    activeHref: "/instructor/f/in-12-ai-course-studio",
    shell: "studio",
    archetype: "studioGeneration",
    primaryAction: "Continue to Outcomes",
    primaryActionHref: "/instructor/f/in-14-outcome-mapping",
    studioGeneration: {
      wizardTitle: "AI Course Studio",
      badge: "Beta Wizard",
      steps: [
        { label: "Select sources", state: "done" },
        { label: "Set outcomes", state: "done" },
        { label: "Generate", state: "current" },
        { label: "Review each object", state: "todo" },
        { label: "Send for approval", state: "todo" },
      ],
      progressLabel: "Generating module 3 of 8",
      progressPct: 35,
      sources: [
        "Syllabus_CS301_v2.pdf",
        "Introduction_to_Algorithms_CLRS.epub",
        "ACM_Curriculum_Guidelines_2024.pdf",
      ],
      cards: [
        {
          kind: "AI: MODULE 3 OBJECTIVE",
          drafted: "Drafted 1m ago",
          title: "Analyze average and worst-case time complexities of basic graph search procedures.",
          body: "",
          citations: [
            'Source Citation: "Introduction to Algorithms (CLRS)", Chapter 22 (Elementary Graph Algorithms), Section 22.2, Page 594.',
          ],
        },
        {
          kind: "AI: ASSESSMENT CRITERIA",
          drafted: "Drafted 2m ago",
          title: "",
          body: "Formulate mathematical proofs verifying memory complexity bounds O(V + E) of Depth-First Search algorithms on adjacency lists.",
          citations: ['Source Citation: "Syllabus_CS301_v2.pdf", Course Prerequisites, Page 2.'],
        },
      ],
    },
  },

  "/instructor/f/in-14-outcome-mapping": {
    path: "/instructor/f/in-14-outcome-mapping",
    figmaId: "17:7596",
    title: "Course Learning Outcomes Matrix",
    subtitle: "Map weekly syllabus objectives across Bloom's Taxonomy cognitive dimensions",
    breadcrumbs: ["Studio", "Outcomes"],
    activeHref: "/instructor/f/in-14-outcome-mapping",
    shell: "studio",
    archetype: "outcomeMapping",
    primaryAction: "Open Question Generator",
    primaryActionHref: "/instructor/f/in-15-question-generator",
    outcomeMapping: {
      clos: [
        { id: "CLO-1", label: "Implement advanced graph storage schemas on sparse matrices.", coverage: 90 },
        { id: "CLO-2", label: "Verify binary heap structures and analyze tree mutation algorithms.", coverage: 65 },
        { id: "CLO-3", label: "Design recursive partition schemas for distributed databases.", coverage: 40 },
      ],
      bloomRows: [
        { level: "Knowledge & Recall", verb: "Core verb: Define", tags: ["CLO-1 Theory"] },
        { level: "Comprehension", verb: "Core verb: Explain", tags: [] },
        { level: "Application", verb: "Core verb: Solve / Use", tags: ["CLO-1 Practice", "CLO-2 Lab"] },
        { level: "Analysis", verb: "Core verb: Differentiate", tags: ["CLO-3 Analysis"] },
        { level: "Synthesis & Design", verb: "Core verb: Construct", tags: ["CLO-3 Architecture"] },
        { level: "Evaluation", verb: "Core verb: Critique", tags: [] },
      ],
    },
  },

  "/instructor/f/in-15-question-generator": {
    path: "/instructor/f/in-15-question-generator",
    figmaId: "17:7724",
    title: "AI Question Generator",
    subtitle: "Auto-generate diverse question sets optimized for direct course objective assessment",
    breadcrumbs: ["Studio", "Assessments"],
    activeHref: "/instructor/f/in-15-question-generator",
    shell: "studio",
    archetype: "questionGenerator",
    primaryAction: "Generate Questions",
    secondaryAction: "Add to Question Bank",
    secondaryActionHref: "/instructor/f/in-16-rubric-generator",
    questionGenerator: {
      topic: "Recursion Trees & Merge Sort Complexity",
      difficulty: "Medium (Undergraduate Core)",
      type: "Multiple Choice (MCQ)",
      count: "5 Questions",
      questions: [
        {
          id: "q1",
          prompt: "What is the height of a recursion tree generated by T(n) = 2T(n/2) + O(n)?",
          options: [
            { key: "A", text: "O(1)" },
            { key: "B", text: "O(log n)", correct: true },
            { key: "C", text: "O(n)" },
            { key: "D", text: "O(n log n)" },
          ],
        },
        {
          id: "q2",
          prompt: "What is the work completed at the root of a partition recursion tree of size N?",
          options: [
            { key: "A", text: "O(1)" },
            { key: "B", text: "O(N)", correct: true },
            { key: "C", text: "O(log N)" },
            { key: "D", text: "O(N log N)" },
          ],
        },
      ],
    },
  },

  "/instructor/f/in-16-rubric-generator": {
    path: "/instructor/f/in-16-rubric-generator",
    figmaId: "17:7830",
    title: "Syllabus Grading Rubric Studio",
    subtitle: "Generate standardized assessment rubrics synced to specific assignment topics",
    breadcrumbs: ["Studio", "Rubrics"],
    activeHref: "/instructor/f/in-16-rubric-generator",
    shell: "studio",
    archetype: "rubricGenerator",
    primaryAction: "Use this rubric",
    secondaryAction: "Submit for Approval",
    secondaryActionHref: "/instructor/f/in-17-course-approval",
    rubricGenerator: {
      criteria: [
        {
          name: "Code Design & Style",
          weight: "35%",
          excellent: "Exemplary recursive architectures cleanly utilizing modularized, memory efficient algorithms.",
          proficient: "Code designs are modularized correctly but miss optimal local complexity boundaries.",
          developing: "Contains partial modularization but recursive traces are poorly bound.",
          beginning: "Linear unstructured codes with no recursive depth or encapsulation.",
        },
        {
          name: "Mathematical Proof",
          weight: "35%",
          excellent: "Complete induction steps and sound recurrence relations mapping trees directly.",
          proficient: "Valid induction structure with minor calculation errors on tree height boundaries.",
          developing: "Missing clear recurrence formulas but maintains base induction logic.",
          beginning: "No mathematical mappings or valid proofs of complexity bounds.",
        },
        {
          name: "Test Coverage",
          weight: "35%",
          excellent: "All edge cases (empty matrices, single trees) tested rigorously with zero fail bounds.",
          proficient: "Primary paths covered thoroughly but misses boundary edge variables.",
          developing: "Minimal testing implemented without edge-case assertions.",
          beginning: "No program tests executed or logged in submittal schema.",
        },
      ],
    },
  },

  "/instructor/f/t16-teacher-messages-chat": {
    path: "/instructor/f/t16-teacher-messages-chat",
    figmaId: "4:6136",
    title: "Messages",
    subtitle: "Secure faculty messaging with student academic context.",
    breadcrumbs: ["Home", "Messages"],
    activeHref: "/instructor/f/t16-teacher-messages-chat",
    shell: "campus",
    archetype: "messages",
  },

  "/instructor/notifications": {
    path: "/instructor/notifications",
    figmaId: "4:6347",
    title: "Notifications",
    subtitle: "Alerts and updates about your courses, students and account.",
    breadcrumbs: ["Home", "Notifications"],
    activeHref: "/instructor/notifications",
    shell: "campus",
    archetype: "notifications",
    primaryAction: "Notification Preferences",
    secondaryAction: "Mark All as Read",
    notifications: {
      termLabel: "Term: Fall 2026",
      filters: [
        { label: "All Alerts" },
        { label: "Unread", count: 7 },
        { label: "Academic", count: 3 },
        { label: "Attendance", count: 2 },
        { label: "Assignments", count: 1 },
        { label: "System", count: 1 },
      ],
      items: [
        {
          title: "Grade submission approved",
          body: "ACC201 Sec-A final marks matching systemic grading rubric published successfully.",
          when: "2 hours ago",
          category: "Assignments",
          unread: true,
          tone: "success",
          cta: "View Gradebook",
          href: "/instructor/gradebook",
          icon: "file-text",
        },
        {
          title: "Attendance threshold alert",
          body: "3 students fell below compliance safety line (75% threshold) in FIN301 Session-B.",
          when: "4 hours ago",
          category: "Attendance",
          unread: true,
          tone: "warning",
          cta: "Open Attendance Sheet",
          href: "/instructor/attendance",
          icon: "user-check",
        },
        {
          title: "Workshop reminder",
          body: "Advanced Rubric Design tomorrow 2 PM at Academic Copilot Hub.",
          when: "1 day ago",
          category: "Academic",
          tone: "info",
          cta: "View Calendar Event",
          href: "/instructor/calendar",
          icon: "calendar",
        },
        {
          title: "Student message received",
          body: "Ahmed Hassan STU-4521 sent a revision artifact for ACC201.",
          when: "1 day ago",
          category: "Academic",
          unread: true,
          tone: "info",
          cta: "Go to Chat",
          href: "/instructor/messages",
          icon: "user",
        },
        {
          title: "Schedule change conflict logged",
          body: "BUS400 Friday Lecture shifted from Node C to Campus Center B315.",
          when: "2 days ago",
          category: "System",
          tone: "muted",
          cta: "Resolve Conflict",
          href: "/instructor/calendar",
          icon: "bell",
        },
        {
          title: "Rubric draft saved",
          body: "CS 301 Syllabus Grading Rubric Studio auto-saved v0.6.",
          when: "Yesterday",
          category: "Assignments",
          tone: "info",
          cta: "Open Rubric Studio",
          href: "/instructor/rubrics",
          icon: "file-text",
        },
      ],
      pagination: "Showing 1–6 of 24 notifications",
    },
  },

  "/instructor/calendar": {
    path: "/instructor/calendar",
    figmaId: "4:6547",
    title: "Teaching Calendar",
    subtitle: "Week view across classes, office hours, and committees.",
    breadcrumbs: ["Home", "Calendar"],
    activeHref: "/instructor/calendar",
    shell: "campus",
    archetype: "timetable",
    timetable: {
      rangeLabel: "October 7–11 2026",
      termLabel: "FALL 2026 TERM",
      views: ["Day", "Week", "Month", "Today"],
      activeView: "Week",
      filters: ["Show All", "Classes", "Office Hours", "Committees"],
      days: [
        {
          label: "Mon",
          date: "7",
          events: [
            { title: "Accounting Principles", time: "09:00–10:30", tone: "blue" },
            { title: "Office Hours", time: "16:00–17:30", tone: "green" },
          ],
        },
        {
          label: "Tue",
          date: "8",
          events: [{ title: "Corporate Finance", time: "11:00–12:30", tone: "purple" }],
        },
        {
          label: "Wed",
          date: "9",
          events: [
            { title: "Accounting Principles", time: "09:00–10:30", tone: "blue" },
            { title: "Academic Board", time: "14:00–15:30", tone: "orange" },
          ],
        },
        {
          label: "Thu",
          date: "10",
          events: [
            { title: "Corporate Finance", time: "11:00–12:30", tone: "purple" },
            { title: "Office Hours", time: "14:00–15:30", tone: "green" },
          ],
        },
        {
          label: "Fri",
          date: "11",
          events: [{ title: "Strategic Management", time: "09:00–12:00", tone: "blue" }],
        },
      ],
    },
  },

  "/instructor/f/t32-resource-file-manager": {
    path: "/instructor/f/t32-resource-file-manager",
    figmaId: "4:8858",
    title: "ACC201 Resources",
    subtitle: "Course file manager for Section A instructional materials.",
    breadcrumbs: ["Home", "My Courses", "ACC201", "Resources"],
    activeHref: "/instructor/sections",
    shell: "campus",
    archetype: "fileManager",
    primaryAction: "Upload Files",
    secondaryAction: "Create Folder",
    fileManager: {
      courseTitle: "ACC201 Resources",
      breadcrumbs: ["My Courses", "ACC201 Sec-A", "Resources"],
      tree: [
        { name: "Syllabus & Policies", children: ["Syllabus_Fall2026.pdf", "Academic_Integrity.pdf"] },
        {
          name: "Week Materials",
          active: true,
          children: ["Week_01", "Week_02", "Week_03", "Week_04"],
        },
        { name: "Assessments", children: ["Midterm_Blueprint.docx", "Rubrics"] },
        { name: "Archives", children: ["Fall_2025"] },
      ],
      files: [
        {
          name: "W04_Adjusting_Entries.pptx",
          type: "Slides",
          size: "4.8 MB",
          updated: "Oct 5, 2026",
          visibility: "Published",
          selected: true,
          folder: "Week Materials",
        },
        {
          name: "Journal_Entry_Template.xlsx",
          type: "Sheet",
          size: "128 KB",
          updated: "Oct 4, 2026",
          visibility: "Published",
          selected: true,
          folder: "Week Materials",
        },
        {
          name: "Lab_C01_Checklist.pdf",
          type: "PDF",
          size: "210 KB",
          updated: "Oct 3, 2026",
          visibility: "Published",
          selected: true,
          folder: "Week Materials",
        },
        {
          name: "Midterm_Practice_Set.pdf",
          type: "PDF",
          size: "890 KB",
          updated: "Oct 2, 2026",
          visibility: "Hidden",
          selected: true,
          folder: "Assessments",
        },
        {
          name: "Instructor_Notes_Private.docx",
          type: "Doc",
          size: "64 KB",
          updated: "Oct 1, 2026",
          visibility: "Hidden",
          folder: "Syllabus & Policies",
        },
      ],
    },
  },

  "/instructor/f/t33-help-support": {
    path: "/instructor/f/t33-help-support",
    figmaId: "4:9078",
    title: "Faculty Support Center",
    subtitle: "Guides, tickets, and secure escalation for instructors.",
    breadcrumbs: ["Home", "Help & Support"],
    activeHref: "/instructor/f/t33-help-support",
    shell: "campus",
    archetype: "helpSupport",
    helpSupport: {
      topics: [
        { title: "Gradebook & Publishing", detail: "Submission windows, overrides, and audit trails.", icon: "bar-chart" },
        { title: "Attendance & Early Warning", detail: "Thresholds, alerts, and advisor handoff.", icon: "user-check" },
        { title: "AI Course Studio", detail: "Ingestion, generation, outcomes, and rubrics.", icon: "sparkle" },
        { title: "Scheduling Conflicts", detail: "Resolve meeting pattern and room clashes.", icon: "calendar" },
        { title: "Student Messaging", detail: "Secure threads and academic context panels.", icon: "file-text" },
        { title: "Account & Security", detail: "MFA, sessions, and recovery codes.", icon: "user" },
      ],
      tickets: [],
      references: [
        { name: "Faculty Grade Submission Guide", meta: "PDF · 12 pages" },
        { name: "Early Warning Protocol", meta: "PDF · 6 pages" },
        { name: "AI Studio Faculty Quickstart", meta: "PDF · 9 pages" },
      ],
      hours: "Mon–Fri · 8:00–18:00 ET",
      contacts: [
        { label: "Registrar", value: "registrar@heritage.edu" },
        { label: "IT Helpdesk", value: "helpdesk@heritage.edu" },
      ],
    },
  },

  "/instructor/attendance": {
    path: "/instructor/attendance",
    figmaId: "3:4952",
    title: "Course Attendance",
    subtitle: "Mark and submit attendance for your course sections",
    breadcrumbs: ["Home", "Course Attendance"],
    activeHref: "/instructor/attendance",
    shell: "campus",
    archetype: "attendanceSession",
    primaryAction: "Submit & Finalize Session",
    secondaryAction: "Save Draft State",
    attendanceSession: {
      alert:
        "3 students are below the 75% attendance threshold in this section.",
      classNode: "ACC201 Sec-A",
      dateLabel: "Oct 7, 2026 (09:00 AM)",
      rosterTitle: "Student Roster (32 Total)",
      draftStatus: "Draft · 28 marked",
      students: [
        {
          name: "Aris Thorne",
          id: "ST-9284",
          status: "Late",
          note: "Transit delays reported on Subway Node C",
          pct: "72%",
          atRisk: true,
          avatar: "/brand/teacher/student-aris.jpeg",
        },
        {
          name: "Marcus Vance",
          id: "ST-1102",
          status: "Present",
          note: "—",
          pct: "96%",
          avatar: "/brand/teacher/student-marcus.jpeg",
        },
        {
          name: "Chloe Miller",
          id: "ST-4521",
          status: "Absent",
          note: "Medical notice submitted",
          pct: "74%",
          atRisk: true,
          avatar: "/brand/teacher/student-chloe.jpeg",
        },
        {
          name: "Elena Rostova",
          id: "ST-8831",
          status: "Present",
          note: "—",
          pct: "98%",
          avatar: "/brand/teacher/student-elena.png",
        },
        {
          name: "Dave Patel",
          id: "ST-2290",
          status: "Excused",
          note: "Official athletic travel waiver",
          pct: "68%",
          atRisk: true,
          avatar: "/brand/teacher/student-dave.png",
        },
      ],
      stats: [
        { label: "Present", count: 24, pct: "75.0%" },
        { label: "Absent", count: 4, pct: "12.5%" },
        { label: "Late", count: 3, pct: "9.4%" },
        { label: "Excused", count: 1, pct: "3.1%" },
      ],
    },
  },

  "/instructor/f/t21-attendance-correction-review": {
    path: "/instructor/f/t21-attendance-correction-review",
    figmaId: "4:7002",
    title: "Attendance Reviews",
    subtitle: "Attendance correction requests",
    breadcrumbs: ["Home", "Attendance Reviews"],
    activeHref: "/instructor/f/t21-attendance-correction-review",
    shell: "campus",
    archetype: "attendanceReview",
    attendanceReview: {
      filters: [
        { label: "Pending Corrections", count: 3, active: true },
        { label: "Approved", count: 12 },
        { label: "Rejected", count: 2 },
      ],
      requests: [
        {
          name: "Aris Thorne",
          id: "ST-9284",
          course: "ACC201 Sec-A",
          date: "Oct 3, 2026",
          current: "Absent",
          requested: "Excused",
          reason: "Transit delays due to Subway Node C outage. Official delay notice attached.",
          attachment: "Subway_Delay_Notice_Oct3.pdf",
        },
        {
          name: "Chloe Miller",
          id: "ST-4521",
          course: "ACC201 Sec-A",
          date: "Oct 5, 2026",
          current: "Absent",
          requested: "Present",
          reason: "Incorrect mark — student was in lab overflow room B210 with TA sign-in.",
          attachment: "Lab_Overflow_SignIn_Oct5.pdf",
        },
      ],
      compliance: {
        student: "Aris Thorne",
        fromPct: "72%",
        toPct: "75%",
        badge: "Clears Critical System Deviation Alert",
      },
      logNote:
        "All processed attendance tokens are logged under university quality audit rules. Changes reflect immediately in student GPA dashboards.",
    },
  },

  "/instructor/f/t19-create-edit-assessment": {
    path: "/instructor/f/t19-create-edit-assessment",
    figmaId: "4:6721",
    title: "Create Assessment",
    subtitle: "Create or edit an assessment",
    breadcrumbs: ["My Courses", "ACC201 Sec-A", "New Assessment"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "assessmentBuilder",
    primaryAction: "Publish Assessment",
    secondaryAction: "Save Draft",
    assessmentBuilder: {
      crumb: ["My Courses", "ACC201 Sec-A", "New Assessment"],
      heading: "Design New Assessment",
      description: "Create grade matching rubrics and upload syllabus artifacts.",
      title: "ACC201 Midterm Examination 2026",
      type: "Written Exam",
      weight: "20%",
      rubricHeaders: ["Criterion", "Excellent (5pts)", "Good (4pts)", "Poor (2pts)"],
      rubricRows: [
        {
          criterion: "Balance Accuracy",
          excellent: "Zero ledger error",
          good: "Minor rounding",
          poor: ">5% discrepancy",
        },
      ],
      uploadHint: "Drag & drop syllabus outline or rubric files",
      uploadFormats: "Supported formats: PDF, DOCX up to 16MB",
      preview: {
        badge: "ACC201 SEC-A • MIDTERM",
        title: "ACC201 Midterm Examination 2026",
        weight: "Weight: 20% of final grade",
        openDate: "Open Date: Oct 12, 2026",
        dueDate: "Due Date: Oct 15, 2026",
      },
    },
  },

  "/instructor/f/t20-grade-correction-workflow": {
    path: "/instructor/f/t20-grade-correction-workflow",
    figmaId: "4:6864",
    title: "Grade Correction Review",
    subtitle: "Grade changes submitted for your course sections",
    breadcrumbs: ["Home", "Grades", "Grade Correction"],
    activeHref: "/instructor/f/t14-course-management",
    archetype: "syllabusDiff",
    syllabusDiff: {
      badge: "",
      currentTitle: "Request",
      proposedTitle: "Grades in this request",
      current: [],
      proposed: [],
      comments: [],
    },
  },

  "/instructor/f/t61-grading-schemes": {
    path: "/instructor/f/t61-grading-schemes",
    figmaId: "4:16047",
    title: "Manage Grading Schemes",
    subtitle: "Grading schemes",
    breadcrumbs: ["Home", "Grading Schemes"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "gradingSchemes",
    primaryAction: "Create Grading Scheme",
    primaryActionHref: "/instructor/f/t64-add-grading-scheme",
    gradingSchemes: {
      searchPlaceholder: "Enter Search Filter Here",
      schemes: [],
    },
  },

  "/instructor/f/t64-add-grading-scheme": {
    path: "/instructor/f/t64-add-grading-scheme",
    figmaId: "4:16048",
    title: "Add Grading Scheme",
    subtitle: "Add a grading scheme",
    breadcrumbs: ["Home", "Grading Schemes", "Add Grading Schemes"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "form",
    primaryAction: "Save Grading Scheme",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t61-grading-schemes",
    form: {
      submitLabel: "Save Grading Scheme",
      groups: [
        {
          title: "Grading Scheme Details",
          fields: [
            { label: "Grading Scheme Name", value: "", type: "text" },
            {
              label: "This is the default grading scheme",
              value: "false",
              type: "checkbox",
            },
            {
              label: "Use Letter Grades",
              value: "Yes",
              type: "select",
              options: [
                { label: "Yes", value: "Yes" },
                { label: "No", value: "No" },
              ],
            },
            {
              label: "Use Percentages",
              value: "Yes",
              type: "select",
              options: [
                { label: "Yes", value: "Yes" },
                { label: "No", value: "No" },
              ],
            },
            {
              label: "Enable round-up options for marginal letter grades in final standings.",
              value: "false",
              type: "checkbox",
            },
            {
              label: "Use Grade Points",
              value: "Yes",
              type: "select",
              options: [
                { label: "Yes", value: "Yes" },
                { label: "No", value: "No" },
              ],
            },
            {
              label: "Active / Inactive",
              value: "Active",
              type: "select",
              options: [
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ],
            },
          ],
        },
      ],
      gradeEntries: {
        addLabel: "Add",
        creditOptions: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" },
        ],
        conditionOptions: [
          { label: "None", value: "None" },
          { label: "Pass", value: "Pass" },
          { label: "Fail", value: "Fail" },
          { label: "Incomplete", value: "Incomplete" },
          { label: "Withdraw", value: "Withdraw" },
        ],
        draft: {
          letter: "",
          percent: "",
          percentUp: "0.00",
          gradePoint: "",
          credit: "Yes",
          condition: "None",
        },
        entries: [],
      },
    },
  },

  "/instructor/f/t65-course-backups": makeTable({
    path: "/instructor/f/t65-course-backups",
    figmaId: "4:16501",
    title: "Course Backups",
    subtitle: "Course backups",
    breadcrumbs: ["Home", "Course Management", "Course Backups"],
    activeHref: "/instructor/f/t14-course-management",
    countLabel: "0 backups",
    columns: ["Backup Name", "Course", "Created", "Size", "Status", "Actions"],
    rows: [],
  }),

  "/instructor/f/t66-course-configurations": {
    path: "/instructor/f/t66-course-configurations",
    figmaId: "4:16502",
    title: "Course Configurations",
    subtitle: "",
    breadcrumbs: ["Home", "Course Management", "Course Configurations"],
    activeHref: "/instructor/f/t66-course-configurations",
    archetype: "courseConfigurations",
    primaryAction: "Create Configuration",
    primaryActionHref: "/instructor/f/t66-course-configurations?courseId=new",
    searchPlaceholder: "Enter Search Filter Here",
    courseConfigurations: {
      searchPlaceholder: "Enter Search Filter Here",
      courses: [
        {
          id: "course-dap-practicum",
          name: "DAP PRACTICUM",
          abbreviation: "0",
          enrollmentPermission: "No permission required",
          syllabusPrivacy: "Private",
          repositorySettings: "Use brand settings",
          textbookOptOut: "System Default",
          active: true,
          href: "/instructor/f/t66-course-configurations?courseId=course-dap-practicum",
        },
        {
          id: "course-capa-dap-105",
          name: "Computerized Accounting",
          abbreviation: "CAPA-DAP 105",
          enrollmentPermission: "No permission required",
          syllabusPrivacy: "Private",
          repositorySettings: "Use brand settings",
          textbookOptOut: "System Default",
          active: true,
          href: "/instructor/f/t66-course-configurations?courseId=course-capa-dap-105",
        },
        {
          id: "course-capa-dap-106",
          name: "Modern Office Technology",
          abbreviation: "CAPA-DAP 106",
          enrollmentPermission: "Instructor approval",
          syllabusPrivacy: "Enrolled students",
          repositorySettings: "Course-specific",
          textbookOptOut: "Allow opt-out",
          active: true,
          href: "/instructor/f/t66-course-configurations?courseId=course-capa-dap-106",
        },
        {
          id: "course-capa-dap-110",
          name: "Payroll Compliance Basics",
          abbreviation: "CAPA-DAP 110",
          enrollmentPermission: "No permission required",
          syllabusPrivacy: "Private",
          repositorySettings: "Use brand settings",
          textbookOptOut: "System Default",
          active: true,
          href: "/instructor/f/t66-course-configurations?courseId=course-capa-dap-110",
        },
        {
          id: "course-capa-dib-112",
          name: "Business Communication Theory",
          abbreviation: "CAPA-DIB 112",
          enrollmentPermission: "No permission required",
          syllabusPrivacy: "Institution",
          repositorySettings: "Use brand settings",
          textbookOptOut: "No opt-out",
          active: true,
          href: "/instructor/f/t66-course-configurations?courseId=course-capa-dib-112",
        },
      ],
    },
  },

  "/instructor/f/t67-course-types": {
    path: "/instructor/f/t67-course-types",
    figmaId: "4:16503",
    title: "Manage Course Types",
    subtitle: "Course types and groups",
    breadcrumbs: ["Home", "Course Types"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "courseTypes",
    primaryAction: "Create Course Type",
    primaryActionHref: "/instructor/f/t69-add-course-type",
    courseTypes: {
      searchPlaceholder: "Enter Search Filter Here",
      types: [
        { id: "ctype-lecture", name: "Lecture", abbreviation: "LEC", active: true },
        { id: "ctype-online", name: "Online", abbreviation: "ON", active: true },
      ],
    },
  },

  "/instructor/f/t68-add-course-group": {
    path: "/instructor/f/t68-add-course-group",
    figmaId: "4:16504",
    title: "Add Course Group",
    subtitle: "Add a course group",
    breadcrumbs: ["Home", "Course Groups", "Add Course Group"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "form",
    primaryAction: "Save Course Group",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t59-course-groups-types",
    form: {
      submitLabel: "Save Course Group",
      groups: [
        {
          title: "Course Group Details",
          fields: [
            { label: "Course Group Name", value: "", type: "text", language: "English" },
            { label: "Abbreviation", value: "", type: "text", language: "English" },
          ],
        },
      ],
    },
  },

  "/instructor/f/t69-add-course-type": {
    path: "/instructor/f/t69-add-course-type",
    figmaId: "4:16505",
    title: "Add Course Type",
    subtitle: "Add a course type",
    breadcrumbs: ["Home", "Course Types", "Add Course Type"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "form",
    primaryAction: "Save Course Type",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t67-course-types",
    form: {
      submitLabel: "Save Course Type",
      groups: [
        {
          title: "Course Type Details",
          fields: [
            { label: "Course Type Name", value: "", type: "text", language: "English" },
            { label: "Abbreviation", value: "", type: "text", language: "English" },
            {
              label: "Active / Inactive",
              value: "Active",
              type: "select",
              options: [
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ],
            },
            {
              label: "Learning Style",
              value: "Face to Face",
              type: "select",
              options: [
                { label: "Face to Face", value: "Face to Face" },
                { label: "Online", value: "Online" },
                { label: "Hybrid", value: "Hybrid" },
              ],
            },
            {
              label: "Asynchronous",
              value: "No",
              type: "select",
              options: [
                { label: "No", value: "No" },
                { label: "Yes", value: "Yes" },
              ],
            },
            {
              label: "Customize enrolment permissions",
              value: "false",
              type: "checkbox",
            },
          ],
        },
      ],
    },
  },

  "/instructor/f/t70-add-badge": {
    path: "/instructor/f/t70-add-badge",
    figmaId: "4:16506",
    title: "Add Badge / Accomplishment",
    subtitle: "Add a badge or accomplishment",
    breadcrumbs: ["Home", "Badges & Accomplishments", "Add Badge / Accomplishment"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "form",
    primaryAction: "Save Badge / Accomplishment",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t82-badges-accomplishments",
    form: {
      submitLabel: "Save Badge / Accomplishment",
      groups: [
        {
          title: "Badge / Accomplishment Details",
          fields: [
            { label: "Name", value: "", type: "text", language: "English" },
            { label: "Description", value: "", type: "textarea", language: "English" },
            { label: "Badge Text", value: "", type: "textarea", language: "English" },
            { label: "Badge Image", value: "", type: "file", language: "English" },
          ],
        },
        {
          title: "Badge / Accomplishment Settings",
          fields: [
            {
              label: "Badge Approval",
              value: "Instant / Automated",
              type: "select",
              options: [
                { label: "Instant / Automated", value: "Instant / Automated" },
                { label: "Manual review", value: "Manual review" },
              ],
            },
            {
              label: "Badge Type",
              value: "Designation / Academic Performance",
              type: "select",
              options: [
                { label: "Designation / Academic Performance", value: "Designation / Academic Performance" },
                { label: "Participation", value: "Participation" },
                { label: "Skill", value: "Skill" },
              ],
            },
            {
              label: "Program(s)",
              value: "All Programs",
              type: "select",
              options: [
                { label: "All Programs", value: "All Programs" },
                { label: "DAP", value: "DAP" },
                { label: "DIB", value: "DIB" },
              ],
            },
            {
              label: "Courses Completed",
              value: "Any",
              type: "select",
              options: [
                { label: "Any", value: "Any" },
                { label: "All required", value: "All required" },
              ],
            },
            {
              label: "Terms Completed",
              value: "Any",
              type: "select",
              options: [
                { label: "Any", value: "Any" },
                { label: "Minimum 1", value: "Minimum 1" },
              ],
            },
            {
              label: "Required Average Type",
              value: "None",
              type: "select",
              options: [
                { label: "None", value: "None" },
                { label: "GPA", value: "GPA" },
                { label: "Percent", value: "Percent" },
              ],
            },
          ],
        },
      ],
    },
  },

  "/instructor/f/t62-pending-grade-submissions": {
    path: "/instructor/f/t62-pending-grade-submissions",
    figmaId: "4:16245",
    title: "Pending Grade Submissions",
    subtitle: "Grades awaiting review",
    breadcrumbs: ["Home", "Grades", "Pending Submissions"],
    activeHref: "/instructor/f/t14-course-management",
    shell: "campus",
    archetype: "pendingGrades",
    primaryAction: "Audit & Approve",
    secondaryAction: "Reject Submission",
    pendingGrades: {
      alert: "PENDING GRADE AUDITS REQUIRE IMMEDIATE INSTRUCTOR SIGN-OFF BY DEC 15 SPRINT END.",
      queueTitle: "Auditable Submissions Queue",
      actionBadge: "4 ACTION REQUIRED",
      rows: [
        { code: "ACC201 A", title: "Accounting Principles", teacher: "D. Mitchell", students: "32", missing: "0", missingTone: "ok", status: "SUBMITTED", active: true },
        { code: "FIN301 B", title: "Corporate Finance", teacher: "J. Vance", students: "28", missing: "3", missingTone: "warn", status: "UNDER REVIEW" },
        { code: "MGT101 C", title: "Business Basics", teacher: "S. Harris", students: "45", missing: "1", missingTone: "warn", status: "SUBMITTED" },
        { code: "MKT302 A", title: "Brand Marketing", teacher: "A. Sterling", students: "24", missing: "0", missingTone: "ok", status: "REJECTED" },
      ],
      audit: {
        title: "Gradebook Audit: ACC201 Sec A",
        locked: "100% Locked",
        average: "B+ (82.4%)",
        notes: "All ledger tasks and midterm tests audited. Student profiles cross-verified with registry outcomes.",
        rejectPlaceholder: "Specify reasons here...",
      },
    },
  },

  "/instructor/f/t11-workshops": {
    path: "/instructor/f/t11-workshops",
    figmaId: "3:5292",
    title: "My Workshops",
    subtitle: "Workshops assigned and available for this campus.",
    breadcrumbs: ["Home", "My Workshops"],
    activeHref: "/instructor/f/t11-workshops",
    archetype: "workshops",
    primaryAction: "New Workshop Enrolment",
    primaryActionHref: "/instructor/f/t42-new-workshop-enrollment",
    workshops: {
      tabs: ["My Workshops", "Available Workshops", "Completed Workshops"],
      activeTab: "My Workshops",
      credits: "",
      cards: [],
      registrations: [],
    },
  },

  "/instructor/f/t24-workshop-detail": {
    path: "/instructor/f/t24-workshop-detail",
    figmaId: "4:7678",
    title: "Workshop Detail",
    subtitle: "Workshop details and materials.",
    breadcrumbs: ["Home", "Workshops", "Detail"],
    activeHref: "/instructor/f/t11-workshops",
    archetype: "workshopDetail",
    workshopDetail: {
      title: "Workshop",
      status: "Open for Enrollment",
      when: "—",
      where: "—",
      seats: "—",
      description: "Select a workshop to view details.",
      agenda: [],
      materials: [],
    },
  },

  "/instructor/f/t40-workshop-enrollment-status": {
    path: "/instructor/f/t40-workshop-enrollment-status",
    figmaId: "4:11882",
    title: "WORKSHOP ENROLMENTS",
    subtitle: "Search and review student workshop enrolments.",
    breadcrumbs: ["Home", "Workshop Enrolments"],
    activeHref: "/instructor/f/t40-workshop-enrollment-status",
    archetype: "workshopEnrolments",
    workshopEnrolments: {
      studentPlaceholder: "Student #, login or last name",
      studentValue: "",
      workshopValue: "",
      workshopOptions: [{ label: "All Workshops", value: "" }],
      statusValue: "pending",
      statusOptions: [
        { label: "All Statuses", value: "all" },
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Declined", value: "declined" },
        { label: "Dropped", value: "dropped" },
      ],
      letter: "ALL",
      searchLabel: "Search Workshops",
      emptyMessage: "No workshop enrolments were found.",
      rows: [],
    },
  },

  "/instructor/f/t41-workshop-attendance": {
    path: "/instructor/f/t41-workshop-attendance",
    figmaId: "4:12042",
    title: "WORKSHOP ATTENDANCE",
    subtitle: "Mark present / absent for workshop sessions.",
    breadcrumbs: ["Home", "Workshop Attendance"],
    activeHref: "/instructor/f/t41-workshop-attendance",
    archetype: "workshopAttendance",
    primaryAction: "Week View",
    secondaryAction: "Print Roster",
    workshopAttendance: {
      date: "2026-09-18",
      studentPlaceholder: "Student # or last name",
      studentValue: "",
      workshopValue: "",
      workshopOptions: [{ label: "All Workshops", value: "" }],
      loadLabel: "Load Attendance",
      heading: "ATTENDANCE FOR: SEP. 18, 2026 (FRI.)",
      previousLabel: "« Sep. 17, 2026",
      previousDate: "2026-09-17",
      nextLabel: "Sep. 19, 2026 »",
      nextDate: "2026-09-19",
      emptyMessage: "No students were found. Please change the filters above to see other possibilities.",
      totalLabel: "Total Students: 0",
      saveLabel: "Save Attendance",
      weekDates: [],
      students: [],
    },
  },

  "/instructor/f/t42-new-workshop-enrollment": {
    path: "/instructor/f/t42-new-workshop-enrollment",
    figmaId: "4:12222",
    title: "NEW WORKSHOP ENROLMENT",
    subtitle: "Register a student into a workshop offering.",
    breadcrumbs: ["Home", "Workshop Enrolments", "New Workshop Enrolment"],
    activeHref: "/instructor/f/t40-workshop-enrollment-status",
    archetype: "form",
    primaryAction: "Save Enrolment",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t40-workshop-enrollment-status?status=pending",
    form: {
      submitLabel: "Save Enrolment",
      groups: [
        {
          title: "Student",
          fields: [{ label: "Student", value: "", type: "text", hint: "Student #, login or last name" }],
        },
        {
          title: "Workshop",
          fields: [
            { label: "Workshop", value: "", type: "select", options: [{ label: "All Workshops", value: "" }] },
            {
              label: "Status",
              value: "pending",
              type: "select",
              options: [
                { label: "Pending", value: "pending" },
                { label: "Approved", value: "approved" },
                { label: "Declined", value: "declined" },
                { label: "Dropped", value: "dropped" },
              ],
            },
            { label: "Note", value: "", type: "textarea", optional: true },
          ],
        },
      ],
    },
  },

  "/instructor/f/t12-students-view": {
    path: "/instructor/f/t12-students-view",
    figmaId: "3:5401",
    title: "STUDENTS",
    subtitle: "",
    breadcrumbs: ["Home", "Students"],
    activeHref: "/instructor/f/t12-students-view",
    archetype: "hccStudents",
  },

  "/instructor/f/t22-student-detail-full-page": {
    path: "/instructor/f/t22-student-detail-full-page",
    figmaId: "4:7293",
    title: "Student detail",
    subtitle: "Live student academic profile",
    breadcrumbs: ["Home", "Students", "Detail"],
    activeHref: "/instructor/f/t12-students-view",
    archetype: "studentDetail",
    primaryAction: "Create academic alert",
  },

  "/instructor/f/t43-create-student-profile": {
    path: "/instructor/f/t43-create-student-profile",
    figmaId: "4:12383",
    title: "Create Student Profile",
    subtitle: "Create a student profile",
    breadcrumbs: ["Home", "Students", "Create Profile"],
    activeHref: "/instructor/f/t12-students-view",
    archetype: "form",
    primaryAction: "Save Student Profile",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t12-students-view",
    form: {
      submitLabel: "Save Student Profile",
      groups: [
        {
          title: "Identity",
          fields: [
            { label: "Given Name", value: "", type: "text" },
            { label: "Family Name", value: "", type: "text" },
            { label: "Email", value: "", type: "text" },
            { label: "Program", value: "", type: "select", options: [] },
            { label: "Student Status", value: "", type: "select", options: [] },
          ],
        },
        {
          title: "Section placement",
          fields: [
            { label: "Course Name", value: "", type: "select", options: [] },
            { label: "Section", value: "", type: "select", options: [], dependsOn: "Course Name" },
          ],
        },
      ],
    },
  },

  "/instructor/f/t44-academic-alerts": {
    path: "/instructor/f/t44-academic-alerts",
    figmaId: "4:12498",
    title: "Academic Alerts",
    subtitle: "Academic alerts for your students",
    breadcrumbs: ["Home", "Students", "Academic Alerts"],
    activeHref: "/instructor/f/t12-students-view",
    archetype: "alertList",
    primaryAction: "Create alert",
  },

  "/instructor/f/t45-student-flags": makeTable({
    path: "/instructor/f/t45-student-flags",
    figmaId: "4:12620",
    title: "Student Flags",
    subtitle: "Flags raised for your students",
    breadcrumbs: ["Home", "Students", "Student Flags"],
    activeHref: "/instructor/f/t12-students-view",
    primaryAction: "Create Flag",
    primaryActionHref: "/instructor/f/t45-create-flag",
    columns: ["Student Name", "Flag Type", "Description", "Priority", "Status"],
    rows: [
      {
        cells: [
          "James Morrison · ID-49032",
          "ACADEMIC RISK",
          "Gradebook matching falls short on mid-term standard.",
          "High",
          "Active",
        ],
        badge: "High",
        badgeTone: "danger",
      },
      {
        cells: [
          "Chloe Henderson · ID-99014",
          "FINANCIAL HOLD",
          "Outstanding library module dues.",
          "Medium",
          "Active",
        ],
        badge: "Medium",
        badgeTone: "warning",
      },
      {
        cells: [
          "Arthur Pendelton · ID-12009",
          "SUCCESS NOTE",
          "Completed CTE Advanced syllabus benchmarks early.",
          "Low",
          "Resolved",
        ],
        badge: "Resolved",
        badgeTone: "success",
      },
    ],
  }),

  "/instructor/f/t45-create-flag": {
    path: "/instructor/f/t45-create-flag",
    figmaId: "4:12620",
    title: "Create Flag",
    subtitle: "Add a student flag from your assigned sections.",
    breadcrumbs: ["Home", "Students", "Student Flags", "Create Flag"],
    activeHref: "/instructor/f/t12-students-view",
    archetype: "modal",
    modal: {
      title: "Create Student Flag",
      description: "Flag a student for academic risk, holds, or success notes.",
      fields: [
        { label: "Student Name", value: "", type: "text" },
        { label: "Flag Type", value: "ACADEMIC RISK", type: "select" },
        { label: "Description", value: "", type: "text" },
        { label: "Priority", value: "High", type: "select" },
      ],
      confirmLabel: "Create Flag",
      cancelLabel: "Cancel",
      backdropHref: "/instructor/f/t45-student-flags",
    },
  },

  "/instructor/f/t46-student-assessments": makeTable({
    path: "/instructor/f/t46-student-assessments",
    figmaId: "4:12840",
    title: "Student Assessments",
    subtitle: "Student assessments overview",
    breadcrumbs: ["Home", "Students", "Assessments"],
    activeHref: "/instructor/f/t12-students-view",
    countLabel: "45 tasks · 8 pending grading · 12 missing",
    columns: ["Student", "Course", "Assessment Title", "Status", "Score", "Feedback"],
    rows: [
      {
        cells: ["Aria Vance · BBA-26-809", "ACC201 Sec A", "Mid-Term Audit Project", "Submitted ✓", "92 / 100", "Given"],
        badge: "Submitted ✓",
        badgeTone: "success",
      },
      {
        cells: [
          "Elena Rostova · BBA-26-441",
          "FIN301 Sec B",
          "Corporate valuation Case",
          "Late !",
          "Pending",
          "Pending Grading",
        ],
        badge: "Late !",
        badgeTone: "warning",
      },
      {
        cells: ["Marcus Brody · BBA-26-112", "ACC201 Sec A", "Mid-Term Audit Project", "Missing ✗", "-- / 100", "—"],
        badge: "Missing ✗",
        badgeTone: "danger",
      },
      {
        cells: ["Chloe Dupont · BBA-26-303", "ACC201 Sec A", "Mid-Term Audit Project", "Draft", "81 / 100", "Given"],
        badge: "Draft",
        badgeTone: "draft",
      },
    ],
  }),

  "/instructor/f/t47-student-requirements": makeTable({
    path: "/instructor/f/t47-student-requirements",
    figmaId: "4:13060",
    title: "Student Requirements",
    subtitle: "Student requirements",
    breadcrumbs: ["Home", "Students", "Requirements"],
    activeHref: "/instructor/f/t12-students-view",
    countLabel: "23 unmet critical · 5 deadlines this week",
    columns: ["Student", "Requirement", "Type", "Deadline", "Status", "Submitted"],
    rows: [
      {
        cells: ["Johnathan Smith · BBA-26-092", "ACC101 Prerequisite", "Prereq", "Sep 01, 2026", "Met ✓", "Aug 15, 2026"],
        badge: "Met ✓",
        badgeTone: "success",
      },
      {
        cells: [
          "Aria Vance · BBA-26-809",
          "Financial Statement Sign-off",
          "Financial",
          "Sep 15, 2026",
          "Pending ◯",
          "Sep 12, 2026",
        ],
        badge: "Pending ◯",
        badgeTone: "warning",
      },
      {
        cells: [
          "Elena Rostova · BBA-26-441",
          "Immunization Record V2",
          "Compliance",
          "Aug 20, 2026",
          "Unmet ✗",
          "MISSING",
        ],
        badge: "Unmet ✗",
        badgeTone: "danger",
      },
      {
        cells: [
          "Chloe Dupont · BBA-26-303",
          "Syllabus Compliance Pledge",
          "Document",
          "Sep 30, 2026",
          "Waived ~",
          "WAIVED BY DEAN",
        ],
        badge: "Waived ~",
        badgeTone: "muted",
      },
    ],
  }),

  "/instructor/f/t48-leave-of-absence": makeTable({
    path: "/instructor/f/t48-leave-of-absence",
    figmaId: "4:13242",
    title: "Leave of Absence (LOA)",
    subtitle: "Leave of absence requests",
    breadcrumbs: ["Home", "Students", "Leave of Absence"],
    activeHref: "/instructor/f/t12-students-view",
    primaryAction: "Submit New LOA",
    countLabel: "Active LOA · Pending Requests · Completed 15 · Denied",
    columns: ["Student", "Program", "LOA Type", "Start Date", "Expected Return", "Status"],
    rows: [
      {
        cells: [
          "Devon Lane · BBA-26-302",
          "Bachelor of Business Admin",
          "Medical",
          "Oct 12, 2026",
          "Jan 15, 2027",
          "Active - Med",
        ],
        badge: "Active - Med",
        badgeTone: "warning",
      },
      {
        cells: [
          "Jenny Wilson · BBA-25-104",
          "Bachelor of Business Admin",
          "Family Leave",
          "Nov 01, 2026",
          "Mar 01, 2027",
          "Active - Pers",
        ],
        badge: "Active - Pers",
        badgeTone: "info",
      },
      {
        cells: [
          "Guy Hawkins · BBA-26-905",
          "Bachelor of Business Admin",
          "Academic Prep",
          "Sep 15, 2026",
          "Feb 01, 2027",
          "Active - Acad",
        ],
        badge: "Active - Acad",
        badgeTone: "active",
      },
    ],
  }),

  "/instructor/f/t49-course-withdraw-requests": makeTable({
    path: "/instructor/f/t49-course-withdraw-requests",
    figmaId: "4:13392",
    title: "Withdraw Requests",
    subtitle: "Course withdrawal requests",
    breadcrumbs: ["Home", "Students", "Course Withdrawals"],
    activeHref: "/instructor/f/t12-students-view",
    countLabel: "Pending Review · Approved 12 · Denied",
    columns: ["Student", "Course", "Reason Category", "Reason Text", "Grade", "Att %"],
    rows: [
      {
        cells: [
          "Robert Fox · BBA-26-104",
          "ACC201 Sec A",
          "Academic Difficulty",
          "Struggling with ledger math fundamentals...",
          "52%",
          "64%",
        ],
        badge: "Pending",
        badgeTone: "warning",
      },
      {
        cells: [
          "Jane Cooper · BBA-26-905",
          "FIN301 Sec B",
          "Schedule Conflict",
          "New shift work hours overlap with lecture times...",
          "84%",
          "92%",
        ],
        badge: "Pending",
        badgeTone: "warning",
      },
      {
        cells: [
          "Cody Fisher · BBA-25-883",
          "ACC201 Sec A",
          "Personal Reasons",
          "Medical issue requiring family care commitments...",
          "78%",
          "81%",
        ],
        badge: "Pending",
        badgeTone: "info",
      },
    ],
  }),

  "/instructor/f/t63-students-by-status-filter": {
    path: "/instructor/f/t63-students-by-status-filter",
    figmaId: "4:16388",
    title: "Student Directory",
    subtitle: "Students by status",
    breadcrumbs: ["Home", "Students", "Status Filter"],
    activeHref: "/instructor/f/t12-students-view",
    archetype: "hccStudents",
  },

  "/instructor/f/t64-pending-transcript-changes": {
    path: "/instructor/f/t64-pending-transcript-changes",
    figmaId: "4:16400",
    title: "Pending Transcript Changes",
    subtitle: "Pending transcript changes",
    breadcrumbs: ["Home", "Pending Transcript Changes"],
    activeHref: "/instructor/f/t64-pending-transcript-changes",
    archetype: "hccTranscriptPending",
    hccTranscriptPending: {
      banner: "Currently no transcript changes are pending.",
    },
  },

  "/instructor/f/t13-program-management": {
    path: "/instructor/f/t13-program-management",
    figmaId: "3:5572",
    title: "MANAGE FACULTIES & PROGRAMS",
    subtitle: "",
    breadcrumbs: ["Home", "Faculties & Programs"],
    activeHref: "/instructor/f/t13-program-management",
    archetype: "facultiesPrograms",
    primaryAction: "Create Faculty",
    primaryActionHref: "/instructor/f/t81-add-faculty",
    secondaryAction: "Create Program",
    secondaryActionHref: "/instructor/f/t74-add-program",
    facultiesPrograms: {
      createFacultyHref: "/instructor/f/t81-add-faculty",
      createProgramHref: "/instructor/f/t74-add-program",
      faculties: [
        {
          id: "fac-accounting-payroll",
          name: "Accounting/Payroll",
          abbreviation: "",
          active: true,
          programs: [
            { id: "prog-capa", name: "Certificate in Accounting and Payroll Administrator", abbreviation: "CAPA", active: true, href: "/instructor/f/t83-program-settings?programId=prog-capa" },
            { id: "prog-dap", name: "Diploma in Accounting and Payroll administrator", abbreviation: "DAP", active: true, href: "/instructor/f/t83-program-settings?programId=prog-dap" },
          ],
        },
        {
          id: "fac-business",
          name: "Business",
          abbreviation: "",
          active: true,
          programs: [
            { id: "prog-btt", name: "Bank Teller Training", abbreviation: "BTT", active: true, href: "/instructor/f/t83-program-settings?programId=prog-btt" },
            { id: "prog-coa", name: "Certificate Office Administration", abbreviation: "COA", active: true, href: "/instructor/f/t83-program-settings?programId=prog-coa" },
            { id: "prog-csms", name: "Corporate Sales Management Strategies Certificate", abbreviation: "CSMS", active: true, href: "/instructor/f/t83-program-settings?programId=prog-csms" },
            { id: "prog-dmm", name: "Digital Marketing Management", abbreviation: "DMM", active: true, href: "/instructor/f/t83-program-settings?programId=prog-dmm" },
            { id: "prog-dib", name: "Diploma in International Business", abbreviation: "DIB", active: true, href: "/instructor/f/t83-program-settings?programId=prog-dib" },
            { id: "prog-hra", name: "Human Resources Administration", abbreviation: "HRA", active: true, href: "/instructor/f/t83-program-settings?programId=prog-hra" },
            { id: "prog-ma", name: "Marketing Administration", abbreviation: "MA", active: true, href: "/instructor/f/t83-program-settings?programId=prog-ma" },
            { id: "prog-oa", name: "Office Administration", abbreviation: "OA", active: true, href: "/instructor/f/t83-program-settings?programId=prog-oa" },
            { id: "prog-rsms", name: "Retail Sales Management Strategies Certificate", abbreviation: "RSMS", active: true, href: "/instructor/f/t83-program-settings?programId=prog-rsms" },
          ],
        },
        {
          id: "fac-computer-science",
          name: "Computer Science",
          abbreviation: "",
          active: true,
          programs: [
            { id: "prog-nsa", name: "Network Support Administrator", abbreviation: "NSA", active: true, href: "/instructor/f/t83-program-settings?programId=prog-nsa" },
            { id: "prog-nst", name: "Network Support Technician", abbreviation: "NST", active: true, href: "/instructor/f/t83-program-settings?programId=prog-nst" },
          ],
        },
        {
          id: "fac-ecea",
          name: "Early Childhood Educator Assistant",
          abbreviation: "ECEA",
          active: true,
          programs: [
            { id: "prog-ecea1", name: "Child Growth Development part 1 & 2", abbreviation: "ECEA option 1", active: true, href: "/instructor/f/t83-program-settings?programId=prog-ecea1" },
            { id: "prog-ecea2", name: "Child Growth Development Part I & II + Interpersonal Communication", abbreviation: "ECEA (Option 2)", active: true, href: "/instructor/f/t83-program-settings?programId=prog-ecea2" },
          ],
        },
        {
          id: "fac-health-science",
          name: "Health Science",
          abbreviation: "",
          active: true,
          programs: [
            { id: "prog-acsw", name: "Addictions Community Support Worker", abbreviation: "ACSW", active: true, href: "/instructor/f/t83-program-settings?programId=prog-acsw" },
            { id: "prog-hca", name: "Health Care Assistant", abbreviation: "HCA", active: true, href: "/instructor/f/t83-program-settings?programId=prog-hca" },
            { id: "prog-hca3", name: "Interpersonal Communication (HCA-3)", abbreviation: "HCA", active: true, href: "/instructor/f/t83-program-settings?programId=prog-hca3" },
            { id: "prog-moa", name: "Medical Office Assistant", abbreviation: "MOA", active: true, href: "/instructor/f/t83-program-settings?programId=prog-moa" },
            { id: "prog-sssw", name: "Social Services Support Worker", abbreviation: "SSSW", active: true, href: "/instructor/f/t83-program-settings?programId=prog-sssw" },
          ],
        },
        {
          id: "fac-hospitality-management",
          name: "Hospitality Management",
          abbreviation: "",
          active: true,
          programs: [
            { id: "prog-dhm", name: "Diploma in Hospitality Management", abbreviation: "DHM", active: true, href: "/instructor/f/t83-program-settings?programId=prog-dhm" },
          ],
        },
        {
          id: "fac-languages",
          name: "Languages",
          abbreviation: "",
          active: true,
          programs: [
            { id: "prog-esc", name: "English Skills for College", abbreviation: "ESC", active: true, href: "/instructor/f/t83-program-settings?programId=prog-esc" },
          ],
        },
      ],
    },
  },

  "/instructor/f/t74-add-program": {
    path: "/instructor/f/t74-add-program",
    figmaId: "4:16600",
    title: "ADD PROGRAM",
    subtitle: "Add a program",
    breadcrumbs: ["Home", "Faculties & Programs", "Add Program"],
    activeHref: "/instructor/f/t13-program-management",
    archetype: "form",
    primaryAction: "Save Program",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t13-program-management",
    form: buildAddProgramScreenForm(),
  },

  "/instructor/f/t81-add-faculty": {
    path: "/instructor/f/t81-add-faculty",
    figmaId: "3:5572",
    title: "ADD FACULTY",
    subtitle: "",
    breadcrumbs: ["Home", "Faculties & Programs", "Add Faculty"],
    activeHref: "/instructor/f/t13-program-management",
    archetype: "form",
    primaryAction: "Save Faculty",
    secondaryActionHref: "/instructor/f/t13-program-management",
    form: {
      submitLabel: "Save Faculty",
      groups: [
        {
          title: "FACULTY DETAILS",
          fields: [
            { label: "Faculty Name", value: "", type: "text", language: "English" },
            { label: "Faculty Abbreviation", value: "", type: "text" },
            {
              label: "Active / Inactive",
              value: "Active",
              type: "select",
              options: [
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ],
            },
          ],
        },
      ],
    },
  },

  "/instructor/f/t82-badges-accomplishments": {
    path: "/instructor/f/t82-badges-accomplishments",
    figmaId: "4:16420",
    title: "BADGES / ACCOMPLISHMENTS",
    subtitle: "",
    breadcrumbs: ["Home", "Badges / Accomplishments"],
    activeHref: "/instructor/f/t14-course-management",
    archetype: "hccBadges",
    primaryAction: "Add Badge / Accomplishment",
    primaryActionHref: "/instructor/f/t70-add-badge",
    hccBadges: {
      userFilter: "",
      badgeFilter: "All Badges",
      statusFilter: "Pending",
      badgeOptions: ["All Badges"],
      statusOptions: ["Pending", "Awarded", "Denied", "All"],
      rows: [],
      empty: "No badges / accomplishments were found.",
    },
  },

  "/instructor/f/t83-program-settings": {
    path: "/instructor/f/t83-program-settings",
    figmaId: "3:5572",
    title: "PROGRAM SETTINGS",
    subtitle: "",
    breadcrumbs: ["Home", "Faculties & Programs", "Program Settings"],
    activeHref: "/instructor/f/t13-program-management",
    archetype: "programSettings",
    programSettings: {
      tabs: [
        "Program Settings",
        "Program Pathway",
        "Fees & Tuition Price List",
        "Deadlines & Penalties",
        "Commission Rates",
        "Audit Changes",
      ],
      footerDate: "Sep. 19, 2026",
    },
  },

  "/instructor/f/t27-program-change-request": {
    path: "/instructor/f/t27-program-change-request",
    figmaId: "4:8112",
    title: "New Program Change Request",
    subtitle: "Request a change to a program's curriculum",
    breadcrumbs: ["Home", "Program Management", "Change Request"],
    activeHref: "/instructor/f/t13-program-management",
    archetype: "form",
    primaryAction: "Submit to Academic Chair",
    secondaryAction: "Save Draft",
    form: {
      submitLabel: "Submit to Academic Chair",
      groups: [
        {
          title: "Curriculum Amendment Form",
          fields: [
            {
              label: "Program",
              value: "Bachelor of Business Administration (BBA) • Version 2024.1 • Academic Chair: Prof. James Chen",
              type: "text",
            },
            {
              label: "Request Title",
              value: "Add Data Analytics Elective course to BBA Year 3 curriculum",
              type: "text",
            },
            { label: "Change Category", value: "Add Course Block / Curriculum Restructure", type: "select" },
            {
              label: "Detailed Justification",
              value:
                "Market feedback indicates strong demand for Business Data Analytics principles. Introducing this course during Semester A of Year 3 ensures our BBA candidates maintain analytical compliance before entering career pathways.",
              type: "textarea",
            },
            {
              label: "Supporting Academic Research Evidence",
              value: "Curriculum_Benchmark_Study.pdf attached",
              type: "text",
            },
          ],
        },
      ],
    },
  },

  "/instructor/f/t50-program-types": {
    path: "/instructor/f/t50-program-types",
    figmaId: "4:13533",
    title: "Manage Program Types",
    subtitle: "Program types used across faculties",
    breadcrumbs: ["Home", "Program Types"],
    activeHref: "/instructor/f/t13-program-management",
    shell: "campus",
    archetype: "programTypes",
    primaryAction: "Create Program Type",
    primaryActionHref: "/instructor/f/t75-add-program-type",
    programTypes: {
      searchPlaceholder: "Enter Search Filter Here",
      types: [],
    },
  },

  "/instructor/f/t75-add-program-type": {
    path: "/instructor/f/t75-add-program-type",
    figmaId: "4:13534",
    title: "Add Program Type",
    subtitle: "Add a program type",
    breadcrumbs: ["Home", "Program Types", "Add Program Type"],
    activeHref: "/instructor/f/t13-program-management",
    shell: "campus",
    archetype: "form",
    primaryAction: "Save Program Type",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t50-program-types",
    form: {
      submitLabel: "Save Program Type",
      groups: [
        {
          title: "Program Type Details",
          fields: [
            { label: "Program Type Name", value: "", type: "text", language: "English" },
            { label: "Abbreviation", value: "", type: "text", language: "English" },
            {
              label: "Active / Inactive",
              value: "Active",
              type: "select",
              options: [
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ],
            },
          ],
        },
      ],
    },
  },

  "/instructor/f/t51-manage-terms": {
    path: "/instructor/f/t51-manage-terms",
    figmaId: "4:13710",
    title: "Manage Terms",
    subtitle: "Academic terms and their dates",
    breadcrumbs: ["Home", "Manage Terms"],
    activeHref: "/instructor/f/t13-program-management",
    shell: "campus",
    archetype: "manageTerms",
    primaryAction: "Create Term",
    primaryActionHref: "/instructor/f/t76-add-term",
    manageTerms: {
      campusFilterLabel: "Filter Campus",
      campusOptions: [
        { label: "ALL CAMPUSES", value: "" },
        { label: "#110 CampusOne - Surrey", value: "#110 Heritage College- Surrey" },
        { label: "CampusOne - Distance", value: "Heritage Community College - Distance" },
        { label: "CampusOne - Victoria", value: "Heritage Community College - Victoria" },
      ],
      terms: [],
    },
  },

  "/instructor/f/t76-add-term": {
    path: "/instructor/f/t76-add-term",
    figmaId: "4:13711",
    title: "Add Term",
    subtitle: "Add a term",
    breadcrumbs: ["Home", "Manage Terms", "Add Term"],
    activeHref: "/instructor/f/t13-program-management",
    shell: "campus",
    archetype: "form",
    primaryAction: "Save Term",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t51-manage-terms",
    form: {
      submitLabel: "Save Term",
      groups: [
        {
          title: "Term Details",
          fields: [
            { label: "Term Name", value: "", type: "text", language: "English" },
            { label: "Term Abbreviation", value: "", type: "text", language: "English" },
            {
              label: "Campuses",
              value: "",
              type: "checkboxes",
              options: [
                { label: "#110 CampusOne - Surrey", value: "#110 Heritage College- Surrey" },
                {
                  label: "CampusOne - Distance",
                  value: "Heritage Community College - Distance",
                },
                {
                  label: "CampusOne - Victoria",
                  value: "Heritage Community College - Victoria",
                },
              ],
            },
          ],
        },
        {
          title: "Term Dates",
          fields: [
            { label: "Start Date", value: "", type: "date", sublabel: "Primary Dates" },
            { label: "End Date", value: "", type: "date" },
            { label: "Midterm Date", value: "", type: "date", optional: true, sublabel: "Other Dates (Optional)" },
            { label: "Last Instruction Date", value: "", type: "date", optional: true },
            { label: "Exam Start Date", value: "", type: "date", optional: true },
            { label: "Exam End Date", value: "", type: "date", optional: true },
            { label: "Census Date", value: "", type: "date", optional: true },
          ],
        },
      ],
      customEventDates: {
        title: "Custom Event Dates",
        addLabel: "+ Add Event Date",
        events: [],
      },
      enrolmentConditions: {
        title: "Enrolment Conditions",
        addLabel: "Add Enrolment Condition",
        emptyMessage: "No enrolment conditions exist for this term.",
        disabledNote: "Self-enrolment is currently disabled.",
        columns: ["Enrolment Dates", "Programs", "Completion Conditions", "Standing Conditions"],
        rows: [],
      },
      deadlines: {
        title: "Deadlines",
        addLabel: "Add Deadline",
        emptyMessage: "No deadlines exist for this term.",
        columns: ["Condition", "Type", "Penalty"],
        rows: [],
      },
    },
  },

  "/instructor/f/t84-review-term": {
    path: "/instructor/f/t84-review-term",
    figmaId: "4:13712",
    title: "Review Term",
    subtitle: "Review term details",
    breadcrumbs: ["Home", "Manage Terms", "Review Term"],
    activeHref: "/instructor/f/t13-program-management",
    shell: "campus",
    archetype: "reviewTerm",
    reviewTerm: {
      id: "",
      name: "",
      code: "",
      startsOn: "",
      endsOn: "",
      campuses: [],
    },
  },

  "/instructor/f/t85-manage-schedule": {
    path: "/instructor/f/t85-manage-schedule",
    figmaId: "4:14308",
    title: "Manage Schedule",
    subtitle: "Manage schedule and fees",
    breadcrumbs: ["Home", "Scheduling", "Manage Schedule"],
    activeHref: "/instructor/f/t13-program-management",
    shell: "campus",
    archetype: "scheduleManage",
    scheduleManage: {
      scheduleId: "ms-dib-nov-2026",
      programTitle: "Schedule: Diploma in International Business",
      dateRange: "Monday, November 2, 2026 - Monday, April 3, 2028",
      totals: { courses: 28, sessions: 28, conflicts: 0, enrolled: 1 },
      addSessionHref: "/instructor/f/t78-add-session-offering",
      sessions: [],
      fees: { ledgers: [], ledgerTypeOptions: ["Assessment Fee", "Application Fee", "Textbooks", "Tuition Fee"] },
      settings: { groups: [] },
    },
  },

  "/instructor/f/t10-assessments-gradebook": {
    path: "/instructor/f/t10-assessments-gradebook",
    figmaId: "3:5121",
    title: "Assessments & Gradebook",
    subtitle: "Review and publish grades",
    breadcrumbs: ["Home", "My Courses", "ACC201", "Gradebook"],
    activeHref: "/instructor/f/t10-assessments-gradebook",
    archetype: "gradebook",
    primaryAction: "Publish Final Marks",
    secondaryAction: "Export CSV",
    gradebook: {
      course: "ACC201 · GRADE_STATUS: DRAFT · Submission Target: Dec 15, 2026",
      publishLabel: "Publish Final Marks",
      columns: ["STUDENT", "QUIZ 1 (10%)", "MIDTERM (25%)", "ASSIGN 1 (15%)", "LABS (20%)", "FINAL EXAM (30%)", "WEIGHTED TOTAL"],
      rows: [
        {
          name: "Aris Thorne",
          id: "ST-1029",
          assessments: ["82% (B)", "78% (B)", "85% (A)", "90% (A)", "80% (B)"],
          total: "81.4%",
          letter: "B+",
          status: "Draft",
        },
        {
          name: "Chloe Miller",
          id: "ST-2041",
          assessments: ["95% (A)", "92% (A)", "88% (B)", "94% (A)", "91% (A)"],
          total: "91.8%",
          letter: "A",
          status: "Draft",
        },
        {
          name: "Dave Patel",
          id: "ST-3102",
          assessments: ["60% (D)", "65% (D)", "70% (C)", "72% (C)", "58% (F)"],
          total: "63.9%",
          letter: "D",
          status: "Draft",
        },
        {
          name: "Eva Jenkins",
          id: "ST-4418",
          assessments: ["84% (B)", "89% (B)", "88% (B)", "90% (A)", "88% (B)"],
          total: "88.5%",
          letter: "A-",
          status: "Draft",
        },
      ],
      legend: [
        "Performances show a +4.2% deviation above section average. Final exam draft complete. Attendance validated at 98.4%.",
      ],
    },
  },

  "/instructor/f/t29-password-reset-flow": {
    path: "/instructor/f/t29-password-reset-flow",
    figmaId: "4:8499",
    title: "Password Reset",
    subtitle: "Reset your account password securely.",
    breadcrumbs: ["Home", "System", "Password Reset"],
    activeHref: "/instructor/f/t29-password-reset-flow",
    archetype: "authGate",
    shell: "campus",
    authGate: {
      heading: "Reset Password",
      description: "Enter your email address and we'll send a secure reset link.",
      fieldLabel: "Email address",
      fieldValue: "teacher@heritage.edu",
      cta: "Send Reset Link",
      help: "Need help? Contact the Registrar's Office",
    },
  },

  "/instructor/f/t30-mfa-challenge": {
    path: "/instructor/f/t30-mfa-challenge",
    figmaId: "4:8586",
    title: "MFA Challenge",
    subtitle: "Complete your security verification to continue to the dashboard.",
    breadcrumbs: ["Home", "System", "MFA Challenge"],
    activeHref: "/instructor/f/t30-mfa-challenge",
    archetype: "authGate",
    shell: "campus",
    authGate: {
      heading: "MFA Challenge",
      description: "Complete your security verification to continue to the dashboard.",
      fieldLabel: "Verification code",
      fieldValue: "••••••",
      cta: "Verify Access",
      help: "Need help? Contact the Registrar's Office",
    },
  },

  "/instructor/f/t31-first-login-profile-completion": {
    path: "/instructor/f/t31-first-login-profile-completion",
    figmaId: "4:8650",
    title: "Profile Completion",
    subtitle: "Complete your faculty profile",
    breadcrumbs: ["Home", "My Profile", "Profile Completion"],
    activeHref: "/instructor/f/t31-first-login-profile-completion",
    archetype: "authGate",
    shell: "campus",
    authGate: {
      heading: "Complete your faculty profile",
      description: "Add your contact and education details so students and the registrar can reach you.",
      fieldLabel: "Course sections assigned",
      fieldValue: "",
      cta: "Complete Profile",
      ctaHref: "/instructor/f/t02-profile-biography?edit=1",
      help: "Need help with your account? Contact the Registrar's Office",
      extraFields: [],
    },
  },


};


// Alias instructor Figma paths onto existing dedicated configs.
const _t08 = TEACHER_SCREENS["/instructor/f/t08-my-courses-detail"];
const _t12 = TEACHER_SCREENS["/instructor/f/t12-students-view"];
const _t22 = TEACHER_SCREENS["/instructor/f/t22-student-detail-full-page"];
const _t04 = TEACHER_SCREENS["/instructor/f/t04-profile-availability"];
const _t05 = TEACHER_SCREENS["/instructor/f/t05-profile-compensation"];
const _t11 = TEACHER_SCREENS["/instructor/f/t11-workshops"];
const _t10 = TEACHER_SCREENS["/instructor/f/t10-assessments-gradebook"];

TEACHER_SCREENS["/instructor/f/in-03-course-detail"] = {
  ..._t08,
  path: "/instructor/f/in-03-course-detail",
  figmaId: "17:6652",
  title: "Course Detail",
};
TEACHER_SCREENS["/instructor/f/in-04-roster"] = {
  ..._t12,
  path: "/instructor/f/in-04-roster",
  figmaId: "17:6739",
  title: "Course Roster",
};
TEACHER_SCREENS["/instructor/f/in-11-student-detail"] = {
  ..._t22,
  path: "/instructor/f/in-11-student-detail",
  figmaId: "17:7313",
  title: "Student Detail",
};
TEACHER_SCREENS["/instructor/f/in-18-availability"] = {
  ..._t04,
  path: "/instructor/f/in-18-availability",
  figmaId: "17:8021",
  title: "Availability",
};
TEACHER_SCREENS["/instructor/f/in-19-compensation"] = {
  ..._t05,
  path: "/instructor/f/in-19-compensation",
  figmaId: "17:8223",
  title: "Compensation",
};
TEACHER_SCREENS["/instructor/f/in-20-workshops"] = {
  ..._t11,
  path: "/instructor/f/in-20-workshops",
  figmaId: "17:8317",
  title: "Workshops",
};
TEACHER_SCREENS["/instructor/f/in-06-assessment-manager"] = {
  path: "/instructor/f/in-06-assessment-manager",
  figmaId: "17:6962",
  title: "Assessment Manager",
  subtitle: "Assessments across your teaching sections",
  breadcrumbs: ["Home", "Gradebook", "Assessments"],
  activeHref: "/instructor/assessments",
  archetype: "table",
  primaryAction: "Create Assessment",
  primaryActionHref: "/instructor/f/t19-create-edit-assessment",
  secondaryAction: "Open Gradebook",
  secondaryActionHref: "/instructor/gradebook",
  columns: ["Assessment", "Course / Section", "Weight", "Due", "Status"],
  rows: [],
  countLabel: "0 assessments",
};
TEACHER_SCREENS["/instructor/f/in-07-gradebook"] = {
  ..._t10,
  path: "/instructor/f/in-07-gradebook",
  figmaId: "17:775",
  title: "ACC201 Gradebook",
  subtitle: "Draft gradebook · Save Draft · Publish Grades",
};

Object.assign(TEACHER_SCREENS, SCHEDULING_SCREENS);

// Legacy pretty routes → same live SIS configs (no orphan GenericLiveScreen pages)
const _t16 = TEACHER_SCREENS["/instructor/f/t16-teacher-messages-chat"];
const _t02 = TEACHER_SCREENS["/instructor/f/t02-profile-biography"];
const _t23 = TEACHER_SCREENS["/instructor/f/t23-course-announcements"];
const _t62 = TEACHER_SCREENS["/instructor/f/t62-pending-grade-submissions"];

if (_t16) {
  TEACHER_SCREENS["/instructor/messages"] = { ..._t16, path: "/instructor/messages", title: "Messages" };
}
if (_t02) {
  TEACHER_SCREENS["/instructor/profile"] = { ..._t02, path: "/instructor/profile", title: "Profile" };
}
if (_t12) {
  TEACHER_SCREENS["/instructor/roster"] = { ..._t12, path: "/instructor/roster", title: "Roster" };
}
if (_t10) {
  TEACHER_SCREENS["/instructor/assessments"] = {
    path: "/instructor/assessments",
    figmaId: _t10.figmaId,
    title: "Assessments",
    subtitle: "Published assessments for your teaching sections",
    breadcrumbs: ["Home", "Gradebook", "Assessments"],
    activeHref: "/instructor/assessments",
    archetype: "assessmentHub",
    primaryAction: "Create Assessment",
    primaryActionHref: "/instructor/f/t19-create-edit-assessment",
    secondaryAction: "Open Gradebook",
    secondaryActionHref: "/instructor/gradebook",
    assessmentHub: {
      kpis: [],
      groups: [],
    },
  };
  TEACHER_SCREENS["/instructor/gradebook"] = {
    ..._t10,
    path: "/instructor/gradebook",
    title: "Gradebook",
    subtitle: "Live scores, drafts, and publish history",
    activeHref: "/instructor/gradebook",
    breadcrumbs: ["Home", "Gradebook"],
    primaryAction: "Publish Final Marks",
    primaryActionHref: "/instructor/gradebook",
  };
}
if (_t62) {
  TEACHER_SCREENS["/instructor/submissions"] = {
    ..._t62,
    path: "/instructor/submissions",
    title: "Submissions",
    primaryActionHref: "/instructor/gradebook",
  };
}
if (_t23) {
  TEACHER_SCREENS["/instructor/announcements"] = {
    ..._t23,
    path: "/instructor/announcements",
    title: "Announcements",
  };
}
if (_t08) {
  TEACHER_SCREENS["/instructor/modules"] = {
    path: "/instructor/modules",
    figmaId: _t08.figmaId,
    title: "Modules",
    subtitle: "Learning modules across your teaching sections.",
    breadcrumbs: ["Home", "My Courses", "Modules"],
    activeHref: "/instructor/sections",
    archetype: "modulesBoard",
    primaryAction: "Open course workspace",
    primaryActionHref: "/instructor/f/t08-my-courses-detail",
  };
  TEACHER_SCREENS["/instructor/lectures"] = {
    ...TEACHER_SCREENS["/instructor/f/in-08-lectures"],
    path: "/instructor/lectures",
    title: "Lectures",
    primaryAction: "Schedule Lecture",
  };
  TEACHER_SCREENS["/instructor/labs"] = {
    ...TEACHER_SCREENS["/instructor/f/in-10-lab-sessions"],
    path: "/instructor/labs",
    title: "Labs",
    primaryAction: "Open Lab Roster",
    primaryActionHref: "/instructor/roster",
  };
  TEACHER_SCREENS["/instructor/studio"] = {
    ..._t08,
    path: "/instructor/studio",
    title: "Course Studio",
    shell: "studio",
  };
  TEACHER_SCREENS["/instructor/sections/demo"] = {
    ..._t08,
    path: "/instructor/sections/demo",
    title: "Section detail",
  };
}

export function getTeacherScreen(path: string): TeacherScreenConfig | undefined {
  const exact = TEACHER_SCREENS[path];
  if (exact) return exact;

  // Dynamic section workspace: /instructor/sections/:sectionId
  const sectionMatch = path.match(/^\/instructor\/sections\/([^/]+)$/);
  if (sectionMatch) {
    const base =
      TEACHER_SCREENS["/instructor/f/t08-my-courses-detail"] ||
      TEACHER_SCREENS["/instructor/sections/demo"];
    if (!base) return undefined;
    return {
      ...base,
      path,
      title: "Course workspace",
      subtitle: "Section detail and teaching tabs",
      activeHref: "/instructor/sections",
      breadcrumbs: ["Home", "My Courses", "Section"],
    };
  }

  return undefined;
}

export const TEACHER_SCREEN_PATHS = Object.keys(TEACHER_SCREENS);
