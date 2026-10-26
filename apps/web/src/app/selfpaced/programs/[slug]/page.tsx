"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CurriculumOutline } from "@/components/selfpaced/CurriculumOutline";
import { SelfpacedShell } from "@/components/selfpaced/SelfpacedShell";
import { isEnrolled, loadSelfpacedUser } from "@/lib/selfpacedAuth";
import { getCurriculum } from "@/lib/selfpacedCurriculum";
import { formatCad } from "@/lib/selfpacedPrograms";
import { useSelfpacedCatalogue } from "@/lib/useSelfpacedCatalogue";

function ProgramInner() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { programs, loading } = useSelfpacedCatalogue();
  const program = programs.find((item) => item.slug === params.slug || item.id === params.slug);
  const chapters = program ? getCurriculum(program.slug) : [];
  const [enrolled, setEnrolled] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    if (!program) return;
    setEnrolled(isEnrolled(program.slug));
    setLoggedIn(Boolean(loadSelfpacedUser()));
  }, [program, searchParams]);

  // Old links used ?enroll=1 — send them straight to Stripe checkout.
  useEffect(() => {
    if (!program) return;
    if (searchParams.get("enroll") !== "1") return;
    if (isEnrolled(program.slug)) {
      router.replace(`/selfpaced/learn/${program.slug}`);
      return;
    }
    router.replace(`/selfpaced/checkout?slug=${encodeURIComponent(program.slug)}`);
  }, [program, searchParams, router]);

  if (!program && loading) {
    return <SelfpacedShell><div className="sp-detail sp-detail--empty"><p>Loading live program…</p></div></SelfpacedShell>;
  }

  if (!program) {
    return (
      <SelfpacedShell>
        <div className="sp-detail sp-detail--empty">
          <h1>Program not found</h1>
          <Link href="/selfpaced#catalog" className="sp-btn sp-btn--primary">
            Back to catalog
          </Link>
        </div>
      </SelfpacedShell>
    );
  }

  const goPay = () => {
    router.push(`/selfpaced/checkout?slug=${encodeURIComponent(program.slug)}`);
  };

  return (
    <SelfpacedShell nextAfterLogin={`/selfpaced/checkout?slug=${encodeURIComponent(program.slug)}`}>
      <div className="sp-detail">
        <div className="sp-detail__main">
          <div className="sp-detail__hero-img">
            <img src={program.image} alt="" />
          </div>
          <div className="sp-card__tags">
            <span>{program.subject}</span>
            <span>{program.level}</span>
          </div>
          <h1>{program.title}</h1>
          <p className="sp-lede">{program.description}</p>
          <div className="sp-detail__stats">
            <div>
              <strong>{program.hours.toFixed(1)}</strong>
              <span>Hours</span>
            </div>
            <div>
              <strong>{program.chapters}</strong>
              <span>Chapters</span>
            </div>
            <div>
              <strong>{chapters.reduce((n, c) => n + c.activities.length, 0)}</strong>
              <span>Activities</span>
            </div>
          </div>
          <CurriculumOutline chapters={chapters} slug={program.slug} showPacing />
          <button type="button" className="sp-linkish" onClick={() => router.push("/selfpaced#catalog")}>
            ← All programs
          </button>
        </div>

        <aside className="sp-tuition">
          <p className="sp-kicker">TUITION</p>
          <p className="sp-tuition__price">{formatCad(program.priceCad)}</p>
          <p className="sp-tuition__note">{program.priceCad === 0 ? "Free test enrolment · no card required" : "One-time payment via Stripe"} · 1 chapter unlocks each day · Premium certificate on completion</p>
          {!loggedIn ? (
            <p className="sp-tuition__auth-note">
              Sign up or log in, then pay on Stripe. The course unlocks only after successful payment.
            </p>
          ) : null}
          {enrolled ? (
            <Link href={`/selfpaced/learn/${program.slug}`} className="sp-btn sp-btn--primary sp-btn--block">
              Open in my learning
            </Link>
          ) : (
            <button type="button" className="sp-btn sp-btn--primary sp-btn--block" onClick={goPay}>
              {program.priceCad === 0 ? (loggedIn ? "Enrol free" : "Sign up & enrol free") : loggedIn ? "Pay with Stripe" : "Sign up & pay with Stripe"}
            </button>
          )}
          <ul className="sp-tuition__features">
            {program.features.map((f) => (
              <li key={f}>
                <span aria-hidden>✓</span>
                {f}
              </li>
            ))}
          </ul>
          <p className="sp-tuition__secure">{program.priceCad === 0 ? "Testing course · no payment collected" : "Secure checkout powered by Stripe (test mode)"}</p>
        </aside>
      </div>
    </SelfpacedShell>
  );
}

export default function SelfpacedProgramPage() {
  return (
    <Suspense
      fallback={
        <SelfpacedShell>
          <div className="sp-detail">
            <p>Loading program…</p>
          </div>
        </SelfpacedShell>
      }
    >
      <ProgramInner />
    </Suspense>
  );
}
