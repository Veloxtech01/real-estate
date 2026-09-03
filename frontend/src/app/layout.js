import { Playfair_Display, Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import siteConfig from "@/config/site";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

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
        <Header />
        {/* Grows to push the footer down on short pages. */}
        <main className="flex-1">{children}</main>
        <Footer />
        {/* Single toast portal for the whole app — components call toast() directly. */}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
