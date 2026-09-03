/**
 * Deterministic parser for Nigerian property search phrases (§5.4).
 *
 * This runs **before** the language model, and for most real queries it removes the
 * need to call one at all. That matters for three reasons §5.6 spells out: a public
 * search box calling a model on every keystroke is an uncapped bill, a regex cannot
 * hallucinate, and "₦100m" parses identically every single time.
 *
 * Scope is deliberately lexical — prices, intent, counts, property types, title
 * types. Locations and amenities are matched against the database vocabulary
 * elsewhere (resolveFilters), because those are client-populated content, not
 * language rules.
 */

/** Word numbers, enough to cover how prices are actually written out. */
const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

/** Multiplier suffixes. "k" is used for monthly rents, "m"/"b" for sale prices. */
const MULTIPLIERS = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

/**
 * Property-type phrases mapped to the canonical enum.
 *
 * Ordered longest-first at match time, so "semi detached duplex" resolves to
 * semi_detached rather than matching the "detached" substring inside it.
 */
const PROPERTY_TYPE_PHRASES = {
  "room and parlour": "room_and_parlour",
  "room and parlor": "room_and_parlour",
  "self contained": "self_contained",
  "self contain": "self_contained",
  "self con": "self_contained",
  selfcon: "self_contained",
  "mini flat": "mini_flat",
  miniflat: "mini_flat",
  "semi detached": "semi_detached",
  "semi-detached": "semi_detached",
  "boys quarters": "boys_quarters",
  "terraced": "terrace",
  terrace: "terrace",
  detached: "detached",
  bungalow: "bungalow",
  penthouse: "penthouse",
  duplex: "duplex",
  apartment: "apartment",
  flat: "apartment",
  warehouse: "commercial",
  commercial: "commercial",
  office: "commercial",
  shop: "commercial",
  land: "land",
  plot: "land",
};

/** Land title phrases (§5.4 "title and land"). */
const TITLE_PHRASES = {
  "certificate of occupancy": "c_of_o",
  "c of o": "c_of_o",
  "c-of-o": "c_of_o",
  cofo: "c_of_o",
  "governors consent": "governors_consent",
  "governor's consent": "governors_consent",
  "deed of assignment": "deed_of_assignment",
  "registered survey": "registered_survey",
  excision: "excision",
  gazette: "gazette",
};

/**
 * Listing intent. "To let" is the ordinary Nigerian phrasing for rent and **must**
 * map correctly — a visitor searching "2 bedroom to let" who is shown properties for
 * sale has been failed by the search (§5.4).
 */
const RENT_PHRASES = ["to let", "for rent", "renting", "rental", "lease", "yearly rent"];
const SALE_PHRASES = ["for sale", "to buy", "buying", "up for grabs", "outright purchase"];

/**
 * Normalises a phrase for parsing and cache lookup.
 *
 * Takes: phrase (string).
 * Returns: lowercase, punctuation-lightened, whitespace-collapsed text. Currency
 *          symbols are preserved because they carry meaning.
 */
