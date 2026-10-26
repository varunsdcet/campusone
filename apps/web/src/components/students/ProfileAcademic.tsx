"use client";

import { useState } from "react";
import {
  Btn,
  Card,
  Check,
  Empty,
  ErrorLine,
  F,
  Filters,
  Grid,
  LinkBtn,
  Modal,
  Sel,
  SourceNotice,
  Table,
  Txt,
  downloadBase64,
  fmtDate,
  fmtStamp,
  qs,
  send,
  useLoad,
  useSubmit,
} from "./kit";
import { useProfile } from "./Profile";
import { AuditDetail, type AuditItem } from "./ProfileStatus";

const enc = encodeURIComponent;

/* ------------------------------------------------------------------ */
/* Grades & Transcript                                                  */
/* ------------------------------------------------------------------ */

type Marks = {
  terms: Array<{ code: string; name: string }>;
  items: Array<{ id: string; course: string; term: string; credits: number; percent: number | null; finalGrade: string; gradePoint: number | null; status: string; completed: string }>;
  cgpa: number | null;
  earnedCredits: number;
  attemptedCredits: number;
  averagePercent: number | null;
  currentAverage: number | null;
};

export function FinalMarks() {
  const { id } = useProfile();
  const [draft, setDraft] = useState("all");
  const [applied, setApplied] = useState("all");
  const { data, error } = useLoad<Marks>(`/${enc(id)}/final-marks${qs({ term: applied })}`);
  return (
    <>
      <Card>
        <Filters submit="Search" onSubmit={() => setApplied(draft)}>
          <F label="Term">
            <Sel value={draft} onChange={setDraft} options={(data?.terms ?? [{ code: "all", name: "All Terms" }]).map((t) => ({ value: t.code, label: t.name }))} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        {data && !data.items.length ? (
          <Empty>No course marks were found.</Empty>
        ) : (
          <Table head={["Course", "Term", "Credits", "Percent", "Final Grade", "Grade Point", "Status", "Completion Date"]}>
            {(data?.items ?? []).map((m) => (
              <tr key={m.id}>
                <td>{m.course}</td>
                <td>{m.term || "—"}</td>
                <td>{m.credits}</td>
                <td>{m.percent === null ? "—" : `${m.percent.toFixed(2)}%`}</td>
                <td>{m.finalGrade || "—"}</td>
                <td>{m.gradePoint === null ? "—" : m.gradePoint.toFixed(2)}</td>
                <td>{m.status}</td>
                <td>{m.completed ? fmtDate(m.completed) : "—"}</td>
              </tr>
            ))}
          </Table>
        )}
        {data && data.items.length ? (
          <p className="pm-note">
            Credits earned: {data.earnedCredits.toFixed(2)} of {data.attemptedCredits.toFixed(2)} attempted · Average: {data.averagePercent == null ? "—" : `${data.averagePercent.toFixed(2)}%`} · CGPA:{" "}
            {data.cgpa == null ? "—" : data.cgpa.toFixed(2)}
            {data.currentAverage != null ? ` · Current average of courses in progress: ${data.currentAverage.toFixed(2)}%` : ""}
          </p>
        ) : null}
      </Card>
    </>
  );
}

