"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel } from "@myheritage/ui";
import { MobileChrome } from "@/components/ScreenScaffold";
import { api, loadSession, logout } from "@/lib/api";
import { openClassLink } from "@/lib/liveClass";

type HomePayload = {
  status?: string | null;
  programName?: string | null;
  enrolledCourses?: number;
  gpa?: number | null;
  nextDeadline?: { title: string; courseCode: string } | null;
};

type CalItem = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  courseCode?: string | null;
  location?: string | null;
  type: string;
  joinUrl?: string | null;
};

type AssignmentItem = {
  id: string;
  state: "upcoming" | "due" | "overdue" | "draft" | "submitted" | "graded";
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MobileStudentHomePage() {
  const router = useRouter();
  const [name, setName] = useState("Student");
  const [data, setData] = useState<HomePayload | null>(null);
  const [calendar, setCalendar] = useState<CalItem[] | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/m/login");
      return;
    }
    setName(s.givenName || "Student");
    api<HomePayload>("/me/home", {}, s.accessToken).then(setData).catch(() => setData(null));
    api<{ items?: CalItem[] }>("/calendar/me", {}, s.accessToken)
      .then((r) => setCalendar(r.items ?? []))
      .catch(() => setCalendar([]));
    api<{ assignments?: AssignmentItem[] }>("/student/assignments", {}, s.accessToken)
      .then((r) => setAssignments(r.assignments ?? []))
      .catch(() => setAssignments([]));
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, [router]);

  const classes = useMemo(() => (calendar ?? []).filter((e) => e.type === "class"), [calendar]);

  const todaySessions = useMemo(() => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return classes.filter((e) => {
      const t = +new Date(e.startsAt);
      return t >= +start && t <= +end;
    });
  }, [classes, now]);

  const nextSession = useMemo(
    () => (todaySessions.length ? null : classes.find((e) => +new Date(e.startsAt) > now) ?? null),
    [classes, todaySessions.length, now],
  );

  const openCount =
    assignments?.filter((a) => a.state === "upcoming" || a.state === "due" || a.state === "overdue" || a.state === "draft")
      .length ?? null;

  const today = new Date(now).toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const renderSession = (e: CalItem) => {
    const start = +new Date(e.startsAt);
    const end = e.endsAt ? +new Date(e.endsAt) : start;
    const live = now >= start && now <= end;
    const done = now > end;
    return (
      <div
        key={e.id}
        style={{
          display: "flex",
          gap: 12,
          padding: 14,
          borderRadius: 8,
          border: `1px solid ${live ? "var(--mh-brand)" : "var(--mh-border)"}`,
          background: live ? "var(--mh-brand-soft)" : "var(--mh-surface)",
        }}
      >
        <div style={{ width: 70 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: live ? "var(--mh-brand)" : undefined }}>{fmtTime(e.startsAt)}</div>
          <div style={{ fontSize: 11, color: "var(--mh-text-subtle)" }}>{live ? "Ongoing" : done ? "Ended" : "Scheduled"}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {e.courseCode && !e.title.startsWith(e.courseCode) ? `${e.courseCode} · ${e.title}` : e.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--mh-text-muted)" }}>
            {[e.location, e.endsAt ? `until ${fmtTime(e.endsAt)}` : null].filter(Boolean).join(" · ") || "Location TBA"}
          </div>
        </div>
        {e.joinUrl && !done ? (
          <Button type="button" style={{ padding: "4px 8px", fontSize: 10 }} onClick={() => openClassLink(e.joinUrl)}>
            JOIN
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <MobileChrome title="CampusOne" active="Home">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{`${greeting()}, ${name}`}</h1>
        <p style={{ margin: "4px 0 0", color: "var(--mh-text-muted)", fontSize: 13 }}>{today}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        <Panel dense>
          <p style={{ margin: 0, fontSize: 11, color: "var(--mh-text-subtle)", fontWeight: 600, textTransform: "uppercase" }}>
            Next
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 700 }}>{data?.nextDeadline?.courseCode ?? "—"}</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--mh-brand)" }}>Deadline</p>
        </Panel>
        <Panel dense>
          <p style={{ margin: 0, fontSize: 11, color: "var(--mh-text-subtle)", fontWeight: 600, textTransform: "uppercase" }}>
            Due
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 700, color: openCount ? "var(--mh-danger)" : undefined }}>
            {openCount == null ? "…" : openCount === 1 ? "1 Item" : `${openCount} Items`}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--mh-text-muted)" }}>Assignments</p>
        </Panel>
        <Panel dense>
          <p style={{ margin: 0, fontSize: 11, color: "var(--mh-text-subtle)", fontWeight: 600, textTransform: "uppercase" }}>
            CGPA
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 700 }}>{data?.gpa != null ? data.gpa.toFixed(2) : "—"}</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--mh-olive)" }}>{data?.status ?? "—"}</p>
        </Panel>
      </div>

      <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>Today&apos;s Schedule</h2>
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {calendar == null ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--mh-text-muted)" }}>Loading schedule…</p>
        ) : todaySessions.length ? (
          todaySessions.map(renderSession)
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13, color: "var(--mh-text-muted)" }}>No classes scheduled today.</p>
            {nextSession ? (
              <>
                <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, color: "var(--mh-text-subtle)" }}>
                  Next class · {new Date(nextSession.startsAt).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
                </p>
                {renderSession(nextSession)}
              </>
            ) : null}
          </>
        )}
      </div>

      <Button
        type="button"
        variant="secondary"
        style={{ width: "100%" }}
        onClick={async () => {
          await logout();
          router.push("/m/login");
        }}
      >
        Sign out
      </Button>
    </MobileChrome>
  );
}
