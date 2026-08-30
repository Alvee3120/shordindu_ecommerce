"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiFilter, FiX } from "react-icons/fi";
import ProductCard from "@/components/ProductCard";
import FilterSidebar from "@/components/shop/FilterSidebar";
import MobileFilterDrawer from "@/components/shop/MobileFilterDrawer";
import Pagination from "@/components/shop/Pagination";
import { listProducts, toCardProduct } from "@/lib/products";
import { getCategories } from "@/lib/categories";

const PAGE_SIZE = 12;

function ShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSearch = searchParams.get("search") || "";
  const urlParentCategories = searchParams.get("category") || ""; // comma-separated parent ids
  const urlSubcategories = searchParams.get("subcategories") || ""; // comma-separated child ids
  const urlMinPrice = searchParams.get("min_price") || "";
  const urlMaxPrice = searchParams.get("max_price") || "";
  const urlPage = Number(searchParams.get("page") || "1");

  const [categoryList, setCategoryList] = useState([]);
  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Draft filters (mirror URL, edited locally, committed via updateUrl/applyFilters)
  const [draftFilters, setDraftFilters] = useState({
    parentCategories: urlParentCategories ? urlParentCategories.split(",") : [],
    childCategories: urlSubcategories ? urlSubcategories.split(",") : [],
    minPrice: urlMinPrice,
    maxPrice: urlMaxPrice,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing draft filters from URL params
    setDraftFilters({
      parentCategories: urlParentCategories ? urlParentCategories.split(",") : [],
      childCategories: urlSubcategories ? urlSubcategories.split(",") : [],
      minPrice: urlMinPrice,
      maxPrice: urlMaxPrice,
    });
  }, [urlParentCategories, urlSubcategories, urlMinPrice, urlMaxPrice]);

  useEffect(() => {
    getCategories()
      .then((data) => setCategoryList(Array.isArray(data) ? data : data?.results ?? []))
      .catch(() => setCategoryList([]));
  }, []);

  // A parent includes itself and its children. Child selections are added to
  // that set, so shoppers can combine any number of parent and child filters.
  const resolveCategoryParam = useCallback(
    (parentCategories, childCategories) => {
      const categoryIds = new Set(childCategories);
      parentCategories.forEach((parentCategory) => {
        categoryIds.add(parentCategory);
        categoryList
          .filter((c) => String(c.parent) === String(parentCategory))
          .forEach((c) => categoryIds.add(String(c.id)));
      });
      return categoryIds.size > 0 ? [...categoryIds].join(",") : undefined;
    },
    [categoryList]
  );

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off loading state for the fetch below
    setLoading(true);
    const categoryParam = resolveCategoryParam(
      urlParentCategories ? urlParentCategories.split(",") : [],
      urlSubcategories ? urlSubcategories.split(",") : []
    );
    listProducts({
      page: urlPage,
      page_size: PAGE_SIZE,
      search: urlSearch || undefined,
      category: categoryParam,
      min_price: urlMinPrice || undefined,
      max_price: urlMaxPrice || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data) ? data : data?.results ?? [];
        setProducts(results.map(toCardProduct));
        setCount(Array.isArray(data) ? results.length : data?.count ?? results.length);
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          setCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [urlSearch, urlParentCategories, urlSubcategories, urlMinPrice, urlMaxPrice, urlPage, resolveCategoryParam]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const updateUrl = useCallback(
    (updates) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      router.push(`/shop?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router, searchParams]
  );

  // Parent selection is additive, so multiple category groups can be shown
  // together. Child selections remain independently selectable.
  const handleSelectParent = (parentId) => {
    setDraftFilters((prev) => {
      const id = String(parentId);
      const exists = prev.parentCategories.includes(id);
      const parentCategories = exists
        ? prev.parentCategories.filter((categoryId) => categoryId !== id)
        : [...prev.parentCategories, id];
      return { ...prev, parentCategories };
    });
  };

  // Child selection is additive (one or more children can be checked) and
  // narrows the grid to strictly those children.
  const handleToggleChild = (childId) => {
    setDraftFilters((prev) => {
      const id = String(childId);
      const exists = prev.childCategories.includes(id);
      const childCategories = exists
        ? prev.childCategories.filter((c) => c !== id)
        : [...prev.childCategories, id];
      return { ...prev, childCategories };
    });
  };

  const handlePriceChange = (key, value) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    updateUrl({
      category: draftFilters.parentCategories.join(",") || undefined,
      subcategories: draftFilters.childCategories.join(",") || undefined,
      min_price: draftFilters.minPrice || undefined,
      max_price: draftFilters.maxPrice || undefined,
      page: 1,
    });
  };

  const clearFilters = () => {
    setDraftFilters({ parentCategories: [], childCategories: [], minPrice: "", maxPrice: "" });
    router.push("/shop");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Auto-apply on desktop (no separate Apply button there)
  useEffect(() => {
    if (drawerOpen) return; // mobile applies explicitly
    const timeout = setTimeout(() => {
      const same =
        (urlParentCategories ? urlParentCategories.split(",") : []).join(",") ===
          draftFilters.parentCategories.join(",") &&
        (urlSubcategories ? urlSubcategories.split(",") : []).join(",") ===
          draftFilters.childCategories.join(",") &&
        urlMinPrice === draftFilters.minPrice &&
        urlMaxPrice === draftFilters.maxPrice;
      if (!same) applyFilters();
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFilters]);

  const heading = useMemo(() => {
    if (urlSearch) return `Search results for “${urlSearch}”`;
    return "Shop";
  }, [urlSearch]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 sm:pt-24 pb-16 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-sora truncate text-2xl font-bold text-neutral-900 sm:text-3xl">{heading}</h1>
          <p className="mt-1 text-sm text-neutral-500">{count} products found</p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-(--primary) hover:text-white lg:hidden"
        >
          <FiFilter size={16} />
          Filter
        </button>
      </div>

      {urlSearch && (
        <button
          type="button"
          onClick={() => updateUrl({ search: undefined, page: 1 })}
          className="mb-6 flex items-center gap-1.5 rounded-full bg-(--primary) px-3 py-1.5 text-xs font-medium text-white hover:bg-(--primary)/90"
        >
          {urlSearch}
          <FiX size={12} />
        </button>
      )}

      <div className="flex items-start gap-8">
        <aside className="sticky top-28 hidden w-64 shrink-0 lg:block">
          <FilterSidebar
            categoryList={categoryList}
            filters={draftFilters}
            onSelectParent={handleSelectParent}
            onToggleChild={handleToggleChild}
            onPriceChange={handlePriceChange}
            onApply={applyFilters}
            onClear={clearFilters}
          />
        </aside>

        <div className="sm:-mt-20 min-w-0 flex-1">
          {loading ? (
            <div className="grid min-h-screen grid-cols-2 gap-6 sm:grid-cols-3 ">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div key={i} className="aspect-[4/5.6] animate-pulse rounded-3xl bg-(--primary)/10" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 ">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-200 py-24 text-center">
              <p className="font-sora text-lg font-semibold text-neutral-700">No products found</p>
              <p className="mt-1 text-sm text-neutral-500">Try adjusting your search or filters.</p>
            </div>
          )}

          <Pagination
            currentPage={urlPage}
            totalPages={totalPages}
            onPageChange={(p) => updateUrl({ page: p })}
          />
        </div>
      </div>

      <MobileFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categoryList={categoryList}
        filters={draftFilters}
        onSelectParent={handleSelectParent}
        onToggleChild={handleToggleChild}
        onPriceChange={handlePriceChange}
        onApply={applyFilters}
        onClear={clearFilters}
      />
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopPageContent />
    </Suspense>
  );
}
