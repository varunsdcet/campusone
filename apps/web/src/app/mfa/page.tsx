"use client";

import { useRouter } from "next/navigation";
import { Button, Banner } from "@myheritage/ui";

export default function MfaPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--mh-surface)",
          border: "1px solid var(--mh-border)",
          borderRadius: "var(--mh-radius-lg)",
          padding: "2rem",
          boxShadow: "0 18px 40px rgba(26, 31, 22, 0.06)",
        }}
      >
        <div style={{ fontFamily: "var(--mh-font-display)", fontSize: "1.6rem" }}>CampusOne</div>
        <p style={{ color: "var(--mh-text-muted)", marginTop: "0.35rem" }}>Multi-factor authentication</p>
        <Banner>MFA verification is not configured for this institution. No access session has been issued. Contact an administrator before trying again.</Banner>
        <div style={{ marginTop: "1.25rem" }}>
          <Button type="button" onClick={() => router.push("/login")} style={{ width: "100%" }}>
            Return to sign in
          </Button>
        </div>
      </section>
    </div>
  );
}
