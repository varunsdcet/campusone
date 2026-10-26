"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { installSelfpacedCurriculum, type SelfpacedActivity, type SelfpacedChapter } from "./selfpacedCurriculum";
import { installSelfpacedPrograms, type SelfpacedProgram } from "./selfpacedPrograms";

type RemoteActivity = { id: string; type: SelfpacedActivity["type"]; title: string; minutes: number; content?: string };
type RemoteChapter = { id: string; title: string; description?: string; summary?: string; activities: RemoteActivity[] };
type RemoteProgram = SelfpacedProgram & { curriculum?: RemoteChapter[] };

function normalizeChapter(chapter: RemoteChapter): SelfpacedChapter {
  return {
    id: chapter.id,
    title: chapter.title,
    summary: chapter.summary || chapter.description || "Instructor-designed self-paced chapter.",
    hours: Math.max(1, Math.round(chapter.activities.reduce((sum, activity) => sum + Number(activity.minutes || 0), 0) / 60)),
    activities: chapter.activities.map((activity) => {
      if (activity.type === "reading") return { ...activity, html: `<p>${activity.content || `Instructor-approved learning content for ${activity.title}.`}</p>` };
      if (activity.type === "lecture") return {
        ...activity,
        storyboard: {
          title: activity.title,
          estimated_duration_sec: Math.max(60, activity.minutes * 60),
          slides: [{ number: 1, heading: activity.title, bullets: ["Learning objectives", "Worked examples", "Practice and recap"], narration: activity.content || `Welcome to ${activity.title}. Follow the instructor transcript and slide prompts.` }],
        },
      };
      const question = { id: `${activity.id}-q1`, prompt: `Which option confirms completion of ${activity.title}?`, options: ["Review the lesson and submit the correct response", "Skip required work", "Ignore feedback", "Leave the activity"], correct: 0 };
      return activity.type === "assessment"
        ? { ...activity, questions: [question], questionBank: [question], questionCount: 1, passMark: 70 }
        : { ...activity, questions: [question] };
    }),
  };
}

export function useSelfpacedCatalogue() {
  const [programs, setPrograms] = useState<SelfpacedProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<{ items: RemoteProgram[] }>("/selfpaced/programs", {}, undefined, { skipAuthRedirect: true })
      .then(({ items }) => {
        for (const item of items) if (item.curriculum?.length) installSelfpacedCurriculum(item.slug, item.curriculum.map(normalizeChapter));
        installSelfpacedPrograms(items);
        // Public surfaces render the server response itself. Do not merge the bundled
        // migration catalogue here, otherwise an admin-unpublished program could reappear.
        if (!cancelled) setPrograms(items);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Live catalogue unavailable."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { programs, loading, error };
}
