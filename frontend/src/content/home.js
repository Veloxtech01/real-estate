/**
 * Homepage copy. Local to the repo rather than fetched from the database (spec §1):
 * this build does not need non-technical staff editing, and keeping copy in one module
 * still makes the copy-and-rebrand step a single-file edit (scope §9).
 *
 * No component below should contain a marketing sentence — it belongs here.
 */
const homeContent = {
  hero: {
    heading: "Find the address you actually want.",
    subheading:
      "Search verified homes, land and commercial property across Nigeria — or tell us what you're looking for in plain English.",
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

  cta: {
    title: "Have a property to sell or let?",
    body: "We handle valuation, photography, listing and viewings. Tell us about the property and we'll come back to you.",
    action: "Talk to our team",
  },
};

export default homeContent;
