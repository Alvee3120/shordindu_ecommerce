"use client";

import { useCallback, useState } from "react";
import ProductShowcase from "@/components/homepage/ProductShowcase";
import CountdownTimer from "@/components/homepage/CountdownTimer";

/**
 * One live discount's homepage section, with a countdown to its end. When the
 * countdown hits zero the section hides itself, so a page left open doesn't
 * keep showing expired prices (the server stops returning it too).
 */
export default function DiscountSection({ section, products }) {
  const [expired, setExpired] = useState(false);
  const handleExpire = useCallback(() => setExpired(true), []);

  if (expired) return null;

  // Basket offers never change a product's price, so the section spells the
  // offer out ("Buy 3, get 20% off"); price-cut sections only need the countdown.
  const subtitle = (
    <div className="flex flex-wrap items-center gap-2">
      {section.label && (
        <span className="rounded-full bg-(--primary)/10 px-2.5 py-1 text-xs font-semibold text-(--primary)">
          {section.label}
        </span>
      )}
      <CountdownTimer endsAt={section.ends_at} onExpire={handleExpire} />
    </div>
  );

  return (
    <ProductShowcase
      title={section.name}
      products={products}
      viewAllHref={`/shop?discount=${section.id}`}
      subtitle={subtitle}
    />
  );
}
