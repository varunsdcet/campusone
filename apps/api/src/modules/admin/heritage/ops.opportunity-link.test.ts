import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  careerOpportunity: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
const audit = vi.hoisted(() => vi.fn());

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("../superAdmin.service.js", () => ({ assertPermission: vi.fn() }));
vi.mock("./service.js", () => ({ audit }));

import { createOps, listOps, updateOps } from "./ops.js";
import { ENTITIES } from "./ops.spec.js";

const user = {
  accountId: "account-admin",
  institutionId: "institution-1",
  personId: "person-admin",
  email: "admin@example.edu",
  roles: ["admin"],
} as const;

const opportunity = (href: string, id = "opportunity-1") => ({
  id,
  title: "Junior Analyst",
  employerName: "Example Employer",
  skillsJson: "[]",
  programCodesJson: "[]",
  href,
  status: "open",
  createdAt: new Date("2026-10-19T00:00:00.000Z"),
  updatedAt: new Date("2026-10-19T00:00:00.000Z"),
});

describe("opportunity application link configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.careerOpportunity.create.mockResolvedValue(opportunity("", "opportunity-new"));
    db.careerOpportunity.update.mockResolvedValue(opportunity(""));
  });

  it("publishes an optional HTTPS Application URL field", () => {
    const field = ENTITIES.opportunities.fields.find((candidate) => candidate.key === "href");
    expect(field).toMatchObject({
      label: "Application URL",
      kind: "url",
      httpsOnly: true,
      allowedInternalPaths: ["/student/f/st-17-practicum"],
    });
    expect(field?.required).not.toBe(true);
  });

  it("persists an explicit empty link and rejects non-HTTPS external links", async () => {
    await createOps(user as never, "opportunities", {
      title: "Junior Analyst",
      employerName: "Example Employer",
      skills: [],
      programCodes: [],
      status: "open",
    });

    expect(db.careerOpportunity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ href: "" }),
    });
    await expect(createOps(user as never, "opportunities", {
      title: "Junior Analyst",
      employerName: "Example Employer",
      href: "http://jobs.example/apply",
      status: "open",
    })).rejects.toMatchObject({ status: 400 });
  });

  it("removes legacy Inbox links from admin rows but preserves the approved practicum path", async () => {
    db.careerOpportunity.findMany.mockResolvedValue([
      opportunity("/student/messages", "legacy"),
      opportunity("/student/f/st-17-practicum", "practicum"),
      opportunity("https://jobs.example/apply", "external"),
    ]);

    const result = await listOps(user as never, "opportunities");

    expect(result.items.map((item) => ({ id: item.id, href: (item as Record<string, unknown>).href }))).toEqual([
      { id: "legacy", href: "" },
      { id: "practicum", href: "/student/f/st-17-practicum" },
      { id: "external", href: "https://jobs.example/apply" },
    ]);
  });

  it("keeps the approved practicum path when another opportunity field is edited", async () => {
    db.careerOpportunity.findMany.mockResolvedValue([opportunity("/student/f/st-17-practicum")]);

    await updateOps(user as never, "opportunities", "opportunity-1", { title: "Updated title" });

    expect(db.careerOpportunity.update).toHaveBeenCalledWith({
      where: { id: "opportunity-1" },
      data: expect.objectContaining({ title: "Updated title", href: "/student/f/st-17-practicum" }),
    });
  });
});
