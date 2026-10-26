"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner, Button, EmptyState, StatusPill } from "@myheritage/ui";
import { StudentSisShell } from "@/components/StudentSisShell";
import { ApiError, api, clearSession, loadSession, type Session } from "@/lib/api";

type ViewState = "loading" | "ready" | "permission-denied" | "offline" | "error";

type AnnouncementItem = {
  id: string;
  channel: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  templateKey?: string;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kindLabel(templateKey?: string) {
  if (!templateKey) return "Campus";
  if (templateKey.startsWith("grade.")) return "Grades";
  if (templateKey.startsWith("assignment.")) return "Assignments";
  if (templateKey.startsWith("standing.")) return "Standing";
  if (templateKey.startsWith("campus.") || templateKey.startsWith("announcement.")) return "Campus";
  return templateKey.split(".")[0] ?? "Notice";
}

export default function StudentAnnouncementsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading announcements…</div>}>
      <StudentAnnouncementsInner />
    </Suspense>
  );
}

function StudentAnnouncementsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("id");

  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkId);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(
    async (activeSession: Session) => {
      setViewState("loading");
      setLoadError(null);
      try {
        const response = await api<{ items: AnnouncementItem[]; unreadCount: number }>(
          "/notifications/me",
          {},
          activeSession.accessToken,
        );
        setItems(response.items);
        setUnreadCount(response.unreadCount);
        setSelectedId((prev) => {
          if (deepLinkId && response.items.some((item) => item.id === deepLinkId)) return deepLinkId;
          if (prev && response.items.some((item) => item.id === prev)) return prev;
          return response.items[0]?.id ?? null;
        });
        setViewState("ready");
      } catch (err) {
        setItems([]);
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
        setLoadError(err instanceof Error ? err.message : "Failed to load announcements");
        setViewState("error");
      }
    },
    [deepLinkId, router],
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

  const visible = useMemo(
    () => (filter === "unread" ? items.filter((item) => !item.readAt) : items),
    [filter, items],
  );

  const selected = useMemo(
    () => visible.find((item) => item.id === selectedId) ?? items.find((item) => item.id === selectedId) ?? visible[0] ?? null,
    [items, selectedId, visible],
  );

  async function openAnnouncement(item: AnnouncementItem) {
    setSelectedId(item.id);
    setActionError(null);
    if (!session || item.readAt) return;
    setMarking(true);
    try {
      await api(`/notifications/me/${item.id}/read`, { method: "PATCH", body: "{}" }, session.accessToken);
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not mark announcement as read");
    } finally {
      setMarking(false);
    }
  }

  useEffect(() => {
    if (!session || !selected || selected.readAt || viewState !== "ready") return;
    void openAnnouncement(selected);
    // Auto-open/mark when deep-link or first unread selection lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, viewState]);

  if (!session) return null;

  return (
    <StudentSisShell
      title="Announcements"
      subtitle="Campus and course notices"
      activeHref="/student/announcements"
      userName={`${session.givenName} ${session.familyName}`}
    >
      <div className="mh-student-stack">
        {viewState === "loading" ? (
          <section className="mh-teacher-card">
            <EmptyState title="Loading announcements" body="Fetching campus and course notices." />
          </section>
        ) : null}
        {viewState === "permission-denied" ? (
          <section className="mh-teacher-card">
            <EmptyState title="Permission denied" body="Announcements are available only to the signed-in student." />
          </section>
        ) : null}
        {viewState === "offline" ? (
          <section className="mh-teacher-card">
            <EmptyState title="You're offline" body="Reconnect to load announcements." />
            <Button type="button" onClick={() => void load(session)}>
              Try again
            </Button>
          </section>
        ) : null}
        {viewState === "error" ? (
          <section className="mh-teacher-card">
            <EmptyState title="Announcements unavailable" body={loadError ?? "Notices could not be loaded."} />
            <Button type="button" onClick={() => void load(session)}>
              Try again
            </Button>
          </section>
        ) : null}

        {viewState === "ready" ? (
          <>
            <div className="mh-teacher-dash__kpis">
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Total</div>
                <div className="mh-teacher-dash__kpi-value">{items.length}</div>
                <div className="mh-teacher-dash__kpi-hint">Notices</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Unread</div>
                <div className="mh-teacher-dash__kpi-value">{unreadCount}</div>
                <div className="mh-teacher-dash__kpi-hint">Need attention</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Showing</div>
                <div className="mh-teacher-dash__kpi-value">{visible.length}</div>
                <div className="mh-teacher-dash__kpi-hint">{filter === "unread" ? "Unread only" : "All"}</div>
              </div>
            </div>

            {actionError ? <Banner tone="danger">{actionError}</Banner> : null}

            <section className="mh-teacher-card">
              <div className="mh-student-profile__chips" role="group" aria-label="Filter announcements">
                <button
                  type="button"
                  className={`mh-teacher-pill${filter === "all" ? " is-active" : ""}`}
                  onClick={() => setFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`mh-teacher-pill${filter === "unread" ? " is-active" : ""}`}
                  onClick={() => setFilter("unread")}
                >
                  Unread
                </button>
              </div>
            </section>

            {items.length === 0 ? (
              <EmptyState title="No announcements" body="Campus and course notices will appear here when published." />
            ) : null}

            {items.length > 0 && visible.length === 0 ? (
              <EmptyState title="No unread announcements" body="You're caught up. Switch to All to review earlier notices." />
            ) : null}

            {visible.length > 0 ? (
              <div className="mh-student-lab__layout">
                <section className="mh-teacher-card">
                  <div className="mh-student-lms__head">
                    <div>
                      <h2>Inbox</h2>
                      <p className="mh-teacher-muted">Click a notice to open it</p>
                    </div>
                  </div>
                  <div className="mh-teacher-list" style={{ marginTop: 12 }}>
                    {visible.map((item) => {
                      const active = selected?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`mh-teacher-list__item${active ? " is-active" : ""}`}
                          onClick={() => void openAnnouncement(item)}
                          style={{ opacity: item.readAt && !active ? 0.78 : 1 }}
                        >
                          <div>
                            <b>{item.title}</b>
                            <span>
                              {kindLabel(item.templateKey)} · {formatWhen(item.createdAt)}
                            </span>
                          </div>
                          <StatusPill tone={item.readAt ? "neutral" : "warning"}>
                            {item.readAt ? "Read" : "Unread"}
                          </StatusPill>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="mh-teacher-card">
                  {selected ? (
                    <>
                      <div className="mh-student-lms__head">
                        <div>
                          <h2>{selected.title}</h2>
                          <p className="mh-teacher-muted">
                            {kindLabel(selected.templateKey)} · {formatWhen(selected.createdAt)}
                            {marking && !selected.readAt ? " · Opening…" : ""}
                          </p>
                        </div>
                        <StatusPill tone={selected.readAt ? "success" : "warning"}>
                          {selected.readAt ? "Read" : "Unread"}
                        </StatusPill>
                      </div>
                      <p style={{ marginTop: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selected.body}</p>
                      <div className="mh-student-lab__facts" style={{ marginTop: 16 }}>
                        <div>
                          <span>Channel</span>
                          <strong>{selected.channel.replace(/_/g, " ")}</strong>
                        </div>
                        <div>
                          <span>Posted</span>
                          <strong>{formatWhen(selected.createdAt)}</strong>
                        </div>
                      </div>
                      <div className="mh-student-lab__actions">
                        {selected.templateKey?.startsWith("grade.") ? (
                          <Button type="button" onClick={() => router.push("/student/grades")}>
                            Open grades
                          </Button>
                        ) : null}
                        {selected.templateKey?.startsWith("assignment.") ? (
                          <Button type="button" onClick={() => router.push("/student/assignments")}>
                            Open assignments
                          </Button>
                        ) : null}
                        <Button type="button" variant="secondary" onClick={() => router.push("/student/notifications")}>
                          All notifications
                        </Button>
                      </div>
                    </>
                  ) : (
                    <EmptyState title="Select an announcement" body="Choose a notice from the inbox to read the full message." />
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
