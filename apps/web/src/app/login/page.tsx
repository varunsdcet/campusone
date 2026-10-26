"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, clearSession, loadSession, logout, saveSession, type Session } from "@/lib/api";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidStudentNumber(value: string) {
  return /^ST-?\d{4}-?\d{2,}$/i.test(value.replace(/\s/g, "")) || /^[A-Z0-9][A-Z0-9._-]{2,}$/i.test(value);
}

function isValidIdentifier(value: string) {
  return isValidEmail(value) || isValidStudentNumber(value);
}

function homeForRoles(roles: string[]) {
  if (roles.includes("admin") || roles.includes("registrar")) return "/admin";
  if (roles.includes("instructor")) return "/instructor";
  if (roles.includes("applicant")) return "/applicant";
  if (roles.includes("employer")) return "/employer";
  if (roles.length > 1) return "/role-select";
  return "/student";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existing, setExisting] = useState<Session | null>(null);

  useEffect(() => {
    // Do not auto-bounce away — a saved student/instructor session was blocking admin login.
    const session = loadSession();
    setExisting(session);
  }, []);

  const registered = searchParams.get("registered") === "1";
  useEffect(() => {
    const prefill = searchParams.get("email");
    if (prefill) setEmail(prefill);
  }, [searchParams]);

  const emailTrimmed = email.trim();
  const emailError = useMemo(() => {
    if (!touchedEmail && !submitted) return null;
    if (!emailTrimmed) return "Student number or email is required.";
    if (!isValidIdentifier(emailTrimmed)) return "Enter a student number (e.g. ST-2024-001) or email.";
    return null;
  }, [emailTrimmed, touchedEmail, submitted]);

  const passwordError = useMemo(() => {
    if (!touchedPassword && !submitted) return null;
    if (!password) return "Password is required.";
    if (password.length < 8) return "Password must be at least 8 characters long.";
    return null;
  }, [password, touchedPassword, submitted]);

  const canSubmit = Boolean(emailTrimmed) && isValidIdentifier(emailTrimmed) && password.length >= 8 && !loading;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTouchedEmail(true);
    setTouchedPassword(true);
    if (!emailTrimmed) {
      setError("Student number or email is required.");
      return;
    }
    if (!isValidIdentifier(emailTrimmed)) {
      setError("Enter a student number (e.g. ST-2024-001) or email.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const identifier = isValidEmail(emailTrimmed) ? emailTrimmed.toLowerCase() : emailTrimmed;
      const ua =
        typeof navigator !== "undefined" && navigator.userAgent
          ? navigator.userAgent.replace(/\s+/g, " ").slice(0, 48)
          : "browser";
      const deviceFingerprint = `web-${ua}-${remember ? "remember" : "session"}`.slice(0, 120);
      const institutionId = searchParams.get("institutionId");
      const session = await api<Session & { requiresMfa?: boolean }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: identifier,
          password,
          deviceFingerprint: deviceFingerprint.length >= 8 ? deviceFingerprint : `web-device-${Date.now()}`,
          remember,
          ...(institutionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(institutionId)
            ? { institutionId }
            : {}),
        }),
      });
      if (session.requiresMfa) {
        setError("Multi-factor authentication is required for this account. Complete MFA with your institution before continuing.");
        return;
      }
      if (!session.accessToken || !session.roles?.length) {
        setError("Sign-in succeeded but no session was returned. Try again.");
        return;
      }
      // Replace any previous account only after a successful login.
      clearSession();
      setExisting(null);
      saveSession(session, remember);
      if (session.pauseGate || session.accountStatus === "paused") {
        window.location.assign("/student/compliance/explain");
        return;
      }
      const next = searchParams.get("next");
      // Prefer role home over a stale ?next= from another portal (e.g. /student while logging in as admin).
      const dest = next && next.startsWith("/") && canUseNext(next, session.roles) ? next : homeForRoles(session.roles);
      // Full navigation so middleware sees the freshly written mh_roles cookie (router.push races).
      window.location.assign(dest);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Sign-in failed";
      const friendly =
        /Can't reach database|ECONNREFUSED|database server/i.test(raw)
          ? "Campus services are temporarily unavailable. Start the database and try again."
          : /Failed to fetch|NetworkError|Load failed|TypeError/i.test(raw)
            ? "Cannot reach campus services. Hard-refresh the page and try again."
          : /Invalid credentials|unauthorized|401/i.test(raw)
            ? "Email/student number or password is incorrect."
            : /VALIDATION_ERROR|Invalid request|deviceFingerprint/i.test(raw)
              ? "Sign-in request was rejected. Hard-refresh and try again."
            : raw.length > 180
              ? "Sign-in failed. Please try again."
              : raw;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }

  function canUseNext(next: string, roles: string[]) {
    if (next.startsWith("/admin")) return roles.includes("admin") || roles.includes("registrar");
    if (next.startsWith("/instructor")) return roles.includes("instructor");
    if (next.startsWith("/student")) return roles.includes("student");
    if (next.startsWith("/applicant")) return roles.includes("applicant");
    if (next.startsWith("/employer")) return roles.includes("employer");
    return true;
  }

  const fieldError = Boolean(passwordError);

  return (
    <div
      className="mh-login"
      data-node-id="17:6"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "stretch",
        background: "#F6F7F4",
        fontFamily: "var(--mh-font-sans)",
      }}
    >
      <style>{`
        .mh-login { width: 100%; }
        .mh-login-form { flex: 0 0 792px; }
        .mh-login-hero { flex: 1 1 648px; min-width: 420px; }
        @media (max-width: 1100px) {
          .mh-login-form { flex: 0 0 55%; min-width: 360px; }
          .mh-login-hero { min-width: 280px; }
        }
        @media (max-width: 900px) {
          .mh-login { flex-direction: column !important; }
          .mh-login-hero { min-height: 240px !important; max-height: 320px !important; min-width: 100% !important; flex: none !important; order: -1; }
          .mh-login-form { width: 100% !important; flex: none !important; padding: 2rem 1.25rem !important; min-height: auto !important; }
        }
      `}</style>

      <section
        className="mh-login-form"
        style={{
          background: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "40px clamp(1.5rem, 6vw, 100px)",
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        <img
          src="/brand/campusone/logo.png"
          alt="CampusOne"
          style={{ display: "block", height: 64, width: "auto", maxWidth: 320, objectFit: "contain" }}
        />

        <form onSubmit={onSubmit} noValidate style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--mh-font-display)", fontSize: 34, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.03em", color: "#1F2937" }}>
              Sign in to CampusOne
            </h1>
            <p style={{ margin: 0, color: "#5C5F5A", fontSize: 15, lineHeight: 1.4 }}>
              Students, instructors, and staff sign in with campus email or student number.
            </p>
          </div>

          {existing ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 12,
                background: "#F0F4F1",
                border: "1px solid #D5DED8",
              }}
            >
              <p style={{ margin: 0, fontSize: 14, color: "#1F2937", lineHeight: 1.4 }}>
                Already signed in as{" "}
                <strong>
                  {existing.givenName} {existing.familyName}
                </strong>
                .
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  className="mh-btn"
                  onClick={() => {
                    const next = searchParams.get("next");
                    const dest =
                      next && next.startsWith("/") && canUseNext(next, existing.roles)
                        ? next
                        : homeForRoles(existing.roles);
                    window.location.assign(dest);
                  }}
                  style={{
                    border: 0,
                    borderRadius: 999,
                    padding: "8px 14px",
                    background: "#1B2A4A",
                    color: "#fff",
                    fontWeight: 650,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    setExisting(null);
                  }}
                  style={{
                    border: "1px solid #C5CEC8",
                    borderRadius: 999,
                    padding: "8px 14px",
                    background: "#fff",
                    color: "#1F2937",
                    fontWeight: 650,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Use a different account
                </button>
              </div>
            </div>
          ) : null}

          {registered && !existing ? (
            <p role="status" style={{ margin: 0, padding: "12px 14px", borderRadius: 12, background: "#F0F4F1", border: "1px solid #D5DED8", fontSize: 14, color: "#1F2937", lineHeight: 1.4 }}>
              Your applicant account is ready. Sign in to start your application.
            </p>
          ) : null}

          {error && !passwordError && !emailError ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#BA1A1A", fontSize: 13 }}>
              <img src="/brand/login/alert.svg" alt="" width={16} height={16} />
              <span>{error}</span>
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1F2937" }}>Student number or email</span>
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setTouchedEmail(true);
                  setError(null);
                }}
                onBlur={() => setTouchedEmail(true)}
                autoComplete="username"
                placeholder="ST-2024-001 or your campus email"
                aria-invalid={Boolean(emailError)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  fontSize: 15,
                  padding: "12px 14px",
                  borderRadius: 6,
                  border: `1px solid ${emailError ? "#BA1A1A" : "#E1E3DC"}`,
                  background: "#F9FAF6",
                  color: "#1F2937",
                  outline: "none",
                }}
              />
              {emailError ? (
                <span style={{ display: "flex", gap: 6, alignItems: "center", color: "#BA1A1A", fontSize: 13 }}>
                  <img src="/brand/login/alert.svg" alt="" width={16} height={16} />
                  {emailError}
                </span>
              ) : null}
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1F2937" }}>Password</span>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setTouchedPassword(true);
                    setError(null);
                  }}
                  onBlur={() => setTouchedPassword(true)}
                  autoComplete="current-password"
                  aria-invalid={Boolean(passwordError)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    fontSize: 15,
                    padding: "12px 44px 12px 14px",
                    borderRadius: 6,
                    border: `1px solid ${fieldError ? "#BA1A1A" : "#E1E3DC"}`,
                    background: "#F9FAF6",
                    color: "#1F2937",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    width: 20,
                    height: 20,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <img src="/brand/login/eye.svg" alt="" width={20} height={20} />
                </button>
              </div>
              {passwordError ? (
                <span style={{ display: "flex", gap: 6, alignItems: "center", color: "#BA1A1A", fontSize: 13 }}>
                  <img src="/brand/login/alert.svg" alt="" width={16} height={16} />
                  {passwordError}
                </span>
              ) : null}
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#5C5F5A", cursor: "pointer" }}>
                <span
                  role="checkbox"
                  aria-checked={remember}
                  tabIndex={0}
                  onClick={() => setRemember((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setRemember((v) => !v);
                    }
                  }}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: `2px solid ${remember ? "#2563EB" : "#E1E3DC"}`,
                    background: remember ? "#2563EB" : "#FFFFFF",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    boxSizing: "border-box",
                  }}
                >
                  {remember ? <img src="/brand/login/check.svg" alt="" width={12} height={12} /> : null}
                </span>
                Remember me
              </label>
              <a href="/reset" style={{ color: "#2563EB", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                Forgot password?
              </a>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 6,
                background: canSubmit ? "#2563EB" : "#C5C9C0",
                color: "#FFFFFF",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "inherit",
                padding: "12px 16px",
                cursor: canSubmit ? "pointer" : "not-allowed",
                opacity: loading ? 0.85 : 1,
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p style={{ margin: 0, fontSize: 14, color: "#5C5F5A", textAlign: "center" }}>
              Applying to CampusOne?{" "}
              <a href="/apply" style={{ color: "#2563EB", fontWeight: 600, textDecoration: "none" }}>
                Create an applicant account
              </a>
            </p>
          </div>

        </form>

        <div aria-hidden style={{ height: 1 }} />
      </section>

      <aside
        className="mh-login-hero"
        aria-hidden
        style={{
          position: "relative",
          minHeight: "100vh",
          overflow: "hidden",
        }}
      >
        <img
          src="/brand/campusone/login-hero.png"
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(135deg, rgba(8,35,83,0.08), rgba(0,159,227,0.12))",
            pointerEvents: "none",
          }}
        />
      </aside>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
