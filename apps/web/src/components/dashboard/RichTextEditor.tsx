"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { sanitizeDashboardHtml } from "@/lib/dashboard";

const BLOCK_FORMATS = [
  { label: "Paragraph", tag: "p" },
  { label: "Heading 1", tag: "h1" },
  { label: "Heading 2", tag: "h2" },
  { label: "Heading 3", tag: "h3" },
  { label: "Heading 4", tag: "h4" },
  { label: "Heading 5", tag: "h5" },
  { label: "Heading 6", tag: "h6" },
  { label: "Preformatted", tag: "pre" },
];
const FONTS = ["Arial", "Georgia", "Helvetica", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana", "Courier New"];
const SIZES = ["8pt", "10pt", "12pt", "14pt", "18pt", "24pt", "36pt"];
const MAX_IMAGE = 1_500_000;

type Dialog =
  | { kind: "link"; url: string; text: string; title: string; blank: boolean }
  | { kind: "image"; src: string; alt: string; width: string; height: string }
  | { kind: "media"; src: string; width: string; height: string }
  | { kind: "table"; rows: string; cols: string }
  | { kind: "words" };

type MenuItem = { label: string; run: () => void; active?: boolean } | "sep";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function countWords(el: HTMLElement | null) {
  const text = el?.innerText ?? "";
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Btn({ label, onRun, active, children }: { label: string; onRun: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`mh-rte__btn${active ? " is-on" : ""}`}
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

export function RichTextEditor({ value, onChange, label }: { value: string; onChange: (html: string) => void; label: string }) {
  const area = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const initial = useRef(value);
  const [source, setSource] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [path, setPath] = useState("");
  const [words, setWords] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const emit = useCallback(() => {
    const el = area.current;
    if (!el) return;
    setWords(countWords(el));
    onChange(el.innerHTML);
  }, [onChange]);

  useEffect(() => {
    if (!area.current) return;
    area.current.innerHTML = sanitizeDashboardHtml(initial.current);
    setWords(countWords(area.current));
  }, []);

  useEffect(() => {
    const onSel = () => {
      const el = area.current;
      const sel = document.getSelection();
      if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return;
      saved.current = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      const parts: string[] = [];
      let n: Node | null = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentNode;
      while (n && n !== el) {
        if (n.nodeType === Node.ELEMENT_NODE) parts.unshift((n as Element).tagName);
        n = n.parentNode;
      }
      setPath(parts.join(" » "));
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  function restore() {
    const el = area.current;
    if (!el) return;
    el.focus();
    const r = saved.current;
    if (r && el.contains(r.commonAncestorContainer)) {
      const sel = document.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
  }

  /** execCommand emits <font>; convert it to inline styles so the stored HTML stays clean. */
  function normalizeFonts() {
    const el = area.current;
    if (!el) return;
    for (const f of Array.from(el.querySelectorAll("font"))) {
      const span = document.createElement("span");
      const size = f.getAttribute("size");
      const face = f.getAttribute("face");
      const color = f.getAttribute("color");
      const pending = f.getAttribute("data-size");
      if (pending) span.style.fontSize = pending;
      else if (size) continue;
      if (face) span.style.fontFamily = face;
      if (color) span.style.color = color;
      if (f.getAttribute("style")) span.style.cssText += f.getAttribute("style");
      span.append(...Array.from(f.childNodes));
      f.replaceWith(span);
    }
  }

  function exec(cmd: string, arg?: string) {
    if (source !== null) return;
    restore();
    document.execCommand("styleWithCSS", false, cmd === "foreColor" || cmd === "hiliteColor" ? "true" : "false");
    document.execCommand(cmd, false, arg);
    normalizeFonts();
    emit();
  }

  function fontSize(pt: string) {
    if (source !== null) return;
    restore();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("fontSize", false, "7");
    for (const f of Array.from(area.current?.querySelectorAll('font[size="7"]') ?? [])) f.setAttribute("data-size", pt);
    normalizeFonts();
    emit();
  }

  function insertHtml(html: string) {
    restore();
    document.execCommand("insertHTML", false, html);
    emit();
  }

  function currentCell() {
    const n = saved.current?.startContainer ?? null;
    const el = n && (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement);
    const cell = el?.closest("td,th") ?? null;
    return cell && area.current?.contains(cell) ? (cell as HTMLTableCellElement) : null;
  }

  function tableOp(op: "rowBefore" | "rowAfter" | "colBefore" | "colAfter" | "delRow" | "delCol" | "delTable") {
    const cell = currentCell();
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = cell.closest("table")!;
    const idx = cell.cellIndex;
    const blank = (tag: string) => {
      const c = document.createElement(tag);
      c.innerHTML = "<br>";
      c.setAttribute("style", "border: 1px solid #c8cdd3; padding: 6px;");
      return c;
    };
    if (op === "rowBefore" || op === "rowAfter") {
      const fresh = document.createElement("tr");
      for (let i = 0; i < row.cells.length; i++) fresh.append(blank("td"));
      row.parentElement!.insertBefore(fresh, op === "rowBefore" ? row : row.nextSibling);
    } else if (op === "colBefore" || op === "colAfter") {
      for (const r of Array.from(table.rows)) {
        const ref = r.cells[idx] ?? null;
        r.insertBefore(blank(ref?.tagName.toLowerCase() ?? "td"), op === "colBefore" ? ref : (ref?.nextSibling ?? null));
      }
    } else if (op === "delRow") {
      if (table.rows.length <= 1) table.remove();
      else row.remove();
    } else if (op === "delCol") {
      if (row.cells.length <= 1) table.remove();
      else for (const r of Array.from(table.rows)) r.cells[idx]?.remove();
    } else {
      table.remove();
    }
    emit();
  }

  function toggleSource() {
    const el = area.current;
    if (!el) return;
    if (source === null) {
      setSource(el.innerHTML);
      return;
    }
    el.innerHTML = sanitizeDashboardHtml(source);
    setSource(null);
    emit();
  }

  function newDocument() {
    if (!area.current || !window.confirm("Clear all content in this editor?")) return;
    area.current.innerHTML = "<p><br></p>";
    emit();
  }

  function print() {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${esc(label)}</title></head><body>${sanitizeDashboardHtml(area.current?.innerHTML ?? "")}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  function openLink() {
    const sel = saved.current;
    const n = sel?.startContainer;
    const a = (n && (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement))?.closest("a");
    setDialogError(null);
    setDialog({
      kind: "link",
      url: a?.getAttribute("href") ?? "https://",
      text: a?.textContent ?? sel?.toString() ?? "",
      title: a?.getAttribute("title") ?? "",
      blank: a?.getAttribute("target") === "_blank",
    });
  }

  function applyDialog() {
    if (!dialog) return;
    setDialogError(null);
    if (dialog.kind === "link") {
      const url = dialog.url.trim();
      if (!/^(https?:\/\/.+|mailto:.+|tel:.+|\/.*|#.*)$/i.test(url)) return setDialogError("Enter a URL starting with https://, mailto:, tel: or /");
      const text = dialog.text.trim() || url;
      const attrs = `href="${esc(url)}"${dialog.title ? ` title="${esc(dialog.title)}"` : ""}${dialog.blank ? ' target="_blank" rel="noopener noreferrer"' : ""}`;
      insertHtml(`<a ${attrs}>${esc(text)}</a>`);
    } else if (dialog.kind === "image") {
      const src = dialog.src.trim();
      if (!/^(https?:\/\/|\/|data:image\/)/i.test(src)) return setDialogError("Enter an image URL (https:// or /) or upload an image");
      const size = `${/^\d+$/.test(dialog.width) ? ` width="${dialog.width}"` : ""}${/^\d+$/.test(dialog.height) ? ` height="${dialog.height}"` : ""}`;
      insertHtml(`<img src="${esc(src)}" alt="${esc(dialog.alt)}"${size} style="max-width: 100%;">`);
    } else if (dialog.kind === "media") {
      const src = dialog.src.trim();
      if (!/^(https?:\/\/|\/).+\.(mp4|webm|ogg)(\?.*)?$/i.test(src)) return setDialogError("Enter a direct link to an MP4, WebM or Ogg video file");
      const size = `${/^\d+$/.test(dialog.width) ? ` width="${dialog.width}"` : ""}${/^\d+$/.test(dialog.height) ? ` height="${dialog.height}"` : ""}`;
      insertHtml(`<video src="${esc(src)}" controls${size} style="max-width: 100%;"></video>`);
    } else if (dialog.kind === "table") {
      const rows = Number(dialog.rows);
      const cols = Number(dialog.cols);
      if (!(rows >= 1 && rows <= 30 && cols >= 1 && cols <= 12)) return setDialogError("Rows must be 1–30 and columns 1–12");
      const cell = '<td style="border: 1px solid #c8cdd3; padding: 6px;"><br></td>';
      const body = Array.from({ length: rows }, () => `<tr>${cell.repeat(cols)}</tr>`).join("");
      insertHtml(`<table style="border-collapse: collapse; width: 100%;"><tbody>${body}</tbody></table><p><br></p>`);
    }
    setDialog(null);
  }

  function onUpload(file: File | undefined) {
    if (!file || dialog?.kind !== "image") return;
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) return setDialogError("Upload a PNG, JPG, GIF or WebP image");
    if (file.size > MAX_IMAGE) return setDialogError("Images must be 1.5 MB or smaller");
    const reader = new FileReader();
    reader.onload = () => setDialog((d) => (d?.kind === "image" ? { ...d, src: String(reader.result), alt: d.alt || file.name.replace(/\.[^.]+$/, "") } : d));
    reader.readAsDataURL(file);
  }

  function openImage() {
    setDialogError(null);
    setDialog({ kind: "image", src: "", alt: "", width: "", height: "" });
  }

  function openMedia() {
    setDialogError(null);
    setDialog({ kind: "media", src: "", width: "", height: "" });
  }

  function openTable() {
    setDialogError(null);
    setDialog({ kind: "table", rows: "2", cols: "2" });
  }

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: "New document", run: newDocument },
      { label: "Print…", run: print },
    ],
    Edit: [
      { label: "Undo", run: () => exec("undo") },
      { label: "Redo", run: () => exec("redo") },
      "sep",
      { label: "Cut", run: () => exec("cut") },
      { label: "Copy", run: () => exec("copy") },
      { label: "Select all", run: () => exec("selectAll") },
    ],
    View: [
      { label: "Source code", run: toggleSource, active: source !== null },
      { label: "Show blocks", run: () => setShowBlocks((v) => !v), active: showBlocks },
      { label: "Fullscreen", run: () => setFullscreen((v) => !v), active: fullscreen },
    ],
    Insert: [
      { label: "Link…", run: openLink },
      { label: "Image…", run: openImage },
      { label: "Media…", run: openMedia },
      { label: "Table…", run: openTable },
      "sep",
      { label: "Horizontal line", run: () => exec("insertHorizontalRule") },
    ],
    Format: [
      { label: "Bold", run: () => exec("bold") },
      { label: "Italic", run: () => exec("italic") },
      { label: "Underline", run: () => exec("underline") },
      { label: "Strikethrough", run: () => exec("strikeThrough") },
      { label: "Superscript", run: () => exec("superscript") },
      { label: "Subscript", run: () => exec("subscript") },
      "sep",
      { label: "Clear formatting", run: () => exec("removeFormat") },
    ],
    Tools: [
      { label: "Source code", run: toggleSource, active: source !== null },
      { label: "Word count", run: () => setDialog({ kind: "words" }) },
    ],
    Table: [
      { label: "Insert table…", run: openTable },
      "sep",
      { label: "Insert row before", run: () => tableOp("rowBefore") },
      { label: "Insert row after", run: () => tableOp("rowAfter") },
      { label: "Insert column before", run: () => tableOp("colBefore") },
      { label: "Insert column after", run: () => tableOp("colAfter") },
      "sep",
      { label: "Delete row", run: () => tableOp("delRow") },
      { label: "Delete column", run: () => tableOp("delCol") },
      { label: "Delete table", run: () => tableOp("delTable") },
    ],
  };

  const inSource = source !== null;
  const pickOnce = (run: (v: string) => void) => (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    e.target.value = "";
    if (v) run(v);
  };

  return (
    <div className={`mh-rte${fullscreen ? " is-fullscreen" : ""}${showBlocks ? " is-blocks" : ""}`}>
      <div className="mh-rte__menubar" role="menubar" aria-label={`${label} menu`}>
        {Object.entries(menus).map(([name, items]) => (
          <div key={name} className="mh-rte__menu">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={menu === name}
              className={`mh-rte__menu-btn${menu === name ? " is-open" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                setMenu((m) => (m === name ? null : name));
              }}
            >
              {name}
            </button>
            {menu === name ? (
              <div className="mh-rte__dropdown" role="menu">
                {items.map((it, i) =>
                  it === "sep" ? (
                    <hr key={`sep-${i}`} />
                  ) : (
                    <button
                      key={it.label}
                      type="button"
                      role="menuitem"
                      className={it.active ? "is-on" : undefined}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setMenu(null);
                        it.run();
                      }}
                    >
                      {it.label}
                    </button>
                  ),
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mh-rte__toolbar" role="toolbar" aria-label={`${label} formatting`}>
        <Btn label="Undo" onRun={() => exec("undo")}>↶</Btn>
        <Btn label="Redo" onRun={() => exec("redo")}>↷</Btn>
        <span className="mh-rte__sep" />
        <select aria-label="Text style" defaultValue="" disabled={inSource} onChange={pickOnce((tag) => exec("formatBlock", `<${tag}>`))}>
          <option value="" disabled>
            Paragraph
          </option>
          {BLOCK_FORMATS.map((f) => (
            <option key={f.tag} value={f.tag}>
              {f.label}
            </option>
          ))}
        </select>
        <select aria-label="Font family" defaultValue="" disabled={inSource} onChange={pickOnce((f) => exec("fontName", f))}>
          <option value="" disabled>
            Font
          </option>
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select aria-label="Font size" defaultValue="" disabled={inSource} onChange={pickOnce(fontSize)}>
          <option value="" disabled>
            Size
          </option>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="mh-rte__sep" />
        <Btn label="Bold" onRun={() => exec("bold")}>
          <b>B</b>
        </Btn>
        <Btn label="Italic" onRun={() => exec("italic")}>
          <i>I</i>
        </Btn>
        <Btn label="Underline" onRun={() => exec("underline")}>
          <u>U</u>
        </Btn>
        <label className="mh-rte__color" title="Text colour">
          <span aria-hidden style={{ borderBottom: "3px solid #c62828" }}>A</span>
          <input type="color" aria-label="Text colour" defaultValue="#c62828" disabled={inSource} onChange={(e) => exec("foreColor", e.target.value)} />
        </label>
        <label className="mh-rte__color" title="Background colour">
          <span aria-hidden style={{ background: "#fff59d", padding: "0 3px" }}>A</span>
          <input type="color" aria-label="Background colour" defaultValue="#fff59d" disabled={inSource} onChange={(e) => exec("hiliteColor", e.target.value)} />
        </label>
        <span className="mh-rte__sep" />
        <Btn label="Align left" onRun={() => exec("justifyLeft")}>⫷</Btn>
        <Btn label="Align center" onRun={() => exec("justifyCenter")}>≡</Btn>
        <Btn label="Align right" onRun={() => exec("justifyRight")}>⫸</Btn>
        <Btn label="Justify" onRun={() => exec("justifyFull")}>☰</Btn>
        <span className="mh-rte__sep" />
        <Btn label="Bulleted list" onRun={() => exec("insertUnorderedList")}>•≡</Btn>
        <Btn label="Numbered list" onRun={() => exec("insertOrderedList")}>1≡</Btn>
        <Btn label="Decrease indent" onRun={() => exec("outdent")}>⇤</Btn>
        <Btn label="Increase indent" onRun={() => exec("indent")}>⇥</Btn>
        <span className="mh-rte__sep" />
        <Btn label="Insert/edit link" onRun={openLink}>
          <Icon d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </Btn>
        <Btn label="Insert/edit image" onRun={openImage}>
          <Icon d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01" />
        </Btn>
        <Btn label="Insert/edit media" onRun={openMedia}>
          <Icon d="M3 5h18v14H3zM10 9l5 3-5 3z" />
        </Btn>
        <Btn label="Source code" onRun={toggleSource} active={inSource}>
          {"</>"}
        </Btn>
      </div>

      <div className="mh-rte__body">
        <div
          ref={area}
          className="mh-rte__area mh-dash__rich"
          contentEditable={!inSource}
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          suppressContentEditableWarning
          hidden={inSource}
          onInput={emit}
          onBlur={emit}
        />
        {inSource ? <textarea className="mh-rte__source" aria-label={`${label} source code`} value={source} onChange={(e) => setSource(e.target.value)} /> : null}
      </div>

      <div className="mh-rte__status">
        <span className="mh-rte__path">{inSource ? "Source code" : path || "P"}</span>
        <span>{words} {words === 1 ? "word" : "words"}</span>
      </div>

      {dialog ? (
        <div className="mh-rte__dialog" role="dialog" aria-modal="true" aria-label={dialog.kind === "words" ? "Word count" : `Insert ${dialog.kind}`}>
          <div className="mh-rte__dialog-panel">
            <header>
              <strong>{dialog.kind === "words" ? "Word Count" : dialog.kind === "link" ? "Insert/Edit Link" : dialog.kind === "image" ? "Insert/Edit Image" : dialog.kind === "media" ? "Insert/Edit Media" : "Insert Table"}</strong>
              <button type="button" aria-label="Close" onClick={() => setDialog(null)}>
                ×
              </button>
            </header>
            {dialogError ? <p className="mh-rte__dialog-error">{dialogError}</p> : null}
            {dialog.kind === "words" ? (
              <dl className="mh-rte__dialog-dl">
                <dt>Words</dt>
                <dd>{words}</dd>
                <dt>Characters (no spaces)</dt>
                <dd>{(area.current?.innerText ?? "").replace(/\s/g, "").length}</dd>
                <dt>Characters</dt>
                <dd>{(area.current?.innerText ?? "").length}</dd>
              </dl>
            ) : dialog.kind === "link" ? (
              <>
                <label>
                  URL
                  <input value={dialog.url} onChange={(e) => setDialog({ ...dialog, url: e.target.value })} autoFocus />
                </label>
                <label>
                  Text to display
                  <input value={dialog.text} onChange={(e) => setDialog({ ...dialog, text: e.target.value })} />
                </label>
                <label>
                  Title
                  <input value={dialog.title} onChange={(e) => setDialog({ ...dialog, title: e.target.value })} />
                </label>
                <label className="mh-rte__dialog-check">
                  <input type="checkbox" checked={dialog.blank} onChange={(e) => setDialog({ ...dialog, blank: e.target.checked })} />
                  Open link in a new window
                </label>
              </>
            ) : dialog.kind === "image" ? (
              <>
                <label>
                  Source
                  <input value={dialog.src.startsWith("data:") ? "(uploaded image)" : dialog.src} onChange={(e) => setDialog({ ...dialog, src: e.target.value })} placeholder="https://… or /brand/…" autoFocus />
                </label>
                <label>
                  Upload
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => onUpload(e.target.files?.[0])} />
                </label>
                <label>
                  Image description
                  <input value={dialog.alt} onChange={(e) => setDialog({ ...dialog, alt: e.target.value })} />
                </label>
                <div className="mh-rte__dialog-row">
                  <label>
                    Width
                    <input inputMode="numeric" value={dialog.width} onChange={(e) => setDialog({ ...dialog, width: e.target.value })} />
                  </label>
                  <label>
                    Height
                    <input inputMode="numeric" value={dialog.height} onChange={(e) => setDialog({ ...dialog, height: e.target.value })} />
                  </label>
                </div>
              </>
            ) : dialog.kind === "media" ? (
              <>
                <label>
                  Source (MP4, WebM or Ogg file)
                  <input value={dialog.src} onChange={(e) => setDialog({ ...dialog, src: e.target.value })} placeholder="https://…/video.mp4" autoFocus />
                </label>
                <div className="mh-rte__dialog-row">
                  <label>
                    Width
                    <input inputMode="numeric" value={dialog.width} onChange={(e) => setDialog({ ...dialog, width: e.target.value })} />
                  </label>
                  <label>
                    Height
                    <input inputMode="numeric" value={dialog.height} onChange={(e) => setDialog({ ...dialog, height: e.target.value })} />
                  </label>
                </div>
              </>
            ) : (
              <div className="mh-rte__dialog-row">
                <label>
                  Rows
                  <input inputMode="numeric" value={dialog.rows} onChange={(e) => setDialog({ ...dialog, rows: e.target.value })} autoFocus />
                </label>
                <label>
                  Columns
                  <input inputMode="numeric" value={dialog.cols} onChange={(e) => setDialog({ ...dialog, cols: e.target.value })} />
                </label>
              </div>
            )}
            <footer>
              <button type="button" className="mh-sa__btn" onClick={() => setDialog(null)}>
                {dialog.kind === "words" ? "Close" : "Cancel"}
              </button>
              {dialog.kind !== "words" ? (
                <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={applyDialog}>
                  Save
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
