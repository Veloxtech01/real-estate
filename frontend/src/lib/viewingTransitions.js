/**
 * Which viewing actions to offer, given the current status.
 *
 * This MIRRORS backend/utils/viewingTransitions.js, deliberately. The authority is
 * one-way: this copy decides which buttons render, the backend decides what is actually
 * allowed. If the two ever drift, the API returns 400 and the user sees that message.
 * Never treat this table as enforcement.
 */

export const VIEWING_TRANSITIONS = {
  requested: ["accepted", "rejected", "rescheduled", "cancelled"],
  rescheduled: ["accepted", "rejected", "cancelled"],
  accepted: ["completed", "cancelled", "rescheduled"],
  // Terminal — reopening one would misrepresent what happened.
  rejected: [],
  completed: [],
  cancelled: [],
};

/** Human labels for a status shown as a badge. */
export const STATUS_LABELS = {
  requested: "Requested",
  accepted: "Accepted",
  rescheduled: "Rescheduled",
  rejected: "Rejected",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Badge tone per status, matching the Badge component's vocabulary. */
export const STATUS_TONES = {
  requested: "accent",
  accepted: "success",
  rescheduled: "warning",
  rejected: "danger",
  completed: "muted",
  cancelled: "muted",
};

// The wording on the button that performs each transition. "Accepted" is a state;
// "Accept" is what the staff member is doing.
const ACTION_LABELS = {
  accepted: "Accept",
  rejected: "Decline",
  rescheduled: "Propose new time",
  cancelled: "Cancel",
  completed: "Mark completed",
};

// Destructive-looking outcomes get a quieter treatment than the primary action.
const ACTION_TONES = {
  accepted: "primary",
  completed: "primary",
  rescheduled: "secondary",
  rejected: "secondary",
  cancelled: "secondary",
};

/**
 * The actions to render for a viewing in the given status.
 *
 * @param {string} status
 * @returns {Array<{status: string, label: string, tone: string}>} empty for a terminal
 *   or unrecognised status.
 */
export function actionsFor(status) {
  return (VIEWING_TRANSITIONS[status] ?? []).map((next) => ({
    status: next,
    label: ACTION_LABELS[next],
    tone: ACTION_TONES[next],
  }));
}
