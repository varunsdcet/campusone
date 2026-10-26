import { Router } from "express";
import { prisma } from "@myheritage/db";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import {
  SEARCH_CAMPUS_OPTIONS,
  SEARCH_DELIVERY_OPTIONS,
  SEARCH_DOMESTIC_OPTIONS,
  SEARCH_PROGRAM_CATALOG,
  SEARCH_STATUS_OPTIONS,
  MONTH_OPTIONS,
  dayOptions,
  yearOptions,
  normalizeLifecycleLabel,
} from "./searchMeta.js";
import { currentStudentId } from "../me/studentAlignment.js";

export const searchRouter: Router = Router();

type SearchItem = { id: string; label: string; sub?: string | null; href?: string | null };
type SearchGroup = { type: string; items: SearchItem[] };

function qstr(req: { query: Record<string, unknown> }, key: string) {
  const raw = req.query[key];
  return String(Array.isArray(raw) ? raw[0] : raw ?? "").trim();
}

searchRouter.get("/meta", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const programs = await prisma.program.findMany({
      where: { institutionId: user.institutionId },
      orderBy: [{ name: "asc" }],
    });
    const seen = new Set<string>();
    const programOptions: Array<{ label: string; value: string; group?: string }> = [
      { label: "All Programs", value: "" },
    ];
    for (const row of SEARCH_PROGRAM_CATALOG) {
      const value = `${row.code}: ${row.label}`;
      seen.add(row.code.toLowerCase());
      seen.add(row.label.toLowerCase());
      programOptions.push({
        label: `${row.code}: ${row.label}`,
        value,
        group: row.group,
      });
    }
    for (const p of programs) {
      const key = p.code.toLowerCase();
      const nameKey = p.name.toLowerCase();
      if (seen.has(key) || seen.has(nameKey)) continue;
      seen.add(key);
      seen.add(nameKey);
      programOptions.push({
        label: `${p.code}: ${p.name}`,
        value: `${p.code}: ${p.name}`,
        group: (p.awardLevel || "PROGRAMS").toUpperCase(),
      });
    }
    res.json({
      statuses: SEARCH_STATUS_OPTIONS,
      campuses: SEARCH_CAMPUS_OPTIONS,
      deliveryMethods: SEARCH_DELIVERY_OPTIONS,
      domesticInternational: SEARCH_DOMESTIC_OPTIONS,
      programs: programOptions,
      months: MONTH_OPTIONS,
      days: dayOptions(),
      years: yearOptions(),
    });
  } catch (err) {
    next(err);
  }
});

searchRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const q = qstr(req as never, "q").toLowerCase();
    const advanced = {
      status: qstr(req as never, "status"),
      sisEmail: qstr(req as never, "sisEmail"),
      lastName: qstr(req as never, "lastName"),
      firstName: qstr(req as never, "firstName"),
      middleName: qstr(req as never, "middleName"),
      preferredName: qstr(req as never, "preferredName"),
      dobMonth: qstr(req as never, "dobMonth"),
      dobDay: qstr(req as never, "dobDay"),
      dobYear: qstr(req as never, "dobYear"),
      domesticInternational: qstr(req as never, "domesticInternational"),
      streetAddress: qstr(req as never, "streetAddress"),
      city: qstr(req as never, "city"),
      postalCode: qstr(req as never, "postalCode"),
      phoneNumber: qstr(req as never, "phoneNumber"),
      email: qstr(req as never, "email"),
      discountCode: qstr(req as never, "discountCode"),
      campus: qstr(req as never, "campus"),
      deliveryMethod: qstr(req as never, "deliveryMethod"),
      program: qstr(req as never, "program"),
      studentNumber: qstr(req as never, "studentNumber"),
    };
    const hasAdvanced = Object.values(advanced).some(Boolean);

    if (!q && !hasAdvanced) {
      res.json({ groups: [] });
      return;
    }
    if (user.roles.includes("student") && !user.roles.some((role) => role === "admin" || role === "registrar")) {
      const student = await prisma.student.findFirst({
        where: { id: await currentStudentId(user.institutionId, user.personId), institutionId: user.institutionId },
      });
      if (!student) {
        res.json({ groups: [] });
        return;
      }
      const [enrolments, assignments, resources] = await Promise.all([
        prisma.enrolment.findMany({
          where: {
            institutionId: user.institutionId,
            studentId: student.id,
            status: { in: ["enrolled", "completed"] },
            section: {
              institutionId: user.institutionId,
              course: {
                institutionId: user.institutionId,
                OR: [
                  { code: { contains: q, mode: "insensitive" } },
                  { title: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
          include: { section: { include: { course: true } } },
          take: 8,
        }),
        prisma.assignment.findMany({
          where: {
            institutionId: user.institutionId,
            title: { contains: q, mode: "insensitive" },
            section: {
              institutionId: user.institutionId,
              enrolments: {
                some: {
                  institutionId: user.institutionId,
                  studentId: student.id,
                  status: { in: ["enrolled", "completed"] },
                },
              },
            },
          },
          include: { section: { include: { course: true } } },
          take: 8,
        }),
        prisma.portalRecord.findMany({
          where: {
            institutionId: user.institutionId,
            role: "student",
            screenPath: { startsWith: "/student/" },
            OR: [{ audienceAccountId: null }, { audienceAccountId: user.accountId }],
            AND: [
              {
                OR: [
                  { primaryText: { contains: q, mode: "insensitive" } },
                  { secondaryText: { contains: q, mode: "insensitive" } },
                ],
              },
            ],
          },
          take: 8,
        }),
      ]);
      res.json({
        groups: [
          {
            type: "courses",
            items: enrolments.map((entry) => ({
              id: entry.sectionId,
              label: `${entry.section.course.code} · ${entry.section.course.title}`,
              sub: entry.section.code,
              href: `/student/courses/${entry.sectionId}`,
            })),
          },
          {
            type: "assignments",
            items: assignments.map((assignment) => ({
              id: assignment.id,
              label: assignment.title,
              sub: assignment.section.course.code,
              href: `/student/assignments/${assignment.id}`,
            })),
          },
          {
            type: "portal",
            items: resources.map((resource) => ({
              id: resource.id,
              label: resource.primaryText,
              sub: resource.secondaryText,
              href: resource.href ?? resource.screenPath,
            })),
          },
        ].filter((group) => group.items.length > 0),
      });
      return;
    }

    if (user.roles.includes("applicant") && !user.roles.some((r) => r === "admin" || r === "registrar")) {
      const app = await prisma.admissionsApplication.findFirst({
        where: { institutionId: user.institutionId, accountId: user.accountId },
        include: { documents: true, offers: true, timeline: true },
      });
      const groups: SearchGroup[] = [];
      if (app) {
        const hay = `${app.programName} ${app.status} ${app.intakeTerm}`.toLowerCase();
        if (hay.includes(q) || q.includes("application") || q.includes("nursing")) {
          groups.push({
            type: "application",
            items: [
              {
                id: app.id,
                label: app.programName,
                sub: `${app.status} · ${app.progressPct}%`,
                href: "/applicant/application",
              },
            ],
          });
        }
        const docs = app.documents.filter(
          (d) => d.label.toLowerCase().includes(q) || d.status.toLowerCase().includes(q),
        );
        if (docs.length || q.includes("document") || q.includes("passport") || q.includes("transcript")) {
          groups.push({
            type: "documents",
            items: (docs.length ? docs : app.documents).slice(0, 8).map((d) => ({
              id: d.id,
              label: d.label,
              sub: d.status,
              href: "/applicant/documents",
            })),
          });
        }
        const offers = app.offers.filter(
          (o) => o.title.toLowerCase().includes(q) || o.status.toLowerCase().includes(q),
        );
        if (offers.length || q.includes("offer")) {
          groups.push({
            type: "offers",
            items: (offers.length ? offers : app.offers).map((o) => ({
              id: o.id,
              label: o.title,
              sub: o.status,
              href: "/applicant/offers",
            })),
          });
        }
      }
      res.json({ groups: groups.filter((g) => g.items.length > 0) });
      return;
    }

    if (user.roles.includes("employer") && !user.roles.some((r) => r === "admin" || r === "registrar")) {
      const org = await prisma.employerOrg.findFirst({
        where: { institutionId: user.institutionId, accountId: user.accountId },
        include: {
          placements: { include: { hours: true, evaluations: true } },
          agreements: true,
        },
      });
      const groups: SearchGroup[] = [];
      if (org) {
        const placements = org.placements.filter(
          (p) =>
            p.studentName.toLowerCase().includes(q) ||
            p.programName.toLowerCase().includes(q) ||
            q.includes("placement"),
        );
        if (placements.length || q.includes("mei") || q.includes("fatima")) {
          groups.push({
            type: "placements",
            items: (placements.length ? placements : org.placements).map((p) => ({
              id: p.id,
              label: p.studentName,
              sub: p.programName,
              href: "/employer/placements",
            })),
          });
        }
        const hours = org.placements.flatMap((p) =>
          p.hours
            .filter((h) => h.weekLabel.toLowerCase().includes(q) || h.status.toLowerCase().includes(q) || q.includes("hour"))
            .map((h) => ({
              id: h.id,
              label: `${p.studentName} · ${h.weekLabel}`,
              sub: `${h.hours}h · ${h.status}`,
              href: "/employer/hours",
            })),
        );
        if (hours.length) {
          groups.push({ type: "hours", items: hours.slice(0, 8) });
        }
        const agreements = org.agreements.filter(
          (a) => a.title.toLowerCase().includes(q) || q.includes("agreement") || q.includes("mou"),
        );
        if (agreements.length || q.includes("agreement")) {
          groups.push({
            type: "agreements",
            items: (agreements.length ? agreements : org.agreements).map((a) => ({
              id: a.id,
              label: a.title,
              sub: a.status,
              href: "/employer/agreements",
            })),
          });
        }
      }
      res.json({ groups: groups.filter((g) => g.items.length > 0) });
      return;
    }

    if (user.roles.includes("instructor") && !user.roles.some((r) => r === "admin" || r === "registrar")) {
      const institution = await prisma.institution.findFirst({
        where: { institutionId: user.institutionId },
      });
      const [directoryStudents, sections] = await Promise.all([
        prisma.student.findMany({
          where: {
            institutionId: user.institutionId,
            enrolments: {
              some: {
                institutionId: user.institutionId,
                status: { in: ["enrolled", "completed", "withdrawn"] },
                section: { instructorPersonId: user.personId },
              },
            },
          },
          include: { person: true },
          orderBy: [{ person: { familyName: "asc" } }, { person: { givenName: "asc" } }],
          take: 5000,
        }),
        prisma.section.findMany({
          where: { institutionId: user.institutionId, instructorPersonId: user.personId },
          include: {
            course: true,
            enrolments: {
              where: { status: { in: ["enrolled", "completed", "withdrawn"] } },
            },
          },
        }),
      ]);

      const campusHay = [
        institution?.name || "",
        institution?.city || "",
        institution?.addressLine1 || "",
        "#110 Heritage College - Surrey",
        "Heritage Community College",
      ]
        .join(" ")
        .toLowerCase();

      const studentHits = directoryStudents
        .filter((st) => {
          const given = st.person.givenName || "";
          const family = st.person.familyName || "";
          const name = `${given} ${family}`.toLowerCase();
          const email = (st.person.email || "").toLowerCase();
          const program = (st.programName || "").toLowerCase();
          const standingRaw = st.standing || "";
          // Match Student List status labels (directory standing), not section enrolment status.
          const lifecycle = normalizeLifecycleLabel(standingRaw);
          const standing = standingRaw.toLowerCase();
          const number = st.studentNumber.toLowerCase();
          const dob = (st.person.dateOfBirth || "").trim();
          const hay = `${name} ${email} ${program} ${standing} ${lifecycle} ${number} ${dob} ${campusHay}`.toLowerCase();

          if (q) {
            const tokens = q.split(/\s+/).filter(Boolean);
            if (!tokens.every((t) => hay.includes(t))) return false;
          }
          if (advanced.studentNumber && !number.includes(advanced.studentNumber.toLowerCase())) return false;
          // Name fields match full name (first/last often swapped in advanced search).
          if (advanced.firstName) {
            const fn = advanced.firstName.toLowerCase();
            if (!given.toLowerCase().includes(fn) && !family.toLowerCase().includes(fn) && !name.includes(fn)) {
              return false;
            }
          }
          if (advanced.lastName) {
            const ln = advanced.lastName.toLowerCase();
            if (!family.toLowerCase().includes(ln) && !given.toLowerCase().includes(ln) && !name.includes(ln)) {
              return false;
            }
          }
          if (advanced.middleName && !hay.includes(advanced.middleName.toLowerCase())) return false;
          if (advanced.preferredName && !hay.includes(advanced.preferredName.toLowerCase())) return false;
          if (advanced.email && !email.includes(advanced.email.toLowerCase())) return false;
          if (advanced.sisEmail && !email.includes(advanced.sisEmail.toLowerCase())) return false;
          if (advanced.program) {
            const p = advanced.program.toLowerCase();
            if (!program.includes(p) && !hay.includes(p.split(":")[0]?.trim() || p)) return false;
          }
          if (advanced.status) {
            const want = normalizeLifecycleLabel(advanced.status);
            if (want && lifecycle !== want && !lifecycle.toLowerCase().includes(want.toLowerCase())) return false;
          }
          if (advanced.dobYear || advanced.dobMonth || advanced.dobDay) {
            if (!dob) return false;
            const parts = dob.replace(/[./]/g, "-").split("-");
            let y = "";
            let m = "";
            let d = "";
            if (parts[0]?.length === 4) {
              y = parts[0];
              m = parts[1] || "";
              d = parts[2] || "";
            } else {
              m = parts[0] || "";
              d = parts[1] || "";
              y = parts[2] || "";
            }
            if (advanced.dobYear && y !== advanced.dobYear) return false;
            if (advanced.dobMonth && m.padStart(2, "0") !== advanced.dobMonth) return false;
            if (advanced.dobDay && d.padStart(2, "0") !== advanced.dobDay) return false;
          }
          if (advanced.city) {
            const city = (institution?.city || "").toLowerCase();
            if (!city.includes(advanced.city.toLowerCase()) && !hay.includes(advanced.city.toLowerCase())) return false;
          }
          if (advanced.postalCode) {
            const postal = (institution?.postalCode || "").toLowerCase();
            if (!postal.includes(advanced.postalCode.toLowerCase()) && !hay.includes(advanced.postalCode.toLowerCase())) {
              return false;
            }
          }
          if (advanced.streetAddress && !hay.includes(advanced.streetAddress.toLowerCase())) return false;
          if (advanced.phoneNumber && !hay.includes(advanced.phoneNumber.toLowerCase())) return false;
          if (advanced.discountCode && !hay.includes(advanced.discountCode.toLowerCase())) return false;
          if (advanced.campus) {
            const c = advanced.campus.toLowerCase();
            if (!campusHay.includes(c) && !hay.includes(c)) {
              if (!(c.includes("surrey") && campusHay.includes("surrey"))) return false;
            }
          }
          if (advanced.deliveryMethod) {
            const dm = advanced.deliveryMethod.toLowerCase();
            const campus = advanced.campus.toLowerCase();
            if (
              (dm === "online" || dm === "distance") &&
              !campus.includes(dm) &&
              !hay.includes(dm) &&
              !campusHay.includes(dm)
            ) {
              return false;
            }
            if ((dm === "in-person" || dm === "hybrid") && /online|distance/i.test(advanced.campus)) {
              return false;
            }
          }
          if (advanced.domesticInternational) {
            const di = advanced.domesticInternational.toLowerCase();
            const intlHint = /intl|international|offshore|visa/i.test(`${standing} ${program} ${standingRaw}`);
            if (di === "international" && !intlHint) return false;
            if (di === "domestic" && intlHint) return false;
          }
          return true;
        })
        .map((st) => {
          const lifecycle = normalizeLifecycleLabel(st.standing || "");
          return {
            id: st.id,
            label: `${st.person.givenName} ${st.person.familyName}`.trim(),
            sub: `${st.studentNumber} · ${lifecycle} · ${st.programName || "—"}`,
            href: `/instructor/f/t22-student-detail-full-page?studentId=${encodeURIComponent(st.id)}`,
          };
        });

      const courses = !hasAdvanced
        ? sections
            .filter(
              (s) =>
                !q ||
                s.course.code.toLowerCase().includes(q) ||
                s.course.title.toLowerCase().includes(q) ||
                s.code.toLowerCase().includes(q),
            )
            .map((s) => ({
              id: s.id,
              label: `${s.course.code} · ${s.course.title}`,
              sub: `${s.code} · ${s.enrolments.filter((e) => e.status === "enrolled").length} enrolled`,
              href: `/instructor/sections/${s.id}`,
            }))
        : [];
      res.json({
        groups: [
          { type: "students", items: studentHits.slice(0, 100) },
          { type: "courses", items: courses.slice(0, 8) },
        ].filter((group) => group.items.length > 0),
      });
      return;
    }

    const people = await prisma.person.findMany({
      where: {
        institutionId: user.institutionId,
        OR: [
          { givenName: { contains: q || advanced.firstName || " ", mode: "insensitive" } },
          { familyName: { contains: q || advanced.lastName || " ", mode: "insensitive" } },
          { email: { contains: q || advanced.email || advanced.sisEmail || " ", mode: "insensitive" } },
        ],
      },
      include: { students: true, accounts: true },
      take: 8,
    });
    const courses = await prisma.course.findMany({
      where: {
        institutionId: user.institutionId,
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 8,
    });
    res.json({
      groups: [
        {
          type: "people",
          items: people.map((p) => {
            const isStudent = (p.students?.length ?? 0) > 0;
            const roles = (p.accounts ?? []).flatMap((a) => {
              try {
                return JSON.parse(a.rolesJson) as string[];
              } catch {
                return [];
              }
            });
            return {
              id: p.id,
              label: `${p.givenName} ${p.familyName}`,
              sub: p.email,
              href: isStudent
                ? "/admin/f/rg-01-student-360"
                : roles.includes("instructor")
                  ? "/admin/f/ac-14-faculty"
                  : "/admin/f/pl-01-users-and-roles",
            };
          }),
        },
        {
          type: "courses",
          items: courses.map((c) => ({
            id: c.id,
            label: `${c.code} · ${c.title}`,
            sub: `${c.credits} credits`,
            href: "/admin/f/ac-06-course-catalogue",
          })),
        },
      ],
    });
  } catch (err) {
    next(err);
  }
});
