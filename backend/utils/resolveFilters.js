import Location from "../model/locationModel.js";
import LocationAlias from "../model/locationAliasModel.js";
import Taxonomy from "../model/taxonomyModel.js";

/**
 * Resolves human-facing filter values into database ids.
 *
 * This is the whitelist boundary described in §5.2 step 4: locations must exist in
 * the locations table and amenities must exist in the taxonomy, and **anything
 * unrecognised is discarded, not passed through**. Both the filter panel (which sends
 * slugs) and the AI search (which sends names the model produced) come through here,
 * so neither can introduce a value the database has never heard of.
 */

/**
 * Resolves location names, slugs or aliases to Location ids.
 *
 * Takes: values (string | string[]) — slugs ("lekki-phase-1"), display names
 *        ("Lekki Phase 1") or informal aliases ("VI", "lekki phase one").
 * Returns: a promise resolving to { ids, matched, unmatched } — `unmatched` lets the
 *          caller tell a visitor which part of their phrase was not understood
 *          rather than silently returning unrelated results.
 */
export async function resolveLocations(values) {
  const inputs = []
    .concat(values ?? [])
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  if (!inputs.length) return { ids: [], matched: [], unmatched: [] };

  const lowered = inputs.map((value) => value.toLowerCase());

  // Match a canonical record by slug or name first — the common case for the filter
  // panel, which sends slugs it got from this API.
  const direct = await Location.find({
    $or: [{ slug: { $in: lowered } }, { name: { $in: inputs } }],
  });

  const matchedInputs = new Set();
  const byId = new Map();

  for (const location of direct) {
    byId.set(String(location._id), location);
    matchedInputs.add(location.slug.toLowerCase());
    matchedInputs.add(location.name.toLowerCase());
  }

  // Anything still unmatched goes through the alias table (§5.4) — "VI", "phase 1",
  // misspellings. This is content the client populates, not logic we can infer.
  const remaining = lowered.filter((value) => !matchedInputs.has(value));

  if (remaining.length) {
    const aliases = await LocationAlias.find({ alias: { $in: remaining } }).populate(
      "location"
    );

    for (const alias of aliases) {
      // A dangling alias (its location was deleted) resolves to nothing and must not
      // produce an undefined id in the query.
      if (!alias.location) continue;

      byId.set(String(alias.location._id), alias.location);
      matchedInputs.add(alias.alias);
    }
  }

  /**
   * Last resort: match the leading segments of a slug.
   *
   * Canonical slugs carry a state suffix to stay unique across states ("GRA" exists
   * in more than one), so a visitor or a link using the bare area name —
   * "lekki-phase-1" rather than "lekki-phase-1-lagos" — would otherwise resolve to
   * nothing. Anchored so "gra" cannot match "old-gra", and an ambiguous input
   * legitimately resolves to every state's version, which the returned chips show.
   */
  const stillUnmatched = lowered.filter((value) => !matchedInputs.has(value));

  if (stillUnmatched.length) {
    const patterns = stillUnmatched.map((value) => {
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`^${escaped}(-|$)`);
    });

    const prefixed = await Location.find({ slug: { $in: patterns } });

    for (const location of prefixed) {
      byId.set(String(location._id), location);

      // Record which input matched, so it isn't reported back as unmatched.
      for (const value of stillUnmatched) {
        if (location.slug === value || location.slug.startsWith(`${value}-`)) {
          matchedInputs.add(value);
        }
      }
    }
  }

  const unmatched = inputs.filter(
    (value) => !matchedInputs.has(value.toLowerCase())
  );

  return {
    ids: [...byId.keys()],
    matched: [...byId.values()].map((l) => ({
      id: String(l._id),
      name: l.name,
      slug: l.slug,
      state: l.state,
    })),
    unmatched,
  };
}

/**
 * Escapes a string for safe use inside a regular expression.
 *
 * Vocabulary comes from the database, where a client could legitimately name an
 * area "GRA (Phase 2)" — unescaped, that would be a malformed pattern.
 *
 * Takes: value (string).
 * Returns: the escaped string.
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds known locations mentioned anywhere in a free-text phrase.
 *
 * The phrase parser handles language rules (prices, "to let", property types) but
 * cannot know place names — those are client-populated content. Scanning the phrase
 * against the locations table and its aliases closes that gap **without a model
 * call**, which matters because AI search is off by default and capped by spend
 * (§5.6): "3 bedroom flat in Lekki" must still find Lekki when the model never runs.
 *
 * Takes: phrase (string).
 * Returns: a promise resolving to { ids, matched }.
 */
