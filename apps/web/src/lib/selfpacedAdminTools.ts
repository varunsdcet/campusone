export type SelfpacedApplication = {
  id: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  programName: string;
  intakeTerm: string;
  status: string;
  progressPct?: number;
  submittedAt?: string;
  _name?: string;
  _docs?: string;
  _student?: string;
};

export type ApplicationFilters = { query?: string; status?: string; program?: string; intake?: string };

export function filterApplications(items: SelfpacedApplication[], filters: ApplicationFilters) {
  const query = (filters.query || "").trim().toLowerCase();
  return items.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.program && item.programName !== filters.program) return false;
    if (filters.intake && item.intakeTerm !== filters.intake) return false;
    if (!query) return true;
    return [item.id, item._name, item.givenName, item.familyName, item.email, item.programName, item.intakeTerm, item.status, item._student]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function applicationsCsv(items: SelfpacedApplication[]) {
  const header = ["Application ID", "Applicant", "Email", "Program", "Intake", "Documents", "Progress %", "Stage", "Submitted", "Student Record"];
  const rows = items.map((item) => [
    item.id,
    item._name || [item.givenName, item.familyName].filter(Boolean).join(" "),
    item.email,
    item.programName,
    item.intakeTerm,
    item._docs,
    item.progressPct ?? 0,
    item.status,
    item.submittedAt,
    item._student,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export type AdminTableFilters = { query?: string; column?: number; value?: string };

export function filterAdminRows(rows: string[][], filters: AdminTableFilters) {
  const query = (filters.query || "").trim().toLocaleLowerCase();
  const value = (filters.value || "").trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (value && filters.column !== undefined && filters.column >= 0 && String(row[filters.column] || "").trim().toLocaleLowerCase() !== value) return false;
    return !query || row.some((cell) => String(cell).toLocaleLowerCase().includes(query));
  });
}

export function adminRowsCsv(columns: string[], rows: string[][]) {
  return [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
