"use client";

import "../superadmin/superadmin.css";
import "../location/location.css";
import "../programs/programs.css";
import "./students.css";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { SaModal, SuperFrame } from "@/components/superadmin/shared";
import { Pager, errMsg, fmtSize, str, useNotice } from "@/components/location/shared";
import { api, loadSession } from "@/lib/api";
import { refreshNavCounts } from "@/lib/navCounts";

export { Pager, errMsg, fmtSize, str, useNotice, SaModal, refreshNavCounts };

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

export const BASE = "/admin/student-management";

let metaCache: Promise<StudentsMeta> | null = null;

export function stu<T>(path: string, init?: RequestInit) {
  return api<T>(`/admin/heritage/students${path}`, init ?? {}, loadSession()?.accessToken);
}

export function send<T = unknown>(path: string, method: "POST" | "PUT" | "DELETE", body?: unknown) {
  return stu<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then((out) => {
    refreshNavCounts();
    return out;
  });
}

export const qs = (q: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export type Named = { id: string; name: string };
export type StatusNode = { name: string; parent: string | null; children: string[] };
export type StudentsMeta = {
  statusTree: StatusNode[];
  statuses: string[];
  programs: Array<Named & { abbreviation: string }>;
  schedules: Array<Named & { program: string; description: string }>;
  pathways: Array<Named & { program: string }>;
  terms: Array<Named & { startDate: string; endDate: string }>;
  admissionTerms: string[];
  campuses: string[];
  countries: Array<{ name: string; regions: string[] }>;
  advisors: Named[];
  agents: Named[];
  flagTemplates: Array<Named & { message: string }>;
  correspondence: { categories: Named[]; types: Array<Named & { categories: string[] }> };
  documentTemplates: Array<Named & { documentType: string; inputs: string[] }>;
  capturedDocumentGroups: string[];
  notificationTemplates: Array<Named & { subject: string; body: string }>;
  documentTypes: Named[];
  workflows: Named[];
  badges: Named[];
  entryTests: Named[];
  options: Record<string, string[]> & { transcriptOptions: Array<{ key: string; label: string }> };
};

export function useStudentsMeta() {
  const [meta, setMeta] = useState<StudentsMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    metaCache ??= stu<StudentsMeta>("/meta");
    metaCache
      .then((m) => live && setMeta(m))
      .catch((e) => {
        metaCache = null;
        if (live) setError(errMsg(e, "Could not load Student Management"));
      });
    return () => {
      live = false;
    };
  }, []);
  return { meta, error };
}

/** Loads a GET endpoint and exposes reload; `deps` re-trigger loading. */
export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setError(null);
    stu<T>(path)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errMsg(e, "Could not load")));
    return () => {
      live = false;
    };
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload, setData };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                           */
/* ------------------------------------------------------------------ */

