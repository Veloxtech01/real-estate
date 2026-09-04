import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

/**
 * Layout for the public marketing site.
 *
 * The header and footer live here rather than in the root layout so they do not render
 * inside /admin, which has its own chrome. "(site)" is a route group — the parentheses
 * mean it contributes nothing to the URL, so every public path is unchanged.
 *
 * not-found.js and error.js were moved into this group deliberately: a root-level
 * not-found renders outside every group's layout, which would strip the navigation off
 * the 404 page — exactly the page a visitor who mistyped a listing URL needs it on.
 */
export default function SiteLayout({ children }) {
  return (
    <>
      <Header />
      {/* Grows so the footer sits at the bottom on short pages. */}
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
