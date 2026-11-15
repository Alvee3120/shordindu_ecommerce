"use client";

import { useEffect, useState } from "react";
import DiscountSection from "@/components/homepage/DiscountSection";
import {
  DISCOUNTS_CHANGED_EVENT,
  DISCOUNTS_CHANNEL,
  getDiscountShowcases,
} from "@/lib/discounts";
import { toCardProduct } from "@/lib/products";

// Re-check periodically so scheduled discounts appear and expired ones vanish
// while the homepage stays open.
const POLL_INTERVAL_MS = 60_000;

function DiscountShowcaseSkeleton() {
  return (
    <section className="w-full bg-background px-6 pt-16 sm:px-8" aria-hidden="true">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-10 space-y-3">
          <div className="h-7 w-48 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="w-[calc(50%-8px)] shrink-0 md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)]"
            >
              <div className="aspect-[4/5] w-full animate-pulse bg-neutral-100" />
              <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
              <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * One homepage section per live automatic discount, titled with the name the
 * admin gave it. Fetched on the client (no-store) so an admin's create / edit /
 * activate / delete shows up immediately — same tab via a window event, other
 * tabs via BroadcastChannel — with polling as the safety net for start/expiry.
 */
export default function DiscountShowcases() {
  const [sections, setSections] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let channel = null;

    const refresh = () => {
      getDiscountShowcases().then((data) => {
        if (!cancelled) setSections(data);
      });
    };

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener(DISCOUNTS_CHANGED_EVENT, refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(DISCOUNTS_CHANNEL);
      channel.onmessage = refresh;
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(DISCOUNTS_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      channel?.close();
    };
  }, []);

  if (sections === null) return <DiscountShowcaseSkeleton />;
  if (sections.length === 0) return null;

  return sections.map((section) => (
    <DiscountSection
      key={section.id}
      section={section}
      products={section.products.map(toCardProduct)}
    />
  ));
}
