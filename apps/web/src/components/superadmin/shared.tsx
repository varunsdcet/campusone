"use client";

import "./superadmin.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AdminSisShell } from "@/components/AdminSisShell";
import { loadSession, type Session } from "@/lib/api";

export function useAdminSession() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    const s = loadSession();
    if (!s || (!s.roles.includes("admin") && !s.roles.includes("registrar"))) {
      router.replace("/login");
      return;
    }
    setSession(s);
  }, [router]);
  return session;
}

export function SuperFrame({
  title,
  breadcrumbs,
  breadcrumbHrefs,
  activeHref,
  activeSearch,
  actions,
  children,
}: {
  title?: string;
  breadcrumbs: string[];
  breadcrumbHrefs?: Array<string | null | undefined>;
  activeHref: string;
  activeSearch?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const session = useAdminSession();
  if (!session) return null;
  return (
    <AdminSisShell
      activeHref={activeHref}
      activeSearch={activeSearch}
      breadcrumbs={breadcrumbs}
      breadcrumbHrefs={breadcrumbHrefs}
      userName={`${session.givenName} ${session.familyName}`}
    >
      <div className="mh-sa">
        {title || actions ? (
          <header className="mh-sa__head">
            {title ? <h1>{title}</h1> : <span />}
            {actions ? <div className="mh-sa__head-actions">{actions}</div> : null}
          </header>
        ) : null}
        {children}
      </div>
    </AdminSisShell>
  );
}

export function SaCard({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
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

export function SaField({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`mh-sa__field${wide ? " mh-sa__field--wide" : ""}`}>
      <span className="mh-sa__label">
        {label}
        {hint ? <em>{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

export function SaNotice({ tone, children, onClose }: { tone: "success" | "error"; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`mh-sa__notice mh-sa__notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span>{children}</span>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      ) : null}
    </div>
  );
}

export function SaModal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  useEffect(() => setPortalRoot(document.body), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!portalRoot) return null;
  return createPortal(
    <div className="mh-sa-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="mh-sa-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className={`mh-sa-modal__panel${wide ? " mh-sa-modal__panel--wide" : ""}`}>
        <header className="mh-sa-modal__head">
          <h2>{title}</h2>
          <button type="button" className="mh-sa-modal__x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="mh-sa-modal__body">{children}</div>
        {footer ? <footer className="mh-sa-modal__foot">{footer}</footer> : null}
      </div>
    </div>,
    portalRoot,
  );
}

/* ------------------------------------------------------------------ */
/* Rich text                                                           */
/* ------------------------------------------------------------------ */

const ALLOWED_TAGS = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "UL", "OL", "LI", "SPAN", "FONT", "BLOCKQUOTE"]);
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "TEMPLATE", "SVG", "MATH"]);
const ALLOWED_STYLES = new Set(["text-align", "font-family", "font-size", "font-weight", "font-style", "text-decoration", "margin-left", "padding-left"]);

export function sanitizeHtml(html: string): string {
  if (!html || typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return "";
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (DROP_TAGS.has(child.tagName)) {
        child.remove();
        continue;
      }
      walk(child);
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (name === "style") {
          const kept = attr.value
            .split(";")
            .map((d) => d.trim())
            .filter((d) => {
              const [prop, ...rest] = d.split(":");
              const value = rest.join(":").toLowerCase();
              return ALLOWED_STYLES.has(prop?.trim().toLowerCase() ?? "") && !value.includes("url(") && !value.includes("expression");
            })
            .join("; ");
          if (kept) child.setAttribute("style", kept);
          else child.removeAttribute("style");
        } else if (child.tagName === "FONT" && (name === "face" || name === "size")) {
          continue;
        } else {
          child.removeAttribute(attr.name);
        }
      }
    }
  };
  walk(root);
  return root.innerHTML;
}

export function SafeHtml({ html, empty = "No content available." }: { html: string; empty?: string }) {
  const [clean, setClean] = useState("");
  useEffect(() => setClean(sanitizeHtml(html)), [html]);
  const hasText = clean.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
  if (!hasText) return <p className="mh-sa__empty">{empty}</p>;
  return <div className="mh-sa__rich" dangerouslySetInnerHTML={{ __html: clean }} />;
}

const FONTS = ["Arial", "Georgia", "Helvetica", "Times New Roman", "Trebuchet MS", "Verdana", "Courier New"];
const SIZES = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "5" },
  { label: "Huge", value: "6" },
];

function ToolBtn({ cmd, label, children, onRun }: { cmd: string; label: string; children: ReactNode; onRun: (cmd: string) => void }) {
  return (
    <button
      type="button"
      className="mh-sa-rte__btn"
      title={label}
      aria-label={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onRun(cmd);
      }}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, label }: { value: string; onChange: (html: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const initial = useRef(value);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeHtml(initial.current);
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");
  const run = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  return (
    <div className="mh-sa-rte">
      <div className="mh-sa-rte__bar" role="toolbar" aria-label={`${label} formatting`}>
        <select aria-label="Font" defaultValue="" onChange={(e) => e.target.value && run("fontName", e.target.value)}>
          <option value="" disabled>
            Font
          </option>
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select aria-label="Font size" defaultValue="" onChange={(e) => e.target.value && run("fontSize", e.target.value)}>
          <option value="" disabled>
            Size
          </option>
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="mh-sa-rte__sep" />
        <ToolBtn cmd="bold" label="Bold" onRun={run}>
          <b>B</b>
        </ToolBtn>
        <ToolBtn cmd="italic" label="Italic" onRun={run}>
          <i>I</i>
        </ToolBtn>
        <ToolBtn cmd="underline" label="Underline" onRun={run}>
          <u>U</u>
        </ToolBtn>
        <ToolBtn cmd="strikeThrough" label="Strikethrough" onRun={run}>
          <s>S</s>
        </ToolBtn>
        <span className="mh-sa-rte__sep" />
        <ToolBtn cmd="justifyLeft" label="Align left" onRun={run}>
          ⫷
        </ToolBtn>
        <ToolBtn cmd="justifyCenter" label="Align center" onRun={run}>
          ≡
        </ToolBtn>
        <ToolBtn cmd="justifyRight" label="Align right" onRun={run}>
          ⫸
        </ToolBtn>
        <ToolBtn cmd="justifyFull" label="Justify" onRun={run}>
          ☰
        </ToolBtn>
        <span className="mh-sa-rte__sep" />
        <ToolBtn cmd="insertUnorderedList" label="Bulleted list" onRun={run}>
          •
        </ToolBtn>
        <ToolBtn cmd="insertOrderedList" label="Numbered list" onRun={run}>
          1.
        </ToolBtn>
        <ToolBtn cmd="outdent" label="Decrease indent" onRun={run}>
          ⇤
        </ToolBtn>
        <ToolBtn cmd="indent" label="Increase indent" onRun={run}>
          ⇥
        </ToolBtn>
        <span className="mh-sa-rte__sep" />
        <ToolBtn cmd="removeFormat" label="Clear formatting" onRun={run}>
          Tx
        </ToolBtn>
        <ToolBtn cmd="undo" label="Undo" onRun={run}>
          ↶
        </ToolBtn>
        <ToolBtn cmd="redo" label="Redo" onRun={run}>
          ↷
        </ToolBtn>
      </div>
      <div
        ref={ref}
        className="mh-sa-rte__area"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
      />
    </div>
  );
}
