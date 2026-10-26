"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel } from "@myheritage/ui";
import { loadSession, type Session } from "@/lib/api";

const OPTIONS = [
  { role: "student", label: "Student", href: "/student", roles: ["student"] },
  { role: "instructor", label: "Teacher", href: "/instructor", roles: ["instructor"] },
  { role: "admin", label: "Administration", href: "/admin", roles: ["admin", "registrar"] },
  { role: "applicant", label: "Applicant", href: "/applicant", roles: ["applicant"] },
  { role: "employer", label: "Employer", href: "/employer", roles: ["employer"] },
] as const;

export default function RoleSelectPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const current = loadSession();
    if (!current) {
      router.replace("/login?next=/role-select");
      return;
    }
    setSession(current);
  }, [router]);

  if (!session) return null;

  const options = OPTIONS.filter((opt) => opt.roles.some((r) => session.roles.includes(r)));

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <h1 style={{ fontFamily: "var(--mh-font-display)", fontSize: "var(--mh-h1)", margin: "0 0 0.35rem" }}>
          Choose a workspace
        </h1>
        <p style={{ color: "var(--mh-text-muted)", marginTop: 0 }}>
          Signed in as {session.givenName} {session.familyName}
        </p>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {options.map((opt) => (
            <Panel key={opt.role} dense>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                <strong>{opt.label}</strong>
                <Button type="button" onClick={() => router.push(opt.href)}>
                  Enter
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
