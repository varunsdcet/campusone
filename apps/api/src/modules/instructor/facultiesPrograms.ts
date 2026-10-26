export const FACULTIES_PROGRAMS_PATH = "/instructor/f/t13-program-management";
export const ADD_FACULTY_PATH = "/instructor/f/t81-add-faculty";

export type FacultyRecord = {
  id: string;
  name: string;
  abbreviation: string;
  active: boolean;
};

export type FacultyProgramRecord = {
  id: string;
  facultyId: string;
  name: string;
  abbreviation: string;
  active: boolean;
};

export const DEFAULT_FACULTIES: FacultyRecord[] = [
  { id: "fac-accounting-payroll", name: "Accounting/Payroll", abbreviation: "", active: true },
  { id: "fac-business", name: "Business", abbreviation: "", active: true },
  { id: "fac-computer-science", name: "Computer Science", abbreviation: "", active: true },
  { id: "fac-ecea", name: "Early Childhood Educator Assistant", abbreviation: "ECEA", active: true },
  { id: "fac-health-science", name: "Health Science", abbreviation: "", active: true },
  { id: "fac-hospitality-management", name: "Hospitality Management", abbreviation: "", active: true },
  { id: "fac-languages", name: "Languages", abbreviation: "", active: true },
];

export const DEFAULT_FACULTY_PROGRAMS: FacultyProgramRecord[] = [
  { id: "prog-capa", facultyId: "fac-accounting-payroll", name: "Certificate in Accounting and Payroll Administrator", abbreviation: "CAPA", active: true },
  { id: "prog-dap", facultyId: "fac-accounting-payroll", name: "Diploma in Accounting and Payroll administrator", abbreviation: "DAP", active: true },
  { id: "prog-btt", facultyId: "fac-business", name: "Bank Teller Training", abbreviation: "BTT", active: true },
  { id: "prog-coa", facultyId: "fac-business", name: "Certificate Office Administration", abbreviation: "COA", active: true },
  { id: "prog-csms", facultyId: "fac-business", name: "Corporate Sales Management Strategies Certificate", abbreviation: "CSMS", active: true },
  { id: "prog-dmm", facultyId: "fac-business", name: "Digital Marketing Management", abbreviation: "DMM", active: true },
  { id: "prog-dib", facultyId: "fac-business", name: "Diploma in International Business", abbreviation: "DIB", active: true },
  { id: "prog-hra", facultyId: "fac-business", name: "Human Resources Administration", abbreviation: "HRA", active: true },
  { id: "prog-ma", facultyId: "fac-business", name: "Marketing Administration", abbreviation: "MA", active: true },
  { id: "prog-oa", facultyId: "fac-business", name: "Office Administration", abbreviation: "OA", active: true },
  { id: "prog-rsms", facultyId: "fac-business", name: "Retail Sales Management Strategies Certificate", abbreviation: "RSMS", active: true },
  { id: "prog-nsa", facultyId: "fac-computer-science", name: "Network Support Administrator", abbreviation: "NSA", active: true },
  { id: "prog-nst", facultyId: "fac-computer-science", name: "Network Support Technician", abbreviation: "NST", active: true },
  {
    id: "prog-ecea1",
    facultyId: "fac-ecea",
    name: "Child Growth Development part 1 & 2",
    abbreviation: "ECEA option 1",
    active: true,
  },
  {
    id: "prog-ecea2",
    facultyId: "fac-ecea",
    name: "Child Growth Development Part I & II + Interpersonal Communication",
    abbreviation: "ECEA (Option 2)",
    active: true,
  },
  { id: "prog-acsw", facultyId: "fac-health-science", name: "Addictions Community Support Worker", abbreviation: "ACSW", active: true },
  { id: "prog-hca", facultyId: "fac-health-science", name: "Health Care Assistant", abbreviation: "HCA", active: true },
  { id: "prog-hca3", facultyId: "fac-health-science", name: "Interpersonal Communication (HCA-3)", abbreviation: "HCA", active: true },
  { id: "prog-moa", facultyId: "fac-health-science", name: "Medical Office Assistant", abbreviation: "MOA", active: true },
  { id: "prog-sssw", facultyId: "fac-health-science", name: "Social Services Support Worker", abbreviation: "SSSW", active: true },
  { id: "prog-dhm", facultyId: "fac-hospitality-management", name: "Diploma in Hospitality Management", abbreviation: "DHM", active: true },
  { id: "prog-esc", facultyId: "fac-languages", name: "English Skills for College", abbreviation: "ESC", active: true },
];

export function facultySlug(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `fac-${slug}` : `fac-${Date.now().toString(36)}`;
}

export function facultyIdFromName(name: string, faculties: FacultyRecord[]) {
  const needle = name.trim().toLowerCase();
  if (!needle) return "";
  const hit = faculties.find(
    (f) => f.name.toLowerCase() === needle || f.id === needle || f.abbreviation.toLowerCase() === needle,
  );
  return hit?.id || facultySlug(name);
}

