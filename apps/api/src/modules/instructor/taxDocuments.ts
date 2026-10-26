import type { SessionClaims } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";

const TAX_PATH = "/instructor/tax-documents";

type StoredTaxDoc = {
  id: string;
  docType: string;
  taxYear: number;
  title: string;
  status: "available" | "pending" | "expired";
  issuedAt: string | null;
  downloadUrl: string | null;
};

function httpError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

function instructorTaxPdfPath(id: string) {
  return `/instructor/tax-documents/${id}/pdf`;
}

function mapRow(row: {
  id: string;
  primaryText: string | null;
  secondaryText: string | null;
  metaText: string | null;
  updatedAt: Date;
}): StoredTaxDoc | null {
  const [yearRaw, statusRaw, issuedAt] = (row.metaText || "").split("|");
  const taxYear = Number(yearRaw);
  if (!row.secondaryText || !Number.isFinite(taxYear) || !row.primaryText) return null;
  return {
    id: row.id,
    docType: row.secondaryText,
    taxYear,
    title: row.primaryText,
    status: statusRaw === "pending" || statusRaw === "expired" ? statusRaw : "available",
    issuedAt: issuedAt || row.updatedAt.toISOString(),
    downloadUrl: instructorTaxPdfPath(row.id),
  };
}

/**
 * Instructor tax slips (T4A / earnings), issued to one account each — never shared or auto-generated.
 * Stored on PortalRecord until a dedicated instructor tax table exists.
 * Fields: primaryText=title, secondaryText=docType, metaText=`year|status|issuedAt`, audienceAccountId=recipient
 */
export async function listInstructorTaxDocuments(user: SessionClaims) {
  const rows = await prisma.portalRecord.findMany({
    where: {
      institutionId: user.institutionId,
      screenPath: TAX_PATH,
      role: "instructor",
      audienceAccountId: user.accountId,
    },
    orderBy: { updatedAt: "desc" },
  });

  const documents: StoredTaxDoc[] = [];
  for (const row of rows) {
    const mapped = mapRow(row);
    if (mapped) documents.push(mapped);
  }

  return {
    documents,
    formOptions: documents.map((d) => ({
      value: d.id,
      label: `${d.docType} — ${d.taxYear} · ${d.title}`,
    })),
    emptyNotice: documents.length
      ? null
      : "There are currently no tax documents or forms available.",
  };
}

export async function getInstructorTaxPdf(user: SessionClaims, documentId: string) {
  const row = await prisma.portalRecord.findFirst({
    where: {
      id: documentId,
      institutionId: user.institutionId,
      screenPath: TAX_PATH,
      role: "instructor",
      audienceAccountId: user.accountId,
    },
  });
  if (!row) throw httpError("Tax document not found", "NOT_FOUND", 404);
  const mapped = mapRow(row);
  if (!mapped) throw httpError("Tax document not found", "NOT_FOUND", 404);

  const person = await prisma.person.findFirst({ where: { id: user.personId } });
  const inst = await prisma.institution.findFirst({ where: { id: user.institutionId } });
  const { renderTaxCertificatePdf, taxPdfFilename } = await import("../../lib/taxPdf.js");
  const pdf = renderTaxCertificatePdf({
    institutionName: inst?.name ?? "Heritage College",
    legalName: inst?.legalName,
    addressLine1: inst?.addressLine1,
    city: inst?.city,
    region: inst?.region,
    postalCode: inst?.postalCode,
    country: inst?.country,
    docType: mapped.docType,
    title: mapped.title,
    taxYear: mapped.taxYear,
    recipientName: `${person?.givenName ?? ""} ${person?.familyName ?? ""}`.trim() || "Instructor",
    recipientIdLabel: "Instructor email",
    recipientId: person?.email ?? user.accountId,
    status: mapped.status,
    craStatus: "generated",
    issuedAt: mapped.issuedAt,
  });
  return { pdf, filename: taxPdfFilename(mapped.docType, mapped.taxYear) };
}
