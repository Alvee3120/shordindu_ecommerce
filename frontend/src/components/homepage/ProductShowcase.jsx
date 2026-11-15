"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import ProductCard from "@/components/ProductCard";

const SKELETON_COUNT = 4;
const GAP_PX = 16;

// 2 full cards (with a peek of the next) on small, 3 on medium, 4 + peek on large.
const ROW_CARD =
  "w-[calc(47%-8px)] shrink-0 snap-start md:w-[calc(32%-11px)] lg:w-[calc(23.5%-12px)]";

/**
 * Homepage product row: title, optional View All link, and the products in one
 * horizontal, swipeable row — 2 / 3 / 4 full cards at <768 / 768–1023 / ≥1024,
 * with the next card peeking in to show there is more. Arrow buttons scroll by
 * one card. Used by the category sections (Saree, Men, Bag, Women) and the
 * automatic-discount sections. `products` are ProductCard-shaped
 * (see toCardProduct in lib/products).
 */
export default function ProductShowcase({
  title,
  subtitle = null,
  products = [],
  loading = false,
  viewAllHref = null,
}) {
  const scrollRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const items = loading ? Array.from({ length: SKELETON_COUNT }) : products;

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    // Deferred so this isn't a synchronous setState inside the effect body.
    const frame = requestAnimationFrame(updateArrows);
    const el = scrollRef.current;
    const observer = el ? new ResizeObserver(updateArrows) : null;
    if (el && observer) observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [loading, products.length, updateArrows]);

  const scrollByCard = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector("[data-card]");
    const step = card ? card.offsetWidth + GAP_PX : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <section className="w-full bg-background px-6 pt-16 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-10 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="font-sora text-2xl font-medium text-(--primary)">{title}</h2>
            {subtitle}
          </div>
          {!loading && viewAllHref && (
            <Link
              href={viewAllHref}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
            >
              View All
            </Link>
          )}
        </div>

        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={updateArrows}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((product, index) =>
              loading ? (
                <div
                  key={index}
                  className={`aspect-[4/5] animate-pulse bg-neutral-100 ${ROW_CARD}`}
                />
              ) : (
                <div key={product.id} data-card className={ROW_CARD}>
                  <ProductCard product={product} />
                </div>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            aria-label="Scroll products left"
            className={`absolute top-[38%] left-2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-700 shadow-md backdrop-blur transition-opacity hover:text-(--primary) ${
              canPrev ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <FiChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            aria-label="Scroll products right"
            className={`absolute top-[38%] right-2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-700 shadow-md backdrop-blur transition-opacity hover:text-(--primary) ${
              canNext ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <FiChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
