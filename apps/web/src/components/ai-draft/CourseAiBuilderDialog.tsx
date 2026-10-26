"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, loadSession } from "@/lib/api";

type Delivery = "synchronous" | "self_paced";
type Brief = {
  hours: number;
  modules: number;
  lessonsPerModule: number;
  delivery: Delivery;
  deliveryMethod: string;
  breakdown: string;
  audience: string;
  includeCase: boolean;
  quizQuestions: number;
  outline: string;
  notes: string;
};
type Lesson = { id: string; title: string; focus: string; minutes: number };
type Module = { id: string; number: number; title: string; purpose: string; milestone: string; outcomes: string[]; minutes: number; lessons: Lesson[] };
type Assessment = { id: string; title: string; mode: "Individual" | "Team"; weight: number; dueModule: string; outcomes: string[]; summary: string };
type Blueprint = {
  course: { code: string; title: string; hours: number; totalMinutes: number; delivery: Delivery; description: string };
  outcomes: Array<{ id: string; text: string }>;
  modules: Module[];
  quizWeight: number;
  quizQuestions: number;
  assessments: Assessment[];
  assumptions: string[];
  approvalRequired: string[];
  flags: string[];
};
type Check = { label: string; ok: boolean; detail: string };
type ItemSummary = { key: string; kind: string; label: string; status: "pending" | "running" | "done" | "failed"; error?: string; attempts: number; flags: number };
type State = {
  course: { code: string; title: string; description: string; totalHours: number | null };
  job: {
    version: number;
    stage: "blueprint" | "approved" | "published";
    brief: Brief;
    blueprint: Blueprint | null;
    blueprintTask: { status: "running" | "done" | "failed"; error?: string };
    published: { at: string; version: number } | null;
  } | null;
  items: ItemSummary[];
  running: boolean;
  checks: Check[];
  publishedSummary?: { topics: number; activities: number; assignments: number };
};

const DEFAULT_BRIEF: Brief = {
  hours: 120,
  modules: 12,
  lessonsPerModule: 4,
  delivery: "synchronous",
  deliveryMethod: "Distance / online",
  breakdown: "100% online",
  audience: "",
  includeCase: true,
  quizQuestions: 10,
  outline: "",
  notes: "",
};

const STATUS_LABEL: Record<ItemSummary["status"], string> = { pending: "Waiting", running: "Writing…", done: "Ready", failed: "Failed" };

async function call<T>(path: string, init?: RequestInit) {
  const session = loadSession();
  if (!session?.accessToken) throw new Error("Your session has expired. Sign in again.");
  return api<T>(path, init, session.accessToken);
}

