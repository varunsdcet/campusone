"use client";

import "../superadmin/superadmin.css";
import "../location/location.css";
import "./courses.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { SaModal, SuperFrame } from "@/components/superadmin/shared";
import { StatementEditor, errMsg, str, useNotice } from "@/components/location/shared";
import { api, loadSession } from "@/lib/api";

export { errMsg, str, useNotice };

/* ------------------------------------------------------------------ */
/* Types + API                                                          */
/* ------------------------------------------------------------------ */

export type Kind = "text" | "number" | "select" | "bool" | "textarea" | "html" | "date" | "time" | "multi" | "multiList" | "people" | "file" | "rows" | "ref" | "dual";
export type Field = {
  key: string;
  label: string;
  kind: Kind;
  required?: boolean;
  options?: string[];
  dyn?: string;
  dynExtra?: string[];
  ref?: string;
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
  accept?: string;
  rowFields?: Field[];
  rowLabel?: string;
  addLabel?: string;
  rowSave?: string;
  columns?: string[];
  createOnly?: boolean;
};
export type Opt = { id: string; label: string; tag?: string };
export type Data = Record<string, unknown>;
export type Row = Data & { id: string };
export type Meta = {
  entities: Record<string, { label: string; fields: Field[]; save: string; parent: string | null }>;
  forms: { course: Field[]; session: Field[]; courseTextbook: Field[]; answer: Field[] };
  lists: Record<string, string[]>;
  refs: Record<string, Opt[]>;
  users: Opt[];
  options: {
    weekdays: string[];
    sessionStatuses: string[];
    changeStatuses: string[];
    changeTypes: string[];
    repositoryFilters: string[];
    backupStatuses: string[];
    bulkUpdates: string[];
    learningStyles: string[];
    gradesVisibility: string[];
  };
};
export type Saved = { id?: string; message: string };
export type Paged<T> = { items: T[]; total: number; page: number; pages: number; perPage: number };

let metaCache: Promise<Meta> | null = null;

export function cm<T>(path: string, init?: RequestInit) {
  if (init?.method && init.method !== "GET") metaCache = null;
  return api<T>(`/admin/heritage/courses${path}`, init ?? {}, loadSession()?.accessToken);
}
export const send = <T = Saved,>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) =>
  cm<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
export const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && String(v) !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    metaCache ??= cm<Meta>("/meta");
    metaCache
      .then((m) => live && setMeta(m))
      .catch((e) => {
        metaCache = null;
        if (live) setError(errMsg(e, "Could not load Course Management"));
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

/** Loads a GET endpoint and exposes a reload; `path === null` skips loading. */
export function useLoad<T>(path: string | null, fallback = "Could not load this page") {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (path === null) return;
    let live = true;
    setError(null);
    cm<T>(path)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errMsg(e, fallback)));
    return () => {
      live = false;
    };
  }, [path, tick, fallback]);
  return { data, error, reload: useCallback(() => setTick((t) => t + 1), []), setData };
}

export const BASE = "/admin/course-management";
export const HREF = {
  courses: `${BASE}/courses`,
  pending: `${BASE}/pending`,
  active: `${BASE}/active`,
  repository: `${BASE}/repository`,
  backups: `${BASE}/backups`,
  textbooks: `${BASE}/textbooks`,
  tests: `${BASE}/tests`,
  workshops: "/admin/workshops/manage",
  categories: `${BASE}/categories`,
  groups: `${BASE}/groups`,
  types: `${BASE}/types`,
  resources: `${BASE}/resources`,
  workshopRoles: "/admin/workshop-roles",
  badges: `${BASE}/badges`,
  competencies: `${BASE}/competencies`,
  grading: `${BASE}/grading`,
  evaluations: `${BASE}/evaluations`,
  questions: `${BASE}/questions`,
  results: `${BASE}/results`,
} as const;

