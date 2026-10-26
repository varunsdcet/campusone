"use client";

import { useRouter } from "next/navigation";
import type { SisScreenConfig } from "@/lib/adminSisCatalog";
import { SisActionBtn } from "@/components/SisActionBtn";

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

export function AiDashView({ config }: { config: SisScreenConfig }) {
  const router = useRouter();
  const dash = config.aiDash;
  if (!dash) {
    return (
      <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
        <div className="mh-sis-dash__welcome">
          <div className="mh-sis-dash__welcome-text">
            <h1>{config.title}</h1>
            <p>{config.subtitle}</p>
          </div>
        </div>
        <p className="mh-sis-muted">No AI dashboard metrics are available for this institution yet.</p>
      </div>
    );
  }

  return (
    <div className="mh-sis-dash mh-sis-dash--wide" data-figma-id={config.figmaId}>
      <div className="mh-sis-dash__welcome">
        <div className="mh-sis-dash__welcome-text">
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <BannerActions config={config} />
      </div>

      <div className="mh-sis-dash__kpis">
        {(dash.kpis ?? []).map((k) => (
          <button
            key={k.label}
            type="button"
            className="mh-sis-dash__kpi mh-sis-ai-kpi"
            onClick={() => (k.href ? router.push(k.href) : undefined)}
          >
            <div className="mh-sis-dash__kpi-label">{k.label}</div>
            <div className="mh-sis-dash__kpi-value">{k.value}</div>
            <div className="mh-sis-dash__kpi-hint is-up">{k.hint}</div>
          </button>
        ))}
      </div>

      <div className="mh-sis-ai-dash-split">
        <section className="mh-sis-dash__card">
          <h2>Usage Trend</h2>
          <div className="mh-sis-ai-bars">
            {(dash.usageTrend ?? []).map((bar) => (
              <div key={bar.label} className="mh-sis-ai-bar">
                <div className="mh-sis-ai-bar__col" style={{ height: bar.height }} />
                <span>{bar.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mh-sis-dash__card">
          <h2>Cost Breakdown</h2>
          <div className="mh-sis-ai-cost-list">
            {(dash.costBreakdown ?? []).map((item) => (
              <button
                key={item.label}
                type="button"
                className="mh-sis-ai-cost"
                onClick={() => (item.href ? router.push(item.href) : undefined)}
              >
                <div className="mh-sis-ai-cost__top">
                  <strong>{item.label}</strong>
                  <span>{item.amount}</span>
                </div>
                <div className="mh-sis-cp-progress__track">
                  <div
                    className="mh-sis-cp-progress__fill"
                    style={{ width: `${item.pct}%`, background: item.color || "#2563EB" }}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="mh-sis-dash__card" style={{ marginTop: 16 }}>
        <div className="mh-sis-cp-section-head">
          <h2>Recent Gateway Activity</h2>
          <button
            type="button"
            className="mh-sis-filters__reset"
            style={{ padding: 0 }}
            onClick={() => router.push("/admin/f/ai-12-tool-call-audit")}
          >
            Open audit log →
          </button>
        </div>
        <div className="mh-sis-ai-activity">
          {(dash.activity ?? []).map((row) => (
            <button
              key={row.id}
              type="button"
              className="mh-sis-ai-activity__row"
              onClick={() => (row.href ? router.push(row.href) : undefined)}
            >
              <div>
                <strong>{row.title}</strong>
                <span>
                  {row.id} · {row.when}
                </span>
              </div>
              <span className={`mh-sis-badge mh-sis-badge--${row.tone || "active"}`}>{row.status}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
