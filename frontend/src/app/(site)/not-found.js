import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

/**
 * Global 404. Also what a draft or soft-deleted listing renders — deliberately
 * identical to a slug that never existed, so the response never leaks that a hidden
 * reference is real.
 */
export default function NotFound() {
  return (
    <Container className="py-28 text-center md:py-40">
      <p className="text-xs uppercase tracking-[0.08em] text-accent-text">404</p>
      <h1 className="mt-4 text-4xl text-ink md:text-5xl">We couldn&apos;t find that page</h1>
      <p className="mx-auto mt-4 max-w-[52ch] text-ink-soft">
        The listing may have been taken off the market, or the link may be wrong.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button href="/properties">Browse listings</Button>
        <Button href="/" variant="secondary">
          Back to home
        </Button>
      </div>
    </Container>
  );
}
