import { describe, it, expect } from "vitest";
import {
  VIEWING_TRANSITIONS,
  isTerminal,
  assertTransition,
} from "../utils/viewingTransitions.js";
import { VIEWING_STATUSES } from "../utils/constants.js";

describe("VIEWING_TRANSITIONS", () => {
  it("covers every status in the schema enum", () => {
    // A status with no entry would throw on any transition attempt.
    for (const status of VIEWING_STATUSES) {
      expect(VIEWING_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("never allows a move to a status outside the enum", () => {
    for (const targets of Object.values(VIEWING_TRANSITIONS)) {
      for (const target of targets) {
        expect(VIEWING_STATUSES).toContain(target);
      }
    }
  });
});

describe("isTerminal", () => {
  it("treats rejected, completed and cancelled as final", () => {
    expect(isTerminal("rejected")).toBe(true);
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
  });

  it("treats live states as non-final", () => {
    expect(isTerminal("requested")).toBe(false);
    expect(isTerminal("accepted")).toBe(false);
    expect(isTerminal("rescheduled")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("allows every legal move from requested", () => {
    for (const target of ["accepted", "rejected", "rescheduled", "cancelled"]) {
      expect(() => assertTransition("requested", target)).not.toThrow();
    }
  });

  it("allows an accepted viewing to complete, cancel or reschedule", () => {
    for (const target of ["completed", "cancelled", "rescheduled"]) {
      expect(() => assertTransition("accepted", target)).not.toThrow();
    }
  });

  it("allows a rescheduled viewing to be accepted, rejected or cancelled", () => {
    for (const target of ["accepted", "rejected", "cancelled"]) {
      expect(() => assertTransition("rescheduled", target)).not.toThrow();
    }
  });

  it("refuses to move a completed viewing back to requested", () => {
    expect(() => assertTransition("completed", "requested")).toThrowError(
      /completed.*requested/i,
    );
  });

  it("refuses to reopen a cancelled or rejected viewing", () => {
    expect(() => assertTransition("cancelled", "accepted")).toThrow();
    expect(() => assertTransition("rejected", "accepted")).toThrow();
  });

  it("treats re-applying the current status as a no-op, not an error", () => {
    // A double-clicked Accept button must not produce a 400.
    expect(() => assertTransition("accepted", "accepted")).not.toThrow();
    expect(() => assertTransition("completed", "completed")).not.toThrow();
  });

  it("throws a 400, not a 500", () => {
    try {
      assertTransition("completed", "requested");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error.statusCode).toBe(400);
    }
  });
});
