import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const rules: Array<{ method: string; path: string; limit: number; windowMs: number; identity?: boolean }> = [
  { method: "POST", path: "/auth/forgot-password", limit: 5, windowMs: 15 * 60_000, identity: true },
  { method: "POST", path: "/auth/reset-password", limit: 10, windowMs: 15 * 60_000 },
  { method: "POST", path: "/selfpaced/register", limit: 5, windowMs: 60 * 60_000, identity: true },
];

function normalizedIdentity(req: Request) {
  const raw = req.body?.email ?? req.body?.studentNumber ?? "";
  return typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 200) : "";
}

/** Small process-local safety gate. Production edge/WAF limits may additionally be stricter. */
export function sensitiveEndpointRateLimit(req: Request, res: Response, next: NextFunction) {
  const rule = rules.find((candidate) => candidate.method === req.method && candidate.path === req.path);
  if (!rule) return next();
  const now = Date.now();
  const key = `${rule.method}:${rule.path}:${req.ip || "unknown"}:${rule.identity ? normalizedIdentity(req) : ""}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + rule.windowMs } : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  if (buckets.size > 20_000) {
    for (const [candidate, value] of buckets) if (value.resetAt <= now) buckets.delete(candidate);
  }
  res.setHeader("RateLimit-Limit", String(rule.limit));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, rule.limit - bucket.count)));
  res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count <= rule.limit) return next();
  res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
  return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait and try again." } });
}

export function clearRateLimitBucketsForTest() {
  buckets.clear();
}
