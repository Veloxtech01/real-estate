"use client";

import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

/**
 * Global error boundary. Must be a client component — Next requires it.
 *
 * The API's own message is never shown here: it can carry internal detail, and by this
 * point the visitor only needs a way forward.
 */
export default function Error({ reset }) {
  return (
    <Container className="py-28 text-center md:py-40">
      <h1 className="text-4xl text-ink md:text-5xl">Something went wrong</h1>
      <p className="mx-auto mt-4 max-w-[52ch] text-ink-soft">
        We couldn&apos;t load this page. Please try again — if it keeps happening, give us a
        call.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {/* reset() re-renders the segment without a full page reload. */}
        <Button onClick={() => reset()}>Try again</Button>
        <Button href="/" variant="secondary">
          Back to home
        </Button>
      </div>
    </Container>
  );
}
