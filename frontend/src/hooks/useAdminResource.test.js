import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAdminResource } from "./useAdminResource";

describe("useAdminResource", () => {
  it("starts loading, then resolves data", async () => {
    const fetcher = vi.fn().mockResolvedValue({ enquiries: [{ _id: "1" }] });

    const { result } = renderHook(() => useAdminResource(fetcher, []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ enquiries: [{ _id: "1" }] });
    expect(result.current.error).toBeNull();
  });

  it("surfaces the normalised error and stops loading", async () => {
    const failure = new Error("Session expired");
    const fetcher = vi.fn().mockRejectedValue(failure);

    const { result } = renderHook(() => useAdminResource(fetcher, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(failure);
    expect(result.current.data).toBeNull();
  });

  it("refetches when a dependency changes", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    const { rerender } = renderHook(({ status }) => useAdminResource(fetcher, [status]), {
      initialProps: { status: "new" },
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    rerender({ status: "contacted" });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("refetch() re-runs the fetcher on demand", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useAdminResource(fetcher, []));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("ignores a stale response that resolves after a newer one", async () => {
    // Filter changes fire faster than the network answers. Without sequence tracking
    // the FIRST request's late response overwrites the second's, and the table shows
    // results for a filter the user already moved off.
    let resolveFirst;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const fetcher = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ label: "second" });

    const { result, rerender } = renderHook(
      ({ status }) => useAdminResource(fetcher, [status]),
      { initialProps: { status: "new" } },
    );

    rerender({ status: "contacted" });
    await waitFor(() => expect(result.current.data).toEqual({ label: "second" }));

    // The first request answers last — and must be discarded.
    await act(async () => {
      resolveFirst({ label: "first" });
      await first;
    });

    expect(result.current.data).toEqual({ label: "second" });
  });
});
