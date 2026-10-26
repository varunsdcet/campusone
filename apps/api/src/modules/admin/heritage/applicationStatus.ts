import { prisma } from "@myheritage/db";

/** Admissions application status → the student lifecycle directory it is listed under (STUDENT_STATUSES). */
const LIFECYCLE: Record<string, string> = {
  draft: "New Inquiry",
  submitted: "New Inquiry",
  in_review: "New Inquiry",
  under_review: "New Inquiry",
  new_inquiry: "New Inquiry",
  inquiry: "New Inquiry",
  prospective: "New Inquiry",
  accepted: "Approved Application",
  approved: "Approved Application",
  approved_application: "Approved Application",
  offer: "Approved Application",
  offered: "Approved Application",
  pre_enrollment: "Pre-enrolment Application",
  pre_enrolment: "Pre-enrolment Application",
  interview: "Pre-enrolment Application",
  waitlisted: "Pre-enrolment Application",
  cloa: "CLOA",
  offer_sent: "CLOA",
  loa: "LOA",
  follow_up: "Follow Up",
  inactive: "In-active Leads",
  duplicate: "Duplicate profiles",
  declined: "Declined Application",
  rejected: "Declined Application",
  refused_visa: "Declined Application",
  withdrawn: "Cancelled / Did not proceed",
  cancelled: "Cancelled / Did not proceed",
  did_not_proceed: "Cancelled / Did not proceed",
};

export function applicationLifecycleStatus(status: string) {
  return LIFECYCLE[status.trim().toLowerCase().replace(/[\s-]+/g, "_")] ?? "Pre-enrolment Application";
}

/** Applications from people who have no student record yet; once a student record exists the student's own status wins. */
export async function applicantLeads(institutionId: string) {
  const [apps, students] = await Promise.all([
    prisma.admissionsApplication.findMany({ where: { institutionId }, orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.student.findMany({ where: { institutionId }, select: { personId: true } }),
  ]);
  const studentPeople = new Set(students.map((s) => s.personId));
  const open = apps.filter((a) => !studentPeople.has(a.personId));
  const people = new Map((await prisma.person.findMany({ where: { id: { in: [...new Set(open.map((a) => a.personId))] } } })).map((p) => [p.id, p]));
  return open.flatMap((a) => {
    const person = people.get(a.personId);
    return person ? [{ ...a, person, lifecycleStatus: applicationLifecycleStatus(a.status) }] : [];
  });
}
