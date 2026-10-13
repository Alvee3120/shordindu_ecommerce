"use client";

import { useEffect, useState } from "react";
import ProductShowcase from "@/components/homepage/ProductShowcase";
import { listProducts, toCardProduct } from "@/lib/products";
import { getCategories, buildCategoryTree } from "@/lib/categories";

/**
 * Shared "trending category" homepage section — fetches a category by name
 * and renders its products in a grid/scroller with a View All link.
 */
export default function CategorySection({ categoryName, title }) {
  const [products, setProducts] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const targetName = categoryName.trim().toLowerCase();

    getCategories()
      .then((data) => {
        if (cancelled) return null;
        const results = Array.isArray(data) ? data : data.results ?? [];
        const category = results.find((cat) => cat.name?.trim().toLowerCase() === targetName);
        if (!category) {
          setLoading(false);
          return null;
        }
        setCategoryId(category.id);
        const [categoryWithChildren] = buildCategoryTree(results).filter((cat) => cat.id === category.id);
        const categoryIds = [category.id, ...(categoryWithChildren?.children.map((c) => c.id) ?? [])];
        return listProducts({ category: categoryIds.join(","), page_size: 5 });
      })
      .then((data) => {
        if (cancelled || !data) return;
        setProducts((data.results ?? []).map(toCardProduct));
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
  }, [categoryName]);

  if (!loading && products.length === 0) return null;

  return (
    <ProductShowcase
      title={title}
      products={products}
      loading={loading}
      viewAllHref={categoryId != null ? `/shop?category=${categoryId}` : null}
    />
  );
}
