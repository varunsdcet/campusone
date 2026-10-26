import type { AiAnswer, Citation, CoachAction, GroundedCoachFact, GroundedCoachResult } from "./types.js";

export function citeOrRefuse(input: { text: string; sources: Citation[]; tier?: AiAnswer["tier"] }): AiAnswer {
  if (!input.sources.length) {
    throw Object.assign(new Error("AI refused: citations required"), {
      code: "CITATION_FAILURE",
      status: 422,
    });
  }
  return {
    tier: input.tier ?? "read_only",
    text: input.text,
    sources: input.sources,
  };
}

function uniqueFacts(facts: GroundedCoachFact[]) {
  return [...new Map(facts.map((fact) => [fact.id, fact])).values()];
}

function intentFor(question: string) {
  const normalized = question.toLowerCase();
  if (/program\s*plan|degree\s*plan|next\s*course|pathway|progress|what.?s\s*next/.test(normalized)) {
    return "program" as const;
  }
  if (/leave\s*of\s*absence|\bloa\b|withdraw|service\s*request/.test(normalized)) {
    return "request" as const;
  }
  if (/absent|attendance|who\s+is\s+missing|present\s+today/.test(normalized)) {
    return "attendance" as const;
  }
  if (/class\s*list|roster|who\s+is\s+in|students\s+in/.test(normalized)) {
    return "roster" as const;
  }
  if (/fee|tuition|balance|payment|financial|statement|owing|owe/.test(normalized)) {
    return "finance" as const;
  }
  if (/grade|gpa|score|mark|gradebook/.test(normalized)) return "grade" as const;
  if (/assignment|deadline|due|today|focus|priority|overdue/.test(normalized)) return "priority" as const;
  if (/schedule|calendar|class|join|session|this\s+week|next\s+week/.test(normalized)) {
    return "schedule" as const;
  }
  if (/mail|inbox|message|email|unread/.test(normalized)) return "mail" as const;
  if (/notification|notice/.test(normalized)) return "notification" as const;
  if (/course|section|teaching|enrol/.test(normalized)) return "course" as const;
  if (/approval|operation|campus|admin|pending\s+grade|search\s+student|student\s+status/.test(normalized)) {
    return "operations" as const;
  }
  return "overview" as const;
}

function actionFor(role: string, intent: ReturnType<typeof intentFor>): CoachAction[] {
  const root = role === "registrar" ? "admin" : role;
  if (intent === "program") {
    return role === "student"
      ? [{ label: "Open program plan", href: "/student/program-plan" }]
      : [{ label: "Open home", href: `/${root}` }];
  }
  if (intent === "request") {
    return role === "student"
      ? [{ label: "Leave of absence", href: "/student/leave-of-absence" }]
      : role === "admin" || role === "registrar"
        ? [{ label: "Open approvals", href: "/admin/approvals" }]
        : [{ label: "Open home", href: `/${root}` }];
  }
  if (intent === "attendance") {
    return role === "instructor"
      ? [{ label: "Open attendance", href: "/instructor/attendance" }]
      : role === "student"
        ? [{ label: "Open attendance", href: "/student/attendance" }]
        : [{ label: "Open home", href: `/${root}` }];
  }
  if (intent === "roster") {
    return role === "instructor"
      ? [{ label: "Open class list", href: "/instructor/sections" }]
      : [{ label: "Open students", href: "/admin/students" }];
  }
  if (intent === "finance") {
    return role === "student"
      ? [{ label: "Open financial statement", href: "/student/fees" }]
      : [{ label: "Open home", href: `/${root}` }];
  }
  if (intent === "grade") {
    return [
      {
        label: role === "student" ? "Open grades" : "Open gradebook",
        href: role === "student" ? "/student/grades" : "/instructor/gradebook",
      },
    ];
  }
  if (intent === "priority") {
    return [
      {
        label: role === "student" ? "Open assignments" : "Open home",
        href: role === "student" ? "/student/assignments" : `/${root}`,
      },
    ];
  }
  if (intent === "schedule") {
    return [{ label: "Open calendar", href: role === "student" ? "/student/calendar" : `/${root}/calendar` }];
  }
  if (intent === "mail") {
    return [{ label: "Open mail", href: role === "student" ? "/student/mail" : `/${root}/mail` }];
  }
  if (intent === "notification") {
    return [{ label: "Open notifications", href: `/${root}/notifications` }];
  }
  if (intent === "course") {
    return [
      {
        label: "Open courses",
        href: role === "student" ? "/student/courses" : role === "instructor" ? "/instructor/sections" : `/${root}`,
      },
    ];
  }
  if (intent === "operations" && (role === "admin" || role === "registrar")) {
    return [
      { label: "Open approvals", href: "/admin/approvals" },
      { label: "Search students", href: "/admin/students" },
    ];
  }
  return [{ label: "Open home", href: `/${root}` }];
}

