"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BASE,
  Btn,
  Card,
  ConfirmModal,
  Empty,
  ErrorLine,
  F,
  Filters,
  Letters,
  LinkBtn,
  PagerFor,
  Sel,
  SourceNotice,
  StuFrame,
  Table,
  Txt,
  errMsg,
  fmtDate,
  fmtStamp,
  profileHref,
  qs,
  send,
  useLoad,
  useNotice,
  usePaging,
  useStudentsMeta,
  type Paged,
} from "./kit";

type StudentCell = { id: string; name: string; number: string; campus: string; program: string };

function StudentLink({ s, tab, sub }: { s: StudentCell; tab?: string; sub?: string }) {
  return (
    <span>
      <Link href={profileHref(s.id, tab, sub)}>{s.name}</Link>
      {s.number ? <div className="mh-sa__muted" style={{ fontSize: 12 }}>{s.number}</div> : null}
    </span>
  );
}

function Queue({ title, nav, children }: { title: string; nav: string; children: ReactNode }) {
  return (
    <StuFrame title={title} crumbs={[title]} nav={`${BASE}/${nav}`}>
      {children}
    </StuFrame>
  );
}

/** Filter state that is applied on submit; `run` changes on each search. */
function useApplied<T extends Record<string, string>>(initial: T) {
  const [draft, setDraft] = useState<T>(initial);
  const [applied, setApplied] = useState<T>(initial);
  const set = (k: keyof T) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  return { draft, applied, set, apply: () => setApplied({ ...draft }) };
}

/* ------------------------------------------------------------------ */
/* Academic Alerts                                                      */
/* ------------------------------------------------------------------ */

