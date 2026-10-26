import { z } from "zod";
import { prisma } from "@myheritage/db";

export const GOVERNANCE_PATH = "ai:governance";
export const GovernancePolicy = z.object({
  studentAiAllowed: z.boolean(),
  instructorAiAllowed: z.boolean(),
  adminAiAllowed: z.boolean(),
  gradingAssistanceAllowed: z.boolean(),
  maxRequestsPerHour: z.number().int().min(1).max(10000),
});
export type GovernancePolicy = z.infer<typeof GovernancePolicy>;
export const DEFAULT_GOVERNANCE: GovernancePolicy = {
  studentAiAllowed: true,
  instructorAiAllowed: true,
  adminAiAllowed: true,
  gradingAssistanceAllowed: true,
  maxRequestsPerHour: 120,
};

export async function governancePolicy(institutionId: string): Promise<GovernancePolicy> {
  const row = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId, path: GOVERNANCE_PATH } },
  });
  if (!row) return DEFAULT_GOVERNANCE;
  try {
    const parsed = GovernancePolicy.safeParse(JSON.parse(row.payloadJson));
    return parsed.success ? parsed.data : DEFAULT_GOVERNANCE;
  } catch {
    return DEFAULT_GOVERNANCE;
  }
}

export function assertGovernanceRoleAllowed(policy: GovernancePolicy, roles: readonly string[]) {
  const allowed = roles.includes("admin") || roles.includes("registrar")
    ? policy.adminAiAllowed
    : roles.includes("instructor")
      ? policy.instructorAiAllowed
      : policy.studentAiAllowed;
  if (!allowed) throw Object.assign(new Error("AI access is disabled by institutional policy"), { code: "FORBIDDEN", status: 403 });
}

export async function assertInstitutionAiAllowed(institutionId: string, roles: readonly string[]) {
  const policy = await governancePolicy(institutionId);
  assertGovernanceRoleAllowed(policy, roles);
  return policy;
}
