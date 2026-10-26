import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({ credentialRecord: { create: vi.fn() } }));
const db = vi.hoisted(() => ({
  student: { findFirst: vi.fn() },
  credentialRecord: { findFirst: vi.fn() },
  sisScreenState: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("@myheritage/events", () => ({ writeAuditAndOutbox: vi.fn() }));

import type { SessionClaims } from "@myheritage/contracts";
import { expectedActivityIds, selfpacedCourse } from "./catalogue.js";
import { issueSelfpacedCertificate, outstandingActivities } from "./selfpaced.service.js";

const user = { accountId: "acc-1", institutionId: "inst-1", personId: "p-1", roles: ["student"] } as unknown as SessionClaims;
const slug = "pharmacy-assistant";
const course = selfpacedCourse(slug);
const all = course ? expectedActivityIds(course) : [];
const issuedAt = new Date("2026-10-01T00:00:00Z");
const record = { id: "cred-1", title: course?.title ?? "", earnedAt: issuedAt, createdAt: issuedAt };

beforeEach(() => {
  vi.clearAllMocks();
  db.student.findFirst.mockResolvedValue({ id: "stu-1", person: { givenName: "Ada", preferredName: null, familyName: "Lovelace" } });
  db.credentialRecord.findFirst.mockResolvedValue(null);
  db.sisScreenState.findMany.mockResolvedValue([
    { path: "selfpaced:catalogue:dynamic-course", payloadJson: JSON.stringify({ slug: "dynamic-course", status: "published", curriculum: [] }), updatedAt: issuedAt },
  ]);
  db.sisScreenState.findUnique.mockResolvedValue({ id: "enrol-1" });
  db.sisScreenState.upsert.mockResolvedValue({});
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  tx.credentialRecord.create.mockResolvedValue(record);
});

describe("self-paced certificates", () => {
  it("knows the course catalogue", () => {
    expect(course).toBeTruthy();
    expect(all.length).toBeGreaterThan(0);
    expect(outstandingActivities(slug, all)).toEqual([]);
    expect(outstandingActivities("no-such-course", [])).toBeNull();
  });

  it("issues a credential keyed by learner and course", async () => {
    const out = await issueSelfpacedCertificate(user, { slug, completedActivityIds: all, assessmentsPassed: true });
    expect(out).toMatchObject({ certificateId: "cred-1", title: course?.title, holderName: "Ada Lovelace", created: true, verifyPath: "/verify/cred-1" });
    expect(tx.credentialRecord.create.mock.calls[0]?.[0]?.data).toMatchObject({ studentId: "stu-1", sourceKey: `selfpaced:${slug}`, status: "earned" });
  });

  it("returns the first credential on repeat calls", async () => {
    db.credentialRecord.findFirst.mockResolvedValue(record);
    await expect(issueSelfpacedCertificate(user, { slug, completedActivityIds: all, assessmentsPassed: true })).resolves.toMatchObject({
      certificateId: "cred-1",
      created: false,
    });
    expect(tx.credentialRecord.create).not.toHaveBeenCalled();
  });

  it("re-reads after a concurrent insert wins the unique key", async () => {
    db.$transaction.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    db.credentialRecord.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(record);
    await expect(issueSelfpacedCertificate(user, { slug, completedActivityIds: all, assessmentsPassed: true })).resolves.toMatchObject({
      certificateId: "cred-1",
      created: false,
    });
  });

  it("refuses incomplete progress with 409", async () => {
    await expect(issueSelfpacedCertificate(user, { slug, completedActivityIds: all.slice(1), assessmentsPassed: true })).rejects.toMatchObject({
      status: 409,
      code: "COURSE_INCOMPLETE",
    });
  });

  it("requires the assessments to be passed and a known course", async () => {
    await expect(issueSelfpacedCertificate(user, { slug, completedActivityIds: all, assessmentsPassed: false })).rejects.toMatchObject({ status: 400 });
    await expect(issueSelfpacedCertificate(user, { slug: "nope", completedActivityIds: [], assessmentsPassed: true })).rejects.toMatchObject({ status: 404 });
  });

  it("requires a learner profile", async () => {
    db.student.findFirst.mockResolvedValue(null);
    await expect(issueSelfpacedCertificate(user, { slug, completedActivityIds: all, assessmentsPassed: true })).rejects.toMatchObject({
      status: 403,
      code: "STUDENT_PROFILE_REQUIRED",
    });
  });

  it("requires a real enrolment before issuing a certificate", async () => {
    db.sisScreenState.findUnique.mockResolvedValue(null);
    await expect(issueSelfpacedCertificate(user, { slug, completedActivityIds: all, assessmentsPassed: true })).rejects.toMatchObject({
      status: 403,
      code: "ENROLMENT_REQUIRED",
    });
  });
});
