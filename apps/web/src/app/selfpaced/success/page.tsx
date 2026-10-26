"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SelfpacedShell } from "@/components/selfpaced/SelfpacedShell";
import { enrollProgram, loadSelfpacedUser } from "@/lib/selfpacedAuth";
import { api, loadSession } from "@/lib/api";
import { useSelfpacedCatalogue } from "@/lib/useSelfpacedCatalogue";

function SuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const slug = params.get("slug") || "";
  const { programs } = useSelfpacedCatalogue();
  const program = programs.find((item) => item.slug === slug || item.id === slug);
  const [hasUser, setHasUser] = useState(false);
  const [ready, setReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = params.get("session_id");
    const demo = params.get("demo") === "1";
    const free = params.get("free") === "1";
    const session = loadSession();
    const user = Boolean(loadSelfpacedUser() && session);
    setHasUser(user);

    if (!slug || (!sessionId && !demo && !free)) {
      setError("This payment link is incomplete. Return to the program page and try again.");
      setReady(true);
      return;
    }

    let cancelled = false;
    void fetch("/api/selfpaced/checkout/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, slug, demo, free }),
    })
      .then(async (response) => {
        const result = (await response.json()) as { verified?: boolean; error?: string };
        if (!response.ok || !result.verified) throw new Error(result.error || "Payment verification failed.");
        if (cancelled) return;
        if (free) {
          const token = session?.accessToken;
          if (!token) throw new Error("Sign in with your student account before activating free access.");
          await api("/selfpaced/enrolments/free", { method: "POST", body: JSON.stringify({ slug }) }, token, { skipAuthRedirect: true });
        } else if (!demo) {
          if (!session?.accessToken || !sessionId) throw new Error("Sign in before confirming paid enrolment.");
          await api("/selfpaced/enrolments/paid", { method: "POST", body: JSON.stringify({ slug, sessionId }) }, session.accessToken, { skipAuthRedirect: true });
        }
        enrollProgram(slug);
        setVerified(true);
        setReady(true);
        if (user) {
          window.setTimeout(() => router.replace("/selfpaced/dashboard"), 900);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Payment verification failed.");
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, router, params]);

  const dashHref = "/selfpaced/dashboard";
  const learnHref = program ? `/selfpaced/learn/${program.slug}` : dashHref;

  if (!ready) {
    return (
      <SelfpacedShell>
        <div className="sp-success">
          <p>Confirming…</p>
        </div>
      </SelfpacedShell>
    );
  }

  if (!verified) {
    return (
      <SelfpacedShell>
        <div className="sp-success">
          <p className="sp-kicker">PAYMENT NOT CONFIRMED</p>
          <h1>We could not unlock this course</h1>
          <p className="sp-lede">{error || "Payment verification is still pending."}</p>
          <div className="sp-hero__cta">
            <Link href={program ? `/selfpaced/programs/${program.slug}` : "/selfpaced#catalog"} className="sp-btn sp-btn--primary">
              Return to program
            </Link>
            <a href="mailto:info@hccbc.com" className="sp-btn sp-btn--ghost">Contact support</a>
          </div>
        </div>
      </SelfpacedShell>
    );
  }

  if (!hasUser) {
    return (
      <SelfpacedShell nextAfterLogin={dashHref}>
        <div className="sp-success">
          <p className="sp-kicker">PAYMENT RECEIVED</p>
          <h1>Almost there</h1>
          <p className="sp-lede">
            Your seat is reserved. Sign in with the same account you used before checkout to open your dashboard.
          </p>
          <Link
            href={`/selfpaced/success?slug=${encodeURIComponent(slug)}&auth=login&next=${encodeURIComponent(dashHref)}`}
            className="sp-btn sp-btn--primary"
          >
            Sign in to open dashboard
          </Link>
        </div>
      </SelfpacedShell>
    );
  }

  return (
    <SelfpacedShell>
      <div className="sp-success">
        <p className="sp-kicker">ENROLLMENT CONFIRMED</p>
        <h1>{program ? program.title : "Your course"} is ready</h1>
        <p className="sp-lede">Payment received. Taking you to your dashboard…</p>
        <div className="sp-hero__cta">
          <Link href={dashHref} className="sp-btn sp-btn--primary">
            Go to dashboard
          </Link>
          <Link href={learnHref} className="sp-btn sp-btn--ghost">
            Start learning
          </Link>
        </div>
      </div>
    </SelfpacedShell>
  );
}

export default function SelfpacedSuccessPage() {
  return (
    <Suspense
      fallback={
        <SelfpacedShell>
          <div className="sp-success">
            <p>Confirming…</p>
          </div>
        </SelfpacedShell>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
