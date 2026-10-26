import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { trustProxySetting } from "./clientIp.js";

describe("trustProxySetting", () => {
  it("trusts only private proxies by default and accepts hop counts", () => {
    expect(trustProxySetting(undefined)).toBe("loopback, linklocal, uniquelocal");
    expect(trustProxySetting("2")).toBe(2);
    expect(trustProxySetting("false")).toBe(false);
  });

  describe("req.ip behind the default setting", () => {
    let base = "";
    let close = () => {};
    beforeAll(async () => {
      const app = express();
      app.set("trust proxy", trustProxySetting(undefined));
      app.get("/ip", (req, res) => res.json({ ip: req.ip }));
      const server = app.listen(0, "127.0.0.1");
      await new Promise((resolve) => server.once("listening", resolve));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      close = () => server.close();
    });
    afterAll(() => close());

    it("ignores addresses the client prepended and uses the one the proxy saw", async () => {
      const res = await fetch(`${base}/ip`, { headers: { "x-forwarded-for": "198.51.100.52, 203.0.113.9, 10.0.0.5" } });
      expect(await res.json()).toEqual({ ip: "203.0.113.9" });
    });
  });
});
