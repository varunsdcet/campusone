"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AppShell,
  Banner,
  Breadcrumb,
  Button,
  Panel,
  RecordHeader,
  StatusPill,
  LogoMark,
} from "@myheritage/ui";
import { loadSession, logout, type Session } from "@/lib/api";
import { resolveNav, type ShellRole } from "@/lib/nav";
import { AskHeritageFab } from "@/components/AskHeritageFab";

type Props = {
  role: ShellRole;
  title: string;
  subtitle?: string;
  breadcrumb: string[];
  active?: string;
  requireAuth?: boolean;
  guestName?: string;
  meta?: ReactNode;
  children: ReactNode;
  hideChromeHeader?: boolean;
};

const ROLE_MATCH: Record<ShellRole, string[]> = {
  admin: ["admin", "registrar"],
  instructor: ["instructor"],
  student: ["student"],
  applicant: ["applicant"],
  employer: ["employer"],
};

function homeForRoles(roles: string[]): string {
  if (roles.includes("instructor")) return "/instructor";
  if (roles.includes("admin") || roles.includes("registrar")) return "/admin";
  if (roles.includes("applicant")) return "/applicant";
  if (roles.includes("employer")) return "/employer";
  if (roles.includes("student")) return "/student";
  return "/login";
}

export function ScreenScaffold({
  role,
  title,
  subtitle,
  breadcrumb,
  active,
  requireAuth = true,
  guestName = "Guest",
  meta,
  children,
  hideChromeHeader = false,
}: Props) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!requireAuth);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!requireAuth) {
      setReady(true);
      return;
    }
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    const allowed = ROLE_MATCH[role] ?? [role];
    if (!s.roles.some((r) => allowed.includes(r))) {
      setForbidden(true);
      setSession(s);
      setReady(true);
      return;
    }
    setForbidden(false);
    setSession(s);
    setReady(true);
  }, [requireAuth, router, role]);

  if (!ready) return null;

  if (forbidden && session) {
    const home = homeForRoles(session.roles);
    return (
      <div style={{ minHeight: "40vh", display: "grid", placeItems: "center", padding: "2rem", textAlign: "center" }}>
        <div>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: 22 }}>Access denied</h1>
          <p style={{ margin: "0 0 1rem", color: "var(--mh-text-muted)" }}>
            Your account does not have access to the {role} portal.
          </p>
          <Button type="button" onClick={() => router.replace(home)}>
            Go to your portal
          </Button>
        </div>
      </div>
    );
  }

  const userName = session ? `${session.givenName} ${session.familyName}` : guestName;

  return (
    <AppShell
      role={role}
      userName={userName}
      active={active}
      onNavigate={(item) => {
        if (item === "Ask CampusOne") {
          router.push(
            role === "student"
              ? "/student/ask"
              : role === "instructor"
                ? "/instructor/ask"
                : role === "admin"
                  ? "/admin/ai/ask"
                  : `/${role}/ask`,
          );
          return;
        }
        if (item === "Search") {
          router.push(
            role === "admin"
              ? "/admin/search"
              : role === "student"
                ? "/student/search"
                : role === "instructor"
                  ? "/instructor/search"
                  : role === "applicant"
                    ? "/applicant/search"
                    : role === "employer"
                      ? "/employer/search"
                      : `/${role}`,
          );
          return;
        }
        if (item === "Notifications") {
          router.push(
            role === "admin"
              ? "/admin/ops/workspace/notifications"
              : role === "instructor"
                ? "/instructor/notifications"
                : role === "student"
                  ? "/student/notifications"
                  : role === "applicant"
                    ? "/applicant/notifications"
                    : role === "employer"
                      ? "/employer/notifications"
                      : `/${role}`,
          );
          return;
        }
        if (item === "Profile") {
          router.push(
            role === "admin"
              ? "/admin/faculty-profile"
              : role === "instructor"
                ? "/instructor/profile"
                : role === "student"
                  ? "/student/profile"
                  : role === "applicant"
                    ? "/applicant/application"
                    : role === "employer"
                      ? "/employer/profile"
                      : `/${role}`,
          );
          return;
        }
        const href = resolveNav(role, item);
        if (href) router.push(href);
      }}
    >
      {!hideChromeHeader ? (
        <>
          <Breadcrumb items={breadcrumb} />
          <RecordHeader
            title={title}
            subtitle={subtitle}
            meta={
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                {meta}
                {session ? (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={async () => {
                      await logout();
                      router.push("/login");
                    }}
                    style={{ padding: "0.4rem 0.75rem", fontSize: 13 }}
                  >
                    Sign out
                  </Button>
                ) : null}
              </div>
            }
          />
        </>
      ) : null}
      {children}
      {role === "instructor" ||
      role === "student" ||
      role === "admin" ||
      role === "applicant" ||
      role === "employer" ? (
        <AskHeritageFab role={role} />
      ) : null}
    </AppShell>
  );
}

