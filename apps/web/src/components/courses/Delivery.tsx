"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CourseLmsView } from "@/components/CourseLmsView";
import { getTeacherScreen } from "@/lib/teacherCatalog";
import { TeacherLiveProvider, mergeTeacherLive, useTeacherLive, useTeacherLivePayload } from "@/lib/useTeacherSisLive";
import { Frame, HREF, LinkBtn, Loading, Pager, RefSelect, RowActions, fmtStamp, qs, useLoad, useMeta, type Paged } from "./kit";
import { scheduleText, viewCourseHref } from "./Courses";

type SessionRow = {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  code: string;
  name: string;
  term: string;
  campus: string;
  classroom: string;
  instructors: string[];
  start: string;
  end: string;
  continuous: boolean;
  meetings: Array<{ day: string; start: string; end: string }>;
  status: string;
  enrolled: number;
  capacity: number | null;
  enableLms: string;
};

/* ------------------------------------------------------------------ */
/* Pending Course Sessions & Changes                                    */
/* ------------------------------------------------------------------ */

type Change = { id: string; status: string; type: string; summary: string; submittedBy: string; submittedAt: string; courseId: string; session: SessionRow | null };

export function PendingSessions() {
  const { meta } = useMeta();
  const [draft, setDraft] = useState({ campus: "", course: "", term: "", status: "Pending Review", type: "" });
  const [applied, setApplied] = useState(draft);
  const { data, error } = useLoad<{ items: Change[] }>(`/pending${qs(applied)}`, "Could not load pending sessions");
  const set = (k: keyof typeof draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <Frame title="Pending Course Sessions & Changes" crumbs={["Pending Sessions"]} active={HREF.pending}>
      <section className="mh-sa__card">
        <form
          className="cm-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(draft);
          }}
        >
          <RefSelect label="Filter Campus" value={draft.campus} onChange={set("campus")} options={meta?.refs.campuses ?? []} all="All Campuses" />
          <RefSelect label="Filter Course" value={draft.course} onChange={set("course")} options={meta?.refs.courses ?? []} all="All Courses" />
          <RefSelect label="Filter Term" value={draft.term} onChange={set("term")} options={meta?.refs.terms ?? []} all="All Terms" />
          <RefSelect label="Status" value={draft.status} onChange={set("status")} options={meta?.options.changeStatuses ?? ["Pending Review"]} all="All Statuses" />
          <RefSelect label="Change Type" value={draft.type} onChange={set("type")} options={meta?.options.changeTypes ?? []} all="All Types" />
          <span className="cm-filters__go">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Show Courses
            </button>
          </span>
        </form>
        {!data ? (
          <Loading error={error} />
        ) : !data.items.length ? (
          <p className="cm-empty">No courses were found.</p>
        ) : (
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table lx-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Change Type</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th className="lx-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cm-stack">
                        <strong>{c.session ? `${c.session.courseCode} ${c.session.code}` : "Session no longer exists"}</strong>
                        <span className="cm-muted">{c.summary || c.session?.courseTitle}</span>
                      </div>
                    </td>
                    <td>{c.type}</td>
                    <td>
                      <div className="cm-stack">
                        <span>{c.submittedBy}</span>
                        <span className="cm-muted">{fmtStamp(c.submittedAt)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="cm-pill cm-pill--warn">{c.status}</span>
                    </td>
                    <td className="lx-actions">
                      {c.session ? (
                        <LinkBtn href={`${HREF.courses}/session${qs({ course: c.session.courseId, id: c.session.id })}`}>VIEW</LinkBtn>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Active Courses                                                       */
/* ------------------------------------------------------------------ */

export function ActiveCourses() {
  const sp = useSearchParams();
  const { meta } = useMeta();
  const initial = { campus: "", course: sp?.get("course") ?? "", term: "", student: "", faculty: "" };
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [paging, setPaging] = useState({ page: 1, perPage: 25 });
  const { data, error } = useLoad<Paged<SessionRow>>(`/active${qs({ ...applied, ...paging })}`, "Could not load active courses");
  const set = (k: keyof typeof draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <Frame title="Active Courses" crumbs={["Active Courses"]} active={HREF.active}>
      <section className="mh-sa__card">
        <form
          className="cm-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(draft);
            setPaging((p) => ({ ...p, page: 1 }));
          }}
        >
          <RefSelect label="Filter Campus" value={draft.campus} onChange={set("campus")} options={meta?.refs.campuses ?? []} all="All Campuses" />
          <RefSelect label="Filter Course" value={draft.course} onChange={set("course")} options={meta?.refs.courses ?? []} all="All Courses" />
          <RefSelect label="Filter Term" value={draft.term} onChange={set("term")} options={meta?.refs.terms ?? []} all="All Terms" />
          <label className="mh-sa__field">
            <span className="mh-sa__label">Filter Student</span>
            <input className="mh-sa__input" placeholder="Student # or last name" value={draft.student} onChange={(e) => set("student")(e.target.value)} />
          </label>
          <RefSelect label="Faculty" value={draft.faculty} onChange={set("faculty")} options={meta?.users ?? []} all="All Faculty / Instructors" />
          <span className="cm-filters__go">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Show Courses
            </button>
          </span>
        </form>
        {!data ? (
          <Loading error={error} />
        ) : (
          <>
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table lx-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Location</th>
                    <th>Instructor(s)</th>
                    <th>Dates</th>
                    <th>Enrolment</th>
                    <th className="lx-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => {
                    const sch = scheduleText(r);
                    const warn = !r.instructors.length ? "No instructor is assigned to this session" : r.capacity !== null && r.enrolled > r.capacity ? "Enrolment is over capacity" : "";
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="cm-stack">
                            <strong>
                              {warn ? (
                                <span title={warn} aria-label={warn} style={{ color: "#b45309", marginRight: 4 }}>
                                  ⚠
                                </span>
                              ) : null}
                              {r.courseCode} {r.code}
                            </strong>
                            <span className="cm-muted">
                              {r.name || r.courseTitle} · {r.term}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="cm-stack">
                            <span>{r.campus || "Campus not set"}</span>
                            <span className="cm-muted">{r.classroom || "Classroom not set"}</span>
                          </div>
                        </td>
                        <td>{r.instructors.length ? r.instructors.join(", ") : <span className="cm-muted">Not Set</span>}</td>
                        <td>{sch.dates}</td>
                        <td>
                          {r.enrolled}
                          {r.capacity !== null ? ` / ${r.capacity}` : ""}
                        </td>
                        <td className="lx-actions">
                          <RowActions>
                            {[
                              <LinkBtn key="v" href={viewCourseHref(r.id)}>
                                VIEW COURSE
                              </LinkBtn>,
                              <LinkBtn key="g" href={viewCourseHref(r.id, "Grades")}>
                                GRADES
                              </LinkBtn>,
                              <LinkBtn key="a" href={viewCourseHref(r.id, "Attendance")}>
                                ATTENDANCE
                              </LinkBtn>,
                            ]}
                          </RowActions>
                        </td>
                      </tr>
                    );
                  })}
                  {!data.items.length ? (
                    <tr>
                      <td colSpan={6} className="mh-sa__empty-cell">
                        No active courses match these filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <Pager data={data} onPage={(page) => setPaging((p) => ({ ...p, page }))} onPerPage={(perPage) => setPaging({ page: 1, perPage })} />
          </>
        )}
      </section>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* View Course — the instructor course workspace, opened by an admin    */
/* ------------------------------------------------------------------ */

function LiveStatus() {
  const live = useTeacherLive();
  if (!live.loading && !live.error && !live.toast) return null;
  return (
    <p className={live.error ? "cm-error" : "cm-muted"} aria-live="polite" style={{ marginBottom: 10 }}>
      {live.loading ? "Loading course…" : live.error ?? live.toast}
    </p>
  );
}

function CourseWorkspace({ path, sectionId }: { path: string; sectionId: string }) {
  const { payload, loading } = useTeacherLivePayload();
  const lastLoaded = useRef<ReturnType<typeof mergeTeacherLive> | null>(null);
  const chrome = getTeacherScreen(path);
  if (!chrome) return null;
  const merged = mergeTeacherLive(chrome, payload, loading);
  const lms = merged.courseDetail?.lms;
  const fresh =
    merged.courseDetail && lms
      ? { ...merged, courseDetail: { ...merged.courseDetail, lms: { ...lms, finalMarksHref: viewCourseHref(sectionId, "Grades") } } }
      : null;
  if (fresh) lastLoaded.current = fresh;
  // CourseLmsView must stay mounted across refreshes (every save reloads the payload), otherwise
  // Edit mode and collapsed topics reset — the instructor portal keeps them the same way.
  const config = fresh ?? lastLoaded.current;
  return (
    <>
      <LiveStatus />
      {config ? <CourseLmsView config={config} /> : null}
    </>
  );
}

export function ViewCourse() {
  const sp = useSearchParams();
  const id = sp?.get("id") ?? "";
  const { data } = useLoad<{ id: string; courseId: string; course: { code: string; title: string }; code: string; term: string }>(id ? `/sessions/${id}` : null, "Could not load this session");
  const path = `/instructor/sections/${id}`;
  return (
    <Frame title={data ? `${data.course.code} ${data.code} — ${data.course.title}` : "View Course"} crumbs={["Active Courses", data ? `${data.course.code} ${data.code}` : "View Course"]} active={HREF.active}>
      <p className="cm-muted" style={{ marginBottom: 10 }}>
        <Link href={HREF.active}>← Active Courses</Link>
        {data ? (
          <>
            {" · "}
            <Link href={`${HREF.courses}/view${qs({ id: data.courseId, tab: "sessions" })}`}>Course Sessions & Offerings</Link>
            {" · "}
            <Link href={`${HREF.courses}/session${qs({ course: data.courseId, id })}`}>Session Settings</Link>
          </>
        ) : null}
      </p>
      <div className="cm-view-frame">
        {id ? (
          <TeacherLiveProvider path={path}>
            <CourseWorkspace path={path} sectionId={id} />
          </TeacherLiveProvider>
        ) : (
          <p className="cm-error">Choose a course session to view.</p>
        )}
      </div>
    </Frame>
  );
}
