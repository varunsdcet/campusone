import { describe, expect, it } from "vitest";
import "./main.js";
import { openApiDocument } from "./openapi.js";

describe("api openapi", () => {
  it("registers proof-slice routes", () => {
    const registeredRoutes = Object.keys(openApiDocument.paths);
    expect(registeredRoutes).toContain("/grades/me");
    expect(registeredRoutes).toContain("/approvals");
    expect(registeredRoutes).toContain("/student/assignments/{assignmentId}/files");
    expect(registeredRoutes).toContain("/notifications/me/{notificationId}/read");
    expect(registeredRoutes).toContain("/ai/ask");
    expect(registeredRoutes).toContain("/ai/history");
  });

  it("documents the complete mounted API surface, including nested routers", () => {
    const operations = Object.values(openApiDocument.paths).reduce((sum, path) => sum + Object.keys(path).length, 0);
    expect(Object.keys(openApiDocument.paths).length).toBeGreaterThanOrEqual(300);
    expect(operations).toBeGreaterThanOrEqual(500);
    expect(openApiDocument.paths["/admin/heritage/students/{id}/flags"]?.post).toBeDefined();
  });
});
