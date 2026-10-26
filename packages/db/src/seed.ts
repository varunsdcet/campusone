import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const INST = "11111111-1111-4111-8111-111111111111";
const ids = {
  marcusPerson: "22222222-2222-4222-8222-222222222201",
  priyaPerson: "22222222-2222-4222-8222-222222222202",
  danielPerson: "22222222-2222-4222-8222-222222222203",
  monicaPerson: "22222222-2222-4222-8222-222222222230",
  monicaAccount: "33333333-3333-4333-8333-333333333330",
  termPast: "55555555-5555-4555-8555-555555555502",
  vancePerson: "22222222-2222-4222-8222-222222222204",
  pendeltonPerson: "22222222-2222-4222-8222-222222222205",
  adminPerson: "22222222-2222-4222-8222-222222222206",
  marcusAccount: "33333333-3333-4333-8333-333333333301",
  priyaAccount: "33333333-3333-4333-8333-333333333302",
  danielAccount: "33333333-3333-4333-8333-333333333303",
  vanceAccount: "33333333-3333-4333-8333-333333333304",
  pendeltonAccount: "33333333-3333-4333-8333-333333333305",
  adminAccount: "33333333-3333-4333-8333-333333333306",
  marcusStudent: "44444444-4444-4444-8444-444444444401",
  priyaStudent: "44444444-4444-4444-8444-444444444402",
  danielStudent: "44444444-4444-4444-8444-444444444403",
  term: "55555555-5555-4555-8555-555555555501",
  cs301: "66666666-6666-4666-8666-666666666601",
  acc201: "66666666-6666-4666-8666-666666666602",
  sectionCs: "77777777-7777-4777-8777-777777777701",
  sectionAcc: "77777777-7777-4777-8777-777777777702",
  enrolMarcusCs: "88888888-8888-4888-8888-888888888801",
  enrolMarcusAcc: "88888888-8888-4888-8888-888888888802",
  enrolPriya: "88888888-8888-4888-8888-888888888803",
  enrolDaniel: "88888888-8888-4888-8888-888888888804",
  asgMidterm: "99999999-9999-4999-8999-999999999901",
  asgProject: "99999999-9999-4999-8999-999999999902",
  asgAccHw: "99999999-9999-4999-8999-999999999903",
  gradeMarcusMid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
  gradeMarcusProj: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
  gradePriyaMid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03",
  gradeDanielMid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04",
  gradeMarcusAcc: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05",
  thread1: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
  msg1: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
  approval1: "dddddddd-dddd-4ddd-8ddd-dddddddddd01",
  // Expanded campus roster (real domain entities — no Figma fixtures)
  jordanPerson: "22222222-2222-4222-8222-222222222208",
  meiPerson: "22222222-2222-4222-8222-222222222209",
  lucasPerson: "22222222-2222-4222-8222-222222222210",
  fatimaPerson: "22222222-2222-4222-8222-222222222211",
  jordanAccount: "33333333-3333-4333-8333-333333333307",
  meiAccount: "33333333-3333-4333-8333-333333333308",
  lucasAccount: "33333333-3333-4333-8333-333333333309",
  fatimaAccount: "33333333-3333-4333-8333-333333333310",
  noraPerson: "22222222-2222-4222-8222-222222222212",
  samPerson: "22222222-2222-4222-8222-222222222213",
  noraAccount: "33333333-3333-4333-8333-333333333311",
  samAccount: "33333333-3333-4333-8333-333333333312",
  jordanStudent: "44444444-4444-4444-8444-444444444404",
  meiStudent: "44444444-4444-4444-8444-444444444405",
  lucasStudent: "44444444-4444-4444-8444-444444444406",
  fatimaStudent: "44444444-4444-4444-8444-444444444407",
  nurs400: "66666666-6666-4666-8666-666666666603",
  eng110: "66666666-6666-4666-8666-666666666604",
  sectionNurs: "77777777-7777-4777-8777-777777777703",
  sectionEng: "77777777-7777-4777-8777-777777777704",
  enrolMeiNurs: "88888888-8888-4888-8888-888888888805",
  enrolJordanCs: "88888888-8888-4888-8888-888888888806",
  enrolLucasAcc: "88888888-8888-4888-8888-888888888807",
  enrolFatimaNurs: "88888888-8888-4888-8888-888888888808",
  enrolPriyaNurs: "88888888-8888-4888-8888-888888888809",
  asgNursClinic: "99999999-9999-4999-8999-999999999904",
  asgEngEssay: "99999999-9999-4999-8999-999999999905",
  gradeMeiClinic: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06",
  gradeJordanMid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07",
  gradeLucasHw: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08",
  gradeFatimaClinic: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09",
  approval2: "dddddddd-dddd-4ddd-8ddd-dddddddddd02",
  submissionMarcusProject: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01",
  sessionCsOnline: "ffffffff-ffff-4fff-8fff-fffffffff001",
  sessionAccRoom: "ffffffff-ffff-4fff-8fff-fffffffff002",
  applicantPerson: "22222222-2222-4222-8222-222222222212",
  employerPerson: "22222222-2222-4222-8222-222222222213",
  applicantAccount: "33333333-3333-4333-8333-333333333311",
  employerAccount: "33333333-3333-4333-8333-333333333312",
  application1: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a101",
  appDocPassport: "d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d001",
  appDocTranscript: "d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d002",
  appDocResume: "d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d003",
  appOffer1: "a55a55a5-a55a-4a55-8a55-a55a55a55a01",
  employerOrg1: "e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e001",
  placement1: "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a001",
  placement2: "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a002",
  hours1: "b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b001",
  hours2: "b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b002",
  eval1: "c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0e1",
  agreement1: "d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0e1",
  programCs: "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b101",
  programVersionCs: "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b201",
  cohortCsFall24: "c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0a1",
  planMarcus: "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d101",
  enrolMarcusEngWithdrawn: "88888888-8888-4888-8888-8888888888a1",
  enrolMarcusEngRetake: "88888888-8888-4888-8888-8888888888a2",
  evalMarcusAcc: "e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e101",
  math210: "66666666-6666-4666-8666-666666666605",
  stat310: "66666666-6666-4666-8666-666666666606",
  data401: "66666666-6666-4666-8666-666666666607",
  cs201: "66666666-6666-4666-8666-666666666608",
  knowledgeDegree: "a11a11a1-a11a-4a11-8a11-a11a11a11a01",
  knowledgeCalendar: "a11a11a1-a11a-4a11-8a11-a11a11a11a02",
  knowledgeServices: "a11a11a1-a11a-4a11-8a11-a11a11a11a03",
  knowledgeAdmissions: "a11a11a1-a11a-4a11-8a11-a11a11a11a04",
  knowledgeNormalization: "a11a11a1-a11a-4a11-8a11-a11a11a11a05",
  rubricCs: "a22a22a2-a22a-4a22-8a22-a22a22a22a01",
  rubricCrit1: "a22a22a2-a22a-4a22-8a22-a22a22a22a02",
  rubricCrit2: "a22a22a2-a22a-4a22-8a22-a22a22a22a03",
  career1: "c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c001",
  offeringMath: "a33a33a3-a33a-4a33-8a33-a33a33a33a01",
  transferMarcus: "a44a44a4-a44a-4a44-8a44-a44a44a44a01",
  sessionCsLab: "ffffffff-ffff-4fff-8fff-fffffffff003",
  assessmentCsQuiz: "a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a501",
  attendance1: "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a701",
  attendance2: "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a702",
  financeTuition: "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f101",
  financeLab: "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f102",
  financePayment: "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f103",
  financeTextbooks: "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f104",
  financeApplication: "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f105",
  financeSupplies: "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f106",
  credentialPending: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c101",
  credentialEarned: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c102",
  serviceReq1: "b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b301",
  placementMarcus: "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a003",
  // Extra CS roster for instructor Elena Vance (beyond the core 4)
  aishaStudentPerson: "22222222-2222-4222-8222-222222222220",
  benStudentPerson: "22222222-2222-4222-8222-222222222221",
  carmenStudentPerson: "22222222-2222-4222-8222-222222222222",
  diegoStudentPerson: "22222222-2222-4222-8222-222222222223",
  emilyStudentPerson: "22222222-2222-4222-8222-222222222224",
  aishaStudentAccount: "33333333-3333-4333-8333-333333333320",
  benStudentAccount: "33333333-3333-4333-8333-333333333321",
  carmenStudentAccount: "33333333-3333-4333-8333-333333333322",
  diegoStudentAccount: "33333333-3333-4333-8333-333333333323",
  emilyStudentAccount: "33333333-3333-4333-8333-333333333324",
  aishaStudent: "44444444-4444-4444-8444-444444444420",
  benStudent: "44444444-4444-4444-8444-444444444421",
  carmenStudent: "44444444-4444-4444-8444-444444444422",
  diegoStudent: "44444444-4444-4444-8444-444444444423",
  emilyStudent: "44444444-4444-4444-8444-444444444424",
};

type PortalSeed = {
  screenPath: string;
  role: string;
  primaryText: string;
  secondaryText?: string;
  metaText?: string;
  href?: string;
  sortOrder?: number;
  audienceAccountId?: string;
};