export function CourseAiBuilderDialog({ path, onClose, onPublished, defaultDelivery }: { path: string; onClose: () => void; onPublished?: () => void; defaultDelivery?: Delivery }) {
  const [state, setState] = useState<State | null>(null);
  const [brief, setBrief] = useState<Brief>(() => ({ ...DEFAULT_BRIEF, ...(defaultDelivery ? { delivery: defaultDelivery, deliveryMethod: "Self-paced online", breakdown: "100% asynchronous online" } : {}) }));
  const [edit, setEdit] = useState<Blueprint | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{ label: string; html: string; flags: string[] } | null>(null);
  const briefLoaded = useRef(false);
  const q = `path=${encodeURIComponent(path)}`;

  const apply = useCallback((next: State) => {
    setState(next);
    if (!briefLoaded.current) {
      briefLoaded.current = true;
      if (next.job?.brief) setBrief(next.job.brief);
      else if (next.course.totalHours) setBrief((b) => ({ ...b, hours: next.course.totalHours! }));
    }
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await call<State>(`/instructor/ai-course?${q}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the AI course builder");
    }
  }, [apply, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const job = state?.job ?? null;
  const blueprintRunning = job?.stage === "blueprint" && job.blueprintTask.status === "running";
  const generating = job?.stage === "approved" && (state?.running || state?.items.some((i) => i.status === "running" || i.status === "pending"));
  useEffect(() => {
    if (!blueprintRunning && !generating) return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [blueprintRunning, generating, load]);

  useEffect(() => {
    if (!dirty) setEdit(job?.stage === "blueprint" && job.blueprint ? (JSON.parse(JSON.stringify(job.blueprint)) as Blueprint) : null);
  }, [job?.blueprint, job?.stage, dirty]);

  async function act(label: string, run: () => Promise<State>, done?: string) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const next = await run();
      apply(next);
      if (done) setNotice(done);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setBusy("");
    }
  }

  const post = (url: string, body: unknown = {}) => call<State>(url, { method: "POST", body: JSON.stringify({ path, ...(body as object) }) });

  const lessons = brief.modules * brief.lessonsPerModule;
  const lessonMinutes = lessons ? Math.round((brief.hours * 60) / lessons) : 0;
  const briefError =
    lessons > 96 ? "Keep modules × lessons per module at or below 96." : lessonMinutes < 20 ? "Each lesson needs at least 20 minutes." : "";

  function startBlueprint() {
    if (job?.published && !window.confirm("This course already has AI-generated content. Generating a new blueprint will replace it when you publish again. Continue?")) return;
    setDirty(false);
    void act("blueprint", () => post("/instructor/ai-course/blueprint", { brief }));
  }

  async function saveEdits() {
    if (!edit) return null;
    const next = await act("save", () =>
      call<State>("/instructor/ai-course/blueprint", {
        method: "PUT",
        body: JSON.stringify({
          path,
          description: edit.course.description,
          outcomes: edit.outcomes.map((o) => o.text),
          modules: edit.modules.map((m) => ({ title: m.title, purpose: m.purpose, milestone: m.milestone, lessons: m.lessons.map((l) => ({ title: l.title, focus: l.focus })) })),
          quizWeight: edit.quizWeight,
          assessments: edit.assessments.map((a) => ({ title: a.title, mode: a.mode, weight: a.weight, dueModule: a.dueModule, summary: a.summary })),
        }),
      }),
    );
    if (next) setDirty(false);
    return next;
  }

  async function approve() {
    if (dirty && !(await saveEdits())) return;
    await act("approve", () => post("/instructor/ai-course/approve"));
  }

  async function publish() {
    if (!window.confirm("Publish the generated course into this section? Lesson pages, quizzes and assignments become visible to enrolled students. Instructor guides stay hidden.")) return;
    const next = await act("publish", () => post("/instructor/ai-course/publish"));
    if (next?.publishedSummary) {
      setNotice(`Published ${next.publishedSummary.topics} topics, ${next.publishedSummary.activities} activities and ${next.publishedSummary.assignments} gradebook assignments.`);
      onPublished?.();
    }
  }

  async function openPreview(key: string) {
    setBusy(`preview:${key}`);
    try {
      setPreview(await call(`/instructor/ai-course/item?${q}&key=${encodeURIComponent(key)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy("");
    }
  }

  function patch(fn: (bp: Blueprint) => void) {
    if (!edit) return;
    const next = JSON.parse(JSON.stringify(edit)) as Blueprint;
    fn(next);
    setEdit(next);
    setDirty(true);
  }

  const weightTotal = edit ? edit.quizWeight + edit.assessments.reduce((a, x) => a + (Number(x.weight) || 0), 0) : 0;
  const done = state?.items.filter((i) => i.status === "done").length ?? 0;
  const failed = state?.items.filter((i) => i.status === "failed") ?? [];
  const total = state?.items.length ?? 0;
  const canPublish = job?.stage !== "blueprint" && total > 0 && done === total && !state?.running && (state?.checks ?? []).every((c) => c.ok);
  const step = !job || (job.stage === "blueprint" && !job.blueprint && job.blueprintTask.status !== "running") ? 1 : job.stage === "blueprint" ? 2 : 3;

  return (
    <div className="mh-ai-draft-overlay" role="dialog" aria-modal="true" aria-labelledby="course-ai-builder-title">
      <div className="mh-ai-draft-modal mh-ai-course">
        <header className="mh-ai-draft-modal__head">
          <h2 id="course-ai-builder-title">
            AI course builder{state ? ` — ${state.course.code} ${state.course.title}` : ""}
          </h2>
          <button type="button" className="mh-ai-draft-modal__x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <ol className="mh-ai-course__steps">
          {["Course brief", "Review blueprint", "Generate & publish"].map((label, i) => (
            <li key={label} className={step === i + 1 ? "is-active" : step > i + 1 ? "is-done" : ""}>
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        {error ? (
          <p className="mh-ai-draft-modal__note" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? <p className="mh-ai-course__ok">{notice}</p> : null}
        {job?.published ? (
          <p className="mh-ai-draft-modal__help">Last published {new Date(job.published.at).toLocaleString()}. Publishing again replaces that content; graded work is kept.</p>
        ) : null}

        {!state ? <p className="mh-ai-draft-modal__help">Loading…</p> : null}

        {state && step === 1 ? (
          <div className="mh-ai-draft-modal__fields">
            {job?.blueprintTask.status === "failed" && job.blueprintTask.error !== "Discarded" ? (
              <p className="mh-ai-draft-modal__note" role="alert">
                Blueprint failed: {job.blueprintTask.error}
              </p>
            ) : null}
            <div className="mh-ai-draft-modal__row">
              <label>
                Total hours
                <input type="number" min={1} max={600} value={brief.hours} onChange={(e) => setBrief({ ...brief, hours: Number(e.target.value) || 0 })} />
              </label>
              <label>
                Modules
                <input type="number" min={1} max={24} value={brief.modules} onChange={(e) => setBrief({ ...brief, modules: Number(e.target.value) || 0 })} />
              </label>
              <label>
                Lessons per module
                <input type="number" min={1} max={8} value={brief.lessonsPerModule} onChange={(e) => setBrief({ ...brief, lessonsPerModule: Number(e.target.value) || 0 })} />
              </label>
              <label>
                Questions per module quiz
                <input type="number" min={5} max={20} value={brief.quizQuestions} onChange={(e) => setBrief({ ...brief, quizQuestions: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <div className="mh-ai-draft-modal__row">
              <label>
                Delivery format
                <select value={brief.delivery} onChange={(e) => setBrief({ ...brief, delivery: e.target.value as Delivery })}>
                  <option value="synchronous">Synchronous (live sessions)</option>
                  <option value="self_paced">Self-paced (study units)</option>
                </select>
              </label>
              <label>
                Delivery method
                <input value={brief.deliveryMethod} maxLength={120} onChange={(e) => setBrief({ ...brief, deliveryMethod: e.target.value })} />
              </label>
              <label>
                Breakdown
                <input value={brief.breakdown} maxLength={200} onChange={(e) => setBrief({ ...brief, breakdown: e.target.value })} />
              </label>
              <label>
                Shared business case
                <select value={brief.includeCase ? "yes" : "no"} onChange={(e) => setBrief({ ...brief, includeCase: e.target.value === "yes" })}>
                  <option value="yes">Create one fictional case</option>
                  <option value="no">No shared case</option>
                </select>
              </label>
            </div>
            <label>
              Audience and prerequisites
              <input value={brief.audience} maxLength={600} placeholder="e.g. Final-term business diploma students" onChange={(e) => setBrief({ ...brief, audience: e.target.value })} />
            </label>
            <label>
              Approved outline or source material (optional — the AI treats this as authoritative)
              <textarea
                rows={8}
                maxLength={40000}
                value={brief.outline}
                placeholder="Paste the program outline: description, outcomes, module hours, assessment plan and weights…"
                onChange={(e) => setBrief({ ...brief, outline: e.target.value })}
              />
            </label>
            <label>
              Notes for the AI (optional)
              <textarea rows={2} maxLength={4000} value={brief.notes} onChange={(e) => setBrief({ ...brief, notes: e.target.value })} />
            </label>
            <p className="mh-ai-draft-modal__help">
              {lessons} {brief.delivery === "synchronous" ? "sessions" : "study units"} of about {lessonMinutes} minutes each. Each lesson gets core reading, a
              worked example, a timed plan, a workshop and a self-check. {brief.delivery === "self_paced" ? "Self-paced lessons also get a course-specific narrated AI video lecture for admin/SME review. " : "Synchronous/offline lessons stay text-led without generated video or audio. "}
              Each module gets an auto-graded quiz, and assessments get rubrics out of 100. Instructor guides with answer keys stay hidden from students.
            </p>
            {briefError ? (
              <p className="mh-ai-draft-modal__note" role="alert">
                {briefError}
              </p>
            ) : null}
          </div>
        ) : null}

        {state && blueprintRunning ? <p className="mh-ai-course__progress">✦ Designing the blueprint (modules, outcomes, assessment plan)… usually 1–3 minutes.</p> : null}

        {state && step === 2 && edit ? (
          <div className="mh-ai-course__blueprint">
            <label>
              Course description
              <textarea rows={3} value={edit.course.description} onChange={(e) => patch((bp) => void (bp.course.description = e.target.value))} />
            </label>
            <h3>Course learning outcomes</h3>
            {edit.outcomes.map((o, i) => (
              <label key={o.id} className="mh-ai-course__inline">
                <span>{o.id}</span>
                <input value={o.text} onChange={(e) => patch((bp) => void (bp.outcomes[i]!.text = e.target.value))} />
              </label>
            ))}
            <h3>Modules and lessons</h3>
            {edit.modules.map((m, mi) => (
              <details key={m.id} className="mh-ai-course__module">
                <summary>
                  {m.id} · {m.title} <em>({Math.round(m.minutes / 6) / 10} h · {m.lessons.length} lessons · {m.outcomes.join(", ")})</em>
                </summary>
                <label>
                  Module title
                  <input value={m.title} onChange={(e) => patch((bp) => void (bp.modules[mi]!.title = e.target.value))} />
                </label>
                <label>
                  Purpose
                  <input value={m.purpose} onChange={(e) => patch((bp) => void (bp.modules[mi]!.purpose = e.target.value))} />
                </label>
                <label>
                  Milestone
                  <input value={m.milestone} onChange={(e) => patch((bp) => void (bp.modules[mi]!.milestone = e.target.value))} />
                </label>
                {m.lessons.map((l, li) => (
                  <label key={l.id} className="mh-ai-course__inline">
                    <span>
                      {l.id} · {l.minutes} min
                    </span>
                    <input value={l.title} onChange={(e) => patch((bp) => void (bp.modules[mi]!.lessons[li]!.title = e.target.value))} />
                  </label>
                ))}
              </details>
            ))}
            <h3>Assessment plan</h3>
            <table className="mh-ai-course__table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Mode</th>
                  <th>Due</th>
                  <th>Weight %</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Q</td>
                  <td>Module quizzes ({edit.modules.length} × {edit.quizQuestions} questions)</td>
                  <td>Individual</td>
                  <td>Each module</td>
                  <td>
                    <input type="number" min={0} max={40} value={edit.quizWeight} onChange={(e) => patch((bp) => void (bp.quizWeight = Number(e.target.value) || 0))} />
                  </td>
                </tr>
                {edit.assessments.map((a, ai) => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>
                      <input value={a.title} onChange={(e) => patch((bp) => void (bp.assessments[ai]!.title = e.target.value))} />
                    </td>
                    <td>
                      <select value={a.mode} onChange={(e) => patch((bp) => void (bp.assessments[ai]!.mode = e.target.value as Assessment["mode"]))}>
                        <option>Individual</option>
                        <option>Team</option>
                      </select>
                    </td>
                    <td>
                      <select value={a.dueModule} onChange={(e) => patch((bp) => void (bp.assessments[ai]!.dueModule = e.target.value))}>
                        {edit.modules.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="number" min={1} max={100} value={a.weight} onChange={(e) => patch((bp) => void (bp.assessments[ai]!.weight = Number(e.target.value) || 0))} />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4}>
                    <strong>Total</strong>
                  </td>
                  <td className={weightTotal === 100 ? "" : "mh-ai-course__bad"}>
                    <strong>{weightTotal}%</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            {edit.flags.length || edit.approvalRequired.length ? (
              <>
                <h3>Needs your attention</h3>
                <ul>
                  {[...edit.flags, ...edit.approvalRequired].map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        {state && step >= 2 && state.checks.length ? (
          <ul className="mh-ai-course__checks">
            {state.checks.map((c) => (
              <li key={c.label} className={c.ok ? "is-ok" : "is-bad"}>
                {c.ok ? "✓" : "✗"} <strong>{c.label}:</strong> {c.detail}
              </li>
            ))}
          </ul>
        ) : null}

        {state && step === 3 ? (
          <div className="mh-ai-course__items">
            <p className="mh-ai-course__progress">
              {done} of {total} items ready{generating ? " — generation continues on the server, you can close this window and come back." : "."}
            </p>
            <progress max={total || 1} value={done} />
            <table className="mh-ai-course__table">
              <tbody>
                {state.items.map((i) => (
                  <tr key={i.key}>
                    <td>{i.label}</td>
                    <td className={i.status === "failed" ? "mh-ai-course__bad" : ""}>
                      {STATUS_LABEL[i.status]}
                      {i.flags ? ` · ${i.flags} flag(s)` : ""}
                      {i.error ? <div className="mh-ai-course__err">{i.error}</div> : null}
                    </td>
                    <td>
                      {i.status === "done" ? (
                        <button type="button" className="mh-teacher-btn" disabled={!!busy} onClick={() => void openPreview(i.key)}>
                          Preview
                        </button>
                      ) : null}
                      {i.status === "done" || i.status === "failed" ? (
                        <button
                          type="button"
                          className="mh-teacher-btn"
                          disabled={!!busy}
                          onClick={() => void act("run", () => post("/instructor/ai-course/run", { key: i.key }))}
                        >
                          {i.status === "failed" ? "Retry" : "Regenerate"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {preview ? (
          <div className="mh-ai-draft-modal__editor-wrap">
            <div className="mh-ai-draft-modal__editor-head">
              <span>{preview.label}</span>
              <button type="button" className="mh-teacher-btn" onClick={() => setPreview(null)}>
                Close preview
              </button>
            </div>
            {preview.flags.length ? (
              <ul className="mh-ai-course__checks">
                {preview.flags.map((f) => (
                  <li key={f} className="is-bad">
                    ⚑ {f}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mh-ai-draft-modal__editor" dangerouslySetInnerHTML={{ __html: preview.html }} />
          </div>
        ) : null}

        <footer className="mh-ai-draft-modal__foot">
          {job && !blueprintRunning ? (
            <button
              type="button"
              className="mh-teacher-btn"
              disabled={!!busy || !!generating}
              onClick={() => {
                if (window.confirm("Discard this AI course draft? Published content stays in the course.")) {
                  briefLoaded.current = true;
                  setDirty(false);
                  void act("discard", () => call<State>(`/instructor/ai-course?${q}`, { method: "DELETE" }));
                }
              }}
            >
              Discard draft
            </button>
          ) : null}
          <button type="button" className="mh-teacher-btn" onClick={onClose}>
            Close
          </button>
          {step === 1 ? (
            <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" disabled={!!busy || !!briefError || !state} onClick={startBlueprint}>
              ✦ {busy === "blueprint" ? "Starting…" : "Generate blueprint"}
            </button>
          ) : null}
          {step === 2 && edit ? (
            <>
              <button type="button" className="mh-teacher-btn" disabled={!!busy} onClick={startBlueprint}>
                Regenerate
              </button>
              <button type="button" className="mh-teacher-btn" disabled={!!busy || !dirty} onClick={() => void saveEdits()}>
                {busy === "save" ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" disabled={!!busy || weightTotal !== 100} onClick={() => void approve()}>
                {busy === "approve" ? "Approving…" : "Approve & generate content"}
              </button>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <button type="button" className="mh-teacher-btn" disabled={!!busy || !!generating} onClick={() => void act("reopen", () => post("/instructor/ai-course/reopen"))}>
                Edit blueprint
              </button>
              {failed.length && !generating ? (
                <button type="button" className="mh-teacher-btn" disabled={!!busy} onClick={() => void act("run", () => post("/instructor/ai-course/run"))}>
                  Retry {failed.length} failed
                </button>
              ) : null}
              <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" disabled={!!busy || !canPublish} onClick={() => void publish()}>
                {busy === "publish" ? "Publishing…" : job?.stage === "published" ? "Publish again" : "Publish to course"}
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
