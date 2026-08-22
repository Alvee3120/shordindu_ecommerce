"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { getCategories } from "@/lib/categories";

const fallbackImage = "/assets/banner/bannerM.jpeg";

export default function CategoryShowcase() {
  const scrollRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data) ? data : data.results ?? [];
        setCategories(
          results.map((cat) => ({
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

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScrollProgress(max > 0 ? el.scrollLeft / max : 0);
  };

  // keep progress correct on resize / first mount
  useEffect(() => {
    handleScroll();
    window.addEventListener("resize", handleScroll);
    return () => window.removeEventListener("resize", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCardWidth = () => {
    const el = scrollRef.current;
    return el?.querySelector("[data-card]")?.offsetWidth ?? 260;
  };

  const scrollNext = () => {
    scrollRef.current?.scrollBy({ left: getCardWidth() + 24, behavior: "smooth" });
  };

  const scrollPrev = () => {
    scrollRef.current?.scrollBy({ left: -(getCardWidth() + 24), behavior: "smooth" });
  };

  /**
   * To show EXACTLY 5 cards on desktop screen:
   * - each card uses a fixed width (CSS variable)
   * - the container is max width large enough for 5 cards + 4 gaps
   */
  const desktopCardWidth = 240; // change if you want bigger/smaller
  const gapPx = 24;

  const containerStyle = useMemo(
    () => ({
      // 5 cards visible on desktop (if the screen is wide enough)
      maxWidth: `${desktopCardWidth * 5 + gapPx * 4}px`,
    }),
    [desktopCardWidth]
  );

  if (!loading && categories.length === 0) return null;

  return (
    <section className="w-full bg-white px-6 py-16 sm:px-8">
      <div className="mx-auto w-full" style={containerStyle}>
        {/* Section label */}
        <div className="mb-10 flex items-center gap-3">
          <span className="font-sora text-2xl font-medium text-neutral-500">
            Categories
          </span>

          {/* FIX: Tailwind arbitrary value syntax */}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
            </svg>
          </span>
        </div>

        {/* Row */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory items-end gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category, i) => {
            const isFirst = i === 0;

            // Like your screenshot: first card taller and sits a bit higher
            const cardWrapClass = isFirst ? "pt-0" : "pt-10"; // pushes smaller cards down

            return (
              <Link
                key={category.id}
                href={category.href}
                data-card
                className={["group relative flex-shrink-0 snap-start", cardWrapClass].join(" ")}
                style={{
                  width: desktopCardWidth, // ensures 5 cards can fit on desktop
                }}
              >
                <div
                  className={[
                    "relative w-full overflow-hidden bg-neutral-200",
                    "transition-transform duration-500 group-hover:scale-[0.985]",
                    isFirst ? "h-[420px] sm:h-[460px]" : "h-[320px] sm:h-[340px]",
                  ].join(" ")}
                  style={{
                    // angled top-right corner like the picture
                    clipPath: isFirst
                      ? "polygon(0 0, calc(100% - 56px) 0, 100% 56px, 100% 100%, 0 100%)"
                      : "polygon(0 0, calc(100% - 46px) 0, 100% 46px, 100% 100%, 0 100%)",
                    borderRadius: "28px",
                  }}
                >
                  <Image
                    src={category.image}
                    alt={category.label}
                    fill
                    priority={isFirst}
                    className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    sizes="240px"
                  />
                </div>

                {/* Label row */}
                <div className="mt-4 flex items-end justify-between gap-4">
                  <p
                    className={[
                      "leading-tight font-semibold text-neutral-900",
                      isFirst ? "text-lg" : "text-base",
                    ].join(" ")}
                  >
                    Shordindu —
                    <br />
                    {category.label}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Progress + buttons */}
        <div className="mt-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-neutral-200">
            <div
              className="h-px bg-neutral-900 transition-all duration-300"
              style={{ width: `${Math.max(scrollProgress * 100, 8)}%` }}
            />
          </div>

          <button
            type="button"
            onClick={scrollPrev}
            aria-label="Previous"
            className="flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
          >
            <FiArrowLeft size={16} />
            Prev
          </button>

          <button
            type="button"
            onClick={scrollNext}
            aria-label="Next"
            className="flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
          >
            Next
            <FiArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}