"use client";

import { useEffect } from "react";
import { DISCOUNTS_CHANGED_EVENT, DISCOUNTS_CHANNEL } from "@/lib/discounts";

/**
 * Calls `onChange` whenever an automatic discount is created, edited, activated
 * or deleted — same tab via a window event, other tabs via a BroadcastChannel.
 * Cart totals depend on which discounts are live, so a shopping page should
 * refetch its cart through this instead of waiting for a hard refresh.
 */
export function useDiscountChanges(onChange) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let channel = null;

    window.addEventListener(DISCOUNTS_CHANGED_EVENT, onChange);
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(DISCOUNTS_CHANNEL);
      channel.onmessage = onChange;
    }

    return () => {
      window.removeEventListener(DISCOUNTS_CHANGED_EVENT, onChange);
      channel?.close();
    };
  }, [onChange]);
}
