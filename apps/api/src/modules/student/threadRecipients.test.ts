import { describe, expect, it, vi } from "vitest";

vi.mock("@myheritage/db", () => ({ prisma: {} }));

import { threadRecipients, visibleBccRecipients } from "./wave3.service.js";

describe("threadRecipients", () => {
  it("lists the people the sender wrote to, not the sender, whoever is viewing", () => {
    expect(threadRecipients(["sender", "me", "other"], "sender")).toEqual(["me", "other"]);
  });

  it("shows the Bcc list only to the original sender", () => {
    expect(visibleBccRecipients(["bcc-a", "bcc-b"], "sender", "sender")).toEqual(["bcc-a", "bcc-b"]);
    expect(visibleBccRecipients(["bcc-a", "bcc-b"], "sender", "to-recipient")).toEqual([]);
    expect(visibleBccRecipients(["bcc-a", "bcc-b"], "sender", "bcc-a")).toEqual([]);
  });

  it("leaves copied participants out of To", () => {
    expect(threadRecipients(["sender", "to", "cc", "bcc"], "sender", ["cc"], ["bcc"])).toEqual(["to"]);
  });

  it("falls back to the sender for a note-to-self", () => {
    expect(threadRecipients(["sender"], "sender")).toEqual(["sender"]);
  });
});