export function guessFacultyId(program: { name: string; code: string }, faculties: FacultyRecord[]) {
  const blob = `${program.name} ${program.code}`.toLowerCase();
  const hit = faculties.find(
    (f) => blob.includes(f.name.toLowerCase()) || (f.abbreviation && blob.includes(f.abbreviation.toLowerCase())),
  );
  return hit?.id || faculties.find((f) => f.id === "fac-computer-science")?.id || faculties[0]?.id || "";
}

function stringIds(value: unknown) {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export function mergeFacultyList(overlay?: Record<string, unknown> | null): FacultyRecord[] {
  const deleted = new Set(stringIds(overlay?.deletedFacultyIds));
  const extras = Array.isArray(overlay?.extraFaculties)
    ? (overlay!.extraFaculties as FacultyRecord[]).filter((f) => f && typeof f.id === "string")
    : [];
  const extraIds = new Set(extras.map((f) => f.id));
  const editsRaw =
    overlay?.facultyEdits && typeof overlay.facultyEdits === "object"
      ? (overlay.facultyEdits as Record<string, Partial<FacultyRecord>>)
      : {};
  const apply = (f: FacultyRecord): FacultyRecord => {
    const e = editsRaw[f.id];
    if (!e) return { ...f };
    return {
      id: f.id,
      name: typeof e.name === "string" && e.name.trim() ? e.name : f.name,
      abbreviation: typeof e.abbreviation === "string" ? e.abbreviation : f.abbreviation,
      active: typeof e.active === "boolean" ? e.active : f.active,
    };
  };
  return [
    ...extras.filter((f) => !deleted.has(f.id)).map(apply),
    ...DEFAULT_FACULTIES.filter((f) => !deleted.has(f.id) && !extraIds.has(f.id)).map(apply),
  ];
}

export function mergeFacultyProgramList(
  overlay: Record<string, unknown> | null | undefined,
  dbPrograms: Array<{ id: string; code: string; name: string }>,
  faculties: FacultyRecord[],
): FacultyProgramRecord[] {
  const deleted = new Set(stringIds(overlay?.deletedFacultyProgramIds));
  const extras = Array.isArray(overlay?.extraFacultyPrograms)
    ? (overlay!.extraFacultyPrograms as FacultyProgramRecord[]).filter((p) => p && typeof p.id === "string")
    : [];
  const extraIds = new Set(extras.map((p) => p.id));
  const extraCodes = new Set(extras.map((p) => p.abbreviation.toLowerCase()));
  const extraNames = new Set(extras.map((p) => p.name.toLowerCase()));
  const editsRaw =
    overlay?.facultyProgramEdits && typeof overlay.facultyProgramEdits === "object"
      ? (overlay.facultyProgramEdits as Record<string, Partial<FacultyProgramRecord>>)
      : {};
  const apply = (p: FacultyProgramRecord): FacultyProgramRecord => {
    const e = editsRaw[p.id];
    if (!e) return { ...p };
    return {
      id: p.id,
      facultyId: typeof e.facultyId === "string" && e.facultyId.trim() ? e.facultyId : p.facultyId,
      name: typeof e.name === "string" && e.name.trim() ? e.name : p.name,
      abbreviation: typeof e.abbreviation === "string" && e.abbreviation.trim() ? e.abbreviation : p.abbreviation,
      active: typeof e.active === "boolean" ? e.active : p.active,
    };
  };
  const rows = [
    ...extras.filter((p) => !deleted.has(p.id)).map(apply),
    ...DEFAULT_FACULTY_PROGRAMS.filter((p) => !deleted.has(p.id) && !extraIds.has(p.id)).map(apply),
  ];
  const seen = new Set(rows.flatMap((p) => [p.id, p.abbreviation.toLowerCase(), p.name.toLowerCase()]));
  const skipDbCodes = new Set(["cs-dip"]);
  const skipDbIds = new Set(["b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b101"]);
  for (const db of dbPrograms) {
    if (deleted.has(db.id) || skipDbIds.has(db.id)) continue;
    if (skipDbCodes.has(db.code.toLowerCase())) continue;
    if (extraIds.has(db.id) || extraCodes.has(db.code.toLowerCase()) || extraNames.has(db.name.toLowerCase())) continue;
    if (seen.has(db.id) || seen.has(db.code.toLowerCase()) || seen.has(db.name.toLowerCase())) continue;
    const facultyId =
      (typeof overlay?.programFaculty === "object" && overlay?.programFaculty
        ? (overlay.programFaculty as Record<string, string>)[db.id]
        : "") || guessFacultyId(db, faculties);
    rows.push({
      id: db.id,
      facultyId,
      name: db.name,
      abbreviation: db.code,
      active: true,
    });
  }
  return rows;
}

export function groupFacultiesPrograms(faculties: FacultyRecord[], programs: FacultyProgramRecord[]) {
  return faculties.map((faculty) => ({
    ...faculty,
    programs: programs.filter((p) => p.facultyId === faculty.id),
  }));
}
