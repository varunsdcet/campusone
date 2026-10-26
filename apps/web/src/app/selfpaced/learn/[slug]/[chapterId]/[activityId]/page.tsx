"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LessonPlayer } from "@/components/selfpaced/LessonPlayer";
import { LearnerShell } from "@/components/selfpaced/LearnerShell";
import { formatUnlockLabel, isEnrolled, loadSelfpacedUser } from "@/lib/selfpacedAuth";
import {
  chapterLockReason,
  isActivitySequentiallyOpen,
  isChapterOpen,
  openChapterCount,
} from "@/lib/selfpacedEngine";
import { flattenActivities, getActivity, getCurriculum } from "@/lib/selfpacedCurriculum";
import { getSelfpacedProgram } from "@/lib/selfpacedPrograms";

export default function SelfpacedActivityPage() {
  const params = useParams<{ slug: string; chapterId: string; activityId: string }>();
  const router = useRouter();
  const program = getSelfpacedProgram(params.slug);
  const chapters = program ? getCurriculum(program.slug) : [];
  const found = program ? getActivity(program.slug, params.chapterId, params.activityId) : undefined;
  const chapterIndex = chapters.findIndex((c) => c.id === params.chapterId);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!program || !found) return;
    const user = loadSelfpacedUser();
    if (!user) {
      router.replace(
        `/selfpaced/dashboard?auth=login&next=/selfpaced/learn/${program.slug}/${params.chapterId}/${params.activityId}`,
      );
      return;
    }
    if (!isEnrolled(program.slug)) {
      router.replace(`/selfpaced/programs/${program.slug}`);
      return;
    }
    const reason = chapterLockReason(program.slug, chapterIndex);
    if (reason.kind !== "open") {
      setLocked(true);
      if (reason.kind === "date" && reason.date) {
        setLockMessage(`This chapter opens on ${formatUnlockLabel(reason.date)}.`);
      } else if (reason.kind === "pass") {
        setLockMessage(`Pass Chapter ${chapterIndex} assessment to open this chapter.`);
      } else {
        setLockMessage("This chapter is locked.");
      }
      setReady(true);
      return;
    }
    if (!isActivitySequentiallyOpen(program.slug, found.chapter, found.activity.id)) {
      setLocked(true);
      setLockMessage("Finish the previous activity in this chapter first.");
      setReady(true);
      return;
    }
    setLocked(false);
    setReady(true);
  }, [program, found, params.chapterId, params.activityId, router, chapterIndex]);

  if (!program || !found) {
    return (
      <LearnerShell>
        <div className="sp-detail sp-detail--empty">
          <h1>Activity not found</h1>
          <Link href={`/selfpaced/learn/${params.slug}`} className="sp-btn sp-btn--primary">
            Back to course
          </Link>
        </div>
      </LearnerShell>
    );
  }

  if (!ready) {
    return (
      <LearnerShell>
        <div className="sp-lesson">
          <p>Loading…</p>
        </div>
      </LearnerShell>
    );
  }

  if (locked) {
    return (
      <LearnerShell>
        <div className="sp-lesson sp-lesson--locked">
          <p className="sp-kicker">LOCKED</p>
          <h1>{found.chapter.title}</h1>
          <p className="sp-lede">{lockMessage}</p>
          <Link href={`/selfpaced/learn/${program.slug}`} className="sp-btn sp-btn--primary">
            Back to open chapters
          </Link>
        </div>
      </LearnerShell>
    );
  }

  const flat = flattenActivities(program.slug);
  const openCount = openChapterCount(program.slug);
  const unlockedActivityIds = new Set(
    chapters.slice(0, openCount).flatMap((ch) => ch.activities.map((a) => a.id)),
  );
  const idx = flat.findIndex((row) => row.activity.id === found.activity.id);
  const next = flat.slice(idx + 1).find((row) => {
    if (!unlockedActivityIds.has(row.activity.id)) return false;
    if (!isChapterOpen(program.slug, chapters.findIndex((c) => c.id === row.chapter.id))) return false;
    return isActivitySequentiallyOpen(program.slug, row.chapter, row.activity.id);
  });
  const nextHref = next
    ? `/selfpaced/learn/${program.slug}/${next.chapter.id}/${next.activity.id}`
    : undefined;

  return (
    <LearnerShell>
      <LessonPlayer
        slug={program.slug}
        chapterId={found.chapter.id}
        chapterTitle={found.chapter.title}
        activity={found.activity}
        backHref={`/selfpaced/learn/${program.slug}`}
        nextHref={nextHref}
        totalActivities={flat.length}
      />
    </LearnerShell>
  );
}
