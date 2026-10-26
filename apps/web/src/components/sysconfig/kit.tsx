"use client";

import "../superadmin/superadmin.css";
import "../location/location.css";
import "./sysconfig.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SaModal, SaNotice } from "@/components/superadmin/shared";
import { api, loadSession } from "@/lib/api";
import { FileUpload, StatementEditor, errMsg, str } from "../location/shared";
import { bodyOf, initialValues } from "./formValues";

export { errMsg, str };
export { bodyOf, defaultsFromEntries, initialValues } from "./formValues";

/* ------------------------------------------------------------------ */
/* Types & API                                                          */
/* ------------------------------------------------------------------ */

export type Kind =
  | "text"
  | "email"
  | "domain"
  | "number"
  | "date"
  | "time"
  | "select"
  | "radio"
  | "bool"
  | "multi"
  | "multiList"
  | "dual"
  | "textarea"
  | "html"
  | "code"
  | "color"
  | "icon"
  | "file"
  | "files"
  | "ref"
  | "refMulti"
  | "people"
  | "person"
  | "secret"
  | "password"
  | "rows";
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
  readonly?: boolean;
  rowFields?: Field[];
  rowLabel?: string;
  addLabel?: string;
  rowSave?: string;
  columns?: string[];
  confirm?: boolean;
  dependsOn?: string;
  display?: "checks" | "list";
};
export type Opt = { id: string; label: string; tag?: string };
export type Meta = {
  entities: Record<string, { label: string; fields: Field[]; sortable: boolean; noCreate: boolean; canEdit?: boolean }>;
  settings: Record<string, { label: string; save: string; fields: Field[] }>;
  canEditSettings?: boolean;
  lists: Record<string, string[]>;
  regions?: Record<string, string[]>;
  users: Opt[];
  colours: string[];
  icons: string[];
  outcomeIcons: string[];
};
export type Data = Record<string, unknown>;
export type Row = Data & { id: string; parentId?: string; updatedAt?: string };
export type Listing = { items: Row[]; total: number };
export type Refs = Record<string, Opt[]>;

export const FILES = "/admin/heritage/sysconfig/files";
export const sx = <T,>(path: string, init?: RequestInit) => api<T>(`/admin/heritage/sysconfig${path}`, init ?? {}, loadSession()?.accessToken);
export const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

let metaCache: Promise<Meta> | null = null;
/** Dropdown lists (statuses, agreement forms, …) change when records are saved, so saves drop the cache. */
export function invalidateMeta() {
  metaCache = null;
}
export function useSysMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    metaCache ??= sx<Meta>("/meta");
    metaCache.then(setMeta).catch((e) => {
      metaCache = null;
      setError(errMsg(e, "Could not load System Configuration"));
    });
  }, []);
  return { meta, error };
}

/** Whether the signed-in access level may change this entity (or the settings pages when no entity is given); false until meta loads. */
export function canEditIn(meta: Meta | null, entity?: string) {
  if (!meta) return false;
  return entity ? meta.entities[entity]?.canEdit !== false : meta.canEditSettings !== false;
}
export function useCanEdit(entity?: string) {
  const { meta } = useSysMeta();
  return canEditIn(meta, entity);
}

export function refTargets(fields: Field[]): string[] {
  const out = new Set<string>();
  for (const f of fields) {
    if ((f.kind === "ref" || f.kind === "refMulti") && f.ref) out.add(f.ref);
    if (f.kind === "rows") for (const t of refTargets(f.rowFields ?? [])) out.add(t);
  }
  return [...out];
}

export const labelOf = (r: Data) => str(r.name || r.question || r.email || r.label);

