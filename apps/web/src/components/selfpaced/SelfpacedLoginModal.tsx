"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearSession, saveSession, type Session } from "@/lib/api";
import { loadEnrollments, saveSelfpacedUser } from "@/lib/selfpacedAuth";

type Mode = "login" | "signup";

function checkoutDestFromNext(next: string): string | null {
  const raw = (next || "").trim();
  if (!raw) return null;
  if (raw.includes("/selfpaced/checkout")) return raw.split("&auth=")[0];
  try {
    const url = new URL(raw, "http://local.invalid");
    if (url.pathname.startsWith("/selfpaced/programs/")) {
      const slug = url.pathname.split("/").filter(Boolean).pop();
      if (slug) return `/selfpaced/checkout?slug=${encodeURIComponent(slug)}`;
    }
    if (url.searchParams.get("enroll") === "1") {
      const slug = url.pathname.split("/").filter(Boolean).pop();
      if (slug) return `/selfpaced/checkout?slug=${encodeURIComponent(slug)}`;
    }
  } catch {
    /* ignore */
  }
  if (raw.includes("enroll=1") && raw.includes("/programs/")) {
    const m = raw.match(/\/selfpaced\/programs\/([^/?#]+)/);
    if (m?.[1]) return `/selfpaced/checkout?slug=${encodeURIComponent(m[1])}`;
  }
  return null;
}

export function SelfpacedLoginModal({
  open,
  onClose,
  initialMode = "login",
  nextPath = "/selfpaced/dashboard",
}: {
  open: boolean;
  onClose: () => void;
  initialMode?: Mode;
  nextPath?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setName("");
      setEmail("");
      setPassword("");
      setShowPw(false);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const resolveDest = (activeMode: Mode) => {
    const pay = checkoutDestFromNext(nextPath || "");
    if (pay) return pay;

    const next = (nextPath || "").trim();
    if (next && next !== "/selfpaced" && !next.startsWith("/selfpaced#") && !next.includes("/dashboard")) {
      return next;
    }

    // Unpaid accounts must buy before dashboard access.
    if (activeMode === "signup") return "/selfpaced#catalog";
    if (loadEnrollments().length > 0) return "/selfpaced/dashboard";
    return "/selfpaced#catalog";
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (mode === "signup" && !name.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (mode === "signup" && !trimmed.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    if (mode === "login" && trimmed.length < 3) {
      setError("Enter your email or student number.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const ua = navigator.userAgent.replace(/\s+/g, " ").slice(0, 48) || "browser";
      if (mode === "signup") {
        await api<{ accepted: true; email: string }>("/selfpaced/register", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), email: trimmed.toLowerCase(), password }),
        }, undefined, { skipAuthRedirect: true });
      }
      const session = await api<Session & { requiresMfa?: boolean }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: trimmed.includes("@") ? trimmed.toLowerCase() : trimmed,
          password,
          deviceFingerprint: `selfpaced-${ua}`.slice(0, 120),
          remember: true,
        }),
      });
      if (session.requiresMfa) throw new Error("Multi-factor authentication is required for this account.");
      if (!session.accessToken || !session.roles?.includes("student")) {
        throw new Error("A CampusOne student account is required for self-paced learning.");
      }
      clearSession();
      saveSession(session, true);
      saveSelfpacedUser({
        name: `${session.givenName || ""} ${session.familyName || ""}`.trim() || "Learner",
        email: trimmed.toLowerCase(),
      });
      const dest = resolveDest(mode);
      onClose();
      window.location.assign(dest);
    } catch (err) {
      const raw = err instanceof Error ? err.message : mode === "signup" ? "Account creation failed." : "Sign-in failed.";
      setError(/Invalid credentials|unauthorized|401/i.test(raw) ? "Email/student number or password is incorrect." : raw);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sp-modal" role="dialog" aria-modal="true" aria-labelledby="sp-login-title">
      <button type="button" className="sp-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="sp-modal__panel">
        <button type="button" className="sp-modal__close" onClick={onClose} aria-label="Close dialog">
          ×
        </button>
        <div className="sp-modal__brand sp-modal__brand--logo-only">
          <img src="/brand/campusone/logo.png" alt="CampusOne" />
        </div>
        <p className="sp-kicker">{mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</p>
        <h2 id="sp-login-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="sp-modal__lede">
          {mode === "login"
            ? "Use your CampusOne learner account. Unpurchased programs open the secure Stripe checkout."
            : "Create a self-paced learner account, choose a course, and continue to checkout. Campus admission is a separate process."}
        </p>
        <form className="sp-modal__form" onSubmit={submit}>
          {mode === "signup" ? (
            <label>
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" autoComplete="name" required />
            </label>
          ) : null}
          <label>
            {mode === "login" ? "Email or student number" : "Email"}
            <input
              type={mode === "login" ? "text" : "email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === "login" ? "you@example.com or SP-2026-…" : "you@example.com"}
              autoComplete={mode === "login" ? "username" : "email"}
              required
            />
          </label>
          <label>
            Password
            <div className="sp-modal__pw">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          {error ? <p className="sp-error">{error}</p> : null}
          <button type="submit" className="sp-btn sp-btn--primary sp-btn--block" disabled={loading}>
            {loading ? (mode === "signup" ? "Creating account…" : "Signing in…") : mode === "login" ? "Sign in" : "Create account & continue"}
          </button>
        </form>
        <p className="sp-modal__switch">
          {mode === "login" ? (
            <>
              New here?{" "}
              <button type="button" onClick={() => setMode("signup")}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("login")}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
