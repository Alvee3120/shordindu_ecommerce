"use client";

import { useRef } from "react";
import Link from "next/link";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import ProductCard from "@/components/ProductCard";

const VISIBLE_PRODUCTS = 4;

/**
 * Homepage product section: title, View All link, and a 4-up grid that turns
 * into a swipeable row with arrows on mobile. Pure presentation — shared by
 * the category sections (CategorySection) and the automatic-discount
 * sections (DiscountShowcases). `products` are ProductCard-shaped
 * (see toCardProduct in lib/products). `subtitle` renders under the title
 * (e.g. a discount's countdown).
 */
export default function ProductShowcase({ title, subtitle = null, products = [], loading = false, viewAllHref = null }) {
  const scrollRef = useRef(null);

  const scrollByCard = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("[data-card]")?.offsetWidth ?? 160;
    el.scrollBy({ left: direction * (cardWidth + 12), behavior: "smooth" });
  };

  const gridItems = loading ? Array.from({ length: VISIBLE_PRODUCTS }) : products.slice(0, VISIBLE_PRODUCTS);

  return (
    <section className="w-full bg-white px-6 pt-16 sm:px-8">
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
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
          >
            {gridItems.map((product, i) =>
              loading ? (
                <div
                  key={i}
                  className="aspect-[4/5] w-[47%] shrink-0 animate-pulse snap-start rounded-2xl bg-neutral-100 sm:w-auto sm:shrink sm:rounded-3xl"
                />
              ) : (
                <div key={product.id} data-card className="w-[47%] shrink-0 snap-start sm:w-auto sm:shrink">
                  <ProductCard product={product} />
                </div>
              )
            )}
          </div>

          {!loading && products.length > 2 && (
            <>
              <button
                type="button"
                onClick={() => scrollByCard(-1)}
                aria-label="Scroll left"
                className="absolute top-1/2 left-0 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-md sm:hidden"
              >
                <FiChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => scrollByCard(1)}
                aria-label="Scroll right"
                className="absolute top-1/2 right-0 flex h-8 w-8 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-md sm:hidden"
              >
                <FiChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
