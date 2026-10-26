"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RichTextEditor, SaCard, SaField, SuperFrame } from "@/components/superadmin/shared";
import { refreshNavCounts } from "@/lib/navCounts";
import { Notices, Req, errMsg, invalidateMeta, json, useMeta, ws, type Meta } from "./common";

type Session = { day: string; start: string; end: string };
type Settings = {
  introduction: string;
  descriptionHtml: string;
  adminStatus: string;
  campus: string;
  instructors: string[];
  classroom: string;
  enrolmentCutoff: string;
  rolesMode: string;
  roleIds: string[];
  maxEnrolments: number | string;
  sameAsClassroom: boolean;
  privacy: string;
  approval: string;
  hours: number | string;
  continuous: boolean;
  startDate: string;
  endDate: string;
  scheduleType: string;
  sessions: Session[];
  dailyStart: string;
  dailyEnd: string;
  feeCollection: string;
  defaultFee: number | string;
  domesticFee: number | string;
  internationalFee: number | string;
  gradingScheme: string;
  lms: string;
  campusAccess: string;
  accessLevels: string;
  studentStatuses: string;
  programOfStudy: string;
  grades: string;
  badges: string;
  hasImage?: boolean;
};
type Form = { categoryId: string; title: string; code: string; settings: Settings };
type Loaded = { id: string; title: string; code: string; categoryId: string; settings: Settings; instructorOptions: Array<{ id: string; name: string }> };

