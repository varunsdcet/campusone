"use client";

import type { FormEvent, ReactNode } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, loadSession, logout } from "@/lib/api";
import { AskHeritageFab } from "@/components/AskHeritageFab";
import { NoModuleAccess, allows, useMyAccess, type ModuleGate, type MyAccess } from "@/lib/access";

type NavChild = {
  label: string;
  href: string;
  match?: string[];
  section?: string;
  exact?: boolean;
  gate?: ModuleGate;
};

type NavItem = {
  label: string;
  href: string;
  icon: string;
  children?: NavChild[];
  gate?: ModuleGate;
};

type ActiveCourse = {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  sectionCode: string;
  enrolmentStatus: "enrolled" | "completed";
};

const BASE_NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/student",
    icon: "bar-chart",
  },
  {
    label: "My Profile / Settings",
    href: "/student/profile",
    icon: "user",
    children: [
      { label: "Security Settings", href: "/student/security" },
      { label: "Change Time Zone", href: "/student/timezone" },
      { label: "Request to Update Personal Details", href: "/student/profile" },
    ],
  },
  {
    label: "My Courses",
    href: "/student/courses",
    gate: { modules: ["courseManagement"] },
    icon: "book",
    children: [
      {
        section: "MISCELLANEOUS",
        label: "All My Courses / Schedule",
        href: "/student/courses",
        exact: true,
      },
      { section: "MISCELLANEOUS", label: "Course History", href: "/student/course-history" },
    ],
  },
  {
    label: "Workshops",
    href: "/student/workshops",
    gate: { modules: ["courseManagement"] },
    icon: "users",
    children: [
      { label: "My Workshops", href: "/student/workshops" },
      { label: "Available Workshops", href: "/student/workshops?tab=available" },
      { label: "Completed Workshops", href: "/student/workshops?tab=completed" },
    ],
  },
  {
    label: "Labs & Practicum",
    href: "/student/labs",
    icon: "school",
    children: [
      { label: "My Labs", href: "/student/labs" },
      { label: "My Practicum", href: "/student/f/st-17-practicum" },
    ],
  },
  {
    label: "Career & Opportunities",
    href: "/student/career",
    icon: "briefcase",
  },
  {
    label: "My Records",
    href: "/student/grades",
    icon: "briefcase",
    children: [
      { label: "Final Marks / Grades", href: "/student/grades" },
      { label: "Degree Progress & Transfer Credits", href: "/student/degree" },
      { label: "Program Plan & Cohort", href: "/student/f/st-23-program-plan" },
      { label: "My Accomplishments & Badges", href: "/student/accomplishments" },
      { label: "Extracurricular Records", href: "/student/f/st-25-extracurricular", gate: { modules: ["studentRecords"] } },
      { label: "Pending Required Tasks", href: "/student/f/st-27-required-tasks", gate: { modules: ["studentRecords"] } },
      { label: "My Documents", href: "/student/documents", gate: { modules: ["studentRecords"] } },
      { label: "Privacy & Record Status", href: "/student/compliance", gate: { modules: ["studentRecords"] } },
      { label: "Tax Documents / Forms", href: "/student/f/st-26-tax-documents", gate: { modules: ["financialManagement"] } },
      { label: "Financial Statements", href: "/student/fees", gate: { modules: ["financialManagement"] } },
    ],
  },
  {
    label: "Request Forms",
    href: "/student/leave-of-absence",
    gate: { modules: ["userRequests"] },
    icon: "school",
    children: [{ label: "Leave of Absence Application", href: "/student/leave-of-absence" }],
  },
  {
    label: "Student Support",
    href: "/student/success",
    gate: { modules: ["studentRecords"] },
    icon: "users",
    children: [
      { label: "My Success Plan", href: "/student/success" },
      { label: "Advising Appointments", href: "/student/advising" },
    ],
  },
  {
    label: "Communication",
    href: "/student/messages",
    gate: { modules: ["emailMessaging"] },
    icon: "bell",
    children: [
      { label: "Message Center", href: "/student/messages" },
      { label: "Notifications", href: "/student/notifications" },
      { label: "Search", href: "/student/search" },
      { label: "Ask CampusOne", href: "/student/ask" },
    ],
  },
];

function splitHref(href: string) {
  const i = href.indexOf("?");
  if (i < 0) return { pathname: href, query: {} as Record<string, string> };
  return { pathname: href.slice(0, i), query: Object.fromEntries(new URLSearchParams(href.slice(i + 1))) };
}

function pathMatches(pathname: string, href: string, extra: string[] = [], exact = false) {
  const targetPath = splitHref(href).pathname;
  return [targetPath, ...extra].some((target) => {
    if (target === "/student") return pathname === "/student";
    if (exact) return pathname === target;
    return pathname === target || pathname.startsWith(`${target}/`);
  });
}

