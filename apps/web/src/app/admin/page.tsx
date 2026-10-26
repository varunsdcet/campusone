"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSisShell } from "@/components/AdminSisShell";
import { AdminQuickAccess, type AdminTodo } from "@/components/dashboard/AdminQuickAccess";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { SisActionBtn } from "@/components/SisActionBtn";
import { SisLiveProvider, useSisLive } from "@/lib/useAdminSisLive";
import { api, loadSession } from "@/lib/api";
import { allows, useMyAccess, type MyAccess } from "@/lib/access";

function roleLabel(access: MyAccess | null | undefined, roles: string[]) {
  if (access?.superAdmin) return "Administrator";
  if (access?.accessLevel) return access.accessLevel;
  return roles.includes("admin") ? "Administrator" : "Registrar's Office";
}

type CampusOverview = {
  institutionName: string;
  termName: string;
  termProgressPct: number;
  students: number;
  teachers: number;
  programs: number;
  courses: number;
  sections: number;
  enrolments: number;
  accounts: number;
  pendingApprovals: number;
  pendingGrades: number;
  publishedGrades: number;
  atRisk: number;
  pendingEvaluations: number;
  pendingLoa: number;
  pendingTasks: number;
  feesPostedCad: number;
  feesOpenCad: number;
  feesPastDueCad: number;
  activity: Array<{ actor: string; detail: string; when: string }>;
  health: Array<{ label: string; value: string }>;
};

function money(n: number) {
  return `CAD ${n.toLocaleString()}`;
}

function KpiButton({
  label,
  value,
  hint,
  href,
  danger,
}: {
  label: string;
  value: string | number;
  hint: string;
  href: string;
  danger?: boolean;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="mh-sis-dash__kpi mh-sis-dash__kpi--link"
      onClick={() => router.push(href)}
    >
      <div className="mh-sis-dash__kpi-label">{label}</div>
      <div className="mh-sis-dash__kpi-value">{value}</div>
      <div className={`mh-sis-dash__kpi-hint${danger ? " is-danger" : " is-up"}`}>{hint}</div>
    </button>
  );
}