const BLANK: Settings = {
  introduction: "",
  descriptionHtml: "",
  adminStatus: "Active",
  campus: "",
  instructors: [],
  classroom: "",
  enrolmentCutoff: "",
  rolesMode: "Disabled",
  roleIds: [],
  maxEnrolments: "",
  sameAsClassroom: true,
  privacy: "Private Workshop",
  approval: "Manual Decision",
  hours: 0,
  continuous: false,
  startDate: "",
  endDate: "",
  scheduleType: "Weekly Schedule",
  sessions: [],
  dailyStart: "",
  dailyEnd: "",
  feeCollection: "Immediately",
  defaultFee: "0.00",
  domesticFee: "0.00",
  internationalFee: "0.00",
  gradingScheme: "None / Not Applicable",
  lms: "Disabled",
  campusAccess: "All Campuses",
  accessLevels: "All Accesses",
  studentStatuses: "All Statuses",
  programOfStudy: "All Programs",
  grades: "Visible",
  badges: "Visible",
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const IMAGE_MAX = 2 * 1024 * 1024;

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: Array<string | { value: string; label: string }>; placeholder?: string }) {
  return (
    <select className="mh-sa__input" value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o}>{o}</option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

function Money({ label, value, onChange }: { label: string; value: number | string; onChange: (v: string) => void }) {
  return (
    <SaField label={label}>
      <span className="wk-money">
        <span aria-hidden>$</span>
        <input className="mh-sa__input" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} onBlur={() => onChange((Number(value) || 0).toFixed(2))} />
      </span>
    </SaField>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <SaCard title={title}>{children}</SaCard>;
}

function wordCount(html: string) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

function InstructorPicker({ meta, value, extra, onChange }: { meta: Meta | null; value: string[]; extra: Array<{ id: string; name: string }>; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const all = useMemo(() => {
    const m = new Map((meta?.instructors ?? []).map((i) => [i.id, i.name]));
    for (const e of extra) if (!m.has(e.id)) m.set(e.id, e.name);
    return m;
  }, [meta, extra]);
  const matches = q.trim().length
    ? [...all.entries()].filter(([id, name]) => !value.includes(id) && name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : [];
  return (
    <div className="wk-picker">
      {value.length ? (
        <div className="wk-chips">
          {value.map((id) => (
            <span key={id} className="wk-chip">
              {all.get(id) ?? "Unknown"}
              <button type="button" aria-label={`Remove ${all.get(id) ?? "instructor"}`} onClick={() => onChange(value.filter((x) => x !== id))}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input className="mh-sa__input" placeholder="Search staff by name" value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length ? (
        <ul className="wk-results" role="listbox">
          {matches.map(([id, name]) => (
            <li key={id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onChange([...value, id]);
                  setQ("");
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : q.trim() ? (
        <span className="mh-sa__sub">No staff matched “{q.trim()}”.</span>
      ) : null}
    </div>
  );
}

export function WorkshopForm({ id }: { id?: string }) {
  const router = useRouter();
  const meta = useMeta();
  const [form, setForm] = useState<Form | null>(id ? null : { categoryId: "", title: "", code: "", settings: BLANK });
  const [extraInstructors, setExtraInstructors] = useState<Array<{ id: string; name: string }>>([]);
  const [image, setImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    ws<Loaded>(`/catalog/${id}`)
      .then((w) => {
        setForm({
          categoryId: w.categoryId,
          title: w.title,
          code: w.code,
          settings: {
            ...BLANK,
            ...w.settings,
            maxEnrolments: w.settings.maxEnrolments,
            defaultFee: Number(w.settings.defaultFee).toFixed(2),
            domesticFee: Number(w.settings.domesticFee).toFixed(2),
            internationalFee: Number(w.settings.internationalFee).toFixed(2),
          },
        });
        setExtraInstructors(w.instructorOptions);
        if (w.settings.hasImage) ws<{ name: string; dataUrl: string }>(`/catalog/${id}/image`).then(setImage).catch(() => undefined);
      })
      .catch((e) => setError(errMsg(e, "Could not load the workshop")));
  }, [id]);

  const st = form?.settings ?? BLANK;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => (f ? { ...f, settings: { ...f.settings, [k]: v } } : f));
  const setTop = <K extends "categoryId" | "title" | "code">(k: K, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const campusIsManaged = Boolean(meta?.classrooms.some((c) => c.campus === st.campus));
  const classrooms = (meta?.classrooms ?? []).filter((c) => !st.campus || !campusIsManaged || c.campus === st.campus);
  const room = meta?.classrooms.find((c) => c.value === st.classroom);
  const activeRoles = (meta?.roles ?? []).filter((r) => r.status === "Active" || st.roleIds.includes(r.id));

  function toggleDay(day: string, on: boolean) {
    const sessions = on ? [...st.sessions, { day, start: st.sessions[0]?.start ?? "09:00", end: st.sessions[0]?.end ?? "11:00" }] : st.sessions.filter((x) => x.day !== day);
    set("sessions", sessions);
  }
  function setTime(day: string, k: "start" | "end", v: string) {
    set(
      "sessions",
      st.sessions.map((x) => (x.day === day ? { ...x, [k]: v } : x)),
    );
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) return setError("Workshop Image must be a PNG, JPG, GIF or WebP image");
    if (file.size > IMAGE_MAX) return setError("Workshop Image must be 2 MB or smaller");
    const reader = new FileReader();
    reader.onload = () => {
      setImage({ name: file.name, dataUrl: String(reader.result) });
      setImageChanged(true);
    };
    reader.readAsDataURL(file);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        categoryId: form.categoryId,
        title: form.title,
        code: form.code,
        ...(imageChanged ? { image } : {}),
        settings: {
          ...form.settings,
          maxEnrolments: form.settings.sameAsClassroom ? undefined : Number(form.settings.maxEnrolments),
          hours: Number(form.settings.hours) || 0,
          defaultFee: Number(form.settings.defaultFee) || 0,
          domesticFee: Number(form.settings.domesticFee) || 0,
          internationalFee: Number(form.settings.internationalFee) || 0,
          hasImage: undefined,
        },
      };
      const r = id ? await ws<{ id: string; message: string }>(`/catalog/${id}`, json("PUT", body)) : await ws<{ id: string; message: string }>("/catalog", json("POST", body));
      invalidateMeta();
      refreshNavCounts();
      router.push(`/admin/workshops/manage/${r.id}?notice=${encodeURIComponent(r.message)}`);
    } catch (err) {
      setError(errMsg(err, "Could not save the workshop"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  const title = id ? "EDIT WORKSHOP" : "ADD WORKSHOP";

  return (
    <SuperFrame
      title={title}
      breadcrumbs={["Home", "Workshops", id ? "Edit Workshop" : "Add Workshop"]}
      breadcrumbHrefs={["/admin", "/admin/workshops/manage"]}
      activeHref="/admin/workshops/manage"
    >
      <div className="ur">
        <Notices notice={null} error={error} onNotice={() => undefined} onError={() => setError(null)} />
        {!form ? (
          error ? null : <p className="mh-sa__muted">Loading workshop…</p>
        ) : (
          <form className="ur-fieldset" onSubmit={(e) => void submit(e)}>
            <Section title="Workshop Details">
              <div className="mh-sa__grid">
                <SaField label="Workshop Category">
                  <Select value={form.categoryId} onChange={(v) => setTop("categoryId", v)} placeholder="Not Set" options={(meta?.categories ?? []).map((c) => ({ value: c.id, label: c.abbreviation ? `${c.name} (${c.abbreviation})` : c.name }))} />
                </SaField>
                <label className="mh-sa__field">
                  <span className="mh-sa__label">
                    <Req label="Workshop Name" />
                  </span>
                  <input className="mh-sa__input" required maxLength={200} value={form.title} onChange={(e) => setTop("title", e.target.value)} />
                </label>
                <SaField label="Workshop Number" hint="generated if left blank">
                  <input className="mh-sa__input" maxLength={40} value={form.code} onChange={(e) => setTop("code", e.target.value.toUpperCase())} />
                </SaField>
                <SaField label="Introduction" wide>
                  <textarea className="mh-sa__input" rows={3} maxLength={4000} value={st.introduction} onChange={(e) => set("introduction", e.target.value)} />
                </SaField>
              </div>
              <div className="mh-sa__field">
                <span className="mh-sa__label">Description</span>
                <RichTextEditor key={id ?? "new"} label="Description" value={st.descriptionHtml} onChange={(html) => set("descriptionHtml", html)} />
                <span className="wk-wordcount">Words: {wordCount(st.descriptionHtml)}</span>
              </div>
              <div className="mh-sa__field">
                <span className="mh-sa__label">Workshop Image</span>
                <div className="wk-image">
                  {image ? <img src={image.dataUrl} alt="Workshop" /> : <span className="mh-sa__muted">No image selected</span>}
                  <div className="mh-sa__inline">
                    <button type="button" className="mh-sa__btn" onClick={() => fileRef.current?.click()}>
                      Add / Browse
                    </button>
                    {image ? (
                      <button
                        type="button"
                        className="mh-sa__btn mh-sa__btn--danger"
                        onClick={() => {
                          setImage(null);
                          setImageChanged(true);
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                    <span className="mh-sa__sub">PNG, JPG, GIF or WebP · max 2 MB{image ? ` · ${image.name}` : ""}</span>
                  </div>
                  <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => onFile(e.target.files?.[0] ?? undefined)} />
                </div>
              </div>
              <div className="mh-sa__grid">
                <SaField label="Status">
                  <Select value={st.adminStatus} onChange={(v) => set("adminStatus", v)} options={meta?.options.statuses ?? ["Active", "Inactive"]} />
                </SaField>
                <SaField label="Campus / Location">
                  <Select
                    value={st.campus}
                    onChange={(v) => {
                      set("campus", v);
                      if (room && meta?.classrooms.some((c) => c.campus === v) && room.campus !== v) set("classroom", "");
                    }}
                    placeholder="Select Campus / Location"
                    options={meta?.campuses ?? []}
                  />
                </SaField>
                <SaField label="Classroom">
                  <Select value={st.classroom} onChange={(v) => set("classroom", v)} placeholder="Select Classroom" options={classrooms.map((c) => ({ value: c.value, label: `${c.label}${c.size ? ` (${c.size} seats)` : ""}` }))} />
                </SaField>
                <SaField label="Instructor(s)" wide>
                  <InstructorPicker meta={meta} value={st.instructors} extra={extraInstructors} onChange={(v) => set("instructors", v)} />
                </SaField>
              </div>
            </Section>

            <Section title="Workshop Enrolment">
              <div className="mh-sa__grid">
                <SaField label="Enrolment Cut-off" hint="optional">
                  <input className="mh-sa__input" type="datetime-local" value={st.enrolmentCutoff} onChange={(e) => set("enrolmentCutoff", e.target.value)} />
                </SaField>
                <SaField label="Workshop Roles">
                  <Select value={st.rolesMode} onChange={(v) => set("rolesMode", v)} options={meta?.options.roleModes ?? ["Disabled", "Enabled"]} />
                </SaField>
                <label className="mh-sa__field">
                  <span className="mh-sa__label">
                    <Req label="Maximum Enrolments" />
                  </span>
                  <input
                    className="mh-sa__input"
                    type="number"
                    min={1}
                    max={10000}
                    disabled={st.sameAsClassroom}
                    value={st.sameAsClassroom ? (room?.size ?? "") : st.maxEnrolments}
                    onChange={(e) => set("maxEnrolments", e.target.value)}
                  />
                  <span className="mh-sa__check">
                    <input type="checkbox" checked={st.sameAsClassroom} onChange={(e) => set("sameAsClassroom", e.target.checked)} />
                    Same as classroom size
                  </span>
                </label>
                <SaField label="Workshop Privacy">
                  <Select value={st.privacy} onChange={(v) => set("privacy", v)} options={meta?.options.privacy ?? ["Private Workshop", "Public Workshop"]} />
                </SaField>
                <SaField label="Enrolment Approval">
                  <Select value={st.approval} onChange={(v) => set("approval", v)} options={meta?.options.approval ?? ["Manual Decision", "Automatic Approval"]} />
                </SaField>
              </div>
              {st.rolesMode === "Enabled" ? (
                <div className="mh-sa__field">
                  <span className="mh-sa__label">
                    <Req label="Roles available in this workshop" />
                  </span>
                  {activeRoles.length ? (
                    <div className="wk-checks">
                      {activeRoles.map((r) => (
                        <label key={r.id} className="mh-sa__check">
                          <input
                            type="checkbox"
                            checked={st.roleIds.includes(r.id)}
                            onChange={(e) => set("roleIds", e.target.checked ? [...st.roleIds, r.id] : st.roleIds.filter((x) => x !== r.id))}
                          />
                          {r.name}
                          {r.status !== "Active" ? <span className="mh-sa__sub">(inactive)</span> : null}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="mh-sa__muted">
                      No workshop roles exist yet.{" "}
                      <Link className="mh-sa__link" href="/admin/workshop-roles/new">
                        Create a workshop role
                      </Link>
                    </span>
                  )}
                </div>
              ) : null}
              <p className="mh-sa__sub">
                {st.privacy === "Public Workshop" ? "Eligible students can enrol themselves from the student portal." : "Only administrators can enrol users into a private workshop."}
              </p>
            </Section>

            <Section title="Workshop Schedule">
              <div className="mh-sa__grid">
                <SaField label="Workshop Hours">
                  <input className="mh-sa__input" type="number" min={0} max={10000} step="0.25" value={st.hours} onChange={(e) => set("hours", e.target.value)} />
                </SaField>
                <div className="mh-sa__field mh-sa__field--end">
                  <label className="mh-sa__check">
                    <input type="checkbox" checked={st.continuous} onChange={(e) => set("continuous", e.target.checked)} />
                    This is a continuous feed-in workshop.
                  </label>
                </div>
                <label className="mh-sa__field">
                  <span className="mh-sa__label">
                    <Req label="Start Date" />
                  </span>
                  <input className="mh-sa__input" type="date" required value={st.startDate} onChange={(e) => set("startDate", e.target.value)} />
                </label>
                {!st.continuous ? (
                  <label className="mh-sa__field">
                    <span className="mh-sa__label">
                      <Req label="End Date" />
                    </span>
                    <input className="mh-sa__input" type="date" required min={st.startDate || undefined} value={st.endDate} onChange={(e) => set("endDate", e.target.value)} />
                  </label>
                ) : null}
                <SaField label="Schedule Type">
                  <Select value={st.scheduleType} onChange={(v) => set("scheduleType", v)} options={meta?.options.scheduleTypes ?? ["Weekly Schedule", "Daily Schedule"]} />
                </SaField>
              </div>
              {st.scheduleType === "Weekly Schedule" ? (
                <div className="wk-weekly">
                  {WEEKDAYS.map((day) => {
                    const s = st.sessions.find((x) => x.day === day);
                    return (
                      <div key={day} className="wk-weekly-row">
                        <label className="mh-sa__check">
                          <input type="checkbox" checked={Boolean(s)} onChange={(e) => toggleDay(day, e.target.checked)} />
                          {day}
                        </label>
                        {s ? (
                          <span className="mh-sa__inline">
                            <input className="mh-sa__input" type="time" aria-label={`${day} start time`} value={s.start} onChange={(e) => setTime(day, "start", e.target.value)} />
                            <span>to</span>
                            <input className="mh-sa__input" type="time" aria-label={`${day} end time`} value={s.end} onChange={(e) => setTime(day, "end", e.target.value)} />
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mh-sa__grid">
                  <SaField label="Daily Start Time">
                    <input className="mh-sa__input" type="time" value={st.dailyStart} onChange={(e) => set("dailyStart", e.target.value)} />
                  </SaField>
                  <SaField label="Daily End Time">
                    <input className="mh-sa__input" type="time" value={st.dailyEnd} onChange={(e) => set("dailyEnd", e.target.value)} />
                  </SaField>
                </div>
              )}
            </Section>

            <Section title="Workshop Fees">
              <div className="mh-sa__grid">
                <SaField label="Fee Collection">
                  <Select value={st.feeCollection} onChange={(v) => set("feeCollection", v)} options={meta?.options.feeCollection ?? ["Immediately", "Upon Approval", "Do Not Collect"]} />
                </SaField>
                <Money label="Workshop Default Fee" value={st.defaultFee} onChange={(v) => set("defaultFee", v)} />
                <Money label="Domestic" value={st.domesticFee} onChange={(v) => set("domesticFee", v)} />
                <Money label="International" value={st.internationalFee} onChange={(v) => set("internationalFee", v)} />
              </div>
              <p className="mh-sa__sub">The Domestic or International fee is charged according to the student&apos;s residency; the default fee applies when that fee is $0.00 or residency is unknown.</p>
            </Section>

            <Section title="Grading">
              <div className="mh-sa__grid">
                <SaField label="Grading Scheme">
                  <Select value={st.gradingScheme} onChange={(v) => set("gradingScheme", v)} options={meta?.gradingSchemes ?? ["None / Not Applicable"]} />
                </SaField>
              </div>
              {meta && meta.gradingSchemes.length <= 1 ? (
                <p className="mh-sa__sub">
                  No active grading schemes are configured. <Link href="/admin/course-management/grading">Manage Grading Schemes</Link>
                </p>
              ) : null}
            </Section>

            <Section title="Workshop Content">
              <div className="mh-sa__grid">
                <SaField label="Enable LMS">
                  <Select value={st.lms} onChange={(v) => set("lms", v)} options={meta?.options.lms ?? ["Disabled", "Enabled"]} />
                </SaField>
              </div>
            </Section>

            <Section title="Workshop Available To">
              <div className="mh-sa__grid">
                <SaField label="Campus Access">
                  <Select value={st.campusAccess} onChange={(v) => set("campusAccess", v)} options={meta?.campusAccess ?? ["All Campuses"]} />
                </SaField>
                <SaField label="Access Levels">
                  <Select value={st.accessLevels} onChange={(v) => set("accessLevels", v)} options={meta?.accessLevels ?? ["All Accesses"]} />
                </SaField>
              </div>
              <h3 className="ur-subhead">Student Access</h3>
              <div className="mh-sa__grid">
                <SaField label="Student Statuses">
                  <Select value={st.studentStatuses} onChange={(v) => set("studentStatuses", v)} options={meta?.studentStatuses ?? ["All Statuses"]} />
                </SaField>
                <SaField label="Program of Study">
                  <Select value={st.programOfStudy} onChange={(v) => set("programOfStudy", v)} options={meta?.programs ?? ["All Programs"]} />
                </SaField>
              </div>
            </Section>

            <Section title="Final Standing Settings">
              <div className="mh-sa__grid">
                <SaField label="Grades">
                  <Select value={st.grades} onChange={(v) => set("grades", v)} options={meta?.options.visibility ?? ["Visible", "Hidden"]} />
                </SaField>
                <SaField label="Badges">
                  <Select value={st.badges} onChange={(v) => set("badges", v)} options={meta?.options.visibility ?? ["Visible", "Hidden"]} />
                </SaField>
              </div>
            </Section>

            <div className="mh-sa__actions">
              <Link className="mh-sa__btn" href={id ? `/admin/workshops/manage/${id}` : "/admin/workshops/manage"}>
                Cancel
              </Link>
              <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
                {busy ? "Saving…" : "Save Workshop"}
              </button>
            </div>
          </form>
        )}
      </div>
    </SuperFrame>
  );
}