export const money = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : `$${Number(v).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const fmtDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
};
export const fmtStamp = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso.length === 16 ? `${iso}:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
export const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  if (h === undefined || Number.isNaN(h)) return t;
  return `${((h + 11) % 12) + 1}:${String(m ?? 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
export const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/* ------------------------------------------------------------------ */
/* Field logic                                                          */
/* ------------------------------------------------------------------ */

export function applies(f: Field, values: Data) {
  if (!f.when) return true;
  const v = values[f.when.key];
  const hit = Array.isArray(f.when.equals) ? f.when.equals.includes(v as string) : v === f.when.equals;
  return f.when.not ? !hit : hit;
}

export function emptyOf(f: Field): unknown {
  if (f.kind === "bool") return false;
  if (["multi", "multiList", "people", "rows", "dual"].includes(f.kind)) return [];
  if (f.kind === "number" || f.kind === "file") return null;
  return "";
}

export function initialValues(fields: Field[], base?: Data): Data {
  const out: Data = {};
  for (const f of fields) out[f.key] = base && f.key in base ? base[f.key] : f.dflt !== undefined ? f.dflt : emptyOf(f);
  return out;
}

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

export function refOpts(meta: Meta, ref?: string) {
  return ref === "users" ? meta.users : (meta.refs[ref ?? ""] ?? []);
}

export function display(f: Field, v: unknown, meta: Meta): string {
  if (f.kind === "bool") return v ? "Yes" : "No";
  if (f.kind === "ref") return refOpts(meta, f.ref).find((o) => o.id === v)?.label ?? (str(v) ? "(no longer available)" : "—");
  if (f.kind === "time") return str(v) ? fmtTime(str(v)) : "—";
  if (f.kind === "date") return str(v) ? fmtDate(str(v)) : "—";
  if (Array.isArray(v)) return v.map(str).join(", ") || "—";
  return str(v) || "—";
}

/* ------------------------------------------------------------------ */
/* Controls                                                             */
/* ------------------------------------------------------------------ */

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export function TimePick({ value, onChange, label, allowEmpty }: { value: string; onChange: (v: string) => void; label: string; allowEmpty?: boolean }) {
  const [h = "", m = "00"] = value ? value.split(":") : [];
  return (
    <span className="cm-time">
      <select className="mh-sa__input" aria-label={`${label} hour`} value={h} onChange={(e) => onChange(e.target.value ? `${e.target.value}:${m || "00"}` : "")}>
        {allowEmpty || !h ? <option value="">--</option> : null}
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      :
      <select className="mh-sa__input" aria-label={`${label} minute`} disabled={!h} value={MINUTES.includes(m) ? m : "00"} onChange={(e) => onChange(`${h || "09"}:${e.target.value}`)}>
        {MINUTES.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </span>
  );
}

export function PeoplePicker({ value, onChange, options, label, placeholder }: { value: unknown; onChange: (v: string[]) => void; options: Opt[]; label: string; placeholder?: string }) {
  const ids = Array.isArray(value) ? (value as string[]) : [];
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
    onChange([...ids, id]);
    setQ("");
    setOpen(false);
  };
  return (
    <div className="cm-people">
      {ids.length ? (
        <div className="cm-chips">
          {ids.map((id) => (
            <span key={id} className="cm-chip">
              {name(id)}
              <button type="button" aria-label={`Remove ${name(id)}`} onClick={() => onChange(ids.filter((x) => x !== id))}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="cm-people__box">
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
          <ul className="cm-people__menu" role="listbox">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h.id)}>
                  {h.label}
                </button>
              </li>
            ))}
          </ul>
        ) : open && q.trim() ? (
          <div className="cm-people__menu cm-people__none">No matching users</div>
        ) : null}
      </div>
    </div>
  );
}

type FileRef = { id: string; name: string; mime: string; size: number } | null;

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

export function FileField({ value, onChange, accept, label }: { value: unknown; onChange: (v: FileRef) => void; accept?: string; label: string }) {
  const ref = value && typeof value === "object" ? (value as NonNullable<FileRef>) : null;
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File) => {
    setError(null);
    if (file.size > 8 * 1024 * 1024) {
      setError("Files must be 8 MB or smaller");
      return;
    }
    setProgress(15);
    try {
      const base64 = await readBase64(file);
      setProgress(55);
      const out = await send<NonNullable<FileRef>>("/files", "POST", { name: file.name, mime: file.type || "application/octet-stream", base64 });
      setProgress(100);
      onChange(out);
    } catch (e) {
      setError(errMsg(e, "Upload failed"));
    } finally {
      setTimeout(() => setProgress(null), 400);
    }
  };
  const download = async () => {
    if (!ref) return;
    try {
      const f = await cm<{ name: string; mime: string; base64: string }>(`/files/${ref.id}`);
      const a = document.createElement("a");
      a.href = `data:${f.mime};base64,${f.base64}`;
      a.download = f.name;
      a.click();
    } catch (e) {
      setError(errMsg(e, "Download failed"));
    }
  };
  return (
    <div className="cm-file">
      <div className="cm-file__row">
        <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => input.current?.click()} disabled={progress !== null}>
          Add / Browse
        </button>
        {ref ? (
          <>
            <button type="button" className="mh-sa__link" onClick={download}>
              {ref.name}
            </button>
            <span className="cm-muted">{fmtSize(ref.size)} uploaded</span>
            <button type="button" className="cm-linkbtn cm-linkbtn--danger" onClick={() => onChange(null)} aria-label={`Remove ${label}`}>
              Remove
            </button>
          </>
        ) : (
          <span className="cm-muted">No file selected · 0 KB of 8 MB</span>
        )}
      </div>
      {progress !== null ? (
        <div className="cm-file__bar" aria-label="Upload progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {error ? <span className="cm-error">{error}</span> : null}
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}

export function FieldControl({ field: f, value, values, onChange, meta, bare, disabled }: { field: Field; value: unknown; values: Data; onChange: (v: unknown) => void; meta: Meta; bare?: boolean; disabled?: boolean }) {
  const id = `cm-${f.key}`;
  let control: ReactNode;
  switch (f.kind) {
    case "textarea":
      control = <textarea id={id} className="mh-sa__input" rows={4} value={str(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
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
            disabled={disabled}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          />
          {f.suffix ? <span className="lx-num__suffix">{f.suffix}</span> : null}
        </span>
      );
      break;
    case "date":
      control = <input id={id} className="mh-sa__input" type="date" disabled={disabled} value={str(value)} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "time":
      control = <TimePick label={f.label} value={str(value)} onChange={onChange} allowEmpty={!f.required} />;
      break;
    case "select": {
      const opts = [...(f.dynExtra ?? []), ...(f.options ?? (f.dyn ? (meta.lists[f.dyn] ?? []) : []))];
      const v = str(value);
      control = (
        <span className="lx-num">
          <select id={id} className="mh-sa__input" value={v} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
            {!f.required || !v ? <option value="">{f.placeholder ?? (f.required ? "— Select —" : "— None —")}</option> : null}
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
      let opts = refOpts(meta, f.ref);
      if (f.ref === "classrooms" && str(values.campus)) opts = opts.filter((o) => o.tag === values.campus);
      const v = str(value);
      control = (
        <select id={id} className="mh-sa__input" value={v} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
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
          <input id={id} type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /> {f.label}
        </label>
      );
      break;
    case "multi": {
      const opts: Opt[] = f.ref ? refOpts(meta, f.ref) : (f.options ?? (f.dyn ? (meta.lists[f.dyn] ?? []) : [])).map((o) => ({ id: o, label: o }));
      const list = Array.isArray(value) ? (value as string[]) : [];
      control = opts.length ? (
        <div className="lx-checks">
          {opts.map((o) => (
            <label key={o.id} className="mh-sa__check">
              <input type="checkbox" checked={list.includes(o.id)} disabled={disabled} onChange={(e) => onChange(e.target.checked ? [...list, o.id] : list.filter((x) => x !== o.id))} /> {o.label}
            </label>
          ))}
        </div>
      ) : (
        <p className="mh-sa__muted">No options available yet.</p>
      );
      break;
    }
    case "multiList": {
      const opts: Opt[] = f.ref ? refOpts(meta, f.ref) : (f.dyn ? (meta.lists[f.dyn] ?? []) : (f.options ?? [])).map((o) => ({ id: o, label: o }));
      const list = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <select id={id} className="mh-sa__input cm-listbox" multiple value={list} disabled={disabled} onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "people":
      control = <PeoplePicker value={value} onChange={onChange} options={meta.users} label={f.label} placeholder={f.placeholder} />;
      break;
    case "file":
      control = <FileField value={value} onChange={onChange} accept={f.accept} label={f.label} />;
      break;
    case "html":
      control = <StatementEditor value={str(value)} onChange={(v) => onChange(v)} label={f.label} />;
      break;
    case "rows":
      control = <RowsField field={f} value={value} onChange={onChange} meta={meta} />;
      break;
    default:
      control = <input id={id} className="mh-sa__input" type="text" value={str(value)} placeholder={f.placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  }
  if (bare || f.kind === "bool") return <>{control}</>;
  const wide = ["textarea", "html", "multi", "multiList", "people", "rows", "file"].includes(f.kind);
  return (
    <div className={`mh-sa__field${wide ? " mh-sa__field--wide" : ""}`}>
      {f.kind === "rows" ? null : (
        <label className="mh-sa__label" htmlFor={id}>
          {f.label}
          {f.required ? <span className="lx-req">*</span> : null}
        </label>
      )}
      {control}
      {f.lang ? <span className="lx-lang">English</span> : null}
      {f.hint ? <span className="lx-hint">{f.hint}</span> : null}
    </div>
  );
}

/** Renders fields honouring `when` rules and paired `group` controls. */
export function FieldGrid({ fields, values, setValue, meta, render }: { fields: Field[]; values: Data; setValue: (k: string, v: unknown) => void; meta: Meta; render?: (f: Field) => ReactNode | undefined }) {
  const out: ReactNode[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    if (!applies(f, values)) continue;
    const custom = render?.(f);
    if (custom !== undefined) {
      out.push(<div key={f.key} className="mh-sa__field mh-sa__field--wide">{custom}</div>);
      continue;
    }
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
                <FieldControl field={m} value={values[m.key]} values={values} onChange={(v) => setValue(m.key, v)} meta={meta} bare />
              </label>
            ))}
          </div>
        </div>,
      );
      continue;
    }
    out.push(<FieldControl key={f.key} field={f} value={values[f.key]} values={values} onChange={(v) => setValue(f.key, v)} meta={meta} />);
  }
  return <div className="mh-sa__grid lx-grid">{out}</div>;
}

export function sectionsOf(fields: Field[]) {
  const order: string[] = [];
  for (const f of fields) if (f.section && !order.includes(f.section)) order.push(f.section);
  return order.map((name) => ({ name, fields: fields.filter((f) => f.section === name) }));
}

/** One card per field section (page forms) or a divided list (popups). */
export function Sections({
  fields,
  values,
  setValue,
  meta,
  flat,
  render,
  after,
}: {
  fields: Field[];
  values: Data;
  setValue: (k: string, v: unknown) => void;
  meta: Meta;
  flat?: boolean;
  render?: (f: Field) => ReactNode | undefined;
  after?: Record<string, ReactNode>;
}) {
  const loose = fields.filter((f) => !f.section);
  const body = (fs: Field[]) => <FieldGrid fields={fs} values={values} setValue={setValue} meta={meta} render={render} />;
  return (
    <>
      {loose.length ? flat ? <div className="cm-modal-section">{body(loose)}</div> : <section className="mh-sa__card">{body(loose)}</section> : null}
      {sectionsOf(fields).map((sec) =>
        flat ? (
          <div key={sec.name} className="cm-modal-section">
            <h3>{sec.name}</h3>
            {body(sec.fields)}
            {after?.[sec.name] ?? null}
          </div>
        ) : (
          <section key={sec.name} className="mh-sa__card">
            <div className="mh-sa__card-head">
              <h2>{sec.name}</h2>
            </div>
            {body(sec.fields)}
            {after?.[sec.name] ?? null}
          </section>
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Inline rows (grades, exam dates, answers, textbook courses)          */
/* ------------------------------------------------------------------ */

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
      wide={fields.length > 5}
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={submit}>
          {saveLabel}
        </button>
      }
    >
      {error ? <p className="cm-error" role="alert">{error}</p> : null}
      <form
        className="cm-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <FieldGrid fields={fields} values={values} setValue={setValue} meta={meta} />
      </form>
    </SaModal>
  );
}

export function RowsField({ field: f, value, onChange, meta }: { field: Field; value: unknown; onChange: (v: Data[]) => void; meta: Meta }) {
  const rows = Array.isArray(value) ? (value as Data[]) : [];
  const fields = f.rowFields ?? [];
  const cols = (f.columns ?? fields.map((x) => x.key)).map((k) => fields.find((x) => x.key === k)).filter(Boolean) as Field[];
  const [editing, setEditing] = useState<{ row: Data | null } | null>(null);
  return (
    <div>
      <div className="pm-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="mh-sa__label">{f.label}</span>
        <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--primary" onClick={() => setEditing({ row: null })}>
          {f.addLabel ?? "Add"}
        </button>
      </div>
      <div className="mh-sa__table-wrap">
        <table className="mh-sa__table lx-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th className="lx-actions" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={str(r.id) || i}>
                {cols.map((c) => (
                  <td key={c.key}>{display(c, r[c.key], meta)}</td>
                ))}
                <td className="lx-actions">
                  <span className="cm-row-actions">
                    <button type="button" className="cm-linkbtn" onClick={() => setEditing({ row: r })}>
                      EDIT
                    </button>
                    <button type="button" className="cm-linkbtn cm-linkbtn--danger" aria-label={`Remove ${f.rowLabel ?? "row"} ${i + 1}`} onClick={() => onChange(rows.filter((x) => x !== r))}>
                      X
                    </button>
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={cols.length + 1} className="mh-sa__empty-cell">
                  No {(f.rowLabel ?? "row").toLowerCase()}s have been added.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {editing ? (
        <RowModal
          title={`${editing.row ? "Edit" : "Add"} ${f.rowLabel ?? "Row"}`}
          fields={fields}
          initial={editing.row}
          saveLabel={f.rowSave ?? "Save"}
          meta={meta}
          onClose={() => setEditing(null)}
          onSave={(row) => {
            onChange(editing.row ? rows.map((x) => (x === editing.row ? row : x)) : [...rows, row]);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entity forms                                                         */
/* ------------------------------------------------------------------ */

export type EntityForm = {
  meta: Meta | null;
  error: string | null;
  fields: Field[];
  values: Data | null;
  record: Row | null;
  dirty: boolean;
  busy: boolean;
  setValue: (k: string, v: unknown) => void;
  save: (extra?: Data) => Promise<Saved>;
};

export function useEntityForm(entity: string, id: string | null, opts: { parentId?: string; defaults?: Data } = {}): EntityForm {
  const { meta, error: metaError } = useMeta();
  const allFields = useMemo(() => meta?.entities[entity]?.fields ?? [], [meta, entity]);
  const fields = useMemo(() => (id ? allFields.filter((f) => !f.createOnly) : allFields), [allFields, id]);
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
      cm<Row>(`/e/${entity}/${id}`)
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

  async function save(extra?: Data) {
    if (!values) throw new Error("Form is still loading");
    const merged = { ...values, ...extra };
    const missing = missingRequired(fields, merged);
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

  return { meta, error: metaError ?? loadError, fields, values, record, dirty: values ? JSON.stringify(values) !== snapshot.current : false, busy, setValue, save };
}

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

/** Create / edit a configuration record in a popup. */
export function EntityModal({
  entity,
  id,
  parentId,
  title,
  saveLabel,
  onClose,
  onSaved,
  defaults,
  children,
}: {
  entity: string;
  id: string | null;
  parentId?: string;
  title: string;
  saveLabel?: string;
  onClose: () => void;
  onSaved: (out: Saved) => void;
  defaults?: Data;
  children?: (form: EntityForm) => ReactNode;
}) {
  const form = useEntityForm(entity, id, { parentId, defaults });
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    setError(null);
    form
      .save()
      .then(onSaved)
      .catch((e) => setError(errMsg(e, "Save failed")));
  };
  return (
    <SaModal
      title={title}
      onClose={onClose}
      wide={form.fields.length > 4}
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values} onClick={submit}>
          {saveLabel ?? form.meta?.entities[entity]?.save ?? "Save"}
        </button>
      }
    >
      {error ? <p className="cm-error" role="alert">{error}</p> : null}
      {form.error ? <p className="cm-error">{form.error}</p> : null}
      {!form.values || !form.meta ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : (
        <form
          className="cm-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Sections fields={form.fields} values={form.values} setValue={form.setValue} meta={form.meta} flat />
          {children?.(form)}
        </form>
      )}
    </SaModal>
  );
}

export function Confirm({ title, body, okLabel, onCancel, onOk, danger = true, busy }: { title: string; body: ReactNode; okLabel: string; onCancel: () => void; onOk: () => void; danger?: boolean; busy?: boolean }) {
  return (
    <SaModal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="mh-sa__btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" disabled={busy} className={`mh-sa__btn${danger ? " mh-sa__btn--danger" : " mh-sa__btn--primary"}`} onClick={onOk}>
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
/* Page chrome                                                          */
/* ------------------------------------------------------------------ */

export function Frame({ title, crumbs, active, actions, children }: { title: string; crumbs: string[]; active: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <SuperFrame title={title} breadcrumbs={["Home", "Course Management", ...crumbs]} activeHref={active} actions={actions}>
      <div className="lx">{children}</div>
    </SuperFrame>
  );
}

export function LinkBtn({ children, onClick, danger, disabled, href }: { children: ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean; href?: string }) {
  if (href)
    return (
      <Link href={href} className={`cm-linkbtn${danger ? " cm-linkbtn--danger" : ""}`}>
        {children}
      </Link>
    );
  return (
    <button type="button" className={`cm-linkbtn${danger ? " cm-linkbtn--danger" : ""}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function RowActions({ children }: { children: ReactNode[] }) {
  const items = children.filter(Boolean);
  return (
    <span className="cm-row-actions">
      {items.map((c, i) => (
        <span key={i}>
          {i ? <span className="cm-sep">|</span> : null}
          {c}
        </span>
      ))}
    </span>
  );
}

