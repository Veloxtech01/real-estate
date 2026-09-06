import { Playfair_Display, Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import siteConfig from "@/config/site";
import { organizationJsonLd } from "@/lib/seo";
import { getSettings } from "@/lib/api/server";

// The core brand tokens a client rebrand can override — matches THEME_COLOR_KEYS in
// backend/controllers/adminSettingsController.js. Status/structural colors stay fixed
// design constants, not per-client brand values.
const THEME_COLOR_KEYS = [
  "ink",
  "ink-deep",
  "ink-raised",
  "ink-soft",
  "accent",
  "accent-text",
  "accent-hover",
  "surface",
  "surface-raised",
];

/**
 * Builds a `:root{...}` override for any brand color an administrator has set via
 * /admin/settings, or null when none are set.
 *
 * Placed in <body>, after globals.css's <link> (which Next injects in <head>), so it
 * wins the cascade by document order without needing React's resource hoisting.
 *
 * Takes: nothing. Returns: a promise resolving to a CSS string, or null.
 */
async function getThemeOverrideCss() {
  // Settings.get() self-creates, so this should never fail in normal operation — but
  // if the DB is unreachable at boot, fall back to globals.css's defaults rather than
  // failing the whole page.
  let data;
  try {
    data = await getSettings();
  } catch {
    return null;
  }

  // request()'s envelope-unwrap leaves one layer: { settings: {...} } — same shape
  // the property detail page reads `settings.settings.listingDisclaimer` from.
  const colors = data?.settings?.theme?.colors;
  if (!colors || typeof colors !== "object") return null;

  const declarations = THEME_COLOR_KEYS.filter((key) => colors[key]).map(
    (key) => `--color-${key}:${colors[key]};`,
  );

  return declarations.length > 0 ? `:root{${declarations.join("")}}` : null;
}

/**
 * Fonts are self-hosted through next/font (zero layout shift, no external request to
 * Google). Variable weights only — one file each, not one per weight.
 */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Title template gives every child page "<page> — <agency>" without repeating the name.
export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

/**
 * Root layout. Holds the font variables, the global toast portal, and (from Task 7)
 * the site header and footer.
 *
 * Async so it can read the theme's brand colors from Settings before the first
 * paint — this applies site-wide (public pages and the admin chrome), since admin
 * components already consume the same --color-accent/--color-ink tokens via Tailwind
 * utility classes, even though the admin's layout stays excluded from the marketing
 * restyle.
 */
export default async function RootLayout({ children }) {
  const themeOverrideCss = await getThemeOverrideCss();

  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {/* A client's brand colors, if set in /admin/settings — pure CSS, no JS, no
            hydration mismatch risk. Omitted entirely when no color has been set. */}
        {themeOverrideCss && <style>{themeOverrideCss}</style>}
        {/* Site-level structured data — emitted once, on every page. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        {/* Chrome lives in the (site) group, not here — /admin has its own. */}
        {children}
        {/* Single toast portal for the whole app — components call toast() directly. */}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
