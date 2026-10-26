"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AskHeritageFab } from "@/components/AskHeritageFab";
import { api, loadSession, logout } from "@/lib/api";
import { NoModuleAccess, allows, useMyAccess, type ModuleGate, type MyAccess } from "@/lib/access";

type NavChild = { label: string; href: string; match?: string[]; section?: string; countKey?: string; gate?: ModuleGate };
type NavItem = {
  label: string;
  href: string;
  icon: string;
  badge?: string;
  match?: string[];
  children?: NavChild[];
  gate?: ModuleGate;
};

const NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/instructor",
    icon: "bar-chart",
  },
  {
    label: "My Profile / Settings",
    href: "/instructor/f/t02-profile-biography",
    icon: "user",
    children: [
      {
        label: "Manage My Profile",
        href: "/instructor/f/t02-profile-biography",
        match: [
          "/instructor/profile",
          "/instructor/f/t03-profile-topics",
          "/instructor/f/t04-profile-availability",
          "/instructor/f/t05-profile-compensation",
          "/instructor/f/t06-profile-schedule",
          "/instructor/f/t25-add-availability-modal",
          "/instructor/f/in-18-availability",
          "/instructor/f/in-19-compensation",
        ],
      },
      { label: "Accomplishments", href: "/instructor/f/t34-accomplishments" },
      { label: "Tax Documents / Forms", href: "/instructor/f/tax-documents" },
      { label: "Security Settings", href: "/instructor/f/t35-security-settings" },
      { label: "Change Time Zone", href: "/instructor/f/t15-settings" },
    ],
  },
  {
    label: "My Courses",
    href: "/instructor/sections",
    gate: { modules: ["courseManagement"] },
    icon: "book",
    children: [
      { label: "All My Courses / Schedule", href: "/instructor/sections", match: ["/instructor/f/t08-my-courses-detail"] },
      { label: "Course Evaluations", href: "/instructor/f/t36-course-evaluations" },
      { label: "Course Attendance", href: "/instructor/attendance", match: ["/instructor/f/t21-attendance-correction-review"] },
      { label: "Course Repository", href: "/instructor/f/t37-course-repository", match: ["/instructor/f/t80-create-content-course"] },
      { label: "Pending Course Schedules", href: "/instructor/f/t38-pending-course-schedules" },
      { label: "Grades Submission", href: "/instructor/f/t62-pending-grade-submissions?mode=submission", countKey: "grades" },
      { label: "Course History", href: "/instructor/f/t39-course-history" },
    ],
  },
  {
    label: "AI Draft",
    href: "/instructor/ai-draft",
    gate: { modules: ["courseManagement"] },
    icon: "sparkles",
  },
  {
    label: "Workshops",
    href: "/instructor/f/t40-workshop-enrollment-status?status=pending",
    gate: { modules: ["courseManagement"] },
    icon: "school",
    children: [
      { section: "ENROLMENTS", label: "Pending", href: "/instructor/f/t40-workshop-enrollment-status?status=pending", countKey: "pending" },
      { section: "ENROLMENTS", label: "Approved", href: "/instructor/f/t40-workshop-enrollment-status?status=approved", countKey: "approved" },
      { section: "ENROLMENTS", label: "Declined", href: "/instructor/f/t40-workshop-enrollment-status?status=declined", countKey: "declined" },
      { section: "MISCELLANEOUS", label: "My Workshops", href: "/instructor/f/t11-workshops?list=mine", match: ["/instructor/f/t24-workshop-detail", "/instructor/f/in-20-workshops"] },
      { section: "MISCELLANEOUS", label: "Available Workshops", href: "/instructor/f/t11-workshops?list=available", countKey: "available" },
      { section: "MISCELLANEOUS", label: "Completed Workshops", href: "/instructor/f/t11-workshops?list=completed", countKey: "completed" },
      { section: "MISCELLANEOUS", label: "Workshop Attendance", href: "/instructor/f/t41-workshop-attendance" },
      { section: "MISCELLANEOUS", label: "New Workshop Enrolment", href: "/instructor/f/t42-new-workshop-enrollment" },
    ],
  },
  {
    label: "Students",
    href: "/instructor/f/t12-students-view",
    gate: { modules: ["studentRecords"] },
    icon: "users",
    children: [
      { section: "STUDENTS BY STATUS", label: "New Inquiry", href: "/instructor/f/t12-students-view?status=New%20Inquiry", countKey: "st_New Inquiry" },
      { section: "STUDENTS BY STATUS", label: "Approved Application", href: "/instructor/f/t12-students-view?status=Approved%20Application", countKey: "st_Approved Application" },
      { section: "STUDENTS BY STATUS", label: "Pre-enrolment Application", href: "/instructor/f/t12-students-view?status=Pre-enrolment%20Application", countKey: "st_Pre-enrolment Application" },
      { section: "STUDENTS BY STATUS", label: "CLOA", href: "/instructor/f/t12-students-view?status=CLOA", countKey: "st_CLOA" },
      { section: "STUDENTS BY STATUS", label: "LOA", href: "/instructor/f/t12-students-view?status=LOA", countKey: "st_LOA" },
      { section: "STUDENTS BY STATUS", label: "Cancelled/ Did not proceed", href: "/instructor/f/t12-students-view?status=Cancelled%2F%20Did%20not%20proceed", countKey: "st_Cancelled/ Did not proceed" },
      { section: "STUDENTS BY STATUS", label: "Follow Up", href: "/instructor/f/t12-students-view?status=Follow%20Up", countKey: "st_Follow Up" },
      { section: "STUDENTS BY STATUS", label: "In-active Leads", href: "/instructor/f/t12-students-view?status=In-active%20Leads", countKey: "st_In-active Leads" },
      { section: "STUDENTS BY STATUS", label: "Duplicate profiles", href: "/instructor/f/t12-students-view?status=Duplicate%20profiles", countKey: "st_Duplicate profiles" },
      { section: "STUDENTS BY STATUS", label: "Declined Application", href: "/instructor/f/t12-students-view?status=Declined%20Application", countKey: "st_Declined Application" },
      { section: "STUDENTS BY STATUS", label: "Registered Student", href: "/instructor/f/t12-students-view?status=Registered%20Student", countKey: "st_Registered Student" },
      { section: "STUDENTS BY STATUS", label: "Active Student", href: "/instructor/f/t12-students-view?status=Active%20Student", countKey: "st_Active Student" },
      { section: "STUDENTS BY STATUS", label: "On-Hold", href: "/instructor/f/t12-students-view?status=On-Hold", countKey: "st_On-Hold" },
      { section: "STUDENTS BY STATUS", label: "Leave of Absence", href: "/instructor/f/t12-students-view?status=Leave%20of%20Absence", countKey: "st_Leave of Absence" },
      { section: "STUDENTS BY STATUS", label: "Graduated", href: "/instructor/f/t12-students-view?status=Graduated", countKey: "st_Graduated" },
      { section: "STUDENTS BY STATUS", label: "Incomplete", href: "/instructor/f/t12-students-view?status=Incomplete", countKey: "st_Incomplete" },
      { section: "STUDENTS BY STATUS", label: "Withdrawn Students", href: "/instructor/f/t12-students-view?status=Withdrawn%20Students", countKey: "st_Withdrawn Students" },
      { section: "STUDENTS BY STATUS", label: "Dismissed", href: "/instructor/f/t12-students-view?status=Dismissed", countKey: "st_Dismissed" },
      { section: "STUDENTS BY STATUS", label: "Refused Visa", href: "/instructor/f/t12-students-view?status=Refused%20Visa", countKey: "st_Refused Visa" },
      { section: "STUDENTS BY STATUS", label: "File not Logged (Offshore student)", href: "/instructor/f/t12-students-view?status=File%20not%20Logged%20(Offshore%20student)", countKey: "st_File not Logged (Offshore student)" },
      { section: "STUDENTS BY STATUS", label: "Prospective Student (Marketing team)", href: "/instructor/f/t12-students-view?status=Prospective%20Student%20(Marketing%20team)", countKey: "st_Prospective Student (Marketing team)" },
      { section: "STUDENT MANAGEMENT", label: "Browse All Students", href: "/instructor/f/t12-students-view" },
      { section: "STUDENT MANAGEMENT", label: "Create Student Profile", href: "/instructor/f/t43-create-student-profile", gate: { modules: ["studentRecords"], edit: true } },
      { section: "STUDENT MANAGEMENT", label: "Academic Alerts", href: "/instructor/f/t44-academic-alerts", countKey: "alerts" },
      { section: "STUDENT MANAGEMENT", label: "Student Flags", href: "/instructor/f/t45-student-flags", countKey: "flags" },
      { section: "STUDENT MANAGEMENT", label: "Student Assessments", href: "/instructor/f/t46-student-assessments" },
      { section: "STUDENT MANAGEMENT", label: "Student Requirements", href: "/instructor/f/t47-student-requirements" },
      { section: "STUDENT MANAGEMENT", label: "Leave of Absence", href: "/instructor/f/t48-leave-of-absence" },
      { section: "STUDENT MANAGEMENT", label: "Course Withdraw Requests", href: "/instructor/f/t49-course-withdraw-requests" },
      { section: "STUDENT MANAGEMENT", label: "Pending Grade Submissions", href: "/instructor/f/t62-pending-grade-submissions", countKey: "grades" },
      { section: "STUDENT MANAGEMENT", label: "Accountability inbox", href: "/instructor/compliance" },
      { section: "STUDENT MANAGEMENT", label: "Pending Transcript Changes", href: "/instructor/f/t64-pending-transcript-changes" },
      { section: "STUDENT MANAGEMENT", label: "Pending Entry / Progress Marks", href: "/instructor/f/t62-pending-grade-submissions" },
      { section: "STUDENT MANAGEMENT", label: "Badges / Accomplishments", href: "/instructor/f/t82-badges-accomplishments" },
    ],
  },
  {
    label: "Program Management",
    href: "/instructor/f/t13-program-management",
    gate: { modules: ["programManagement"] },
    icon: "briefcase",
    children: [
      { label: "Faculties & Programs", href: "/instructor/f/t13-program-management", match: ["/instructor/f/t81-add-faculty", "/instructor/f/t74-add-program", "/instructor/f/t83-program-settings"] },
      { label: "Add Program", href: "/instructor/f/t74-add-program", gate: { modules: ["programManagement"], edit: true } },
      { label: "Program Types", href: "/instructor/f/t50-program-types", match: ["/instructor/f/t75-add-program-type"] },
      { label: "Manage Terms", href: "/instructor/f/t51-manage-terms", match: ["/instructor/f/t76-add-term", "/instructor/f/t84-review-term"] },
      { label: "Academic Calendars", href: "/instructor/f/t52-academic-calendars", match: ["/instructor/f/t73-create-academic-calendar"] },
      { label: "Master Scheduling", href: "/instructor/f/t53-master-scheduling", match: ["/instructor/f/t71-create-master-schedule", "/instructor/f/t72-create-term-schedule", "/instructor/f/t85-manage-schedule"] },
      { label: "Program Change Request", href: "/instructor/f/t27-program-change-request" },
    ],
  },
  {
    label: "My Assigned Work",
    href: "/instructor/assigned-work",
    icon: "briefcase",
    children: [
      { label: "All Assigned Work", href: "/instructor/assigned-work" },
      { label: "Labs & Practicum", href: "/instructor/assigned-work?category=Labs+%26+Practicum" },
      { label: "Compliance Assignments", href: "/instructor/assigned-work?category=Compliance" },
    ],
  },
  {
    label: "Student Success",
    href: "/instructor/student-success/cases",
    gate: { modules: ["studentRecords"] },
    icon: "users",
    children: [
      { label: "My Assigned Cases", href: "/instructor/student-success/cases" },
      { label: "My Appointments", href: "/instructor/student-success/appointments" },
    ],
  },
  {
    label: "CRM Counselling",
    href: "/instructor/crm/leads",
    gate: { modules: ["studentRecords"] },
    icon: "users",
    children: [
      { label: "My Assigned Leads", href: "/instructor/crm/leads" },
    ],
  },
  {
    label: "Course Management",
    href: "/instructor/f/t14-course-management",
    gate: { modules: ["courseManagement"] },
    icon: "settings",
    children: [
      {
        section: "COURSE MANAGEMENT",
        label: "Courses & Sessions",
        href: "/instructor/f/t54-courses-sessions",
        match: ["/instructor/f/t77-course-admin", "/instructor/f/t78-add-session-offering", "/instructor/f/t55-add-course-form"],
      },
      { section: "COURSE MANAGEMENT", label: "Active Courses", href: "/instructor/f/t56-active-courses" },
      {
        section: "COURSE MANAGEMENT",
        label: "Course Repository",
        href: "/instructor/f/t37-course-repository",
        match: ["/instructor/f/t80-create-content-course"],
      },
      { section: "COURSE MANAGEMENT", label: "Course Backups", href: "/instructor/f/t65-course-backups" },
      {
        section: "COURSE MANAGEMENT",
        label: "Course Textbooks",
        href: "/instructor/f/t57-course-textbooks",
        match: ["/instructor/f/t79-add-textbook"],
      },
      {
        section: "COURSE CONFIGURATIONS",
        label: "Course Categories",
        href: "/instructor/f/t58-course-categories",
        match: ["/instructor/f/t66-course-configurations"],
      },
      {
        section: "COURSE CONFIGURATIONS",
        label: "Course Groups",
        href: "/instructor/f/t59-course-groups-types",
        match: ["/instructor/f/t68-add-course-group"],
      },
      {
        section: "COURSE CONFIGURATIONS",
        label: "Course Types",
        href: "/instructor/f/t67-course-types",
        match: ["/instructor/f/t69-add-course-type"],
      },
      { section: "COURSE CONFIGURATIONS", label: "Course Resources", href: "/instructor/f/t60-course-resources-management" },
      {
        section: "COURSE CONFIGURATIONS",
        label: "Badges & Accomplishments",
        href: "/instructor/f/t82-badges-accomplishments",
        match: ["/instructor/f/t70-add-badge"],
      },
      {
        section: "COURSE CONFIGURATIONS",
        label: "Grading Schemes",
        href: "/instructor/f/t61-grading-schemes",
        match: ["/instructor/f/t64-add-grading-scheme"],
      },
    ],
  },
  {
    label: "Communication",
    href: "/instructor/messages",
    gate: { modules: ["emailMessaging"] },
    icon: "bell",
    children: [
      { label: "Message Center", href: "/instructor/messages", match: ["/instructor/f/t16-teacher-messages-chat", "/instructor/mail"] },
      { label: "Notifications", href: "/instructor/notifications" },
      { label: "Search", href: "/instructor/search" },
      { label: "Ask CampusOne", href: "/instructor/ask" },
    ],
  },
];

