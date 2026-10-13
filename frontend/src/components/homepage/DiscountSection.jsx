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

  return (
    <ProductShowcase
      title={section.name}
      products={products}
      viewAllHref={`/shop?discount=${section.id}`}
      subtitle={<CountdownTimer endsAt={section.ends_at} onExpire={handleExpire} />}
    />
  );
}
