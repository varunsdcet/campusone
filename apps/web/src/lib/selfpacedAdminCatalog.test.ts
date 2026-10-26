import { describe, expect, it } from "vitest";
import { ONLINE_ADMIN_GROUPS, ONLINE_ADMIN_SCREENS } from "./selfpacedAdminCatalog";

describe("self-paced admin coverage", () => {
  it("has a unique routable screen for every admin work area", () => {
    const slugs = ONLINE_ADMIN_SCREENS.map((screen) => screen.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual(expect.arrayContaining([
      "overview", "applications", "enrolments", "users", "catalogue", "schedules", "content",
      "grading", "attendance", "english-test", "requests", "integrity", "finance", "reports",
      "branding", "workshops", "integration", "documents", "security", "profile",
    ]));
  });

  it("keeps every screen explicit about fields, actions, workflow and safety", () => {
    for (const screen of ONLINE_ADMIN_SCREENS) {
      expect(ONLINE_ADMIN_GROUPS).toContain(screen.group);
      expect(screen.fields.length).toBeGreaterThanOrEqual(4);
      expect(screen.actions.length).toBeGreaterThanOrEqual(3);
      expect(screen.workflow.length).toBeGreaterThan(20);
      expect(screen.safeguard.length).toBeGreaterThan(20);
      expect(screen.columns.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("includes the identity, enrolment, AI review and reconciliation controls", () => {
    const inventory = JSON.stringify(ONLINE_ADMIN_SCREENS);
    for (const required of [
      "Canonical Student ID", "Learning Enrolment ID", "Generate AI Draft", "faculty or SME review",
      "Last successful sync", "Retry Failed", "Integrity flag", "Approved academic attendance",
      "Online order reference", "Template version", "Two-factor policy", "Optional student ID",
    ]) expect(inventory).toContain(required);
  });
});
