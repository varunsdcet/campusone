/** Links shown to users may only be absolute http(s) URLs or paths on this site (no javascript:, data:, //host). */
export function isSafeLink(value: string) {
  if (/^\/(?![/\\])/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const SAFE_LINK_MESSAGE = "Download URL must start with https://, http:// or / (a page on this site)";
