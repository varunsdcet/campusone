"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Panel, StatusPill } from "@myheritage/ui";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { api, loadSession } from "@/lib/api";

type UserRow = {
  accountId: string;
  email: string;
  givenName: string;
  familyName: string;
  roles: string[];
  studentNumber: string | null;
  programName: string | null;
};

const ROLE_OPTIONS = ["instructor", "student", "applicant", "employer", "admin", "registrar"] as const;

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}!7`;
}

function CreateUserInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const initialRole =
    roleParam && (ROLE_OPTIONS as readonly string[]).includes(roleParam) ? roleParam : "instructor";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    givenName: "",
    familyName: "",
    role: initialRole,
    password: "",
    studentNumber: "",
    programName: "",
  });
  const [programs, setPrograms] = useState<Array<{ id: string; code: string; name: string }> | null>(null);

  const [lastLogin, setLastLogin] = useState<{
    email: string;
    role: string;
    temporaryPassword: string;
    portalHref: string;
    studentNumber: string | null;
    loginHint: string;
  } | null>(null);

  useEffect(() => {
    if (roleParam && (ROLE_OPTIONS as readonly string[]).includes(roleParam) && roleParam !== form.role) {
      setForm((f) => ({ ...f, role: roleParam }));
    }
  }, [roleParam, form.role]);

  const heading = useMemo(() => {
    if (form.role === "student") {
      return {
        title: "Student onboarding",
        subtitle: "Create student account → then enrol into a section",
        breadcrumb: ["Administration", "Registrar", "Student onboarding"],
      };
    }
    if (form.role === "instructor") {
      return {
        title: "Instructor onboarding",
        subtitle: "Create instructor account → then assign a section",
        breadcrumb: ["Administration", "Academics", "Instructor onboarding"],
      };
    }
    return {
      title: "Create user",
      subtitle: "Provision teachers, students, and admins · live API",
      breadcrumb: ["Administration", "Users", "Create"],
    };
  }, [form.role]);

  async function refresh(token: string) {
    const res = await api<{ items: UserRow[] }>("/admin/users", {}, token);
    setUsers(res.items);
  }

  useEffect(() => {
    setForm((f) => (f.password ? f : { ...f, password: temporaryPassword() }));
  }, []);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    refresh(s.accessToken).catch((err) => setError(err instanceof Error ? err.message : "Failed"));
    api<{ items: Array<{ id: string; code: string; name: string }> }>("/admin/programs-lite", {}, s.accessToken)
      .then((res) => setPrograms(res.items))
      .catch(() => setPrograms([]));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const s = loadSession();
    if (!s) return;
    setError(null);
    setNote(null);
    try {
      const password = form.password;
      const created = await api<{
        email: string;
        role: string;
        portalHref?: string;
        studentNumber?: string | null;
        loginHint?: string;
      }>(
        "/admin/users",
        {
          method: "POST",
          body: JSON.stringify({
            email: form.email,
            givenName: form.givenName,
            familyName: form.familyName,
            role: form.role,
            password: form.password,
            studentNumber: form.studentNumber || undefined,
            programName: form.programName || undefined,
          }),
        },
        s.accessToken,
      );
      const portalHref =
        created.portalHref ||
        (created.role === "instructor"
          ? "/instructor"
          : created.role === "student"
            ? "/student"
            : "/login");
      const loginHint =
        created.loginHint ||
        `Login at /login with ${created.email} → ${portalHref}`;
      setLastLogin({
        email: created.email,
        role: created.role,
        temporaryPassword: password,
        portalHref,
        studentNumber: created.studentNumber ?? null,
        loginHint,
      });
      setNote(`Created ${created.role} ${created.email}`);
      setForm((f) => ({ ...f, email: "", givenName: "", familyName: "", studentNumber: "", password: temporaryPassword() }));
      await refresh(s.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <ScreenScaffold
      role="admin"
      title={heading.title}
      subtitle={heading.subtitle}
      breadcrumb={heading.breadcrumb}
      active="Users"
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/sections/create")}>
          Create section
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/enrolments")}>
          Enrol student
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/student-management/browse")}>
          Student 360
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/user-management")}>
          Instructor 360
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/users")}>
          Directory
        </Button>
      </div>

      {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
      {note ? <StatusPill tone="success">{note}</StatusPill> : null}
      {lastLogin ? (
        <Panel title="Ready to sign in">
          <div style={{ display: "grid", gap: 8, fontSize: 14, lineHeight: 1.45 }}>
            <div>
              <strong>{lastLogin.loginHint}</strong>
            </div>
            <div>
              Email: <code>{lastLogin.email}</code>
            </div>
            {lastLogin.studentNumber ? (
              <div>
                Student number: <code>{lastLogin.studentNumber}</code>
              </div>
            ) : null}
            <div>
              Password: <code>{lastLogin.temporaryPassword}</code>
            </div>
            <div>
              Portal after login: <code>{lastLogin.portalHref}</code>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <Button type="button" onClick={() => router.push("/login")}>
                Open login
              </Button>
              {lastLogin.role === "student" ? (
                <Button type="button" variant="secondary" onClick={() => router.push("/admin/enrolments")}>
                  Enrol into section
                </Button>
              ) : null}
              {lastLogin.role === "instructor" ? (
                <Button type="button" variant="secondary" onClick={() => router.push("/admin/sections/create")}>
                  Assign section
                </Button>
              ) : null}
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel title="New account">
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid var(--mh-border)",
                background: "var(--mh-surface-muted)",
              }}
            >
              <option value="instructor">Teacher / Instructor</option>
              <option value="student">Student</option>
              <option value="applicant">Applicant</option>
              <option value="employer">Employer</option>
              <option value="admin">Admin</option>
              <option value="registrar">Registrar</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Given name</span>
            <Input value={form.givenName} onChange={(e) => setForm({ ...form, givenName: e.target.value })} required />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Family name</span>
            <Input value={form.familyName} onChange={(e) => setForm({ ...form, familyName: e.target.value })} required />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Campus email</span>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@heritage.edu"
              required
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Temporary password</span>
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </label>
          {form.role === "student" ? (
            <>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Student number (optional)</span>
                <Input value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value })} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Program</span>
                {programs && programs.length ? (
                  <select
                    value={form.programName}
                    onChange={(e) => setForm({ ...form, programName: e.target.value })}
                    required
                    style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--mh-border)",
                      background: "var(--mh-surface-muted)",
                    }}
                  >
                    <option value="">Select a program</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input value={form.programName} onChange={(e) => setForm({ ...form, programName: e.target.value })} />
                )}
              </label>
            </>
          ) : null}
          {form.role === "applicant" ? (
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Program interest</span>
              <Input value={form.programName} onChange={(e) => setForm({ ...form, programName: e.target.value })} />
            </label>
          ) : null}
          {form.role === "employer" ? (
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Organization name</span>
              <Input
                value={form.programName}
                onChange={(e) => setForm({ ...form, programName: e.target.value })}
                placeholder="Partner organization"
              />
            </label>
          ) : null}
          <Button type="submit">Create account</Button>
        </form>
      </Panel>

      <Panel title="Live directory">
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {users.map((u) => (
            <li
              key={u.accountId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                borderBottom: "1px solid var(--mh-border)",
                paddingBottom: 8,
              }}
            >
              <div>
                <strong>
                  {u.givenName} {u.familyName}
                </strong>
                <div style={{ color: "var(--mh-text-muted)", fontSize: 13 }}>
                  {u.email}
                  {u.studentNumber ? ` · ${u.studentNumber}` : ""}
                  {u.programName ? ` · ${u.programName}` : ""}
                </div>
              </div>
              <StatusPill>{u.roles.join(", ")}</StatusPill>
            </li>
          ))}
        </ul>
      </Panel>
    </ScreenScaffold>
  );
}

export default function CreateUserPage() {
  return (
    <Suspense fallback={<p style={{ padding: 32 }}>Loading…</p>}>
      <CreateUserInner />
    </Suspense>
  );
}
