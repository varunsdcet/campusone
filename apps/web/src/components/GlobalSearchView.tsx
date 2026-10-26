"use client";

import { FormEvent, Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner, Button, EmptyState, Panel } from "@myheritage/ui";
import { api, loadSession } from "@/lib/api";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { AdminSisShell } from "@/components/AdminSisShell";
import { TeacherSisShell } from "@/components/TeacherSisShell";
import { StudentSisShell } from "@/components/StudentSisShell";

type SearchItem = { id: string; label: string; sub?: string; href?: string };
type SearchGroup = { type: string; items: SearchItem[] };

function RoleShell({
  role,
  children,
}: {
  role: "admin" | "student" | "instructor" | "applicant" | "employer";
  children: ReactNode;
}) {
  if (role === "admin") {
    return (
      <AdminSisShell activeHref="/admin/search" breadcrumbs={["Home", "Workspace", "Search"]}>
        {children}
      </AdminSisShell>
    );
  }
  if (role === "instructor") {
    return (
      <TeacherSisShell title="Global search" subtitle="Find people, courses, and campus records" activeHref="/instructor/search">
        {children}
      </TeacherSisShell>
    );
  }
  if (role === "student") {
    return (
      <StudentSisShell title="Global search" subtitle="Find courses, assignments, and campus records" activeHref="/student/search">
        {children}
      </StudentSisShell>
    );
  }
  const crumb =
    role === "applicant"
      ? (["Applicant", "Search"] as string[])
      : (["Employer", "Search"] as string[]);
  return (
    <ScreenScaffold
      role={role}
      title="Global search"
      subtitle="Find people, courses, applications, placements, and campus records"
      active="Search"
      breadcrumb={crumb}
    >
      {children}
    </ScreenScaffold>
  );
}

export function GlobalSearchView({ role }: { role: "admin" | "student" | "instructor" | "applicant" | "employer" }) {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading search…</div>}>
      <GlobalSearchInner role={role} />
    </Suspense>
  );
}

function GlobalSearchInner({ role }: { role: "admin" | "student" | "instructor" | "applicant" | "employer" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(value: string) {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const q = value.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ groups: SearchGroup[] }>(
        `/search?q=${encodeURIComponent(q)}`,
        {},
        session.accessToken,
      );
      setGroups(result.groups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initialQ.trim()) void runSearch(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await runSearch(query);
  }

  return (
    <RoleShell role={role}>
      <div className={role === "admin" || role === "instructor" || role === "student" ? "mh-student-stack" : undefined}>
        {role === "admin" || role === "instructor" || role === "student" ? (
          <section className="mh-teacher-card" style={{ marginBottom: 16 }}>
            <h1 style={{ margin: "0 0 6px", fontFamily: "var(--mh-font-display)", fontSize: 28 }}>Global search</h1>
            <p style={{ margin: 0, color: "var(--mh-text-muted)" }}>
              Find people, courses, applications, placements, and campus records
            </p>
          </section>
        ) : null}
        <Panel>
          <form onSubmit={onSearch} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try "Marcus", "CS301", "Nursing"…'
              aria-label="Search"
              style={{
                flex: "1 1 240px",
                minHeight: 40,
                border: "1px solid var(--mh-border)",
                borderRadius: 8,
                padding: "0 12px",
              }}
            />
            <Button type="submit" disabled={busy}>
              {busy ? "Searching…" : "Search"}
            </Button>
          </form>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {!groups.length ? (
            <EmptyState title="No results yet" body="Run a search to see live campus matches." />
          ) : (
            groups.map((group) => (
              <div key={group.type} style={{ marginTop: 16 }}>
                <h3 style={{ textTransform: "capitalize", marginBottom: 8 }}>{group.type}</h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => item.href && router.push(item.href)}
                      style={{
                        textAlign: "left",
                        border: "1px solid var(--mh-border)",
                        borderRadius: 8,
                        padding: "10px 12px",
                        background: "var(--mh-surface)",
                        cursor: item.href ? "pointer" : "default",
                      }}
                    >
                      <strong>{item.label}</strong>
                      {item.sub ? <div style={{ color: "var(--mh-text-muted)", fontSize: 13 }}>{item.sub}</div> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </Panel>
      </div>
    </RoleShell>
  );
}
