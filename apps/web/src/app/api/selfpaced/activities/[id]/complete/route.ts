import { NextRequest, NextResponse } from "next/server";
import { getSelfpacedProgram } from "@/lib/selfpacedPrograms";
import { getActivity, getCurriculum } from "@/lib/selfpacedCurriculum";
import { ACTIVITY_TIMER_SECONDS, PASS_MARK } from "@/lib/selfpacedEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side completion rule check (mirrors client engine).
 * Body: { slug, chapterId, activityId, meta }
 * Returns 409 rule_not_met with missing conditions when gates fail.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: activityId } = await ctx.params;
  const body = (await req.json()) as {
    slug?: string;
    chapterId?: string;
    meta?: {
      dwellSeconds?: number;
      watchPct?: number;
      scrolledEnd?: boolean;
      coachChecksCorrect?: number;
      score?: number;
      assessmentPassed?: boolean;
    };
  };
  const slug = body.slug || "";
  const chapterId = body.chapterId || "";
  if (!getSelfpacedProgram(slug)) {
    return NextResponse.json({ error: "Unknown program", code: "not_found" }, { status: 404 });
  }
  const found = getActivity(slug, chapterId, activityId);
  if (!found) {
    return NextResponse.json({ error: "Unknown activity", code: "not_found" }, { status: 404 });
  }
  const { activity } = found;
  const meta = body.meta || {};
  const missing: string[] = [];

  // Universal: 2-minute timer only (assessments still need a pass).
  if ((meta.dwellSeconds || 0) < ACTIVITY_TIMER_SECONDS) {
    missing.push("activity_timer");
  }
  if (activity.type === "assessment") {
    if (!meta.assessmentPassed && (meta.score || 0) < (activity.passMark || PASS_MARK)) {
      missing.push("assessment_pass");
    }
  }
  if (activity.type === "lecture" && (meta.watchPct || 0) < 90) {
    missing.push("lecture_watch_90_percent");
  }

  if (missing.length) {
    return NextResponse.json(
      { error: "Completion rule not met", code: "rule_not_met", missing },
      { status: 409 },
    );
  }

  const chapters = getCurriculum(slug);
  return NextResponse.json({
    ok: true,
    activityId,
    chapterId,
    chapters: chapters.length,
  });
}