export async function loadRefs(targets: string[]): Promise<Refs> {
  const out: Refs = {};
  await Promise.all(
    targets.map(async (t) => {
      const r = await sx<Listing>(`/e/${t}`, { cache: "no-store" });
      out[t] = r.items.map((i) => ({ id: i.id, label: labelOf(i), tag: str(i.type || (i.parent ? "child" : "")) }));
    }),
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* Value helpers                                                        */
/* ------------------------------------------------------------------ */

const LIST_KINDS: Kind[] = ["multi", "multiList", "dual", "files", "refMulti", "people", "rows"];

export function emptyOf(f: Field): unknown {
  if (f.kind === "bool") return false;
  if (LIST_KINDS.includes(f.kind)) return [];
  if (f.kind === "file") return null;
  return "";
}

export function applies(f: Field, values: Data) {
  if (!f.when) return true;
  const v = values[f.when.key];
  const hit = Array.isArray(f.when.equals) ? f.when.equals.includes(v as string) : v === f.when.equals;
  return f.when.not ? !hit : hit;
}

export function missingRequired(fields: Field[], values: Data) {
  return fields
    .filter((f) => f.required && applies(f, values))
    .filter((f) => {
      const v = values[f.key];
      if (f.kind === "password") return !v && !values[`_has_${f.key}`];
      if (LIST_KINDS.includes(f.kind)) return !Array.isArray(v) || v.length === 0;
      if (f.kind === "file") return !v;
      return v === null || v === undefined || String(v).trim() === "";
    })
    .map((f) => f.label);
}

export function sectionsOf(fields: Field[]) {
  const order: string[] = [];
  for (const f of fields) if (f.section && !order.includes(f.section)) order.push(f.section);
  return order.map((name) => ({ name, fields: fields.filter((f) => f.section === name) }));
}

export function optionsFor(f: Field, meta: Meta) {
  return [...(f.dynExtra ?? []), ...(f.options ?? (f.dyn ? (meta.lists[f.dyn] ?? []) : []))];
}

/** Human-readable value for list cells and row tables. */
export function display(f: Field | undefined, v: unknown, meta: Meta, refs: Refs): string {
  if (!f) return str(v);
  if (f.kind === "bool") return v ? "Yes" : "No";
  if (f.kind === "html" || f.kind === "code") {
    const t = str(v).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    return t.length > 80 ? `${t.slice(0, 80)}…` : t;
  }
  if (f.kind === "ref") return refs[f.ref!]?.find((o) => o.id === v)?.label ?? "";
  if (f.kind === "refMulti") return (Array.isArray(v) ? v : []).map((id) => refs[f.ref!]?.find((o) => o.id === id)?.label ?? "").filter(Boolean).join(", ");
  if (f.kind === "person") return meta.users.find((u) => u.id === v)?.label ?? "";
  if (f.kind === "people") return (Array.isArray(v) ? v : []).map((id) => meta.users.find((u) => u.id === id)?.label ?? "").filter(Boolean).join(", ");
  if (Array.isArray(v)) return v.length ? v.map(str).join(", ") : f.kind === "multiList" ? "All" : "";
  if (f.kind === "number" && v !== null && v !== "" && v !== undefined) return `${str(v)}${f.suffix ? ` ${f.suffix}` : ""}`;
  return str(v);
}

/* ------------------------------------------------------------------ */
/* Notices                                                              */
/* ------------------------------------------------------------------ */

export function useFlash(initial?: string | null) {
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(initial ? { tone: "success", text: initial } : null);
  const node = notice ? (
    <SaNotice tone={notice.tone} onClose={() => setNotice(null)}>
      {notice.text}
    </SaNotice>
  ) : null;
  return {
    node,
    ok: useCallback((text: string) => setNotice({ tone: "success", text }), []),
    fail: useCallback((text: string) => setNotice({ tone: "error", text }), []),
    clear: useCallback(() => setNotice(null), []),
  };
}

/* ------------------------------------------------------------------ */
/* Icons                                                                */
/* ------------------------------------------------------------------ */

const ICON_PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM6 3v14",
  briefcase: "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  graduation: "m12 3 9 5-9 5-9-5 9-5zM5 10.5V17c0 1.5 3 3 7 3s7-1.5 7-3v-6.5",
  bell: "M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7M10 20a2 2 0 0 0 4 0",
  dollar: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  award: "M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5",
  list: "M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01",
  "bar-chart": "M4 20V10M12 20V4M20 20v-7",
  calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  folder: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  file: "M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 2v6h6",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
};

export function SysIcon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICON_PATHS[name] ?? ICON_PATHS.folder} />
    </svg>
  );
}

