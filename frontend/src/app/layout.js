import { Playfair_Display, Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import siteConfig from "@/config/site";
import { organizationJsonLd } from "@/lib/seo";

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
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">
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
