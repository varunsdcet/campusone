"use client";

import Link from "next/link";
import { Button, Panel } from "@myheritage/ui";

export default function Page() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <Panel>
        <h1 style={{ fontFamily: "var(--mh-font-display)", marginTop: 0 }}>Accessibility</h1>
        <p style={{ color: "var(--mh-text-muted)" }}>CampusOne is designed for keyboard navigation, visible focus, semantic headings, labelled controls, and screen-reader announcements.</p>
        <p>If a document or workflow is not accessible to you, contact the college and include the page address and the format you need. We will provide an accessible alternative.</p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/login"><Button type="button">Sign in</Button></Link>
          <Link href="/role-select"><Button type="button" variant="secondary">Workspaces</Button></Link>
          <Link href="/help"><Button type="button" variant="secondary">Get help</Button></Link>
        </div>
      </Panel>
    </div>
  );
}
