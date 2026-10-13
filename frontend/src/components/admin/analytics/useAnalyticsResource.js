"use client";

import { useEffect, useState } from "react";

/**
 * Small data-fetch hook mirroring the dashboard's cancelled-guard pattern.
 * Returns { data, loading, error, reload }; `deps` re-runs the fetch.
 */
export function useAnalyticsResource(fetcher, deps, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(fetcher)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Something went wrong. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  return { data, loading, error, reload: () => setNonce((value) => value + 1) };
}
