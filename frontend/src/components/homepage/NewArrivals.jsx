"use client";

import { useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { listProducts } from "@/lib/products";

export default function NewArrivals() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listProducts({ page_size: 8 })
      .then((data) => {
        if (cancelled) return;
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
    <section className="w-full bg-white px-6 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-10 flex items-center gap-3">
          <span className="font-sora text-2xl font-medium text-neutral-500">New Arrivals</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] w-full animate-pulse rounded-3xl bg-neutral-100"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => {
              const primaryImage =
                product.images?.find((img) => img.is_primary)?.image ||
                product.images?.[0]?.image ||
                null;
              const price = product.variations?.[0]?.price;

              return (
                <ProductCard
                  key={product.id}
                  product={{
                    name: product.name,
                    description: product.description,
                    image: primaryImage,
                    price: price ?? "—",
                    href: `/shop/${product.slug}`,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
