"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import ProductCard from "@/components/ProductCard";
import { listProducts } from "@/lib/products";
import { getCategories, buildCategoryTree } from "@/lib/categories";

const WOMEN_CATEGORY_NAME = "women";

export default function NewArrivals() {
  const [products, setProducts] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  const scrollByCard = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("[data-card]")?.offsetWidth ?? 160;
    el.scrollBy({ left: direction * (cardWidth + 12), behavior: "smooth" });
  };

  useEffect(() => {
    let cancelled = false;

    getCategories()
      .then((data) => {
        if (cancelled) return null;
        const results = Array.isArray(data) ? data : data.results ?? [];
        const women = results.find((cat) => cat.name?.trim().toLowerCase() === WOMEN_CATEGORY_NAME);
        if (!women) {
          setLoading(false);
          return null;
        }
        setCategoryId(women.id);
        const [womenWithChildren] = buildCategoryTree(results).filter((cat) => cat.id === women.id);
        const categoryIds = [women.id, ...(womenWithChildren?.children.map((c) => c.id) ?? [])];
        return listProducts({ category: categoryIds.join(","), page_size: 4 });
      })
      .then((data) => {
        if (cancelled || !data) return;
        setProducts(data.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section className="w-full bg-white px-6 pt-16 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-10 flex items-center justify-between gap-3">
          <span className="font-sora text-2xl font-medium text-(--primary)">Shordindu Women</span>
          {!loading && categoryId != null && (
            <Link
              href={`/shop?category=${categoryId}`}
              className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900"
            >
              View All
            </Link>
          )}
        </div>

        <div className="relative">
          {loading ? (
            <div
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/5] w-[47%] shrink-0 animate-pulse snap-start rounded-2xl bg-neutral-100 sm:w-auto sm:shrink sm:rounded-3xl"
                />
              ))}
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden"
            >
              {products.map((product) => {
                const primaryImage =
                  product.images?.find((img) => img.is_primary)?.image ||
                  product.images?.[0]?.image ||
                  null;
                const price = product.variations?.[0]?.price;

                return (
                  <div key={product.id} data-card className="w-[47%] shrink-0 snap-start sm:w-auto sm:shrink">
                    <ProductCard
                      product={{
                        name: product.name,
                        description: product.description,
                        image: primaryImage,
                        price: price ?? "—",
                        href: `/shop/${product.id}`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

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