export function AcademicAlerts() {
  const { meta } = useStudentsMeta();
  const notice = useNotice();
  const f = useApplied({ campus: "", student: "", status: "Active", resolved: "No" });
  const { data, error, reload } = useLoad<{ canDecide: boolean; items: Array<{ id: string; student: StudentCell; description: string; status: string; resolved: string; date: string }> }>(`/queues/alerts${qs(f.applied)}`);
  return (
    <Queue title="Academic Alerts" nav="alerts">
      {notice.node}
      <Card>
        <Filters submit="Search Alerts" onSubmit={f.apply}>
          <F label="Campus Filter">
            <Sel value={f.draft.campus} onChange={f.set("campus")} empty="All Campuses" options={meta?.campuses ?? []} />
          </F>
          <F label="Student Filter">
            <Txt value={f.draft.student} onChange={f.set("student")} placeholder="Student # or last name" />
          </F>
          <F label="Status">
            <Sel value={f.draft.status} onChange={f.set("status")} options={["Active", "Dismissed"]} />
          </F>
          <F label="Resolved">
            <Sel value={f.draft.resolved} onChange={f.set("resolved")} options={["No", "Yes"]} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        {data && !data.items.length ? (
          <Empty>No academic alerts were found.</Empty>
        ) : (
          <Table head={["Student", "Description", "Status", "Resolved", "Date", "Action"]}>
            {(data?.items ?? []).map((a) => (
              <tr key={a.id}>
                <td>
                  <StudentLink s={a.student} />
                </td>
                <td>{a.description}</td>
                <td>{a.status}</td>
                <td>{a.resolved}</td>
                <td>{fmtStamp(a.date)}</td>
                <td>{data?.canDecide && a.resolved !== "Yes" ? <Btn onClick={async () => { try { await send(`/queues/alerts/${encodeURIComponent(a.id)}/resolve`, "POST"); notice.ok("Academic alert resolved."); reload(); } catch (e) { notice.fail(errMsg(e, "Could not resolve alert")); } }}>Resolve</Btn> : "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </Queue>
  );
}

/* ------------------------------------------------------------------ */
/* Student Flags (global)                                               */
/* ------------------------------------------------------------------ */

type GlobalFlag = { id: string; name: string; applyHold: string; resolved: string; status: string; date: string; student: StudentCell };

export function StudentFlagsQueue() {
  const { meta } = useStudentsMeta();
  const notice = useNotice();
  const paging = usePaging(25);
  const f = useApplied({ campus: "", student: "", status: "Active", resolved: "All", template: "" });
  const { data, error, reload } = useLoad<Paged<GlobalFlag>>(`/queues/flags${qs({ ...f.applied, page: paging.page, perPage: paging.perPage })}`);
  const [confirm, setConfirm] = useState<{ flag: GlobalFlag; op: "dismiss" | "delete" } | null>(null);
  return (
    <Queue title="Student Flags" nav="flags">
      {notice.node}
      <Card>
        <Filters
          submit="Search Flags"
          onSubmit={() => {
            f.apply();
            paging.reset();
          }}
        >
          <F label="Campus">
            <Sel value={f.draft.campus} onChange={f.set("campus")} empty="All Campuses" options={meta?.campuses ?? []} />
          </F>
          <F label="Student">
            <Txt value={f.draft.student} onChange={f.set("student")} placeholder="Student # or last name" />
          </F>
          <F label="Status">
            <Sel value={f.draft.status} onChange={f.set("status")} options={["Active", "Dismissed"]} />
          </F>
          <F label="Resolved">
            <Sel value={f.draft.resolved} onChange={f.set("resolved")} options={["All", "No", "Yes"]} />
          </F>
          <F label="Flag Templates">
            <Sel value={f.draft.template} onChange={f.set("template")} empty="All Flag Templates" options={(meta?.flagTemplates ?? []).map((t) => ({ value: t.id, label: t.name }))} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <PagerFor data={data} paging={paging} />
        <Table head={["Student", "Description", "Status", "Applies Hold", "Date", "Actions"]} empty={data ? "No student flags were found." : false}>
          {(data?.items ?? []).map((fl) => (
            <tr key={fl.id}>
              <td>
                <StudentLink s={fl.student} tab="status" sub="flags" />
              </td>
              <td>{fl.name}</td>
              <td>
                {fl.status}
                <div className="mh-sa__muted" style={{ fontSize: 12 }}>
                  {fl.resolved === "Yes" ? "Resolved" : "Unresolved"}
                </div>
              </td>
              <td>{fl.applyHold}</td>
              <td>{fmtStamp(fl.date)}</td>
              <td>
                <span className="st-actions">
                  {fl.status !== "Dismissed" ? <LinkBtn onClick={() => setConfirm({ flag: fl, op: "dismiss" })}>Dismiss</LinkBtn> : null}
                  <LinkBtn danger onClick={() => setConfirm({ flag: fl, op: "delete" })}>
                    Delete
                  </LinkBtn>
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {confirm ? (
        <ConfirmModal
          title={confirm.op === "dismiss" ? "Dismiss Flag" : "Delete Flag"}
          body={confirm.op === "dismiss" ? `Dismiss "${confirm.flag.name}" for ${confirm.flag.student.name}? The flag stays on the profile with status Dismissed.` : `Permanently delete "${confirm.flag.name}" for ${confirm.flag.student.name}?`}
          ok={confirm.op === "dismiss" ? "Dismiss" : "Confirm Delete"}
          danger={confirm.op === "delete"}
          onCancel={() => setConfirm(null)}
          onOk={async () => {
            try {
              if (confirm.op === "dismiss") await send(`/queues/flags/${encodeURIComponent(confirm.flag.id)}/dismiss`, "POST");
              else await send(`/queues/flags/${encodeURIComponent(confirm.flag.id)}`, "DELETE");
              notice.ok(confirm.op === "dismiss" ? "Flag dismissed." : "Flag deleted.");
              reload();
            } catch (e) {
              notice.fail(errMsg(e, "Action failed"));
            }
            setConfirm(null);
          }}
        />
      ) : null}
    </Queue>
  );
}

/* ------------------------------------------------------------------ */
/* Student Assessments / Requirements (global)                          */
/* ------------------------------------------------------------------ */

export function StudentAssessmentsQueue() {
  const { meta } = useStudentsMeta();
  const paging = usePaging(25);
  const f = useApplied({ number: "", student: "", status: "", advisor: "" });
  const { data, error } = useLoad<Paged<{ id: string; number: string; assessment: string; status: string; advisor: string; date: string; student: StudentCell }>>(`/queues/assessments${qs({ ...f.applied, page: paging.page, perPage: paging.perPage })}`);
  return (
    <Queue title="Student Assessments" nav="assessments">
      <Card>
        <Filters
          submit="Search Assessments"
          onSubmit={() => {
            f.apply();
            paging.reset();
          }}
        >
          <F label="Assessment #">
            <Txt value={f.draft.number} onChange={f.set("number")} />
          </F>
          <F label="Student">
            <Txt value={f.draft.student} onChange={f.set("student")} placeholder="Student # or last name" />
          </F>
          <F label="Status">
            <Sel value={f.draft.status} onChange={f.set("status")} empty="All Statuses" options={meta?.options.assessmentStatuses ?? []} />
          </F>
          <F label="Advisor">
            <Sel value={f.draft.advisor} onChange={f.set("advisor")} empty="All Advisors" options={(meta?.advisors ?? []).map((a) => ({ value: a.id, label: a.name }))} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        {data && !data.items.length ? (
          <Empty>No assessments were found.</Empty>
        ) : (
          <>
            <PagerFor data={data} paging={paging} />
            <Table head={["Assessment #", "Student", "Assessment", "Status", "Date"]}>
              {(data?.items ?? []).map((c) => (
                <tr key={c.id}>
                  <td>{c.number}</td>
                  <td>
                    <StudentLink s={c.student} tab="comms" sub="assessments" />
                  </td>
                  <td>{c.assessment}</td>
                  <td>{c.status}</td>
                  <td>{fmtStamp(c.date)}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Card>
    </Queue>
  );
}

export function StudentRequirementsQueue() {
  const { meta } = useStudentsMeta();
  const paging = usePaging(25);
  const [letter, setLetter] = useState("");
  const f = useApplied({ student: "", status: "", submission: "", program: "", workflow: "" });
  const { data, error } = useLoad<Paged<{ id: string; name: string; dataType: string; status: string; submission: string; requestedAt: string; student: StudentCell }>>(`/queues/requirements${qs({ ...f.applied, letter, page: paging.page, perPage: paging.perPage })}`);
  return (
    <Queue title="Student Requirements" nav="requirements">
      <Card>
        <Filters
          submit="Search Requirements"
          onSubmit={() => {
            f.apply();
            paging.reset();
          }}
        >
          <F label="Student">
            <Txt value={f.draft.student} onChange={f.set("student")} placeholder="Student # or last name" />
          </F>
          <F label="Status">
            <Sel value={f.draft.status} onChange={f.set("status")} empty="All Statuses" options={meta?.options.reqStatuses ?? []} />
          </F>
          <F label="Submission">
            <Sel value={f.draft.submission} onChange={f.set("submission")} empty="All Options" options={meta?.options.reqSubmissions ?? []} />
          </F>
          <F label="Program">
            <Sel value={f.draft.program} onChange={f.set("program")} empty="All Programs" options={(meta?.programs ?? []).map((p) => p.name)} />
          </F>
          <F label="Workflow">
            <Sel value={f.draft.workflow} onChange={f.set("workflow")} empty="All Workflows" options={(meta?.workflows ?? []).map((w) => ({ value: w.id, label: w.name }))} />
          </F>
        </Filters>
      </Card>
      <Card>
        <Letters
          value={letter}
          onChange={(l) => {
            setLetter(l);
            paging.reset();
          }}
        />
        <ErrorLine>{error}</ErrorLine>
        {data && !data.items.length ? (
          <Empty>No requirement requests were found.</Empty>
        ) : (
          <>
            <PagerFor data={data} paging={paging} />
            <Table head={["Student", "Requirement", "Type", "Requested", "Submission", "Status"]}>
              {(data?.items ?? []).map((r) => (
                <tr key={r.id}>
                  <td>
                    <StudentLink s={r.student} tab="comms" sub="requirements" />
                  </td>
                  <td>{r.name}</td>
                  <td>{r.dataType}</td>
                  <td>{fmtDate(r.requestedAt)}</td>
                  <td>{r.submission}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Card>
    </Queue>
  );
}

/* ------------------------------------------------------------------ */
/* Leave of Absence / Course Withdraw Requests                          */
/* ------------------------------------------------------------------ */

/** Leave and withdraw requests are decided on the User Request page, which applies status, enrolment and approval changes. */
function RequestLink({ number, pending, canDecide }: { number: number | null; pending: boolean; canDecide: boolean }) {
  if (!number) return null;
  return (
    <Link className="mh-sa__btn mh-sa__btn--sm" href={`/admin/requests/${number}`}>
      {pending && canDecide ? "Review / Decide" : "View"}
    </Link>
  );
}

export function LeaveQueue() {
  const { meta } = useStudentsMeta();
  const paging = usePaging(25);
  const [letter, setLetter] = useState("");
  const f = useApplied({ student: "", status: "" });
  const { data, error } = useLoad<Paged<{ id: string; student: StudentCell; reason: string; startsOn: string; endsOn: string; status: string; requested: string; decisionNote: string; requestNumber: number | null }> & { canDecide: boolean }>(
    `/queues/leave${qs({ ...f.applied, letter, page: paging.page, perPage: paging.perPage })}`,
  );
  return (
    <Queue title="Leave of Absence" nav="leave">
      <Card>
        <Filters
          submit="Search"
          onSubmit={() => {
            f.apply();
            paging.reset();
          }}
        >
          <F label="Student">
            <Txt value={f.draft.student} onChange={f.set("student")} placeholder="Student # or last name" />
          </F>
          <F label="Status">
            <Sel value={f.draft.status} onChange={f.set("status")} empty="All Statuses" options={meta?.options.loaStatuses ?? []} />
          </F>
        </Filters>
      </Card>
      <Card>
        <Letters value={letter} onChange={(l) => { setLetter(l); paging.reset(); }} />
        <ErrorLine>{error}</ErrorLine>
        {data && !data.items.length ? (
          <Empty>No leave-of-absence students were found.</Empty>
        ) : (
          <>
            <PagerFor data={data} paging={paging} />
            <Table head={["Student", "Reason", "Start", "End", "Status", "Requested", ""]}>
              {(data?.items ?? []).map((l) => (
                <tr key={l.id}>
                  <td>
                    <StudentLink s={l.student} />
                  </td>
                  <td>
                    {l.reason}
                    {l.decisionNote ? <div className="mh-sa__muted" style={{ fontSize: 12 }}>Decision note: {l.decisionNote}</div> : null}
                  </td>
                  <td>{fmtDate(l.startsOn)}</td>
                  <td>{fmtDate(l.endsOn)}</td>
                  <td>{l.status}</td>
                  <td>{fmtStamp(l.requested)}</td>
                  <td>
                    <RequestLink number={l.requestNumber} pending={l.status === "Pending"} canDecide={Boolean(data?.canDecide)} />
                  </td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Card>
    </Queue>
  );
}

export function WithdrawQueue() {
  const { meta } = useStudentsMeta();
  const paging = usePaging(25);
  const [letter, setLetter] = useState("");
  const f = useApplied({ student: "", status: "" });
  const { data, error } = useLoad<Paged<{ id: string; student: StudentCell; subject: string; details: string; status: string; requested: string; requestNumber: number | null }> & { canDecide: boolean }>(
    `/queues/withdraw${qs({ ...f.applied, letter, page: paging.page, perPage: paging.perPage })}`,
  );
  return (
    <Queue title="Course Withdraw Requests" nav="withdraw">
      <Card>
        <Filters
          submit="Search Requests"
          onSubmit={() => {
            f.apply();
            paging.reset();
          }}
        >
          <F label="Student">
            <Txt value={f.draft.student} onChange={f.set("student")} placeholder="Student # or last name" />
          </F>
          <F label="Status">
            <Sel value={f.draft.status} onChange={f.set("status")} empty="All Statuses" options={meta?.options.withdrawStatuses ?? []} />
          </F>
        </Filters>
      </Card>
      <Card>
        <Letters value={letter} onChange={(l) => { setLetter(l); paging.reset(); }} />
        <ErrorLine>{error}</ErrorLine>
        {data && !data.items.length ? (
          <Empty>No course withdraw requests were found.</Empty>
        ) : (
          <>
            <PagerFor data={data} paging={paging} />
            <Table head={["Student", "Request", "Status", "Requested", ""]}>
              {(data?.items ?? []).map((r) => (
                <tr key={r.id}>
                  <td>
                    <StudentLink s={r.student} />
                  </td>
                  <td>
                    {r.subject}
                    {r.details ? <div className="mh-sa__muted" style={{ fontSize: 12 }}>{r.details}</div> : null}
                  </td>
                  <td>{r.status}</td>
                  <td>{fmtStamp(r.requested)}</td>
                  <td>
                    <RequestLink number={r.requestNumber} pending={r.status === "Pending"} canDecide={Boolean(data?.canDecide)} />
                  </td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Card>
    </Queue>
  );
}

/* ------------------------------------------------------------------ */
/* Pending Grade Submissions + review                                   */
/* ------------------------------------------------------------------ */

type Submission = { id: string; courseCode: string; offering: string; courseTitle: string; instructor: string; startsOn: string; endsOn: string; submittedBy: string; submittedAt: string };

export function GradeSubmissions() {
  const { meta } = useStudentsMeta();
  const paging = usePaging(25);
  const f = useApplied({ campus: "", course: "", instructor: "" });
  const { data, error } = useLoad<Paged<Submission> & { courseOptions: Array<{ value: string; label: string }>; instructorOptions: Array<{ value: string; label: string }> }>(`/queues/grades${qs({ ...f.applied, page: paging.page, perPage: paging.perPage })}`);
  const notice = useNotice();
  return (
    <Queue title="Pending Grade Submissions" nav="grades">
      {notice.node}
      <Card>
        <Filters
          submit="Search Submissions"
          onSubmit={() => {
            f.apply();
            paging.reset();
          }}
        >
          <F label="Campus">
            <Sel value={f.draft.campus} onChange={f.set("campus")} empty="All Campuses" options={meta?.campuses ?? []} />
          </F>
          <F label="Course">
            <Sel value={f.draft.course} onChange={f.set("course")} empty="All Courses" options={data?.courseOptions ?? []} />
          </F>
          <F label="Faculty / Instructor">
            <Sel value={f.draft.instructor} onChange={f.set("instructor")} empty="All Instructors" options={data?.instructorOptions ?? []} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <PagerFor data={data} paging={paging} />
        <Table head={["Course", "Instructor(s)", "Dates", "Submitted By", ""]} empty={data ? "No grade submissions are pending." : false}>
          {(data?.items ?? []).map((s) => (
            <tr key={s.id}>
              <td>
                <strong>
                  {s.courseCode} {s.offering}
                </strong>
                <div className="mh-sa__muted" style={{ fontSize: 12 }}>
                  {s.courseTitle}
                </div>
              </td>
              <td>{s.instructor || "—"}</td>
              <td>
                {fmtDate(s.startsOn)} – {fmtDate(s.endsOn)}
              </td>
              <td>
                {s.submittedBy || "—"}
                <div className="mh-sa__muted" style={{ fontSize: 12 }}>
                  {fmtStamp(s.submittedAt)}
                </div>
              </td>
              <td className="st-right">
                <Link className="mh-sa__btn mh-sa__btn--sm" href={`${BASE}/grades/review?id=${encodeURIComponent(s.id)}`}>
                  REVIEW
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </Queue>
  );
}

type Review = {
  id: string;
  status: string;
  course: string;
  session: { instructors: string; room: string; delivery: string; startsOn: string; endsOn: string; schedule: string };
  submittedBy: string;
  submittedAt: string;
  students: Array<{ studentId: string; name: string; number: string; completionDate: string; creditReceived: number; gradePoint: number | null; finalGrade: string }>;
};

export function GradeReview() {
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp?.get("id") ?? "";
  const { data, error } = useLoad<Review>(id ? `/queues/grades/${encodeURIComponent(id)}` : null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<"approve" | "decline" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    if (data) setDates(Object.fromEntries(data.students.map((s) => [s.studentId, s.completionDate.slice(0, 10)])));
  }, [data]);
  const decided = data && data.status !== "pending";
  return (
    <StuFrame title={data ? `Review Grade Submission: ${data.course}` : "Review Grade Submission"} crumbs={["Pending Grade Submissions", "Review"]} nav={`${BASE}/grades`}>
      <ErrorLine>{error ?? actionError}</ErrorLine>
      {!data ? (
        !error ? <Empty>Loading…</Empty> : null
      ) : (
        <>
          {decided ? <p className="st-warning">This grade submission has already been {data.status}.</p> : null}
          <Card title="Session / Offering Details">
            <dl className="st-detail">
              <dt>Instructor(s)</dt>
              <dd>{data.session.instructors || "—"}</dd>
              <dt>Room</dt>
              <dd>{data.session.room || "—"}</dd>
              <dt>Delivery Method</dt>
              <dd>{data.session.delivery || "—"}</dd>
              <dt>Course Dates</dt>
              <dd>
                {fmtDate(data.session.startsOn)} – {fmtDate(data.session.endsOn)}
              </dd>
              <dt>Schedule</dt>
              <dd>{data.session.schedule || "—"}</dd>
              <dt>Submitted By</dt>
              <dd>
                {data.submittedBy || "—"} · {fmtStamp(data.submittedAt)}
              </dd>
            </dl>
          </Card>
          <Card title="Student Grades">
            <Table head={["Student", "Completion Date", "Credit Received", "Grade Point", "Final Grade"]} empty="No student grades in this submission.">
              {data.students.map((s) => (
                <tr key={s.studentId}>
                  <td>
                    <Link href={profileHref(s.studentId, "grades", "marks")}>{s.name}</Link>
                    {s.number ? <div className="mh-sa__muted" style={{ fontSize: 12 }}>{s.number}</div> : null}
                  </td>
                  <td>
                    <input className="mh-sa__input" type="date" aria-label={`Completion date for ${s.name}`} disabled={Boolean(decided)} value={dates[s.studentId] ?? ""} onChange={(e) => setDates((d) => ({ ...d, [s.studentId]: e.target.value }))} />
                  </td>
                  <td>{s.creditReceived}</td>
                  <td>{s.gradePoint === null ? "—" : s.gradePoint.toFixed(2)}</td>
                  <td>{s.finalGrade}</td>
                </tr>
              ))}
            </Table>
            {!decided ? (
              <div className="st-filters__actions" style={{ marginTop: 12 }}>
                <Btn tone="danger" onClick={() => setConfirm("decline")}>
                  Decline Grade Submission
                </Btn>
                <Btn tone="primary" onClick={() => setConfirm("approve")}>
                  Approve Grade Submission
                </Btn>
              </div>
            ) : null}
          </Card>
        </>
      )}
      {confirm === "approve" ? (
        <ConfirmModal
          title="Approve Grade Submission"
          body="Approve this grade submission? The final grades will be published to the students' records."
          ok="Confirm Approval"
          cancel="Cancel Approval"
          danger={false}
          onCancel={() => setConfirm(null)}
          onOk={async () => {
            try {
              await send(`/queues/grades/${encodeURIComponent(id)}/approve`, "POST", { completionDates: dates });
              router.push(`${BASE}/grades?notice=${encodeURIComponent("Grade submission approved.")}`);
            } catch (e) {
              setActionError(errMsg(e, "Could not approve the grade submission"));
            }
            setConfirm(null);
          }}
        />
      ) : null}
      {confirm === "decline" ? (
        <ConfirmModal
          title="Decline Grade Submission"
          body={
            <>
              <p style={{ marginTop: 0 }}>Decline this grade submission? The grades return to the instructor as draft.</p>
              <SourceNotice>The full decline form (reason / comments) was not captured from the original system.</SourceNotice>
            </>
          }
          ok="Decline Grade Submission"
          onCancel={() => setConfirm(null)}
          onOk={async () => {
            try {
              await send(`/queues/grades/${encodeURIComponent(id)}/decline`, "POST");
              router.push(`${BASE}/grades?notice=${encodeURIComponent("Grade submission declined.")}`);
            } catch (e) {
              setActionError(errMsg(e, "Could not decline the grade submission"));
            }
            setConfirm(null);
          }}
        />
      ) : null}
    </StuFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Pending Transcript Changes / Entry Marks / Badges                    */
/* ------------------------------------------------------------------ */

export function TranscriptChanges() {
  const notice = useNotice();
  const { data, error, reload } = useLoad<{ canDecide: boolean; items: Array<{ id: string; student: StudentCell; description: string; date: string }> }>(`/queues/transcript-changes`);
  const decide = async (id: string, decision: "approve" | "reject") => {
    try {
      await send(`/queues/transcript-changes/${encodeURIComponent(id)}/decide`, "POST", { decision });
      notice.ok(`Transcript change ${decision === "approve" ? "approved" : "rejected"}.`);
      reload();
    } catch (e) {
      notice.fail(errMsg(e, "Could not decide transcript change"));
    }
  };
  return (
    <Queue title="Pending Transcript Changes" nav="transcript-changes">
      {notice.node}
      <ErrorLine>{error}</ErrorLine>
      {data && !data.items.length ? (
        <p className="st-warning">Currently no transcript changes are pending.</p>
      ) : (
        <Card>
          <Table head={["Student", "Change", "Date", "Action"]}>
            {(data?.items ?? []).map((c) => (
              <tr key={c.id}>
                <td>
                  <StudentLink s={c.student} tab="grades" sub="marks" />
                </td>
                <td>{c.description}</td>
                <td>{fmtStamp(c.date)}</td>
                <td>{data?.canDecide ? <span style={{ display: "flex", gap: 6 }}><Btn onClick={() => void decide(c.id, "approve")}>Approve</Btn><Btn onClick={() => void decide(c.id, "reject")}>Reject</Btn></span> : "—"}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </Queue>
  );
}

export function EntryMarks() {
  const { data, error } = useLoad<{ items: Array<{ id: string; test: string; status: string; date: string; mark: string; student: StudentCell }> }>(`/queues/entry-marks`);
  return (
    <Queue title="Pending Entry / Progress Test Marks" nav="entry-marks">
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <Table head={["Student", "Entry/Progress Test", "Status", "Date Taken", "Grade/Mark"]} empty={data ? "No students currently pending marks for entry/progress tests." : false}>
          {(data?.items ?? []).map((t) => (
            <tr key={t.id}>
              <td>
                <StudentLink s={t.student} tab="plan" sub="tests" />
              </td>
              <td>{t.test}</td>
              <td>{t.status}</td>
              <td>{fmtDate(t.date)}</td>
              <td>{t.mark || "—"}</td>
            </tr>
          ))}
        </Table>
        {data?.items.length ? <SourceNotice>The mark review / save / approval controls were not captured from the original system.</SourceNotice> : null}
      </Card>
    </Queue>
  );
}

export function BadgesQueue() {
  const { meta } = useStudentsMeta();
  const paging = usePaging(25);
  const f = useApplied({ user: "", badge: "", status: "" });
  const { data, error, reload } = useLoad<Paged<{ id: string; student: StudentCell; badge: string; status: string; earned: string }> & { canDecide: boolean }>(
    `/queues/badges${qs({ ...f.applied, page: paging.page, perPage: paging.perPage })}`,
  );
  const notice = useNotice();
  const [confirm, setConfirm] = useState<{ id: string; badge: string; student: string; decision: "approve" | "decline" } | null>(null);
  return (
    <Queue title="Badges / Accomplishments" nav="badges">
      {notice.node}
      <Card>
        <Filters
          submit="Search Badges"
          onSubmit={() => {
            f.apply();
            paging.reset();
          }}
        >
          <F label="User">
            <Txt value={f.draft.user} onChange={f.set("user")} placeholder="Student #, login or last name" />
          </F>
          <F label="Badge">
            <Sel value={f.draft.badge} onChange={f.set("badge")} empty="All Badges" options={(meta?.badges ?? []).map((b) => b.name)} />
          </F>
          <F label="Status">
            <Sel value={f.draft.status} onChange={f.set("status")} empty="All Statuses" options={meta?.options.badgeStatuses ?? []} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        {data && !data.items.length ? (
          <Empty>No badges/accomplishments were found.</Empty>
        ) : (
          <>
            <PagerFor data={data} paging={paging} />
            <Table head={["Student", "Badge", "Status", "Earned", ""]}>
              {(data?.items ?? []).map((b) => (
                <tr key={b.id}>
                  <td>
                    <StudentLink s={b.student} />
                  </td>
                  <td>{b.badge}</td>
                  <td>{b.status}</td>
                  <td>{b.earned ? fmtDate(b.earned) : "—"}</td>
                  <td>
                    {b.status === "Pending" && data?.canDecide ? (
                      <span className="lx-actions">
                        <Btn small tone="primary" onClick={() => setConfirm({ id: b.id, badge: b.badge, student: b.student.name, decision: "approve" })}>
                          Award
                        </Btn>
                        <Btn small tone="danger" onClick={() => setConfirm({ id: b.id, badge: b.badge, student: b.student.name, decision: "decline" })}>
                          Decline
                        </Btn>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </Card>
      {confirm ? (
        <ConfirmModal
          title={confirm.decision === "approve" ? "Award badge" : "Decline badge"}
          body={`${confirm.decision === "approve" ? "Award" : "Decline"} "${confirm.badge}" for ${confirm.student}?`}
          ok={confirm.decision === "approve" ? "Award" : "Decline"}
          danger={confirm.decision === "decline"}
          onCancel={() => setConfirm(null)}
          onOk={() =>
            send<{ message: string }>(`/queues/badges/${confirm.id}/decide`, "POST", { decision: confirm.decision })
              .then((out) => {
                notice.ok(out.message);
                setConfirm(null);
                reload();
              })
              .catch((e) => {
                notice.fail(errMsg(e, "Could not save the decision"));
                setConfirm(null);
              })
          }
        />
      ) : null}
    </Queue>
  );
}

/* ------------------------------------------------------------------ */
/* Documents / Exports + Bulk / Group Actions                           */
/* ------------------------------------------------------------------ */

export function DocumentsExports() {
  const { meta } = useStudentsMeta();
  const [choice, setChoice] = useState("");
  return (
    <Queue title="DOCUMENTS / CONTENT EXPORTS" nav="exports">
      <Card title="Generate Documents/Exports">
        <F label="Document / Content">
          <Sel value={choice} onChange={setChoice} empty="— Select —" options={meta?.options.exportOptions ?? []} />
        </F>
        {choice ? (
          <div style={{ marginTop: 12 }}>
            <SourceNotice>The export configuration, file format and generated download for &quot;{choice}&quot; were not captured from the original system, so no export output has been assumed.</SourceNotice>
          </div>
        ) : null}
      </Card>
    </Queue>
  );
}

export function BulkActions() {
  const { meta } = useStudentsMeta();
  const [choice, setChoice] = useState("");
  const showLog = choice === "__log";
  const { data, error } = useLoad<{ items: Array<{ id: string; action: string; summary: string; date: string }> }>(showLog ? "/queues/bulk-log" : null);
  return (
    <Queue title="Bulk / Group Actions" nav="bulk">
      <Card>
        <F label="Bulk Action">
          <Sel value={choice} onChange={setChoice} empty="— Select —" options={[...(meta?.options.bulkActions ?? []).map((a) => ({ value: a, label: a })), { value: "__log", label: "Log / History" }]} />
        </F>
        {choice && !showLog ? (
          <div style={{ marginTop: 12 }}>
            <SourceNotice>The student-selection controls, parameters and execution results for &quot;{choice}&quot; were not captured from the original system, so this bulk operation cannot be run from here yet.</SourceNotice>
          </div>
        ) : null}
      </Card>
      {showLog ? (
        <Card title="Log / History">
          <ErrorLine>{error}</ErrorLine>
          <Table head={["Date", "Action", "Summary"]} empty={data ? "No bulk actions have been run." : false}>
            {(data?.items ?? []).map((l) => (
              <tr key={l.id}>
                <td>{fmtStamp(l.date)}</td>
                <td>{l.action}</td>
                <td>{l.summary}</td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}
    </Queue>
  );
}
