"use client";

import "../superadmin/superadmin.css";
import "../location/location.css";
import "../sysconfig/sysconfig.css";
import "./finance.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SaModal, SuperFrame } from "@/components/superadmin/shared";
import { API_URL, api, loadSession } from "@/lib/api";
import { Pager, errMsg, str } from "../location/shared";
import { useFlash } from "../sysconfig/kit";

export { errMsg, str, useFlash };

export const FM = "Financial Management";
export const FIN = "/admin/financial";

export type Data = Record<string, unknown>;
export type Who = { id: string; name: string; number: string; campus?: string; program?: string } | null;
export type Page<T> = { items: T[]; total: number; page: number; perPage: number; pages: number };
export type Opt = { id: string; name: string };
export type Term = { id: string; name: string; startsOn: string; endsOn: string };
export type FinMeta = {
  campuses: string[];
  programs: string[];
  statuses: string[];
  terms: Term[];
  ledgerTypes: Array<{ id: string; name: string; trigger: string; domestic: number; international: number; overridable: boolean }>;
  paymentMethods: Array<{ id: string; name: string; creditCard: boolean }>;
  disbursementTypes: Opt[];
  promotionAllocations: Opt[];
  promotions: Array<{ id: string; name: string; type: string; status: string }>;
  fundingSources: Opt[];
  agents: Array<{ id: string; label: string; number: string; last: string }>;
  collectionAgencies: Array<{ id: string; name: string; isDefault: boolean }>;
  planTemplates: Array<{ id: string; name: string; scheduleType: string; frequency: string; totalInstalments: number; balanceSync: string; fixedAmount: number; planFee: string; offsetCredit: boolean; prompts: boolean }>;
  frequencies: string[];
  documents: Array<{ group: string; items: Array<{ id: string; label: string }> }>;
  constants: Record<string, string[]>;
  perms: { edit: boolean; agents: boolean };
};

export const fin = <T,>(path: string, init?: RequestInit) => api<T>(`/admin/heritage/financial${path}`, init ?? {}, loadSession()?.accessToken);
export const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const money = (n: unknown) => {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "$0.00";
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
export const fmtDay = (d: unknown) => {
  const t = str(d);
  if (!t) return "—";
  const x = new Date(t.length === 10 ? `${t}T12:00:00` : t);
  return Number.isNaN(x.getTime()) ? t : x.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "2-digit" });
};
export const today = () => new Date().toISOString().slice(0, 10);

let metaCache: Promise<FinMeta> | null = null;
let metaAt = 0;
export function invalidateFinMeta() {
  metaCache = null;
}
/** Dropdown data for the module; refreshed when older than 20 s so configuration edits show up on the next screen. */
export function useFinMeta() {
  const [meta, setMeta] = useState<FinMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (Date.now() - metaAt > 20_000) metaCache = null;
    if (!metaCache) {
      metaAt = Date.now();
      metaCache = fin<FinMeta>("/meta");
    }
    metaCache.then(setMeta).catch((e) => {
      metaCache = null;
      setError(errMsg(e, "Could not load Financial Management"));
    });
  }, []);
  return { meta, error };
}

