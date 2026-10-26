import type { AiEvalCaseResult } from "@myheritage/contracts";
import { isAdvisorQuestion, extractDropCourseCode } from "./advisor.js";
import { resolveStudyCoachPolicy } from "./policy.js";
import { assertToolAllowed, listAiTools } from "./registry.js";
import { isAdminAskDataQuestion } from "./admin-ask.js";
import { citeOrRefuse } from "./coach.js";

/** Lightweight deterministic eval suite for CI — expand with golden datasets over time. */
export function runAiEvalSuite(): AiEvalCaseResult[] {
  const results: AiEvalCaseResult[] = [];

  const advisorIntent = isAdvisorQuestion("Can I graduate next summer?");
  results.push({
    id: "eval-advisor-intent",
    capability: "student_advisor",
    passed: advisorIntent && extractDropCourseCode("What happens if I drop MATH 210?") === "MATH210",
    checks: ["advisor intent detection", "drop course code extraction"],
  });

  try {
    citeOrRefuse({ text: "x", sources: [] });
    results.push({
      id: "eval-cite-refuse",
      capability: "campus_coach",
      passed: false,
      checks: ["must refuse without sources"],
    });
  } catch {
    results.push({
      id: "eval-cite-refuse",
      capability: "campus_coach",
      passed: true,
      checks: ["refused without sources"],
    });
  }

  const policy = resolveStudyCoachPolicy({ assessmentAttemptOpen: true });
  results.push({
    id: "eval-assessment-gate",
    capability: "study_coach",
    passed: policy.tutoringAllowed === false,
    checks: ["assessment mode disables tutoring"],
  });

  let toolAuthz = false;
  try {
    assertToolAllowed("get_enrollment_metrics", ["student"]);
  } catch {
    toolAuthz = true;
  }
  results.push({
    id: "eval-tool-authz",
    capability: "admin_ask_data",
    passed: toolAuthz && listAiTools().length >= 14 && isAdminAskDataQuestion("How many students are enrolled?"),
    checks: ["student blocked from admin metrics tool", "registry size", "admin intent"],
  });

  return results;
}
