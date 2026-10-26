import {
  AI_TOOL_REGISTRY,
  AiRequestContext,
  AiToolDefinition,
  AiToolName,
  type AiCapabilityId,
  type RoleName,
  type SessionClaims,
} from "@myheritage/contracts";

export function getAiToolDefinition(name: AiToolName): AiToolDefinition {
  const tool = AI_TOOL_REGISTRY.find((entry) => entry.name === name);
  if (!tool) {
    throw Object.assign(new Error(`Unknown AI tool: ${name}`), { code: "VALIDATION_ERROR", status: 400 });
  }
  return AiToolDefinition.parse(tool);
}

export function assertToolAllowed(name: AiToolName, roles: RoleName[]) {
  const tool = getAiToolDefinition(name);
  const ok = tool.personas.some((persona) => roles.includes(persona));
  if (!ok) {
    throw Object.assign(new Error(`Tool ${name} is not allowed for this role`), {
      code: "FORBIDDEN",
      status: 403,
    });
  }
  return tool;
}

export function buildAiRequestContext(input: {
  user: SessionClaims;
  capability: AiCapabilityId;
  contextPath?: string;
  activeStudentId?: string;
  activeCourseId?: string;
  activeSectionId?: string;
  activeTermId?: string;
  assessmentAttemptOpen?: boolean;
}) {
  return AiRequestContext.parse({
    accountId: input.user.accountId,
    personId: input.user.personId,
    institutionId: input.user.institutionId,
    roles: input.user.roles,
    sessionId: input.user.sessionId,
    capability: input.capability,
    contextPath: input.contextPath,
    activeStudentId: input.activeStudentId,
    activeCourseId: input.activeCourseId,
    activeSectionId: input.activeSectionId,
    activeTermId: input.activeTermId,
    assessmentAttemptOpen: input.assessmentAttemptOpen ?? false,
  });
}

export function listAiTools() {
  return AI_TOOL_REGISTRY.map((tool) => AiToolDefinition.parse(tool));
}