function proseLead(role: string, intent: ReturnType<typeof intentFor>, grounded: GroundedCoachFact[]) {
  if (!grounded.length) {
    return `I do not have enough ${role} records yet to answer that. Open your portal home and try again after your enrolments load.`;
  }
  if (intent === "program") return "Here is what your live program plan shows:";
  if (intent === "request") return "Here are your request records from campus systems:";
  if (intent === "attendance") return "Here is attendance from your live campus records:";
  if (intent === "roster") return "Here is the class roster from your assigned sections:";
  if (intent === "finance") return "Here is your financial statement snapshot:";
  if (intent === "priority") return "Here is what deserves attention first based on your live campus records:";
  if (intent === "grade") return "Here is what your published grade records show:";
  if (intent === "schedule") return "Here is your upcoming class and deadline schedule:";
  if (intent === "mail") return "Here is what your mailbox shows:";
  if (intent === "course") return "Here is your current course picture:";
  if (intent === "notification") return "Here are the latest messages and notices I can see for you:";
  if (intent === "operations") return "Here is the current operations snapshot:";
  return "Here is a short answer from your campus records:";
}

export function groundedCoachAnswer(input: {
  role: string;
  question: string;
  facts: GroundedCoachFact[];
}): GroundedCoachResult {
  const facts = uniqueFacts(input.facts);
  const intent = intentFor(input.question);
  const kindsByIntent: Record<typeof intent, GroundedCoachFact["kind"][]> = {
    program: ["program", "requirement", "course", "profile"],
    request: ["request", "approval", "notification"],
    attendance: ["attendance", "roster", "session", "course"],
    roster: ["roster", "course", "attendance"],
    finance: ["finance", "profile"],
    grade: ["grade", "course", "profile"],
    priority: ["assignment", "session", "notification", "course", "request"],
    schedule: ["session", "assignment", "course"],
    mail: ["mail", "notification"],
    notification: ["notification", "mail", "portal"],
    course: ["course", "assignment", "session", "program"],
    operations: ["approval", "request", "roster", "notification", "institution", "grade"],
    overview: ["profile", "course", "assignment", "program", "finance", "portal", "institution"],
  };
  const selected = kindsByIntent[intent]
    .flatMap((kind) => facts.filter((fact) => fact.kind === kind))
    .slice(0, 6);
  const grounded = selected.length ? selected : facts.slice(0, 4);
  const lines = grounded.map((fact, index) => `${index + 1}. ${fact.text}`);
  const nextStep =
    input.role === "student"
      ? intent === "priority"
        ? "Open Assignments to submit or check due work, or open Calendar for class join links."
        : intent === "grade"
          ? "Open Grades for the full published mark list, or Ask about a specific course."
          : intent === "finance"
            ? "Open Fees for the full statement. Payment execution stays in the student portal when enabled."
            : intent === "program"
              ? "Open Program Plan for the full pathway and remaining courses."
              : "Use the suggested action below to jump straight into the matching student screen."
      : "Use the suggested action below to open the matching workspace screen.";
  const text = `${proseLead(input.role, intent, grounded)}\n\n${lines.join("\n")}\n\n${nextStep}`;
  const answer = citeOrRefuse({
    text,
    tier: "read_only",
    sources: grounded.map(({ id, title, uri }) => ({ id, title, uri })),
  });
  return { ...answer, suggestedActions: actionFor(input.role, intent) };
}
