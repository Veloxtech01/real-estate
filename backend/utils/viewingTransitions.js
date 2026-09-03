import ApiError from "./ApiError.js";

/**
 * The viewing lifecycle (§4.2).
 *
 * Six statuses with no rules would let a completed viewing revert to requested, which
 * corrupts the response-time metric and confuses the diary. The API is the only place
 * this can be guaranteed — an admin UI that hides a button is not enforcement.
 */

/**
 * Legal next states, keyed by current state.
 *
 * Terminal states map to an empty array rather than being omitted, so a lookup never
 * returns undefined and the "unknown status" branch stays genuinely exceptional.
 */
export const VIEWING_TRANSITIONS = {
  // A fresh request can go any way: agreed, declined, moved, or withdrawn.
  requested: ["accepted", "rejected", "rescheduled", "cancelled"],
  // A proposed new time is still awaiting an outcome.
  rescheduled: ["accepted", "rejected", "cancelled"],
  // Once agreed it either happens, moves again, or falls through.
  accepted: ["completed", "cancelled", "rescheduled"],
  // Final states. Reopening one would misrepresent what actually happened.
  rejected: [],
  completed: [],
  cancelled: [],
};

/** Whether a status admits no further transitions. */
export function isTerminal(status) {
  return (VIEWING_TRANSITIONS[status] ?? []).length === 0;
}

/**
 * Guard one status change.
 *
 * Takes: from (string) — the stored status; to (string) — the requested status.
 * Returns: nothing when the move is legal.
 * Throws: ApiError 400 naming both states when it is not.
 */
export function assertTransition(from, to) {
  // Re-applying the same status is idempotent, not an error — a double-clicked
  // Accept button must not surface a 400 to the user.
  if (from === to) return;

  const allowed = VIEWING_TRANSITIONS[from];

  // An unrecognised stored status means the data predates this table; fail loudly
  // rather than silently permitting the move.
  if (!allowed) {
    throw new ApiError(400, `Unknown viewing status "${from}"`);
  }

  if (!allowed.includes(to)) {
    throw new ApiError(400, `A ${from} viewing cannot be moved to ${to}.`);
  }
}
