"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AVAILABILITY_TYPES,
  WEEKDAYS,
  errorMessage,
  formatClock,
  isoDate,
  saApi,
  type AvailabilityRecord,
  type Contract,
  type FacultyProfile,
} from "@/lib/superAdmin";
import { ProfileCalendar, type SlotPick } from "./ProfileCalendar";
import { RichTextEditor, SaModal, SaNotice, SafeHtml, SuperFrame } from "./shared";

export type FacultyTab = "biography" | "topics" | "availability" | "compensation" | "schedule";

const TABS: Array<{ key: FacultyTab; label: string }> = [
  { key: "biography", label: "Biography" },
  { key: "topics", label: "Topics" },
  { key: "availability", label: "Availability" },
  { key: "compensation", label: "Compensation" },
  { key: "schedule", label: "Schedule" },
];

const SUCCESS = "Profile information updated successfully.";

type Patch = Record<string, unknown> & { section: string };

function useFacultyProfile(userId: string) {
  const [profile, setProfile] = useState<FacultyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setProfile(null);
    saApi<FacultyProfile>(`/faculty/${encodeURIComponent(userId)}`)
      .then(setProfile)
      .catch((err) => setError(errorMessage(err, "Could not load profile")));
  }, [userId]);

  const save = useCallback(
    async (patch: Patch) => {
      setError(null);
      const next = await saApi<FacultyProfile>(`/faculty/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setProfile(next);
      setNotice(SUCCESS);
      return next;
    },
    [userId],
  );

  return { profile, error, setError, notice, setNotice, save };
}

export function SuperFacultyProfile({ tab }: { tab: FacultyTab }) {
  const params = useSearchParams();
  const userId = params.get("user") || "me";
  const userQuery = userId === "me" ? "" : `?user=${encodeURIComponent(userId)}`;
  const { profile, error, setError, notice, setNotice, save } = useFacultyProfile(userId);
  const [photoOpen, setPhotoOpen] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice, setNotice]);

  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? "Biography";

  return (
    <SuperFrame breadcrumbs={["Home", "My Profile", tabLabel]} activeHref={`/admin/faculty-profile/${tab}`}>
      {notice ? <SaNotice tone="success" onClose={() => setNotice(null)}>{notice}</SaNotice> : null}
      {error ? <SaNotice tone="error" onClose={() => setError(null)}>{error}</SaNotice> : null}
      {!profile ? (
        !error ? <p className="mh-sa__muted">Loading profile…</p> : null
      ) : (
        <>
          <section className="mh-sa-fp__header">
            <button type="button" className="mh-sa-fp__photo" onClick={() => setPhotoOpen(true)} aria-label="Change profile photo">
              {profile.photo ? (
                <img src={profile.photo} alt={`${profile.name} profile photo`} />
              ) : (
                <span aria-hidden>
                  {profile.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
              )}
              <em>Change</em>
            </button>
            <div className="mh-sa-fp__identity">
              <h1>
                {profile.name}
                {profile.title ? <small>{profile.title}</small> : null}
              </h1>
              <p>{profile.department || "No department / area set"}</p>
              <p>
                <a href={`mailto:${profile.email}`}>{profile.email}</a>
              </p>
            </div>
            <span className={`mh-sa__pill mh-sa__pill--${profile.status === "Active" ? "ok" : "warn"}`}>{profile.status}</span>
          </section>

          <nav className="mh-sa-fp__tabs" aria-label="Profile sections">
            {TABS.map((t) => (
              <Link key={t.key} href={`/admin/faculty-profile/${t.key}${userQuery}`} className={t.key === tab ? "is-active" : ""}>
                {t.label}
              </Link>
            ))}
          </nav>

          <div className="mh-sa-fp__body">
            {tab === "biography" ? <BiographyTab profile={profile} save={save} onError={setError} /> : null}
            {tab === "topics" ? <TopicsTab profile={profile} /> : null}
            {tab === "availability" ? <AvailabilityTab profile={profile} save={save} onError={setError} /> : null}
            {tab === "compensation" ? <CompensationTab profile={profile} /> : null}
            {tab === "schedule" ? <ScheduleTab profile={profile} save={save} onError={setError} /> : null}
          </div>

          {photoOpen ? <PhotoModal current={profile.photo} onClose={() => setPhotoOpen(false)} save={save} onError={setError} /> : null}
        </>
      )}
    </SuperFrame>
  );
}

type SaveFn = (patch: Patch) => Promise<FacultyProfile>;

function SaveButton({ form, busy, label = "Save Content" }: { form: string; busy: boolean; label?: string }) {
  return (
    <button type="submit" form={form} className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
      {busy ? "Saving…" : label}
    </button>
  );
}

function useSubmit(save: SaveFn, onDone: () => void, onError: (msg: string) => void) {
  const [busy, setBusy] = useState(false);
  const submit = async (patch: Patch) => {
    setBusy(true);
    try {
      await save(patch);
      onDone();
    } catch (err) {
      onError(errorMessage(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  };
  return { busy, submit };
}

/* ------------------------------ Biography ------------------------------ */

function BiographyTab({ profile, save, onError }: { profile: FacultyProfile; save: SaveFn; onError: (m: string) => void }) {
  const [modal, setModal] = useState<"connect" | "education" | null>(null);
  return (
    <>
      <section className="mh-sa-fp__section">
        <div className="mh-sa-fp__section-head">
          <h2>CONNECT</h2>
          <button type="button" className="mh-sa__btn" onClick={() => setModal("connect")}>
            Edit
          </button>
        </div>
        <dl className="mh-sa__dl">
          <dt>Phone</dt>
          <dd>{profile.connect.phone || "—"}</dd>
          <dt>E-mail</dt>
          <dd>{profile.connect.email ? <a href={`mailto:${profile.connect.email}`}>{profile.connect.email}</a> : "—"}</dd>
        </dl>
      </section>

      <section className="mh-sa-fp__section">
        <div className="mh-sa-fp__section-head">
          <h2>EDUCATION / ACCREDITATION</h2>
          <button type="button" className="mh-sa__btn" onClick={() => setModal("education")}>
            Edit
          </button>
        </div>
        <h3>Education background</h3>
        <SafeHtml html={profile.education.background} />
        <h3>Summary of professional experience</h3>
        <SafeHtml html={profile.education.experience} />
        <h3>Membership in professional organizations</h3>
        <SafeHtml html={profile.education.organizations} />
      </section>

      {modal === "connect" ? <ConnectModal profile={profile} onClose={() => setModal(null)} save={save} onError={onError} /> : null}
      {modal === "education" ? <EducationModal profile={profile} onClose={() => setModal(null)} save={save} onError={onError} /> : null}
    </>
  );
}

function ConnectModal({ profile, onClose, save, onError }: { profile: FacultyProfile; onClose: () => void; save: SaveFn; onError: (m: string) => void }) {
  const [phone, setPhone] = useState(profile.connect.phone);
  const [email, setEmail] = useState(profile.connect.email);
  const { busy, submit } = useSubmit(save, onClose, onError);
  return (
    <SaModal title="CONNECT" onClose={onClose} footer={<SaveButton form="sa-connect" busy={busy} />}>
      <form
        id="sa-connect"
        className="mh-sa__form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit({ section: "connect", phone, email });
        }}
      >
        <label className="mh-sa__field">
          <span className="mh-sa__label">Phone</span>
          <input className="mh-sa__input" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
        </label>
        <label className="mh-sa__field">
          <span className="mh-sa__label">E-mail</span>
          <input className="mh-sa__input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </label>
      </form>
    </SaModal>
  );
}

function EducationModal({ profile, onClose, save, onError }: { profile: FacultyProfile; onClose: () => void; save: SaveFn; onError: (m: string) => void }) {
  const [background, setBackground] = useState(profile.education.background);
  const [experience, setExperience] = useState(profile.education.experience);
  const [organizations, setOrganizations] = useState(profile.education.organizations);
  const { busy, submit } = useSubmit(save, onClose, onError);
  return (
    <SaModal title="EDUCATION / ACCREDITATION" wide onClose={onClose} footer={<SaveButton form="sa-education" busy={busy} />}>
      <form
        id="sa-education"
        className="mh-sa__form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit({ section: "education", background, experience, organizations });
        }}
      >
        <div className="mh-sa__field">
          <span className="mh-sa__label">Education background</span>
          <RichTextEditor label="Education background" value={background} onChange={setBackground} />
        </div>
        <div className="mh-sa__field">
          <span className="mh-sa__label">Summary of professional experience</span>
          <RichTextEditor label="Summary of professional experience" value={experience} onChange={setExperience} />
        </div>
        <div className="mh-sa__field">
          <span className="mh-sa__label">Membership in professional organizations</span>
          <RichTextEditor label="Membership in professional organizations" value={organizations} onChange={setOrganizations} />
        </div>
      </form>
    </SaModal>
  );
}

/* ------------------------------ Topics ------------------------------ */

function SimpleList({ items }: { items: string[] }) {
  if (!items.length) return <p className="mh-sa__empty">No content available.</p>;
  return (
    <ul className="mh-sa__list">
      {items.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ul>
  );
}

function TopicsTab({ profile }: { profile: FacultyProfile }) {
  const t = profile.topics;
  return (
    <>
      <div className="mh-sa-fp__split">
        <div>
          <section className="mh-sa-fp__section">
            <h2>CURRENT COURSES</h2>
            <SimpleList items={t.currentCourses} />
          </section>
          <section className="mh-sa-fp__section">
            <h2>PREVIOUS COURSES TAUGHT</h2>
            <SimpleList items={t.previousCourses} />
          </section>
        </div>
        <div>
          <section className="mh-sa-fp__section">
            <h2>ACADEMIC CHAIR</h2>
            {t.academicChair ? <p>{t.academicChair}</p> : <p className="mh-sa__empty">No content available.</p>}
          </section>
          <section className="mh-sa-fp__section">
            <h2>ACADEMIC LEAD</h2>
            {t.academicLead ? <p>{t.academicLead}</p> : <p className="mh-sa__empty">No content available.</p>}
          </section>
        </div>
      </div>
      <section className="mh-sa-fp__section">
        <h2>CURRENT TEACHING SCHEDULE</h2>
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Delivery Method</th>
                <th>Location</th>
                <th>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {t.teachingSchedule.length ? (
                t.teachingSchedule.map((row) => (
                  <tr key={row.sectionId}>
                    <td>{row.course}</td>
                    <td>{row.deliveryMethod}</td>
                    <td>{row.location}</td>
                    <td className="mh-sa__pre">{row.schedule}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="mh-sa__empty-cell">
                    No courses were found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ------------------------------ Availability ------------------------------ */

function RichSectionModal({
  title,
  section,
  value,
  onClose,
  save,
  onError,
}: {
  title: string;
  section: "officeHours" | "generalInfo";
  value: string;
  onClose: () => void;
  save: SaveFn;
  onError: (m: string) => void;
}) {
  const [content, setContent] = useState(value);
  const { busy, submit } = useSubmit(save, onClose, onError);
  return (
    <SaModal title={title} wide onClose={onClose} footer={<SaveButton form={`sa-${section}`} busy={busy} />}>
      <form
        id={`sa-${section}`}
        className="mh-sa__form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit({ section, content });
        }}
      >
        <div className="mh-sa__field">
          <span className="mh-sa__label">Content</span>
          <RichTextEditor label={title} value={content} onChange={setContent} />
        </div>
      </form>
    </SaModal>
  );
}

function hasContent(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

function AvailabilityTab({ profile, save, onError }: { profile: FacultyProfile; save: SaveFn; onError: (m: string) => void }) {
  const [modal, setModal] = useState<"officeHours" | "generalInfo" | null>(null);
  const [editing, setEditing] = useState<AvailabilityRecord | "new" | null>(null);
  const [slot, setSlot] = useState<SlotPick | null>(null);
  const openNew = (pick: SlotPick | null = null) => {
    setSlot(pick);
    setEditing("new");
  };

  return (
    <>
      <section className="mh-sa-fp__section">
        <div className="mh-sa-fp__section-head">
          <h2>REGULAR OFFICE HOURS</h2>
          <button type="button" className="mh-sa__btn" onClick={() => setModal("officeHours")}>
            Edit
          </button>
        </div>
        <SafeHtml html={profile.officeHours} />
      </section>

      <section className="mh-sa-fp__section">
        <div className="mh-sa-fp__section-head">
          <h2>GENERAL INFORMATION</h2>
          <button type="button" className="mh-sa__btn" onClick={() => setModal("generalInfo")}>
            {hasContent(profile.generalInfo) ? "Edit" : "Add"}
          </button>
        </div>
        <SafeHtml html={profile.generalInfo} />
      </section>

      <section className="mh-sa-fp__section">
        <div className="mh-sa-fp__section-head">
          <h2>AVAILABILITY</h2>
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => openNew()}>
            + Add
          </button>
        </div>
        {profile.availability.length ? (
          <ul className="mh-sa-fp__avail-list">
                {profile.availability
                  .slice()
                  .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.startTime.localeCompare(b.startTime))
                  .map((rec) => (
                    <li key={rec.id}>
                      <button type="button" onClick={() => setEditing(rec)}>
                        <strong>{rec.title || rec.type}</strong>
                        <span>
                          {formatClock(rec.startTime)} – {formatClock(rec.endTime)} · {rec.type}
                        </span>
                        <span>
                          {rec.recurring ? `${rec.startDate} → ${rec.endDate} · ${rec.days.join(", ")}` : rec.startDate}
                        </span>
                      </button>
                    </li>
                  ))}
          </ul>
        ) : (
          <p className="mh-sa__empty">No availability records yet.</p>
        )}
        <ProfileCalendar mode="month" records={profile.availability} onPick={openNew} onOpen={setEditing} />
      </section>

      {modal === "officeHours" ? (
        <RichSectionModal title="REGULAR OFFICE HOURS" section="officeHours" value={profile.officeHours} onClose={() => setModal(null)} save={save} onError={onError} />
      ) : null}
      {modal === "generalInfo" ? (
        <RichSectionModal title="GENERAL INFORMATION" section="generalInfo" value={profile.generalInfo} onClose={() => setModal(null)} save={save} onError={onError} />
      ) : null}
      {editing ? (
        <AvailabilityModal
          record={editing === "new" ? null : editing}
          slot={editing === "new" ? slot : null}
          onClose={() => setEditing(null)}
          save={save}
          onError={onError}
        />
      ) : null}
    </>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const WORKWEEK = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function TimePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(":");
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();
  return (
    <span className="mh-sa-fp__time" role="group" aria-label={label}>
      <select className="mh-sa__input" aria-label={`${label} hour`} value={h} onChange={(e) => onChange(`${e.target.value}:${m}`)}>
        {HOURS.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <b>:</b>
      <select className="mh-sa__input" aria-label={`${label} minute`} value={m} onChange={(e) => onChange(`${h}:${e.target.value}`)}>
        {minutes.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </span>
  );
}

function plusDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function AvailabilityModal({
  record,
  onClose,
  save,
  onError,
  slot,
  heading = "AVAILABILITY",
}: {
  record: AvailabilityRecord | null;
  onClose: () => void;
  save: SaveFn;
  onError: (m: string) => void;
  slot?: SlotPick | null;
  heading?: string;
}) {
  const today = slot?.date ?? isoDate(new Date());
  const [title, setTitle] = useState(record?.title ?? "");
  const [type, setType] = useState(record?.type ?? AVAILABILITY_TYPES[0]);
  const [startTime, setStartTime] = useState(record?.startTime ?? slot?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(record?.endTime ?? slot?.endTime ?? "10:00");
  const [startDate, setStartDate] = useState(record?.startDate ?? today);
  const [recurring, setRecurring] = useState(record ? record.recurring : !slot);
  const [endDate, setEndDate] = useState(record?.endDate || plusDays(record?.startDate ?? today, 7));
  const [days, setDays] = useState<string[]>(() => {
    if (record?.days?.length) return record.days;
    if (slot) return [WEEKDAYS[new Date(`${slot.date}T12:00:00`).getDay()]];
    return WORKWEEK;
  });
  const [note, setNote] = useState(record?.note ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const { busy, submit } = useSubmit(save, onClose, (m) => setLocalError(m));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const s = startTime;
    const en = endTime;
    if (en <= s) {
      setLocalError("End time must be after start time.");
      return;
    }
    if (recurring && !days.length) {
      setLocalError("Pick at least one day of the week.");
      return;
    }
    void submit({
      section: "availability.upsert",
      record: {
        ...(record ? { id: record.id } : {}),
        title,
        type,
        startTime: s,
        endTime: en,
        startDate,
        recurring,
        endDate: recurring ? endDate : "",
        days: recurring ? days : [],
        note,
      },
    });
  }

  async function onDelete() {
    if (!record || !window.confirm("Delete this availability record?")) return;
    try {
      await save({ section: "availability.delete", id: record.id });
      onClose();
    } catch (err) {
      onError(errorMessage(err, "Delete failed"));
    }
  }

  return (
    <SaModal
      title={heading}
      onClose={onClose}
      footer={
        <>
          {record ? (
            <button type="button" className="mh-sa__btn mh-sa__btn--danger" onClick={onDelete}>
              Delete
            </button>
          ) : null}
          <button type="button" className="mh-sa__btn" onClick={onClose}>
            Close
          </button>
          <SaveButton form="sa-availability" busy={busy} label={record ? "Save Availability" : "Add Availability"} />
        </>
      }
    >
      <form id="sa-availability" className="mh-sa__form" onSubmit={onSubmit}>
        {localError ? <SaNotice tone="error">{localError}</SaNotice> : null}
        <label className="mh-sa__field">
          <span className="mh-sa__label">
            Title / Name <em>Optional</em>
          </span>
          <input className="mh-sa__input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </label>
        <label className="mh-sa__field">
          <span className="mh-sa__label">Type</span>
          <select className="mh-sa__input" value={type} onChange={(e) => setType(e.target.value)}>
            {AVAILABILITY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="mh-sa__field">
          <span className="mh-sa__label">Times</span>
          <div className="mh-sa-fp__times">
            <TimePicker label="Start time" value={startTime} onChange={setStartTime} />
            <span>to</span>
            <TimePicker label="End time" value={endTime} onChange={setEndTime} />
          </div>
        </div>
        <label className="mh-sa__field">
          <span className="mh-sa__label">Date</span>
          <input className="mh-sa__input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label className="mh-sa__check">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          Set availability recurrence timeframe
        </label>
        <fieldset className="mh-sa-fp__recur" disabled={!recurring}>
          <label className="mh-sa__field">
            <span className="mh-sa__label">End Date</span>
            <input className="mh-sa__input" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required={recurring} />
          </label>
          <div className="mh-sa__field">
            <span className="mh-sa__label">Days of the Week</span>
            <div className="mh-sa-fp__days">
              {WEEKDAYS.map((d) => (
                <label key={d} className={`mh-sa-fp__day${recurring && days.includes(d) ? " is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={days.includes(d)}
                    onChange={(e) => setDays((cur) => (e.target.checked ? [...cur, d] : cur.filter((x) => x !== d)))}
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>
          {!recurring ? <p className="mh-sa__muted">Tick “Set availability recurrence timeframe” to repeat on these days until the end date.</p> : null}
        </fieldset>
        <label className="mh-sa__field">
          <span className="mh-sa__label">Note</span>
          <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
        </label>
      </form>
    </SaModal>
  );
}

/* ------------------------------ Compensation ------------------------------ */

function ContractTable({ rows }: { rows: Contract[] }) {
  return (
    <div className="mh-sa__table-wrap">
      <table className="mh-sa__table">
        <thead>
          <tr>
            <th>Contract</th>
            <th>Compensation</th>
            <th>Requirements</th>
            <th>Earnings</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={`${r.contract}-${i}`}>
                <td>{r.contract}</td>
                <td>{r.compensation}</td>
                <td>{r.requirements}</td>
                <td>{r.earnings}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="mh-sa__empty-cell">
                No contracts found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CompensationTab({ profile }: { profile: FacultyProfile }) {
  return (
    <>
      <section className="mh-sa-fp__section">
        <h2>PREVIOUS CONTRACTS</h2>
        <ContractTable rows={profile.contracts.previous} />
      </section>
      <section className="mh-sa-fp__section">
        <h2>CURRENT CONTRACT</h2>
        <ContractTable rows={profile.contracts.current} />
      </section>
    </>
  );
}

/* ------------------------------ Schedule ------------------------------ */

function ScheduleTab({ profile, save, onError }: { profile: FacultyProfile; save: SaveFn; onError: (m: string) => void }) {
  const [editing, setEditing] = useState<AvailabilityRecord | "new" | null>(null);
  const [slot, setSlot] = useState<SlotPick | null>(null);
  const openNew = (pick: SlotPick | null = null) => {
    setSlot(pick);
    setEditing("new");
  };

  return (
    <section className="mh-sa-fp__section">
      <ProfileCalendar
        mode="week"
        records={profile.availability}
        sessions={profile.topics.teachingSessions ?? []}
        onPick={openNew}
        onOpen={setEditing}
        heading={<h2>CURRENT TEACHING SCHEDULE</h2>}
        actions={
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => openNew()}>
            + Add
          </button>
        }
      />
      {editing ? (
        <AvailabilityModal
          heading="SCHEDULE"
          record={editing === "new" ? null : editing}
          slot={editing === "new" ? slot : null}
          onClose={() => setEditing(null)}
          save={save}
          onError={onError}
        />
      ) : null}
    </section>
  );
}

/* ------------------------------ Photo ------------------------------ */

async function fileToDataUrl(blob: Blob, size = 320): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file is not a readable image."));
      el.src = url;
    });
    return drawSquare(img, img.naturalWidth, img.naturalHeight, size);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawSquare(source: CanvasImageSource, w: number, h: number, size = 320) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  const side = Math.min(w, h);
  ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function PhotoModal({
  current,
  onClose,
  save,
  onError,
}: {
  current: string | null;
  onClose: () => void;
  save: SaveFn;
  onError: (m: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { busy, submit } = useSubmit(save, onClose, onError);
  const canCapture = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    if (videoRef.current && camera) videoRef.current.srcObject = camera;
    return () => camera?.getTracks().forEach((t) => t.stop());
  }, [camera]);

  async function accept(file: File | undefined) {
    setLocalError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      setLocalError("Please choose a PNG, JPEG, WebP or GIF image.");
      return;
    }
    try {
      setPreview(await fileToDataUrl(file));
    } catch (err) {
      setLocalError(errorMessage(err));
    }
  }

  async function startCamera() {
    setLocalError(null);
    try {
      setCamera(await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } }));
    } catch {
      setLocalError("Camera is unavailable or permission was denied.");
    }
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setPreview(drawSquare(v, v.videoWidth, v.videoHeight));
    camera?.getTracks().forEach((t) => t.stop());
    setCamera(null);
  }

  return (
    <SaModal
      title="PROFILE PHOTO"
      onClose={onClose}
      footer={
        <>
          {current && !preview ? (
            <button type="button" className="mh-sa__btn mh-sa__btn--danger" disabled={busy} onClick={() => void submit({ section: "photo", photo: null })}>
              Remove Photo
            </button>
          ) : null}
          <button type="button" className="mh-sa__btn" onClick={onClose}>
            Close
          </button>
          {preview ? (
            <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={() => void submit({ section: "photo", photo: preview })}>
              {busy ? "Saving…" : "Save Photo"}
            </button>
          ) : null}
        </>
      }
    >
      {localError ? <SaNotice tone="error">{localError}</SaNotice> : null}
      {camera ? (
        <div className="mh-sa-photo__camera">
          <video ref={videoRef} autoPlay playsInline muted />
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={capture}>
            Capture
          </button>
        </div>
      ) : (
        <div
          className={`mh-sa-photo__drop${dragging ? " is-drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void accept(e.dataTransfer.files?.[0]);
          }}
        >
          {preview || current ? (
            <img src={preview || current || ""} alt="Profile photo preview" />
          ) : (
            <p>Drag photo into box</p>
          )}
        </div>
      )}
      <div className="mh-sa-photo__actions">
        <button type="button" className="mh-sa__btn" onClick={() => fileRef.current?.click()}>
          Upload Photo
        </button>
        {canCapture ? (
          <button type="button" className="mh-sa__btn" onClick={startCamera} disabled={Boolean(camera)}>
            Take Photo
          </button>
        ) : null}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => void accept(e.target.files?.[0])} />
      </div>
      <p className="mh-sa__muted">Browse your computer, or take a photo if a webcam is available.</p>
    </SaModal>
  );
}
