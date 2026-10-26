"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SisBadgeTone, SisScreenConfig } from "@/lib/adminSisCatalog";
import { SisActionBtn } from "@/components/SisActionBtn";

function badgeClass(tone?: SisBadgeTone) {
  return `mh-sis-badge mh-sis-badge--${tone || "active"}`;
}

function BannerActions({ config, dangerPrimary }: { config: SisScreenConfig; dangerPrimary?: boolean }) {
  const secondaryLabels =
    config.secondaryActions || (config.secondaryAction ? [config.secondaryAction] : []);
  return (
    <div className="mh-sis-dash__banner-actions">
      {secondaryLabels.map((label) => (
        <SisActionBtn
          key={label}
          label={label}
          tone="secondary"
          href={
            config.secondaryActionHrefs?.[label] ??
            (label === config.secondaryAction ? config.secondaryActionHref : undefined)
          }
        />
      ))}
      {config.primaryAction ? (
        <SisActionBtn
          label={config.primaryAction}
          href={config.primaryActionHref}
          tone={dangerPrimary ? "danger" : "primary"}
        />
      ) : null}
    </div>
  );
}

function KpiRow({ config }: { config: SisScreenConfig }) {
  if (!config.kpis?.length) return null;
  return (
    <div className="mh-sis-dash__kpis">
      {config.kpis.map((k) => (
        <article key={k.label} className="mh-sis-dash__kpi">
          <div className="mh-sis-dash__kpi-label">{k.label}</div>
          <div className="mh-sis-dash__kpi-value">{k.value}</div>
          <div
            className={`mh-sis-dash__kpi-hint${k.tone === "up" ? " is-up" : ""}${
              k.tone === "danger" ? " is-danger" : ""
            }`}
          >
            {k.hint}
          </div>
        </article>
      ))}
    </div>
  );
}

