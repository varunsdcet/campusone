"use client";

import Link from "next/link";
import {
  AIBlock,
  ApprovalBar,
  Banner,
  BrandLockup,
  Breadcrumb,
  Button,
  EmptyState,
  Input,
  LogoMark,
  Metric,
  Panel,
  ReadOnlyGuard,
  RecordHeader,
  StatusPill,
} from "@myheritage/ui";

const swatch = (bg: string, label: string) => (
  <div key={label} style={{ flex: "1 1 120px" }}>
    <div style={{ height: 56, borderRadius: "var(--mh-radius-md)", background: bg, border: "1px solid var(--mh-border)" }} />
    <div style={{ fontSize: 12, marginTop: 6, color: "var(--mh-text-muted)" }}>{label}</div>
  </div>
);

export default function DesignSystemPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--mh-bg)" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "1.5rem clamp(1rem,4vw,3rem) 3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 12 }}>
          <BrandLockup />
          <Link href="/role-select">
            <Button type="button" variant="secondary">
              Workspaces
            </Button>
          </Link>
        </div>
        <Breadcrumb items={["Shared", "Component library"]} />
        <RecordHeader
          title="Component library"
          subtitle="Figma 26:1156 · white/green tokens · @myheritage/ui primitives"
        />

        <Panel title="Brand & logo">
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <LogoMark size={36} />
            <BrandLockup />
            <BrandLockup compact />
          </div>
        </Panel>

        <Panel title="Colour tokens">
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {swatch("var(--mh-brand)", "brand #2563EB")}
            {swatch("var(--mh-brand-dark)", "brand-dark")}
            {swatch("var(--mh-olive)", "olive")}
            {swatch("var(--mh-accent-olive, var(--mh-olive))", "accent olive")}
            {swatch("var(--mh-ai)", "ai / info")}
            {swatch("var(--mh-warning)", "warning")}
            {swatch("var(--mh-danger)", "danger")}
            {swatch("var(--mh-bg)", "bg")}
            {swatch("var(--mh-surface)", "surface")}
            {swatch("var(--mh-surface-muted)", "surface-muted")}
          </div>
        </Panel>

        <Panel title="Buttons & inputs">
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: 16 }}>
            <Button type="button">Primary</Button>
            <Button type="button" variant="secondary">
              Secondary
            </Button>
            <Button type="button" variant="danger">
              Danger
            </Button>
            <Button type="button" variant="ai">
              Ask CampusOne
            </Button>
          </div>
          <div style={{ maxWidth: 360 }}>
            <Input placeholder="Search CampusOne ⌘K" />
          </div>
        </Panel>

        <Panel title="Status & feedback">
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: 12 }}>
            <StatusPill>Neutral</StatusPill>
            <StatusPill tone="success">Success</StatusPill>
            <StatusPill tone="warning">Warning</StatusPill>
            <StatusPill tone="danger">Danger</StatusPill>
            <StatusPill tone="ai">AI</StatusPill>
          </div>
          <Banner>Draft grades stay hidden until approval applies.</Banner>
          <Banner tone="success">Student portals online.</Banner>
          <ApprovalBar pendingCount={2} onOpen={() => undefined} />
        </Panel>

        <Panel title="Metrics & empty / AI">
          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: 16 }}>
            <Metric label="GPA" value="3.84" hint="Cumulative" />
            <Metric label="Balance" value="CAD 2,450" hint="Fees" />
            <Metric label="Sections" value="2" hint="Fall 2026" />
          </div>
          <EmptyState title="Nothing here yet" body="Live API returned an empty list for this account." />
          <div style={{ marginTop: 12 }}>
            <AIBlock text="Midterm weighting is 30% of the term grade." sources={[{ id: "1", title: "CS301 syllabus" }]} />
          </div>
        </Panel>

        <Panel title="States">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            {[
              ["/design-system/state-loading", "Loading"],
              ["/design-system/state-empty", "Empty"],
              ["/design-system/state-error", "Error"],
              ["/denied", "Permission denied"],
              ["/offline", "Offline"],
              ["/archive", "Archived"],
              ["/design-system/tokens", "Tokens sheet"],
              ["/design-system/shell", "Admin shell"],
            ].map(([href, label]) => (
              <Link key={href} href={href} style={{ padding: 12, border: "1px solid var(--mh-border)", borderRadius: 8, background: "var(--mh-surface)" }}>
                {label}
              </Link>
            ))}
          </div>
        </Panel>

        <ReadOnlyGuard active>
          <Panel title="Read-only guard demo">
            <p style={{ margin: 0 }}>Protected academic record surface.</p>
          </Panel>
        </ReadOnlyGuard>
      </div>
    </div>
  );
}
