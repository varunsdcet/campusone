"use client";

import "../superadmin/superadmin.css";
import "./location.css";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { SaModal, SaNotice } from "@/components/superadmin/shared";
import { API_URL, ApiError, api, loadSession } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

export type Kind = "text" | "email" | "domain" | "number" | "date" | "select" | "bool" | "multi" | "textarea" | "html" | "file" | "files" | "ref" | "map" | "secret";
export type RefTarget = "brands" | "regions" | "provinces" | "campuses" | "classroomTypes" | "course";
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
};
export type Meta = {
  entities: Record<string, { label: string; fields: Field[] }>;
  settings: Record<string, { label: string; save: string; fields: Field[] }>;
  lists: Record<string, string[]>;
  courses: Array<{ id: string; label: string }>;
  weekdays: string[];
};
export type Data = Record<string, unknown>;
export type Row = Data & { id: string; parentId?: string };
export type Listing = { items: Row[]; total: number; page: number; perPage: number; pages: number };
export type FileRef = { id: string; name: string; size: number; mime: string };
export type RefOptions = Partial<Record<RefTarget, Array<{ id: string; label: string }>>>;

export const lx = <T,>(path: string, init?: RequestInit) => api<T>(`/admin/heritage/location${path}`, init ?? {}, loadSession()?.accessToken);
export const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);
export const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

let metaCache: Promise<Meta> | null = null;
export function useLocationMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    metaCache ??= lx<Meta>("/meta");
    metaCache.then(setMeta).catch((e) => {
      metaCache = null;
      setError(errMsg(e, "Could not load Location Management"));
    });
  }, []);
  return { meta, error };
}

export async function loadRefOptions(targets: RefTarget[], meta: Meta): Promise<RefOptions> {
  const out: RefOptions = {};
  const slug: Record<Exclude<RefTarget, "course">, string> = { brands: "brands", regions: "regions", provinces: "provinces", campuses: "campuses", classroomTypes: "classroom-types" };
  await Promise.all(
    targets.map(async (t) => {
      if (t === "course") {
        out.course = meta.courses;
        return;
      }
      const r = await lx<Listing>(`/${slug[t]}`);
      out[t] = r.items.map((i) => ({ id: i.id, label: t === "campuses" ? str(i._display || i.name) : str(i.name) }));
    }),
  );
  return out;
}

export function useNotice() {
  const sp = useSearchParams();
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(sp?.get("notice") ? { tone: "success", text: sp.get("notice")! } : null);
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

export function ConfirmDelete({ title, body, onCancel, onOk, okLabel = "Delete" }: { title: string; body: ReactNode; onCancel: () => void; onOk: () => void; okLabel?: string }) {
  return (
    <SaModal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="mh-sa__btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="mh-sa__btn mh-sa__btn--danger" onClick={onOk}>
            {okLabel}
          </button>
        </>
      }
    >
      {typeof body === "string" ? <p>{body}</p> : <div>{body}</div>}
    </SaModal>
  );
}

export function initialValues(fields: Field[], base?: Data): Data {
  const out: Data = {};
  for (const f of fields) out[f.key] = base && f.key in base ? base[f.key] : f.dflt !== undefined ? f.dflt : f.kind === "bool" ? false : f.kind === "multi" || f.kind === "files" ? [] : f.kind === "file" ? null : f.kind === "map" ? {} : "";
  if (base) for (const k of ["hasPassword"]) if (k in base) out[k] = base[k];
  return out;
}

export function applies(f: Field, values: Data) {
  if (!f.when) return true;
  const v = values[f.when.key];
  const hit = Array.isArray(f.when.equals) ? f.when.equals.includes(v as string) : v === f.when.equals;
  return f.when.not ? !hit : hit;
}

/** Client-side mirror of the server's required checks so users get instant feedback. */
export function missingRequired(fields: Field[], values: Data) {
  return fields
    .filter((f) => f.required && applies(f, values))
    .filter((f) => {
      const v = values[f.key];
      if (f.kind === "multi" || f.kind === "files") return !Array.isArray(v) || v.length === 0;
      if (f.kind === "file") return !v;
      return v === null || v === undefined || String(v).trim() === "";
    })
    .map((f) => f.label);
}

/* ------------------------------------------------------------------ */
/* Field controls                                                       */
/* ------------------------------------------------------------------ */

export function optionsFor(f: Field, meta: Meta) {
  return [...(f.dynExtra ?? []), ...(f.options ?? (f.dyn ? (meta.lists[f.dyn] ?? []) : []))];
}

