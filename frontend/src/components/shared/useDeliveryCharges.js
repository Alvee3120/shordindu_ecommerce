"use client";

import { useCallback, useEffect, useState } from "react";
import { getDeliveryCharges } from "@/lib/delivery";

/**
 * Current delivery-charge config (amounts + Dhaka zones) from the backend.
 * Fetched fresh on mount, so a storefront page always reflects the latest
 * values the admin saved. Returns { config, loading, error, reload }.
 */
export function useDeliveryCharges() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDeliveryCharges()
      .then((data) => {
        if (cancelled) return;
        setConfig(data);
        setError("");
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => {
    setLoading(true);
    setNonce((value) => value + 1);
  }, []);

  return { config, loading, error, reload };
}
