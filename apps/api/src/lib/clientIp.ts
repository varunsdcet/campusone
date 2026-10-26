/**
 * Express `trust proxy` value. By default only proxies on private or loopback addresses (the host reverse
 * proxy and the web container's /__api rewrite) may name the client, so a client-supplied X-Forwarded-For
 * cannot change `req.ip`. Set TRUST_PROXY to a hop count or an address list when a public CDN sits in front.
 */
export function trustProxySetting(raw: string | undefined): number | string | boolean {
  const value = raw?.trim();
  if (!value) return "loopback, linklocal, uniquelocal";
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}
