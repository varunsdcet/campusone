"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  decorateLmsActivityTypes,
  type LmsActivityType,
} from "@/lib/lmsActivityTypes";

type Tab = "all" | "activity" | "resource";
const FAVORITES_KEY = "mh-lms-chooser-favorites";

type Props = {
  types?: Array<{ code: string; label: string; kind: string }>;
  busy?: boolean;
  onSelect: (type: LmsActivityType) => void;
  onClose: () => void;
};

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function AddActivityChooser({ types, busy, onSelect, onClose }: Props) {
  const titleId = useId();
  const searchId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [helpCode, setHelpCode] = useState<string | null>(null);

  const catalog = useMemo(() => decorateLmsActivityTypes(types), [types]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((t) => {
      if (tab !== "all" && t.kind !== tab) return false;
      if (!q) return true;
      return `${t.label} ${t.kind} ${t.help || ""}`.toLowerCase().includes(q);
    });
  }, [catalog, query, tab]);

  const helpItem = visible.find((t) => t.code === helpCode) || catalog.find((t) => t.code === helpCode);
  const helpIndex = helpItem ? visible.findIndex((t) => t.code === helpItem.code) : -1;

  useEffect(() => setFavorites(loadFavorites()), []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (helpCode) setHelpCode(null);
        else onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = [...root.querySelectorAll<HTMLElement>("button:not([disabled]), input, a[href]")];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, helpCode]);

  function toggleFavorite(code: string) {
    setFavorites((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  }

  function showHelp(offset: number) {
    if (helpIndex < 0 || !visible.length) return;
    const next = (helpIndex + offset + visible.length) % visible.length;
    setHelpCode(visible[next]?.code || null);
  }

  const dialog = (
    <div className="mh-lms-chooser-overlay" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="mh-lms-chooser-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mh-lms-chooser-modal__head">
          <h2 id={titleId}>Add an activity or resource</h2>
          <button type="button" className="mh-lms-chooser-modal__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="mh-lms-chooser-modal__body">
          <div className="mh-lms-chooser-search">
            <label className="mh-teacher-sr-only" htmlFor={searchId}>
              Search
            </label>
            <input
              ref={searchRef}
              id={searchId}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHelpCode(null);
              }}
              placeholder="Search"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                className="mh-lms-chooser-search__clear"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
              >
                ×
              </button>
            ) : null}
          </div>

          <div className="mh-lms-chooser-tabs" role="tablist" aria-label="Activity type">
            {(
              [
                { id: "all", label: "All" },
                { id: "activity", label: "Activities" },
                { id: "resource", label: "Resources" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? "is-active" : ""}
                onClick={() => {
                  setTab(item.id);
                  setHelpCode(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mh-lms-chooser-panel">
            {helpItem ? (
              <div className="mh-lms-chooser-info">
                <div className="mh-lms-chooser-info__nav">
                  <button type="button" onClick={() => showHelp(-1)} aria-label="Previous" disabled={visible.length < 2}>
                    ‹
                  </button>
                  <button type="button" onClick={() => showHelp(1)} aria-label="Next" disabled={visible.length < 2}>
                    ›
                  </button>
                  <button type="button" className="mh-lms-chooser-info__back" onClick={() => setHelpCode(null)}>
                    Close
                  </button>
                </div>
                <span
                  className={`mh-lms-chooser-icon mh-lms-chooser-icon--lg${helpItem.iconTone === "paper" ? " is-paper" : ""}`}
                  style={{ background: helpItem.color || "#42a5f5" }}
                  aria-hidden
                >
                  <ActivityGlyph code={helpItem.code} />
                </span>
                <h3>{helpItem.label}</h3>
                <p>{helpItem.help}</p>
                <button
                  type="button"
                  className="mh-lms-chooser-info__add"
                  disabled={busy}
                  onClick={() => onSelect(helpItem)}
                >
                  Add
                </button>
              </div>
            ) : (
              <div className="mh-lms-chooser-grid" role="list">
                {visible.length === 0 ? (
                  <p className="mh-lms-chooser-empty">No activities or resources match that search.</p>
                ) : (
                  visible.map((type) => {
                    const starred = favorites.includes(type.code);
                    return (
                      <div key={type.code} className="mh-lms-chooser-tile" role="listitem">
                        <button
                          type="button"
                          className="mh-lms-chooser-tile__main"
                          disabled={busy}
                          onClick={() => onSelect(type)}
                        >
                          <span
                            className={`mh-lms-chooser-icon${type.iconTone === "paper" ? " is-paper" : ""}`}
                            style={{ background: type.color || "#42a5f5" }}
                            aria-hidden
                          >
                            <ActivityGlyph code={type.code} />
                          </span>
                          <span className="mh-lms-chooser-tile__label">{type.label}</span>
                        </button>
                        <div className="mh-lms-chooser-tile__tools">
                          <button
                            type="button"
                            className={`mh-lms-chooser-tool${starred ? " is-starred" : ""}`}
                            aria-pressed={starred}
                            aria-label={starred ? `Unfavourite ${type.label}` : `Favourite ${type.label}`}
                            onClick={() => toggleFavorite(type.code)}
                          >
                            <StarIcon filled={starred} />
                          </button>
                          <button
                            type="button"
                            className="mh-lms-chooser-tool"
                            aria-label={`Information about ${type.label}`}
                            onClick={() => setHelpCode(type.code)}
                          >
                            <InfoIcon />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="mh-lms-chooser-modal__foot">
          <a href="https://moodle.net" target="_blank" rel="noreferrer">
            Or browse for content on{" "}
            <MoodleNetMark />
          </a>
        </footer>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 4.4 14.2 9l5.3.7-3.9 3.7.9 5.3L12 16.2 7.5 18.7l.9-5.3-3.9-3.7 5.3-.7z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10.6v5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.8" r="1" fill="currentColor" />
    </svg>
  );
}

function MoodleNetMark() {
  return (
    <span className="mh-moodlenet">
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="M2 11.2 8 3.4 14 11.2 8 8.6z" fill="#f97316" />
      </svg>
      <span>moodle</span>
      <span className="mh-moodlenet--net">Net</span>
    </span>
  );
}

function ActivityGlyph({ code }: { code: string }) {
  const fill = { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true };
  const line = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (code) {
    case "assignment":
      return (
        <svg {...line}>
          <path d="M7.2 3.8h7.2L18.6 8.2v12.4H7.2z" />
          <path d="M14.4 3.8v4.4h4.2" />
          <path d="M9.6 12h6.2M9.6 15.2h4.4" />
        </svg>
      );
    case "bigbluebutton":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
          <text x="12" y="16.2" textAnchor="middle" fontSize="12" fontWeight="800" fill="currentColor">
            b
          </text>
        </svg>
      );
    case "book":
      return (
        <svg {...line}>
          <path d="M12 6.2c1.7-1.5 4.5-1.9 6.8-.4v12.4c-2.4-1.3-5.1-.9-6.8.5-1.7-1.4-4.4-1.8-6.8-.5V5.8c2.3-1.5 5.1-1.1 6.8.4z" />
          <path d="M12 6.2v12.5" />
        </svg>
      );
    case "chat":
      return (
        <svg {...fill}>
          <path d="M4.5 6.8A3.3 3.3 0 0 1 7.8 4.8h6.2A3.2 3.2 0 0 1 17.2 8v.6H16a3.5 3.5 0 0 0-3.5 3.5V16l-4.4 2.6V16H7.8A3.3 3.3 0 0 1 4.5 12.8z" />
          <path d="M10.2 10.6h6.6A3 3 0 0 1 19.8 13.6V20l-3.4-2.2h-4.4A2.4 2.4 0 0 1 9.6 15.4v-2.4a2.4 2.4 0 0 1 2.4-2.4z" />
        </svg>
      );
    case "checklist":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="4.5" y="4" width="15" height="16" rx="2" fill="#fff" stroke="#cfd8dc" strokeWidth="1.2" />
          <path d="M8 8h8M8 12h8M8 16h5" stroke="#90a4ae" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="17.2" cy="16.6" r="3.3" fill="#43a047" />
          <path d="M15.6 16.6 16.8 17.8 18.9 15.4" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "choice":
      return (
        <svg {...fill}>
          <circle cx="12" cy="5.4" r="2.2" />
          <circle cx="6.4" cy="18.4" r="2.2" />
          <circle cx="17.6" cy="18.4" r="2.2" />
          <path d="M12 7.6v3.6L7.6 16.2M12 11.2l4.4 5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        </svg>
      );
    case "database":
      return (
        <svg {...fill}>
          <ellipse cx="12" cy="6.2" rx="7" ry="2.6" />
          <path d="M5 6.2v11.6c0 1.5 3.1 2.7 7 2.7s7-1.2 7-2.7V6.2" />
          <ellipse cx="12" cy="12" rx="7" ry="2.6" opacity="0.85" />
        </svg>
      );
    case "externaltool":
    case "mcgrawhill":
      return (
        <svg {...fill}>
          <path d="M9 4.2h5.1l1.8 3.2H20v6.2h-3.6L14.6 17H9l-1.8-3.4H4.2V7.4h3z" />
        </svg>
      );
    case "feedback":
      return (
        <svg {...fill}>
          <path d="M4.4 14.4 9 12.8 19.4 5.2l1.8 3.1-10.4 7.6-1.4 4.2z" />
        </svg>
      );
    case "file":
      return (
        <svg {...line}>
          <path d="M7.2 3.8h7.2L18.6 8.2v12.4H7.2z" />
          <path d="M14.4 3.8v4.4h4.2" />
        </svg>
      );
    case "page":
      return (
        <svg {...line}>
          <path d="M7.2 3.8h7.2L18.6 8.2v12.4H7.2z" />
          <path d="M14.4 3.8v4.4h4.2" />
          <path d="M9.6 12h6.2M9.6 15.2h4.4" />
        </svg>
      );
    case "folder":
      return (
        <svg {...fill}>
          <path d="M3.8 8.2 6.2 5.6h5.1l1.6 2.6H20v10.6H3.8z" />
        </svg>
      );
    case "forum":
      return (
        <svg {...fill}>
          <path d="M5.2 6.2h13.6A2.4 2.4 0 0 1 21.2 8.6v6.2a2.4 2.4 0 0 1-2.4 2.4h-6.2L7 20.8v-3.6H5.2A2.2 2.2 0 0 1 3 15V8.6a2.4 2.4 0 0 1 2.2-2.4z" />
        </svg>
      );
    case "glossary":
      return (
        <svg {...line}>
          <path d="M6.6 4.4h10.8v15.4H8.2A1.6 1.6 0 0 1 6.6 18.2z" />
          <path d="M9.6 9.2h5.8M9.6 12.6h4.2" />
        </svg>
      );
    case "h5p":
    case "interactive":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <text x="12" y="15.6" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="currentColor">
            H5P
          </text>
        </svg>
      );
    case "imscp":
      return (
        <svg {...fill}>
          <rect x="8.6" y="3.6" width="6.8" height="4.8" rx="0.8" />
          <rect x="3.8" y="15.4" width="7" height="4.8" rx="0.8" />
          <rect x="13.2" y="15.4" width="7" height="4.8" rx="0.8" />
          <path d="M12 8.4v4.2M12 12.6H7.3v2.8M12 12.6h4.7v2.8" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      );
    case "journal":
      return (
        <svg {...fill}>
          <path d="M15.2 4.4 20 9.2 10.4 18.8 5.4 20.2 6.8 15.2z" />
        </svg>
      );
    case "label":
      return (
        <svg {...fill}>
          <path d="M12.4 4.2 20.2 12l-8 8-7.8-7.8V4.2z" />
          <circle cx="10.4" cy="8.6" r="1.3" fill="#fff" />
        </svg>
      );
    case "lesson":
      return (
        <svg {...fill}>
          <circle cx="7" cy="6.6" r="2.4" />
          <circle cx="17" cy="6.6" r="2.4" />
          <circle cx="12" cy="17.4" r="2.4" />
          <path d="M8.8 8.2 10.6 15M15.2 8.2 13.4 15" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      );
    case "quiz":
      return (
        <svg {...fill}>
          <rect x="4.4" y="5.2" width="5.2" height="5.2" rx="1" />
          <path d="M5.4 15 7.4 17.1 11 13.2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M11.6 7.2h8v2h-8zm0 8.2h8v2h-8z" />
        </svg>
      );
    case "scorm":
      return (
        <svg {...line}>
          <path d="M4.4 9.2 12 5l7.6 4.2v9.4L12 22.4 4.4 18.6z" />
          <path d="M12 5v17.4M4.4 9.2 12 13.4 19.6 9.2" />
        </svg>
      );
    case "survey":
      return (
        <svg {...fill}>
          <rect x="4.6" y="12" width="3.2" height="7.2" rx="0.6" />
          <rect x="10.4" y="6.4" width="3.2" height="12.8" rx="0.6" />
          <rect x="16.2" y="9.2" width="3.2" height="10" rx="0.6" />
        </svg>
      );
    case "turnitin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M6.4 3.8h8.2L19 8.2v12H6.4z" fill="#eceff1" stroke="#90a4ae" strokeWidth="1.2" />
          <path d="M14.6 3.8V8.2H19" fill="#cfd8dc" />
          <path d="M9.2 13.2h6.4" stroke="#1e88e5" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M13.4 10.8 16.2 13.2 13.4 15.6" fill="none" stroke="#1e88e5" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "url":
      return (
        <svg {...line}>
          <circle cx="12" cy="12" r="7.2" />
          <path d="M5.2 12h13.6M12 4.8c2.3 2.4 3.4 4.8 3.4 7.2S14.3 16.8 12 19.2c-2.3-2.4-3.4-4.8-3.4-7.2S9.7 7.2 12 4.8z" />
        </svg>
      );
    case "wiki":
      return (
        <svg {...fill}>
          <circle cx="6.2" cy="12" r="2.4" />
          <circle cx="17.6" cy="6.8" r="2.4" />
          <circle cx="17.6" cy="17.2" r="2.4" />
          <path d="M8.4 11.2 15.4 7.8M8.4 12.8 15.4 16.2" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      );
    case "workshop":
      return (
        <svg {...fill}>
          <circle cx="8" cy="7.6" r="2.4" />
          <circle cx="16" cy="7.6" r="2.4" />
          <path d="M3.8 18.6c.5-3.1 2.4-4.8 4.2-4.8s3.7 1.7 4.2 4.8" />
          <path d="M11.8 18.6c.5-3.1 2.4-4.8 4.2-4.8s3.7 1.7 4.2 4.8" />
        </svg>
      );
    default:
      return (
        <svg {...fill}>
          <rect x="5" y="5" width="14" height="14" rx="2.4" />
        </svg>
      );
  }
}
