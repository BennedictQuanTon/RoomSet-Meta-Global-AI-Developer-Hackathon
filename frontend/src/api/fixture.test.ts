import { describe, expect, it } from "vitest";
import fixture from "../../../contracts/fixtures/scene.fixture.json";
import { assertSceneV1 } from "./contracts";

describe("shared scene fixture", () => {
  it("passes the browser contract check", () => {
    expect(() => assertSceneV1(fixture)).not.toThrow();
  });

  it("rejects a scene in the wrong units", () => {
    expect(() => assertSceneV1({ ...fixture, units: "centimeters" })).toThrow(/units/);
  });

  it("rejects an unknown provenance", () => {
    expect(() =>
      assertSceneV1({ ...fixture, provenance: { ...fixture.provenance, method: "magic" } }),
    ).toThrow(/provenance/);
  });
});
