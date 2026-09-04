/**
 * Maps an API validation failure onto react-hook-form fields.
 *
 * The backend flattens a Mongoose ValidationError into `{ "rent.agencyFeePct": "…" }`
 * — dotted paths that happen to match react-hook-form's own field naming, so most
 * messages can land directly on the input that caused them.
 *
 * The client's own rules are a convenience; the server is the authority (it is the
 * only place the statutory rent limits are enforced). So anything the server rejects
 * that the form has no field for must still be shown, never swallowed — that is what
 * the return value is for.
 */

/**
 * Routes each `details` entry to its field, and collects the ones with nowhere to go.
 *
 * Takes: details (object|null) — the API's field-path → message map;
 *        setError (function) — react-hook-form's setError;
 *        knownPaths (string[]) — the field names the form actually registered.
 * Returns: an array of messages that matched no field, for a form-level banner.
 */
export function mapApiErrors(details, setError, knownPaths = []) {
  if (!details || typeof details !== "object") return [];

  const known = new Set(knownPaths);
  const unmatched = [];

  for (const [path, message] of Object.entries(details)) {
    if (known.has(path)) {
      // shouldFocus is left off: focusing jumps the page to a collapsed section, and
      // the section nav already shows where the errors are.
      setError(path, { type: "server", message });
    } else {
      // A server rule the form doesn't model — the Lagos rent cap firing on a field
      // combination the client didn't check, say. Surfaced verbatim rather than lost.
      unmatched.push(message);
    }
  }

  return unmatched;
}

export default mapApiErrors;
