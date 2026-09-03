/**
 * Loading placeholders. Skeletons rather than spinners, sized to match the real
 * content, so nothing reflows when data arrives.
 */
export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded bg-ink/5 ${className}`} aria-hidden="true" />;
}

/**
 * A skeleton shaped exactly like PropertyCard: 4/3 image, title, meta row, price.
 * Keep these dimensions in step with PropertyCard or the grid will jump on load.
 */
export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    </div>
  );
}

export default Skeleton;
