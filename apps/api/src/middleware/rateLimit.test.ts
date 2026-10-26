import { describe, expect, it, vi, beforeEach } from "vitest";
import { clearRateLimitBucketsForTest, sensitiveEndpointRateLimit } from "./rateLimit.js";

describe("sensitiveEndpointRateLimit", () => {
  beforeEach(clearRateLimitBucketsForTest);

  it("does not rate-limit login attempts", () => {
    const req = { method: "POST", path: "/auth/login", ip: "203.0.113.1", body: { email: "USER@example.test" } } as never;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = { setHeader: vi.fn(), status, json } as never;
    const next = vi.fn();
    for (let i = 0; i < 20; i += 1) sensitiveEndpointRateLimit(req, res, next);
    expect(next).toHaveBeenCalledTimes(20);
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it("continues to protect password recovery", () => {
    const req = { method: "POST", path: "/auth/forgot-password", ip: "203.0.113.1", body: { email: "USER@example.test" } } as never;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = { setHeader: vi.fn(), status, json } as never;
    const next = vi.fn();
    for (let i = 0; i < 5; i += 1) sensitiveEndpointRateLimit(req, res, next);
    sensitiveEndpointRateLimit(req, res, next);
    expect(next).toHaveBeenCalledTimes(5);
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: "RATE_LIMITED" }) }));
  });

  it("does not rate-limit unrelated routes", () => {
    const next = vi.fn();
    sensitiveEndpointRateLimit({ method: "GET", path: "/health" } as never, {} as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
