"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SelfpacedShell } from "@/components/selfpaced/SelfpacedShell";
import { formatCad } from "@/lib/selfpacedPrograms";
import { useSelfpacedCatalogue } from "@/lib/useSelfpacedCatalogue";

const HIGHLIGHTS = [
  ["book", "Expert curriculum", "Programs shaped by instructors and aligned to Canadian educational standards."],
  ["award", "Branded certificate", "Complete your program to receive a verifiable, branded PDF certificate."],
  ["people", "Learn in community", "Discuss lessons with peers and receive feedback from subject-matter experts."],
];

function HighlightIcon({ name }: { name: string }) {
  if (name === "award") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="8" r="5" />
        <path d="m8.5 12.5-1 8 4.5-2.5 4.5 2.5-1-8" />
      </svg>
    );
  }
  if (name === "people") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M16 4.5a4 4 0 0 1 0 7M18 14a5 5 0 0 1 4 5v2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 4h5a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H3zM21 4h-5a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h6z" />
    </svg>
  );
}

export default function SelfpacedHomePage() {
  const { programs, loading, error } = useSelfpacedCatalogue();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("All subjects");
  const [level, setLevel] = useState("All levels");

  const subjects = useMemo(
    () => ["All subjects", ...Array.from(new Set(programs.map((p) => p.subject)))],
    [programs],
  );
  const levels = ["All levels", "Beginner", "Intermediate", "Advanced"];

  const filtered = programs.filter((p) => {
    const hay = `${p.title} ${p.blurb} ${p.subject}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (subject !== "All subjects" && p.subject !== subject) return false;
    if (level !== "All levels" && p.level !== level) return false;
    return true;
  });

  return (
    <SelfpacedShell>
      <section className="sp-home-hero">
        <div className="sp-home-hero__inner">
          <div className="sp-home-hero__copy">
            <p className="sp-kicker">Trusted education powered by CampusOne</p>
            <h1>
              A classical education,
              <br />
              <em>re-imagined</em> for the modern learner.
            </h1>
            <p className="sp-home-hero__lede">
              Enroll in expertly-crafted programs aligned with Canadian curriculum standards. Study at your own pace,
              earn a branded certificate, and advance your career — all under one storied name.
            </p>
            <div className="sp-hero__cta">
              <a href="#catalog" className="sp-btn sp-btn--primary">
                Browse Programs →
              </a>
              <button
                type="button"
                className="sp-btn sp-btn--ghost"
                onClick={() => window.dispatchEvent(new CustomEvent("sp-open-auth", { detail: "login" }))}
              >
                I have an account
              </button>
            </div>
          </div>
          <div className="sp-home-hero__visual">
            <img src="/brand/campus/hero.png" alt="CampusOne learners" />
            <div className="sp-home-hero__stat">
              <strong>12,400+</strong>
              <span>Learners enrolled</span>
            </div>
          </div>
        </div>
      </section>

      <section className="sp-value" id="about">
        {HIGHLIGHTS.map(([icon, title, copy]) => (
          <article key={title}>
            <span className="sp-value__icon">
              <HighlightIcon name={icon} />
            </span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section className="sp-catalog" id="catalog">
        <div className="sp-catalog__head">
          <div>
            <p className="sp-kicker">Catalog</p>
            <h2>Current Programs</h2>
          </div>
          <p>Showing {filtered.length} of {programs.length}</p>
        </div>
        {error ? <p className="sp-error">The live admin-published catalogue is temporarily unavailable. Please refresh in a moment.</p> : null}

        <div className="sp-filters">
          <label className="sp-search">
            <span className="sp-search__icon" aria-hidden>
              ⌕
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title, description, or subject…"
            />
          </label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level">
            {levels.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {q || subject !== "All subjects" || level !== "All levels" ? (
            <button
              type="button"
              className="sp-filter-clear"
              onClick={() => {
                setQ("");
                setSubject("All subjects");
                setLevel("All levels");
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="sp-grid">
          {filtered.map((p) => (
            <Link key={p.id} href={`/selfpaced/programs/${p.slug}`} className="sp-card">
              <div className="sp-card__media">
                <img src={p.image} alt={p.title} />
              </div>
              <div className="sp-card__body">
                <div className="sp-card__tags">
                  <span>{p.subject}</span>
                  <span>{p.level}</span>
                </div>
                <h3>{p.title}</h3>
                <p>{p.blurb}</p>
                <p className="sp-card__meta">
                  {p.hours.toFixed(1)} hrs · {p.chapters} chapters
                </p>
                <p className="sp-card__price">
                  <strong>{formatCad(p.priceCad)}</strong>
                  <span> · domestic</span>
                </p>
                {p.internationalCad ? (
                  <p className="sp-card__price-intl">{formatCad(p.internationalCad)} · international</p>
                ) : null}
                <span className="sp-card__link">View curriculum →</span>
              </div>
            </Link>
          ))}
        </div>
        {loading ? <p className="sp-empty">Refreshing live catalogue…</p> : filtered.length === 0 ? <p className="sp-empty">No programs match your filters.</p> : null}
      </section>
    </SelfpacedShell>
  );
}