export function ComplianceDashView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const dash = config.complianceDash;
  if (!dash) {
    return (
      <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
        <div className="mh-sis-dash__welcome">
          <div className="mh-sis-dash__welcome-text">
            <h1>{config.title}</h1>
            <p>{config.subtitle}</p>
          </div>
        </div>
        <p>No compliance score is available yet.</p>
      </div>
    );
  }
  const score = typeof dash.scorePct === "number" ? dash.scorePct : 0;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>

      <div className="mh-sis-cp-dash-top">
        <section className="mh-sis-dash__card mh-sis-cp-score">
          <div className="mh-sis-cp-score__ring" aria-label={`${score}% overall compliance`}>
            <svg viewBox="0 0 120 120" width={132} height={132}>
              <circle cx="60" cy="60" r="54" className="mh-sis-cp-score__track" />
              <circle
                cx="60"
                cy="60"
                r="54"
                className="mh-sis-cp-score__fill"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="mh-sis-cp-score__value">
              <strong>{score}%</strong>
              <span>Overall</span>
            </div>
          </div>
          <div className="mh-sis-cp-score__copy">
            <h2>{dash.scoreLabel}</h2>
            <p>{dash.scoreHint}</p>
          </div>
        </section>

        <div className="mh-sis-cp-side-metrics">
          {dash.sideMetrics.map((m) => (
            <button
              key={m.label}
              type="button"
              className="mh-sis-dash__card mh-sis-cp-metric"
              onClick={() => (m.href ? router.push(m.href) : undefined)}
            >
              <div className="mh-sis-cp-metric__label">{m.label}</div>
              <div className="mh-sis-cp-metric__value">{m.value}</div>
              {m.hint ? <div className="mh-sis-cp-metric__hint">{m.hint}</div> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mh-sis-cp-dash-split">
        <section className="mh-sis-dash__card">
          <div className="mh-sis-cp-section-head">
            <h2>Upcoming Deadlines</h2>
            <button
              type="button"
              className="mh-sis-filters__reset"
              style={{ padding: 0 }}
              onClick={() => router.push(dash.deadlinesHref)}
            >
              View accreditation →
            </button>
          </div>
          <div className="mh-sis-cp-deadline-list">
            {dash.deadlines.map((d) => (
              <button
                key={d.title}
                type="button"
                className="mh-sis-cp-deadline"
                onClick={() => router.push(dash.deadlinesHref)}
              >
                <img src="/brand/icons/calendar.svg" alt="" width={16} height={16} />
                <div>
                  <strong>{d.title}</strong>
                  <span>{d.due}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mh-sis-dash__card">
          <div className="mh-sis-cp-section-head">
            <h2>Evidence Mapping Progress</h2>
            <button
              type="button"
              className="mh-sis-filters__reset"
              style={{ padding: 0 }}
              onClick={() => router.push(dash.evidenceHref)}
            >
              Open mapping →
            </button>
          </div>
          <div className="mh-sis-cp-progress-list">
            {dash.evidence.map((e) => (
              <button
                key={e.label}
                type="button"
                className="mh-sis-cp-progress"
                onClick={() => router.push(dash.evidenceHref)}
              >
                <div className="mh-sis-cp-progress__top">
                  <strong>{e.label}</strong>
                  <span>{e.pct}%</span>
                </div>
                <div className="mh-sis-cp-progress__track">
                  <div className="mh-sis-cp-progress__fill" style={{ width: `${e.pct}%` }} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function CpCompletenessView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const data = config.cpCompleteness!;
  const [q, setQ] = useState("");
  const rows = data.incomplete.filter((row) => {
    if (!q.trim()) return true;
    return `${row.name} ${row.cohort} ${row.missing}`.toLowerCase().includes(q.trim().toLowerCase());
  });

  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>
      <KpiRow config={config} />

      <div className="mh-sis-cp-split">
        <section className="mh-sis-dash__card">
          <h2>Field Group Completeness</h2>
          <div className="mh-sis-cp-field-groups">
            {data.fieldGroups.map((g) => (
              <div key={g.name} className="mh-sis-cp-progress">
                <div className="mh-sis-cp-progress__top">
                  <strong>{g.name}</strong>
                  <span>{g.pct}%</span>
                </div>
                <div className="mh-sis-cp-progress__track">
                  <div className="mh-sis-cp-progress__fill" style={{ width: `${g.pct}%` }} />
                </div>
                <div className="mh-sis-cp-field-groups__meta">{g.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mh-sis-dash__card">
          <h2>Incomplete Students</h2>
          <div className="mh-sis-filters" style={{ marginBottom: 12 }}>
            <div className="mh-sis-filters__search">
              <img src="/brand/icons/search.svg" alt="" width={14} height={14} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={config.searchPlaceholder || "Search students…"}
                aria-label="Search incomplete students"
              />
            </div>
          </div>
          <div className="mh-sis-cp-student-list">
            {rows.map((row) => (
              <button
                key={row.name}
                type="button"
                className="mh-sis-cp-student"
                onClick={() => router.push(row.href || data.vaultHref)}
              >
                <div>
                  <strong>{row.name}</strong>
                  <span>
                    {row.cohort} · Missing: {row.missing}
                  </span>
                </div>
                <span className={badgeClass(row.tone)}>{row.status}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function CpRetentionView({ config }: { config: SisScreenConfig }) {
  const data = config.cpRetention!;
  const [selected, setSelected] = useState(0);
  const policy = data.policies[selected] || data.policies[0];

  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>

      <div className="mh-sis-cp-split">
        <section className="mh-sis-dash__card">
          <h2>Policy Directory</h2>
          <div className="mh-sis-cp-policy-list">
            {data.policies.map((p, idx) => (
              <button
                key={p.name}
                type="button"
                className={`mh-sis-cp-policy-row${idx === selected ? " is-active" : ""}`}
                onClick={() => setSelected(idx)}
              >
                <div>
                  <strong>{p.name}</strong>
                  <span>{p.scope}</span>
                </div>
                <span className={badgeClass(p.tone)}>{p.status}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mh-sis-dash__card mh-sis-cp-editor">
          <h2>Policy Editor</h2>
          {policy ? (
            <>
              <label className="mh-sis-field">
                <span>Policy Name</span>
                <div>{policy.name}</div>
              </label>
              <label className="mh-sis-field">
                <span>Retention Period</span>
                <div>{policy.period}</div>
              </label>
              <label className="mh-sis-field">
                <span>Trigger Event</span>
                <div>{policy.trigger}</div>
              </label>
              <label className="mh-sis-field">
                <span>Disposal Action</span>
                <div>{policy.disposal}</div>
              </label>
              <p className="mh-sis-cp-editor__note">{policy.note}</p>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export function CpHoldsView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const data = config.cpHolds!;
  const [open, setOpen] = useState<string | null>(data.holds[0]?.id || null);

  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} dangerPrimary />
      </div>
      <KpiRow config={config} />

      <section className="mh-sis-dash__card">
        <h2>Active Legal Holds</h2>
        <div className="mh-sis-cp-holds">
          {data.holds.map((hold) => {
            const expanded = open === hold.id;
            return (
              <div key={hold.id} className="mh-sis-cp-hold">
                <button
                  type="button"
                  className="mh-sis-cp-hold__head"
                  onClick={() => setOpen(expanded ? null : hold.id)}
                >
                  <div>
                    <strong>{hold.title}</strong>
                    <span>
                      {hold.matter} · Placed {hold.placed}
                    </span>
                  </div>
                  <div className="mh-sis-cp-hold__meta">
                    <span className={badgeClass(hold.tone)}>{hold.status}</span>
                    <img
                      src="/brand/icons/chevron-down.svg"
                      alt=""
                      width={14}
                      height={14}
                      style={{ transform: expanded ? "rotate(180deg)" : undefined }}
                    />
                  </div>
                </button>
                {expanded ? (
                  <div className="mh-sis-cp-hold__body">
                    <div className="mh-sis-cp-hold__chips">
                      {hold.affected.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="mh-sis-cp-chip"
                          onClick={() => router.push(data.vaultHref)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <p>{hold.reason}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function CpEvidenceView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const data = config.cpEvidence!;
  const [active, setActive] = useState(0);
  const standard = data.standards[active] || data.standards[0];

  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>

      <div className="mh-sis-cp-split">
        <section className="mh-sis-dash__card">
          <h2>Accreditation Standards</h2>
          <div className="mh-sis-cp-tree">
            {data.standards.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`mh-sis-cp-tree__item${idx === active ? " is-active" : ""}`}
                onClick={() => setActive(idx)}
              >
                <div className="mh-sis-cp-progress__top">
                  <strong>
                    {s.id} · {s.title}
                  </strong>
                  <span>{s.pct}%</span>
                </div>
                <div className="mh-sis-cp-progress__track">
                  <div className="mh-sis-cp-progress__fill" style={{ width: `${s.pct}%` }} />
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mh-sis-dash__card">
          <h2>Mapped Documents · {standard?.id}</h2>
          <div className="mh-sis-cp-doc-list">
            {(standard?.documents || []).map((doc) => (
              <div key={doc.name} className="mh-sis-cp-doc">
                <div>
                  <strong>{doc.name}</strong>
                  <span>{doc.meta}</span>
                </div>
                <div className="mh-sis-cp-doc__actions">
                  <button
                    type="button"
                    className="mh-sis-dash__btn mh-sis-dash__btn--secondary"
                    onClick={() => router.push(doc.href || data.vaultHref)}
                  >
                    View
                  </button>
                  <SisActionBtn label="Unlink" tone="secondary" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function CpAccreditationView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const data = config.cpAccreditation!;

  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>
      <KpiRow config={config} />

      <div className="mh-sis-cp-dash-split">
        <section className="mh-sis-dash__card">
          <h2>Accreditation Deadlines</h2>
          <div className="mh-sis-cp-deadline-list">
            {data.deadlines.map((d) => (
              <div key={d.title} className="mh-sis-cp-deadline mh-sis-cp-deadline--static">
                <img src="/brand/icons/calendar.svg" alt="" width={16} height={16} />
                <div>
                  <strong>{d.title}</strong>
                  <span>{d.due}</span>
                </div>
                <span className={badgeClass(d.tone)}>{d.status}</span>
              </div>
            ))}
          </div>
          <div className="mh-sis-cp-progress-list" style={{ marginTop: 16 }}>
            {data.metrics.map((m) => (
              <div key={m.label} className="mh-sis-cp-progress">
                <div className="mh-sis-cp-progress__top">
                  <strong>{m.label}</strong>
                  <span>{m.pct}%</span>
                </div>
                <div className="mh-sis-cp-progress__track">
                  <div className="mh-sis-cp-progress__fill" style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mh-sis-dash__card">
          <h2>AI Insights</h2>
          <div className="mh-sis-cp-insight-list">
            {data.insights.map((insight) => (
              <article key={insight.title} className="mh-sis-cp-insight">
                <img src="/brand/icons/sparkle.svg" alt="" width={16} height={16} />
                <div>
                  <strong>{insight.title}</strong>
                  <p>{insight.body}</p>
                  <div className="mh-sis-cp-doc__actions">
                    <button
                      type="button"
                      className="mh-sis-dash__btn mh-sis-dash__btn--secondary"
                      onClick={() => router.push(insight.href || data.vaultHref)}
                    >
                      Link
                    </button>
                    <SisActionBtn label="Ignore" tone="secondary" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function CpInspectionView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const data = config.cpInspection!;

  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <div className="mh-sis-cp-pack-status">
            <span className={badgeClass("review")}>{data.status}</span>
            <span className="mh-sis-cp-pack-status__pct">{data.progressPct}% complete</span>
          </div>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>

      <div className="mh-sis-cp-progress" style={{ marginBottom: 16 }}>
        <div className="mh-sis-cp-progress__track mh-sis-cp-progress__track--lg">
          <div className="mh-sis-cp-progress__fill" style={{ width: `${data.progressPct}%` }} />
        </div>
      </div>

      <div className="mh-sis-cp-split">
        <section className="mh-sis-dash__card">
          <h2>Checklist Categories</h2>
          <div className="mh-sis-cp-checklist">
            {data.categories.map((c) => (
              <div key={c.title} className="mh-sis-cp-checklist__item">
                <div>
                  <strong>{c.title}</strong>
                  <span>
                    {c.done}/{c.total} items
                  </span>
                </div>
                <span className={badgeClass(c.tone)}>{c.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mh-sis-dash__card">
          <div className="mh-sis-cp-section-head">
            <h2>Pack Documents</h2>
            <button
              type="button"
              className="mh-sis-dash__btn mh-sis-dash__btn--secondary"
              onClick={() => router.push(data.addDocHref)}
            >
              Add Document
            </button>
          </div>
          <div className="mh-sis-table">
            <div
              className="mh-sis-table__head"
              style={{ gridTemplateColumns: "minmax(160px,1.4fr) 110px 100px 90px" }}
            >
              <span>Document</span>
              <span>Category</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {data.documents.map((doc) => (
              <div
                key={doc.name}
                className="mh-sis-table__row mh-sis-grades__row"
                style={{ gridTemplateColumns: "minmax(160px,1.4fr) 110px 100px 90px" }}
              >
                <span className="mh-sis-table__primary">{doc.name}</span>
                <span style={{ fontSize: 13, color: "#5c5f5a" }}>{doc.category}</span>
                <span className={badgeClass(doc.tone)}>{doc.status}</span>
                <button
                  type="button"
                  className="mh-sis-filters__reset"
                  style={{ padding: 0 }}
                  onClick={() => router.push(doc.href || data.addDocHref)}
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function CpDisposalView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const data = config.cpDisposal!;
  const [selected, setSelected] = useState(0);
  const item = data.items[selected] || data.items[0];

  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <div className="mh-sis-case-header__type">Batch {data.batchId}</div>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>

      <div className="mh-sis-cp-split">
        <section className="mh-sis-dash__card">
          <h2>Disposal Candidates</h2>
          <div className="mh-sis-cp-policy-list">
            {data.items.map((row, idx) => (
              <button
                key={row.id}
                type="button"
                className={`mh-sis-cp-policy-row${idx === selected ? " is-active" : ""}`}
                onClick={() => setSelected(idx)}
              >
                <div>
                  <strong>{row.name}</strong>
                  <span>
                    {row.id} · {row.retention}
                  </span>
                </div>
                <span className={badgeClass(row.tone)}>{row.status}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mh-sis-dash__card mh-sis-cp-preview">
          <h2>File Preview</h2>
          {item ? (
            <>
              <div className="mh-sis-cp-preview__file">
                <img src="/brand/icons/file-text.svg" alt="" width={28} height={28} />
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.type} · {item.size}
                  </span>
                </div>
              </div>
              <p>{item.preview}</p>
              <div className="mh-sis-cp-doc__actions">
                <SisActionBtn label="Approve Destruction" />
                <button
                  type="button"
                  className="mh-sis-dash__btn mh-sis-dash__btn--secondary"
                  onClick={() => router.push(data.holdsHref)}
                >
                  Deny Hold
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export function CpPrivacyView({ config }: { config: SisScreenConfig }) {
  const data = config.cpPrivacy!;
  const [selected, setSelected] = useState(0);
  const req = data.requests[selected] || data.requests[0];

  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>
      <KpiRow config={config} />

      <div className="mh-sis-cp-split">
        <section className="mh-sis-dash__card">
          <h2>FOIA / Privacy Queue</h2>
          <div className="mh-sis-cp-policy-list">
            {data.requests.map((row, idx) => (
              <button
                key={row.id}
                type="button"
                className={`mh-sis-cp-policy-row${idx === selected ? " is-active" : ""}`}
                onClick={() => setSelected(idx)}
              >
                <div>
                  <strong>{row.requester}</strong>
                  <span>
                    {row.id} · {row.type}
                  </span>
                </div>
                <span className={badgeClass(row.tone)}>{row.status}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mh-sis-dash__card">
          <h2>Request Dossier</h2>
          {req ? (
            <>
              <div className="mh-sis-summary">
                {req.fields.map((f) => (
                  <div key={f.label}>
                    <span>{f.label}</span>
                    <strong>{f.value}</strong>
                  </div>
                ))}
              </div>
              <h3 className="mh-sis-cp-subhead">Timeline</h3>
              <div className="mh-sis-labs-timeline">
                {req.timeline.map((t, idx) => (
                  <div key={t.title + t.date} className="mh-sis-labs-timeline__item">
                    <div className="mh-sis-labs-timeline__rail">
                      <span className="mh-sis-labs-timeline__dot" />
                      {idx < req.timeline.length - 1 ? <span className="mh-sis-labs-timeline__line" /> : null}
                    </div>
                    <div>
                      <span className="mh-sis-labs-timeline__time">{t.date}</span>
                      <strong>{t.title}</strong>
                      {t.detail ? <p>{t.detail}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mh-sis-dash__btn mh-sis-dash__btn--primary"
                style={{ marginTop: 16 }}
                onClick={() => undefined}
              >
                {config.primaryAction || "Final Sign-off"}
              </button>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
