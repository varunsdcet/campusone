import { api, loadSession } from "@/lib/api";

export type UploadedLmsFile = { id: string; name: string; mime: string; size: number };

const MAX_BYTES = 8 * 1024 * 1024;

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadLmsFile(sectionId: string, file: File): Promise<UploadedLmsFile> {
  const session = loadSession();
  if (!session) throw new Error("Sign in again to upload files");
  if (file.size > MAX_BYTES) throw new Error("Files must be 8 MB or smaller");
  const base64 = await readAsBase64(file);
  return api<UploadedLmsFile>(
    "/lms-files",
    {
      method: "POST",
      body: JSON.stringify({ sectionId, name: file.name, mime: file.type || "application/octet-stream", base64 }),
    },
    session.accessToken,
  );
}

export async function downloadLmsFile(sectionId: string, fileId: string) {
  const session = loadSession();
  if (!session) throw new Error("Sign in again to download files");
  const file = await api<{ name: string; mime: string; base64: string }>(
    `/lms-files/${encodeURIComponent(sectionId)}/${encodeURIComponent(fileId)}`,
    {},
    session.accessToken,
  );
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime || "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name || "file";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatFileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
