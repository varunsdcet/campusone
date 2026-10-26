import { describe, expect, it } from "vitest";
import { bytesMatchMime, decodeBase64, sniff } from "./fileSniff.js";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n");
const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]), Buffer.from("[Content_Types].xml")]);
const exe = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]), Buffer.from("This program cannot be run in DOS mode.")]);
const binary = Buffer.from([0x13, 0x37, 0x00, 0xff, 0x00, 0x01, 0x02, 0x03]);

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("bytesMatchMime", () => {
  it.each([
    ["PNG", png, "image/png"],
    ["JPEG", jpeg, "image/jpeg"],
    ["JPEG (image/jpg)", jpeg, "image/jpg"],
    ["PDF", pdf, "application/pdf"],
    ["DOCX", docx, DOCX_MIME],
    ["plain text", Buffer.from("Week 3 reflection\nIt went well.\n"), "text/plain"],
  ])("accepts real %s bytes for their declared type", (_label, bytes, mime) => {
    expect(bytesMatchMime(bytes, mime)).toBe(true);
  });

  it("rejects a Windows executable renamed to a PDF", () => {
    expect(sniff(exe)).toBe("binary");
    expect(bytesMatchMime(exe, "application/pdf")).toBe(false);
  });

  it("rejects an executable declared as plain text", () => {
    expect(bytesMatchMime(exe, "text/plain")).toBe(false);
  });

  it("rejects binary content declared as plain text", () => {
    expect(bytesMatchMime(binary, "text/plain")).toBe(false);
  });

  it("rejects bytes of one real type declared as another", () => {
    expect(bytesMatchMime(png, "image/jpeg")).toBe(false);
    expect(bytesMatchMime(pdf, DOCX_MIME)).toBe(false);
  });

  it.each(["application/x-msdownload", "application/octet-stream", "text/html", ""])(
    "rejects unknown MIME type %j even for valid bytes",
    (mime) => {
      expect(bytesMatchMime(pdf, mime)).toBe(false);
      expect(bytesMatchMime(Buffer.from("hello"), mime)).toBe(false);
    },
  );

  it("decodes data URLs before sniffing", () => {
    const bytes = decodeBase64(`data:application/pdf;base64,${pdf.toString("base64")}`);
    expect(bytesMatchMime(bytes, "application/pdf")).toBe(true);
  });
});
