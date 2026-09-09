/**
 * Privacy notice and terms-of-use copy (§4.1, §11). Same hardcoded-in-content-file
 * pattern as about/services/contact — not pageModel-backed, see the marketing-pages
 * design spec's content-source decision.
 *
 * PLACEHOLDER LEGAL TEXT: §11 requires both documents be reviewed by a Nigerian
 * lawyer before launch. This copy is drafted to be accurate about what the site
 * actually does (forms, cookies, NDPA 2023 rights) but is not a substitute for that
 * review — same "flag it, don't fake it" status as the homepage placeholder stats.
 */

// Contact/enquiry/viewing/list-property forms all collect this; kept as one list so
// both documents describe the same data rather than drifting into two descriptions.
const COLLECTED_DATA = [
  "Name, email address and phone number, when you submit an enquiry, request a viewing, or list a property with us",
  "The content of your message or requirement, including any property or budget details you choose to share",
  "Pages you visit and how you found the site, if analytics is enabled (see \"Cookies and analytics\" below)",
];

export const privacyContent = {
  eyebrow: "Legal",
  title: "Privacy notice",
  description:
    "How we collect, use and protect the personal information you share with us.",
  updated: "9 September 2026",
  sections: [
    {
      heading: "Who this notice covers",
      body: [
        "This notice explains how we handle personal data collected through this website — the contact form, property enquiry form, viewing request form and the \"list your property with us\" form. It applies to visitors and prospective buyers, tenants, landlords and sellers.",
      ],
    },
    {
      heading: "What we collect",
      list: COLLECTED_DATA,
    },
    {
      heading: "Why we collect it",
      body: [
        "We use this information to respond to your enquiry, schedule and manage property viewings, and follow up on a property you've asked us to sell or let on your behalf. We do not sell your personal data to third parties, and we do not use it to generate marketing content or train any automated system.",
      ],
    },
    {
      heading: "Legal basis and retention",
      body: [
        "We process your data under the Nigeria Data Protection Act 2023 (NDPA), on the basis that it is necessary to respond to a request you have made to us. We keep enquiry and viewing records for as long as needed to service your request and meet our own record-keeping obligations, after which they are deleted.",
      ],
    },
    {
      heading: "Cookies and analytics",
      body: [
        "This site may use analytics tools to understand how visitors use it, such as which pages are viewed. Analytics data is aggregated and is not used to identify you personally. No advertising or third-party tracking cookies are set.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "Under the NDPA, you may ask us to confirm what personal data we hold about you, correct it if it's inaccurate, or delete it. To exercise any of these rights, contact us using the details below.",
      ],
    },
    {
      heading: "Contact us",
      body: [
        "For any question about this notice or your personal data, reach us through the contact details in the site footer.",
      ],
    },
  ],
};

export const termsContent = {
  eyebrow: "Legal",
  title: "Terms of use",
  description: "The terms that apply when you use this website.",
  updated: "9 September 2026",
  sections: [
    {
      heading: "Acceptance of these terms",
      body: [
        "By using this website you agree to these terms. If you do not agree, please do not use the site.",
      ],
    },
    {
      heading: "Listing information",
      body: [
        "Property listings on this site are provided for general information and do not constitute a legal offer. We do not warrant title to any property listed, and prospective buyers and tenants must conduct their own independent legal and physical due diligence before proceeding with a transaction. Prices, availability and specifications are subject to change without notice.",
      ],
    },
    {
      heading: "Use of the site",
      body: [
        "You agree to use this site only for lawful purposes — to browse listings, make genuine enquiries and, where invited, submit a property for our consideration. You may not use automated means to scrape or copy listing content, or submit false or misleading information through any form on this site.",
      ],
    },
    {
      heading: "Intellectual property",
      body: [
        "The site design, text, and our own photography are our property or that of our licensors and may not be reproduced without permission. Listing photographs remain the property of their respective owners.",
      ],
    },
    {
      heading: "Limitation of liability",
      body: [
        "We make reasonable efforts to keep listing information accurate but do not guarantee it. To the extent permitted by law, we are not liable for any loss arising from reliance on information published on this site.",
      ],
    },
    {
      heading: "Governing law",
      body: ["These terms are governed by the laws of the Federal Republic of Nigeria."],
    },
    {
      heading: "Changes to these terms",
      body: [
        "We may update these terms from time to time. The date at the top of this page shows when it was last revised.",
      ],
    },
    {
      heading: "Contact us",
      body: [
        "For any question about these terms, reach us through the contact details in the site footer.",
      ],
    },
  ],
};
