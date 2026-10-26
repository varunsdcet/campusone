import { describe, expect, it } from "vitest";

import { rawRegistry, screenSchema, screenSchemas } from "./registry.js";

describe("heritage screen registry", () => {
  it("loads heritage-master.json and builds a schema for every screen", () => {
    const screens = rawRegistry().screens;
    expect(screens.length).toBeGreaterThan(200);
    expect(screenSchemas().size).toBe(screens.length);
  });

  it("resolves generic admin screens by id", () => {
    for (const id of ["F07", "G01", "R01", "SF01"]) expect(screenSchema(id)?.id).toBe(id);
  });
});
