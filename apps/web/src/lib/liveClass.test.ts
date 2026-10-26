import { describe, expect, it } from "vitest";
import { liveClassRef, liveSectionId } from "./liveClass";

describe("live class links", () => {
  it("keeps the provider selected for an online class activity", () => {
    expect(liveClassRef("/live/section-123?provider=jitsi")).toEqual({
      sectionId: "section-123",
      provider: "jitsi",
    });
    expect(liveClassRef("/live/section-123?provider=bigbluebutton")).toEqual({
      sectionId: "section-123",
      provider: "bigbluebutton",
    });
  });

  it("keeps legacy launcher links working", () => {
    expect(liveSectionId("/live/section-123")).toBe("section-123");
    expect(liveClassRef("https://meet.jit.si/external-room")).toBeNull();
  });
});
