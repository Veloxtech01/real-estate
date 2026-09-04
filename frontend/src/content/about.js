/**
 * About-page copy (§3). Local to the repo rather than pageModel-backed — see the
 * design spec's content-source decision. Placeholder until the client supplies
 * their own history and credentials, same status as content/home.js.
 */
const aboutContent = {
  eyebrow: "Who we are",
  title: "About us",
  intro:
    "We handle residential and commercial sales, lettings and land across Nigeria — the kind of agency that verifies a title before it ever reaches a viewing.",
  story: {
    heading: "Our story",
    // PLACEHOLDER — replace with the agency's own history, years in operation and
    // what it is known for before this page goes live.
    body: "PLACEHOLDER — tell visitors how long you have been operating, the markets you specialise in, and what sets your service apart.",
  },
  values: {
    eyebrow: "How we work",
    title: "What you can expect",
    points: [
      {
        title: "Title verified before listing",
        body: "Every listing states its land title — C of O, Governor's Consent, excision or gazette — before it ever reaches a viewing.",
      },
      {
        title: "One consultant, start to finish",
        body: "The person who shows you a property is the one who takes it through to completion — no handoffs, no repeating yourself.",
      },
      {
        title: "Straightforward pricing",
        body: "Rent is quoted per annum with the advance stated up front, and our agency fees stay within the statutory limit in every state we operate.",
      },
    ],
  },
};

export default aboutContent;