function childMatches(pathname: string, child: NavChild, search: URLSearchParams, siblings: NavChild[] = []) {
  const { pathname: hrefPath, query } = splitHref(child.href);
  const extraHit = (child.match || []).some((target) => pathname === target || pathname.startsWith(`${target}/`));
  if (extraHit) return true;
  if (!pathMatches(pathname, hrefPath, [], child.exact)) return false;
  const samePath = siblings.filter((s) => splitHref(s.href).pathname === hrefPath);
  const keys = new Set(samePath.flatMap((s) => Object.keys(splitHref(s.href).query)));
  if (!keys.size) return true;
  for (const key of keys) {
    const expected = query[key];
    const fallback = key === "tab" ? "" : "";
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
  return pathMatches(pathname, item.href);
}

function NavIcon({ name, active }: { name: string; active?: boolean }) {
  const stroke = active ? "#F1F0F7" : "#A29FBA";
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
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
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
    default:
      return <span style={{ width: 16, height: 16 }} />;
  }
}

function pageBlocked(pathname: string, search: URLSearchParams, access: MyAccess | null | undefined) {
  if (access === null) return false;
  for (const item of BASE_NAV) {
    if (!isActive(pathname, item, search) && !pathMatches(pathname, item.href)) continue;
    if (!allows(access, item.gate)) return true;
    const child = item.children?.find((c) => childMatches(pathname, c, search, item.children));
    return Boolean(child && !allows(access, child.gate));
  }
  return false;
}

function buildNav(activeCourses: ActiveCourse[], access: MyAccess | null | undefined): NavItem[] {
  return BASE_NAV.filter((item) => allows(access, item.gate)).map((item) => {
    if (item.children && item.href !== "/student/courses") {
      return { ...item, children: item.children.filter((c) => allows(access, c.gate)) };
    }
    if (item.href !== "/student/courses") return item;
    const courseLinks: NavChild[] = activeCourses.map((c) => ({
      section: "ACTIVE COURSES",
      label: `${c.courseCode} (${c.sectionCode})`,
      href: `/student/courses/${c.sectionId}`,
    }));
    const misc = (item.children ?? []).filter((c) => c.section === "MISCELLANEOUS");
    return {
      ...item,
      children: [...courseLinks, ...misc],
    };
  });
}

type ShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  activeHref?: string;
  userName?: string;
  studentNumber?: string;
};

export function StudentSisShell(props: ShellProps) {
  return (
    <Suspense fallback={null}>
      <StudentSisShellInner {...props} />
    </Suspense>
  );
}

