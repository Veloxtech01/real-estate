import { describe, it, expect, vi } from "vitest";
import { mapApiErrors } from "./apiErrors";

/**
 * The rule this file enforces: the API is the authority on validation, so nothing it
 * rejects may be silently dropped by the form.
 */
describe("mapApiErrors", () => {
  const paths = ["title", "rent.agencyFeePct"];

  it("puts a nested detail on the field that owns it", () => {
    const setError = vi.fn();

    mapApiErrors(
      { "rent.agencyFeePct": "Agency fee cannot exceed 10% in Lagos" },
      setError,
      paths,
    );

    expect(setError).toHaveBeenCalledWith("rent.agencyFeePct", {
      type: "server",
      message: "Agency fee cannot exceed 10% in Lagos",
    });
  });

  it("returns messages with no matching field instead of losing them", () => {
    const setError = vi.fn();

    const unmatched = mapApiErrors(
      { "documents.0.url": "Invalid document URL", title: "Title is required" },
      setError,
      paths,
    );

    // The form has no input for this path, so it has to be said somewhere else.
    expect(unmatched).toEqual(["Invalid document URL"]);
    expect(setError).toHaveBeenCalledWith("title", expect.anything());
  });

  it("does nothing when the failure carried no details", () => {
    const setError = vi.fn();

    // A 403 or a network error has no field map; the caller shows error.message.
    expect(mapApiErrors(null, setError, paths)).toEqual([]);
    expect(setError).not.toHaveBeenCalled();
  });
});