const OUTCOME_GLYPH: Record<string, { glyph: string; tone: string }> = {
  "Green Check": { glyph: "✓", tone: "green" },
  Warning: { glyph: "!", tone: "amber" },
  "Red Minus": { glyph: "−", tone: "red" },
  "Blue Question": { glyph: "?", tone: "blue" },
  Custom: { glyph: "★", tone: "grey" },
};
export function OutcomeBadge({ icon }: { icon: string }) {
  const g = OUTCOME_GLYPH[icon] ?? OUTCOME_GLYPH.Custom!;
  return <span className={`sx-outcome sx-outcome--${g.tone}`}>{g.glyph}</span>;
}

export function Swatch({ colour }: { colour: string }) {
  return <span className="sx-swatch" style={{ background: colour }} aria-label={colour} />;
}

/* ------------------------------------------------------------------ */
/* Composite controls                                                   */
/* ------------------------------------------------------------------ */

export function DualList({ options, value, onChange, label }: { options: Opt[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  const [left, setLeft] = useState<string[]>([]);
  const [right, setRight] = useState<string[]>([]);
  const available = options.filter((o) => !value.includes(o.id));
  const chosen = value.map((id) => options.find((o) => o.id === id) ?? { id, label: "(no longer available)" });
  const pick = (e: React.ChangeEvent<HTMLSelectElement>) => Array.from(e.target.selectedOptions).map((o) => o.value);
  return (
    <div className="sx-dual">
      <label className="sx-dual__col">
        <span className="mh-sa__muted">Available {label}</span>
        <select multiple size={8} className="mh-sa__input" value={left} onChange={(e) => setLeft(pick(e))} aria-label={`Available ${label}`}>
          {available.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="sx-dual__btns">
        <button
          type="button"
          className="mh-sa__btn mh-sa__btn--sm"
          disabled={!left.length}
          onClick={() => {
            onChange([...value, ...left.filter((id) => !value.includes(id))]);
            setLeft([]);
          }}
        >
          Add »
        </button>
        <button
          type="button"
          className="mh-sa__btn mh-sa__btn--sm"
          disabled={!right.length}
          onClick={() => {
            onChange(value.filter((id) => !right.includes(id)));
            setRight([]);
          }}
        >
          « Remove
        </button>
      </div>
      <label className="sx-dual__col">
        <span className="mh-sa__muted">Selected {label}</span>
        <select multiple size={8} className="mh-sa__input" value={right} onChange={(e) => setRight(pick(e))} aria-label={`Selected ${label}`}>
          {chosen.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function PeoplePicker({ users, value, onChange, multi, placeholder, id }: { users: Opt[]; value: string[]; onChange: (v: string[]) => void; multi: boolean; placeholder?: string; id?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const needle = q.trim().toLowerCase();
  const matches = needle ? users.filter((u) => !value.includes(u.id) && u.label.toLowerCase().includes(needle)).slice(0, 8) : [];
  const chosen = value.map((uid) => users.find((u) => u.id === uid) ?? { id: uid, label: "(removed user)" });
  return (
    <div className="sx-people">
      {chosen.length ? (
        <div className="sx-chips">
          {chosen.map((u) => (
            <span key={u.id} className="sx-chip">
              {u.label}
              <button type="button" aria-label={`Remove ${u.label}`} onClick={() => onChange(value.filter((x) => x !== u.id))}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {multi || !chosen.length ? (
        <div className="sx-people__search">
          <input
            id={id}
            className="mh-sa__input"
            value={q}
            placeholder={placeholder ?? "Start typing a name"}
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && needle ? (
            <ul className="sx-people__menu" role="listbox">
              {matches.length ? (
                matches.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(multi ? [...value, u.id] : [u.id]);
                        setQ("");
                      }}
                    >
                      {u.label}
                    </button>
                  </li>
                ))
              ) : (
                <li className="mh-sa__muted sx-people__none">No matching users</li>
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ColourPicker({ value, onChange, options, id }: { value: string; onChange: (v: string) => void; options: string[]; id?: string }) {
  const custom = value && !options.includes(value);
  return (
    <div className="sx-colours" role="radiogroup" id={id}>
      {options.map((c) => (
        <label key={c} className={`sx-colours__opt${value === c ? " is-on" : ""}`} title={c}>
          <input type="radio" name={id} checked={value === c} onChange={() => onChange(c)} />
          <span style={{ background: c }} />
        </label>
      ))}
      <label className={`sx-colours__custom${custom ? " is-on" : ""}`} title="Custom colour">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#1565c0"} onChange={(e) => onChange(e.target.value)} aria-label="Custom colour" />
        Custom
      </label>
    </div>
  );
}

function PasswordPair({ field, values, onChange, setValue }: { field: Field; values: Data; onChange: (v: unknown) => void; setValue?: (k: string, v: unknown) => void }) {
  const v = str(values[field.key]);
  const score = [v.length >= 10, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v), v.length >= 14].filter(Boolean).length;
  const label = !v ? "" : score <= 2 ? "Weak" : score <= 3 ? "Fair" : score === 4 ? "Strong" : "Very strong";
  const confirmKey = `${field.key}Confirm`;
  const confirm = str(values[confirmKey]);
  return (
    <div className="sx-pass">
      <input
        className="mh-sa__input"
        type="password"
        autoComplete="new-password"
        value={v}
        placeholder={values[`_has_${field.key}`] ? "Saved — leave blank to keep it" : "At least 10 characters with letters and numbers"}
        onChange={(e) => onChange(e.target.value)}
        aria-label={field.label}
      />
      {v ? (
        <div className={`sx-meter sx-meter--${score}`} aria-live="polite">
          <span style={{ width: `${(score / 5) * 100}%` }} />
          <em>{label}</em>
        </div>
      ) : null}
      {field.confirm ? (
        <label className="sx-pass__confirm">
          <span className="mh-sa__label">Confirm Password</span>
          <input className="mh-sa__input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setValue?.(confirmKey, e.target.value)} aria-label="Confirm Password" />
          {confirm && confirm !== v ? <span className="lx-hint sx-bad">Passwords do not match</span> : null}
        </label>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rows editor (Add Step, Add Requirement Item, Add Case, …)            */
/* ------------------------------------------------------------------ */

export function RowsEditor({ field, value, onChange, meta, refs }: { field: Field; value: unknown; onChange: (v: unknown) => void; meta: Meta; refs: Refs }) {
  const rows = (Array.isArray(value) ? value : []) as Data[];
  const rowFields = field.rowFields ?? [];
  const cols = (field.columns ?? rowFields.slice(0, 3).map((f) => f.key)).map((k) => rowFields.find((f) => f.key === k)).filter(Boolean) as Field[];
  const [edit, setEdit] = useState<{ index: number; values: Data } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noun = field.rowLabel ?? "Row";
  const move = (i: number, d: number) => {
    const next = [...rows];
    const [r] = next.splice(i, 1);
    next.splice(i + d, 0, r!);
    onChange(next);
  };
  return (
    <div className="sx-rows">
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
                  <td key={c.key}>{display(c, r[c.key], meta, refs) || <span className="mh-sa__muted">—</span>}</td>
                ))}
                <td className="lx-actions">
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm" disabled={i === 0} aria-label="Move up" onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm" disabled={i === rows.length - 1} aria-label="Move down" onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="mh-sa__btn mh-sa__btn--sm"
                    onClick={() => {
                      setError(null);
                      setEdit({ index: i, values: initialValues(rowFields, r) });
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" aria-label={`Remove ${noun.toLowerCase()} ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                    X
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={cols.length + 1} className="mh-sa__empty-cell">
                  No {noun.toLowerCase()}s added yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="mh-sa__btn mh-sa__btn--sm sx-rows__add"
        onClick={() => {
          setError(null);
          setEdit({ index: -1, values: initialValues(rowFields) });
        }}
      >
        {field.addLabel ?? `Add ${noun}`}
      </button>
      {edit ? (
        <SaModal
          title={`${edit.index < 0 ? "Add" : "Edit"} ${noun}`}
          wide={rowFields.some((f) => f.kind === "html" || f.kind === "code" || f.kind === "multiList")}
          onClose={() => setEdit(null)}
          footer={
            <>
              <button type="button" className="mh-sa__btn" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="mh-sa__btn mh-sa__btn--primary"
                onClick={() => {
                  const missing = missingRequired(rowFields, edit.values);
                  if (missing.length) {
                    setError(`Please complete: ${missing.join(", ")}`);
                    return;
                  }
                  const clean: Data = { id: str(rows[edit.index]?.id) || `new-${Date.now()}` };
                  for (const f of rowFields) clean[f.key] = applies(f, edit.values) ? edit.values[f.key] : emptyOf(f);
                  onChange(edit.index < 0 ? [...rows, clean] : rows.map((r, j) => (j === edit.index ? clean : r)));
                  setEdit(null);
                }}
              >
                {field.rowSave ?? `Save ${noun}`}
              </button>
            </>
          }
        >
          {error ? <SaNotice tone="error">{error}</SaNotice> : null}
          <SysGrid fields={rowFields} values={edit.values} setValue={(k, v) => setEdit((s) => (s ? { ...s, values: { ...s.values, [k]: v } } : s))} meta={meta} refs={refs} />
        </SaModal>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Field control                                                        */
/* ------------------------------------------------------------------ */

const WIDE: Kind[] = ["textarea", "html", "code", "multi", "files", "dual", "refMulti", "rows", "people", "radio", "color", "icon", "password"];

export function SysControl({
  field: f,
  value,
  values,
  onChange,
  setValue,
  meta,
  refs,
  bare,
}: {
  field: Field;
  value: unknown;
  values: Data;
  onChange: (v: unknown) => void;
  setValue?: (k: string, v: unknown) => void;
  meta: Meta;
  refs: Refs;
  bare?: boolean;
}) {
  const id = `sx-${f.key}`;
  let control: ReactNode;
  switch (f.kind) {
    case "textarea":
      control = <textarea id={id} className="mh-sa__input" rows={4} value={str(value)} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "code":
      control = <textarea id={id} className="mh-sa__input sx-code" rows={10} spellCheck={false} value={str(value)} placeholder="<!-- HTML / CSS / script -->" onChange={(e) => onChange(e.target.value)} />;
      break;
    case "html":
      control = <StatementEditor value={str(value)} onChange={(v) => onChange(v)} label={f.label} />;
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
            onChange={(e) => onChange(e.target.value)}
          />
          {f.suffix ? <span className="lx-num__suffix">{f.suffix}</span> : null}
        </span>
      );
      break;
    case "date":
    case "time":
      control = (
        <span className="lx-num">
          <input id={id} className="mh-sa__input" type={f.kind} value={str(value)} onChange={(e) => onChange(e.target.value)} />
          {f.suffix ? <span className="lx-num__suffix">{f.suffix}</span> : null}
        </span>
      );
      break;
    case "select": {
      const opts = f.dependsOn ? (meta.regions?.[str(values[f.dependsOn])] ?? []) : optionsFor(f, meta);
      const v = str(value);
      if (f.dependsOn && !opts.length) {
        control = <input id={id} className="mh-sa__input" value={v} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
        break;
      }
      control = (
        <span className="lx-num">
          <select id={id} className="mh-sa__input" value={v} onChange={(e) => onChange(e.target.value)}>
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
    case "radio":
      control = (
        <div className="sx-radios" role="radiogroup" aria-label={f.label}>
          {optionsFor(f, meta).map((o) => (
            <label key={o} className="mh-sa__check">
              <input type="radio" name={id} checked={value === o} onChange={() => onChange(o)} /> {f.key === "icon" ? <OutcomeBadge icon={o} /> : null} {o}
            </label>
          ))}
        </div>
      );
      break;
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
      control = (
        <div className="lx-checks">
          {opts.map((o) => (
            <label key={o} className="mh-sa__check">
              <input type="checkbox" checked={arr.includes(o)} onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} /> {o}
            </label>
          ))}
        </div>
      );
      break;
    }
    case "multiList": {
      const opts = optionsFor(f, meta);
      const arr = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <select
          id={id}
          multiple
          size={Math.min(8, Math.max(4, opts.length))}
          className="mh-sa__input sx-multilist"
          value={arr}
          onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
        >
          {arr.filter((v) => !opts.includes(v)).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "dual":
      control = <DualList label={f.label} options={(f.options ?? []).map((o) => ({ id: o, label: o }))} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />;
      break;
    case "refMulti": {
      const opts = refs[f.ref!] ?? [];
      const arr = Array.isArray(value) ? (value as string[]) : [];
      if (f.display === "checks") {
        control = (
          <div className="sx-radios">
            {opts.map((o) => (
              <label key={o.id} className="mh-sa__check">
                <input type="checkbox" checked={arr.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...arr, o.id] : arr.filter((x) => x !== o.id))} /> {o.label}
              </label>
            ))}
            {!opts.length ? <span className="mh-sa__muted">None configured yet.</span> : null}
          </div>
        );
      } else if (f.display === "list") {
        control = (
          <select id={id} multiple size={Math.min(8, Math.max(4, opts.length))} className="mh-sa__input sx-multilist" value={arr} onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}>
            {opts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        );
      } else control = <DualList label={f.label} options={opts} value={arr} onChange={onChange} />;
      break;
    }
    case "color":
      control = <ColourPicker id={id} value={str(value)} options={f.options ?? meta.colours} onChange={onChange} />;
      break;
    case "icon":
      control = (
        <div className="sx-icons" role="radiogroup" aria-label={f.label}>
          {(f.options ?? meta.icons).map((name) => (
            <button key={name} type="button" role="radio" aria-checked={value === name} title={name} className={`sx-icons__opt${value === name ? " is-on" : ""}`} onClick={() => onChange(name)}>
              <SysIcon name={name} />
            </button>
          ))}
        </div>
      );
      break;
    case "ref": {
      let opts = refs[f.ref!] ?? [];
      if (f.ref === "runningElements") opts = opts.filter((o) => o.tag === (f.key.startsWith("header") ? "Header" : "Footer"));
      if (f.ref === "studentStatuses") opts = opts.filter((o) => o.tag !== "child");
      const v = str(value);
      control = (
        <select id={id} className="mh-sa__input" value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">{f.required ? "— Select —" : "— None —"}</option>
          {v && refs[f.ref!] && !opts.some((o) => o.id === v) ? <option value={v}>(no longer available)</option> : null}
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "person":
    case "people":
      control = (
        <PeoplePicker
          id={id}
          users={meta.users}
          multi={f.kind === "people"}
          placeholder={f.placeholder}
          value={f.kind === "person" ? (value ? [str(value)] : []) : Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => onChange(f.kind === "person" ? (v[0] ?? "") : v)}
        />
      );
      break;
    case "secret":
      control = (
        <input
          id={id}
          className="mh-sa__input"
          type="password"
          autoComplete="new-password"
          value={str(value)}
          placeholder={values[`_has_${f.key}`] ? "Saved — leave blank to keep it" : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "password":
      control = <PasswordPair field={f} values={values} onChange={onChange} setValue={setValue} />;
      break;
    case "file":
    case "files":
      control = <FileUpload endpoint={FILES} multiple={f.kind === "files"} value={value} onChange={onChange} accept={/font/i.test(f.key) ? ".ttf,.otf,.woff,.woff2" : "image/*"} label={f.label} />;
      break;
    case "rows":
      control = <RowsEditor field={f} value={value} onChange={onChange} meta={meta} refs={refs} />;
      break;
    default:
      control = (
        <input
          id={id}
          className="mh-sa__input"
          type={f.kind === "email" ? "email" : "text"}
          value={str(value)}
          readOnly={f.readonly}
          placeholder={f.placeholder ?? (f.kind === "domain" ? "e.g. txt.bell.ca" : undefined)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
  if (bare || f.kind === "bool") {
    if (f.kind === "bool" && f.hint && !bare)
      return (
        <div className="mh-sa__field mh-sa__field--wide">
          {control}
          <span className="lx-hint">{f.hint}</span>
        </div>
      );
    return <>{control}</>;
  }
  return (
    <div className={`mh-sa__field${WIDE.includes(f.kind) ? " mh-sa__field--wide" : ""}`}>
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

export function SysGrid({ fields, values, setValue, meta, refs }: { fields: Field[]; values: Data; setValue: (k: string, v: unknown) => void; meta: Meta; refs: Refs }) {
  const out: ReactNode[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    if (!applies(f, values)) continue;
    if (f.group) {
      if (seen.has(f.group)) continue;
      seen.add(f.group);
      const members = fields.filter((x) => x.group === f.group);
      out.push(
        <div key={f.group} className="mh-sa__field mh-sa__field--wide lx-group">
          <span className="mh-sa__label">{f.group}</span>
          <div className="lx-group__row">
            {members.map((m) => (
              <label key={m.key} className="lx-group__item">
                <span className="lx-group__sub">{m.sub}</span>
                <SysControl field={m} value={values[m.key]} values={values} onChange={(v) => setValue(m.key, v)} setValue={setValue} meta={meta} refs={refs} bare />
              </label>
            ))}
          </div>
        </div>,
      );
      continue;
    }
    out.push(<SysControl key={f.key} field={f} value={values[f.key]} values={values} onChange={(v) => setValue(f.key, v)} setValue={setValue} meta={meta} refs={refs} />);
  }
  return <div className="mh-sa__grid lx-grid">{out}</div>;
}

/* ------------------------------------------------------------------ */
/* Form hooks                                                           */
/* ------------------------------------------------------------------ */

export type SysForm = {
  meta: Meta | null;
  error: string | null;
  fields: Field[];
  values: Data | null;
  record: Row | null;
  refs: Refs;
  dirty: boolean;
  busy: boolean;
  setValue: (k: string, v: unknown) => void;
  save: () => Promise<{ id: string; message: string }>;
};

/** Loads an entity's field definitions, its reference lists and (when editing) the record. */
export function useSysForm(entity: string, id: string | null, opts: { parentId?: string; defaults?: Data } = {}): SysForm {
  const { meta, error: metaError } = useSysMeta();
  const fields = useMemo(() => meta?.entities[entity]?.fields ?? [], [meta, entity]);
  const [values, setValues] = useState<Data | null>(null);
  const [record, setRecord] = useState<Row | null>(null);
  const [refs, setRefs] = useState<Refs>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const snapshot = useRef("");
  const defaults = useRef(opts.defaults);
  defaults.current = opts.defaults;
  const defaultsKey = JSON.stringify(opts.defaults ?? {});

  useEffect(() => {
    if (!meta) return;
    void loadRefs(refTargets(fields))
      .then(setRefs)
      .catch(() => setRefs({}));
    if (id) {
      setValues(null);
      void sx<Row>(`/e/${entity}/${id}`, { cache: "no-store" })
        .then((r) => {
          const v = initialValues(fields, r);
          snapshot.current = JSON.stringify(v);
          setRecord(r);
          setValues(v);
        })
        .catch((e: Error) => setError(e.message));
    } else {
      const v = initialValues(fields, defaults.current);
      snapshot.current = JSON.stringify(v);
      setRecord(null);
      setValues(v);
    }
  }, [meta, id, entity, fields, defaultsKey]);

  const setValue = useCallback((k: string, v: unknown) => setValues((s) => (s ? { ...s, [k]: v } : s)), []);

  async function save() {
    if (!values) throw new Error("Form is still loading");
    const missing = missingRequired(fields, values);
    if (missing.length) throw new Error(`Please complete: ${missing.join(", ")}`);
    setBusy(true);
    try {
      const body = bodyOf(values);
      const out = id
        ? await sx<{ id: string; message: string }>(`/e/${entity}/${id}`, json("PATCH", body))
        : await sx<{ id: string; message: string }>(`/e/${entity}`, json("POST", { ...body, ...(opts.parentId ? { parentId: opts.parentId } : {}) }));
      snapshot.current = JSON.stringify(values);
      invalidateMeta();
      return out;
    } finally {
      setBusy(false);
    }
  }

  return { meta, error: metaError ?? error, fields, values, record, refs, dirty: values ? JSON.stringify(values) !== snapshot.current : false, busy, setValue, save };
}

export type SettingsForm = Omit<SysForm, "record" | "save"> & { save: () => Promise<string>; updatedAt: string | null };

export function useSettingsForm(key: string): SettingsForm {
  const { meta, error: metaError } = useSysMeta();
  const fields = useMemo(() => meta?.settings[key]?.fields ?? [], [meta, key]);
  const [values, setValues] = useState<Data | null>(null);
  const [refs, setRefs] = useState<Refs>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const snapshot = useRef("");

  useEffect(() => {
    if (!meta) return;
    void loadRefs(refTargets(fields))
      .then(setRefs)
      .catch(() => setRefs({}));
    void sx<{ values: Data; updatedAt: string | null }>(`/settings/${key}`)
      .then((r) => {
        const v = initialValues(fields, r.values);
        snapshot.current = JSON.stringify(v);
        setValues(v);
        setUpdatedAt(r.updatedAt);
      })
      .catch((e: Error) => setError(e.message));
  }, [meta, key, fields]);

  const setValue = useCallback((k: string, v: unknown) => setValues((s) => (s ? { ...s, [k]: v } : s)), []);

  async function save() {
    if (!values) throw new Error("Settings are still loading");
    const missing = missingRequired(fields, values);
    if (missing.length) throw new Error(`Please complete: ${missing.join(", ")}`);
    setBusy(true);
    try {
      const out = await sx<{ message: string }>(`/settings/${key}`, json("PUT", bodyOf(values)));
      snapshot.current = JSON.stringify(values);
      setUpdatedAt(new Date().toISOString());
      invalidateMeta();
      return out.message;
    } finally {
      setBusy(false);
    }
  }

  return { meta, error: metaError ?? error, fields, values, refs, dirty: values ? JSON.stringify(values) !== snapshot.current : false, busy, setValue, save, updatedAt };
}

/** One card per field section (fields without a section share one untitled card). */
export function SysSections({ form, only, skip }: { form: Pick<SysForm, "meta" | "values" | "fields" | "setValue" | "refs">; only?: string[]; skip?: string[] }) {
  if (!form.meta || !form.values) return null;
  let fields = form.fields;
  if (only) fields = fields.filter((f) => only.includes(f.key));
  if (skip) fields = fields.filter((f) => !skip.includes(f.key));
  const loose = fields.filter((f) => !f.section);
  const sections = sectionsOf(fields);
  return (
    <>
      {loose.length ? (
        <section className="mh-sa__card">
          <SysGrid fields={loose} values={form.values} setValue={form.setValue} meta={form.meta} refs={form.refs} />
        </section>
      ) : null}
      {sections.map((sec) =>
        sec.fields.some((f) => applies(f, form.values!)) ? (
          <section key={sec.name} className="mh-sa__card">
            <div className="mh-sa__card-head">
              <h2>{sec.name}</h2>
            </div>
            <SysGrid fields={sec.fields} values={form.values!} setValue={form.setValue} meta={form.meta!} refs={form.refs} />
          </section>
        ) : null,
      )}
    </>
  );
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

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-CA", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};