export function FixtureNotice({ apiHint }: { apiHint?: string }) {
  return (
    <Banner>
      FD-07 fixture view{apiHint ? ` · live API: ${apiHint}` : " · backend endpoint pending"}
    </Banner>
  );
}

export function StatRow({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: string }>;
}) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.75rem 0 1rem" }}>
      {items.map((item) => (
        <StatusPill
          key={item.label}
          tone={(item.tone as "neutral" | "success" | "warning" | "danger" | "ai" | undefined) ?? "neutral"}
        >
          {item.label}: {item.value}
        </StatusPill>
      ))}
    </div>
  );
}

export function ListPanel({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ primary: string; secondary?: string; meta?: string }>;
  empty?: string;
}) {
  return (
    <Panel title={title}>
      {!rows.length ? (
        <p style={{ color: "var(--mh-text-muted)", margin: 0 }}>{empty ?? "Nothing here yet."}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.65rem" }}>
          {rows.map((row) => (
            <li
              key={row.primary + (row.secondary ?? "")}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap",
                paddingBottom: "0.65rem",
                borderBottom: "1px solid var(--mh-border)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{row.primary}</div>
                {row.secondary ? (
                  <div style={{ color: "var(--mh-text-muted)", fontSize: "var(--mh-body-compact)" }}>{row.secondary}</div>
                ) : null}
              </div>
              {row.meta ? (
                <span style={{ color: "var(--mh-text-muted)", fontSize: "var(--mh-body-compact)" }}>{row.meta}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const MOBILE_TABS = [
  { label: "Home", href: "/m/student" },
  { label: "Courses", href: "/m/student/courses" },
  { label: "Schedule", href: "/m/f/mb-04-student-schedule" },
  { label: "Grades", href: "/m/student/grades" },
  { label: "More", href: "/m/student/profile" },
] as const;

const INSTRUCTOR_MOBILE_TABS = [
  { label: "Home", href: "/m/instructor/home" },
  { label: "Attendance", href: "/m/instructor/attendance" },
  { label: "Grades", href: "/m/instructor/grades" },
] as const;

const MOBILE_MORE_LINKS = [
  { label: "Documents", href: "/m/student/documents" },
  { label: "Fees", href: "/m/student/fees" },
  { label: "Library", href: "/m/student/library" },
  { label: "Profile", href: "/m/student/profile" },
  { label: "Notifications", href: "/m/f/mb-09-notifications" },
  { label: "To-do", href: "/m/f/mb-03-student-todo" },
  { label: "Offline access", href: "/m/f/mb-10-offline-state" },
] as const;

export function MobileChrome({
  children,
  title,
  active = "Home",
}: {
  children: ReactNode;
  title: string;
  active?: (typeof MOBILE_TABS)[number]["label"];
}) {
  const pathname = usePathname() || "";
  const instructor = pathname.startsWith("/m/instructor");
  const tabs = instructor ? INSTRUCTOR_MOBILE_TABS : MOBILE_TABS;
  const activeLabel = instructor
    ? pathname.includes("/attendance")
      ? "Attendance"
      : pathname.includes("/grades")
        ? "Grades"
        : "Home"
    : active;

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background: "var(--mh-bg)",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--mh-border)",
        borderRight: "1px solid var(--mh-border)",
      }}
    >
      <header
        style={{
          padding: "0.85rem 1.25rem 1rem",
          background: "var(--mh-brand)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.65rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              background: "#fff",
              color: "var(--mh-brand)",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            H
          </div>
          <strong style={{ fontSize: 16 }}>{title}</strong>
        </div>
        <span style={{ fontSize: 18, opacity: 0.9 }} aria-hidden>
          ≡
        </span>
      </header>
      <div style={{ padding: "1.1rem", flex: 1 }}>{children}</div>
      {!instructor && activeLabel === "More" ? (
        <nav
          aria-label="More student modules"
          style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 12px", borderTop: "1px solid var(--mh-border)" }}
        >
          {MOBILE_MORE_LINKS.map((item) => (
            <a key={item.href} href={item.href} style={{ color: "var(--mh-brand)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid var(--mh-border)",
          background: "var(--mh-surface)",
          padding: "8px 0 12px",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.label === activeLabel;
          return (
            <a
              key={tab.label}
              href={tab.href}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--mh-brand)" : "var(--mh-text-muted)",
                padding: "4px 0",
              }}
            >
              {tab.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

export { LogoMark };
