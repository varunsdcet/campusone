"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SisBadgeTone, SisScreenConfig } from "@/lib/adminSisCatalog";
import { SisActionBtn } from "@/components/SisActionBtn";
import { useSisLive } from "@/lib/useAdminSisLive";

function badgeClass(tone?: SisBadgeTone) {
  return `mh-sis-badge mh-sis-badge--${tone || "active"}`;
}

function BannerActions({ config }: { config: SisScreenConfig }) {
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
        <SisActionBtn label={config.primaryAction} href={config.primaryActionHref} />
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

export function LabDashView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const dash = config.labDash!;
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
      <div className="mh-sis-labs-dash-split">
        <section className="mh-sis-labs-section">
          <h2>{dash.roomsTitle || "Room Statuses"}</h2>
          <div className="mh-sis-labs-room-grid">
            {dash.rooms.map((room) => (
              <button
                key={room.name}
                type="button"
                className="mh-sis-dash__card mh-sis-labs-room-card"
                onClick={() => (room.href ? router.push(room.href) : undefined)}
              >
                <div className="mh-sis-labs-room-card__top">
                  <strong>{room.name}</strong>
                  <span className={badgeClass(room.statusTone)}>{room.status}</span>
                </div>
                <div className="mh-sis-labs-room-card__meta">{room.capacity}</div>
                <div className="mh-sis-labs-room-card__activity">{room.activity}</div>
              </button>
            ))}
          </div>
        </section>
        <section className="mh-sis-dash__card mh-sis-labs-alerts">
          <h2>{dash.alertsTitle || "Active Hardware Status & Alerts"}</h2>
          <div className="mh-sis-labs-alerts__list">
            {dash.alerts.map((alert) => (
              <button
                key={alert.name}
                type="button"
                className={`mh-sis-labs-alert mh-sis-labs-alert--${alert.tone}`}
                onClick={() => (alert.href ? router.push(alert.href) : undefined)}
              >
                <img
                  src={alert.tone === "danger" ? "/brand/icons/bell.svg" : "/brand/icons/file-text.svg"}
                  alt=""
                  width={16}
                  height={16}
                />
                <div>
                  <strong>{alert.name}</strong>
                  <span>{alert.detail}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const DAY_LABELS = ["M", "T", "W", "T", "F"];

export function LabRoomsView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const rooms = config.labRooms!.rooms;
  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>
      <div className="mh-sis-labs-rooms-list">
        {rooms.map((room) => (
          <button
            key={room.name}
            type="button"
            className="mh-sis-dash__card mh-sis-labs-room-row"
            onClick={() => (room.href ? router.push(room.href) : undefined)}
          >
            <div className="mh-sis-labs-room-row__main">
              <strong>{room.name}</strong>
              <span>{room.location}</span>
            </div>
            <div className="mh-sis-labs-room-row__stats">
              <span>{room.seats}</span>
              <span>{room.equipment}</span>
            </div>
            <div className="mh-sis-labs-days" aria-label="Active days">
              {DAY_LABELS.map((d, i) => (
                <span key={`${room.name}-${d}-${i}`} className={`mh-sis-labs-day${room.days[i] ? " is-on" : ""}`}>
                  {d}
                </span>
              ))}
            </div>
            <span className={badgeClass(room.statusTone)}>{room.status}</span>
            <div className="mh-sis-labs-room-row__next">
              <span>Next availability</span>
              <strong>{room.nextAvailable}</strong>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function LabSafetyView({ config }: { config: SisScreenConfig }) {
  const safety = config.labSafety!;
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
      <div className="mh-sis-labs-safety-grid">
        {safety.categories.map((cat) => (
          <article key={cat.title} className="mh-sis-dash__card mh-sis-labs-safety-card">
            <div className="mh-sis-labs-safety-card__top">
              <strong>{cat.title}</strong>
              <span className={badgeClass(cat.badgeTone)}>{cat.badge}</span>
            </div>
            <div className="mh-sis-labs-safety-card__count">{cat.count}</div>
          </article>
        ))}
      </div>
      <section className="mh-sis-dash__card">
        <h2>{safety.signoffsTitle || "Student Training Sign-offs"}</h2>
        <div className="mh-sis-labs-signoffs">
          <div className="mh-sis-labs-signoffs__head">
            <span>Student</span>
            <span>Course</span>
            <span>Status</span>
            <span>Completed</span>
          </div>
          {safety.signoffs.map((row) => (
            <div key={row.name} className="mh-sis-labs-signoffs__row">
              <strong>{row.name}</strong>
              <span>{row.course}</span>
              <span className={badgeClass(row.statusTone)}>{row.status}</span>
              <span>{row.completed}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LabSessionView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const session = config.labSession!;
  const [acked, setAcked] = useState(false);
  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>
      <div className="mh-sis-labs-session-grid">
        <section className="mh-sis-dash__card">
          <h2>Objectives</h2>
          <ul className="mh-sis-labs-bullets">
            {session.objectives.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="mh-sis-dash__card">
          <h2>Procedure</h2>
          <ol className="mh-sis-labs-steps">
            {session.procedure.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <section className="mh-sis-dash__card">
          <h2>Safety Rules</h2>
          <ul className="mh-sis-labs-bullets">
            {session.safetyRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
        <section className="mh-sis-dash__card">
          <h2>Equipment</h2>
          <ul className="mh-sis-labs-equip">
            {session.equipment.map((item) => (
              <li key={item}>
                <img src="/brand/icons/file-text.svg" alt="" width={14} height={14} />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="mh-sis-dash__card mh-sis-labs-session-ack">
        <label className="mh-sis-labs-ack">
          <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
          <span>{session.ackLabel || "I have read and understood the safety rules"}</span>
        </label>
        <button
          type="button"
          className="mh-sis-dash__btn mh-sis-dash__btn--primary"
          disabled={!acked}
          onClick={() => router.push(session.notebookHref)}
        >
          {session.notebookLabel || "My Lab Notebook"}
        </button>
      </div>
    </div>
  );
}

export function LabNotebookView({ config }: { config: SisScreenConfig }) {
  const nb = config.labNotebook!;
  const live = useSisLive();
  const [ask, setAsk] = useState("");
  const [localMsg, setLocalMsg] = useState(nb.studentMessage);
  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>{config.title}</h1>
          <p>
            Course: {nb.course} · {nb.group} · Experiment: {nb.experiment}
          </p>
        </div>
        <BannerActions config={config} />
      </div>
      <div className="mh-sis-labs-notebook">
        <div className="mh-sis-labs-notebook__main">
          <section className="mh-sis-dash__card">
            <h2>Hypothesis</h2>
            <p>{nb.hypothesis}</p>
          </section>
          <section className="mh-sis-dash__card">
            <h2>Experimental Method</h2>
            <ol className="mh-sis-labs-steps">
              {nb.method.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
          <section className="mh-sis-dash__card">
            <h2>Observations</h2>
            <div className="mh-sis-labs-obs">
              <div className="mh-sis-labs-obs__head">
                <span>Temperature</span>
                <span>Rate</span>
                <span>Notes</span>
              </div>
              {nb.observations.map((row) => (
                <div key={row.temp} className="mh-sis-labs-obs__row">
                  <strong>{row.temp}</strong>
                  <span>{row.rate}</span>
                  <span>{row.notes}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="mh-sis-dash__card mh-sis-labs-copilot">
          <div className="mh-sis-labs-copilot__head">
            <img src="/brand/icons/sparkle.svg" alt="" width={16} height={16} />
            <strong>AI Co-Pilot</strong>
          </div>
          <div className="mh-sis-labs-copilot__bubble mh-sis-labs-copilot__bubble--ai">
            {nb.aiSuggestion}
          </div>
          <div className="mh-sis-labs-copilot__bubble mh-sis-labs-copilot__bubble--student">
            {localMsg}
          </div>
          <form
            className="mh-sis-labs-copilot__ask"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ask.trim()) return;
              setLocalMsg(ask.trim());
              void live.runAction("Ask", ask.trim());
              setAsk("");
            }}
          >
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Ask about your experiment…"
              aria-label="Ask AI Co-Pilot"
            />
            <button type="submit" className="mh-sis-dash__btn mh-sis-dash__btn--secondary">
              Ask
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

export function LabIncidentView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const incident = config.labIncident!;
  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <div className="mh-sis-labs-incident-title">
            <h1>{incident.id}</h1>
            <span className={badgeClass("review")}>{incident.severity} Severity</span>
            <span className={badgeClass("new")}>{incident.status}</span>
          </div>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>
      <div className="mh-sis-labs-incident-grid">
        <section className="mh-sis-dash__card">
          <h2>Response Timeline</h2>
          <div className="mh-sis-labs-timeline">
            {incident.timeline.map((item, i) => (
              <div key={item.time} className="mh-sis-labs-timeline__item">
                <div className="mh-sis-labs-timeline__rail">
                  <span className="mh-sis-labs-timeline__dot" />
                  {i < incident.timeline.length - 1 ? <span className="mh-sis-labs-timeline__line" /> : null}
                </div>
                <div>
                  <span className="mh-sis-labs-timeline__time">{item.time}</span>
                  <strong>{item.title}</strong>
                  {item.detail ? <p>{item.detail}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="mh-sis-dash__card">
          <h2>Incident Details</h2>
          <div className="mh-sis-fields">
            {incident.fields.map((f) => (
              <label key={f.label} className="mh-sis-field">
                <span>{f.label}</span>
                <div>{f.value}</div>
              </label>
            ))}
          </div>
          {incident.backHref ? (
            <button
              type="button"
              className="mh-sis-dash__btn mh-sis-dash__btn--secondary"
              style={{ marginTop: 16 }}
              onClick={() => router.push(incident.backHref!)}
            >
              Back to Lab Dashboard
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export function LabVirtualView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const virt = config.labVirtual!;
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
      <div className="mh-sis-labs-virtual-grid">
        {virt.environments.map((env) => (
          <button
            key={env.name}
            type="button"
            className="mh-sis-dash__card mh-sis-labs-virtual-card"
            onClick={() => (env.href ? router.push(env.href) : undefined)}
          >
            <div className="mh-sis-labs-virtual-card__top">
              <strong>{env.name}</strong>
              <span className="mh-sis-labs-virtual-card__course">{env.course}</span>
            </div>
            <div className="mh-sis-labs-virtual-card__meta">
              <img src="/brand/icons/bar-chart.svg" alt="" width={14} height={14} />
              <span>{env.engine} engine</span>
            </div>
            <div className="mh-sis-labs-virtual-card__load">
              <div className="mh-sis-labs-virtual-card__track">
                <div className="mh-sis-labs-virtual-card__fill" style={{ width: `${env.loadPct}%` }} />
              </div>
              <span>{env.load}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
