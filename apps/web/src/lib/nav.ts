export type ShellRole = "applicant" | "student" | "instructor" | "admin" | "employer";

const STUDENT: Record<string, string> = {
  Home: "/student",
  Courses: "/student/courses",
  Assignments: "/student/assignments",
  Schedule: "/student/calendar",
  Calendar: "/student/calendar",
  Grades: "/student/grades",
  Services: "/student/advising",
  Fees: "/student/fees",
  Messages: "/student/messages",
  Notifications: "/student/notifications",
  Profile: "/student/profile",
  Search: "/student/search",
  Ask: "/student/ask",
  More: "/student",
};

const INSTRUCTOR: Record<string, string> = {
  Home: "/instructor",
  Sections: "/instructor/sections",
  Gradebook: "/instructor/gradebook",
  Attendance: "/instructor/attendance",
  Messages: "/instructor/messages",
  Notifications: "/instructor/notifications",
  Profile: "/instructor/profile",
  Search: "/instructor/search",
  Ask: "/instructor/ask",
  Workshops: "/instructor/f/t11-workshops",
};

const ADMIN: Record<string, string> = {
  Home: "/admin",
  Overview: "/admin",
  Approvals: "/admin/approvals",
  "Approvals Inbox": "/admin/approvals",
  Analytics: "/admin/analytics",
  Users: "/admin/users/create",
  Notifications: "/admin/notifications",
  Profile: "/admin/profile",
  Search: "/admin/search",
  "Ask CampusOne": "/admin/ai/ask",
  "AI governance": "/admin/ai/governance",
  "Executive intelligence": "/admin/ai/executive",
  Integrations: "/admin/integrations",
  Settings: "/admin/settings",
  Recruit: "/admin/admissions",
  Academics: "/admin/courses",
  Students: "/admin/students",
  Compliance: "/admin/compliance",
  Platform: "/admin/platform",
};

const APPLICANT: Record<string, string> = {
  Home: "/applicant",
  Application: "/applicant/application",
  Status: "/applicant/f/ap-06-application-status",
  Requirements: "/applicant/f/ap-03-requirements",
  Documents: "/applicant/documents",
  Interview: "/applicant/f/ap-05-interview",
  Offer: "/applicant/offers",
  Contract: "/applicant/f/ap-08-contract",
  Payment: "/applicant/f/ap-10-payment",
  Leave: "/applicant/f/ap-09-loa",
  Onboarding: "/applicant/f/ap-11-onboarding",
  Timeline: "/applicant/timeline",
  Assistant: "/applicant/f/ap-12-applicant-ai-drawer",
  Messages: "/applicant/messages",
  Notifications: "/applicant/notifications",
  Profile: "/applicant/application",
  Offers: "/applicant/offers",
  Search: "/applicant/search",
  Ask: "/applicant/ask",
};

const EMPLOYER: Record<string, string> = {
  Home: "/employer",
  Placements: "/employer/placements",
  Hours: "/employer/hours",
  Evaluations: "/employer/evaluations",
  Agreements: "/employer/agreements",
  Profile: "/employer/profile",
  Notifications: "/employer/notifications",
  Messages: "/employer/profile",
  Search: "/employer/search",
  Ask: "/employer/ask",
};

export const ROLE_NAV: Record<ShellRole, Record<string, string>> = {
  student: STUDENT,
  instructor: INSTRUCTOR,
  admin: ADMIN,
  applicant: APPLICANT,
  employer: EMPLOYER,
};

export function resolveNav(role: ShellRole, item: string): string | undefined {
  return ROLE_NAV[role][item];
}