function StudentSisShellInner({
  children,
  title,
  subtitle,
  activeHref,
  userName = "Student",
  studentNumber = "",
}: ShellProps) {
  const router = useRouter();
  const pathname = usePathname() || "/student";
  const searchParams = useSearchParams();
  const current = activeHref || pathname;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [resolvedNumber, setResolvedNumber] = useState(studentNumber);
  const [activeCourses, setActiveCourses] = useState<ActiveCourse[]>([]);

  const access = useMyAccess();
  const nav = useMemo(() => buildNav(activeCourses, access), [activeCourses, access]);
  const blocked = pageBlocked(current, searchParams, access);

  const initials = useMemo(
    () =>
      userName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "ST",
    [userName],
  );

  useEffect(() => {
    setResolvedNumber(studentNumber);
  }, [studentNumber]);

  useEffect(() => {
    if (studentNumber) return;
    const session = loadSession();
    if (!session?.accessToken) return;
    let cancelled = false;
    api<{ studentNumber?: string }>("/me/profile", {}, session.accessToken, { skipAuthRedirect: true })
      .then((p) => {
        if (!cancelled && p.studentNumber) setResolvedNumber(p.studentNumber);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [studentNumber]);

  useEffect(() => {
    const session = loadSession();
    if (!session?.accessToken || !session.roles.includes("student")) return;
    let cancelled = false;
    api<{
      courses?: ActiveCourse[];
      items?: Array<{
        sectionId: string;
        code?: string;
        courseCode?: string;
        title?: string;
        courseTitle?: string;
        sectionCode?: string;
        status?: string;
        enrolmentStatus?: "enrolled" | "completed";
      }>;
    }>("/courses/me", {}, session.accessToken, { skipAuthRedirect: true })
      .then((payload) => {
        if (cancelled) return;
        const fromCourses = payload.courses ?? [];
        const fromItems = (payload.items ?? []).map((row) => ({
          sectionId: row.sectionId,
          courseCode: row.courseCode || row.code || "",
          courseTitle: row.courseTitle || row.title || "",
          sectionCode: row.sectionCode || "",
          enrolmentStatus: (row.enrolmentStatus ||
            (row.status === "completed" ? "completed" : "enrolled")) as "enrolled" | "completed",
        }));
        const list = fromCourses.length ? fromCourses : fromItems;
        const enrolled = list.filter((c) => c.enrolmentStatus === "enrolled");
        enrolled.sort((a, b) => {
          const rank = (code: string) => (/^ACSW\s*500$/i.test(code) ? 0 : 1);
          const diff = rank(a.courseCode) - rank(b.courseCode);
          if (diff !== 0) return diff;
          return a.courseCode.localeCompare(b.courseCode);
        });
        setActiveCourses(enrolled);
      })
      .catch(() => {
        if (!cancelled) setActiveCourses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  useEffect(() => {
    const match = nav.find((item) => isActive(current, item, searchParams) && item.children);
    setOpenGroup(match?.href ?? null);
  }, [current, nav, searchParams]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const q = searchQ.trim();
    router.push(q ? `/student/search?q=${encodeURIComponent(q)}` : "/student/search");
  }

  return (
    <div className="mh-teacher mh-student-shell" data-portal="student">
      <aside className="mh-teacher__sidebar">
        <div className="mh-teacher__sidebar-top">
          <button
            type="button"
            className="mh-teacher__brand mh-student-shell__brand"
            aria-label="CampusOne"
            onClick={() => router.push("/student")}
          >
            <img src="/brand/campusone/logo.png" alt="CampusOne" className="mh-student-shell__logo" />
          </button>

          <nav className="mh-teacher__nav" aria-label="Student">
            {nav.map((item) => {
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
                          <div key={`${child.href}-${child.label}`}>
                            {showSection ? <p className="mh-teacher__nav-section">{child.section}</p> : null}
                            <button
                              type="button"
                              className={`mh-teacher__nav-subitem${
                                childMatches(current, child, searchParams, item.children) ? " is-active" : ""
                              }`}
                              onClick={() => router.push(child.href)}
                            >
                              <span className="mh-teacher__nav-dot" />
                              {child.label}
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
              <span>Student</span>
            </span>
          </div>
          <div className="mh-teacher__foot-actions">
            <button type="button" aria-label="Messages" onClick={() => router.push("/student/messages")}>
              <img src="/brand/icons/file-text.svg" alt="" width={16} height={16} />
            </button>
            <button type="button" aria-label="Home" onClick={() => router.push("/student")}>
              <img src="/brand/icons/school.svg" alt="" width={16} height={16} />
            </button>
            <button type="button" aria-label="Notifications" onClick={() => router.push("/student/notifications")}>
              <img src="/brand/icons/bell.svg" alt="" width={16} height={16} />
            </button>
            <button type="button" className="mh-student-shell__sign-out" aria-label="Sign out" onClick={signOut}>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="mh-teacher__main">
        <header className="mh-teacher__header">
          <div className="mh-teacher__title-group">
            {title ? <h1>{title}</h1> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="mh-teacher__header-actions">
            <form className="mh-teacher__search" onSubmit={onSearch}>
              <img src="/brand/icons/search.svg" alt="" width={14} height={14} />
              <input
                value={searchQ}
                onChange={(event) => setSearchQ(event.target.value)}
                placeholder="Search your portal…"
                aria-label="Search student portal"
              />
            </form>
            <button
              type="button"
              className="mh-teacher__bell"
              aria-label="Mail"
              title="Mail"
              onClick={() => router.push("/student/messages")}
            >
              <img src="/brand/icons/file-text.svg" alt="" width={18} height={18} />
            </button>
            <button
              type="button"
              className="mh-teacher__bell"
              aria-label="Home"
              title="Home"
              onClick={() => router.push("/student")}
            >
              <img src="/brand/icons/school.svg" alt="" width={18} height={18} />
            </button>
            <button type="button" className="mh-teacher__bell" aria-label="Log out" title="Log out" onClick={signOut}>
              <img src="/brand/icons/chevron-right.svg" alt="" width={18} height={18} />
            </button>
            <div className="mh-teacher__profile">
              <button
                type="button"
                className="mh-teacher__avatar mh-teacher__avatar--photo"
                aria-label="Profile"
                onClick={() => router.push("/student/profile")}
              >
                {initials}
              </button>
              <span className="mh-teacher__profile-meta">
                <strong>{userName}</strong>
                {resolvedNumber ? <span className="mh-student-shell__number">{resolvedNumber}</span> : null}
                <button type="button" className="mh-teacher__logout-link" onClick={signOut}>
                  Log Out
                </button>
              </span>
            </div>
          </div>
        </header>
        <div className="mh-teacher__scroll">{blocked ? access === undefined ? null : <NoModuleAccess /> : children}</div>
        <AskHeritageFab role="student" />
      </div>
    </div>
  );
}

export function StudentFrame({
  title,
  subtitle,
  activeHref,
  children,
}: {
  role?: string;
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  active?: string;
  activeHref?: string;
  children: ReactNode;
}) {
  const [userName, setUserName] = useState("Student");

  useEffect(() => {
    const session = loadSession();
    if (session) setUserName(`${session.givenName} ${session.familyName}`.trim() || "Student");
  }, []);

  return (
    <StudentSisShell title={title} subtitle={subtitle} activeHref={activeHref} userName={userName}>
      <div className="mh-student-stack">{children}</div>
    </StudentSisShell>
  );
}
