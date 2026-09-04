/**
 * Translation between the listing editor's form values and the API's property shape.
 *
 * Kept out of the components for two reasons: the conversions are the part most worth
 * testing (a wrong land-unit factor silently mis-stores an area), and the form is
 * assembled from nine section components that should only have to know their fields.
 *
 * Field names deliberately mirror the API's nested paths (`rent.agencyFeePct`), which
 * react-hook-form supports directly. That is what lets a server validation error land
 * on the exact input that caused it — see lib/apiErrors.js.
 *
 * Fields the form needs but the API doesn't take are prefixed with an underscore and
 * stripped on submit.
 */

/**
 * Coerces a form value to a number, treating blank as "not provided".
 *
 * Number("") is 0, which would publish a free property. Empty must stay undefined so
 * the field is simply absent from the payload.
 *
 * Takes: value (any).
 * Returns: a number, or undefined when blank/unparseable.
 */
function num(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Reads an id off a field that may be populated or may be a bare id.
 *
 * The detail endpoint populates `location` and `agent`; a freshly saved record returns
 * them as ids. Both have to load into the same select.
 *
 * Takes: value (object|string|null).
 * Returns: the id as a string, or "".
 */
function idOf(value) {
  if (!value) return "";
  return typeof value === "object" ? String(value._id ?? "") : String(value);
}

/**
 * Converts a land area into square metres, the only unit the model stores.
 *
 * Factors come from the API (`landUnits`), never from a constant here: a "plot" is
 * ~648 sqm generally but ~464 sqm in parts of Lagos, so a stale client copy would
 * store the wrong area with no visible symptom.
 *
 * Takes: value (number|string), unit (string), factors (object) from the reference call.
 * Returns: the area in square metres rounded to 2dp, or undefined when blank.
 * Throws: Error when the unit isn't in the served table — better than silently
 *         treating an unknown unit as square metres.
 */
export function toSquareMetres(value, unit, factors) {
  const amount = num(value);
  if (amount === undefined) return undefined;

  const factor = factors?.[unit];
  if (!factor) throw new Error(`Unknown land unit: ${unit}`);

  return Math.round(amount * factor * 100) / 100;
}

/** The defaults a brand-new listing opens with. */
export const BLANK_LISTING = {
  title: "",
  description: "",
  listingType: "sale",
  propertyType: "",
  status: "available",
  publicationState: "draft",
  agent: "",
  location: "",
  landmark: "",
  address: "",
  _lat: "",
  _lng: "",
  bedrooms: "",
  bathrooms: "",
  toilets: "",
  boysQuarters: "",
  parkingSpaces: "",
  _landSizeValue: "",
  // Square metres is the storage unit, so it is also the default input unit — the
  // conversion only happens when someone deliberately picks plots or acres.
  _landSizeUnit: "sqm",
  builtAreaSqm: "",
  yearBuilt: "",
  price: { amount: "", currency: "NGN", isNegotiable: false, onRequest: false },
  rent: {
    amount: "",
    period: "per_annum",
    advanceYears: 1,
    agencyFeePct: "",
    legalFeePct: "",
    cautionDeposit: "",
    serviceCharge: "",
    serviceChargePeriod: "",
  },
  landTitle: {
    type: "",
    gazetteNumber: "",
    freeFromGovernmentAcquisition: false,
    surveyPlanAvailable: false,
  },
  infrastructure: {
    power: [],
    water: [],
    metering: "",
    floodRisk: "",
    hasFloodHistory: false,
    roadCondition: "",
    distanceToTarredRoadM: "",
    isGatedEstate: false,
    estateName: "",
  },
  tags: [],
  coverImage: "",
  floorPlan: "",
  metaTitle: "",
  metaDescription: "",
  ogImage: "",
};

/**
 * Loads an API property into form values.
 *
 * Takes: property (object|null) — null for a create.
 * Returns: a react-hook-form defaultValues object.
 */
export function toFormValues(property) {
  if (!property) return structuredClone(BLANK_LISTING);

  const blank = structuredClone(BLANK_LISTING);
  // GeoJSON stores [longitude, latitude]; the form shows latitude first, as everyone
  // writes and reads coordinates in that order.
  const [lng, lat] = property.coordinates?.coordinates ?? [];

  return {
    ...blank,
    ...property,
    listingType: property.listingType ?? blank.listingType,
    status: property.status ?? blank.status,
    publicationState: property.publicationState ?? blank.publicationState,
    agent: idOf(property.agent),
    location: idOf(property.location),
    description: property.description ?? "",
    address: property.address ?? "",
    _lat: lat ?? "",
    _lng: lng ?? "",
    bedrooms: property.bedrooms ?? "",
    bathrooms: property.bathrooms ?? "",
    toilets: property.toilets ?? "",
    boysQuarters: property.boysQuarters ?? "",
    parkingSpaces: property.parkingSpaces ?? "",
    // Always shown back in square metres. Re-deriving the original unit is guesswork,
    // and showing 648 sqm as "1 plot" would be wrong for a Lagos listing.
    _landSizeValue: property.landSizeSqm ?? "",
    _landSizeUnit: "sqm",
    builtAreaSqm: property.builtAreaSqm ?? "",
    yearBuilt: property.yearBuilt ?? "",
    price: { ...blank.price, ...property.price },
    rent: { ...blank.rent, ...property.rent },
    landTitle: { ...blank.landTitle, ...property.landTitle },
    infrastructure: { ...blank.infrastructure, ...property.infrastructure },
    tags: (property.tags ?? []).map(idOf),
    coverImage: idOf(property.coverImage),
    floorPlan: property.floorPlan ?? "",
    metaTitle: property.metaTitle ?? "",
    metaDescription: property.metaDescription ?? "",
    ogImage: property.ogImage ?? "",
  };
}

/**
 * Builds the API payload from form values.
 *
 * Takes: values (object) — react-hook-form's output;
 *        options.landUnits (object) — the served unit → sqm factors;
 *        options.isAdministrator (boolean) — whether to send the agent assignment.
 * Returns: the request body for POST/PATCH /api/admin/properties.
 */
export function toApiPayload(values, { landUnits, isAdministrator = false } = {}) {
  const isRent = values.listingType === "rent";

  const payload = {
    title: values.title,
    description: values.description || undefined,
    listingType: values.listingType,
    propertyType: values.propertyType,
    status: values.status,
    publicationState: values.publicationState,

    location: values.location,
    landmark: values.landmark,
    address: values.address || undefined,

    bedrooms: num(values.bedrooms),
    bathrooms: num(values.bathrooms),
    toilets: num(values.toilets),
    boysQuarters: num(values.boysQuarters),
    parkingSpaces: num(values.parkingSpaces),
    landSizeSqm: toSquareMetres(values._landSizeValue, values._landSizeUnit, landUnits),
    builtAreaSqm: num(values.builtAreaSqm),
    yearBuilt: num(values.yearBuilt),

    tags: values.tags ?? [],
    coverImage: values.coverImage || undefined,
    floorPlan: values.floorPlan || undefined,
    metaTitle: values.metaTitle || undefined,
    metaDescription: values.metaDescription || undefined,
    ogImage: values.ogImage || undefined,
  };

  // `state` is deliberately never sent. The server derives it from the location, and
  // that derivation is what stops a Lagos listing being filed under another state to
  // dodge the statutory rent cap.

  // Ownership is only assignable by an administrator; the server forces an agent's own
  // id regardless, so sending it from an agent's session would be noise.
  if (isAdministrator && values.agent) payload.agent = values.agent;

  // A pin is optional — a listing can go live before the agent drops one — but a half
  // pair is meaningless, so both or neither.
  const lat = num(values._lat);
  const lng = num(values._lng);
  if (lat !== undefined && lng !== undefined) {
    payload.coordinates = { type: "Point", coordinates: [lng, lat] };
  }

  /**
   * Pricing branches on listing type, and the unused half is omitted rather than sent
   * empty: the model rejects rent terms on a sale outright, and a stale price left on
   * a listing switched to rent would render alongside the rent figure.
   */
  if (isRent) {
    payload.rent = {
      amount: num(values.rent.amount),
      period: values.rent.period,
      advanceYears: num(values.rent.advanceYears),
      agencyFeePct: num(values.rent.agencyFeePct),
      legalFeePct: num(values.rent.legalFeePct),
      cautionDeposit: num(values.rent.cautionDeposit),
      serviceCharge: num(values.rent.serviceCharge),
      serviceChargePeriod: values.rent.serviceChargePeriod || undefined,
    };
  } else {
    payload.price = {
      // On request is a genuine state, not a zero — the amount is left absent.
      amount: values.price.onRequest ? undefined : num(values.price.amount),
      currency: values.price.currency,
      isNegotiable: Boolean(values.price.isNegotiable),
      onRequest: Boolean(values.price.onRequest),
    };
  }

  // Land title is only sent when a type was chosen; an empty enum string would fail
  // schema validation on a listing that simply hasn't recorded its title yet.
  if (values.landTitle?.type) {
    payload.landTitle = {
      type: values.landTitle.type,
      gazetteNumber: values.landTitle.gazetteNumber || undefined,
      freeFromGovernmentAcquisition: Boolean(
        values.landTitle.freeFromGovernmentAcquisition,
      ),
      surveyPlanAvailable: Boolean(values.landTitle.surveyPlanAvailable),
    };
  }

  const infrastructure = values.infrastructure ?? {};
  payload.infrastructure = {
    power: infrastructure.power ?? [],
    water: infrastructure.water ?? [],
    metering: infrastructure.metering || undefined,
    floodRisk: infrastructure.floodRisk || undefined,
    hasFloodHistory: Boolean(infrastructure.hasFloodHistory),
    roadCondition: infrastructure.roadCondition || undefined,
    distanceToTarredRoadM: num(infrastructure.distanceToTarredRoadM),
    isGatedEstate: Boolean(infrastructure.isGatedEstate),
    estateName: infrastructure.estateName || undefined,
  };

  return payload;
}

/**
 * Every field path the editor registers.
 *
 * mapApiErrors uses it to decide whether a server message has an input to land on;
 * anything not listed here goes to the form-level banner instead of being dropped.
 * Kept beside the payload builder so the two are updated together.
 */
export const REGISTERED_PATHS = [
  "title",
  "description",
  "listingType",
  "propertyType",
  "status",
  "publicationState",
  "agent",
  "location",
  "landmark",
  "address",
  "bedrooms",
  "bathrooms",
  "toilets",
  "boysQuarters",
  "parkingSpaces",
  "builtAreaSqm",
  "yearBuilt",
  "price.amount",
  "price.currency",
  "rent.amount",
  "rent.period",
  "rent.advanceYears",
  "rent.agencyFeePct",
  "rent.legalFeePct",
  "rent.cautionDeposit",
  "rent.serviceCharge",
  "rent.serviceChargePeriod",
  "landTitle.type",
  "landTitle.gazetteNumber",
  "infrastructure.metering",
  "infrastructure.floodRisk",
  "infrastructure.roadCondition",
  "infrastructure.distanceToTarredRoadM",
  "infrastructure.estateName",
  "coverImage",
  "floorPlan",
  "metaTitle",
  "metaDescription",
  "ogImage",
];

/**
 * The statutory rent limits for a state, for the form's pre-submit warning.
 *
 * Advisory only. propertyModel's pre("validate") is the authority — this exists so a
 * Lagos listing flags an 11% agency fee before paying for the round trip.
 *
 * Takes: state (string), rules (object) — the served STATE_RENT_RULES table.
 * Returns: the matching rule object, or the table's default.
 */
export function rentRulesFor(state, rules) {
  return rules?.[state] ?? rules?.default ?? { maxAgencyFeePct: 100, maxAdvanceYears: 10 };
}
