import Container from "@/components/ui/Container";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Streamed fallback for the results route. Card skeletons match PropertyCard's
 * dimensions so the grid does not jump when the real data arrives.
 */
export default function Loading() {
  return (
    <Container className="py-10">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-4 h-5 w-40" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </Container>
  );
}
