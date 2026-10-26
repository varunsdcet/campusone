import { afterEach, describe, expect, it, vi } from "vitest";
import { xttsConfig } from "./xttsSpeech";

describe("xttsConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("stays disabled until the model licence has been accepted", () => {
    vi.stubEnv("XTTS_URL", "http://xtts.internal:8020");
    vi.stubEnv("XTTS_LICENSE_ACCEPTED", "0");
    expect(xttsConfig()).toBeNull();
  });

  it("returns configured servers after explicit acceptance", () => {
    vi.stubEnv("XTTS_URL", "http://one:8020/, http://two:8020");
    vi.stubEnv("XTTS_LICENSE_ACCEPTED", "true");
    expect(xttsConfig()).toEqual({ urls: ["http://one:8020", "http://two:8020"] });
  });
});
