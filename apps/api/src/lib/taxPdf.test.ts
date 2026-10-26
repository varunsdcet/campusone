import { describe, expect, it } from "vitest";
import { buildSimplePdf, renderTaxCertificatePdf, taxPdfFilename } from "./taxPdf.js";

describe("taxPdf", () => {
  it("builds a valid single-page PDF", () => {
    const pdf = buildSimplePdf("T2202 Tuition Certificate", ["Student: Marcus Vance", "Tax year: 2025"]);
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.includes("%%EOF")).toBe(true);
    expect(text).toContain("T2202 Tuition Certificate");
    expect(text).toContain("Marcus Vance");
    expect(text).toContain("Heritage College");
  });

  it("renders branded T2202 fields and a stable filename", () => {
    const pdf = renderTaxCertificatePdf({
      institutionName: "Heritage College",
      legalName: "Heritage College of Applied Arts",
      addressLine1: "12345 King George Blvd",
      city: "Surrey",
      region: "BC",
      postalCode: "V3T 2W1",
      country: "CA",
      docType: "T2202",
      title: "T2202 Tuition and Enrolment Certificate - 2025",
      taxYear: 2025,
      recipientName: "Marcus Vance",
      recipientIdLabel: "Student number",
      recipientId: "S1001",
      programName: "Computer Science diploma",
      eligibleTuitionCad: 2450,
      enrolmentMonths: 8,
      craStatus: "generated",
      status: "available",
      issuedAt: "2026-02-28T00:00:00.000Z",
    });
    const text = pdf.toString("latin1");
    expect(text).toContain("HERITAGE COLLEGE");
    expect(text).toContain("12345 King George Blvd");
    expect(text).toContain("Eligible tuition fees: CAD 2450.00");
    expect(text).not.toContain("last 4 digits");
    expect(text).toContain("Official tax document");
    expect(taxPdfFilename("T2202", 2025)).toBe("T2202-2025.pdf");
  });
});
