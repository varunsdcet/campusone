import type { SessionClaims } from "@myheritage/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const user = { sub: "acct-1", accountId: "acct-1", personId: "p-admin", institutionId: "inst-1", roles: ["admin"], sessionId: "s-1" } as SessionClaims;

const tx = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  enrolment: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  student: { findFirst: vi.fn() },
  account: { findFirst: vi.fn() },
  notification: { create: vi.fn() },
  auditEvent: { create: vi.fn() },
  eventOutbox: { create: vi.fn() },
}));

const db = vi.hoisted(() => ({
  student: { findFirst: vi.fn() },
  section: { findFirst: vi.fn() },
  coursePrerequisite: { findMany: vi.fn() },
  courseCorequisite: { findMany: vi.fn() },
  enrolment: { findMany: vi.fn(), findFirst: vi.fn() },
  transferCredit: { findMany: vi.fn() },
  heritageRecord: { findFirst: vi.fn() },
  account: { findFirst: vi.fn() },
  notification: { create: vi.fn() },
  $transaction: vi.fn(),
}));

const courses = vi.hoisted(() => ({ settingsOf: vi.fn() }));
const fin = vi.hoisted(() => ({
  postEntry: vi.fn(),
  ensureFinancialTerm: vi.fn(),
  loadConfig: vi.fn(),
  assertPeriodOpen: vi.fn(),
  finAudit: vi.fn(),
  requireStudent: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: db }));