export function normalizePhrase(phrase) {
  return String(phrase ?? "")
    .toLowerCase()
    .replace(/[,]/g, "")
    .replace(/[^\w\s₦$'.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts a written-out number to a value, e.g. "one hundred" -> 100.
 *
 * Takes: words (string[]).
 * Returns: the number, or null when the words aren't a number.
 */
function wordsToNumber(words) {
  let total = 0;
  let current = 0;
  let matched = false;

  for (const word of words) {
    if (WORD_NUMBERS[word] !== undefined) {
      current += WORD_NUMBERS[word];
      matched = true;
    } else if (word === "hundred") {
      // "one hundred" -> 100; a bare "hundred" means 100.
      current = (current || 1) * 100;
      matched = true;
    } else {
      break;
    }
  }

  total += current;
  return matched ? total : null;
}

/**
 * Extracts every money amount in a phrase.
 *
 * Handles the forms Nigerian listings actually use (§5.4): "100m", "₦100m",
 * "N100 million", "one hundred million", "100k per month", "1.5m".
 *
 * Takes: phrase (string) — already normalised.
 * Returns: an array of { value, currency, index } in order of appearance.
 */
export function extractAmounts(phrase) {
  const amounts = [];

  // Digit form: optional currency mark, number, optional multiplier word/letter.
  const digitPattern = /(₦|\$|\bn(?=\d))?\s?(\d+(?:\.\d+)?)\s*(k|m|b|thousand|million|billion)?\b/gi;

  let match;
  while ((match = digitPattern.exec(phrase)) !== null) {
    const [full, symbol, digits, suffix] = match;
    const multiplier = suffix ? MULTIPLIERS[suffix.toLowerCase()] : 1;

    // A bare small number with no currency mark or multiplier is far more likely a
    // bedroom count than a price ("3 bedroom"), so it isn't treated as money.
    if (!symbol && !suffix) continue;

    amounts.push({
      value: Number(digits) * multiplier,
      // Dollar figures appear in high-end Lagos and Abuja stock (§8.2); naira is the
      // default everywhere else.
      currency: symbol === "$" ? "USD" : "NGN",
      index: match.index,
      text: full.trim(),
    });
  }

  // Written form: "one hundred million".
  const words = phrase.split(" ");
  for (let i = 0; i < words.length; i += 1) {
    const suffixIndex = words.findIndex(
      (word, j) => j > i && MULTIPLIERS[word] !== undefined
    );
    if (suffixIndex === -1) continue;

    const value = wordsToNumber(words.slice(i, suffixIndex));
    if (value === null) continue;

    amounts.push({
      value: value * MULTIPLIERS[words[suffixIndex]],
      currency: "NGN",
      index: phrase.indexOf(words[i]),
      text: words.slice(i, suffixIndex + 1).join(" "),
    });

    i = suffixIndex;
  }

  return amounts.sort((a, b) => a.index - b.index);
}

/**
 * Parses a search phrase into structured filters.
 *
 * Takes: rawPhrase (string).
 * Returns: { filters, matchedTerms, dimensions } where `dimensions` counts how many
 *          distinct constraints were understood — the caller uses it to decide
 *          whether a model call is warranted at all.
 */
export function parseNigerianPhrase(rawPhrase) {
  const phrase = normalizePhrase(rawPhrase);
  const filters = {};
  const matchedTerms = [];

  if (!phrase) return { filters, matchedTerms, dimensions: 0 };

  // --- Listing intent ----------------------------------------------------------
  if (RENT_PHRASES.some((term) => phrase.includes(term))) {
    filters.listingType = "rent";
    matchedTerms.push("listingType");
  } else if (SALE_PHRASES.some((term) => phrase.includes(term))) {
    filters.listingType = "sale";
    matchedTerms.push("listingType");
  }

  // --- Property type -----------------------------------------------------------
  // Longest phrase first, so compound types win over their own substrings.
  const typePhrases = Object.keys(PROPERTY_TYPE_PHRASES).sort((a, b) => b.length - a.length);
  const foundType = typePhrases.find((term) => phrase.includes(term));
  if (foundType) {
    filters.propertyType = PROPERTY_TYPE_PHRASES[foundType];
    matchedTerms.push("propertyType");
  }

  // --- Land title --------------------------------------------------------------
  const titlePhrases = Object.keys(TITLE_PHRASES).sort((a, b) => b.length - a.length);
  const foundTitle = titlePhrases.find((term) => phrase.includes(term));
  if (foundTitle) {
    filters.titleType = TITLE_PHRASES[foundTitle];
    matchedTerms.push("titleType");
  }

  // --- Bedrooms / bathrooms ----------------------------------------------------
  // Digit or written form: "3 bedroom", "three bedroom", "3 bed", "3bdrm".
  const bedroomMatch = /(\d+)\s*(?:bed|bedroom|bedrooms|bdrm|br)\b/.exec(phrase);
  if (bedroomMatch) {
    filters.bedroomsMin = Number(bedroomMatch[1]);
    matchedTerms.push("bedrooms");
  } else {
    const wordBedroom = new RegExp(
      `\\b(${Object.keys(WORD_NUMBERS).join("|")})\\s*(?:bed|bedroom|bedrooms)\\b`
    ).exec(phrase);
    if (wordBedroom) {
      filters.bedroomsMin = WORD_NUMBERS[wordBedroom[1]];
      matchedTerms.push("bedrooms");
    }
  }

  const bathroomMatch = /(\d+)\s*(?:bath|bathroom|bathrooms)\b/.exec(phrase);
  if (bathroomMatch) {
    filters.bathroomsMin = Number(bathroomMatch[1]);
    matchedTerms.push("bathrooms");
  }

  // --- Price -------------------------------------------------------------------
  const amounts = extractAmounts(phrase);

  if (amounts.length) {
    const hasUpperBound = /\b(under|below|less than|max|maximum|up to|within|budget of)\b/.test(phrase);
    const hasLowerBound = /\b(above|over|more than|min|minimum|from|starting at)\b/.test(phrase);
    const isRange = /\bbetween\b/.test(phrase) || (amounts.length >= 2 && /\b(to|and|-)\b/.test(phrase));

    if (isRange && amounts.length >= 2) {
      filters.priceMin = Math.min(amounts[0].value, amounts[1].value);
      filters.priceMax = Math.max(amounts[0].value, amounts[1].value);
    } else if (hasLowerBound && !hasUpperBound) {
      filters.priceMin = amounts[0].value;
    } else {
      // Default to an upper bound. A visitor naming one figure is almost always
      // stating a budget ceiling, not a floor.
      filters.priceMax = amounts[0].value;
    }

    if (amounts[0].currency === "USD") filters.currency = "USD";
    matchedTerms.push("price");
  }

  return { filters, matchedTerms, dimensions: matchedTerms.length };
}