const STUDIO_NAV = [
  { label: "Studio", href: "/instructor/f/in-12-ai-course-studio" },
  { label: "Outcomes", href: "/instructor/f/in-14-outcome-mapping" },
  { label: "Assessments", href: "/instructor/f/t10-assessments-gradebook" },
  { label: "Rubrics", href: "/instructor/f/in-16-rubric-generator" },
  { label: "Approval", href: "/instructor/f/in-17-course-approval" },
  { label: "Availability", href: "/instructor/f/t04-profile-availability" },
  { label: "Compensation", href: "/instructor/f/t05-profile-compensation" },
  { label: "Workshops", href: "/instructor/f/t11-workshops" },
];

function NavIcon({ name, active }: { name: string; active?: boolean }) {
  const stroke = active ? "#2563EB" : "#64748B";
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "bar-chart":
      return (
        <svg {...common}>
          <path d="M4 20V10M12 20V4M20 20v-7" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
          <path d="M6 3v14" />
        </svg>
      );
    case "school":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5z" />
          <path d="M5 10.5V17c0 1.5 3 3 7 3s7-1.5 7-3v-6.5" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
          <path d="M12 8.5 13.2 11l2.5.4-1.8 1.8.4 2.5L12 14.5 10.7 15.7l.4-2.5-1.8-1.8 2.5-.4z" />
        </svg>
      );
    default:
      return <span style={{ width: 16, height: 16 }} />;
  }
}

