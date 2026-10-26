"use client";

import "../superadmin/superadmin.css";
import "./programs.css";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { SaModal } from "@/components/superadmin/shared";
import { StatementEditor, errMsg, str } from "@/components/location/shared";
import { api, loadSession } from "@/lib/api";

export { errMsg, str };

/* ------------------------------------------------------------------ */
/* Types + API                                                          */
/* ------------------------------------------------------------------ */

export type Kind = "text" | "textarea" | "html" | "number" | "date" | "datetime" | "select" | "bool" | "multi" | "ref" | "refMulti" | "person" | "people" | "weekly" | "rows";
export type RefTarget = "faculties" | "programTypes" | "programs" | "terms" | "tiers" | "electiveGroups" | "feeTerms" | "scheduleFeeTerms" | "schedules" | "course" | "classroom";
export type Field = {
  key: string;
  label: string;
  kind: Kind;
  required?: boolean;
  options?: string[];
  dyn?: string;
  dynExtra?: string[];
  ref?: RefTarget;
  min?: number;
  max?: number;
  integer?: boolean;
  dflt?: unknown;
  when?: { key: string; equals: string | boolean | string[]; not?: boolean };
  section?: string;
  group?: string;
  sub?: string;
  suffix?: string;
  hint?: string;
  lang?: boolean;
  placeholder?: string;
  rowFields?: Field[];
};
export type Opt = { id: string; label: string };
export type Classroom = { id: string; name: string; campus: string; size: number; label: string };
export type Meta = {
  entities: Record<string, { label: string; fields: Field[] }>;
  lists: Record<string, string[]>;
  faculties: Array<Opt & { active: string }>;
  programTypes: Array<Opt & { active: string }>;
  programs: Array<Opt & { abbreviation: string; facultyId: string; scheduleType: string; active: string }>;
  terms: Array<Opt & { abbreviation: string; startDate: string; endDate: string }>;
  schedules: Opt[];
  classrooms: Classroom[];
  courses: Array<Opt & { code: string; title: string; credits: number }>;
  staff: Opt[];
  holidays: Array<{ name: string; date: string }>;
  weekdays: string[];
  bulkCategories: string[];
  passFailRows: Array<{ letter: string; credit: string; condition: string }>;
};
export type Data = Record<string, unknown>;
export type Row = Data & { id: string; parentId: string; updatedAt?: string };
export type Listing<T = Row> = { items: T[]; total: number };
export type Saved = { ok: boolean; id?: string; message: string };
export type Refs = Partial<Record<RefTarget, Opt[]>>;

let metaCache: Promise<Meta> | null = null;

export function pm<T>(path: string, init?: RequestInit) {
  if (init?.method && init.method !== "GET") metaCache = null;
  return api<T>(`/admin/heritage/programs${path}`, init ?? {}, loadSession()?.accessToken);
}
export const send = <T = Saved,>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) => pm<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    metaCache ??= pm<Meta>("/meta");
    metaCache
      .then((m) => live && setMeta(m))
      .catch((e) => {
        metaCache = null;
        if (live) setError(errMsg(e, "Could not load Program Management"));
      });
    return () => {
      live = false;
    };
  }, [tick]);
  const reload = useCallback(() => {
    metaCache = null;
    setTick((t) => t + 1);
  }, []);
  return { meta, error, reload };
}

