export type Citation = { id: string; title: string; uri?: string };

export type AiAnswer = {
  tier: "read_only" | "draft" | "consequential";
  text: string;
  sources: Citation[];
};

export type GroundedCoachFact = Citation & {
  uri: string;
  text: string;
  kind:
    | "institution"
    | "profile"
    | "course"
    | "assignment"
    | "session"
    | "grade"
    | "notification"
    | "approval"
    | "portal"
    | "program"
    | "requirement"
    | "finance"
    | "attendance"
    | "roster"
    | "request"
    | "mail";
};

export type CoachAction = { label: string; href: string };

export type GroundedCoachResult = AiAnswer & {
  suggestedActions: CoachAction[];
  claims?: Array<{ kind: "fact" | "inference" | "uncertainty" | "action"; text: string; evidenceIds: string[] }>;
  analysis?: unknown;
};

export type AdvisorProgress = {
  remainingCredits: number;
  completedCredits: number;
  requiredCredits: number;
  projectedCompletionTerm: string | null;
  remainingRequirements: Array<{
    code: string;
    title: string;
    credits: number;
    status: string;
    blockedByCourseCodes: string[];
  }>;
  prerequisiteConflicts: Array<{ courseCode: string; missingPrerequisites: string[] }>;
  prerequisiteGraph: Array<{ courseCode: string; requiresCourseCode: string }>;
  warnings: string[];
  suggestedOptions: string[];
  evidence: Array<{ id: string; title: string; uri: string }>;
  claims: Array<{ kind: "fact" | "inference" | "uncertainty" | "action"; text: string; evidenceIds: string[] }>;
  programName: string;
  programVersionLabel: string;
};
