/**
 * Homepage copy. Local to the repo rather than fetched from the database (spec §1):
 * this build does not need non-technical staff editing, and keeping copy in one module
 * still makes the copy-and-rebrand step a single-file edit (scope §9).
 *
 * No component below should contain a marketing sentence — it belongs here.
 */
const homeContent = {
  hero: {
    eyebrow: "Homes · Land · Commercial",
    heading: "Find the address you actually want.",
    subheading:
      "Search verified homes, land and commercial property across Nigeria — or tell us what you're looking for in plain English.",
    action: "Explore listings",
  },

  featured: {
    eyebrow: "Handpicked",
    title: "Featured listings",
    description: "A selection of what's currently available through our team.",
  },

  areas: {
    eyebrow: "Where we work",
    title: "Browse by area",
    description: "The neighbourhoods our team knows best.",
  },

  trust: {
    eyebrow: "Why work with us",
    title: "Property handled properly",
    points: [
      {
        title: "Title verified before listing",
        body: "Every listing states its land title — C of O, Governor's Consent, excision or gazette — so you know what you're buying into before you view.",
      },
      {
        title: "One agent, start to finish",
        body: "The consultant who shows you the property is the one who takes it through to completion. No handoffs, no repeating yourself.",
      },
      {
        title: "Honest pricing",
        body: "Rent is quoted per annum with the advance clearly stated, and agency fees follow the statutory limits in each state.",
      },
    ],
  },

  /*
   * Stats band.
   *
   * ⚠️ PLACEHOLDER FIGURES. These are not derived from the database and are not a claim
   * the agency has made — they exist so the layout can be evaluated against demo data.
   * Before any client launch they must either be replaced with numbers the agency will
   * stand behind, or the section removed. A fabricated "3,500 happy clients" on a live
   * site is the agency's exposure, not ours.
   *
   * `value` is a string, not a number: the "+" and the comma are part of the claim's
   * presentation and formatting them at render time buys nothing.
   */
  stats: [
    { value: "1,250+", label: "Properties listed", caption: "Across our portfolio" },
    { value: "3,500+", label: "Clients served", caption: "Buyers, sellers and tenants" },
    { value: "15+", label: "Prime locations", caption: "Lagos, Abuja and beyond" },
    { value: "10+", label: "Years of practice", caption: "In Nigerian real estate" },
  ],

  /*
   * Testimonials.
   *
   * ⚠️ PLACEHOLDER COPY, written for layout. `testimonialModel` exists in the backend
   * but has no public endpoint yet; when one ships, this section reads from the API and
   * this block is deleted. Publishing invented client quotes under real names would be
   * a misrepresentation — replace before launch, do not simply rename.
   */
  testimonials: {
    eyebrow: "What our clients say",
    title: "Trusted by discerning clients",
    items: [
      {
        quote:
          "They confirmed the title before we ever booked a viewing. That alone saved us a wasted trip to a property that was never going to complete.",
        name: "Placeholder client",
        role: "Buyer, Lekki",
      },
      {
        quote:
          "One consultant handled the whole let, start to finish. No being passed around, no explaining myself twice.",
        name: "Placeholder client",
        role: "Landlord, Ikoyi",
      },
      {
        quote:
          "The rent was quoted per annum with the advance stated up front. It is the first time an agency has been that plain with me about the numbers.",
        name: "Placeholder client",
        role: "Tenant, Ikeja",
      },
    ],
  },

  cta: {
    title: "Have a property to sell or let?",
    body: "We handle valuation, photography, listing and viewings. Tell us about the property and we'll come back to you.",
    action: "Talk to our team",
  },
};

export default homeContent;
