export type SisArchetype =
  | "queue"
  | "detail"
  | "dashboard"
  | "builder"
  | "workspace"
  | "grades"
  | "wizard"
  | "profile360"
  | "case"
  | "plan"
  | "appointments"
  | "analytics"
  | "account"
  | "reconcile"
  | "holds"
  | "export"
  | "lead360"
  | "campaignDetail"
  | "events"
  | "tasks"
  | "matrix"
  | "policy"
  | "integrations"
  | "operations"
  | "settings"
  | "templates"
  | "versionDiff"
  | "ruleDesigner"
  | "simulator"
  | "testRunner"
  | "retrieval"
  | "citation"
  | "usageCost"
  | "partnerDetail"
  | "searchResults"
  | "employerPortal"
  | "registrarRecord"
  | "correction"
  | "labDash"
  | "labRooms"
  | "labSafety"
  | "labSession"
  | "labNotebook"
  | "labIncident"
  | "labVirtual"
  | "complianceDash"
  | "cpCompleteness"
  | "cpRetention"
  | "cpHolds"
  | "cpEvidence"
  | "cpAccreditation"
  | "cpInspection"
  | "cpDisposal"
  | "cpPrivacy"
  | "aiDash";

export type SisBadgeTone = "active" | "review" | "new" | "danger" | "interview" | "offered" | "decision";

export type SisScreenConfig = {
  path: string;
  figmaId: string;
  title: string;
  subtitle: string;
  breadcrumbs: string[];
  activeHref: string;
  archetype: SisArchetype;
  primaryAction?: string;
  primaryActionHref?: string;
  secondaryAction?: string;
  secondaryActionHref?: string;
  secondaryActions?: string[];
  platformNav?: boolean;
  labsNav?: boolean;
  aiNav?: boolean;
  complianceNav?: boolean;
  academicsNav?: boolean;
  secondaryActionHrefs?: Record<string, string>;
  searchPlaceholder?: string;
  filters?: string[];
  countLabel?: string;
  columns?: string[];
  columnTemplate?: string;
  rows?: Array<{
    cells: string[];
    primary?: string;
    secondary?: string;
    badge?: string;
    badgeTone?: SisBadgeTone;
    href?: string;
  }>;
  kpis?: Array<{
    label: string;
    value: string;
    hint: string;
    tone?: "up" | "danger" | "muted" | "highlight";
    href?: string;
  }>;
  detail?: {
    name: string;
    meta: string;
    steps: Array<{ label: string; state: "done" | "current" | "todo" }>;
    tabs: string[];
    fields: Array<{ label: string; value: string }>;
    checklist: Array<{ label: string; status: string; tone: SisBadgeTone }>;
    aiBlurb?: string;
    reviewer?: { name: string; role: string };
  };
  workspacePanels?: string[];
  grades?: Array<{
    code: string;
    title: string;
    instructor: string;
    submitted: string;
    enrolled: string;
    distribution: string;
    bars: [number, number, number, number?];
    status: string;
  }>;
  wizard?: {
    steps: Array<{ label: string; state: "done" | "current" | "todo" }>;
    matches: Array<{ name: string; reason: string }>;
    summary: Array<{ label: string; value: string }>;
  };
  riskFeed?: Array<{ name: string; detail: string; badge: string; badgeTone: SisBadgeTone }>;
  caseload?: Array<{ name: string; cases: string; pct: number }>;
  profile360?: {
    name: string;
    meta: string;
    tabs: string[];
    aiBlurb?: string;
    alert?: string;
    plan?: string;
    badge?: string;
    stats?: Array<{ label: string; value: string; hint?: string }>;
    actions?: string[];
    courses?: {
      title: string;
      columns: string[];
      rows: Array<{
        course: string;
        midterm: string;
        attendance: string;
        status: string;
        statusTone?: SisBadgeTone;
      }>;
    };
    timeline?: Array<{ title: string; date: string }>;
    interactions?: Array<{ title: string; date: string; authorizedBy: string }>;
  };
  registrarDash?: {
    auditsTitle: string;
    audits: Array<{ text: string; when: string }>;
    clearanceTitle: string;
    clearance: Array<{ name: string; detail: string; badge: string; badgeTone: SisBadgeTone }>;
    searchEnterLabel?: string;
  };
  registrarRecord?: {
    student: {
      name: string;
      badge: string;
      id: string;
      program: string;
      admit: string;
      gpa: string;
      credits: string;
    };
    tabs?: Array<{ label: string; href: string }>;
    activeTab?: string;
    eyebrow: string;
    pageTitle: string;
    history?: {
      terms: Array<{
        label: string;
        badge?: string;
        gpa: string;
        credits: string;
        courses: Array<{ code: string; grade: string }>;
      }>;
      cumulative: Array<{ label: string; value: string }>;
      aiNote?: string;
    };
    statusTimeline?: Array<{
      status: string;
      detail: string;
      date: string;
      actor?: string;
      tone?: SisBadgeTone;
    }>;
    transfer?: {
      institution: string;
      accreditation: string;
      rows: Array<{ external: string; equivalent: string; status: string; tone: SisBadgeTone }>;
    };
    standing?: {
      current: { label: string; effective: string };
      audits: Array<{ term: string; standing: string; gpa: string; notes?: string }>;
      policies: string[];
    };
    audit?: {
      sections: Array<{
        title: string;
        progress: string;
        complete?: boolean;
        courses?: Array<{ code: string; title: string; status: string; tone?: SisBadgeTone }>;
      }>;
      overview: Array<{ label: string; value: string }>;
    };
    transcript?: {
      school: string;
      studentLine: string;
      program: string;
      terms: Array<{
        label: string;
        courses: Array<{ code: string; title?: string; grade: string; credits?: string }>;
      }>;
      totals: { credits: string; gpa: string };
    };
  };
  correction?: {
    eyebrow: string;
    title: string;
    record: { id: string; name: string; type: string };
    before: { label: string; value: string };
    after: { label: string; value: string };
    reasonLabel?: string;
    reasonPlaceholder?: string;
    authorizer: { name: string; role: string };
    notice: string;
    applyLabel: string;
  };
  riskFeedTitle?: string;
  caseloadTitle?: string;
  partnerDetail?: {
    partners: Array<{ name: string; meta: string; active?: boolean }>;
    selected: {
      name: string;
      meta: string;
      fields: Array<{ label: string; value: string }>;
      locations: string[];
    };
  };
  employerPortal?: {
    placementsTitle: string;
    placementsLink: string;
    placements: Array<{ name: string; meta: string; dates: string }>;
    appraisalsTitle: string;
    appraisals: Array<{ name: string; due: string; action: string }>;
    quickLinksTitle: string;
    quickLinks: Array<{ label: string; icon: "calendar" | "file" | "user" }>;
  };
  searchResults?: {
    query: string;
    resultCount: string;
    tabs: Array<{ label: string; count: number }>;
    results: Array<{
      type: string;
      title: string;
      badges?: string[];
      badgeTone?: "green" | "amber" | "blue";
      fields?: Array<{ label: string; value: string; tone?: "danger" | "up" }>;
      meta?: string;
      action?: string;
      actionTone?: "primary" | "ghost";
      href?: string;
    }>;
  };
  caseDetail?: {
    type: string;
    title: string;
    status: string;
    owner: string;
    body: string;
    outcome: string;
    tabs: string[];
  };
  planTasks?: Array<{ task: string; owner: string; due: string; shared: boolean }>;
  appointments?: {
    slots: Array<{ time: string; title: string; status: "Booked" | "Available" }>;
    student: string;
    advisor: string;
  };
  analytics?: {
    leftTitle?: string;
    rightTitle?: string;
    bottomTitle?: string;
    bars: Array<{ label: string; value: string; width: string; color: string }>;
    outcomes: Array<{ label: string; color: string; value?: string }>;
    weeks?: Array<{ label: string; height: string }>;
  };
  financeDash?: {
    months: Array<{ label: string; height: string; active?: boolean }>;
    methods: Array<{ label: string; value: string; color: string }>;
    transactions: Array<{ id?: string; name: string; detail: string; amount: string }>;
    overdue: Array<{ name: string; detail: string }>;
  };
  infoBanner?: { title: string; body: string; cta: string };
  actionLabel?: string;
  hideRowAction?: boolean;
  rowActions?: "refund" | "approval";
  account?: {
    name: string;
    meta: string;
    balance: string;
    dueNote: string;
    planTitle: string;
    planBody: string;
    tabs: string[];
    ledger: Array<{ date: string; desc: string; debit: string; credit: string; balance: string; creditTone?: boolean }>;
  };
  reconcile?: {
    stripe: Array<{ label: string; amount: string; status: "MATCHED" | "UNMATCHED" }>;
    ledger: Array<{ label: string; amount: string; highlight?: boolean }>;
  };
  holds?: {
    rows: Array<{ student: string; type: string; reason: string; placedBy: string }>;
    student: string;
    releaseReason: string;
  };
  exportPanel?: {
    configs: Array<{ label: string; value: string }>;
    schema: string[];
    history: Array<{ name: string; date: string; status: string }>;
    eyebrow?: string;
    deliveries?: Array<{ date: string; destination: string; count: string; status: string }>;
    publishNote?: string;
  };
  crmDash?: {
    funnel: Array<{ label: string; value: string; pct: number; color: string }>;
    recent: Array<{ name: string; detail: string; badge: string; badgeTone: SisBadgeTone }>;
  };
  lead360?: {
    name: string;
    meta: string;
    score: string;
    steps: Array<{ label: string; state: "done" | "current" | "todo" }>;
    tabs: string[];
    fields: Array<{ label: string; value: string }>;
    timeline: Array<{ when: string; text: string }>;
  };
  campaignDetail?: {
    name: string;
    status: string;
    kpis: Array<{ label: string; value: string; hint: string }>;
    rules: string[];
    subject: string;
  };
  events?: {
    list: Array<{ title: string; meta: string; active?: boolean }>;
    selectedTitle: string;
    selectedMeta: string;
    roster: Array<{ name: string; email: string; date: string; status: string; tone: SisBadgeTone }>;
  };
  tasks?: {
    groups: Array<{
      title: string;
      tone: "danger" | "active";
      items: Array<{ name: string; detail: string; when: string }>;
    }>;
  };
  matrix?: {
    roles: string[];
    rows: Array<{ module: string; capability: string; detail: string; checks: boolean[] }>;
    banner?: { body: string; cta: string };
  };
  policy?: {
    sections: Array<{
      title: string;
      toggles?: Array<{ label: string; detail: string; on: boolean }>;
      fields?: Array<{ label: string; value: string; hint?: string }>;
      checks?: string[];
      textarea?: { label: string; value: string; hint?: string };
    }>;
  };
  integrations?: {
    kpis: Array<{ label: string; value: string }>;
    cards: Array<{ name: string; detail: string; sync: string; status: string; tone: SisBadgeTone }>;
  };
  operations?: {
    health: Array<{ label: string; value: string; ok?: boolean }>;
    jobs: Array<{ id: string; title: string; meta: string; status: string; tone: SisBadgeTone; retry?: boolean }>;
    telemetry: { note: string; cpu: string; memory: string };
  };
  settingsForm?: {
    fields: Array<{ label: string; value: string }>;
    uploadHint: string;
    previewNote: string;
  };
  templates?: {
    rows: Array<{
      name: string;
      channel: string;
      status: string;
      edited: string;
      tone: SisBadgeTone;
      preview?: { to: string; channel: string; subject: string; body: string };
    }>;
    preview: { to: string; channel: string; subject: string; body: string };
    editHref?: string;
    createHref?: string;
  };
  builder?: {
    paletteTitle?: string;
    palette: string[];
    canvasTitle: string;
    canvasFields?: Array<{ label: string; value: string }>;
    inspectorTitle?: string;
    inspector: Array<{ label: string; value: string }>;
  };
  versionDiff?: {
    heading: string;
    changes: Array<{ tone: SisBadgeTone; label: string; text: string }>;
  };
  ruleDesigner?: {
    conditions: Array<{ field: string; op: string; value: string }>;
    outcome: string;
    preview: string;
  };
  simulator?: {
    cohort: string;
    results: Array<{ name: string; gpa: string; rules: string; action: string }>;
  };
  testRunner?: {
    logs: string[];
    output: string;
  };
  retrieval?: {
    model: string;
    query: string;
    latency: string;
    matches: Array<{ rank: string; source: string; score: string; chunkId: string }>;
    threshold: string;
    topK: string;
    index: string;
    dimension: string;
    vectors: string;
  };
  citation?: {
    filters: string[];
    rows: Array<{
      id: string;
      user: string;
      query: string;
      type: string;
      severity: string;
      severityTone: SisBadgeTone;
      status: string;
      statusTone: SisBadgeTone;
    }>;
    detail: {
      id: string;
      flag: string;
      response: string;
      groundTruth: string;
    };
  };
  usageCost?: {
    models: Array<{ model: string; calls: string; tokensIn: string; tokensOut: string; cost: string }>;
    trend: Array<{ label: string; height: string }>;
    cycle: string;
  };
  evalRuns?: Array<{ id: string; date: string; model: string; dataset: string; scores: string }>;
  labDash?: {
    roomsTitle?: string;
    rooms: Array<{
      name: string;
      status: string;
      statusTone: SisBadgeTone;
      capacity: string;
      activity: string;
      href?: string;
    }>;
    alertsTitle?: string;
    alerts: Array<{
      name: string;
      detail: string;
      tone: "warn" | "danger";
      href?: string;
    }>;
  };
  labRooms?: {
    rooms: Array<{
      name: string;
      location: string;
      seats: string;
      equipment: string;
      days: boolean[];
      status: string;
      statusTone: SisBadgeTone;
      nextAvailable: string;
      href?: string;
    }>;
  };
  labSafety?: {
    categories: Array<{
      title: string;
      count: string;
      badge: string;
      badgeTone: SisBadgeTone;
    }>;
    signoffsTitle?: string;
    signoffs: Array<{
      name: string;
      course: string;
      status: string;
      statusTone: SisBadgeTone;
      completed: string;
    }>;
  };
  labSession?: {
    objectives: string[];
    procedure: string[];
    safetyRules: string[];
    equipment: string[];
    notebookHref: string;
    notebookLabel?: string;
    ackLabel?: string;
  };
  labNotebook?: {
    course: string;
    group: string;
    experiment: string;
    hypothesis: string;
    method: string[];
    observations: Array<{ temp: string; rate: string; notes: string }>;
    aiSuggestion: string;
    studentMessage: string;
  };
  labIncident?: {
    id: string;
    severity: string;
    status: string;
    timeline: Array<{ time: string; title: string; detail?: string }>;
    fields: Array<{ label: string; value: string }>;
    backHref?: string;
  };
  labVirtual?: {
    environments: Array<{
      name: string;
      course: string;
      engine: string;
      load: string;
      loadPct: number;
      href?: string;
    }>;
  };
  complianceDash?: {
    scorePct: number;
    scoreLabel: string;
    scoreHint: string;
    sideMetrics: Array<{ label: string; value: string; hint?: string; href?: string }>;
    deadlinesHref: string;
    deadlines: Array<{ title: string; due: string }>;
    evidenceHref: string;
    evidence: Array<{ label: string; pct: number }>;
  };
  cpCompleteness?: {
    vaultHref: string;
    fieldGroups: Array<{ name: string; pct: number; detail: string }>;
    incomplete: Array<{
      name: string;
      cohort: string;
      missing: string;
      status: string;
      tone: SisBadgeTone;
      href?: string;
    }>;
  };
  cpRetention?: {
    policies: Array<{
      name: string;
      scope: string;
      status: string;
      tone: SisBadgeTone;
      period: string;
      trigger: string;
      disposal: string;
      note: string;
    }>;
  };
  cpHolds?: {
    vaultHref: string;
    holds: Array<{
      id: string;
      title: string;
      matter: string;
      placed: string;
      status: string;
      tone: SisBadgeTone;
      reason: string;
      affected: string[];
    }>;
  };
  cpEvidence?: {
    vaultHref: string;
    standards: Array<{
      id: string;
      title: string;
      pct: number;
      documents: Array<{ name: string; meta: string; href?: string }>;
    }>;
  };
  cpAccreditation?: {
    vaultHref: string;
    deadlines: Array<{ title: string; due: string; status: string; tone: SisBadgeTone }>;
    metrics: Array<{ label: string; pct: number }>;
    insights: Array<{ title: string; body: string; href?: string }>;
  };
  cpInspection?: {
    status: string;
    progressPct: number;
    addDocHref: string;
    categories: Array<{
      title: string;
      done: number;
      total: number;
      status: string;
      tone: SisBadgeTone;
    }>;
    documents: Array<{
      name: string;
      category: string;
      status: string;
      tone: SisBadgeTone;
      href?: string;
    }>;
  };
  cpDisposal?: {
    batchId: string;
    holdsHref: string;
    items: Array<{
      id: string;
      name: string;
      retention: string;
      status: string;
      tone: SisBadgeTone;
      type: string;
      size: string;
      preview: string;
    }>;
  };
  cpPrivacy?: {
    requests: Array<{
      id: string;
      requester: string;
      type: string;
      status: string;
      tone: SisBadgeTone;
      fields: Array<{ label: string; value: string }>;
      timeline: Array<{ date: string; title: string; detail?: string }>;
    }>;
  };
  aiDash?: {
    kpis: Array<{ label: string; value: string; hint: string; href?: string }>;
    usageTrend: Array<{ label: string; height: string }>;
    costBreakdown: Array<{ label: string; amount: string; pct: number; color?: string; href?: string }>;
    activity: Array<{
      id: string;
      title: string;
      when: string;
      status: string;
      tone?: SisBadgeTone;
      href?: string;
    }>;
  };
};

/** Empty by design — live domain API fills rows. Never ship fixture people. */
function queueRows(_prefix: string, _href?: string) {
  return [] as SisScreenConfig["rows"];
}

function makeQueue(
  partial: Omit<SisScreenConfig, "archetype"> & { rowHref?: string },
): SisScreenConfig {
  const { rowHref: _rowHref, ...rest } = partial;
  return {
    archetype: "queue",
    searchPlaceholder: `Search ${partial.title.toLowerCase()}…`,
    filters: ["Program", "Intake: Fall 2026", "Stage"],
    countLabel: "Loading…",
    columns: ["Primary", "Scope", "Stage", "Updated", "Owner", "SLA", "Action"],
    columnTemplate:
      "minmax(160px,1.3fr) minmax(120px,1fr) minmax(100px,0.7fr) minmax(100px,0.7fr) minmax(110px,0.8fr) minmax(80px,0.5fr) minmax(70px,0.4fr)",
    rows: [],
    ...rest,
  };
}

function makeDetail(
  partial: Omit<SisScreenConfig, "archetype" | "detail"> & { subject?: string; metaLine?: string },
): SisScreenConfig {
  const { subject: _s, metaLine: _m, ...rest } = partial;
  return {
    archetype: "detail",
    primaryAction: "Schedule Interview",
    secondaryAction: "Request Documents",
    detail: {
      name: "—",
      meta: "Loading live record…",
      steps: [
        { label: "Applied", state: "todo" },
        { label: "Documents", state: "todo" },
        { label: "Interview", state: "todo" },
        { label: "Decision", state: "todo" },
        { label: "Offer", state: "todo" },
      ],
      tabs: ["Summary", "Requirements", "Documents", "Interview", "Decision", "Timeline", "Messages"],
      fields: [],
      checklist: [],
    },
    ...rest,
  };
}

function makeDashboard(partial: Omit<SisScreenConfig, "archetype">): SisScreenConfig {
  return {
    archetype: "dashboard",
    kpis: [],
    ...partial,
  };
}

function makeBuilder(partial: Omit<SisScreenConfig, "archetype">): SisScreenConfig {
  return {
    archetype: "builder",
    workspacePanels: ["Palette", "Canvas", "Inspector"],
    primaryAction: "Publish Draft",
    secondaryAction: "Save",
    builder: {
      paletteTitle: "Blocks",
      palette: [],
      canvasTitle: `${partial.title} canvas`,
      canvasFields: [],
      inspectorTitle: "Inspector",
      inspector: [],
    },
    kpis: [],
    ...partial,
  };
}

function makeWorkspace(partial: Omit<SisScreenConfig, "archetype">): SisScreenConfig {
  return {
    archetype: "workspace",
    workspacePanels: ["Queue", "Workspace", "Notes"],
    primaryAction: "Save Decision",
    secondaryAction: "Escalate",
    rows: [],
    kpis: [],
    ...partial,
  };
}

/** Catalog for SIS-shell Figma parity screens (admissions + academics batch). */

const REGISTRAR_VANCE_STUDENT = {
  name: "Marcus Vance",
  badge: "ACTIVE STUDENT",
  id: "#2024-8902",
  program: "A.S. in Computer Science",
  admit: "Admit Fall 2023",
  gpa: "Cum GPA 3.84",
  credits: "Credits 45/60",
} as const;

const REGISTRAR_VANCE_TABS = [
  { label: "Academic History", href: "/admin/f/rg-02-academic-history" },
  { label: "Status History", href: "/admin/f/rg-03-status-history" },
  { label: "Transfer Credits", href: "/admin/f/rg-04-transfer-credits" },
  { label: "Academic Standing", href: "/admin/f/rg-05-academic-standing" },
  { label: "Completion Audit", href: "/admin/f/rg-06-completion-audit" },
] as const;

const REGISTRAR_VANCE_RECORD = {
  student: { ...REGISTRAR_VANCE_STUDENT },
  tabs: [...REGISTRAR_VANCE_TABS],
};