export async function matchLocationsInPhrase(phrase) {
  const text = String(phrase ?? "").toLowerCase();
  if (!text) return { ids: [], matched: [] };

  const [locations, aliases] = await Promise.all([
    // State is included so a zero-result search can widen to the surrounding state
    // rather than dropping location entirely (§5.5).
    Location.find({}).select("name slug state").lean(),
    LocationAlias.find({})
      .select("alias location")
      .populate("location", "name slug state")
      .lean(),
  ]);

  /**
   * Leading-word prefixes of a multi-word area name.
   *
   * Nigerian areas are commonly named by their umbrella rather than their full
   * designation: people search "Lekki", not "Lekki Phase 1", and "Ikeja" rather than
   * "Ikeja GRA". Without this, the most common search term in Lagos matches nothing
   * and the visitor is shown listings in another state entirely.
   *
   * Prefixes shorter than four characters are skipped, so generic leaders like
   * "Old" in "Old GRA" and "New" in "New Haven" can't hijack a phrase.
   *
   * Takes: name (string).
   * Returns: an array of lowercase prefix terms (empty for single-word names).
   */
  function namePrefixes(name) {
    const words = name.toLowerCase().split(/\s+/);
    if (words.length < 2) return [];

    const prefixes = [];
    for (let count = 1; count < words.length; count += 1) {
      const prefix = words.slice(0, count).join(" ");
      if (prefix.length >= 4) prefixes.push(prefix);
    }

    return prefixes;
  }

  const candidates = [
    ...locations.map((l) => ({ term: l.name.toLowerCase(), location: l })),
    ...aliases
      .filter((a) => a.location)
      .map((a) => ({ term: a.alias.toLowerCase(), location: a.location })),
    // Prefixes last, so an exact name or alias is preferred when both could match.
    ...locations.flatMap((l) => namePrefixes(l.name).map((term) => ({ term, location: l }))),
  ];

  /**
   * Group by term before matching.
   *
   * An umbrella term maps to several areas — "Lekki" covers Lekki Phase 1 and any
   * other Lekki area the client adds — so a term must contribute *all* of its
   * locations. Matching one at a time and consuming the text would silently return
   * only whichever happened to be checked first.
   */
  const byTerm = new Map();
  for (const { term, location } of candidates) {
    if (!byTerm.has(term)) byTerm.set(term, []);
    byTerm.get(term).push(location);
  }

  // Longest term first, so "Lekki Phase 1" is tried before a bare "Lekki" and the
  // more specific request wins.
  const terms = [...byTerm.keys()].sort((a, b) => b.length - a.length);

  const byId = new Map();
  let remaining = text;

  for (const term of terms) {
    // Word boundaries stop "gra" matching inside "programme" — a substring match
    // here would attach listings to an area the visitor never mentioned.
    const pattern = new RegExp(`(^|\\W)${escapeRegex(term)}($|\\W)`);
    if (!pattern.test(remaining)) continue;

    for (const location of byTerm.get(term)) {
      byId.set(String(location._id), location);
    }

    // Consume the match so an overlapping shorter term can't also fire.
    remaining = remaining.replace(pattern, " ");
  }

  return {
    ids: [...byId.keys()],
    matched: [...byId.values()].map((l) => ({
      id: String(l._id),
      name: l.name,
      slug: l.slug,
      state: l.state,
    })),
  };
}

/**
 * Finds known amenities mentioned anywhere in a free-text phrase.
 *
 * Same reasoning as matchLocationsInPhrase — "with parking and a pool" should work
 * with no model call.
 *
 * Takes: phrase (string).
 * Returns: a promise resolving to { ids, matched }.
 */
export async function matchAmenitiesInPhrase(phrase) {
  const text = String(phrase ?? "").toLowerCase();
  if (!text) return { ids: [], matched: [] };

  const terms = await Taxonomy.find({ isActive: true })
    .select("key name category aliases")
    .lean();

  const byId = new Map();

  for (const term of terms) {
    // Match the label or any alias; the key itself ("swimming_pool") is a machine
    // form nobody types.
    const phrases = [term.name.toLowerCase(), ...(term.aliases ?? [])];

    const found = phrases.some((candidate) =>
      new RegExp(`(^|\\W)${escapeRegex(candidate)}($|\\W)`).test(text)
    );

    if (found) byId.set(String(term._id), term);
  }

  return {
    ids: [...byId.keys()],
    matched: [...byId.values()].map((term) => ({
      id: String(term._id),
      key: term.key,
      name: term.name,
      category: term.category,
    })),
  };
}

/**
 * Resolves amenity keys, names or aliases to Taxonomy ids.
 *
 * Takes: values (string | string[]) — keys ("swimming_pool"), labels ("Swimming
 *        pool") or aliases ("pool").
 * Returns: a promise resolving to { ids, matched, unmatched }.
 */
export async function resolveAmenities(values) {
  const inputs = []
    .concat(values ?? [])
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  if (!inputs.length) return { ids: [], matched: [], unmatched: [] };

  const lowered = inputs.map((value) => value.toLowerCase());

  // One query covering all three ways a term can be named. Inactive terms are
  // excluded so a retired amenity can't be filtered on.
  const terms = await Taxonomy.find({
    isActive: true,
    $or: [
      { key: { $in: lowered } },
      { name: { $in: inputs } },
      { aliases: { $in: lowered } },
    ],
  });

  const matchedInputs = new Set();
  for (const term of terms) {
    matchedInputs.add(term.key);
    matchedInputs.add(term.name.toLowerCase());
    for (const alias of term.aliases) matchedInputs.add(alias);
  }

  const unmatched = inputs.filter((value) => !matchedInputs.has(value.toLowerCase()));

  return {
    ids: terms.map((term) => String(term._id)),
    matched: terms.map((term) => ({
      id: String(term._id),
      key: term.key,
      name: term.name,
      category: term.category,
    })),
    unmatched,
  };
}
