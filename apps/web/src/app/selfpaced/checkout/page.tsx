"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SelfpacedShell } from "@/components/selfpaced/SelfpacedShell";
import { isEnrolled, loadSelfpacedUser } from "@/lib/selfpacedAuth";
import { formatCad } from "@/lib/selfpacedPrograms";
import { useSelfpacedCatalogue } from "@/lib/useSelfpacedCatalogue";

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const slug = params.get("slug") || "";
  const { programs, loading: catalogueLoading } = useSelfpacedCatalogue();
  const program = useMemo(() => programs.find((item) => item.slug === slug || item.id === slug), [programs, slug]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    if (!program && !catalogueLoading) {
      setBusy(false);
      return;
    }
    if (!program) return;

    // Already paid for this program — skip Stripe.
    if (isEnrolled(program.slug)) {
      router.replace(`/selfpaced/dashboard`);
      return;
    }

    const user = loadSelfpacedUser();
    if (!user) {
      setNeedsAuth(true);
      setBusy(false);
      const resume = `/selfpaced/checkout?slug=${encodeURIComponent(program.slug)}`;
      router.replace(
        `/selfpaced/checkout?slug=${encodeURIComponent(program.slug)}&auth=signup&next=${encodeURIComponent(resume)}`,
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/selfpaced/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: program.slug }),
        });
        const data = (await res.json()) as { url?: string; error?: string; mode?: string };
        if (cancelled) return;
        if (!res.ok || !data.url) {
          setError(data.error || "Could not start Stripe Checkout");
          setBusy(false);
          return;
        }
        // Always leave this site for Stripe hosted Checkout (payment gateway).
        window.location.assign(data.url);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Checkout failed");
          setBusy(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [program, catalogueLoading, router]);

  if (!program && catalogueLoading) return <SelfpacedShell><div className="sp-checkout"><p>Loading live program…</p></div></SelfpacedShell>;
  if (!program) {
    return (
      <SelfpacedShell>
        <div className="sp-checkout">
          <h1>Checkout</h1>
          <p>Missing program.</p>
          <Link href="/selfpaced#catalog" className="sp-btn sp-btn--primary">
            Browse programs
          </Link>
        </div>
      </SelfpacedShell>
    );
  }

  return (
    <SelfpacedShell nextAfterLogin={`/selfpaced/checkout?slug=${encodeURIComponent(program.slug)}`}>
      <div className="sp-checkout" style={{ gridTemplateColumns: "1fr" }}>
        <div className="sp-checkout__panel">
          <p className="sp-kicker">{program.priceCad === 0 ? "FREE TEST ENROLMENT" : "SECURE PAYMENT"}</p>
          <h1>{needsAuth ? "Sign in to continue" : busy ? (program.priceCad === 0 ? "Activating access…" : "Opening Stripe…") : "Checkout"}</h1>
          <p className="sp-lede">
            {program.title} · {formatCad(program.priceCad)}
          </p>
          {needsAuth ? (
            <p className="sp-tuition__note">
              Create an account or log in first. {program.priceCad === 0 ? "No card will be requested for this testing course." : "After that we open the Stripe payment gateway for this program."}
            </p>
          ) : null}
          {busy && !needsAuth ? (
            <p className="sp-tuition__note">{program.priceCad === 0 ? "Creating your free enrolment…" : "Redirecting to Stripe’s secure payment page… Do not close this window."}</p>
          ) : null}
          {error ? (
            <>
              <p className="sp-error">{error}</p>
              <button
                type="button"
                className="sp-btn sp-btn--primary"
                onClick={() => {
                  setError(null);
                  setBusy(true);
                  window.location.reload();
                }}
              >
                Retry payment
              </button>
              <Link href={`/selfpaced/programs/${program.slug}`} className="sp-btn sp-btn--ghost">
                Back to program
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </SelfpacedShell>
  );
}

export default function SelfpacedCheckoutPage() {
  return (
    <Suspense
      fallback={
        <SelfpacedShell>
          <div className="sp-checkout">
            <p>Preparing Stripe Checkout…</p>
          </div>
        </SelfpacedShell>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
