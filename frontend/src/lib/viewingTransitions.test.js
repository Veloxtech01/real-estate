import { describe, it, expect } from "vitest";
import { VIEWING_TRANSITIONS, actionsFor, STATUS_LABELS } from "./viewingTransitions";

describe("VIEWING_TRANSITIONS", () => {
  // These sets are asserted literally rather than derived, so a drift from the backend
  // table fails loudly here instead of silently rendering a button the API rejects.
  it("matches the backend table exactly", () => {
    expect(VIEWING_TRANSITIONS).toEqual({
      requested: ["accepted", "rejected", "rescheduled", "cancelled"],
      rescheduled: ["accepted", "rejected", "cancelled"],
      accepted: ["completed", "cancelled", "rescheduled"],
      rejected: [],
      completed: [],
      cancelled: [],
    });
  });
});

describe("actionsFor", () => {
  it("offers every legal move from requested", () => {
    const statuses = actionsFor("requested").map((action) => action.status);
    expect(statuses).toEqual(["accepted", "rejected", "rescheduled", "cancelled"]);
  });

  it("offers nothing for a terminal status", () => {
    expect(actionsFor("completed")).toEqual([]);
    expect(actionsFor("rejected")).toEqual([]);
    expect(actionsFor("cancelled")).toEqual([]);
  });

  it("gives every action a human label", () => {
    for (const action of actionsFor("requested")) {
      expect(action.label).toBeTruthy();
      expect(action.label).not.toContain("_");
    }
  });

  it("returns nothing for an unknown status rather than throwing", () => {
    expect(actionsFor("abducted")).toEqual([]);
  });
});

describe("STATUS_LABELS", () => {
  it("labels every status in the table", () => {
    for (const status of Object.keys(VIEWING_TRANSITIONS)) {
      expect(STATUS_LABELS[status]).toBeTruthy();
    }
  });
});