export const money = (v: unknown) => `$${(Number(v) || 0).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
};
export const fmtStamp = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
export const today = () => new Date().toISOString().slice(0, 10);

export const profileHref = (id: string, tab = "status", sub = "overview") => `${BASE}/student/${encodeURIComponent(id)}/${tab}/${sub}`;

/* ------------------------------------------------------------------ */
/* Frame                                                                */
/* ------------------------------------------------------------------ */

/** Admin shell for Student Management pages; `nav` is the sidebar entry to highlight. */
export function StuFrame({ title, crumbs, nav, actions, children }: { title?: string; crumbs: string[]; nav: string; actions?: ReactNode; children: ReactNode }) {
  const sp = useSearchParams();
  const [path, search = ""] = nav.split("?");
  return (
    <SuperFrame title={title} breadcrumbs={["Students", ...crumbs]} breadcrumbHrefs={[`${BASE}/browse`]} activeHref={path!} activeSearch={search || (path === `${BASE}/browse` ? "" : sp?.toString() ?? "")} actions={actions}>
      {children}
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Small controls                                                       */
/* ------------------------------------------------------------------ */

export function Req() {
  return <span className="lx-req">*</span>;
}

export function F({ label, req, wide, hint, children }: { label: string; req?: boolean; wide?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className={`mh-sa__field${wide ? " mh-sa__field--wide" : ""}`}>
      <span className="mh-sa__label">
        {label}
        {req ? <Req /> : null}
      </span>
      {children}
      {hint ? <span className="lx-hint">{hint}</span> : null}
    </label>
  );
}

export function Sel({ value, onChange, options, empty, label, disabled }: { value: string; onChange: (v: string) => void; options: Array<string | { value: string; label: string }>; empty?: string; label?: string; disabled?: boolean }) {
  return (
    <select className="mh-sa__input" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {empty !== undefined ? <option value="">{empty}</option> : null}
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
}

export function Txt({ value, onChange, placeholder, type = "text", label }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; label?: string }) {
  return <input className="mh-sa__input" type={type} aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="mh-sa__check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {children}
    </label>
  );
}

export function Btn({ children, onClick, tone, small, disabled, type = "button" }: { children: ReactNode; onClick?: () => void; tone?: "primary" | "danger"; small?: boolean; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} disabled={disabled} className={`mh-sa__btn${small ? " mh-sa__btn--sm" : ""}${tone ? ` mh-sa__btn--${tone}` : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function LinkBtn({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className={`st-link${danger ? " st-link--danger" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function Card({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mh-sa__card${className ? ` ${className}` : ""}`}>
      {title || actions ? (
        <div className="mh-sa__card-head">
          {title ? <h2>{title}</h2> : <span />}
          {actions ? <div className="mh-sa__card-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="mh-sa__grid lx-grid">{children}</div>;
}

export function Filters({ children, onSubmit, submit }: { children: ReactNode; onSubmit: () => void; submit: string }) {
  return (
    <form
      className="st-filters"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="st-filters__grid">{children}</div>
      <div className="st-filters__actions">
        <Btn type="submit" tone="primary">
          {submit}
        </Btn>
      </div>
    </form>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="pm-empty">{children}</p>;
}

export function ErrorLine({ children }: { children: ReactNode }) {
  return children ? (
    <p className="pm-error" role="alert">
      {children}
    </p>
  ) : null;
}

/** Marks a flow whose follow-on form / output was not captured from the original system. */
export function SourceNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="st-source" role="note">
      <strong>Source confirmation required.</strong> {children ?? "The follow-on form and result for this step were not captured from the original system, so no fields have been assumed."}
    </div>
  );
}

export function Table({ head, children, empty, colSpan }: { head: ReactNode[]; children: ReactNode; empty?: string | false; colSpan?: number }) {
  const hasRows = Array.isArray(children) ? children.flat().filter(Boolean).length > 0 : Boolean(children);
  return (
    <div className="mh-sa__table-wrap">
      <table className="mh-sa__table lx-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasRows ? (
            children
          ) : empty ? (
            <tr>
              <td colSpan={colSpan ?? head.length} className="st-empty-cell">
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function Letters({ value, onChange }: { value: string; onChange: (l: string) => void }) {
  return (
    <div className="st-letters" role="group" aria-label="Filter by last name">
      {["", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((l) => (
        <button key={l || "all"} type="button" className={value === l ? "is-active" : ""} aria-pressed={value === l} onClick={() => onChange(l)}>
          {l || "ALL"}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <SaModal title={title} onClose={onClose} footer={footer} wide={wide}>
      {children}
    </SaModal>
  );
}

export function ConfirmModal({ title, body, ok, cancel = "Cancel", onOk, onCancel, danger = true }: { title: string; body: ReactNode; ok: string; cancel?: string; onOk: () => void; onCancel: () => void; danger?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Btn onClick={onCancel}>{cancel}</Btn>
          <Btn
            tone={danger ? "danger" : "primary"}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              Promise.resolve(onOk()).finally(() => setBusy(false));
            }}
          >
            {ok}
          </Btn>
        </>
      }
    >
      <div>{body}</div>
    </Modal>
  );
}

/** Async submit helper for modals: tracks busy + error, closes on success. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>, fallback = "Save failed") => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(errMsg(e, fallback));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}

/* ------------------------------------------------------------------ */
/* Files                                                                */
/* ------------------------------------------------------------------ */

export type PendingFile = { name: string; mime: string; size: number; base64: string };
export type FileRef = { id: string; name: string; size: number; mime?: string };

const MAX_FILE = 8 * 1024 * 1024;

function readAsBase64(file: File) {
  return new Promise<PendingFile>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, base64: String(r.result).split(",")[1] ?? "" });
    r.onerror = () => reject(new Error(`Could not read ${file.name}`));
    r.readAsDataURL(file);
  });
}

/** Add/Browse + drag/drop file area; files are kept in memory until the form is saved. */
export function FileDrop({ files, onChange, max = 10, label = "Add / Browse" }: { files: PendingFile[]; onChange: (f: PendingFile[]) => void; max?: number; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const picked = Array.from(list);
    const tooBig = picked.find((f) => f.size > MAX_FILE);
    if (tooBig) {
      setError(`${tooBig.name} is larger than 8 MB`);
      return;
    }
    if (files.length + picked.length > max) {
      setError(`You can attach at most ${max} file${max === 1 ? "" : "s"}`);
      return;
    }
    try {
      onChange([...files, ...(await Promise.all(picked.map(readAsBase64)))]);
    } catch (e) {
      setError(errMsg(e, "Could not read file"));
    }
  };
  return (
    <div
      className={`st-drop${over ? " is-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void addFiles(e.dataTransfer.files);
      }}
    >
      <input ref={input} type="file" hidden multiple={max > 1} accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => void addFiles(e.target.files).then(() => (e.target.value = ""))} />
      <Btn small onClick={() => input.current?.click()}>
        {label}
      </Btn>
      <span className="mh-sa__muted">or drag and drop files here</span>
      {files.length ? (
        <ul className="st-files">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              {f.name} <span className="mh-sa__muted">({fmtSize(f.size)})</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <span className="st-file-error">{error}</span> : null}
    </div>
  );
}

/** Types a browser renders without running script; anything else (HTML, SVG, XML…) is only ever saved to disk. */
const INLINE_SAFE = /^(application\/pdf|image\/(png|jpe?g|gif|webp)|text\/plain)$/i;

export function downloadBase64(name: string, mime: string, base64: string, open = false) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const inline = open && INLINE_SAFE.test(mime.trim());
  const url = URL.createObjectURL(new Blob([bytes], { type: inline ? mime : "application/octet-stream" }));
  if (inline) window.open(url, "_blank", "noopener");
  else {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadStudentFile(studentId: string, file: FileRef) {
  const f = await stu<{ name: string; mime: string; base64: string }>(`/${encodeURIComponent(studentId)}/files/${encodeURIComponent(file.id)}`);
  downloadBase64(f.name, f.mime, f.base64);
}

/** Uploads in-memory files for a student and returns their stored references. */
export async function uploadAll(studentId: string, files: PendingFile[]) {
  const out: FileRef[] = [];
  for (const f of files) out.push(await send<FileRef>(`/${encodeURIComponent(studentId)}/files`, "POST", { name: f.name, mime: f.mime, base64: f.base64 }));
  return out;
}

export function FileLinks({ studentId, files }: { studentId: string; files: FileRef[] }) {
  if (!files.length) return <span className="mh-sa__muted">—</span>;
  return (
    <span className="st-file-links">
      {files.map((f) => (
        <button key={f.id} type="button" className="st-link" onClick={() => void downloadStudentFile(studentId, f)}>
          {f.name}
        </button>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Rich text (shared editor + safe display)                             */
/* ------------------------------------------------------------------ */

export { RichTextEditor, SafeHtml } from "@/components/superadmin/shared";

/* ------------------------------------------------------------------ */
/* Paging                                                               */
/* ------------------------------------------------------------------ */

export type Paged<T> = { items: T[]; total: number; page: number; perPage: number; pages: number };

export function usePaging(initialPer = 25) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(initialPer);
  return {
    page,
    perPage,
    setPage,
    setPerPage: (n: number) => {
      setPerPage(n);
      setPage(1);
    },
    reset: () => setPage(1),
  };
}

export function PagerFor({ data, paging }: { data: Paged<unknown> | null; paging: ReturnType<typeof usePaging> }) {
  if (!data) return null;
  return <Pager total={data.total} page={data.page} pages={Math.max(1, data.pages)} perPage={data.perPage} onPage={paging.setPage} onPerPage={paging.setPerPage} />;
}