const PORTAL: PortalSeed[] = [
  // Student services
  { screenPath: "/student/fees", role: "student", primaryText: "Tuition Fall 2026", secondaryText: "Balance due", metaText: "CAD 2,450.00", href: "/student/fees", sortOrder: 1 },
  { screenPath: "/student/fees", role: "student", primaryText: "Lab fee CS301", secondaryText: "Paid Sep 2", metaText: "CAD 85.00", href: "/student/fees", sortOrder: 2 },
  { screenPath: "/student/documents", role: "student", primaryText: "Student ID card", secondaryText: "Digital wallet ready", metaText: "Active", href: "/student/documents", sortOrder: 1 },
  { screenPath: "/student/documents", role: "student", primaryText: "Unofficial transcript", secondaryText: "PDF available", metaText: "Download", href: "/student/documents", sortOrder: 2 },
  { screenPath: "/student/library", role: "student", primaryText: "Algorithms textbook", secondaryText: "Due in 12 days", metaText: "Checked out", href: "/student/library", sortOrder: 1 },
  { screenPath: "/student/library", role: "student", primaryText: "Library laptop loan", secondaryText: "Science Hall desk", metaText: "Available", href: "/student/library", sortOrder: 2 },
  { screenPath: "/student/advising", role: "student", primaryText: "Program check-in", secondaryText: "Advisor: Campus Success", metaText: "Booked", href: "/student/advising", sortOrder: 1 },
  { screenPath: "/student/holds", role: "student", primaryText: "No active holds", secondaryText: "Registration clear", metaText: "OK", href: "/student/holds", sortOrder: 1 },
  { screenPath: "/student/f/st-16-services", role: "student", primaryText: "Academic advising", secondaryText: "Program planning and registration support", metaText: "Available", href: "/student/advising", sortOrder: 1 },
  { screenPath: "/student/f/st-16-services", role: "student", primaryText: "Wellness and accessibility", secondaryText: "Confidential student support services", metaText: "Book", href: "/student/messages", sortOrder: 2 },
  { screenPath: "/student/f/st-17-practicum", role: "student", primaryText: "Practicum readiness", secondaryText: "Requirements and placement documents", metaText: "In progress", href: "/student/documents", sortOrder: 1 },
  { screenPath: "/student/f/st-19-credentials", role: "student", primaryText: "Computer Science diploma", secondaryText: "Credential progress follows your degree requirements", metaText: "In progress", href: "/student/degree", sortOrder: 1 },
  { screenPath: "/student/f/st-19-credentials", role: "student", primaryText: "Unofficial transcript", secondaryText: "Current academic record", metaText: "Available", href: "/student/documents", sortOrder: 2 },
  { screenPath: "/student/f/st-20-career", role: "student", primaryText: "Career coaching", secondaryText: "Resume, interview, and job-search support", metaText: "Book", href: "/student/messages", sortOrder: 1 },
  { screenPath: "/student/f/st-20-career", role: "student", primaryText: "Work-integrated learning", secondaryText: "Explore practicum and placement opportunities", metaText: "Explore", href: "/student/f/st-17-practicum", sortOrder: 2 },
  { screenPath: "/student/attendance", role: "student", primaryText: "CS301 attendance", secondaryText: "Present 11 / 12", metaText: "94%", href: "/student/attendance", sortOrder: 1 },
  { screenPath: "/student/attendance", role: "student", primaryText: "ACC201 attendance", secondaryText: "Present 10 / 11", metaText: "91%", href: "/student/attendance", sortOrder: 2 },
  { screenPath: "/student/lectures", role: "student", primaryText: "CS301 Lecture 8", secondaryText: "Online · Recording ready", metaText: "Join", href: "/student/lectures", sortOrder: 1 },
  { screenPath: "/student/labs", role: "student", primaryText: "Algorithms lab B", secondaryText: "Science Hall 110", metaText: "Thu 2pm", href: "/student/f/st-13-lab-detail", sortOrder: 1 },
  { screenPath: "/student/f/st-13-lab-detail", role: "student", primaryText: "Algorithms lab B", secondaryText: "Science Hall 110 · Thursday 2:00–4:00 PM", metaText: "Scheduled", href: "/student/labs", sortOrder: 1 },
  { screenPath: "/student/f/st-13-lab-detail", role: "student", primaryText: "Lab safety acknowledgement", secondaryText: "Required before practical work", metaText: "Complete", href: "/student/documents", sortOrder: 2 },
  { screenPath: "/student/announcements", role: "student", primaryText: "Fall reading week", secondaryText: "No classes Oct 13–17", metaText: "Campus", href: "/student/announcements", sortOrder: 1 },
  { screenPath: "/student/ask", role: "student", primaryText: "Ask MyHeritage", secondaryText: "Grounded answers with citations", metaText: "AI", href: "/student/ask", sortOrder: 1 },
  { screenPath: "/student/success", role: "student", primaryText: "Success plan", secondaryText: "Midterm coaching available", metaText: "Open", href: "/student/advising", sortOrder: 1 },
  { screenPath: "/student/success", role: "student", primaryText: "Study support", secondaryText: "Tutoring and learning strategy appointments", metaText: "Available", href: "/student/messages", sortOrder: 2 },
  { screenPath: "/student/*", role: "student", primaryText: "Campus services", secondaryText: "Live portal record", metaText: "Open", href: "/student", sortOrder: 1 },

  // Instructor
  { screenPath: "/instructor/tax-documents", role: "instructor", primaryText: "T4A Statement of Other Income — 2025", secondaryText: "T4A", metaText: "2025|available|2026-02-28T00:00:00.000Z", sortOrder: 1, audienceAccountId: ids.vanceAccount },
  { screenPath: "/instructor/tax-documents", role: "instructor", primaryText: "T4 Statement of Remuneration Paid — 2025", secondaryText: "T4", metaText: "2025|available|2026-02-28T00:00:00.000Z", sortOrder: 2, audienceAccountId: ids.vanceAccount },
  { screenPath: "/instructor/lectures", role: "instructor", primaryText: "CS301 Lecture 8", secondaryText: "Publish slides before 9am", metaText: "Today", href: "/instructor/lectures", sortOrder: 1 },
  { screenPath: "/instructor/labs", role: "instructor", primaryText: "Lab supervision CS301", secondaryText: "Science Hall 110", metaText: "Thu", href: "/instructor/labs", sortOrder: 1 },
  { screenPath: "/instructor/announcements", role: "instructor", primaryText: "Midterm review session", secondaryText: "Posted to CS301-01", metaText: "Sent", href: "/instructor/announcements", sortOrder: 1, audienceAccountId: ids.vanceAccount },
  { screenPath: "/instructor/studio", role: "instructor", primaryText: "AI course studio draft", secondaryText: "Outcome mapping ready", metaText: "Open", href: "/instructor/studio", sortOrder: 1 },
  { screenPath: "/instructor/modules", role: "instructor", primaryText: "Module 4 · Graphs", secondaryText: "CS301-01", metaText: "Published", href: "/instructor/modules", sortOrder: 1 },
  { screenPath: "/instructor/*", role: "instructor", primaryText: "Teaching workspace", secondaryText: "Live portal record", metaText: "Open", href: "/instructor", sortOrder: 1 },

  // Admin domains
  { screenPath: "/admin/finance", role: "admin", primaryText: "Refund queue", secondaryText: "8 student refunds awaiting auth", metaText: "Urgent", href: "/admin/refunds", sortOrder: 1 },
  { screenPath: "/admin/payments", role: "admin", primaryText: "Tuition batch T-2026F-09", secondaryText: "Cleared CAD 184,200", metaText: "Posted", href: "/admin/payments", sortOrder: 1 },
  { screenPath: "/admin/refunds", role: "admin", primaryText: "Refund · Daniel Okafor", secondaryText: "Tuition adjustment", metaText: "Pending", href: "/admin/refunds", sortOrder: 1 },
  { screenPath: "/admin/admissions", role: "admin", primaryText: "Application queue", secondaryText: "14 awaiting verification", metaText: "Open", href: "/admin/admissions", sortOrder: 1 },
  { screenPath: "/admin/crm", role: "admin", primaryText: "Counsellor queue", secondaryText: "7 leads this week", metaText: "CRM", href: "/admin/crm", sortOrder: 1 },
  { screenPath: "/admin/compliance", role: "admin", primaryText: "Curriculum policy audit", secondaryText: "3 packs pending", metaText: "Review", href: "/admin/compliance", sortOrder: 1 },
  { screenPath: "/admin/programs", role: "admin", primaryText: "Computer Science diploma", secondaryText: "Active · Fall 2026", metaText: "AC", href: "/admin/programs", sortOrder: 1 },
  { screenPath: "/admin/terms", role: "admin", primaryText: "Fall 2026", secondaryText: "2026-09-01 → 2026-12-18", metaText: "Current", href: "/admin/terms", sortOrder: 1 },
  { screenPath: "/admin/integrations", role: "admin", primaryText: "SIS sync", secondaryText: "Healthy · last run 4m ago", metaText: "OK", href: "/admin/integrations", sortOrder: 1 },
  { screenPath: "/admin/operations", role: "admin", primaryText: "Outbox worker", secondaryText: "Queue depth 0", metaText: "Healthy", href: "/admin/operations", sortOrder: 1 },
  { screenPath: "/admin/settings", role: "admin", primaryText: "Institution settings", secondaryText: "Heritage College · CAD", metaText: "Edit", href: "/admin/settings", sortOrder: 1 },
  { screenPath: "/admin/ai", role: "admin", primaryText: "AI evaluation dashboard", secondaryText: "Citation failures: 0", metaText: "Monitor", href: "/admin/ai", sortOrder: 1 },
  { screenPath: "/admin/analytics", role: "admin", primaryText: "Enrolment funnel", secondaryText: "Live dashboards", metaText: "Open", href: "/admin/analytics", sortOrder: 1 },
  { screenPath: "/admin/*", role: "admin", primaryText: "Administration record", secondaryText: "Live portal data", metaText: "Open", href: "/admin", sortOrder: 1 },

  // Applicant / employer
  { screenPath: "/applicant/application", role: "applicant", primaryText: "Application draft", secondaryText: "Nursing diploma", metaText: "In progress", href: "/applicant/application", sortOrder: 1 },
  { screenPath: "/applicant/documents", role: "applicant", primaryText: "Passport scan", secondaryText: "Awaiting review", metaText: "Uploaded", href: "/applicant/documents", sortOrder: 1 },
  { screenPath: "/applicant/offers", role: "applicant", primaryText: "Conditional offer", secondaryText: "Fall 2026 intake", metaText: "Review", href: "/applicant/offers", sortOrder: 1 },
  { screenPath: "/applicant/*", role: "applicant", primaryText: "Applicant workspace", secondaryText: "Live portal data", metaText: "Open", href: "/applicant", sortOrder: 1 },
  { screenPath: "/employer/placements", role: "employer", primaryText: "Practicum site A", secondaryText: "2 active students", metaText: "Open", href: "/employer/placements", sortOrder: 1 },
  { screenPath: "/employer/hours", role: "employer", primaryText: "Hours log week 38", secondaryText: "Awaiting sign-off", metaText: "Pending", href: "/employer/hours", sortOrder: 1 },
  { screenPath: "/employer/*", role: "employer", primaryText: "Employer workspace", secondaryText: "Live portal data", metaText: "Open", href: "/employer", sortOrder: 1 },

  // Mobile mirrors
  { screenPath: "/m/student/fees", role: "student", primaryText: "Tuition balance", secondaryText: "CAD 2,450.00", metaText: "Due", href: "/m/student/fees", sortOrder: 1 },
  { screenPath: "/m/student/library", role: "student", primaryText: "Checked-out items", secondaryText: "1 textbook", metaText: "Open", href: "/m/student/library", sortOrder: 1 },
  { screenPath: "/m/student/documents", role: "student", primaryText: "Student ID", secondaryText: "Digital card", metaText: "Show", href: "/m/student/documents", sortOrder: 1 },
  { screenPath: "/m/instructor/attendance", role: "instructor", primaryText: "CS301-01 roster", secondaryText: "Mark today's session", metaText: "Open", href: "/m/instructor/attendance", sortOrder: 1 },
  { screenPath: "/student/courses", role: "student", primaryText: "Courses record", secondaryText: "Live campus data for /student/courses", metaText: "Open", href: "/student/courses", sortOrder: 1 },
  { screenPath: "/student/courses/demo", role: "student", primaryText: "Demo record", secondaryText: "Live campus data for /student/courses/demo", metaText: "Open", href: "/student/courses/demo", sortOrder: 1 },
  { screenPath: "/student/modules", role: "student", primaryText: "Modules record", secondaryText: "Live campus data for /student/modules", metaText: "Open", href: "/student/modules", sortOrder: 1 },
  { screenPath: "/student/continue", role: "student", primaryText: "Continue record", secondaryText: "Live campus data for /student/continue", metaText: "Open", href: "/student/continue", sortOrder: 1 },
  { screenPath: "/student/assessments", role: "student", primaryText: "Assessments record", secondaryText: "Live campus data for /student/assessments", metaText: "Open", href: "/student/assessments", sortOrder: 1 },
  { screenPath: "/student/grades", role: "student", primaryText: "Grades record", secondaryText: "Live campus data for /student/grades", metaText: "Open", href: "/student/grades", sortOrder: 1 },
  { screenPath: "/student/calendar", role: "student", primaryText: "Calendar record", secondaryText: "Live campus data for /student/calendar", metaText: "Open", href: "/student/calendar", sortOrder: 1 },
  { screenPath: "/student/profile", role: "student", primaryText: "Profile record", secondaryText: "Live campus data for /student/profile", metaText: "Open", href: "/student/profile", sortOrder: 1 },
  { screenPath: "/student/notifications", role: "student", primaryText: "Notifications record", secondaryText: "Live campus data for /student/notifications", metaText: "Open", href: "/student/notifications", sortOrder: 1 },
  { screenPath: "/student/messages", role: "student", primaryText: "Messages record", secondaryText: "Live campus data for /student/messages", metaText: "Open", href: "/student/messages", sortOrder: 1 },
  { screenPath: "/instructor/sections", role: "instructor", primaryText: "Sections record", secondaryText: "Live campus data for /instructor/sections", metaText: "Open", href: "/instructor/sections", sortOrder: 1 },
  { screenPath: "/instructor/sections/demo", role: "instructor", primaryText: "Demo record", secondaryText: "Live campus data for /instructor/sections/demo", metaText: "Open", href: "/instructor/sections/demo", sortOrder: 1 },
  { screenPath: "/instructor/assessments", role: "instructor", primaryText: "Assessments record", secondaryText: "Live campus data for /instructor/assessments", metaText: "Open", href: "/instructor/assessments", sortOrder: 1 },
  { screenPath: "/instructor/submissions", role: "instructor", primaryText: "Submissions record", secondaryText: "Live campus data for /instructor/submissions", metaText: "Open", href: "/instructor/submissions", sortOrder: 1 },
  { screenPath: "/instructor/gradebook", role: "instructor", primaryText: "Gradebook record", secondaryText: "Live campus data for /instructor/gradebook", metaText: "Open", href: "/instructor/gradebook", sortOrder: 1 },
  { screenPath: "/instructor/attendance", role: "instructor", primaryText: "Attendance record", secondaryText: "Live campus data for /instructor/attendance", metaText: "Open", href: "/instructor/attendance", sortOrder: 1 },
  { screenPath: "/instructor/profile", role: "instructor", primaryText: "Profile record", secondaryText: "Live campus data for /instructor/profile", metaText: "Open", href: "/instructor/profile", sortOrder: 1 },
  { screenPath: "/instructor/notifications", role: "instructor", primaryText: "Notifications record", secondaryText: "Live campus data for /instructor/notifications", metaText: "Open", href: "/instructor/notifications", sortOrder: 1 },
  { screenPath: "/instructor/messages", role: "instructor", primaryText: "Messages record", secondaryText: "Live campus data for /instructor/messages", metaText: "Open", href: "/instructor/messages", sortOrder: 1 },
  { screenPath: "/instructor/calendar", role: "instructor", primaryText: "Calendar record", secondaryText: "Live campus data for /instructor/calendar", metaText: "Open", href: "/instructor/calendar", sortOrder: 1 },
  { screenPath: "/instructor/roster", role: "instructor", primaryText: "Roster record", secondaryText: "Live campus data for /instructor/roster", metaText: "Open", href: "/instructor/roster", sortOrder: 1 },
  { screenPath: "/admin/notifications", role: "admin", primaryText: "Notifications record", secondaryText: "Live campus data for /admin/notifications", metaText: "Open", href: "/admin/notifications", sortOrder: 1 },
  { screenPath: "/admin/calendar", role: "admin", primaryText: "Calendar record", secondaryText: "Live campus data for /admin/calendar", metaText: "Open", href: "/admin/calendar", sortOrder: 1 },
  { screenPath: "/admin/profile", role: "admin", primaryText: "Profile record", secondaryText: "Live campus data for /admin/profile", metaText: "Open", href: "/admin/profile", sortOrder: 1 },
  { screenPath: "/admin/security", role: "admin", primaryText: "Security record", secondaryText: "Live campus data for /admin/security", metaText: "Open", href: "/admin/security", sortOrder: 1 },
  { screenPath: "/admin/help", role: "admin", primaryText: "Help record", secondaryText: "Live campus data for /admin/help", metaText: "Open", href: "/admin/help", sortOrder: 1 },
  { screenPath: "/admin/approvals", role: "admin", primaryText: "Approvals record", secondaryText: "Live campus data for /admin/approvals", metaText: "Open", href: "/admin/approvals", sortOrder: 1 },
  { screenPath: "/admin/users", role: "admin", primaryText: "Users record", secondaryText: "Live campus data for /admin/users", metaText: "Open", href: "/admin/users", sortOrder: 1 },
  { screenPath: "/admin/permissions", role: "admin", primaryText: "Permissions record", secondaryText: "Live campus data for /admin/permissions", metaText: "Open", href: "/admin/permissions", sortOrder: 1 },
  { screenPath: "/admin/templates", role: "admin", primaryText: "Templates record", secondaryText: "Live campus data for /admin/templates", metaText: "Open", href: "/admin/templates", sortOrder: 1 },
  { screenPath: "/admin/search", role: "admin", primaryText: "Search record", secondaryText: "Live campus data for /admin/search", metaText: "Open", href: "/admin/search", sortOrder: 1 },
  { screenPath: "/admin/platform", role: "admin", primaryText: "Platform record", secondaryText: "Live campus data for /admin/platform", metaText: "Open", href: "/admin/platform", sortOrder: 1 },
  { screenPath: "/admin/flags", role: "admin", primaryText: "Flags record", secondaryText: "Live campus data for /admin/flags", metaText: "Open", href: "/admin/flags", sortOrder: 1 },
  { screenPath: "/admin/audit", role: "admin", primaryText: "Audit record", secondaryText: "Live campus data for /admin/audit", metaText: "Open", href: "/admin/audit", sortOrder: 1 },
  { screenPath: "/admin/files", role: "admin", primaryText: "Files record", secondaryText: "Live campus data for /admin/files", metaText: "Open", href: "/admin/files", sortOrder: 1 },
  { screenPath: "/admin/jobs", role: "admin", primaryText: "Jobs record", secondaryText: "Live campus data for /admin/jobs", metaText: "Open", href: "/admin/jobs", sortOrder: 1 },
  { screenPath: "/admin/courses", role: "admin", primaryText: "Courses record", secondaryText: "Live campus data for /admin/courses", metaText: "Open", href: "/admin/courses", sortOrder: 1 },
  { screenPath: "/admin/sections", role: "admin", primaryText: "Sections record", secondaryText: "Live campus data for /admin/sections", metaText: "Open", href: "/admin/sections", sortOrder: 1 },
  { screenPath: "/admin/schedule", role: "admin", primaryText: "Schedule record", secondaryText: "Live campus data for /admin/schedule", metaText: "Open", href: "/admin/schedule", sortOrder: 1 },
  { screenPath: "/admin/students", role: "admin", primaryText: "Students record", secondaryText: "Live campus data for /admin/students", metaText: "Open", href: "/admin/students", sortOrder: 1 },
  { screenPath: "/admin/records", role: "admin", primaryText: "Records record", secondaryText: "Live campus data for /admin/records", metaText: "Open", href: "/admin/records", sortOrder: 1 },
  { screenPath: "/admin/transcripts", role: "admin", primaryText: "Transcripts record", secondaryText: "Live campus data for /admin/transcripts", metaText: "Open", href: "/admin/transcripts", sortOrder: 1 },
  { screenPath: "/admin/corrections", role: "admin", primaryText: "Corrections record", secondaryText: "Live campus data for /admin/corrections", metaText: "Open", href: "/admin/corrections", sortOrder: 1 },
  { screenPath: "/admin/success", role: "admin", primaryText: "Success record", secondaryText: "Live campus data for /admin/success", metaText: "Open", href: "/admin/success", sortOrder: 1 },
  { screenPath: "/admin/workflows", role: "admin", primaryText: "Workflows record", secondaryText: "Live campus data for /admin/workflows", metaText: "Open", href: "/admin/workflows", sortOrder: 1 },
  { screenPath: "/admin/rules", role: "admin", primaryText: "Rules record", secondaryText: "Live campus data for /admin/rules", metaText: "Open", href: "/admin/rules", sortOrder: 1 },
  { screenPath: "/admin/forms", role: "admin", primaryText: "Forms record", secondaryText: "Live campus data for /admin/forms", metaText: "Open", href: "/admin/forms", sortOrder: 1 },
  { screenPath: "/admin/labs", role: "admin", primaryText: "Labs record", secondaryText: "Live campus data for /admin/labs", metaText: "Open", href: "/admin/labs", sortOrder: 1 },
  { screenPath: "/admin/practicum", role: "admin", primaryText: "Practicum record", secondaryText: "Live campus data for /admin/practicum", metaText: "Open", href: "/admin/practicum", sortOrder: 1 },
  { screenPath: "/applicant", role: "applicant", primaryText: "Applicant record", secondaryText: "Live campus data for /applicant", metaText: "Open", href: "/applicant", sortOrder: 1 },
  { screenPath: "/applicant/messages", role: "applicant", primaryText: "Messages record", secondaryText: "Live campus data for /applicant/messages", metaText: "Open", href: "/applicant/messages", sortOrder: 1 },
  { screenPath: "/applicant/timeline", role: "applicant", primaryText: "Timeline record", secondaryText: "Live campus data for /applicant/timeline", metaText: "Open", href: "/applicant/timeline", sortOrder: 1 },
  { screenPath: "/employer", role: "employer", primaryText: "Employer record", secondaryText: "Live campus data for /employer", metaText: "Open", href: "/employer", sortOrder: 1 },
  { screenPath: "/employer/evaluations", role: "employer", primaryText: "Evaluations record", secondaryText: "Live campus data for /employer/evaluations", metaText: "Open", href: "/employer/evaluations", sortOrder: 1 },
  { screenPath: "/employer/agreements", role: "employer", primaryText: "Agreements record", secondaryText: "Live campus data for /employer/agreements", metaText: "Open", href: "/employer/agreements", sortOrder: 1 },
  { screenPath: "/employer/profile", role: "employer", primaryText: "Profile record", secondaryText: "Live campus data for /employer/profile", metaText: "Open", href: "/employer/profile", sortOrder: 1 },
  { screenPath: "/m/student/courses", role: "student", primaryText: "Courses record", secondaryText: "Live campus data for /m/student/courses", metaText: "Open", href: "/m/student/courses", sortOrder: 1 },
  { screenPath: "/m/student/grades", role: "student", primaryText: "Grades record", secondaryText: "Live campus data for /m/student/grades", metaText: "Open", href: "/m/student/grades", sortOrder: 1 },
  { screenPath: "/m/student/profile", role: "student", primaryText: "Profile record", secondaryText: "Live campus data for /m/student/profile", metaText: "Open", href: "/m/student/profile", sortOrder: 1 },
  { screenPath: "/m/instructor/grades", role: "instructor", primaryText: "Grades record", secondaryText: "Live campus data for /m/instructor/grades", metaText: "Open", href: "/m/instructor/grades", sortOrder: 1 },
  { screenPath: "/m/instructor/home", role: "instructor", primaryText: "Home record", secondaryText: "Live campus data for /m/instructor/home", metaText: "Open", href: "/m/instructor/home", sortOrder: 1 },
];