function splitHref(href: string) {
  const i = href.indexOf("?");
  if (i < 0) return { pathname: href, query: {} as Record<string, string> };
  return { pathname: href.slice(0, i), query: Object.fromEntries(new URLSearchParams(href.slice(i + 1))) };
}

function pathMatches(pathname: string, href: string, extra: string[] = []) {
  const targetPath = splitHref(href).pathname;
  return [targetPath, ...extra].some((target) => {
    if (target === "/instructor") return pathname === "/instructor";
    return pathname === target || pathname.startsWith(`${target}/`);
  });
}

function childMatches(pathname: string, child: NavChild, search: URLSearchParams, siblings: NavChild[] = []) {
  const { pathname: hrefPath, query } = splitHref(child.href);
  const extraHit = (child.match || []).some((target) => pathname === target || pathname.startsWith(`${target}/`));
  if (extraHit) return true;
  if (!pathMatches(pathname, hrefPath)) return false;
  const samePath = siblings.filter((s) => splitHref(s.href).pathname === hrefPath);
  const keys = new Set(samePath.flatMap((s) => Object.keys(splitHref(s.href).query)));
  if (!keys.size) return true;
  for (const key of keys) {
    const expected = query[key];
    const fallback = key === "status" ? "pending" : key === "list" ? "mine" : "";
    const actual = search.get(key) || fallback;
    if (expected) {
      if (actual !== expected) return false;
    } else if (search.get(key)) {
      const other = samePath.map((s) => splitHref(s.href).query[key]).filter(Boolean);
      if (other.includes(search.get(key) || "")) return false;
    }
  }
  return true;
}

