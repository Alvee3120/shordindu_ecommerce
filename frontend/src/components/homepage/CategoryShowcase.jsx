"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiArrowLeft, FiArrowRight, FiArrowUpRight } from "react-icons/fi";
import { getCategories } from "@/lib/categories";

const fallbackImage = "/assets/banner/bannerM.jpeg";
const GAP_PX = 16;

export default function CategoryShowcase() {
  const scrollRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brokenImages, setBrokenImages] = useState(() => new Set());
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data) ? data : data.results ?? [];
        setCategories(
          results
            .filter((cat) => cat.parent == null)
            .map((cat) => ({
              id: cat.id,
              label: cat.name,
              href: `/shop?category=${cat.id}`,
              image: cat.image || fallbackImage,
            }))
        );
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    // Defer so this isn't a synchronous setState inside the effect body.
    const frame = requestAnimationFrame(updateArrows);
    const el = scrollRef.current;
    const observer = el ? new ResizeObserver(updateArrows) : null;
    if (el && observer) observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [categories, updateArrows]);

  const scrollByCard = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector("[data-card]");
    const step = card ? card.offsetWidth + GAP_PX : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  if (!loading && categories.length === 0) return null;

  return (
    <section className="w-full bg-background px-6 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8">
          <h2 className="font-sora text-xl font-bold text-neutral-900 sm:text-2xl">
            Explore Our Exclusive Categories
          </h2>
          <p className="mt-1.5 text-xs text-neutral-500 sm:text-sm">
            Upgrade your closet with everything trendy and new
          </p>
        </div>

        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={updateArrows}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {categories.map((category) => (
              <Link
                key={category.id}
                href={category.href}
                data-card
                className="group w-[44%] shrink-0 snap-start sm:w-[calc(32%-11px)] md:w-[calc(23.5%-12px)]"
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-200">
                  <Image
                    src={brokenImages.has(category.id) ? fallbackImage : category.image}
                    alt={category.label}
                    fill
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 44vw, (max-width: 768px) 32vw, 23vw"
                    onError={() =>
                      setBrokenImages((prev) => new Set(prev).add(category.id))
                    }
                  />
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  <span className="text-sm font-medium text-neutral-900 sm:text-base">
                    {category.label}
                  </span>
                  <FiArrowUpRight
                    size={16}
                    className="shrink-0 text-neutral-500 transition-colors group-hover:text-(--primary)"
                  />
                </div>
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            aria-label="Scroll categories left"
            className={`absolute top-[38%] left-2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-700 shadow-md backdrop-blur transition-opacity hover:text-(--primary) ${
              canPrev ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <FiArrowLeft size={18} />
          </button>

          <button
            type="button"
            onClick={() => scrollByCard(1)}
            aria-label="Scroll categories right"
            className={`absolute top-[38%] right-2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-700 shadow-md backdrop-blur transition-opacity hover:text-(--primary) ${
              canNext ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <FiArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
