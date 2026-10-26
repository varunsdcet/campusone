"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Banner, Button, Input } from "@myheritage/ui";
import { api, ApiError } from "@/lib/api";

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === "VALIDATION_ERROR") {
      if (/password/i.test(err.message)) return "Password must be at least 8 characters long.";
      if (/token/i.test(err.message)) return "Reset link is invalid or expired. Request a new one.";
      if (/email/i.test(err.message)) return "Enter the email address registered to your account.";
      return fallback;
    }
    if (/invalid or expired/i.test(err.message)) return "Reset link is invalid or expired. Request a new one.";
  }
  if (err instanceof Error && /Failed to fetch|NetworkError|Load failed/i.test(err.message)) {
    return "Cannot reach campus services. Check your connection and try again.";
  }
  return fallback;
}

export default function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenFromUrl = params.get("token") || "";
  const [email, setEmail] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(tokenFromUrl);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mailed, setMailed] = useState<boolean | null>(null);

  const mode = useMemo(() => (token ? "reset" : "forgot"), [token]);

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter the email address registered to your account.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ok: boolean; mailed?: boolean; resetToken?: string }>(
        "/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            studentNumber: studentNumber.trim() || undefined,
          }),
        },
      );
      setSent(true);
      setMailed(Boolean(res.mailed));
      if (res.resetToken) setToken(res.resetToken);
    } catch (err) {
      setError(friendlyError(err, "Could not send reset email. Check the details and try again."));
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      setError(friendlyError(err, "Could not update your password. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <form
        onSubmit={mode === "forgot" ? onForgot : onReset}
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
        <p style={{ color: "var(--mh-text-muted)", marginTop: "0.35rem" }}>
          {mode === "forgot" ? "Reset password" : "Choose a new password"}
        </p>
        {error ? <Banner>{error}</Banner> : null}
        {sent && mode === "forgot" ? (
          <Banner>
            If an account exists for {email}, reset instructions were {mailed ? "emailed" : "prepared"}.
            {token ? " Enter a new password below." : ""}
          </Banner>
        ) : null}
        {done ? <Banner>Password updated. Redirecting to sign in…</Banner> : null}

        {mode === "forgot" && !token ? (
          <>
            <label style={{ display: "grid", gap: "0.35rem", marginTop: "1rem" }}>
              Student number (students only)
              <Input
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                autoComplete="username"
                placeholder="Leave blank if you are staff"
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem", marginTop: "1rem" }}>
              Registered email
              <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
          </>
        ) : (
          <>
            {!tokenFromUrl ? (
              <label style={{ display: "grid", gap: "0.35rem", marginTop: "1rem" }}>
                Reset token
                <Input value={token} onChange={(e) => setToken(e.target.value)} />
              </label>
            ) : null}
            <label style={{ display: "grid", gap: "0.35rem", marginTop: "1rem" }}>
              New password
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          </>
        )}

        <div style={{ marginTop: "1.25rem" }}>
          <Button type="submit" style={{ width: "100%" }} disabled={busy}>
            {mode === "forgot" && !token ? "Send reset link" : "Update password"}
          </Button>
        </div>
        <p style={{ marginTop: "1rem", fontSize: "var(--mh-body-compact)" }}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
