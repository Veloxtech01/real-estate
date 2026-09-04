"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Fetch one admin resource, with loading, error and manual refetch.
 *
 * Deliberately small: a data library would be a new dependency for four screens, and
 * the admin panel's needs are a read, a mutation, and a refetch. Mutations do NOT go
 * through this hook — a screen calls the API directly and then calls refetch().
 *
 * @param {() => Promise<object>} fetcher Returns the unwrapped `data` object.
 * @param {Array} deps Re-runs the fetcher when any of these change.
 * @returns {{data: object|null, loading: boolean, error: Error|null, refetch: () => Promise<void>}}
 */
export function useAdminResource(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Monotonic request id. Only the newest request may write to state — filter changes
  // fire faster than the network answers, and without this an older response landing
  // late would overwrite a newer one.
  const requestId = useRef(0);

  // The fetcher is usually an inline arrow, so a new identity every render. Holding it
  // in a ref keeps it out of the effect's dependency list, which would otherwise
  // re-fire on every render and loop.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);

    try {
      const result = await fetcherRef.current();
      // A newer request has already started — discard this answer entirely.
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (caught) {
      if (id !== requestId.current) return;
      // The Axios interceptor already normalised this; pass it through untouched so
      // callers can read `details` for field-level errors.
      setError(caught);
      setData(null);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: load };
}

export default useAdminResource;