export const ADMIN_SIS_SCREENS: Record<string, SisScreenConfig> = {
  "/admin/f/ad-01-admissions-dashboard": makeDashboard({
    path: "/admin/f/ad-01-admissions-dashboard",
    figmaId: "168:200",
    title: "Admissions Overview",
    subtitle: "Real-time application cycles and review pipeline.",
    breadcrumbs: ["Home", "Recruit", "Admissions Overview"],
    activeHref: "/admin/f/ad-01-admissions-dashboard",
    primaryAction: "+ New Applicant",
    primaryActionHref: "/admin/f/ad-02-application-queue",
    secondaryAction: "Export Data",
    kpis: [
      {
        label: "New Applications",
        value: "284",
        hint: "+14% this wk",
        tone: "up",
        href: "/admin/f/ad-02-application-queue",
      },
      {
        label: "In Review",
        value: "95",
        hint: "Action required",
        tone: "danger",
        href: "/admin/f/ad-02-application-queue",
      },
      {
        label: "Interviews This Week",
        value: "42",
        hint: "12 scheduled today",
        tone: "up",
        href: "/admin/f/ad-06-interview-workspace",
      },
      {
        label: "Offers Pending",
        value: "18",
        hint: "Awaiting response",
        href: "/admin/f/ad-08-offer-builder",
      },
      {
        label: "Intake Capacity Used",
        value: "82.4%",
        hint: "412 of 500 seats filled",
        tone: "up",
        href: "/admin/f/ad-11-intake-capacity",
      },
    ],
  }),

  "/admin/f/ad-02-application-queue": makeQueue({
    path: "/admin/f/ad-02-application-queue",
    figmaId: "168:408",
    title: "Application Queue",
    subtitle: "Review and advance applicants through the admissions pipeline.",
    breadcrumbs: ["Home", "Recruit", "Applications Queue"],
    activeHref: "/admin/f/ad-02-application-queue",
    secondaryAction: "Export Queue",
    rowHref: "/admin/f/ad-03-application-detail",
    searchPlaceholder: "Search applicants…",
    countLabel: "247 applications found",
    columns: ["Applicant", "Program", "Intake", "Stage", "Submitted", "Assigned To", "SLA Remaining", "Action"],
    columnTemplate:
      "minmax(160px,1.4fr) minmax(120px,1.1fr) minmax(90px,0.7fr) minmax(100px,0.7fr) minmax(100px,0.7fr) minmax(110px,0.9fr) minmax(90px,0.6fr) minmax(70px,0.4fr)",
    rows: [
      {
        primary: "Sarah Mitchell",
        secondary: "s.mitchell@outlook.com",
        cells: ["Sarah Mitchell", "Bachelor of Nursing", "Fall 2026", "Interview", "Oct 02, 2025", "Dr. Amy Adams", "12 days"],
        badge: "Interview",
        badgeTone: "interview",
        href: "/admin/f/ad-03-application-detail",
      },
      {
        primary: "Marcus Vance",
        secondary: "m.vance@email.com",
        cells: ["Marcus Vance", "Computer Science (AS)", "Fall 2026", "In Review", "Oct 01, 2025", "Admin Sarah", "8 days"],
        badge: "In Review",
        badgeTone: "review",
        href: "/admin/f/ad-03-application-detail",
      },
      {
        primary: "Clara Oswald",
        secondary: "clara.o@email.com",
        cells: ["Clara Oswald", "Nursing (BSN)", "Fall 2026", "New", "Sep 30, 2025", "Counselor Lee", "14 days"],
        badge: "New",
        badgeTone: "new",
        href: "/admin/f/ad-03-application-detail",
      },
      {
        primary: "Jonathan Archer",
        secondary: "j.archer@email.com",
        cells: ["Jonathan Archer", "Mechanical Eng (AS)", "Spring 2027", "Decision", "Sep 28, 2025", "Dean Vance", "Passed"],
        badge: "Decision",
        badgeTone: "decision",
        href: "/admin/f/ad-03-application-detail",
      },
      {
        primary: "Beverly Crusher",
        secondary: "b.crusher@email.com",
        cells: ["Beverly Crusher", "Biological Sciences", "Fall 2026", "Offer Sent", "Sep 22, 2025", "Dr. Amy Adams", "3 days"],
        badge: "Offer Sent",
        badgeTone: "offered",
        href: "/admin/f/ad-03-application-detail",
      },
      {
        primary: "Tuvok Vulcan",
        secondary: "t.vulcan@email.com",
        cells: ["Tuvok Vulcan", "General Studies", "Fall 2026", "In Review", "Sep 18, 2025", "Admin Sarah", "Passed"],
        badge: "In Review",
        badgeTone: "review",
        href: "/admin/f/ad-03-application-detail",
      },
    ],
  }),

  "/admin/f/ad-03-application-detail": makeDetail({
    path: "/admin/f/ad-03-application-detail",
    figmaId: "168:652",
    title: "Application Detail",
    subtitle: "Applicant profile, requirements, and decision workspace",
    breadcrumbs: ["Home", "Recruit", "Admissions Queue", "Sarah Mitchell"],
    activeHref: "/admin/f/ad-02-application-queue",
  }),

  "/admin/f/ad-04-requirement-review": makeWorkspace({
    path: "/admin/f/ad-04-requirement-review",
    figmaId: "17:14157",
    title: "Requirement Review",
    subtitle: "Validate prerequisite and disclosure requirements before interview.",
    breadcrumbs: ["Home", "Recruit", "Requirement Review"],
    activeHref: "/admin/f/ad-02-application-queue",
  }),

  "/admin/f/ad-05-document-review": makeWorkspace({
    path: "/admin/f/ad-05-document-review",
    figmaId: "17:14303",
    title: "Document Review",
    subtitle: "Inspect uploaded evidence, flags, and verification status.",
    breadcrumbs: ["Home", "Recruit", "Document Review"],
    activeHref: "/admin/f/ad-02-application-queue",
  }),

  "/admin/f/ad-06-interview-workspace": makeWorkspace({
    path: "/admin/f/ad-06-interview-workspace",
    figmaId: "17:14401",
    title: "Interview Workspace",
    subtitle: "Scorecards, panel notes, and interview outcomes.",
    breadcrumbs: ["Home", "Recruit", "Interviews"],
    activeHref: "/admin/f/ad-06-interview-workspace",
  }),

  "/admin/f/ad-07-decision-workspace": makeWorkspace({
    path: "/admin/f/ad-07-decision-workspace",
    figmaId: "17:14539",
    title: "Decision Workspace",
    subtitle: "Admit, waitlist, or deny with audited rationale.",
    breadcrumbs: ["Home", "Recruit", "Decision"],
    activeHref: "/admin/f/ad-02-application-queue",
  }),

  "/admin/f/ad-08-offer-builder": makeBuilder({
    path: "/admin/f/ad-08-offer-builder",
    figmaId: "17:14625",
    title: "Offer Builder",
    subtitle: "Compose program offer terms, conditions, and deadlines.",
    breadcrumbs: ["Home", "Recruit", "Offers"],
    activeHref: "/admin/f/ad-08-offer-builder",
  }),

  "/admin/f/ad-09-loa-builder": makeBuilder({
    path: "/admin/f/ad-09-loa-builder",
    figmaId: "17:14720",
    title: "LOA Builder",
    subtitle: "Draft letter of acceptance packages for selected applicants.",
    breadcrumbs: ["Home", "Recruit", "LOA Builder"],
    activeHref: "/admin/f/ad-08-offer-builder",
  }),

  "/admin/f/ad-10-conversion": makeDashboard({
    path: "/admin/f/ad-10-conversion",
    figmaId: "17:14802",
    title: "Conversion",
    subtitle: "Track offer acceptance and enrolment conversion.",
    breadcrumbs: ["Home", "Recruit", "Conversion"],
    activeHref: "/admin/f/ad-01-admissions-dashboard",
    kpis: [
      { label: "Offers Sent", value: "64", hint: "This cycle", tone: "up" },
      { label: "Accepted", value: "41", hint: "64% accept rate", tone: "up" },
      { label: "Declined", value: "9", hint: "Needs follow-up", tone: "danger" },
      { label: "Pending", value: "14", hint: "Awaiting student", tone: "muted" },
    ],
  }),

  "/admin/f/ad-10-conversion-dashboard": makeDashboard({
    path: "/admin/f/ad-10-conversion-dashboard",
    figmaId: "134:181",
    title: "Conversion",
    subtitle: "Track offer acceptance and enrolment conversion.",
    breadcrumbs: ["Home", "Recruit", "Conversion"],
    activeHref: "/admin/f/ad-01-admissions-dashboard",
    kpis: [
      { label: "Offers Sent", value: "64", hint: "This cycle", tone: "up" },
      { label: "Accepted", value: "41", hint: "64% accept rate", tone: "up" },
      { label: "Declined", value: "9", hint: "Needs follow-up", tone: "danger" },
      { label: "Pending", value: "14", hint: "Awaiting student", tone: "muted" },
    ],
  }),

  "/admin/f/ad-11-intake-capacity": makeDashboard({
    path: "/admin/f/ad-11-intake-capacity",
    figmaId: "17:14890",
    title: "Intake Capacity",
    subtitle: "Seat planning across programs and intakes.",
    breadcrumbs: ["Home", "Recruit", "Intake Capacity"],
    activeHref: "/admin/f/ad-01-admissions-dashboard",
    kpis: [
      { label: "Seats Total", value: "500", hint: "Fall 2026", tone: "muted" },
      { label: "Filled", value: "412", hint: "82.4% used", tone: "up" },
      { label: "Reserved", value: "48", hint: "Conditional offers", tone: "muted" },
      { label: "Available", value: "40", hint: "Open capacity", tone: "up" },
    ],
  }),

  "/admin/f/ac-01-academic-terms": makeQueue({
    path: "/admin/f/ac-01-academic-terms",
    figmaId: "66:2707",
    title: "Academic Terms",
    subtitle: "Define term windows, census dates, and grading periods.",
    breadcrumbs: ["Home", "Academics", "Academic Terms"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "+ Add Term",
    primaryActionHref: "/admin/f/ac-02-academic-calendar",
    secondaryAction: "Open Calendar",
    secondaryActionHref: "/admin/f/ac-02-academic-calendar",
    searchPlaceholder: "Search terms…",
    countLabel: "8 terms",
    filters: ["Year", "Status"],
    columns: ["Term", "Start", "End", "Census", "Status", "Action"],
    columnTemplate:
      "minmax(140px,1.2fr) minmax(100px,0.8fr) minmax(100px,0.8fr) minmax(100px,0.8fr) minmax(90px,0.6fr) minmax(70px,0.4fr)",
    rows: [
      {
        primary: "Fall 2026",
        cells: ["Fall 2026", "Aug 24, 2026", "Dec 12, 2026", "Sep 11, 2026"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/ac-02-academic-calendar",
      },
      {
        primary: "Spring 2027",
        cells: ["Spring 2027", "Jan 12, 2027", "May 08, 2027", "Jan 30, 2027"],
        badge: "Scheduled",
        badgeTone: "review",
        href: "/admin/f/ac-02-academic-calendar",
      },
      {
        primary: "Summer 2026",
        cells: ["Summer 2026", "May 18, 2026", "Aug 07, 2026", "Jun 01, 2026"],
        badge: "Closed",
        badgeTone: "new",
        href: "/admin/f/ac-09-sections",
      },
    ],
  }),

  "/admin/f/ac-02-academic-calendar": makeQueue({
    path: "/admin/f/ac-02-academic-calendar",
    figmaId: "66:2852",
    title: "Academic Calendar",
    subtitle: "Institutional calendar events and blackout dates.",
    breadcrumbs: ["Home", "Academics", "Academic Calendar"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "+ Add Event",
    primaryActionHref: "/admin/f/ac-01-academic-terms",
    secondaryAction: "Manage Terms",
    secondaryActionHref: "/admin/f/ac-01-academic-terms",
    searchPlaceholder: "Search calendar events…",
    countLabel: "24 events",
    filters: ["Term", "Type"],
    columns: ["Event", "Date", "Term", "Type", "Status", "Action"],
    columnTemplate:
      "minmax(160px,1.3fr) minmax(110px,0.8fr) minmax(100px,0.7fr) minmax(110px,0.8fr) minmax(90px,0.6fr) minmax(70px,0.4fr)",
    rows: [
      {
        primary: "Fall Census Date",
        cells: ["Fall Census Date", "Sep 11, 2026", "Fall 2026", "Deadline"],
        badge: "Upcoming",
        badgeTone: "review",
        href: "/admin/f/ac-01-academic-terms",
      },
      {
        primary: "Registration Opens",
        cells: ["Registration Opens", "Apr 06, 2026", "Fall 2026", "Registration"],
        badge: "Published",
        badgeTone: "active",
        href: "/admin/f/ac-10-master-scheduling",
      },
      {
        primary: "Final Grade Deadline",
        cells: ["Final Grade Deadline", "Dec 18, 2026", "Fall 2026", "Grading"],
        badge: "Upcoming",
        badgeTone: "review",
        href: "/admin/f/ac-13-pending-grades",
      },
    ],
  }),

  "/admin/f/ac-03-programs": makeQueue({
    path: "/admin/f/ac-03-programs",
    figmaId: "168:1713",
    title: "Academic Programs",
    subtitle: "Manage curriculum structures, credential paths, and department catalogs.",
    breadcrumbs: ["Home", "Academics", "Academic Programs"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "+ New Program",
    primaryActionHref: "/admin/f/ac-05-program-change-request",
    secondaryAction: "Bulk Export",
    secondaryActionHref: "/admin/f/ac-06-course-catalogue",
    searchPlaceholder: "Search programs…",
    countLabel: "24 programs",
    filters: ["Credential: All", "Department: All"],
    columns: ["Program Name", "Credential Path", "Department", "Courses", "Enrolled", "Status", "Action"],
    columnTemplate:
      "minmax(180px,1.5fr) minmax(110px,0.8fr) minmax(130px,1fr) minmax(70px,0.5fr) minmax(100px,0.7fr) minmax(90px,0.6fr) minmax(70px,0.4fr)",
    kpis: [
      {
        label: "Active Programs",
        value: "24",
        hint: "↑ 2 new paths approved",
        tone: "up",
        href: "/admin/f/ac-04-program-detail",
      },
      {
        label: "Total Courses",
        value: "186",
        hint: "Active catalog entries",
        tone: "up",
        href: "/admin/f/ac-06-course-catalogue",
      },
      {
        label: "Sections This Term",
        value: "45",
        hint: "92.4% enrollment fill rate",
        tone: "up",
        href: "/admin/f/ac-09-sections",
      },
      {
        label: "Pending Changes",
        value: "12",
        hint: "Awaiting committee vote",
        tone: "danger",
        href: "/admin/f/ac-05-program-change-request",
      },
    ],
    rows: [
      {
        primary: "Bachelor of Science in Nursing",
        cells: ["Bachelor of Science in Nursing", "Degree (BSN)", "Health Sciences", "38", "412 Students"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/ac-04-program-detail",
      },
      {
        primary: "Associate of Science in Computer Science",
        cells: ["Associate of Science in Computer Science", "Degree (AS)", "STEM & Computing", "24", "284 Students"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/ac-04-program-detail",
      },
      {
        primary: "Diploma in Practical Nursing",
        cells: ["Diploma in Practical Nursing", "Diploma", "Health Sciences", "18", "145 Students"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/ac-04-program-detail",
      },
      {
        primary: "Certificate in Cyber Security Operations",
        cells: ["Certificate in Cyber Security Operations", "Certificate", "STEM & Computing", "12", "98 Students"],
        badge: "Under Review",
        badgeTone: "review",
        href: "/admin/f/ac-05-program-change-request",
      },
      {
        primary: "Associate of Arts in Business Administration",
        cells: ["Associate of Arts in Business Administration", "Degree (AA)", "Business & Humanities", "20", "195 Students"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/ac-04-program-detail",
      },
      {
        primary: "Certificate in Allied Health Assistant",
        cells: ["Certificate in Allied Health Assistant", "Certificate", "Health Sciences", "8", "64 Students"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/ac-04-program-detail",
      },
    ],
  }),

  "/admin/f/ac-04-program-detail": makeDetail({
    path: "/admin/f/ac-04-program-detail",
    figmaId: "66:3189",
    title: "Program Detail",
    subtitle: "Credential path, curriculum map, and enrolment profile.",
    breadcrumbs: ["Home", "Academics", "Programs", "BSN Nursing"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "Request Change",
    primaryActionHref: "/admin/f/ac-05-program-change-request",
    secondaryAction: "View Courses",
    secondaryActionHref: "/admin/f/ac-06-course-catalogue",
    subject: "Bachelor of Science in Nursing",
    metaLine: "Degree (BSN) · Health Sciences · 412 enrolled",
  }),

  "/admin/f/ac-05-program-change-request": makeWorkspace({
    path: "/admin/f/ac-05-program-change-request",
    figmaId: "66:3307",
    title: "Program Change Request",
    subtitle: "Committee review for curriculum modifications.",
    breadcrumbs: ["Home", "Academics", "Program Change Request"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "Submit to Committee",
    primaryActionHref: "/admin/f/ac-03-programs",
    secondaryAction: "Back to Programs",
    secondaryActionHref: "/admin/f/ac-03-programs",
  }),

  "/admin/f/ac-06-course-catalogue": makeQueue({
    path: "/admin/f/ac-06-course-catalogue",
    figmaId: "66:3469",
    title: "Course Catalogue",
    subtitle: "Browse and maintain the active course inventory.",
    breadcrumbs: ["Home", "Academics", "Course Catalogue"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "+ New Course",
    primaryActionHref: "/admin/f/ac-07-course-setup",
    secondaryAction: "Categories",
    secondaryActionHref: "/admin/f/ac-08-course-categories",
    searchPlaceholder: "Search courses…",
    countLabel: "186 courses",
    filters: ["Department", "Level", "Status"],
    columns: ["Course", "Title", "Credits", "Department", "Status", "Action"],
    columnTemplate:
      "minmax(100px,0.7fr) minmax(180px,1.4fr) minmax(70px,0.5fr) minmax(130px,1fr) minmax(90px,0.6fr) minmax(70px,0.4fr)",
    rows: [
      {
        primary: "CS 301",
        cells: ["CS 301", "Advanced Data Structures", "3", "STEM & Computing"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/ac-07-course-setup",
      },
      {
        primary: "NURS 400",
        cells: ["NURS 400", "Clinical Practicum IV", "4", "Health Sciences"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/ac-07-course-setup",
      },
      {
        primary: "MATH 215",
        cells: ["MATH 215", "Linear Algebra", "3", "STEM & Computing"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/ac-09-sections",
      },
      {
        primary: "ENG 101",
        cells: ["ENG 101", "Freshman Composition", "3", "Business & Humanities"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/ac-16-course-resources",
      },
    ],
  }),

  "/admin/f/ac-07-course-setup": makeBuilder({
    path: "/admin/f/ac-07-course-setup",
    figmaId: "66:3610",
    title: "Course Setup",
    subtitle: "Configure credits, requisites, and delivery modes.",
    breadcrumbs: ["Home", "Academics", "Course Setup"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "Save Course",
    primaryActionHref: "/admin/f/ac-06-course-catalogue",
    secondaryAction: "Open Sections",
    secondaryActionHref: "/admin/f/ac-09-sections",
  }),

  "/admin/f/ac-08-course-categories": makeQueue({
    path: "/admin/f/ac-08-course-categories",
    figmaId: "66:3730",
    title: "Course Categories",
    subtitle: "Taxonomy used across catalogue and reporting.",
    breadcrumbs: ["Home", "Academics", "Course Categories"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "+ Add Category",
    primaryActionHref: "/admin/f/ac-06-course-catalogue",
    secondaryAction: "Catalogue",
    secondaryActionHref: "/admin/f/ac-06-course-catalogue",
    rowHref: "/admin/f/ac-06-course-catalogue",
  }),

  "/admin/f/ac-09-sections": makeQueue({
    path: "/admin/f/ac-09-sections",
    figmaId: "66:3847",
    title: "Sections",
    subtitle: "Term sections, capacity, and faculty assignment.",
    breadcrumbs: ["Home", "Academics", "Sections"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "+ New Section",
    primaryActionHref: "/admin/sections/create",
    secondaryAction: "Pending Approvals",
    secondaryActionHref: "/admin/f/ac-11-pending-schedules",
    searchPlaceholder: "Search sections…",
    countLabel: "45 sections",
    filters: ["Term", "Campus", "Status"],
    columns: ["Section", "Course", "Faculty", "Seats", "Status", "Action"],
    columnTemplate:
      "minmax(110px,0.8fr) minmax(160px,1.2fr) minmax(130px,1fr) minmax(80px,0.5fr) minmax(90px,0.6fr) minmax(70px,0.4fr)",
    rows: [
      {
        primary: "CS 301-01",
        cells: ["CS 301-01", "Advanced Data Structures", "Prof. Eleanor Vance", "32/36"],
        badge: "Open",
        badgeTone: "active",
        href: "/admin/sections/create",
      },
      {
        primary: "NURS 400-01",
        cells: ["NURS 400-01", "Clinical Practicum IV", "Dr. Sarah Jenkins", "18/18"],
        badge: "Full",
        badgeTone: "review",
        href: "/admin/sections/create",
      },
      {
        primary: "ENG 101-04",
        cells: ["ENG 101-04", "Freshman Composition", "Dr. Jane Austin", "24/28"],
        badge: "Open",
        badgeTone: "active",
        href: "/admin/sections/create",
      },
    ],
  }),

  "/admin/f/ac-10-master-scheduling": makeWorkspace({
    path: "/admin/f/ac-10-master-scheduling",
    figmaId: "66:3982",
    title: "Master Scheduling",
    subtitle: "Room, time, and instructor conflict resolution.",
    breadcrumbs: ["Home", "Academics", "Master Scheduling"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "Submit for Approval",
    primaryActionHref: "/admin/f/ac-11-pending-schedules",
    secondaryAction: "View Sections",
    secondaryActionHref: "/admin/f/ac-09-sections",
  }),

  "/admin/f/ac-11-pending-schedules": makeQueue({
    path: "/admin/f/ac-11-pending-schedules",
    figmaId: "66:4235",
    title: "Pending Schedules",
    subtitle: "Approvals waiting before publish to student portal.",
    breadcrumbs: ["Home", "Academics", "Pending Schedules"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "Approve Selected",
    primaryActionHref: "/admin/f/ac-09-sections",
    secondaryAction: "Open Scheduler",
    secondaryActionHref: "/admin/f/ac-10-master-scheduling",
    rowHref: "/admin/f/ac-10-master-scheduling",
  }),

  "/admin/f/ac-12-grading-schemes": makeQueue({
    path: "/admin/f/ac-12-grading-schemes",
    figmaId: "66:4424",
    title: "Grading Schemes",
    subtitle: "Letter scales, pass/fail rules, and GPA weights.",
    breadcrumbs: ["Home", "Academics", "Grading Schemes"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "+ New Scheme",
    primaryActionHref: "/admin/f/ac-13-pending-grades",
    secondaryAction: "Pending Grades",
    secondaryActionHref: "/admin/f/ac-13-pending-grades",
    rowHref: "/admin/f/ac-13-pending-grades",
  }),

  "/admin/f/ac-13-pending-grades": {
    path: "/admin/f/ac-13-pending-grades",
    figmaId: "66:4615",
    title: "Pending Grade Submissions",
    subtitle: "Approve and officially post final course grades submitted by faculty members to academic transcripts.",
    breadcrumbs: ["Home", "Academics", "Pending Grades"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    archetype: "grades",
    primaryAction: "Accept All Outstanding",
    primaryActionHref: "/admin/f/ac-12-grading-schemes",
    secondaryAction: "Grading Schemes",
    secondaryActionHref: "/admin/f/ac-12-grading-schemes",
    grades: [
      {
        code: "ENG 101-04",
        title: "Freshman Composition",
        instructor: "Dr. Jane Austin",
        submitted: "Oct 24, 2025",
        enrolled: "24 Students",
        distribution: "A:12 | B:8 | C:4 | F:0",
        bars: [50, 31, 13, 0],
        status: "Awaiting Review",
      },
      {
        code: "CS 301-01",
        title: "Advanced Data Structures",
        instructor: "Prof. Eleanor Vance",
        submitted: "Oct 24, 2025",
        enrolled: "32 Students",
        distribution: "A:20 | B:7 | C:3 | F:2",
        bars: [50, 22, 9, 6],
        status: "Awaiting Review",
      },
      {
        code: "MATH 215-02",
        title: "Linear Algebra",
        instructor: "Dr. Arthur Pendelton",
        submitted: "Oct 23, 2025",
        enrolled: "28 Students",
        distribution: "A:10 | B:12 | C:5 | F:1",
        bars: [36, 43, 18, 4],
        status: "Awaiting Review",
      },
      {
        code: "NURS 400-01",
        title: "Clinical Practicum IV",
        instructor: "Dr. Sarah Jenkins",
        submitted: "Oct 22, 2025",
        enrolled: "18 Students",
        distribution: "A:14 | B:4 | C:0 | F:0",
        bars: [78, 22, 0, 0],
        status: "Awaiting Review",
      },
    ],
  },

  "/admin/f/ac-14-faculty": makeQueue({
    path: "/admin/f/ac-14-faculty",
    figmaId: "66:4809",
    title: "Faculty",
    subtitle: "Faculty roster, credentials, and teaching assignments.",
    breadcrumbs: ["Home", "Academics", "Faculty"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "Onboard instructor",
    primaryActionHref: "/admin/users/create?role=instructor",
    secondaryAction: "Instructor 360",
    secondaryActionHref: "/admin/f/ac-14-faculty-360",
    searchPlaceholder: "Search faculty…",
    countLabel: "Faculty",
    filters: ["Department", "Rank"],
    columns: ["Faculty", "Department", "Courses", "Load", "Status", "Action"],
    columnTemplate:
      "minmax(150px,1.2fr) minmax(130px,1fr) minmax(80px,0.5fr) minmax(70px,0.5fr) minmax(90px,0.6fr) minmax(70px,0.4fr)",
    rows: [],
    rowHref: "/admin/f/ac-14-faculty-360",
  }),

  "/admin/f/ac-14-faculty-360": {
    path: "/admin/f/ac-14-faculty-360",
    figmaId: "66:4811",
    title: "Instructor 360",
    subtitle: "Faculty profile, teaching load, and section assignments.",
    breadcrumbs: ["Home", "Academics", "Faculty", "Instructor 360"],
    activeHref: "/admin/f/ac-14-faculty",
    academicsNav: true,
    archetype: "profile360",
    primaryAction: "Assign section",
    primaryActionHref: "/admin/sections/create",
    secondaryAction: "Faculty roster",
    secondaryActionHref: "/admin/f/ac-14-faculty",
    profile360: {
      name: "Instructor",
      meta: "Loading live faculty profile…",
      badge: "ACTIVE",
      actions: ["Assign Section", "Message"],
      tabs: ["Overview", "Sections", "Timeline"],
      stats: [
        { label: "Sections", value: "—" },
        { label: "Enrolments taught", value: "—" },
        { label: "Status", value: "—" },
        { label: "Load", value: "—" },
      ],
      courses: {
        title: "Teaching assignments",
        columns: ["Course", "Section", "Enrolled", "Status"],
        rows: [],
      },
      timeline: [],
    },
  },

  "/admin/f/rg-badges-accomplishments": makeQueue({
    path: "/admin/f/rg-badges-accomplishments",
    figmaId: "66:4810",
    title: "Badges & Accomplishments",
    subtitle: "Open badges earned and available across the student body.",
    breadcrumbs: ["Home", "Students", "Badges"],
    activeHref: "/admin/f/rg-01-student-360",
    primaryAction: "Student 360",
    primaryActionHref: "/admin/f/rg-01-student-360",
    searchPlaceholder: "Search badges…",
    countLabel: "0 badges",
    filters: ["All", "earned", "available"],
    columns: ["Badge", "Code", "Student", "Status", "Earned"],
    columnTemplate:
      "minmax(160px,1.3fr) minmax(100px,0.7fr) minmax(140px,1fr) minmax(90px,0.6fr) minmax(100px,0.7fr)",
    rows: [],
  }),

  "/admin/f/ac-15-course-evaluations": makeQueue({
    path: "/admin/f/ac-15-course-evaluations",
    figmaId: "66:4968",
    title: "Course Evaluations",
    subtitle: "Student evaluation cycles and response rates.",
    breadcrumbs: ["Home", "Academics", "Course Evaluations"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "Launch Cycle",
    primaryActionHref: "/admin/f/ac-14-faculty",
    secondaryAction: "Faculty Roster",
    secondaryActionHref: "/admin/f/ac-14-faculty",
    rowHref: "/admin/f/ac-14-faculty",
  }),

  "/admin/f/ac-16-course-resources": makeQueue({
    path: "/admin/f/ac-16-course-resources",
    figmaId: "66:5364",
    title: "Course Resources",
    subtitle: "Syllabi, materials, and learning resource links.",
    breadcrumbs: ["Home", "Academics", "Course Resources"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "+ Upload Resource",
    primaryActionHref: "/admin/f/ac-06-course-catalogue",
    secondaryAction: "Catalogue",
    secondaryActionHref: "/admin/f/ac-06-course-catalogue",
    rowHref: "/admin/f/ac-07-course-setup",
  }),

  "/admin/f/ac-17-student-requirements": makeQueue({
    path: "/admin/f/ac-17-student-requirements",
    figmaId: "66:5552",
    title: "Student Requirements",
    subtitle: "Program and institutional requirement tracking.",
    breadcrumbs: ["Home", "Academics", "Student Requirements"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "Create user",
    primaryActionHref: "/admin/users/create",
    secondaryAction: "LOA Queue",
    secondaryActionHref: "/admin/f/ac-18-loa-requests",
    rowHref: "/admin/users/create",
  }),

  "/admin/f/ac-18-loa-requests": makeQueue({
    path: "/admin/f/ac-18-loa-requests",
    figmaId: "66:5700",
    title: "LOA Requests",
    subtitle: "Leave of absence petitions awaiting registrar action.",
    breadcrumbs: ["Home", "Academics", "LOA Requests"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "Review Next",
    primaryActionHref: "/admin/f/ac-19-withdraw-requests",
    secondaryAction: "Withdrawals",
    secondaryActionHref: "/admin/f/ac-19-withdraw-requests",
    rowHref: "/admin/f/rg-01-student-360",
  }),

  "/admin/f/ac-19-withdraw-requests": makeQueue({
    path: "/admin/f/ac-19-withdraw-requests",
    figmaId: "66:5844",
    title: "Withdraw Requests",
    subtitle: "Course and program withdrawal queue.",
    breadcrumbs: ["Home", "Academics", "Withdraw Requests"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    primaryAction: "Process Withdrawal",
    primaryActionHref: "/admin/f/ac-17-student-requirements",
    secondaryAction: "LOA Requests",
    secondaryActionHref: "/admin/f/ac-18-loa-requests",
    rowHref: "/admin/f/rg-01-student-360",
  }),

  "/admin/f/ac-20-create-student": {
    path: "/admin/f/ac-20-create-student",
    figmaId: "66:5975",
    title: "Create Student Record (Manual Path)",
    subtitle: "Registrar creation wizard with identity match protection.",
    breadcrumbs: ["Home", "Academics", "Create Student"],
    activeHref: "/admin/f/ac-03-programs",
    academicsNav: true,
    archetype: "wizard",
    primaryAction: "Continue Enrollment",
    primaryActionHref: "/admin/f/rg-01-student-360",
    secondaryAction: "Back to Requirements",
    secondaryActionHref: "/admin/f/ac-17-student-requirements",
    wizard: {
      steps: [
        { label: "Personal Info", state: "done" },
        { label: "Program Selection", state: "done" },
        { label: "Identity Match Check", state: "current" },
        { label: "Enrollment Details", state: "todo" },
        { label: "Review and Create", state: "todo" },
      ],
      matches: [
        {
          name: "Marcus A. Vance",
          reason: "Matches: SSN (Last 4), Date of Birth, Phone Num",
        },
        {
          name: "Marcus Vance",
          reason: "Matches: Date of Birth, Email domain similarity",
        },
      ],
      summary: [
        { label: "Name", value: "Marcus Aurelius Vance" },
        { label: "Contact Email", value: "marcus.vance@mail.com" },
        { label: "Program Target", value: "Computer Science (A.S.)" },
        { label: "Catalog Year", value: "2026 - 2027" },
      ],
    },
  },

  "/admin/f/ss-01-success-dashboard": {
    path: "/admin/f/ss-01-success-dashboard",
    figmaId: "168:1117",
    title: "Student Success Alerts",
    subtitle: "Academic standing triggers, caseload assignments, and interventions.",
    breadcrumbs: ["Home", "Students", "Success Alerts & Interventions"],
    activeHref: "/admin/f/ss-01-success-dashboard",
    archetype: "dashboard",
    primaryAction: "New Action Plan",
    kpis: [
      { label: "Active Students Monitored", value: "8,490", hint: "LMS connected", tone: "muted" },
      { label: "At-Risk Alerts Active", value: "112 Cases", hint: "↑ 5% vs last week", tone: "up" },
      { label: "Open Advisor Cases", value: "28 Cases", hint: "Assigned to advisors", tone: "muted" },
      { label: "Interventions Completed", value: "84.2%", hint: "Successful resolution rate", tone: "up" },
    ],
    riskFeed: [
      {
        name: "Zayan Malik",
        detail: "Academic Standing (Low GPA) · Current GPA 1.95 · Requires override",
        badge: "Critical",
        badgeTone: "danger",
      },
      {
        name: "Beverly Crusher",
        detail: "Attendance Drop · Missed 3 consecutive nursing labs",
        badge: "High",
        badgeTone: "review",
      },
      {
        name: "David Kim",
        detail: "Missing Prerequisites · Lacks Math 101 prerequisite for Finance",
        badge: "Medium",
        badgeTone: "new",
      },
    ],
    caseload: [
      { name: "Dr. Amy Adams", cases: "14 cases assigned", pct: 100 },
      { name: "Eleanor Vance", cases: "8 cases assigned", pct: 57 },
      { name: "Prof. J. Hill", cases: "11 cases assigned", pct: 79 },
      { name: "Dean Thomas", cases: "5 cases assigned", pct: 36 },
    ],
  },

  "/admin/f/ss-02-alert-queue": makeQueue({
    path: "/admin/f/ss-02-alert-queue",
    figmaId: "17:10106",
    title: "Active Alerts Queue",
    subtitle: "Prioritize and assign student success interventions.",
    breadcrumbs: ["Home", "Students", "Success Alerts"],
    activeHref: "/admin/f/ss-01-success-dashboard",
    primaryAction: "New Action Plan",
    searchPlaceholder: "Search alerts…",
    countLabel: "112 alerts active",
    filters: ["Severity", "Alert Type", "Assigned To"],
    columns: ["Student", "Alert Type", "Severity", "Triggered Date", "Course", "Assigned To", "Action"],
    columnTemplate:
      "minmax(140px,1.1fr) minmax(140px,1.1fr) minmax(90px,0.7fr) minmax(110px,0.8fr) minmax(90px,0.6fr) minmax(120px,0.9fr) minmax(90px,0.6fr)",
    rowHref: "/admin/f/ss-03-student-success-360",
    rows: [
      {
        primary: "Marcus Vance",
        cells: ["Marcus Vance", "Attendance Drop", "High", "Oct 24, 2026", "CS 301", "Eleanor Vance"],
        badge: "High",
        badgeTone: "danger",
        href: "/admin/f/ss-03-student-success-360",
      },
      {
        primary: "Chloe Sterling",
        cells: ["Chloe Sterling", "Failing Grade Warning", "High", "Oct 23, 2026", "MATH 215", "Arthur Pendelton"],
        badge: "High",
        badgeTone: "danger",
        href: "/admin/f/ss-03-student-success-360",
      },
      {
        primary: "Devon Lane",
        cells: ["Devon Lane", "Low Engagement", "Medium", "Oct 22, 2026", "ENG 101", "John Doe"],
        badge: "Medium",
        badgeTone: "review",
        href: "/admin/f/ss-03-student-success-360",
      },
      {
        primary: "Jane Cooper",
        cells: ["Jane Cooper", "Registration Hold", "Low", "Oct 20, 2026", "N/A", "Registrar"],
        badge: "Low",
        badgeTone: "new",
        href: "/admin/f/ss-03-student-success-360",
      },
    ],
  }),

  "/admin/f/ss-03-student-success-360": {
    path: "/admin/f/ss-03-student-success-360",
    figmaId: "17:10211",
    title: "Student Success 360",
    subtitle: "Holistic student risk, alerts, and intervention view.",
    breadcrumbs: ["Home", "Students", "Student 360"],
    activeHref: "/admin/f/ss-03-student-success-360",
    archetype: "profile360",
    profile360: {
      name: "Marcus Vance",
      meta: "Student ID: #2024-88421 · Computer Science Major · Term 5",
      tabs: ["Overview", "Alerts", "Cases", "Action Plan", "Appointments", "Notes"],
      aiBlurb:
        "Marcus's attendance has dropped below 80% in CS 301. We suggest scheduling an academic advisor review and assigning a peer tutor for CS 301 practical labs.",
      alert: "CS 301: Critical Attendance Alert (74% attendance)",
      plan: "Set up Peer Tutoring Program (Pending mentor assignment)",
    },
  },

  "/admin/f/ss-04-case": {
    path: "/admin/f/ss-04-case",
    figmaId: "17:10294",
    title: "Case",
    subtitle: "Manage academic intervention cases through resolution.",
    breadcrumbs: ["Home", "Students", "Cases"],
    activeHref: "/admin/f/ss-04-case",
    archetype: "case",
    caseDetail: {
      type: "Case Type: Academic Intervention",
      title: "Attendance Drop: Marcus Vance",
      status: "IN PROGRESS",
      owner: "Eleanor Vance",
      body: "Case opened automatically on Oct 24 after 3 consecutive missed lectures in CS 301: Advanced Data Structures. Initial outreach sent.",
      outcome: "Resolved - Plan Implemented",
      tabs: ["Details", "Actions", "Notes", "Timeline"],
    },
  },

  "/admin/f/ss-05-action-plan": {
    path: "/admin/f/ss-05-action-plan",
    figmaId: "17:10379",
    title: "Marcus Vance - Peer Mentoring Action Plan",
    subtitle: "Plan status: Active · Created on Oct 24, 2026",
    breadcrumbs: ["Home", "Students", "Action Plans"],
    activeHref: "/admin/f/ss-05-action-plan",
    archetype: "plan",
    primaryAction: "Add Task",
    planTasks: [
      { task: "Register for weekly peer tutor support sessions", owner: "Marcus Vance", due: "Oct 28, 2026", shared: true },
      { task: "Complete math catch-up diagnostic workbook", owner: "Marcus Vance", due: "Nov 02, 2026", shared: true },
      { task: "CS 301 mid-term diagnostic review conference", owner: "Eleanor Vance", due: "Nov 05, 2026", shared: false },
      { task: "Attendance confirmation report from Science Hall", owner: "Support Staff", due: "Nov 12, 2026", shared: true },
    ],
  },

  "/admin/f/ss-06-appointments": {
    path: "/admin/f/ss-06-appointments",
    figmaId: "17:10486",
    title: "Appointments",
    subtitle: "Advisor booking slots and student meeting schedule.",
    breadcrumbs: ["Home", "Students", "Appointments"],
    activeHref: "/admin/f/ss-01-success-dashboard",
    archetype: "appointments",
    appointments: {
      slots: [
        { time: "09:00 AM - 09:45 AM", title: "Math Review - Chloe Sterling", status: "Booked" },
        { time: "10:30 AM - 11:15 AM", title: "Academic Alert Catch-up - Marcus Vance", status: "Booked" },
        { time: "01:30 PM - 02:15 PM", title: "Open Advising Slot", status: "Available" },
        { time: "03:00 PM - 03:45 PM", title: "Financial Hold Counseling", status: "Available" },
      ],
      student: "Marcus Vance",
      advisor: "Eleanor Vance",
    },
  },

  "/admin/f/ss-07-intervention-analytics": {
    path: "/admin/f/ss-07-intervention-analytics",
    figmaId: "17:10585",
    title: "Intervention Analytics",
    subtitle: "Outcomes, caseload mix, and time-to-close trends.",
    breadcrumbs: ["Home", "Students", "Intervention Analytics"],
    activeHref: "/admin/f/ss-01-success-dashboard",
    archetype: "analytics",
    analytics: {
      bars: [
        { label: "Academic Advising", value: "142", width: "88%", color: "#2563EB" },
        { label: "Peer Tutoring", value: "98", width: "64%", color: "#849f38" },
        { label: "Financial Advice", value: "45", width: "32%", color: "#1d4ed8" },
      ],
      outcomes: [
        { label: "Resolved positive outcomes (70%)", color: "#2563EB" },
        { label: "In Progress active review (20%)", color: "#fac020" },
        { label: "Escalated without resolution (10%)", color: "#ba1a1a" },
      ],
      weeks: [
        { label: "Week 1", height: "88%" },
        { label: "Week 2", height: "75%" },
        { label: "Week 3", height: "63%" },
        { label: "Week 4", height: "50%" },
        { label: "Week 5", height: "56%" },
        { label: "Week 6", height: "44%" },
      ],
    },
  },

  "/admin/f/fn-01-finance-dashboard": {
    path: "/admin/f/fn-01-finance-dashboard",
    figmaId: "168:896",
    title: "Finance Dashboard",
    subtitle: "Receivables, billing plans, and account reconciliations.",
    breadcrumbs: ["Home", "Finance", "Dashboard"],
    activeHref: "/admin/f/fn-01-finance-dashboard",
    archetype: "dashboard",
    primaryAction: "Billing Run",
    kpis: [
      { label: "Total Revenue This Term", value: "$1,240,450", hint: "↑ 4.2% vs last term", tone: "up" },
      { label: "Outstanding Balance", value: "$148,450", hint: "Current student balances", tone: "muted" },
      { label: "Refunds Pending", value: "4 Cases", hint: "Requires supervisor signoff", tone: "danger" },
      { label: "Payment Plans Active", value: "1,120 Plan", hint: "82% on autopay schedule", tone: "up" },
    ],
    financeDash: {
      months: [
        { label: "Mar", height: "22%" },
        { label: "Apr", height: "34%" },
        { label: "May", height: "26%" },
        { label: "Jun", height: "45%" },
        { label: "Jul", height: "60%" },
        { label: "Aug", height: "72%" },
        { label: "Sep", height: "82%" },
        { label: "Oct", height: "100%", active: true },
      ],
      methods: [
        { label: "Stripe Gateway", value: "58% ($1,020,400)", color: "#2563EB" },
        { label: "Direct ACH", value: "32% ($560,300)", color: "#1d4ed8" },
        { label: "Internal Checks", value: "10% ($175,000)", color: "#8d928a" },
      ],
      transactions: [
        { name: "Jane Cooper", detail: "Stripe Gateway · Tuition", amount: "$1,200" },
        { name: "Marcus Vance", detail: "Direct ACH · Lab Fees", amount: "$850" },
        { name: "Chloe Sterling", detail: "Direct ACH · Meal Plan", amount: "$2,100" },
      ],
      overdue: [
        { name: "Liam O'Connor", detail: "64 Days Overdue · $3,450" },
        { name: "Sofia Rodriguez", detail: "38 Days Overdue · $1,890" },
      ],
    },
  },

  "/admin/f/fn-02-student-account": {
    path: "/admin/f/fn-02-student-account",
    figmaId: "65:4530",
    title: "Student Account",
    subtitle: "Ledger, payment plans, and bursar actions.",
    breadcrumbs: ["Home", "Finance", "Accounts", "STU-2026-1847"],
    activeHref: "/admin/f/fn-02-student-account",
    archetype: "account",
    primaryAction: "Apply Charge",
    secondaryAction: "Record Payment",
    account: {
      name: "Marcus Aurelius · STU-2026-1847",
      meta: "Associate of Applied Science - Cybersecurity Track",
      balance: "$4,250.00",
      dueNote: "Next installment due: Nov 01, 2026 ($1,416.00)",
      planTitle: "Active Payment Plan",
      planBody: "3-Month installment option. 2 of 3 payments remaining. Tracked automatically by CampusOne Bursar.",
      tabs: ["Ledger Summary", "Outstanding Charges", "Payments Applied", "Grants & Financial Aid"],
      ledger: [
        { date: "Oct 01, 2026", desc: "Lab Fee - Chemistry 302", debit: "$500.00", credit: "-", balance: "$4,250.00" },
        { date: "Sep 15, 2026", desc: "Online Payment Received - Plan Installment", debit: "-", credit: "$3,250.00", balance: "$3,750.00", creditTone: true },
        { date: "Aug 25, 2026", desc: "Community Merit Scholarship Applied", debit: "-", credit: "$5,000.00", balance: "$7,000.00", creditTone: true },
        { date: "Aug 15, 2026", desc: "Tuition Fee - Fall 2026", debit: "$12,000.00", credit: "-", balance: "$12,000.00" },
      ],
    },
  },

  "/admin/f/fn-03-charges": makeQueue({
    path: "/admin/f/fn-03-charges",
    figmaId: "17:10809",
    title: "Standard Term Fee Schedules",
    subtitle: "Program fee catalogs and bulk charge application.",
    breadcrumbs: ["Home", "Finance", "Charges"],
    activeHref: "/admin/f/fn-01-finance-dashboard",
    searchPlaceholder: "Search fee schedules…",
    countLabel: "4 fee schedules",
    filters: ["Program Block", "Frequency"],
    columns: ["Fee Description", "Program Block", "Amount", "Frequency", "Action"],
    columnTemplate: "minmax(220px,1.6fr) minmax(120px,1fr) 110px 120px 90px",
    actionLabel: "Edit Fee",
    infoBanner: {
      title: "Bulk Fee Schedule Scheduler",
      body: "Apply term fees to all students enrolled in a program block.",
      cta: "Bulk Apply Charges",
    },
    rows: [
      {
        primary: "Tuition Fee - Computer Science (Undergrad)",
        cells: ["Tuition Fee - Computer Science (Undergrad)", "CS Undergrad", "$4,200.00", "Per Semester"],
      },
      {
        primary: "Tuition Fee - Liberal Arts (Undergrad)",
        cells: ["Tuition Fee - Liberal Arts (Undergrad)", "Liberal Arts", "$3,800.00", "Per Semester"],
      },
      {
        primary: "Technology & Library Access Levy",
        cells: ["Technology & Library Access Levy", "All Programs", "$150.00", "Annual"],
      },
      {
        primary: "Science Laboratory Infrastructure Fee",
        cells: ["Science Laboratory Infrastructure Fee", "CS & Science Block", "$250.00", "Per Semester"],
      },
    ],
  }),

  "/admin/f/fn-04-payments": makeQueue({
    path: "/admin/f/fn-04-payments",
    figmaId: "17:10906",
    title: "Received Payments Log",
    subtitle: "Gateway settlements and receipt archive.",
    breadcrumbs: ["Home", "Finance", "Payments"],
    activeHref: "/admin/f/fn-01-finance-dashboard",
    searchPlaceholder: "Search payments…",
    countLabel: "248 payments this term",
    filters: ["Method", "Status"],
    columns: ["Student Name", "Method & Gateway Reference", "Amount", "Status", "Receipt"],
    columnTemplate: "minmax(140px,1fr) minmax(180px,1.4fr) 110px 110px 130px",
    actionLabel: "View PDF Receipt",
    rows: [
      {
        primary: "Marcus Vance",
        secondary: "Stripe: ch_3MxxOpL2x",
        cells: ["Marcus Vance", "Credit Card", "$4,200.00", "COMPLETED"],
        badge: "COMPLETED",
        badgeTone: "active",
      },
      {
        primary: "Chloe Sterling",
        secondary: "Direct ACH: tx_88421098",
        cells: ["Chloe Sterling", "Direct Bank Transfer", "$2,100.00", "COMPLETED"],
        badge: "COMPLETED",
        badgeTone: "active",
      },
      {
        primary: "Devon Lane",
        secondary: "Stripe: ch_3MxxZpK8y",
        cells: ["Devon Lane", "Credit Card", "$150.00", "PENDING"],
        badge: "PENDING",
        badgeTone: "review",
      },
    ],
  }),

  "/admin/f/fn-05-reconciliation": {
    path: "/admin/f/fn-05-reconciliation",
    figmaId: "17:11000",
    title: "Reconciliation",
    subtitle: "Match gateway clearing to the student ledger.",
    breadcrumbs: ["Home", "Finance", "Reconciliation"],
    activeHref: "/admin/f/fn-01-finance-dashboard",
    archetype: "reconcile",
    reconcile: {
      stripe: [
        { label: "ch_90218 - Marcus Vance", amount: "$4,200.00", status: "MATCHED" },
        { label: "ch_88201 - Unknown Payer", amount: "$150.00", status: "UNMATCHED" },
      ],
      ledger: [
        { label: "Marcus Vance - Cs Sem 5", amount: "$4,200.00" },
        { label: "No matching entry found in ledger", amount: "N/A", highlight: true },
      ],
    },
  },

  "/admin/f/fn-06-refund-queue": makeQueue({
    path: "/admin/f/fn-06-refund-queue",
    figmaId: "17:11088",
    title: "Pending Student Refund Approvals",
    subtitle: "Supervisor review for bursar refund requests.",
    breadcrumbs: ["Home", "Finance", "Refund Queue"],
    activeHref: "/admin/f/fn-01-finance-dashboard",
    searchPlaceholder: "Search refunds…",
    countLabel: "4 refunds pending",
    filters: ["Reason", "Amount"],
    columns: ["Student Name", "Refund Reason", "Request Date", "Amount", "Review Action"],
    columnTemplate: "minmax(140px,1.1fr) minmax(140px,1.1fr) 120px 110px minmax(180px,1fr)",
    rowActions: "refund",
    rows: [
      {
        primary: "Marcus Vance",
        cells: ["Marcus Vance", "Class Cancellation", "Oct 24, 2026", "$1,200.00"],
      },
      {
        primary: "Chloe Sterling",
        cells: ["Chloe Sterling", "Double Payment Fee", "Oct 23, 2026", "$250.00"],
      },
    ],
  }),

  "/admin/f/fn-07-holds": {
    path: "/admin/f/fn-07-holds",
    figmaId: "17:11179",
    title: "Financial Holds",
    subtitle: "Active bursar holds and release workflow.",
    breadcrumbs: ["Home", "Finance", "Holds"],
    activeHref: "/admin/f/fn-01-finance-dashboard",
    archetype: "holds",
    holds: {
      rows: [
        { student: "Marcus Vance", type: "Tuition Hold", reason: "Unpaid Balance > 60 days", placedBy: "Bursar Office" },
        { student: "Devon Lane", type: "Library Hold", reason: "Overdue Books Penalty", placedBy: "Library Admin" },
      ],
      student: "Marcus Vance",
      releaseReason: "Payment Plan Agreement Signed",
    },
  },

  "/admin/f/fn-08-finance-export": {
    path: "/admin/f/fn-08-finance-export",
    figmaId: "17:20634",
    title: "Finance Ledger Export",
    subtitle: "Generate GL packages for accounting systems.",
    breadcrumbs: ["Home", "Finance", "Export"],
    activeHref: "/admin/f/fn-01-finance-dashboard",
    archetype: "export",
    primaryAction: "Generate New Export",
    exportPanel: {
      configs: [
        { label: "Destination", value: "QuickBooks Online" },
        { label: "Date Range", value: "Fall 2026 Term" },
        { label: "Include", value: "Charges, Payments, Refunds" },
      ],
      schema: ["student_id", "txn_date", "gl_code", "debit", "credit", "memo"],
      history: [
        { name: "QB_Fall2026_Week42.csv", date: "Oct 20, 2026", status: "Ready" },
        { name: "QB_Fall2026_Week41.csv", date: "Oct 13, 2026", status: "Archived" },
      ],
    },
  },

  "/admin/f/crm-01-dashboard": {
    path: "/admin/f/crm-01-dashboard",
    figmaId: "168:1959",
    title: "CRM Dashboard",
    subtitle: "Track prospective student inquiries, campaigns, and transition pipelines.",
    breadcrumbs: ["Home", "CRM", "Dashboard"],
    activeHref: "/admin/f/crm-01-dashboard",
    archetype: "dashboard",
    primaryAction: "New Lead",
    kpis: [
      { label: "Total Leads", value: "1,247", hint: "Active prospective cohort", tone: "up" },
      { label: "Active Leads", value: "342", hint: "Engaged this cycle", tone: "up" },
      { label: "Conversion Rate", value: "28%", hint: "↑ 2.4% over target expectation", tone: "up" },
      { label: "Events This Month", value: "156", hint: "Campus tours & info hours", tone: "up" },
    ],
    crmDash: {
      funnel: [
        { label: "Inquiry", value: "1247 Leads (100%)", pct: 100, color: "#2563EB" },
        { label: "Application Started", value: "684 Leads (55%)", pct: 55, color: "#849f38" },
        { label: "Admitted Status", value: "342 Leads (27%)", pct: 27, color: "#1d4ed8" },
        { label: "Enrolled", value: "210 Leads (17%)", pct: 17, color: "#1F2937" },
      ],
      recent: [
        {
          name: "Gavin MacLeod",
          detail: "g.macleod@gmail.com • Online Inquiry",
          badge: "Inquiry",
          badgeTone: "new",
        },
        {
          name: "Diana Prince",
          detail: "diana.prince@star.org • Referral",
          badge: "Interview Scheduled",
          badgeTone: "interview",
        },
        {
          name: "Arthur Dent",
          detail: "galaxy.guide@yahoo.com • Facebook Ad",
          badge: "Applied",
          badgeTone: "review",
        },
        {
          name: "Selina Kyle",
          detail: "catpaw@gmail.com • Search Engine",
          badge: "Inquiry",
          badgeTone: "new",
        },
      ],
    },
  },

  "/admin/f/crm-02-leads": makeQueue({
    path: "/admin/f/crm-02-leads",
    figmaId: "17:8674",
    title: "Prospect Leads",
    subtitle: "All registered prospects and web inquiries",
    breadcrumbs: ["Home", "CRM", "Leads"],
    activeHref: "/admin/f/crm-01-dashboard",
    primaryAction: "New Lead",
    secondaryActions: ["Bulk Assign", "Import CSV"],
    searchPlaceholder: "Search by name, email...",
    filters: ["Computer Science", "All Sources", "Min. Score"],
    countLabel: "Showing 1-5 of 1,842 Leads",
    columns: ["Name", "Program Interest", "Source", "Stage", "Owner", "Last Activity", "Score"],
    columnTemplate: "minmax(140px,1.1fr) minmax(130px,1fr) 110px 110px 120px 120px 70px",
    rows: [
      {
        primary: "Marcus Vance",
        cells: ["Marcus Vance", "CS: Data Structures", "Web Search", "Prospect", "Advisor Eleanor", "2 hours ago", "95"],
        badge: "Prospect",
        badgeTone: "new",
        href: "/admin/f/crm-03-lead-360",
      },
      {
        primary: "Sarah Jenkins",
        cells: ["Sarah Jenkins", "A.S. Nursing", "College Fair", "Applied", "Advisor Vance", "1 day ago", "82"],
        badge: "Applied",
        badgeTone: "review",
        href: "/admin/f/crm-03-lead-360",
      },
      {
        primary: "Aleksey Petrov",
        cells: ["Aleksey Petrov", "Cybersecurity", "Referral", "Interview", "Advisor Eleanor", "3 days ago", "76"],
        badge: "Interview",
        badgeTone: "interview",
        href: "/admin/f/crm-03-lead-360",
      },
      {
        primary: "Chloe Sterling",
        cells: ["Chloe Sterling", "Business Admin", "Web Inquiry", "Prospect", "Advisor Vance", "5 days ago", "61"],
        badge: "Prospect",
        badgeTone: "new",
        href: "/admin/f/crm-03-lead-360",
      },
      {
        primary: "Devon Lane",
        cells: ["Devon Lane", "CS: AI Track", "Paid Ads", "Admitted", "Advisor Eleanor", "1 week ago", "88"],
        badge: "Admitted",
        badgeTone: "active",
        href: "/admin/f/crm-03-lead-360",
      },
    ],
  }),

  "/admin/f/crm-03-lead-360": {
    path: "/admin/f/crm-03-lead-360",
    figmaId: "17:8811",
    title: "Lead 360",
    subtitle: "Marcus Vance · CS: Data Structures",
    breadcrumbs: ["Home", "CRM", "Leads", "Marcus Vance"],
    activeHref: "/admin/f/crm-01-dashboard",
    archetype: "lead360",
    primaryAction: "Convert to Applicant",
    secondaryAction: "Log Activity",
    lead360: {
      name: "Marcus Vance",
      meta: "marcus.vance@gmail.com · Web Search · Score 95",
      score: "95",
      steps: [
        { label: "Inquiry", state: "done" },
        { label: "Qualified", state: "done" },
        { label: "Applied", state: "current" },
        { label: "Admitted", state: "todo" },
        { label: "Enrolled", state: "todo" },
      ],
      tabs: ["Activity", "Details", "Applications", "Campaigns", "Tasks"],
      fields: [
        { label: "First Name", value: "Marcus" },
        { label: "Last Name", value: "Vance" },
        { label: "Email", value: "marcus.vance@gmail.com" },
        { label: "Program Interest", value: "CS: Data Structures" },
        { label: "Lead Source", value: "Web Search" },
        { label: "Owner", value: "Advisor Eleanor" },
      ],
      timeline: [
        { when: "2 hours ago", text: "Opened Spring 2026 Admissions Newsletter campaign." },
        { when: "Yesterday", text: "Counselor note: Strong interest in evening CS labs." },
        { when: "Oct 12, 2026", text: "Registered for Computer Science Open House." },
      ],
    },
  },

  "/admin/f/crm-04-campaigns": makeQueue({
    path: "/admin/f/crm-04-campaigns",
    figmaId: "17:8957",
    title: "Marketing Campaigns",
    subtitle: "Automated outreach and regional awareness cohort tracking",
    breadcrumbs: ["Home", "CRM", "Campaigns"],
    activeHref: "/admin/f/crm-01-dashboard",
    primaryAction: "Create Campaign",
    searchPlaceholder: "Search campaigns…",
    filters: ["Status", "Audience"],
    countLabel: "4 campaigns",
    columns: ["Campaign Name", "Status", "Audience Size", "Sent", "Opened", "Clicked", "Converted"],
    columnTemplate: "minmax(200px,1.6fr) 110px 110px 90px 110px 110px 90px",
    rows: [
      {
        primary: "Spring 2026 Admissions Newsletter",
        cells: ["Spring 2026 Admissions Newsletter", "Active", "5,420", "5,420", "4,102 (75%)", "1,280 (23%)", "412"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/crm-05-campaign-detail",
      },
      {
        primary: "STEM Open House Invitation",
        cells: ["STEM Open House Invitation", "Paused", "2,100", "1,840", "1,240 (67%)", "340 (18%)", "94"],
        badge: "Paused",
        badgeTone: "review",
        href: "/admin/f/crm-05-campaign-detail",
      },
      {
        primary: "Fafsa Support Workshop Reminders",
        cells: ["Fafsa Support Workshop Reminders", "Draft", "920", "0", "0", "0", "0"],
        badge: "Draft",
        badgeTone: "new",
        href: "/admin/f/crm-05-campaign-detail",
      },
      {
        primary: "Scholarship Deadline Alert",
        cells: ["Scholarship Deadline Alert", "Completed", "3,800", "3,800", "2,904 (76%)", "1,024 (26%)", "184"],
        badge: "Completed",
        badgeTone: "interview",
        href: "/admin/f/crm-05-campaign-detail",
      },
    ],
  }),

  "/admin/f/crm-05-campaign-detail": {
    path: "/admin/f/crm-05-campaign-detail",
    figmaId: "17:9050",
    title: "Campaign Detail",
    subtitle: "Spring 2026 Admissions Newsletter",
    breadcrumbs: ["Home", "CRM", "Campaigns", "Spring 2026"],
    activeHref: "/admin/f/crm-01-dashboard",
    archetype: "campaignDetail",
    primaryAction: "Publish",
    secondaryAction: "Edit Content",
    campaignDetail: {
      name: "Spring 2026 Admissions Newsletter",
      status: "Active",
      kpis: [
        { label: "Total Sent", value: "5,420", hint: "Emails sent out of 5,500 total" },
        { label: "Open Rate", value: "75.6%", hint: "4,102 distinct opens" },
        { label: "Click Rate", value: "23.6%", hint: "1,280 link clicks" },
        { label: "Converted", value: "412", hint: "Submitted applications" },
      ],
      rules: [
        "Program Interest = STEM / Computer Science",
        "Region = Local Metro Community",
        "Lead Score >= 50",
      ],
      subject: "Unlock your potential this Spring",
    },
  },

  "/admin/f/crm-06-events": {
    path: "/admin/f/crm-06-events",
    figmaId: "17:9149",
    title: "Recruitment Events",
    subtitle: "Event roster and check-in",
    breadcrumbs: ["Home", "CRM", "Events"],
    activeHref: "/admin/f/crm-01-dashboard",
    archetype: "events",
    primaryAction: "New Check-In",
    secondaryAction: "Export Roster",
    events: {
      list: [
        { title: "Computer Science Open House", meta: "Oct 24, 2026 · 128 registered", active: true },
        { title: "Nursing Career Info Seminar", meta: "Nov 02, 2026 · 84 registered" },
        { title: "Financial Aid & Scholarship Day", meta: "Nov 12, 2026 · 240 registered" },
      ],
      selectedTitle: "Computer Science Open House",
      selectedMeta: "Oct 24, 2026 · Science Hall lobby & Labs",
      roster: [
        {
          name: "Marcus Vance",
          email: "marcus.vance@gmail.com",
          date: "Oct 12, 2026",
          status: "Checked In",
          tone: "active",
        },
        {
          name: "Sarah Jenkins",
          email: "sarah.j99@gmail.com",
          date: "Oct 14, 2026",
          status: "No Show",
          tone: "danger",
        },
        {
          name: "Aleksey Petrov",
          email: "aleksey.tech@gmail.com",
          date: "Oct 15, 2026",
          status: "Registered",
          tone: "new",
        },
        {
          name: "Daniel Craig",
          email: "daniel.007@gmail.com",
          date: "Oct 16, 2026",
          status: "Checked In",
          tone: "active",
        },
      ],
    },
  },

  "/admin/f/crm-07-counsellor-queue": {
    path: "/admin/f/crm-07-counsellor-queue",
    figmaId: "17:9244",
    title: "Admissions Task Queue",
    subtitle: "Advising and support tasks assigned directly to you",
    breadcrumbs: ["Home", "CRM", "Task Queue"],
    activeHref: "/admin/f/crm-01-dashboard",
    archetype: "tasks",
    primaryAction: "Task Settings",
    tasks: {
      groups: [
        {
          title: "Overdue Tasks (2)",
          tone: "danger",
          items: [
            {
              name: "Michael Torres",
              detail: "Follow-up regarding financial aid inquiry",
              when: "2 days ago",
            },
            {
              name: "Sarah Jenkins",
              detail: "Validate high school transcript credits",
              when: "Yesterday",
            },
          ],
        },
        {
          title: "Due Today (2)",
          tone: "active",
          items: [
            {
              name: "Marcus Vance",
              detail: "Transcript call discussion and fast-track evaluation",
              when: "Today at 2:00 PM",
            },
            {
              name: "Aleksey Petrov",
              detail: "MFA setup walkthrough support call",
              when: "Today at 4:30 PM",
            },
          ],
        },
      ],
    },
  },

  "/admin/f/crm-08-funnel-analytics": {
    path: "/admin/f/crm-08-funnel-analytics",
    figmaId: "17:9338",
    title: "Funnel Analytics & Reports",
    subtitle: "Deep pipeline visibility and counsellor acquisition tracking",
    breadcrumbs: ["Home", "CRM", "Analytics"],
    activeHref: "/admin/f/crm-01-dashboard",
    archetype: "analytics",
    primaryAction: "Export PDF Report",
    analytics: {
      leftTitle: "Conversion Stages Optimization",
      rightTitle: "Top Lead Acquisition Channels",
      bars: [
        { label: "Prospect -> Applied", value: "14.2 days", width: "100%", color: "#2563EB" },
        { label: "Applied -> Admitted", value: "3.1 days", width: "51%", color: "#849f38" },
        { label: "Admitted -> Enrolled", value: "8.4 days", width: "39%", color: "#1d4ed8" },
      ],
      outcomes: [
        { label: "Direct / Web Search", color: "#2563EB", value: "4,102 leads" },
        { label: "Paid Advertisements", color: "#1d4ed8", value: "2,904 leads" },
        { label: "College Fairs & Outreach", color: "#849f38", value: "1,240 leads" },
        { label: "Alumni Referrals", color: "#8d928a", value: "840 leads" },
      ],
    },
  },

  "/admin/f/pl-01-users-and-roles": makeQueue({
    path: "/admin/f/pl-01-users-and-roles",
    figmaId: "168:2613",
    title: "Users & Roles",
    subtitle: "Manage administration personnel permission roles and system directory access.",
    breadcrumbs: ["Home", "System", "Platform Settings", "Users & Roles"],
    activeHref: "/admin/f/pl-07-institution-settings",
    platformNav: true,
    primaryAction: "+ Invite User",
    primaryActionHref: "/admin/users/create",
    searchPlaceholder: "Search users by name or email...",
    filters: ["Filter by Role: All"],
    countLabel: "4 directory profiles",
    columns: ["Name & Email", "System Role", "Primary Department", "Last Login", "Status"],
    columnTemplate: "minmax(200px,1.6fr) minmax(140px,1.1fr) minmax(140px,1.1fr) 130px 100px",
    hideRowAction: true,
    rows: [
      {
        primary: "Dr. Amy Adams",
        secondary: "a.adams@heritage.edu",
        cells: ["Dr. Amy Adams", "Registrar / Counselor", "Health Sciences", "5 mins ago", "Active"],
        badge: "Active",
        badgeTone: "active",
      },
      {
        primary: "Eleanor Vance",
        secondary: "e.vance@heritage.edu",
        cells: ["Eleanor Vance", "Super Admin", "Registrar's Office", "2 hours ago", "Active"],
        badge: "Active",
        badgeTone: "active",
      },
      {
        primary: "Prof. John Hill",
        secondary: "j.hill@heritage.edu",
        cells: ["Prof. John Hill", "Faculty", "Business & Humanities", "Yesterday, 3:15 PM", "Active"],
        badge: "Active",
        badgeTone: "active",
      },
      {
        primary: "Tuvok Vulcan",
        secondary: "tuvok@heritage.edu",
        cells: ["Tuvok Vulcan", "Lab Tech", "STEM & Computing", "3 days ago", "Inactive"],
        badge: "Inactive",
        badgeTone: "new",
      },
    ],
  }),

  "/admin/f/pl-02-permission-matrix": {
    path: "/admin/f/pl-02-permission-matrix",
    figmaId: "66:1314",
    title: "Permission Matrix Workspace",
    subtitle: "Configure authorization boundaries across platform modules and functional groups.",
    breadcrumbs: ["Home", "Platform", "Permission Matrix"],
    activeHref: "/admin/f/pl-07-institution-settings",
    platformNav: true,
    archetype: "matrix",
    primaryAction: "Submit Changes for Approval",
    matrix: {
      banner: {
        body: "There are currently 3 pending changes to this Matrix awaiting administrative co-signature. Action required.",
        cta: "Review Draft",
      },
      roles: ["System Admin", "Registrar Office", "Instructors", "Student Rep"],
      rows: [
        {
          module: "User Registry",
          capability: "Write SIS Records",
          detail: "Allows direct synchronization of manual enrollment database",
          checks: [true, true, false, false],
        },
        {
          module: "System Logs",
          capability: "Purge Audit Logs",
          detail: "Clear login trails older than 90 days",
          checks: [true, false, false, false],
        },
        {
          module: "Course Mgmt",
          capability: "Create Virtual Labs",
          detail: "Construct digital developer environments for classes",
          checks: [true, false, true, false],
        },
        {
          module: "Grading Engine",
          capability: "Override Final Marks",
          detail: "Manual modification of gradebook outcomes",
          checks: [true, true, false, false],
        },
        {
          module: "Platform Security",
          capability: "Change MFA Mandate",
          detail: "Enable or disable global security standards",
          checks: [true, false, false, false],
        },
        {
          module: "Communications",
          capability: "Platform-wide Broadcast",
          detail: "Send emergency banners to all active user portals",
          checks: [true, false, false, false],
        },
      ],
    },
  },

  "/admin/f/pl-03-security-policy": {
    path: "/admin/f/pl-03-security-policy",
    figmaId: "66:1483",
    title: "Security Policy & Identity Governance",
    subtitle: "Configure multi-factor authentication, password complexity, IP filters, and concurrent portal restrictions.",
    breadcrumbs: ["Home", "Platform", "Security Policy"],
    activeHref: "/admin/f/pl-07-institution-settings",
    platformNav: true,
    archetype: "policy",
    primaryAction: "Save Security Settings",
    policy: {
      sections: [
        {
          title: "Multi-Factor Authentication (MFA)",
          toggles: [
            {
              label: "Require MFA for Campus Personnel",
              detail: "Mandates authenticator application or SMS setup for Admins, Registrar and Faculty.",
              on: true,
            },
            {
              label: "Permit student SMS verification",
              detail: "Allows SMS as a secondary validation alternative to authenticator apps.",
              on: true,
            },
          ],
        },
        {
          title: "Password Complexity Guidelines",
          fields: [{ label: "Minimum Character Length", value: "12" }],
          checks: [
            "Require at least one uppercase letter (A-Z)",
            "Require at least one numeric digit (0-9)",
            "Require at least one special symbol (!@#$)",
          ],
        },
        {
          title: "Session & Concurrency Controls",
          fields: [
            {
              label: "Maximum Concurrent Sessions Per Account",
              value: "3 active sessions",
              hint: "Exceeding this value automatically invalidates the oldest session token.",
            },
          ],
          toggles: [
            {
              label: "Enable Shared-IP Session Alerting",
              detail: "Warn security team when identical credentials connect from diverse geolocations within 5 minutes.",
              on: true,
            },
          ],
        },
        {
          title: "Admin Console IP Allowlist",
          textarea: {
            label: "Explicit Access Subnets (One per line)",
            value: "192.168.10.0/24 (Campus LAN)\n10.200.0.0/16 (Administrative VPN)",
            hint: "Attempts to log into platform management outside these blocks are dropped instantly.",
          },
        },
      ],
    },
  },

  "/admin/f/pl-04-session-login-audit": makeQueue({
    path: "/admin/f/pl-04-session-login-audit",
    figmaId: "66:1608",
    title: "Session & Login Audit Trail",
    subtitle: "Examine comprehensive verification activity, track geographical outliers, and investigate anomalies.",
    breadcrumbs: ["Home", "Platform", "Session Audit"],
    activeHref: "/admin/f/pl-07-institution-settings",
    platformNav: true,
    primaryAction: "Export CSV Log",
    searchPlaceholder: "Enter name or email...",
    filters: ["Today: Oct 24, 2026", "All Sessions"],
    countLabel: "Filter Audit Registry",
    columns: ["Identified User", "IP Address", "Client Environment", "Timestamp", "Status", "Resolved Location"],
    columnTemplate: "minmax(160px,1.3fr) 120px 130px 150px 100px minmax(120px,1fr)",
    rows: [
      {
        primary: "Sarah Jenkins (Admin)",
        cells: ["Sarah Jenkins (Admin)", "192.168.10.45", "Chrome / macOS", "Oct 24, 2026 11:21 AM", "Success", "Science Hall (Internal)"],
        badge: "Success",
        badgeTone: "active",
      },
      {
        primary: "Marcus Thompson (Student)",
        cells: ["Marcus Thompson (Student)", "107.21.43.109", "Safari / iOS", "Oct 24, 2026 10:55 AM", "Success", "Off-Campus VPN"],
        badge: "Success",
        badgeTone: "active",
      },
      {
        primary: "Arthur Pendelton (Instructor)",
        cells: ["Arthur Pendelton (Instructor)", "192.168.10.88", "Edge / Windows", "Oct 24, 2026 09:30 AM", "Success", "Faculty Lounge"],
        badge: "Success",
        badgeTone: "active",
      },
      {
        primary: "unknown_credential",
        cells: ["unknown_credential", "203.0.113.12", "Python-Requests", "Oct 24, 2026 09:12 AM", "Failed", "München, Germany"],
        badge: "Failed",
        badgeTone: "danger",
      },
      {
        primary: "Eleanor Vance (Registrar)",
        cells: ["Eleanor Vance (Registrar)", "192.168.12.115", "Chrome / Windows", "Oct 24, 2026 08:44 AM", "Success", "Administration Wing"],
        badge: "Success",
        badgeTone: "active",
      },
    ],
  }),

  "/admin/f/pl-05-integrations": {
    path: "/admin/f/pl-05-integrations",
    figmaId: "66:1977",
    title: "Platform Integrations",
    subtitle: "Manage third-party connections, LTI tools, and external services linked to CampusOne.",
    breadcrumbs: ["Home", "Platform", "Integrations"],
    activeHref: "/admin/f/pl-07-institution-settings",
    platformNav: true,
    archetype: "integrations",
    primaryAction: "+ Connect New Service",
    integrations: {
      kpis: [
        { label: "Active Connections", value: "5 / 6" },
        { label: "LTI Tool Launches", value: "45,210" },
        { label: "Average Latency", value: "34ms" },
      ],
      cards: [
        { name: "Canvas LMS", detail: "LTI 1.3 Tool • Institution-wide", sync: "Last Sync: 5 mins ago", status: "Connected", tone: "active" },
        { name: "Stripe Gateway", detail: "Payment Gateway • Student Accounts", sync: "Last Sync: Real-time", status: "Connected", tone: "active" },
        { name: "Ellucian Banner SIS", detail: "SIS Import • Registrar Sync", sync: "Last Sync: 4 hours ago", status: "Sync Warning", tone: "review" },
        { name: "Twilio API", detail: "SMS / Comms Provider • Campus Alerts", sync: "Last Sync: 12 mins ago", status: "Connected", tone: "active" },
        { name: "Panopto Video", detail: "Video Provider • Media Libraries", sync: "Last Sync: 1 day ago", status: "Connected", tone: "active" },
        { name: "Zoom Education", detail: "Virtual Classroom • LTI Pro Scope", sync: "Last Sync: Never", status: "Disconnected", tone: "danger" },
      ],
    },
  },

  "/admin/f/pl-06-operations": {
    path: "/admin/f/pl-06-operations",
    figmaId: "66:2137",
    title: "Operations & Diagnostics",
    subtitle: "Monitor background daemon workers, system memory telemetry, and job queue retries.",
    breadcrumbs: ["Home", "Platform", "Operations"],
    activeHref: "/admin/f/pl-07-institution-settings",
    platformNav: true,
    archetype: "operations",
    primaryAction: "Force Global Resync",
    secondaryAction: "Download Diagnostic Bundle",
    operations: {
      health: [
        { label: "SIS Import Service", value: "Healthy (99.8%)", ok: true },
        { label: "Database Lock Latency", value: "4.2ms", ok: true },
        { label: "Failed Retries Queue", value: "3 Jobs Outstanding", ok: false },
      ],
      jobs: [
        { id: "#JOB-9902", title: "Canvas SIS Grade Push", meta: "Elapsed/Duration: 1.2s • Completed: 45%", status: "Active", tone: "active" },
        { id: "#JOB-9899", title: "Daily Database Backup", meta: "Elapsed/Duration: 45s • Completed: 100%", status: "Completed", tone: "interview" },
        { id: "#JOB-9892", title: "LTI Enrollment Metadata Re-index", meta: "Elapsed/Duration: 12m • Completed: 74%", status: "Failed", tone: "danger", retry: true },
        { id: "#JOB-9884", title: "Emergency SMS Notification Queue", meta: "Elapsed/Duration: 1.5s • Completed: 99%", status: "Active", tone: "active" },
      ],
      telemetry: {
        note: "* Spike recorded 2m ago during LTI enrollment push. Currently stabilizing.",
        cpu: "24%",
        memory: "5.8GB / 8GB",
      },
    },
  },

  "/admin/f/pl-07-institution-settings": {
    path: "/admin/f/pl-07-institution-settings",
    figmaId: "66:2284",
    title: "Institution Configuration",
    subtitle: "Manage college metadata, upload institution asset branding, and configure timezone parameters.",
    breadcrumbs: ["Home", "Platform", "Institution Settings"],
    activeHref: "/admin/f/pl-07-institution-settings",
    platformNav: true,
    archetype: "settings",
    primaryAction: "Save Settings",
    secondaryAction: "Reset Defaults",
    settingsForm: {
      fields: [
        { label: "College Name", value: "CampusOne" },
        { label: "Primary Support Contact Email", value: "admin@heritage.edu" },
        { label: "Primary Timezone", value: "Pacific Standard Time (PST - America/Los_Angeles)" },
        { label: "Current Academic Term Prefix", value: "Fall 2026 (Semesters)" },
      ],
      uploadHint: "Drag logo assets here or click to select file · SVG, PNG (max 5MB)",
      previewNote: "Logo matched. Current render size 128x32px.",
    },
  },

  "/admin/f/pl-08-notification-templates": {
    path: "/admin/f/pl-08-notification-templates",
    figmaId: "66:2385",
    title: "System Notifications & Templates",
    subtitle: "Draft, edit and publish variables-supported mail, SMS and push system alerts.",
    breadcrumbs: ["Home", "Platform", "Notification Templates"],
    activeHref: "/admin/f/pl-07-institution-settings",
    platformNav: true,
    archetype: "templates",
    primaryAction: "+ Create Template",
    primaryActionHref: "/admin/f/pl-06-operations",
    templates: {
      createHref: "/admin/f/pl-06-operations",
      editHref: "/admin/f/pl-06-operations",
      rows: [
        {
          name: "Emergency Campus Alert",
          channel: "SMS",
          status: "Active",
          edited: "Oct 12, 2026",
          tone: "active",
          preview: {
            to: "all-students@heritage.edu",
            channel: "SMS CHANNEL",
            subject: "EMERGENCY: Campus Alert",
            body: "CampusOne Alert: Immediate campus advisory in effect. Follow official instructions and check CampusOne for updates.",
          },
        },
        {
          name: "Course Enrollment Success",
          channel: "Email",
          status: "Active",
          edited: "Oct 11, 2026",
          tone: "active",
          preview: {
            to: "marcus.student@heritage.edu",
            channel: "EMAIL CHANNEL",
            subject: "Course Enrollment Confirmation: CS 301",
            body: "Dear Marcus, This automated system message confirms that you have successfully enrolled in CS 301: Advanced Data Structures with Professor Eleanor Vance. The course syllabus is now accessible inside your CampusOne dashboard student panel.",
          },
        },
        {
          name: "Quiz Due Reminder (Auto)",
          channel: "Push",
          status: "Active",
          edited: "Oct 10, 2026",
          tone: "active",
          preview: {
            to: "device:push",
            channel: "PUSH CHANNEL",
            subject: "Quiz due tomorrow",
            body: "Reminder: your quiz for {{course_title}} is due tomorrow at 11:59 PM.",
          },
        },
        {
          name: "Academic Grade Published",
          channel: "Email",
          status: "Draft",
          edited: "Sep 28, 2026",
          tone: "new",
          preview: {
            to: "marcus.student@heritage.edu",
            channel: "EMAIL CHANNEL",
            subject: "Grade published: {{course_title}}",
            body: "Hello {{student_name}}, a new grade has been posted for {{course_title}}. Open Academics to review details.",
          },
        },
        {
          name: "Tuition Invoice Past Due",
          channel: "SMS",
          status: "Active",
          edited: "Sep 22, 2026",
          tone: "active",
          preview: {
            to: "marcus.student@heritage.edu",
            channel: "SMS CHANNEL",
            subject: "Tuition past due",
            body: "CampusOne Finance: your tuition balance of {{balance}} is past due. Pay now in CampusOne to avoid registration holds.",
          },
        },
      ],
      preview: {
        to: "marcus.student@heritage.edu",
        channel: "EMAIL CHANNEL",
        subject: "Course Enrollment Confirmation: CS 301",
        body: "Dear Marcus, This automated system message confirms that you have successfully enrolled in CS 301: Advanced Data Structures with Professor Eleanor Vance. The course syllabus is now accessible inside your CampusOne dashboard student panel.",
      },
    },
  },

  "/admin/f/fm-01-form-list": makeQueue({
    path: "/admin/f/fm-01-form-list",
    figmaId: "17:13147",
    title: "Custom Forms & Surveys",
    subtitle: "Publish intake surveys, feedback forms, and waiver templates used across campus portals.",
    breadcrumbs: ["Home", "Builder", "Forms"],
    activeHref: "/admin/f/fm-01-form-list",
    primaryAction: "+ New Form",
    searchPlaceholder: "Search forms…",
    filters: ["Status: All", "Owner: All"],
    countLabel: "3 published form schemas",
    columns: ["Form Name", "Version", "Status", "Submissions", "Action"],
    columnTemplate: "minmax(200px,1.6fr) 90px 100px 110px 90px",
    actionLabel: "Open",
    rows: [
      {
        primary: "Immunization Record Intake",
        cells: ["Immunization Record Intake", "v2.0", "Active", "4,902"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/fm-02-form-designer",
      },
      {
        primary: "Course Feedback Survey",
        cells: ["Course Feedback Survey", "v1.1", "Active", "11,248"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/fm-02-form-designer",
      },
      {
        primary: "Tuition Waiver Request",
        cells: ["Tuition Waiver Request", "v0.4", "Draft", "0"],
        badge: "Draft",
        badgeTone: "new",
        href: "/admin/f/fm-02-form-designer",
      },
    ],
  }),

  "/admin/f/fm-02-form-designer": makeBuilder({
    path: "/admin/f/fm-02-form-designer",
    figmaId: "17:13209",
    title: "Form Designer",
    subtitle: "Compose form fields, validation rules, and publish schemas to campus portals.",
    breadcrumbs: ["Home", "Builder", "Forms", "Designer"],
    activeHref: "/admin/f/fm-01-form-list",
    primaryAction: "Publish Form",
    secondaryAction: "Save Draft",
    builder: {
      paletteTitle: "Field Palette",
      palette: ["Text Input", "Text Area", "Radio", "Checkbox", "File Upload", "Date"],
      canvasTitle: "Student Health Intake Form",
      canvasFields: [
        { label: "Full Legal Name", value: "Text input · required" },
        { label: "Date of Birth", value: "Date · dob_field_v1" },
        { label: "Immunization Type", value: "Radio · COVID / Flu / Other" },
        { label: "Parent / Guardian Consent", value: "Checkbox · required" },
      ],
      inspectorTitle: "Field Inspector",
      inspector: [
        { label: "Field ID", value: "dob_field_v1" },
        { label: "Label", value: "Date of Birth" },
        { label: "Validation", value: "ISO date · required" },
        { label: "Regex", value: "^\\d{4}-\\d{2}-\\d{2}$" },
      ],
    },
  }),

  "/admin/f/fm-03-form-version": {
    path: "/admin/f/fm-03-form-version",
    figmaId: "17:13281",
    title: "Form Schema Audit",
    subtitle: "Review schema diffs before publishing a new form version to production.",
    breadcrumbs: ["Home", "Builder", "Forms", "Version Audit"],
    activeHref: "/admin/f/fm-01-form-list",
    archetype: "versionDiff",
    primaryAction: "Publish v2.0-RC1",
    versionDiff: {
      heading: "Diff: Immunization Record Intake · v1.2 → v2.0",
      changes: [
        {
          tone: "active",
          label: "Added",
          text: "Field immunization_type_covid (Radio) with COVID / Flu / Other options",
        },
        {
          tone: "review",
          label: "Modified",
          text: "parental_consent checkbox marked required; blocks submit when unchecked",
        },
        {
          tone: "danger",
          label: "Removed",
          text: "Legacy free-text vaccine_notes field deprecated from canvas",
        },
      ],
    },
  },

  "/admin/f/rl-01-rule-sets": makeQueue({
    path: "/admin/f/rl-01-rule-sets",
    figmaId: "17:12957",
    title: "Academic Rule Engine",
    subtitle: "Manage rule sets that drive eligibility, honors, and academic standing decisions.",
    breadcrumbs: ["Home", "Builder", "Rules"],
    activeHref: "/admin/f/rl-01-rule-sets",
    primaryAction: "+ New Rule Set",
    searchPlaceholder: "Search rule sets…",
    filters: ["Domain: All", "Status: Active"],
    countLabel: "3 active rule sets",
    columns: ["Rule Set", "Version", "Conditions", "Status", "Action"],
    columnTemplate: "minmax(220px,1.6fr) 90px 110px 100px 90px",
    actionLabel: "Edit",
    rows: [
      {
        primary: "Financial Aid Eligibility",
        cells: ["Financial Aid Eligibility", "v3.2", "6 conditions", "Active"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/rl-02-rule-designer",
      },
      {
        primary: "Latin Honors",
        cells: ["Latin Honors", "v1.5", "3 conditions", "Active"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/rl-02-rule-designer",
      },
      {
        primary: "Academic Warning & Suspension",
        cells: ["Academic Warning & Suspension", "v2.1", "8 conditions", "Active"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/rl-02-rule-designer",
      },
    ],
  }),

  "/admin/f/rl-02-rule-designer": {
    path: "/admin/f/rl-02-rule-designer",
    figmaId: "17:13019",
    title: "Rule Designer",
    subtitle: "Author condition trees and outcome triggers for academic standing automation.",
    breadcrumbs: ["Home", "Builder", "Rules", "Designer"],
    activeHref: "/admin/f/rl-01-rule-sets",
    archetype: "ruleDesigner",
    ruleDesigner: {
      conditions: [
        { field: "student.gpa", op: "<", value: "2.0" },
        { field: "student.cumulative_credits", op: ">=", value: "24" },
      ],
      outcome: "Flag Profile: Academic Probation",
      preview:
        "When GPA is below 2.0 and cumulative credits are at least 24, flag the student profile for Academic Probation.",
    },
  },

  "/admin/f/rl-03-rule-simulator": {
    path: "/admin/f/rl-03-rule-simulator",
    figmaId: "17:13085",
    title: "Rule Evaluator Simulator",
    subtitle: "Dry-run rule sets against a cohort before promoting them to production.",
    breadcrumbs: ["Home", "Builder", "Rules", "Simulator"],
    activeHref: "/admin/f/rl-01-rule-sets",
    archetype: "simulator",
    primaryAction: "Run Simulation",
    simulator: {
      cohort: "CS Sophomores (54 records)",
      results: [
        {
          name: "Marcus Vance",
          gpa: "1.82",
          rules: "Academic Warning & Suspension",
          action: "Probation",
        },
        {
          name: "Sarah Chen",
          gpa: "3.91",
          rules: "Latin Honors",
          action: "Dean's List",
        },
        {
          name: "Devon Lane",
          gpa: "2.45",
          rules: "—",
          action: "No Action",
        },
      ],
    },
  },

  "/admin/f/wf-01-workflow-list": makeQueue({
    path: "/admin/f/wf-01-workflow-list",
    figmaId: "17:12751",
    title: "Automation Workflows",
    subtitle: "Orchestrate multi-step campus automations across admissions, academics, and alerts.",
    breadcrumbs: ["Home", "Builder", "Workflows"],
    activeHref: "/admin/f/wf-01-workflow-list",
    primaryAction: "+ New Workflow",
    searchPlaceholder: "Search workflows…",
    filters: ["Health: All", "Owner: All"],
    countLabel: "4 automation workflows",
    columns: ["Workflow", "Trigger", "Health", "Last Run", "Action"],
    columnTemplate: "minmax(220px,1.6fr) minmax(140px,1.1fr) 100px 120px 90px",
    actionLabel: "Open",
    rows: [
      {
        primary: "Admissions Document Verification",
        cells: ["Admissions Document Verification", "Application submitted", "Healthy", "2h ago"],
        badge: "Healthy",
        badgeTone: "active",
        href: "/admin/f/wf-02-workflow-designer",
      },
      {
        primary: "Academic Probation Notice Sync",
        cells: ["Academic Probation Notice Sync", "Rule fired", "Healthy", "Yesterday"],
        badge: "Healthy",
        badgeTone: "active",
        href: "/admin/f/wf-02-workflow-designer",
      },
      {
        primary: "Emergency Alert Broadcast",
        cells: ["Emergency Alert Broadcast", "Manual / API", "Warning", "6d ago"],
        badge: "Warning",
        badgeTone: "review",
        href: "/admin/f/wf-02-workflow-designer",
      },
      {
        primary: "Financial Aid Disbursal Audit",
        cells: ["Financial Aid Disbursal Audit", "Nightly cron", "Error", "Failed"],
        badge: "Error",
        badgeTone: "danger",
        href: "/admin/f/wf-03-workflow-test",
      },
    ],
  }),

  "/admin/f/wf-02-workflow-designer": makeBuilder({
    path: "/admin/f/wf-02-workflow-designer",
    figmaId: "17:2903",
    title: "Workflow Designer",
    subtitle: "Compose triggers and actions for New Student Onboarding automation.",
    breadcrumbs: ["Home", "Builder", "Workflows", "Designer"],
    activeHref: "/admin/f/wf-01-workflow-list",
    primaryAction: "Publish Workflow",
    secondaryActions: ["Test Run", "Save Draft"],
    builder: {
      paletteTitle: "Triggers & Actions",
      palette: [
        "Trigger: Application Accepted",
        "Action: Create SIS Record",
        "Action: Send Welcome Email",
        "Action: Assign Advisor",
        "Action: Enroll Orientation",
        "Gate: Document Checklist",
      ],
      canvasTitle: "New Student Onboarding",
      canvasFields: [
        { label: "1. Trigger", value: "Application status → Accepted" },
        { label: "2. Create SIS Record", value: "Write student profile + program enrollment" },
        { label: "3. Assign Advisor", value: "Round-robin by program caseload" },
        { label: "4. Send Welcome Email", value: "Template: New Student Welcome" },
        { label: "5. Enroll Orientation", value: "Section ORIENT-FALL-2026" },
      ],
      inspectorTitle: "Step Inspector",
      inspector: [
        { label: "Workflow ID", value: "wf-new-student-onboarding" },
        { label: "Selected Step", value: "Assign Advisor" },
        { label: "Retry Policy", value: "3 attempts · exponential backoff" },
        { label: "Owner", value: "Registrar Automation" },
      ],
    },
  }),

  "/admin/f/wf-03-workflow-test": {
    path: "/admin/f/wf-03-workflow-test",
    figmaId: "17:12828",
    title: "Test Runner: admissions-sync",
    subtitle: "Dry-run the admissions-sync workflow and inspect compiled step output.",
    breadcrumbs: ["Home", "Builder", "Workflows", "Test Runner"],
    activeHref: "/admin/f/wf-01-workflow-list",
    archetype: "testRunner",
    primaryAction: "Run Dry-Test",
    testRunner: {
      logs: [
        "[00:00.012] START admissions-sync dry-run",
        "[00:00.048] LOAD trigger payload application_id=APP-88421",
        "[00:00.112] STEP create_sis_record → OK (student_id=STU-22091)",
        "[00:00.186] STEP assign_advisor → OK (advisor=e.vance)",
        "[00:00.241] STEP send_welcome_email → SKIPPED (dry-run)",
        "[00:00.255] COMPLETE status=success",
      ],
      output: `{
  "workflow": "admissions-sync",
  "mode": "dry-run",
  "student_id": "STU-22091",
  "advisor": "e.vance@heritage.edu",
  "email_queued": false,
  "status": "success"
}`,
    },
  },

  "/admin/f/wf-04-workflow-runs": makeQueue({
    path: "/admin/f/wf-04-workflow-runs",
    figmaId: "17:12879",
    title: "admissions-sync: Run History",
    subtitle: "Inspect historical executions, failures, and log artifacts for admissions-sync.",
    breadcrumbs: ["Home", "Builder", "Workflows", "Run History"],
    activeHref: "/admin/f/wf-01-workflow-list",
    searchPlaceholder: "Search run IDs…",
    filters: ["Status: All", "Range: 30 days"],
    countLabel: "4 recent runs",
    columns: ["Run ID", "Started", "Duration", "Status", "Action"],
    columnTemplate: "minmax(160px,1.3fr) 140px 90px 100px 90px",
    actionLabel: "View log",
    rows: [
      {
        primary: "run-9043-a8df",
        cells: ["run-9043-a8df", "Oct 24, 10:14 AM", "1.2s", "Success"],
        badge: "Success",
        badgeTone: "active",
        href: "/admin/f/wf-03-workflow-test",
      },
      {
        primary: "run-9042-11c0",
        cells: ["run-9042-11c0", "Oct 24, 09:02 AM", "0.8s", "Success"],
        badge: "Success",
        badgeTone: "active",
        href: "/admin/f/wf-03-workflow-test",
      },
      {
        primary: "run-9038-77be",
        cells: ["run-9038-77be", "Oct 23, 11:41 PM", "4.6s", "Failed"],
        badge: "Failed",
        badgeTone: "danger",
        href: "/admin/f/wf-03-workflow-test",
      },
      {
        primary: "run-9031-0f2a",
        cells: ["run-9031-0f2a", "Oct 23, 06:15 PM", "1.1s", "Success"],
        badge: "Success",
        badgeTone: "active",
        href: "/admin/f/wf-03-workflow-test",
      },
    ],
  }),

  "/admin/f/ai-02-model-registry": makeQueue({
    path: "/admin/f/ai-02-model-registry",
    figmaId: "17:17225",
    title: "Model Registry",
    subtitle: "Manage LLM endpoint configuration, version tiers, and direct capability constraints.",
    breadcrumbs: ["Home", "System", "AI Hub", "Model Registry"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    primaryAction: "+ Register Model",
    searchPlaceholder: "Search models…",
    filters: ["Provider: All", "Status: All"],
    countLabel: "4 registered models",
    columns: ["Model Name", "Provider", "Version", "Status", "Endpoint", "Last Updated", "Action"],
    columnTemplate: "minmax(160px,1.3fr) 110px 110px 100px minmax(140px,1.2fr) 120px 100px",
    actionLabel: "Configure",
    rows: [
      {
        primary: "gpt-4o-standard",
        secondary: "Capabilities: Function Calling · JSON Mode · Vision · Fine-tuned",
        cells: ["gpt-4o-standard", "OpenAI", "2024-08-06", "Active", "api.openai.com/v1", "Today, 08:12 AM"],
        badge: "Active",
        badgeTone: "active",
      },
      {
        primary: "claude-3-5-sonnet",
        cells: ["claude-3-5-sonnet", "Anthropic", "v1.0", "Active", "api.anthropic.com/v1", "Yesterday"],
        badge: "Active",
        badgeTone: "active",
      },
      {
        primary: "llama-3-1-70b-instruct",
        cells: ["llama-3-1-70b-instruct", "CampusOne (Host)", "f1-weights", "Testing", "internal.heritage.edu/inference", "Oct 14, 2024"],
        badge: "Testing",
        badgeTone: "review",
      },
      {
        primary: "gpt-3-5-turbo-legacy",
        cells: ["gpt-3-5-turbo-legacy", "OpenAI", "0125-deprecated", "Deprecated", "api.openai.com/v1", "Sep 20, 2024"],
        badge: "Deprecated",
        badgeTone: "danger",
      },
    ],
  }),

  "/admin/f/ai-03-prompt-registry": makeQueue({
    path: "/admin/f/ai-03-prompt-registry",
    figmaId: "17:17388",
    title: "Prompt Registry",
    subtitle: "Manage system instructions, version controls, and playground validation loops.",
    breadcrumbs: ["Home", "System", "AI Hub", "Prompt Registry"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    primaryAction: "+ Create Prompt",
    searchPlaceholder: "Search prompts…",
    filters: ["Category: All", "Status: All"],
    countLabel: "3 prompt versions",
    columns: ["Prompt Name", "Target Model", "Category", "Version", "Status", "Last Edited", "Action"],
    columnTemplate: "minmax(160px,1.3fr) minmax(120px,1fr) 100px 100px 100px 110px 100px",
    actionLabel: "Edit",
    rows: [
      {
        primary: "academic_advisor_v2",
        cells: ["academic_advisor_v2", "gpt-4o-standard", "Academic", "v2.4.1", "Active", "Oct 22, 2024"],
        badge: "Active",
        badgeTone: "active",
      },
      {
        primary: "grade_validator_test",
        cells: ["grade_validator_test", "llama-3-1-70b", "Admin", "v0.9.5-rc", "Testing", "Oct 12, 2024"],
        badge: "Testing",
        badgeTone: "review",
      },
      {
        primary: "syllabus_extraction_v1",
        cells: ["syllabus_extraction_v1", "gpt-3-5-turbo", "Academic", "v1.0.0", "Deprecated", "Sep 15, 2024"],
        badge: "Deprecated",
        badgeTone: "danger",
      },
    ],
  }),

  "/admin/f/ai-04-tool-registry": makeQueue({
    path: "/admin/f/ai-04-tool-registry",
    figmaId: "17:17552",
    title: "Tool Registry",
    subtitle: "Register function-calling tools, external schemas, and microservice plugins.",
    breadcrumbs: ["Home", "System", "AI Hub", "Tool Registry"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    primaryAction: "+ Register Tool",
    searchPlaceholder: "Search tools…",
    filters: ["Type: All", "Status: All"],
    countLabel: "3 registered tools",
    columns: ["Tool Name", "Type", "Permission Scope", "Call Count (7d)", "Status", "Action"],
    columnTemplate: "minmax(180px,1.4fr) minmax(140px,1.1fr) minmax(140px,1.1fr) 120px 100px 110px",
    actionLabel: "Toggle",
    rows: [
      {
        primary: "fetchStudentSchedules",
        cells: ["fetchStudentSchedules", "Function (Database)", "read:schedules", "148,205 calls", "Enabled"],
        badge: "Enabled",
        badgeTone: "active",
      },
      {
        primary: "mathFormulaCalculator",
        cells: ["mathFormulaCalculator", "Plugin", "none:sandbox", "125,441 calls", "Enabled"],
        badge: "Enabled",
        badgeTone: "active",
      },
      {
        primary: "modifyRecordGrade",
        cells: ["modifyRecordGrade", "Function (Database)", "write:grades-admin", "0 calls", "Disabled"],
        badge: "Disabled",
        badgeTone: "danger",
      },
    ],
  }),

  "/admin/f/ai-05-knowledge-sources": makeQueue({
    path: "/admin/f/ai-05-knowledge-sources",
    figmaId: "17:17707",
    title: "Knowledge Sources",
    subtitle: "Index syllabus files, handbook PDFs, and database resources into vectorized embeddings.",
    breadcrumbs: ["Home", "System", "AI Hub", "Knowledge Sources"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    primaryAction: "+ Add Source",
    searchPlaceholder: "Search sources…",
    filters: ["Type: All", "Status: All"],
    countLabel: "4 knowledge sources",
    columns: ["Source Name", "Type", "Status", "Documents", "Last Sync", "Size", "Action"],
    columnTemplate: "minmax(200px,1.5fr) minmax(130px,1fr) 100px minmax(120px,1fr) 120px 90px 110px",
    actionLabel: "Trigger Sync",
    rows: [
      {
        primary: "Academic_Catalog_2024_Final.pdf",
        cells: ["Academic_Catalog_2024_Final.pdf", "Document (PDF)", "Indexed", "1 doc (320 chunks)", "Today, 09:00 AM", "12.4 MB"],
        badge: "Indexed",
        badgeTone: "active",
      },
      {
        primary: "Fall_2024_Syllabi_Folder",
        cells: ["Fall_2024_Syllabi_Folder", "Folder (Drive)", "Syncing", "48 docs (pending)", "Syncing…", "112.5 MB"],
        badge: "Syncing",
        badgeTone: "review",
      },
      {
        primary: "Course_Catalog_Master_DB",
        cells: ["Course_Catalog_Master_DB", "Database (Postgres)", "Indexed", "420 rows", "Yesterday", "1.8 MB"],
        badge: "Indexed",
        badgeTone: "active",
      },
      {
        primary: "Legacy_Financial_Policy.docx",
        cells: ["Legacy_Financial_Policy.docx", "Document (Word)", "Error", "Failed", "Oct 10, 2024", "420 KB"],
        badge: "Error",
        badgeTone: "danger",
      },
    ],
  }),

  "/admin/f/ai-06-ingestion-jobs": makeQueue({
    path: "/admin/f/ai-06-ingestion-jobs",
    figmaId: "17:17852",
    title: "Ingestion Jobs",
    subtitle: "Track real-time background processing, indexing rates, and sync pipeline status.",
    breadcrumbs: ["Home", "System", "AI Hub", "Ingestion Jobs"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    searchPlaceholder: "Search job IDs…",
    filters: ["Status: All"],
    countLabel: "3 recent jobs",
    columns: ["Job ID", "Source", "Status", "Started", "Duration", "Processed", "Errors", "Action"],
    columnTemplate: "110px minmax(180px,1.4fr) 100px 130px 90px 90px 70px 90px",
    actionLabel: "Expand",
    rows: [
      {
        primary: "ingest_4281a",
        cells: ["ingest_4281a", "Fall_2024_Syllabi_Folder", "Running", "Today, 12:35 PM", "10 mins", "18 / 48", "0"],
        badge: "Running",
        badgeTone: "review",
      },
      {
        primary: "ingest_4279x",
        cells: ["ingest_4279x", "Academic_Catalog_2024_Final.pdf", "Complete", "Today, 08:30 AM", "4 mins", "1 / 1 doc", "0"],
        badge: "Complete",
        badgeTone: "active",
      },
      {
        primary: "ingest_4210b",
        secondary: "Error: Unexpected file format encoding. Expected UTF-8, got Windows-1252.",
        cells: ["ingest_4210b", "Legacy_Financial_Policy.docx", "Failed", "Oct 10, 2024", "12 secs", "0 / 1 doc", "1"],
        badge: "Failed",
        badgeTone: "danger",
      },
    ],
  }),

  "/admin/f/ai-07-retrieval-inspector": {
    path: "/admin/f/ai-07-retrieval-inspector",
    figmaId: "17:18180",
    title: "Retrieval Inspector",
    subtitle: "Workspace D — Test vector embeddings, chunks, and similarity thresholds in real-time.",
    breadcrumbs: ["Home", "System", "AI Hub", "Retrieval Inspector"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    archetype: "retrieval",
    retrieval: {
      model: "Model: GPT-4o + Ada-002",
      query: "What are the prerequisites for Advanced Data Structures CS 301?",
      latency: "84ms",
      matches: [
        { rank: "Match #1", source: "CS-301_Syllabus_2024.pdf", score: "94%", chunkId: "chunk_8122" },
        { rank: "Match #2", source: "Academic_Catalog_Addendum_V2.docx", score: "82%", chunkId: "chunk_4901" },
        { rank: "Match #3", source: "Student_Handbook_Section_4.pdf", score: "71%", chunkId: "chunk_3229" },
      ],
      threshold: "0.70",
      topK: "5 Chunks",
      index: "Student_Handbook_V4_Embeddings",
      dimension: "1536 (OpenAI)",
      vectors: "452,189 Vectors",
    },
  },

  "/admin/f/ai-08-evaluation-dashboard": {
    path: "/admin/f/ai-08-evaluation-dashboard",
    figmaId: "17:18303",
    title: "AI Evaluation Dashboard",
    subtitle: "Dashboard A — System quality benchmarks, test-run history, and validation outcomes.",
    breadcrumbs: ["Home", "System", "AI Hub", "Evaluation"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    archetype: "dashboard",
    kpis: [
      { label: "Response Accuracy", value: "96.4%", hint: "+1.2% this run", tone: "up" },
      { label: "Context Relevance", value: "91.8%", hint: "+0.5% this run", tone: "up" },
      { label: "Faithfulness Score", value: "94.5%", hint: "+2.1% this run", tone: "up" },
      { label: "Latency (Avg)", value: "1.24s", hint: "-0.15s improvement", tone: "up" },
    ],
    evalRuns: [
      {
        id: "EVAL-2849",
        date: "Oct 24, 2024 14:32",
        model: "GPT-4o (production)",
        dataset: "Admissions_QA_v1.2",
        scores: "Acc: 96% | Rel: 91% | Faith: 94%",
      },
      {
        id: "EVAL-2840",
        date: "Oct 22, 2024 09:15",
        model: "GPT-4o (shadow)",
        dataset: "CS_Prereq_Test_Set",
        scores: "Acc: 94% | Rel: 89% | Faith: 91%",
      },
      {
        id: "EVAL-2821",
        date: "Oct 19, 2024 18:40",
        model: "Llama-3-70b-instruct",
        dataset: "Admissions_QA_v1.1",
        scores: "Acc: 89% | Rel: 85% | Faith: 87%",
      },
      {
        id: "EVAL-2798",
        date: "Oct 15, 2024 11:12",
        model: "GPT-3.5-Turbo (legacy)",
        dataset: "General_Campus_FAQ",
        scores: "Acc: 81% | Rel: 78% | Faith: 82%",
      },
    ],
  },

  "/admin/f/ai-09-citation-failures": {
    path: "/admin/f/ai-09-citation-failures",
    figmaId: "17:18428",
    title: "Citation Failure Logs",
    subtitle: "List B — Real-time tracking of hallucinated citations, missing sources, or mismatch issues.",
    breadcrumbs: ["Home", "System", "AI Hub", "Citation Failures"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    archetype: "citation",
    citation: {
      filters: ["Flagged Violations", "All Failures", "Missing Citation", "Hallucination"],
      rows: [
        {
          id: "RESP-4991",
          user: "marcus.v",
          query: "How much is tuition for international students…",
          type: "Hallucination",
          severity: "CRITICAL",
          severityTone: "danger",
          status: "OPEN",
          statusTone: "review",
        },
        {
          id: "RESP-4972",
          user: "eleanor.v",
          query: "Can I adjust class timings after week 2?",
          type: "Wrong Source",
          severity: "Medium",
          severityTone: "review",
          status: "Reviewed",
          statusTone: "active",
        },
        {
          id: "RESP-4940",
          user: "admin_test",
          query: "MFA setups for faculty logins",
          type: "Missing Citation",
          severity: "High",
          severityTone: "danger",
          status: "Resolved",
          statusTone: "active",
        },
      ],
      detail: {
        id: "RESP-4991",
        flag: "FLAGGED FOR HALLUCINATION",
        response:
          "International student tuition for the academic year 2024 is flat-rate $12,500 per semester.",
        groundTruth:
          "Official bursar schedule lists international undergraduate tuition as $14,800 per semester (Fall 2024 catalog §4.2).",
      },
    },
  },

  "/admin/f/ai-10-usage-cost": {
    path: "/admin/f/ai-10-usage-cost",
    figmaId: "17:18538",
    title: "Usage & Cost Analytics",
    subtitle: "Dashboard A — Real-time tracking of token spends, projected cost structures, and model distribution.",
    breadcrumbs: ["Home", "System", "AI Hub", "Usage & Cost"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    archetype: "usageCost",
    kpis: [
      { label: "Today's Cost", value: "$42.18", hint: "1.4M total tokens consumed today" },
      { label: "Month-to-Date Cost", value: "$1,284.50", hint: "Current budget threshold: 64% used" },
      { label: "Projected Monthly Spend", value: "$1,620.00", hint: "Est. savings: -$140 vs budget threshold" },
    ],
    usageCost: {
      cycle: "Billing Cycle: Oct 2024",
      models: [
        { model: "GPT-4o", calls: "142,502", tokensIn: "41.2M", tokensOut: "24.6M", cost: "$920.40" },
        { model: "GPT-3.5-Turbo", calls: "210,482", tokensIn: "112.5M", tokensOut: "48.1M", cost: "$240.10" },
        { model: "Ada-002 Embeddings", calls: "98,122", tokensIn: "24.0M", tokensOut: "0.0M", cost: "$4.24" },
      ],
      trend: [
        { label: "15", height: "42%" },
        { label: "16", height: "48%" },
        { label: "17", height: "55%" },
        { label: "18", height: "50%" },
        { label: "19", height: "62%" },
        { label: "20", height: "70%" },
        { label: "21", height: "68%" },
        { label: "22", height: "78%" },
        { label: "23", height: "86%" },
        { label: "24", height: "100%" },
      ],
    },
  },

  "/admin/f/pr-01-practicum-dashboard": {
    path: "/admin/f/pr-01-practicum-dashboard",
    figmaId: "17:11726",
    title: "Practicum & Placement Hub",
    subtitle: "Coordinate employer sites, student placements, agreements, and clinical evaluations.",
    breadcrumbs: ["Home", "Academics", "Practicum"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    archetype: "dashboard",
    primaryAction: "Start Matching Session",
    kpis: [
      { label: "Placements Active", value: "112", hint: "Across clinical partners", tone: "up" },
      { label: "Unplaced", value: "8", hint: "Awaiting site match", tone: "danger" },
      { label: "Expiring Agreements", value: "3", hint: "Renew within 30 days", tone: "danger" },
      { label: "Evaluations Pending", value: "15", hint: "Preceptor reviews due", tone: "muted" },
    ],
    riskFeedTitle: "Pending Hours Certifications",
    caseloadTitle: "Site Capacity Snapshot",
    riskFeed: [
      {
        name: "Marcus Vance",
        detail: "Valley Health · 36 Hours awaiting certification",
        badge: "Pending",
        badgeTone: "review",
      },
      {
        name: "Emma Wilson",
        detail: "Cascade Pediatrics · Midpoint hours review",
        badge: "Due",
        badgeTone: "new",
      },
      {
        name: "David Brent",
        detail: "Metro Tech · Final hours package incomplete",
        badge: "Action",
        badgeTone: "danger",
      },
    ],
    caseload: [
      { name: "Valley Health", cases: "28 active placements", pct: 90 },
      { name: "Metro Tech", cases: "18 active placements", pct: 62 },
      { name: "Cascade Pediatrics", cases: "12 active placements", pct: 48 },
      { name: "Highland Biotech", cases: "9 active placements", pct: 36 },
    ],
  },

  "/admin/f/pr-02-employers-registry": {
    path: "/admin/f/pr-02-employers-registry",
    figmaId: "17:11883",
    title: "Practicum Partners",
    subtitle: "Employer registry for clinical and industry placement partners.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Partners"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    archetype: "partnerDetail",
    primaryAction: "Add Partner",
    secondaryAction: "Export Registry",
    partnerDetail: {
      partners: [
        { name: "Valley Health", meta: "Hospital network · Primary", active: true },
        { name: "Metro Tech", meta: "Technology · Active", active: false },
        { name: "Cascade Pediatrics", meta: "Clinic · Active", active: false },
        { name: "Highland Biotech", meta: "Lab partner · Active", active: false },
      ],
      selected: {
        name: "Valley Health Hospital",
        meta: "Primary Partner · MOU active through Jun 2027",
        fields: [
          { label: "Partner Type", value: "Hospital Network" },
          { label: "Liaison", value: "Dr. Priya Shah" },
          { label: "Capacity", value: "32 concurrent students" },
          { label: "Agreement Status", value: "Active · renews Jun 2027" },
        ],
        locations: [
          "Valley Health Main Campus — Downtown",
          "Valley Health East Wing — Clinical Skills",
          "Valley Health Community Clinic — Northside",
        ],
      },
    },
  },

  "/admin/f/pr-03-sites": makeQueue({
    path: "/admin/f/pr-03-sites",
    figmaId: "65:3354",
    title: "Practicum Sites Directory",
    subtitle: "Approved clinical and industry sites with agreement status.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Sites"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    primaryAction: "Add New Site",
    secondaryAction: "Export",
    searchPlaceholder: "Search sites…",
    countLabel: "24 sites",
    filters: ["Agreement Status", "Partner", "Capacity"],
    columns: ["Site", "Partner", "Agreement Status", "Capacity", "Next Review", "Action"],
    columnTemplate: "minmax(180px,1.4fr) minmax(120px,1fr) 130px 90px 120px 90px",
    rows: [
      {
        primary: "City General Hospital",
        cells: ["City General Hospital", "Valley Health", "Active", "12", "Jan 2027"],
        badge: "Active",
        badgeTone: "active",
      },
      {
        primary: "Metro Tech Innovation Lab",
        cells: ["Metro Tech Innovation Lab", "Metro Tech", "Active", "8", "Mar 2027"],
        badge: "Active",
        badgeTone: "active",
      },
      {
        primary: "Cascade Pediatrics Clinic",
        cells: ["Cascade Pediatrics Clinic", "Cascade Pediatrics", "Expiring", "6", "Nov 2026"],
        badge: "Expiring",
        badgeTone: "review",
      },
      {
        primary: "Highland Biotech R&D Floor",
        cells: ["Highland Biotech R&D Floor", "Highland Biotech", "Pending", "4", "Dec 2026"],
        badge: "Pending",
        badgeTone: "new",
      },
    ],
  }),

  "/admin/f/pr-04-opportunities": makeQueue({
    path: "/admin/f/pr-04-opportunities",
    figmaId: "65:3508",
    title: "Placement Opportunities",
    subtitle: "Open, full, and closed practicum openings by site and term.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Opportunities"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    primaryAction: "Create Opportunity",
    searchPlaceholder: "Search opportunities…",
    countLabel: "18 opportunities",
    filters: ["Status", "Term", "Site"],
    columns: ["Opportunity", "Site", "Term", "Seats", "Status", "Action"],
    columnTemplate: "minmax(180px,1.4fr) minmax(140px,1fr) 110px 80px 110px 90px",
    rows: [
      {
        primary: "Med-Surg Clinical Rotation",
        cells: ["Med-Surg Clinical Rotation", "City General Hospital", "Fall 2026", "4/8", "Open"],
        badge: "Open",
        badgeTone: "active",
      },
      {
        primary: "Pediatric Outpatient Practicum",
        cells: ["Pediatric Outpatient Practicum", "Cascade Pediatrics", "Fall 2026", "6/6", "Full"],
        badge: "Full",
        badgeTone: "review",
      },
      {
        primary: "Biotech Lab Immersion",
        cells: ["Biotech Lab Immersion", "Highland Biotech", "Spring 2027", "0/4", "Closed"],
        badge: "Closed",
        badgeTone: "decision",
      },
      {
        primary: "IT Systems Support Placement",
        cells: ["IT Systems Support Placement", "Metro Tech", "Fall 2026", "2/5", "Open"],
        badge: "Open",
        badgeTone: "active",
      },
    ],
  }),

  "/admin/f/pr-05-placements-workspace": {
    path: "/admin/f/pr-05-placements-workspace",
    figmaId: "17:12002",
    title: "Practicum Placement Workspace",
    subtitle: "Match unplaced students to Fall 2026 opportunities.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Placement Workspace"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    archetype: "workspace",
    primaryAction: "Confirm Placement",
    secondaryAction: "Request Site Hold",
    rows: [
      {
        primary: "Emma Wilson",
        secondary: "BBA · Unplaced · Matching Fall 2026",
        cells: ["Emma Wilson"],
        badge: "Unplaced",
        badgeTone: "review",
      },
      {
        primary: "David Brent",
        secondary: "Nursing · Unplaced · Matching Fall 2026",
        cells: ["David Brent"],
        badge: "Unplaced",
        badgeTone: "danger",
      },
      {
        primary: "Marcus Vance",
        secondary: "CS · Unplaced · Matching Fall 2026",
        cells: ["Marcus Vance"],
        badge: "Unplaced",
        badgeTone: "new",
      },
    ],
  },

  "/admin/f/pr-06-agreements": makeQueue({
    path: "/admin/f/pr-06-agreements",
    figmaId: "65:3725",
    title: "Practicum Agreements Management",
    subtitle: "MOUs and affiliation agreements with employer partners.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Agreements"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    primaryAction: "New Agreement",
    searchPlaceholder: "Search agreements…",
    countLabel: "31 agreements",
    filters: ["Status", "Partner", "Expiry"],
    columns: ["Agreement ID", "Partner", "Status", "Effective", "Expires", "Action"],
    columnTemplate: "130px minmax(140px,1.2fr) 120px 110px 110px 90px",
    infoBanner: {
      title: "3 agreements expiring within 45 days",
      body: "Renew affiliation paperwork before clinical seats are released for Spring 2027.",
      cta: "Review Expiring",
    },
    rows: [
      {
        primary: "AGR-2024-009",
        cells: ["AGR-2024-009", "Valley Health", "Active", "Jul 2024", "Jun 2027"],
        badge: "Active",
        badgeTone: "active",
      },
      {
        primary: "AGR-2025-014",
        cells: ["AGR-2025-014", "Cascade Pediatrics", "Expiring", "Jan 2025", "Nov 2026"],
        badge: "Expiring",
        badgeTone: "review",
      },
      {
        primary: "AGR-2023-021",
        cells: ["AGR-2023-021", "Metro Tech", "Active", "Sep 2023", "Aug 2026"],
        badge: "Active",
        badgeTone: "active",
      },
      {
        primary: "AGR-2026-003",
        cells: ["AGR-2026-003", "Highland Biotech", "Draft", "Pending", "—"],
        badge: "Draft",
        badgeTone: "new",
      },
    ],
  }),

  "/admin/f/pr-07-logs": makeQueue({
    path: "/admin/f/pr-07-logs",
    figmaId: "65:3846",
    title: "Student Practicum Activity Logs",
    subtitle: "Hours submissions awaiting faculty or preceptor approval.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Activity Logs"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    searchPlaceholder: "Search activity logs…",
    countLabel: "42 log entries",
    filters: ["Status", "Student", "Site"],
    columns: ["Student", "Site", "Hours", "Submitted", "Status", "Action"],
    columnTemplate: "minmax(140px,1.1fr) minmax(140px,1.1fr) 80px 120px 120px 90px",
    rows: [
      {
        primary: "Sarah Chen",
        cells: ["Sarah Chen", "City General Hospital", "8.0", "Oct 24, 2026", "Approved"],
        badge: "Approved",
        badgeTone: "active",
      },
      {
        primary: "Marcus Vance",
        cells: ["Marcus Vance", "Valley Health", "6.5", "Oct 23, 2026", "Pending"],
        badge: "Pending",
        badgeTone: "review",
      },
      {
        primary: "Emma Wilson",
        cells: ["Emma Wilson", "Cascade Pediatrics", "4.0", "Oct 22, 2026", "Returned"],
        badge: "Returned",
        badgeTone: "danger",
      },
      {
        primary: "David Brent",
        cells: ["David Brent", "Metro Tech", "7.5", "Oct 21, 2026", "Approved"],
        badge: "Approved",
        badgeTone: "active",
      },
    ],
  }),

  "/admin/f/pr-08-evaluations": makeQueue({
    path: "/admin/f/pr-08-evaluations",
    figmaId: "65:4101",
    title: "Practicum Evaluations",
    subtitle: "Midpoint and final evaluations from preceptors and faculty.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Evaluations"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    searchPlaceholder: "Search evaluations…",
    countLabel: "15 pending evaluations",
    filters: ["Status", "Rating", "Term"],
    columns: ["Student", "Preceptor", "Rating", "Type", "Status", "Action"],
    columnTemplate: "minmax(140px,1.1fr) minmax(140px,1.1fr) 90px 110px 120px 90px",
    rows: [
      {
        primary: "Marcus Aurelius",
        cells: ["Marcus Aurelius", "Dr. Priya Shah", "4.6 / 5", "Midpoint", "Submitted"],
        badge: "Submitted",
        badgeTone: "active",
      },
      {
        primary: "Chloe Sterling",
        cells: ["Chloe Sterling", "Nurse Lee", "—", "Final", "Pending"],
        badge: "Pending",
        badgeTone: "review",
      },
      {
        primary: "Devon Lane",
        cells: ["Devon Lane", "Eng. Marta Ruiz", "3.9 / 5", "Midpoint", "In Review"],
        badge: "In Review",
        badgeTone: "new",
      },
      {
        primary: "Jane Cooper",
        cells: ["Jane Cooper", "Dr. Hill", "4.8 / 5", "Final", "Complete"],
        badge: "Complete",
        badgeTone: "active",
      },
    ],
  }),

  "/admin/f/pr-09-incidents": {
    path: "/admin/f/pr-09-incidents",
    figmaId: "65:4279",
    title: "Practicum Incident Logs",
    subtitle: "Safety and compliance incidents at clinical sites.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Incidents"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    archetype: "case",
    caseDetail: {
      type: "Incident · INC-2026-081",
      title: "Needlestick — Marcus Vance",
      status: "INVESTIGATING",
      owner: "Clinical Compliance",
      body: "Needlestick exposure reported at Valley Health East Wing during supervised clinical. Exposure protocol initiated; student cleared by employee health pending lab follow-up. Site liaison notified; faculty incident packet attached.",
      outcome: "Resolved — Protocol Complete",
      tabs: ["Details", "Actions", "Documents", "Timeline"],
    },
  },

  "/admin/f/pr-10-employer-portal": {
    path: "/admin/f/pr-10-employer-portal",
    figmaId: "65:4416",
    title: "Clinical Partner Dashboard",
    subtitle:
      "Overview of placements, pending administrative evaluations, and site status for Mercy Health Group.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Partner Portal"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    archetype: "employerPortal",
    primaryAction: "Contact Coordinator",
    kpis: [
      {
        label: "Active Placement Students",
        value: "8 Students",
        hint: "Across 3 distinct medical programs",
        tone: "muted",
      },
      {
        label: "Pending Evaluations",
        value: "3 Due Now",
        hint: "2 midterm forms, 1 final form pending",
        tone: "highlight",
      },
      {
        label: "Next Placement Start",
        value: "Oct 21, 2026",
        hint: "4 students incoming next week",
        tone: "muted",
      },
    ],
    employerPortal: {
      placementsTitle: "Current Placements",
      placementsLink: "View All 8",
      placements: [
        {
          name: "John Davis",
          meta: "Computer Science - BS · Tech Park Campus",
          dates: "Sep 01 - Dec 15",
        },
        {
          name: "Emily Clarkson",
          meta: "Nursing - AAS · West Clinical Wing",
          dates: "Sep 15 - Nov 30",
        },
        {
          name: "Robert Miller",
          meta: "Cybersecurity - Cert · Main Lab Center",
          dates: "Oct 01 - Dec 01",
        },
      ],
      appraisalsTitle: "Pending Appraisals",
      appraisals: [
        { name: "Lisa Wong", due: "Due Oct 24", action: "Complete Evaluation" },
        { name: "Marcus Aurelius", due: "Due Oct 28", action: "Complete Evaluation" },
      ],
      quickLinksTitle: "Portal Quick Links",
      quickLinks: [
        { label: "Update Site Availability", icon: "calendar" },
        { label: "Clinical Placement Guidelines", icon: "file" },
        { label: "Coordinator Contacts", icon: "user" },
      ],
    },
  },

  "/admin/f/rg-00-registrar-dashboard": {
    path: "/admin/f/rg-00-registrar-dashboard",
    figmaId: "168:2826",
    title: "Registrar Dashboard",
    subtitle: "Manage graduation processing, transcripts, course registrations, and enrollment status.",
    breadcrumbs: ["Home", "Registrar", "Dashboard"],
    activeHref: "/admin/f/rg-00-registrar-dashboard",
    archetype: "dashboard",
    searchPlaceholder: "Quick student search (Search by Name, Student ID, or SSN equivalent)...",
    kpis: [
      { label: "Active Students", value: "2,450", hint: "Currently enrolled", tone: "up" },
      { label: "Pending Transfers", value: "156", hint: "Transcripts awaiting evaluation", tone: "up" },
      { label: "Graduation Candidates", value: "89", hint: "Fall 2026 Audit cycle", tone: "up" },
      { label: "Corrections Queue", value: "12", hint: "Requires registrar review", tone: "danger" },
    ],
    registrarDash: {
      searchEnterLabel: "Enter",
      auditsTitle: "Recent Registration Audits",
      audits: [
        {
          text: "Sarah Mitchell graduation audit cleared by Advisor Adams",
          when: "10 mins ago",
        },
        {
          text: "Marcus Vance program transfer request approved: Computer Science (AS)",
          when: "2 hours ago",
        },
        {
          text: "Liam O'Connor enrollment status updated to: Leave of Absence",
          when: "1 day ago",
        },
      ],
      clearanceTitle: "Graduation Clearance List",
      clearance: [
        {
          name: "John Connor",
          detail: "AS in Computer Science • GPA: 3.84",
          badge: "Cleared",
          badgeTone: "active",
        },
        {
          name: "Beverly Crusher",
          detail: "BS in Biological Sciences • GPA: 3.92",
          badge: "Audit Pending",
          badgeTone: "review",
        },
        {
          name: "Wesley Crusher",
          detail: "BBA in Business • GPA: 3.75",
          badge: "Cleared",
          badgeTone: "active",
        },
      ],
    },
  },

  "/admin/f/rg-01-student-360": {
    path: "/admin/f/rg-01-student-360",
    figmaId: "17:1049",
    title: "Student 360",
    subtitle: "Registrar student record overview.",
    breadcrumbs: ["Home", "Registrar", "Student 360"],
    activeHref: "/admin/f/rg-01-student-360",
    archetype: "profile360",
    profile360: {
      name: "Marcus Chen",
      meta: "STU-24031 · Bachelor of Business Administration",
      badge: "ACTIVE",
      actions: ["Send Message", "Add Note"],
      tabs: [
        "Overview",
        "Academics",
        "Attendance",
        "Finance",
        "Success",
        "Practicum",
        "Credentials",
        "Documents",
        "Cases",
        "Timeline",
      ],
      stats: [
        { label: "Cumulative GPA", value: "3.42", hint: "Top 15% of Cohort" },
        { label: "Earned Credits", value: "68 / 120", hint: "Junior Standing" },
        { label: "Academic Standing", value: "Good", hint: "No current alerts" },
        { label: "Outstanding Balance", value: "$2,450.00", hint: "Due Nov 30" },
      ],
      courses: {
        title: "Current Courses (Fall 2026)",
        columns: ["Course", "Midterm Grade", "Attendance", "Status"],
        rows: [
          {
            course: "ACC201 Intermediate Accounting",
            midterm: "B+ (85%)",
            attendance: "94.2%",
            status: "On Track",
            statusTone: "active",
          },
          {
            course: "CS302 Database Systems",
            midterm: "A (94%)",
            attendance: "100.0%",
            status: "Excellent",
            statusTone: "active",
          },
          {
            course: "MATH215 Linear Algebra",
            midterm: "C (75%)",
            attendance: "88.5%",
            status: "Attention Required",
            statusTone: "review",
          },
        ],
      },
      timeline: [
        { title: "Fall 2026 Enrollment Confirmed", date: "Aug 20, 2026" },
        { title: "Intermediate Accounting Added", date: "Aug 15, 2026" },
        { title: "MFA Authentication Enabled", date: "Jun 02, 2026" },
        { title: "Student Profile Created", date: "May 14, 2026" },
      ],
      interactions: [
        {
          title: "Academic Advising Session Completed",
          date: "Oct 15, 2026",
          authorizedBy: "Dr. Arthur Pendelton",
        },
        {
          title: "Course Withdrawal Requested (CS 204)",
          date: "Sep 28, 2026",
          authorizedBy: "Eleanor Vance",
        },
      ],
    },
  },

  "/admin/f/rg-02-academic-history": {
    path: "/admin/f/rg-02-academic-history",
    figmaId: "17:15028",
    title: "Academic History Record",
    subtitle: "Term-by-term course and grade history.",
    breadcrumbs: ["Home", "Registrar", "Academic History"],
    activeHref: "/admin/f/rg-00-registrar-dashboard",
    archetype: "registrarRecord",
    primaryAction: "Verify Enrollment",
    secondaryAction: "Audit Requirements",
    registrarRecord: {
      ...REGISTRAR_VANCE_RECORD,
      activeTab: "Academic History",
      eyebrow: "Registrar Records",
      pageTitle: "Academic History Record",
      history: {
        terms: [
          {
            label: "Spring 2024",
            badge: "CURRENT",
            gpa: "3.90",
            credits: "15 credits",
            courses: [
              { code: "CS301", grade: "A" },
              { code: "CS302", grade: "A-" },
              { code: "MATH215", grade: "B+" },
            ],
          },
          {
            label: "Fall 2023",
            gpa: "3.78",
            credits: "14 credits",
            courses: [
              { code: "CS101", grade: "A" },
              { code: "ENG101", grade: "A-" },
            ],
          },
        ],
        cumulative: [
          { label: "Cumulative GPA", value: "3.84" },
          { label: "Credits Earned", value: "45 / 60" },
          { label: "Program Progress", value: "75%" },
        ],
        aiNote:
          "Student is on track for Cum Laude distinction (requires 3.75+). Maintain current performance through remaining core requirements.",
      },
    },
  },

  "/admin/f/rg-03-status-history": {
    path: "/admin/f/rg-03-status-history",
    figmaId: "17:15181",
    title: "Status Change History",
    subtitle: "Enrollment and academic status change log.",
    breadcrumbs: ["Home", "Registrar", "Status History"],
    activeHref: "/admin/f/rg-00-registrar-dashboard",
    archetype: "registrarRecord",
    primaryAction: "Change Student Status",
    registrarRecord: {
      ...REGISTRAR_VANCE_RECORD,
      activeTab: "Status History",
      eyebrow: "Administrative Log",
      pageTitle: "Status Change History",
      statusTimeline: [
        {
          status: "ACTIVE GOOD STANDING",
          detail: "Status restored to Active Good Standing",
          date: "Jan 08, 2024",
          actor: "Sarah Jenkins",
          tone: "active",
        },
        {
          status: "PROBATION",
          detail: "Academic probation placed after term review",
          date: "Oct 15, 2023",
          actor: "Registrar Ops",
          tone: "review",
        },
        {
          status: "NEW INTAKE",
          detail: "Student record created and matriculated",
          date: "Aug 24, 2023",
          actor: "Admissions",
          tone: "new",
        },
      ],
    },
  },

  "/admin/f/rg-04-transfer-credits": {
    path: "/admin/f/rg-04-transfer-credits",
    figmaId: "17:15305",
    title: "Transfer Credit Evaluations",
    subtitle: "External transcript evaluation and equivalency posting.",
    breadcrumbs: ["Home", "Registrar", "Transfer Credits"],
    activeHref: "/admin/f/rg-00-registrar-dashboard",
    archetype: "registrarRecord",
    primaryAction: "+ Add Transfer Course",
    registrarRecord: {
      ...REGISTRAR_VANCE_RECORD,
      activeTab: "Transfer Credits",
      eyebrow: "External Transcript Eval",
      pageTitle: "Transfer Credit Evaluations",
      transfer: {
        institution: "Pacific State University",
        accreditation: "WASC",
        rows: [
          { external: "COMP151", equivalent: "CS101", status: "APPROVED", tone: "active" },
          { external: "MATH180", equivalent: "MATH150", status: "APPROVED", tone: "active" },
          { external: "PHYS100", equivalent: "PHYS101", status: "DENIED", tone: "danger" },
        ],
      },
    },
  },

  "/admin/f/rg-05-academic-standing": {
    path: "/admin/f/rg-05-academic-standing",
    figmaId: "17:15432",
    title: "Academic Standing Records",
    subtitle: "Standing calculations and compliance letters.",
    breadcrumbs: ["Home", "Registrar", "Academic Standing"],
    activeHref: "/admin/f/rg-00-registrar-dashboard",
    archetype: "registrarRecord",
    primaryAction: "Issue Standing Letter",
    registrarRecord: {
      ...REGISTRAR_VANCE_RECORD,
      activeTab: "Academic Standing",
      eyebrow: "Academic Compliance",
      pageTitle: "Academic Standing Records",
      standing: {
        current: { label: "Good Standing", effective: "Jan 08, 2024" },
        audits: [
          {
            term: "Spring 2024",
            standing: "Good Standing",
            gpa: "3.90",
            notes: "Restored after successful term",
          },
          {
            term: "Fall 2023",
            standing: "Probation",
            gpa: "1.95",
            notes: "Below 2.0 cumulative threshold",
          },
        ],
        policies: [
          "Students must maintain a minimum 2.0 cumulative GPA to remain in good standing.",
          "Two consecutive terms below 2.0 may result in academic dismissal review.",
          "Standing letters are issued within 5 business days of term grade posting.",
        ],
      },
    },
  },

  "/admin/f/rg-06-completion-audit": {
    path: "/admin/f/rg-06-completion-audit",
    figmaId: "17:15554",
    title: "Program Completion Audit",
    subtitle: "Degree pathway checklist for graduation candidacy.",
    breadcrumbs: ["Home", "Registrar", "Completion Audit"],
    activeHref: "/admin/f/rg-00-registrar-dashboard",
    archetype: "registrarRecord",
    primaryAction: "Generate Audit Report",
    registrarRecord: {
      ...REGISTRAR_VANCE_RECORD,
      activeTab: "Completion Audit",
      eyebrow: "Degree Pathways",
      pageTitle: "Program Completion Audit",
      audit: {
        sections: [
          {
            title: "CS Core",
            progress: "12 / 16",
            courses: [
              { code: "CS101", title: "Intro to Computing", status: "Complete", tone: "active" },
              { code: "CS301", title: "Data Structures", status: "Complete", tone: "active" },
              { code: "CS302", title: "Database Systems", status: "Complete", tone: "active" },
              { code: "CS401", title: "Software Engineering", status: "Remaining", tone: "review" },
            ],
          },
          {
            title: "Math Requirements",
            progress: "Complete",
            complete: true,
            courses: [
              { code: "MATH150", title: "College Algebra", status: "Complete", tone: "active" },
              { code: "MATH215", title: "Linear Algebra", status: "Complete", tone: "active" },
            ],
          },
        ],
        overview: [
          { label: "Overall Complete", value: "75%" },
          { label: "Required Credits", value: "60" },
          { label: "Earned Credits", value: "45" },
          { label: "Remaining", value: "15" },
        ],
      },
    },
  },

  "/admin/f/rg-07-transcript": {
    path: "/admin/f/rg-07-transcript",
    figmaId: "17:15688",
    title: "Official Transcript Generator",
    subtitle: "Preview and release official academic transcript.",
    breadcrumbs: ["Home", "Registrar", "Transcript"],
    activeHref: "/admin/f/rg-00-registrar-dashboard",
    archetype: "registrarRecord",
    primaryAction: "Download PDF",
    secondaryAction: "Send Officially",
    registrarRecord: {
      student: { ...REGISTRAR_VANCE_STUDENT },
      eyebrow: "Academic Records PDF Preview",
      pageTitle: "Official Transcript Generator",
      transcript: {
        school: "CampusOne",
        studentLine: "Marcus Vance · #2024-8902",
        program: "A.S. in Computer Science",
        terms: [
          {
            label: "Spring 2024",
            courses: [
              { code: "CS301", title: "Data Structures", grade: "A", credits: "3.0" },
              { code: "CS302", title: "Database Systems", grade: "A-", credits: "3.0" },
              { code: "MATH215", title: "Linear Algebra", grade: "B+", credits: "3.0" },
            ],
          },
          {
            label: "Fall 2023",
            courses: [
              { code: "CS101", title: "Intro to Computing", grade: "A", credits: "3.0" },
              { code: "ENG101", title: "Composition", grade: "A-", credits: "3.0" },
            ],
          },
        ],
        totals: { credits: "45.0", gpa: "3.84" },
      },
    },
  },

  "/admin/f/rg-08-registrar-correction": {
    path: "/admin/f/rg-08-registrar-correction",
    figmaId: "17:15786",
    title: "Before / After",
    subtitle: "Correct grades, enrollment, and biographic record errors.",
    breadcrumbs: ["Home", "Registrar", "Corrections"],
    activeHref: "/admin/f/rg-00-registrar-dashboard",
    archetype: "correction",
    correction: {
      eyebrow: "Registrar Correction",
      title: "Before / After",
      record: {
        id: "#2024-8902",
        name: "Marcus Vance",
        type: "Course Grade Correction",
      },
      before: { label: "MATH215", value: "B+" },
      after: { label: "MATH215", value: "A-" },
      reasonLabel: "Correction Reason",
      reasonPlaceholder: "Describe the documented reason for this grade correction…",
      authorizer: { name: "Dr. Arthur Pendelton", role: "Department Chair" },
      notice:
        "Applying this correction will write an immutable audit log entry and notify the student of the grade change.",
      applyLabel: "Apply and Log Correction",
    },
  },

  "/admin/f/rg-09-official-export": {
    path: "/admin/f/rg-09-official-export",
    figmaId: "17:15865",
    title: "Official Registrar Export Module",
    subtitle: "Generate official registrar data packages and clearinghouse files.",
    breadcrumbs: ["Home", "Registrar", "Official Export"],
    activeHref: "/admin/f/rg-00-registrar-dashboard",
    archetype: "export",
    primaryAction: "Run Secure Export",
    exportPanel: {
      eyebrow: "Bulk Document Exports",
      configs: [
        { label: "Document Type", value: "Official Student Transcript" },
        { label: "Format", value: "PDF Secure Digital Seal" },
        { label: "Destination", value: "National Student Clearinghouse" },
      ],
      schema: ["student_id", "ssn_hash", "enrollment_status", "program_code", "degree_level", "term"],
      history: [
        { name: "NSC_Fall2026_Week42.xml", date: "Oct 20, 2026", status: "Ready" },
        { name: "NSC_Fall2026_Week41.xml", date: "Oct 13, 2026", status: "Archived" },
      ],
      deliveries: [
        { date: "Oct 24", destination: "NSC", count: "184", status: "DELIVERED" },
        { date: "Oct 23", destination: "State University", count: "1", status: "DELIVERED" },
      ],
      publishNote:
        "Publish Batch File packages the selected cohort and applies the secure digital seal before delivery.",
    },
  },

  "/admin/search": {
    path: "/admin/search",
    figmaId: "178:121",
    title: "Search Results",
    subtitle: '4 results for "Sarah Mitchell"',
    breadcrumbs: ["Home", "System Admin", "Search Results"],
    activeHref: "/admin",
    archetype: "searchResults",
    searchResults: {
      query: "Sarah Mitchell",
      resultCount: "4 results",
      tabs: [
        { label: "All", count: 4 },
        { label: "Students", count: 1 },
        { label: "Applications", count: 1 },
        { label: "Courses", count: 0 },
        { label: "Finance", count: 1 },
        { label: "Documents", count: 1 },
      ],
      results: [
        {
          type: "Student",
          title: "Sarah Mitchell",
          badges: ["Student", "Active"],
          badgeTone: "green",
          fields: [
            { label: "ID", value: "STU-2026-0847" },
            { label: "Program", value: "Bachelor of Nursing (BSN)" },
            { label: "Cohort", value: "Fall 2026" },
          ],
          action: "View Profile",
          actionTone: "ghost",
          href: "/admin/f/rg-01-student-360",
        },
        {
          type: "Application",
          title: "Sarah Mitchell",
          badges: ["Application", "Stage: Interview"],
          badgeTone: "amber",
          fields: [
            { label: "App #", value: "APP-4521" },
            { label: "Program", value: "Bachelor of Nursing" },
            { label: "Submitted", value: "Oct 2, 2025" },
          ],
          action: "Review",
          actionTone: "primary",
          href: "/admin/f/ad-03-application-detail",
        },
        {
          type: "Finance",
          title: "Sarah Mitchell",
          badges: ["Finance"],
          badgeTone: "blue",
          fields: [
            { label: "Account #", value: "FIN-0847" },
            { label: "Outstanding Balance", value: "$2,450", tone: "danger" },
            { label: "Payment Plan", value: "Active", tone: "up" },
          ],
          action: "View Ledger",
          actionTone: "ghost",
          href: "/admin/f/fn-02-student-account",
        },
        {
          type: "Document",
          title: "Immunization Record",
          badges: ["Document", "In Review"],
          badgeTone: "amber",
          fields: [
            { label: "Owner", value: "Sarah Mitchell" },
            { label: "Uploaded", value: "Sep 15, 2025" },
            { label: "Requirement", value: "Health Clearance" },
          ],
          action: "Verify Doc",
          actionTone: "ghost",
          href: "/admin/f/ad-05-document-review",
        },
      ],
    },
  },

  "/admin/f/lb-01-lab-dashboard": {
    path: "/admin/f/lb-01-lab-dashboard",
    figmaId: "168:2186",
    title: "Lab Management",
    subtitle: "Oversee equipment reservations, room capacities, and active simulation hours.",
    breadcrumbs: ["Home", "Academics", "Lab Management"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    archetype: "labDash",
    kpis: [
      { label: "Lab Rooms", value: "12", hint: "4 specialised Sim rooms", tone: "up" },
      { label: "Equipment Items", value: "340", hint: "Tracked lab hardware", tone: "up" },
      { label: "Sessions Scheduled", value: "8 Today", hint: "12 scheduled tomorrow", tone: "up" },
      { label: "Open Incidents", value: "2", hint: "Awaiting safety clearance", tone: "danger" },
    ],
    labDash: {
      roomsTitle: "Room Statuses",
      rooms: [
        {
          name: "Simulation Lab A",
          status: "In Use",
          statusTone: "review",
          capacity: "Capacity Limit: 20 students",
          activity: "Currently: Nursing Clinicals",
          href: "/admin/f/lb-02-lab-rooms",
        },
        {
          name: "Computer Lab B",
          status: "Available",
          statusTone: "active",
          capacity: "Capacity Limit: 30 students",
          activity: "Currently: Open Access",
          href: "/admin/f/lb-02-lab-rooms",
        },
        {
          name: "Microbiology Lab 1",
          status: "Maintenance",
          statusTone: "danger",
          capacity: "Capacity Limit: 18 students",
          activity: "Currently: Autoclave Service",
          href: "/admin/f/lb-02-lab-rooms",
        },
        {
          name: "Chemistry Lab 3",
          status: "Available",
          statusTone: "active",
          capacity: "Capacity Limit: 24 students",
          activity: "Currently: Intro Chem Section",
          href: "/admin/f/lb-02-lab-rooms",
        },
      ],
      alertsTitle: "Active Hardware Status & Alerts",
      alerts: [
        {
          name: "Autoclave Unit #3",
          detail: "Slight calibration drift reported",
          tone: "warn",
          href: "/admin/f/lb-04-equipment-detail",
        },
        {
          name: "Sim-Patient #12",
          detail: "Battery backup failure state",
          tone: "danger",
          href: "/admin/f/lb-10-incident",
        },
      ],
    },
  },

  "/admin/f/lb-02-lab-rooms": {
    path: "/admin/f/lb-02-lab-rooms",
    figmaId: "65:1833",
    title: "Lab Rooms Directory",
    subtitle: "Manage and schedule chemistry, physics, computer, and biological laboratory resources",
    breadcrumbs: ["Home", "Academics", "Lab Rooms"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    archetype: "labRooms",
    primaryAction: "+ Add Room",
    primaryActionHref: "/admin/f/lb-02-lab-rooms",
    secondaryAction: "Schedule Maintenance",
    secondaryActionHref: "/admin/f/lb-10-incident",
    labRooms: {
      rooms: [
        {
          name: "Chemistry Lab A",
          location: "Science Hall · 2nd Floor",
          seats: "28 seats",
          equipment: "42 equip",
          days: [true, true, true, true, true],
          status: "In Session",
          statusTone: "review",
          nextAvailable: "02:00 PM",
          href: "/admin/f/lb-03-lab-equipment-list",
        },
        {
          name: "Computer Lab B",
          location: "Tech Center · Room 110",
          seats: "30 seats",
          equipment: "36 equip",
          days: [true, true, true, true, false],
          status: "Available",
          statusTone: "active",
          nextAvailable: "Immediate",
          href: "/admin/f/lb-03-lab-equipment-list",
        },
        {
          name: "Microbiology Lab 1",
          location: "Science Hall · Basement",
          seats: "18 seats",
          equipment: "24 equip",
          days: [true, false, true, false, true],
          status: "Maintenance",
          statusTone: "danger",
          nextAvailable: "Tomorrow 09:00 AM",
          href: "/admin/f/lb-10-incident",
        },
        {
          name: "Simulation Lab A",
          location: "Health Sciences · Wing C",
          seats: "20 seats",
          equipment: "58 equip",
          days: [true, true, true, true, true],
          status: "In Session",
          statusTone: "review",
          nextAvailable: "04:30 PM",
          href: "/admin/f/lb-03-lab-equipment-list",
        },
        {
          name: "Physics Lab 2",
          location: "Science Hall · 3rd Floor",
          seats: "24 seats",
          equipment: "31 equip",
          days: [false, true, true, true, true],
          status: "Available",
          statusTone: "active",
          nextAvailable: "Immediate",
          href: "/admin/f/lb-03-lab-equipment-list",
        },
      ],
    },
  },

  "/admin/f/lb-03-lab-equipment-list": makeQueue({
    path: "/admin/f/lb-03-lab-equipment-list",
    figmaId: "17:11504",
    title: "Equipment Registry",
    subtitle: "Deployments, condition ratings, and asset distribution tracking",
    breadcrumbs: ["Home", "Academics", "Lab Equipment"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    primaryAction: "+ Add Asset",
    primaryActionHref: "/admin/f/lb-04-equipment-detail",
    searchPlaceholder: "Filter assets by ID or class...",
    filters: ["Condition: All", "Room: All"],
    countLabel: "340 tracked assets",
    columns: ["Asset ID", "Equipment Name", "Condition", "Room", "Checked out to", "Action"],
    columnTemplate: "110px minmax(180px,1.6fr) 130px minmax(120px,1fr) minmax(140px,1.1fr) 80px",
    rows: [
      {
        primary: "EQ-492",
        secondary: "High-Temperature Muffle Furnace",
        cells: ["EQ-492", "High-Temperature Muffle Furnace", "Perfect", "Science Hall 204", "Dr. Eleanor Vance"],
        badge: "Perfect",
        badgeTone: "active",
        href: "/admin/f/lb-04-equipment-detail",
      },
      {
        primary: "EQ-103",
        secondary: "Digital Centrifuge XC-4",
        cells: ["EQ-103", "Digital Centrifuge XC-4", "Maintenance Req", "Microbiology Lab 1", "Lab Tech Desk"],
        badge: "Maintenance Req",
        badgeTone: "danger",
        href: "/admin/f/lb-04-equipment-detail",
      },
      {
        primary: "EQ-2041",
        secondary: "Agilent 1260 Infinity II HPLC",
        cells: ["EQ-2041", "Agilent 1260 Infinity II HPLC", "Good", "Chemistry Lab A", "Available"],
        badge: "Good",
        badgeTone: "active",
        href: "/admin/f/lb-04-equipment-detail",
      },
      {
        primary: "EQ-771",
        secondary: "Sim-Patient Monitor #12",
        cells: ["EQ-771", "Sim-Patient Monitor #12", "Critical", "Simulation Lab A", "Nursing Clinicals"],
        badge: "Critical",
        badgeTone: "danger",
        href: "/admin/f/lb-04-equipment-detail",
      },
      {
        primary: "EQ-318",
        secondary: "Autoclave Unit #3",
        cells: ["EQ-318", "Autoclave Unit #3", "Calibration Due", "Microbiology Lab 1", "Facilities"],
        badge: "Calibration Due",
        badgeTone: "review",
        href: "/admin/f/lb-04-equipment-detail",
      },
    ],
  }),

  "/admin/f/lb-04-equipment-detail": {
    path: "/admin/f/lb-04-equipment-detail",
    figmaId: "65:2077",
    title: "Equipment Detail",
    subtitle: "Asset profile, calibration status, and booking readiness",
    breadcrumbs: ["Home", "Academics", "Lab Equipment", "EQ-2041"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    archetype: "detail",
    primaryAction: "Book Equipment",
    primaryActionHref: "/admin/f/lb-08-lab-session",
    secondaryAction: "Schedule Calibration",
    secondaryActionHref: "/admin/f/lb-04-equipment-detail",
    secondaryActions: ["Schedule Calibration", "Report Issue"],
    secondaryActionHrefs: {
      "Schedule Calibration": "/admin/f/lb-04-equipment-detail",
      "Report Issue": "/admin/f/lb-10-incident",
    },
    detail: {
      name: "Agilent 1260 Infinity II HPLC System",
      meta: "EQ-2041 · Chemistry Lab A · Bench 3 · Available",
      steps: [
        { label: "Registered", state: "done" },
        { label: "Calibrated", state: "done" },
        { label: "Available", state: "current" },
        { label: "Booked", state: "todo" },
      ],
      tabs: ["Overview", "Maintenance", "Bookings", "Incidents"],
      fields: [
        { label: "Model", value: "Agilent 1260 Infinity II" },
        { label: "Serial", value: "US98274112-X" },
        { label: "Purchase", value: "Sep 14 2022" },
        { label: "Warranty", value: "Active" },
      ],
      checklist: [
        { label: "Annual calibration", status: "Current", tone: "active" },
        { label: "Safety inspection", status: "Passed", tone: "active" },
        { label: "Consumables stocked", status: "Low", tone: "review" },
        { label: "SOP acknowledgment", status: "Required", tone: "new" },
      ],
      aiBlurb: "Asset is booking-ready. Next preventive maintenance window opens in 18 days. Consumable solvent stock is below preferred threshold.",
      reviewer: { name: "Lab Ops Desk", role: "Chemistry Lab A" },
    },
  },

  "/admin/f/lb-05-inventory": makeQueue({
    path: "/admin/f/lb-05-inventory",
    figmaId: "65:2226",
    title: "Lab Inventory Management",
    subtitle: "Track consumables, reorder thresholds, and stock distribution across lab rooms",
    breadcrumbs: ["Home", "Academics", "Lab Inventory"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    primaryAction: "+ Add Item",
    primaryActionHref: "/admin/f/lb-05-inventory",
    secondaryAction: "Place Order",
    secondaryActionHref: "/admin/f/lb-05-inventory",
    secondaryActions: ["Export Inventory", "Place Order"],
    secondaryActionHrefs: {
      "Export Inventory": "/admin/f/lb-05-inventory",
      "Place Order": "/admin/f/lb-05-inventory",
    },
    searchPlaceholder: "Search SKUs, vendors, or rooms...",
    filters: ["Status: All", "Category: All"],
    countLabel: "142 SKUs in catalog",
    columns: ["SKU", "Item", "On Hand", "Threshold", "Room", "Status", "Action"],
    columnTemplate: "100px minmax(160px,1.5fr) 90px 90px minmax(110px,1fr) 120px 80px",
    kpis: [
      { label: "SKUs", value: "142", hint: "Active catalog items", tone: "muted" },
      { label: "Critical Reorders", value: "3", hint: "Needs PO today", tone: "danger" },
      { label: "Low Threshold", value: "11", hint: "Approaching reorder", tone: "muted" },
    ],
    rows: [
      {
        primary: "SKU-8812",
        secondary: "Nitrile Gloves (M)",
        cells: ["SKU-8812", "Nitrile Gloves (M)", "24", "40", "Chem Prep", "Critical"],
        badge: "Critical",
        badgeTone: "danger",
        href: "/admin/f/lb-05-inventory",
      },
      {
        primary: "SKU-4401",
        secondary: "pH Buffer Pack",
        cells: ["SKU-4401", "pH Buffer Pack", "8", "12", "Chemistry Lab A", "Low"],
        badge: "Low",
        badgeTone: "review",
        href: "/admin/f/lb-05-inventory",
      },
      {
        primary: "SKU-2290",
        secondary: "Agar Plates (Case)",
        cells: ["SKU-2290", "Agar Plates (Case)", "56", "20", "Microbiology Lab 1", "In Stock"],
        badge: "In Stock",
        badgeTone: "active",
        href: "/admin/f/lb-05-inventory",
      },
      {
        primary: "SKU-1104",
        secondary: "HPLC Solvent Kit",
        cells: ["SKU-1104", "HPLC Solvent Kit", "3", "6", "Chemistry Lab A", "Critical"],
        badge: "Critical",
        badgeTone: "danger",
        href: "/admin/f/lb-04-equipment-detail",
      },
      {
        primary: "SKU-5520",
        secondary: "Spill Kit Refill",
        cells: ["SKU-5520", "Spill Kit Refill", "14", "10", "Safety Cage", "In Stock"],
        badge: "In Stock",
        badgeTone: "active",
        href: "/admin/f/lb-06-safety-rules",
      },
    ],
  }),

  "/admin/f/lb-06-safety-rules": {
    path: "/admin/f/lb-06-safety-rules",
    figmaId: "65:2389",
    title: "Lab Safety Rules & Protocols",
    subtitle: "Maintain rule categories, training assignments, and student sign-off compliance",
    breadcrumbs: ["Home", "Academics", "Lab Safety"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    archetype: "labSafety",
    primaryAction: "Edit Rules",
    primaryActionHref: "/admin/f/lb-06-safety-rules",
    secondaryAction: "Assign Training",
    secondaryActionHref: "/admin/f/lb-07-student-eligibility",
    secondaryActions: ["Assign Training", "Print Safety Manual"],
    secondaryActionHrefs: {
      "Assign Training": "/admin/f/lb-07-student-eligibility",
      "Print Safety Manual": "/admin/f/lb-06-safety-rules",
    },
    kpis: [
      { label: "Compliance", value: "98%", hint: "Campus-wide rule adherence", tone: "up" },
      { label: "Completion", value: "94%", hint: "Training modules finished", tone: "up" },
      { label: "Overdue Instructor Certs", value: "3", hint: "Requires renewal", tone: "danger" },
    ],
    labSafety: {
      categories: [
        { title: "General Lab Safety", count: "8 rules", badge: "Required", badgeTone: "active" },
        { title: "PPE", count: "5 rules", badge: "Critical", badgeTone: "danger" },
        { title: "Emergency Spill", count: "6 rules", badge: "Critical", badgeTone: "danger" },
        { title: "Electrical", count: "4 rules", badge: "Recommended", badgeTone: "new" },
      ],
      signoffsTitle: "Student Training Sign-offs",
      signoffs: [
        {
          name: "John Davis",
          course: "CHEM 301",
          status: "Signed",
          statusTone: "active",
          completed: "Oct 12, 2026",
        },
        {
          name: "Priya Patel",
          course: "BIO 210",
          status: "Pending",
          statusTone: "review",
          completed: "—",
        },
        {
          name: "Marcus Chen",
          course: "NURS 140",
          status: "Overdue",
          statusTone: "danger",
          completed: "Due Oct 01",
        },
        {
          name: "Ava Morales",
          course: "CHEM 204",
          status: "Signed",
          statusTone: "active",
          completed: "Sep 28, 2026",
        },
      ],
    },
  },

  "/admin/f/lb-07-student-eligibility": makeQueue({
    path: "/admin/f/lb-07-student-eligibility",
    figmaId: "65:2673",
    title: "Student Lab Eligibility",
    subtitle: "Verify safety training status before authorizing lab access",
    breadcrumbs: ["Home", "Academics", "Lab Eligibility"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    primaryAction: "Assign Training",
    primaryActionHref: "/admin/f/lb-06-safety-rules",
    secondaryAction: "Export Roster",
    secondaryActionHref: "/admin/f/lb-07-student-eligibility",
    searchPlaceholder: "Search students by name or ID...",
    filters: ["Status: All", "Course: All"],
    countLabel: "214 student records",
    columns: ["Student", "Program", "Safety Training", "Last Lab", "Status", "Action"],
    columnTemplate: "minmax(160px,1.4fr) minmax(140px,1.1fr) 140px 110px 110px 80px",
    kpis: [
      { label: "Eligible", value: "156", hint: "ACTIVE", tone: "up" },
      { label: "Conditional", value: "31", hint: "REVIEW", tone: "muted" },
      { label: "Ineligible", value: "27", hint: "BLOCKED", tone: "danger" },
    ],
    rows: [
      {
        primary: "John Davis",
        secondary: "STU-2026-1102",
        cells: ["John Davis", "A.S. Chemistry", "Complete", "Oct 10", "Eligible"],
        badge: "Eligible",
        badgeTone: "active",
        href: "/admin/f/lb-06-safety-rules",
      },
      {
        primary: "Priya Patel",
        secondary: "STU-2026-0881",
        cells: ["Priya Patel", "B.S. Biology", "In Progress", "Sep 22", "Conditional"],
        badge: "Conditional",
        badgeTone: "review",
        href: "/admin/f/lb-06-safety-rules",
      },
      {
        primary: "Marcus Chen",
        secondary: "STU-2025-4410",
        cells: ["Marcus Chen", "BSN Nursing", "Expired", "Aug 14", "Ineligible"],
        badge: "Ineligible",
        badgeTone: "danger",
        href: "/admin/f/lb-06-safety-rules",
      },
      {
        primary: "Ava Morales",
        secondary: "STU-2026-0199",
        cells: ["Ava Morales", "A.S. Chemistry", "Complete", "Oct 11", "Eligible"],
        badge: "Eligible",
        badgeTone: "active",
        href: "/admin/f/lb-08-lab-session",
      },
    ],
  }),

  "/admin/f/lb-08-lab-session": {
    path: "/admin/f/lb-08-lab-session",
    figmaId: "17:2790",
    title: "Lab Session 03 · Acid-Base Titration Practice",
    subtitle: "Review objectives, procedure, safety rules, and required equipment before starting",
    breadcrumbs: ["Home", "Academics", "Lab Session"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    archetype: "labSession",
    primaryAction: "Open Notebook",
    primaryActionHref: "/admin/f/lb-09-lab-notebook",
    labSession: {
      objectives: [
        "Determine the concentration of an unknown acid using standardized NaOH",
        "Practice precise burette reading and endpoint recognition",
        "Record titration volumes and calculate molarity with significant figures",
      ],
      procedure: [
        "Rinse and fill the burette with standardized NaOH solution",
        "Pipette 25.00 mL of unknown acid into an Erlenmeyer flask",
        "Add 2–3 drops of phenolphthalein indicator",
        "Titrate to a persistent pale pink endpoint and record volume",
        "Repeat for a total of three concordant trials",
      ],
      safetyRules: [
        "Wear approved safety goggles and lab coat at all times",
        "Neutralize spills immediately using the designated spill kit",
        "Never pipette by mouth; use bulb or pump only",
        "Report broken glassware to the instructor before cleanup",
      ],
      equipment: ["50 mL burette", "25 mL volumetric pipette", "Erlenmeyer flasks (3)", "Phenolphthalein", "NaOH standard"],
      notebookHref: "/admin/f/lb-09-lab-notebook",
      notebookLabel: "My Lab Notebook",
      ackLabel: "I have read and understood the safety rules",
    },
  },

  "/admin/f/lb-09-lab-notebook": {
    path: "/admin/f/lb-09-lab-notebook",
    figmaId: "17:11624",
    title: "Structured Research Entry #402",
    subtitle: "Document hypothesis, method, and observations for the active lab experiment",
    breadcrumbs: ["Home", "Academics", "Lab Notebook"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    archetype: "labNotebook",
    primaryAction: "Sign Off",
    primaryActionHref: "/admin/f/lb-08-lab-session",
    secondaryAction: "Edit Doc",
    secondaryActionHref: "/admin/f/lb-09-lab-notebook",
    labNotebook: {
      course: "CHEM 301",
      group: "Group B",
      experiment: "Recrystallization Rates",
      hypothesis:
        "Recrystallization rate increases with temperature because solute solubility rises and supersaturation resolves more quickly as kinetic energy increases.",
      method: [
        "Prepare identical saturated solutions at 10°C, 15°C, and 20°C",
        "Induce crystallization with a seed crystal at t = 0",
        "Measure mass of recovered crystals at 5-minute intervals for 30 minutes",
        "Compute average rate (g/min) for each temperature condition",
      ],
      observations: [
        { temp: "10°C", rate: "0.12 g/min", notes: "Slow nucleation; cloudy supernatant" },
        { temp: "15°C", rate: "0.21 g/min", notes: "Steady crystal growth" },
        { temp: "20°C", rate: "0.34 g/min", notes: "Fast recovery; larger crystals" },
      ],
      aiSuggestion:
        "Your 20°C rate looks consistent with Arrhenius expectations. Consider noting whether stirring speed was held constant across trials — that control strengthens the temperature claim.",
      studentMessage: "Should I include the mass of the seed crystal in the recovered total?",
    },
  },

  "/admin/f/lb-10-incident": {
    path: "/admin/f/lb-10-incident",
    figmaId: "65:2852",
    title: "INC-2026-047",
    subtitle: "Minor severity incident under review — track response timeline and closeout",
    breadcrumbs: ["Home", "Academics", "Lab Incidents", "INC-2026-047"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    archetype: "labIncident",
    primaryAction: "Generate Report",
    primaryActionHref: "/admin/f/lb-10-incident",
    secondaryAction: "Escalate",
    secondaryActionHref: "/admin/f/lb-10-incident",
    secondaryActions: ["Escalate", "Close"],
    secondaryActionHrefs: {
      Escalate: "/admin/f/lb-10-incident",
      Close: "/admin/f/lb-01-lab-dashboard",
    },
    labIncident: {
      id: "INC-2026-047",
      severity: "Minor",
      status: "Under Review",
      backHref: "/admin/f/lb-01-lab-dashboard",
      timeline: [
        { time: "2:15 PM", title: "Occurred", detail: "Acid splash near sink in Chemistry Lab A" },
        { time: "2:18 PM", title: "Spill Kit Deployed", detail: "Neutralizer applied by lab tech" },
        { time: "2:30 PM", title: "Cleanup Complete", detail: "Area cleared; PPE collected for disposal" },
      ],
      fields: [
        { label: "Reporter", value: "Lab Tech · Jordan Lee" },
        { label: "Room", value: "Chemistry Lab A" },
        { label: "Related Asset", value: "Autoclave Unit #3 / Bench 2" },
        { label: "Students Present", value: "14 · CHEM 301 Section B" },
        { label: "Injury Reported", value: "None" },
        { label: "Follow-up", value: "Calibration check scheduled" },
      ],
    },
  },

  "/admin/f/lb-11-virtual-labs": {
    path: "/admin/f/lb-11-virtual-labs",
    figmaId: "65:2986",
    title: "Virtual Lab Environments",
    subtitle: "Monitor simulation environments, engine load, and active learner sessions",
    breadcrumbs: ["Home", "Academics", "Virtual Labs"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    archetype: "labVirtual",
    primaryAction: "Launch Environment",
    primaryActionHref: "/admin/f/lb-12-computer-environments",
    secondaryAction: "Provision New",
    secondaryActionHref: "/admin/f/lb-12-computer-environments",
    kpis: [
      { label: "Environments", value: "4", hint: "Published sims", tone: "muted" },
      { label: "Active Users", value: "84", hint: "In session now", tone: "up" },
      { label: "Utilization", value: "68.4%", hint: "Across all engines", tone: "up" },
    ],
    labVirtual: {
      environments: [
        {
          name: "Chemistry Sim · Organic",
          course: "CHEM 204",
          engine: "WebGL",
          load: "75% load",
          loadPct: 75,
          href: "/admin/f/lb-12-computer-environments",
        },
        {
          name: "Microbiology Bench",
          course: "BIO 210",
          engine: "WebGL",
          load: "52% load",
          loadPct: 52,
          href: "/admin/f/lb-12-computer-environments",
        },
        {
          name: "Nursing Sim Ward",
          course: "NURS 140",
          engine: "Unity Stream",
          load: "81% load",
          loadPct: 81,
          href: "/admin/f/lb-12-computer-environments",
        },
        {
          name: "Physics Optics Lab",
          course: "PHYS 120",
          engine: "WebGL",
          load: "34% load",
          loadPct: 34,
          href: "/admin/f/lb-12-computer-environments",
        },
      ],
    },
  },

  "/admin/f/lb-12-computer-environments": makeQueue({
    path: "/admin/f/lb-12-computer-environments",
    figmaId: "65:3146",
    title: "Virtual Desktop Environments",
    subtitle: "Provision, clone, and monitor virtual desktop lab workspaces",
    breadcrumbs: ["Home", "Academics", "Computer Environments"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    primaryAction: "Provision New",
    primaryActionHref: "/admin/f/lb-12-computer-environments",
    secondaryAction: "Clone Environment",
    secondaryActionHref: "/admin/f/lb-11-virtual-labs",
    searchPlaceholder: "Search environments by name or image...",
    filters: ["Status: All", "Pool: All"],
    countLabel: "12 configured environments",
    columns: ["Environment", "Image", "vCPU", "Sessions", "Status", "Action"],
    columnTemplate: "minmax(160px,1.5fr) minmax(140px,1.2fr) 80px 90px 110px 80px",
    kpis: [
      { label: "Configured", value: "12", hint: "Desktop images", tone: "muted" },
      { label: "Sessions", value: "186", hint: "Active this week", tone: "up" },
      { label: "vCPU", value: "384", hint: "Allocated capacity", tone: "up" },
    ],
    rows: [
      {
        primary: "CHEM-VDI-01",
        secondary: "Organic chem workstation",
        cells: ["CHEM-VDI-01", "Ubuntu Chem 22.04", "8", "24", "Ready"],
        badge: "Ready",
        badgeTone: "active",
        href: "/admin/f/lb-11-virtual-labs",
      },
      {
        primary: "BIO-VDI-04",
        secondary: "Microscopy suite",
        cells: ["BIO-VDI-04", "Windows Lab 11", "4", "18", "Ready"],
        badge: "Ready",
        badgeTone: "active",
        href: "/admin/f/lb-11-virtual-labs",
      },
      {
        primary: "NURS-VDI-02",
        secondary: "Sim charting desktop",
        cells: ["NURS-VDI-02", "Windows EHR Base", "6", "41", "High Load"],
        badge: "High Load",
        badgeTone: "review",
        href: "/admin/f/lb-11-virtual-labs",
      },
      {
        primary: "CS-VDI-09",
        secondary: "Compiler toolchain",
        cells: ["CS-VDI-09", "Ubuntu Dev 24.04", "16", "12", "Provisioning"],
        badge: "Provisioning",
        badgeTone: "new",
        href: "/admin/f/lb-12-computer-environments",
      },
    ],
  }),

  "/admin/f/cp-01-compliance-dashboard": {
    path: "/admin/f/cp-01-compliance-dashboard",
    figmaId: "168:2399",
    title: "Compliance Dashboard",
    subtitle: "Monitor FERPA regulations, records retention protocols, and safety audits.",
    breadcrumbs: ["Home", "System", "Compliance Dashboard"],
    activeHref: "/admin/f/cp-01-compliance-dashboard",
    complianceNav: true,
    archetype: "complianceDash",
    primaryAction: "Generate Compliance Report",
    primaryActionHref: "/admin/f/cp-07-accreditation-assistant",
    secondaryAction: "Open Record Vault",
    secondaryActionHref: "/admin/f/cp-03-record-vault",
    complianceDash: {
      scorePct: 87,
      scoreLabel: "Overall Compliance Score",
      scoreHint: "Meets current regional accreditation standards",
      sideMetrics: [
        {
          label: "Record Completeness",
          value: "92%",
          hint: "Across active cohorts",
          href: "/admin/f/cp-02-record-completeness",
        },
        {
          label: "Retention Adherence",
          value: "85%",
          hint: "Policies on schedule",
          href: "/admin/f/cp-04-retention-policies",
        },
        {
          label: "Legal Holds Active",
          value: "3",
          hint: "Preservation required",
          href: "/admin/f/cp-05-legal-holds",
        },
        {
          label: "Privacy Requests",
          value: "7 Pending",
          hint: "FOIA / DSAR queue",
          href: "/admin/f/cp-10-privacy-requests",
        },
      ],
      deadlinesHref: "/admin/f/cp-07-accreditation-assistant",
      deadlines: [
        { title: "FERPA Employee Annual Training", due: "14 Days" },
        { title: "LMS Sync & Audit Record Clear", due: "28 Days" },
        { title: "State Board Nursing Review", due: "60 Days" },
      ],
      evidenceHref: "/admin/f/cp-06-evidence-mapping",
      evidence: [
        { label: "Standard I", pct: 95 },
        { label: "Standard II", pct: 82 },
        { label: "Standard III", pct: 74 },
      ],
    },
  },

  "/admin/f/cp-02-record-completeness": {
    path: "/admin/f/cp-02-record-completeness",
    figmaId: "17:16000",
    title: "Record Completeness",
    subtitle: "Verify enrollment documentation completeness audits across active cohorts.",
    breadcrumbs: ["Home", "System", "Compliance", "Record Completeness"],
    activeHref: "/admin/f/cp-01-compliance-dashboard",
    complianceNav: true,
    archetype: "cpCompleteness",
    primaryAction: "Run Completeness Audit",
    primaryActionHref: "/admin/f/cp-02-record-completeness",
    secondaryAction: "Open Vault",
    secondaryActionHref: "/admin/f/cp-03-record-vault",
    searchPlaceholder: "Search students or cohorts…",
    kpis: [{ label: "Overall Completeness", value: "87%", hint: "Active enrollment records", tone: "up" }],
    cpCompleteness: {
      vaultHref: "/admin/f/cp-03-record-vault",
      fieldGroups: [
        { name: "Identity & Enrollment", pct: 96, detail: "SSN, residency, program admit" },
        { name: "Academic History", pct: 88, detail: "Transcripts and prior coursework" },
        { name: "Health & Clearance", pct: 79, detail: "Immunizations and clinical clearance" },
        { name: "Financial Aid Docs", pct: 84, detail: "ISIR, award letters, verification" },
      ],
      incomplete: [
        {
          name: "Marcus Vance",
          cohort: "BSN Fall 2026",
          missing: "Immunization Record",
          status: "Critical",
          tone: "danger",
          href: "/admin/f/cp-03-record-vault",
        },
        {
          name: "Priya Patel",
          cohort: "ADN Spring 2027",
          missing: "Proof of Residency",
          status: "Incomplete",
          tone: "review",
          href: "/admin/f/cp-03-record-vault",
        },
        {
          name: "Devon Lane",
          cohort: "BSN Fall 2026",
          missing: "High School Transcript",
          status: "Incomplete",
          tone: "review",
          href: "/admin/f/cp-03-record-vault",
        },
        {
          name: "Ava Morales",
          cohort: "RN-BSN Online",
          missing: "FERPA Release",
          status: "At Risk",
          tone: "danger",
          href: "/admin/f/cp-03-record-vault",
        },
      ],
    },
  },

  "/admin/f/cp-03-record-vault": makeQueue({
    path: "/admin/f/cp-03-record-vault",
    figmaId: "17:16137",
    title: "Record Vault",
    subtitle: "Search, archive, and preserve institutional student records under retention control.",
    breadcrumbs: ["Home", "System", "Compliance", "Record Vault"],
    activeHref: "/admin/f/cp-01-compliance-dashboard",
    complianceNav: true,
    primaryAction: "Apply Hold",
    primaryActionHref: "/admin/f/cp-05-legal-holds",
    secondaryActions: ["Archive", "Export"],
    secondaryActionHrefs: {
      Archive: "/admin/f/cp-03-record-vault",
      Export: "/admin/f/cp-03-record-vault",
    },
    searchPlaceholder: "Search vault by student, document, or ID…",
    filters: ["Type: All", "Hold: Any", "Retention: Active"],
    countLabel: "1,842 vault documents",
    columns: ["Document", "Student", "Type", "Retention", "Status", "Action"],
    columnTemplate: "minmax(180px,1.5fr) minmax(130px,1.1fr) 110px 110px 110px 90px",
    actionLabel: "Open",
    rows: [
      {
        primary: "Immunization_Record_Vance.pdf",
        secondary: "STU-2025-4410",
        cells: ["Immunization_Record_Vance.pdf", "Marcus Vance", "Health", "7 years", "Active"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/cp-03-record-vault",
      },
      {
        primary: "Enrollment_Agreement_Patel.pdf",
        cells: ["Enrollment_Agreement_Patel.pdf", "Priya Patel", "Enrollment", "Permanent", "On Hold"],
        badge: "On Hold",
        badgeTone: "danger",
        href: "/admin/f/cp-05-legal-holds",
      },
      {
        primary: "Official_Transcript_Lane.pdf",
        cells: ["Official_Transcript_Lane.pdf", "Devon Lane", "Academic", "Permanent", "Active"],
        badge: "Active",
        badgeTone: "active",
        href: "/admin/f/cp-03-record-vault",
      },
      {
        primary: "FOIA_Packet_Morales.zip",
        cells: ["FOIA_Packet_Morales.zip", "Ava Morales", "Privacy", "5 years", "Review"],
        badge: "Review",
        badgeTone: "review",
        href: "/admin/f/cp-10-privacy-requests",
      },
      {
        primary: "Clinical_Eval_Fall2024.docx",
        cells: ["Clinical_Eval_Fall2024.docx", "Jordan Lee", "Clinical", "7 years", "Eligible Dispose"],
        badge: "Eligible Dispose",
        badgeTone: "review",
        href: "/admin/f/cp-09-disposal-review",
      },
    ],
  }),

  "/admin/f/cp-04-retention-policies": {
    path: "/admin/f/cp-04-retention-policies",
    figmaId: "17:16235",
    title: "Retention Policies",
    subtitle: "Define retention periods, trigger events, and disposal actions by record class.",
    breadcrumbs: ["Home", "System", "Compliance", "Retention"],
    activeHref: "/admin/f/cp-01-compliance-dashboard",
    complianceNav: true,
    archetype: "cpRetention",
    primaryAction: "Create Policy",
    primaryActionHref: "/admin/f/cp-04-retention-policies",
    secondaryAction: "Disposal Review",
    secondaryActionHref: "/admin/f/cp-09-disposal-review",
    cpRetention: {
      policies: [
        {
          name: "Student Academic Transcripts",
          scope: "Registrar · Permanent",
          status: "Published",
          tone: "active",
          period: "Permanent",
          trigger: "Graduation or last enrollment",
          disposal: "Never — archive to cold vault",
          note: "Aligned with regional accreditation and FERPA permanent record guidance.",
        },
        {
          name: "Financial Aid Verification",
          scope: "Financial Aid · 5 years",
          status: "Published",
          tone: "active",
          period: "5 years after award year close",
          trigger: "Aid year closed + audit complete",
          disposal: "Secure shred / digital wipe",
          note: "Title IV records retained through the required post-award window.",
        },
        {
          name: "Clinical Evaluations",
          scope: "Practicum · 7 years",
          status: "Draft",
          tone: "review",
          period: "7 years after clinical term",
          trigger: "Term grade finalization",
          disposal: "Review queue → approved destruction",
          note: "Draft pending nursing board review before publish.",
        },
        {
          name: "Admissions Application Packets",
          scope: "Admissions · 3 years",
          status: "Published",
          tone: "active",
          period: "3 years after decision",
          trigger: "Admit/deny decision finalized",
          disposal: "Bulk dispose after hold check",
          note: "Exclude records under active legal hold or privacy request.",
        },
      ],
    },
  },

  "/admin/f/cp-05-legal-holds": {
    path: "/admin/f/cp-05-legal-holds",
    figmaId: "17:16334",
    title: "Legal Holds",
    subtitle: "Preserve records under litigation, investigation, or regulatory inquiry.",
    breadcrumbs: ["Home", "System", "Compliance", "Legal Holds"],
    activeHref: "/admin/f/cp-01-compliance-dashboard",
    complianceNav: true,
    archetype: "cpHolds",
    primaryAction: "Place New Hold",
    primaryActionHref: "/admin/f/cp-05-legal-holds",
    secondaryAction: "Open Vault",
    secondaryActionHref: "/admin/f/cp-03-record-vault",
    kpis: [
      { label: "Active Holds", value: "3", hint: "Preservation locked", tone: "danger" },
      { label: "Students Affected", value: "11", hint: "Across matters", tone: "muted" },
      { label: "Docs Frozen", value: "248", hint: "Vault objects", tone: "muted" },
    ],
    cpHolds: {
      vaultHref: "/admin/f/cp-03-record-vault",
      holds: [
        {
          id: "HOLD-2026-014",
          title: "Title IX Investigation · Nursing Cohort",
          matter: "Matter TX-441",
          placed: "Oct 02, 2026",
          status: "Active",
          tone: "danger",
          reason: "Preserve emails, clinical notes, and enrollment packets for named students.",
          affected: ["Marcus Vance", "Priya Patel", "Devon Lane"],
        },
        {
          id: "HOLD-2026-011",
          title: "State Board Document Subpoena",
          matter: "Matter SB-118",
          placed: "Sep 18, 2026",
          status: "Active",
          tone: "danger",
          reason: "Retain accreditation evidence binders and faculty credential files.",
          affected: ["Faculty Cohort A", "Jordan Lee", "Ava Morales"],
        },
        {
          id: "HOLD-2026-008",
          title: "FOIA Expansion Hold",
          matter: "Matter PR-77",
          placed: "Aug 30, 2026",
          status: "Review",
          tone: "review",
          reason: "Temporary freeze pending privacy request scope confirmation.",
          affected: ["Ava Morales", "Campus Tours Inbox"],
        },
      ],
    },
  },

  "/admin/f/cp-06-evidence-mapping": {
    path: "/admin/f/cp-06-evidence-mapping",
    figmaId: "17:16423",
    title: "Evidence Mapping",
    subtitle: "Map vault documents to accreditation standards and track coverage gaps.",
    breadcrumbs: ["Home", "System", "Compliance", "Evidence Mapping"],
    activeHref: "/admin/f/cp-01-compliance-dashboard",
    complianceNav: true,
    archetype: "cpEvidence",
    primaryAction: "Link Document",
    primaryActionHref: "/admin/f/cp-03-record-vault",
    secondaryAction: "Accreditation Assistant",
    secondaryActionHref: "/admin/f/cp-07-accreditation-assistant",
    cpEvidence: {
      vaultHref: "/admin/f/cp-03-record-vault",
      standards: [
        {
          id: "Standard I",
          title: "Mission & Governance",
          pct: 95,
          documents: [
            { name: "Board_Minutes_Q3.pdf", meta: "Governance · Linked Oct 12", href: "/admin/f/cp-03-record-vault" },
            { name: "Mission_Statement_2026.docx", meta: "Policy · Linked Sep 02", href: "/admin/f/cp-03-record-vault" },
          ],
        },
        {
          id: "Standard II",
          title: "Student Achievement",
          pct: 82,
          documents: [
            { name: "NCLEX_Pass_Rates_2025.xlsx", meta: "Outcomes · Linked Oct 01", href: "/admin/f/cp-03-record-vault" },
            { name: "Retention_Report_Fall.pdf", meta: "IR · Linked Sep 20", href: "/admin/f/cp-03-record-vault" },
            { name: "Employer_Survey_Summary.pdf", meta: "Career · Linked Aug 14", href: "/admin/f/cp-03-record-vault" },
          ],
        },
        {
          id: "Standard III",
          title: "Faculty & Resources",
          pct: 74,
          documents: [
            { name: "Faculty_Credential_Matrix.xlsx", meta: "HR · Linked Oct 08", href: "/admin/f/cp-03-record-vault" },
            { name: "Lab_Safety_Audit.pdf", meta: "Labs · Linked Sep 28", href: "/admin/f/cp-03-record-vault" },
          ],
        },
      ],
    },
  },

  "/admin/f/cp-07-accreditation-assistant": {
    path: "/admin/f/cp-07-accreditation-assistant",
    figmaId: "17:16529",
    title: "Accreditation Assistant",
    subtitle: "Track deadlines, coverage metrics, and AI-suggested evidence links.",
    breadcrumbs: ["Home", "System", "Compliance", "Accreditation"],
    activeHref: "/admin/f/cp-01-compliance-dashboard",
    complianceNav: true,
    archetype: "cpAccreditation",
    primaryAction: "Generate Compliance Report",
    primaryActionHref: "/admin/f/cp-08-inspection-pack",
    secondaryAction: "Evidence Mapping",
    secondaryActionHref: "/admin/f/cp-06-evidence-mapping",
    kpis: [
      { label: "Standards Mapped", value: "3 / 3", hint: "Regional binder", tone: "up" },
      { label: "Evidence Gaps", value: "6", hint: "Needs vault link", tone: "danger" },
      { label: "Days to Review", value: "60", hint: "State board nursing", tone: "muted" },
    ],
    cpAccreditation: {
      vaultHref: "/admin/f/cp-03-record-vault",
      deadlines: [
        {
          title: "FERPA Employee Annual Training",
          due: "Due in 14 days",
          status: "Urgent",
          tone: "danger",
        },
        {
          title: "LMS Sync & Audit Record Clear",
          due: "Due in 28 days",
          status: "Scheduled",
          tone: "review",
        },
        {
          title: "State Board Nursing Review",
          due: "Due in 60 days",
          status: "On Track",
          tone: "active",
        },
      ],
      metrics: [
        { label: "Governance Evidence", pct: 95 },
        { label: "Student Outcomes", pct: 82 },
        { label: "Faculty Credentials", pct: 74 },
      ],
      insights: [
        {
          title: "Missing lab safety audit for Standard III",
          body: "AI found an unlinked Lab Safety Audit PDF that matches criterion III.4.",
          href: "/admin/f/cp-03-record-vault",
        },
        {
          title: "NCLEX cohort split needs annotation",
          body: "Pass-rate workbook lacks first-time vs repeater footnote required by the board.",
          href: "/admin/f/cp-03-record-vault",
        },
      ],
    },
  },

  "/admin/f/cp-08-inspection-pack": {
    path: "/admin/f/cp-08-inspection-pack",
    figmaId: "65:4898",
    title: "Inspection Pack Builder",
    subtitle: "Assemble checklist evidence into a submission-ready inspection packet.",
    breadcrumbs: ["Home", "System", "Compliance", "Inspection Pack"],
    activeHref: "/admin/f/cp-01-compliance-dashboard",
    complianceNav: true,
    archetype: "cpInspection",
    primaryAction: "Submit Pack",
    primaryActionHref: "/admin/f/cp-07-accreditation-assistant",
    secondaryActions: ["Preview", "Auto-Populate"],
    secondaryActionHrefs: {
      Preview: "/admin/f/cp-08-inspection-pack",
      "Auto-Populate": "/admin/f/cp-06-evidence-mapping",
    },
    cpInspection: {
      status: "DRAFT",
      progressPct: 78,
      addDocHref: "/admin/f/cp-03-record-vault",
      categories: [
        { title: "Governance", done: 8, total: 8, status: "Complete", tone: "active" },
        { title: "Student Records", done: 11, total: 14, status: "In Progress", tone: "review" },
        { title: "Clinical Sites", done: 6, total: 9, status: "In Progress", tone: "review" },
        { title: "Faculty Files", done: 4, total: 7, status: "Gaps", tone: "danger" },
      ],
      documents: [
        {
          name: "Org_Chart_2026.pdf",
          category: "Governance",
          status: "Ready",
          tone: "active",
          href: "/admin/f/cp-03-record-vault",
        },
        {
          name: "FERPA_Training_Roster.xlsx",
          category: "Records",
          status: "Ready",
          tone: "active",
          href: "/admin/f/cp-03-record-vault",
        },
        {
          name: "Clinical_MOU_Packet.zip",
          category: "Clinical",
          status: "Needed",
          tone: "danger",
          href: "/admin/f/cp-03-record-vault",
        },
        {
          name: "Faculty_CV_Binder.pdf",
          category: "Faculty",
          status: "Review",
          tone: "review",
          href: "/admin/f/cp-03-record-vault",
        },
      ],
    },
  },

  "/admin/f/cp-09-disposal-review": {
    path: "/admin/f/cp-09-disposal-review",
    figmaId: "17:16639",
    title: "Disposal Review",
    subtitle: "Approve or deny destruction for records that have reached retention expiry.",
    breadcrumbs: ["Home", "System", "Compliance", "Disposal Review"],
    activeHref: "/admin/f/cp-01-compliance-dashboard",
    complianceNav: true,
    archetype: "cpDisposal",
    primaryAction: "Bulk Approve",
    primaryActionHref: "/admin/f/cp-09-disposal-review",
    secondaryAction: "Bulk Deny",
    secondaryActionHref: "/admin/f/cp-05-legal-holds",
    secondaryActions: ["Bulk Deny"],
    secondaryActionHrefs: { "Bulk Deny": "/admin/f/cp-05-legal-holds" },
    cpDisposal: {
      batchId: "B-94",
      holdsHref: "/admin/f/cp-05-legal-holds",
      items: [
        {
          id: "DOC-88412",
          name: "Clinical_Eval_Fall2024.docx",
          retention: "Expired · 7yr window",
          status: "Pending",
          tone: "review",
          type: "Clinical evaluation",
          size: "420 KB",
          preview: "Student clinical evaluation for Fall 2024 practicum. Retention clock expired Oct 01, 2026. No active legal hold detected.",
        },
        {
          id: "DOC-88201",
          name: "Admissions_Packet_2021.zip",
          retention: "Expired · 3yr window",
          status: "Pending",
          tone: "review",
          type: "Admissions archive",
          size: "12.4 MB",
          preview: "Denied applicant packet from 2021 cycle. Eligible for secure destruction after privacy scan.",
        },
        {
          id: "DOC-87990",
          name: "FA_Verification_AY20.pdf",
          retention: "Expired · 5yr window",
          status: "Flagged",
          tone: "danger",
          type: "Financial aid",
          size: "1.1 MB",
          preview: "Verification worksheet may overlap FOIA request PR-77. Recommend Deny Hold before destruction.",
        },
      ],
    },
  },

  "/admin/f/cp-10-privacy-requests": {
    path: "/admin/f/cp-10-privacy-requests",
    figmaId: "17:16728",
    title: "Privacy Requests",
    subtitle: "Manage FOIA and data-subject access requests with dossier review and sign-off.",
    breadcrumbs: ["Home", "System", "Compliance", "Privacy Requests"],
    activeHref: "/admin/f/cp-01-compliance-dashboard",
    complianceNav: true,
    archetype: "cpPrivacy",
    primaryAction: "Final Sign-off",
    primaryActionHref: "/admin/f/cp-10-privacy-requests",
    secondaryAction: "Open Vault",
    secondaryActionHref: "/admin/f/cp-03-record-vault",
    kpis: [
      { label: "Pending", value: "7", hint: "Awaiting review", tone: "danger" },
      { label: "Due This Week", value: "2", hint: "SLA pressure", tone: "muted" },
      { label: "Closed 30d", value: "18", hint: "Completed packets", tone: "up" },
    ],
    cpPrivacy: {
      requests: [
        {
          id: "PR-77",
          requester: "Ava Morales",
          type: "FOIA",
          status: "Review",
          tone: "review",
          fields: [
            { label: "Request ID", value: "PR-77" },
            { label: "Received", value: "Oct 08, 2026" },
            { label: "Due", value: "Oct 28, 2026" },
            { label: "Scope", value: "Enrollment + clinical evaluations" },
          ],
          timeline: [
            { date: "Oct 08", title: "Request received", detail: "Portal submission verified" },
            { date: "Oct 10", title: "Identity confirmed", detail: "Registrar identity check passed" },
            { date: "Oct 14", title: "Vault gather", detail: "4 documents staged for redaction" },
            { date: "Oct 18", title: "Legal review", detail: "Pending final sign-off" },
          ],
        },
        {
          id: "PR-74",
          requester: "External Counsel · Hale & Co",
          type: "FOIA",
          status: "Gathering",
          tone: "new",
          fields: [
            { label: "Request ID", value: "PR-74" },
            { label: "Received", value: "Oct 02, 2026" },
            { label: "Due", value: "Oct 22, 2026" },
            { label: "Scope", value: "Board minutes Q2–Q3" },
          ],
          timeline: [
            { date: "Oct 02", title: "Request received" },
            { date: "Oct 04", title: "Assigned to compliance desk" },
            { date: "Oct 12", title: "Partial packet assembled" },
          ],
        },
        {
          id: "DSAR-19",
          requester: "Marcus Vance",
          type: "DSAR",
          status: "Urgent",
          tone: "danger",
          fields: [
            { label: "Request ID", value: "DSAR-19" },
            { label: "Received", value: "Oct 15, 2026" },
            { label: "Due", value: "Oct 20, 2026" },
            { label: "Scope", value: "Full student education record export" },
          ],
          timeline: [
            { date: "Oct 15", title: "DSAR opened" },
            { date: "Oct 16", title: "Hold check clear" },
            { date: "Oct 17", title: "Export staged", detail: "Awaiting final sign-off" },
          ],
        },
      ],
    },
  },

  "/admin/f/ai-01-ai-dashboard": {
    path: "/admin/f/ai-01-ai-dashboard",
    figmaId: "17:17016",
    title: "AI Administration",
    subtitle: "Central workspace for LLM diagnostics, model configurations, and gateway telemetry.",
    breadcrumbs: ["Home", "System", "AI Hub"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    archetype: "aiDash",
    primaryAction: "Open Model Registry",
    primaryActionHref: "/admin/f/ai-02-model-registry",
    secondaryAction: "AI Policy",
    secondaryActionHref: "/admin/f/ai-11-ai-policy",
    aiDash: {
      kpis: [
        {
          label: "Active Models",
          value: "8",
          hint: "Production + shadow",
          href: "/admin/f/ai-02-model-registry",
        },
        {
          label: "Prompts",
          value: "142",
          hint: "Versioned instructions",
          href: "/admin/f/ai-03-prompt-registry",
        },
        {
          label: "Daily API Calls",
          value: "485.2K",
          hint: "Last 24 hours",
          href: "/admin/f/ai-10-usage-cost",
        },
        {
          label: "Monthly Cost",
          value: "$2,480.15",
          hint: "Month-to-date",
          href: "/admin/f/ai-10-usage-cost",
        },
      ],
      usageTrend: [
        { label: "Mon", height: "48%" },
        { label: "Tue", height: "62%" },
        { label: "Wed", height: "58%" },
        { label: "Thu", height: "74%" },
        { label: "Fri", height: "88%" },
        { label: "Sat", height: "40%" },
        { label: "Sun", height: "36%" },
      ],
      costBreakdown: [
        {
          label: "GPT-4o",
          amount: "$1,420",
          pct: 57,
          color: "#2563EB",
          href: "/admin/f/ai-10-usage-cost",
        },
        {
          label: "Claude",
          amount: "$760",
          pct: 31,
          color: "#849f38",
          href: "/admin/f/ai-10-usage-cost",
        },
        {
          label: "Llama",
          amount: "$300",
          pct: 12,
          color: "#1d4ed8",
          href: "/admin/f/ai-10-usage-cost",
        },
      ],
      activity: [
        {
          id: "gw-9912",
          title: "fetchStudentSchedules · SUCCESS",
          when: "2 min ago",
          status: "SUCCESS",
          tone: "active",
          href: "/admin/f/ai-12-tool-call-audit",
        },
        {
          id: "gw-9908",
          title: "Citation mismatch flagged",
          when: "18 min ago",
          status: "REVIEW",
          tone: "review",
          href: "/admin/f/ai-09-citation-failures",
        },
        {
          id: "gw-9899",
          title: "modifyRecordGrade · TIMEOUT",
          when: "41 min ago",
          status: "TIMEOUT",
          tone: "danger",
          href: "/admin/f/ai-12-tool-call-audit",
        },
        {
          id: "gw-9881",
          title: "mathFormulaCalculator · SUCCESS",
          when: "1 hr ago",
          status: "SUCCESS",
          tone: "active",
          href: "/admin/f/ai-12-tool-call-audit",
        },
      ],
    },
  },

  "/admin/f/ai-11-ai-policy": {
    path: "/admin/f/ai-11-ai-policy",
    figmaId: "17:18639",
    title: "AI Policy Settings",
    subtitle: "Configure data handling, content filters, rate limits, and pending policy approvals.",
    breadcrumbs: ["Home", "System", "AI Hub", "AI Policy"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    archetype: "policy",
    primaryAction: "Publish Policy Changes",
    primaryActionHref: "/admin/f/ai-01-ai-dashboard",
    policy: {
      sections: [
        {
          title: "Data Handling",
          toggles: [
            {
              label: "Block PII in model prompts",
              detail: "Strip SSN, DOB, and financial account numbers before gateway egress.",
              on: true,
            },
            {
              label: "Retain tool payloads for audit",
              detail: "Keep tool request/response bodies for 30 days in the audit log.",
              on: true,
            },
          ],
          fields: [
            {
              label: "Retention window",
              value: "30 days",
              hint: "Applies to gateway telemetry and tool call archives.",
            },
          ],
        },
        {
          title: "Content Filtering",
          checks: [
            "Refuse grade modification without dual-admin confirmation",
            "Require citation grounding for academic advising answers",
            "Flag medical or counseling advice for human escalation",
          ],
          toggles: [
            {
              label: "Enable jailbreak detection",
              detail: "Quarantine prompts that attempt system-instruction override.",
              on: true,
            },
          ],
        },
        {
          title: "Rate Limits",
          fields: [
            { label: "Per-user RPM", value: "60 requests / minute" },
            { label: "Institution daily token cap", value: "25M tokens" },
            {
              label: "Burst allowance",
              value: "2× for 5 minutes",
              hint: "Automatically cools down after burst window.",
            },
          ],
        },
        {
          title: "Pending Approvals",
          textarea: {
            label: "Changes awaiting publish",
            value:
              "• Raise Claude monthly budget to $1,000\n• Allow Llama tool calling in academic advisor prompt\n• Extend audit retention from 14 → 30 days",
            hint: "Publishing routes reviewers back to the AI dashboard.",
          },
        },
      ],
    },
  },

  "/admin/f/ai-12-tool-call-audit": makeQueue({
    path: "/admin/f/ai-12-tool-call-audit",
    figmaId: "17:18712",
    title: "Tool Call Audit Log",
    subtitle: "Inspect gateway tool invocations, latency, and success or failure outcomes.",
    breadcrumbs: ["Home", "System", "AI Hub", "Tool Audit"],
    activeHref: "/admin/f/ai-01-ai-dashboard",
    aiNav: true,
    primaryAction: "Export Audit CSV",
    primaryActionHref: "/admin/f/ai-12-tool-call-audit",
    secondaryAction: "AI Dashboard",
    secondaryActionHref: "/admin/f/ai-01-ai-dashboard",
    searchPlaceholder: "Search tool, user, or call ID…",
    filters: ["Status: All", "Tool: All", "Range: 24h"],
    countLabel: "248 calls in window",
    columns: ["Call ID", "Tool", "Actor", "Latency", "Status", "When", "Action"],
    columnTemplate: "110px minmax(160px,1.3fr) minmax(110px,1fr) 90px 100px 120px 90px",
    actionLabel: "Inspect",
    rows: [
      {
        primary: "tc-9912",
        cells: ["tc-9912", "fetchStudentSchedules", "advisor.bot", "124ms", "SUCCESS", "Today 1:42 PM"],
        badge: "SUCCESS",
        badgeTone: "active",
        href: "/admin/f/ai-04-tool-registry",
      },
      {
        primary: "tc-9908",
        cells: ["tc-9908", "retrieveCitations", "academic.v2", "860ms", "ERROR", "Today 1:24 PM"],
        badge: "ERROR",
        badgeTone: "danger",
        href: "/admin/f/ai-09-citation-failures",
      },
      {
        primary: "tc-9899",
        cells: ["tc-9899", "modifyRecordGrade", "admin_test", "5000ms", "TIMEOUT", "Today 1:01 PM"],
        badge: "TIMEOUT",
        badgeTone: "danger",
        href: "/admin/f/ai-04-tool-registry",
      },
      {
        primary: "tc-9881",
        cells: ["tc-9881", "mathFormulaCalculator", "tutor.bot", "42ms", "SUCCESS", "Today 12:38 PM"],
        badge: "SUCCESS",
        badgeTone: "active",
        href: "/admin/f/ai-04-tool-registry",
      },
      {
        primary: "tc-9860",
        cells: ["tc-9860", "fetchStudentSchedules", "advisor.bot", "210ms", "SUCCESS", "Today 11:55 AM"],
        badge: "SUCCESS",
        badgeTone: "active",
        href: "/admin/f/ai-12-tool-call-audit",
      },
    ],
  }),

  "/admin/f/fm-04-form-submissions": makeQueue({
    path: "/admin/f/fm-04-form-submissions",
    figmaId: "17:13330",
    title: "Form Submissions",
    subtitle: "Review inbound form responses and open the matching form schema.",
    breadcrumbs: ["Home", "Builder", "Forms", "Submissions"],
    activeHref: "/admin/f/fm-01-form-list",
    primaryAction: "Open Designer",
    primaryActionHref: "/admin/f/fm-02-form-designer",
    searchPlaceholder: "Search submissions…",
    filters: ["Form: All", "Status: All"],
    countLabel: "4 recent submissions",
    columns: ["Respondent", "Form", "Submitted", "Status", "Action"],
    columnTemplate: "minmax(160px,1.3fr) minmax(180px,1.4fr) 120px 100px 90px",
    actionLabel: "Open",
    rows: [
      {
        primary: "Sarah Mitchell",
        cells: ["Sarah Mitchell", "Immunization Record Intake", "Today 9:14 AM", "Complete"],
        badge: "Complete",
        badgeTone: "active",
        href: "/admin/f/fm-02-form-designer",
      },
      {
        primary: "Marcus Vance",
        cells: ["Marcus Vance", "Course Feedback Survey", "Yesterday", "In Review"],
        badge: "In Review",
        badgeTone: "review",
        href: "/admin/f/fm-02-form-designer",
      },
      {
        primary: "Clara Oswald",
        cells: ["Clara Oswald", "Tuition Waiver Request", "Oct 02", "New"],
        badge: "New",
        badgeTone: "new",
        href: "/admin/f/fm-02-form-designer",
      },
      {
        primary: "Jonathan Archer",
        cells: ["Jonathan Archer", "Immunization Record Intake", "Sep 28", "Complete"],
        badge: "Complete",
        badgeTone: "active",
        href: "/admin/f/fm-02-form-designer",
      },
    ],
  }),

  "/admin/f/sh-01-login-admin": makeDashboard({
    path: "/admin/f/sh-01-login-admin",
    figmaId: "27:118",
    title: "Admin Login Console",
    subtitle: "Entry point for SIS administrators. Use the shared login screen or return to the admin home.",
    breadcrumbs: ["Home", "Auth", "Admin Login"],
    activeHref: "/admin",
    primaryAction: "Open Login",
    primaryActionHref: "/login",
    secondaryAction: "Admin Home",
    secondaryActionHref: "/admin",
    kpis: [
      { label: "Active Sessions", value: "42", hint: "Last hour", tone: "up", href: "/admin/f/pl-04-session-login-audit" },
      { label: "Failed Logins", value: "3", hint: "Needs review", tone: "danger", href: "/admin/security" },
      { label: "MFA Enforced", value: "100%", hint: "Admin roles", tone: "up", href: "/admin/f/pl-03-security-policy" },
      { label: "Password Policy", value: "OK", hint: "90-day rotation", tone: "muted", href: "/admin/f/pl-03-security-policy" },
    ],
  }),

  "/admin/f/xx-1-lab-booking-calendar": makeQueue({
    path: "/admin/f/xx-1-lab-booking-calendar",
    figmaId: "71:13",
    title: "Lab Booking Calendar",
    subtitle: "Schedule and approve lab room bookings across campus facilities.",
    breadcrumbs: ["Home", "Academics", "Labs", "Booking"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    primaryAction: "New Booking",
    primaryActionHref: "/admin/f/lb-02-lab-rooms",
    rowHref: "/admin/f/lb-02-lab-rooms",
  }),

  "/admin/f/xx-2-lab-usage-analytics": makeDashboard({
    path: "/admin/f/xx-2-lab-usage-analytics",
    figmaId: "71:195",
    title: "Lab Usage Analytics",
    subtitle: "Utilization, peak hours, and equipment demand across lab spaces.",
    breadcrumbs: ["Home", "Academics", "Labs", "Usage Analytics"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    kpis: [
      { label: "Utilization", value: "78%", hint: "This week", tone: "up", href: "/admin/f/lb-01-lab-dashboard" },
      { label: "Peak Hour", value: "14:00", hint: "Tue–Thu", tone: "muted" },
      { label: "No-shows", value: "6", hint: "Last 7 days", tone: "danger", href: "/admin/f/xx-1-lab-booking-calendar" },
      { label: "Open Seats", value: "124", hint: "Today", tone: "up", href: "/admin/f/lb-02-lab-rooms" },
    ],
  }),

  "/admin/f/xx-3-simulation-templates": makeBuilder({
    path: "/admin/f/xx-3-simulation-templates",
    figmaId: "71:436",
    title: "Simulation Templates",
    subtitle: "Author reusable clinical and technical simulation scenarios for lab sessions.",
    breadcrumbs: ["Home", "Academics", "Labs", "Simulations"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    primaryAction: "Publish Template",
    secondaryAction: "Save Draft",
  }),

  "/admin/f/xx-4-lab-compliance": makeQueue({
    path: "/admin/f/xx-4-lab-compliance",
    figmaId: "71:567",
    title: "Lab Compliance",
    subtitle: "Track safety certifications, inspections, and lab policy exceptions.",
    breadcrumbs: ["Home", "Academics", "Labs", "Compliance"],
    activeHref: "/admin/f/lb-01-lab-dashboard",
    labsNav: true,
    rowHref: "/admin/f/lb-06-safety-rules",
  }),

  "/admin/f/xx-5-preceptor-management": makeQueue({
    path: "/admin/f/xx-5-preceptor-management",
    figmaId: "71:709",
    title: "Preceptor Management",
    subtitle: "Manage clinical preceptors, credentials, and placement capacity.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Preceptors"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    rowHref: "/admin/f/pr-02-employers-registry",
  }),

  "/admin/f/xx-6-competency-tracking": makeQueue({
    path: "/admin/f/xx-6-competency-tracking",
    figmaId: "71:1016",
    title: "Competency Tracking",
    subtitle: "Monitor student clinical competencies against program requirements.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Competency"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    rowHref: "/admin/f/pr-08-evaluations",
  }),

  "/admin/f/xx-7-clinical-compliance": makeQueue({
    path: "/admin/f/xx-7-clinical-compliance",
    figmaId: "71:1203",
    title: "Clinical Compliance",
    subtitle: "Clearance, immunization, and site requirement checks for placements.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Clinical Compliance"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    rowHref: "/admin/f/pr-06-agreements",
  }),

  "/admin/f/xx-8-practicum-reports": makeQueue({
    path: "/admin/f/xx-8-practicum-reports",
    figmaId: "71:1364",
    title: "Practicum Reports",
    subtitle: "Generate and export placement, hours, and evaluation reports.",
    breadcrumbs: ["Home", "Academics", "Practicum", "Reports"],
    activeHref: "/admin/f/pr-01-practicum-dashboard",
    rowHref: "/admin/f/pr-01-practicum-dashboard",
  }),

  "/admin/f/xx-9-disposal-review-queue": makeQueue({
    path: "/admin/f/xx-9-disposal-review-queue",
    figmaId: "71:1516",
    title: "Disposal Review Queue",
    subtitle: "Approve or hold records queued for disposal under retention policy.",
    breadcrumbs: ["Home", "System", "Compliance", "Disposal Queue"],
    activeHref: "/admin/f/cp-01-compliance-dashboard",
    complianceNav: true,
    rowHref: "/admin/f/cp-09-disposal-review",
  }),

  "/admin/notifications": makeDashboard({
    path: "/admin/notifications",
    figmaId: "17:13425",
    title: "Notifications",
    subtitle: "System notices and alerts for administrators.",
    breadcrumbs: ["Home", "Notifications"],
    activeHref: "/admin",
    kpis: [
      { label: "Unread", value: "4", hint: "Require attention", tone: "danger" },
      { label: "Today", value: "12", hint: "All channels", tone: "muted" },
      { label: "Scheduled", value: "3", hint: "Upcoming", tone: "up" },
      { label: "Muted", value: "2", hint: "Quiet hours", tone: "muted" },
    ],
  }),

  "/admin/profile": makeDashboard({
    path: "/admin/profile",
    figmaId: "17:13515",
    title: "Admin Profile",
    subtitle: "Your account preferences, role, and contact details.",
    breadcrumbs: ["Home", "Profile"],
    activeHref: "/admin",
    primaryAction: "Edit Profile",
    kpis: [
      { label: "Role", value: "Registrar", hint: "Primary office", tone: "muted" },
      { label: "MFA", value: "On", hint: "Enforced", tone: "up" },
      { label: "Last Login", value: "Today", hint: "09:12 AM", tone: "muted" },
      { label: "Sessions", value: "2", hint: "Active devices", tone: "muted" },
    ],
  }),

  "/admin/analytics": makeDashboard({
    path: "/admin/analytics",
    figmaId: "66:270",
    title: "Analytics Home",
    subtitle: "Cross-module KPIs spanning CRM, success, AI, and finance.",
    breadcrumbs: ["Home", "Analytics"],
    activeHref: "/admin",
    kpis: [
      { label: "CRM Conversion", value: "74.2%", hint: "Funnel", tone: "up", href: "/admin/f/crm-08-funnel-analytics" },
      { label: "At-Risk Students", value: "18", hint: "Success alerts", tone: "danger", href: "/admin/f/ss-01-success-dashboard" },
      { label: "AI Compliance", value: "99.8%", hint: "Policy audit", tone: "up", href: "/admin/f/ai-08-evaluation-dashboard" },
      { label: "AI Cost MTD", value: "$1.4k", hint: "Token usage", tone: "muted", href: "/admin/f/ai-10-usage-cost" },
    ],
  }),

  "/admin/approvals": makeQueue({
    path: "/admin/approvals",
    figmaId: "66:140",
    title: "Approval Inbox",
    subtitle: "Pending administrative approvals across modules.",
    breadcrumbs: ["Home", "Approvals"],
    activeHref: "/admin",
    searchPlaceholder: "Search approvals…",
    countLabel: "Live approval queue",
    columns: ["Request", "Subject", "Status", "Created", "Review Action"],
    columnTemplate: "minmax(160px,1.2fr) minmax(140px,1fr) minmax(100px,0.7fr) minmax(120px,0.8fr) minmax(220px,1.2fr)",
    rowActions: "approval",
  }),

  "/admin/calendar": makeDashboard({
    path: "/admin/calendar",
    figmaId: "17:13448",
    title: "Admin Calendar",
    subtitle: "Institutional deadlines, intake windows, and staff events.",
    breadcrumbs: ["Home", "Calendar"],
    activeHref: "/admin",
    kpis: [
      { label: "This Week", value: "9", hint: "Events", tone: "up" },
      { label: "Deadlines", value: "4", hint: "Next 7 days", tone: "danger" },
      { label: "Interviews", value: "12", hint: "Admissions", tone: "muted", href: "/admin/f/ad-06-interview-workspace" },
      { label: "Terms", value: "Fall 2026", hint: "Active", tone: "muted", href: "/admin/f/ac-01-academic-terms" },
    ],
  }),

  "/admin/security": makeDashboard({
    path: "/admin/security",
    figmaId: "17:13574",
    title: "Security Center",
    subtitle: "Login risk, policy posture, and session health.",
    breadcrumbs: ["Home", "Security"],
    activeHref: "/admin",
    primaryAction: "Security Policy",
    primaryActionHref: "/admin/f/pl-03-security-policy",
    kpis: [
      { label: "Risk Score", value: "Low", hint: "Institution", tone: "up" },
      { label: "Failed Logins", value: "3", hint: "24h", tone: "danger", href: "/admin/f/pl-04-session-login-audit" },
      { label: "Open Alerts", value: "1", hint: "Needs triage", tone: "danger" },
      { label: "MFA Coverage", value: "100%", hint: "Admin roles", tone: "up" },
    ],
  }),

  "/admin/help": makeDashboard({
    path: "/admin/help",
    title: "Help & Support",
    figmaId: "help",
    subtitle: "Guides, runbooks, and escalation paths for SIS administrators.",
    breadcrumbs: ["Home", "Help"],
    activeHref: "/admin",
    primaryAction: "Contact Support",
    kpis: [
      { label: "Articles", value: "48", hint: "Knowledge base", tone: "muted" },
      { label: "Open Tickets", value: "2", hint: "Your office", tone: "muted" },
      { label: "SLA", value: "4h", hint: "Target response", tone: "up" },
      { label: "Status", value: "OK", hint: "All systems", tone: "up" },
    ],
  }),

  "/admin/jobs": makeQueue({
    path: "/admin/jobs",
    title: "Background Jobs",
    figmaId: "jobs",
    subtitle: "Monitor scheduled and on-demand administrative job runs.",
    breadcrumbs: ["Home", "Jobs"],
    activeHref: "/admin",
    searchPlaceholder: "Search jobs…",
    countLabel: "12 recent jobs",
  }),

  "/admin/operations": makeDashboard({
    path: "/admin/operations",
    title: "Operations",
    figmaId: "ops",
    subtitle: "Day-to-day platform operations and runbook shortcuts.",
    breadcrumbs: ["Home", "Operations"],
    activeHref: "/admin",
    primaryAction: "Platform Ops",
    primaryActionHref: "/admin/f/pl-06-operations",
    kpis: [
      { label: "Incidents", value: "0", hint: "Open", tone: "up" },
      { label: "Deploys", value: "2", hint: "This week", tone: "muted" },
      { label: "Queues", value: "Healthy", hint: "Workers", tone: "up" },
      { label: "Backups", value: "OK", hint: "Last night", tone: "up" },
    ],
  }),

  "/admin/settings": makeDashboard({
    path: "/admin/settings",
    title: "Admin Settings",
    figmaId: "settings",
    subtitle: "Institution preferences and feature toggles.",
    breadcrumbs: ["Home", "Settings"],
    activeHref: "/admin",
    primaryAction: "Institution Settings",
    primaryActionHref: "/admin/f/pl-07-institution-settings",
    kpis: [
      { label: "Campus", value: "Main", hint: "Primary site", tone: "muted" },
      { label: "Locale", value: "en-CA", hint: "Default", tone: "muted" },
      { label: "Flags", value: "6", hint: "Feature toggles", tone: "muted", href: "/admin/audit" },
      { label: "Integrations", value: "8", hint: "Connected", tone: "up", href: "/admin/f/pl-05-integrations" },
    ],
  }),

  "/admin/corrections": makeQueue({
    path: "/admin/corrections",
    title: "Record Corrections",
    figmaId: "corrections",
    subtitle: "Queued academic and demographic correction requests.",
    breadcrumbs: ["Home", "Corrections"],
    activeHref: "/admin",
    primaryAction: "Registrar Correction",
    primaryActionHref: "/admin/f/rg-08-registrar-correction",
    searchPlaceholder: "Search corrections…",
    countLabel: "5 open corrections",
    rowHref: "/admin/f/rg-08-registrar-correction",
  }),

  "/admin/audit": makeQueue({
    path: "/admin/audit",
    title: "Audit Log",
    figmaId: "audit",
    subtitle: "Immutable administrative actions across the SIS.",
    breadcrumbs: ["Home", "Audit"],
    activeHref: "/admin",
    searchPlaceholder: "Search audit events…",
    countLabel: "248 events today",
  }),

};