export const BASE = "/admin/program-management";
export const money = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : `$${Number(v).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const fmtDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
};
export const fmtRange = (a: string, b: string) => (a || b ? `${fmtDate(a) || "—"} – ${fmtDate(b) || "—"}` : "Dates not set");
export const fmtStamp = (iso: string) => new Date(iso).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  if (h === undefined || Number.isNaN(h)) return t;
  return `${((h + 11) % 12) + 1}:${String(m ?? 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
export const cap = (s: string) => s.replace(/^\w/, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ */
/* Field logic                                                          */
/* ------------------------------------------------------------------ */

export function applies(f: Field, values: Data) {
  if (!f.when) return true;
  const v = values[f.when.key];
  const hit = Array.isArray(f.when.equals) ? f.when.equals.includes(v as string) : v === f.when.equals;
  return f.when.not ? !hit : hit;
}

function emptyOf(f: Field): unknown {
  if (f.kind === "bool") return false;
  if (["multi", "refMulti", "people", "rows"].includes(f.kind)) return [];
  if (f.kind === "weekly") return {};
  if (f.kind === "number") return null;
  return "";
}

export function initialValues(fields: Field[], base?: Data): Data {
  const out: Data = {};
  for (const f of fields) out[f.key] = base && f.key in base ? base[f.key] : f.dflt !== undefined ? f.dflt : emptyOf(f);
  return out;
}

/** Client-side mirror of the server's required checks so users get instant feedback. */
export function missingRequired(fields: Field[], values: Data) {
  return fields
    .filter((f) => f.required && applies(f, values))
    .filter((f) => {
      const v = values[f.key];
      if (Array.isArray(v)) return v.length === 0;
      return v === null || v === undefined || String(v).trim() === "";
    })
    .map((f) => f.label);
}

export function optionsFor(f: Field, meta: Meta) {
  return [...new Set([...(f.dynExtra ?? []), ...(f.options ?? (f.dyn ? (meta.lists[f.dyn] ?? []) : []))])];
}

export function refOptions(target: RefTarget, meta: Meta, refs?: Refs): Opt[] {
  if (refs?.[target]) return refs[target]!;
  switch (target) {
    case "faculties":
      return meta.faculties;
    case "programTypes":
      return meta.programTypes;
    case "programs":
      return meta.programs.map((p) => ({ id: p.id, label: p.label }));
    case "terms":
      return meta.terms.map((t) => ({ id: t.id, label: `${t.label} (${fmtRange(t.startDate, t.endDate)})` }));
    case "schedules":
      return meta.schedules;
    case "course":
      return meta.courses;
    case "classroom":
      return meta.classrooms.map((c) => ({ id: c.id, label: c.campus ? `${c.campus}: ${c.label}` : c.label }));
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/* Controls                                                             */
/* ------------------------------------------------------------------ */

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
type Weekly = Record<string, { start: string; end: string }>;

function TimePick({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [h = "09", m = "00"] = value.split(":");
  return (
    <span className="pm-time">
      <select className="mh-sa__input" aria-label={`${label} hour`} value={h} onChange={(e) => onChange(`${e.target.value}:${m}`)}>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      :
      <select className="mh-sa__input" aria-label={`${label} minute`} value={MINUTES.includes(m) ? m : "00"} onChange={(e) => onChange(`${h}:${e.target.value}`)}>
        {MINUTES.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </span>
  );
}

export function WeeklyEditor({ value, onChange, weekdays }: { value: unknown; onChange: (v: Weekly) => void; weekdays: string[] }) {
  const w = (value && typeof value === "object" ? value : {}) as Weekly;
  const set = (day: string, next: { start: string; end: string } | null) => {
    const copy = { ...w };
    if (next) copy[day] = next;
    else delete copy[day];
    onChange(copy);
  };
  return (
    <div className="pm-weekly">
      <div className="pm-weekly__days">
        {weekdays.map((d) => (
          <label key={d} className="mh-sa__check">
            <input type="checkbox" checked={Boolean(w[d])} onChange={(e) => set(d, e.target.checked ? { start: "09:00", end: "10:00" } : null)} /> {d}
          </label>
        ))}
      </div>
      {weekdays
        .filter((d) => w[d])
        .map((d) => (
          <div key={d} className="pm-weekly__row">
            <strong>{d}</strong>
            <span className="mh-sa__muted">Start</span>
            <TimePick label={`${d} start`} value={w[d]!.start || "09:00"} onChange={(v) => set(d, { ...w[d]!, start: v })} />
            <span className="mh-sa__muted">Finish</span>
            <TimePick label={`${d} finish`} value={w[d]!.end || "10:00"} onChange={(v) => set(d, { ...w[d]!, end: v })} />
          </div>
        ))}
    </div>
  );
}

export function weeklyText(value: unknown) {
  const w = (value && typeof value === "object" ? value : {}) as Weekly;
  const days = Object.entries(w).filter(([, t]) => t?.start && t?.end);
  return days.length ? days.map(([d, t]) => `${d.slice(0, 3)} ${fmtTime(t.start)}–${fmtTime(t.end)}`).join(", ") : "TBD";
}

function PeoplePicker({ value, onChange, options, single, label, placeholder }: { value: unknown; onChange: (v: unknown) => void; options: Opt[]; single?: boolean; label: string; placeholder?: string }) {
  const ids = single ? (str(value) ? [str(value)] : []) : Array.isArray(value) ? (value as string[]) : [];
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const name = (id: string) => options.find((o) => o.id === id)?.label ?? "(user removed)";
  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    const available = options.filter((o) => !ids.includes(o.id));
    if (!n) return available.slice(0, 20);
    return available
      .filter((o) => o.label.toLowerCase().includes(n))
      .sort((a, b) => Number(!a.label.toLowerCase().startsWith(n)) - Number(!b.label.toLowerCase().startsWith(n)) || a.label.localeCompare(b.label))
      .slice(0, 100);
  }, [q, options, ids]);
  const pick = (id: string) => {
    onChange(single ? id : [...ids, id]);
    setQ("");
    setOpen(false);
  };
  return (
    <div className="pm-people">
      {ids.length ? (
        <div className="pm-chips">
          {ids.map((id) => (
            <span key={id} className="pm-chip">
              {name(id)}
              <button type="button" aria-label={`Remove ${name(id)}`} onClick={() => onChange(single ? "" : ids.filter((x) => x !== id))}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {single && ids.length ? null : (
        <div className="pm-people__box">
          <input
            className="mh-sa__input"
            aria-label={label}
            placeholder={placeholder ?? "Start typing the user's name"}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits[0]) {
                e.preventDefault();
                pick(hits[0].id);
              }
            }}
          />
          {open && hits.length ? (
            <ul className="pm-people__menu" role="listbox">
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h.id)}>
                    {h.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : open && q.trim() ? (
            <div className="pm-people__menu pm-people__none">No matching users</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ProgramChecks({ value, onChange, meta }: { value: unknown; onChange: (v: string[]) => void; meta: Meta }) {
  const ids = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div className="pm-faculty-checks">
      {meta.faculties.map((f) => {
        const progs = meta.programs.filter((p) => p.facultyId === f.id);
        if (!progs.length) return null;
        return (
          <fieldset key={f.id}>
            <legend>{f.label}</legend>
            {progs.map((p) => (
              <label key={p.id} className="mh-sa__check">
                <input type="checkbox" checked={ids.includes(p.id)} onChange={(e) => onChange(e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id))} /> {p.label}
                {p.abbreviation ? <span className="mh-sa__muted"> ({p.abbreviation})</span> : null}
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

export function FieldControl({ field: f, value, values, onChange, meta, refs, bare }: { field: Field; value: unknown; values: Data; onChange: (v: unknown) => void; meta: Meta; refs?: Refs; bare?: boolean }) {
  const id = `pm-${f.key}`;
  let control: ReactNode;
  switch (f.kind) {
    case "textarea":
      control = <textarea id={id} className="mh-sa__input" rows={4} value={str(value)} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "number":
      control = (
        <span className="lx-num">
          <input
            id={id}
            className="mh-sa__input"
            type="number"
            inputMode={f.integer ? "numeric" : "decimal"}
            step={f.integer ? 1 : "any"}
            min={f.min}
            max={f.max}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          />
          {f.suffix ? <span className="lx-num__suffix">{f.suffix}</span> : null}
        </span>
      );
      break;
    case "date":
      control = <input id={id} className="mh-sa__input" type="date" value={str(value)} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "datetime":
      control = <input id={id} className="mh-sa__input" type="datetime-local" value={str(value).slice(0, 16)} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "select": {
      const opts = optionsFor(f, meta);
      const v = str(value);
      control = (
        <span className="lx-num">
          <select id={id} className="mh-sa__input" value={v} onChange={(e) => onChange(e.target.value)}>
            {!f.required || !v ? <option value="">{f.required ? "— Select —" : "— None —"}</option> : null}
            {v && !opts.includes(v) ? <option value={v}>{v}</option> : null}
            {opts.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {f.suffix ? <span className="lx-num__suffix">{f.suffix}</span> : null}
        </span>
      );
      break;
    }
    case "ref": {
      let opts = refOptions(f.ref!, meta, refs);
      if (f.ref === "classroom" && str(values.campus) && values.campus !== "Not Set") opts = meta.classrooms.filter((c) => c.campus === values.campus).map((c) => ({ id: c.id, label: c.label }));
      const v = str(value);
      control = (
        <select id={id} className="mh-sa__input" value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">{f.placeholder ?? (f.required ? "— Select —" : "— None —")}</option>
          {v && !opts.some((o) => o.id === v) ? <option value={v}>(no longer available)</option> : null}
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "bool":
      control = (
        <label className="mh-sa__check">
          <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {f.label}
        </label>
      );
      break;
    case "multi": {
      const opts = optionsFor(f, meta);
      const arr = Array.isArray(value) ? (value as string[]) : [];
      control = opts.length ? (
        <div className="lx-checks">
          {opts.map((o) => (
            <label key={o} className="mh-sa__check">
              <input type="checkbox" checked={arr.includes(o)} onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} /> {o}
            </label>
          ))}
        </div>
      ) : (
        <p className="mh-sa__muted">No options available yet.</p>
      );
      break;
    }
    case "refMulti":
      control = f.ref === "programs" ? <ProgramChecks value={value} onChange={onChange} meta={meta} /> : null;
      break;
    case "person":
    case "people":
      control = <PeoplePicker value={value} onChange={onChange} options={meta.staff} single={f.kind === "person"} label={f.label} placeholder={f.placeholder} />;
      break;
    case "weekly":
      control = <WeeklyEditor value={value} onChange={onChange} weekdays={meta.weekdays} />;
      break;
    case "html":
      control = <StatementEditor value={str(value)} onChange={(v) => onChange(v)} label={f.label} />;
      break;
    case "rows":
      return null;
    default:
      control = <input id={id} className="mh-sa__input" type="text" value={str(value)} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  if (bare || f.kind === "bool") return <>{control}</>;
  const wide = ["textarea", "html", "multi", "refMulti", "weekly", "people"].includes(f.kind);
  return (
    <div className={`mh-sa__field${wide ? " mh-sa__field--wide" : ""}`}>
      <label className="mh-sa__label" htmlFor={id}>
        {f.label}
        {f.required ? <span className="lx-req">*</span> : null}
      </label>
      {control}
      {f.lang ? <span className="lx-lang">English</span> : null}
      {f.hint ? <span className="lx-hint">{f.hint}</span> : null}
    </div>
  );
}

/** Renders a list of fields, honouring conditional `when` rules and paired `group` controls. */
export function FieldGrid({ fields, values, setValue, meta, refs }: { fields: Field[]; values: Data; setValue: (k: string, v: unknown) => void; meta: Meta; refs?: Refs }) {
  const out: ReactNode[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    if (!applies(f, values) || f.kind === "rows") continue;
    if (f.group) {
      if (seen.has(f.group)) continue;
      seen.add(f.group);
      const members = fields.filter((x) => x.group === f.group && applies(x, values));
      out.push(
        <div key={f.group} className="mh-sa__field lx-group">
          <span className="mh-sa__label">
            {f.group}
            {members.some((m) => m.required) ? <span className="lx-req">*</span> : null}
          </span>
          <div className="lx-group__row">
            {members.map((m) => (
              <label key={m.key} className="lx-group__item">
                <span className="lx-group__sub">{m.sub}</span>
                <FieldControl field={m} value={values[m.key]} values={values} onChange={(v) => setValue(m.key, v)} meta={meta} refs={refs} bare />
              </label>
            ))}
          </div>
        </div>,
      );
      continue;
    }
    out.push(<FieldControl key={f.key} field={f} value={values[f.key]} values={values} onChange={(v) => setValue(f.key, v)} meta={meta} refs={refs} />);
  }
  return <div className="mh-sa__grid lx-grid">{out}</div>;
}

export function sectionsOf(fields: Field[]) {
  const order: string[] = [];
  for (const f of fields) if (f.section && !order.includes(f.section)) order.push(f.section);
  return order.map((name) => ({ name, fields: fields.filter((f) => f.section === name) }));
}

/** One card per field section; fields without a section go into a leading untitled card. */
export function Sections({ fields, values, setValue, meta, refs, after }: { fields: Field[]; values: Data; setValue: (k: string, v: unknown) => void; meta: Meta; refs?: Refs; after?: Record<string, ReactNode> }) {
  const loose = fields.filter((f) => !f.section && f.kind !== "rows");
  return (
    <>
      {loose.length ? (
        <section className="mh-sa__card">
          <FieldGrid fields={loose} values={values} setValue={setValue} meta={meta} refs={refs} />
        </section>
      ) : null}
      {sectionsOf(fields).map((sec) => (
        <section key={sec.name} className="mh-sa__card">
          <div className="mh-sa__card-head">
            <h2>{sec.name}</h2>
          </div>
          <FieldGrid fields={sec.fields} values={values} setValue={setValue} meta={meta} refs={refs} />
          {after?.[sec.name] ?? null}
        </section>
      ))}
    </>
  );
}

/** Lays out named groups of field keys as cards (for screens whose sections differ from the stored field sections). */
export function Layout({
  groups,
  fields,
  values,
  setValue,
  meta,
  refs,
  flat,
  after,
}: {
  groups: Array<[string, string[]]>;
  fields: Field[];
  values: Data;
  setValue: (k: string, v: unknown) => void;
  meta: Meta;
  refs?: Refs;
  flat?: boolean;
  after?: Record<string, ReactNode>;
}) {
  return (
    <>
      {groups.map(([title, keys]) => {
        const fs = keys.map((k) => fields.find((f) => f.key === k)).filter(Boolean) as Field[];
        const body = <FieldGrid fields={fs} values={values} setValue={setValue} meta={meta} refs={refs} />;
        return flat ? (
          <div key={title} className="pm-modal-section">
            <h3>{title}</h3>
            {body}
          </div>
        ) : (
          <section key={title} className="mh-sa__card">
            <div className="mh-sa__card-head">
              <h2>{title}</h2>
            </div>
            {body}
            {after?.[title] ?? null}
          </section>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Entity form hook                                                     */
/* ------------------------------------------------------------------ */

export type EntityForm = {
  meta: Meta | null;
  metaError: string | null;
  loadError: string | null;
  fields: Field[];
  values: Data | null;
  record: Row | null;
  dirty: boolean;
  busy: boolean;
  setValue: (k: string, v: unknown) => void;
  save: (extra?: Data, fieldsToCheck?: Field[]) => Promise<Saved>;
};

export function useEntityForm(entity: string, id: string | null, opts: { parentId?: string; defaults?: Data } = {}): EntityForm {
  const { meta, error: metaError } = useMeta();
  const fields = useMemo(() => meta?.entities[entity]?.fields ?? [], [meta, entity]);
  const [values, setValues] = useState<Data | null>(null);
  const [record, setRecord] = useState<Row | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const snapshot = useRef("");
  const defaults = useRef(opts.defaults);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!meta || !fields.length) return;
    const key = `${entity}:${id ?? "new"}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    if (id) {
      setValues(null);
      void pm<Row>(`/e/${entity}/${id}`)
        .then((r) => {
          const v = initialValues(fields, r);
          snapshot.current = JSON.stringify(v);
          setRecord(r);
          setValues(v);
        })
        .catch((e) => setLoadError(errMsg(e, "Could not load this record")));
    } else {
      const v = initialValues(fields, defaults.current);
      snapshot.current = JSON.stringify(v);
      setRecord(null);
      setValues(v);
    }
  }, [meta, fields, id, entity]);

  const setValue = useCallback((k: string, v: unknown) => setValues((s) => (s ? { ...s, [k]: v } : s)), []);

  async function save(extra?: Data, fieldsToCheck?: Field[]) {
    if (!values) throw new Error("Form is still loading");
    const merged = { ...values, ...extra };
    const missing = missingRequired(fieldsToCheck ?? fields, merged);
    if (missing.length) throw new Error(`Please complete: ${missing.join(", ")}`);
    setBusy(true);
    try {
      const out = id ? await send(`/e/${entity}/${id}`, "PATCH", merged) : await send(`/e/${entity}`, "POST", { ...merged, ...(opts.parentId ? { parentId: opts.parentId } : {}) });
      snapshot.current = JSON.stringify(values);
      return out;
    } finally {
      setBusy(false);
    }
  }

  return { meta, metaError, loadError, fields, values, record, dirty: values ? JSON.stringify(values) !== snapshot.current : false, busy, setValue, save };
}

/** Warn before leaving a form with unsaved edits. */
export function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);
}

/* ------------------------------------------------------------------ */
/* Popups                                                               */
/* ------------------------------------------------------------------ */

/** Create / edit a stored record in a popup. */
export function EntityModal({
  entity,
  id,
  parentId,
  title,
  saveLabel,
  onClose,
  onSaved,
  refs,
  defaults,
  extra,
  layout,
  successMessage,
  fieldMap,
  children,
}: {
  entity: string;
  id: string | null;
  parentId?: string;
  title: string;
  saveLabel: string;
  onClose: () => void;
  onSaved: (out: Saved) => void;
  refs?: Refs;
  defaults?: Data;
  extra?: Data;
  layout?: Array<[string, string[]]>;
  successMessage?: string;
  fieldMap?: (f: Field, values: Data) => Field;
  children?: (form: EntityForm) => ReactNode;
}) {
  const form = useEntityForm(entity, id, { parentId, defaults });
  const [error, setError] = useState<string | null>(null);
  const fields = form.values && fieldMap ? form.fields.map((f) => fieldMap(f, form.values!)) : form.fields;
  const submit = () => {
    setError(null);
    form
      .save(extra, fields)
      .then((out) => onSaved({ ...out, message: !id && successMessage ? successMessage : out.message }))
      .catch((e) => setError(errMsg(e, "Save failed")));
  };
  return (
    <SaModal
      title={title}
      onClose={onClose}
      wide={fields.length > 6}
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values} onClick={submit}>
          {saveLabel}
        </button>
      }
    >
      {error ? <p className="pm-error" role="alert">{error}</p> : null}
      {form.metaError || form.loadError ? <p className="pm-error">{form.metaError ?? form.loadError}</p> : null}
      {!form.values || !form.meta ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : (
        <form
          className="pm-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {layout ? (
            <Layout groups={layout} fields={fields} values={form.values} setValue={form.setValue} meta={form.meta} refs={refs} flat />
          ) : (
            <ModalSections fields={fields} values={form.values} setValue={form.setValue} meta={form.meta} refs={refs} />
          )}
          {children?.(form)}
        </form>
      )}
    </SaModal>
  );
}

export function ModalSections({ fields, values, setValue, meta, refs }: { fields: Field[]; values: Data; setValue: (k: string, v: unknown) => void; meta: Meta; refs?: Refs }) {
  const loose = fields.filter((f) => !f.section);
  return (
    <>
      {loose.length ? <FieldGrid fields={loose} values={values} setValue={setValue} meta={meta} refs={refs} /> : null}
      {sectionsOf(fields).map((sec) => (
        <div key={sec.name} className="pm-modal-section">
          <h3>{sec.name}</h3>
          <FieldGrid fields={sec.fields} values={values} setValue={setValue} meta={meta} refs={refs} />
        </div>
      ))}
    </>
  );
}

/** Edits one inline row (designation, enrolment condition, deadline, event date) held in the parent form until it is saved. */
export function RowModal({ title, fields, initial, saveLabel, meta, onClose, onSave }: { title: string; fields: Field[]; initial: Data | null; saveLabel: string; meta: Meta; onClose: () => void; onSave: (row: Data) => void }) {
  const [values, setValues] = useState<Data>(() => ({ ...initialValues(fields, initial ?? undefined), ...(initial?.id ? { id: initial.id } : {}) }));
  const [error, setError] = useState<string | null>(null);
  const setValue = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));
  const submit = () => {
    const missing = missingRequired(fields, values);
    if (missing.length) {
      setError(`Please complete: ${missing.join(", ")}`);
      return;
    }
    const out: Data = { ...values };
    for (const f of fields) if (!applies(f, out)) out[f.key] = f.dflt !== undefined ? f.dflt : emptyOf(f);
    onSave({ ...out, id: str(values.id) || `new-${Date.now()}` });
  };
  return (
    <SaModal
      title={title}
      onClose={onClose}
      wide={fields.length > 6}
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={submit}>
          {saveLabel}
        </button>
      }
    >
      {error ? <p className="pm-error" role="alert">{error}</p> : null}
      <form
        className="pm-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <ModalSections fields={fields} values={values} setValue={setValue} meta={meta} />
      </form>
    </SaModal>
  );
}

export function Confirm({ title, body, okLabel, onCancel, onOk, danger = true }: { title: string; body: ReactNode; okLabel: string; onCancel: () => void; onOk: () => void; danger?: boolean }) {
  return (
    <SaModal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="mh-sa__btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={`mh-sa__btn${danger ? " mh-sa__btn--danger" : " mh-sa__btn--primary"}`} onClick={onOk}>
            {okLabel}
          </button>
        </>
      }
    >
      <div>{body}</div>
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Lists                                                                */
/* ------------------------------------------------------------------ */

/** Drag-and-drop row ordering (plus keyboard: focus the handle and use the arrow keys). */
export function useDragOrder<T extends { id: string }>(rows: T[], onReorder: (ids: string[]) => void) {
  const drag = useRef<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const move = (from: string, to: string | number) => {
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(from);
    if (i < 0) return;
    ids.splice(i, 1);
    const j = typeof to === "number" ? Math.max(0, Math.min(ids.length, to)) : ids.indexOf(to) + (ids.indexOf(to) >= i ? 1 : 0);
    ids.splice(j, 0, from);
    if (ids.join() !== rows.map((r) => r.id).join()) onReorder(ids);
  };
  const rowProps = (r: T) => ({
    draggable: true,
    className: over === r.id ? "pm-drop" : undefined,
    onDragStart: () => {
      drag.current = r.id;
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(r.id);
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(null);
      if (drag.current && drag.current !== r.id) move(drag.current, r.id);
      drag.current = null;
    },
  });
  const handle = (r: T, label: string) => (
    <button
      type="button"
      className="pm-handle"
      aria-label={`Reorder ${label}. Use the up and down arrow keys.`}
      title="Drag to reorder"
      onKeyDown={(e) => {
        const i = rows.findIndex((x) => x.id === r.id);
        if (e.key === "ArrowUp" && i > 0) {
          e.preventDefault();
          move(r.id, i - 1);
        }
        if (e.key === "ArrowDown" && i < rows.length - 1) {
          e.preventDefault();
          move(r.id, i + 1);
        }
      }}
    >
      ⠿
    </button>
  );
  return { rowProps, handle };
}

export function Tabs({ tabs, active, hrefOf, disabled }: { tabs: Array<[string, string]>; active: string; hrefOf: (key: string) => string; disabled?: boolean }) {
  return (
    <nav className="lx-tabs pm-tabs" aria-label="Sections">
      {tabs.map(([key, label]) =>
        disabled && key !== tabs[0]![0] ? (
          <span key={key} className="lx-tab pm-tab--off" title="Save the program first">
            {label}
          </span>
        ) : (
          <Link key={key} href={hrefOf(key)} className={`lx-tab${active === key ? " is-active" : ""}`} aria-current={active === key ? "page" : undefined}>
            {label}
          </Link>
        ),
      )}
    </nav>
  );
}

export function Counters({ items }: { items: Array<[string, number | string, string?]> }) {
  return (
    <div className="pm-counters">
      {items.map(([label, n, tone]) => (
        <div key={label} className={`pm-counter${tone ? ` pm-counter--${tone}` : ""}`}>
          <strong>{n}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="pm-empty">{children}</p>;
}

export function Actions({ children }: { children: ReactNode }) {
  return <span className="pm-row-actions">{children}</span>;
}

export function Btn({ children, onClick, tone, small = true, disabled, type = "button" }: { children: ReactNode; onClick?: () => void; tone?: "primary" | "danger"; small?: boolean; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} disabled={disabled} className={`mh-sa__btn${small ? " mh-sa__btn--sm" : ""}${tone ? ` mh-sa__btn--${tone}` : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export { Fragment };