export function FieldControl({
  field: f,
  value,
  values,
  onChange,
  meta,
  refs,
  accept,
  bare,
}: {
  field: Field;
  value: unknown;
  values: Data;
  onChange: (v: unknown) => void;
  meta: Meta;
  refs?: RefOptions;
  accept?: string;
  bare?: boolean;
}) {
  const id = `lx-${f.key}`;
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
            onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value)}
          />
          {f.suffix ? <span className="lx-num__suffix">{f.suffix}</span> : null}
        </span>
      );
      break;
    case "date":
      control = <input id={id} className="mh-sa__input" type="date" value={str(value)} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "select": {
      const opts = optionsFor(f, meta);
      const v = str(value);
      control = (
        <select id={id} className="mh-sa__input" value={v} onChange={(e) => onChange(e.target.value)}>
          {!f.required || !v ? <option value="">{f.required ? "— Select —" : "— None —"}</option> : null}
          {v && !opts.includes(v) ? <option value={v}>{v}</option> : null}
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "ref": {
      const opts = refs?.[f.ref!] ?? [];
      const v = str(value);
      control = (
        <select id={id} className="mh-sa__input" value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">{f.required ? "— Select —" : "— None —"}</option>
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
    case "secret":
      control = (
        <input
          id={id}
          className="mh-sa__input"
          type="password"
          autoComplete="new-password"
          value={str(value)}
          placeholder={values.hasPassword ? "Saved — leave blank to keep it" : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "file":
    case "files":
      control = <FileUpload multiple={f.kind === "files"} value={value} onChange={onChange} accept={accept} label={f.label} />;
      break;
    case "html":
      control = <StatementEditor value={str(value)} onChange={(v) => onChange(v)} label={f.label} />;
      break;
    default:
      control = (
        <input
          id={id}
          className="mh-sa__input"
          type={f.kind === "email" ? "email" : "text"}
          value={str(value)}
          placeholder={f.kind === "domain" ? "e.g. myhccbc.com" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
  if (bare || f.kind === "bool") return <>{control}</>;
  return (
    <div className={`mh-sa__field${f.kind === "textarea" || f.kind === "html" || f.kind === "multi" || f.kind === "files" ? " mh-sa__field--wide" : ""}`}>
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

/** Renders the fields of one section, grouping paired controls (e.g. Students / Staff) on one row. */
export function FieldGrid({ fields, values, setValue, meta, refs, accept }: { fields: Field[]; values: Data; setValue: (k: string, v: unknown) => void; meta: Meta; refs?: RefOptions; accept?: Record<string, string> }) {
  const out: ReactNode[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    if (!applies(f, values)) continue;
    if (f.group) {
      if (seen.has(f.group)) continue;
      seen.add(f.group);
      const members = fields.filter((x) => x.group === f.group);
      out.push(
        <div key={f.group} className="mh-sa__field lx-group">
          <span className="mh-sa__label">{f.group}</span>
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
    out.push(<FieldControl key={f.key} field={f} value={values[f.key]} values={values} onChange={(v) => setValue(f.key, v)} meta={meta} refs={refs} accept={accept?.[f.key]} />);
  }
  return <div className="mh-sa__grid lx-grid">{out}</div>;
}

export function sectionsOf(fields: Field[]) {
  const order: string[] = [];
  for (const f of fields) if (f.section && !order.includes(f.section)) order.push(f.section);
  return order.map((name) => ({ name, fields: fields.filter((f) => f.section === name) }));
}

/* ------------------------------------------------------------------ */
/* File upload: drag & drop, Add / Browse, size + progress              */
/* ------------------------------------------------------------------ */

const MAX_FILE = 8 * 1024 * 1024;
export const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

const LOCATION_FILES = "/admin/heritage/location/files";

function sendFile(file: File, base64: string, onProgress: (pct: number) => void, endpoint: string) {
  return new Promise<FileRef>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL.replace(/\/$/, "")}${endpoint}`);
    xhr.setRequestHeader("content-type", "application/json");
    const token = loadSession()?.accessToken;
    if (token) xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body: { error?: { message?: string }; message?: string } & Partial<FileRef> = {};
      try {
        body = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as FileRef);
      else reject(new Error(body.error?.message ?? body.message ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.send(JSON.stringify({ name: file.name, mime: file.type || "application/octet-stream", base64 }));
  });
}

export async function downloadFile(id: string, endpoint = LOCATION_FILES) {
  const f = await api<{ name: string; mime: string; base64: string }>(`${endpoint}/${id}`, {}, loadSession()?.accessToken);
  const bytes = Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: f.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = f.name;
  a.click();
  URL.revokeObjectURL(url);
}

export function FileUpload({
  value,
  onChange,
  multiple,
  accept,
  label,
  endpoint = LOCATION_FILES,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  multiple?: boolean;
  accept?: string;
  label: string;
  endpoint?: string;
}) {
  const files: FileRef[] = multiple ? (Array.isArray(value) ? (value as FileRef[]) : []) : value ? [value as FileRef] : [];
  const [uploads, setUploads] = useState<Array<{ key: string; name: string; size: number; pct: number; error?: string }>>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const current = useRef(files);
  current.current = files;

  async function add(list: FileList | null) {
    if (!list?.length) return;
    const picked = multiple ? Array.from(list) : [list[0]!];
    for (const file of picked) {
      const key = `${file.name}-${file.size}-${Date.now()}`;
      if (file.size > MAX_FILE) {
        setUploads((u) => [...u, { key, name: file.name, size: file.size, pct: 0, error: "Larger than 8 MB" }]);
        continue;
      }
      if (accept?.startsWith("image") && !file.type.startsWith("image/")) {
        setUploads((u) => [...u, { key, name: file.name, size: file.size, pct: 0, error: "Choose an image file" }]);
        continue;
      }
      setUploads((u) => [...u, { key, name: file.name, size: file.size, pct: 0 }]);
      try {
        const ref = await sendFile(file, await readBase64(file), (pct) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, pct } : x))), endpoint);
        setUploads((u) => u.filter((x) => x.key !== key));
        onChange(multiple ? [...current.current, ref] : ref);
      } catch (e) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: errMsg(e, "Upload failed") } : x)));
      }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div
      className={`lx-upload${drag ? " is-drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void add(e.dataTransfer.files);
      }}
    >
      <input ref={input} type="file" hidden multiple={multiple} accept={accept} aria-label={label} onChange={(e) => void add(e.target.files)} />
      <div className="lx-upload__drop">
        <span>{multiple ? "Drag & drop files here, or" : "Drag & drop a file here, or"}</span>
        <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => input.current?.click()}>
          {files.length && !multiple ? "Replace / Browse" : multiple || accept?.startsWith("image") ? "Add / Browse" : "Choose File"}
        </button>
        <span className="mh-sa__muted lx-upload__limit">Max 8 MB per file</span>
      </div>
      {files.length || uploads.length ? (
        <ul className="lx-upload__list">
          {files.map((f) => (
            <li key={f.id}>
              <button type="button" className="mh-sa__link lx-upload__name" onClick={() => void downloadFile(f.id, endpoint)}>
                {f.name}
              </button>
              <span className="mh-sa__muted">{fmtSize(f.size)}</span>
              <span className="lx-upload__bar">
                <span style={{ width: "100%" }} />
              </span>
              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => onChange(multiple ? files.filter((x) => x.id !== f.id) : null)}>
                Remove
              </button>
            </li>
          ))}
          {uploads.map((u) => (
            <li key={u.key} className={u.error ? "is-error" : undefined}>
              <span className="lx-upload__name">{u.name}</span>
              <span className="mh-sa__muted">{fmtSize(u.size)}</span>
              <span className="lx-upload__bar" aria-label={`Upload ${u.pct}%`}>
                <span style={{ width: `${u.error ? 100 : u.pct}%` }} />
              </span>
              {u.error ? (
                <span className="lx-upload__err">
                  {u.error}{" "}
                  <button type="button" className="mh-sa__link" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}>
                    dismiss
                  </button>
                </span>
              ) : (
                <span className="mh-sa__muted">{u.pct}%</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Accessibility Statement editor                                       */
/* ------------------------------------------------------------------ */

const FONTS = ["Arial", "Georgia", "Helvetica", "Times New Roman", "Trebuchet MS", "Verdana", "Courier New"];
const SIZES = [
  { label: "8pt", value: "1" },
  { label: "10pt", value: "2" },
  { label: "12pt", value: "3" },
  { label: "14pt", value: "4" },
  { label: "18pt", value: "5" },
  { label: "24pt", value: "6" },
  { label: "36pt", value: "7" },
];
const ALLOWED = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "UL", "OL", "LI", "SPAN", "FONT", "BLOCKQUOTE", "A", "IMG", "H1", "H2", "H3", "H4"]);
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "TEMPLATE", "SVG", "MATH", "FORM", "INPUT", "BUTTON"]);
const STYLES = new Set(["text-align", "font-family", "font-size", "font-weight", "font-style", "text-decoration", "margin-left", "padding-left", "color", "background-color"]);

export function cleanStatement(html: string) {
  if (!html || typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return "";
  const safeUrl = (u: string, img: boolean) => /^(https?:|mailto:)/i.test(u.trim()) || (img && /^data:image\/(png|jpe?g|gif|webp);/i.test(u.trim()));
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (DROP.has(child.tagName)) {
        child.remove();
        continue;
      }
      walk(child);
      if (!ALLOWED.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const n = attr.name.toLowerCase();
        if (n === "style") {
          const kept = attr.value
            .split(";")
            .map((d) => d.trim())
            .filter((d) => STYLES.has(d.split(":")[0]?.trim().toLowerCase() ?? "") && !/url\(|expression/i.test(d))
            .join("; ");
          if (kept) child.setAttribute("style", kept);
          else child.removeAttribute("style");
        } else if (child.tagName === "A" && n === "href" && safeUrl(attr.value, false)) {
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        } else if (child.tagName === "A" && (n === "target" || n === "rel")) {
          continue;
        } else if (child.tagName === "IMG" && n === "src" && safeUrl(attr.value, true)) {
          continue;
        } else if (child.tagName === "IMG" && (n === "alt" || n === "width" || n === "height")) {
          continue;
        } else if (child.tagName === "FONT" && (n === "face" || n === "size" || n === "color")) {
          continue;
        } else child.removeAttribute(attr.name);
      }
    }
  };
  walk(root);
  return root.innerHTML;
}

function Tool({ label, onRun, children, active }: { label: string; onRun: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      className={`mh-sa-rte__btn${active ? " is-active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault();
        onRun();
      }}
    >
      {children}
    </button>
  );
}

export function StatementEditor({ value, onChange, label }: { value: string; onChange: (html: string) => void; label: string }) {
  const area = useRef<HTMLDivElement>(null);
  const initial = useRef(value);
  const [source, setSource] = useState(false);
  const [html, setHtml] = useState(value);
  const [full, setFull] = useState(false);
  const [spell, setSpell] = useState(true);
  const [prompt, setPrompt] = useState<null | { kind: "link" | "image"; value: string; alt: string }>(null);
  const saved = useRef<Range | null>(null);

  useEffect(() => {
    if (area.current) area.current.innerHTML = cleanStatement(initial.current);
  }, []);

  const emit = () => {
    const v = area.current?.innerHTML ?? "";
    setHtml(v);
    onChange(v);
  };
  const run = (cmd: string, arg?: string) => {
    area.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(cmd, false, arg);
    emit();
  };
  const remember = () => {
    const sel = window.getSelection();
    saved.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  };
  const restore = () => {
    area.current?.focus();
    const sel = window.getSelection();
    if (saved.current && sel) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
  };
  const toggleSource = () => {
    if (source) {
      const clean = cleanStatement(html);
      setSource(false);
      setTimeout(() => {
        if (area.current) area.current.innerHTML = clean;
        onChange(clean);
        setHtml(clean);
      }, 0);
    } else {
      setHtml(area.current?.innerHTML ?? html);
      setSource(true);
    }
  };
  const text = (source ? html.replace(/<[^>]*>/g, " ") : (area.current?.innerText ?? html.replace(/<[^>]*>/g, " "))).replace(/&nbsp;/g, " ");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className={`mh-sa-rte lx-rte${full ? " is-full" : ""}`}>
      <div className="mh-sa-rte__bar" role="toolbar" aria-label={`${label} formatting`}>
        <Tool label={source ? "Back to editor" : "Source / HTML"} onRun={toggleSource} active={source}>
          {"</>"}
        </Tool>
        <span className="mh-sa-rte__sep" />
        <Tool label="Align left" onRun={() => run("justifyLeft")}>
          ⫷
        </Tool>
        <Tool label="Align centre" onRun={() => run("justifyCenter")}>
          ≡
        </Tool>
        <Tool label="Align right" onRun={() => run("justifyRight")}>
          ⫸
        </Tool>
        <Tool label="Justify" onRun={() => run("justifyFull")}>
          ☰
        </Tool>
        <span className="mh-sa-rte__sep" />
        <Tool label="Bulleted list" onRun={() => run("insertUnorderedList")}>
          •
        </Tool>
        <Tool label="Numbered list" onRun={() => run("insertOrderedList")}>
          1.
        </Tool>
        <Tool label="Decrease indent" onRun={() => run("outdent")}>
          ⇤
        </Tool>
        <Tool label="Increase indent" onRun={() => run("indent")}>
          ⇥
        </Tool>
        <span className="mh-sa-rte__sep" />
        <Tool
          label="Insert link"
          onRun={() => {
            remember();
            setPrompt({ kind: "link", value: "https://", alt: "" });
          }}
        >
          🔗
        </Tool>
        <Tool
          label="Insert image"
          onRun={() => {
            remember();
            setPrompt({ kind: "image", value: "https://", alt: "" });
          }}
        >
          🖼
        </Tool>
        <Tool label={full ? "Exit full screen" : "Full screen"} onRun={() => setFull((f) => !f)} active={full}>
          ⛶
        </Tool>
        <span className="mh-sa-rte__sep" />
        <select aria-label="Font family" defaultValue="" disabled={source} onChange={(e) => e.target.value && run("fontName", e.target.value)}>
          <option value="" disabled>
            Font Family
          </option>
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select aria-label="Font size" defaultValue="" disabled={source} onChange={(e) => e.target.value && run("fontSize", e.target.value)}>
          <option value="" disabled>
            Font Size
          </option>
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="lx-rte__color" title="Text colour">
          A
          <input type="color" aria-label="Text colour" disabled={source} onChange={(e) => run("foreColor", e.target.value)} />
        </label>
        <span className="mh-sa-rte__sep" />
        <Tool label="Bold" onRun={() => run("bold")}>
          <b>B</b>
        </Tool>
        <Tool label="Italic" onRun={() => run("italic")}>
          <i>I</i>
        </Tool>
        <Tool label="Underline" onRun={() => run("underline")}>
          <u>U</u>
        </Tool>
        <Tool label={spell ? "Spell check on" : "Spell check off"} onRun={() => setSpell((x) => !x)} active={spell}>
          ABC✓
        </Tool>
      </div>
      {prompt ? (
        <div className="lx-rte__prompt">
          <input
            className="mh-sa__input"
            autoFocus
            value={prompt.value}
            aria-label={prompt.kind === "link" ? "Link URL" : "Image URL"}
            onChange={(e) => setPrompt({ ...prompt, value: e.target.value })}
          />
          {prompt.kind === "image" ? <input className="mh-sa__input" placeholder="Alternative text" value={prompt.alt} aria-label="Alternative text" onChange={(e) => setPrompt({ ...prompt, alt: e.target.value })} /> : null}
          <button
            type="button"
            className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--primary"
            onClick={() => {
              const url = prompt.value.trim();
              if (!/^(https?:|mailto:)/i.test(url)) return;
              restore();
              if (prompt.kind === "link") run("createLink", url);
              else run("insertHTML", `<img src="${url.replace(/"/g, "&quot;")}" alt="${prompt.alt.replace(/"/g, "&quot;")}">`);
              setPrompt(null);
            }}
          >
            Insert
          </button>
          <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setPrompt(null)}>
            Cancel
          </button>
        </div>
      ) : null}
      {source ? (
        <textarea
          className="mh-sa__input lx-rte__source"
          value={html}
          spellCheck={false}
          aria-label={`${label} HTML source`}
          onChange={(e) => {
            setHtml(e.target.value);
            onChange(e.target.value);
          }}
        />
      ) : null}
      <div
        ref={area}
        hidden={source}
        className="mh-sa-rte__area lx-rte__area"
        contentEditable
        spellCheck={spell}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
      />
      <div className="lx-rte__status">
        Words: {words}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small layout helpers                                                 */
/* ------------------------------------------------------------------ */

export function FilterBar({ value, onChange, placeholder = "Enter Search Filter Here", label = "Filter", onSubmit, submitLabel }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string; onSubmit?: () => void; submitLabel?: string }) {
  return (
    <form
      className="lx-filter"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <label className="mh-sa__field">
        <span className="mh-sa__label">{label}</span>
        <input className="mh-sa__input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
      {submitLabel ? (
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
          {submitLabel}
        </button>
      ) : null}
    </form>
  );
}

export function Pager({ total, page, pages, perPage, onPage, onPerPage }: { total: number; page: number; pages: number; perPage: number; onPage: (p: number) => void; onPerPage: (n: number) => void }) {
  return (
    <div className="lx-pager">
      <span>
        Results: <strong>{total}</strong>
      </span>
      <label>
        Results per page{" "}
        <select className="mh-sa__input" value={perPage} onChange={(e) => onPerPage(Number(e.target.value))}>
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Page{" "}
        <select className="mh-sa__input" value={page} onChange={(e) => onPage(Number(e.target.value))}>
          {Array.from({ length: pages }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