vi.mock("./courses.js", () => ({ S: { session: "CM:SESSION", courseSettings: "CM:COURSE" }, settingsOf: courses.settingsOf }));
vi.mock("./finance.core.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("./finance.core.js")>()), ...fin }));
vi.mock("./finance.ledger.js", () => ({
  isInternational: (st: { rateCategory?: string }) => /international/i.test(st.rateCategory ?? ""),
  feeTotals: (_cfg: unknown, _type: unknown, unit: number, quantity: number) => ({ subtotal: unit * quantity, taxes: [], total: unit * quantity }),
}));
vi.mock("./finance.records.js", () => ({ applyAutomatedPromotions: vi.fn(async () => []) }));
vi.mock("./studentLock.js", () => ({ withStudentMoneyLock: (_inst: string, _student: string, work: () => Promise<unknown>) => work() }));
vi.mock("../superAdmin.service.js", () => ({ studentMetaMap: vi.fn(async () => ({})) }));
vi.mock("./students.core.js", () => ({ studentStatusPolicy: vi.fn(async () => null) }));
vi.mock("../../me/studentAlignment.js", () => ({ assertNoActiveStudentHold: vi.fn(async () => undefined) }));
const facts = vi.hoisted(() => ({ loadSectionTerms: vi.fn() }));
vi.mock("../../instructor/myCoursesFacts.js", () => facts);

import { courseFeeQuote, enrolInSections, missingCourseRequirements, promoteWaitlisted, seatDecision, seatRule } from "./enrolment.js";

const section = {
  id: "sec-1",
  courseId: "course-1",
  code: "01",
  course: { code: "CS101", title: "Intro to Computing", credits: 3 },
  term: { id: "term-1", code: "2026F", name: "Fall 2026", startsOn: "2026-09-01", endsOn: "2026-12-18" },
};

function settings(session: Record<string, unknown> | undefined, course: Record<string, unknown> | undefined) {
  courses.settingsOf.mockImplementation(async (_inst: string, screen: string, ids: string[]) => {
    const data = screen === "CM:SESSION" ? session : course;
    return new Map(data ? [[ids[0], { data }]] : []);
  });
}

function seats(enrolled: number, waitlisted: number) {
  tx.enrolment.count.mockImplementation(async ({ where }: { where: { status: string } }) => (where.status === "enrolled" ? enrolled : waitlisted));
}

beforeEach(() => {
  vi.clearAllMocks();
  db.student.findFirst.mockResolvedValue({ id: "stu-1", personId: "p-stu" });
  db.section.findFirst.mockResolvedValue(section);
  db.account.findFirst.mockResolvedValue(null);
  db.coursePrerequisite.findMany.mockResolvedValue([]);
  db.courseCorequisite.findMany.mockResolvedValue([]);
  db.enrolment.findMany.mockResolvedValue([]);
  db.enrolment.findFirst.mockResolvedValue(null);
  db.transferCredit.findMany.mockResolvedValue([]);
  db.heritageRecord.findFirst.mockResolvedValue(null);
  db.$transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  tx.enrolment.findFirst.mockResolvedValue(null);
  tx.enrolment.create.mockImplementation(async ({ data }: { data: { status: string } }) => ({ id: "enr-1", ...data }));
  tx.enrolment.updateMany.mockResolvedValue({ count: 1 });
  tx.auditEvent.create.mockResolvedValue({});
  tx.eventOutbox.create.mockResolvedValue({});
  tx.student.findFirst.mockResolvedValue(null);
  tx.account.findFirst.mockResolvedValue(null);
  fin.requireStudent.mockResolvedValue({ id: "stu-1", campus: "Surrey", rateCategory: "Domestic" });
  fin.loadConfig.mockResolvedValue({ ledgerTypes: [{ id: "lt-fee", data: { name: "Course Fee" } }] });
  fin.ensureFinancialTerm.mockResolvedValue({ id: "fin-term-1" });
  fin.postEntry.mockResolvedValue({ entry: { id: "entry-1" }, number: 42 });
  facts.loadSectionTerms.mockImplementation(async (_inst: string, sections: Array<{ id: string; term: unknown }>) => new Map(sections.map((s) => [s.id, s.term])));
});

describe("seat rules", () => {
  it("reads capacity and waitlist from the session settings", () => {
    expect(seatRule({ maxEnrolments: "20", waitlist: "Disabled", waitlistSize: "" })).toEqual({ capacity: 20, waitlist: false, waitlistSize: null });
    expect(seatRule(undefined)).toEqual({ capacity: null, waitlist: true, waitlistSize: null });
  });

  it("enrols while seats remain, waitlists when full with an open waitlist, refuses otherwise", () => {
    expect(seatDecision({ capacity: 2, waitlist: false, waitlistSize: null }, { enrolled: 1, waitlisted: 0 }, "CS101 01")).toBe("enrolled");
    expect(seatDecision({ capacity: 2, waitlist: true, waitlistSize: null }, { enrolled: 2, waitlisted: 5 }, "CS101 01")).toBe("waitlisted");
    expect(() => seatDecision({ capacity: 2, waitlist: false, waitlistSize: null }, { enrolled: 2, waitlisted: 0 }, "CS101 01")).toThrow(expect.objectContaining({ status: 409, code: "SECTION_FULL" }));
    expect(() => seatDecision({ capacity: 2, waitlist: true, waitlistSize: 1 }, { enrolled: 2, waitlisted: 1 }, "CS101 01")).toThrow(expect.objectContaining({ status: 409, code: "WAITLIST_FULL" }));
  });
});

describe("course fee quote", () => {
  it("prefers a session fee, then the course cost per credit, else tuition is included", () => {
    expect(courseFeeQuote({ tuitionIncluded: false, domestic: 100 }, { tuitionIncluded: false, domestic: 250, international: 900 }, 3, true)).toMatchObject({ amount: 900, source: "session" });
    expect(courseFeeQuote({ tuitionIncluded: false, costCalculation: "Per Credit", domestic: 100, international: 300 }, undefined, 3, false)).toMatchObject({ amount: 300, source: "course" });
    expect(courseFeeQuote({ tuitionIncluded: true }, undefined, 3, false)).toEqual({ amount: 0, included: true, source: "none", domestic: 0, international: 0 });
  });
});

describe("course requirements", () => {
  it("requires completed prerequisites and completed, active or co-selected corequisites", () => {
    const req = (courseId: string, requiredCourseId: string) => ({ courseId, requiredCourseId, requiredCode: requiredCourseId.toUpperCase(), requiredTitle: "Required course" });
    expect(missingCourseRequirements(new Set(["advanced"]), new Set(), new Set(), [req("advanced", "intro")], [])).toMatchObject({ missingPrerequisites: [expect.objectContaining({ requiredCourseId: "intro" })] });
    expect(missingCourseRequirements(new Set(["advanced", "lab"]), new Set(["intro"]), new Set(), [req("advanced", "intro")], [req("advanced", "lab")])).toEqual({ missingPrerequisites: [], missingCorequisites: [] });
  });

  it("blocks enrolment before opening a transaction when a prerequisite is missing", async () => {
    settings({ maxEnrolments: 10 }, undefined);
    db.coursePrerequisite.findMany.mockResolvedValue([{ courseId: "course-1", prerequisiteCourseId: "course-0", prerequisiteCourse: { code: "CS100", title: "Foundations" } }]);
    await expect(enrolInSections(user, "stu-1", ["sec-1"], { source: "test" })).rejects.toMatchObject({ status: 409, code: "COURSE_REQUIREMENTS_NOT_MET" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("enrolInSections", () => {
  it("returns a 409 and writes nothing when the section is full and its waitlist is disabled", async () => {
    settings({ maxEnrolments: 1, waitlist: "Disabled" }, undefined);
    seats(1, 0);
    await expect(enrolInSections(user, "stu-1", ["sec-1"], { source: "test" })).rejects.toMatchObject({ status: 409, code: "SECTION_FULL" });
    expect(tx.enrolment.create).not.toHaveBeenCalled();
  });

  it("waitlists over capacity when the waitlist is enabled and does not charge the fee", async () => {
    settings({ maxEnrolments: 1, waitlist: "Enabled" }, { tuitionIncluded: false, costCalculation: "Flat", domestic: 400 });
    seats(1, 0);
    const [out] = await enrolInSections(user, "stu-1", ["sec-1"], { source: "test", postFee: true });
    expect(out).toMatchObject({ status: "waitlisted", fee: null });
    expect(out!.feeNote).toMatch(/waitlisted/);
    expect(tx.enrolment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "waitlisted" }) });
    expect(fin.postEntry).not.toHaveBeenCalled();
  });

  it("posts the course fee in the enrolment transaction, linked to the course, section and the section's term", async () => {
    settings({ maxEnrolments: 10 }, { tuitionIncluded: false, costCalculation: "Flat", domestic: 400, international: 1200 });
    seats(3, 0);
    const [out] = await enrolInSections(user, "stu-1", ["sec-1"], { source: "test", postFee: true });
    expect(out).toMatchObject({ status: "enrolled", fee: { id: "entry-1", number: 42, amount: 400 } });
    expect(fin.ensureFinancialTerm).toHaveBeenCalledWith("inst-1", section.term, tx);
    expect(fin.postEntry).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ studentId: "stu-1", kind: "charge", amount: 400, termId: "fin-term-1", courseId: "course-1", sectionId: "sec-1" }),
      expect.objectContaining({ ledgerTypeId: "lt-fee", enrolmentId: "enr-1" }),
      tx,
    );
  });

  it("posts the fee without a term when the stored term does not cover the section's dates", async () => {
    settings({ maxEnrolments: 10 }, { tuitionIncluded: false, costCalculation: "Flat", domestic: 900 });
    seats(0, 0);
    facts.loadSectionTerms.mockResolvedValue(new Map([["sec-1", null]]));
    await enrolInSections(user, "stu-1", ["sec-1"], { source: "test", postFee: true });
    expect(fin.ensureFinancialTerm).not.toHaveBeenCalled();
    expect(fin.postEntry).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ termId: null, note: "Course fee for CS101 Intro to Computing (01), Not assigned" }),
      expect.anything(),
      tx,
    );
  });

  it("does not post a fee when the option is off", async () => {
    settings({ maxEnrolments: 10 }, { tuitionIncluded: false, costCalculation: "Flat", domestic: 400 });
    seats(0, 0);
    const [out] = await enrolInSections(user, "stu-1", ["sec-1"], { source: "test", postFee: false });
    expect(out).toMatchObject({ status: "enrolled", fee: null, feeNote: null });
    expect(fin.postEntry).not.toHaveBeenCalled();
  });

  it("leaves an existing enrolment alone for program enrolment and refuses a duplicate otherwise", async () => {
    settings({ maxEnrolments: 10 }, undefined);
    seats(0, 0);
    tx.enrolment.findFirst.mockResolvedValue({ id: "enr-old", status: "enrolled" });
    await expect(enrolInSections(user, "stu-1", ["sec-1"], { source: "test", skipExisting: true })).resolves.toEqual([expect.objectContaining({ enrolmentId: "enr-old", status: "existing" })]);
    await expect(enrolInSections(user, "stu-1", ["sec-1"], { source: "test" })).rejects.toMatchObject({ status: 409, code: "ALREADY_ENROLLED" });
    expect(tx.enrolment.create).not.toHaveBeenCalled();
  });
});

describe("waitlist promotion", () => {
  it("promotes the oldest waitlisted enrolment when a seat opens", async () => {
    settings({ maxEnrolments: 2, waitlist: "Enabled" }, undefined);
    const candidate = { id: "enr-wait", studentId: "stu-2", sectionId: "sec-1", status: "waitlisted", rowVersion: 3, createdAt: new Date("2026-10-01") };
    db.enrolment.findFirst.mockResolvedValue(candidate);
    tx.enrolment.findFirst.mockResolvedValue(candidate);
    seats(1, 1);
    await expect(promoteWaitlisted(user, "sec-1")).resolves.toEqual({ enrolmentId: "enr-wait", studentId: "stu-2", sectionId: "sec-1" });
    expect(tx.enrolment.updateMany).toHaveBeenCalledWith({
      where: { id: "enr-wait", status: "waitlisted", rowVersion: 3 },
      data: { status: "enrolled", rowVersion: { increment: 1 } },
    });
  });
});
