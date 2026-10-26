"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudentResourcesResponse } from "@myheritage/contracts";
import { Banner, Button, EmptyState, StatusPill } from "@myheritage/ui";
import { StudentSisShell } from "@/components/StudentSisShell";
import { ApiError, api, clearSession, loadSession, type Session } from "@/lib/api";

type ViewState = "loading" | "ready" | "permission-denied" | "offline" | "error";

function labelKind(kind: string) {
  return kind.replace(/_/g, " ");
}

export default function StudentLibraryPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<StudentResourcesResponse | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(
    async (activeSession: Session) => {
      setViewState("loading");
      setLoadError(null);
      try {
        const response = await api<StudentResourcesResponse>("/student/resources", {}, activeSession.accessToken);
        setData(response);
        setSelectedId((prev) => prev ?? response.resources[0]?.id ?? null);
        setViewState("ready");
      } catch (err) {
        setData(null);
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          router.replace("/login");
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setViewState("permission-denied");
          return;
        }
        if ((typeof navigator !== "undefined" && !navigator.onLine) || err instanceof TypeError) {
          setViewState("offline");
          return;
        }
        setLoadError(err instanceof Error ? err.message : "Failed to load library");
        setViewState("error");
      }
    },
    [router],
  );

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    if (!s.roles.includes("student")) {
      setViewState("permission-denied");
      return;
    }
    void load(s);
  }, [load, router]);

  const kinds = useMemo(() => {
    const set = new Set((data?.resources ?? []).map((row) => row.sourceKind));
    return ["all", ...[...set].sort()];
  }, [data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.resources ?? []).filter((row) => {
      if (kind !== "all" && row.sourceKind !== kind) return false;
      if (!needle) return true;
      return (
        row.title.toLowerCase().includes(needle) ||
        row.snippet.toLowerCase().includes(needle) ||
        row.sourceKind.toLowerCase().includes(needle)
      );
    });
  }, [data, kind, query]);

  const selected = useMemo(
    () => filtered.find((row) => row.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  function openResource(href: string | null) {
    if (!href) return;
    if (href.startsWith("http://") || href.startsWith("https://")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  }

  if (!session) return null;

  return (
    <StudentSisShell
      title="Library"
      subtitle="Institution and course resources"
      activeHref="/student/library"
      userName={`${session.givenName} ${session.familyName}`}
    >
      <div className="mh-student-stack">
        {viewState === "loading" ? (
          <section className="mh-teacher-card">
            <EmptyState title="Loading library" body="Fetching approved campus resources." />
          </section>
        ) : null}
        {viewState === "permission-denied" ? (
          <section className="mh-teacher-card">
            <EmptyState title="Permission denied" body="Library resources are available only to the signed-in student." />
          </section>
        ) : null}
        {viewState === "offline" ? (
          <section className="mh-teacher-card">
            <EmptyState title="You're offline" body="Reconnect to search the campus library." />
            <Button type="button" onClick={() => void load(session)}>
              Try again
            </Button>
          </section>
        ) : null}
        {viewState === "error" ? (
          <section className="mh-teacher-card">
            <EmptyState title="Library unavailable" body={loadError ?? "Resources could not be loaded."} />
            <Button type="button" onClick={() => void load(session)}>
              Try again
            </Button>
          </section>
        ) : null}

        {viewState === "ready" ? (
          <>
            <div className="mh-teacher-dash__kpis">
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Resources</div>
                <div className="mh-teacher-dash__kpi-value">{data?.resources.length ?? 0}</div>
                <div className="mh-teacher-dash__kpi-hint">Published</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Showing</div>
                <div className="mh-teacher-dash__kpi-value">{filtered.length}</div>
                <div className="mh-teacher-dash__kpi-hint">After filters</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Types</div>
                <div className="mh-teacher-dash__kpi-value">{Math.max(kinds.length - 1, 0)}</div>
                <div className="mh-teacher-dash__kpi-hint">Source kinds</div>
              </div>
            </div>

            <section className="mh-teacher-card">
              <div className="mh-student-assign__toolbar">
                <label className="mh-teacher-field" style={{ flex: 1, minWidth: 220 }}>
                  <span>Search resources</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, type, or keyword…"
                    aria-label="Search library resources"
                  />
                </label>
                <div className="mh-student-profile__chips" role="group" aria-label="Filter by type">
                  {kinds.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`mh-teacher-pill${kind === item ? " is-active" : ""}`}
                      onClick={() => setKind(item)}
                    >
                      {item === "all" ? "All types" : labelKind(item)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {(data?.resources.length ?? 0) === 0 ? (
              <EmptyState title="No published resources" body="Approved handbooks and course materials will appear here when published." />
            ) : null}

            {(data?.resources.length ?? 0) > 0 && filtered.length === 0 ? (
              <EmptyState title="No matches" body="Try another search term or clear the type filter." />
            ) : null}

            {filtered.length > 0 ? (
              <div className="mh-student-lab__layout">
                <section className="mh-teacher-card" style={{ gridColumn: "1 / -1" }}>
                  <div className="mh-student-course-grid">
                    {filtered.map((row) => {
                      const active = selected?.id === row.id;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          className="mh-student-course-card"
                          aria-pressed={active}
                          style={
                            active
                              ? { outline: "2px solid var(--mh-brand)", outlineOffset: 2 }
                              : undefined
                          }
                          onClick={() => setSelectedId(row.id)}
                        >
                          <span className="mh-student-course-card__code">{labelKind(row.sourceKind)}</span>
                          <strong>{row.title}</strong>
                          <span>{row.snippet}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="mh-teacher-card" style={{ gridColumn: "1 / -1" }}>
                  {selected ? (
                    <>
                      <div className="mh-student-lms__head">
                        <div>
                          <h2>{selected.title}</h2>
                          <p className="mh-teacher-muted">Approved campus resource</p>
                        </div>
                        <StatusPill tone="neutral">{labelKind(selected.sourceKind)}</StatusPill>
                      </div>
                      <p style={{ marginTop: 12, lineHeight: 1.55 }}>{selected.snippet}</p>
                      {!selected.href ? (
                        <Banner tone="warning">This resource has no openable link yet.</Banner>
                      ) : null}
                      <div className="mh-student-lab__actions">
                        <Button
                          type="button"
                          disabled={!selected.href}
                          onClick={() => openResource(selected.href)}
                        >
                          Open resource
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => router.push("/student/search")}>
                          Search portal
                        </Button>
                      </div>
                    </>
                  ) : (
                    <EmptyState title="Select a resource" body="Choose a card above to read the summary and open it." />
                  )}
                </section>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </StudentSisShell>
  );
}
