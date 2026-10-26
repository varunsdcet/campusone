"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import { SelfpacedLoginModal } from "@/components/selfpaced/SelfpacedLoginModal";
import { SelfpacedCoachWidget } from "@/components/selfpaced/SelfpacedCoachWidget";
import { SelfpacedCertificate } from "@/components/selfpaced/SelfpacedCertificate";
import {
  clearSelfpacedUser,
  ensureCertificate,
  getEnrollment,
  isCourseComplete,
  loadAllProgress,
  loadEnrollments,
  loadSelfpacedUser,
  type SelfpacedUser,
  syncSelfpacedEnrollments,
} from "@/lib/selfpacedAuth";
import { flattenActivities, getActivity, getCurriculum } from "@/lib/selfpacedCurriculum";
import { getSelfpacedProgram } from "@/lib/selfpacedPrograms";
import { coachModeFor } from "@/lib/selfpacedEngine";
import { logout as logoutHeritage } from "@/lib/api";
import { useSelfpacedCatalogue } from "@/lib/useSelfpacedCatalogue";

const NAV = [
  { href: "/selfpaced/dashboard", label: "Dashboard", icon: "◉" },
  { href: "/selfpaced#catalog", label: "Browse programs", icon: "▣" },
];

function LearnerShellInner({
  children,
  nextAfterLogin = "/selfpaced/dashboard",
  requirePurchase = true,
}: {
  children: ReactNode;
  nextAfterLogin?: string;
  requirePurchase?: boolean;
}) {
  useSelfpacedCatalogue();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<SelfpacedUser | null>(null);
  const [enrollments, setEnrollments] = useState<string[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    setUser(loadSelfpacedUser());
    setEnrollments(loadEnrollments());
    void syncSelfpacedEnrollments().then((records) => setEnrollments(records.map((item) => item.slug))).catch(() => undefined);
  }, [pathname, authOpen]);

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "login" || auth === "signup") {
      setAuthMode(auth);
      setAuthOpen(true);
    }
  }, [searchParams]);

  const progress = useMemo(() => loadAllProgress(), [pathname, enrollments.join("|")]);

  const courses = enrollments
    .map((slug) => getSelfpacedProgram(slug))
    .filter(Boolean) as NonNullable<ReturnType<typeof getSelfpacedProgram>>[];

  const [certCards, setCertCards] = useState<
    Array<{
      program: NonNullable<ReturnType<typeof getSelfpacedProgram>>;
      enrollment: ReturnType<typeof getEnrollment>;
      chapters: number;
      finished: boolean;
      pct: number;
    }>
  >([]);

  useEffect(() => {
    if (!user) {
      setCertCards([]);
      return;
    }
    const next = courses.map((c) => {
      const items = flattenActivities(c.slug);
      const done = progress[c.slug]?.completedActivityIds.length || 0;
      const finished = isCourseComplete(c.slug, items.length);
      let enrollment = getEnrollment(c.slug);
      if (finished) {
        enrollment = ensureCertificate(c.slug, items.length) || enrollment;
      }
      return {
        program: c,
        enrollment,
        chapters: getCurriculum(c.slug).length,
        finished,
        pct: items.length ? Math.round((done / items.length) * 100) : 0,
      };
    });
    setCertCards(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- courses/progress derived; avoid new-array loop
  }, [enrollments.join("|"), user?.email, pathname]);

  const activeCourseSlug = useMemo(() => {
    const m = pathname.match(/\/selfpaced\/(?:learn|certificate)\/([^/]+)/);
    return m?.[1] || null;
  }, [pathname]);

  const coachCtx = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    // /selfpaced/learn/:slug/:chapterId/:activityId
    if (parts[0] === "selfpaced" && parts[1] === "learn" && parts[2]) {
      const slug = parts[2];
      const chapterId = parts[3];
      const activityId = parts[4];
      if (chapterId && activityId) {
        const found = getActivity(slug, chapterId, activityId);
        const mode = found ? coachModeFor(found.activity) : ("on" as const);
        const type = found?.activity.type;
        // Reading/lecture use a collapsed Ask coach button — no floating panel auto-open.
        const embeddedHere = type === "reading" || type === "lecture";
        return {
          slug,
          chapterId,
          activity: found?.activity,
          chapterTitle: found?.chapter.title,
          mode,
          show: mode !== "off" && !embeddedHere,
        };
      }
      // Course outline — keep Ask coach closed / hidden
      return { slug, show: false as const };
    }
    return { show: false as const };
  }, [pathname, enrollments]);

  const closeAuth = () => {
    setAuthOpen(false);
    setUser(loadSelfpacedUser());
    setEnrollments(loadEnrollments());
    if (searchParams.get("auth")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("auth");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    }
  };

  if (!user) {
    return (
      <div className="sp-root sp-learner-gate">
        <div className="sp-dash sp-dash--gate">
          <p className="sp-kicker">LEARNER AREA</p>
          <h1>Sign in to continue</h1>
          <p className="sp-lede">Create an account or log in first. Courses open here only after you purchase a program.</p>
          <div className="sp-hero__cta">
            <button type="button" className="sp-btn sp-btn--primary" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>
              Log In
            </button>
            <button type="button" className="sp-btn sp-btn--ghost" onClick={() => { setAuthMode("signup"); setAuthOpen(true); }}>
              Sign Up
            </button>
            <Link href="/selfpaced" className="sp-btn sp-btn--ghost">
              Back to catalog
            </Link>
          </div>
        </div>
        <SelfpacedLoginModal
          open={authOpen}
          onClose={closeAuth}
          initialMode={authMode}
          nextPath={searchParams.get("next") || nextAfterLogin}
        />
      </div>
    );
  }

  if (requirePurchase && courses.length === 0) {
    return (
      <div className="sp-root sp-learner-gate">
        <div className="sp-dash sp-dash--gate">
          <p className="sp-kicker">NO PURCHASE YET</p>
          <h1>Buy a program to open your dashboard</h1>
          <p className="sp-lede">
            You are signed in as <strong>{user.email}</strong>, but no course is unlocked yet. Enroll and complete payment —
            then your course appears in the sidebar.
          </p>
          <div className="sp-hero__cta">
            <Link href="/selfpaced#catalog" className="sp-btn sp-btn--primary">
              Browse programs
            </Link>
            <button
              type="button"
              className="sp-btn sp-btn--ghost"
              onClick={() => {
                clearSelfpacedUser();
                void logoutHeritage();
                setUser(null);
                router.push("/selfpaced");
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const Sidebar = (
    <aside className="sp-side">
      <Link href="/selfpaced/dashboard" className="sp-side__brand sp-side__brand--logo-only" onClick={() => setNavOpen(false)}>
        <img src="/brand/campusone/logo.png" alt="CampusOne" />
      </Link>

      <nav className="sp-side__nav" aria-label="Learner">
        {NAV.map((item) => {
          const inCourse = pathname.includes("/selfpaced/learn/");
          const browseActive = item.href.includes("#catalog") && !inCourse && pathname === "/selfpaced";
          const dashActive = item.href.includes("dashboard") && pathname.startsWith("/selfpaced/dashboard");
          const active = browseActive || dashActive;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setNavOpen(false)}
              className={active ? "is-active" : ""}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sp-side__courses">
        <p>My courses</p>
        {courses.length === 0 ? (
          <Link href="/selfpaced#catalog" className="sp-side__empty" onClick={() => setNavOpen(false)}>
            No purchases yet — browse programs
          </Link>
        ) : (
          <ul>
            {courses.map((c) => {
              const items = flattenActivities(c.slug);
              const done = progress[c.slug]?.completedActivityIds.length || 0;
              const pct = items.length ? Math.round((done / items.length) * 100) : 0;
              const finished = isCourseComplete(c.slug, items.length);
              const onCourse =
                pathname.includes(`/selfpaced/learn/${c.slug}`) ||
                pathname.includes(`/selfpaced/certificate/${c.slug}`);
              const onCert = pathname.includes(`/selfpaced/certificate/${c.slug}`);
              const onLearn = pathname.includes(`/selfpaced/learn/${c.slug}`);
              return (
                <li key={c.slug} className={onCourse ? "is-open" : ""}>
                  <Link
                    href={`/selfpaced/learn/${c.slug}`}
                    className={onLearn ? "is-active" : ""}
                    onClick={() => setNavOpen(false)}
                  >
                    <img src={c.image} alt="" />
                    <span>
                      <strong>{c.title}</strong>
                      <em>{finished ? "Completed" : `${pct}% complete`}</em>
                    </span>
                  </Link>
                  <div className="sp-side__tabs" role="tablist" aria-label={`${c.title} tabs`}>
                    <Link
                      href={`/selfpaced/learn/${c.slug}`}
                      role="tab"
                      aria-selected={onLearn && !onCert}
                      className={onLearn && !onCert ? "is-active" : ""}
                      onClick={() => setNavOpen(false)}
                    >
                      Course
                    </Link>
                    <Link
                      href={`/selfpaced/certificate/${c.slug}`}
                      role="tab"
                      aria-selected={onCert}
                      className={onCert ? "is-active" : ""}
                      onClick={() => setNavOpen(false)}
                    >
                      Certificate
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {certCards.length > 0 ? (
        <div className="sp-side__certs">
          <p>Your certificates</p>
          {certCards.map(({ program, enrollment, chapters, finished, pct }) => {
            const active = activeCourseSlug === program.slug;
            return (
              <Link
                key={program.slug}
                href={`/selfpaced/certificate/${program.slug}`}
                className={`sp-side__cert-link${active ? " is-active" : ""}${finished ? "" : " is-locked"}`}
                onClick={() => setNavOpen(false)}
              >
                <SelfpacedCertificate
                  compact
                  locked={!finished}
                  learnerName={user.name || "Learner"}
                  programTitle={program.title}
                  hours={program.hours}
                  chapters={chapters}
                  issuedAt={enrollment?.certificateIssuedAt || new Date().toISOString()}
                  certificateId={enrollment?.certificateId || (finished ? "—" : `${pct}% to unlock`)}
                />
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="sp-side__foot">
        <div className="sp-side__user">
          <span className="sp-nav__avatar" aria-hidden />
          <div>
            <strong>{user.name}</strong>
            <em>{user.email}</em>
          </div>
        </div>
        <button
          type="button"
          className="sp-btn sp-btn--ghost sp-btn--sm"
          onClick={() => {
            clearSelfpacedUser();
            void logoutHeritage();
            setUser(null);
            router.push("/selfpaced");
          }}
        >
          Log out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="sp-root sp-learner">
      <div className="sp-learner__desk">{Sidebar}</div>
      {navOpen ? (
        <>
          <button type="button" className="sp-learner__scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />
          <div className="sp-learner__drawer">{Sidebar}</div>
        </>
      ) : null}
      <div className="sp-learner__main">
        <header className="sp-learner__top">
          <button type="button" className="sp-learner__menu" onClick={() => setNavOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <p>Self-paced learning</p>
          <div className="sp-learner__top-actions">
            {coachCtx.show && coachCtx.mode !== "off" ? (
              <button
                type="button"
                className="sp-btn sp-btn--primary sp-btn--sm"
                onClick={() => window.dispatchEvent(new Event("sp-open-coach"))}
              >
                Ask coach
              </button>
            ) : null}
            <Link href="/selfpaced#catalog" className="sp-btn sp-btn--ghost sp-btn--sm">
              Catalog
            </Link>
          </div>
        </header>
        <main>{children}</main>
      </div>
      {coachCtx.show && coachCtx.mode !== "off" ? (
        <SelfpacedCoachWidget
          slug={coachCtx.slug}
          chapterId={coachCtx.chapterId}
          activity={coachCtx.activity}
          chapterTitle={coachCtx.chapterTitle}
          mode={coachCtx.mode || "on"}
        />
      ) : null}
      <SelfpacedLoginModal
        open={authOpen}
        onClose={closeAuth}
        initialMode={authMode}
        nextPath={searchParams.get("next") || nextAfterLogin}
      />
    </div>
  );
}

export function LearnerShell({
  children,
  nextAfterLogin = "/selfpaced/dashboard",
  requirePurchase = true,
}: {
  children: ReactNode;
  nextAfterLogin?: string;
  requirePurchase?: boolean;
}) {
  return (
    <Suspense fallback={<div className="sp-root"><main>{children}</main></div>}>
      <LearnerShellInner nextAfterLogin={nextAfterLogin} requirePurchase={requirePurchase}>
        {children}
      </LearnerShellInner>
    </Suspense>
  );
}