export function Pager({ data, onPage, onPerPage }: { data: { total: number; page: number; pages: number; perPage: number }; onPage: (p: number) => void; onPerPage: (n: number) => void }) {
  return (
    <div className="cm-pager">
      <span>
        <strong>{data.total}</strong> result{data.total === 1 ? "" : "s"}
      </span>
      <span style={{ display: "inline-flex", gap: 14 }}>
        <label>
          Results per page
          <select className="mh-sa__input" value={data.perPage} onChange={(e) => onPerPage(Number(e.target.value))}>
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Page
          <select className="mh-sa__input" value={data.page} onChange={(e) => onPage(Number(e.target.value))}>
            {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          of {data.pages}
        </label>
      </span>
    </div>
  );
}

export function RefSelect({ label, value, onChange, options, all }: { label: string; value: string; onChange: (v: string) => void; options: Opt[] | string[]; all: string }) {
  const opts: Opt[] = (options as Array<Opt | string>).map((o) => (typeof o === "string" ? { id: o, label: o } : o));
  return (
    <label className="mh-sa__field">
      <span className="mh-sa__label">{label}</span>
      <select className="mh-sa__input" value={value} onChange={(e) => onChange(e.target.value)}>
        {all ? <option value="">{all}</option> : null}
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Loading({ error }: { error?: string | null }) {
  return error ? <p className="cm-error">{error}</p> : <p className="mh-sa__muted">Loading…</p>;
}