export function GenerateTranscript() {
  const { id, meta, notice } = useProfile();
  const opts = meta.options.transcriptOptions ?? [];
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const { busy, error, run } = useSubmit();
  const generate = async () => {
    const out = await run(() => send<{ filename: string; mime: string; base64: string }>(`/${enc(id)}/transcript`, "POST", { options: checked, startDate, completionDate }), "Could not generate transcript");
    if (out) {
      downloadBase64(out.filename, out.mime, out.base64, true);
      notice.ok("Transcript generated.");
    }
  };
  return (
    <Card title="Generate Transcript">
      <ErrorLine>{error}</ErrorLine>
      <div className="lx-checks" style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        {opts.map((o) => (
          <Check key={o.key} checked={Boolean(checked[o.key])} onChange={(v) => setChecked((c) => ({ ...c, [o.key]: v }))}>
            {o.label}
          </Check>
        ))}
      </div>
      <Grid>
        <F label="Start Date">
          <Txt type="date" value={startDate} onChange={setStartDate} />
        </F>
        <F label="Completion Date">
          <Txt type="date" value={completionDate} onChange={setCompletionDate} />
        </F>
      </Grid>
      <div className="st-filters__actions" style={{ marginTop: 12 }}>
        <Btn tone="primary" disabled={busy} onClick={() => void generate()}>
          {busy ? "Generating…" : "Generate Document"}
        </Btn>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Program Plan                                                         */
/* ------------------------------------------------------------------ */

type Seats = { capacity: number | null; waitlist: boolean; waitlistSize: number | null; enrolled: number; waitlisted: number };

type Plan = {
  enrolled: boolean;
  status: string;
  rateCategory: string;
  defaultRateCategory: string;
  rateCategories: string[];
  enrolments: Array<{ id: string; program: string; schedule: string; feedIn: string; status: string; startDate: string; date: string }>;
  programs: Array<{ id: string; name: string }>;
  schedules: Array<{ id: string; program: string; name: string; description: string }>;
  feedIns: Array<{
    id: string;
    schedule: string;
    course: string;
    startDate: string;
    endDate: string;
    campus: string;
    sectionId: string;
    fee: { amount: number; included: boolean; termName: string } | null;
    seats: Seats | null;
  }>;
  statuses: string[];
};

type EnrolOut = { id: string; courses: Array<{ course: string; status: string; feeNote: string | null; fee: { amount: number } | null }> };

const money = (n: number) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

function seatLine(seats: Seats) {
  if (seats.capacity === null) return `${seats.enrolled} enrolled, no seat limit`;
  const left = seats.capacity - seats.enrolled;
  if (left > 0) return `${left} of ${seats.capacity} seats left`;
  return seats.waitlist ? `Full (${seats.enrolled}/${seats.capacity}); new students are waitlisted` : `Full (${seats.enrolled}/${seats.capacity}) and the waitlist is disabled`;
}

function EnrolmentEntry({ plan, onSaved }: { plan: Plan; onSaved: (message: string) => void }) {
  const { id } = useProfile();
  const [f, setF] = useState({ programId: "", scheduleId: "", sessionId: "", status: "", rateCategory: plan.rateCategory || plan.defaultRateCategory, courseScope: "schedule", postFee: true });
  const { busy, error, setError, run } = useSubmit();
  const schedules = plan.schedules.filter((s) => s.program === f.programId);
  const feedIns = plan.feedIns.filter((x) => x.schedule === f.scheduleId);
  const session = feedIns.find((x) => x.id === f.sessionId);
  const save = async () => {
    const missing = [!f.programId && "Program", !f.scheduleId && "Schedule", !f.sessionId && "Feed-in Course", !f.status && "Student Status", !f.rateCategory && "Rate Category / Fee Status"].filter(Boolean);
    if (missing.length) return setError(`Please complete: ${missing.join(", ")}`);
    const out = await run(() => send<EnrolOut>(`/${enc(id)}/plan/enrol`, "POST", f), "Could not save the program enrolment");
    if (!out) return;
    const courses = out.courses.map((c) => `${c.course}${c.status === "waitlisted" ? " (waitlisted)" : c.status === "existing" ? " (already enrolled)" : ""}`);
    const fees = out.courses.reduce((t, c) => t + (c.fee?.amount ?? 0), 0);
    onSaved(`Program enrolment saved.${courses.length ? ` Course enrolments: ${courses.join(", ")}.` : ""}${fees > 0 ? ` Course fees posted: ${money(fees)}.` : ""}`);
  };
  return (
    <Card title="Program Enrolment">
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Program" req>
          <Sel value={f.programId} onChange={(v) => setF((s) => ({ ...s, programId: v, scheduleId: "", sessionId: "" }))} empty="— Select —" options={plan.programs.map((p) => ({ value: p.id, label: p.name }))} />
        </F>
        <F label="Schedule" req>
          <Sel value={f.scheduleId} onChange={(v) => setF((s) => ({ ...s, scheduleId: v, sessionId: "" }))} disabled={!f.programId} empty={f.programId ? (schedules.length ? "— Select —" : "No schedules for this program") : "Select a program first"} options={schedules.map((s) => ({ value: s.id, label: s.description ? `${s.name} — ${s.description}` : s.name }))} />
        </F>
        <F label="Feed-in Course" req>
          <Sel value={f.sessionId} onChange={(v) => setF((s) => ({ ...s, sessionId: v }))} disabled={!f.scheduleId} empty={f.scheduleId ? (feedIns.length ? "— Select —" : "No feed-in courses in this schedule") : "Select a schedule first"} options={feedIns.map((x) => ({ value: x.id, label: x.startDate ? `${x.course} (${fmtDate(x.startDate)})` : x.course }))} />
        </F>
        <F label="Student Status" req>
          <Sel value={f.status} onChange={(v) => setF((s) => ({ ...s, status: v }))} empty="— Select —" options={plan.statuses} />
        </F>
        <F label="Rate Category / Fee Status" req hint={!plan.rateCategory && plan.defaultRateCategory ? `Defaulted from residency (${plan.defaultRateCategory}); saved to the profile with the enrolment.` : undefined}>
          <Sel value={f.rateCategory} onChange={(v) => setF((s) => ({ ...s, rateCategory: v }))} empty="— Select —" options={plan.rateCategories} />
        </F>
        <F label="Start Date">
          <input className="mh-sa__input" readOnly value={session?.startDate ? fmtDate(session.startDate) : ""} placeholder="Set by the feed-in course" />
        </F>
        <F label="Course Enrolments">
          <Sel
            value={f.courseScope}
            onChange={(v) => setF((s) => ({ ...s, courseScope: v }))}
            options={[
              { value: "schedule", label: "Feed-in course and the schedule's later courses" },
              { value: "feedIn", label: "Feed-in course only" },
            ]}
          />
        </F>
      </Grid>
      {session ? (
        <div style={{ marginTop: 10 }}>
          {!session.sectionId ? <p className="mh-sa__muted">This feed-in session is linked to a course section when the enrolment is saved.</p> : null}
          {session.seats ? <p className="mh-sa__muted">Feed-in section: {seatLine(session.seats)}.</p> : null}
          <div className="lx-checks">
            <Check checked={f.postFee} onChange={(on) => setF((s) => ({ ...s, postFee: on }))}>
              Post course fee
              {session.fee
                ? session.fee.included
                  ? " (feed-in tuition is included in the program cost)"
                  : session.fee.amount > 0
                    ? ` — ${money(session.fee.amount)} for the feed-in course${session.fee.termName ? `, ${session.fee.termName}` : ""}`
                    : " (no course cost set for the feed-in course)"
                : ""}
            </Check>
          </div>
        </div>
      ) : null}
      <div className="st-filters__actions" style={{ marginTop: 12 }}>
        <Btn tone="primary" disabled={busy} onClick={() => void save()}>
          Save Program Enrolment
        </Btn>
      </div>
    </Card>
  );
}

function EnrolmentSummary({ plan }: { plan: Plan }) {
  return (
    <Card title="Program Enrolment">
      <Table head={["Program", "Schedule", "Feed-in Course", "Status", "Start Date", "Recorded"]}>
        {plan.enrolments.map((e) => (
          <tr key={e.id}>
            <td>{e.program}</td>
            <td>{e.schedule}</td>
            <td>{e.feedIn}</td>
            <td>{e.status}</td>
            <td>{fmtDate(e.startDate)}</td>
            <td>{fmtStamp(e.date)}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function PlanAudit() {
  const { id } = useProfile();
  const { data, error } = useLoad<{ items: AuditItem[] }>(`/${enc(id)}/audit${qs({ sections: "Program Plan" })}`);
  const [open, setOpen] = useState<AuditItem | null>(null);
  return (
    <Card title="Program Plan Audit Trail">
      <ErrorLine>{error}</ErrorLine>
      <Table head={["Date", "By", "Action(s)"]} empty={data ? "No program plan audit records were found." : false}>
        {(data?.items ?? []).map((a) => (
          <tr key={a.id}>
            <td>{fmtStamp(a.date)}</td>
            <td>{a.by}</td>
            <td>
              <LinkBtn onClick={() => setOpen(a)}>{a.action}</LinkBtn>
            </td>
          </tr>
        ))}
      </Table>
      {open ? <AuditDetail item={open} onClose={() => setOpen(null)} /> : null}
    </Card>
  );
}

const ENROLLED_NOTICE: Record<string, string> = {
  customize: "The enrolled-student plan customization screen (course grid and edits) was not captured from the original system.",
  transfer: "The transfer and challenge-credit flow for enrolled students was not captured from the original system.",
  change: "The complete change / drop program process for enrolled students was not captured from the original system.",
  completion: "The program completion flow for enrolled students was not captured from the original system.",
  export: "The plan export output for enrolled students was not captured from the original system; no file format has been assumed.",
};

/** Program Plan subtabs: not-enrolled students see the enrolment gate; enrolled-only flows are marked as not captured. */
export function PlanGate({ view }: { view: "overview" | "customize" | "transfer" | "change" | "completion" | "export" | "audit" }) {
  const { id, notice, reloadHeader } = useProfile();
  const { data: plan, error, reload } = useLoad<Plan>(`/${enc(id)}/plan`);
  if (!plan) return error ? <ErrorLine>{error}</ErrorLine> : <Empty>Loading…</Empty>;
  const saved = (message: string) => {
    notice.ok(message);
    reload();
    reloadHeader();
  };
  if (!plan.enrolled) {
    const showEntry = view === "overview" || view === "transfer" || view === "completion";
    return (
      <>
        <p className="st-warning">This student is currently not enrolled or active in any programs. Enrol the student in a program to manage the program plan.</p>
        {!plan.rateCategory ? <p className="pm-warn" style={{ marginBottom: 12 }}>Rate Category / Fee Status is not set on this profile yet. Choose it below; it is saved with the program enrolment.</p> : null}
        {showEntry ? <EnrolmentEntry plan={plan} onSaved={saved} /> : null}
      </>
    );
  }
  if (view === "overview") return <EnrolmentSummary plan={plan} />;
  if (view === "audit") return <PlanAudit />;
  return (
    <>
      <EnrolmentSummary plan={plan} />
      <SourceNotice>{ENROLLED_NOTICE[view]}</SourceNotice>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Entry & Progress Tests                                               */
/* ------------------------------------------------------------------ */

type Test = { id: string; test: string; date: string; mark: string; hide: boolean; status: string };

export function EntryTests() {
  const { id, notice } = useProfile();
  const { data, error, reload } = useLoad<{ items: Test[]; options: Array<{ id: string; name: string }> }>(`/${enc(id)}/tests`);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ testId: "", date: "", hide: false });
  const [tried, setTried] = useState(false);
  const { busy, error: saveError, setError, run } = useSubmit();
  const save = async () => {
    setTried(true);
    if (!f.testId || !f.date) return setError("Select an Entry / Progress Test and a Test Date");
    if (await run(() => send(`/${enc(id)}/tests`, "POST", f))) {
      setOpen(false);
      setF({ testId: "", date: "", hide: false });
      setTried(false);
      notice.ok("Entry / progress test added.");
      reload();
    }
  };
  return (
    <>
      <Card
        actions={
          <Btn small tone="primary" onClick={() => setOpen(true)}>
            Add Entry / Progress Test
          </Btn>
        }
      >
        <ErrorLine>{error}</ErrorLine>
        <Table head={["Entry/Progress Test", "Test Date", "Mark"]} empty={data ? "No entry / progress tests were found." : false}>
          {(data?.items ?? []).map((t) => (
            <tr key={t.id}>
              <td>
                {t.test}
                {t.hide ? <span className="st-pill st-pill--off" style={{ marginLeft: 6 }}>Hidden from transcript</span> : null}
              </td>
              <td>{fmtDate(t.date)}</td>
              <td>{t.mark || <span className="mh-sa__muted">{t.status}</span>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {open ? (
        <Modal
          title="Add Entry / Progress Test"
          onClose={() => setOpen(false)}
          footer={
            <Btn tone="primary" disabled={busy} onClick={() => void save()}>
              Save Entry / Progress Test
            </Btn>
          }
        >
          <ErrorLine>{saveError}</ErrorLine>
          <Grid>
            <F label="Entry/Progress Test" req>
              <span className={tried && !f.testId ? "st-invalid" : ""}>
                <Sel value={f.testId} onChange={(v) => setF((s) => ({ ...s, testId: v }))} empty={data?.options.length ? "— Select —" : "No tests configured in Course Management"} options={(data?.options ?? []).map((o) => ({ value: o.id, label: o.name }))} />
              </span>
            </F>
            <F label="Test Date" req>
              <span className={tried && !f.date ? "st-invalid" : ""}>
                <Txt type="date" value={f.date} onChange={(v) => setF((s) => ({ ...s, date: v }))} />
              </span>
            </F>
          </Grid>
          <div className="lx-checks" style={{ marginTop: 8 }}>
            <Check checked={f.hide} onChange={(v) => setF((s) => ({ ...s, hide: v }))}>
              Hide from transcript
            </Check>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
