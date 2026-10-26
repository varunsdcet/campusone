process.env.NODE_ENV = "test";
await import("./main.js");
const { openApiDocument } = await import("./openapi.js");

const runtimeRoutes = [
  "/auth/login",
  "/me/home",
  "/me/profile",
  "/me/preferences",
  "/me/profile-change-requests",
  "/courses/me",
  "/notifications/me",
  "/notifications/me/{notificationId}/read",
  "/calendar/me",
  "/grades/me",
  "/gradebooks/{sectionId}",
  "/grade-items/{id}",
  "/gradebooks/{sectionId}/publish",
  "/approvals",
  "/approvals/{id}/decide",
  "/approvals/{id}/apply",
  "/messages/ask-grade",
  "/student/assignments",
  "/student/assignments/{assignmentId}",
  "/student/assignments/{assignmentId}/files",
  "/student/submission-files/{fileId}",
  "/student/assignments/{assignmentId}/submit",
  "/student/degree-progress",
  "/student/degree-scenarios",
  "/search",
  "/ai/ask",
  "/ai/history",
  "/ai/tools",
  "/ai/governance",
  "/ai/eval",
  "/student/advising/appointments",
  "/auth/forgot-password",
  "/auth/reset-password",
];

const registeredRoutes = Object.keys(openApiDocument.paths);
const missing = runtimeRoutes.filter((r) => !registeredRoutes.includes(r));
if (missing.length) {
  console.error("OpenAPI missing routes:", missing);
  process.exit(1);
}
const operations = Object.values(openApiDocument.paths).reduce((sum, path) => sum + Object.keys(path).length, 0);
if (registeredRoutes.length < 300 || operations < 500) {
  console.error(`OpenAPI inventory unexpectedly small: ${registeredRoutes.length} paths / ${operations} operations`);
  process.exit(1);
}
console.log("OpenAPI check OK:", registeredRoutes.length, "paths /", operations, "operations");