/** The seed wipes every table first; refuse to run against a database holding real data unless explicitly told to. */
async function assertSafeToWipe() {
  if (process.env.SEED_ALLOW_WIPE === "yes-wipe-everything") return;
  const seeded = Object.values(ids);
  const realAccounts = await prisma.account.count({ where: { id: { notIn: seeded } } }).catch(() => 0);
  const production = process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
  if (production || realAccounts > 0) {
    console.error(
      `Refusing to seed: ${production ? "this is a production environment" : `${realAccounts} non-seed account(s) exist`}. ` +
        "The seed deletes every table. Set SEED_ALLOW_WIPE=yes-wipe-everything only on a disposable database.",
    );
    process.exit(1);
  }
}

async function main() {
  await assertSafeToWipe();
  await prisma.$executeRawUnsafe(`DELETE FROM "MailThreadPlacement"`).catch(() => undefined);
  await prisma.mailThreadPlacement.deleteMany().catch(() => undefined);
  await prisma.mailFolder.deleteMany().catch(() => undefined);
  await prisma.mailboxSettings.deleteMany().catch(() => undefined);
  await prisma.courseLesson.deleteMany().catch(() => undefined);
  await prisma.courseDayBlock.deleteMany().catch(() => undefined);
  // Hard delete in case client/model lag leaves FK rows behind
  await prisma.$executeRawUnsafe(`DELETE FROM "CourseLesson"`).catch(() => undefined);
  await prisma.$executeRawUnsafe(`DELETE FROM "CourseDayBlock"`).catch(() => undefined);
  await prisma.courseFolderItem.deleteMany().catch(() => undefined);
  await prisma.courseFolder.deleteMany().catch(() => undefined);
  await prisma.syllabusTopic.deleteMany().catch(() => undefined);
  await prisma.assessmentAttempt.deleteMany().catch(() => undefined);
  await prisma.assessment.deleteMany().catch(() => undefined);
  await prisma.attendanceRecord.deleteMany().catch(() => undefined);
  await prisma.labNotebookEntry.deleteMany().catch(() => undefined);
  await prisma.serviceRequest.deleteMany().catch(() => undefined);
  await prisma.financeLedgerEntry.deleteMany().catch(() => undefined);
  await prisma.credentialRecord.deleteMany().catch(() => undefined);
  await prisma.sisScreenState.deleteMany().catch(() => undefined);
  await prisma.portalRecord.deleteMany().catch(() => undefined);
  await prisma.aiInteraction.deleteMany().catch(() => undefined);
  await prisma.applicationTimelineEvent.deleteMany().catch(() => undefined);
  await prisma.applicationDocument.deleteMany().catch(() => undefined);
  await prisma.applicationOffer.deleteMany().catch(() => undefined);
  await prisma.admissionsApplication.deleteMany().catch(() => undefined);
  await prisma.hoursEntry.deleteMany().catch(() => undefined);
  await prisma.placementEvaluation.deleteMany().catch(() => undefined);
  await prisma.affiliationAgreement.deleteMany().catch(() => undefined);
  await prisma.placement.deleteMany().catch(() => undefined);
  await prisma.employerOrg.deleteMany().catch(() => undefined);
  await prisma.passwordResetToken.deleteMany().catch(() => undefined);
  await prisma.idempotencyKey.deleteMany();
  await prisma.$executeRawUnsafe(`DELETE FROM "MailThreadPlacement"`).catch(() => undefined);
  await prisma.mailThreadPlacement.deleteMany().catch(() => undefined);
  await prisma.message.deleteMany();
  await prisma.messageThread.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.eventOutbox.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.gradeItem.deleteMany();
  await prisma.fileObject.deleteMany().catch(() => undefined);
  await prisma.submission.deleteMany().catch(() => undefined);
  await prisma.assignment.deleteMany();
  await prisma.courseEvaluation.deleteMany().catch(() => undefined);
  await prisma.programPlanItem.deleteMany().catch(() => undefined);
  await prisma.programPlan.deleteMany().catch(() => undefined);
  await prisma.workshopRegistration.deleteMany().catch(() => undefined);
  await prisma.workshop.deleteMany().catch(() => undefined);
  await prisma.leaveOfAbsenceRequest.deleteMany().catch(() => undefined);
  await prisma.requiredTask.deleteMany().catch(() => undefined);
  await prisma.taxDocument.deleteMany().catch(() => undefined);
  await prisma.studentDocument.deleteMany().catch(() => undefined);
  await prisma.extracurricularRecord.deleteMany().catch(() => undefined);
  await prisma.studentBadge.deleteMany().catch(() => undefined);
  await prisma.enrolment.deleteMany();
  await prisma.classSession.deleteMany().catch(() => undefined);
  await prisma.section.deleteMany();
  await prisma.academicBlock.deleteMany().catch(() => undefined);
  await prisma.degreePlanScenario.deleteMany().catch(() => undefined);
  await prisma.degreeRequirement.deleteMany().catch(() => undefined);
  await prisma.coursePrerequisite.deleteMany().catch(() => undefined);
  await prisma.courseCorequisite.deleteMany().catch(() => undefined);
  await prisma.courseOffering.deleteMany().catch(() => undefined);
  await prisma.transferCredit.deleteMany().catch(() => undefined);
  await prisma.careerOpportunity.deleteMany().catch(() => undefined);
  await prisma.interventionTask.deleteMany().catch(() => undefined);
  await prisma.successCase.deleteMany().catch(() => undefined);
  await prisma.advisingAppointment.deleteMany().catch(() => undefined);
  await prisma.rubricCriterion.deleteMany().catch(() => undefined);
  await prisma.rubric.deleteMany().catch(() => undefined);
  await prisma.knowledgeDocument.deleteMany().catch(() => undefined);
  await prisma.course.deleteMany();
  await prisma.term.deleteMany();
  await prisma.student.deleteMany();
  await prisma.financialTerm.deleteMany().catch(() => undefined);
  await prisma.cohort.deleteMany().catch(() => undefined);
  await prisma.programVersion.deleteMany().catch(() => undefined);
  await prisma.program.deleteMany().catch(() => undefined);
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.person.deleteMany();
  await prisma.securityPolicy.deleteMany();
  await prisma.institution.deleteMany();

  const passwordHash = await bcrypt.hash("Heritage!2026", 10);

  await prisma.institution.create({
    data: {
      id: INST,
      institutionId: INST,
      name: "Heritage College",
      legalName: "Heritage College of Applied Arts",
      addressLine1: "12345 King George Blvd",
      city: "Surrey",
      region: "BC",
      postalCode: "V3T 2W1",
      country: "CA",
    },
  });

  await prisma.securityPolicy.create({
    data: { institutionId: INST, maxConcurrentSessions: 3, sharedIpAlertWindowMinutes: 5 },
  });

  const people = [
    { id: ids.marcusPerson, givenName: "Marcus", familyName: "Vance", email: "marcus.vance@heritage.edu", dateOfBirth: "2003-11-14" },
    { id: ids.priyaPerson, givenName: "Priya", familyName: "Sandhu", email: "priya.sandhu@heritage.edu", dateOfBirth: "2002-04-09" },
    { id: ids.danielPerson, givenName: "Daniel", familyName: "Okafor", email: "daniel.okafor@heritage.edu", dateOfBirth: "2001-08-22" },
    { id: ids.vancePerson, givenName: "Elena", familyName: "Vance", email: "vance.instructor@heritage.edu" },
    { id: ids.monicaPerson, givenName: "Monica", familyName: "Dahiya", email: "monica.dahiya@myhccbc.com" },
    { id: ids.pendeltonPerson, givenName: "James", familyName: "Pendelton", email: "pendelton@heritage.edu" },
    { id: ids.adminPerson, givenName: "Aisha", familyName: "Khan", email: "admin@heritage.edu" },
    { id: ids.jordanPerson, givenName: "Jordan", familyName: "Lee", email: "jordan.lee@heritage.edu", dateOfBirth: "2004-02-18" },
    { id: ids.meiPerson, givenName: "Mei", familyName: "Chen", email: "mei.chen@heritage.edu", dateOfBirth: "2003-06-03" },
    { id: ids.lucasPerson, givenName: "Lucas", familyName: "Moreau", email: "lucas.moreau@heritage.edu", dateOfBirth: "2002-12-11" },
    { id: ids.fatimaPerson, givenName: "Fatima", familyName: "Hassan", email: "fatima.hassan@heritage.edu", dateOfBirth: "2003-09-27" },
    { id: ids.aishaStudentPerson, givenName: "Aisha", familyName: "Patel", email: "aisha.patel@heritage.edu", dateOfBirth: "2004-05-12" },
    { id: ids.benStudentPerson, givenName: "Ben", familyName: "Nguyen", email: "ben.nguyen@heritage.edu", dateOfBirth: "2003-03-21" },
    { id: ids.carmenStudentPerson, givenName: "Carmen", familyName: "Silva", email: "carmen.silva@heritage.edu", dateOfBirth: "2002-11-08" },
    { id: ids.diegoStudentPerson, givenName: "Diego", familyName: "Romero", email: "diego.romero@heritage.edu", dateOfBirth: "2004-07-30" },
    { id: ids.emilyStudentPerson, givenName: "Emily", familyName: "Brooks", email: "emily.brooks@heritage.edu", dateOfBirth: "2003-01-15" },
    { id: ids.applicantPerson, givenName: "Nora", familyName: "Reyes", email: "nora.reyes@applicant.heritage.edu", dateOfBirth: "2004-01-20" },
    { id: ids.employerPerson, givenName: "Sam", familyName: "Okello", email: "sam.okello@fraserhealth.partner" },
  ];

  for (const p of people) {
    await prisma.person.create({ data: { ...p, institutionId: INST } });
  }

  const accounts = [
    { id: ids.marcusAccount, personId: ids.marcusPerson, email: "marcus.vance@heritage.edu", roles: ["student"] },
    { id: ids.priyaAccount, personId: ids.priyaPerson, email: "priya.sandhu@heritage.edu", roles: ["student"] },
    { id: ids.danielAccount, personId: ids.danielPerson, email: "daniel.okafor@heritage.edu", roles: ["student"] },
    { id: ids.vanceAccount, personId: ids.vancePerson, email: "vance.instructor@heritage.edu", roles: ["instructor"] },
    { id: ids.monicaAccount, personId: ids.monicaPerson, email: "monica.dahiya@myhccbc.com", roles: ["instructor"] },
    { id: ids.pendeltonAccount, personId: ids.pendeltonPerson, email: "pendelton@heritage.edu", roles: ["instructor"] },
    { id: ids.adminAccount, personId: ids.adminPerson, email: "admin@heritage.edu", roles: ["admin", "registrar"] },
    { id: ids.jordanAccount, personId: ids.jordanPerson, email: "jordan.lee@heritage.edu", roles: ["student"] },
    { id: ids.meiAccount, personId: ids.meiPerson, email: "mei.chen@heritage.edu", roles: ["student"] },
    { id: ids.lucasAccount, personId: ids.lucasPerson, email: "lucas.moreau@heritage.edu", roles: ["student"] },
    { id: ids.fatimaAccount, personId: ids.fatimaPerson, email: "fatima.hassan@heritage.edu", roles: ["student"] },
    { id: ids.aishaStudentAccount, personId: ids.aishaStudentPerson, email: "aisha.patel@heritage.edu", roles: ["student"] },
    { id: ids.benStudentAccount, personId: ids.benStudentPerson, email: "ben.nguyen@heritage.edu", roles: ["student"] },
    { id: ids.carmenStudentAccount, personId: ids.carmenStudentPerson, email: "carmen.silva@heritage.edu", roles: ["student"] },
    { id: ids.diegoStudentAccount, personId: ids.diegoStudentPerson, email: "diego.romero@heritage.edu", roles: ["student"] },
    { id: ids.emilyStudentAccount, personId: ids.emilyStudentPerson, email: "emily.brooks@heritage.edu", roles: ["student"] },
    { id: ids.applicantAccount, personId: ids.applicantPerson, email: "nora.reyes@applicant.heritage.edu", roles: ["applicant"] },
    { id: ids.employerAccount, personId: ids.employerPerson, email: "sam.okello@fraserhealth.partner", roles: ["employer"] },
  ];

  for (const a of accounts) {
    await prisma.account.create({
      data: {
        id: a.id,
        institutionId: INST,
        personId: a.personId,
        email: a.email,
        passwordHash,
        rolesJson: JSON.stringify(a.roles),
      },
    });
  }

  await prisma.student.createMany({
    data: [
      { id: ids.marcusStudent, institutionId: INST, personId: ids.marcusPerson, studentNumber: "ST-2024-001", programName: "Computer Science", standing: "good" },
      { id: ids.priyaStudent, institutionId: INST, personId: ids.priyaPerson, studentNumber: "ST-2024-014", programName: "Nursing", standing: "good" },
      { id: ids.danielStudent, institutionId: INST, personId: ids.danielPerson, studentNumber: "ST-2023-088", programName: "Computer Science", standing: "alert" },
      { id: ids.jordanStudent, institutionId: INST, personId: ids.jordanPerson, studentNumber: "ST-2025-022", programName: "Computer Science", standing: "good" },
      { id: ids.meiStudent, institutionId: INST, personId: ids.meiPerson, studentNumber: "ST-2025-031", programName: "Nursing", standing: "good" },
      { id: ids.lucasStudent, institutionId: INST, personId: ids.lucasPerson, studentNumber: "ST-2024-055", programName: "Business Administration", standing: "good" },
      { id: ids.fatimaStudent, institutionId: INST, personId: ids.fatimaPerson, studentNumber: "ST-2025-044", programName: "Nursing", standing: "probation" },
      { id: ids.aishaStudent, institutionId: INST, personId: ids.aishaStudentPerson, studentNumber: "ST-2025-051", programName: "Computer Science", standing: "good" },
      { id: ids.benStudent, institutionId: INST, personId: ids.benStudentPerson, studentNumber: "ST-2025-052", programName: "Computer Science", standing: "good" },
      { id: ids.carmenStudent, institutionId: INST, personId: ids.carmenStudentPerson, studentNumber: "ST-2024-061", programName: "Computer Science", standing: "warning" },
      { id: ids.diegoStudent, institutionId: INST, personId: ids.diegoStudentPerson, studentNumber: "ST-2025-053", programName: "Computer Science", standing: "good" },
      { id: ids.emilyStudent, institutionId: INST, personId: ids.emilyStudentPerson, studentNumber: "ST-2024-062", programName: "Computer Science", standing: "good" },
    ],
  });

  await prisma.term.create({
    data: {
      id: ids.term,
      institutionId: INST,
      code: "2026F",
      name: "Fall 2026",
      startsOn: "2026-09-01",
      endsOn: "2026-12-18",
    },
  });

  await prisma.course.createMany({
    data: [
      { id: ids.cs301, institutionId: INST, code: "CS301", title: "Algorithms", credits: 3 },
      { id: ids.acc201, institutionId: INST, code: "ACC201", title: "Financial Accounting", credits: 3 },
      { id: ids.nurs400, institutionId: INST, code: "NURS400", title: "Clinical Practicum IV", credits: 4 },
      { id: ids.eng110, institutionId: INST, code: "ENG110", title: "Academic Writing", credits: 3 },
      { id: ids.cs201, institutionId: INST, code: "CS201", title: "Data Structures", credits: 3 },
      { id: ids.math210, institutionId: INST, code: "MATH210", title: "Discrete Mathematics", credits: 3 },
      { id: ids.stat310, institutionId: INST, code: "STAT310", title: "Applied Statistics", credits: 3 },
      { id: ids.data401, institutionId: INST, code: "DATA401", title: "Data Engineering", credits: 3 },
    ],
  });

  await prisma.program.create({
    data: {
      id: ids.programCs,
      institutionId: INST,
      code: "CS-DIP",
      name: "Computer Science",
      awardLevel: "diploma",
    },
  });
  await prisma.programVersion.create({
    data: {
      id: ids.programVersionCs,
      institutionId: INST,
      programId: ids.programCs,
      label: "2024.1",
      effectiveOn: "2024-09-01",
      totalCredits: 27,
      status: "active",
    },
  });
  await prisma.cohort.create({
    data: {
      id: ids.cohortCsFall24,
      institutionId: INST,
      programId: ids.programCs,
      code: "CS-2024-FALL-A",
      label: "Computer Science · Fall 2024 · Section A",
      intakeYear: 2024,
      intakeMonth: 9,
      sectionLabel: "A",
    },
  });
  await prisma.student.update({
    where: { id: ids.marcusStudent },
    data: { programVersionId: ids.programVersionCs, cohortId: ids.cohortCsFall24 },
  });
  await prisma.programPlan.create({
    data: {
      id: ids.planMarcus,
      institutionId: INST,
      studentId: ids.marcusStudent,
      cohortId: ids.cohortCsFall24,
      status: "active",
      items: {
        create: [
          {
            id: "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f901",
            institutionId: INST,
            courseId: ids.cs201,
            courseCode: "CS201",
            title: "Data Structures",
            credits: 3,
            sortOrder: 1,
            category: "main",
            status: "completed",
            startsOn: "2025-09-01",
            endsOn: "2025-10-10",
            scheduleText: "Mon/Wed 09:00–12:00",
          },
          {
            id: "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f902",
            institutionId: INST,
            courseId: ids.cs301,
            courseCode: "CS301",
            title: "Algorithms",
            credits: 3,
            sortOrder: 2,
            category: "main",
            status: "in_progress",
            startsOn: "2026-09-01",
            endsOn: "2026-10-17",
            scheduleText: "Tue/Thu 10:00–13:00",
            sectionId: ids.sectionCs,
          },
          {
            id: "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f903",
            institutionId: INST,
            courseId: ids.acc201,
            courseCode: "ACC201",
            title: "Financial Accounting",
            credits: 3,
            sortOrder: 3,
            category: "main",
            status: "in_progress",
            startsOn: "2026-09-01",
            endsOn: "2026-10-10",
            scheduleText: "Fri 09:00–16:00",
            sectionId: ids.sectionAcc,
          },
          {
            id: "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f904",
            institutionId: INST,
            courseId: ids.eng110,
            courseCode: "ENG110",
            title: "Academic Writing",
            credits: 3,
            sortOrder: 4,
            category: "main",
            status: "dropped",
            startsOn: "2025-11-01",
            endsOn: "2025-12-12",
            scheduleText: "Mon 13:00–16:00",
            sectionId: ids.sectionEng,
          },
          {
            id: "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f905",
            institutionId: INST,
            courseId: ids.math210,
            courseCode: "MATH210",
            title: "Discrete Mathematics",
            credits: 3,
            sortOrder: 5,
            category: "main",
            status: "not_started",
            startsOn: "2026-10-20",
            endsOn: "2026-11-28",
            scheduleText: "Block 4 · TBD",
          },
          {
            id: "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f906",
            institutionId: INST,
            courseId: ids.nurs400,
            courseCode: "WORK401",
            title: "Work Experience / Co-op",
            credits: 0,
            sortOrder: 6,
            category: "practicum",
            status: "not_started",
            startsOn: "2027-01-12",
            endsOn: "2027-04-30",
            scheduleText: "Placement · supervised hours",
          },
          {
            id: "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f907",
            institutionId: INST,
            courseId: ids.eng110,
            courseCode: "ENG110",
            title: "Academic Writing (make-up)",
            credits: 3,
            sortOrder: 7,
            category: "makeup",
            status: "in_progress",
            startsOn: "2026-09-01",
            endsOn: "2026-10-10",
            scheduleText: "EX/RETAKE-01",
            sectionId: ids.sectionEng,
          },
        ],
      },
    },
  });
  await prisma.degreeRequirement.createMany({
    data: [
      { id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c101", institutionId: INST, programVersionId: ids.programVersionCs, courseId: ids.cs201, courseCode: "CS201", title: "Data Structures", credits: 3, kind: "required", sortOrder: 1 },
      { id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c102", institutionId: INST, programVersionId: ids.programVersionCs, courseId: ids.cs301, courseCode: "CS301", title: "Algorithms", credits: 3, kind: "required", sortOrder: 2 },
      { id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c103", institutionId: INST, programVersionId: ids.programVersionCs, courseId: ids.eng110, courseCode: "ENG110", title: "Academic Writing", credits: 3, kind: "required", sortOrder: 3 },
      { id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c104", institutionId: INST, programVersionId: ids.programVersionCs, courseId: ids.math210, courseCode: "MATH210", title: "Discrete Mathematics", credits: 3, kind: "required", sortOrder: 4 },
      { id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c105", institutionId: INST, programVersionId: ids.programVersionCs, courseId: ids.stat310, courseCode: "STAT310", title: "Applied Statistics", credits: 3, kind: "required", sortOrder: 5 },
      { id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c106", institutionId: INST, programVersionId: ids.programVersionCs, courseId: ids.data401, courseCode: "DATA401", title: "Data Engineering", credits: 3, kind: "required", sortOrder: 6 },
      { id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c107", institutionId: INST, programVersionId: ids.programVersionCs, courseId: ids.acc201, courseCode: "ACC201", title: "Financial Accounting", credits: 3, kind: "elective", sortOrder: 7 },
      { id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c108", institutionId: INST, programVersionId: ids.programVersionCs, courseId: null, courseCode: "ELECTIVE", title: "Open elective", credits: 3, kind: "elective", sortOrder: 8 },
      { id: "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c109", institutionId: INST, programVersionId: ids.programVersionCs, courseId: null, courseCode: "CAPSTONE", title: "CS Capstone", credits: 3, kind: "capstone", sortOrder: 9 },
    ],
  });
  await prisma.coursePrerequisite.createMany({
    data: [
      { id: "a66a66a6-a66a-4a66-8a66-a66a66a66a01", institutionId: INST, courseId: ids.cs301, prerequisiteCourseId: ids.cs201 },
      { id: "a66a66a6-a66a-4a66-8a66-a66a66a66a02", institutionId: INST, courseId: ids.stat310, prerequisiteCourseId: ids.math210 },
      { id: "a66a66a6-a66a-4a66-8a66-a66a66a66a03", institutionId: INST, courseId: ids.data401, prerequisiteCourseId: ids.stat310 },
    ],
  });
  await prisma.knowledgeDocument.create({
    data: {
      id: ids.knowledgeDegree,
      institutionId: INST,
      slug: "cs-diploma-requirements-2024",
      title: "Computer Science Diploma Requirements 2024.1",
      docType: "program_handbook",
      body: "CS diploma requires 27 credits including MATH210 → STAT310 → DATA401 prerequisite chain.",
      uri: "/student/degree",
      versionLabel: "2024.1",
      status: "published",
    },
  });
  await prisma.knowledgeDocument.createMany({
    data: [
      {
        id: ids.knowledgeCalendar,
        institutionId: INST,
        slug: "academic-calendar-2026",
        title: "Academic Calendar 2026–2027",
        docType: "academic_calendar",
        body: "Fall 2026 classes begin September 8. Reading week is November 10–14. Withdrawal deadline without academic penalty is October 31. Winter term starts January 12 2027.",
        uri: "/student/calendar",
        versionLabel: "2026.1",
        status: "published",
      },
      {
        id: ids.knowledgeServices,
        institutionId: INST,
        slug: "student-services-handbook",
        title: "Student Services Handbook",
        docType: "student_handbook",
        body: "Request an official transcript from Documents. Book an academic advisor under Advising. Tuition receipts appear under Fees. Accommodation requests are filed through Campus services. Address changes require a profile change request.",
        uri: "/student/advising",
        versionLabel: "2026.1",
        status: "published",
      },
      {
        id: ids.knowledgeAdmissions,
        institutionId: INST,
        slug: "admissions-requirements",
        title: "Admissions Requirements Overview",
        docType: "admissions_policy",
        body: "Applicants must submit transcript, identification, and program application. Offers are issued by Admissions staff. AI does not make final admissions decisions. Missing documents are listed on the applicant Documents screen.",
        uri: "/applicant/application",
        versionLabel: "2026.1",
        status: "published",
      },
      {
        id: ids.knowledgeNormalization,
        institutionId: INST,
        slug: "cs301-normalization-brief",
        title: "CS301 Database Normalization Brief",
        docType: "course_material",
        body: "Normalization organizes relations to reduce redundancy. First normal form requires atomic values. Second normal form removes partial dependency on a composite key. Third normal form removes transitive dependencies. Practice by decomposing an unnormalized enrolment table into Student, Course, and Enrolment relations.",
        uri: "/student/courses",
        versionLabel: "2026.1",
        status: "published",
      },
    ],
  });
  await prisma.rubric.create({
    data: {
      id: ids.rubricCs,
      institutionId: INST,
      title: "CS301 Project Rubric",
      description: "Rubric for Project 1 deliverables",
      maxScore: 100,
      status: "published",
      criteria: {
        create: [
          {
            id: ids.rubricCrit1,
            institutionId: INST,
            label: "Correctness",
            description: "Solution meets functional requirements",
            maxPoints: 60,
            sortOrder: 1,
          },
          {
            id: ids.rubricCrit2,
            institutionId: INST,
            label: "Clarity",
            description: "Explanation and structure are clear",
            maxPoints: 40,
            sortOrder: 2,
          },
        ],
      },
    },
  });
  await prisma.courseOffering.create({
    data: {
      id: ids.offeringMath,
      institutionId: INST,
      courseId: ids.math210,
      termCode: "2027W",
      termName: "Winter 2027",
      seatsOpen: 18,
      seatsTotal: 30,
      status: "published",
    },
  });
  await prisma.careerOpportunity.createMany({
    data: [
      {
        id: ids.career1,
        institutionId: INST,
        title: "Junior Data Analyst (co-op)",
        employerName: "Surrey Civic Analytics",
        skillsJson: JSON.stringify(["SQL", "normalization", "reporting"]),
        programCodesJson: JSON.stringify(["CS-DIP"]),
        status: "open",
        href: "/student/messages",
      },
      {
        id: "c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c002",
        institutionId: INST,
        title: "IT Support Associate (part-time)",
        employerName: "Heritage Campus Technology",
        skillsJson: JSON.stringify(["troubleshooting", "customer service", "Windows"]),
        programCodesJson: JSON.stringify(["CS-DIP"]),
        status: "open",
        href: "/student/messages",
      },
      {
        id: "c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c003",
        institutionId: INST,
        title: "Clinical placement — community health",
        employerName: "Fraser Health partner sites",
        skillsJson: JSON.stringify(["patient care", "documentation", "teamwork"]),
        programCodesJson: JSON.stringify(["NURS-DIP"]),
        status: "open",
        href: "/student/f/st-17-practicum",
      },
    ],
  });
  await prisma.student.updateMany({
    where: { id: { in: [ids.marcusStudent, ids.danielStudent, ids.jordanStudent] }, institutionId: INST },
    data: { programVersionId: ids.programVersionCs },
  });

  await prisma.academicBlock.createMany({
    data: [
      {
        id: "ab0ab0ab-0ab0-4ab0-8ab0-ab0ab0ab0ab1",
        institutionId: INST,
        code: "BLK-CS-W1",
        name: "CS301 Weeks 1–2 · Graphs & Heaps",
        startsOn: "2026-09-08",
        endsOn: "2026-09-19",
      },
      {
        id: "ab0ab0ab-0ab0-4ab0-8ab0-ab0ab0ab0ab2",
        institutionId: INST,
        code: "BLK-ACC-W1",
        name: "ACC201 Weeks 1–3 · Ledgers",
        startsOn: "2026-09-08",
        endsOn: "2026-09-26",
      },
      {
        id: "ab0ab0ab-0ab0-4ab0-8ab0-ab0ab0ab0ab3",
        institutionId: INST,
        code: "BLK-ACSW500",
        name: "ACSW 500 Family Studies · Intensive",
        startsOn: "2026-09-18",
        endsOn: "2026-10-02",
      },
    ],
  });

  await prisma.section.createMany({
    data: [
      { id: ids.sectionCs, institutionId: INST, courseId: ids.cs301, termId: ids.term, academicBlockId: "ab0ab0ab-0ab0-4ab0-8ab0-ab0ab0ab0ab1", code: "CS301-01", instructorPersonId: ids.vancePerson },
      { id: ids.sectionAcc, institutionId: INST, courseId: ids.acc201, termId: ids.term, academicBlockId: "ab0ab0ab-0ab0-4ab0-8ab0-ab0ab0ab0ab2", code: "ACC201-01", instructorPersonId: ids.pendeltonPerson },
      { id: ids.sectionNurs, institutionId: INST, courseId: ids.nurs400, termId: ids.term, code: "NURS400-01", instructorPersonId: ids.pendeltonPerson },
      { id: ids.sectionEng, institutionId: INST, courseId: ids.eng110, termId: ids.term, code: "ENG110-01", instructorPersonId: ids.vancePerson },
      { id: "77777777-7777-4777-8777-777777777705", institutionId: INST, courseId: ids.cs201, termId: ids.term, code: "CS201-01", instructorPersonId: ids.vancePerson },
      { id: "77777777-7777-4777-8777-777777777706", institutionId: INST, courseId: ids.math210, termId: ids.term, code: "MATH210-01", instructorPersonId: ids.pendeltonPerson },
    ],
  });

  await prisma.enrolment.createMany({
    data: [
      { id: ids.enrolMarcusCs, institutionId: INST, sectionId: ids.sectionCs, studentId: ids.marcusStudent, attemptNumber: 1 },
      { id: ids.enrolMarcusAcc, institutionId: INST, sectionId: ids.sectionAcc, studentId: ids.marcusStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888810", institutionId: INST, sectionId: "77777777-7777-4777-8777-777777777705", studentId: ids.marcusStudent, status: "completed", attemptNumber: 1 },
      {
        id: ids.enrolMarcusEngWithdrawn,
        institutionId: INST,
        sectionId: ids.sectionEng,
        studentId: ids.marcusStudent,
        status: "withdrawn",
        attemptNumber: 1,
        countsTowardCgpa: false,
      },
      {
        id: ids.enrolMarcusEngRetake,
        institutionId: INST,
        sectionId: ids.sectionEng,
        studentId: ids.marcusStudent,
        status: "enrolled",
        attemptNumber: 2,
        countsTowardCgpa: true,
      },
      { id: "88888888-8888-4888-8888-888888888812", institutionId: INST, sectionId: "77777777-7777-4777-8777-777777777706", studentId: ids.marcusStudent, attemptNumber: 1 },
      { id: ids.enrolPriya, institutionId: INST, sectionId: ids.sectionCs, studentId: ids.priyaStudent, attemptNumber: 1 },
      { id: ids.enrolDaniel, institutionId: INST, sectionId: ids.sectionCs, studentId: ids.danielStudent, attemptNumber: 1 },
      { id: ids.enrolMeiNurs, institutionId: INST, sectionId: ids.sectionNurs, studentId: ids.meiStudent, attemptNumber: 1 },
      { id: ids.enrolJordanCs, institutionId: INST, sectionId: ids.sectionCs, studentId: ids.jordanStudent, attemptNumber: 1 },
      { id: ids.enrolLucasAcc, institutionId: INST, sectionId: ids.sectionAcc, studentId: ids.lucasStudent, attemptNumber: 1 },
      { id: ids.enrolFatimaNurs, institutionId: INST, sectionId: ids.sectionNurs, studentId: ids.fatimaStudent, attemptNumber: 1 },
      { id: ids.enrolPriyaNurs, institutionId: INST, sectionId: ids.sectionNurs, studentId: ids.priyaStudent, attemptNumber: 1 },
      // Cross-enroll remaining campus students onto Vance CS301 so teacher roster isn't stuck at 4
      { id: "88888888-8888-4888-8888-888888888821", institutionId: INST, sectionId: ids.sectionCs, studentId: ids.meiStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888822", institutionId: INST, sectionId: ids.sectionCs, studentId: ids.lucasStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888823", institutionId: INST, sectionId: ids.sectionCs, studentId: ids.fatimaStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888824", institutionId: INST, sectionId: ids.sectionEng, studentId: ids.priyaStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888825", institutionId: INST, sectionId: ids.sectionEng, studentId: ids.danielStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888826", institutionId: INST, sectionId: ids.sectionEng, studentId: ids.jordanStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888827", institutionId: INST, sectionId: ids.sectionEng, studentId: ids.meiStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888828", institutionId: INST, sectionId: ids.sectionEng, studentId: ids.lucasStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888829", institutionId: INST, sectionId: "77777777-7777-4777-8777-777777777705", studentId: ids.priyaStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888830", institutionId: INST, sectionId: "77777777-7777-4777-8777-777777777705", studentId: ids.danielStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888831", institutionId: INST, sectionId: "77777777-7777-4777-8777-777777777705", studentId: ids.jordanStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888832", institutionId: INST, sectionId: "77777777-7777-4777-8777-777777777705", studentId: ids.lucasStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888833", institutionId: INST, sectionId: ids.sectionCs, studentId: ids.aishaStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888834", institutionId: INST, sectionId: ids.sectionCs, studentId: ids.benStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888835", institutionId: INST, sectionId: ids.sectionCs, studentId: ids.carmenStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888836", institutionId: INST, sectionId: ids.sectionCs, studentId: ids.diegoStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888837", institutionId: INST, sectionId: ids.sectionCs, studentId: ids.emilyStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888838", institutionId: INST, sectionId: ids.sectionEng, studentId: ids.aishaStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888839", institutionId: INST, sectionId: ids.sectionEng, studentId: ids.benStudent, attemptNumber: 1 },
      { id: "88888888-8888-4888-8888-888888888840", institutionId: INST, sectionId: ids.sectionEng, studentId: ids.carmenStudent, attemptNumber: 1 },
    ],
  });

  await prisma.courseEvaluation.create({
    data: {
      id: ids.evalMarcusAcc,
      institutionId: INST,
      studentId: ids.marcusStudent,
      sectionId: ids.sectionAcc,
      courseCode: "ACC201",
      courseTitle: "Financial Accounting",
      status: "pending",
      dueAt: new Date("2026-10-20T23:59:00.000Z"),
    },
  });

  await prisma.courseEvaluation.createMany({
    data: [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01",
        institutionId: INST,
        studentId: ids.marcusStudent,
        sectionId: ids.sectionCs,
        courseCode: "CS301",
        courseTitle: "Algorithms",
        status: "submitted",
        overallRating: 5,
        responsesJson: JSON.stringify({
          comment: "Clear explanations and practical coding labs made algorithms approachable.",
        }),
        submittedAt: new Date("2026-09-10T18:00:00.000Z"),
        dueAt: new Date("2026-09-15T23:59:00.000Z"),
      },
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02",
        institutionId: INST,
        studentId: ids.priyaStudent,
        sectionId: ids.sectionCs,
        courseCode: "CS301",
        courseTitle: "Algorithms",
        status: "submitted",
        overallRating: 4,
        responsesJson: JSON.stringify({
          comment: "Would like more worked solutions posted before exams.",
        }),
        submittedAt: new Date("2026-09-11T16:30:00.000Z"),
        dueAt: new Date("2026-09-15T23:59:00.000Z"),
      },
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03",
        institutionId: INST,
        studentId: ids.danielStudent,
        sectionId: ids.sectionCs,
        courseCode: "CS301",
        courseTitle: "Algorithms",
        status: "pending",
        dueAt: new Date("2026-09-15T23:59:00.000Z"),
      },
    ],
  });

  const finTermId = "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f871";
  await prisma.financialTerm.create({
    data: {
      id: finTermId,
      institutionId: INST,
      code: "1st Term- 2026",
      name: "1st Term- 2026 (Jan. 1, 2026 to Apr. 30, 2026)",
      startsOn: "2026-01-01",
      endsOn: "2026-04-30",
    },
  });

  await prisma.workshop.createMany({
    data: [
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f801",
        institutionId: INST,
        code: "WS-RESUME",
        title: "Resume Lab",
        description: "Build a job-ready resume with Career Services.",
        creditsCeu: 0.5,
        startsAt: new Date("2026-10-05T16:00:00.000Z"),
        endsAt: new Date("2026-10-05T18:00:00.000Z"),
        location: "Career Hub A",
        capacity: 25,
        status: "upcoming",
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f802",
        institutionId: INST,
        code: "WS-STUDY",
        title: "Exam Study Skills",
        description: "Active recall and time-blocking for block exams.",
        creditsCeu: 0.5,
        startsAt: new Date("2026-09-20T17:00:00.000Z"),
        endsAt: new Date("2026-09-20T19:00:00.000Z"),
        location: "Library Seminar",
        capacity: 40,
        status: "completed",
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f803",
        institutionId: INST,
        code: "WS-WELL",
        title: "Wellness Check-in",
        description: "Campus wellness and peer support orientation.",
        creditsCeu: 0.25,
        startsAt: new Date("2026-10-12T12:00:00.000Z"),
        endsAt: new Date("2026-10-12T13:00:00.000Z"),
        location: "Online",
        capacity: 100,
        status: "active",
      },
    ],
  });
  await prisma.workshopRegistration.createMany({
    data: [
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f811",
        institutionId: INST,
        workshopId: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f802",
        studentId: ids.marcusStudent,
        status: "approved",
        note: "Completed Exam Study Skills workshop.",
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f812",
        institutionId: INST,
        workshopId: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f803",
        studentId: ids.marcusStudent,
        status: "approved",
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f813",
        institutionId: INST,
        workshopId: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f801",
        studentId: ids.priyaStudent,
        status: "pending",
        note: "Awaiting Career Services confirmation.",
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f814",
        institutionId: INST,
        workshopId: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f803",
        studentId: ids.danielStudent,
        status: "declined",
        note: "Schedule conflict with clinical placement.",
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f815",
        institutionId: INST,
        workshopId: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f801",
        studentId: ids.jordanStudent,
        status: "dropped",
        note: "Student withdrew after first session.",
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f816",
        institutionId: INST,
        workshopId: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f801",
        studentId: ids.meiStudent,
        status: "approved",
      },
    ],
  });

  await prisma.leaveOfAbsenceRequest.create({
    data: {
      id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f821",
      institutionId: INST,
      studentId: ids.marcusStudent,
      reason: "Short medical leave for a scheduled procedure; able to resume after recovery.",
      startsOn: "2026-11-01",
      endsOn: "2026-11-14",
      status: "pending",
    },
  });

  await prisma.requiredTask.createMany({
    data: [
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f831",
        institutionId: INST,
        studentId: ids.marcusStudent,
        title: "Complete ACC201 course evaluation",
        detail: "Submit feedback before the block closes.",
        dueAt: new Date("2026-10-20T23:59:00.000Z"),
        status: "pending",
        href: "/student/f/st-24-course-evaluation",
        createdAt: new Date("2026-09-12T10:00:00.000Z"),
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f832",
        institutionId: INST,
        studentId: ids.marcusStudent,
        title: "Upload immunization record",
        detail: "Required for practicum clearance.",
        dueAt: new Date("2026-10-30T23:59:00.000Z"),
        status: "pending",
        href: "/student/documents",
        createdAt: new Date("2026-09-05T14:30:00.000Z"),
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f833",
        institutionId: INST,
        studentId: ids.marcusStudent,
        title: "Confirm emergency contact",
        detail: "Verify phone number on file.",
        status: "completed",
        completedAt: new Date("2026-09-10T12:00:00.000Z"),
        href: "/student/profile",
        createdAt: new Date("2026-08-28T09:00:00.000Z"),
      },
    ],
  });

  await prisma.taxDocument.create({
    data: {
      id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f841",
      institutionId: INST,
      studentId: ids.marcusStudent,
      docType: "T2202",
      taxYear: 2025,
      title: "Tuition and Enrolment Certificate",
      status: "available",
      issuedAt: new Date("2026-02-28T00:00:00.000Z"),
      downloadUrl: "/student/tax-documents/f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f841/pdf",
    },
  });

  await prisma.studentDocument.createMany({
    data: [
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f871",
        institutionId: INST,
        studentId: ids.marcusStudent,
        recordName: "Student ID Card",
        recordDate: "2024-09-02",
        docLabel: "Campus ID",
        downloadUrl: null,
        status: "available",
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f872",
        institutionId: INST,
        studentId: ids.marcusStudent,
        recordName: "Letter of Enrolment",
        recordDate: "2025-01-15",
        docLabel: "Official letter",
        downloadUrl: "/student/documents",
        status: "available",
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f873",
        institutionId: INST,
        studentId: ids.marcusStudent,
        recordName: "Program Confirmation",
        recordDate: "2026-09-01",
        docLabel: "Registrar",
        downloadUrl: "/student/documents",
        status: "available",
      },
    ],
  });

  await prisma.extracurricularRecord.createMany({
    data: [
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f851",
        institutionId: INST,
        studentId: ids.marcusStudent,
        termCode: "2026F",
        category: "Student leadership",
        title: "CS Club · Events lead",
        detail: "Organized two peer study nights.",
        status: "recorded",
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f852",
        institutionId: INST,
        studentId: ids.marcusStudent,
        termCode: "2025F",
        category: "Volunteer",
        title: "Open house volunteer",
        detail: "Campus tour guide.",
        status: "recorded",
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f853",
        institutionId: INST,
        studentId: ids.marcusStudent,
        termCode: "2026F",
        category: "Athletics",
        title: "Intramural basketball",
        detail: "Team roster · winter block.",
        status: "recorded",
      },
    ],
  });

  await prisma.studentBadge.createMany({
    data: [
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f861",
        institutionId: INST,
        studentId: ids.marcusStudent,
        code: "FIRST-BLOCK",
        title: "First block complete",
        description: "Finished your first academic block.",
        status: "earned",
        earnedAt: new Date("2025-10-15T00:00:00.000Z"),
      },
      {
        id: "f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f862",
        institutionId: INST,
        studentId: ids.marcusStudent,
        code: "WORKSHOP-3",
        title: "Workshop explorer",
        description: "Attend three workshops.",
        status: "available",
      },
    ],
  });

  await prisma.assignment.createMany({
    data: [
      {
        id: ids.asgMidterm,
        institutionId: INST,
        sectionId: ids.sectionCs,
        title: "Midterm Exam",
        maxScore: 100,
        weightPercent: 30,
        dueAt: new Date("2026-10-20T16:00:00.000Z"),
      },
      {
        id: ids.asgProject,
        institutionId: INST,
        sectionId: ids.sectionCs,
        title: "Project 1",
        maxScore: 100,
        weightPercent: 20,
        dueAt: new Date("2026-10-15T23:59:00.000Z"),
      },
      {
        id: ids.asgAccHw,
        institutionId: INST,
        sectionId: ids.sectionAcc,
        title: "Homework 5",
        maxScore: 100,
        weightPercent: 10,
        dueAt: new Date("2026-10-12T23:59:00.000Z"),
      },
      {
        id: ids.asgNursClinic,
        institutionId: INST,
        sectionId: ids.sectionNurs,
        title: "Clinical Skills Check",
        maxScore: 100,
        weightPercent: 40,
        dueAt: new Date("2026-11-05T16:00:00.000Z"),
      },
      {
        id: ids.asgEngEssay,
        institutionId: INST,
        sectionId: ids.sectionEng,
        title: "Research Essay",
        maxScore: 100,
        weightPercent: 25,
        dueAt: new Date("2026-10-28T23:59:00.000Z"),
      },
      {
        id: "99999999-9999-4999-8999-999999999910",
        institutionId: INST,
        sectionId: "77777777-7777-4777-8777-777777777705",
        title: "Structures Lab",
        maxScore: 100,
        weightPercent: 30,
        dueAt: new Date("2026-10-22T23:59:00.000Z"),
      },
      {
        id: "99999999-9999-4999-8999-999999999911",
        institutionId: INST,
        sectionId: "77777777-7777-4777-8777-777777777705",
        title: "Final Exam",
        maxScore: 100,
        weightPercent: 40,
        dueAt: new Date("2026-12-10T16:00:00.000Z"),
      },
    ],
  });
  await prisma.assignment.update({
    where: { id: ids.asgProject },
    data: { rubricId: ids.rubricCs },
  });
  await prisma.transferCredit.create({
    data: {
      id: ids.transferMarcus,
      institutionId: INST,
      studentId: ids.marcusStudent,
      courseId: ids.eng110,
      externalCode: "ENGL101",
      externalTitle: "College Writing Transfer",
      credits: 3,
      status: "accepted",
    },
  });

  await prisma.classSession.createMany({
    data: [
      {
        id: ids.sessionCsOnline,
        institutionId: INST,
        sectionId: ids.sectionCs,
        title: "Algorithms · Graph Traversal",
        startsAt: (() => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - 1);
          d.setUTCHours(17, 0, 0, 0);
          return d;
        })(),
        endsAt: (() => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - 1);
          d.setUTCHours(18, 20, 0, 0);
          return d;
        })(),
        location: "Online",
        joinUrl: "https://meet.jit.si/heritage-cs301-01",
        deliveryMode: "online",
        sessionKind: "lecture",
      },
      {
        id: ids.sessionAccRoom,
        institutionId: INST,
        sectionId: ids.sectionAcc,
        title: "Financial Accounting · Ledgers",
        startsAt: (() => {
          const d = new Date();
          d.setUTCHours(19, 0, 0, 0);
          return d;
        })(),
        endsAt: (() => {
          const d = new Date();
          d.setUTCHours(20, 20, 0, 0);
          return d;
        })(),
        location: "Business Centre 204",
        deliveryMode: "in_person",
        sessionKind: "lecture",
      },
      {
        id: ids.sessionCsLab,
        institutionId: INST,
        sectionId: ids.sectionCs,
        title: "Algorithms Lab · Graph Coding",
        startsAt: (() => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() + 1);
          d.setUTCHours(17, 0, 0, 0);
          return d;
        })(),
        endsAt: (() => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() + 1);
          d.setUTCHours(18, 50, 0, 0);
          return d;
        })(),
        location: "Lab 3B",
        deliveryMode: "in_person",
        sessionKind: "lab",
      },
    ],
  });

  await prisma.assessment.create({
    data: {
      id: ids.assessmentCsQuiz,
      institutionId: INST,
      sectionId: ids.sectionCs,
      title: "CS301 Quiz 2 · Graphs",
      opensAt: new Date("2026-09-16T00:00:00.000Z"),
      closesAt: new Date("2026-09-30T23:59:00.000Z"),
      durationMinutes: 45,
      maxAttempts: 3,
      status: "published",
    },
  });

  await prisma.attendanceRecord.createMany({
    data: [
      {
        id: ids.attendance1,
        institutionId: INST,
        studentId: ids.marcusStudent,
        sectionId: ids.sectionCs,
        classSessionId: ids.sessionCsOnline,
        meetingLabel: "CS301 · Graph Traversal",
        status: "present",
        recordedAt: new Date("2026-09-17T18:25:00.000Z"),
      },
      {
        id: ids.attendance2,
        institutionId: INST,
        studentId: ids.marcusStudent,
        sectionId: ids.sectionAcc,
        classSessionId: ids.sessionAccRoom,
        meetingLabel: "ACC201 · Ledgers",
        status: "late",
        recordedAt: new Date("2026-09-18T19:10:00.000Z"),
      },
      {
        id: "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a703",
        institutionId: INST,
        studentId: ids.marcusStudent,
        sectionId: ids.sectionCs,
        classSessionId: ids.sessionCsOnline,
        meetingLabel: "CS301 · BFS / DFS lab prep",
        status: "present",
        recordedAt: new Date("2026-09-19T18:20:00.000Z"),
      },
      {
        id: "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a704",
        institutionId: INST,
        studentId: ids.marcusStudent,
        sectionId: ids.sectionCs,
        classSessionId: ids.sessionCsOnline,
        meetingLabel: "CS301 · Shortest paths",
        status: "absent",
        recordedAt: new Date("2026-09-22T18:20:00.000Z"),
      },
      {
        id: "a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a705",
        institutionId: INST,
        studentId: ids.marcusStudent,
        sectionId: ids.sectionAcc,
        classSessionId: ids.sessionAccRoom,
        meetingLabel: "ACC201 · Adjusting entries",
        status: "present",
        recordedAt: new Date("2026-09-23T19:05:00.000Z"),
      },
    ],
  });

  await prisma.financeLedgerEntry.createMany({
    data: [
      {
        id: ids.financeTuition,
        institutionId: INST,
        studentId: ids.marcusStudent,
        label: "Tuition Fee",
        amountCad: 11000,
        kind: "charge",
        status: "open",
        dueAt: new Date("2026-02-01T00:00:00.000Z"),
        postedAt: new Date("2026-01-22T12:00:00.000Z"),
        financialTermId: finTermId,
      },
      {
        id: ids.financeTextbooks,
        institutionId: INST,
        studentId: ids.marcusStudent,
        label: "Textbooks",
        amountCad: 1728,
        kind: "charge",
        status: "open",
        postedAt: new Date("2026-01-22T12:00:00.000Z"),
        financialTermId: finTermId,
      },
      {
        id: ids.financeApplication,
        institutionId: INST,
        studentId: ids.marcusStudent,
        label: "Application Fee",
        amountCad: 250,
        kind: "charge",
        status: "open",
        postedAt: new Date("2026-01-22T12:00:00.000Z"),
        financialTermId: finTermId,
      },
      {
        id: ids.financeSupplies,
        institutionId: INST,
        studentId: ids.marcusStudent,
        label: "Lab, Books, Supplies, etc.",
        amountCad: 250,
        kind: "charge",
        status: "open",
        postedAt: new Date("2026-01-22T12:00:00.000Z"),
        financialTermId: finTermId,
      },
      {
        id: ids.financePayment,
        institutionId: INST,
        studentId: ids.marcusStudent,
        label: "Payment Applied",
        amountCad: 10000,
        kind: "payment",
        status: "paid",
        source: "Student Aid",
        postedAt: new Date("2026-03-23T15:00:00.000Z"),
        financialTermId: finTermId,
      },
    ],
  });

  await prisma.credentialRecord.createMany({
    data: [
      {
        id: ids.credentialPending,
        institutionId: INST,
        studentId: ids.marcusStudent,
        title: "Computer Science Diploma",
        status: "pending",
        detail: "In progress — tracked against degree requirements",
      },
      {
        id: ids.credentialEarned,
        institutionId: INST,
        studentId: ids.marcusStudent,
        title: "Workplace Safety Orientation",
        status: "earned",
        detail: "Completed campus safety module",
        earnedAt: new Date("2026-08-20T12:00:00.000Z"),
      },
    ],
  });

  await prisma.serviceRequest.create({
    data: {
      id: ids.serviceReq1,
      institutionId: INST,
      studentId: ids.marcusStudent,
      type: "general_inquiry",
      subject: "Ask about workshop schedule",
      details: "Looking for upcoming academic skills workshops this term.",
      status: "open",
    },
  });

  await prisma.submission.create({
    data: {
      id: ids.submissionMarcusProject,
      institutionId: INST,
      assignmentId: ids.asgProject,
      studentId: ids.marcusStudent,
      status: "draft",
    },
  });

  await prisma.gradeItem.createMany({
    data: [
      { id: ids.gradeMarcusMid, institutionId: INST, assignmentId: ids.asgMidterm, studentId: ids.marcusStudent, enrolmentId: ids.enrolMarcusCs, score: 88, maxScore: 100, letter: "A-", status: "published", publishedAt: new Date("2026-10-01T12:00:00.000Z") },
      { id: ids.gradeMarcusProj, institutionId: INST, assignmentId: ids.asgProject, studentId: ids.marcusStudent, enrolmentId: ids.enrolMarcusCs, score: 92, maxScore: 100, letter: "A", status: "draft" },
      { id: ids.gradePriyaMid, institutionId: INST, assignmentId: ids.asgMidterm, studentId: ids.priyaStudent, enrolmentId: ids.enrolPriya, score: 91, maxScore: 100, letter: "A", status: "published", publishedAt: new Date("2026-10-01T12:00:00.000Z") },
      { id: ids.gradeDanielMid, institutionId: INST, assignmentId: ids.asgMidterm, studentId: ids.danielStudent, enrolmentId: ids.enrolDaniel, score: 64, maxScore: 100, letter: "C", status: "draft" },
      { id: ids.gradeMarcusAcc, institutionId: INST, assignmentId: ids.asgAccHw, studentId: ids.marcusStudent, enrolmentId: ids.enrolMarcusAcc, score: 76, maxScore: 100, letter: "B", status: "published", publishedAt: new Date("2026-09-28T12:00:00.000Z") },
      { id: ids.gradeMeiClinic, institutionId: INST, assignmentId: ids.asgNursClinic, studentId: ids.meiStudent, enrolmentId: ids.enrolMeiNurs, score: 87, maxScore: 100, letter: "A-", status: "published", publishedAt: new Date("2026-10-08T12:00:00.000Z") },
      { id: ids.gradeJordanMid, institutionId: INST, assignmentId: ids.asgMidterm, studentId: ids.jordanStudent, enrolmentId: ids.enrolJordanCs, score: 79, maxScore: 100, letter: "B+", status: "published", publishedAt: new Date("2026-10-01T12:00:00.000Z") },
      { id: ids.gradeLucasHw, institutionId: INST, assignmentId: ids.asgAccHw, studentId: ids.lucasStudent, enrolmentId: ids.enrolLucasAcc, score: 82, maxScore: 100, letter: "B", status: "draft" },
      { id: ids.gradeFatimaClinic, institutionId: INST, assignmentId: ids.asgNursClinic, studentId: ids.fatimaStudent, enrolmentId: ids.enrolFatimaNurs, score: 58, maxScore: 100, letter: "D+", status: "draft" },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        institutionId: INST,
        recipientAccountId: ids.marcusAccount,
        channel: "in_app",
        title: "Grade published · CS301 Midterm",
        body: "Your midterm score is now visible in Grades. Review the breakdown and ask your instructor if anything looks incorrect.",
        templateKey: "grade.published",
      },
      {
        institutionId: INST,
        recipientAccountId: ids.marcusAccount,
        channel: "in_app",
        title: "Assignment due soon",
        body: "Project 1 is due Oct 15. Upload your PDF before the deadline from Assignments.",
        templateKey: "assignment.due",
      },
      {
        institutionId: INST,
        recipientAccountId: ids.marcusAccount,
        channel: "in_app",
        title: "Library hours extended for midterms",
        body: "Main library stays open until 11 PM through Oct 24. Bring your student ID for after-hours entry at the Surrey campus.",
        templateKey: "campus.library",
      },
      {
        institutionId: INST,
        recipientAccountId: ids.marcusAccount,
        channel: "in_app",
        title: "Fall reading week reminder",
        body: "Reading week is Nov 10–14. No scheduled classes. Advising appointments remain available online.",
        templateKey: "announcement.calendar",
      },
      {
        institutionId: INST,
        recipientAccountId: ids.marcusAccount,
        channel: "in_app",
        title: "Workshop seats still open",
        body: "Career Prep Lab still has open seats this week. Register under Workshops before capacity fills.",
        templateKey: "announcement.workshop",
      },
      {
        institutionId: INST,
        recipientAccountId: ids.vanceAccount,
        channel: "in_app",
        title: "Publish reminder",
        body: "Project 1 drafts are ready for publish approval.",
        templateKey: "grade.publish_reminder",
      },
      {
        institutionId: INST,
        recipientAccountId: ids.pendeltonAccount,
        channel: "in_app",
        title: "ACC201 homework drafts",
        body: "Ledger homework drafts are waiting in your gradebook.",
        templateKey: "grade.publish_reminder",
      },
      {
        institutionId: INST,
        recipientAccountId: ids.adminAccount,
        channel: "in_app",
        title: "Approval inbox",
        body: "Grade publish requests may arrive from instructors.",
        templateKey: "approvals.digest",
      },
      {
        institutionId: INST,
        recipientAccountId: ids.meiAccount,
        channel: "in_app",
        title: "Clinical check published",
        body: "NURS400 Clinical Skills Check is now visible.",
        templateKey: "grade.published",
      },
      {
        institutionId: INST,
        recipientAccountId: ids.fatimaAccount,
        channel: "in_app",
        title: "Standing review",
        body: "Your academic standing is under registrar review.",
        templateKey: "standing.alert",
      },
    ],
  });

  await prisma.messageThread.create({
    data: {
      id: ids.thread1,
      institutionId: INST,
      subject: "Question about CS301 Midterm",
      participantAccountIdsJson: JSON.stringify([ids.marcusAccount, ids.vanceAccount]),
      messages: {
        create: {
          id: ids.msg1,
          institutionId: INST,
          senderAccountId: ids.marcusAccount,
          body: "Could you clarify the weighting for question 3?",
          relatedGradeItemId: ids.gradeMarcusMid,
        },
      },
    },
  });

  await prisma.courseDayBlock.createMany({
    data: [
      {
        id: "db0db0db-0db0-4db0-8db0-db0db0db0db1",
        institutionId: INST,
        sectionId: ids.sectionCs,
        label: "Day 1–2",
        title: "Graph foundations",
        sortOrder: 1,
      },
      {
        id: "db0db0db-0db0-4db0-8db0-db0db0db0db2",
        institutionId: INST,
        sectionId: ids.sectionCs,
        label: "Day 3–4",
        title: "Heaps & priority queues",
        sortOrder: 2,
      },
    ],
  });
  await prisma.courseLesson.createMany({
    data: [
      {
        id: "fafafafa-fafa-4afa-8afa-fafafafafa01",
        institutionId: INST,
        dayBlockId: "db0db0db-0db0-4db0-8db0-db0db0db0db1",
        title: "BFS / DFS walkthrough",
        body: "Trace breadth-first and depth-first search on a campus map graph.",
        resourceHref: "/student/library",
        sortOrder: 1,
      },
      {
        id: "fafafafa-fafa-4afa-8afa-fafafafafa02",
        institutionId: INST,
        dayBlockId: "db0db0db-0db0-4db0-8db0-db0db0db0db1",
        title: "Shortest paths intro",
        body: "Dijkstra overview with weighted edges.",
        sortOrder: 2,
      },
      {
        id: "fafafafa-fafa-4afa-8afa-fafafafafa03",
        institutionId: INST,
        dayBlockId: "db0db0db-0db0-4db0-8db0-db0db0db0db2",
        title: "Binary heap operations",
        body: "Insert, extract-min, and heapify practice set.",
        resourceHref: `/student/assignments/${ids.asgProject}`,
        sortOrder: 1,
      },
    ],
  });
  await prisma.courseFolder.createMany({
    data: [
      {
        id: "fd0fd0fd-0fd0-4fd0-8fd0-fd0fd0fd0fd1",
        institutionId: INST,
        sectionId: ids.sectionCs,
        name: "Syllabus & Policies",
        sortOrder: 1,
      },
      {
        id: "fd0fd0fd-0fd0-4fd0-8fd0-fd0fd0fd0fd2",
        institutionId: INST,
        sectionId: ids.sectionCs,
        name: "Books & PPTs",
        sortOrder: 2,
      },
    ],
  });
  await prisma.courseFolderItem.createMany({
    data: [
      {
        id: "fafafafa-fafa-4afa-8afa-fafafafafa11",
        institutionId: INST,
        folderId: "fd0fd0fd-0fd0-4fd0-8fd0-fd0fd0fd0fd1",
        title: "CS301_Syllabus_Fall26.pdf",
        kind: "pdf",
        href: "/student/library",
        sizeLabel: "1.2 MB",
        sortOrder: 1,
      },
      {
        id: "fafafafa-fafa-4afa-8afa-fafafafafa12",
        institutionId: INST,
        folderId: "fd0fd0fd-0fd0-4fd0-8fd0-fd0fd0fd0fd2",
        title: "Week1_Graphs.pptx",
        kind: "ppt",
        href: "/student/library",
        sizeLabel: "4.8 MB",
        sortOrder: 1,
      },
      {
        id: "fafafafa-fafa-4afa-8afa-fafafafafa13",
        institutionId: INST,
        folderId: "fd0fd0fd-0fd0-4fd0-8fd0-fd0fd0fd0fd2",
        title: "CLRS — Chapters 22–24",
        kind: "book",
        href: "/student/library",
        sortOrder: 2,
      },
    ],
  });
  await prisma.syllabusTopic.createMany({
    data: [
      { id: "fafafafa-fafa-4afa-8afa-fafafafafa21", institutionId: INST, sectionId: ids.sectionCs, title: "1. Graph representations", level: 1, sortOrder: 1 },
      { id: "fafafafa-fafa-4afa-8afa-fafafafafa22", institutionId: INST, sectionId: ids.sectionCs, title: "1.1 Adjacency lists vs matrices", level: 2, sortOrder: 2 },
      { id: "fafafafa-fafa-4afa-8afa-fafafafafa23", institutionId: INST, sectionId: ids.sectionCs, title: "2. Priority queues & heaps", level: 1, sortOrder: 3 },
    ],
  });
  await prisma.mailFolder.createMany({
    data: [
      { id: "fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb01", institutionId: INST, accountId: ids.marcusAccount, name: "Inbox", kind: "inbox", sortOrder: 0 },
      { id: "fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb02", institutionId: INST, accountId: ids.marcusAccount, name: "Outbox", kind: "outbox", sortOrder: 1 },
      { id: "fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb03", institutionId: INST, accountId: ids.marcusAccount, name: "Drafts", kind: "drafts", sortOrder: 2 },
      { id: "fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb04", institutionId: INST, accountId: ids.marcusAccount, name: "Junk", kind: "junk", sortOrder: 3 },
      { id: "fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb05", institutionId: INST, accountId: ids.marcusAccount, name: "Deleted", kind: "deleted", sortOrder: 4 },
    ],
  });
  await prisma.mailThreadPlacement.create({
    data: {
      id: "fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb11",
      institutionId: INST,
      accountId: ids.marcusAccount,
      threadId: ids.thread1,
      folderId: "fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb02",
      readAt: new Date("2026-09-18T12:00:00.000Z"),
    },
  });
  await prisma.mailboxSettings.create({
    data: {
      id: "fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb21",
      institutionId: INST,
      accountId: ids.marcusAccount,
      forwardingEnabled: false,
      signature: "Marcus Vance\nComputer Science · Heritage Community College",
      popupNotifications: true,
      notificationSound: false,
      smsForwardingEnabled: false,
    },
  });

  await prisma.approvalRequest.create({
    data: {
      id: ids.approval1,
      institutionId: INST,
      type: "grade_publish",
      subjectRef: ids.sectionCs,
      proposedDiffJson: JSON.stringify({ gradeItemIds: [ids.gradeMarcusProj] }),
      requestedBy: ids.vanceAccount,
      requiredApproverRolesJson: JSON.stringify(["registrar", "admin"]),
      requiredCount: 1,
      status: "pending",
    },
  });

  await prisma.approvalRequest.create({
    data: {
      id: ids.approval2,
      institutionId: INST,
      type: "grade_publish",
      subjectRef: ids.sectionAcc,
      proposedDiffJson: JSON.stringify({ gradeItemIds: [ids.gradeLucasHw] }),
      requestedBy: ids.pendeltonAccount,
      requiredApproverRolesJson: JSON.stringify(["registrar", "admin"]),
      requiredCount: 1,
      status: "pending",
    },
  });

  await prisma.auditEvent.create({
    data: {
      institutionId: INST,
      actorId: ids.adminAccount,
      eventName: "seed.complete",
      purpose: "bootstrap",
      afterJson: JSON.stringify({ ok: true }),
      source: "seed",
      correlationId: "seed-fd07",
    },
  });

  await prisma.portalRecord.createMany({
    data: PORTAL.map((p, i) => ({
      institutionId: INST,
      screenPath: p.screenPath,
      role: p.role,
      primaryText: p.primaryText,
      secondaryText: p.secondaryText,
      metaText: p.metaText,
      href: p.href,
      sortOrder: p.sortOrder ?? i,
      audienceAccountId: p.audienceAccountId,
    })),
  });

  // Admin SIS screens compose live from domain tables — clear any leftover fixture payloads.
  await prisma.sisScreenState.deleteMany({ where: { institutionId: INST } });
  console.log("SisScreenState cleared (domain-composed at request time)");

  await prisma.admissionsApplication.create({
    data: {
      id: ids.application1,
      institutionId: INST,
      accountId: ids.applicantAccount,
      personId: ids.applicantPerson,
      programName: "Nursing diploma",
      intakeTerm: "Fall 2026",
      status: "new_inquiry",
      progressPct: 45,
      notes: "International applicant · Surrey campus preference",
      documents: {
        create: [
          {
            id: ids.appDocPassport,
            institutionId: INST,
            label: "Passport scan",
            status: "uploaded",
            fileName: "passport_scan.pdf",
          },
          {
            id: ids.appDocTranscript,
            institutionId: INST,
            label: "Official transcript",
            status: "missing",
          },
          {
            id: ids.appDocResume,
            institutionId: INST,
            label: "Resume / CV",
            status: "missing",
          },
        ],
      },
      offers: {
        create: [
          {
            id: ids.appOffer1,
            institutionId: INST,
            title: "Conditional offer · Nursing diploma",
            status: "pending",
            conditions: "Complete document packet + deposit within 14 days",
            expiresOn: "2026-10-15",
          },
        ],
      },
      timeline: {
        create: [
          {
            institutionId: INST,
            title: "Application started",
            detail: "Nursing diploma draft created",
            occurredAt: new Date("2026-09-01T10:00:00Z"),
          },
          {
            institutionId: INST,
            title: "Passport uploaded",
            detail: "Awaiting remaining documents",
            occurredAt: new Date("2026-09-05T16:30:00Z"),
          },
        ],
      },
    },
  });

  // Extra lifecycle pipeline rows for admin/instructor status filters
  await prisma.admissionsApplication.createMany({
    data: [
      {
        id: "a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a902",
        institutionId: INST,
        accountId: ids.applicantAccount,
        personId: ids.applicantPerson,
        programName: "Computer Science",
        intakeTerm: "Fall 2026",
        status: "approved_application",
        progressPct: 70,
        notes: "Documents verified",
      },
      {
        id: "a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a903",
        institutionId: INST,
        accountId: ids.applicantAccount,
        personId: ids.applicantPerson,
        programName: "Business Administration",
        intakeTerm: "Winter 2027",
        status: "cloa",
        progressPct: 90,
        notes: "Conditional letter of acceptance issued",
      },
      {
        id: "a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a904",
        institutionId: INST,
        accountId: ids.applicantAccount,
        personId: ids.applicantPerson,
        programName: "Early Childhood Education",
        intakeTerm: "Fall 2026",
        status: "declined",
        progressPct: 100,
        notes: "Applicant declined offer",
      },
      {
        id: "a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a905",
        institutionId: INST,
        accountId: ids.applicantAccount,
        personId: ids.applicantPerson,
        programName: "Health Sciences",
        intakeTerm: "Fall 2026",
        status: "refused_visa",
        progressPct: 80,
        notes: "Visa refusal on file",
      },
      {
        id: "a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a906",
        institutionId: INST,
        accountId: ids.applicantAccount,
        personId: ids.applicantPerson,
        programName: "Accounting",
        intakeTerm: "Spring 2026",
        status: "follow_up",
        progressPct: 35,
        notes: "Awaiting missing documents follow-up",
      },
      {
        id: "a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a907",
        institutionId: INST,
        accountId: ids.applicantAccount,
        personId: ids.applicantPerson,
        programName: "Hospitality",
        intakeTerm: "Fall 2026",
        status: "prospective",
        progressPct: 10,
        notes: "Prospective offshore lead",
      },
    ],
  });

  await prisma.employerOrg.create({
    data: {
      id: ids.employerOrg1,
      institutionId: INST,
      accountId: ids.employerAccount,
      name: "Fraser Health",
      siteName: "Surrey Memorial · Clinical unit A",
      contactEmail: "sam.okello@fraserhealth.partner",
      agreements: {
        create: [
          {
            id: ids.agreement1,
            institutionId: INST,
            title: "Affiliation MOU 2026–2028",
            status: "active",
            renewsOn: "2028-06-30",
          },
        ],
      },
      placements: {
        create: [
          {
            id: ids.placement1,
            institutionId: INST,
            studentName: "Mei Chen",
            studentId: ids.meiStudent,
            programName: "Nursing · NURS400",
            status: "active",
            startsOn: "2026-09-08",
            endsOn: "2026-12-12",
            hours: {
              create: [
                {
                  id: ids.hours1,
                  institutionId: INST,
                  weekLabel: "Week 38",
                  hours: 32,
                  status: "pending",
                },
                {
                  id: ids.hours2,
                  institutionId: INST,
                  weekLabel: "Week 37",
                  hours: 28,
                  status: "approved",
                },
              ],
            },
            evaluations: {
              create: [
                {
                  id: ids.eval1,
                  institutionId: INST,
                  studentName: "Mei Chen",
                  status: "due",
                },
              ],
            },
          },
          {
            id: ids.placement2,
            institutionId: INST,
            studentName: "Fatima Hassan",
            studentId: ids.fatimaStudent,
            programName: "Nursing · NURS400",
            status: "active",
            startsOn: "2026-09-08",
            endsOn: "2026-12-12",
          },
          {
            id: ids.placementMarcus,
            institutionId: INST,
            studentName: "Marcus Vance",
            studentId: ids.marcusStudent,
            programName: "Computer Science · Industry project",
            status: "active",
            startsOn: "2026-09-01",
            endsOn: "2026-12-15",
          },
        ],
      },
    },
  });

  await prisma.messageThread.create({
    data: {
      institutionId: INST,
      subject: "Admissions · document checklist",
      participantAccountIdsJson: JSON.stringify([ids.applicantAccount, ids.adminAccount]),
      messages: {
        create: {
          institutionId: INST,
          senderAccountId: ids.adminAccount,
          body: "Hi Nora — please upload your transcript and resume to complete the packet.",
        },
      },
    },
  });

  // Monica Dahiya faculty profile — HCC My Profile screens (real domain rows)
  await prisma.term.create({
    data: {
      id: ids.termPast,
      institutionId: INST,
      code: "2025F",
      name: "Fall 2025",
      startsOn: "2025-09-01",
      endsOn: "2025-12-18",
    },
  });

  const monicaCurrent = [
    { code: "ACSW 500", title: "Family Studies", section: "ACSW-MAR26-01", startH: 17, endH: 22, days: [1, 2, 3, 4], from: "2026-09-15", to: "2026-10-02" },
    { code: "BETH 190", title: "Business Ethics", section: "EXRETAKE-01", startH: 9, endH: 13, days: [1, 2, 3, 4, 5], from: "2026-09-01", to: "2026-12-18" },
    { code: "BMGT 112", title: "Introduction to Organizational Behaviour", section: "EXRETAKE-01", startH: 8, endH: 12, days: [1, 2, 3, 4, 5], from: "2026-09-01", to: "2026-12-18" },
    { code: "COMP 101", title: "Introduction to Computers", section: "EXRETAKE-01", startH: 9, endH: 13, days: [1, 2, 3, 4, 5], from: "2026-09-01", to: "2026-12-18" },
    { code: "DAP 101", title: "Financial Accounting", section: "EXRETAKE-01", startH: 8, endH: 12, days: [1, 2, 3, 4, 5], from: "2026-09-01", to: "2026-12-18" },
    { code: "EMPL 111", title: "Career Employment & Strategies", section: "EXRETAKE-01", startH: 8, endH: 12, days: [1, 2, 3, 4, 5], from: "2026-09-01", to: "2026-12-18" },
    { code: "MARK 114", title: "Social Media Marketing Strategies", section: "ONM-MAR26-01", startH: 15, endH: 19, days: [1, 2, 3, 4], from: "2026-09-15", to: "2026-09-27" },
  ] as const;

  const monicaPrevious = [
    "ACSW 100", "ACSW 200", "ACSW 300", "ACSW 400", "BETH 190", "BMGT 101", "BMGT 112", "COMC 150",
    "COMP 101", "COMP 102", "DAP 101", "ECEA 1", "ECON 101", "ECON 102", "EMPL 111", "MARK 101",
    "MARK 104", "MARK 108", "MATH 100", "PHRM 100", "PSYC 130", "PSYC 100", "PSYC 110", "SFCS 100", "SOCI 100",
  ];

  const monicaTopicHeader = [
    "ACSW 200", "ACSW 500", "BETH 190", "BMGT 112", "COMC 150", "COMP 101", "DAP 101", "ECON 102",
    "EMPL 111", "MARK 101", "MARK 114", "PSYC 130", "PYSC 110",
  ];

  let courseIdx = 0;
  for (const row of monicaCurrent) {
    courseIdx += 1;
    const courseId = `a1a1a1a1-c0c0-4c0c-8c0c-${String(courseIdx).padStart(12, "0")}`;
    const sectionId = `a1a1a1a1-s0s0-4s0s-8s0s-${String(courseIdx).padStart(12, "0")}`;
    await prisma.course.create({
      data: { id: courseId, institutionId: INST, code: row.code, title: row.title, credits: 3 },
    });
    await prisma.section.create({
      data: {
        id: sectionId,
        institutionId: INST,
        courseId,
        termId: ids.term,
        code: row.section,
        instructorPersonId: ids.monicaPerson,
        academicBlockId: row.code === "ACSW 500" ? "ab0ab0ab-0ab0-4ab0-8ab0-ab0ab0ab0ab3" : undefined,
      },
    });
    // Seed one representative week of class sessions (Sep 14–18, 2026)
    for (const day of row.days) {
      // 2026-09-13 is Sunday → Monday=14
      await prisma.classSession.create({
        data: {
          id: `a1a1a1a1-5e5e-4f0f-8f0f-${String(courseIdx).padStart(6,"0")}${String(day).padStart(6,"0")}`,
          institutionId: INST,
          sectionId,
          title: `${row.code} · Lecture`,
          startsAt: new Date(2026, 8, 13 + day, row.startH, 0, 0),
          endsAt: new Date(2026, 8, 13 + day, row.endH, 0, 0),
          location: "#110 Heritage College - Surrey",
          deliveryMode: "in_person",
          sessionKind: "lecture",
          joinUrl: row.code === "ACSW 500" ? "https://meet.jit.si/heritage-acsw-500-acsw-mar26-01" : null,
        },
      });
    }
    if (row.code === "ACSW 500") {
      const gradeItems = [
        { title: "Quiz 1", weight: 10, suffix: "01" },
        { title: "MID TERM", weight: 30, suffix: "02" },
        { title: "Quiz 2", weight: 10, suffix: "03" },
        { title: "FINAL EXAM", weight: 30, suffix: "04" },
        { title: "Participation", weight: 20, suffix: "05" },
      ] as const;
      for (const g of gradeItems) {
        await prisma.assignment.create({
          data: {
            id: `a1a1a1a1-a55a-4a55-8a55-${g.suffix.padStart(12, "0")}`,
            institutionId: INST,
            sectionId,
            title: g.title,
            maxScore: 100,
            weightPercent: g.weight,
            dueAt: new Date("2026-10-02T23:59:00.000Z"),
          },
        });
      }
    }
  }

  // Previous courses as past-term sections (no sessions needed)
  let prevIdx = 0;
  for (const code of monicaPrevious) {
    prevIdx += 1;
    const courseId = `b2b2b2b2-c0c0-4c0c-8c0c-${String(prevIdx).padStart(12, "0")}`;
    const sectionId = `b2b2b2b2-s0s0-4s0s-8s0s-${String(prevIdx).padStart(12, "0")}`;
    const existing = await prisma.course.findFirst({ where: { institutionId: INST, code } });
    const useCourseId = existing?.id ?? courseId;
    if (!existing) {
      await prisma.course.create({
        data: { id: courseId, institutionId: INST, code, title: code, credits: 3 },
      });
    }
    await prisma.section.create({
      data: {
        id: sectionId,
        institutionId: INST,
        courseId: useCourseId,
        termId: ids.termPast,
        code: `${code.replace(/\s+/g, "")}-PREV`,
        instructorPersonId: ids.monicaPerson,
      },
    });
  }

  await prisma.portalRecord.createMany({
    data: [
      {
        id: "c0c0c0c0-c0c0-4c0c-8c0c-ffffffffffff01",
        institutionId: INST,
        screenPath: "/instructor/f/t02-profile-biography",
        role: "instructor",
        primaryText: "connect",
        secondaryText: "connect",
        metaText: JSON.stringify({ phone: "", email: "monica@hccbc.com" }),
        audienceAccountId: ids.monicaAccount,
        sortOrder: 0,
      },
      {
        id: "c0c0c0c0-c0c0-4c0c-8c0c-ffffffffffff02",
        institutionId: INST,
        screenPath: "/instructor/f/t03-profile-topics",
        role: "instructor",
        primaryText: "previousCourses",
        secondaryText: "previousCourses",
        metaText: JSON.stringify({ codes: monicaPrevious }),
        audienceAccountId: ids.monicaAccount,
        sortOrder: 0,
      },
      {
        id: "c0c0c0c0-c0c0-4c0c-8c0c-ffffffffffff03",
        institutionId: INST,
        screenPath: "/instructor/f/t03-profile-topics",
        role: "instructor",
        primaryText: "academicChair",
        secondaryText: "academicChair",
        metaText: JSON.stringify({ codes: monicaTopicHeader }),
        audienceAccountId: ids.monicaAccount,
        sortOrder: 1,
      },
      {
        id: "c0c0c0c0-c0c0-4c0c-8c0c-ffffffffffff04",
        institutionId: INST,
        screenPath: "/instructor/f/t34-accomplishments",
        role: "instructor",
        primaryText: "Faculty Excellence Award",
        secondaryText: "Recognized for outstanding teaching across Business and Social Sciences.",
        metaText: JSON.stringify({ year: "2025", tone: "success" }),
        audienceAccountId: ids.monicaAccount,
        href: "/instructor/f/t34-accomplishments",
        sortOrder: 0,
      },
      {
        id: "c0c0c0c0-c0c0-4c0c-8c0c-ffffffffffff05",
        institutionId: INST,
        screenPath: "/instructor/f/t34-accomplishments",
        role: "instructor",
        primaryText: "Curriculum redesign · ACSW pathway",
        secondaryText: "Led course sequence refresh for Family Studies and related electives.",
        metaText: JSON.stringify({ year: "2024", tone: "info" }),
        audienceAccountId: ids.monicaAccount,
        href: "/instructor/f/t34-accomplishments",
        sortOrder: 1,
      },
      {
        id: "c0c0c0c0-c0c0-4c0c-8c0c-ffffffffffff10",
        institutionId: INST,
        screenPath: "/instructor/f/t12-students-view",
        role: "instructor",
        primaryText: "statusCensus",
        secondaryText: "statusCensus",
        metaText: JSON.stringify({
          "New Inquiry": 2,
          "Approved Application": 10,
          "Pre-enrolment Application": 0,
          CLOA: 2,
          LOA: 0,
          "Cancelled/ Did not proceed": 96,
          "Follow Up": 120,
          "In-active Leads": 295,
          "Duplicate profiles": 10,
          "Declined Application": 82,
          "Registered Student": 10,
          "Active Student": 257,
          "On-Hold": 0,
          "Leave of Absence": 0,
          Graduated: 437,
          Incomplete: 7,
          "Withdrawn Students": 228,
          Dismissed: 399,
          "Refused Visa": 105,
          "File not Logged (Offshore student)": 111,
          "Prospective Student (Marketing team)": 0,
        }),
        sortOrder: 0,
      },
    ],
  });

  // Campus directory sample students (standing = PDF lifecycle label) + Monica enrolments + flags
  const campusSamples: Array<{ family: string; given: string; standing: string; program: string }> = [
    { family: "Mitchell", given: "Arthur", standing: "Active Student", program: "Accounting" },
    { family: "Manning", given: "Jessica", standing: "Active Student", program: "Corporate Finance" },
    { family: "McDonald", given: "Douglas", standing: "Active Student", program: "Business Admin" },
    { family: "Miller", given: "Gregory", standing: "Active Student", program: "Economics" },
    { family: "Nguyen", given: "Linh", standing: "Active Student", program: "Nursing" },
    { family: "Patel", given: "Riya", standing: "Active Student", program: "Computer Science" },
    { family: "Singh", given: "Arjun", standing: "Active Student", program: "Business Admin" },
    { family: "Chen", given: "Wei", standing: "Active Student", program: "Accounting" },
    { family: "Brown", given: "Amelia", standing: "New Inquiry", program: "Business Admin" },
    { family: "Garcia", given: "Diego", standing: "New Inquiry", program: "Nursing" },
    { family: "Lopez", given: "Sofia", standing: "Approved Application", program: "Accounting" },
    { family: "Kim", given: "Hana", standing: "Approved Application", program: "Computer Science" },
    { family: "Singh", given: "Jagdeep", standing: "CLOA", program: "ACSW" },
    { family: "Kaur", given: "Tranjot", standing: "CLOA", program: "DIB" },
    { family: "Wilson", given: "James", standing: "Follow Up", program: "Economics" },
    { family: "Taylor", given: "Emma", standing: "Follow Up", program: "Accounting" },
    { family: "Anderson", given: "Noah", standing: "In-active Leads", program: "Business Admin" },
    { family: "Thomas", given: "Olivia", standing: "In-active Leads", program: "Nursing" },
    { family: "Adams", given: "Blake", standing: "In-active Leads", program: "Accounting" },
    { family: "Bennett", given: "Chloe", standing: "In-active Leads", program: "Computer Science" },
    { family: "Carter", given: "Dylan", standing: "In-active Leads", program: "Economics" },
    { family: "Dixon", given: "Ella", standing: "In-active Leads", program: "Business Admin" },
    { family: "Edwards", given: "Finn", standing: "In-active Leads", program: "Nursing" },
    { family: "Foster", given: "Gina", standing: "In-active Leads", program: "Corporate Finance" },
    { family: "Gibson", given: "Hugo", standing: "In-active Leads", program: "Accounting" },
    { family: "Hayes", given: "Ivy", standing: "In-active Leads", program: "Computer Science" },
    { family: "Iverson", given: "Jade", standing: "In-active Leads", program: "Business Admin" },
    { family: "Jenkins", given: "Kai", standing: "In-active Leads", program: "Nursing" },
    { family: "Keller", given: "Luna", standing: "In-active Leads", program: "Economics" },
    { family: "Lambert", given: "Miles", standing: "In-active Leads", program: "Accounting" },
    { family: "Murphy", given: "Nora", standing: "In-active Leads", program: "Business Admin" },
    { family: "Nelson", given: "Owen", standing: "In-active Leads", program: "Computer Science" },
    { family: "Owens", given: "Piper", standing: "In-active Leads", program: "Nursing" },
    { family: "Perez", given: "Quinn", standing: "In-active Leads", program: "Corporate Finance" },
    { family: "Quinn", given: "Riley", standing: "In-active Leads", program: "Economics" },
    { family: "Reed", given: "Sage", standing: "In-active Leads", program: "Accounting" },
    { family: "Stewart", given: "Tara", standing: "In-active Leads", program: "Business Admin" },
    { family: "Underwood", given: "Uma", standing: "In-active Leads", program: "Nursing" },
    { family: "Vargas", given: "Vince", standing: "In-active Leads", program: "Computer Science" },
    { family: "Walsh", given: "Willa", standing: "In-active Leads", program: "Economics" },
    { family: "Xu", given: "Xander", standing: "In-active Leads", program: "Accounting" },
    { family: "Yates", given: "Yara", standing: "In-active Leads", program: "Business Admin" },
    { family: "Zimmerman", given: "Zoe", standing: "In-active Leads", program: "Nursing" },
    { family: "Jackson", given: "Liam", standing: "Declined Application", program: "Computer Science" },
    { family: "White", given: "Ava", standing: "Declined Application", program: "Accounting" },
    { family: "Harris", given: "Mason", standing: "Registered Student", program: "Business Admin" },
    { family: "Martin", given: "Isabella", standing: "Registered Student", program: "Nursing" },
    { family: "Thompson", given: "Ethan", standing: "Graduated", program: "Accounting" },
    { family: "Moore", given: "Mia", standing: "Graduated", program: "Economics" },
    { family: "Clark", given: "Lucas", standing: "Incomplete", program: "Computer Science" },
    { family: "Lewis", given: "Charlotte", standing: "Withdrawn Students", program: "Business Admin" },
    { family: "Walker", given: "Henry", standing: "Withdrawn Students", program: "Nursing" },
    { family: "Hall", given: "Harper", standing: "Dismissed", program: "Accounting" },
    { family: "Young", given: "Alexander", standing: "Dismissed", program: "Business Admin" },
    { family: "King", given: "Evelyn", standing: "Refused Visa", program: "Nursing" },
    { family: "Wright", given: "Sebastian", standing: "File not Logged (Offshore student)", program: "Computer Science" },
    { family: "Scott", given: "Ella", standing: "Duplicate profiles", program: "Accounting" },
    { family: "Green", given: "Jack", standing: "Cancelled/ Did not proceed", program: "Business Admin" },
    { family: "Baker", given: "Grace", standing: "Cancelled/ Did not proceed", program: "Economics" },
  ];

  const campusStudentIds: string[] = [];
  for (let i = 0; i < campusSamples.length; i++) {
    const s = campusSamples[i]!;
    const personId = `d3d3d3d3-2222-4222-8222-${String(i + 1).padStart(12, "0")}`;
    const studentId = `d3d3d3d3-4444-4444-8444-${String(i + 1).padStart(12, "0")}`;
    campusStudentIds.push(studentId);
    await prisma.person.create({
      data: {
        id: personId,
        institutionId: INST,
        givenName: s.given,
        familyName: s.family,
        email: `${s.given.toLowerCase()}.${s.family.toLowerCase()}@campus.heritage.edu`,
      },
    });
    const studentNumber =
      s.family === "Singh" && s.given === "Jagdeep"
        ? "2600474"
        : s.family === "Kaur" && s.given === "Tranjot"
          ? "2600475"
          : `MH-2026-${String(9000 + i)}`;
    const studentData: {
      id: string;
      institutionId: string;
      personId: string;
      studentNumber: string;
      programName: string;
      standing: string;
      updatedAt?: Date;
    } = {
      id: studentId,
      institutionId: INST,
      personId,
      studentNumber,
      programName: s.program,
      standing: s.standing,
    };
    if (s.family === "Singh" && s.given === "Jagdeep") studentData.updatedAt = new Date("2026-09-17T15:17:18");
    if (s.family === "Kaur" && s.given === "Tranjot") studentData.updatedAt = new Date("2026-08-28T09:04:33");
    await prisma.student.create({ data: studentData });
  }

  // Enrol campus + core students into Monica current sections for attendance/grades
  const monicaSections = await prisma.section.findMany({
    where: { institutionId: INST, instructorPersonId: ids.monicaPerson, termId: ids.term },
    select: { id: true },
  });
  const enrolPool = [
    ids.marcusStudent,
    ids.priyaStudent,
    ids.danielStudent,
    ids.jordanStudent,
    ids.meiStudent,
    ids.lucasStudent,
    ...campusStudentIds.slice(0, 8),
  ];
  let enrolIdx = 0;
  for (const sec of monicaSections) {
    for (const studentId of enrolPool.slice(0, 6)) {
      enrolIdx += 1;
      await prisma.enrolment.create({
        data: {
          id: `d3d3d3d3-8888-4888-8888-${String(enrolIdx).padStart(12, "0")}`,
          institutionId: INST,
          sectionId: sec.id,
          studentId,
          status: "enrolled",
        },
      }).catch(() => undefined);
    }
  }

  const flagNames = [
    "Mitchell, Arthur", "Manning, Jessica", "McDonald, Douglas", "Miller, Gregory",
    "Nguyen, Linh", "Patel, Riya", "Singh, Arjun", "Chen, Wei", "Wilson, James",
    "Taylor, Emma", "Lewis, Charlotte", "Walker, Henry", "Hall, Harper", "Young, Alexander",
  ];
  const flagDescs = [
    "Pending Withdrawn Form",
    "SABC application status to be verified",
    "LPT Missing!",
    "Confirmation Required: Status",
    "Confirmation Required: Intent to Enroll",
    "withdrawal Notice",
    "Check and update in progress classes",
    "SHOULD BE TERMINATED!",
    "Pending Fees",
    "Wrong Information on Documents",
    "Missing LPR",
    "Program start date discrepancy with SA form",
    "Missing English Test",
    "Payment",
    "Needs to update Finance",
    "Missing Contact",
    "No Show to the College since beginning",
    "SEC- Missing",
    "Finance Needs to update",
  ];
  const flagRows = [];
  for (let i = 0; i < 54; i++) {
    flagRows.push({
      id: `d3d3d3d3-f1a9-4f1a-8f1a-${String(i + 1).padStart(12, "0")}`,
      institutionId: INST,
      screenPath: "/instructor/f/t45-student-flags",
      role: "instructor",
      primaryText: flagNames[i % flagNames.length]!,
      secondaryText: flagDescs[i % flagDescs.length]!,
      metaText: JSON.stringify({
        status: "Unresolved",
        hold: i % 7 === 0 ? "Yes" : "No",
        date: `Sep. ${(i % 28) + 1}, 2026 (Mon.) 10:${String((i * 3) % 60).padStart(2, "0")} am`,
      }),
      sortOrder: i,
    });
  }
  await prisma.portalRecord.createMany({ data: flagRows });

  console.log("FD-07 + portal + applicant/employer seed complete. Password for all accounts: Heritage!2026");
  console.log("Applicant: nora.reyes@applicant.heritage.edu");
  console.log("Employer: sam.okello@fraserhealth.partner");
  console.log("Instructor (profile): monica.dahiya@myhccbc.com");
  console.log(`Campus directory samples: ${campusSamples.length}; student flags: ${flagRows.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