/** Downloads a generated PDF (receipt, invoice, T2202, statement) with the session token. */
export async function downloadPdf(path: string, init?: RequestInit) {
  const token = loadSession()?.accessToken;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/admin/heritage/financial${path}`, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const b = (await res.json()) as { error?: { message?: string }; message?: string };
      message = b.error?.message ?? b.message ?? message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "document.pdf";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function FinFrame({ title, href, crumbs, actions, children }: { title: string; href: string; crumbs?: string[]; actions?: ReactNode; children: ReactNode }) {
  return (
    <SuperFrame title={title} breadcrumbs={["Home", FM, ...(crumbs ?? [title])]} activeHref={href} actions={actions}>
      <div className="lx sx fn">{children}</div>
    </SuperFrame>
  );
}

export function Field({ label, children, lang, hint, wide, required }: { label: string; children: ReactNode; lang?: boolean; hint?: ReactNode; wide?: boolean; required?: boolean }) {
  return (
    <label className={`mh-sa__field${wide ? " mh-sa__field--wide" : ""}`}>
      <span className="mh-sa__label">
        {label}
        {required ? <span className="lx-req">*</span> : null}
      </span>
      {children}
      {lang ? <span className="lx-lang">English</span> : null}
      {hint ? <span className="lx-hint">{hint}</span> : null}
    </label>
  );
}

export function Select({ value, onChange, options, all, placeholder, disabled }: { value: string; onChange: (v: string) => void; options: Array<string | { id: string; name: string }>; all?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <select className="mh-sa__input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {all ? <option value="">{all}</option> : null}
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ),
      )}
    </select>
  );
}

export function Badge({ text }: { text: string }) {
  const tone = /^(Paid|Active|Applied|Allocated|Balance Paid|Paid To-Date|Approved|Approved \/ Complete|Sent|Credited|Yes|Unlocked)$/.test(text)
    ? "green"
    : /^(Not Paid|Overdue|Declined|Revoked|Removed|Locked)$/.test(text)
      ? "red"
      : /^(Partially|Pending|Owing|Unapplied|Unallocated|Created)/.test(text)
        ? "amber"
        : /Refund/.test(text)
          ? "blue"
          : "grey";
  return <span className={`sx-badge sx-badge--${tone}`}>{text}</span>;
}

/** "Enter student # or last name" autocomplete; picking a student shows it as a removable token. */
export function StudentPicker({ value, onChange, placeholder = "Enter student # or last name", autoFocus }: { value: Who; onChange: (v: Who) => void; placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<NonNullable<Who>[]>([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setItems([]);
      return;
    }
    const n = ++seq.current;
    const t = setTimeout(() => {
      fin<{ items: NonNullable<Who>[] }>(`/students?q=${encodeURIComponent(term)}`)
        .then((r) => n === seq.current && setItems(r.items))
        .catch(() => setItems([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  if (value)
    return (
      <span className="fn-token">
        {value.name} <small>#{value.number}</small>
        <button type="button" aria-label={`Remove ${value.name}`} onClick={() => onChange(null)}>
          ×
        </button>
      </span>
    );
  return (
    <div className="fn-picker">
      <input
        className="mh-sa__input"
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && items.length ? (
        <ul className="fn-picker__list" role="listbox">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s);
                  setQ("");
                  setOpen(false);
                }}
              >
                <strong>{s.name}</strong> <span>#{s.number}</span> {s.campus ? <em>{s.campus}</em> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : open && q.trim() ? (
        <div className="fn-picker__list fn-picker__none">No students match “{q.trim()}”.</div>
      ) : null}
    </div>
  );
}

export function AgentPicker({ meta, value, onChange }: { meta: FinMeta; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = meta.agents.find((a) => a.id === value);
  const t = q.trim().toLowerCase();
  const list = t ? meta.agents.filter((a) => a.number.toLowerCase().includes(t) || a.last.toLowerCase().startsWith(t) || a.label.toLowerCase().includes(t)) : meta.agents;
  if (chosen)
    return (
      <span className="fn-token">
        {chosen.label}
        <button type="button" aria-label="Remove agent" onClick={() => onChange("")}>
          ×
        </button>
      </span>
    );
  return (
    <div className="fn-picker">
      <input className="mh-sa__input" value={q} placeholder="Enter agent # or last name" onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open ? (
        <ul className="fn-picker__list" role="listbox">
          {list.map((a) => (
            <li key={a.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(a.id)}>
                {a.label}
              </button>
            </li>
          ))}
          {!list.length ? <li className="fn-picker__none">No agents match.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

export function StudentCell({ who }: { who: Who }) {
  if (!who) return <span className="mh-sa__muted">(unknown student)</span>;
  return (
    <a className="fn-student" href={`${FIN}/student?ctx=student:${who.id}`}>
      <strong>{who.name}</strong>
      <small>#{who.number}</small>
    </a>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <SaModal title={title} onClose={onClose} footer={footer} wide={wide}>
      <div className="fn-modal">{children}</div>
    </SaModal>
  );
}

/** Popup with a primary action that shows its own error inline and stays open on failure. */
export function ActionModal({
  title,
  onClose,
  onSubmit,
  submitLabel,
  children,
  wide,
  danger,
  cancelLabel = "Cancel",
  disabled,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  submitLabel: string;
  children: ReactNode;
  wide?: boolean;
  danger?: boolean;
  cancelLabel?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = () => {
    setErr(null);
    setBusy(true);
    onSubmit()
      .catch((e) => setErr(errMsg(e, "Something went wrong")))
      .finally(() => setBusy(false));
  };
  return (
    <SaModal
      title={title}
      onClose={onClose}
      wide={wide}
      footer={
        <>
          <button type="button" className="mh-sa__btn" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={`mh-sa__btn ${danger ? "mh-sa__btn--danger" : "mh-sa__btn--primary"}`} disabled={busy || disabled} onClick={run}>
            {busy ? "Working…" : submitLabel}
          </button>
        </>
      }
    >
      <form
        className="fn-modal"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        {err ? <div className="mh-sa__notice mh-sa__notice--error" role="alert">{err}</div> : null}
        {children}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Filtered, paged directories                                          */
/* ------------------------------------------------------------------ */

export type FilterDef = {
  key: string;
  label: string;
  kind: "select" | "text" | "date";
  all?: string;
  options?: (m: FinMeta) => Array<string | { id: string; name: string }>;
  groups?: Array<{ label: string; items: string[] }>;
  placeholder?: string;
  initial?: string;
  when?: (v: Record<string, string>) => boolean;
};

export type ListCtx = { reload: () => void; ok: (t: string) => void; fail: (t: string) => void; meta: FinMeta };
export type Column<T> = { label: string; render: (r: T, ctx: ListCtx) => ReactNode; className?: string };

export function useFinList<T>(path: string, filters: FilterDef[]) {
  const initial = useMemo(() => Object.fromEntries(filters.map((f) => [f.key, f.initial ?? ""])), [filters]);
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [applied, setApplied] = useState<Record<string, string>>(initial);
  const [pageNo, setPageNo] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [data, setData] = useState<Page<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const load = useCallback(() => {
    const qs = new URLSearchParams({ page: String(pageNo), perPage: String(perPage) });
    for (const [k, v] of Object.entries(applied)) if (v) qs.set(k, v);
    const mine = ++seq.current;
    fin<Page<T>>(`${path}?${qs.toString()}`)
      .then((r) => {
        if (mine !== seq.current) return;
        setData(r);
        setError(null);
      })
      .catch((e) => {
        if (mine === seq.current) setError(errMsg(e, "Could not load records"));
      });
  }, [path, applied, pageNo, perPage]);
  useEffect(load, [load]);
  return {
    draft,
    setDraft,
    data,
    error,
    load,
    search: () => {
      setApplied(draft);
      setPageNo(1);
    },
    pager: data ? <Pager total={data.total} page={data.page} pages={data.pages} perPage={perPage} onPage={setPageNo} onPerPage={(n) => (setPerPage(n), setPageNo(1))} /> : null,
  };
}

export function FilterBar({ filters, meta, draft, setDraft, onSearch, submitLabel }: { filters: FilterDef[]; meta: FinMeta; draft: Record<string, string>; setDraft: (f: (d: Record<string, string>) => Record<string, string>) => void; onSearch: () => void; submitLabel: string }) {
  return (
    <form
      className="fn-filters"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
    >
      {filters
        .filter((f) => !f.when || f.when(draft))
        .map((f) => (
          <Field key={f.key} label={f.label}>
            {f.kind === "select" && f.groups ? (
              <select className="mh-sa__input" value={draft[f.key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}>
                {f.all ? <option value="">{f.all}</option> : null}
                {f.groups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : f.kind === "select" ? (
              <Select value={draft[f.key] ?? ""} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} options={f.options?.(meta) ?? []} all={f.all} />
            ) : (
              <input className="mh-sa__input" type={f.kind === "date" ? "date" : "text"} value={draft[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
            )}
          </Field>
        ))}
      <div className="fn-filters__go">
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function FinTable<T extends { id: string }>({ rows, columns, ctx, actions, empty, select }: { rows: T[]; columns: Column<T>[]; ctx: ListCtx; actions?: (r: T) => ReactNode; empty: string; select?: { ids: string[]; set: (ids: string[]) => void } }) {
  const allOn = select && rows.length > 0 && rows.every((r) => select.ids.includes(r.id));
  return (
    <div className="mh-sa__table-wrap">
      <table className="mh-sa__table lx-table fn-table">
        <thead>
          <tr>
            {select ? (
              <th className="fn-check">
                <input type="checkbox" aria-label="Select all" checked={Boolean(allOn)} onChange={(e) => select.set(e.target.checked ? rows.map((r) => r.id) : [])} />
              </th>
            ) : null}
            {columns.map((c) => (
              <th key={c.label} className={c.className}>
                {c.label}
              </th>
            ))}
            {actions ? <th className="lx-actions" aria-label="Actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {select ? (
                <td className="fn-check">
                  <input type="checkbox" aria-label="Select row" checked={select.ids.includes(r.id)} onChange={(e) => select.set(e.target.checked ? [...select.ids, r.id] : select.ids.filter((x) => x !== r.id))} />
                </td>
              ) : null}
              {columns.map((c) => (
                <td key={c.label} className={c.className}>
                  {c.render(r, ctx)}
                </td>
              ))}
              {actions ? <td className="lx-actions fn-actions">{actions(r)}</td> : null}
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0) + (select ? 1 : 0)} className="mh-sa__empty-cell">
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function LinkBtn({ children, onClick, danger, disabled }: { children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={`fn-link${danger ? " fn-link--danger" : ""}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export const Sub = ({ children }: { children: ReactNode }) => <small className="fn-sub">{children}</small>;
export const Money = ({ v, strong }: { v: unknown; strong?: boolean }) => <span className={`fn-money${Number(v) < 0 ? " fn-money--neg" : ""}`}>{strong ? <strong>{money(v)}</strong> : money(v)}</span>;
