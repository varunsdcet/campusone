"use client";

import { useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";
import type { AiDraftStoryboard } from "@/lib/aiDraftSamples";
import { AiDraftVideoPlayer } from "./AiDraftVideoPlayer";

type Topic = { id: string; title: string; summary?: string; activities: Array<{ name: string }> };
type QuizItem = { question: string; options: string[]; answer: number };
type Draft = {
  lessonTitle: string;
  lessonHtml: string;
  quiz: QuizItem[];
  storyboard: AiDraftStoryboard;
  model: string;
  grounding: { course: string; hasDescription: boolean; term: string | null };
};

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function quizHtml(quiz: QuizItem[]) {
  if (!quiz.length) return "";
  const items = quiz
    .map(
      (q) =>
        `<li><p>${esc(q.question)}</p><ol>${q.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol><details><summary>Show answer</summary><p>${esc(q.options[q.answer] ?? "")}</p></details></li>`,
    )
    .join("");
  return `<h3>Check your understanding</h3><ol>${items}</ol>`;
}

export function CourseAiDraftDialog({
  path,
  topics,
  initialTopicId,
  busy,
  runAction,
  onClose,
}: {
  path: string;
  topics: Topic[];
  initialTopicId?: string;
  busy?: boolean;
  runAction?: (action: string, rowKey?: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const usable = topics.filter((t) => t.id !== "topic-eval");
  const [topicId, setTopicId] = useState(initialTopicId || usable[0]?.id || "");
  const topic = usable.find((t) => t.id === topicId);
  useEffect(() => {
    if (!topic && usable[0]) setTopicId(usable[0].id);
  }, [topic, usable]);
  const [lessonTitle, setLessonTitle] = useState("");
  const [minutes, setMinutes] = useState("20");
  const [slides, setSlides] = useState("6");
  const [withQuiz, setWithQuiz] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  async function generate() {
    const session = loadSession();
    if (!session?.accessToken || !topic) return;
    setGenerating(true);
    setError("");
    try {
      const res = await api<Draft>(
        "/instructor/ai-draft",
        {
          method: "POST",
          body: JSON.stringify({
            path,
            topicTitle: topic.title,
            topicSummary: topic.summary || "",
            lessonTitle: lessonTitle.trim() || topic.title,
            minutes: Number(minutes) || 20,
            slides: Number(slides) || 6,
            existingActivities: topic.activities.map((a) => a.name).slice(0, 40),
          }),
        },
        session.accessToken,
      );
      setDraft(res);
      if (!lessonTitle.trim()) setLessonTitle(res.lessonTitle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function addToCourse() {
    if (!draft || !topic || !runAction) return;
    setSaving(true);
    setError("");
    const name = lessonTitle.trim() || draft.lessonTitle;
    const ok = await runAction(
      "Add an activity or resource",
      JSON.stringify({
        TopicId: topic.id,
        Type: "PAGE",
        Name: name,
        Body: draft.lessonHtml + (withQuiz ? quizHtml(draft.quiz) : ""),
        Storyboard: JSON.stringify({ ...draft.storyboard, title: name }),
      }),
    );
    setSaving(false);
    if (ok) onClose();
    else setError("Could not add the lesson to the course. Try again.");
  }

  return (
    <div className="mh-ai-draft-overlay" role="dialog" aria-modal="true" aria-labelledby="course-ai-draft-title">
      <div className="mh-ai-draft-modal">
        <header className="mh-ai-draft-modal__head">
          <h2 id="course-ai-draft-title">AI draft — lesson + video slideshow</h2>
          <button type="button" className="mh-ai-draft-modal__x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="mh-ai-draft-modal__fields">
          <label>
            Topic
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={generating}>
              {usable.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lesson title
            <input
              value={lessonTitle}
              placeholder={topic ? `e.g. ${topic.title} — key concepts` : "Lesson title"}
              onChange={(e) => setLessonTitle(e.target.value)}
            />
          </label>
          <div className="mh-ai-draft-modal__row">
            <label>
              Minutes of study
              <input type="number" min={5} max={180} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </label>
            <label>
              Video slides
              <input type="number" min={3} max={12} value={slides} onChange={(e) => setSlides(e.target.value)} />
            </label>
            <label>
              Practice quiz
              <select value={withQuiz ? "yes" : "no"} onChange={(e) => setWithQuiz(e.target.value === "yes")}>
                <option value="yes">Include in lesson</option>
                <option value="no">Leave out</option>
              </select>
            </label>
          </div>
          <p className="mh-ai-draft-modal__help">
            The AI writes from this course&apos;s catalogue record (code, title, description, hours), the selected topic and its existing
            activities. Review the draft before adding it — it is added to the topic as a page with a narrated video slideshow that
            students can play.
          </p>
        </div>

        <div className="mh-ai-draft-modal__ai-row">
          <button type="button" className="mh-ai-draft-modal__ai" disabled={generating || !topic} onClick={() => void generate()}>
            ✦ {generating ? "Generating with AI… (about 10–30 s)" : draft ? "Regenerate" : "Generate with AI"}
          </button>
        </div>
        {error ? (
          <p className="mh-ai-draft-modal__note" role="alert">
            {error}
          </p>
        ) : null}

        {draft ? (
          <div className="mh-ai-draft-modal__editor-wrap">
            <div className="mh-ai-draft-modal__editor-head">
              <span>
                {draft.grounding.course}
                {draft.grounding.term ? ` · ${draft.grounding.term}` : ""}
              </span>
              <span className="mh-ai-draft-modal__story-badge">
                {draft.storyboard.slides.length} slides · ~{Math.max(1, Math.round(draft.storyboard.estimated_duration_sec / 60))} min ·{" "}
                {draft.quiz.length} quiz questions
              </span>
            </div>
            <AiDraftVideoPlayer key={draft.storyboard.slides.map((s) => s.heading).join("|")} storyboard={draft.storyboard} />
            <div
              className="mh-ai-draft-modal__editor"
              dangerouslySetInnerHTML={{ __html: draft.lessonHtml + (withQuiz ? quizHtml(draft.quiz) : "") }}
            />
            {!draft.grounding.hasDescription ? (
              <p className="mh-ai-draft-modal__help">
                This course has no description in Course Management yet, so the draft is based on the course title and topic only.
              </p>
            ) : null}
          </div>
        ) : null}

        <footer className="mh-ai-draft-modal__foot">
          <button type="button" className="mh-teacher-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--primary"
            disabled={!draft || saving || busy || !runAction}
            onClick={() => void addToCourse()}
          >
            {saving ? "Adding…" : `Add to ${topic?.title ?? "topic"}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
