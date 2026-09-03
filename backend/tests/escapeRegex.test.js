import { describe, it, expect } from "vitest";
import { escapeRegex, buildSearchRegex } from "../utils/escapeRegex.js";

describe("escapeRegex", () => {
  it("leaves ordinary text alone", () => {
    expect(escapeRegex("Lekki Phase 1")).toBe("Lekki Phase 1");
  });

  it("escapes every regex metacharacter", () => {
    expect(escapeRegex(".*+?^${}()|[]\\")).toBe(
      "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\",
    );
  });

  it("returns an empty string for a nullish input", () => {
    expect(escapeRegex(undefined)).toBe("");
    expect(escapeRegex(null)).toBe("");
  });
});

describe("buildSearchRegex", () => {
  it("matches case-insensitively", () => {
    expect(buildSearchRegex("lekki").test("Lekki Phase 1")).toBe(true);
  });

  it("treats a metacharacter as a literal rather than a pattern", () => {
    // Without escaping this matches everything, which is both wrong and a ReDoS risk.
    expect(buildSearchRegex(".*").test("anything")).toBe(false);
    expect(buildSearchRegex(".*").test("literally .* here")).toBe(true);
  });
});