function isActive(pathname: string, item: NavItem, search: URLSearchParams) {
  if (item.children?.length) return item.children.some((child) => childMatches(pathname, child, search, item.children));
  return pathMatches(pathname, item.href, item.match);
}

function visibleNav(items: NavItem[], access: MyAccess | null | undefined) {
  return items
    .filter((item) => allows(access, item.gate))
    .map((item) => (item.children ? { ...item, children: item.children.filter((c) => allows(access, c.gate)) } : item));
}

function pageBlocked(pathname: string, search: URLSearchParams, access: MyAccess | null | undefined) {
  if (access === null) return false;
  for (const item of NAV) {
    if (!isActive(pathname, item, search) && !pathMatches(pathname, item.href)) continue;
    if (!allows(access, item.gate)) return true;
    const child = item.children?.find((c) => childMatches(pathname, c, search, item.children));
    return Boolean(child && !allows(access, child.gate));
  }
  return false;
}

export function TeacherSisShell({
  children,
  activeHref = "/instructor",
  title = "CampusOne",
  subtitle,
  shell = "campus",
  studioActive,
  userName: userNameProp,
  userRole = "INSTRUCTOR",
  studentCount,
  hideSignOut = false,
  workshopCounts,
  draftGradeCount,
  statusCounts,
  flagCount,
  alertCount,
}: {
  children: ReactNode;
  activeHref?: string;
  title?: string;
  subtitle?: string;
  shell?: "campus" | "studio";
  studioActive?: string;
  userName?: string;
  userRole?: string;
  studentCount?: number;
  hideSignOut?: boolean;
  workshopCounts?: {
    pending?: number;
    approved?: number;
    declined?: number;
    available?: number;
    completed?: number;
  };
  draftGradeCount?: number;
  statusCounts?: Record<string, number>;
  flagCount?: number;
  alertCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/instructor";
  const searchParams = useSearchParams();
  const current = pathname || activeHref;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [upcoming, setUpcoming] = useState<
    Array<{ id: string; courseCode: string; title: string; label: string; joinUrl?: string | null; minutesUntil: number }>
  >([]);
  const [sessionName, setSessionName] = useState("");

  useEffect(() => {
    const s = loadSession();
    setSessionName(s ? `${s.givenName ?? ""} ${s.familyName ?? ""}`.trim() : "");
  }, []);

  const propName = userNameProp?.trim() || "";
  const userName = (propName && propName !== "Instructor" ? propName : sessionName) || propName || "Instructor";

  async function signOut() {
    await logout();
    router.push("/login");
  }

  function submitHeaderSearch() {
    const q = searchQ.trim();
    router.push(q ? `/instructor/search?q=${encodeURIComponent(q)}` : "/instructor/search");
  }

  useEffect(() => {
    const s = loadSession();
    if (!s?.accessToken) return;
    let cancelled = false;
    const load = () => {
      void api<{ items: typeof upcoming }>("/compliance/upcoming?hours=12", {}, s.accessToken)
        .then((res) => {
          if (!cancelled) setUpcoming(res.items ?? []);
        })
        .catch(() => {
          if (!cancelled) setUpcoming([]);
        });
    };
    load();
    const t = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const access = useMyAccess();
  const blocked = pageBlocked(current, searchParams, access);
  const navItems = useMemo(
    () =>
      visibleNav(NAV, access).map((item) =>
        item.href === "/instructor/f/t12-students-view" && studentCount != null
          ? { ...item, badge: studentCount.toLocaleString() }
          : item,
      ),
    [studentCount, access],
  );

  const initials = useMemo(
    () =>
      userName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("") || "IN",
    [userName],
  );

  const userHandle = useMemo(() => {
    const parts = userName.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return parts[0] || "Instructor";
    return `${parts[0]}.${parts[parts.length - 1]}`;
  }, [userName]);

  useEffect(() => {
    const match = NAV.find((item) => isActive(current, item, searchParams) && item.children);
    setOpenGroup(match?.href ?? null);
  }, [current, searchParams]);

  function countedLabel(child: NavChild) {
    if (!child.countKey) return child.label;
    if (child.countKey === "grades") return `${child.label} (${draftGradeCount ?? 0})`;
    if (child.countKey === "flags") return `${child.label} (${flagCount ?? 0})`;
    if (child.countKey === "alerts") return `${child.label} (${alertCount ?? 0})`;
    if (child.countKey.startsWith("st_")) {
      const label = child.countKey.slice(3);
      const n = statusCounts?.[label] ?? statusCounts?.[child.label] ?? 0;
      return `${child.label} (${n})`;
    }
    const n = workshopCounts?.[child.countKey as keyof NonNullable<typeof workshopCounts>];
    return `${child.label} (${n ?? 0})`;
  }

  if (shell === "studio") {
    return (
      <div className="mh-teacher mh-teacher--studio" data-figma="teacher-studio">
        <header className="mh-teacher-studio__nav">
          <div className="mh-teacher-studio__brand">
            <img
              src="/brand/campusone/logo.png"
              alt="CampusOne"
              className="mh-teacher-studio__brand-logo"
            />
            <nav className="mh-teacher-studio__links" aria-label="Course studio">
              {STUDIO_NAV.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  className={`mh-teacher-studio__link${(studioActive || activeHref) === item.href ? " is-active" : ""}`}
                  onClick={() => router.push(item.href)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="mh-teacher-studio__actions">
            <label className="mh-teacher__search">
              <img src="/brand/icons/search.svg" alt="" width={14} height={14} />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search catalog..."
                aria-label="Search catalog"
              />
            </label>
            <div className="mh-teacher__profile-chip">
              <span className="mh-teacher__avatar mh-teacher__avatar--sm" aria-hidden>
                {initials}
              </span>
              <span>{userName}</span>
            </div>
          </div>
        </header>
        <div className="mh-teacher__scroll">{children}</div>
        <AskHeritageFab role="instructor" />
      </div>
    );
  }

  return (
    <div className={`mh-teacher${navOpen ? " is-nav-open" : ""}`} data-figma="teacher-campus-os">
      <aside className="mh-teacher__sidebar">
        <div className="mh-teacher__sidebar-top">
          <button
            type="button"
            className="mh-teacher__brand mh-teacher__brand--logo"
            aria-label="CampusOne"
            onClick={() => router.push("/instructor")}
          >
            <img
              src="/brand/campusone/logo.png"
              alt="CampusOne"
              className="mh-teacher__brand-logo"
            />
          </button>

          {upcoming.length ? (
            <div className="mh-teacher__upcoming" aria-label="Upcoming classes">
              <p className="mh-teacher__upcoming-kicker">Up next</p>
              {upcoming.slice(0, 3).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`mh-teacher__upcoming-item${u.minutesUntil <= 60 ? " is-soon" : ""}`}
                  onClick={() => {
                    if (u.joinUrl) window.open(u.joinUrl, "_blank", "noopener,noreferrer");
                    else router.push("/instructor/f/t06-profile-schedule");
                  }}
                >
                  <strong>
                    {u.courseCode} · {u.label}
                  </strong>
                  <span>{u.title}</span>
                </button>
              ))}
              <button type="button" className="mh-teacher__upcoming-link" onClick={() => router.push("/instructor/compliance")}>
                Accountability inbox
              </button>
            </div>
          ) : null}

          <nav className="mh-teacher__nav" aria-label="Teacher">
            {navItems.map((item) => {
              const active = isActive(current, item, searchParams);
              const expanded = Boolean(item.children) && openGroup === item.href;
              return (
                <div key={item.href} className={`mh-teacher__nav-group${active ? " is-active" : ""}`}>
                  <button
                    type="button"
                    className={`mh-teacher__nav-item${active ? " is-active" : ""}`}
                    aria-expanded={item.children ? expanded : undefined}
                    onClick={() => {
                      if (item.children) {
                        setOpenGroup((value) => (value === item.href ? null : item.href));
                        return;
                      }
                      setOpenGroup(null);
                      router.push(item.href);
                    }}
                  >
                    <span className="mh-teacher__nav-icon">
                      <NavIcon name={item.icon} active={active} />
                    </span>
                    <span className="mh-teacher__nav-text">{item.label}</span>
                    {item.badge ? <span className="mh-teacher__nav-badge">{item.badge}</span> : null}
                    {item.children ? (
                      <img
                        src={`/brand/icons/chevron-${expanded ? "down" : "right"}.svg`}
                        alt=""
                        width={16}
                        height={16}
                        className="mh-teacher__nav-chevron"
                      />
                    ) : null}
                  </button>
                  {item.children && expanded ? (
                    <div className="mh-teacher__nav-sub">
                      {item.children.map((child, index) => {
                        const prev = item.children![index - 1];
                        const showSection = Boolean(child.section && child.section !== prev?.section);
                        return (
                          <div key={`${child.label}-${child.href}`}>
                            {showSection ? <p className="mh-teacher__nav-section">{child.section}</p> : null}
                            <button
                              type="button"
                              className={`mh-teacher__nav-subitem${childMatches(current, child, searchParams, item.children) ? " is-active" : ""}`}
                              onClick={() => router.push(child.href)}
                            >
                              <span className="mh-teacher__nav-dot" />
                              {countedLabel(child)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="mh-teacher__sidebar-foot">
          <div className="mh-teacher__user-card">
            <span className="mh-teacher__avatar" aria-hidden>
              {initials}
            </span>
            <span>
              <strong>{userName}</strong>
              <span>{userHandle}</span>
            </span>
          </div>
          <div className="mh-teacher__foot-actions">
            <button type="button" aria-label="Messages" onClick={() => router.push("/instructor/messages")}>
              <img src="/brand/icons/file-text.svg" alt="" width={16} height={16} />
            </button>
            <button type="button" aria-label="Home" onClick={() => router.push("/instructor")}>
              <img src="/brand/icons/school.svg" alt="" width={16} height={16} />
            </button>
            <button type="button" aria-label="Notifications" onClick={() => router.push("/instructor/notifications")}>
              <img src="/brand/icons/bell.svg" alt="" width={16} height={16} />
            </button>
            {hideSignOut ? null : (
              <button
                type="button"
                aria-label="Sign out"
                onClick={signOut}
              >
                <img src="/brand/icons/chevron-right.svg" alt="" width={16} height={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="mh-teacher__main">
        <header className="mh-teacher__header">
          <div className="mh-teacher__title-group">
            <button
              type="button"
              className="mh-teacher__nav-toggle"
              aria-label={navOpen ? "Close sidebar" : "Open sidebar"}
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
            {title ? <h1>{title}</h1> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="mh-teacher__header-actions">
            <label className="mh-teacher__search">
              <button type="button" className="mh-teacher__search-icon" aria-label="Search" onClick={submitHeaderSearch}>
                <img src="/brand/icons/search.svg" alt="" width={14} height={14} />
              </button>
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitHeaderSearch();
                  }
                }}
                placeholder="Student # or last name"
                aria-label="Student # or last name"
              />
            </label>
            <Link href="/instructor/search?advanced=1" className="mh-teacher__advanced-search">
              Advanced Search
            </Link>
            <button
              type="button"
              className="mh-teacher__bell"
              aria-label="Notifications"
              onClick={() => router.push("/instructor/notifications")}
            >
              <img src="/brand/icons/bell.svg" alt="" width={18} height={18} />
            </button>
            <div className="mh-teacher__profile">
              <span className="mh-teacher__avatar mh-teacher__avatar--photo" aria-hidden>
                {initials}
              </span>
              <span className="mh-teacher__profile-meta">
                <strong>{userName}</strong>
                {hideSignOut ? (
                  <span className="mh-teacher__role-pill">{userRole}</span>
                ) : (
                  <button
                    type="button"
                    className="mh-teacher__logout-link"
                    onClick={signOut}
                  >
                    Log Out
                  </button>
                )}
              </span>
            </div>
          </div>
        </header>
        <div className="mh-teacher__scroll">{blocked ? access === undefined ? null : <NoModuleAccess /> : children}</div>
        <AskHeritageFab role="instructor" />
      </div>
    </div>
  );
}
