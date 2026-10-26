/** Detects a file's real type from its leading bytes so a renamed executable cannot pass as a PDF or image. */
export type SniffedKind = "png" | "jpeg" | "gif" | "webp" | "pdf" | "ole" | "zip" | "text" | "binary";

const startsWith = (buf: Buffer, sig: number[], offset = 0) => sig.every((b, i) => buf[offset + i] === b);

export function sniff(buf: Buffer): SniffedKind {
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "jpeg";
  if (buf.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (buf.subarray(0, 1024).toString("latin1").includes("%PDF-")) return "pdf";
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  const head = buf.subarray(0, 4096);
  if (startsWith(head, [0x4d, 0x5a]) || startsWith(head, [0x7f, 0x45, 0x4c, 0x46])) return "binary";
  return head.includes(0) ? "binary" : "text";
}

const MIME_KINDS: Array<[RegExp, SniffedKind[]]> = [
  [/^image\/png$/, ["png"]],
  [/^image\/jpe?g$/, ["jpeg"]],
  [/^image\/gif$/, ["gif"]],
  [/^image\/webp$/, ["webp"]],
  [/^application\/pdf$/, ["pdf"]],
  [/^application\/(msword|vnd\.ms-excel|vnd\.ms-powerpoint)$/, ["ole"]],
  [/^application\/vnd\.openxmlformats-officedocument\./, ["zip"]],
  [/^application\/(zip|x-zip-compressed)$/, ["zip"]],
  [/^text\/(plain|csv)$/, ["text"]],
];

/** True when the decoded bytes match the declared MIME type. Unknown MIME types never match. */
export function bytesMatchMime(buf: Buffer, mime: string): boolean {
  const rule = MIME_KINDS.find(([re]) => re.test(mime.toLowerCase()));
  return !!rule && rule[1].includes(sniff(buf));
}

export function decodeBase64(b64: string): Buffer {
  return Buffer.from(b64.replace(/^data:[^,]*,/, ""), "base64");
}