function AdminHomeBody({
  stats,
  failed,
  onRetry,
  firstName,
  access,
}: {
  stats: CampusOverview | null;
  failed: boolean;
  onRetry: () => void;
  firstName: string;
  access: MyAccess | null | undefined;
}) {
  const router = useRouter();
  const live = useSisLive();
  const canOnboardUsers = allows(access, { modules: ["userManagement"], edit: true });
  const canEditStudents = allows(access, { modules: ["studentRecords"], edit: true });
  const canSeeFinance = allows(access, { modules: ["financialManagement"] });
  const canPostFinance = allows(access, { modules: ["financialManagement"], edit: true });
  const canSeeStudents = allows(access, { modules: ["studentRecords"] });
  const canSeeApprovals = allows(access, { modules: ["userRequests"] });
  const canSeeCourses = allows(access, { modules: ["courseManagement"] });
  const loading = stats === null;
  const blank = failed ? "—" : "…";
  const todos: AdminTodo[] | null = stats
    ? [
        { count: stats.pendingApprovals, one: "pending approval", many: "pending approvals", href: "/admin/approvals", show: canSeeApprovals },
        { count: stats.pendingGrades, one: "grade awaiting publish", many: "grades awaiting publish", href: "/admin/student-management/grades", show: canSeeApprovals },
        { count: stats.pendingLoa, one: "leave of absence request", many: "leave of absence requests", href: "/admin/student-management/leave", show: canSeeStudents },
        { count: stats.atRisk, one: "at-risk student", many: "at-risk students", href: "/admin/ops/success/cases", show: canSeeStudents },
        { count: stats.pendingEvaluations, one: "pending evaluation", many: "pending evaluations", href: "/admin/course-management/evaluations", show: canSeeCourses },
      ]
        .filter((t) => t.show && t.count > 0)
        .map((t) => ({ label: `${t.count} ${t.count === 1 ? t.one : t.many}`, href: t.href }))
    : null;

  return (
    <div className="mh-sis-dash" data-figma-id="168:10">
      <div className="mh-ct-dash">
        <div className="mh-ct-dash__main">
          <DashboardContent />
        </div>
        <AdminQuickAccess todos={todos} failed={failed} />
      </div>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>Welcome back{firstName ? `, ${firstName}` : ""}</h1>
          <p>
            {stats
              ? [
                  stats.institutionName,
                  stats.termName,
                  canSeeApprovals ? `${stats.pendingApprovals} pending approvals` : null,
                  `${stats.enrolments} enrolments`,
                ].filter(Boolean).join(" · ")
              : failed
                ? "Live campus data is unavailable."
                : "Loading live campus data…"}
          </p>
        </div>
        <div className="mh-sis-dash__banner-actions">
          {canOnboardUsers ? (
            <>
              <SisActionBtn label="Student onboard" href="/admin/user-management/new?accessLevel=student" tone="secondary" />
              <SisActionBtn label="Instructor onboard" href="/admin/user-management/new?accessLevel=faculty" tone="secondary" />
            </>
          ) : canEditStudents ? (
            <SisActionBtn label="Create student" href="/admin/student-management/create" tone="secondary" />
          ) : null}
          {canEditStudents ? <SisActionBtn label="Enrol student" href="/admin/enrolments" /> : null}
        </div>
      </div>
      {live.toast ? (
        <p style={{ color: "#0f766e", fontSize: 13, marginBottom: 8 }}>{live.toast}</p>
      ) : null}
      {failed ? (
        <div className="mh-sis-dash__error" role="alert">
          <span>Couldn&apos;t load dashboard figures.</span>
          <button type="button" className="mh-sis-dash__link-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      <h2 className="mh-sis-dash__section-title">Campus scale</h2>
      <div className="mh-sis-dash__kpis mh-sis-dash__kpis--wrap">
        <KpiButton
          label="Students"
          value={loading ? blank : stats.students}
          hint="Live roster"
          href="/admin/student-management/browse"
        />
        <KpiButton
          label="Teachers"
          value={loading ? blank : stats.teachers}
          hint="Instructor accounts"
          href="/admin/user-management"
        />
        <KpiButton
          label="Programs"
          value={loading ? blank : stats.programs}
          hint="Catalogue"
          href="/admin/program-management/faculties"
        />
        <KpiButton
          label="Courses"
          value={loading ? blank : stats.courses}
          hint="Catalogue"
          href="/admin/course-management/courses"
        />
        <KpiButton
          label="Sections"
          value={loading ? blank : stats.sections}
          hint="Current offerings"
          href="/admin/course-management/courses"
        />
        <KpiButton
          label="Enrolments"
          value={loading ? blank : stats.enrolments}
          hint="Student ↔ section"
          href="/admin/enrolments"
        />
      </div>

      <h2 className="mh-sis-dash__section-title">{canSeeFinance ? "Fees & queues" : "Queues"}</h2>
      <div className="mh-sis-dash__kpis mh-sis-dash__kpis--wrap">
        {canSeeFinance ? (
          <KpiButton
            label="Fees / AR open"
            value={loading ? blank : money(stats.feesOpenCad)}
            hint={
              loading
                ? "Finance"
                : stats.feesPastDueCad > 0
                  ? `${money(stats.feesPastDueCad)} past due`
                  : `${money(stats.feesPostedCad)} posted`
            }
            href="/admin/financial/transactions"
            danger={!loading && stats.feesPastDueCad > 0}
          />
        ) : null}
        {canSeeApprovals ? (
          <>
            <KpiButton
              label="Pending approvals"
              value={loading ? blank : stats.pendingApprovals}
              hint="Action required"
              href="/admin/approvals"
              danger
            />
            <KpiButton
              label="Pending grades"
              value={loading ? blank : stats.pendingGrades}
              hint={loading ? "Draft / publish" : `${stats.publishedGrades} published`}
              href="/admin/student-management/grades"
              danger={!loading && stats.pendingGrades > 0}
            />
          </>
        ) : null}
        <KpiButton
          label="At-risk students"
          value={loading ? blank : stats.atRisk}
          hint="Standing alerts"
          href="/admin/ops/success/cases"
          danger={!loading && stats.atRisk > 0}
        />
        <KpiButton
          label="Pending evaluations"
          value={loading ? blank : stats.pendingEvaluations}
          hint="Course evals"
          href="/admin/course-management/evaluations"
        />
        <KpiButton
          label="Pending LOA"
          value={loading ? blank : stats.pendingLoa}
          hint={loading ? "Leave requests" : `${stats.pendingTasks} open tasks`}
          href="/admin/student-management/leave"
          danger={!loading && stats.pendingLoa > 0}
        />
      </div>

      <div className="mh-sis-dash__split">
        <section className="mh-sis-dash__card mh-sis-dash__activity">
          <h2>Recent Administrative Activity</h2>
          <div className="mh-sis-dash__feed">
            {(stats?.activity || []).map((row, index) => (
              <div key={`${index}:${row.actor}${row.when}${row.detail}`} className="mh-sis-dash__feed-row">
                <div className="mh-sis-dash__feed-detail">
                  <span className="mh-sis-dash__dot" />
                  <div className="mh-sis-dash__actor-meta">
                    <div className="mh-sis-dash__actor">{row.actor}</div>
                    <div className="mh-sis-dash__detail">{row.detail}</div>
                  </div>
                </div>
                <div className="mh-sis-dash__when">{row.when}</div>
              </div>
            ))}
            {!stats?.activity?.length ? (
              <div className="mh-sis-dash__detail">{failed ? "Activity unavailable." : "No recent audit events yet."}</div>
            ) : null}
          </div>
        </section>

        <section className="mh-sis-dash__card mh-sis-dash__health">
          <h2>System Health & Term Progress</h2>
          <div className="mh-sis-dash__health-metrics">
            {(stats?.health || []).map((row) => (
              <div key={row.label} className="mh-sis-dash__health-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
            <div className="mh-sis-dash__divider" />
            <div className="mh-sis-dash__term">
              <div className="mh-sis-dash__progress-label">
                <strong>{stats?.termName || "Current term"}</strong>
                <span>{loading ? blank : `${stats.termProgressPct}%`}</span>
              </div>
              <div className="mh-sis-dash__progress-track">
                <div
                  className="mh-sis-dash__progress-fill"
                  style={{ width: `${loading ? (failed ? 0 : 50) : stats.termProgressPct}%` }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {canPostFinance ? (
                <button type="button" className="mh-sis-dash__link-btn" onClick={() => router.push("/admin/finance/posting")}>
                  AR posting
                </button>
              ) : null}
              {canSeeStudents ? (
                <button type="button" className="mh-sis-dash__link-btn" onClick={() => router.push("/admin/student-documents")}>
                  Documents
                </button>
              ) : null}
              {canSeeFinance ? (
                <button type="button" className="mh-sis-dash__link-btn" onClick={() => router.push("/admin/tax-documents")}>
                  Tax docs
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AdminHomePage() {
  const router = useRouter();
  const [userName, setUserName] = useState("Admin User");
  const [firstName, setFirstName] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [stats, setStats] = useState<CampusOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const access = useMyAccess();

  const loadStats = useCallback((accessToken: string) => {
    setStats(null);
    setFailed(false);
    api<CampusOverview>("/admin/campus-overview", {}, accessToken)
      .then(setStats)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    if (!s.roles.includes("admin") && !s.roles.includes("registrar")) {
      if (s.roles.includes("instructor")) router.replace("/instructor");
      else if (s.roles.includes("student")) router.replace("/student");
      else if (s.roles.includes("applicant")) router.replace("/applicant");
      else if (s.roles.includes("employer")) router.replace("/employer");
      else router.replace("/login");
      return;
    }
    setUserName(`${s.givenName} ${s.familyName}`.trim() || "Admin User");
    setFirstName(s.givenName || "");
    setRoles(s.roles);
    setAllowed(true);
    loadStats(s.accessToken);
  }, [router, loadStats]);

  const retry = useCallback(() => {
    const s = loadSession();
    if (s) loadStats(s.accessToken);
    else router.replace("/login");
  }, [loadStats, router]);

  if (!allowed) return null;

  return (
    <AdminSisShell activeHref="/admin" userName={userName} userRole={roleLabel(access, roles)}>
      <SisLiveProvider path="/admin" onPayload={() => undefined}>
        <AdminHomeBody stats={stats} failed={failed} onRetry={retry} firstName={firstName} access={access} />
      </SisLiveProvider>
    </AdminSisShell>
  );
}
